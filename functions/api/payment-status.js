// Public read-only status check for the thank-you page. Returns no customer data.
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
export async function onRequestGet({ request, env }) {
  const ref = new URL(request.url).searchParams.get("ref") || "";
  if (!/^PIL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(ref)) return json({ paid: false }, 400);
  if (!env.DB) return json({ paid: false }, 503);
  try {
    const order = await env.DB.prepare("SELECT status FROM orders WHERE order_no = ?").bind(ref).first();
    return json({ paid: !!order && ["paid", "packed", "shipped"].includes(order.status) });
  } catch (e) {
    return json({ paid: false }, 503);
  }
}
