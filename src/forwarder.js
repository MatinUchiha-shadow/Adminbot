// این بخش کانال مبدا (که باید عمومی باشه) رو با خوندن صفحه‌ی پیش‌نمایش عمومیش
// (t.me/s/username) هر چند ثانیه چک می‌کنه و پست‌های جدید رو با خودِ بات
// می‌فرسته تو کانال مقصد. هیچ لاگین یا API_ID/API_HASH لازم نداره.

const axios = require("axios");
const cheerio = require("cheerio");
const { getConfig, saveConfig } = require("./store");

const POLL_INTERVAL_MS = 15000;
const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

async function fetchChannelPage(username) {
  const url = `https://t.me/s/${username}`;
  const res = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ChannelMirrorBot/1.0)" },
    timeout: 15000,
  });
  return cheerio.load(res.data);
}

function extractMessages($) {
  const messages = [];

  $(".tgme_widget_message").each((_, el) => {
    const $el = $(el);
    const dataPost = $el.attr("data-post"); // مثل "channelname/123"
    if (!dataPost) return;

    const id = parseInt(dataPost.split("/").pop(), 10);
    if (!id) return;

    const $text = $el.find(".tgme_widget_message_text").first();
    $text.find("br").replaceWith("\n");
    const text = $text.text().trim();

    let photoUrl = null;
    const $photo = $el.find(".tgme_widget_message_photo_wrap").first();
    if ($photo.length) {
      const style = $photo.attr("style") || "";
      const match = style.match(/url\(['"]?(.*?)['"]?\)/);
      if (match) photoUrl = match[1];
    }

    const hasVideo = $el.find(".tgme_widget_message_video").length > 0;
    const hasDocument = $el.find(".tgme_widget_message_document").length > 0;

    messages.push({ id, text, photoUrl, hasVideo, hasDocument });
  });

  messages.sort((a, b) => a.id - b.id);
  return messages;
}

async function sendToTarget({ botToken, target, message, sourceUsername }) {
  const base = TELEGRAM_API(botToken);
  const originalLink = `https://t.me/${sourceUsername}/${message.id}`;

  try {
    if (message.photoUrl) {
      await axios.post(`${base}/sendPhoto`, {
        chat_id: target,
        photo: message.photoUrl,
        caption: message.text ? message.text.slice(0, 1024) : undefined,
      });
    } else if (message.hasVideo || message.hasDocument) {
      const caption =
        (message.text ? message.text + "\n\n" : "") +
        `🎬 برای دیدن رسانه: ${originalLink}`;
      await axios.post(`${base}/sendMessage`, {
        chat_id: target,
        text: caption,
      });
    } else if (message.text) {
      await axios.post(`${base}/sendMessage`, {
        chat_id: target,
        text: message.text,
      });
    }
    console.log(`✅ پست جدید فوروارد شد (id: ${message.id})`);
  } catch (err) {
    console.error(
      "خطا در فرستادن پیام به کانال مقصد:",
      err.response?.data || err.message
    );
  }
}

function startForwarder() {
  const botToken = process.env.BOT_TOKEN;

  async function checkOnce() {
    const { source, target, lastId } = getConfig();
    if (!source || !target) return;

    try {
      const $ = await fetchChannelPage(source);
      const messages = extractMessages($);
      if (messages.length === 0) return;

      const maxId = messages[messages.length - 1].id;

      if (lastId == null) {
        saveConfig({ lastId: maxId });
        console.log(`📌 baseline کانال مبدا ثبت شد (id: ${maxId})`);
        return;
      }

      const newMessages = messages.filter((m) => m.id > lastId);
      for (const msg of newMessages) {
        await sendToTarget({ botToken, target, message: msg, sourceUsername: source });
      }

      if (newMessages.length > 0) {
        saveConfig({ lastId: maxId });
      }
    } catch (err) {
      console.error("خطا در خوندن کانال مبدا:", err.message);
    }
  }

  console.log("🚀 فورواردر روشن شد (بدون نیاز به یوزربات).");
  checkOnce();
  setInterval(checkOnce, POLL_INTERVAL_MS);
}

module.exports = { startForwarder };
