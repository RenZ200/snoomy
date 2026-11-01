// Real: once a day at a random moment, a photo with the back and the front camera. The reminder runs on every page;
// the top of Galeri shows today's two posts (yours unlocks your partner's), the camera and the memories strip.
(() => {
 const $=s=>document.querySelector(s);
 const section=$('#real');
 if(!section)return;
 const navLink=document.querySelector('header nav a[href="#gallery"]');
 const alertBox=$('#real-alert'),alertTime=$('#real-alert-time'),camera=$('#real-camera'),video=$('#real-video'),preview=$('#real-preview'),note=$('#real-camera-note');
 const sendForm=$('#real-send'),shootBar=$('#real-shoot'),fallback=$('#real-fallback'),shutter=$('#real-shutter'),dayDialog=$('#real-day');
 const REACTIONS=['😍','😂','🥺','😮','🔥','❤️'];
 // The server refuses bigger photos; these are the decoded sizes the compression aims under.
 const LIMIT={main:690*1024,inset:245*1024,thumb:58*1024};
 const NUDGED='snoomy-real-nudged',DISMISSED='snoomy-real-dismissed';
 let user=null,data=null,status=null,offset=0,timer=null,ticker=null,stream=null,shots=null,swapped=false,busy=false,drawn='';
 const onPage=()=>document.body.dataset.view==='gallery';
 const now=()=>Date.now()+offset;
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
 const notify=message=>window.toast?window.toast(message):alert(message);
 const sound=name=>window.snoomySound?.play(name);
 const buzz=pattern=>{if(navigator.userActivation?.hasBeenActive===false)return;try{navigator.vibrate?.(pattern);}catch{}};
 const remember=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
 const recall=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 const countdown=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
 const span=ms=>{const m=Math.max(1,Math.round(ms/60000));return m<60?`${m} menit`:m<1440?`${Math.round(m/60)} jam`:`${Math.round(m/1440)} hari`;};
 const WINDOW=2*60*1000;
 const onTime=post=>post.late<=(status?.window??WINDOW);
 const lateText=post=>onTime(post)?'Tepat waktu ⚡':`Telat ${span(post.late)}`;
 const partnerOf=name=>name==='Moreno'?'Cahya':'Moreno';
 const timeOf=ms=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).format(ms);
 const dayName=day=>new Intl.DateTimeFormat('id-ID',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`));
 const photoUrl=(post,kind)=>`/api/real/${post.id}/${kind}`;
 const inWindow=()=>status?.started&&now()-status.at<status.window;

 async function api(path='',body){
  const response=await fetch(`/api/real${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  const result=await response.json().catch(()=>({error:'Server belum merespons. Coba lagi.'}));
  if(!response.ok){const error=Error(result.error);error.status=response.status;throw error;}
  if(typeof result.now==='number')offset=result.now-Date.now();
  return result;
 }

 // The reminder: a red dot until you post, and a banner with sound while the two minutes run.
 function track(next){
  const before=status;status=next;
  const pending=next.started&&!next.you;
  navLink?.classList.toggle('has-turn',pending&&!onPage());
  if(pending&&inWindow()&&!onPage()&&recall(DISMISSED)!==next.day)showAlert();
  else alertBox.hidden=true;
  if(pending&&inWindow()&&recall(NUDGED)!==next.day){remember(NUDGED,next.day);sound('turn');buzz([60,80,60]);}
  if(before&&before.day===next.day&&!before.partner&&next.partner)notify(next.you?`${partnerOf(user)} baru posting Real ✨`:`${partnerOf(user)} sudah posting Real. Posting punyamu untuk melihat 🔒`);
  ticking();
 }
 function showAlert(){
  if(alertBox.hidden){alertBox.hidden=false;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)window.gsap?.fromTo(alertBox,{xPercent:-50,x:0,y:-30,opacity:0},{y:0,opacity:1,duration:.5,ease:'back.out(1.8)',clearProps:'transform,opacity'});}
  alertTime.textContent=`${countdown(status.at+status.window-now())} lagi, kamera belakang & depan`;
 }
 // A one-second clock only while the two minutes are running.
 function ticking(){
  clearInterval(ticker);ticker=null;
  if(!inWindow())return;
  ticker=setInterval(()=>{
   if(!inWindow()){clearInterval(ticker);ticker=null;alertBox.hidden=true;if(onPage())renderClock();return;}
   if(!alertBox.hidden)showAlert();
   if(onPage())renderClock();
   if(camera.open)$('#real-camera-timer').textContent=timerText();
  },1000);
 }
 const timerText=()=>!status?.started?'':inWindow()?`⚡ ${countdown(status.at+status.window-now())}`:`Telat ${span(now()-status.at)}`;

 async function poll(){
  if(!user)return;
  try{
   if(onPage()){data=await api();track(summary(data));render();}
   else track(await api('/status'));
  }catch(error){if(error.status===401)stop();}
 }
 const summary=full=>({day:full.day,now:full.now,started:full.started,at:full.at,window:full.window,you:!!full.mine,partner:!!full.theirs});
 function schedule(){
  clearTimeout(timer);
  if(!user||document.hidden)return;
  timer=setTimeout(async()=>{await poll();schedule();},onPage()?8000:20000);
 }
 function stop(){clearTimeout(timer);clearInterval(ticker);user=null;data=status=null;drawn='';alertBox.hidden=true;navLink?.classList.remove('has-turn');}

 // Page
 function renderClock(){
  const clock=$('#real-clock');
  if(!data)return;
  clock.classList.toggle('live',inWindow()&&!data.mine);
  clock.textContent=!data.started?'Belum waktunya. Snoomy akan memberi tahu saat waktunya tiba ⏳'
   :!data.mine&&inWindow()?`⚡ Waktunya Real! ${countdown(data.at+data.window-now())} lagi`
   :!data.mine?`Real hari ini mulai pukul ${timeOf(data.at)}. Telat juga nggak apa-apa, posting sekarang.`
   :!data.theirs?`Kamu sudah posting. Menunggu ${data.partner}…`
   :data.theirs.locked?'':'Real hari ini lengkap ♡';
 }
 function photo(post,owner){
  const box=el('div',null,'real-photo');
  const main=new Image();main.className='real-main';main.decoding='async';
  if(!post.full){
   // Older than the keeping period: only the small combined preview is left.
   main.src=photoUrl(post,'thumb');main.alt=`Real ${owner}, pratinjau`;box.classList.add('archived');box.append(main);return box;
  }
  main.src=photoUrl(post,'main');main.alt=`Real ${owner}: foto besar`;
  const toggle=el('button',null,'real-inset');toggle.type='button';toggle.setAttribute('aria-label','Tukar foto besar dan kecil');
  const inset=new Image();inset.decoding='async';inset.src=photoUrl(post,'inset');inset.alt=`Real ${owner}: foto kecil`;
  toggle.append(inset);
  toggle.addEventListener('click',()=>{[main.src,inset.src]=[inset.src,main.src];[main.alt,inset.alt]=[inset.alt,main.alt];});
  box.append(main,toggle);
  return box;
 }
 function head(name,post){
  const top=el('div',null,'real-card-head');
  top.append(el('span',name[0],`real-avatar ${name==='Moreno'?'matcha':'stroberi'}`),el('strong',name===data.you?'Kamu':name));
  if(post&&!post.locked)top.append(el('small',`${timeOf(post.posted)} · ${lateText(post)}`,onTime(post)?'on-time':''));
  return top;
 }
 function renderMine(){
  const card=$('#real-mine'),post=data.mine;
  card.replaceChildren(head(data.you,post));
  card.classList.toggle('waiting',!post);
  if(!post){
   const cta=el('button',null,'real-cta');cta.type='button';cta.disabled=!data.started;
   cta.append(el('span',null,'real-cta-ring'),el('strong',data.started?'Ambil Real':'Belum waktunya'),el('small',data.started?(inWindow()?'Dua menit, jangan dipikir lama ⚡':'Telat sedikit tetap seru'):'Tunggu pengingat dari Snoomy'));
   cta.addEventListener('click',openCamera);
   card.append(cta);return;
  }
  card.append(photo(post,data.you));
  if(post.caption)card.append(el('p',post.caption,'real-caption'));
  const reactions=Object.entries(post.reactions);
  const foot=el('div',null,'real-card-foot');
  foot.append(el('p',reactions.length?reactions.map(([name,emoji])=>`${name} ${emoji}`).join(' · '):'Belum ada reaksi','real-reacted'),saveButton(post));
  card.append(foot);
 }
 function renderTheirs(){
  const card=$('#real-theirs'),post=data.theirs;
  card.replaceChildren(head(data.partner,post));
  card.classList.toggle('waiting',!post||!!post.locked);
  if(!post){
   card.append(el('div',`${data.partner} belum posting${data.started?'':'. Belum waktunya'}`,'real-empty'));return;
  }
  if(post.locked){
   const lock=el('div',null,'real-locked');
   lock.append(el('span','🔒','real-lock-icon'),el('strong',`${data.partner} sudah posting pukul ${timeOf(post.posted)}`),el('small','Posting Real-mu dulu untuk melihatnya.'));
   card.append(lock);return;
  }
  card.append(photo(post,data.partner));
  if(post.caption)card.append(el('p',post.caption,'real-caption'));
  const bar=el('div',null,'real-react');bar.setAttribute('role','group');bar.setAttribute('aria-label',`Reaksi untuk Real ${data.partner}`);
  const chosen=post.reactions[data.you];
  for(const emoji of REACTIONS){
   const button=el('button',emoji);button.type='button';button.setAttribute('aria-pressed',String(emoji===chosen));
   button.addEventListener('click',()=>react(post,emoji===chosen?'':emoji));
   bar.append(button);
  }
  const foot=el('div',null,'real-card-foot');foot.append(bar,saveButton(post));
  card.append(foot);
 }
 function renderMemories(){
  const box=$('#real-memories'),strip=$('#real-strip');
  box.hidden=!data.memories.length;
  strip.replaceChildren(...data.memories.map(memory=>{
   const tile=el('button',null,'real-tile');tile.type='button';
   tile.setAttribute('aria-label',`Real ${dayName(memory.day)}`);
   const pics=el('span',null,'real-tile-pics');
   for(const name of [data.you,data.partner]){
    const post=memory[name];
    if(post){const img=new Image();img.loading='lazy';img.src=photoUrl(post,'thumb');img.alt='';pics.append(img);}
    else pics.append(el('span','–','real-tile-missing'));
   }
   tile.append(pics,el('small',dayName(memory.day)));
   tile.addEventListener('click',()=>openDay(memory));
   return tile;
  }));
 }
 function render(){
  if(!data)return;
  renderClock();
  // The page refreshes every few seconds; the cards are only rebuilt when something in them changed.
  const sign=JSON.stringify({...data,now:0});
  if(sign===drawn)return;
  drawn=sign;
  const streak=$('#real-streak');streak.hidden=!data.streak;streak.textContent=`🔥 ${data.streak} hari berturut-turut berdua`;
  renderMine();renderTheirs();renderMemories();
 }
 function openDay(memory){
  $('#real-day-title').textContent=`Real ${dayName(memory.day)}`;
  $('#real-day-posts').replaceChildren(...[data.you,data.partner].map(name=>{
   const post=memory[name],card=el('article',null,'real-card');
   card.append(head(name,post));
   if(!post){card.append(el('div',`${name===data.you?'Kamu':name} tidak posting hari itu`,'real-empty'));return card;}
   card.append(photo(post,name));
   if(post.caption)card.append(el('p',post.caption,'real-caption'));
   const reacted=Object.entries(post.reactions);
   if(reacted.length)card.append(el('p',reacted.map(([who,emoji])=>`${who} ${emoji}`).join(' · '),'real-reacted'));
   return card;
  }));
  dayDialog.showModal();
 }
 async function react(post,emoji){
  try{const result=await api(`/${post.id}/react`,{emoji});post.reactions=result.reactions;drawn='';render();if(emoji)sound('pop');}
  catch(error){notify(error.message);}
 }
 async function load(){
  if(!user)return;
  try{data=await api();track(summary(data));render();}
  catch(error){if(error.status===401)stop();else $('#real-clock').textContent='Belum tersambung, mencoba lagi…';}
 }

 // Saving to the shared gallery keeps a Real past the 60 days, as one picture with the small photo in its corner.
 function saveButton(post){
  const button=el('button','Simpan ke galeri','secondary real-save');button.type='button';button.hidden=!post.full;
  button.addEventListener('click',async()=>{
   button.disabled=true;button.textContent='Menyimpan…';
   try{
    const [big,small]=await Promise.all(['main','inset'].map(async kind=>createImageBitmap(await (await fetch(photoUrl(post,kind))).blob())));
    const canvas=compose(big,small,Math.min(1600,big.width));
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));
    const base64=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);});
    const response=await fetch('/api/gallery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:base64,mime:'image/jpeg',key:crypto.randomUUID(),caption:`Real ${post.user} · ${dayName(post.day)}${post.caption?` · ${post.caption}`:''}`.slice(0,180)})});
    if(!response.ok)throw Error((await response.json().catch(()=>({}))).error||'Gagal menyimpan ke galeri.');
    button.textContent='Tersimpan di galeri ♡';notify('Real disimpan ke galeri ♡');
   }catch(error){button.disabled=false;button.textContent='Simpan ke galeri';notify(error.message);}
  });
  return button;
 }
 // One picture: the big photo with the small one in a rounded, framed corner.
 function compose(big,small,width){
  const scale=width/big.width,canvas=document.createElement('canvas');
  canvas.width=Math.round(big.width*scale);canvas.height=Math.round(big.height*scale);
  const c=canvas.getContext('2d');
  c.drawImage(big,0,0,canvas.width,canvas.height);
  const w=Math.round(canvas.width*.3),h=Math.round(w*small.height/small.width),x=Math.round(canvas.width*.04),y=x,r=Math.round(w*.12),border=Math.max(2,Math.round(w*.025));
  c.fillStyle='#fffcf5';c.beginPath();c.roundRect(x-border,y-border,w+border*2,h+border*2,r+border);c.fill();
  c.save();c.beginPath();c.roundRect(x,y,w,h,r);c.clip();c.drawImage(small,x,y,w,h);c.restore();
  return canvas;
 }

 // Camera: the back camera first, then the front one about a second later, like the real thing.
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function stopStream(){stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;}
 async function startStream(facing){
  stopStream();
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1920}},audio:false});
  video.srcObject=stream;video.classList.toggle('mirror',facing==='user');
  await video.play().catch(()=>{});
  for(let i=0;i<60&&!video.videoWidth;i++)await wait(50);
  if(!video.videoWidth)throw Error('Kamera belum siap.');
 }
 function grab(mirror){
  const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
  const c=canvas.getContext('2d');
  if(mirror){c.translate(canvas.width,0);c.scale(-1,1);}
  c.drawImage(video,0,0);
  return canvas;
 }
 function stage(name){
  camera.dataset.stage=name;
  video.hidden=name!=='shoot';preview.hidden=name!=='preview';
  shootBar.hidden=name!=='shoot';sendForm.hidden=name!=='preview';fallback.hidden=name!=='fallback';
 }
 async function openCamera(){
  if(!data?.started||data.mine||camera.open)return;
  shots=null;swapped=false;$('#real-caption').value='';shutter.disabled=true;pickNote();
  $('#real-camera-timer').textContent=timerText();
  stage('shoot');camera.showModal();
  note.textContent='Membuka kamera…';
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('no camera');
   await startStream('environment');
   note.textContent='Kamera belakang dulu, lalu depan.';shutter.disabled=false;
  }catch{stopStream();note.textContent='';stage('fallback');}
 }
 async function shoot(){
  if(shutter.disabled)return;
  shutter.disabled=true;sound('shutter');buzz(15);flash();
  const back=grab(false);
  note.textContent='Sekarang kamera depan… senyum! 😊';
  let front=null;
  try{await startStream('user');await wait(650);flash();sound('shutter');front=grab(true);}catch{}
  stopStream();
  if(!front){shots={back,front:null};pickNote('Kamera depan tidak terbuka. Ambil selfie lewat kamera HP:');stage('fallback');return;}
  shots={back,front};showPreview();
 }
 function flash(){const light=camera.querySelector('.real-flash');light.classList.remove('on');void light.offsetWidth;light.classList.add('on');}
 function showPreview(){
  const [big,small]=swapped?[shots.front,shots.back]:[shots.back,shots.front];
  const [main,inset]=[preview.querySelector('.real-main'),preview.querySelector('.real-inset img')];
  main.src=scaled(big,900).toDataURL('image/jpeg',.85);inset.src=scaled(small,360).toDataURL('image/jpeg',.85);
  note.textContent='Ketuk foto kecil untuk menukar. Siap kirim?';
  stage('preview');
 }
 function scaled(source,side){
  const ratio=Math.min(1,side/Math.max(source.width,source.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(source.width*ratio));canvas.height=Math.max(1,Math.round(source.height*ratio));
  canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
  return canvas;
 }
 // Smaller and softer until the photo fits under the server's limit.
 function encode(source,side,limit){
  for(const [size,quality] of [[side,.82],[side,.7],[side,.58],[side*.8,.6],[side*.6,.6]]){
   const url=scaled(source,size).toDataURL('image/jpeg',quality);
   if((url.length-url.indexOf(',')-1)*.75<=limit)return url;
  }
  throw Error('Fotonya terlalu besar. Coba ambil lagi.');
 }
 async function post(event){
  event.preventDefault();
  if(busy||!shots?.front)return;
  busy=true;$('#real-post').disabled=true;note.textContent='Mengirim…';
  try{
   const [big,small]=swapped?[shots.front,shots.back]:[shots.back,shots.front];
   const result=await api('',{main:encode(big,1280,LIMIT.main),inset:encode(small,560,LIMIT.inset),thumb:encode(compose(big,small,320),320,LIMIT.thumb),caption:$('#real-caption').value});
   camera.close();
   sound('win');buzz(30);
   notify(result.theirs?`Real terkirim ✨ Sekarang lihat punya ${data.partner}!`:'Real terkirim ✨');
   await load();
   if(result.theirs&&window.gsap&&!matchMedia('(prefers-reduced-motion: reduce)').matches)window.gsap.from('#real-theirs .real-photo',{scale:.9,opacity:0,duration:.6,ease:'back.out(1.6)',clearProps:'transform,opacity'});
  }catch(error){note.textContent=error.message;notify(error.message);if(error.status===409){camera.close();load();}}
  finally{busy=false;$('#real-post').disabled=false;}
 }
 // Without a live camera, the two photos come from the phone's own camera app; ticks show which one is done.
 function pickNote(text='Kamera tidak bisa dibuka langsung di sini. Ambil dua foto lewat kamera HP:'){
  fallback.querySelector('p').textContent=text;
  fallback.querySelectorAll('input').forEach(input=>input.closest('label').classList.toggle('done',!!shots?.[input.id==='real-file-back'?'back':'front']));
 }
 async function picked(input,kind){
  const file=input.files?.[0];input.value='';
  if(!file)return;
  try{
   const bitmap=await createImageBitmap(file);
   shots={...shots,[kind]:bitmap};
   if(shots.back&&shots.front)showPreview();
   else pickNote(kind==='back'?'Foto belakang siap. Sekarang selfie-nya:':'Selfie siap. Sekarang foto belakangnya:');
  }catch{notify('Foto itu belum bisa dibaca. Coba foto lain.');}
 }

 shutter.addEventListener('click',shoot);
 preview.querySelector('.real-inset').addEventListener('click',()=>{swapped=!swapped;showPreview();});
 $('#real-retake').addEventListener('click',async()=>{shots=null;swapped=false;stage('shoot');shutter.disabled=true;note.textContent='Membuka kamera…';try{await startStream('environment');note.textContent='Kamera belakang dulu, lalu depan.';shutter.disabled=false;}catch{stopStream();stage('fallback');}});
 sendForm.addEventListener('submit',post);
 $('#real-file-back').addEventListener('change',event=>picked(event.target,'back'));
 $('#real-file-front').addEventListener('change',event=>picked(event.target,'front'));
 camera.querySelector('[data-real-close]').addEventListener('click',()=>camera.close());
 camera.addEventListener('close',()=>{stopStream();shots=null;});
 dayDialog.querySelector('[data-real-day-close]').addEventListener('click',()=>dayDialog.close());
 $('#real-alert-close').addEventListener('click',()=>{alertBox.hidden=true;if(status)remember(DISMISSED,status.day);});
 // The banner's button goes straight to the camera (the tap also lets the browser open it).
 $('#real-alert-go').addEventListener('click',()=>{alertBox.hidden=true;queueMicrotask(()=>load().then(openCamera));});

 document.addEventListener('snoomy-session',event=>{
  const next=event.detail?.user||null;
  if(next===user)return;
  stop();user=next;
  if(user){(onPage()?load():poll());schedule();}
 });
 document.addEventListener('snoomy-route',()=>{
  if(!user)return;
  if(onPage()){alertBox.hidden=true;navLink?.classList.remove('has-turn');load();}
  else if(camera.open)camera.close();
  schedule();
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)poll();schedule();});
})();
