const db = require("./db.cjs");
const env = process.env
let busy = false;
let timer = null;
function configured(){
    return (
        env.WHATSAPP_SEND_ENABLED === "true" &&
        env.WHATSAPP_ACCESS_TOKEN &&
        /^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID || "") &&
    /^\d+$/.test(env.WHATSAPP_SELLER_NUMBER || "") &&
    /^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_VERSION || "")
    );
}
function hasTemplate() {
    return (
        /^[a-z0-9_]+$/.test(env.WHATSAPP_ORDER_TEMPLATE || "") &&
    /^[a-z]{2}(?:_[A-Z]{2})?$/.test(
      env.WHATSAPP_TEMPLATE_LANGUAGE || ""
    )
    );
}
async function update(id, values) {
    await db(
        "wa_outbox?id=eq." + encodeURIComponent(id),
        "PATCH",
        values
    );
}
async function replyWindowOpen() {
    const rows = await db(
        "wa_inbox?sender=eq." + 
        encodeURIComponent(env.WHATSAPP_SELLER_NUMBER) +
        "&select=sent_at&order=sent_at-desc&limit=1"
    );
    if (!rows.length) return false;
    const age = Date.now() - Date.parse(rows[0].sent_at);
    return age >= -60000 && age < 23 * 60 * 60 * 1000;
}
function orderMessage(order) {
    const amount = order.qty * order.price_rupees;
    const kannada = env.WHATSAPP_REPLY_LANGUAGE === "kn";
    const link = env.APP_URL;
    if (kannada) {
        return [
            "ಮನೆ ಬಜಾರ್: ಹೊಸ ಆರ್ಡರ್",
      order.product_name,
      "ಪ್ರಮಾಣ: " + order.qty,
      "ಒಟ್ಟು: ₹" + amount,
      "ಆರ್ಡರ್: " + order.id,
      "ಸ್ವೀಕರಿಸಲು ಮಾರಾಟಗಾರರ ಪುಟ ತೆರೆಯಿರಿ:",
      link
        ].join("\n")
    }
    return [
        "Mane Bazaar: new order",
        order.product_name,
        "Quantity: " + order.qty,
        "Total: ₹" + amount,
        "Order: " + order.id,
        "Open your seller page to accept:",
        link 
    ].join("\n");
}
async function prepare(message) {
    const age = Date.now() - Date.parse(message.created_at);
    if (age> 23 * 60 *60 * 1000) {
        await update (message.id, {
            state: "expired",
            last_error: "Alert expired. Review orders in the app."
        });
        return null;
    }
    if (!message.order_id ) {
        if (message.body) return message.body;
        await update(message.id,{
            state: "failed",
            last_error: "Message has no body."
        });
        return null;
    }
    const rows = await db(
        "orders?id=eq." + message.order_id +
        "&shop_id=eq." + env.SHOP_ID + 
        "&select=id,product_name, qty, price_rupees, status"
    );
    const order = rows[0];
    if (!order || order.status !== "new") {
        await update(message.id, {
            state: "skipped",
            last_error: "Order no longer awaits acceptance."
        });
        return null;
    }
    return orderMessage(order);
}
async function send(message) {
    const body = await prepare(message);
    if (!body) return;
    const payload = {
        messaging_product: "whatsapp",
        to: env.WHATSAPP_SELLER_NUMBER
    };
    if(await replyWindowOpen()){
        payload.type = "text";
        payload.text = {body: body.slice(0,4000)};
    } else if (message.order_id && hasTemplate()){
        payload.type = "template";
        payload.template = {
            name: env.WHATSAPP_ORDER_TEMPLATE,
            language: {
                code: env.WHATSAPP_TEMPLATE_LANGUAGE
            },
            components: [{
                type: "body",
                parameters: [{
                    type: "text",
                    text: body.replace(/\s+/g, " ").slice(0, 900)
                }]
            }]
        };
    } else {
        await update(message.id, {
            state: "blocked",
            last_error:
            "Seller must message first or an approved order template is required."
        });
        return;
    }
    const url= 
    "https://graph.facebook.com/" +
    env.WHATSAPP_GRAPH_VERSION + "/" +
    env.WHATSAPP_PHONE_NUMBER_ID + "/messages";
    try {
        const response = await fetch (url, {
            method: "POST",
            headers:{
                Authorization: "Bearer " + env.WHATSAPP_ACCESS_TOKEN,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) {
            await update(message.id, {
                state: "failed",
                last_error:"Meta rejected the request: HTTP " + response.status
            });
            return;
        }
        const result = await response.json();
        const providerId = result.messages?.[0]?.id;
        if (!providerId) {
            await update(message.id, {
                state: "unknown",
                last_error: "Meta response contained no message ID."
            });
            return;
        }
        await update ( message.id, {
            state: "sent",
            provider_id: providerId,
            last_error: null
        });
    } catch {
        await update(message.id, {
            state: "unknown",
            last_error:
            "Send outcome uncertain. Inspect Meta before retrying."
        });
    }
}
async function tick() {
    if(busy || !configured()) return;
    busy = true;
    try {
        const stale = new Date(Date.now() - 600000).toISOString();
        await db(
  "wa_outbox?shop_id=eq." + env.SHOP_ID +
  "&state=eq.sending&started_at=lt." +
  encodeURIComponent(stale),
  "PATCH",
  {
    state: "unknown",
    last_error:
      "Worker interrupted during processing. Inspect before retrying."
  }
);
        if (await replyWindowOpen()) {
        await db(
            "wa_outbox?shop_id=eq." + env.SHOP_ID +
            "&state=eq.blocked",
            "PATCH",
            { state: "queued", last_error: null }
        );
    } else if (hasTemplate()) {
        await db(
            "wa_outbox?shop_id=eq." + env.SHOP_ID +
        "&state=eq.blocked&order_id=not.is.null",
        "PATCH",
        { state: "queued", last_error: null }
        );
    }
    for (let count=0; count<3; count ++){
        const rows = await db ("rpc/claim_whatsapp","POST",{
            p_shop: env.SHOP_ID
        });
        if (!rows.length) break;
        await send(rows[0]);
    }
} catch (error) {
    console.error("WhatsApp worker:",error.message);
} finally {
    busy = false;
}
}
function start() {
    if (timer) return;
    timer = setInterval (()=> {
        void tick();
    }, 10000);
    timer.unref();
    void tick();
}
module.exports = {start};