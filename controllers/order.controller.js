const mongoose = require("mongoose");
const { Order, ORDER_STATUS } = require("../models/order.model");
const Product = require("../models/product.model");

function sendSuccess(res, message, data, statusCode) {
  return res.status(statusCode || 200).json({
    success: true,
    message: message,
    data: data
  });
}

function sendError(res, message, statusCode, errors) {
  return res.status(statusCode || 400).json({
    success: false,
    message: message,
    errors: errors || null
  });
}

function formatValidationError(error) {
  if (error && error.name === "ValidationError") {
    return Object.keys(error.errors).map(function (key) {
      return {
        field: key,
        message: error.errors[key].message
      };
    });
  }

  return null;
}

function sanitizeOrder(orderDocument) {
  const rawOrder = orderDocument.toObject
    ? orderDocument.toObject({ versionKey: false })
    : { ...orderDocument };

  const order = {
    id: String(rawOrder._id || rawOrder.id),
    userId: rawOrder.userId,
    productId: rawOrder.productId,
    packageInfo: rawOrder.packageInfo,
    price: rawOrder.price,
    status: rawOrder.status,
    createdAt: rawOrder.createdAt,
    updatedAt: rawOrder.updatedAt
  };

  if (rawOrder.userId && typeof rawOrder.userId === "object") {
    order.user = {
      id: String(rawOrder.userId._id || rawOrder.userId.id || rawOrder.userId),
      phone: rawOrder.userId.phone,
      nickname: rawOrder.userId.nickname,
      role: rawOrder.userId.role
    };
    order.userId = String(order.user.id);
  } else if (rawOrder.userId) {
    order.userId = String(rawOrder.userId);
  }

  if (rawOrder.productId && typeof rawOrder.productId === "object") {
    order.product = {
      id: String(rawOrder.productId._id || rawOrder.productId.id || rawOrder.productId),
      name: rawOrder.productId.name,
      price: rawOrder.productId.price,
      flowGB: rawOrder.productId.flowGB,
      validDays: rawOrder.productId.validDays,
      isRecommended: rawOrder.productId.isRecommended,
      stock: rawOrder.productId.stock
    };
    order.productId = String(order.product.id);
  } else if (rawOrder.productId) {
    order.productId = String(rawOrder.productId);
  }

  return order;
}

async function resolveProductFromRequest(body) {
  const productId = body.productId;
  const productName = body.productName || body.planName || body.name;

  if (productId) {
    if (!mongoose.isValidObjectId(productId)) {
      return { error: "商品 ID 格式不正确" };
    }

    const productById = await Product.findById(productId);
    if (!productById) {
      return { error: "商品不存在" };
    }

    return { product: productById };
  }

  if (productName) {
    const productByName = await Product.findOne({ name: String(productName).trim() });
    if (!productByName) {
      return { error: "未找到对应商品，请先在商品系统中创建该套餐" };
    }

    return { product: productByName };
  }

  return { error: "商品 ID 不能为空" };
}

function isOwnerOrAdmin(req, orderId) {
  return req.currentUser.role === "admin"
    ? { _id: orderId }
    : { _id: orderId, userId: req.currentUser._id };
}

async function createOrder(req, res) {
  try {
    const resolved = await resolveProductFromRequest(req.body);

    if (resolved.error) {
      return sendError(res, resolved.error, 400);
    }

    const product = resolved.product;

    if (product.stock !== null && product.stock !== undefined && product.stock <= 0) {
      return sendError(res, "商品库存不足", 400);
    }

    const order = await Order.create({
      userId: req.currentUser._id,
      productId: product._id,
      packageInfo: {
        name: product.name,
        price: product.price,
        flowGB: product.flowGB,
        validDays: product.validDays,
        isRecommended: product.isRecommended,
        stock: product.stock
      },
      price: product.price,
      status: ORDER_STATUS.PENDING
    });

    if (product.stock !== null && product.stock !== undefined) {
      product.stock = Math.max(product.stock - 1, 0);
      await product.save();
    }

    return sendSuccess(res, "创建订单成功", sanitizeOrder(order), 201);
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return sendError(res, "订单数据校验失败", 400, formatValidationError(error));
    }

    return sendError(res, "创建订单失败", 500);
  }
}

async function getMyOrders(req, res) {
  try {
    const orders = await Order.find({ userId: req.currentUser._id })
      .sort({ createdAt: -1 })
      .populate("productId", "name price flowGB validDays isRecommended stock");

    return sendSuccess(
      res,
      "获取用户订单成功",
      orders.map(function (order) {
        return sanitizeOrder(order);
      })
    );
  } catch (error) {
    console.error(error);
    return sendError(res, "获取用户订单失败", 500);
  }
}

async function getAdminOrders(req, res) {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate("userId", "phone nickname role")
      .populate("productId", "name price flowGB validDays isRecommended stock");

    return sendSuccess(
      res,
      "获取管理员订单列表成功",
      orders.map(function (order) {
        return sanitizeOrder(order);
      })
    );
  } catch (error) {
    console.error(error);
    return sendError(res, "获取管理员订单列表失败", 500);
  }
}

async function confirmPayment(req, res) {
  try {
    const orderId = req.params.id;

    if (!mongoose.isValidObjectId(orderId)) {
      return sendError(res, "订单 ID 格式不正确", 400);
    }

    const order = await Order.findOne({
      _id: orderId,
      userId: req.currentUser._id
    })
      .populate("userId", "phone nickname role")
      .populate("productId", "name price flowGB validDays isRecommended stock");

    if (!order) {
      return sendError(res, "订单不存在", 404);
    }

    if (order.status !== ORDER_STATUS.PENDING) {
      return sendError(res, "当前订单状态不允许确认付款", 400);
    }

    order.status = ORDER_STATUS.PAID_PENDING_CONFIRM;
    await order.save();

    return sendSuccess(res, "已提交付款确认，请等待管理员核实", sanitizeOrder(order));
  } catch (error) {
    console.error(error);
    return sendError(res, "确认付款失败", 500);
  }
}

async function updateOrderStatus(req, res) {
  try {
    const orderId = req.params.id;
    const nextStatus = String(req.body.status || "").trim();

    if (!mongoose.isValidObjectId(orderId)) {
      return sendError(res, "订单 ID 格式不正确", 400);
    }

    if (!Object.values(ORDER_STATUS).includes(nextStatus)) {
      return sendError(res, "订单状态不合法", 400);
    }

    const order = await Order.findOne(isOwnerOrAdmin(req, orderId))
      .populate("userId", "phone nickname role")
      .populate("productId", "name price flowGB validDays isRecommended stock");

    if (!order) {
      return sendError(res, "订单不存在", 404);
    }

    if (req.currentUser.role !== "admin") {
      return sendError(res, "只有管理员可以直接修改订单状态", 403);
    }

    if (nextStatus === ORDER_STATUS.COMPLETED && order.status === ORDER_STATUS.PAID_PENDING_CONFIRM) {
      order.status = ORDER_STATUS.COMPLETED;
      await order.save();
      return sendSuccess(res, "订单已确认收款并完成", sanitizeOrder(order));
    }

    if (nextStatus === order.status) {
      return sendSuccess(res, "订单状态未发生变化", sanitizeOrder(order));
    }

    return sendError(res, "当前只允许将“已付款待确认”的订单更新为 completed", 400);
  } catch (error) {
    console.error(error);
    return sendError(res, "更新订单状态失败", 500);
  }
}

module.exports = {
  ORDER_STATUS: ORDER_STATUS,
  createOrder: createOrder,
  getMyOrders: getMyOrders,
  getAdminOrders: getAdminOrders,
  confirmPayment: confirmPayment,
  updateOrderStatus: updateOrderStatus
};
