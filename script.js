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

  // reveal
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold:0.1 });
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
})();
