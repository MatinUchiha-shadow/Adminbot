const FILTER_LABELS = {
  all: "همه محتوا",
  text: "فقط متن",
  photo: "متن و عکس",
  video: "متن و ویدیو",
};

const TELEGRAM_CONTACT = "Matin_Uchiha0";
const UPGRADE_TEXT = encodeURIComponent("سلام، می‌خوام پلن پولی ادمین اوچیها رو فعال کنم.");

let currentUser = null;

function getToken() {
  return localStorage.getItem("relay_token") || "";
}
function setToken(t) {
  localStorage.setItem("relay_token", t);
}
function clearToken() {
  localStorage.removeItem("relay_token");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    showAuth();
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "خطای ناشناخته");
  return data;
}

function showAuth(errorMsg) {
  document.getElementById("auth-overlay").style.display = "flex";
  document.getElementById("app").style.display = "none";
  document.getElementById("log-toggle").style.display = "none";
  document.getElementById("auth-error").textContent = errorMsg || "";
}

document.querySelectorAll("#auth-overlay .tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#auth-overlay .tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("login-form").style.display = btn.dataset.tab === "login" ? "block" : "none";
    document.getElementById("register-form").style.display = btn.dataset.tab === "register" ? "block" : "none";
    document.getElementById("auth-error").textContent = "";
  });
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ورود ناموفق بود.");
    setToken(data.token);
    currentUser = data.user;
    boot();
  } catch (err) {
    document.getElementById("auth-error").textContent = err.message;
  }
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ثبت‌نام ناموفق بود.");
    setToken(data.token);
    currentUser = data.user;
    boot();
  } catch (err) {
    document.getElementById("auth-error").textContent = err.message;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  clearToken();
  currentUser = null;
  showAuth();
});

function formatExpiry(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diffDays = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
  const dateLabel = d.toLocaleDateString("fa-IR");
  return diffDays > 0 ? `تا ${dateLabel} (${diffDays} روز مونده)` : "منقضی شده";
}

function applyUserState() {
  document.getElementById("user-email").textContent = currentUser.email;
  const badge = document.getElementById("plan-badge");
  const isPaid = currentUser.plan === "paid";
  badge.textContent = isPaid ? "اشتراک پلاس" : "پلن رایگان";
  badge.className = "plan-badge " + (isPaid ? "paid" : "free");

  document.getElementById("plan-expiry").textContent = isPaid ? formatExpiry(currentUser.planExpiresAt) : "";

  document.getElementById("upsell-banner").style.display = isPaid ? "none" : "flex";
  document.getElementById("upgrade-link").href = `https://t.me/${TELEGRAM_CONTACT}?text=${UPGRADE_TEXT}`;

  const filterSelect = document.getElementById("f-filter");
  if (!isPaid) {
    filterSelect.value = "text";
    filterSelect.disabled = true;
  } else {
    filterSelect.disabled = false;
  }

  const adminBtn = document.getElementById("admin-tab-btn");
  if (currentUser.isAdmin) {
    adminBtn.style.display = "block";
    document.getElementById("log-toggle").style.display = "block";
  } else {
    adminBtn.style.display = "none";
    document.getElementById("view-admin").style.display = "none";
    document.getElementById("log-toggle").style.display = "none";
  }
}

function showApp() {
  document.getElementById("auth-overlay").style.display = "none";
  document.getElementById("app").style.display = "block";

  applyUserState();
  if (currentUser.isAdmin) loadLogs();
  loadBridges();
}

async function refreshMe() {
  try {
    const fresh = await api("/api/me");
    const changed = JSON.stringify(fresh) !== JSON.stringify(currentUser);
    currentUser = fresh;
    if (changed) applyUserState();
  } catch (e) {}
}

document.querySelectorAll("#main-tabs .tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#main-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("view-bridges").style.display = btn.dataset.view === "bridges" ? "block" : "none";
    document.getElementById("view-admin").style.display = btn.dataset.view === "admin" ? "block" : "none";
    if (btn.dataset.view === "admin") loadUsers();
  });
});

async function boot() {
  try {
    currentUser = await api("/api/me");
    showApp();
  } catch (e) {
    showAuth();
  }
}

async function loadBridges() {
  try {
    const bridges = await api("/api/bridges");
    renderBridges(bridges);
  } catch (e) {}
}

function renderBridges(bridges) {
  const container = document.getElementById("bridges");
  if (!bridges.length) {
    container.innerHTML = '<div class="empty-state">هنوز پلی نساختی.</div>';
    return;
  }
  container.innerHTML = "";
  bridges.forEach((b) => container.appendChild(bridgeCard(b)));
}

function bridgeCard(b) {
  const card = document.createElement("div");
  card.className = "bridge-card";
  const isPaid = currentUser.plan === "paid";
  const repCount = b.replacements ? b.replacements.length : 0;

  card.innerHTML = `
    <div class="bridge-row">
      <div class="node">
        <span class="label">مبدا</span>
        <span class="value">@${b.source}</span>
      </div>
      <div class="link-line"><div class="pulse"></div></div>
      <div class="node target">
        <span class="label">مقصد</span>
        <span class="value">${b.target}</span>
      </div>
      <div class="badges">
        <span class="badge">${FILTER_LABELS[b.contentFilter] || "همه محتوا"}</span>
        ${isPaid ? `<span class="badge">${repCount} جایگزینی</span>` : ""}
      </div>
      <div class="bridge-actions">
        ${isPaid ? '<button class="icon-btn toggle-rep">جایگزینی متن</button>' : ""}
        <button class="icon-btn danger delete-bridge">حذف</button>
      </div>
    </div>
    ${isPaid ? `
    <div class="bridge-extra">
      <div class="rep-list"></div>
      <div class="rep-add">
        <input type="text" class="rep-from" placeholder="کلمه‌ی مبدا (مثلاً matin)">
        <input type="text" class="rep-to" placeholder="کلمه‌ی جایگزین (مثلاً jamali)">
        <button class="btn btn-ghost rep-add-btn">افزودن</button>
      </div>
    </div>` : ""}
  `;

  if (isPaid) {
    const extra = card.querySelector(".bridge-extra");
    const repList = card.querySelector(".rep-list");

    function renderReps() {
      repList.innerHTML = "";
      (b.replacements || []).forEach((r, i) => {
        const item = document.createElement("div");
        item.className = "rep-item";
        item.innerHTML = `<span>${r.from} ← ${r.to || "(حذف)"}</span><button class="icon-btn danger">حذف</button>`;
        item.querySelector("button").addEventListener("click", async () => {
          await api(`/api/bridges/${b._id}/replacements/${i}`, { method: "DELETE" });
          loadBridges();
        });
        repList.appendChild(item);
      });
    }
    renderReps();

    card.querySelector(".toggle-rep").addEventListener("click", () => {
      extra.classList.toggle("open");
    });

    card.querySelector(".rep-add-btn").addEventListener("click", async () => {
      const from = card.querySelector(".rep-from").value.trim();
      const to = card.querySelector(".rep-to").value.trim();
      if (!from) return;
      await api(`/api/bridges/${b._id}/replacements`, {
        method: "POST",
        body: JSON.stringify({ from, to }),
      });
      loadBridges();
    });
  }

  card.querySelector(".delete-bridge").addEventListener("click", async () => {
    if (!confirm(`پل @${b.source} → ${b.target} حذف بشه؟`)) return;
    await api(`/api/bridges/${b._id}`, { method: "DELETE" });
    loadBridges();
  });

  return card;
}

document.getElementById("bridge-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("form-error");
  errorEl.textContent = "";
  try {
    await api("/api/bridges", {
      method: "POST",
      body: JSON.stringify({
        source: document.getElementById("f-source").value.trim(),
        target: document.getElementById("f-target").value.trim(),
        botToken: document.getElementById("f-token").value.trim(),
        contentFilter: document.getElementById("f-filter").value,
      }),
    });
    e.target.reset();
    loadBridges();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

async function loadUsers() {
  const container = document.getElementById("users-table");
  try {
    const users = await api("/api/admin/users");
    if (!users.length) {
      container.innerHTML = '<div class="empty-state">هنوز کاربری ثبت‌نام نکرده.</div>';
      return;
    }
    container.innerHTML = '<div class="users-list"></div>';
    const list = container.querySelector(".users-list");
    users.forEach((u) => {
      const row = document.createElement("div");
      row.className = "user-row";
      row.innerHTML = `
        <div><span class="u-email">${u.email}</span><span class="u-plan">${u.plan === "paid" ? "اشتراک پلاس" : "رایگان"}${u.plan === "paid" ? " · " + formatExpiry(u.planExpiresAt) : ""}${u.isAdmin ? " · ادمین" : ""}</span></div>
        <button class="btn ${u.plan === "paid" ? "btn-ghost" : "btn-signal"} toggle-plan">
          ${u.plan === "paid" ? "برگردون به رایگان" : "فعال‌کردن اشتراک پلاس (۳۰ روز)"}
        </button>
      `;
      row.querySelector(".toggle-plan").addEventListener("click", async () => {
        const newPlan = u.plan === "paid" ? "free" : "paid";
        await api(`/api/admin/users/${u.id}/plan`, {
          method: "POST",
          body: JSON.stringify({ plan: newPlan }),
        });
        loadUsers();
      });
      list.appendChild(row);
    });
  } catch (e) {}
}

async function loadLogs() {
  try {
    const logs = await api("/api/logs");
    const body = document.getElementById("log-body");
    const wasAtBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 10;
    body.innerHTML = logs
      .map((l) => `<div class="line"><span class="t">${l.time}</span>${escapeHtml(l.line)}</div>`)
      .join("");
    if (wasAtBottom) body.scrollTop = body.scrollHeight;
  } catch (e) {}
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

document.getElementById("log-bar").addEventListener("click", () => {
  const body = document.getElementById("log-body");
  const caret = document.getElementById("log-caret");
  body.classList.toggle("open");
  caret.textContent = body.classList.contains("open") ? "▼" : "▲";
});

if (getToken()) {
  boot();
} else {
  showAuth();
}

setInterval(() => {
  if (document.getElementById("app").style.display !== "none" && currentUser) {
    refreshMe();
    loadBridges();
    if (currentUser.isAdmin) loadLogs();
  }
}, 8000);
