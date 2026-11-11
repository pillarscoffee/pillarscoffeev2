// Notifications: Telegram alert to the team + Resend order emails.
// All credentials come from Cloudflare secrets (env), never hard-coded.
//
// Env used:
//   TELEGRAM_BOT_TOKEN   - secret, the @pillarsorders_bot token
//   TELEGRAM_CHAT_ID     - the group chat id (e.g. -5353902451); defaults to that
//   RESEND_API_KEY       - secret, Resend API key
//   ORDER_FROM_EMAIL     - from address, defaults to orders@pillarscoffee.sg
//   ORDER_REPLY_TO       - reply-to, defaults to orders@pillarscoffee.sg

import { dollars } from "./_order.js";

const DEFAULT_CHAT_ID = "-5353902451";
const DEFAULT_FROM = "Pillars Coffee <orders@pillarscoffee.sg>";
const DEFAULT_REPLY_TO = "orders@pillarscoffee.sg";

// ---- helpers ----
function itemsLines(items) {
  // items: [{name, weight, qty, line_cents}]
  return items
    .map(function (i) {
      return "• " + i.qty + " x " + i.name + " (" + i.weight + ") — $" + dollars(i.line_cents);
    })
    .join("\n");
}

function esc(s) {
  return String(s == null ? "" : s);
}
// Escape untrusted customer and product text before placing it in HTML emails.
function htmlSafe(s) {
  return esc(s).replace(/[&<>"']/g, function(c) {
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}

function isPickup(order) {
  return order && order.fulfilment === "pickup";
}

// ---- Telegram ----
// Sends a plain-text message to the orders group. Best-effort: logs on failure,
// never throws (a failed alert must not break the webhook).
export async function sendTelegram(env, order) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID || DEFAULT_CHAT_ID;
  if (!token) {
    console.log("Telegram skipped: no TELEGRAM_BOT_TOKEN");
    return { ok: false, skipped: true };
  }

  const items = JSON.parse(order.items_json || "[]");
  const feeNote =
    order.hitpay_fee_cents != null
      ? "\nHitPay fee: $" + dollars(order.hitpay_fee_cents) +
        "   Net: $" + dollars(order.total_cents - order.hitpay_fee_cents)
      : "";

  const pickup = isPickup(order);
  const text =
    "NEW PAID ORDER  " + esc(order.order_no) +
    (pickup ? "   [SELF-PICKUP]" : "") + "\n" +
    "----------------------------------------\n" +
    itemsLines(items) + "\n" +
    "----------------------------------------\n" +
    "Subtotal: $" + dollars(order.subtotal_cents) + "\n" +
    (pickup ? "Collection: self-pickup" : "Delivery: $" + dollars(order.delivery_cents)) + "\n" +
    "TOTAL PAID: $" + dollars(order.total_cents) + " " + order.currency +
    feeNote + "\n\n" +
    (pickup ? "COLLECT AT COUNTER:\n" : "Deliver to:\n") +
    esc(order.customer_name) + "\n" +
    esc(order.phone) + "\n" +
    esc(order.address) + "\n" +
    esc(order.email);

  try {
    const resp = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text, disable_web_page_preview: true }),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.log("Telegram failed:", resp.status, body);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.log("Telegram error:", e && e.message);
    return { ok: false };
  }
}

// ---- Resend: order confirmation ----
export async function sendOrderConfirmation(env, order) {
  const key = env.RESEND_API_KEY;
  if (!key) {
    console.log("Resend skipped: no RESEND_API_KEY");
    return { ok: false, skipped: true };
  }
  const from = env.ORDER_FROM_EMAIL || DEFAULT_FROM;
  const replyTo = env.ORDER_REPLY_TO || DEFAULT_REPLY_TO;
  const items = JSON.parse(order.items_json || "[]");

  const rows = items
    .map(function (i) {
      return (
        '<tr>' +
        '<td style="padding:8px 0;border-bottom:1px solid #eee;">' + htmlSafe(i.name) +
        ' <span style="color:#888;">(' + htmlSafe(i.weight) + ') x ' + i.qty + '</span></td>' +
        '<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">$' + dollars(i.line_cents) + '</td>' +
        '</tr>'
      );
    })
    .join("");

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1c1a;">' +
      '<h1 style="font-size:22px;letter-spacing:2px;">PILLARS COFFEE</h1>' +
      '<p>Hi ' + htmlSafe(order.customer_name) + ',</p>' +
      (isPickup(order)
        ? '<p>Thank you for your order. We have received your payment. Your beans will be packed fresh and ready for collection at our counter. We will let you know when they are ready.</p>'
        : '<p>Thank you for your order. We have received your payment and your beans will be packed fresh and delivered in 1 to 4 working days.</p>') +
      '<p style="color:#888;font-size:13px;">Order reference: <b>' + esc(order.order_no) + '</b></p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">' + rows +
        '<tr><td style="padding:8px 0;">Subtotal</td><td style="padding:8px 0;text-align:right;">$' + dollars(order.subtotal_cents) + '</td></tr>' +
        (isPickup(order)
          ? '<tr><td style="padding:4px 0;">Collection</td><td style="padding:4px 0;text-align:right;">Self-pickup, free</td></tr>'
          : '<tr><td style="padding:4px 0;">Delivery</td><td style="padding:4px 0;text-align:right;">' + (order.delivery_cents === 0 ? "FREE" : "$" + dollars(order.delivery_cents)) + '</td></tr>') +
        '<tr><td style="padding:8px 0;font-weight:bold;border-top:2px solid #1c1c1a;">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold;border-top:2px solid #1c1c1a;">$' + dollars(order.total_cents) + ' ' + order.currency + '</td></tr>' +
      '</table>' +
      '<p style="font-size:14px;"><b>' + (isPickup(order) ? "Collect at" : "Delivery to") + '</b><br>' + htmlSafe(order.address).replace(/\n/g, "<br>") + '</p>' +
      '<p style="color:#888;font-size:12px;margin-top:28px;">Every Pillars bag ships blank. Draw on it, keep it, or gift it. Questions? Just reply to this email.</p>' +
    '</div>';

  const text =
    "PILLARS COFFEE\n\nHi " + esc(order.customer_name) + ",\n\n" +
    (isPickup(order)
      ? "Thank you for your order. We have received your payment. Your beans will be ready for collection at our counter.\n\n"
      : "Thank you for your order. We have received your payment and your beans will be delivered in 1 to 4 working days.\n\n") +
    "Order reference: " + esc(order.order_no) + "\n\n" +
    itemsLines(items) + "\n" +
    "Subtotal: $" + dollars(order.subtotal_cents) + "\n" +
    (isPickup(order) ? "Collection: self-pickup, free" : "Delivery: " + (order.delivery_cents === 0 ? "FREE" : "$" + dollars(order.delivery_cents))) + "\n" +
    "Total: $" + dollars(order.total_cents) + " " + order.currency + "\n\n" +
    (isPickup(order) ? "Collect at:\n" : "Delivery to:\n") + esc(order.address) + "\n";

  return resendSend(env, {
    from: from,
    to: order.email,
    reply_to: replyTo,
    subject: "Your Pillars Coffee order " + order.order_no,
    html: html,
    text: text,
  });
}

// ---- Resend: pickup ready notification ----
export async function sendPickupReadyEmail(env, order) {
  if (!env.RESEND_API_KEY) return { ok: false, skipped: true };
  const from = env.ORDER_FROM_EMAIL || DEFAULT_FROM;
  const replyTo = env.ORDER_REPLY_TO || DEFAULT_REPLY_TO;
  // Escaped for email HTML, because customer-entered values are untrusted.
  function safe(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function(c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1c1a;">' +
    '<h1 style="font-size:22px;letter-spacing:2px;">PILLARS COFFEE</h1>' +
    '<p>Hi ' + safe(order.customer_name) + ',</p>' +
    '<p>Your coffee is packed and ready for collection.</p>' +
    '<p><b>Order:</b> ' + safe(order.order_no) + '<br><b>Collection:</b> ' + safe(order.address) + '</p>' +
    '<p>Please quote your order number when collecting. Questions? Reply to this email.</p>' +
    '</div>';
  const plain = 'PILLARS COFFEE\n\nHi ' + esc(order.customer_name) +
    ',\nYour coffee is packed and ready for collection.\n' +
    'Order: ' + esc(order.order_no) + '\nCollection: ' + esc(order.address) +
    '\nPlease quote your order number when collecting.\n';
  return resendSend(env, { from, to: order.email, reply_to: replyTo,
    subject: 'Your Pillars Coffee order is ready for collection', html, text: plain });
}

// ---- Resend: shipped email ----
export async function sendShippedEmail(env, order) {
  const key = env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const from = env.ORDER_FROM_EMAIL || DEFAULT_FROM;
  const replyTo = env.ORDER_REPLY_TO || DEFAULT_REPLY_TO;

  const carrierNames = { jt: "J&T Express", singpost: "SingPost", other: "Other courier" };
  const carrier = carrierNames[order.tracking_carrier] || "Courier";
  const number = String(order.tracking_number || "").trim();
  const url = String(order.tracking_url || "").trim();
  function htmlSafe(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  const isSafeLink = /^https:\/\/[^\s]+$/i.test(url);
  const trackingInfo = number
    ? '<p>Courier: <b>' + htmlSafe(carrier) + '</b><br>Tracking number: <b>' + htmlSafe(number) + '</b></p>'
    : '';
  const trackButton = isSafeLink
    ? '<p><a href="' + htmlSafe(url) + '" style="display:inline-block;background:#1c1c1a;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;">Open courier tracking</a></p>'
    : '';
  const guidance = order.tracking_carrier === "jt" ? '<p style="font-size:12px;color:#888;">Enter the tracking number on J&T Express. You may also be asked for the last 4 digits of your phone number.</p>' :
    (number ? '<p style="font-size:12px;color:#888;">Enter the tracking number on the courier website.</p>' : '');
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1c1a;">' +
      '<h1 style="font-size:22px;letter-spacing:2px;">PILLARS COFFEE</h1>' +
      '<p>Hi ' + htmlSafe(order.customer_name) + ',</p>' +
      '<p>Good news, your order <b>' + htmlSafe(order.order_no) + '</b> is on its way.</p>' +
      trackingInfo + trackButton + guidance +
      '<p style="color:#888;font-size:12px;margin-top:28px;">Questions? Just reply to this email.</p>' +
    '</div>';
  const text =
    "PILLARS COFFEE\n\nHi " + esc(order.customer_name) + ",\n\n" +
    "Your order " + esc(order.order_no) + " is on its way.\n" +
    (number ? "Courier: " + carrier + "\nTracking number: " + number + "\n" : "") +
    (isSafeLink ? "Tracking page: " + url + "\n" : "") +
    (order.tracking_carrier === "jt" ? "J&T may request the last four digits of your phone number.\n" : "");

  return resendSend(env, {
    from: from,
    to: order.email,
    reply_to: replyTo,
    subject: "Your Pillars Coffee order is on its way",
    html: html,
    text: text,
  });
}

// ---- low-level Resend call ----
async function resendSend(env, msg) {
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msg),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.log("Resend failed:", resp.status, body);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.log("Resend error:", e && e.message);
    return { ok: false };
  }
}
