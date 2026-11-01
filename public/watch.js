// Nonton bareng: one shared YouTube video kept in step through the server.
// The server holds where the video was at a moment in time; each phone follows that shared clock.
(() => {
 const $=s=>document.querySelector(s);
 const section=$('#watch'),YT=window.SnoomyYouTube;
 if(!section||!YT)return;
 const stage=$('#watch-player'),statusLine=$('#watch-status'),partnerLine=$('#watch-partner'),hint=$('#watch-hint'),bubbles=$('#watch-reactions');
 const ENDED=0,PLAYING=1,PAUSED=2,BUFFERING=3;
 // How far (in seconds) a phone may drift from the shared clock. Small gaps while playing are closed by playing a
 // little faster or slower for a few seconds (smooth, no buffering); bigger ones, or videos that refuse another
 // speed, by jumping.
 const NUDGE=.4,JUMP=2.5,JUMP_WITHOUT_NUDGE=1,DRIFT_PAUSED=1;
 let user=null,state=null,version=-1,stale=0,player=null,mounted=null,failed=null,timer=null,lastReaction=null,latest=null,retry=null;
 // The server clock comes from the quickest recent round trip; a slow reply says little about "now".
 let offset=0,clockSamples=[];
 // Sync bookkeeping. quietUntil: ignore the events our own commands cause. settleUntil: let a seek finish buffering
 // before trusting the player's clock. holdUntil: after a tap on this phone, do not undo it before the server has it.
 let quietUntil=0,settleUntil=0,holdUntil=0,holdVersion=0,awayUntil=0,sentAt=0,seekedAt=0,lag=.4,playTriedAt=0,wanted=0,played=false,sample=null,previous=-1;
 let rate=1,rateUntil=0,nudgeFrom=0,nudgeWorks=true;
 const onPage=()=>document.body.dataset.view==='watch';
 const now=()=>Date.now()+offset;
 const expected=()=>state?.videoId?state.position+(state.playing?Math.max(0,(now()-state.updatedAt)/1000):0):0;
 // The shared clock keeps running after the video ends, so never aim past the last frame.
 const end=()=>player?.duration>0?player.duration:Infinity;
 const goal=()=>Math.max(0,Math.min(expected(),end()-.3));
 const finished=()=>expected()>=end()-1;
 // Phones pause the video by themselves when the app goes to the background; that is not a pause to share.
 const away=()=>document.hidden||Date.now()<awayUntil;
 const clock=seconds=>{const s=Math.max(0,Math.floor(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
 const notify=message=>window.toast?window.toast(message):alert(message);
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};

 async function api(body){
  const sent=Date.now();
  const response=await fetch('/api/watch',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
  const data=await response.json().catch(()=>({error:'Server belum merespons. Coba lagi.'}));
  if(!response.ok){const error=Error(data.error);error.status=response.status;throw error;}
  const received=Date.now();
  clockSamples=[...clockSamples.filter(sample=>received-sample.at<60000).slice(-9),{offset:data.now-(sent+received)/2,rtt:received-sent,at:received}];
  offset=clockSamples.reduce((best,sample)=>sample.rtt<best.rtt?sample:best).offset;
  return data;
 }
 // Replies can overtake each other on a phone connection: keep the newest shared state, never step back.
 // (Three older replies in a row mean the server itself started over, so follow it.)
 function accept(next){
  if(state&&next.version<version&&++stale<3)return;
  stale=0;
  const changed=next.version!==version;
  state=next;version=next.version;
  if(holdUntil&&version>=holdVersion)holdUntil=0;
  if(changed)render();
  else{apply();showPartner();showStatus();}
 }

 function mount(){
  player?.destroy();player=null;sample=null;previous=-1;wanted=0;playTriedAt=0;played=false;seekedAt=0;holdUntil=0;failed=null;rate=1;nudgeWorks=true;
  mounted=state.videoId;
  // Starting at the shared position means no seek (and no extra buffering) is needed once it loads.
  const frame=YT.embed(state.videoId,{start:expected(),autoplay:state.playing,title:`Nonton bareng: ${state.title||'video YouTube'}`});
  stage.replaceChildren(frame);
  stage.classList.add('loading');
  // The overlay goes as soon as YouTube's own page has loaded, even if the control channel is slow.
  frame.addEventListener('load',()=>stage.classList.remove('loading'),{once:true});
  player=YT.connect(frame,{
   onReady:()=>{stage.classList.remove('loading');apply();},
   onState:local,
   onTime:watchTime,
   onError:code=>{stage.classList.remove('loading');failed=code;showStatus();},
  });
  window.snoomySound?.play('pop');
 }

 function setRate(next){if(rate!==next){rate=next;player.command('setPlaybackRate',[next]);}}
 function seekTo(target){
  const at=Date.now();
  // While playing, aim a little ahead: the player needs a moment to buffer before it moves again.
  const to=Math.max(0,Math.min(target+(state.playing?lag:0),end()-.3));
  quietUntil=at+2500;settleUntil=at+4500;seekedAt=state.playing&&!finished()?at:0;
  setRate(1);
  player.command('seekTo',[to,true]);
  player.time=to;sample=null;
 }
 // Bring this phone's player to the shared position and play state.
 function apply(force=false){
  if(!player?.ready||!state?.videoId)return;
  const at=Date.now(),ps=player.state;
  if(!force&&at<holdUntil)return;
  const target=goal(),done=finished();
  // The player's clock is trusted while it plays (with a fresh reading), is paused or has ended.
  const steady=ps===PAUSED||ps===ENDED||(ps===PLAYING&&sample&&at-sample.at<1500);
  const position=ps===PLAYING&&sample?sample.time+(at-sample.at)/1000*rate:player.time;
  const off=position-target;
  if(rate!==1&&(at>=rateUntil||!state.playing||ps!==PLAYING||done)){
   // A nudge that ran its course without closing the gap means this video keeps one speed: jump instead.
   if(at>=rateUntil&&steady&&ps===PLAYING&&Math.abs(off)>nudgeFrom*.6)nudgeWorks=false;
   setRate(1);
  }
  // A speed picked in YouTube's own menu would pull this phone away from the other one, so keep Snoomy's.
  if(player.rate&&player.rate!==rate)player.command('setPlaybackRate',[rate]);
  if(force||(steady&&at>settleUntil&&!(done&&ps===ENDED))){
   const limit=!state.playing?DRIFT_PAUSED:nudgeWorks?JUMP:JUMP_WITHOUT_NUDGE;
   if(force||Math.abs(off)>limit)seekTo(target);
   else if(state.playing&&ps===PLAYING&&!done&&nudgeWorks&&rate===1&&Math.abs(off)>NUDGE){
    nudgeFrom=Math.abs(off);rateUntil=at+Math.min(8000,nudgeFrom/.25*1000);
    setRate(off<0?1.25:.75);
   }
  }
  // A finished video stays on its last frame: playVideo on an ended video would start it again from 0.
  if(state.playing&&!done&&ps!==PLAYING&&ps!==BUFFERING&&at-playTriedAt>3000){
   quietUntil=Math.max(quietUntil,at+1500);playTriedAt=at;wanted=wanted||at;player.command('playVideo');
  }
  if(!state.playing&&(ps===PLAYING||ps===BUFFERING)){quietUntil=Math.max(quietUntil,at+1500);player.command('pauseVideo');}
  if(!state.playing||ps===PLAYING||done)wanted=0;
  // Some phones block playback until someone taps the video itself.
  hint.hidden=!(wanted&&at-wanted>3500);
 }
 // A tap on this phone's player: tell the server, and leave this player alone until the server has it.
 function share(action,position=player.time){
  const at=Date.now();
  sentAt=at;holdUntil=at+4000;holdVersion=version+1;settleUntil=Math.max(settleUntil,at+2500);
  // The newest tap replaces any older one still waiting to be retried.
  latest={action,position};retry=null;
  send(latest,true);
 }
 function local(playerState){
  const before=previous;previous=playerState;
  if(playerState===PLAYING){played=true;wanted=0;hint.hidden=true;stage.classList.remove('loading');document.dispatchEvent(new CustomEvent('snoomy-media',{detail:{source:'watch'}}));}
  if(Date.now()<quietUntil||!state?.videoId||away())return;
  // Only real taps count: a phone that could not autoplay (it never played) must not pause the other phone.
  if(playerState===PLAYING&&(!state.playing||finished()))share('play');
  else if(playerState===PAUSED&&state.playing&&played&&(before===PLAYING||before===BUFFERING))share('pause');
  else if(playerState===ENDED&&state.playing)share('pause',Number.isFinite(end())?end():player.time);
 }
 // Time reports from the player. A jump this phone did not cause means the progress bar was moved here
 // (or the video was double-tapped to skip), so the other phone should follow.
 function watchTime(time){
  const at=Date.now(),last=sample;
  sample={time,at,state:player.state};
  if(seekedAt&&player.state===PLAYING&&at-seekedAt>250){
   // Learn how long a seek takes to get going on this phone, and aim that far ahead next time.
   const behind=goal()-time;
   if(Math.abs(behind)<3)lag=Math.min(2.5,Math.max(0,lag+behind*.6));
   seekedAt=0;
  }
  if(!last||!state?.videoId||at<quietUntil||at-sentAt<500||away())return;
  const running=last.state===PLAYING;
  if(running&&at-last.at>1500)return;
  const predicted=last.time+(running?(at-last.at)/1000*rate:0);
  if(Math.abs(time-predicted)>2.5)share('seek',time);
 }

 function showPartner(){
  const partner=state.partner?.name||'Pasangan';
  partnerLine.textContent=state.partner?.online?`${partner} ikut nonton ♡`:`${partner} belum buka halaman ini`;
  partnerLine.classList.toggle('online',!!state.partner?.online);
 }
 function showStatus(){
  if(!state?.videoId)return;
  if(failed!==null){
   statusLine.replaceChildren(el('span',YT.errorText(failed)+' '),Object.assign(el('a','Buka di YouTube'),{href:YT.watchUrl(mounted),target:'_blank',rel:'noopener noreferrer'}));
   return;
  }
  const who=state.by===state.you?'kamu':state.by;
  statusLine.textContent=state.playing&&finished()?'Videonya sudah selesai. Putar lagi kapan saja ♡':state.playing?`Diputar ${who} · ${clock(goal())}`:`Dijeda ${who} di ${clock(state.position)}`;
 }
 function render(){
  showPartner();
  section.dataset.state=state.videoId?'video':'empty';
  $('#watch-title').textContent=state.videoId?state.title:'';
  $('#watch-clear').hidden=!state.videoId;
  $('#watch-sync').hidden=!state.videoId;
  if(!state.videoId){
   player?.destroy();player=null;mounted=null;failed=null;stage.classList.remove('loading');
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
  if(!user)return;
  try{accept(await api());}
  catch(error){
   if(error.status===401)stop();
   else if(version<0)statusLine.textContent='Koneksi lambat, mencoba lagi…';
  }
 }
 async function send(body,quiet=false){
  try{accept(await api(body));if(body===retry)retry=null;}
  catch(error){
   if(error.status===401)return stop();
   // A tap that did not reach the server is sent again on the next round, otherwise the other phone never hears of it.
   if(body===latest&&(!error.status||error.status>=500)){retry=body;statusLine.textContent='Koneksi putus sebentar, mencoba lagi…';}
   else if(!quiet)notify(error.message);
  }
 }
 function schedule(){
  clearTimeout(timer);
  if(!user||!onPage()||document.hidden)return;
  timer=setTimeout(async()=>{if(retry)await send(retry,true);else await load();schedule();},state?.videoId?1500:3000);
 }
 function open(){
  // Show the last known state at once (the video starts at the right spot), then refresh it.
  if(state&&mounted!==state.videoId)render();
  load();schedule();
 }
 function stop(){clearTimeout(timer);user=null;latest=retry=null;}

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
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden)return clearTimeout(timer);
  awayUntil=Date.now()+2000;
  if(onPage())load();
  schedule();
 });
})();
