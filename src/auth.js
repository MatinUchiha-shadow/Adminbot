// ابزارهای رمزنگاری رمز عبور و ساخت/بررسی توکن ورود (JWT)

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SECRET = process.env.SESSION_SECRET || "change-this-secret-please";

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(user) {
  return jwt.sign({ id: user._id.toString(), email: user.email }, SECRET, {
    expiresIn: "60d",
  });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken };
