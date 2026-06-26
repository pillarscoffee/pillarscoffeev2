/* Pillars Coffee V2 — shared JS */

// Nav scroll border
const header = document.querySelector('header');
if(header){
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();
}

// Mobile menu
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
