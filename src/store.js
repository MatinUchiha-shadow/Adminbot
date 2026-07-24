// دسترسی به داده‌ها روی MongoDB: کاربرها و پل‌های ارتباطی هرکدوم.

const { getDb } = require("./db");
const { ObjectId } = require("mongodb");

function usersCol() {
  return getDb().collection("users");
}
function bridgesCol() {
  return getDb().collection("bridges");
}

function toId(id) {
  return typeof id === "string" ? new ObjectId(id) : id;
}

// ---------- کاربرها ----------
async function createUser({ email, passwordHash, isAdmin }) {
  const user = {
    email: email.toLowerCase().trim(),
    passwordHash,
    plan: "free",
    isAdmin: !!isAdmin,
    createdAt: new Date(),
  };
  const res = await usersCol().insertOne(user);
  return { ...user, _id: res.insertedId };
}

async function findUserByEmail(email) {
  return usersCol().findOne({ email: email.toLowerCase().trim() });
}

async function findUserById(id) {
  return usersCol().findOne({ _id: toId(id) });
}

async function listUsers() {
  return usersCol().find().sort({ createdAt: -1 }).toArray();
}

async function setUserPlan(id, plan) {
  await usersCol().updateOne({ _id: toId(id) }, { $set: { plan } });
  return findUserById(id);
}

// ---------- پل‌های ارتباطی ----------
async function getUserBridges(userId) {
  return bridgesCol().find({ userId: toId(userId) }).toArray();
}

async function getAllBridges() {
  return bridgesCol().find().toArray();
}

async function countUserBridges(userId) {
  return bridgesCol().countDocuments({ userId: toId(userId) });
}

async function addBridge(userId, { source, target, botToken, contentFilter }) {
  const bridge = {
    userId: toId(userId),
    source,
    target,
    botToken,
    contentFilter: contentFilter || "all",
    replacements: [],
    lastId: null,
    createdAt: new Date(),
  };
  const res = await bridgesCol().insertOne(bridge);
  return { ...bridge, _id: res.insertedId };
}

async function removeBridge(id, userId) {
  await bridgesCol().deleteOne({ _id: toId(id), userId: toId(userId) });
}

async function setLastId(id, lastId) {
  await bridgesCol().updateOne({ _id: toId(id) }, { $set: { lastId } });
}

async function addReplacement(id, userId, from, to) {
  await bridgesCol().updateOne(
    { _id: toId(id), userId: toId(userId) },
    { $push: { replacements: { from, to } } }
  );
  return bridgesCol().findOne({ _id: toId(id) });
}

async function removeReplacement(id, userId, index) {
  const bridge = await bridgesCol().findOne({ _id: toId(id), userId: toId(userId) });
  if (!bridge) return null;
  bridge.replacements.splice(index, 1);
  await bridgesCol().updateOne({ _id: toId(id) }, { $set: { replacements: bridge.replacements } });
  return bridge;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  listUsers,
  setUserPlan,
  getUserBridges,
  getAllBridges,
  countUserBridges,
  addBridge,
  removeBridge,
  setLastId,
  addReplacement,
  removeReplacement,
};
