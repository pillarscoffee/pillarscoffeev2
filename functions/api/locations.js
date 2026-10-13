// GET /api/locations  (PUBLIC)
// Returns the self-pickup locations for the checkout dropdown.
//   -> { locations: [{ id, label, address, note }, ...] }

import { locationList } from "../_locations.js";

export async function onRequestGet() {
  return new Response(JSON.stringify({ locations: locationList() }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet();
  return new Response("Method Not Allowed", { status: 405 });
}
