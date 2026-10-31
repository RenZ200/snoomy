// Nonton bareng: one shared YouTube video kept in step through the server.
// The server holds where the video was at a moment in time; each phone seeks to that shared clock.
(() => {
 const $=s=>document.querySelector(s);
 const section=$('#watch'),YT=window.SnoomyYouTube;
 if(!section||!YT)return;
 const stage=$('#watch-player'),statusLine=$('#watch-status'),partnerLine=$('#watch-partner'),hint=$('#watch-hint'),bubbles=$('#watch-reactions');
 let user=null,state=null,version=-1,offset=0,player=null,mounted=null,quietUntil=0,timer=null,lastReaction=null,sample=null,wanted=0,busy=false;
 const onPage=()=>document.body.dataset.view==='watch';
 const now=()=>Date.now()+offset;
 const expected=()=>state?.videoId?state.position+(state.playing?Math.max(0,(now()-state.updatedAt)/1000):0):0;
 const clock=seconds=>{const s=Math.max(0,Math.floor(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
 const notify=message=>window.toast?window.toast(message):alert(message);
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};

 async function api(body){
  const sent=Date.now();
  const response=await fetch('/api/watch',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const data=await response.json().catch(()=>({error:'Server belum merespons. Coba lagi.'}));
  if(!response.ok){const error=Error(data.error);error.status=response.status;throw error;}
  // Estimate the server clock so both phones agree on "now".
  offset=data.now-(sent+Date.now())/2;
  return data;
 }

 function mount(){
  player?.destroy();player=null;sample=null;
  mounted=state.videoId;
  const frame=YT.embed(state.videoId,{start:expected(),title:`Nonton bareng: ${state.title||'video YouTube'}`});
  stage.replaceChildren(frame);
  player=YT.connect(frame,{
   onReady:()=>{quietUntil=Date.now()+2000;apply(true);},
   onState:local,
   onTime:time=>{
    // A sudden jump that we did not cause means someone dragged the progress bar.
    const at=Date.now();
    if(sample&&at>quietUntil&&state?.videoId){
     const predicted=sample.time+(player.state===1?(at-sample.at)/1000:0);
     if(Math.abs(time-predicted)>2.5)send({action:'seek',position:time},true);
    }
    sample={time,at};
    if(player.state===1)hint.hidden=true;
   },
   onError:code=>{
    statusLine.replaceChildren(el('span',YT.errorText(code)+' '),Object.assign(el('a','Buka di YouTube'),{href:YT.watchUrl(mounted),target:'_blank',rel:'noopener noreferrer'}));
   },
  });
  window.snoomySound?.play('pop');
 }

 // Bring this phone's player to the shared position and play state.
 function apply(force=false){
  if(!player?.ready||!state?.videoId)return;
  const target=expected();
  if(force||Math.abs(player.time-target)>2){quietUntil=Date.now()+1500;player.command('seekTo',[target,true]);}
  if(state.playing&&player.state!==1&&player.state!==3){quietUntil=Date.now()+1500;player.command('playVideo');wanted=wanted||Date.now();}
  if(!state.playing&&player.state===1){quietUntil=Date.now()+1500;player.command('pauseVideo');}
  if(!state.playing)wanted=0;
  // Some phones block playback until someone taps the video itself.
  hint.hidden=!(state.playing&&wanted&&Date.now()-wanted>3000&&player.state!==1);
 }
 function local(playerState){
  if(playerState===1){wanted=0;hint.hidden=true;document.dispatchEvent(new CustomEvent('snoomy-media',{detail:{source:'watch'}}));}
  if(Date.now()<quietUntil||!state?.videoId)return;
  if(playerState===1&&!state.playing)send({action:'play',position:player.time},true);
  else if(playerState===2&&state.playing)send({action:'pause',position:player.time},true);
  else if(playerState===0&&state.playing)send({action:'pause',position:player.duration||player.time},true);
 }

 function render(){
  const partner=state.partner?.name||'Pasangan';
  partnerLine.textContent=state.partner?.online?`${partner} ikut nonton ♡`:`${partner} belum buka halaman ini`;
  partnerLine.classList.toggle('online',!!state.partner?.online);
  section.dataset.state=state.videoId?'video':'empty';
  $('#watch-title').textContent=state.videoId?state.title:'';
  $('#watch-clear').hidden=!state.videoId;
  $('#watch-sync').hidden=!state.videoId;
  if(!state.videoId){
   player?.destroy();player=null;mounted=null;
   if(!stage.querySelector('.watch-empty'))stage.replaceChildren($('#watch-empty-template').content.cloneNode(true));
   statusLine.textContent='Tempel link YouTube di atas untuk mulai.';hint.hidden=true;
  }else{
   if(mounted!==state.videoId)mount();else apply();
   const who=state.by===state.you?'kamu':state.by;
   statusLine.textContent=state.playing?`Diputar ${who} · ${clock(expected())}`:`Dijeda ${who} di ${clock(state.position)}`;
  }
  const history=$('#watch-history');
  history.replaceChildren(...(state.history||[]).filter(item=>item.videoId!==state.videoId).slice(0,6).map(item=>{
   const button=el('button',item.title||'Video YouTube','watch-again');button.type='button';button.dataset.video=item.videoId;
   return el('li',null,null).appendChild(button).parentNode;
  }));
  $('#watch-history-box').hidden=!history.children.length;
  if(state.reaction&&lastReaction!==null&&state.reaction.id!==lastReaction&&state.reaction.by!==state.you)float(state.reaction.emoji);
  lastReaction=state.reaction?.id??0;
 }

 function float(emoji){
  const bubble=el('span',emoji,'watch-float');
  bubble.style.left=`${15+Math.random()*70}%`;
  bubbles.append(bubble);
  setTimeout(()=>bubble.remove(),2200);
  window.snoomySound?.play('pop');
 }

 async function load(){
  if(!user||busy)return;
  try{
   const next=await api();
   if(busy)return;
   const changed=next.version!==version;
   state=next;version=next.version;
   if(changed)render();
   else{apply();partnerLine.textContent=state.partner?.online?`${state.partner.name} ikut nonton ♡`:`${state.partner.name} belum buka halaman ini`;partnerLine.classList.toggle('online',!!state.partner?.online);if(state.videoId&&state.playing)statusLine.textContent=`Diputar ${state.by===state.you?'kamu':state.by} · ${clock(expected())}`;}
  }catch(error){if(error.status===401)stop();}
 }
 async function send(body,quiet=false){
  busy=true;
  try{state=await api(body);version=state.version;render();}
  catch(error){if(!quiet)notify(error.message);}
  finally{busy=false;}
 }
 function schedule(){
  clearTimeout(timer);
  if(!user||!onPage()||document.hidden)return;
  timer=setTimeout(async()=>{await load();schedule();},1500);
 }
 function stop(){clearTimeout(timer);user=null;}

 $('#watch-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const input=$('#watch-url');
  if(!YT.parse(input.value))return notify('Link YouTube-nya belum dikenali. Tempel link video dari YouTube.');
  const button=event.submitter;button.disabled=true;
  await send({action:'load',url:input.value.trim()});
  button.disabled=false;input.value='';
 });
 $('#watch-history').addEventListener('click',event=>{
  const button=event.target.closest('[data-video]');
  if(button)send({action:'load',url:button.dataset.video});
 });
 $('#watch-sync').addEventListener('click',()=>{load().then(()=>apply(true));});
 $('#watch-clear').addEventListener('click',()=>{if(confirm('Selesai nonton? Video akan ditutup di kedua HP.'))send({action:'clear'});});
 section.querySelector('.watch-react').addEventListener('click',event=>{
  const button=event.target.closest('[data-react]');
  if(!button||!state?.videoId)return;
  float(button.dataset.react);
  send({action:'react',emoji:button.dataset.react},true);
 });

 document.addEventListener('snoomy-session',event=>{
  const next=event.detail?.user||null;
  if(next===user)return;
  stop();user=next;version=-1;
  if(user&&onPage()){load();schedule();}
 });
 document.addEventListener('snoomy-route',event=>{
  if(event.detail.page==='watch'&&user){load();schedule();}
  else{
   clearTimeout(timer);
   // Leaving the page stops the local player; the shared state stays for when you return.
   if(player){player.destroy();player=null;mounted=null;stage.replaceChildren();version=-1;}
  }
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&onPage()){load();}schedule();});
})();
