// Chat: a floating button with an unread badge opens the conversation on any page. While it is open new messages
// arrive every two seconds and are marked read; while it is closed Snoomy checks for new ones every 15 seconds.
(() => {
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
 const box=el('div',null,'snoomy-chat');
 const toggle=el('button',null,'chat-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','chat-panel');
 const badge=el('span','','chat-badge');badge.hidden=true;badge.setAttribute('aria-hidden','true');
 toggle.append(el('span','💬','chat-icon'),el('span','Chat','chat-label'),badge);
 const panel=el('section',null,'chat-panel');panel.id='chat-panel';panel.hidden=true;panel.setAttribute('aria-label','Chat');
 const head=el('div',null,'chat-head');
 const title=el('div');const heading=el('h2','Chat kita');const presence=el('small','','chat-presence');title.append(heading,presence);
 const close=el('button','×','icon chat-close');close.type='button';close.setAttribute('aria-label','Tutup chat');
 // Colek: rings the partner's phone on demand, even when there is nothing new to say.
 const nudge=el('button','👋 Colek','secondary chat-nudge');nudge.type='button';nudge.setAttribute('aria-label','Colek pasangan lewat notifikasi');
 head.append(title,nudge,close);
 const list=el('ol',null,'chat-list');list.setAttribute('aria-live','polite');list.setAttribute('aria-label','Pesan');
 const older=el('button','Muat pesan sebelumnya','secondary chat-older');older.type='button';older.hidden=true;
 const scroller=el('div',null,'chat-scroll');scroller.append(older,list);
 const form=el('form',null,'chat-form');
 const input=el('textarea');input.rows=1;input.maxLength=1000;input.placeholder='Tulis pesan…';input.setAttribute('aria-label','Pesan');input.enterKeyHint='send';
 const send=el('button','Kirim','chat-send');send.type='submit';
 form.append(input,send);
 // Notifications are turned on once per phone in Galeri → Real; the chat points there while they are off.
 const hint=el('a','🔔 Nyalakan notifikasi supaya pesan baru masuk ke HP','chat-hint');hint.href='#real';
 hint.addEventListener('click',()=>openChat(false));
 panel.append(head,hint,scroller,form);
 box.append(panel,toggle);
 document.body.append(box);

 let user=null,messages=[],last=0,partnerRead=0,partner='',more=false,timer=null,busy=false,seenToast=0;
 const isOpen=()=>!panel.hidden;
 const sound=name=>window.snoomySound?.play(name);
 const notify=message=>window.toast?.(message);
 const time=ms=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).format(ms);
 const dayKey=ms=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(ms);
 const dayLabel=ms=>{const key=dayKey(ms),today=dayKey(Date.now()),yesterday=dayKey(Date.now()-86400000);return key===today?'Hari ini':key===yesterday?'Kemarin':new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'numeric',month:'long'}).format(ms);};

 async function api(path='',body){
  const response=await fetch(`/api/chat${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  const data=await response.json().catch(()=>({error:'Server belum merespons. Coba lagi.'}));
  if(!response.ok){const error=Error(data.error);error.status=response.status;throw error;}
  return data;
 }
 function showUnread(count){
  badge.hidden=!count;badge.textContent=count>9?'9+':String(count);
  toggle.setAttribute('aria-label',count?`Chat, ${count} pesan belum dibaca`:'Buka chat');
 }
 function render(){
  const atBottom=scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<60;
  const items=[];let day='';
  const lastMine=[...messages].reverse().find(message=>message.from===user&&!message.pending);
  for(const message of messages){
   const key=dayKey(message.at);
   if(key!==day){day=key;items.push(el('li',dayLabel(message.at),'chat-day'));}
   const mine=message.from===user,item=el('li',null,`chat-message ${mine?'mine':'theirs'}${message.pending?' pending':''}`);
   const bubble=el('p',message.text,'chat-bubble');
   const meta=el('small',message.pending?'Mengirim…':time(message.at),'chat-meta');
   if(mine&&message===lastMine)meta.textContent+=message.id<=partnerRead?' · Dibaca':' · Terkirim';
   item.append(bubble,meta);items.push(item);
  }
  if(!messages.length)items.push(el('li',`Belum ada pesan. Sapa ${partner||'pasanganmu'} duluan ♡`,'chat-empty'));
  list.replaceChildren(...items);
  older.hidden=!more;
  if(atBottom)scroller.scrollTop=scroller.scrollHeight;
 }
 function apply(data,fresh){
  partner=data.partner;partnerRead=data.partnerRead;
  presence.textContent=data.partnerHere?`${data.partner} sedang di chat ♡`:'';
  heading.textContent=`Chat dengan ${data.partner}`;
  if(fresh.length){
   const known=new Set(messages.map(message=>message.id));
   messages=[...messages.filter(message=>!message.pending),...fresh.filter(message=>!known.has(message.id))].sort((a,b)=>a.id-b.id);
   last=Math.max(last,...fresh.map(message=>message.id));
  }
  const incoming=fresh.filter(message=>message.from!==user&&message.id>seenToast);
  if(incoming.length&&seenToast){
   sound('pop');
   if(!isOpen()){const latest=incoming.at(-1);notify(`💬 ${latest.from}: ${latest.text.length>60?`${latest.text.slice(0,57)}…`:latest.text}`);}
  }
  if(incoming.length)seenToast=Math.max(...incoming.map(message=>message.id));
  showUnread(isOpen()?0:data.unread);
  if(isOpen()&&data.unread)api('/read',{upTo:last}).catch(()=>{});
  render();
 }
 async function load(){
  if(!user||busy)return;
  try{
   const data=await api(`?${new URLSearchParams({...(last?{after:last}:{}),...(isOpen()?{open:'1'}:{})})}`);
   if(!last)more=data.more;
   if(!seenToast)seenToast=Math.max(0,...data.messages.map(message=>message.id));
   apply(data,data.messages);
  }catch(error){if(error.status===401)stop();}
 }
 function schedule(){
  clearTimeout(timer);
  if(!user||document.hidden)return;
  timer=setTimeout(async()=>{await load();schedule();},isOpen()?2000:15000);
 }
 function stop(){clearTimeout(timer);user=null;messages=[];last=partnerRead=seenToast=0;showUnread(0);openChat(false);box.hidden=true;}

 function openChat(open=true){
  panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));box.classList.toggle('open',open);
  if(open){
   hint.hidden=!('Notification' in window)||Notification.permission==='granted';
   showUnread(0);render();scroller.scrollTop=scroller.scrollHeight;
   if(matchMedia('(min-width:601px)').matches)input.focus();
   load().then(()=>{if(last)api('/read',{upTo:last}).catch(()=>{});});
  }
  schedule();
 }
 toggle.addEventListener('click',()=>openChat(panel.hidden));
 close.addEventListener('click',()=>{openChat(false);toggle.focus();});
 nudge.addEventListener('click',async()=>{
  nudge.disabled=true;
  try{await api('/nudge',{});sound('pop');notify(`${partner||'Pasangan'} sudah dicolek ♡`);setTimeout(()=>{nudge.disabled=false;},20000);}
  catch(error){notify(error.message);nudge.disabled=false;}
 });
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'){openChat(false);toggle.focus();}});
 older.addEventListener('click',async()=>{
  older.disabled=true;
  try{
   const data=await api(`?before=${messages[0]?.id||1}`);
   const height=scroller.scrollHeight;
   messages=[...data.messages,...messages];more=data.more;render();
   scroller.scrollTop=scroller.scrollHeight-height;
  }catch(error){notify(error.message);}
  finally{older.disabled=false;}
 });
 // The box grows with the text up to a few lines.
 const grow=()=>{input.style.height='auto';input.style.height=`${Math.min(input.scrollHeight,120)}px`;input.style.overflowY=input.scrollHeight>120?'auto':'hidden';};
 input.addEventListener('input',grow);
 input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const text=input.value.trim();
  if(!text||!user)return;
  // The message shows at once; the server's copy replaces it.
  const pending={id:Number.MAX_SAFE_INTEGER,from:user,text,at:Date.now(),pending:true};
  messages.push(pending);input.value='';grow();render();scroller.scrollTop=scroller.scrollHeight;
  busy=true;
  try{
   const data=await api('',{text});
   messages=messages.filter(message=>message!==pending);
   busy=false;apply(data,[data.message]);sound('tap');
  }catch(error){
   messages=messages.filter(message=>message!==pending);input.value=text;grow();render();notify(error.message);
  }finally{busy=false;}
 });

 // Opening Snoomy from a chat notification (or a #chat link) opens the chat on the current page.
 const fromLink=()=>{if(location.hash==='#chat'&&user){history.replaceState(null,'',`#${document.body.dataset.view||'dashboard'}`);openChat(true);}};
 addEventListener('hashchange',fromLink);
 navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='snoomy-open'&&event.data.hash==='#chat'&&user)openChat(true);});
 function session(next){
  if(next===user)return;
  stop();user=next;box.hidden=!user;
  if(user){load().then(fromLink);schedule();}
 }
 document.addEventListener('snoomy-session',event=>session(event.detail?.user||null));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)load();schedule();});
 box.hidden=true;
 // This script loads last, so the first sign-in event may already have passed: ask once who is signed in.
 api().then(data=>{if(!user)session(data.you);}).catch(()=>{});
})();
