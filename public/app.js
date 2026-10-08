const icons = {home:'M3 10l9-7 9 7v10H3Z M9 20v-7h6v7',bag:'M5 7h14l1 14H4Z M8 8V6a4 4 0 0 1 8 0v2',box:'M3 7l9-4 9 4v10l-9 4-9-4Z M3 7l9 5 9-5 M12 12v9',wallet:'M3 5h17v15H3Z M16 10h5v6h-5Z M5 5V3h12',chart:'M4 20V10 M10 20V4 M16 20v-8 M22 20H2',chat:'M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z M7 9h9 M7 13h6',plus:'M12 5v14 M5 12h14',mic:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0Z M6 10v2a6 6 0 0 0 12 0v-2 M12 18v4 M9 22h6',clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',check:'M5 12l4 4L19 6',bell:'M5 17V9a7 7 0 0 1 14 0v8H5Z M9 21h6',close:'M6 6l12 12 M6 18L18 6',help:'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',sun:'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',pause:'M8 4v16 M16 4v16',leaf:'M20 3C9 2 2 9 5 16s15 5 15-13Z M4 21L15 9',download:'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4'};
const icon=k=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[k]||icons.home}"/></svg>`;

let lang=localStorage.getItem('mane-language')||'en',view='home',filter='all';
let shop = null, products = [], orders = [];
let isSeller = false;

const t=(en,kn)=>lang==='kn'?kn:en, money=n=>'₹'+Number(n).toLocaleString('en-IN'),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assets={chakli:'https://upload.wikimedia.org/wikipedia/commons/7/73/Chakli.jpg',peda:'https://upload.wikimedia.org/wikipedia/commons/0/01/Dharwad_peda.jpg',pickle:'https://upload.wikimedia.org/wikipedia/commons/f/f3/Mangopickle.jpg'};

const pname=p=>t(p.name,p.name_kn || p.name),punit=p=>p.unit,statusLabel=s=>({new:t('New order','ಹೊಸ ಆರ್ಡರ್'),accepted:t('Preparing','ತಯಾರಾಗುತ್ತಿದೆ'),ready:t('Ready','ಸಿದ್ಧವಾಗಿದೆ'),completed:t('Completed','ಪೂರ್ಣಗೊಂಡಿದೆ'),declined:t('Declined','ನಿರಾಕರಿಸಲಾಗಿದೆ')})[s];

function photo(p,cls=''){return p && assets[p.image]?`<img class="${cls}" src="${assets[p.image]}" alt="${esc(pname(p))}" loading="lazy">`:`<div class="${cls}" style="display:grid;place-items:center;color:#936e36">${icon('box')}</div>`}
function navigate(v){view=v;render();window.scrollTo(0,0)}
function setLang(l){lang=l;localStorage.setItem('mane-language',l);document.documentElement.lang=l==='kn'?'kn':'en';render()}
function toast(msg){let el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove('show'),3500)}

async function api(path, options = {}) {
    options.headers = {
        "x-mane-request": "1",
        "Content-Type": "application/json",
        ...options.headers
    };
    if (options.body && typeof options.body !== "string") {
        options.body = JSON.stringify(options.body);
    }
    const res = await fetch("/api" + path, options);
    if (!res.ok) {
        let msg = "Network error";
        try { msg = (await res.json()).error; } catch (e) {}
        throw new Error(msg);
    }
    return res.json();
}

async function loadData() {
    try {
        const [meData, catalogData, ordersData] = await Promise.all([
            api("/me"),
            api("/catalog"),
            api("/orders")
        ]);
        isSeller = meData.seller;
        shop = catalogData.shop;
        products = catalogData.products || [];
        orders = ordersData || [];
        render();
    } catch (e) {
        if (e.message.includes("login") || e.message.includes("required")) {
            renderLogin();
        } else {
            console.error(e);
        }
    }
}

function renderLogin() {
    document.getElementById("app").innerHTML = `
        <div style="max-width: 400px; margin: 50px auto; padding: 20px;">
            <div class="panel">
                <h2>Seller Login</h2>
                <form onsubmit="doLogin(event)">
                    <label style="display:block; margin-bottom: 10px;">Password
                        <input type="password" name="password" required style="width: 100%; padding: 8px; margin-top: 5px;">
                    </label>
                    <button class="btn" type="submit" style="width: 100%;">Login</button>
                </form>
            </div>
        </div>
    `;
}

async function doLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
        await api("/login", {
            method: "POST",
            body: { password: e.target.password.value }
        });
        await loadData();
    } catch (err) {
        alert(err.message);
        btn.disabled = false;
    }
}

async function doLogout() {
    await api("/logout", { method: "POST" });
    location.reload();
}

function render(){
    if (!shop) return;
    let nav=[
        ['home','home',t('My home','ಮುಖಪುಟ')],
        ['orders','bag',t('My orders','ನನ್ನ ಆರ್ಡರ್‌ಗಳು')],
        ['products','box',t('My products','ನನ್ನ ಉತ್ಪನ್ನಗಳು')],
        ['money','wallet',t('My money','ನನ್ನ ಹಣ')],
        ['passport','chart',t('My business','ನನ್ನ ವ್ಯಾಪಾರ')],
        ['chat','chat',t('WhatsApp demo','WhatsApp ಡೆಮೊ')]
    ];
    
    document.getElementById('app').innerHTML=`
    <div class="shell">
        <aside class="sidebar">
            <div class="brand"><span class="brandmark">${icon('home')}</span>Mane Bazaar</div>
            <div class="brand-sub">HUBBALLI · ಹುಬ್ಬಳ್ಳಿ</div>
            <nav class="nav" aria-label="${t('Main navigation','ಮುಖ್ಯ ಮೆನು')}">
                ${nav.map(([v,i,label])=>`<button data-view="${v}" class="${view===v?'active':''}" onclick="navigate('${v}')" ${view===v?'aria-current="page"':''}>${icon(i)}<span>${label}</span>${v==='orders'?`<span class="count">${orders.filter(o=>o.status==='new').length}</span>`:''}</button>`).join('')}
            </nav>
            <div class="sidebar-bottom">
                <div class="help-card">
                    ${icon('help')}<strong> ${t('A little help?','ಸಹಾಯ ಬೇಕೇ?')}</strong>
                    <p>${t('Let’s take it one step at a time.','ಒಂದೊಂದೇ ಹೆಜ್ಜೆ ಇಡೋಣ.')}</p>
                    <button class="text-btn" onclick="help()">${t('Get help','ಸಹಾಯ ಪಡೆಯಿರಿ')}</button>
                </div>
                <div class="profile">
                    <div class="avatar">${shop.name.charAt(0)}</div>
                    <div>
                        <strong>${esc(t(shop.name, shop.name_kn || shop.name))}</strong>
                        <small>${esc(shop.area)}</small>
                    </div>
                </div>
            </div>
        </aside>
        <main class="main">
            <header class="topbar">
                <div class="crumb">${t('My shop','ನನ್ನ ಅಂಗಡಿ')} <strong>/ ${nav.find(x=>x[0]===view)?.[2]||''}</strong></div>
                <div class="brand mobile-brand"><span class="brandmark">${icon('home')}</span>Mane Bazaar</div>
                <div class="top-actions">
                    <div class="lang" aria-label="Language">
                        <button onclick="setLang('kn')" class="${lang==='kn'?'selected':''}" aria-pressed="${lang==='kn'}">ಕನ್ನಡ</button>
                        <button onclick="setLang('en')" class="${lang==='en'?'selected':''}" aria-pressed="${lang==='en'}">English</button>
                    </div>
                    <button class="circle-btn" onclick="navigate('orders')" aria-label="${t('View new orders','ಹೊಸ ಆರ್ಡರ್‌ಗಳನ್ನು ನೋಡಿ')}">${icon('bell')}</button>
                    <button class="text-btn" onclick="doLogout()">Logout</button>
                    <div class="avatar">${shop.name.charAt(0)}</div>
                </div>
            </header>
            <div class="content">
                ${view==='home'?home():screens[view]?screens[view]():''}
            </div>
        </main>
    </div>`;
}

function stats(){
    return `<div class="stats">
        <div class="stat">
            <div class="stat-icon">${icon('bag')}</div>
            <div>
                <p>${t('Orders to prepare','ತಯಾರಿಸಬೇಕಾದ ಆರ್ಡರ್‌ಗಳು')}</p>
                <strong>${orders.filter(o=>['new','accepted'].includes(o.status)).length}</strong>
            </div>
        </div>
        <div class="stat">
            <div class="stat-icon">${icon('wallet')}</div>
            <div>
                <p>${t('Received today','ಇಂದು ಬಂದ ಹಣ')}</p>
                <strong>${money(orders.filter(o=>o.paid).reduce((s,o)=>s+(products.find(p=>p.id===o.product_id)?.price_rupees||0)*o.qty,0))}</strong>
            </div>
        </div>
        <div class="stat">
            <div class="stat-icon">${icon('clock')}</div>
            <div>
                <p>${t('Awaiting payment','ಬರಬೇಕಾದ ಹಣ')}</p>
                <strong>${money(orders.filter(o=>!o.paid&&o.status!=='declined').reduce((s,o)=>s+(products.find(p=>p.id===o.product_id)?.price_rupees||0)*o.qty,0))}</strong>
            </div>
        </div>
    </div>`;
}

function productCard(p){
    return `<article class="product">
        <div class="photo">
            ${photo(p)}
            <span class="pill">${p.active?t('Available','ಲಭ್ಯವಿದೆ'):t('Paused','ನಿಲ್ಲಿಸಲಾಗಿದೆ')}</span>
        </div>
        <div class="product-body">
            <h3>${esc(pname(p))}</h3>
            <p>${esc(punit(p))} · ${p.stock} ${t('available','ಲಭ್ಯ')}</p>
            <div class="product-bottom">
                <strong>${money(p.price_rupees)}</strong>
                <button onclick="editProduct('${p.id}')">${t('Edit','ಬದಲಿಸಿ')}</button>
            </div>
        </div>
    </article>`;
}

function home(){
    return `<div class="page-heading">
        <div>
            <p class="eyebrow">${new Date().toLocaleDateString(lang==='kn'?'kn-IN':'en-IN', {weekday: 'long', day: 'numeric', month: 'long'})}</p>
            <h1>${t('Namaskara, ' + shop.name.split(' ')[0] + '!','ನಮಸ್ಕಾರ, ' + (shop.name_kn||shop.name).split(' ')[0] + '!')} <span style="color:#dd9d1b">☀</span></h1>
            <p class="sub">${t('A little homemade. A lot of heart.','ಮನೆಯ ರುಚಿ, ಮನದ ಪ್ರೀತಿ.')}</p>
        </div>
        <button class="pill" onclick="toggleShop()">
            <span class="dot"></span>${shop.is_open?t('Shop is open','ಅಂಗಡಿ ತೆರೆದಿದೆ'):t('Shop is paused','ಅಂಗಡಿ ನಿಲ್ಲಿಸಲಾಗಿದೆ')}
        </button>
    </div>
    <section class="hero">
        <div class="hero-copy">
            <div class="eyebrow">${t('YOUR SHOP. YOUR WAY.','ನಿಮ್ಮ ಅಂಗಡಿ. ನಿಮ್ಮ ಆಯ್ಕೆ.')}</div>
            <h2>${t('What’s cooking<br>in your shop today?','ಇಂದು ನಿಮ್ಮ ಅಂಗಡಿಯಲ್ಲಿ<br>ಏನು ವಿಶೇಷ?')}</h2>
            <p>${t('Add something delicious. Your customers are just around the corner.','ನಿಮ್ಮ ಉತ್ಪನ್ನ ಸೇರಿಸಿ. ಹತ್ತಿರದ ಗ್ರಾಹಕರನ್ನು ತಲುಪಿ.')}</p>
            <button class="btn yellow" onclick="editProduct()">${icon('plus')}${t('Add today’s item','ಇಂದಿನ ಉತ್ಪನ್ನ ಸೇರಿಸಿ')}</button>
        </div>
        <div class="hero-art">
            ${assets.chakli?`<img src="${assets.chakli}" alt="">`:''}
            <div class="hero-label">
                <strong>${t('Made with love, in Hubballi','ಹುಬ್ಬಳ್ಳಿಯ ಮನೆಯ ರುಚಿ')}</strong>
                <small>${t('Your neighbourhood favourites','ನಿಮ್ಮ ನೆಚ್ಚಿನ ಸ್ಥಳೀಯ ಉತ್ಪನ್ನಗಳು')}</small>
            </div>
        </div>
    </section>
    ${stats()}
    <div class="dashboard-grid">
        <div>
            <section class="panel">
                <div class="section-head">
                    <h2>${t('A little work for today','ಇಂದಿನ ಕೆಲಸಗಳು')}</h2>
                    <button class="text-btn" onclick="navigate('orders')">${t('All orders','ಎಲ್ಲಾ ಆರ್ಡರ್‌ಗಳು')}</button>
                </div>
                ${orders.filter(o=>['new','accepted'].includes(o.status)).slice(0,3).map(o=>{
                    let p=products.find(p=>p.id===o.product_id);
                    return `<div class="order-row">
                        ${photo(p,'order-thumb')}
                        <div class="order-info">
                            <strong>${esc(o.customer_name)} · ${o.qty} × ${esc(p?pname(p):'Unknown')}</strong>
                            <p>${esc(o.address)} · ${o.mode==='pickup'?t('Pickup tomorrow','ನಾಳೆ ಬಂದು ಪಡೆಯುತ್ತಾರೆ'):t('Delivery requested','ವಿತರಣೆ ಕೋರಲಾಗಿದೆ')}</p>
                        </div>
                        <div class="order-price">
                            ${money((p?.price_rupees||0)*o.qty)}
                            <small>${statusLabel(o.status)}</small>
                        </div>
                    </div>`
                }).join('')||`<p class="muted">${t('You’re all caught up!','ಎಲ್ಲಾ ಕೆಲಸಗಳು ಮುಗಿದಿವೆ!')}</p>`}
            </section>
            <section class="panel">
                <div class="section-head">
                    <h2>${t('Fresh from your shop','ನಿಮ್ಮ ಅಂಗಡಿಯ ಉತ್ಪನ್ನಗಳು')}</h2>
                    <button class="text-btn" onclick="navigate('products')">${t('View shop','ಅಂಗಡಿ ನೋಡಿ')}</button>
                </div>
                <div class="products">${products.slice(0,3).map(productCard).join('')}</div>
            </section>
        </div>
        <div class="dashboard-right">
            <section class="panel">
                <div class="section-head">
                    <h2>${t('What would you like to do?','ನೀವು ಏನು ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?')}</h2>
                </div>
                <div class="action-grid">
                    <button class="action-tile" onclick="navigate('chat')">${icon('mic')}<span>${t('Speak to add','ಮಾತನಾಡಿ ಸೇರಿಸಿ')}</span></button>
                    <button class="action-tile" onclick="navigate('orders')">${icon('bag')}<span>${t('See my orders','ಆರ್ಡರ್‌ಗಳನ್ನು ನೋಡಿ')}</span></button>
                    <button class="action-tile" onclick="openWindow()">${icon('clock')}<span>${t('Open pre-orders','ಮುಂಗಡ ಆರ್ಡರ್ ತೆರೆಯಿರಿ')}</span></button>
                    <button class="action-tile" onclick="navigate('money')">${icon('wallet')}<span>${t('Check my money','ಹಣದ ವಿವರ ನೋಡಿ')}</span></button>
                </div>
            </section>
            <div class="tip">
                <h3>✦ ${t('Small batches. Less worry.','ಸ್ವಲ್ಪ ತಯಾರಿ. ಕಡಿಮೆ ಚಿಂತೆ.')}</h3>
                <p>${t('Taking orders for tomorrow? Set a limit and a closing time. Make only what your customers order.','ನಾಳೆಗಾಗಿ ಆರ್ಡರ್ ಪಡೆಯುತ್ತೀರಾ? ಮಿತಿ ಮತ್ತು ಕೊನೆಯ ಸಮಯ ನಿಗದಿಪಡಿಸಿ. ಆರ್ಡರ್ ಬಂದಷ್ಟೇ ತಯಾರಿಸಿ.')}</p>
                <button class="text-btn" style="margin-top:13px;color:#855907" onclick="openWindow()">${t('Set an order window','ಆರ್ಡರ್ ಸಮಯ ನಿಗದಿಪಡಿಸಿ')}</button>
            </div>
        </div>
    </div>`;
}

function showModal(html){let d=document.getElementById('modal');d.innerHTML=html;d.showModal()}
function modalHead(title){return `<div class="dialog-head"><h2>${title}</h2><button class="circle-btn" type="button" onclick="document.getElementById('modal').close()" aria-label="${t('Close','ಮುಚ್ಚಿ')}">${icon('close')}</button></div>`}
function toggleShop(){
    // Mock interaction for shop open/close toggle
    shop.is_open=!shop.is_open;
    render();
    toast(shop.is_open?t('Your shop is open','ನಿಮ್ಮ ಅಂಗಡಿ ತೆರೆದಿದೆ'):t('New orders paused. Existing orders are unchanged.','ಹೊಸ ಆರ್ಡರ್‌ಗಳನ್ನು ನಿಲ್ಲಿಸಲಾಗಿದೆ. ಹಳೆಯ ಆರ್ಡರ್‌ಗಳು ಹಾಗೆಯೇ ಇವೆ.'))
}
function help(){
    showModal(modalHead(t('Let’s make it easy','ಸುಲಭವಾಗಿ ಮಾಡೋಣ'))+`<p>${t('Add an item, accept an order, then mark it ready. You can use the app or try the WhatsApp simulator.','ಉತ್ಪನ್ನ ಸೇರಿಸಿ, ಆರ್ಡರ್ ಸ್ವೀಕರಿಸಿ, ನಂತರ ಸಿದ್ಧವಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ. ಆ್ಯಪ್ ಅಥವಾ WhatsApp ಮಾದರಿ ಬಳಸಿ.')}</p><button class="btn" onclick="document.getElementById('modal').close();navigate('chat')">${t('Try the WhatsApp demo','WhatsApp ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ')}</button>`)
}

function heading(title,sub,action=''){return `<div class="page-heading"><div><h1>${title}</h1><p class="sub">${sub}</p></div>${action}</div>`}

async function orderAction(id,status){
    try {
        await api("/orders/" + id + "/status", {
            method: "POST",
            body: { status }
        });
        await loadData();
        toast(t('Order updated','ಆರ್ಡರ್ ಬದಲಿಸಲಾಗಿದೆ'));
    } catch (e) {
        toast(e.message);
    }
}

function orderCard(o){
    let p=products.find(p=>p.id===o.product_id);
    return `<article class="order-card">
        <div class="order-card-head">
            <div>
                <h3>${esc(o.customer_name)}</h3>
                <small class="muted">#MB${String(o.id).substring(0,8)} · ${esc(o.address)}</small>
            </div>
            <span class="status ${o.status}">${statusLabel(o.status)}</span>
        </div>
        <div class="order-detail">
            ${photo(p,'order-thumb')}
            <div style="flex:1">
                <strong>${o.qty} × ${esc(p?pname(p):'Unknown')}</strong>
                <p>${esc(p?punit(p):'')}</p>
            </div>
            <strong>${money((p?.price_rupees||0)*o.qty)}</strong>
        </div>
        <div class="order-card-footer">
            <div>
                <small>${o.mode==='pickup'?t('Pickup','ಬಂದು ಪಡೆಯುವುದು'):t('Delivery requested','ವಿತರಣೆ ಕೋರಲಾಗಿದೆ')}</small>
                <p class="muted" style="font-size:13px;margin:3px 0">${o.paid?t('Payment: confirmed','ಪಾವತಿ: ದೃಢೀಕರಿಸಲಾಗಿದೆ'):t('Payment: pending','ಪಾವತಿ: ಬಾಕಿ ಇದೆ')}</p>
            </div>
            <div class="toolbar">
                ${o.status==='new'?`<button class="btn secondary small" onclick="confirmDecline('${o.id}')">${t('Decline','ನಿರಾಕರಿಸಿ')}</button><button class="btn green small" onclick="orderAction('${o.id}','accepted')">${icon('check')}${t('Accept','ಸ್ವೀಕರಿಸಿ')}</button>`:o.status==='accepted'?`<button class="btn small" onclick="orderAction('${o.id}','ready')">${t('Mark ready','ಸಿದ್ಧವಾಗಿದೆ')}</button>`:o.status==='ready'?`<button class="btn green small" onclick="confirmComplete('${o.id}')">${t('Mark handed over','ಹಸ್ತಾಂತರಿಸಲಾಗಿದೆ')}</button>`:''}
            </div>
        </div>
    </article>`
}

function confirmDecline(id){
    showModal(modalHead(t('Decline this order?','ಈ ಆರ್ಡರ್ ನಿರಾಕರಿಸಬೇಕೇ?'))+`<p>${t('This order will be closed.','ಈ ಆರ್ಡರ್ ಮುಚ್ಚಲಾಗುತ್ತದೆ.')}</p><div class="form-actions"><button class="btn secondary" onclick="document.getElementById('modal').close()">${t('Keep order','ಆರ್ಡರ್ ಉಳಿಸಿ')}</button><button class="btn" onclick="orderAction('${id}','declined');document.getElementById('modal').close()">${t('Decline order','ಆರ್ಡರ್ ನಿರಾಕರಿಸಿ')}</button></div>`)
}
function confirmComplete(id){
    showModal(modalHead(t('Has the order been handed over?','ಆರ್ಡರ್ ಹಸ್ತಾಂತರಿಸಿದ್ದೀರಾ?'))+`<p>${t('This records your confirmation.','ಇದು ನಿಮ್ಮ ದೃಢೀಕರಣವನ್ನು ದಾಖಲಿಸುತ್ತದೆ.')}</p><button class="btn green" onclick="orderAction('${id}','completed');document.getElementById('modal').close()">${t('Yes, handed over','ಹೌದು, ಹಸ್ತಾಂತರಿಸಲಾಗಿದೆ')}</button>`)
}

let windowInfo=null;
const screens={
    orders:()=>heading(t('My orders','ನನ್ನ ಆರ್ಡರ್‌ಗಳು'),t('One order at a time. You’ve got this.','ಒಂದೊಂದೇ ಆರ್ಡರ್. ನೀವು ಮಾಡಬಲ್ಲಿರಿ.'))+`<div class="tabs" aria-label="${t('Filter orders','ಆರ್ಡರ್‌ಗಳನ್ನು ಆಯ್ಕೆ ಮಾಡಿ')}">${[['all',t('All','ಎಲ್ಲಾ')],['new',t('New','ಹೊಸ')],['accepted',t('Preparing','ತಯಾರಿ')],['ready',t('Ready','ಸಿದ್ಧ')],['completed',t('Completed','ಪೂರ್ಣ')]].map(([f,l])=>`<button class="${filter===f?'active':''}" onclick="filter='${f}';render()">${l} ${f==='all'?orders.length:orders.filter(o=>o.status===f).length}</button>`).join('')}</div>${orders.filter(o=>filter==='all'||o.status===filter).map(orderCard).join('')||`<div class="panel empty">${t('No orders here yet.','ಇಲ್ಲಿ ಇನ್ನೂ ಆರ್ಡರ್‌ಗಳಿಲ್ಲ.')}</div>`}`,
    
    products:()=>heading(t('My products','ನನ್ನ ಉತ್ಪನ್ನಗಳು'),t('Your recipes. Your prices. Your pace.','ನಿಮ್ಮ ಉತ್ಪನ್ನ. ನಿಮ್ಮ ಬೆಲೆ. ನಿಮ್ಮ ಸಮಯ.'),`<button class="btn" onclick="editProduct()">${icon('plus')}${t('Add item','ಸೇರಿಸಿ')}</button>`)+`<div class="notice">${t('Photos are optional. These sample photos are illustrative.','ಫೋಟೋ ಕಡ್ಡಾಯವಲ್ಲ. ಇಲ್ಲಿನ ಚಿತ್ರಗಳು ಉದಾಹರಣೆಗಾಗಿ ಮಾತ್ರ.')}</div><div class="products wide-products">${products.map(productCard).join('')}</div>`,
    
    money:()=>heading(t('My money','ನನ್ನ ಹಣ'),t('Know what has arrived and what is still due.','ಬಂದ ಹಣ ಮತ್ತು ಬರಬೇಕಾದ ಹಣ ನೋಡಿ.'))+stats()+`<section class="panel"><div class="section-head"><h2>${t('Payment book','ಪಾವತಿ ಪುಸ್ತಕ')}</h2></div><div class="notice">${t('These are sample records.','ಇವು ಮಾದರಿ ದಾಖಲೆಗಳು.')}</div>${orders.filter(o=>o.status!=='declined').map(o=>{let p=products.find(p=>p.id===o.product_id);return `<div class="ledger-row"><div><strong>${esc(o.customer_name)} · #MB${String(o.id).substring(0,8)}</strong><p>${o.paid?t('Seller confirmed receipt','ಮಾರಾಟಗಾರರು ಸ್ವೀಕೃತಿ ದೃಢಪಡಿಸಿದ್ದಾರೆ'):t('Awaiting payment','ಪಾವತಿಗಾಗಿ ಕಾಯುತ್ತಿದೆ')}</p></div><div style="text-align:right"><strong>${money((p?.price_rupees||0)*o.qty)}</strong>${!o.paid?`<div><button class="text-btn" style="font-size:13px" onclick="confirmPaid('${o.id}')">${t('Record received','ಹಣ ಬಂದಿದೆಯೆಂದು ದಾಖಲಿಸಿ')}</button></div>`:''}</div></div>`}).join('')}</section>`,
    
    passport:()=>heading(t('My business story','ನನ್ನ ವ್ಯಾಪಾರದ ಕಥೆ'),t('Every small order is a step forward.','ಪ್ರತಿ ಆರ್ಡರ್ ಒಂದು ಮುಂದಿನ ಹೆಜ್ಜೆ.'),`<button class="btn secondary" onclick="window.print()">${icon('download')}${t('Print / PDF','ಪ್ರಿಂಟ್ / PDF')}</button>`)+`<section class="passport"><p class="eyebrow">${t('BUSINESS PASSPORT','ವ್ಯಾಪಾರದ ದಾಖಲೆ')}</p><h2>${esc(t(shop.name, shop.name_kn || shop.name))}</h2><p>${esc(shop.area)}</p><span class="pill">${t('Activity recorded since 2026','2026 ರಿಂದ ದಾಖಲಾದ ಚಟುವಟಿಕೆ')}</span><div class="passport-grid"><div><strong>${orders.filter(o=>o.status==='completed').length}</strong><span>${t('Completed orders','ಪೂರ್ಣಗೊಂಡ ಆರ್ಡರ್‌ಗಳು')}</span></div><div><strong>0</strong><span>${t('Repeat customers','ಮತ್ತೆ ಬಂದ ಗ್ರಾಹಕರು')}</span></div><div><strong>1</strong><span>${t('Active months','ಸಕ್ರಿಯ ತಿಂಗಳುಗಳು')}</span></div></div></section>`,
    
    chat:()=>heading(t('Your WhatsApp companion','ನಿಮ್ಮ WhatsApp ಸಹಾಯಕ'),t('Try a message. See your shop update.','ಸಂದೇಶ ಪ್ರಯತ್ನಿಸಿ. ಅಂಗಡಿಯ ಬದಲಾವಣೆ ನೋಡಿ.'))+`<div class="chat"><div class="chat-header">${icon('chat')}<div><strong>Mane Bazar</strong><small>${t('WhatsApp simulator','WhatsApp ಮಾದರಿ')}</small></div></div><div class="chat-body"><div class="bubble">${t('Namaskara! What would you like to add to your shop?','ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಅಂಗಡಿಗೆ ಏನು ಸೇರಿಸಲು ಬಯಸುತ್ತೀರಿ?')}</div></div><div class="chat-compose"><p class="chat-note">Chat is just a mockup right now.</p></div></div>`
};

function editProduct(id){
    let p=id?products.find(p=>p.id===id):null;
    showModal(modalHead(p&&id?t('Edit item','ಉತ್ಪನ್ನ ಬದಲಿಸಿ'):t('Add an item','ಉತ್ಪನ್ನ ಸೇರಿಸಿ'))+`<form onsubmit="saveProduct(event,'${id||''}')">
        <label>${t('Product name (English)','ಉತ್ಪನ್ನದ ಹೆಸರು (ಇಂಗ್ಲಿಷ್)')}
            <input name="name" value="${p?esc(p.name):''}" required maxlength="70">
        </label>
        <label>${t('Product name (Kannada)','ಉತ್ಪನ್ನದ ಹೆಸರು (ಕನ್ನಡ)')}
            <input name="name_kn" value="${p?esc(p.name_kn||''):''}" maxlength="100">
        </label>
        <div class="form-grid">
            <label>${t('Price per pack (₹)','ಒಂದು ಪ್ಯಾಕ್ ಬೆಲೆ (₹)')}
                <input name="price_rupees" type="number" min="1" max="100000" step="1" required value="${p?.price_rupees||''}">
            </label>
            <label>${t('Available packs','ಲಭ್ಯವಿರುವ ಪ್ಯಾಕ್‌ಗಳು')}
                <input name="stock" type="number" min="0" max="9999" step="1" required value="${p?.stock??''}">
            </label>
        </div>
        <label>${t('Pack size','ಪ್ಯಾಕ್ ಪ್ರಮಾಣ')}
            <input name="unit" value="${p?esc(p.unit):''}" placeholder="${t('e.g. 250 g box','ಉದಾ. 250 ಗ್ರಾಂ ಡಬ್ಬಿ')}" required maxlength="50">
        </label>
        ${id?`<label>${t('Availability','ಲಭ್ಯತೆ')}
            <select name="active">
                <option value="true" ${p?.active?'selected':''}>${t('Available','ಲಭ್ಯವಿದೆ')}</option>
                <option value="false" ${p&&!p.active?'selected':''}>${t('Paused','ನಿಲ್ಲಿಸಲಾಗಿದೆ')}</option>
            </select>
        </label>`:''}
        <div class="form-actions">
            <button class="btn secondary" type="button" onclick="document.getElementById('modal').close()">${t('Cancel','ರದ್ದುಮಾಡಿ')}</button>
            <button class="btn" type="submit">${t('Save item','ಉತ್ಪನ್ನ ಉಳಿಸಿ')}</button>
        </div>
    </form>`)
}

async function saveProduct(e,id){
    e.preventDefault();
    let f=new FormData(e.target);
    let name=f.get('name').trim(), unit=f.get('unit').trim();
    if(!name||!unit)return;
    
    let record={
        name: name,
        name_kn: f.get('name_kn').trim(),
        price_rupees: Number(f.get('price_rupees')),
        stock: Number(f.get('stock')),
        unit: unit,
        active: f.get('active') !== 'false'
    };
    if (id) record.id = id;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
        await api("/products", {
            method: "POST",
            body: record
        });
        document.getElementById('modal').close();
        await loadData();
        toast(t('Item saved','ಉತ್ಪನ್ನ ಉಳಿಸಲಾಗಿದೆ'));
    } catch (err) {
        toast(err.message);
        btn.disabled = false;
    }
}

function openWindow(){
    toast("Order windows requires backend update first.");
}

function confirmPaid(id){
    // Mock action
    showModal(modalHead(t('Have you received the money?','ಹಣ ಬಂದಿದೆಯೇ?'))+`<p>${t('Mock action only for now.','ಈಗಿನ ಮಾದರಿ ಮಾತ್ರ.')}</p><button class="btn green" onclick="orders.find(o=>o.id==='${id}').paid=true;document.getElementById('modal').close();render();toast(t('Receipt recorded','ಹಣ ಬಂದಿರುವುದು ದಾಖಲಾಗಿದೆ'))">${t('Yes, I received it','ಹೌದು, ಹಣ ಬಂದಿದೆ')}</button>`)
}

document.documentElement.lang=lang==='kn'?'kn':'en';
loadData();
