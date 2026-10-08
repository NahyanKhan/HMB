const $ = id => document.getElementById(id);

let language = localStorage.getItem("mane-language") || "en";
let seller = false;
let catalog = { shop: null, products: [] };
let orders = [];
let selected = null;
let requestId = null;
let refreshing = false;
let busy = false;

const t = (english,kannada)=>
    language === "kn" ? kannada : english;
function escapeHtml(value){
    return String(value ?? "").replace(/[&<>"']/g, character =>
    "&#" + character.charCodeAt(0) + ";"
    );
}
function productName(product){
    return language === "kn" && product.name_kn ? product.name_kn : product.name;
}
function notice(message,error=false){
    $("notice").textContent=message;
    $("notice").className = error ? "error" : "";
}
async function api(path, body) {
  const response = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Mane-Request": "1"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}
function statusName(value){
    const labels ={
    
    new: ["Awaiting acceptance", "ಸ್ವೀಕಾರಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದೆ"],
    accepted: ["Preparing", "ತಯಾರಾಗುತ್ತಿದೆ"],
    ready: ["Ready", "ಸಿದ್ಧವಾಗಿದೆ"],
    picked_up: ["On the way", "ದಾರಿಯಲ್ಲಿದೆ"],
    delivered: ["Received", "ಸ್ವೀಕರಿಸಲಾಗಿದೆ"],
    cancelled: ["Cancelled", "ರದ್ದಾಗಿದೆ"],
    declined: ["Declined", "ನಿರಾಕರಿಸಲಾಗಿದೆ"]
  };
return labels[value] ? t(...labels[value]) : value;
}
function translate(){
    document.documentElement.lang = language;

  const labels = {
    language: ["ಕನ್ನಡ", "English"],
    tagline: ["Made at home. Shared with love.", "ಮನೆಯಿಂದ, ಪ್ರೀತಿಯಿಂದ."],
    "browse-tab": ["Shop", "ಅಂಗಡಿ"],
    "orders-tab": [
      seller ? "All orders" : "My orders",
      seller ? "ಎಲ್ಲಾ ಆರ್ಡರ್‌ಗಳು" : "ನನ್ನ ಆರ್ಡರ್‌ಗಳು"
    ],
    "account-tab": [
      seller ? "Sign out" : "Seller login",
      seller ? "ಹೊರಬನ್ನಿ" : "ಮಾರಾಟಗಾರರ ಪ್ರವೇಶ"
    ],
    "orders-title": [
      seller ? "All orders" : "My orders",
      seller ? "ಎಲ್ಲಾ ಆರ್ಡರ್‌ಗಳು" : "ನನ್ನ ಆರ್ಡರ್‌ಗಳು"
    ],
    "product-title": ["Add a product", "ಉತ್ಪನ್ನ ಸೇರಿಸಿ"],
    "save-product": ["Add product", "ಉತ್ಪನ್ನ ಸೇರಿಸಿ"],
    "login-title": ["Seller login", "ಮಾರಾಟಗಾರರ ಪ್ರವೇಶ"],
    "login-submit": ["Sign in", "ಪ್ರವೇಶಿಸಿ"],
    "quantity-label": ["Number of packs", "ಪ್ಯಾಕ್‌ಗಳ ಸಂಖ್ಯೆ"],
    "order-submit": ["Place order", "ಆರ್ಡರ್ ಮಾಡಿ"],
    "payment-note": [
      "Cash on handover. Seller acceptance is required.",
      "ಸ್ವೀಕರಿಸುವಾಗ ನಗದು ಪಾವತಿ. ಮಾರಾಟಗಾರರ ಒಪ್ಪಿಗೆ ಅಗತ್ಯ."
    ],
    footer: [
      "Hubballi pilot · Cash on handover · No online payment collected",
      "ಹುಬ್ಬಳ್ಳಿ ಪ್ರಾಯೋಗಿಕ ಸೇವೆ · ಸ್ವೀಕರಿಸುವಾಗ ನಗದು ಪಾವತಿ"
    ]
  };

  for (const [id, words] of Object.entries(labels)) {
    $(id).textContent = t(...words);
  }

  $("search").placeholder = t("Search products", "ಉತ್ಪನ್ನ ಹುಡುಕಿ");

  const form = $("order-form");
  form.elements.customer_name.placeholder = t("Your name", "ನಿಮ್ಮ ಹೆಸರು");
  form.elements.address.placeholder = t("Delivery address", "ವಿತರಣೆಯ ವಿಳಾಸ");

  form.elements.mode.options[0].textContent =
    t("Customer pickup", "ಅಂಗಡಿಯಿಂದ ಪಡೆಯುತ್ತೇನೆ");

  form.elements.mode.options[1].textContent =
    t("Request seller delivery", "ಮಾರಾಟಗಾರರಿಂದ ವಿತರಣೆ");

  $("login-form").elements.password.placeholder =
    t("Seller password", "ಮಾರಾಟಗಾರರ ಪಾಸ್‌ವರ್ಡ್");

  const product = $("product-form");
  product.elements.name.placeholder = t("Product name in English", "ಉತ್ಪನ್ನದ ಇಂಗ್ಲಿಷ್ ಹೆಸರು");
  product.elements.price_rupees.placeholder = t("Price in rupees", "ಬೆಲೆ ರೂಪಾಯಿಗಳಲ್ಲಿ");
  product.elements.stock.placeholder = t("Available packs", "ಲಭ್ಯವಿರುವ ಪ್ಯಾಕ್‌ಗಳು");
  product.elements.unit.placeholder = t("Pack size, e.g. 250 g box", "ಪ್ಯಾಕ್ ಗಾತ್ರ, ಉದಾ. 250 g");

  document.querySelectorAll("[data-close]").forEach(button => {
    button.textContent = t("Close", "ಮುಚ್ಚಿ");
  });
}
function renderProducts() {
  const query = $("search").value.trim().toLowerCase();

  const products = catalog.products.filter(product =>
    (product.name + " " + product.name_kn).toLowerCase().includes(query)
  );

  $("products").innerHTML = products.map(product => {
    const available =
      product.active &&
      product.stock > 0 &&
      catalog.shop?.is_open &&
(!product.closes_at || Date.parse(product.closes_at) > Date.now());

    return `
      <article class="card">
        <span class="badge">${t("Homemade", "ಮನೆಯ ತಯಾರಿ")}</span>
        <h2>${escapeHtml(productName(product))}</h2>
        <div class="price">₹${product.price_rupees}</div>
        <p>${escapeHtml(product.unit)}</p>
        <p>${product.stock} ${t("packs available", "ಪ್ಯಾಕ್‌ಗಳು ಲಭ್ಯ")}</p>
        ${seller ? "" : `
          <button data-buy="${escapeHtml(product.id)}"
                  ${available ? "" : "disabled"}>
            ${available ? t("Order", "ಆರ್ಡರ್ ಮಾಡಿ") : t("Unavailable", "ಲಭ್ಯವಿಲ್ಲ")}
          </button>
        `}
      </article>
    `;
  }).join("") || `<p>${t("No products found.", "ಉತ್ಪನ್ನಗಳು ಕಂಡುಬಂದಿಲ್ಲ.")}</p>`;
}
function actionButton(id, next, label) {
  return `
  <button data-order="${escapeHtml(id)}"
            data-next="${escapeHtml(next)}"
            ${busy ? "disabled" : ""}>
      ${label}
    </button>
  `;
}

function renderOrders() {
    $("orders").innerHTML = orders.map(order=>{
        let actions="";
        if (seller){
            if (order.status === "new"){
                actions += actionButton(order.id, "accepted", t("Accept", "ಸ್ವೀಕರಿಸಿ"));
        actions += actionButton(order.id, "declined", t("Decline", "ನಿರಾಕರಿಸಿ"));
      }

      if (order.status === "accepted") {
        actions += actionButton(order.id, "ready", t("Mark ready", "ಸಿದ್ಧವಾಗಿದೆ"));
      }

      if (order.status === "ready" && order.mode === "self") {
        actions += actionButton(order.id, "picked_up", t("Start delivery", "ವಿತರಣೆ ಆರಂಭಿಸಿ"));
      }

      if (["accepted", "ready"].includes(order.status)) {
        actions += actionButton(order.id, "cancelled", t("Cancel", "ರದ್ದುಮಾಡಿ"));
      }
} else {
      if (order.status === "new") {
        actions += actionButton(order.id, "cancelled", t("Cancel", "ರದ್ದುಮಾಡಿ"));
      }

      const canConfirm =
        (order.mode === "pickup" && order.status === "ready") ||
        (order.mode === "self" && order.status === "picked_up");

      if (canConfirm) {
        actions += actionButton(
          order.id, "delivered",
          t("I received my order", "ನನ್ನ ಆರ್ಡರ್ ಸ್ವೀಕರಿಸಿದ್ದೇನೆ")
        );
      }
    }
return `
<article class="card">
        <span class="badge">${statusName(order.status)}</span>
        <h3>${escapeHtml(order.product_name)}</h3>
        <p>${order.qty} × ₹${order.price_rupees}
           = ₹${order.qty * order.price_rupees}</p>
        <p>${escapeHtml(order.customer_name)}</p>
        <p>${order.mode === "pickup"
          ? t("Customer pickup", "ಅಂಗಡಿಯಿಂದ ಪಡೆಯುವುದು")
          : escapeHtml(order.address)}</p>
          <small>#${escapeHtml(order.id.slice(0,8))}</small>
         <div class="actions">${actions}</div>
 </article>
 `;
  }).join("") || `<p>${t("No orders yet.", "ಇನ್ನೂ ಆರ್ಡರ್‌ಗಳಿಲ್ಲ.")}</p>`;
}
function render() {
  translate();

  if (catalog.shop) {
    $("shop-name").textContent = productName(catalog.shop);
    $("shop-area").textContent = catalog.shop.area + " · Hubballi";
    $("shop-status").textContent = catalog.shop.is_open
      ? t("Open for orders", "ಆರ್ಡರ್‌ಗಳಿಗೆ ತೆರೆದಿದೆ")
      : t("Currently closed", "ಪ್ರಸ್ತುತ ಮುಚ್ಚಲಾಗಿದೆ");

  }
$("seller-panel").hidden = !seller;
renderProducts();
renderOrders();
}
async function refresh(){
if (refreshing) return;
  refreshing=true;
  try {
    const me = await api("me");

    const results = await Promise.all([
      api("catalog"),
      api("orders")
    ]);

    seller = me.seller;
    catalog = results[0];
    orders = results[1];
    render();
  } finally {
    refreshing = false;
  }
}
function showOrders(show){
  $("browse-panel").hidden=show;
  $("orders-panel").hidden=!show;

}
$("browse-tab").onclick = () => showOrders(false);
$("orders-tab").onclick = () => showOrders(true);
$("search").oninput = renderProducts;
$("language").onclick = () => {
  language = language === "en" ? "kn" : "en";
  localStorage.setItem("mane-language", language);
  render();
};

document.querySelectorAll("[data-close]").forEach(button => {
  button.onclick = () => button.closest("dialog").close();
});
$("account-tab").onclick =async()=>{
  if (!seller){
    $("login-dialog").showModal();
    return;
  }
try{
  await api("logout", {});
    await refresh();
    notice(t("Signed out.", "ಹೊರಬಂದಿದ್ದೀರಿ."));
  } catch (error) {
    notice(error.message, true);
  }
};
async function submitForm(event, work) {
  event.preventDefault();

  const button = event.submitter;
  const errorBox = event.target.querySelector(".form-error");
  button.disabled = true;

  if (errorBox) errorBox.textContent = "";

  try {
    await work();
  } catch (error) {
    if (errorBox) errorBox.textContent = error.message;
    else notice(error.message, true);
  } finally {
    button.disabled = false;
  }
}

$("login-form").onsubmit = event => submitForm(event, async () => {
  await api("login", {
    password: event.target.elements.password.value
  });

  event.target.reset();
  $("login-dialog").close();
  await refresh();
  notice(t("Seller dashboard opened.", "ಮಾರಾಟಗಾರರ ಪುಟ ತೆರೆಯಲಾಗಿದೆ."));
});
$("product-form").onsubmit = event => submitForm(event, async () => {
  const values = Object.fromEntries(new FormData(event.target));

  values.price_rupees = Number(values.price_rupees);
  values.stock = Number(values.stock);

  await api("products", values);
  event.target.reset();
notice(t("Product added.", "ಉತ್ಪನ್ನ ಸೇರಿಸಲಾಗಿದೆ."));
await refresh();
});

$("products").onclick = event => {
      const button = event.target.closest("[data-buy]");
    if(!button)return;
    selected=catalog.products.find(product=>product.id===button.dataset.buy);

  if (!selected)return;
  requestId=crypto.randomUUID();
  const form=$("order-form");
  form.reset();
  form.elements.qty.max=Math.min(20,selected.stock);
  form.elements.address.hidden = true;
  form.elements.address.required = false;

  $("order-product").textContent = productName(selected);
  $("order-price").textContent =
    "₹" + selected.price_rupees + " / " + selected.unit;

  form.querySelector(".form-error").textContent = "";
  $("order-dialog").showModal();
};

$("order-form").elements.mode.onchange = event => {
  const address = $("order-form").elements.address;
  address.hidden = event.target.value === "pickup";
  address.required = event.target.value === "self";
};
$("order-form").onsubmit = event => submitForm(event, async () => {
  const values = Object.fromEntries(new FormData(event.target));
  values.product_id=selected.id;
   values.request_id = requestId;
  values.qty = Number(values.qty);

  await api("orders", values);

  $("order-dialog").close();
  showOrders(true);
  notice(t("Order sent to the seller.", "ಆರ್ಡರ್ ಮಾರಾಟಗಾರರಿಗೆ ಕಳುಹಿಸಲಾಗಿದೆ."));
  await refresh();
});

$("orders").onclick=async event=>{
const button = event.target.closest("[data-order]");  if (!button ||busy)return;
  const next = button.dataset.next;
  if (["cancelled", "declined", "delivered"].includes(next)) {
    const message = next === "delivered"
      ? t("Have you actually received the order?", "ನೀವು ಆರ್ಡರ್ ಸ್ವೀಕರಿಸಿದ್ದೀರಾ?")
      : t("Confirm this action?", "ಈ ಕ್ರಮವನ್ನು ಖಚಿತಪಡಿಸುತ್ತೀರಾ?");

    if (!confirm(message)) return;
  }

  busy = true;
  button.disabled = true;
try{
  await api("orders/"+button.dataset.order+"/status",{
  status: next
});

    notice(t("Order updated.", "ಆರ್ಡರ್ ನವೀಕರಿಸಲಾಗಿದೆ."));
  } catch (error) {
    notice(error.message, true);
  } finally {
    busy = false;
    refresh().catch(error => notice(error.message, true));
  }
}
translate();

refresh().catch(error => notice(error.message, true));

setInterval(() => {
  if (!document.hidden && !busy) {
    refresh().catch(error => notice(error.message, true));
  }
}, 5000);

