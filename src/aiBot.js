// بات معمولی تلگرام که با اون چت می‌کنی. دو کار می‌کنه:
// ۱) تنظیم کانال مبدا/مقصد با فوروارد کردن یه پست از هرکدوم
// ۲) ویرایش متن با هوش مصنوعی: پیام اصلی رو می‌فرستی، روی همون ریپلای می‌کنی و دستور ویرایش رو می‌نویسی

const { Telegraf } = require("telegraf");
const axios = require("axios");
const { getConfig, saveConfig } = require("./store");

const userState = new Map();

function startAiBot() {
  const bot = new Telegraf(process.env.BOT_TOKEN);
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";

  bot.start((ctx) =>
    ctx.reply(
      "سلام! این چیزیه که ازم برمیاد:\n\n" +
        "📡 مانیتور کانال:\n" +
        "/setsource — تعیین کانال مبدا (باید عمومی باشه)\n" +
        "/settarget — تعیین کانال خودت (باید من رو اونجا ادمین کنی)\n" +
        "/status — دیدن وضعیت فعلی\n\n" +
        "✍️ ویرایش با هوش مصنوعی:\n" +
        "اول یه متن برام بفرست، بعد روی همون پیام ریپلای کن و بگو باهاش چیکار کنم؛ مثلاً «سوالی‌اش کن» یا «رسمی‌ترش کن».\n"
    )
  );

  bot.command("setsource", (ctx) => {
    userState.set(ctx.from.id, "awaiting_source");
    ctx.reply(
      "یوزرنیم کانال مبدا رو برام بفرست (باید عمومی باشه)، مثلاً:\n@some_channel"
    );
  });

  bot.command("settarget", (ctx) => {
    userState.set(ctx.from.id, "awaiting_target");
    ctx.reply(
      "اول من رو تو کانال خودت ادمین کن (با دسترسی ارسال پیام).\n" +
        "بعدش یا یوزرنیمش رو بفرست (مثلاً @my_channel)، یا اگه خصوصیه یه پست از همون کانال رو برام فوروارد کن."
    );
  });

  bot.command("status", (ctx) => {
    const { source, target } = getConfig();
    ctx.reply(
      `📡 کانال مبدا: ${source ? source : "❌ تنظیم نشده (با /setsource تنظیمش کن)"}\n` +
        `📤 کانال مقصد: ${target ? target : "❌ تنظیم نشده (با /settarget تنظیمش کن)"}`
    );
  });

  bot.on("text", async (ctx, next) => {
    const state = userState.get(ctx.from.id);
    const text = ctx.message.text.trim();

    if (state === "awaiting_source" && text.startsWith("@")) {
      const username = text.replace(/^@/, "");
      saveConfig({ source: username, lastId: null });
      userState.delete(ctx.from.id);
      return ctx.reply(
        `✅ کانال مبدا تنظیم شد: @${username}\nاز الان به بعد پست‌های جدیدش رو چک می‌کنم.`
      );
    }

    if (state === "awaiting_target" && text.startsWith("@")) {
      const username = text.replace(/^@/, "");
      saveConfig({ target: `@${username}` });
      userState.delete(ctx.from.id);
      return ctx.reply(`✅ کانال مقصد تنظیم شد: @${username}`);
    }

    return next();
  });

  bot.on("message", async (ctx, next) => {
    const msg = ctx.message;
    const forwardedChat =
      msg.forward_from_chat && msg.forward_from_chat.type === "channel"
        ? msg.forward_from_chat
        : null;

    if (!forwardedChat) return next();

    const state = userState.get(ctx.from.id);

    if (state === "awaiting_target") {
      saveConfig({ target: forwardedChat.id });
      userState.delete(ctx.from.id);
      return ctx.reply(
        `✅ کانال مقصد تنظیم شد: ${forwardedChat.title || forwardedChat.id}\n` +
          "اگه هنوز کانال مبدا رو تنظیم نکردی، با /setsource ادامه بده."
      );
    }

    return next();
  });

  bot.on("text", async (ctx) => {
    const msg = ctx.message;

    if (!msg.reply_to_message) {
      return;
    }

    const original = msg.reply_to_message.text || msg.reply_to_message.caption;
    const instruction = msg.text.trim();

    if (!original) {
      return ctx.reply("این پیامی که روش ریپلای کردی متن نداره.");
    }

    const waitMsg = await ctx.reply("⏳ در حال ویرایش...");

    try {
      const edited = await editWithInstruction(
        original,
        instruction,
        openRouterKey,
        model
      );
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        waitMsg.message_id,
        undefined,
        edited
      );
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
  console.log("🤖 بات هوش مصنوعی روشن شد.");

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
            "تو یه دستیار ویرایش متن فارسی هستی. کاربر یه متن اصلی و یه دستور ویرایش می‌ده (مثلاً تبدیل به سوال، تغییر لحن، خلاصه کردن و ...). طبق دستور، متن رو ویرایش کن و فقط متن نهایی رو برگردون، بدون توضیح اضافه یا گیومه.",
        },
        {
          role: "user",
          content: `متن اصلی:\n${originalText}\n\nدستور ویرایش:\n${instruction}`,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content.trim();
}

module.exports = { startAiBot };
