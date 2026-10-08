const icons = {
  home: "M3 10l9-7 9 7v10H3Z M9 20v-7h6v7",
  bag: "M5 7h14l1 14H4Z M8 8V6a4 4 0 0 1 8 0v2",
  box: "M3 7l9-4 9 4v10l-9 4-9-4Z M3 7l9 5 9-5 M12 12v9",
  wallet: "M3 5h17v15H3Z M16 10h5v6h-5Z M5 5V3h12",
  chart: "M4 20V10 M10 20V4 M16 20v-8 M22 20H2",
  chat: "M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z M7 9h9 M7 13h6",
  plus: "M12 5v14 M5 12h14",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0Z M6 10v2a6 6 0 0 0 12 0v-2 M12 18v4 M9 22h6",
  clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  check: "M5 12l4 4L19 6",
  bell: "M5 17V9a7 7 0 0 1 14 0v8H5Z M9 21h6",
  close: "M6 6l12 12 M6 18L18 6",
  help: "M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  download: "M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4"
};

const icon = key =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="${icons[key] || icons.home}"/>
  </svg>`;

let lang = "en";
try {
  lang = localStorage.getItem("mane-language") === "kn" ? "kn" : "en";
} catch { }

let view = "home";
let filter = "all";
let shop = null;
let products = [];
let orders = [];
let isSeller = false;
let loadingData = false;
let busy = false;
let toastTimer;

const t = (en, kn) => lang === "kn" ? kn : en;
const money = value => "₹" + Number(value || 0).toLocaleString("en-IN");

const esc = value => String(value ?? "").replace(
  /[&<>"']/g,
  character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]
);

const assets = {
  chakli: "https://upload.wikimedia.org/wikipedia/commons/7/73/Chakli.jpg",
  peda: "https://upload.wikimedia.org/wikipedia/commons/0/01/Dharwad_peda.jpg",
  pickle: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Mangopickle.jpg"
};

const pname = product => t(product.name, product.name_kn || product.name);
const punit = product => product.unit || "";
const orderValue = order => Number(order.price_rupees) * Number(order.qty);

const statusLabel = status => ({
  new: t("New order", "ಹೊಸ ಆರ್ಡರ್"),
  accepted: t("Preparing", "ತಯಾರಾಗುತ್ತಿದೆ"),
  ready: t("Ready", "ಸಿದ್ಧವಾಗಿದೆ"),
  picked_up: t("On the way", "ದಾರಿಯಲ್ಲಿದೆ"),
  delivered: t("Delivered", "ವಿತರಿಸಲಾಗಿದೆ"),
  cancelled: t("Cancelled", "ರದ್ದಾಗಿದೆ"),
  declined: t("Declined", "ನಿರಾಕರಿಸಲಾಗಿದೆ")
})[status] || status;

const modeLabel = mode => ({
  pickup: t("Customer pickup", "ಅಂಗಡಿಯಿಂದ ಪಡೆಯುವುದು"),
  self: t("Seller delivery", "ಮಾರಾಟಗಾರರಿಂದ ವಿತರಣೆ"),
  rider: t("Rider delivery", "ರೈಡರ್ ವಿತರಣೆ")
})[mode] || mode;

function photo(product, cls = "") {
  let key = product?.image;
  const name = `${product?.name || ""} ${product?.name_kn || ""}`.toLowerCase();

  if (!assets[key]) {
    if (/chakli|ಚಕ್ಲಿ/.test(name)) key = "chakli";
    else if (/peda|ಪೇಡ/.test(name)) key = "peda";
    else if (/pickle|ಉಪ್ಪಿನಕಾಯಿ/.test(name)) key = "pickle";
  }

  return assets[key]
    ? `<img class="${cls}" src="${assets[key]}"
        alt="${esc(t("Illustrative product photo", "ಸಾಂದರ್ಭಿಕ ಉತ್ಪನ್ನ ಚಿತ್ರ"))}"
        loading="lazy">`
    : `<div class="${cls}"
        style="display:grid;place-items:center;color:#936e36">
        ${icon("box")}
       </div>`;
}

function toast(message) {
  const element = document.getElementById("toast");

  if (!element) {
    console.log(message);
    return;
  }

  element.textContent = message;
  element.hidden = false;
  element.classList.add("show");
  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 5000);
}

function navigate(next) {
  if (busy) return;
  view = next;
  render();
  window.scrollTo(0, 0);
}

function setLang(next) {
  if (busy) return;
  lang = next;

  try {
    localStorage.setItem("mane-language", lang);
  } catch { }

  document.documentElement.lang = lang;
  if (isSeller) render();
  else renderLogin();
}

async function api(path, options = {}) {
  const request = {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Mane-Request": "1",
      ...options.headers
    },
    signal: AbortSignal.timeout(15000)
  };

  if (request.body && typeof request.body !== "string") {
    request.body = JSON.stringify(request.body);
  }

  const response = await fetch("/api" + path, request);
  const raw = await response.text();

  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Server returned an unexpected response.");
  }

  if (!response.ok) {
    const error = new Error(data.error || "Request failed");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function loadData() {
  if (loadingData) return;
  loadingData = true;

  try {
    const me = await api("/me");
    isSeller = me.seller === true;

    if (!isSeller) {
      shop = null;
      products = [];
      orders = [];

      document.querySelectorAll("dialog[open]").forEach(d => d.close());
      renderLogin();
      return;
    }

    const [catalog, savedOrders] = await Promise.all([
      api("/catalog"),
      api("/orders")
    ]);

    if (!catalog.shop) {
      throw new Error("Shop not found. Check the server SHOP_ID.");
    }

    shop = catalog.shop;
    products = catalog.products || [];
    orders = savedOrders || [];
    render();
  } finally {
    loadingData = false;
  }
}

function showLoadError(error) {
  console.error("Dashboard:", error);
  toast(error.message);

  if (!shop && !document.getElementById("seller-login")) {
    document.getElementById("app").innerHTML = `
      <section class="panel" style="max-width:500px;margin:50px auto">
        <h2>${t("Unable to load the dashboard", "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಲೋಡ್ ಆಗಲಿಲ್ಲ")}</h2>
        <p>${esc(error.message)}</p>
        <button class="btn" onclick="loadData().catch(showLoadError)">
          ${t("Try again", "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ")}
        </button>
      </section>`;
  }
}

function renderLogin() {
  document.getElementById("app").innerHTML = `
    <div style="max-width:420px;margin:60px auto;padding:20px">
      <div class="brand">
        <span class="brandmark">${icon("home")}</span>Mane Bazaar
      </div>
      <p class="brand-sub">HUBBALLI · ಹುಬ್ಬಳ್ಳಿ</p>

      <div class="lang" style="margin-bottom:20px">
        <button onclick="setLang('kn')">ಕನ್ನಡ</button>
        <button onclick="setLang('en')">English</button>
      </div>

      <section class="panel">
        <h2>${t("Seller login", "ಮಾರಾಟಗಾರರ ಪ್ರವೇಶ")}</h2>
        <p>${t(
    "Sign in to see your shop and WhatsApp orders.",
    "ನಿಮ್ಮ ಅಂಗಡಿ ಮತ್ತು WhatsApp ಆರ್ಡರ್‌ಗಳನ್ನು ನೋಡಲು ಪ್ರವೇಶಿಸಿ."
  )}</p>

        <form id="seller-login" onsubmit="doLogin(event)">
          <label style="display:block;margin-bottom:16px">
            ${t("Seller password", "ಮಾರಾಟಗಾರರ ಪಾಸ್‌ವರ್ಡ್")}
            <input name="password" type="password"
              autocomplete="current-password" required
              style="width:100%;padding:12px;margin-top:8px">
          </label>
          <p id="login-error" role="alert" style="color:#a32626"></p>
          <button class="btn" type="submit" style="width:100%">
            ${t("Sign in", "ಪ್ರವೇಶಿಸಿ")}
          </button>
        </form>
      </section>
    </div>`;
}

async function doLogin(event) {
  event.preventDefault();
  if (busy) return;

  busy = true;
  const form = event.target;
  const button = form.querySelector('button[type="submit"]');
  const errorBox = document.getElementById("login-error");

  button.disabled = true;
  errorBox.textContent = "";

  try {
    await api("/login", {
      method: "POST",
      body: { password: form.elements.password.value }
    });

    form.reset();

    const me = await api("/me");
    if (!me.seller) {
      throw new Error(
        "Login session was not saved. Check APP_URL and cookie settings."
      );
    }

    view = "orders";
    filter = "all";
    await loadData();
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    busy = false;
    button.disabled = false;
  }
}

async function doLogout() {
  if (busy) return;
  busy = true;

  try {
    await api("/logout", { method: "POST", body: {} });
    location.reload();
  } catch (error) {
    toast(error.message);
    busy = false;
  }
}

function heading(title, subtitle, action = "") {
  return `<div class="page-heading">
    <div><h1>${title}</h1><p class="sub">${subtitle}</p></div>
    ${action}
  </div>`;
}

function render() {
  if (!isSeller) return renderLogin();
  if (!shop) return;

  const nav = [
    ["home", "home", t("My home", "ಮುಖಪುಟ")],
    ["orders", "bag", t("My orders", "ನನ್ನ ಆರ್ಡರ್‌ಗಳು")],
    ["products", "box", t("My products", "ನನ್ನ ಉತ್ಪನ್ನಗಳು")],
    ["money", "wallet", t("My money", "ನನ್ನ ಹಣ")],
    ["passport", "chart", t("My business", "ನನ್ನ ವ್ಯಾಪಾರ")],
    ["chat", "chat", t("WhatsApp", "WhatsApp")]
  ];

  const shopName = t(shop.name, shop.name_kn || shop.name);
  const initial = esc(shopName.charAt(0));

  document.getElementById("app").innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brandmark">${icon("home")}</span>Mane Bazaar
        </div>
        <div class="brand-sub">HUBBALLI · ಹುಬ್ಬಳ್ಳಿ</div>

        <nav class="nav" aria-label="${t("Main navigation", "ಮುಖ್ಯ ಮೆನು")}">
          ${nav.map(([key, symbol, label]) => `
            <button data-view="${key}"
              class="${view === key ? "active" : ""}"
              onclick="navigate('${key}')"
              ${view === key ? 'aria-current="page"' : ""}>
              ${icon(symbol)}<span>${label}</span>
              ${key === "orders"
      ? `<span class="count">${orders.filter(o => o.status === "new").length}</span>`
      : ""}
            </button>`).join("")}
        </nav>

        <div class="sidebar-bottom">
          <div class="help-card">
            ${icon("help")}<strong>${t("A little help?", "ಸಹಾಯ ಬೇಕೇ?")}</strong>
            <p>${t("Let’s take it one step at a time.", "ಒಂದೊಂದೇ ಹೆಜ್ಜೆ ಇಡೋಣ.")}</p>
            <button class="text-btn" onclick="help()">
              ${t("Get help", "ಸಹಾಯ ಪಡೆಯಿರಿ")}
            </button>
          </div>

          <button class="profile" onclick="showAccount()"
            style="width:100%;text-align:left">
            <span class="avatar">${initial}</span>
            <span>
              <strong>${esc(shopName)}</strong>
              <small>${esc(shop.area)}</small>
            </span>
          </button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div class="crumb">
            ${t("My shop", "ನನ್ನ ಅಂಗಡಿ")}
            <strong>/ ${nav.find(item => item[0] === view)?.[2] || ""}</strong>
          </div>

          <div class="brand mobile-brand">
            <span class="brandmark">${icon("home")}</span>Mane Bazaar
          </div>

          <div class="top-actions">
            <div class="lang" aria-label="Language">
              <button onclick="setLang('kn')"
                class="${lang === "kn" ? "selected" : ""}">ಕನ್ನಡ</button>
              <button onclick="setLang('en')"
                class="${lang === "en" ? "selected" : ""}">English</button>
            </div>
            <button class="circle-btn" onclick="navigate('orders')"
              aria-label="${t("Orders", "ಆರ್ಡರ್‌ಗಳು")}">${icon("bell")}</button>
            <button class="avatar" onclick="showAccount()"
              aria-label="${t("Account", "ಖಾತೆ")}">${initial}</button>
          </div>
        </header>

        <div class="content">
          ${view === "home" ? home() : screens[view]?.() || ""}
          <p class="muted" style="margin-top:24px;font-size:12px">
            ${t(
        "Latest 100 orders · refreshes every 5 seconds",
        "ಇತ್ತೀಚಿನ 100 ಆರ್ಡರ್‌ಗಳು · ಪ್ರತಿ 5 ಸೆಕೆಂಡಿಗೆ ನವೀಕರಣ"
      )}
          </p>
        </div>
      </main>
    </div>`;
}

function stats() {
  const values = [
    [
      "bag",
      t("Orders to prepare", "ತಯಾರಿಸಬೇಕಾದ ಆರ್ಡರ್‌ಗಳು"),
      orders.filter(o => ["new", "accepted"].includes(o.status)).length
    ],
    [
      "clock",
      t("Ready for handover", "ಹಸ್ತಾಂತರಕ್ಕೆ ಸಿದ್ಧ"),
      orders.filter(o => o.status === "ready").length
    ],
    [
      "check",
      t("Delivered orders", "ವಿತರಿಸಿದ ಆರ್ಡರ್‌ಗಳು"),
      orders.filter(o => o.status === "delivered").length
    ]
  ];

  return `<div class="stats">${values.map(([symbol, label, value]) => `
    <div class="stat">
      <div class="stat-icon">${icon(symbol)}</div>
      <div><p>${label}</p><strong>${value}</strong></div>
    </div>`).join("")}</div>`;
}

function productCard(product) {
  return `<article class="product">
    <div class="photo">
      ${photo(product)}
      <span class="pill">${product.active
      ? t("Listed", "ಪಟ್ಟಿಯಲ್ಲಿದೆ")
      : t("Paused", "ನಿಲ್ಲಿಸಲಾಗಿದೆ")}</span>
    </div>
    <div class="product-body">
      <h3>${esc(pname(product))}</h3>
      <p>${esc(punit(product))} · ${product.stock} ${t("available", "ಲಭ್ಯ")}</p>
      <div class="product-bottom">
        <strong>${money(product.price_rupees)}</strong>
        <button onclick="editProduct('${product.id}')">
          ${t("Edit", "ಬದಲಿಸಿ")}
        </button>
      </div>
    </div>
  </article>`;
}

function home() {
  const active = orders.filter(o => ["new", "accepted"].includes(o.status));

  return `
    <div class="page-heading">
      <div>
        <p class="eyebrow">${new Date().toLocaleDateString(
    lang === "kn" ? "kn-IN" : "en-IN",
    { weekday: "long", day: "numeric", month: "long" }
  )}</p>
        <h1>${t("Namaskara", "ನಮಸ್ಕಾರ")}, ${esc(
    t(shop.name, shop.name_kn || shop.name)
  )}! <span style="color:#dd9d1b">☀</span></h1>
        <p class="sub">${t(
    "A little homemade. A lot of heart.",
    "ಮನೆಯ ರುಚಿ, ಮನದ ಪ್ರೀತಿ."
  )}</p>
      </div>
      <span class="pill"><span class="dot"></span>${shop.is_open
      ? t("Shop is open", "ಅಂಗಡಿ ತೆರೆದಿದೆ")
      : t("Shop is paused", "ಅಂಗಡಿ ನಿಲ್ಲಿಸಲಾಗಿದೆ")}</span>
    </div>

    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">${t(
        "YOUR SHOP. YOUR WAY.", "ನಿಮ್ಮ ಅಂಗಡಿ. ನಿಮ್ಮ ಆಯ್ಕೆ."
      )}</div>
        <h2>${t(
        "What’s cooking<br>in your shop today?",
        "ಇಂದು ನಿಮ್ಮ ಅಂಗಡಿಯಲ್ಲಿ<br>ಏನು ವಿಶೇಷ?"
      )}</h2>
        <p>${t(
        "Add something delicious. Your customers are just around the corner.",
        "ನಿಮ್ಮ ಉತ್ಪನ್ನ ಸೇರಿಸಿ. ಹತ್ತಿರದ ಗ್ರಾಹಕರನ್ನು ತಲುಪಿ."
      )}</p>
        <button class="btn yellow" onclick="editProduct()">
          ${icon("plus")}${t("Add today’s item", "ಇಂದಿನ ಉತ್ಪನ್ನ ಸೇರಿಸಿ")}
        </button>
      </div>
      <div class="hero-art">
        <img src="${assets.chakli}" alt="Illustrative chakli">
        <div class="hero-label">
          <strong>${t("Made with love, in Hubballi", "ಹುಬ್ಬಳ್ಳಿಯ ಮನೆಯ ರುಚಿ")}</strong>
          <small>${t("Illustrative photo", "ಸಾಂದರ್ಭಿಕ ಚಿತ್ರ")}</small>
        </div>
      </div>
    </section>

    ${stats()}

    <div class="dashboard-grid">
      <div>
        <section class="panel">
          <div class="section-head">
            <h2>${t("A little work for today", "ಇಂದಿನ ಕೆಲಸಗಳು")}</h2>
            <button class="text-btn" onclick="navigate('orders')">
              ${t("All orders", "ಎಲ್ಲಾ ಆರ್ಡರ್‌ಗಳು")}
            </button>
          </div>

          ${active.slice(0, 3).map(order => {
        const product = products.find(p => p.id === order.product_id);
        return `<div class="order-row">
              ${photo(product, "order-thumb")}
              <div class="order-info">
                <strong>${esc(order.customer_name)} ·
                  ${order.qty} × ${esc(order.product_name)}</strong>
                <p>${esc(modeLabel(order.mode))}</p>
              </div>
              <div class="order-price">
                ${money(orderValue(order))}
                <small>${statusLabel(order.status)}</small>
              </div>
            </div>`;
      }).join("") || `<p class="muted">${t(
        "You’re all caught up!", "ಎಲ್ಲಾ ಕೆಲಸಗಳು ಮುಗಿದಿವೆ!"
      )}</p>`}
        </section>

        <section class="panel">
          <div class="section-head">
            <h2>${t("Fresh from your shop", "ನಿಮ್ಮ ಅಂಗಡಿಯ ಉತ್ಪನ್ನಗಳು")}</h2>
            <button class="text-btn" onclick="navigate('products')">
              ${t("View shop", "ಅಂಗಡಿ ನೋಡಿ")}
            </button>
          </div>
          <div class="products">${products.slice(0, 3).map(productCard).join("")}</div>
        </section>
      </div>

      <div class="dashboard-right">
        <section class="panel">
          <div class="section-head">
            <h2>${t("What would you like to do?", "ನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?")}</h2>
          </div>
          <div class="action-grid">
            <button class="action-tile" onclick="navigate('chat')">
              ${icon("chat")}<span>${t("WhatsApp orders", "WhatsApp ಆರ್ಡರ್‌ಗಳು")}</span>
            </button>
            <button class="action-tile" onclick="navigate('orders')">
              ${icon("bag")}<span>${t("See my orders", "ಆರ್ಡರ್‌ಗಳನ್ನು ನೋಡಿ")}</span>
            </button>
            <button class="action-tile" onclick="editProduct()">
              ${icon("plus")}<span>${t("Add a product", "ಉತ್ಪನ್ನ ಸೇರಿಸಿ")}</span>
            </button>
            <button class="action-tile" onclick="navigate('money')">
              ${icon("wallet")}<span>${t("Order values", "ಆರ್ಡರ್ ಮೊತ್ತಗಳು")}</span>
            </button>
          </div>
        </section>
        <div class="tip">
          <h3>✦ ${t("Small batches. Less worry.", "ಸ್ವಲ್ಪ ತಯಾರಿ. ಕಡಿಮೆ ಚಿಂತೆ.")}</h3>
          <p>${t(
        "Keep your available stock updated. Confirm orders before preparing them.",
        "ಲಭ್ಯವಿರುವ ದಾಸ್ತಾನು ನವೀಕರಿಸಿ. ತಯಾರಿಸುವ ಮೊದಲು ಆರ್ಡರ್ ದೃಢೀಕರಿಸಿ."
      )}</p>
        </div>
      </div>
    </div>`;
}

function orderCard(order) {
  const product = products.find(p => p.id === order.product_id);
  let actions = "";

  if (order.status === "new") {
    actions = `
      <button class="btn secondary small"
        onclick="confirmDecline('${order.id}')">${t("Decline", "ನಿರಾಕರಿಸಿ")}</button>
      <button class="btn green small"
        onclick="orderAction('${order.id}','accepted')">
        ${icon("check")}${t("Accept", "ಸ್ವೀಕರಿಸಿ")}
      </button>`;
  } else if (order.status === "accepted") {
    actions = `<button class="btn small"
      onclick="orderAction('${order.id}','ready')">
      ${t("Mark ready", "ಸಿದ್ಧವಾಗಿದೆ")}
    </button>`;
  } else if (order.status === "ready" && order.mode === "self") {
    actions = `<button class="btn green small"
      onclick="orderAction('${order.id}','picked_up')">
      ${t("Start delivery", "ವಿತರಣೆ ಆರಂಭಿಸಿ")}
    </button>`;
  }

  let note = "";

  if (order.status === "ready" && order.mode === "pickup") {
    note = t(
      "Customer confirms receipt after pickup.",
      "ಪಿಕಪ್ ನಂತರ ಗ್ರಾಹಕರು ಸ್ವೀಕೃತಿಯನ್ನು ದೃಢೀಕರಿಸುತ್ತಾರೆ."
    );
  }

  if (order.status === "ready" && order.mode === "rider") {
    note = order.rider_id && order.pickup_code
      ? t("Give the rider this code at pickup: ", "ಪಿಕಪ್ ಸಮಯದಲ್ಲಿ ರೈಡರ್‌ಗೆ ಈ ಕೋಡ್ ನೀಡಿ: ") +
      order.pickup_code
      : t("Waiting for a rider.", "ರೈಡರ್‌ಗಾಗಿ ಕಾಯುತ್ತಿದೆ.");
  }

  return `<article class="order-card">
    <div class="order-card-head">
      <div>
        <h3>${esc(order.customer_name)}</h3>
        <small class="muted">#MB${esc(order.id.slice(0, 8))}</small>
      </div>
      <span class="status ${esc(order.status)}">${esc(statusLabel(order.status))}</span>
    </div>

    <div class="order-detail">
      ${photo(product, "order-thumb")}
      <div style="flex:1">
        <strong>${order.qty} × ${esc(order.product_name)}</strong>
        <p>${money(order.price_rupees)} ${t("per pack", "ಪ್ರತಿ ಪ್ಯಾಕ್")}</p>
      </div>
      <strong>${money(orderValue(order))}</strong>
    </div>

    <div class="order-card-footer">
      <div>
        <small>${esc(modeLabel(order.mode))}</small>
        ${order.mode !== "pickup" ? `<p>${esc(order.address)}</p>` : ""}
        ${note ? `<p class="muted">${esc(note)}</p>` : ""}
        ${order.confirmed ? `<p class="muted">${t(
    "Customer confirmed receipt", "ಗ್ರಾಹಕರು ಸ್ವೀಕೃತಿ ದೃಢೀಕರಿಸಿದ್ದಾರೆ"
  )}</p>` : ""}
      </div>
      <div class="toolbar">${actions}</div>
    </div>
  </article>`;
}

const screens = {
  orders: () => {
    const tabs = ["all", "new", "accepted", "ready", "picked_up", "delivered", "cancelled", "declined"];
    const visible = orders.filter(o => filter === "all" || o.status === filter);

    return heading(
      t("My orders", "ನನ್ನ ಆರ್ಡರ್‌ಗಳು"),
      t("Website and confirmed WhatsApp orders.", "ವೆಬ್‌ಸೈಟ್ ಮತ್ತು ದೃಢೀಕರಿಸಿದ WhatsApp ಆರ್ಡರ್‌ಗಳು.")
    ) + `
      <div class="tabs">
        ${tabs.map(status => `<button
          class="${filter === status ? "active" : ""}"
          onclick="filter='${status}';render()">
          ${status === "all" ? t("All", "ಎಲ್ಲಾ") : statusLabel(status)}
          ${status === "all" ? orders.length : orders.filter(o => o.status === status).length}
        </button>`).join("")}
      </div>
      ${visible.map(orderCard).join("") || `<div class="panel empty">${t(
      "No orders here yet.", "ಇಲ್ಲಿ ಇನ್ನೂ ಆರ್ಡರ್‌ಗಳಿಲ್ಲ."
    )}</div>`}`;
  },

  products: () => heading(
    t("My products", "ನನ್ನ ಉತ್ಪನ್ನಗಳು"),
    t("Your recipes. Your prices. Your pace.", "ನಿಮ್ಮ ಉತ್ಪನ್ನ. ನಿಮ್ಮ ಬೆಲೆ. ನಿಮ್ಮ ಸಮಯ."),
    `<button class="btn" onclick="editProduct()">
      ${icon("plus")}${t("Add item", "ಸೇರಿಸಿ")}
    </button>`
  ) + `
    <div class="notice">${t(
    "Photos are optional. Displayed photos are illustrative.",
    "ಫೋಟೋ ಕಡ್ಡಾಯವಲ್ಲ. ಇಲ್ಲಿನ ಚಿತ್ರಗಳು ಉದಾಹರಣೆಗಾಗಿ ಮಾತ್ರ."
  )}</div>
    <div class="products wide-products">
      ${products.map(productCard).join("")}
    </div>`,

  money: () => heading(
    t("My money", "ನನ್ನ ಹಣ"),
    t("Recorded order values", "ದಾಖಲಾದ ಆರ್ಡರ್ ಮೊತ್ತಗಳು")
  ) + `
    <section class="panel">
      <div class="notice">${t(
    "Payment tracking is not connected yet. These are order values, not verified payments.",
    "ಪಾವತಿ ದಾಖಲಾತಿ ಇನ್ನೂ ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ. ಇವು ಆರ್ಡರ್ ಮೊತ್ತಗಳು; ದೃಢೀಕರಿಸಿದ ಪಾವತಿಗಳಲ್ಲ."
  )}</div>
      ${orders.filter(o => !["declined", "cancelled"].includes(o.status)).map(o => `
        <div class="ledger-row">
          <div>
            <strong>${esc(o.customer_name)} · #MB${esc(o.id.slice(0, 8))}</strong>
            <p>${esc(statusLabel(o.status))}</p>
          </div>
          <strong>${money(orderValue(o))}</strong>
        </div>`).join("")}
    </section>`,

  passport: () => {
    const done = orders.filter(o => o.status === "delivered");

    return heading(
      t("My business story", "ನನ್ನ ವ್ಯಾಪಾರದ ಕಥೆ"),
      t("Every small order is a step forward.", "ಪ್ರತಿ ಆರ್ಡರ್ ಒಂದು ಮುಂದಿನ ಹೆಜ್ಜೆ."),
      `<button class="btn secondary" onclick="window.print()">
        ${icon("download")}${t("Print / PDF", "ಪ್ರಿಂಟ್ / PDF")}
      </button>`
    ) + `
      <section class="passport">
        <p class="eyebrow">${t("BUSINESS PASSPORT", "ವ್ಯಾಪಾರದ ದಾಖಲೆ")}</p>
        <h2>${esc(t(shop.name, shop.name_kn || shop.name))}</h2>
        <p>${esc(shop.area)}</p>
        <div class="passport-grid">
          <div><strong>${done.length}</strong>
            <span>${t("Delivered orders", "ವಿತರಿಸಿದ ಆರ್ಡರ್‌ಗಳು")}</span></div>
          <div><strong>${done.filter(o => o.confirmed).length}</strong>
            <span>${t("Customer-confirmed receipts", "ಗ್ರಾಹಕರು ದೃಢೀಕರಿಸಿದ ಸ್ವೀಕೃತಿಗಳು")}</span></div>
          <div><strong>${money(done.reduce((sum, o) => sum + orderValue(o), 0))}</strong>
            <span>${t("Delivered order value", "ವಿತರಿಸಿದ ಆರ್ಡರ್ ಮೊತ್ತ")}</span></div>
        </div>
      </section>
      <div class="notice">${t(
      "Based on the latest 100 orders. Order value is not verified income. This is not a credit score or a loan guarantee.",
      "ಇತ್ತೀಚಿನ 100 ಆರ್ಡರ್‌ಗಳ ಆಧಾರಿತ ದಾಖಲೆ. ಆರ್ಡರ್ ಮೊತ್ತ ದೃಢೀಕರಿಸಿದ ಆದಾಯವಲ್ಲ. ಇದು ಕ್ರೆಡಿಟ್ ಸ್ಕೋರ್ ಅಥವಾ ಸಾಲದ ಭರವಸೆಯಲ್ಲ."
    )}</div>`;
  },

  chat: () => heading(
    t("Your WhatsApp connection", "ನಿಮ್ಮ WhatsApp ಸಂಪರ್ಕ"),
    t("Customer conversations become confirmed orders.", "ಗ್ರಾಹಕರ ಸಂಭಾಷಣೆಗಳು ದೃಢೀಕರಿಸಿದ ಆರ್ಡರ್‌ಗಳಾಗುತ್ತವೆ.")
  ) + `
    <div class="chat">
      <div class="chat-header">
        ${icon("chat")}
        <div><strong>Mane Bazaar</strong>
          <small>${t("Customer order bot", "ಗ್ರಾಹಕರ ಆರ್ಡರ್ ಬಾಟ್")}</small></div>
      </div>
      <div class="chat-body">
        <div class="bubble">${t(
    "Customers choose a product, quantity and delivery option on WhatsApp. After CONFIRM, their order appears in My orders.",
    "ಗ್ರಾಹಕರು WhatsApp ನಲ್ಲಿ ಉತ್ಪನ್ನ, ಪ್ರಮಾಣ ಮತ್ತು ವಿತರಣೆಯ ಆಯ್ಕೆ ಮಾಡುತ್ತಾರೆ. CONFIRM ನಂತರ ಆರ್ಡರ್ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ."
  )}</div>
        <div class="bubble">${t(
    "Keep the Windows bot running for WhatsApp replies and customer status updates. This page does not monitor the bot connection or display chat transcripts.",
    "WhatsApp ಉತ್ತರಗಳು ಮತ್ತು ಆರ್ಡರ್ ನವೀಕರಣಗಳಿಗೆ Windows ಬಾಟ್ ಚಾಲನೆಯಲ್ಲಿರಲಿ. ಈ ಪುಟ ಬಾಟ್ ಸಂಪರ್ಕ ಸ್ಥಿತಿ ಅಥವಾ ಚಾಟ್ ಸಂದೇಶಗಳನ್ನು ತೋರಿಸುವುದಿಲ್ಲ."
  )}</div>
      </div>
      <div class="chat-compose">
        <button class="btn" onclick="navigate('orders')">
          ${t("View orders", "ಆರ್ಡರ್‌ಗಳನ್ನು ನೋಡಿ")}
        </button>
      </div>
    </div>`
};

function showModal(html) {
  const dialog = document.getElementById("modal");
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}

function modalHead(title) {
  return `<div class="dialog-head">
    <h2>${title}</h2>
    <button class="circle-btn" type="button"
      onclick="closeModal()" aria-label="${t("Close", "ಮುಚ್ಚಿ")}">
      ${icon("close")}
    </button>
  </div>`;
}

function closeModal() {
  if (!busy) document.getElementById("modal").close();
}

function showAccount() {
  showModal(
    modalHead(t("Seller account", "ಮಾರಾಟಗಾರರ ಖಾತೆ")) +
    `<p><strong>${esc(t(shop.name, shop.name_kn || shop.name))}</strong></p>
     <p>${esc(shop.area)}</p>
     <button class="btn secondary" onclick="doLogout()">
       ${t("Sign out", "ಹೊರಬನ್ನಿ")}
     </button>`
  );
}

function help() {
  showModal(
    modalHead(t("A little help", "ಸಹಾಯ")) +
    `<p>${t(
      "Open My orders, accept an order, then mark it ready. Pickup customers confirm receipt through WhatsApp. For seller delivery, click Start delivery before the customer confirms receipt.",
      "ನನ್ನ ಆರ್ಡರ್‌ಗಳನ್ನು ತೆರೆಯಿರಿ, ಆರ್ಡರ್ ಸ್ವೀಕರಿಸಿ ಮತ್ತು ಸಿದ್ಧವಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ. ಗ್ರಾಹಕರು ಸ್ವೀಕೃತಿಯನ್ನು WhatsApp ಮೂಲಕ ದೃಢೀಕರಿಸುತ್ತಾರೆ."
    )}</p>
    <p>${t(
      "Payment tracking, voice ordering and pre-order controls are not connected in this version.",
      "ಈ ಆವೃತ್ತಿಯಲ್ಲಿ ಪಾವತಿ ದಾಖಲಾತಿ, ಧ್ವನಿ ಆರ್ಡರ್ ಮತ್ತು ಮುಂಗಡ ಆರ್ಡರ್ ನಿಯಂತ್ರಣ ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ."
    )}</p>`
  );
}

function confirmDecline(id) {
  showModal(
    modalHead(t("Decline this order?", "ಈ ಆರ್ಡರ್ ನಿರಾಕರಿಸಬೇಕೇ?")) +
    `<p>${t("The order will be declined and stock restored.", "ಆರ್ಡರ್ ನಿರಾಕರಿಸಿ ದಾಸ್ತಾನು ಮರುಸ್ಥಾಪಿಸಲಾಗುತ್ತದೆ.")}</p>
     <div class="form-actions">
       <button class="btn secondary" onclick="closeModal()">
         ${t("Keep order", "ಆರ್ಡರ್ ಉಳಿಸಿ")}
       </button>
       <button class="btn" onclick="orderAction('${id}','declined')">
         ${t("Decline order", "ಆರ್ಡರ್ ನಿರಾಕರಿಸಿ")}
       </button>
     </div>`
  );
}

async function orderAction(id, status) {
  if (busy) return;
  busy = true;

  try {
    await api("/orders/" + encodeURIComponent(id) + "/status", {
      method: "POST",
      body: { status }
    });

    document.getElementById("modal").close();
    await loadData();
    toast(t("Order updated", "ಆರ್ಡರ್ ಬದಲಿಸಲಾಗಿದೆ"));
  } catch (error) {
    toast(error.message);
  } finally {
    busy = false;
  }
}

function editProduct(id) {
  if (busy) return;
  const product = id ? products.find(p => p.id === id) : null;

  if (id && !product) return toast("Product not found");

  showModal(
    modalHead(product ? t("Edit item", "ಉತ್ಪನ್ನ ಬದಲಿಸಿ") : t("Add an item", "ಉತ್ಪನ್ನ ಸೇರಿಸಿ")) +
    `<form onsubmit="saveProduct(event,'${id || ""}')">
      <label>${t("Product name", "ಉತ್ಪನ್ನದ ಹೆಸರು")}
        <input name="name" value="${esc(product?.name || "")}"
          required maxlength="100">
      </label>
      <label>${t("Kannada name", "ಕನ್ನಡ ಹೆಸರು")}
        <input name="name_kn" value="${esc(product?.name_kn || "")}"
          maxlength="100">
      </label>
      <div class="form-grid">
        <label>${t("Price per pack (₹)", "ಒಂದು ಪ್ಯಾಕ್ ಬೆಲೆ (₹)")}
          <input name="price_rupees" type="number"
            min="1" max="100000" step="1" required
            value="${product?.price_rupees ?? ""}">
        </label>
        <label>${t("Available packs", "ಲಭ್ಯವಿರುವ ಪ್ಯಾಕ್‌ಗಳು")}
          <input name="stock" type="number"
            min="0" max="9999" step="1" required
            value="${product?.stock ?? ""}">
        </label>
      </div>
      <label>${t("Pack size", "ಪ್ಯಾಕ್ ಪ್ರಮಾಣ")}
        <input name="unit" value="${esc(product?.unit || "")}"
          placeholder="250 g box" required maxlength="60">
      </label>
      <label>${t("Visibility", "ಗೋಚರತೆ")}
        <select name="active">
          <option value="true" ${product?.active !== false ? "selected" : ""}>
            ${t("Listed", "ಪಟ್ಟಿಯಲ್ಲಿದೆ")}
          </option>
          <option value="false" ${product?.active === false ? "selected" : ""}>
            ${t("Paused", "ನಿಲ್ಲಿಸಲಾಗಿದೆ")}
          </option>
        </select>
      </label>
      <p class="form-error" role="alert" style="color:#a32626"></p>
      <div class="form-actions">
        <button class="btn secondary" type="button" onclick="closeModal()">
          ${t("Cancel", "ರದ್ದುಮಾಡಿ")}
        </button>
        <button class="btn" type="submit">
          ${t("Save item", "ಉತ್ಪನ್ನ ಉಳಿಸಿ")}
        </button>
      </div>
    </form>`
  );
}

async function saveProduct(event, id) {
  event.preventDefault();
  if (busy) return;

  busy = true;
  const form = event.target;
  const fields = new FormData(form);
  const button = form.querySelector('button[type="submit"]');
  const errorBox = form.querySelector(".form-error");

  const record = {
    name: String(fields.get("name") || "").trim(),
    name_kn: String(fields.get("name_kn") || "").trim(),
    price_rupees: Number(fields.get("price_rupees")),
    stock: Number(fields.get("stock")),
    unit: String(fields.get("unit") || "").trim(),
    active: fields.get("active") !== "false"
  };

  if (id) record.id = id;
  button.disabled = true;
  errorBox.textContent = "";

  try {
    await api("/products", { method: "POST", body: record });
    document.getElementById("modal").close();
    await loadData();
    toast(t("Item saved", "ಉತ್ಪನ್ನ ಉಳಿಸಲಾಗಿದೆ"));
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    button.disabled = false;
    busy = false;
  }
}

function startDashboard() {
  if (!document.getElementById("app")) {
    console.error('This frontend requires <div id="app"></div> in index.html.');
    return;
  }

  if (!document.getElementById("modal")) {
    const dialog = document.createElement("dialog");
    dialog.id = "modal";
    document.body.append(dialog);
  }

  if (!document.getElementById("toast")) {
    const element = document.createElement("div");
    element.id = "toast";
    element.setAttribute("role", "status");
    document.body.append(element);
  }

  document.getElementById("modal").addEventListener("cancel", event => {
    if (busy) event.preventDefault();
  });

  document.documentElement.lang = lang;

  document.getElementById("app").innerHTML =
    `<div class="panel" style="margin:40px">${t(
      "Connecting to your shop…", "ನಿಮ್ಮ ಅಂಗಡಿಗೆ ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ…"
    )}</div>`;

  loadData().catch(showLoadError);

  setInterval(() => {
    if (!isSeller || document.hidden || busy || loadingData) return;
    if (document.querySelector("dialog[open]")) return;
    if (document.activeElement?.matches("input,textarea,select")) return;

    loadData().catch(showLoadError);
  }, 5000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startDashboard);
} else {
  startDashboard();
}