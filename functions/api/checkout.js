// POST /api/checkout  — DIAGNOSTIC VERSION
// Self-contained (no imports) so we can isolate what is crashing.
// Every step is wrapped; any failure returns a readable JSON message.

const CATALOG = {
  "alo-mosto":    { name: "Alo Mosto",          price: 35, weight: "150g" },
  "anaya-estate": { name: "Finca Anaya Estate", price: 28, weight: "200g" },
  "la-esmeralda": { name: "La Esmeralda",       price: 38, weight: "150g" },
  "banko-gotiti": { name: "Banko Gotiti",       price: 25, weight: "200g" },
  "chinga-aa":    { name: "Chinga AA",          price: 25, weight: "200g" },
  "ruli-cws":     { name: "Ruli CWS",           price: 26, weight: "200g" },
  "sitio-yamava": { name: "Sitio Yamava",       price: 19, weight: "200g" },
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  // Wrap EVERYTHING so no crash can escape as a 502.
  try {
    const { request, env } = context;

    // 1. Config check
    const apiKey = env.HITPAY_API_KEY;
    const apiBase = env.HITPAY_API_BASE || "https://api.hit-pay.com/v1";
    if (!apiKey) return json({ step: "config", error: "HITPAY_API_KEY is missing" }, 500);

    // 2. Parse body
    let body;
    try { body = await request.json(); }
    catch (e) { return json({ step: "parse", error: "bad json: " + e.message }, 400); }

    const customer = (body && body.customer) || {};
    const cart = (body && body.cart) || [];

    // 3. Price the cart
    let subtotalCents = 0, totalQty = 0;
    const items = [];
    for (const line of cart) {
      const p = CATALOG[line && line.id];
      if (!p) return json({ step: "price", error: "unknown item: " + (line && line.id) }, 400);
      const qty = Math.max(1, Math.min(20, Math.floor(Number(line.qty)) || 1));
      const unit = Math.round(p.price * 100);
      subtotalCents += unit * qty;
      totalQty += qty;
      items.push({ id: line.id, name: p.name, weight: p.weight, qty: qty, line_cents: unit * qty });
    }
    if (items.length === 0) return json({ step: "price", error: "empty cart" }, 400);

    const deliveryCents = totalQty >= 2 ? 0 : 350;
    const totalCents = subtotalCents + deliveryCents;
    const amountStr = (totalCents / 100).toFixed(2);

    // 4. Order number
    const orderNo = "PIL-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    // 5. Try the database insert (but do NOT crash if it fails)
    let dbNote = "skipped";
    if (env.DB) {
      try {
        const r = await env.DB.prepare(
          `INSERT INTO orders
            (order_no, status, fulfilment, customer_name, email, phone, address,
             items_json, subtotal_cents, delivery_cents, total_cents, currency, hitpay_reference)
           VALUES (?, 'pending', 'delivery', ?, ?, ?, ?, ?, ?, ?, ?, 'SGD', ?)`
        ).bind(
          orderNo,
          String(customer.name || ""),
          String(customer.email || ""),
          String(customer.phone || ""),
          String(customer.address || ""),
          JSON.stringify(items),
          subtotalCents, deliveryCents, totalCents, orderNo
        ).run();
        dbNote = "inserted id=" + (r.meta && r.meta.last_row_id);
      } catch (e) {
        dbNote = "DB ERROR: " + e.message;
      }
    } else {
      dbNote = "no DB binding";
    }

    // 6. Call HitPay
    const origin = new URL(request.url).origin;
    const form = new URLSearchParams();
    form.set("amount", amountStr);
    form.set("currency", "SGD");
    form.set("email", String(customer.email || ""));
    form.set("name", String(customer.name || ""));
    form.set("purpose", "Pillars Coffee order " + orderNo);
    form.set("reference_number", orderNo);
    form.set("redirect_url", origin + "/success.html?ref=" + encodeURIComponent(orderNo));
    form.append("payment_methods[]", "paynow_online");
    form.append("payment_methods[]", "card");

    let hitpayRaw = "", hitpay = null;
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
      hitpayRaw = await resp.text();
      try { hitpay = JSON.parse(hitpayRaw); } catch (e2) { hitpay = null; }

      if (!resp.ok || !hitpay || !hitpay.url) {
        return json({
          step: "hitpay",
          http: resp.status,
          db: dbNote,
          apiBase: apiBase,
          hitpayResponse: hitpayRaw.slice(0, 400),
        }, 502);
      }
    } catch (e) {
      return json({ step: "hitpay-fetch", error: e.message, db: dbNote }, 502);
    }

    // 7. Success
    return json({ url: hitpay.url, order_no: orderNo, db: dbNote });

  } catch (fatal) {
    // Absolute last resort: show the fatal error instead of a 502.
    return json({ step: "FATAL", error: (fatal && fatal.message) || String(fatal) }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response("Method Not Allowed", { status: 405 });
}
