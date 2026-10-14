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
   Meta Pixel + consent (advertising / retargeting)
   - Loads site-wide from this one file; no duplication.
   - The Pixel (base code + PageView + noscript image) only fires
     AFTER the visitor clicks Accept. The choice is remembered so the
     banner shows once. Declining fires nothing.
   - Touches nothing else: no design, cart, or checkout changes.
============================================================ */
(function () {
  "use strict";
  var PIXEL_ID = "1347321530632453";
  var KEY = "pillars_consent_v1"; // "granted" | "denied"

  function readConsent() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function saveConsent(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  // The exact Meta Pixel base code, run only when consent is granted.
  function loadPixel() {
    if (window.fbq) return; // never init twice
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
    // The <noscript> pixel image is intentionally OMITTED: it fires on load when
    // JavaScript is disabled, which cannot be consent-gated. Leaving it out keeps
    // all tracking strictly behind consent.
  }

  // --- consent banner (built in JS so no HTML page is touched) ---
  function showBanner() {
    if (document.getElementById('cc-banner')) return;
    var bar = document.createElement('div');
    bar.id = 'cc-banner';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML =
      '<div class="cc-banner__text">We use cookies for advertising and analytics, including the Meta Pixel, to understand visits and show relevant ads. See our ' +
      '<a href="/privacy.html">Privacy Policy</a>.</div>' +
      '<div class="cc-banner__btns">' +
        '<button type="button" class="cc-btn cc-btn--line" id="cc-decline">Decline</button>' +
        '<button type="button" class="cc-btn cc-btn--solid" id="cc-accept">Accept</button>' +
      '</div>';
    document.body.appendChild(bar);
    // slight delay so it slides in rather than flashing
    requestAnimationFrame(function(){ bar.classList.add('cc-in'); });

    document.getElementById('cc-accept').addEventListener('click', function () {
      saveConsent('granted');
      hideBanner(bar);
      loadPixel();
    });
    document.getElementById('cc-decline').addEventListener('click', function () {
      saveConsent('denied');
      hideBanner(bar);
      // nothing loads
    });
  }
  function hideBanner(bar) {
    bar.classList.remove('cc-in');
    setTimeout(function () { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); }, 300);
  }

  // --- decide on each page load ---
  var consent = readConsent();
  if (consent === 'granted') {
    loadPixel();            // returning visitor who accepted: track, no banner
  } else if (consent === 'denied') {
    /* do nothing */        // respected their decline
  } else {
    // first visit: ask. Run after DOM is ready so body exists.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showBanner);
    } else {
      showBanner();
    }
  }

  // Public API: reopen the banner so visitors can change / withdraw consent.
  window.PillarsConsent = {
    reset: function () { saveConsent(''); try{localStorage.removeItem(KEY);}catch(e){} showBanner(); },
    status: function () { return readConsent(); }
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
    // Wire any cookie-settings trigger on the page to reopen the banner.
    ['footerCookieSettings', 'openCookieSettings'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', function (e) {
          e.preventDefault();
          window.PillarsConsent.reset();
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
