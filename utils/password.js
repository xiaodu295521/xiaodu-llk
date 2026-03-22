const bcrypt = require("bcryptjs");
const { env } = require("../config/env");

async function hashPassword(password) {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  hashPassword,
  comparePassword
};
