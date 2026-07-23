require("dotenv").config();

const { createServer } = require("./server");
const { startForwarder } = require("./forwarder");
const { startAiBot } = require("./aiBot");

const PORT = process.env.PORT || 3000;
const app = createServer();
app.listen(PORT, () => console.log(`🌐 داشبورد وب روی پورت ${PORT} روشنه`));

(async () => {
  console.log("=== شروع پروژه ===\n");
  startForwarder();
  startAiBot();
  console.log("\n✅ همه چی روشنه.");
})();

process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
