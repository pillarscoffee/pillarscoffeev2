// POST /api/checkout
//
// Takes the browser cart + the customer's delivery details, re-prices everything
// against the server catalog, writes a PENDING order to D1, creates a HitPay
// hosted payment request (sandbox), and returns { url } for the browser to
// redirect to.
//
// IMPORTANT: this endpoint never trusts prices from the browser. It looks every
// item up in the server catalog and recomputes the total. The order is NOT
// considered paid here. Payment is confirmed later by the HitPay webhook
// (Phase 2); until then the row stays status = 'pending'.

import { priceCart, deliveryFeeCents, makeOrderNo, CURRENCY } from "../_order.js";

// Small JSON response helper.
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Basic field cleaning.
function clean(v, max = 300) {
  return String(v == null ? "" : v).trim().slice(0, max);
}
function looksLikeEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // --- 0. Config present? ---
  if (!env.DB) {
    return json({ error: "Store is not fully set up yet. Please try again later." }, 500);
  }
  const apiKey = env.HITPAY_API_KEY;
  const apiBase = env.HITPAY_API_BASE || "https://api.sandbox.hit-pay.com/v1";
  if (!apiKey) {
    return json({ error: "Payment is not configured yet. Please try again later." }, 500);
  }

  // --- 1. Parse body ---
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Could not read your order. Please try again." }, 400);
  }

  const customer = body && body.customer ? body.customer : {};
  const cart = body && body.cart ? body.cart : [];
  const fulfilment = "delivery"; // only delivery for now; pickup is a later add-on

  // --- 2. Validate customer (delivery needs a shipping address) ---
  const name = clean(customer.name, 120);
  const email = clean(customer.email, 160);
  const phone = clean(customer.phone, 40);
  const address = clean(customer.address, 600);

  if (!name) return json({ error: "Please enter your name." }, 400);
  if (!looksLikeEmail(email)) return json({ error: "Please enter a valid email." }, 400);
  if (!phone) return json({ error: "Please enter a phone number." }, 400);
  if (address.length < 10) return json({ error: "Please enter your full delivery address." }, 400);

  // --- 3. Re-price the cart server side ---
  const priced = priceCart(cart);
  if (!priced.ok) return json({ error: priced.error }, 400);

  const deliveryCents = deliveryFeeCents(priced.totalQty, fulfilment);
  const totalCents = priced.subtotalCents + deliveryCents;
  const amountStr = (totalCents / 100).toFixed(2); // HitPay wants a decimal string

  // --- 4. Create the order row (pending) ---
  const orderNo = makeOrderNo();
  const itemsJson = JSON.stringify(priced.items);

  let orderId;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO orders
        (order_no, status, fulfilment, customer_name, email, phone, address,
         items_json, subtotal_cents, delivery_cents, total_cents, currency,
         hitpay_reference)
       VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        orderNo, fulfilment, name, email, phone, address,
        itemsJson, priced.subtotalCents, deliveryCents, totalCents, CURRENCY,
        orderNo // reference_number sent to HitPay == our order_no
      )
      .run();
    orderId = result.meta && result.meta.last_row_id;
  } catch (e) {
    return json({ error: "Could not save your order. Please try again." }, 500);
  }

  // --- 5. Create the HitPay payment request ---
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

  let hitpay;
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
    hitpay = await resp.json();
    if (!resp.ok || !hitpay || !hitpay.url) {
      // Leave the order row as pending; it just never got a payment link.
      return json({ error: "Could not start payment. Please try again." }, 502);
    }
  } catch (e) {
    return json({ error: "Could not reach payment provider. Please try again." }, 502);
  }

  // --- 6. Save HitPay's id back onto the order, then hand the url to the browser ---
  try {
    await env.DB.prepare(`UPDATE orders SET hitpay_payment_id = ? WHERE id = ?`)
      .bind(hitpay.id, orderId)
      .run();
  } catch (e) {
    // Non-fatal: we can still reconcile by reference_number on the webhook.
  }

  return json({ url: hitpay.url, order_no: orderNo });
}

// Anything other than POST
export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response("Method Not Allowed", { status: 405 });
}
