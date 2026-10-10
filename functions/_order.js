// Order helpers: money math, delivery-fee rule, order numbers.
// Everything that decides "how much" lives here so there is one place to change it.

import { getProduct } from "./_catalog.js";

export const CURRENCY = "SGD";

// Delivery rule, in ONE place.
// Standard Delivery: $3.50, waived on 2 bags or more.
// Built so self-pickup can later pass fulfilment="pickup" and get a 0 fee
// without touching anything else.
export const DELIVERY_FEE_CENTS = 350;
export const FREE_DELIVERY_MIN_QTY = 2;

export function deliveryFeeCents(totalQty, fulfilment = "delivery") {
  if (fulfilment === "pickup") return 0;
  return totalQty >= FREE_DELIVERY_MIN_QTY ? 0 : DELIVERY_FEE_CENTS;
}

// Validate and re-price a browser cart against the server catalog.
// `cart` is an array of { id, qty }. Returns { ok, items, subtotalCents,
// totalQty, error }. Never trusts any price sent from the browser.
export function priceCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return { ok: false, error: "Your bag is empty." };
  }

  const items = [];
  let subtotalCents = 0;
  let totalQty = 0;

  for (const line of cart) {
    const id = line && line.id;
    let qty = Math.floor(Number(line && line.qty));
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > 20) qty = 20; // sane cap per line

    const product = getProduct(id);
    if (!product) {
      return { ok: false, error: "One of the items is no longer available." };
    }

    const unitCents = Math.round(product.price * 100);
    const lineCents = unitCents * qty;
    subtotalCents += lineCents;
    totalQty += qty;

    items.push({
      id,
      name: product.name,
      weight: product.weight,
      qty,
      unit_cents: unitCents,
      line_cents: lineCents,
    });
  }

  return { ok: true, items, subtotalCents, totalQty };
}

// Human-friendly order number, e.g. PIL-7F3K9Q. Unambiguous charset (no 0/O/1/I).
export function makeOrderNo() {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return "PIL-" + s;
}

// Format cents as a plain dollar string for display, e.g. 350 -> "3.50".
export function dollars(cents) {
  return (cents / 100).toFixed(2);
}
