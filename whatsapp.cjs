const express = require("express");
const crypto = require("node:crypto");
const db = require("./db.cjs");

const router = express.Router();
router.get("/",(req,res)=> {
    const token = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!token){
        return res.status(503).send("WhatsApp is not configured");
    }
    if (
        req.query["hub.mode"] !== "subscribe" ||
        req.query["hub.verify_token"] !== token
    ) {
        return res.status(403).send("Verification failed");
    }
    const challenge = req.query["hub.challenge"];
    if (typeof challenge !== "string") {
        return res.status(400).send("Missing challenge");
    }
    res.type("text/plain").send(challenge);
});
router.post(
    "/",
    express.raw({type: "application/json",limit:"100kb"}),
    async (req,res,next) => {
        try {
            const secret = process.env.WHATSAPP_APP_SECRET;
            const seller = process.env.WHATSAPP_SELLER_NUMBER;
            const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
            if (!secret || !seller || !phoneId) {
                return res.status(503).json ({
                    error: "WhatsApp is not configured"
                });
            }
            if (!Buffer.isBuffer(req.body)){
                return res.status(400).json({
                    error: "Expected a JSON webhook"
                });
            }
            const expected = Buffer.from(
                "sha256=" + 
                crypto.createHmac("sha256",secret)
                .update(req.body)
                .digest("hex")
            );
            const supplied = Buffer.from(
                req.get("x-hub-signature-256") || ""
            );
            if (
                expected.length !== supplied.length ||
                !crypto.timingSafeEqual(expected, supplied)
            ) {
                return res.status(401).json({
                    error: "Invalid webhook signature"
                });
            }
            let body;
            try {
                body = JSON.parse(req.body.toString("utf8"));
            } catch {
                return res.status(400).json({
                    error: "Invalid JSON"
                });
            }
            if (body.object !== "whatsapp_business_account") {
                return res.status(400).json({
                    error: "Unexpected webhook object"
                });
            }
            const messages = [];
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []){
                    const value = change.value;
                    if(
                        change.field !== "messages" ||
                        value?.metadata?.phone_number_id !== phoneId
                    ) {
                        continue;
                    }
                    for (const message of value.messages || []) {
  if (
    message.from !== seller ||
    typeof message.id !== "string" ||
    !["text", "audio"].includes(message.type)
  ) {
    continue;
  }
                    const timestamp = Number(message.timestamp) * 1000;
                    if (
                        !Number.isFinite(timestamp) ||
                        timestamp <= 0 ||
                        timestamp > Date.now() + 60000
                    ) {
                        continue;
                    }
                    if (
                        message.type === "audio" &&
                        !/^\d+$/.test(message.audio?.id || "")
                    ) {
                        continue;
                    }
                    messages.push({
                        id: message.id,
                        sender: message.from,
                        kind: message.type,
                        text: message.type === "text"
                        ? String(message.text?.body || "").slice(0,4000)
                        : "",
                        media_id: message.type === "audio"
                        ? message.audio.id : null,
                        sent_at: new Date(timestamp).toISOString()
                    });
                
                }
            }
        }
        if (messages.length){
            await db("rpc/queue_whatsapp","POST", {
                p_messages: messages
            });
        }
        res.json({ received: true });
    } catch (error) {
        next(error);
    }
}
);
module.exports = router;