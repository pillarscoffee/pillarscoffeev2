/* Pillars Coffee — shopping cart (delivery only, Phase 1)
 *
 * Self-contained. Loaded site-wide after script.js. It:
 *  - keeps the cart in localStorage
 *  - injects a cart button into the nav and a slide-out cart drawer into the page
 *  - wires every [data-add-to-bag] button on bean pages
 *  - shows live subtotal + the delivery rule (free on 2 or more bags)
 *  - sends the shopper to /checkout.html
 *
 * Prices here are for DISPLAY ONLY. The server re-prices everything at checkout,
 * so a tampered price in the browser can never change what is charged.
 */
(function () {
  "use strict";

  var KEY = "pillars_cart_v1";
  var DELIVERY_FEE = 3.5;
  var FREE_DELIVERY_MIN_QTY = 2;

  /* ---------- storage ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function save(cart) {
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch (e) {}
  }

  var cart = load();

  /* ---------- cart ops ---------- */
  function totalQty() {
    return cart.reduce(function (n, i) {
      return n + i.qty;
    }, 0);
  }
  function subtotal() {
    return cart.reduce(function (n, i) {
      return n + i.price * i.qty;
    }, 0);
  }
  function deliveryFee() {
    return totalQty() >= FREE_DELIVERY_MIN_QTY ? 0 : DELIVERY_FEE;
  }
  function find(id) {
    for (var i = 0; i < cart.length; i++) if (cart[i].id === id) return cart[i];
    return null;
  }
  function addItem(item) {
    var existing = find(item.id);
    if (existing) existing.qty += 1;
    else cart.push({ id: item.id, name: item.name, price: item.price, weight: item.weight, qty: 1 });
    save(cart);
    render();
    openDrawer();
  }
  function setQty(id, qty) {
    var it = find(id);
    if (!it) return;
    it.qty = qty;
    if (it.qty < 1) cart = cart.filter(function (x) { return x.id !== id; });
    save(cart);
    render();
  }

  function money(n) {
    return "$" + n.toFixed(2);
  }

  /* ---------- DOM: build nav button + drawer once ---------- */
  var elDrawer, elScrim, elItems, elSummary, elBadge, elFoot;

  function buildUI() {
    // Cart button in the nav (desktop links area + always-visible on mobile row)
    var navRow = document.querySelector(".nav .nav__row");
    if (navRow && !document.getElementById("cartBtn")) {
      var btn = document.createElement("button");
      btn.id = "cartBtn";
      btn.className = "cartbtn";
      btn.setAttribute("aria-label", "Open bag");
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
        '<path d="M6 8h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z"/>' +
        '<path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>' +
        '<span class="cartbtn__count" id="cartCount">0</span>';
      // place it just before the burger so it sits at the right edge
      var burger = navRow.querySelector(".nav__burger");
      if (burger) navRow.insertBefore(btn, burger);
      else navRow.appendChild(btn);
    }

    // Drawer + scrim
    if (!document.getElementById("cartDrawer")) {
      var scrim = document.createElement("div");
      scrim.className = "cart-scrim";
      scrim.id = "cartScrim";

      var drawer = document.createElement("aside");
      drawer.className = "cart-drawer";
      drawer.id = "cartDrawer";
      drawer.setAttribute("aria-label", "Your bag");
      drawer.innerHTML =
        '<div class="cart-drawer__head">' +
          '<span class="cart-drawer__title">Your bag</span>' +
          '<button class="cart-drawer__close" id="cartClose" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="cart-drawer__items" id="cartItems"></div>' +
        '<div class="cart-drawer__foot" id="cartFoot"></div>';

      document.body.appendChild(scrim);
      document.body.appendChild(drawer);
    }

    elDrawer = document.getElementById("cartDrawer");
    elScrim = document.getElementById("cartScrim");
    elItems = document.getElementById("cartItems");
    elFoot = document.getElementById("cartFoot");
    elBadge = document.getElementById("cartCount");

    document.getElementById("cartBtn") &&
      document.getElementById("cartBtn").addEventListener("click", openDrawer);
    document.getElementById("cartClose") &&
      document.getElementById("cartClose").addEventListener("click", closeDrawer);
    elScrim && elScrim.addEventListener("click", closeDrawer);
  }

  function openDrawer() {
    elDrawer && elDrawer.classList.add("open");
    elScrim && elScrim.classList.add("open");
  }
  function closeDrawer() {
    elDrawer && elDrawer.classList.remove("open");
    elScrim && elScrim.classList.remove("open");
  }

  /* ---------- render ---------- */
  function render() {
    if (elBadge) {
      var q = totalQty();
      elBadge.textContent = q;
      elBadge.style.display = q > 0 ? "flex" : "none";
    }
    if (!elItems || !elFoot) return;

    if (cart.length === 0) {
      elItems.innerHTML = '<p class="cart-empty">Your bag is empty.</p>';
      elFoot.innerHTML =
        '<a href="/beans.html" class="btn btn--line btn--full">Shop Coffee</a>';
      return;
    }

    var rows = cart
      .map(function (i) {
        return (
          '<div class="cart-line">' +
            '<div class="cart-line__info">' +
              '<div class="cart-line__name">' + esc(i.name) + "</div>" +
              '<div class="cart-line__meta">' + esc(i.weight) + " &middot; " + money(i.price) + "</div>" +
            "</div>" +
            '<div class="cart-qty">' +
              '<button class="cart-qty__btn" data-dec="' + esc(i.id) + '" aria-label="Decrease">&minus;</button>' +
              '<span class="cart-qty__n">' + i.qty + "</span>" +
              '<button class="cart-qty__btn" data-inc="' + esc(i.id) + '" aria-label="Increase">+</button>' +
            "</div>" +
            '<div class="cart-line__sum">' + money(i.price * i.qty) + "</div>" +
          "</div>"
        );
      })
      .join("");
    elItems.innerHTML = rows;

    var fee = deliveryFee();
    var feeLabel = fee === 0 ? "FREE" : money(fee);
    var hint =
      fee === 0
        ? "Free delivery applied (2 or more bags)"
        : "Add 1 more bag for free delivery";

    elFoot.innerHTML =
      '<div class="cart-tot">' +
        '<div class="cart-tot__row"><span>Subtotal</span><span>' + money(subtotal()) + "</span></div>" +
        '<div class="cart-tot__row"><span>Delivery</span><span>' + feeLabel + "</span></div>" +
        '<div class="cart-tot__row cart-tot__row--grand"><span>Total</span><span>' +
          money(subtotal() + fee) + "</span></div>" +
      "</div>" +
      '<p class="cart-tot__hint">' + hint + "</p>" +
      '<a href="/checkout.html" class="btn btn--solid btn--full">Checkout</a>' +
      '<p class="cart-tot__note">Standard Delivery &middot; 1 to 3 working days. $3.50, waived on 2 bags or more.</p>';

    // wire qty buttons
    Array.prototype.forEach.call(elItems.querySelectorAll("[data-inc]"), function (b) {
      b.addEventListener("click", function () {
        var it = find(b.getAttribute("data-inc"));
        if (it) setQty(it.id, it.qty + 1);
      });
    });
    Array.prototype.forEach.call(elItems.querySelectorAll("[data-dec]"), function (b) {
      b.addEventListener("click", function () {
        var it = find(b.getAttribute("data-dec"));
        if (it) setQty(it.id, it.qty - 1);
      });
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- wire "Add to Bag" buttons ---------- */
  function wireAddButtons() {
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-add-to-bag]"),
      function (b) {
        b.addEventListener("click", function (e) {
          e.preventDefault();
          addItem({
            id: b.getAttribute("data-id"),
            name: b.getAttribute("data-name"),
            price: parseFloat(b.getAttribute("data-price")),
            weight: b.getAttribute("data-weight"),
          });
        });
      }
    );
  }

  /* ---------- expose a tiny API for checkout.html ---------- */
  window.PillarsCart = {
    get: function () { return load(); },
    subtotal: subtotal,
    deliveryFee: deliveryFee,
    totalQty: totalQty,
    clear: function () { cart = []; save(cart); render(); },
  };

  /* ---------- boot ---------- */
  function init() {
    buildUI();
    render();
    wireAddButtons();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
