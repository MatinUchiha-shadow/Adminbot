const FILTER_LABELS = {
  all: "همه محتوا",
  text: "فقط متن",
  photo: "متن و عکس",
  video: "متن و ویدیو",
};

function getPassword() {
  return localStorage.getItem("relay_password") || "";
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-dashboard-password": getPassword(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("relay_password");
    showLogin("رمز عبور اشتباهه یا منقضی شده.");
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "خطای ناشناخته");
  return data;
}

function showLogin(errorMsg) {
  document.getElementById("login-overlay").style.display = "flex";
  document.getElementById("app").style.display = "none";
  document.getElementById("log-toggle").style.display = "none";
  document.getElementById("login-error").textContent = errorMsg || "";
}

function showApp() {
  document.getElementById("login-overlay").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("log-toggle").style.display = "block";
  loadBridges();
  loadLogs();
}

async function tryLogin(password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.ok) {
    localStorage.setItem("relay_password", password);
    showApp();
  } else {
    document.getElementById("login-error").textContent = "رمز عبور اشتباهه.";
  }
}

document.getElementById("login-btn").addEventListener("click", () => {
  const pw = document.getElementById("login-password").value;
  tryLogin(pw);
});
document.getElementById("login-password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryLogin(e.target.value);
});

// ---------- Bridges ----------
async function loadBridges() {
  try {
    const bridges = await api("/api/bridges");
    renderBridges(bridges);
  } catch (e) {
    /* handled by api() */
  }
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
        <span class="badge">${repCount} جایگزینی</span>
      </div>
      <div class="bridge-actions">
        <button class="icon-btn toggle-rep">جایگزینی متن</button>
        <button class="icon-btn danger delete-bridge">حذف</button>
      </div>
    </div>
    <div class="bridge-extra">
      <div class="rep-list"></div>
      <div class="rep-add">
        <input type="text" class="rep-from" placeholder="کلمه‌ی مبدا (مثلاً matin)">
        <input type="text" class="rep-to" placeholder="کلمه‌ی جایگزین (مثلاً jamali)">
        <button class="btn btn-ghost rep-add-btn">افزودن</button>
      </div>
    </div>
  `;

  const extra = card.querySelector(".bridge-extra");
  const repList = card.querySelector(".rep-list");

  function renderReps() {
    repList.innerHTML = "";
    (b.replacements || []).forEach((r, i) => {
      const item = document.createElement("div");
      item.className = "rep-item";
      item.innerHTML = `<span>${r.from} ← ${r.to || "(حذف)"}</span><button class="icon-btn danger" data-i="${i}">حذف</button>`;
      item.querySelector("button").addEventListener("click", async () => {
        await api(`/api/bridges/${b.id}/replacements/${i}`, { method: "DELETE" });
        loadBridges();
      });
      repList.appendChild(item);
    });
  }
  renderReps();

  card.querySelector(".toggle-rep").addEventListener("click", () => {
    extra.classList.toggle("open");
  });

  card.querySelector(".delete-bridge").addEventListener("click", async () => {
    if (!confirm(`پل @${b.source} → ${b.target} حذف بشه؟`)) return;
    await api(`/api/bridges/${b.id}`, { method: "DELETE" });
    loadBridges();
  });

  card.querySelector(".rep-add-btn").addEventListener("click", async () => {
    const from = card.querySelector(".rep-from").value.trim();
    const to = card.querySelector(".rep-to").value.trim();
    if (!from) return;
    await api(`/api/bridges/${b.id}/replacements`, {
      method: "POST",
      body: JSON.stringify({ from, to }),
    });
    card.querySelector(".rep-from").value = "";
    card.querySelector(".rep-to").value = "";
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

// ---------- Logs ----------
async function loadLogs() {
  try {
    const logs = await api("/api/logs");
    const body = document.getElementById("log-body");
    const wasAtBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 10;
    body.innerHTML = logs
      .map((l) => `<div class="line"><span class="t">${l.time}</span>${escapeHtml(l.line)}</div>`)
      .join("");
    if (wasAtBottom) body.scrollTop = body.scrollHeight;
  } catch (e) {
    /* handled by api() */
  }
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

// ---------- Boot ----------
if (getPassword()) {
  api("/api/bridges")
    .then((bridges) => {
      renderBridges(bridges);
      showApp();
    })
    .catch(() => showLogin());
} else {
  showLogin();
}

setInterval(() => {
  if (document.getElementById("app").style.display !== "none") {
    loadBridges();
    loadLogs();
  }
}, 8000);
