const express = require("express");
const crypto = require("node:crypto");
const db = require("./db.cjs");
const router = express.Router();
const riderId = process.env.RIDER_ID;
const password = process.env.RIDER_PASSWORD;
const shopId = process.env.SHOP_ID;
if (!riderId || !password || password.length < 16) {
    throw new Error ("Configure RIDER_ID and a long RIDER_PASSWORD");
}
const areas = ["Vidyanagar", "Keshwapur", "Unkal", "Gokul Road"];
const attempts = new Map();
const route = handler => (req, res, next) => {
    Promise.resolve(handler(req,res)).catch(next);
};
function fail(message, status=400) {
    throw Object.assign(new Error(message), { status });
}
function requireRider(req){
    if (req.session.seller || req.session.riderId !== riderId){
        fail("Rider login required", 403);
    }
}
function id(value) {
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value || "")) {
        fail("Invalid order ID");
      }
      return value;
}
function limit(key){
    let entry = attempts.get(key);
    if(!entry || entry.until < Date.now()){
        entry = { count : 0,  until: Date.now() + 600000 };
        attempts.set(key, entry);
    }
    if (++entry.count > 10){
        fail ("Too many attempts. Wait ten minutes.", 429);
    }
}
setInterval(() => {
    for (const [key, entry] of attempts){
        if(entry.until < Date.now()) attempts.delete(key);
    }
}, 60000).unref();
router.post("/rider/login", route(async (req, res) => {    limit("login:" + req.ip);
    const hash = value => crypto.createHash("sha256")
    .update(value).digest();
    const supplied = typeof req.body.password === "string"
    ? req.body.password : "";
    if (!crypto.timingSafeEqual(hash(supplied), hash(password))) {
        fail("Incorrect rider password", 401);
    }
    const customerId= req.session.customerId;
    await new Promise((resolve, reject)=> {
        req.session.regenerate(error =>
            error ? reject(error) : resolve()
        );
    });
    req.session.customerId = customerId;
    req.session.riderId = riderId;
    res.json({ ok: true });
}));
router.get ("/rider/state", route(async (req,res) => {
    requireRider(req);
    const riders = await db(
        "riders?id=eq." + encodeURIComponent(riderId) + "&select=*"
    );
      const rider = riders[0];
  if (!rider) fail("Rider record is missing", 404);
    const shops = await db(
        "shops?id=eq." + shopId +
        "&select=name,area,pickup_address"
    );
    const shop = shops[0];
    if (!shop) fail("Shop not found", 404);
    const active =
    rider.online &&
    Date.parse(rider.updated_at) > Date.now() - 600000;
const jobs = active && rider.area === shop.area
    ? await db(
        "orders?shop_id=eq." + shopId +
        "&mode=eq.rider&status=eq.ready&rider_id=is.null" +
        "&select=id,product_name,qty,created_at" +
        "&order=created_at&limit=50"
    )
    : [];
    const assigned = await db(
        "orders?shop_id=eq." + shopId +
        "&rider_id=eq." + encodeURIComponent(riderId) +
        "&status=in.(ready,picked_up)" +
        "&select=id,product_name,qty,customer_name,address,status" +
        "&order=created_at" 
    );
    res.json({
        rider,
        active,
        areas,
        jobs,
        assigned,
        pickup_address: assigned.length ? shop.pickup_address : ""
    });
}));
router.post("/rider/availability", route(async (req, res) => {
    requireRider(req);
    if (!areas.includes(req.body.area)) fail("Choose an area");
    await db(
        "riders?id=eq." + encodeURIComponent(riderId),
        "PATCH",
        {
            area: req.body.area,
            online: req.body.online ===true,
            updated_at: new Date().toISOString()
        }
    );
    res.json({ ok: true });
}));
router.post("/rider/claim", route(async (req,res) => {
    requireRider(req);
    await db("rpc/claim_delivery", "POST", {
        p_order: id(req.body.id),
        p_rider: riderId,
        p_shop: shopId
    });
    res.json({ ok: true });
}));
router.post("/rider/step", route(async (req, res) => {
    requireRider(req);
    const orderId = id(req.body.id);
    limit("code:" + riderId + ":" + orderId);
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(code)) {
    fail("Enter the six-character handover code");
  }
  await db("rpc/rider_step", "POST", {
    p_order: orderId,
    p_rider: riderId,
    p_shop: shopId,
    p_step: req.body.step,
    p_code: code
  });
  res.json({ ok: true});
}));
router.post("/orders/:id/status",(req,res,next) => {
    if (req.body.status !== "confirmed") return next();
    route(async (req,res) => {
        if(req.session.seller) fail("Use the customer account", 403);
        const rows = await db(
            "orders?id=eq." + id(req.params.id) +
            "&shop_id=eq." + shopId +
            "&customer_id=eq." + req.session.customerId +
            "&mode=eq.rider&status=eq.delivered",
            "PATCH",
            { confirmed: true } 
        );
        if (!rows.length) fail("Order cannot be confirmed", 409);
        res.json({ ok: true });      
    })(req , res, next);
});
module.exports = router;