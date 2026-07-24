// سرور وب: ثبت‌نام/ورود کاربر، مدیریت پل‌های ارتباطی خودش، و پنل ادمین.

const express = require("express");
const path = require("path");
const {
  createUser,
  findUserByEmail,
  findUserById,
  listUsers,
  setUserPlan,
  getUserBridges,
  countUserBridges,
  addBridge,
  removeBridge,
  addReplacement,
  removeReplacement,
} = require("./store");
const { hashPassword, comparePassword, signToken, verifyToken } = require("./auth");
const { getLogs } = require("./logs");

const FREE_PLAN_MAX_BRIDGES = 1;

function createServer() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "..", "public")));

  async function authRequired(req, res, next) {
    const header = req.headers["authorization"] || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "لازمه دوباره وارد بشی." });

    const user = await findUserById(payload.id);
    if (!user) return res.status(401).json({ error: "حساب پیدا نشد." });

    req.user = user;
    next();
  }

  function adminRequired(req, res, next) {
    if (!req.user.isAdmin) return res.status(403).json({ error: "دسترسی نداری." });
    next();
  }

  function publicUser(u) {
    return { id: u._id, email: u.email, plan: u.plan, isAdmin: u.isAdmin };
  }

  app.post("/api/register", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: "ایمیل و رمز (حداقل ۶ کاراکتر) لازمه." });
      }
      const existing = await findUserByEmail(email);
      if (existing) return res.status(400).json({ error: "این ایمیل قبلاً ثبت‌نام کرده." });

      const passwordHash = await hashPassword(password);
      const isAdmin = email.toLowerCase().trim() === (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
      const user = await createUser({ email, passwordHash, isAdmin });
      const token = signToken(user);
      res.json({ token, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ error: "خطای سرور: " + err.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const user = await findUserByEmail(email || "");
      if (!user) return res.status(401).json({ error: "ایمیل یا رمز اشتباهه." });

      const ok = await comparePassword(password || "", user.passwordHash);
      if (!ok) return res.status(401).json({ error: "ایمیل یا رمز اشتباهه." });

      const token = signToken(user);
      res.json({ token, user: publicUser(user) });
    } catch (err) {
      res.status(500).json({ error: "خطای سرور: " + err.message });
    }
  });

  app.get("/api/me", authRequired, (req, res) => {
    res.json(publicUser(req.user));
  });

  app.get("/api/bridges", authRequired, async (req, res) => {
    const bridges = await getUserBridges(req.user._id);
    res.json(bridges);
  });

  app.post("/api/bridges", authRequired, async (req, res) => {
    const { source, target, botToken, contentFilter } = req.body || {};
    if (!source || !target || !botToken) {
      return res.status(400).json({ error: "کانال مبدا، کانال مقصد و توکن ربات لازمه." });
    }

    const isFree = req.user.plan !== "paid";
    if (isFree) {
      const count = await countUserBridges(req.user._id);
      if (count >= FREE_PLAN_MAX_BRIDGES) {
        return res.status(403).json({
          error: `پلن رایگان فقط ${FREE_PLAN_MAX_BRIDGES} پل ارتباطی رو پشتیبانی می‌کنه. برای پل بیشتر، پلن پولی رو فعال کن.`,
        });
      }
    }

    const finalFilter = isFree ? "text" : contentFilter || "all";

    const bridge = await addBridge(req.user._id, {
      source: source.replace(/^@/, "").trim(),
      target: target.trim(),
      botToken: botToken.trim(),
      contentFilter: finalFilter,
    });
    res.json(bridge);
  });

  app.delete("/api/bridges/:id", authRequired, async (req, res) => {
    await removeBridge(req.params.id, req.user._id);
    res.json({ ok: true });
  });

  app.post("/api/bridges/:id/replacements", authRequired, async (req, res) => {
    if (req.user.plan !== "paid") {
      return res.status(403).json({ error: "جایگزینی متن فقط تو پلن پولیه." });
    }
    const { from, to } = req.body || {};
    if (!from) return res.status(400).json({ error: "کلمه‌ی مبدا لازمه." });
    const bridge = await addReplacement(req.params.id, req.user._id, from, to || "");
    if (!bridge) return res.status(404).json({ error: "پل پیدا نشد." });
    res.json(bridge);
  });

  app.delete("/api/bridges/:id/replacements/:index", authRequired, async (req, res) => {
    const bridge = await removeReplacement(req.params.id, req.user._id, parseInt(req.params.index, 10));
    if (!bridge) return res.status(404).json({ error: "پل پیدا نشد." });
    res.json(bridge);
  });

  app.get("/api/admin/users", authRequired, adminRequired, async (req, res) => {
    const users = await listUsers();
    res.json(users.map(publicUser));
  });

  app.post("/api/admin/users/:id/plan", authRequired, adminRequired, async (req, res) => {
    const { plan } = req.body || {};
    if (!["free", "paid"].includes(plan)) {
      return res.status(400).json({ error: "پلن نامعتبره." });
    }
    const user = await setUserPlan(req.params.id, plan);
    res.json(publicUser(user));
  });

  app.get("/api/logs", authRequired, adminRequired, (req, res) => {
    res.json(getLogs());
  });

  app.get("/health", (req, res) => res.send("ربات روشنه ✅"));

  return app;
}

module.exports = { createServer, FREE_PLAN_MAX_BRIDGES };
