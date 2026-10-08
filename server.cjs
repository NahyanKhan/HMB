const express = require("express");
const path = require("node:path");
const crypto = require("node:crypto");
const db = require("./db.cjs");


const env = process.env;
for (const key of [
  "SUPABASE_URL", "SUPABASE_SECRET_KEY",
  "APP_URL", "SHOP_ID", "SELLER_PASSWORD", "SESSION_SECRET"
]) {
  if (!env[key]) throw new Error("Missing setting: " + key);
}

  if (env.SELLER_PASSWORD.length < 16 || env.SESSION_SECRET.length <32) {
    throw new Error("Seller password or session secret is too short");

  }
  const app = express();
  const shop = env.SHOP_ID;
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use("/webhooks/whatsapp", require("./whatsapp.cjs"));
  app.use(express.json({limit: "16kb"}));
  app.use((req, res, next)=>{
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (
        req.headers.origin !== env.APP_URL ||
        req.headers["x-mane-request"] !== "1"
      ){
    return res.status(403).json({error:"Request not allowed"});
  }
}
next();
});
app.get("/health",(req,res)=>{
  res.json({ok:true});

});
app.use(express.static(path.join(__dirname, "public")));
app.use("/api",require("./auth.cjs"));
app.use("/api",(req,res,next)=>{
  res.set("Cache-Control","no-store");
  if (!req.session.customerId){
    req.session.customerId = crypto.randomUUID();
  }
  next();
});
app.use("/api", require("./riders.cjs"));
const route = handler => (req,res,next) =>{
  Promise.resolve(handler(req,res)).catch(next);
};
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status});
}
function seller(req){
  if (!req.session.seller) fail("Seller login required", 403);
}
function uuid(value){
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value || "")){
    fail("Invalid ID");
  }
  return value;
}
function text(value, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    fail("Please complete the required fields");
  }
  return value.trim();
}
function integer(value , min , max) {
    if (!Number.isInteger(value) || value < min || value > max) {
  fail("Enter a valid whole number");
}
return value;
}
app.get("/api/me", (req, res)=> {
  res.json({ seller: Boolean(req.session.seller)});
});
const attempts = new Map();
setInterval (() => {
  for (const [ip, entry] of attempts){
    if (entry.until < Date.now()) attempts.delete(ip);

  }
}, 60000).unref();
app.post("/api/login", route(async (req,res) => {
  let entry = attempts.get(req.ip);
  if (!entry || entry.until < Date.now()){
    entry = { count: 0, until: Date.now() + 600000};
    attempts.set(req.ip, entry);
  }
  if (++entry.count >10) fail("Try again in ten minutes", 429);
  const hash = value => crypto.createHash("sha256")
  .update(value).digest();
  const supplied = typeof req.body.password === "string"
  ? req.body.password : "";
  if (!crypto.timingSafeEqual(
    hash(supplied), hash(env.SELLER_PASSWORD)
  )){
    fail("Incorrect seller password", 401);
  }
const customerId = req.session.customerId;
await new Promise((resolve, reject)=> {
  req.session.regenerate(error => error ? reject(error) : resolve());

});
req.session.customerId = customerId;
req.session.seller = true;
res.json({ ok: true});
}));
app.post("/api/logout", route(async (req,res)=> {
  await new Promise((resolve, reject) => {
    req.session.destroy(error => error ? reject(error) : resolve());

  });
  res.clearCookie ("mane.sid", { path: "/"});
  res.json({ ok:true });
}));
app.get("/api/catalog", route(async (req, res) => {
const shops = await db(
  "shops?id=eq." + shop +
  "&select=id,name,name_kn,area,language,is_open"
);
  const products = await db(
    "products?shop_id=eq." + shop +
    "&select=*&order=name" + 
    (req.session.seller ? "" : "&active=eq.true")
  );
  res.json({ shop : shops[0], products});
}));
app.post("/api/products", route(async (req,res)=>{
  seller(req);
  const b = req.body;
  const product = {
    shop_id: shop,
    name: text(b.name),
    name_kn: typeof b.name_kn === "string"
    ? b.name_kn.trim().slice(0,100) : "",
    price_rupees: integer(b.price_rupees, 1, 100000),
    stock: integer (b.stock, 0, 9999),
    unit: text(b.unit, 60),
    active: b.active !== false
  };
  if (b.id) {
    const rows = await db(
      "products?id=eq." + uuid(b.id) + "&shop_id=eq." + shop,
      "PATCH",
      product
    );
    if (!rows.length) fail("Product not found", 404);
  } else {
    await db("products","POST", product);
  }
  res.json({ok:true});
}));
app.get("/api/orders", route(async(req, res) => {
const filter = req.session.seller ? "" :
"&customer_id=eq." + req.session.customerId;
const rows = await db (
  "orders?shop_id=eq." + shop +
  filter + "&select=*&order=created_at.desc&limit=100"
);
res.json(rows.map(row => {
  const {
    customer_id, request_id,
    pickup_code, delivery_code, ...order
  } = row;

  if (req.session.seller) {
    order.pickup_code = pickup_code;
  } else {
    order.delivery_code = delivery_code;
  }

  return order;
}));
}));
app.post("/api/orders", route(async(req,res) => {
  const b = req.body;
  if (!["pickup", "self", "rider"].includes(b.mode)){
  fail("Choose pickup, seller delivery or rider delivery");
}
  const id = await db("rpc/place_order", "POST", {
    p_shop: shop,
    p_customer: req.session.customerId,
    p_product: uuid(b.product_id),
    p_qty: integer(b.qty, 1,20),
    p_name: text(b.customer_name, 70),
    p_address: b.mode === "pickup"
    ? "Customer pickup" : text(b.address, 250),
    p_mode:b.mode,
    p_request: uuid(b.request_id)
  });
  res.json({ id });
}));
app.post("/api/orders/:id/status", route(async(req,res) => {
  await db("rpc/change_order", "POST",{
    p_id: uuid(req.params.id),
    p_shop:shop,
    p_customer: req.session.customerId,
    p_seller: Boolean(req.session.seller),
    p_next: text(req.body.status, 30)
  });
res.json({ok:true});
}));
app.use((error, req,res,next) => {
  console.error(error.message);
  res.status(error.status || 500).json({
    error:error.status ? error.message : "Unable to complete request"
});
});
require("./commands.cjs").start();
require("./notifications.cjs").start();
app.listen(Number(env.PORT || 3000), "0.0.0.0", () => {
  console.log("Mane Bazaar running on port" + (env.PORT || 3000));
});