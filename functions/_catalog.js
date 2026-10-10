// Pillars Coffee product catalog (server side, source of truth for pricing).
//
// This is the ONLY place prices live for checkout. The browser cart is just UX;
// the checkout function always re-prices every line against this list, so a
// tampered price in the browser can never change what gets charged.
//
// To change the shop when beans rotate: edit this list, then update the matching
// bean page(s) in /beans. Keep `id` equal to the bean page filename slug.
//
// Prices are in whole SGD dollars here, converted to cents where money math happens.

export const CATALOG = {
  "alo-mosto":    { name: "Alo Mosto",          price: 35, weight: "150g", type: "Filter"   },
  "anaya-estate": { name: "Finca Anaya Estate", price: 28, weight: "200g", type: "Filter"   },
  "la-esmeralda": { name: "La Esmeralda",       price: 38, weight: "150g", type: "Filter"   },
  "banko-gotiti": { name: "Banko Gotiti",       price: 25, weight: "200g", type: "Espresso" },
  "chinga-aa":    { name: "Chinga AA",          price: 25, weight: "200g", type: "Espresso" },
  "ruli-cws":     { name: "Ruli CWS",           price: 26, weight: "200g", type: "Espresso" },
  "sitio-yamava": { name: "Sitio Yamava",       price: 19, weight: "200g", type: "Espresso" },
};

// Returns the catalog product for an id, or null if it is not a live product.
export function getProduct(id) {
  if (typeof id !== "string") return null;
  return Object.prototype.hasOwnProperty.call(CATALOG, id) ? CATALOG[id] : null;
}
