// Pillars Coffee product catalog (server side, source of truth for pricing).
//
// This is the ONLY place prices live for checkout. The browser cart is just UX;
// the checkout function always re-prices every line against this list, so a
// tampered price in the browser can never change what gets charged.
//
// Every bean in the portfolio lives here. Whether a bean can actually be BOUGHT
// right now is NOT decided here: it is decided by the live stock list (the Stock
// tab on the team page, stored in the database). This catalog is the full menu;
// stock is what is switched on today.
//
// `id` MUST equal the bean page filename slug in /beans (e.g. sitio-yamava.html).
// `drawn` is the carousel sketch filename; if the file is missing the carousel
// falls back to a default, so it never breaks.
//
// Prices are in whole SGD dollars here, converted to cents where money math happens.

export const CATALOG = {
  // --- Espresso ---
  "sitio-yamava":       { name: "Sitio Yamava",        price: 19, weight: "200g", type: "Espresso", origin: "Alta Mogiana, Brazil",             notes: "Hazelnut · Milk Chocolate · Brown Sugar", drawn: "images/drawn-sitio-yamava.jpg" },
  "fazenda-sertao":     { name: "Fazenda Sertao",      price: 19, weight: "200g", type: "Espresso", origin: "Carmo de Minas, Brazil",           notes: "Hazelnut · Red Plums · Molasses",         drawn: "images/drawn-fazenda-sertao.jpg" },
  "planadas-espresso":  { name: "Planadas Orquidea",   price: 22, weight: "200g", type: "Espresso", origin: "Planadas, Tolima, Colombia",       notes: "Red Dates · Raisins · Honey",             drawn: "images/drawn-planadas-espresso.jpg" },
  "banko-gotiti":       { name: "Banko Gotiti",        price: 25, weight: "200g", type: "Espresso", origin: "Yirgacheffe, Ethiopia",            notes: "Lemon Candy · Mandarin · Cola",           drawn: "images/drawn-banko-gotiti.jpg" },
  "kiamwangi-espresso": { name: "Kiamwangi AB",        price: 26, weight: "200g", type: "Espresso", origin: "Nyeri County, Kenya",              notes: "Floral · Blackcurrant · Citrus",          drawn: "images/drawn-kiamwangi-espresso.jpg" },
  "ruli-cws":           { name: "Ruli CWS",            price: 26, weight: "200g", type: "Espresso", origin: "Gakenke District, Rwanda",         notes: "Violet Florals · Mixed Berries · Rum",    drawn: "images/drawn-ruli-cws.jpg" },
  "chinga-aa":          { name: "Chinga AA",           price: 25, weight: "200g", type: "Espresso", origin: "Nyeri County, Kenya",              notes: "Kefir Lime · Blackcurrants · Roselle",    drawn: "images/drawn-chinga-aa.jpg" },

  // --- Filter ---
  "alo-village":        { name: "Alo Village",         price: 28, weight: "200g", type: "Filter",   origin: "Bensa, Sidama, Ethiopia",          notes: "Blueberry · Bergamot · Lavender",         drawn: "images/drawn-alo-village.jpg" },
  "quebraditas":        { name: "Quebraditas",         price: 38, weight: "150g", type: "Filter",   origin: "Huila, Colombia",                  notes: "Watermelon · Lychee · Roselle",           drawn: "images/drawn-quebraditas.jpg" },
  "el-alcanfor":        { name: "El Alcanfor",         price: 28, weight: "200g", type: "Filter",   origin: "San Ignacio, Cajamarca, Peru",     notes: "Yellow Plums · Dried Fig · Red Tea",      drawn: "images/drawn-el-alcanfor.jpg" },
  "planadas-filter":    { name: "Planadas Orquidea",   price: 22, weight: "200g", type: "Filter",   origin: "Planadas, Tolima, Colombia",       notes: "Red Dates · Raisins · Honey",             drawn: "images/drawn-planadas-filter.jpg" },
  "la-esmeralda":       { name: "La Esmeralda",        price: 38, weight: "150g", type: "Filter",   origin: "Huila, Colombia",                  notes: "Tropical Fruits · Jasmine · Wild Honey",  drawn: "images/drawn-la-esmeralda.jpg" },
  "alo-mosto":          { name: "Alo Mosto",           price: 35, weight: "150g", type: "Filter",   origin: "Bensa, Sidama, Ethiopia",          notes: "Muscat Grape · Panela · Mango",           drawn: "images/drawn-alo-mosto.jpg" },
  "anaya-estate":       { name: "Finca Anaya Estate",  price: 28, weight: "200g", type: "Filter",   origin: "Huila, Colombia",                  notes: "Guava · Passionfruit · Pineapple",        drawn: "images/drawn-anaya-estate.jpg" },
  "kiamwangi-filter":   { name: "Kiamwangi AB",        price: 26, weight: "200g", type: "Filter",   origin: "Nyeri County, Kenya",              notes: "Floral · Blackcurrant · Citrus",          drawn: "images/drawn-kiamwangi-filter.jpg" },
  "mungaria":           { name: "Mung'aria",           price: 26, weight: "200g", type: "Filter",   origin: "Central Kenya",                    notes: "Passionfruit · Pineapple · Forest Berries", drawn: "images/drawn-mungaria.jpg" },
  "kirigo-ultra":       { name: "Kirigo Ultra",        price: 32, weight: "150g", type: "Filter",   origin: "Nyeri County, Kenya",              notes: "Mixed Berries · Champagne Grape · Papaya", drawn: "images/drawn-kirigo-ultra.jpg" },
  "kermachi-gesha":     { name: "Kermachi Gesha",      price: 38, weight: "150g", type: "Filter",   origin: "Bench Sheko, Ethiopia",            notes: "Blackcurrants · Strawberry · Chrysanthemum", drawn: "images/drawn-kermachi-gesha.jpg" },
};

// Returns the catalog product for an id, or null if it is not in the portfolio.
export function getProduct(id) {
  if (typeof id !== "string") return null;
  return Object.prototype.hasOwnProperty.call(CATALOG, id) ? CATALOG[id] : null;
}

// All bean ids, in catalog (menu) order.
export function allIds() {
  return Object.keys(CATALOG);
}
