require("dotenv").config();

const http = require("http");
const { startForwarder } = require("./forwarder");
const { startAiBot } = require("./aiBot");

// Render (و سرویس‌های مشابه) برای اینکه سرویس رو "زنده" نگه دارن، به یه پورت HTTP نیاز دارن.
// این یه سرور خیلی ساده‌ست که فقط "OK" برمی‌گردونه؛ UptimeRobot می‌تونه هر چند دقیقه بهش سر بزنه.
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ربات روشنه ✅");
  })
  .listen(PORT, () => console.log(`🌐 health-check سرور روی پورت ${PORT} روشنه`));

(async () => {
  console.log("=== شروع پروژه ===\n");

  startForwarder();
  startAiBot();

  console.log("\n✅ همه چی روشنه. Ctrl+C برای خاموش کردن.");
})();

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
