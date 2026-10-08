const db = require("./db.cjs");
const env = process.env;
let busy = false;
let timer = null;
async function tick() {
    if (
        busy ||
        env.WHATSAPP_COMMANDS_ENABLED !== "true" ||
        !env.SHOP_ID ||
        !/^\d+$/.test(env.WHATSAPP_SELLER_NUMBER || "")
    ) {
        return;
    }
    busy = true;
    try {
        for (let count = 0; count< 5; count ++){
            const processed = await db(
                "rpc/process_whatsapp",
                "POST",
                {
                    p_shop: env.SHOP_ID,
                    p_sender: env.WHATSAPP_SELLER_NUMBER,
                    p_kn: env.WHATSAPP_REPLY_LANGUAGE === "kn"
                }
            );
            if (!processed) break;
        }
        } catch (error) {
            console.error("WhatsApp commands:", error.message);
        } finally {
            busy = false;
        }
        }
        function start(){
            if (timer) return;
            timer = setInterval(() => {
                void tick();
            },5000);
            timer.unref();
            void tick();
        }
        module.exports = {start};