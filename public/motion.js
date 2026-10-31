// Decorative motion is progressive enhancement: no content depends on GSAP.
(() => {
 // Sliding nav pill follows the current page. Its motion is a CSS transition, so reduced-motion turns it off.
 const nav=document.querySelector('body > header nav');
 if(nav){
  const pill=document.createElement('span');pill.className='nav-pill';pill.setAttribute('aria-hidden','true');
  nav.prepend(pill);nav.classList.add('has-pill');
  const place=()=>{
   const link=nav.querySelector('a[aria-current=page]');
   pill.hidden=!link;if(!link)return;
   for(const [name,value] of [['--x',link.offsetLeft],['--y',link.offsetTop],['--w',link.offsetWidth],['--h',link.offsetHeight]])pill.style.setProperty(name,`${value}px`);
   requestAnimationFrame(()=>nav.classList.add('pill-ready'));
  };
  place();
  document.addEventListener('snoomy-route',place);
  new ResizeObserver(place).observe(nav);
  document.fonts?.ready.then(place);
 }
 if(!window.gsap)return;
 const media=gsap.matchMedia();
 media.add('(prefers-reduced-motion: no-preference)',context=>{
  const shown=el=>!!el?.getClientRects().length;
  const all=(selector,root=document)=>[...root.querySelectorAll(selector)].filter(shown);
  const inView=el=>{const box=el.getBoundingClientRect();return box.top<innerHeight*.94&&box.bottom>0;};
  const clear='transform,opacity,visibility';
  const settle={opacity:1,x:0,y:0,scale:1,clearProps:clear};
  // CSS hover transitions on transform would fight the tween, so they pause while it runs.
  const hold=items=>{items.forEach(el=>el.classList.add('is-moving'));return ()=>items.forEach(el=>el.classList.remove('is-moving'));};
  let mascotTimeline,pageTimeline;
  // Content below the fold waits for the scroll to reach it.
  const reveal=new IntersectionObserver(entries=>{
   for(const {isIntersecting,target} of entries)if(isIntersecting){
    reveal.unobserve(target);
    gsap.to(target,{...settle,duration:.75,ease:'power3.out',overwrite:true,onComplete:()=>target.classList.remove('is-moving')});
   }
  },{rootMargin:'0px 0px -6% 0px'});
  // Visible items join the page timeline; the rest are handed to the reveal observer.
  const flow=(tl,selector,from,at,vars={})=>{
   const items=all(selector);
   const now=items.filter(inView);
   hold(items);
   if(now.length)tl.fromTo(now,{opacity:0,...from},{...settle,duration:.7,stagger:.06,...vars,onComplete:hold(now)},at);
   for(const el of items)if(!now.includes(el)){gsap.set(el,{opacity:0,...from});reveal.observe(el);}
  };
  // HyperFrames animation skill: spring-pop entrance, finite staggered arrival.
  // The website controls playback; this is not a rendered video composition.
  context.add('mascotEnter',()=>{
   const hero=document.querySelector('.hero-art');
   if(!shown(hero))return;
   mascotTimeline?.revert();
   mascotTimeline=gsap.timeline({defaults:{ease:'back.out(1.7)'}})
    .fromTo(hero.querySelector('.mascot-halo'),{scale:.6,rotation:-50,opacity:0},{scale:1,rotation:0,opacity:1,duration:.9,ease:'power4.out'},0)
    .fromTo(hero.querySelector('img'),{scale:.7,y:44,rotation:-10,opacity:0},{scale:1,y:0,rotation:7,opacity:1,duration:.85},.14)
    .fromTo(hero.querySelector('.spark'),{scale:0,rotation:-180,opacity:0},{scale:1,rotation:0,opacity:1,duration:.7},.4)
    .fromTo(hero.querySelector('.sticker'),{scale:0,rotation:-70,opacity:0},{scale:1,rotation:-9,opacity:1,duration:.8},.5);
  });
  context.add('mascotHello',()=>{
   const hero=document.querySelector('.hero-art');
   if(!shown(hero)||mascotTimeline?.isActive())return;
   gsap.timeline({defaults:{overwrite:'auto'}})
    .fromTo(hero.querySelector('img'),{rotation:7},{keyframes:{rotation:[7,-5,11,4,7]},duration:.9,ease:'power1.inOut'},0)
    .fromTo(hero.querySelector('.spark'),{rotation:0,scale:1},{rotation:180,keyframes:{scale:[1,1.35,1]},duration:.8,ease:'power2.out'},0)
    .fromTo(hero.querySelector('.sticker'),{rotation:-9},{keyframes:{rotation:[-9,8,-9]},duration:.8,ease:'back.out(2)'},.08);
  });
  context.add('weekIn',()=>{
   const tl=gsap.timeline({defaults:{ease:'power4.out'}});
   flow(tl,'.week .day',{y:34},0,{stagger:.05,duration:.75});
   flow(tl,'.week .class-card',{y:14,scale:.92},.25,{stagger:.04,duration:.6,ease:'back.out(1.6)'});
  });
  context.add('tasksIn',()=>{
   const tl=gsap.timeline();
   flow(tl,'#task-list > *',{y:18},0,{stagger:.045,duration:.5,ease:'power3.out'});
  });
  context.add('enter',()=>{
   pageTimeline?.progress(1).kill();
   reveal.disconnect();
   const tl=pageTimeline=gsap.timeline({defaults:{ease:'power4.out',duration:.8}});
   const banner=all('.hero,#calendar>.section-title,#todos>.section-title,#game>.section-title,#watch>.section-title,.gallery-heading,.budget-heading')[0];
   if(banner){
    tl.fromTo(banner,{y:30,scale:.965,opacity:0},{...settle},0);
    const heading=banner.querySelector('h1,h2');
    if(heading)tl.fromTo(heading,{y:40,opacity:0},{...settle,duration:.9},.1);
    const details=all(':scope > div:not(.hero-art) > :not(h1):not(h2), :scope > button, .album-art, #nyaa',banner);
    if(details.length)tl.fromTo(details,{y:18,opacity:0},{...settle,duration:.65,stagger:.06,onComplete:hold(details)},.24);
    if(banner.classList.contains('hero'))tl.add(()=>context.mascotEnter(),.12);
   }
   flow(tl,'.quick-links a',{y:26,scale:.96},.32,{ease:'back.out(1.4)',stagger:.07});
   flow(tl,'.overview > article, #google-calendar',{y:30},.42,{stagger:.08});
   flow(tl,'.calendar-toolbar > *, #calendar > .hint, .task-toolbar > *, .gallery-bar',{y:14},.3,{stagger:.05,duration:.55});
   tl.add(()=>{context.weekIn();context.tasksIn();},.36);
   flow(tl,'.game-bar, .game-table:not([hidden]), .game-empty:not([hidden]), .game-notes',{y:24},.32,{stagger:.07});
   flow(tl,'.watch-form, .watch-bar, .watch-stage, .watch-react',{y:24},.32,{stagger:.07});
   flow(tl,'.gallery-card, .budget-tabs, .budget-tools, .money-grid article, .budget-card',{y:26},.4,{stagger:.06});
  });
  context.add('dialogEnter',dialog=>{
   const parts=all(':scope > form > :not(#fields):not(#budget-fields), #fields > *, #budget-fields > *, :scope > :not(form)',dialog);
   gsap.timeline()
    .fromTo(dialog,{y:26,scale:.94,opacity:0},{y:0,scale:1,opacity:1,duration:.5,ease:'back.out(1.5)',clearProps:clear,overwrite:true})
    .fromTo(parts,{y:10,opacity:0},{y:0,opacity:1,duration:.35,stagger:.035,ease:'power2.out',clearProps:clear},.1);
  });
  context.add('toastIn',toast=>{
   gsap.fromTo(toast,{xPercent:-50,x:0,y:26,scale:.88,opacity:0},{y:0,scale:1,opacity:1,duration:.55,ease:'back.out(1.8)',clearProps:clear,overwrite:true});
  });
  // A small sparkle burst when a task is ticked off.
  context.add('burst',input=>{
   const box=input.getBoundingClientRect();
   gsap.fromTo(input,{scale:.6},{scale:1,duration:.45,ease:'back.out(3)',clearProps:'transform'});
   for(let i=0;i<8;i++){
    const spark=document.createElement('span');
    spark.className=`burst${i%2?' matcha':''}`;spark.textContent='✦';spark.setAttribute('aria-hidden','true');
    document.body.append(spark);
    const angle=Math.PI*2*i/8+Math.random()*.4,reach=30+Math.random()*22;
    gsap.set(spark,{left:box.left+box.width/2,top:box.top+box.height/2,xPercent:-50,yPercent:-50});
    gsap.timeline({onComplete:()=>spark.remove()})
     .fromTo(spark,{scale:0,rotation:0},{x:Math.cos(angle)*reach,y:Math.sin(angle)*reach,scale:1,rotation:120,duration:.45,ease:'power3.out'})
     .to(spark,{opacity:0,scale:.3,duration:.3,ease:'power1.in'},'-=.12');
   }
  });
  context.add('pulseToday',()=>{
   const today=document.querySelector('.week .day.current');
   if(shown(today))gsap.fromTo(today,{scale:1},{keyframes:{scale:[1,1.04,1]},duration:.6,delay:.35,ease:'power2.inOut',clearProps:'transform',overwrite:true});
  });

  context.enter();
  const onRoute=()=>context.enter();
  const hero=document.querySelector('.hero-art');
  hero?.addEventListener('pointerenter',context.mascotHello);
  document.addEventListener('snoomy-route',onRoute);
  const onClick=event=>{
   const check=event.target.closest?.('input[data-action=check-task]');
   if(check?.checked)context.burst(check);
   if(event.target.closest?.('[data-filter]'))queueMicrotask(context.tasksIn);
   if(event.target.closest?.('#calendar-today'))context.pulseToday();
  };
  document.addEventListener('click',onClick);
  // Lists filled by the first data load get the same entrance; later 10-second refreshes stay still.
  const firstFill=new MutationObserver(records=>{
   for(const {target,removedNodes} of records){
    if(removedNodes.length||!target.children.length)continue;
    if(target.id==='week')context.weekIn();else context.tasksIn();
   }
  });
  for(const list of document.querySelectorAll('#week, #task-list'))firstFill.observe(list,{childList:true});
  const observer=new MutationObserver(records=>{
   for(const {target} of records){
    if(target.id==='toast'){if(!target.hidden)context.toastIn(target);}
    else if(target.open)context.dialogEnter(target);
   }
  });
  document.querySelectorAll('dialog').forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['open']}));
  const toast=document.querySelector('#toast');
  if(toast)observer.observe(toast,{attributes:true,attributeFilter:['hidden']});
  return ()=>{
   observer.disconnect();firstFill.disconnect();reveal.disconnect();
   document.removeEventListener('snoomy-route',onRoute);document.removeEventListener('click',onClick);
   hero?.removeEventListener('pointerenter',context.mascotHello);
   document.querySelectorAll('.burst').forEach(spark=>spark.remove());
  };
 });
})();
