// این بخش همه‌ی کانال‌های مبدا (که باید عمومی باشن) رو با خوندن صفحه‌ی پیش‌نمایش
// عمومی‌شون (t.me/s/username) هر چند ثانیه چک می‌کنه و پست‌های جدید رو (بعد از
// اعمال قوانین جایگزینی متن) با خودِ بات می‌فرسته تو کانال مقصد.

const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");
const { getConfig, setLastId } = require("./store");

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
    const dataPost = $el.attr("data-post");
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

function applyReplacements(text, replacements) {
  if (!text || !replacements || replacements.length === 0) return text;
  let result = text;
  for (const { from, to } of replacements) {
    if (!from) continue;
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    result = result.replace(regex, to != null ? to : "");
  }
  return result;
}

async function downloadPhoto(photoUrl) {
  const res = await axios.get(photoUrl, {
    responseType: "arraybuffer",
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ChannelMirrorBot/1.0)",
      Referer: "https://t.me/",
    },
  });
  return Buffer.from(res.data);
}

async function sendToTarget({ botToken, target, message, sourceUsername }) {
  const base = TELEGRAM_API(botToken);
  const originalLink = `https://t.me/${sourceUsername}/${message.id}`;

  try {
    if (message.photoUrl) {
      try {
        const buffer = await downloadPhoto(message.photoUrl);
        const form = new FormData();
        form.append("chat_id", target);
        if (message.text) form.append("caption", message.text.slice(0, 1024));
        form.append("photo", buffer, { filename: "photo.jpg" });

        await axios.post(`${base}/sendPhoto`, form, {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
        });
      } catch (photoErr) {
        console.error(
          "خطا در دانلود/آپلود عکس، برگشت به ارسال متنی:",
          photoErr.response?.data || photoErr.message
        );
        const fallbackText =
          (message.text ? message.text + "\n\n" : "") +
          `🖼️ برای دیدن عکس: ${originalLink}`;
        await axios.post(`${base}/sendMessage`, {
          chat_id: target,
          text: fallbackText,
        });
      }
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
    } else {
      await axios.post(`${base}/sendMessage`, {
        chat_id: target,
        text: `🔗 پست جدید: ${originalLink}`,
      });
    }
    console.log(`✅ پست جدید فوروارد شد از ${sourceUsername} (id: ${message.id})`);
  } catch (err) {
    console.error(
      "خطا در فرستادن پیام به کانال مقصد:",
      err.response?.data || err.message
    );
  }
}

function startForwarder() {
  const botToken = process.env.BOT_TOKEN;

  async function checkSource(source, target, replacements) {
    try {
      const $ = await fetchChannelPage(source);
      const messages = extractMessages($);
      if (messages.length === 0) return;

      const { lastIds } = getConfig();
      const lastId = lastIds[source];
      const maxId = messages[messages.length - 1].id;

      if (lastId == null) {
        setLastId(source, maxId);
        console.log(`📌 baseline ${source} ثبت شد (id: ${maxId})`);
        return;
      }

      const newMessages = messages.filter((m) => m.id > lastId);
      for (const msg of newMessages) {
        const text = applyReplacements(msg.text, replacements);
        await sendToTarget({
          botToken,
          target,
          message: { ...msg, text },
          sourceUsername: source,
        });
      }

      if (newMessages.length > 0) {
        setLastId(source, maxId);
      }
    } catch (err) {
      console.error(`خطا در خوندن کانال ${source}:`, err.message);
    }
  }

  async function checkOnce() {
    const { sources, target, replacements } = getConfig();
    if (!target || !sources || sources.length === 0) return;

    for (const source of sources) {
      await checkSource(source, target, replacements);
    }
  }

  console.log("🚀 فورواردر روشن شد (بدون نیاز به یوزربات).");
  checkOnce();
  setInterval(checkOnce, POLL_INTERVAL_MS);
}

module.exports = { startForwarder };      await axios.post(`${base}/sendMessage`, {
        chat_id: target,
        text: `🔗 پست جدید: ${originalLink}`,
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
