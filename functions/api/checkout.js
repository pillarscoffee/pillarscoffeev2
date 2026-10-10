// POST /api/checkout
//
// Validates the cart, re-prices it against the server catalog, saves a PENDING
// order to D1, creates a HitPay hosted payment request, and returns { url } for
// the browser to redirect to. The order is only marked PAID later by the HitPay
// webhook (functions/api/webhook.js) — never here.
//
// Self-contained (no imports) so the Cloudflare Pages Function bundles cleanly.

const CATALOG = {
  "alo-mosto":    { name: "Alo Mosto",          price: 35, weight: "150g" },
  "anaya-estate": { name: "Finca Anaya Estate", price: 28, weight: "200g" },
  "la-esmeralda": { name: "La Esmeralda",       price: 38, weight: "150g" },
  "banko-gotiti": { name: "Banko Gotiti",       price: 25, weight: "200g" },
  "chinga-aa":    { name: "Chinga AA",          price: 25, weight: "200g" },
  "ruli-cws":     { name: "Ruli CWS",           price: 26, weight: "200g" },
  "sitio-yamava": { name: "Sitio Yamava",       price: 19, weight: "200g" },
};

const CURRENCY = "SGD";
const DELIVERY_FEE_CENTS = 350;      // $3.50
const FREE_DELIVERY_MIN_QTY = 2;     // free on 2 bags or more

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" },
  });
}
function clean(v, max) {
  return String(v == null ? "" : v).trim().slice(0, max || 300);
}
function looksLikeEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // --- Config ---
    const apiKey = env.HITPAY_API_KEY;
    const apiBase = env.HITPAY_API_BASE || "https://api.hit-pay.com/v1";
    if (!apiKey) return json({ error: "Payment is not configured yet. Please try again later." }, 500);

    // --- Parse ---
    let body;
    try { body = await request.json(); }
    catch (e) { return json({ error: "Could not read your order. Please try again." }, 400); }

    const customer = (body && body.customer) || {};
    const cart = (body && body.cart) || [];

    // --- Validate customer (delivery needs a shipping address) ---
    const name = clean(customer.name, 120);
    const email = clean(customer.email, 160);
    const phone = clean(customer.phone, 40);
    const address = clean(customer.address, 600);
    if (!name) return json({ error: "Please enter your name." }, 400);
    if (!looksLikeEmail(email)) return json({ error: "Please enter a valid email." }, 400);
    if (!phone) return json({ error: "Please enter a phone number." }, 400);
    if (address.length < 10) return json({ error: "Please enter your full delivery address." }, 400);

    // --- Re-price the cart from the server catalog (never trust browser prices) ---
    if (!Array.isArray(cart) || cart.length === 0) {
      return json({ error: "Your bag is empty." }, 400);
    }
    let subtotalCents = 0, totalQty = 0;
    const items = [];
    for (const line of cart) {
      const p = CATALOG[line && line.id];
      if (!p) return json({ error: "One of the items is no longer available." }, 400);
      const qty = Math.max(1, Math.min(20, Math.floor(Number(line.qty)) || 1));
      const unit = Math.round(p.price * 100);
      subtotalCents += unit * qty;
      totalQty += qty;
      items.push({ id: line.id, name: p.name, weight: p.weight, qty: qty, unit_cents: unit, line_cents: unit * qty });
    }

    const deliveryCents = totalQty >= FREE_DELIVERY_MIN_QTY ? 0 : DELIVERY_FEE_CENTS;
    const totalCents = subtotalCents + deliveryCents;
    const amountStr = (totalCents / 100).toFixed(2);

    // --- Order number (unambiguous charset) ---
    const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    let suffix = "";
    for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const orderNo = "PIL-" + suffix;

    // --- Save the pending order ---
    let orderId = null;
    if (env.DB) {
      try {
        const r = await env.DB.prepare(
          `INSERT INTO orders
            (order_no, status, fulfilment, customer_name, email, phone, address,
             items_json, subtotal_cents, delivery_cents, total_cents, currency, hitpay_reference)
           VALUES (?, 'pending', 'delivery', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          orderNo, name, email, phone, address,
          JSON.stringify(items), subtotalCents, deliveryCents, totalCents, CURRENCY, orderNo
        ).run();
        orderId = r.meta && r.meta.last_row_id;
      } catch (e) {
        return json({ error: "Could not save your order. Please try again." }, 500);
      }
    }

    // --- Create the HitPay payment request ---
    const origin = new URL(request.url).origin;
    const form = new URLSearchParams();
    form.set("amount", amountStr);
    form.set("currency", CURRENCY);
    form.set("email", email);
    form.set("name", name);
    form.set("purpose", "Pillars Coffee order " + orderNo);
    form.set("reference_number", orderNo);
    form.set("redirect_url", origin + "/success.html?ref=" + encodeURIComponent(orderNo));
    form.append("payment_methods[]", "paynow_online");
    form.append("payment_methods[]", "card");

    let hitpay = null;
    try {
      const resp = await fetch(apiBase + "/payment-requests", {
        method: "POST",
        headers: {
          "X-BUSINESS-API-KEY": apiKey,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      const raw = await resp.text();
      try { hitpay = JSON.parse(raw); } catch (e2) { hitpay = null; }
      if (!resp.ok || !hitpay || !hitpay.url) {
        // Common case: HitPay account not yet verified returns 403 here.
        return json({ error: "Payment could not be started right now. Please try again later." }, 502);
      }
    } catch (e) {
      return json({ error: "Could not reach the payment provider. Please try again." }, 502);
    }

    // --- Save HitPay's id onto the order (non-fatal if it fails) ---
    if (env.DB && orderId) {
      try {
        await env.DB.prepare(`UPDATE orders SET hitpay_payment_id = ? WHERE id = ?`)
          .bind(hitpay.id, orderId).run();
      } catch (e) { /* reconcile via reference_number on the webhook */ }
    }

    return json({ url: hitpay.url, order_no: orderNo });

  } catch (fatal) {
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response("Method Not Allowed", { status: 405 });
}
