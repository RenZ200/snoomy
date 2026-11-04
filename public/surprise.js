// A full-screen surprise: gift screen, photo story, poem, then the wish with a candle and a little music box.
// All words and photos come from /api/surprise, which stays closed until the date. Moreno previews it at #kejutan.
(() => {
 const STORY_MS=8000,SEEN='snoomy-surprise-seen';
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
  clearTimeout(timer);music?.close();music=null;root?.remove();root=null;document.body.classList.remove('surprise-on');remember();
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
  open.addEventListener('click',()=>{
   music=musicBox();music?.start();root.querySelector('.surprise-sound').hidden=!music;
   index=0;story(stage);
  });
  open.focus();
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
  cake.append(el('span',null,'flame'),el('span',null,'candle'),el('span','🎂','cake'));
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
  if(!user)return;
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
