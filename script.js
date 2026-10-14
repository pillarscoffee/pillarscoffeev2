/* Pillars Coffee — interactions */
(function(){
  const nav = document.querySelector('.nav');
  const isHeroPage = nav && nav.dataset.hero === 'true';

  function onScroll(){
    if(!nav) return;
    const past = window.scrollY > 40;
    if(isHeroPage){
      nav.classList.toggle('transparent', !past);
      nav.classList.toggle('solid', past);
    } else {
      nav.classList.add('solid');
    }
  }
  if(nav){
    if(isHeroPage){ nav.classList.add('transparent'); } else { nav.classList.add('solid'); }
    window.addEventListener('scroll', onScroll, {passive:true});
    onScroll();
  }

  // hero entrance
  window.addEventListener('load', ()=>{
    setTimeout(()=>document.querySelector('.hero__inner')?.classList.add('in'), 120);
  });

  // drawer
  const drawer = document.getElementById('drawer');
  const scrim  = document.getElementById('scrim');
  const openBtn = document.getElementById('burger');
  const closeBtn = document.getElementById('drawerClose');
  function open(){ drawer?.classList.add('open'); scrim?.classList.add('open'); document.body.style.overflow='hidden'; }
  function close(){ drawer?.classList.remove('open'); scrim?.classList.remove('open'); document.body.style.overflow=''; }
  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  scrim?.addEventListener('click', close);

  // reveal — fires as soon as an element edges into view (rootMargin),
  // and never leaves content hidden if the observer is unsupported.
  const revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold:0, rootMargin:'0px 0px -8% 0px' });
    revealEls.forEach(el=>io.observe(el));
    // safety net: if anything is still hidden after 3s (e.g. tall off-screen
    // sections the observer missed), force them visible.
    setTimeout(()=>{ revealEls.forEach(el=>el.classList.add('in')); }, 3000);
  } else {
    revealEls.forEach(el=>el.classList.add('in'));
  }
})();

/* ============================================================
   Meta Pixel + cookie notice (advertising / retargeting)
   - Loads site-wide from this one file; no duplication.
   - Subtle "implied consent" model: the Pixel tracks on page load by
     default. A slim notice bar informs the visitor (not blocking); it
     can be dismissed, and a "Cookie Settings" footer link lets anyone
     OPT OUT, which stops the Pixel on future loads. Opting out is
     remembered. The <noscript> image is omitted on purpose.
   - Touches nothing else: no design, cart, or checkout changes.
============================================================ */
(function () {
  "use strict";
  var PIXEL_ID = "1347321530632453";
  var OPTOUT_KEY = "pillars_ads_optout_v1";   // "1" = opted out
  var SEEN_KEY   = "pillars_cookie_seen_v1";  // "1" = notice dismissed

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var optedOut = get(OPTOUT_KEY) === "1";

  // The exact Meta Pixel base code. Fires on load unless the visitor opted out.
  var pixelStarted = false; // guard: PageView can only ever fire once per page
  function loadPixel() {
    if (pixelStarted || window.fbq) return; // never init / PageView twice
    pixelStarted = true;
    // --- Meta Pixel base code (standard snippet) ---
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    // Standard init + a single standard PageView (NOT trackCustom).
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    // The <noscript> pixel image is intentionally omitted.
  }

  // Track by default, unless the visitor has opted out.
  if (!optedOut) loadPixel();

  // --- slim notice bar (informational; shown once until dismissed) ---
  function showNotice() {
    if (document.getElementById('cc-banner')) return;
    var bar = document.createElement('div');
    bar.id = 'cc-banner';
    bar.setAttribute('role', 'note');
    bar.setAttribute('aria-label', 'Cookie notice');
    bar.innerHTML =
      '<div class="cc-banner__text">We use cookies for advertising and analytics, including the Meta Pixel. ' +
      '<a href="/privacy.html">Learn more</a>.</div>' +
      '<button type="button" class="cc-x" id="cc-dismiss" aria-label="Dismiss">&times;</button>';
    document.body.appendChild(bar);
    requestAnimationFrame(function(){ bar.classList.add('cc-in'); });
    document.getElementById('cc-dismiss').addEventListener('click', function () {
      set(SEEN_KEY, "1");
      hideBar(bar);
    });
  }
  function hideBar(bar) {
    bar.classList.remove('cc-in');
    setTimeout(function () { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); }, 300);
  }

  // Show the notice once (until dismissed), and never to someone who opted out.
  if (!optedOut && get(SEEN_KEY) !== "1") {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showNotice);
    } else {
      showNotice();
    }
  }

  // Public API for the "Cookie Settings" link: let people opt out or back in.
  window.PillarsConsent = {
    optOut: function () { set(OPTOUT_KEY, "1"); alert("Advertising cookies turned off. This takes effect on your next page load."); },
    optIn:  function () { del(OPTOUT_KEY); alert("Advertising cookies turned on. Thank you."); },
    isOptedOut: function () { return get(OPTOUT_KEY) === "1"; }
  };

  // Add a "Cookie Settings" link to every page footer (one source, site-wide).
  // Any existing link with id footerCookieSettings or openCookieSettings is wired too.
  function wireCookieSettings() {
    // Inject into the footer links row if not already present on this page.
    var linksRow = document.querySelector('.foot .foot__links');
    if (linksRow && !document.getElementById('footerCookieSettings')) {
      var a = document.createElement('a');
      a.href = '#';
      a.id = 'footerCookieSettings';
      a.textContent = 'Cookie Settings';
      linksRow.appendChild(a);
    }
    // Wire any cookie-settings trigger to toggle the advertising opt-out.
    ['footerCookieSettings', 'openCookieSettings'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', function (e) {
          e.preventDefault();
          if (window.PillarsConsent.isOptedOut()) {
            if (confirm("Advertising cookies are currently OFF. Turn them back on?")) window.PillarsConsent.optIn();
          } else {
            if (confirm("Turn OFF advertising cookies (Meta Pixel) for this browser?")) window.PillarsConsent.optOut();
          }
        });
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireCookieSettings);
  } else {
    wireCookieSettings();
  }
})();
