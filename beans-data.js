// Client-side bean menu. Mirrors functions/_catalog.js (same ids, prices, notes).
// Used by the homepage carousel and the beans page to render cards and to decide
// buyable vs "check availability", based on the live /api/stock list.
//
// When beans rotate you normally only flip the Stock toggles on the team page.
// Only edit THIS file when a bean's details change (price, notes) or a new bean
// is added to the portfolio (keep it in sync with functions/_catalog.js).

window.PILLARS_BEANS = {
  "sitio-yamava":       { name: "Sitio Yamava",       type: "Espresso", origin: "Alta Mogiana, Brazil",         notes: "Hazelnut · Milk Chocolate · Brown Sugar",   price: 19, weight: "200g", drawn: "images/drawn-sitio-yamava.jpg",       photo: "images/beans/sitio-yamava.jpg" },
  "fazenda-sertao":     { name: "Fazenda Sertao",     type: "Espresso", origin: "Carmo de Minas, Brazil",       notes: "Hazelnut · Red Plums · Molasses",           price: 19, weight: "200g", drawn: "images/drawn-fazenda-sertao.jpg",     photo: "images/beans/fazenda-sertao.jpg" },
  "planadas-espresso":  { name: "Planadas Orquidea",  type: "Espresso", origin: "Planadas, Tolima, Colombia",   notes: "Red Dates · Raisins · Honey",               price: 22, weight: "200g", drawn: "images/drawn-planadas-espresso.jpg", photo: "images/beans/planadas-espresso.jpg" },
  "banko-gotiti":       { name: "Banko Gotiti",       type: "Espresso", origin: "Yirgacheffe, Ethiopia",        notes: "Lemon Candy · Mandarin · Cola",             price: 25, weight: "200g", drawn: "images/drawn-banko-gotiti.jpg",       photo: "images/beans/banko-gotiti.jpg" },
  "kiamwangi-espresso": { name: "Kiamwangi AB",       type: "Espresso", origin: "Nyeri County, Kenya",          notes: "Floral · Blackcurrant · Citrus",            price: 26, weight: "200g", drawn: "images/drawn-kiamwangi-espresso.jpg",photo: "images/beans/kiamwangi-espresso.jpg" },
  "ruli-cws":           { name: "Ruli CWS",           type: "Espresso", origin: "Gakenke District, Rwanda",     notes: "Violet Florals · Mixed Berries · Rum",      price: 26, weight: "200g", drawn: "images/drawn-ruli-cws.jpg",           photo: "images/beans/ruli-cws.jpg" },
  "chinga-aa":          { name: "Chinga AA",          type: "Espresso", origin: "Nyeri County, Kenya",          notes: "Kefir Lime · Blackcurrants · Roselle",      price: 25, weight: "200g", drawn: "images/drawn-chinga-aa.jpg",          photo: "images/beans/chinga-aa.jpg" },

  "alo-village":        { name: "Alo Village",        type: "Filter",   origin: "Bensa, Sidama, Ethiopia",      notes: "Blueberry · Bergamot · Lavender",           price: 28, weight: "200g", drawn: "images/drawn-alo-village.jpg",        photo: "images/beans/alo-village.jpg" },
  "quebraditas":        { name: "Quebraditas",        type: "Filter · Limited", origin: "Huila, Colombia",      notes: "Watermelon · Lychee · Roselle",             price: 38, weight: "150g", drawn: "images/drawn-quebraditas.jpg",        photo: "images/beans/quebraditas.jpg" },
  "el-alcanfor":        { name: "El Alcanfor",        type: "Filter",   origin: "San Ignacio, Cajamarca, Peru", notes: "Yellow Plums · Dried Fig · Red Tea",        price: 28, weight: "200g", drawn: "images/drawn-el-alcanfor.jpg",        photo: "images/beans/el-alcanfor.jpg" },
  "planadas-filter":    { name: "Planadas Orquidea",  type: "Filter",   origin: "Planadas, Tolima, Colombia",   notes: "Red Dates · Raisins · Honey",               price: 22, weight: "200g", drawn: "images/drawn-planadas-filter.jpg",   photo: "images/beans/planadas-filter.jpg" },
  "la-esmeralda":       { name: "La Esmeralda",       type: "Filter",   origin: "Huila, Colombia",              notes: "Tropical Fruits · Jasmine · Wild Honey",    price: 38, weight: "150g", drawn: "images/drawn-la-esmeralda.jpg",      photo: "images/beans/la-esmeralda.jpg" },
  "alo-mosto":          { name: "Alo Mosto",          type: "Filter",   origin: "Bensa, Sidama, Ethiopia",      notes: "Muscat Grape · Panela · Mango",             price: 35, weight: "150g", drawn: "images/drawn-alo-mosto.jpg",          photo: "images/beans/alo-mosto.jpg" },
  "anaya-estate":       { name: "Finca Anaya Estate", type: "Filter",   origin: "Huila, Colombia",              notes: "Guava · Passionfruit · Pineapple",          price: 28, weight: "200g", drawn: "images/drawn-anaya-estate.jpg",      photo: "images/beans/anaya-estate.jpg" },
  "kiamwangi-filter":   { name: "Kiamwangi AB",       type: "Filter",   origin: "Nyeri County, Kenya",          notes: "Floral · Blackcurrant · Citrus",            price: 26, weight: "200g", drawn: "images/drawn-kiamwangi-filter.jpg",  photo: "images/beans/kiamwangi-filter.jpg" },
  "mungaria":           { name: "Mung'aria",          type: "Filter",   origin: "Central Kenya",                notes: "Passionfruit · Pineapple · Forest Berries", price: 26, weight: "200g", drawn: "images/drawn-mungaria.jpg",           photo: "images/beans/mungaria.jpg" },
  "kirigo-ultra":       { name: "Kirigo Ultra",       type: "Filter",   origin: "Nyeri County, Kenya",          notes: "Mixed Berries · Champagne Grape · Papaya",  price: 32, weight: "150g", drawn: "images/drawn-kirigo-ultra.jpg",      photo: "images/beans/kirigo-ultra.jpg" },
  "kermachi-gesha":     { name: "Kermachi Gesha",     type: "Filter · Limited", origin: "Bench Sheko, Ethiopia",notes: "Blackcurrants · Strawberry · Chrysanthemum",price: 38, weight: "150g", drawn: "images/drawn-kermachi-gesha.jpg",    photo: "images/beans/kermachi-gesha.jpg" },
};

// Instagram link used for "Check availability" on out-of-stock beans.
window.PILLARS_IG = "https://instagram.com/pillars.sg";

// Fallback image when a bean has no drawn sketch yet (uses its product photo).
window.PILLARS_DRAWN_FALLBACK = function (id) {
  var b = window.PILLARS_BEANS[id];
  return (b && b.photo) || "images/hero.jpg";
};
