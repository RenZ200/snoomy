// HyperFrames motion vocabulary: finite entrance, explicit states and staged gestures.
// Website adapter: play on arrival or an explicit tap, never on polling refreshes.
const controllers=new WeakMap();
export function setupNyaaMotion(element,mood){
 controllers.get(element)?.();
 let media;
 const start=()=>{
  if(!window.gsap)return;
  const button=element.querySelector('.nyaa-replay');
  const svg=button.querySelector('svg');
  const tail=svg.querySelector('.nyaa-tail');
  const eyes=svg.querySelector('.nyaa-eyes');
  media=gsap.matchMedia();
  media.add('(prefers-reduced-motion: no-preference)',context=>{
   let timeline;
   context.add('greet',()=>{
    timeline?.revert();
    timeline=gsap.timeline({paused:true,defaults:{ease:'power2.inOut'}});
    timeline.fromTo(svg,{y:7,scale:.95},{y:0,scale:1,duration:.45,ease:'power3.out'},0)
     .fromTo(tail,{rotation:0,svgOrigin:'100 132'},{rotation:mood==='safe'?-12:-7,duration:.25},.22)
     .to(tail,{rotation:7,duration:.3},.47)
     .to(tail,{rotation:0,duration:.3},.77)
     .fromTo(eyes,{scaleY:1,svgOrigin:'70 58'},{scaleY:.12,duration:.1},.6)
     .to(eyes,{scaleY:1,duration:.12},.7)
     .to(svg,{y:mood==='safe'?-3:-1,duration:.2},.85)
     .to(svg,{y:0,duration:.25},1.05);
    timeline.play(0);
   });
   context.greet();
   button.addEventListener('click',context.greet);
   return ()=>button.removeEventListener('click',context.greet);
  });
 };
 if(document.readyState==='complete')start();
 else window.addEventListener('load',start,{once:true});
 controllers.set(element,()=>{window.removeEventListener('load',start);media?.revert();});
}
