// POST /api/webhook-v2  — HitPay payment webhook (HARDENED)
//
// This is a drop-in replacement for /api/webhook. It is deployed under a NEW
// name first so it can be tested with a HitPay SANDBOX payment WITHOUT touching
// the live /api/webhook. Once a sandbox test confirms it marks an order paid
// correctly, rename this file to webhook.js (overwriting the old one).
//
// WHAT CHANGED vs the old webhook, and WHY:
//   The old webhook marked an order paid on:  status==completed AND (signature OK
//   OR the payment-id in the body matches the stored id). The payment-id is NOT a
//   secret (it travels to the customer's browser), so "id match" alone let a
//   forged, unsigned webhook mark an order paid without real payment.
//
//   This version NEVER trusts the webhook body as proof of payment. It uses:
//     Proof A — Signature: HMAC-SHA256(rawBody, HITPAY_SALT) == Hitpay-Signature.
//               The fast path for every genuine HitPay call.
//     Proof B — Authenticated callback: if the signature does NOT verify, we do
//               NOT trust the body. We call HitPay's own authenticated API
//               (GET /payment-requests/{id} with our X-BUSINESS-API-KEY) and read
//               the status, amount and currency FROM HITPAY'S RESPONSE, not from
//               the incoming webhook. An attacker cannot forge HitPay's API reply.
//
//   We mark paid only if, by whichever proof, the payment is genuinely completed
//   AND the amount + currency match the order we created. Neither proof -> 401.
//
//   Fulfilment is idempotent AND the "mark paid" write is atomic (UPDATE ... WHERE
//   status='pending'); notifications fire only if that write actually flipped the
//   row, so a re-delivered / duplicate webhook can never fulfil twice.
//
// Set the webhook URL in HitPay: Developers -> Webhook Endpoints ->
//   https://pillarscoffee.sg/api/webhook   (topic: payment_request.completed)
//
// Env: HITPAY_SALT (secret), HITPAY_API_KEY (secret, same one checkout uses),
//      HITPAY_API_BASE (optional, defaults to production). Plus the notify env.

import { sendTelegram, sendOrderConfirmation } from "../_notify.js";

// SHA-256 -> lowercase hex. Meta requires user data (email/phone) hashed.
async function sha256Hex(input) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(String(input)));
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

// Normalise a SG phone to E.164 digits (meta wants digits only, country code).
function normalisePhone(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d]/g, "");
  if (!d) return null;
  if (d.length === 8) d = "65" + d; // bare SG mobile/landline -> +65
  return d;
}

// Send a server-side Purchase to the Meta Conversions API. This is the SOURCE OF
// TRUTH for Purchase: it runs only after an order is verified-paid, so it can
// never fire on an unpaid order, and it is immune to ad-blockers / incognito.
// event_id = order_no so Meta DEDUPES it against the browser Purchase on
// success.html. No-ops silently if the two env vars are not set, so tracking can
// never break order processing.
async function sendMetaPurchase(env, order) {
  try {
    const pixelId = env.META_PIXEL_ID;
    const token = env.META_CAPI_TOKEN;
    if (!pixelId || !token) return; // not configured -> skip quietly

    const value = (Number(order.total_cents) || 0) / 100;
    const currency = order.currency || "SGD";

    const userData = {};
    if (order.email) userData.em = [await sha256Hex(String(order.email).trim().toLowerCase())];
    const ph = normalisePhone(order.phone);
    if (ph) userData.ph = [await sha256Hex(ph)];

    let contentIds = [];
    try {
      const items = JSON.parse(order.items_json || "[]");
      contentIds = items.map(function (i) { return i.id; }).filter(Boolean);
    } catch (e) { /* ignore */ }

    const body = {
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: order.order_no,            // <-- dedupe key (matches browser)
        action_source: "website",
        event_source_url: "https://pillarscoffee.sg/success.html",
        user_data: userData,
        custom_data: {
          currency: currency,
          value: value,
          content_type: "product",
          content_ids: contentIds,
          order_id: order.order_no
        }
      }]
    };

    const resp = await fetch(
      "https://graph.facebook.com/v19.0/" + encodeURIComponent(pixelId) +
        "/events?access_token=" + encodeURIComponent(token),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );
    if (!resp.ok) {
      console.log("Meta CAPI Purchase HTTP", resp.status, order.order_no);
    } else {
      console.log("Meta CAPI Purchase sent", order.order_no);
    }
  } catch (e) {
    console.log("Meta CAPI Purchase error:", e && e.message);
  }
}

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

// Compare a HitPay decimal amount string/number to the order's integer cents.
// Tolerate representation ("19" vs "19.00" vs 19) by comparing rounded cents.
function amountMatchesCents(hitpayAmount, orderCents) {
  if (hitpayAmount == null || orderCents == null) return false;
  const cents = Math.round(parseFloat(hitpayAmount) * 100);
  if (!isFinite(cents)) return false;
  return cents === Number(orderCents);
}

// Ask HitPay's authenticated API whether this payment request is really paid.
// Returns { ok, status, amount, currency } or { ok:false } on any failure.
async function confirmWithHitPay(env, paymentRequestId) {
  try {
    const apiKey = env.HITPAY_API_KEY;
    const apiBase = env.HITPAY_API_BASE || "https://api.hit-pay.com/v1";
    if (!apiKey || !paymentRequestId) return { ok: false };
    const resp = await fetch(apiBase + "/payment-requests/" + encodeURIComponent(paymentRequestId), {
      method: "GET",
      headers: {
        "X-BUSINESS-API-KEY": apiKey,
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (!resp.ok) {
      console.log("HitPay confirm HTTP", resp.status, paymentRequestId);
      return { ok: false };
    }
    const body = await resp.json();
    // Payment-request object exposes status/amount/currency at the top level.
    return {
      ok: true,
      status: body && body.status,
      amount: body && body.amount,
      currency: body && body.currency,
    };
  } catch (e) {
    console.log("HitPay confirm error:", e && e.message);
    return { ok: false };
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Read the RAW body first (needed for an exact signature match).
  const raw = await request.text();

  // 2. Parse the payload (reference + id let us look up the order + confirm).
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    // Older HitPay webhooks post form-urlencoded. Fall back to that shape.
    try {
      const params = new URLSearchParams(raw);
      data = Object.fromEntries(params.entries());
    } catch (e2) {
      return new Response("Bad body", { status: 400 });
    }
  }

  const orderNo = data.reference_number;
  const paymentId = data.id || data.payment_id; // HitPay payment-request id

  if (!orderNo) {
    return new Response("No reference", { status: 200 }); // ack, nothing to do
  }

  if (!env.DB) {
    console.log("Webhook: no DB binding");
    return new Response("OK", { status: 200 });
  }

  // 3. Load the order (needed for the amount/currency check + notifications).
  let order;
  try {
    order = await env.DB.prepare(`SELECT * FROM orders WHERE order_no = ?`).bind(orderNo).first();
  } catch (e) {
    console.log("Webhook DB read error:", e && e.message);
    return new Response("OK", { status: 200 });
  }
  if (!order) {
    console.log("Webhook: order not found", orderNo);
    return new Response("OK", { status: 200 }); // nothing to mark
  }

  // Idempotency (fast exit): if already progressed, ack and stop.
  if (order.status === "paid" || order.status === "packed" || order.status === "shipped") {
    return new Response("OK already paid", { status: 200 });
  }

  // 4. Proof A — signature check over the raw body (never throws; true/false).
  let sigOk = false;
  try {
    const salt = env.HITPAY_SALT;
    const given =
      request.headers.get("Hitpay-Signature") ||
      request.headers.get("hitpay-signature") ||
      data.hmac; // form-style webhooks put the hmac in the body
    if (salt && given) {
      const expected = await hmacHex(salt, raw);
      sigOk = safeEqualHex(expected, given);
    }
  } catch (e) {
    sigOk = false;
  }

  // 5. Establish the TRUE status + amount + currency.
  //    - If the signature verified, the body is trustworthy: use it.
  //    - If NOT, do not trust the body at all; ask HitPay's authenticated API.
  let trueStatus, trueAmount, trueCurrency, proof;
  if (sigOk) {
    proof = "signature";
    trueStatus = data.status;
    trueAmount = data.amount;           // present on signed webhooks
    trueCurrency = data.currency;
  } else {
    // Signature failed or salt unset -> independent, authenticated confirmation.
    const c = await confirmWithHitPay(env, paymentId);
    if (!c.ok) {
      console.log("Webhook REJECTED (no signature, HitPay confirm failed):", orderNo);
      return new Response("Unverified", { status: 401 });
    }
    proof = "api-confirm";
    trueStatus = c.status;
    trueAmount = c.amount;
    trueCurrency = c.currency;
  }

  // 6. The payment must actually be completed.
  //    (Signed webhooks use 'completed'; the payment-request API uses 'completed'
  //     too for a paid request. Accept 'completed'/'paid' to be safe.)
  const isCompleted = trueStatus === "completed" || trueStatus === "paid";
  if (!isCompleted) {
    console.log("Webhook status not completed:", trueStatus, orderNo, "via", proof);
    return new Response("OK", { status: 200 });
  }

  // 7. Amount + currency MUST match the order we created. This blocks a webhook
  //    that is genuine-looking but names the wrong (e.g. smaller) amount.
  //    If the signed body did not carry an amount, fall back to an API confirm
  //    rather than skipping the check.
  if (trueAmount == null && proof === "signature") {
    const c = await confirmWithHitPay(env, paymentId);
    if (c.ok) { trueAmount = c.amount; trueCurrency = trueCurrency || c.currency; }
  }
  const amountOk = amountMatchesCents(trueAmount, order.total_cents);
  const currencyOk =
    !order.currency || !trueCurrency ||
    String(trueCurrency).toUpperCase() === String(order.currency).toUpperCase();
  if (!amountOk || !currencyOk) {
    console.log(
      "Webhook REJECTED (amount/currency mismatch):", orderNo,
      "hitpay=", trueAmount, trueCurrency, "order=", order.total_cents, order.currency, "via", proof
    );
    return new Response("Amount mismatch", { status: 401 });
  }

  console.log("Webhook accepted via", proof, orderNo);

  // 8. Extract the real HitPay fee from the first payment record (cents), if present.
  let feeCents = null;
  try {
    if (Array.isArray(data.payments) && data.payments.length > 0) {
      const f = data.payments[0].fees;
      if (f != null) feeCents = Math.round(parseFloat(f) * 100);
    }
  } catch (e) { /* ignore */ }

  // 9. Mark paid ATOMICALLY: only flip a row that is still 'pending'. The result's
  //    changes count tells us whether THIS call is the one that did it, so two
  //    simultaneous webhooks can never both proceed to notify.
  let didFlip = false;
  try {
    const res = await env.DB.prepare(
      `UPDATE orders
         SET status = 'paid',
             paid_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
             hitpay_payment_id = COALESCE(hitpay_payment_id, ?),
             hitpay_fee_cents = ?
       WHERE order_no = ? AND status = 'pending'`
    ).bind(paymentId, feeCents, orderNo).run();
    const changes = (res && res.meta && typeof res.meta.changes === "number")
      ? res.meta.changes
      : (res && typeof res.changes === "number" ? res.changes : 0);
    didFlip = changes > 0;
  } catch (e) {
    console.log("Webhook DB update error:", e && e.message);
    // If we cannot confirm the write, do NOT fire notifications (avoid false ship).
    return new Response("OK", { status: 200 });
  }

  if (!didFlip) {
    // Someone/thing already flipped it between our read and write. Ack, don't re-notify.
    return new Response("OK already paid", { status: 200 });
  }

  // 10. Fire notifications (best-effort; only reached once, for the real flip).
  const paidOrder = Object.assign({}, order, { status: "paid", hitpay_fee_cents: feeCents });
  const notify = Promise.allSettled([
    sendTelegram(env, paidOrder),
    sendOrderConfirmation(env, paidOrder),
    sendMetaPurchase(env, paidOrder),   // server-side Purchase (source of truth)
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
