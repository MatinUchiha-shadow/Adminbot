require("dotenv").config();

const { connectDb } = require("./db");
const { createServer } = require("./server");
const { startForwarder } = require("./forwarder");
const { startAiBot } = require("./aiBot");

const PORT = process.env.PORT || 3000;

(async () => {
  console.log("=== شروع پروژه ===\n");

  await connectDb();

  const app = createServer();
  app.listen(PORT, () => console.log(`🌐 داشبورد وب روی پورت ${PORT} روشنه`));

  startForwarder();
  startAiBot();

  console.log("\n✅ همه چی روشنه.");
})().catch((err) => {
  console.error("❌ خطای راه‌اندازی:", err.message);
  process.exit(1);
});

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
