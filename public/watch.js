// Nonton bareng: one shared YouTube video kept in step through the server.
// The server holds where the video was at a moment in time; each phone seeks to that shared clock.
(() => {
 const $=s=>document.querySelector(s);
 const section=$('#watch'),YT=window.SnoomyYouTube;
 if(!section||!YT)return;
 const stage=$('#watch-player'),statusLine=$('#watch-status'),partnerLine=$('#watch-partner'),hint=$('#watch-hint'),bubbles=$('#watch-reactions');
 const ENDED=0,PLAYING=1,PAUSED=2,BUFFERING=3;
 let user=null,state=null,version=-1,offset=0,player=null,mounted=null,timer=null,lastReaction=null,busy=false;
 // Sync bookkeeping. Events caused by our own commands are ignored for a moment (quietUntil), and after a seek
 // the player gets time to buffer before its clock is trusted again (settleUntil), so slow phones never loop.
 let quietUntil=0,settleUntil=0,playTriedAt=0,wanted=0,sample=null,previous=-1;
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
  player?.destroy();player=null;sample=null;previous=-1;wanted=0;playTriedAt=0;
  mounted=state.videoId;
  // Starting at the shared position means no seek (and no extra buffering) is needed once it loads.
  const frame=YT.embed(state.videoId,{start:expected(),title:`Nonton bareng: ${state.title||'video YouTube'}`});
  stage.replaceChildren(frame);
  stage.classList.add('loading');
  // The overlay goes as soon as YouTube's own page has loaded, even if the control channel is slow.
  frame.addEventListener('load',()=>stage.classList.remove('loading'),{once:true});
  player=YT.connect(frame,{
   onReady:()=>{stage.classList.remove('loading');apply();},
   onState:local,
   onTime:time=>{
    const at=Date.now(),playing=player.state===PLAYING;
    // A jump we did not cause means someone dragged the progress bar on this phone.
    if(sample&&at>quietUntil&&state?.videoId&&((playing&&at-sample.at<1500)||player.state===PAUSED)){
     const predicted=sample.time+(playing?(at-sample.at)/1000:0);
     if(Math.abs(time-predicted)>3){settleUntil=at+4000;send({action:'seek',position:time},true);}
    }
    sample={time,at};
   },
   onError:code=>{
    stage.classList.remove('loading');
    statusLine.replaceChildren(el('span',YT.errorText(code)+' '),Object.assign(el('a','Buka di YouTube'),{href:YT.watchUrl(mounted),target:'_blank',rel:'noopener noreferrer'}));
   },
  });
  window.snoomySound?.play('pop');
 }

 function seekTo(target){
  const at=Date.now();
  quietUntil=at+2500;settleUntil=at+6000;
  player.command('seekTo',[target,true]);
  player.time=target;sample=null;
 }
 // Bring this phone's player to the shared position and play state.
 function apply(force=false){
  if(!player?.ready||!state?.videoId)return;
  const at=Date.now(),target=expected();
  // The player's clock is only trusted while it is really playing (with a fresh reading) or paused.
  const settled=(player.state===PLAYING&&sample&&at-sample.at<1500)||player.state===PAUSED;
  if(force||(settled&&at>settleUntil&&Math.abs(player.time-target)>(state.playing?3:1.5)))seekTo(target);
  if(state.playing&&player.state!==PLAYING&&player.state!==BUFFERING&&at-playTriedAt>3000){
   quietUntil=Math.max(quietUntil,at+1500);playTriedAt=at;wanted=wanted||at;player.command('playVideo');
  }
  if(!state.playing&&(player.state===PLAYING||player.state===BUFFERING)){quietUntil=Math.max(quietUntil,at+1500);player.command('pauseVideo');}
  if(!state.playing||player.state===PLAYING)wanted=0;
  // Some phones block playback until someone taps the video itself.
  hint.hidden=!(wanted&&at-wanted>3500);
 }
 function local(playerState){
  const before=previous;previous=playerState;
  if(playerState===PLAYING){wanted=0;hint.hidden=true;stage.classList.remove('loading');document.dispatchEvent(new CustomEvent('snoomy-media',{detail:{source:'watch'}}));}
  if(Date.now()<quietUntil||!state?.videoId)return;
  // Only real button presses count: a phone that could not autoplay must not pause the other phone.
  if(playerState===PLAYING&&!state.playing)send({action:'play',position:player.time},true);
  else if(playerState===PAUSED&&before===PLAYING&&state.playing)send({action:'pause',position:player.time},true);
  else if(playerState===ENDED&&state.playing)send({action:'pause',position:player.duration||player.time},true);
 }

 function showPartner(){
  const partner=state.partner?.name||'Pasangan';
  partnerLine.textContent=state.partner?.online?`${partner} ikut nonton ♡`:`${partner} belum buka halaman ini`;
  partnerLine.classList.toggle('online',!!state.partner?.online);
 }
 function showStatus(){
  if(!state.videoId)return;
  const who=state.by===state.you?'kamu':state.by;
  statusLine.textContent=state.playing?`Diputar ${who} · ${clock(expected())}`:`Dijeda ${who} di ${clock(state.position)}`;
 }
 function render(){
  showPartner();
  section.dataset.state=state.videoId?'video':'empty';
  $('#watch-title').textContent=state.videoId?state.title:'';
  $('#watch-clear').hidden=!state.videoId;
  $('#watch-sync').hidden=!state.videoId;
  if(!state.videoId){
   player?.destroy();player=null;mounted=null;stage.classList.remove('loading');
   if(!stage.querySelector('.watch-empty'))stage.replaceChildren($('#watch-empty-template').content.cloneNode(true));
   statusLine.textContent='Tempel link YouTube di atas untuk mulai.';hint.hidden=true;
  }else{
   if(mounted!==state.videoId)mount();else apply();
   showStatus();
  }
  const history=$('#watch-history');
  history.replaceChildren(...(state.history||[]).filter(item=>item.videoId!==state.videoId).slice(0,6).map(item=>{
   const button=el('button',item.title||'Video YouTube','watch-again');button.type='button';button.dataset.video=item.videoId;
   const row=el('li');row.append(button);return row;
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
   else{apply();showPartner();showStatus();}
  }catch(error){
   if(error.status===401)stop();
   else if(version<0)statusLine.textContent='Koneksi lambat, mencoba lagi…';
  }
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
  timer=setTimeout(async()=>{await load();schedule();},state?.videoId?1500:3000);
 }
 function open(){
  // Show the last known state at once (the video starts at the right spot), then refresh it.
  if(state&&mounted!==state.videoId)render();
  load();schedule();
 }
 function stop(){clearTimeout(timer);user=null;}

 $('#watch-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const input=$('#watch-url');
  if(!YT.parse(input.value))return notify('Link YouTube-nya belum dikenali. Tempel link video dari YouTube.');
  const button=event.submitter;button.disabled=true;
  statusLine.textContent='Menyiapkan video…';
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
  stop();user=next;version=-1;state=null;
  if(user&&onPage())open();
 });
 document.addEventListener('snoomy-route',event=>{
  if(event.detail.page==='watch'&&user)open();
  else{
   clearTimeout(timer);
   // Leaving the page stops the local player; the shared state stays for when you return.
   if(player){player.destroy();player=null;mounted=null;stage.replaceChildren();stage.classList.remove('loading');version=-1;}
  }
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&onPage())load();schedule();});
})();
