/* Pillars Coffee V2 — JS */

// ── Nav state ──────────────────────────────
const header = document.querySelector('header');
function updateNav(){
  if(!header) return;
  const isTop = window.scrollY < 60;
  header.classList.toggle('hero-top', isTop);
  header.classList.toggle('scrolled', !isTop);
}
if(header){
  window.addEventListener('scroll', updateNav, { passive:true });
  updateNav();
}

// ── Hero entrance ──────────────────────────
window.addEventListener('load', () => {
  setTimeout(() => {
    document.querySelector('.hero-inner')?.classList.add('loaded');
  }, 100);
});

// ── Mobile menu ────────────────────────────
function openMenu(){
  document.getElementById('mobileMenu')?.classList.add('active');
  document.getElementById('mobileOverlay')?.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeMenu(){
  document.getElementById('mobileMenu')?.classList.remove('active');
  document.getElementById('mobileOverlay')?.classList.remove('active');
  document.body.style.overflow = '';
}
document.getElementById('menuToggle')?.addEventListener('click', openMenu);
document.getElementById('closeToggle')?.addEventListener('click', closeMenu);
document.getElementById('mobileOverlay')?.addEventListener('click', closeMenu);

// ── Scroll reveal ──────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if(e.isIntersecting){
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold:0.08 });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right')
  .forEach(el => revealObserver.observe(el));
