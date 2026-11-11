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
              hitpay_fee_cents, tracking_url, tracking_carrier, tracking_number, created_at, paid_at, shipped_at, refunded_at
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
  const carrierPages = {
    jt: "https://www.jtexpress.sg/trackmyparcel",
    singpost: "https://www.singpost.com/track-items",
  };
  const trackingCarrier = String(body.tracking_carrier || "").trim();
  const trackingNumber = String(body.tracking_number || "").trim();

  // Bulk cleanup: remove every pending (unpaid) order in one go. Never touches
  // a paid/packed/shipped order.
  if (action === "clear_pending") {
    const res = await env.DB.prepare(`DELETE FROM orders WHERE status = 'pending'`).run();
    const removed = (res && res.meta && res.meta.changes) || 0;
    return json({ ok: true, removed });
  }

  if (!orderNo) return json({ error: "Missing order_no" }, 400);

  const order = await env.DB.prepare(`SELECT * FROM orders WHERE order_no = ?`).bind(orderNo).first();
  if (!order) return json({ error: "Order not found" }, 404);

  if (action === "packed") {
    await env.DB.prepare(`UPDATE orders SET status = 'packed' WHERE order_no = ?`).bind(orderNo).run();
    return json({ ok: true, status: "packed" });
  }

  if (action === "paid") {
    // Manual fallback only. Staff must verify the real payment in HitPay first.
    // Mirror the webhook's finite-stock deduction. D1 batch is transactional:
    // the conditional stock updates and pending -> paid transition succeed together.
    if (order.status !== "pending") {
      return json({ error: "Only a pending order can be marked paid. Refresh the order list." }, 409);
    }
    let purchased;
    try {
      purchased = JSON.parse(order.items_json || "[]");
      if (!Array.isArray(purchased)) throw new Error("Invalid order items");
    } catch (e) {
      return json({ error: "Order items could not be read. Do not mark this order paid yet." }, 500);
    }
    const updates = [];
    for (const line of purchased) {
      if (!line || !line.id || !Number.isInteger(Number(line.qty)) || Number(line.qty) < 1) continue;
      updates.push(env.DB.prepare(
        `UPDATE stock SET quantity = MAX(0, quantity - ?),
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE bean_id = ? AND quantity IS NOT NULL
           AND EXISTS (SELECT 1 FROM orders WHERE order_no = ? AND status = 'pending')`
      ).bind(Number(line.qty), line.id, orderNo));
    }
    updates.push(env.DB.prepare(
      `UPDATE orders SET status = 'paid',
         paid_at = COALESCE(paid_at, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
       WHERE order_no = ? AND status = 'pending'`
    ).bind(orderNo));
    try {
      const results = await env.DB.batch(updates);
      const last = results[results.length - 1];
      if (!last || !last.meta || last.meta.changes !== 1) {
        return json({ error: "Order status changed. Refresh the order list." }, 409);
      }
    } catch (e) {
      console.log("Manual paid/stock reconciliation error:", e && e.message);
      return json({ error: "Could not update payment and stock. Please retry after checking the order." }, 503);
    }
    return json({ ok: true, status: "paid" });
  }

  if (action === "refunded") {
    // Mark an order refunded AFTER you have done the refund in HitPay.
    // Only a real (paid/packed/shipped) order can be refunded; a pending one
    // was never paid, so there is nothing to refund.
    if (order.status === "pending") {
      return json({ error: "This order was never paid, so there is nothing to refund. Use Remove instead." }, 400);
    }
    if (order.status === "refunded") {
      return json({ ok: true, status: "refunded" });
    }
    await env.DB.prepare(
      `UPDATE orders SET status = 'refunded', refunded_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE order_no = ?`
    ).bind(orderNo).run();
    return json({ ok: true, status: "refunded" });
  }

  if (action === "delete") {
    // Safety: only ever delete a PENDING order. A paid/packed/shipped order is
    // real money and can never be removed from here.
    if (order.status !== "pending") {
      return json({ error: "Only unpaid (pending) orders can be removed." }, 400);
    }
    await env.DB.prepare(`DELETE FROM orders WHERE order_no = ? AND status = 'pending'`).bind(orderNo).run();
    return json({ ok: true, deleted: orderNo });
  }

  if (action === "resend_shipping") {
    if (order.status !== "shipped") return json({ error: "Only shipped orders can resend their shipping email." }, 400);
    const r = await sendShippedEmail(env, order);
    return r.ok ? json({ ok: true, email: "sent" }) : json({ error: "Email could not be sent. Check Resend and retry." }, 502);
  }

  if (action === "shipped") {
    if (order.status !== "packed") return json({ error: "Mark this order packed before shipping." }, 400);
    if (!["jt", "singpost", "other"].includes(trackingCarrier)) return json({ error: "Select a courier." }, 400);
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{3,49}$/.test(trackingNumber)) {
      return json({ error: "Enter a valid tracking number (4–50 characters)." }, 400);
    }
    let trackingUrl = carrierPages[trackingCarrier] || "";
    if (trackingCarrier === "other") {
      try {
        const u = new URL(String(body.tracking_url || "").trim());
        if (u.protocol !== "https:" || !u.hostname || u.username || u.password) throw new Error("Unsafe link");
        trackingUrl = u.href;
      } catch (e) { return json({ error: "For other couriers, paste the official HTTPS tracking page." }, 400); }
    }
    const shipmentWrite = await env.DB.prepare(
      `UPDATE orders SET status='shipped', tracking_carrier=?, tracking_number=?, tracking_url=?,
         shipped_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE order_no=? AND status='packed'`
    ).bind(trackingCarrier, trackingNumber, trackingUrl, orderNo).run();
    // If another request already shipped this order, do not email twice.
    if (!shipmentWrite || !shipmentWrite.meta || shipmentWrite.meta.changes !== 1) {
      return json({ error: "This order is no longer packed. Refresh the order list." }, 409);
    }
    const updated = Object.assign({}, order, {
      status: "shipped", tracking_carrier: trackingCarrier, tracking_number: trackingNumber, tracking_url: trackingUrl
    });
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
