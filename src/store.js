// ذخیره‌ی تنظیمات روی فایل JSON: چند کانال مبدا، یک کانال مقصد، و قوانین جایگزینی متن

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

function defaultConfig() {
  return { sources: [], target: null, lastIds: {}, replacements: [] };
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig(), null, 2));
  }
}

function getConfig() {
  ensureFile();
  const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  const cfg = { ...defaultConfig(), ...raw };

  if (raw.source && (!raw.sources || raw.sources.length === 0)) {
    cfg.sources = [raw.source];
  }
  if (raw.lastId != null && cfg.sources[0]) {
    cfg.lastIds = { ...cfg.lastIds, [cfg.sources[0]]: raw.lastId };
  }
  if (!cfg.lastIds) cfg.lastIds = {};
  if (!cfg.replacements) cfg.replacements = [];

  return cfg;
}

function writeConfig(cfg) {
  ensureFile();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  return cfg;
}

function saveConfig(partial) {
  const current = getConfig();
  return writeConfig({ ...current, ...partial });
}

function addSource(username) {
  const cfg = getConfig();
  if (!cfg.sources.includes(username)) cfg.sources.push(username);
  return writeConfig(cfg);
}

function removeSource(username) {
  const cfg = getConfig();
  cfg.sources = cfg.sources.filter((s) => s !== username);
  delete cfg.lastIds[username];
  return writeConfig(cfg);
}

function setLastId(username, id) {
  const cfg = getConfig();
  cfg.lastIds[username] = id;
  return writeConfig(cfg);
}

function addReplacement(from, to) {
  const cfg = getConfig();
  cfg.replacements.push({ from, to });
  return writeConfig(cfg);
}

function removeReplacement(index) {
  const cfg = getConfig();
  cfg.replacements.splice(index, 1);
  return writeConfig(cfg);
}

module.exports = {
  getConfig,
  saveConfig,
  addSource,
  removeSource,
  setLastId,
  addReplacement,
  removeReplacement,
};
