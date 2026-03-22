const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function extractBearerToken(req) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function sanitizeUser(user) {
  return {
    id: String(user._id),
    phone: user.phone,
    nickname: user.nickname,
    role: user.role,
    createdAt: user.createdAt
  };
}

function buildToken(user) {
  return jwt.sign(
    {
      userId: String(user._id),
      role: user.role
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      algorithm: "HS256"
    }
  );
}

function setAuthState(req, res, user) {
  const token = buildToken(user);

  req.session.user = {
    id: String(user._id),
    role: user.role
  };

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return token;
}

function createAuthenticateRequest(User) {
  return async function authenticateRequest(req, res, next) {
    try {
      let userId = req.session && req.session.user ? req.session.user.id : "";

      if (!userId) {
        const token = extractBearerToken(req) || req.cookies.token;

        if (!token) {
          return res.status(401).json({ success: false, message: "请先登录" });
        }

        const payload = jwt.verify(token, env.JWT_SECRET, {
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
          algorithms: ["HS256"]
        });

        userId = payload.userId;
        req.auth = {
          userId: payload.userId,
          role: payload.role
        };
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(401).json({ success: false, message: "登录状态已失效，请重新登录" });
      }

      req.currentUser = user;
      req.currentUserSafe = sanitizeUser(user);
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: "登录状态已失效，请重新登录" });
    }
  };
}

module.exports = {
  buildToken,
  setAuthState,
  sanitizeUser,
  createAuthenticateRequest
};
