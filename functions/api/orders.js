// /api/orders  — private team endpoint (list + update orders)
//
// Protected by a shared password in the `x-pillars-key` header, checked against
// the ADMIN_KEY Cloudflare secret. Not Fort Knox, but keeps the orders page
// private to the team. Use a long random value for ADMIN_KEY.
//
// GET  /api/orders            -> list recent orders (newest first)
// POST /api/orders            -> { order_no, action, tracking_url? }
//        action: 'packed' | 'shipped' | 'paid'
//        shipped also sends the customer a "shipped" email (with tracking).
//
// Env: ADMIN_KEY (secret), DB, plus notify env for the shipped email.

import { sendShippedEmail } from "../_notify.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authed(request, env) {
  const key = request.headers.get("x-pillars-key") || "";
  return env.ADMIN_KEY && key === env.ADMIN_KEY;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401);
  if (!env.DB) return json({ error: "No database" }, 500);

  try {
    const res = await env.DB.prepare(
      `SELECT id, order_no, status, fulfilment, customer_name, email, phone, address,
              items_json, subtotal_cents, delivery_cents, total_cents, currency,
              hitpay_fee_cents, tracking_url, created_at, paid_at, shipped_at
         FROM orders
        ORDER BY id DESC
        LIMIT 200`
    ).all();
    return json({ orders: (res && res.results) || [] });
  } catch (e) {
    return json({ error: "Could not load orders." }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401);
  if (!env.DB) return json({ error: "No database" }, 500);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "Bad request" }, 400); }

  const orderNo = String(body.order_no || "").trim();
  const action = String(body.action || "").trim();
  const trackingUrl = String(body.tracking_url || "").trim();

  if (!orderNo) return json({ error: "Missing order_no" }, 400);

  const order = await env.DB.prepare(`SELECT * FROM orders WHERE order_no = ?`).bind(orderNo).first();
  if (!order) return json({ error: "Order not found" }, 404);

  if (action === "packed") {
    await env.DB.prepare(`UPDATE orders SET status = 'packed' WHERE order_no = ?`).bind(orderNo).run();
    return json({ ok: true, status: "packed" });
  }

  if (action === "paid") {
    // manual fallback to mark paid (rarely needed; webhook normally does this)
    await env.DB.prepare(
      `UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, strftime('%Y-%m-%dT%H:%M:%SZ','now')) WHERE order_no = ?`
    ).bind(orderNo).run();
    return json({ ok: true, status: "paid" });
  }

  if (action === "shipped") {
    if (trackingUrl.length < 5) return json({ error: "Please paste a tracking link first." }, 400);
    await env.DB.prepare(
      `UPDATE orders
          SET status = 'shipped',
              tracking_url = ?,
              shipped_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
        WHERE order_no = ?`
    ).bind(trackingUrl, orderNo).run();

    // email the customer with tracking
    const updated = Object.assign({}, order, { status: "shipped", tracking_url: trackingUrl });
    const r = await sendShippedEmail(env, updated);
    return json({ ok: true, status: "shipped", email: r.ok ? "sent" : "failed" });
  }

  return json({ error: "Unknown action" }, 400);
}

export async function onRequest(context) {
  const m = context.request.method;
  if (m === "GET") return onRequestGet(context);
  if (m === "POST") return onRequestPost(context);
  return new Response("Method Not Allowed", { status: 405 });
}
