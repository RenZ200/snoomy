// Keep the document (and music player) alive while switching workspaces.
(() => {
 const main=document.querySelector('main'),nav=document.querySelector('header nav');
 let frame;
 const home=['dashboard','overview','quick-links','google-calendar'];
 function route(event){
  const hash=location.hash.slice(1)||'dashboard';
  const page=['calendar','todos','budgeting','gallery'].includes(hash)?hash:'dashboard';
  document.body.dataset.view=page;
  document.body.classList.toggle('budgeting-mode',page==='budgeting');
  for(const section of main.children){
   if(section.tagName==='FOOTER'){section.hidden=page==='budgeting';continue;}
   if(section.id==='budget-page-frame')continue;
   section.hidden=page==='dashboard'?!home.includes(section.id):section.id!==page;
  }
  if(page==='budgeting'&&!frame){
   frame=document.createElement('iframe');frame.id='budget-page-frame';
   frame.title='Budgeting Moreno dan Cahya';frame.src='/budgeting.html?embedded=1';
   main.append(frame);
  }
  if(frame)frame.hidden=page!=='budgeting';
  document.body.classList.toggle('budget-modal-open',page==='budgeting'&&!!frame?.contentDocument?.querySelector('dialog[open]'));
  nav.querySelectorAll('a').forEach(link=>{
   if(link.hash==='#'+page)link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
  });
  window.scrollTo({top:0,behavior:'instant'});
  if(hash==='google-calendar')document.querySelector('#google-calendar').scrollIntoView({block:'start',behavior:'instant'});
  if(event){main.tabIndex=-1;main.focus({preventScroll:true});}
  document.dispatchEvent(new CustomEvent('snoomy-route',{detail:{page}}));
 }
 const header=document.querySelector('body > header');
 new ResizeObserver(()=>document.documentElement.style.setProperty('--header-height',`${header.offsetHeight}px`)).observe(header);
 window.addEventListener('hashchange',route);route();
 document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();main.tabIndex=-1;main.focus();});
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame?.contentWindow||event.data?.type!=='snoomy-modal')return;
  document.body.classList.toggle('budget-modal-open',document.body.dataset.view==='budgeting'&&event.data.open===true);
 });
 const calendar=document.querySelector('.calendar-scroll');
 document.querySelectorAll('[data-calendar-step]').forEach(button=>button.addEventListener('click',()=>{
  const day=calendar.querySelector('.day');
  if(day)calendar.scrollBy({left:day.getBoundingClientRect().width*Number(button.dataset.calendarStep),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }));
 document.querySelector('#calendar-today')?.addEventListener('click',()=>{
  const day=calendar.querySelector('.day.current');
  if(day)calendar.scrollTo({left:day.offsetLeft-calendar.querySelector('.day').offsetLeft,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });
})();
