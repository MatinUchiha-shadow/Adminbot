// سرور وب داشبورد: صفحه‌ی مدیریت پل‌های ارتباطی + API که داشبورد باهاش کار می‌کنه.
// پشت یه رمز عبور ساده محافظت می‌شه چون آدرس سایت رو Render عمومی می‌کنه.

const express = require("express");
const path = require("path");
const {
  getBridges,
  addBridge,
  removeBridge,
  addReplacement,
  removeReplacement,
} = require("./store");
const { getLogs } = require("./logs");

function createServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  const PASSWORD = process.env.DASHBOARD_PASSWORD || "admin1234";
  if (!process.env.DASHBOARD_PASSWORD) {
    console.log(
      "⚠️ DASHBOARD_PASSWORD تنظیم نشده، رمز پیش‌فرض «admin1234» فعاله. " +
        "برای امنیت بیشتر، این متغیر رو تو Environment Variables اضافه کن."
    );
  }

  function auth(req, res, next) {
    if (req.headers["x-dashboard-password"] !== PASSWORD) {
      return res.status(401).json({ error: "رمز عبور اشتباهه." });
    }
    next();
  }

  app.post("/api/login", (req, res) => {
    const { password } = req.body || {};
    if (password === PASSWORD) return res.json({ ok: true });
    return res.status(401).json({ ok: false, error: "رمز عبور اشتباهه." });
  });

  app.get("/api/bridges", auth, (req, res) => {
    res.json(getBridges());
  });

  app.post("/api/bridges", auth, (req, res) => {
    const { source, target, botToken, contentFilter } = req.body || {};
    if (!source || !target || !botToken) {
      return res
        .status(400)
        .json({ error: "کانال مبدا، کانال مقصد و توکن ربات لازمه." });
    }
    const bridge = addBridge({
      source: source.replace(/^@/, "").trim(),
      target: target.trim(),
      botToken: botToken.trim(),
      contentFilter: contentFilter || "all",
    });
    res.json(bridge);
  });

  app.delete("/api/bridges/:id", auth, (req, res) => {
    removeBridge(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/bridges/:id/replacements", auth, (req, res) => {
    const { from, to } = req.body || {};
    if (!from) return res.status(400).json({ error: "کلمه‌ی مبدا لازمه." });
    const bridge = addReplacement(req.params.id, from, to || "");
    if (!bridge) return res.status(404).json({ error: "پل پیدا نشد." });
    res.json(bridge);
  });

  app.delete("/api/bridges/:id/replacements/:index", auth, (req, res) => {
    const bridge = removeReplacement(req.params.id, parseInt(req.params.index, 10));
    if (!bridge) return res.status(404).json({ error: "پل پیدا نشد." });
    res.json(bridge);
  });

  app.get("/api/logs", auth, (req, res) => {
    res.json(getLogs());
  });

  app.get("/health", (req, res) => res.send("ربات روشنه ✅"));

  return app;
}

module.exports = { createServer };
