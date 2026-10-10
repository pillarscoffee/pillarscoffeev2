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

  const text =
    "NEW PAID ORDER  " + esc(order.order_no) + "\n" +
    "----------------------------------------\n" +
    itemsLines(items) + "\n" +
    "----------------------------------------\n" +
    "Subtotal: $" + dollars(order.subtotal_cents) + "\n" +
    "Delivery: $" + dollars(order.delivery_cents) + "\n" +
    "TOTAL PAID: $" + dollars(order.total_cents) + " " + order.currency +
    feeNote + "\n\n" +
    "Deliver to:\n" +
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
        '<td style="padding:8px 0;border-bottom:1px solid #eee;">' + esc(i.name) +
        ' <span style="color:#888;">(' + esc(i.weight) + ') x ' + i.qty + '</span></td>' +
        '<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">$' + dollars(i.line_cents) + '</td>' +
        '</tr>'
      );
    })
    .join("");

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1c1a;">' +
      '<h1 style="font-size:22px;letter-spacing:2px;">PILLARS COFFEE</h1>' +
      '<p>Hi ' + esc(order.customer_name) + ',</p>' +
      '<p>Thank you for your order. We have received your payment and your beans will be packed fresh and delivered in 1 to 3 working days.</p>' +
      '<p style="color:#888;font-size:13px;">Order reference: <b>' + esc(order.order_no) + '</b></p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">' + rows +
        '<tr><td style="padding:8px 0;">Subtotal</td><td style="padding:8px 0;text-align:right;">$' + dollars(order.subtotal_cents) + '</td></tr>' +
        '<tr><td style="padding:4px 0;">Delivery</td><td style="padding:4px 0;text-align:right;">' + (order.delivery_cents === 0 ? "FREE" : "$" + dollars(order.delivery_cents)) + '</td></tr>' +
        '<tr><td style="padding:8px 0;font-weight:bold;border-top:2px solid #1c1c1a;">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold;border-top:2px solid #1c1c1a;">$' + dollars(order.total_cents) + ' ' + order.currency + '</td></tr>' +
      '</table>' +
      '<p style="font-size:14px;"><b>Delivery to</b><br>' + esc(order.address).replace(/\n/g, "<br>") + '</p>' +
      '<p style="color:#888;font-size:12px;margin-top:28px;">Every Pillars bag ships blank. Draw on it, keep it, or gift it. Questions? Just reply to this email.</p>' +
    '</div>';

  const text =
    "PILLARS COFFEE\n\nHi " + esc(order.customer_name) + ",\n\n" +
    "Thank you for your order. We have received your payment and your beans will be delivered in 1 to 3 working days.\n\n" +
    "Order reference: " + esc(order.order_no) + "\n\n" +
    itemsLines(items) + "\n" +
    "Subtotal: $" + dollars(order.subtotal_cents) + "\n" +
    "Delivery: " + (order.delivery_cents === 0 ? "FREE" : "$" + dollars(order.delivery_cents)) + "\n" +
    "Total: $" + dollars(order.total_cents) + " " + order.currency + "\n\n" +
    "Delivery to:\n" + esc(order.address) + "\n";

  return resendSend(env, {
    from: from,
    to: order.email,
    reply_to: replyTo,
    subject: "Your Pillars Coffee order " + order.order_no,
    html: html,
    text: text,
  });
}

// ---- Resend: shipped email ----
export async function sendShippedEmail(env, order) {
  const key = env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const from = env.ORDER_FROM_EMAIL || DEFAULT_FROM;
  const replyTo = env.ORDER_REPLY_TO || DEFAULT_REPLY_TO;

  const track = order.tracking_url
    ? '<p><a href="' + esc(order.tracking_url) + '" style="display:inline-block;background:#1c1c1a;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;">Track your delivery</a></p>' +
      '<p style="font-size:12px;color:#888;">Or copy this link: ' + esc(order.tracking_url) + '</p>'
    : "";
  const trackText = order.tracking_url ? "Track your delivery: " + esc(order.tracking_url) + "\n" : "";

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1c1a;">' +
      '<h1 style="font-size:22px;letter-spacing:2px;">PILLARS COFFEE</h1>' +
      '<p>Hi ' + esc(order.customer_name) + ',</p>' +
      '<p>Good news, your order <b>' + esc(order.order_no) + '</b> is on its way.</p>' +
      track +
      '<p style="color:#888;font-size:12px;margin-top:28px;">Questions? Just reply to this email.</p>' +
    '</div>';
  const text =
    "PILLARS COFFEE\n\nHi " + esc(order.customer_name) + ",\n\n" +
    "Your order " + esc(order.order_no) + " is on its way.\n" + trackText;

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
