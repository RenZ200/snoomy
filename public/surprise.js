// A full-screen surprise: gift screen, photo story, poem, then the wish with a candle and a little music box.
// All words and photos come from /api/surprise, which stays closed until the date. Moreno previews it at #kejutan.
(() => {
 const STORY_MS=8000,SEEN='snoomy-surprise-seen';
 // The cake is drawn here in Snoomy's outline style, with the mascot sitting on top beside the candle.
 const CAKE=`<svg viewBox="0 0 240 216" aria-hidden="true"><g stroke="#241726" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
<ellipse cx="120" cy="200" rx="112" ry="13" fill="#fffcf5"/>
<rect x="28" y="122" width="184" height="76" rx="14" fill="#E75CA6"/>
<path d="M28 138c0-9 6-16 15-16h154c9 0 15 7 15 16 0 7-5 12-11 12s-11-5-11-11c0 8-6 19-13 19s-13-9-13-19c0 6-5 11-11 11s-11-5-11-11c0 11-6 24-13 24s-13-13-13-24c0 6-5 11-11 11s-11-5-11-11c0 8-6 17-13 17s-13-8-13-17c0 6-5 11-11 11s-16-6-16-17z" fill="#F6F1E4"/>
<rect x="60" y="62" width="120" height="62" rx="12" fill="#93AE6B"/>
<path d="M60 76c0-8 6-14 13-14h94c7 0 13 6 13 14 0 6-4 10-9 10s-10-4-10-10c0 8-5 17-11 17s-11-8-11-17c0 5-4 10-9 10s-9-5-9-10c0 9-5 20-11 20s-11-10-11-20c0 5-4 10-9 10s-9-4-9-10c0 5-4 10-9 10s-9-5-9-10z" fill="#fffcf5"/>
<rect class="candle" x="84" y="20" width="13" height="44" rx="3" fill="#F6F1E4"/>
<path d="M84 34l13-7M84 47l13-7" fill="none" stroke="#E75CA6"/>
</g>
<path class="flame" d="M90.5 -6c7 8 10 13 10 18a10 10 0 0 1-20 0c0-5 3-10 10-18z" fill="#ffb347" stroke="#D6483C" stroke-width="2"/>
<g class="sprinkles" fill="#fffcf5"><circle cx="58" cy="176" r="4"/><circle cx="100" cy="184" r="4"/><circle cx="146" cy="176" r="4"/><circle cx="186" cy="182" r="4"/></g>
<path fill="#fffcf5" d="M120 192c-16-10-9-20 0-13 9-7 16 3 0 13z" transform="translate(0 -12)"/></svg><img src="/mascot.svg" alt="" class="snoomy"><span class="smoke"></span>`;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
 const button=(text,className='')=>{const node=el('button',text,className);node.type='button';return node;};
 const seen=()=>{try{return localStorage.getItem(SEEN)==='1';}catch{return false;}};
 const remember=()=>{try{localStorage.setItem(SEEN,'1');}catch{}};
 let user=null,data=null,root=null,timer=null,index=0,music=null,launch=null;

 async function api(path='',body){
  const response=await fetch(`/api/surprise${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  const result=await response.json().catch(()=>({error:'Server belum merespons. Coba lagi.'}));
  if(!response.ok)throw Error(result.error);
  return result;
 }

 // Soft music box: a slow arpeggio during the story, then Happy Birthday (a public-domain tune) at the end.
 function musicBox(){
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return null;
  const context=new Audio(),out=context.createGain();
  out.gain.value=.5;out.connect(context.destination);
  const note=(frequency,at,length=1.6,gain=.09)=>{
   const tone=context.createOscillator(),shimmer=context.createOscillator(),volume=context.createGain();
   tone.type='sine';shimmer.type='sine';tone.frequency.value=frequency;shimmer.frequency.value=frequency*3;
   volume.gain.setValueAtTime(.0001,at);volume.gain.exponentialRampToValueAtTime(gain,at+.01);volume.gain.exponentialRampToValueAtTime(.0001,at+length);
   const soft=context.createGain();soft.gain.value=.12;
   tone.connect(volume);shimmer.connect(soft).connect(volume);volume.connect(out);
   tone.start(at);shimmer.start(at);tone.stop(at+length+.05);shimmer.stop(at+length+.05);
  };
  const CHORDS=[[261.63,329.63,392,523.25],[220,261.63,329.63,440],[174.61,261.63,349.23,440],[196,293.66,392,493.88]];
  let loop=null,step=0,at=0;
  const tick=()=>{
   while(at<context.currentTime+1){
    const chord=CHORDS[Math.floor(step/8)%4],order=[0,1,2,3,2,1,2,3];
    note(chord[order[step%8]],at);at+=.46;step+=1;
   }
  };
  return {
   start(){context.resume();at=context.currentTime+.1;clearInterval(loop);loop=setInterval(tick,300);tick();},
   stop(){clearInterval(loop);},
   birthday(){
    clearInterval(loop);
    const G=392,A=440,B=493.88,C=523.25,D=587.33,E=659.25,F=698.46,g=783.99;
    const tune=[[G,.5],[G,.5],[A,1],[G,1],[C,1],[B,2],[G,.5],[G,.5],[A,1],[G,1],[D,1],[C,2],[G,.5],[G,.5],[g,1],[E,1],[C,1],[B,1],[A,2],[F,.5],[F,.5],[E,1],[C,1],[D,1],[C,3]];
    let moment=context.currentTime+.3;
    for(const [frequency,beats] of tune){note(frequency,moment,1.9,.11);moment+=beats*.42;}
   },
   muted:false,
   toggle(){this.muted=!this.muted;out.gain.value=this.muted?0:.5;return this.muted;},
   close(){clearInterval(loop);context.close();},
  };
 }

 function close(){
  clearTimeout(timer);music?.close();music=null;root?.remove();root=null;document.body.classList.remove('surprise-on');
  // Moreno's previews must not stop it opening for Cahya on the same device.
  if(!data?.author)remember();
  if(location.hash==='#kejutan')location.hash='#dashboard';
 }
 function frame(){
  root?.remove();
  root=el('div',null,'surprise');root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Kejutan ulang tahun');
  const shut=button('×','surprise-close');shut.setAttribute('aria-label','Tutup');shut.addEventListener('click',close);
  const sound=button('♪','surprise-sound');sound.setAttribute('aria-label','Matikan musik');sound.hidden=true;
  sound.addEventListener('click',()=>{const muted=music?.toggle();sound.classList.toggle('muted',!!muted);sound.setAttribute('aria-label',muted?'Nyalakan musik':'Matikan musik');});
  const stage=el('div',null,'surprise-stage');
  root.append(stage,sound,shut);
  document.body.append(root);document.body.classList.add('surprise-on');
  return stage;
 }
 const show=(stage,...nodes)=>{stage.replaceChildren(...nodes);};
 const sparkles=()=>{const sky=el('div',null,'surprise-sky');sky.setAttribute('aria-hidden','true');for(let i=0;i<26;i++){const star=el('span','✦');star.style.left=`${Math.random()*100}%`;star.style.top=`${Math.random()*100}%`;star.style.animationDelay=`${Math.random()*4}s`;star.style.fontSize=`${8+Math.random()*14}px`;sky.append(star);}return sky;};

 function gift(stage){
  const {text}=data,open=button(text.openLabel||'Buka ♡','surprise-open-gift');
  show(stage,sparkles(),Object.assign(el('div',null,'surprise-gift'),{}),);
  const box=stage.querySelector('.surprise-gift');
  box.append(el('p','🎁','surprise-box'),el('h1',text.greeting),el('p',text.intro),open);
  open.addEventListener('click',()=>{if(data.text.song&&window.SnoomyYouTube)song(stage);else begin(stage,musicBox());});
  open.focus();
 }

 function begin(stage,player){
  music=player;music?.start();root.querySelector('.surprise-sound').hidden=!music;
  index=0;story(stage);
 }
 // The song plays in a small YouTube player. Android starts it from the tap on Buka; iPhone needs a tap on the
 // player itself. Once it plays the story begins and the player shrinks to a corner. Errors fall back to the music box.
 function song(stage){
  const YT=window.SnoomyYouTube,{videoId,title}=data.text.song;
  const box=el('div',null,'surprise-song'),frame=YT.embed(videoId,{autoplay:true,title});
  box.append(frame);root.append(box);
  const skip=button('Lanjut tanpa lagu','secondary');
  const prompt=el('div',null,'surprise-gift surprise-song-prompt');
  prompt.append(el('h1','Putar lagunya dulu ya ♡'),el('p',title),el('p','Kalau belum jalan, tekan ▶ di video.','surprise-hint'),skip);
  show(stage,sparkles(),prompt);
  let started=false;
  const drop=()=>{player.destroy();box.remove();};
  const go=()=>{
   if(started)return;started=true;box.classList.add('mini');
   document.dispatchEvent(new CustomEvent('snoomy-media',{detail:{source:'surprise'}}));
   begin(stage,{start(){player.command('seekTo',[0,true]);player.command('playVideo');},birthday(){},muted:false,toggle(){this.muted=!this.muted;player.command(this.muted?'mute':'unMute');return this.muted;},close:drop});
  };
  const player=YT.connect(frame,{onState:state=>{if(state===1)go();},onError:()=>{if(started)return;started=true;drop();begin(stage,musicBox());}});
  skip.addEventListener('click',()=>{if(started)return;started=true;drop();begin(stage,musicBox());});
 }

 function story(stage){
  clearTimeout(timer);
  const items=data.items,item=items[index];
  if(!item)return statement(stage);
  const bars=el('div',null,'surprise-bars');bars.setAttribute('aria-hidden','true');
  items.forEach((_,i)=>{const bar=el('span',null,i<index?'done':i===index?'active':'');bar.style.setProperty('--story',`${STORY_MS}ms`);bars.append(bar);});
  const url=`/api/surprise/photo/${item.position}`;
  const backdrop=el('div',null,'surprise-backdrop');backdrop.style.backgroundImage=`url("${url}")`;
  const photo=el('img',null,'surprise-photo');photo.src=url;photo.alt=item.title;
  const words=el('div',null,'surprise-words');
  if(item.date)words.append(el('small',item.date));
  words.append(el('h2',item.title),el('p',item.line));
  const back=button('','surprise-tap back'),next=button('','surprise-tap next');
  back.setAttribute('aria-label','Sebelumnya');next.setAttribute('aria-label','Berikutnya');
  back.addEventListener('click',()=>{index=Math.max(0,index-1);story(stage);});
  next.addEventListener('click',()=>{index+=1;story(stage);});
  show(stage,backdrop,photo,bars,words,back,next);
  // The next photo is fetched early so the story never stops to load.
  if(items[index+1])new Image().src=`/api/surprise/photo/${items[index+1].position}`;
  timer=setTimeout(()=>{index+=1;story(stage);},STORY_MS);
 }

 function statement(stage){
  const line=el('h2',data.text.statement,'surprise-statement'),tap=button('','surprise-tap all');tap.setAttribute('aria-label','Lanjut');
  show(stage,sparkles(),line,tap);
  const go=()=>{clearTimeout(timer);poem(stage);};
  tap.addEventListener('click',go);
  timer=setTimeout(go,5000);
 }

 function poem(stage){
  const body=el('div',null,'surprise-poem');
  const lines=data.text.poem.split('\n');
  lines.forEach((text,i)=>{const row=text?el('p',text):el('br');row.style.setProperty('--line',`${i*(reduced()?0:.55)}s`);body.append(row);});
  const next=button('Lanjut ♡','surprise-next');next.style.setProperty('--line',`${lines.length*(reduced()?0:.55)}s`);
  next.addEventListener('click',()=>wish(stage));
  body.append(next);
  show(stage,sparkles(),body);
  body.scrollTop=0;
 }

 function wish(stage){
  const cake=el('button',null,'surprise-cake');cake.type='button';cake.setAttribute('aria-label','Tiup lilin');
  cake.innerHTML=CAKE;
  const hint=el('p','Tutup mata, buat permintaan, lalu ketuk lilinnya','surprise-hint');
  const title=el('h1',data.text.wish),signed=el('p',data.text.signature,'surprise-signature'),again=button('Lihat lagi','secondary'),done=button('Tutup ♡');
  const actions=el('div',null,'surprise-actions');actions.append(again,done);actions.hidden=true;
  const box=el('div',null,'surprise-wish');box.append(title,cake,hint,signed,actions);
  show(stage,sparkles(),box);
  music?.birthday();hearts(stage,30);
  cake.addEventListener('click',()=>{
   if(cake.classList.contains('out'))return;
   cake.classList.add('out');hint.textContent=data.text.afterWish;actions.hidden=false;hearts(stage,60);
   if(navigator.vibrate)try{navigator.vibrate([40,60,40]);}catch{}
  });
  again.addEventListener('click',()=>{index=0;music?.start();story(stage);});
  done.addEventListener('click',close);
 }

 function hearts(stage,count){
  if(reduced())return;
  for(let i=0;i<count;i++){
   const heart=el('span',i%3?'♥':'✦','surprise-heart');heart.setAttribute('aria-hidden','true');
   heart.style.left=`${Math.random()*100}%`;heart.style.animationDelay=`${Math.random()*2.4}s`;heart.style.fontSize=`${12+Math.random()*22}px`;
   stage.append(heart);setTimeout(()=>heart.remove(),6000);
  }
 }

 // Moreno fills it in once from the pack file; each item is sent on its own to stay under the request limit.
 function setup(){
  const stage=frame(),box=el('div',null,'surprise-gift'),input=el('input');input.type='file';input.accept='application/json,.json';input.setAttribute('aria-label','File kejutan');
  const note=el('p',data?.ready?`Sudah terisi ${data.items.length} foto. Pilih file untuk mengganti isinya.`:'Belum ada isi. Pilih file surprise-pack.json.');
  const preview=button('Lihat pratinjau');preview.hidden=!data?.ready;preview.addEventListener('click',()=>play());
  box.append(el('h1','Siapkan kejutan'),note,input,preview);
  show(stage,box);
  input.addEventListener('change',async()=>{
   try{
    const pack=JSON.parse(await input.files[0].text());
    await api('/clear',{});
    await api('/item',{position:0,meta:pack.text});
    for(const [i,item] of pack.items.entries()){
     note.textContent=`Mengunggah foto ${i+1} dari ${pack.items.length}…`;
     const {photo,...meta}=item;
     await api('/item',{position:i+1,meta,photo});
    }
    data=await api();note.textContent=`Selesai: ${data.items.length} foto tersimpan.`;preview.hidden=false;
   }catch(error){note.textContent=error.message;}
  });
 }
 function play(){gift(frame());}

 function chip(){
  launch?.remove();launch=null;
  if(!data?.show)return;
  const links=document.querySelector('#quick-links');
  if(!links)return;
  launch=button('🎁 Ada kejutan buat kamu ♡','surprise-launch');launch.addEventListener('click',play);
  links.prepend(launch);
 }
 async function check(){
  // Never rebuild the page while it is open, or a tab switch would restart the story.
  if(!user||root)return;
  try{
   data=await api();chip();
   if(location.hash==='#kejutan'&&data.author)return setup();
   if(data.show&&data.autoOpen&&!seen()&&!root)play();
  }catch{}
 }
 document.addEventListener('snoomy-session',event=>{
  const next=event.detail?.user||null;
  if(next===user)return;
  user=next;data=null;launch?.remove();launch=null;
  if(!user&&root)close();
  check();
 });
 addEventListener('hashchange',()=>{if(location.hash==='#kejutan')check();});
 // A phone left open overnight finds the surprise when it comes back at midnight.
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user&&!data?.show)check();});
})();
