// Decorative motion is progressive enhancement: no content depends on GSAP.
(() => {
 if(!window.gsap)return;
 const media=gsap.matchMedia();
 media.add('(prefers-reduced-motion: no-preference)',context=>{
  const visible=elements=>[...elements].filter(el=>el.getClientRects().length);
  context.add('enter',()=>{
   const targets=visible(document.querySelectorAll('.hero > div,.quick-links,.overview > article,.budget-heading,.budget-tabs,#calendar > .section-title,#todos > .section-title'));
   if(!targets.length)return;
   gsap.fromTo(targets,{y:16,opacity:.3},{y:0,opacity:1,duration:.55,stagger:.055,ease:'power3.out',clearProps:'transform,opacity',overwrite:true});
  });
  context.add('dialogEnter',element=>{
   gsap.fromTo(element,{y:12,opacity:.5},{y:0,opacity:1,duration:.25,ease:'power2.out',clearProps:'transform,opacity',overwrite:true});
  });
  context.add('mascotHello',()=>{
   const mascot=document.querySelector('.hero-art img');
   if(mascot&&mascot.getClientRects().length)gsap.fromTo(mascot,{rotation:3},{rotation:7,duration:.6,ease:'back.out(2)',overwrite:true});
  });
  context.add('budgetEnter',event=>{
   if(!event.target.closest('[data-budget-tab]'))return;
   const cat=document.querySelector('#nyaa svg');
   if(cat)gsap.fromTo(cat,{y:5,rotation:-3},{y:0,rotation:0,duration:.4,ease:'power2.out',clearProps:'transform',overwrite:true});
  });
  context.enter();
  const onRoute=()=>context.enter();
  const hero=document.querySelector('.hero-art');
  hero?.addEventListener('pointerenter',context.mascotHello);
  document.addEventListener('snoomy-route',onRoute);
  document.addEventListener('click',context.budgetEnter);
  const observer=new MutationObserver(records=>{
   for(const {target,attributeName} of records)if(attributeName==='open'&&target.open)context.dialogEnter(target);
  });
  document.querySelectorAll('dialog').forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['open']}));
  return ()=>{
   observer.disconnect();document.removeEventListener('snoomy-route',onRoute);
   document.removeEventListener('click',context.budgetEnter);
   hero?.removeEventListener('pointerenter',context.mascotHello);
  };
 });
})();
