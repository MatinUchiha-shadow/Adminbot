// اتصال به MongoDB Atlas. یه‌بار وصل می‌شه و همون اتصال رو بقیه‌ی فایل‌ها استفاده می‌کنن.

const { MongoClient } = require("mongodb");

let client;
let db;

async function connectDb() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI تنظیم نشده. اول تو Environment Variables اضافه‌ش کن.");
  }
  client = new MongoClient(uri);
  await client.connect();
  db = client.db("admin_uchiha");
  console.log("🗄️  به MongoDB وصل شد.");
  return db;
}

function getDb() {
  if (!db) throw new Error("پایگاه داده هنوز وصل نشده.");
  return db;
}

module.exports = { connectDb, getDb };
