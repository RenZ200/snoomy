// Decorative motion is progressive enhancement: no content depends on GSAP.
(() => {
 if(!window.gsap)return;
 const media=gsap.matchMedia();
 media.add('(prefers-reduced-motion: no-preference)',context=>{
  const visible=elements=>[...elements].filter(el=>el.getClientRects().length);
  let mascotTimeline;
  // HyperFrames animation skill: spring-pop entrance, finite staggered arrival.
  // The website controls playback; this is not a rendered video composition.
  context.add('mascotEnter',()=>{
   const hero=document.querySelector('.hero-art');
   if(!hero?.getClientRects().length)return;
   mascotTimeline?.revert();
   mascotTimeline=gsap.timeline({paused:true,defaults:{ease:'power3.out'}});
   mascotTimeline
    .fromTo(hero.querySelector('.mascot-halo'),{scale:.86,opacity:0},{scale:1,opacity:1,duration:.5},0)
    .fromTo(hero.querySelector('img'),{scale:.88,y:16,rotation:1,opacity:0},{scale:1,y:0,rotation:7,opacity:1,duration:.6},.06)
    .fromTo(hero.querySelector('.spark'),{scale:0,opacity:0},{scale:1,opacity:1,duration:.4},.18)
    .fromTo(hero.querySelector('.sticker'),{scale:.8,y:8,opacity:0},{scale:1,y:0,opacity:1,duration:.45},.24);
   mascotTimeline.play(0);
  });
  context.add('enter',()=>{
   context.mascotEnter();
   const targets=visible(document.querySelectorAll('.hero > div:not(.hero-art),.quick-links,.overview > article,.budget-heading,.budget-tabs,#calendar > .section-title,#todos > .section-title'));
   if(!targets.length)return;
   gsap.fromTo(targets,{y:16,opacity:.3},{y:0,opacity:1,duration:.55,stagger:.055,ease:'power3.out',clearProps:'transform,opacity',overwrite:true});
  });
  context.add('dialogEnter',element=>{
   gsap.fromTo(element,{y:12,opacity:.5},{y:0,opacity:1,duration:.25,ease:'power2.out',clearProps:'transform,opacity',overwrite:true});
  });
  context.add('mascotHello',()=>{
   const mascot=document.querySelector('.hero-art img');
   if(mascot&&mascot.getClientRects().length&&!mascotTimeline?.isActive())gsap.fromTo(mascot,{rotation:3},{rotation:7,duration:.6,ease:'power3.out',overwrite:true});
  });
  context.enter();
  const onRoute=()=>context.enter();
  const hero=document.querySelector('.hero-art');
  hero?.addEventListener('pointerenter',context.mascotHello);
  document.addEventListener('snoomy-route',onRoute);
  const observer=new MutationObserver(records=>{
   for(const {target,attributeName} of records)if(attributeName==='open'&&target.open)context.dialogEnter(target);
  });
  document.querySelectorAll('dialog').forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['open']}));
  return ()=>{
   observer.disconnect();document.removeEventListener('snoomy-route',onRoute);
   hero?.removeEventListener('pointerenter',context.mascotHello);
  };
 });
})();
