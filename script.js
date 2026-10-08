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
