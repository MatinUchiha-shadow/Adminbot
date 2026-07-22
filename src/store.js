// ذخیره ساده‌ی تنظیمات روی فایل JSON (بدون نیاز به دیتابیس)

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ source: null, target: null, lastId: null }, null, 2)
    );
  }
}

function getConfig() {
  ensureFile();
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

function saveConfig(partial) {
  ensureFile();
  const current = getConfig();
  const updated = { ...current, ...partial };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
  return updated;
}

module.exports = { getConfig, saveConfig };
