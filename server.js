const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const { MongoMemoryServer } = require("mongodb-memory-server");
const createProductRoutes = require("./routes/product.routes");
const createOrderRoutes = require("./routes/order.routes");
const { env, validateEnv } = require("./config/env");
const User = require("./models/user.model");
const Product = require("./models/product.model");
const { Order, ORDER_STATUS } = require("./models/order.model");
const { hashPassword, comparePassword } = require("./utils/password");
const { sanitizeString } = require("./utils/request-sanitizer");
const { createAuthenticateRequest, setAuthState, sanitizeUser } = require("./middleware/auth.middleware");
const { requireAdmin } = require("./middleware/admin.middleware");
const { applySecurityMiddlewares, createAuthLimiter } = require("./middleware/security.middleware");

const app = express();
const ROOT_DIR = __dirname;
const PORT = env.PORT;

const DEFAULT_PRODUCTS = [
  { name: "星耀 5G 畅享卡", price: 39, flowGB: 120, validDays: 30, isRecommended: true, stock: 500 },
  { name: "轻享卡", price: 29, flowGB: 80, validDays: 30, isRecommended: true, stock: 500 },
  { name: "极速卡", price: 39, flowGB: 120, validDays: 30, isRecommended: true, stock: 500 },
  { name: "超享卡", price: 49, flowGB: 150, validDays: 30, isRecommended: true, stock: 300 },
  { name: "青春卡", price: 19, flowGB: 50, validDays: 15, isRecommended: false, stock: 400 },
  { name: "畅聊卡", price: 35, flowGB: 100, validDays: 30, isRecommended: false, stock: 260 },
  { name: "尊享卡", price: 59, flowGB: 200, validDays: 30, isRecommended: true, stock: 180 }
];

let memoryServer = null;

function isValidPhone(phone) {
  return /^1\d{10}$/.test(phone);
}

function sendServerError(res, error) {
  console.error(error);
  res.status(500).json({ success: false, message: "服务器内部错误" });
}

async function connectDatabase() {
  let mongoUri = env.MONGODB_URI;

  if (!mongoUri) {
    memoryServer = await MongoMemoryServer.create();
    mongoUri = memoryServer.getUri();
    console.log("Using in-memory MongoDB for development");
  }

  mongoose.set("sanitizeFilter", true);
  await mongoose.connect(mongoUri, {
    dbName: env.MONGODB_DB
  });

  return mongoUri;
}

async function ensureAdminUser() {
  const existingAdmin = await User.findOne({ phone: env.ADMIN_PHONE });

  if (existingAdmin) {
    if (existingAdmin.role !== "admin") {
      existingAdmin.role = "admin";
      await existingAdmin.save();
    }

    return existingAdmin;
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  const admin = await User.create({
    phone: env.ADMIN_PHONE,
    passwordHash: passwordHash,
    nickname: env.ADMIN_NICKNAME,
    role: "admin"
  });

  console.log("Seeded admin account:", env.ADMIN_PHONE);
  return admin;
}

async function ensureDefaultProducts() {
  const count = await Product.countDocuments();

  if (count > 0) {
    return;
  }

  await Product.insertMany(DEFAULT_PRODUCTS);
  console.log("Seeded default products:", DEFAULT_PRODUCTS.length);
}

async function bootstrap() {
  validateEnv();
  const mongoUri = await connectDatabase();
  await ensureAdminUser();
  await ensureDefaultProducts();

  if (env.TRUST_PROXY > 0) {
    app.set("trust proxy", env.TRUST_PROXY);
  }

  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(
    session({
      name: "kasu.sid",
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: mongoUri,
        collectionName: "sessions"
      }),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
      }
    })
  );

  applySecurityMiddlewares(app);
  app.use(express.static(ROOT_DIR));

  const authenticateRequest = createAuthenticateRequest(User);
  const authLimiter = createAuthLimiter();

  const productRoutes = createProductRoutes({
    authenticateRequest: authenticateRequest,
    requireAdmin: requireAdmin
  });
  const orderRoutes = createOrderRoutes({
    authenticateRequest: authenticateRequest,
    requireAdmin: requireAdmin
  });

  app.use("/products", productRoutes);
  app.use("/api/products", productRoutes);
  app.use("/orders", orderRoutes.orderRouter);
  app.use("/api/orders", orderRoutes.orderRouter);
  app.use("/admin", orderRoutes.adminRouter);
  app.use("/api/admin", orderRoutes.adminRouter);

  app.get("/api/health", function (req, res) {
    res.json({
      success: true,
      message: "Server is running",
      database: mongoose.connection.name,
      env: env.NODE_ENV
    });
  });

  app.post("/api/auth/register", authLimiter, async function (req, res) {
    try {
      const phone = sanitizeString(req.body.phone || "");
      const password = String(req.body.password || "");
      const nickname = sanitizeString(req.body.nickname || "");

      if (!isValidPhone(phone)) {
        return res.status(400).json({ success: false, message: "请输入正确的 11 位手机号" });
      }

      if (password.length < 8) {
        return res.status(400).json({ success: false, message: "密码长度不能少于 8 位" });
      }

      const exists = await User.findOne({ phone: phone });
      if (exists) {
        return res.status(400).json({ success: false, message: "该手机号已注册，请直接登录" });
      }

      const passwordHash = await hashPassword(password);
      const user = await User.create({
        phone: phone,
        passwordHash: passwordHash,
        nickname: nickname || ("新用户" + phone.slice(-4))
      });

      const token = setAuthState(req, res, user);

      res.json({
        success: true,
        message: "注册成功",
        token: token,
        user: sanitizeUser(user)
      });
    } catch (error) {
      sendServerError(res, error);
    }
  });

  app.post("/api/auth/login", authLimiter, async function (req, res) {
    try {
      const phone = sanitizeString(req.body.phone || "");
      const password = String(req.body.password || "");
      const user = await User.findOne({ phone: phone });

      if (!user) {
        return res.status(404).json({ success: false, message: "账号不存在，请先注册" });
      }

      const isMatch = await comparePassword(password, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: "密码错误，请重新输入" });
      }

      const token = setAuthState(req, res, user);

      res.json({
        success: true,
        message: "登录成功",
        token: token,
        user: sanitizeUser(user)
      });
    } catch (error) {
      sendServerError(res, error);
    }
  });

  app.get("/api/auth/me", authenticateRequest, function (req, res) {
    res.json({
      success: true,
      user: sanitizeUser(req.currentUser)
    });
  });

  app.post("/api/auth/logout", function (req, res) {
    res.clearCookie("token");
    req.session.destroy(function () {
      res.json({ success: true, message: "已退出登录" });
    });
  });

  app.get("/api/admin/summary", authenticateRequest, requireAdmin, async function (req, res) {
    try {
      const totalUsers = await User.countDocuments({ role: "user" });
      const totalOrders = await Order.countDocuments();
      const pendingOrders = await Order.countDocuments({ status: ORDER_STATUS.PENDING });
      const paidPendingConfirmOrders = await Order.countDocuments({ status: ORDER_STATUS.PAID_PENDING_CONFIRM });
      const completedOrders = await Order.countDocuments({ status: ORDER_STATUS.COMPLETED });
      const revenueResult = await Order.aggregate([
        { $group: { _id: null, totalRevenue: { $sum: "$price" } } }
      ]);

      res.json({
        success: true,
        summary: {
          totalUsers: totalUsers,
          totalOrders: totalOrders,
          pendingOrders: pendingOrders,
          paidPendingConfirmOrders: paidPendingConfirmOrders,
          shippedOrders: paidPendingConfirmOrders,
          completedOrders: completedOrders,
          totalRevenue: revenueResult[0] ? revenueResult[0].totalRevenue : 0
        }
      });
    } catch (error) {
      sendServerError(res, error);
    }
  });

  app.get("/api/admin/users", authenticateRequest, requireAdmin, async function (req, res) {
    try {
      const users = await User.find().sort({ createdAt: -1 }).lean();
      const userIds = users.map(function (user) { return user._id; });
      const orderCounts = await Order.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: "$userId", count: { $sum: 1 } } }
      ]);

      const countMap = orderCounts.reduce(function (accumulator, item) {
        accumulator[String(item._id)] = item.count;
        return accumulator;
      }, {});

      res.json({
        success: true,
        users: users.map(function (user) {
          return {
            id: String(user._id),
            phone: user.phone,
            nickname: user.nickname,
            role: user.role,
            createdAt: user.createdAt,
            orderCount: countMap[String(user._id)] || 0
          };
        })
      });
    } catch (error) {
      sendServerError(res, error);
    }
  });

  app.listen(PORT, function () {
    console.log("Server running at http://localhost:" + PORT);
  });
}

bootstrap().catch(function (error) {
  console.error("Failed to start server");
  console.error(error);

  if (memoryServer) {
    memoryServer.stop();
  }

  process.exit(1);
});
