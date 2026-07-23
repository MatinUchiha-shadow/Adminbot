// ذخیره‌ی «پل‌های ارتباطی»: هر پل یه کانال مبدا، یه کانال مقصد، توکن ربات خودش،
// فیلتر نوع محتوا، و قوانین جایگزینی متن داره.

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

function defaultConfig() {
  return { bridges: [] };
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig(), null, 2));
  }
}

function readAll() {
  ensureFile();
  const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  if (!raw.bridges) raw.bridges = [];
  return raw;
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

function getBridges() {
  return readAll().bridges;
}

function getBridge(id) {
  return getBridges().find((b) => b.id === id) || null;
}

function addBridge({ source, target, botToken, contentFilter }) {
  const data = readAll();
  const bridge = {
    id: randomUUID(),
    source,
    target,
    botToken,
    contentFilter: contentFilter || "all",
    replacements: [],
    lastId: null,
    createdAt: Date.now(),
  };
  data.bridges.push(bridge);
  writeAll(data);
  return bridge;
}

function removeBridge(id) {
  const data = readAll();
  data.bridges = data.bridges.filter((b) => b.id !== id);
  writeAll(data);
}

function updateBridge(id, partial) {
  const data = readAll();
  const bridge = data.bridges.find((b) => b.id === id);
  if (!bridge) return null;
  Object.assign(bridge, partial);
  writeAll(data);
  return bridge;
}

function setLastId(id, lastId) {
  return updateBridge(id, { lastId });
}

function addReplacement(id, from, to) {
  const data = readAll();
  const bridge = data.bridges.find((b) => b.id === id);
  if (!bridge) return null;
  bridge.replacements.push({ from, to });
  writeAll(data);
  return bridge;
}

function removeReplacement(id, index) {
  const data = readAll();
  const bridge = data.bridges.find((b) => b.id === id);
  if (!bridge) return null;
  bridge.replacements.splice(index, 1);
  writeAll(data);
  return bridge;
}

module.exports = {
  getBridges,
  getBridge,
  addBridge,
  removeBridge,
  updateBridge,
  setLastId,
  addReplacement,
  removeReplacement,
};
