-- Pillars Coffee orders table (Cloudflare D1 / SQLite).
-- Run this once against the D1 database (see SETUP guide).
-- Safe to re-run: uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no          TEXT    NOT NULL UNIQUE,          -- e.g. PIL-7F3K9Q

  -- lifecycle: pending -> paid -> packed -> shipped  (also: cancelled)
  status            TEXT    NOT NULL DEFAULT 'pending',

  -- delivery | pickup  (pickup is a later add-on; column here from day one)
  fulfilment        TEXT    NOT NULL DEFAULT 'delivery',

  -- customer
  customer_name     TEXT    NOT NULL,
  email             TEXT    NOT NULL,
  phone             TEXT,
  address           TEXT,                              -- full delivery address block

  -- what they bought: JSON array of {id,name,weight,qty,unit_cents,line_cents}
  items_json        TEXT    NOT NULL,

  -- money, all in cents, currency fixed SGD
  subtotal_cents    INTEGER NOT NULL,
  delivery_cents    INTEGER NOT NULL DEFAULT 0,
  total_cents       INTEGER NOT NULL,
  currency          TEXT    NOT NULL DEFAULT 'SGD',

  -- HitPay linkage
  hitpay_reference  TEXT,                              -- our reference sent to HitPay
  hitpay_payment_id TEXT,                              -- HitPay's payment request id

  -- fulfilment
  tracking_url      TEXT,

  -- timestamps (ISO 8601 UTC strings)
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  paid_at           TEXT,
  shipped_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_hitpay_ref ON orders(hitpay_reference);
