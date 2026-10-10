// POST /api/webhook  — HitPay payment webhook
//
// HitPay calls this (server to server) when a payment completes. This is the
// ONLY thing that marks an order paid — never the browser redirect.
//
// Security: HitPay sends a `Hitpay-Signature` header = HMAC-SHA256 of the RAW
// JSON body, keyed with our salt (hex). We must verify it against the raw bytes
// before trusting anything. A bad or missing signature is rejected.
//
// Set the webhook URL in HitPay: Developers -> Webhook Endpoints ->
//   https://pillarscoffee.sg/api/webhook   (event: payment_request.completed)
//
// Env: HITPAY_SALT (secret). Plus the notify env (Telegram/Resend).

import { sendTelegram, sendOrderConfirmation } from "../_notify.js";

// Constant-time-ish compare of two hex strings.
function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// HMAC-SHA256(rawBody, salt) -> lowercase hex, using Web Crypto (available in Workers).
async function hmacHex(salt, rawBody) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Read the RAW body first (needed for an exact signature match).
  const raw = await request.text();

  // 2. Verify the signature.
  const salt = env.HITPAY_SALT;
  const given = request.headers.get("Hitpay-Signature") || request.headers.get("hitpay-signature");
  if (!salt || !given) {
    return new Response("Missing signature", { status: 400 });
  }
  const expected = await hmacHex(salt, raw);
  if (!safeEqualHex(expected, given)) {
    console.log("Webhook signature mismatch");
    return new Response("Bad signature", { status: 401 });
  }

  // 3. Parse the (now trusted) payload.
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return new Response("Bad JSON", { status: 400 });
  }

  const orderNo = data.reference_number;
  const status = data.status; // 'completed' when paid
  const paymentId = data.id;

  if (!orderNo) {
    return new Response("No reference", { status: 200 }); // ack, nothing to do
  }

  // Only act on a completed payment.
  if (status !== "completed") {
    console.log("Webhook status not completed:", status, orderNo);
    return new Response("OK", { status: 200 });
  }

  if (!env.DB) {
    console.log("Webhook: no DB binding");
    return new Response("OK", { status: 200 });
  }

  // 4. Extract the real HitPay fee from the first payment record (cents).
  let feeCents = null;
  try {
    if (Array.isArray(data.payments) && data.payments.length > 0) {
      const f = data.payments[0].fees;
      if (f != null) feeCents = Math.round(parseFloat(f) * 100);
    }
  } catch (e) { /* ignore */ }

  // 5. Load the order. Idempotency: if already paid, ack and stop (HitPay can
  //    deliver a webhook more than once; we must not double-notify).
  let order;
  try {
    order = await env.DB.prepare(`SELECT * FROM orders WHERE order_no = ?`).bind(orderNo).first();
  } catch (e) {
    console.log("Webhook DB read error:", e && e.message);
    return new Response("OK", { status: 200 });
  }
  if (!order) {
    console.log("Webhook: order not found", orderNo);
    return new Response("OK", { status: 200 });
  }
  if (order.status === "paid" || order.status === "packed" || order.status === "shipped") {
    return new Response("OK already paid", { status: 200 }); // idempotent
  }

  // 6. Mark paid (store fee + payment id + paid timestamp).
  try {
    await env.DB.prepare(
      `UPDATE orders
         SET status = 'paid',
             paid_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
             hitpay_payment_id = COALESCE(hitpay_payment_id, ?),
             hitpay_fee_cents = ?
       WHERE order_no = ?`
    ).bind(paymentId, feeCents, orderNo).run();
  } catch (e) {
    console.log("Webhook DB update error:", e && e.message);
    // continue to notify anyway using what we have
  }

  // Build the order object we pass to notifications (with fee).
  const paidOrder = Object.assign({}, order, { status: "paid", hitpay_fee_cents: feeCents });

  // 7. Fire notifications (best-effort; failures are logged, not fatal).
  //    waitUntil lets them finish after we return 200 to HitPay quickly.
  const notify = Promise.allSettled([
    sendTelegram(env, paidOrder),
    sendOrderConfirmation(env, paidOrder),
  ]);
  if (context.waitUntil) context.waitUntil(notify);
  else await notify;

  return new Response("OK", { status: 200 });
}

// HitPay only POSTs here.
export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return new Response("Method Not Allowed", { status: 405 });
}
