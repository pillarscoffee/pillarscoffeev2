// /api/stock  — which beans are available to buy right now, and in what order.
//
// GET  /api/stock           (PUBLIC)
//     -> { available: ["sitio-yamava", ...] }  in carousel order (position asc)
//     Used by the homepage carousel, the beans page, and the checkout guard.
//
// GET  /api/stock?all=1     (ADMIN, x-pillars-key)
//     -> { beans: [{ id, name, type, price, weight, available, position }] }
//        every portfolio bean + its on/off state, for the Stock tab.
//
// POST /api/stock           (ADMIN, x-pillars-key)
//     body { bean_id, available: true|false }
//     Turning ON gives the bean the next position (so carousel order = the order
//     you switch them on). Turning OFF clears its position.
//
// Env: DB, ADMIN_KEY.

import { CATALOG, getProduct, allIds } from "../_catalog.js";

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

// Read the raw stock rows as a map { bean_id: { available, position } }.
async function readStock(env) {
  const map = {};
  if (!env.DB) return map;
  try {
    const res = await env.DB.prepare(`SELECT bean_id, available, position FROM stock`).all();
    for (const r of (res && res.results) || []) {
      map[r.bean_id] = { available: !!r.available, position: r.position };
    }
  } catch (e) { /* table may not exist yet -> empty */ }
  return map;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const stock = await readStock(env);

  // Admin view: full bean list with state (for the Stock tab).
  if (url.searchParams.get("all") === "1") {
    if (!authed(request, env)) return json({ error: "Unauthorized" }, 401);
    const beans = allIds().map(function (id) {
      const p = CATALOG[id];
      const s = stock[id] || {};
      return {
        id: id,
        name: p.name,
        type: p.type,
        price: p.price,
        weight: p.weight,
        available: !!s.available,
        position: s.position != null ? s.position : null,
      };
    });
    return json({ beans: beans });
  }

  // Public view: just the available bean ids, in carousel order.
  const available = allIds()
    .filter(function (id) { return stock[id] && stock[id].available; })
    .sort(function (a, b) {
      const pa = stock[a].position == null ? 9999 : stock[a].position;
      const pb = stock[b].position == null ? 9999 : stock[b].position;
      return pa - pb;
    });
  return json({ available: available });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authed(request, env)) return json({ error: "Unauthorized" }, 401);
  if (!env.DB) return json({ error: "No database" }, 500);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "Bad request" }, 400); }

  const beanId = String(body.bean_id || "").trim();
  const makeAvailable = body.available === true || body.available === "true";

  if (!getProduct(beanId)) return json({ error: "Unknown bean" }, 400);

  try {
    if (makeAvailable) {
      // Next position = one past the current max among available beans.
      const row = await env.DB.prepare(
        `SELECT COALESCE(MAX(position), 0) AS maxpos FROM stock WHERE available = 1`
      ).first();
      const nextPos = ((row && row.maxpos) || 0) + 1;
      await env.DB.prepare(
        `INSERT INTO stock (bean_id, available, position, updated_at)
           VALUES (?, 1, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
         ON CONFLICT(bean_id) DO UPDATE SET
           available = 1,
           position = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')`
      ).bind(beanId, nextPos, nextPos).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO stock (bean_id, available, position, updated_at)
           VALUES (?, 0, NULL, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
         ON CONFLICT(bean_id) DO UPDATE SET
           available = 0,
           position = NULL,
           updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')`
      ).bind(beanId).run();
    }
  } catch (e) {
    return json({ error: "Could not update stock. Did you run the stock table setup?" }, 500);
  }

  return json({ ok: true, bean_id: beanId, available: makeAvailable });
}

export async function onRequest(context) {
  const m = context.request.method;
  if (m === "GET") return onRequestGet(context);
  if (m === "POST") return onRequestPost(context);
  return new Response("Method Not Allowed", { status: 405 });
}
