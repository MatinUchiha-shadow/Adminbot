// این بخش همه‌ی «پل‌های ارتباطی» رو می‌خونه؛ برای هر کدوم صفحه‌ی پیش‌نمایش
// عمومی کانال مبدا (t.me/s/username) رو چک می‌کنه، فیلتر نوع محتوا و قوانین
// جایگزینی متن رو اعمال می‌کنه، و پست‌های جدید رو با ربات همون پل به مقصد می‌فرسته.

const axios = require("axios");
const cheerio = require("cheerio");
const FormData = require("form-data");
const { getBridges, setLastId } = require("./store");
const { log } = require("./logs");

const POLL_INTERVAL_MS = 15000;
const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;

async function fetchChannelPage(username) {
  const url = `https://t.me/s/${username}`;
  const res = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; RelayBot/1.0)" },
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

function passesFilter(message, contentFilter) {
  switch (contentFilter) {
    case "text":
      return !message.photoUrl && !message.hasVideo && !message.hasDocument;
    case "photo":
      return !message.hasVideo && !message.hasDocument;
    case "video":
      return !message.photoUrl;
    case "all":
    default:
      return true;
  }
}

async function downloadPhoto(photoUrl) {
  const res = await axios.get(photoUrl, {
    responseType: "arraybuffer",
    timeout: 20000,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RelayBot/1.0)",
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
        log(`⚠️ عکس آپلود نشد، متن جایگزین فرستاده شد (${sourceUsername}/${message.id})`);
        const fallbackText =
          (message.text ? message.text + "\n\n" : "") +
          `🖼️ برای دیدن عکس: ${originalLink}`;
        await axios.post(`${base}/sendMessage`, {
          chat_id: target,
          text: fallbackText,
        });
      }
    } else if (message.hasVideo || message.hasDocument) {
      if (message.text) {
        await axios.post(`${base}/sendMessage`, {
          chat_id: target,
          text: message.text,
        });
      }
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
    log(`✅ پست فوروارد شد: @${sourceUsername} → ${target} (id: ${message.id})`);
  } catch (err) {
    log(`❌ خطا در ارسال به ${target}: ${err.response?.data?.description || err.message}`);
  }
}

function startForwarder() {
  async function checkBridge(bridge) {
    try {
      const $ = await fetchChannelPage(bridge.source);
      const messages = extractMessages($);
      if (messages.length === 0) return;

      const maxId = messages[messages.length - 1].id;

      if (bridge.lastId == null) {
        setLastId(bridge.id, maxId);
        log(`📌 baseline پل @${bridge.source} → ${bridge.target} ثبت شد`);
        return;
      }

      const allNew = messages.filter((m) => m.id > bridge.lastId);
      const toSend = allNew.filter((m) => passesFilter(m, bridge.contentFilter));

      for (const msg of toSend) {
        const text = applyReplacements(msg.text, bridge.replacements);
        await sendToTarget({
          botToken: bridge.botToken,
          target: bridge.target,
          message: { ...msg, text },
          sourceUsername: bridge.source,
        });
      }

      if (allNew.length > 0) {
        setLastId(bridge.id, maxId);
      }
    } catch (err) {
      log(`❌ خطا در خوندن @${bridge.source}: ${err.message}`);
    }
  }

  async function checkOnce() {
    const bridges = getBridges();
    for (const bridge of bridges) {
      await checkBridge(bridge);
    }
  }

  log("🚀 فورواردر روشن شد.");
  checkOnce();
  setInterval(checkOnce, POLL_INTERVAL_MS);
}

module.exports = { startForwarder };
