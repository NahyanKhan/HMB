const $ = id => document.getElementById(id);
let language = localStorage.getItem("mane-language") || "kn";
let state = null;
let busy = false;
let loading = false;
const t = (en, kn) => language === "kn" ? kn : en;
function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character =>
        "&#" + character.charCodeAt(0) + ";"
    );
}
async function api(path, body) {
    const response = await fetch ("/api/" + path, {
        method: body === undefined ? "GET" : "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            "X-Mane-Request": "1"
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.error || "Request failed");
        error.status = response.status;
        throw error;
    }
    return data;
}
function translate() {
    document.documentElement.lang = language;
    const labels = {
    language: ["ಕನ್ನಡ", "English"],
    title: ["Rider desk", "ರೈಡರ್ ಪುಟ"],
    "login-button": ["Sign in", "ಪ್ರವೇಶಿಸಿ"],
    "availability-title": ["Your availability", "ನಿಮ್ಮ ಲಭ್ಯತೆ"],
    "availability-note": [
      "Choose your area. Refresh availability every ten minutes. This pilot matches the shop's neighbourhood, not GPS.",
      "ಪ್ರದೇಶ ಆರಿಸಿ. ಪ್ರತಿ ಹತ್ತು ನಿಮಿಷಕ್ಕೆ ಲಭ್ಯತೆ ನವೀಕರಿಸಿ. ಇದು ಪ್ರದೇಶದ ಆಧಾರಿತ ಸೇವೆ; GPS ಅಲ್ಲ."
    ],
    online: ["Go online / refresh", "ಆನ್‌ಲೈನ್ / ನವೀಕರಿಸಿ"],
    offline: ["Go offline", "ಆಫ್‌ಲೈನ್"],
    "current-title": ["Your current delivery", "ನಿಮ್ಮ ಪ್ರಸ್ತುತ ವಿತರಣೆ"],
    "jobs-title": ["Available pickups", "ಲಭ್ಯವಿರುವ ಪಿಕಪ್‌ಗಳು"],
    logout: ["Sign out", "ಹೊರಬನ್ನಿ"]
  };

  for (const [id, words] of Object.entries(labels)) {
    $(id).textContent = t(...words);
  }
}
function render() {
    translate();
    $("login-panel").hidden = Boolean(state);
    $("desk").hidden = !state;
    if(!state) return;
    if (!$("area").options.length){
        $("area").innerHTML = state.areas.map(area =>
        `<option>${escapeHtml(area)}</option>`
        ).join("");
        $("area").value = state.rider.area;    
    }
    $("availability-status").textContent = state.active
    ? t("You are available for pickups.", "ನೀವು ಪಿಕಪ್‌ಗೆ ಲಭ್ಯವಿದ್ದೀರಿ.")
    : t("Offline or expired — refresh to receive jobs.", "ಆಫ್‌ಲೈನ್ ಅಥವಾ ಅವಧಿ ಮುಗಿದಿದೆ — ನವೀಕರಿಸಿ.");
    if ( document.activeElement?.name === "code") return;
    $("assigned").innerHTML = state.assigned.map(order => `
    <article class="order-card">
      <span class="status">${order.status === "ready"
        ? t("Collect from seller", "ಮಾರಾಟಗಾರರಿಂದ ಪಡೆಯಿರಿ")
        : t("Deliver to customer", "ಗ್ರಾಹಕರಿಗೆ ತಲುಪಿಸಿ")}</span>
        <h3>${escapeHtml(order.product_name)}</h3>
        <p>${order.qty} ${t("packs", "ಪ್ಯಾಕ್‌ಗಳು")}</p>
      <p>${t("Pickup:", "ಪಿಕಪ್:")} ${escapeHtml(state.pickup_address)}</p>
      <p>${t("Customer:", "ಗ್ರಾಹಕರು:")} ${escapeHtml(order.customer_name)}</p>
      <p>${t("Destination:", "ತಲುಪುವ ವಿಳಾಸ:")} ${escapeHtml(order.address)}</p>
<form data-job = "${escapeHtml(order.id)}"
data-step="${order.status === "ready" ? "pickup" :
    "deliver"}">
    <label>
    ${order.status === "ready"
        ? t("Seller's pickup code","ಮಾರಾಟಗಾರರ ಪಿಕಪ್ ಕೋಡ್")
        : t("Customer's delivery code", "ಗ್ರಾಹಕರ ವಿತರಣಾ ಕೋಡ್")}
        <input name="code" required minlength="6" maxlength="6"
        autocomplete="off" autocapitalize="characters">
        </label>
        <button class="btn green" ${busy ? "disabled" : ""}>
        ${order.status === "ready"
            ? t("Confirm pickup", "ಪಿಕಪ್ ದೃಢೀಕರಿಸಿ")
            : t("Confirm delivery", "ವಿತರಣೆ ದೃಢೀಕರಿಸಿ")}
            </button>
            </form>
            </article>
            `).join("") || `<p class="empty">${t("No active delivery.", "ಪ್ರಸ್ತುತ ವಿತರಣೆ ಇಲ್ಲ.")}</p>`;
            $("jobs").innerHTML = state.jobs.map(order => `
                <article class="order-card">
                <h3>${escapeHtml(order.product_name)}</h3>
                <p>${order.qty} ${t("packs","ಪ್ಯಾಕ್‌ಗಳು")}</p>
                <button class="btn" data-claim = "${escapeHtml(order.id)}"
                ${busy || state.assigned.length ? "disabled" : ""}>
                ${t("Claim delivery","ವಿತರಣೆ ಸ್ವೀಕರಿಸಿ")}
                </button>
                </article>
                `).join("") || `<p class="empty">${t("No ready pickups in your area.", "ನಿಮ್ಮ ಪ್ರದೇಶದಲ್ಲಿ ಸಿದ್ಧ ಪಿಕಪ್‌ಗಳಿಲ್ಲ.")}</p>`;
}
async function refresh() {
    if (loading) return;
    loading = true;
    try{
        state = await api ("rider/state");
        render();
    } catch (error) {
        if (error.status === 403 || error.status === 401){
            state = null;
            render();
        } else{
            $("message").textContent = error.message;
        }
    } finally {
        loading = false;
    }
}
async function action(work){
    if (busy) return;
    busy = true;
    $("message").textContent = "";
    try {
        await work();
        $("message").textContent = t("Saved.","ಉಳಿಸಲಾಗಿದೆ.");
    } catch (error) {
        $("message").textContent = error.message;
    } finally {
        busy = false;
        await refresh();
    }
}
$("language").onclick = () => {
    language = language === "kn" ? "en" : "kn";
    localStorage.setItem("mane-language", language);
    render(); 
};
$("login-form").onsubmit = event => {
  event.preventDefault();

  action(async () => {
    await api("rider/login", {
      password: event.target.elements.password.value
    });
    event.target.reset();
  });
};
$("availability-form").onsubmit = event => {
  event.preventDefault();

  action(() => api("rider/availability", {
    area: $("area").value,
    online: event.submitter.value === "true"
  }));
};
$("jobs").onclick = event => {
  const button = event.target.closest("[data-claim]");
  if (!button) return;

  action(() => api("rider/claim", {
    id: button.dataset.claim
  }));
};
$("assigned").onsubmit = event => {
    event.preventDefault();
    const form = event.target
    const code = form.elements.code.value.trim();
    form.elements.code.blur();
    action(() => api("rider/step", {
        id: form.dataset.job,
    step: form.dataset.step,
code}));
};
$("logout").onclick = () => action(async () => {
  await api("logout", {});
  state = null;
  render();
});

render();
refresh();

setInterval(() => {
  if (!busy && !document.hidden) refresh();
}, 5000);