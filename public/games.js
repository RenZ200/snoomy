// Permainan: the game picker, turn reminders for every game, and the shared client behind Ludo, Empat Sejajar and
// Ular Tangga (polling while a game is open, sending moves with the version they were based on, the common panel parts).
window.SnoomyGames = (() => {
 const $=s=>document.querySelector(s);
 const section=$('#game');
 if(!section)return null;
 const KEY='snoomy-game',PLAYERS=['Moreno','Cahya'];
 const GAMES={cards:'Kartu Snoomy',ludo:'Ludo',four:'Empat Sejajar',snakes:'Ular Tangga'};
 const tabs=[...section.querySelectorAll('.game-picker [role=tab]')];
 const navLink=document.querySelector('header nav a[href="#game"]'),quick=$('#ql-game'),title=document.title;
 const controllers={};
 let active='cards',user=null,briefs={},timer=null;
 try{const saved=localStorage.getItem(KEY);if(GAMES[saved])active=saved;}catch{}
 const onPage=()=>document.body.dataset.view==='game';
 const isOpen=id=>onPage()&&active===id&&!document.hidden;
 const moving=()=>!!window.gsap&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
 const notify=message=>window.toast?window.toast(message):alert(message);
 const sound=(name,times)=>window.snoomySound?.play(name,times);
 // Browsers only allow vibration after the person has tapped the page at least once.
 const buzz=pattern=>{if(navigator.userActivation?.hasBeenActive===false)return;try{navigator.vibrate?.(pattern);}catch{}};
 const rival=name=>PLAYERS.find(p=>p!==name);

 function select(id,focus=false){
  if(!GAMES[id])return;
  active=id;document.body.dataset.game=id;
  try{localStorage.setItem(KEY,id);}catch{}
  for(const tab of tabs){
   const on=tab.dataset.game===id;
   tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;
   if(on&&focus)tab.focus();
  }
  for(const panel of section.querySelectorAll('.game-panel'))panel.hidden=panel.id!==`play-${id}`;
  document.dispatchEvent(new CustomEvent('snoomy-game',{detail:{game:id}}));
  paint();
 }

 const score=brief=>brief.wins?`${brief.wins[user]??0}–${brief.wins[rival(user)]??0}`:'';
 const label=brief=>brief.status==='none'?'Belum mulai':brief.status==='finished'?`${brief.winner?(brief.winner===user?'Kamu menang':`${brief.winner} menang`):'Seri'} · ${score(brief)}`:brief.yourTurn?'Giliranmu ✦':`Giliran ${brief.turn}`;
 // The picker, the red dot on the menu, the tab title and the Beranda shortcut all follow every game at once.
 function paint(){
  for(const tab of tabs){
   const brief=briefs[tab.dataset.game];
   tab.querySelector('[data-pick-status]').textContent=brief?label(brief):'';
   tab.classList.toggle('your-turn',!!brief?.yourTurn);
  }
  const mine=Object.keys(GAMES).filter(id=>briefs[id]?.yourTurn);
  navLink?.classList.toggle('has-turn',mine.length>0&&!onPage());
  document.title=mine.length?`✦ Giliranmu · ${title}`:title;
  if(quick){
   const waiting=Object.keys(GAMES).find(id=>briefs[id]?.status==='playing');
   quick.textContent=mine.length?`Giliranmu di ${GAMES[mine[0]]} ✦`:waiting?`${GAMES[waiting]}: menunggu ${briefs[waiting].turn}…`:'Kartu, ludo & lainnya';
   quick.classList.toggle('attention',mine.length>0);
  }
 }
 // A game that is not on screen only nudges when it becomes your turn; the open game makes its own sounds.
 function remind(id,before,now){
  if(!before||!now?.yourTurn||before.yourTurn||isOpen(id)||document.hidden)return;
  sound('turn');buzz(25);
  if(onPage())notify(`Giliranmu di ${GAMES[id]} ✦`);
 }
 // Every state a game shows is reported here, so its picker card never lags behind the open board.
 function report(id,game){
  const before=briefs[id];
  if(before&&game.version<before.version)return;
  briefs[id]={status:game.status,round:game.round,turn:game.turn,winner:game.winner,wins:game.wins,version:game.version,yourTurn:game.status==='playing'&&game.turn===game.you};
  remind(id,before,briefs[id]);
  paint();
 }
 async function poll(){
  if(!user)return;
  try{
   const response=await fetch('/api/games',{cache:'no-store'});
   const data=await response.json();
   if(!response.ok||data.you!==user)return;
   for(const [id,brief] of Object.entries(data.games)){
    const before=briefs[id];
    if(before&&brief.version<before.version)continue;
    briefs[id]=brief;remind(id,before,brief);
   }
   paint();
  }catch{}
 }
 function schedule(){
  clearTimeout(timer);
  if(!user||document.hidden)return;
  timer=setTimeout(async()=>{await poll();schedule();},onPage()?6000:15000);
 }
 const refresh=()=>{for(const controller of Object.values(controllers))controller.refresh();};

 // The board games share one way of talking to the server and the common parts of their panels.
 function board(id,{render,prompt,restartText='Mulai ulang ronde ini? Papannya akan dikosongkan.'}){
  const panel=$(`#play-${id}`),part=name=>panel.querySelector(`[data-${name}]`);
  let game=null,busy=false,poller=null;
  async function api(path='',body){
   const response=await fetch(`/api/games/${id}${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
   const data=await response.json().catch(()=>({error:'Server belum merespons. Coba lagi.'}));
   if(!response.ok){const error=Error(data.error);error.status=response.status;throw error;}
   return data;
  }
  function show(next){
   const before=game;game=next;
   report(id,next);
   const yourTurn=next.status==='playing'&&next.turn===next.you;
   part('score').replaceChildren(el('span',`${next.you} ${next.wins[next.you]}`,'you'),el('span','–'),el('span',`${next.wins[next.opponent]} ${next.opponent}`));
   const status=part('status');
   status.textContent=next.status==='none'?'Belum ada ronde. Mulai satu ♡':next.status==='finished'?(next.winner?`${next.winner===next.you?'Kamu':next.winner} menang ronde ${next.round} ♡`:`Ronde ${next.round} seri`):yourTurn?prompt(next):`Menunggu ${next.turn}…`;
   status.classList.toggle('yours',yourTurn);
   part('new').textContent=next.status==='playing'?'Mulai ulang':'Main baru';
   part('empty').hidden=next.status!=='none';
   part('table').hidden=next.status==='none';
   if(next.status==='none')return;
   part('log').replaceChildren(...next.log.slice(-4).reverse().map(entry=>el('li',entry.text)));
   const result=part('result');
   result.hidden=next.status!=='finished';
   if(next.status==='finished')result.querySelector('p').textContent=next.winner?(next.winner===next.you?'Kamu menang! ♡':`${next.winner} menang kali ini ♡`):'Seri! Satu ronde lagi?';
   const open=isOpen(id);
   render(next,before,{yourTurn,open,animate:open&&moving()&&!!before&&before.status!=='none'&&before.round===next.round});
   if(!open||!before||before.status==='none')return;
   if(before.status==='playing'&&next.status==='finished')sound(next.winner?next.winner===next.you?'win':'lose':'pop');
   else if(yourTurn&&before.turn!==next.you){buzz(25);sound('turn');}
  }
  async function load(){
   if(!user||busy)return;
   try{const next=await api();if(!busy&&(!game||next.version!==game.version||next.you!==game.you))show(next);}
   catch(error){if(error.status===401)game=null;}
  }
  function schedule(){
   clearTimeout(poller);
   if(!user||!isOpen(id))return;
   poller=setTimeout(async()=>{await load();schedule();},game?.status==='playing'&&game.turn!==game.you?1500:5000);
  }
  async function send(path,body={}){
   if(busy||!game)return null;
   busy=true;panel.setAttribute('aria-busy','true');
   try{const next=await api(path,{...body,version:game.version});busy=false;show(next);return next;}
   catch(error){busy=false;notify(error.message);if(error.status===409)await load();return null;}
   finally{busy=false;panel.removeAttribute('aria-busy');schedule();}
  }
  const start=restart=>{
   if(restart&&!confirm(restartText))return;
   send('/new',restart?{restart:true}:{});
  };
  part('new').addEventListener('click',()=>start(game?.status==='playing'));
  part('start').addEventListener('click',()=>start(false));
  part('again').addEventListener('click',()=>start(false));
  controllers[id]={
   refresh(){if(isOpen(id))load();schedule();},
   reset(){clearTimeout(poller);game=null;},
  };
  return {move:body=>send('/move',body),get game(){return game;},get busy(){return busy;},panel};
 }

 // A die with pips; rolling shuffles faces while it spins, then lands on the value.
 function dice(button){
  const die=button.querySelector('.die');
  return {
   show(value){die.dataset.die=String(value||1);},
   roll(timeline,value){
    let frames=0;
    sound('dice');
    timeline.fromTo(die,{rotation:-200,scale:.7},{rotation:0,scale:1,duration:.6,ease:'back.out(1.6)',
     onUpdate:()=>{if(frames++%4===0)die.dataset.die=String(1+Math.floor(Math.random()*6));},
     onComplete:()=>{die.dataset.die=String(value);}});
   },
  };
 }
 // Offsets for tokens sharing one square: side by side, then a small grid.
 function spread(count,index){
  if(count<2)return [0,0,1];
  const columns=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/columns),step=.62/columns;
  return [(index%columns-(columns-1)/2)*step*1.4,(Math.floor(index/columns)-(rows-1)/2)*step*1.4,Math.max(.45,1.15/columns)];
 }

 tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>select(tab.dataset.game));
  tab.addEventListener('keydown',event=>{
   const step={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
   if(event.key==='Home'||event.key==='End'||step){
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+step+tabs.length)%tabs.length;
    select(tabs[next].dataset.game,true);
   }
  });
 });
 document.addEventListener('snoomy-session',event=>{
  const next=event.detail?.user||null;
  if(next===user)return;
  user=next;briefs={};
  for(const controller of Object.values(controllers))controller.reset();
  paint();
  if(user){poll();refresh();}
  schedule();
 });
 document.addEventListener('snoomy-route',()=>{if(onPage()){poll();refresh();}paint();schedule();});
 document.addEventListener('snoomy-game',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){poll();refresh();}schedule();});
 select(active);
 return {board,dice,spread,report,moving,sound,buzz,active:()=>active,isOpen};
})();
