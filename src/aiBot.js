// بات معمولی تلگرام که فقط برای ویرایش متن با هوش مصنوعی استفاده می‌شه.
// مدیریت پل‌های ارتباطی (کانال مبدا/مقصد) الان از طریق داشبورد وب انجام می‌شه.

const { Telegraf } = require("telegraf");
const axios = require("axios");

function startAiBot() {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.log("ℹ️ BOT_TOKEN تنظیم نشده، بخش ویرایش با هوش مصنوعی غیرفعاله.");
    return null;
  }

  const bot = new Telegraf(token);
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";

  bot.start((ctx) =>
    ctx.reply(
      "سلام! برای ویرایش متن با هوش مصنوعی:\n\n" +
        "۱. یه متن برام بفرست.\n" +
        "۲. روی همون پیام ریپلای کن و بگو باهاش چیکار کنم؛ مثلاً «سوالی‌اش کن» یا «رسمی‌ترش کن».\n\n" +
        "برای ساخت و مدیریت پل‌های ارتباطی بین کانال‌ها، به داشبورد وب پروژه سر بزن."
    )
  );

  bot.on("text", async (ctx) => {
    const msg = ctx.message;
    if (!msg.reply_to_message) return;

    const original = msg.reply_to_message.text || msg.reply_to_message.caption;
    const instruction = msg.text.trim();

    if (!original) {
      return ctx.reply("این پیامی که روش ریپلای کردی متن نداره.");
    }

    const waitMsg = await ctx.reply("⏳ در حال ویرایش...");

    try {
      const edited = await editWithInstruction(original, instruction, openRouterKey, model);
      await ctx.telegram.editMessageText(ctx.chat.id, waitMsg.message_id, undefined, edited);
    } catch (err) {
      console.error("خطا در تماس با هوش مصنوعی:", err.response?.data || err.message);
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        waitMsg.message_id,
        undefined,
        "❌ مشکلی توی ارتباط با هوش مصنوعی پیش اومد. دوباره امتحان کن."
      );
    }
  });

  bot.launch();
  console.log("🤖 بات ویرایش‌گر هوش مصنوعی روشن شد.");

  return bot;
}

async function editWithInstruction(originalText, instruction, apiKey, model) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model,
      messages: [
        {
          role: "system",
          content:
            "تو یه دستیار ویرایش متن فارسی هستی. کاربر یه متن اصلی و یه دستور ویرایش می‌ده. طبق دستور، متن رو ویرایش کن و فقط متن نهایی رو برگردون، بدون توضیح اضافه یا گیومه.",
        },
        { role: "user", content: `متن اصلی:\n${originalText}\n\nدستور ویرایش:\n${instruction}` },
      ],
    },
    { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }
  );

  return response.data.choices[0].message.content.trim();
}

module.exports = { startAiBot };
