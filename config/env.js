const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.join(__dirname, "..", ".env")
});

function toNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: toNumber(process.env.PORT, 3000),
  MONGODB_URI: process.env.MONGODB_URI || "",
  MONGODB_DB: process.env.MONGODB_DB || "llk_codex",
  JWT_SECRET: process.env.JWT_SECRET || "change-this-jwt-secret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  JWT_ISSUER: process.env.JWT_ISSUER || "llk-codex",
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || "llk-codex-users",
  SESSION_SECRET: process.env.SESSION_SECRET || "change-this-session-secret",
  BCRYPT_ROUNDS: toNumber(process.env.BCRYPT_ROUNDS, 12),
  TRUST_PROXY: toNumber(process.env.TRUST_PROXY, 0),
  RATE_LIMIT_WINDOW_MS: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  RATE_LIMIT_MAX: toNumber(process.env.RATE_LIMIT_MAX, 200),
  AUTH_RATE_LIMIT_MAX: toNumber(process.env.AUTH_RATE_LIMIT_MAX, 10),
  ADMIN_PHONE: process.env.ADMIN_PHONE || "13900000000",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123456",
  ADMIN_NICKNAME: process.env.ADMIN_NICKNAME || "系统管理员"
};

function validateEnv() {
  if (env.NODE_ENV === "production") {
    if (!env.MONGODB_URI) {
      throw new Error("生产环境必须配置 MONGODB_URI");
    }

    if (env.JWT_SECRET === "change-this-jwt-secret") {
      throw new Error("生产环境必须替换 JWT_SECRET");
    }

    if (env.SESSION_SECRET === "change-this-session-secret") {
      throw new Error("生产环境必须替换 SESSION_SECRET");
    }
  }

  if (env.BCRYPT_ROUNDS < 10) {
    throw new Error("BCRYPT_ROUNDS 不能小于 10");
  }
}

module.exports = {
  env,
  validateEnv
};
