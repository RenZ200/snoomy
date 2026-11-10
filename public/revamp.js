// Revamp conveniences: profile menu, scroll memory per tab, quick task, deadline shortcuts and live home tiles.
// Shares app.js's top-level helpers (state, api, refresh, toast, wibDate, openEditor).
(() => {
 const $=s=>document.querySelector(s);
 const partner=()=>state.user==='Moreno'?'Cahya':'Moreno';

 // Profile menu. Signing out used to happen on the first tap; now it is one item among the settings.
 const menu=$('#profile-menu'),profile=$('#profile');
 if(menu&&profile){
  const note=name=>menu.querySelector(`[data-menu-note="${name}"]`);
  const item=name=>menu.querySelector(`[data-menu="${name}"]`);
  const sync=()=>{
   $('#profile-menu-name').textContent=state.user?`Hai, ${state.user} ♡`:'Profil';
   const on=!window.snoomySound?.muted;
   item('sound').setAttribute('aria-pressed',String(on));note('sound').textContent=on?'Nyala':'Mati';
   note('switch').textContent=`Keluar lalu masuk sebagai ${state.user?partner():'profil lain'}`;
   const permission='Notification' in window?Notification.permission:'unsupported';
   note('notify').textContent=permission==='granted'?'Aktif di perangkat ini':permission==='denied'?'Diblokir di pengaturan browser':'Atur pengingat Real dan chat';
   item('install').hidden=$('#install-app')?.hidden!==false;
  };
  const signOut=profile.onclick;
  profile.onclick=()=>{if(!state.user)return signOut?.();sync();menu.showModal();};
  menu.addEventListener('click',event=>{
   if(event.target.closest('[data-menu-close]'))return menu.close();
   const choice=event.target.closest('[data-menu]')?.dataset.menu;
   if(!choice)return;
   if(choice==='sound'){window.snoomySound?.setMuted(!window.snoomySound.muted);sync();window.snoomySound?.play('pop');return;}
   menu.close();
   if(choice==='notify')location.hash='#real';
   if(choice==='install')$('#install-app')?.click();
   if(choice==='switch')signOut?.();
  });
 }

 // navigation.js remembers the scroll position of each tab; tapping the tab you are on goes back to the top.
 const view=()=>document.body.dataset.view||'dashboard';
 document.querySelector('header nav')?.addEventListener('click',event=>{
  const link=event.target.closest('a');
  if(!link||link.getAttribute('aria-current')!=='page')return;
  if(window.snoomyScroll)window.snoomyScroll[view()]=0;
  scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 });

 // Quick task on Beranda: a title is enough, it lands on today for both of you.
 const quick=$('#quick-task');
 quick?.addEventListener('submit',async event=>{
  event.preventDefault();
  const title=quick.title.value.trim();
  if(!title)return;
  quick.classList.add('busy');
  try{
   const known=new Set(state.tasks.map(task=>task.id));
   await api('/tasks','POST',{title,deadline:wibDate(),assignee:'Berdua',priority:'Sedang'});
   quick.reset();await refresh();
   const added=state.tasks.find(task=>!known.has(task.id));
   toast('Tugas masuk untuk hari ini ♡',added&&{label:'Atur',run:()=>openEditor('task',added.id)});
  }catch(error){toast(error.message);}
  finally{quick.classList.remove('busy');}
 });

 // Deadline shortcuts appear whenever the task form is drawn.
 const fields=$('#fields');
 const shift=days=>{const date=new Date(wibDate()+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
 if(fields)new MutationObserver(()=>{
  const input=fields.querySelector('input[name=deadline]');
  if(!input||fields.querySelector('.date-chips'))return;
  const chips=document.createElement('div');chips.className='date-chips';chips.setAttribute('role','group');chips.setAttribute('aria-label','Pilih deadline cepat');
  const mark=()=>chips.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.date===input.value)));
  for(const [label,days] of [['Hari ini',0],['Besok',1],['Lusa',2],['Minggu depan',7]]){
   const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.date=shift(days);
   button.addEventListener('click',()=>{input.value=button.dataset.date;mark();});
   chips.append(button);
  }
  input.after(chips);input.addEventListener('input',mark);mark();
 }).observe(fields,{childList:true});

 // Home tiles for Chat and Real. Chat reuses the unread badge chat.js already keeps; Real asks its light status route.
 const chatHint=$('#ql-chat'),realHint=$('#ql-real');
 const hint=(node,text,attention)=>{if(!node)return;node.textContent=text;node.classList.toggle('attention',!!attention);};
 const readChat=()=>{
  const badge=document.querySelector('.chat-badge');
  const unread=badge&&!badge.hidden?badge.textContent:'';
  hint(chatHint,unread?`${unread} pesan baru dari ${partner()}`:`Ngobrol sama ${partner()}`,unread);
 };
 const watchChat=()=>{
  const badge=document.querySelector('.chat-badge');
  if(!badge)return false;
  new MutationObserver(readChat).observe(badge,{attributes:true,childList:true,characterData:true,subtree:true});
  readChat();return true;
 };
 let realTimer;
 async function readReal(){
  clearTimeout(realTimer);
  if(!state.user||document.hidden)return;
  try{
   const response=await fetch('/api/real/status',{cache:'no-store'});
   if(response.ok){
    const real=await response.json();
    if(!real.started)hint(realHint,'Belum waktunya. Tunggu kejutannya ⚡');
    else if(!real.you)hint(realHint,real.partner?`${partner()} sudah. Giliranmu!`:'Waktunya Real! Ambil foto',true);
    else hint(realHint,real.partner?'Kalian berdua sudah ♡':`Kamu sudah, tunggu ${partner()}`);
   }
  }catch{}
  if(view()==='dashboard')realTimer=setTimeout(readReal,60000);
 }
 // app.js announces the session on every refresh; only a change of person matters here.
 let seen=null,watching=false;
 document.addEventListener('snoomy-session',event=>{
  const user=event.detail?.user||null;
  if(user===seen)return;
  seen=user;
  if(!user)return;
  const watch=()=>{if(!watching)watching=watchChat();};
  watch();setTimeout(watch,1500);
  readChat();readReal();
 });
 document.addEventListener('snoomy-route',event=>{if(event.detail?.page==='dashboard')readReal();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&view()==='dashboard')readReal();});
})();
