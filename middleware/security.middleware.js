const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const { env } = require("../config/env");
const { sanitizeRequestData } = require("../utils/request-sanitizer");

function createGeneralLimiter() {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "请求过于频繁，请稍后再试"
    }
  });
}

function createAuthLimiter() {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: env.NODE_ENV !== "production",
    message: {
      success: false,
      message: "登录或注册尝试过于频繁，请稍后再试"
    }
  });
}

function applySecurityMiddlewares(app) {
  app.use(helmet({
    crossOriginResourcePolicy: false
  }));
  app.use(createGeneralLimiter());
  app.use(mongoSanitize({
    replaceWith: "_"
  }));
  app.use(sanitizeRequestData);
}

module.exports = {
  applySecurityMiddlewares,
  createAuthLimiter
};
