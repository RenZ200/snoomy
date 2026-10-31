// Kartu Snoomy table: polls the shared match and sends one move at a time.
(() => {
 const $=s=>document.querySelector(s);
 const section=$('#game');
 if(!section)return;
 const FLAVOR={matcha:{name:'Matcha',mark:'✿'},stroberi:{name:'Stroberi',mark:'♥'},taro:{name:'Taro',mark:'✦'},vanila:{name:'Vanila',mark:'●'}};
 const VALUE={plus2:'+2',skip:'⊘',swap:'⇄',wild:'★',plus4:'+4'};
 const VALUE_NAME={plus2:'Tambah 2',skip:'Lewati',swap:'Tukar Kartu',wild:'Ganti Rasa',plus4:'Tambah 4'};
 const WILD=['wild','plus4'];
 const ORDER=['matcha','stroberi','taro','vanila',null];
 const hand=$('#game-hand'),top=$('#game-top'),drawPile=$('#game-draw'),backs=$('#game-opponent-hand'),pick=$('#game-flavor-pick'),callButton=$('#game-call');
 const stackPlay=$('#game-stack-play'),stackCancel=$('#game-stack-cancel'),soundButton=$('#game-sound');
 const navLink=document.querySelector('header nav a[href="#game"]'),quick=$('#ql-game'),title=document.title;
 let game=null,user=null,busy=false,timer,pendingWild=null,from=null,calling=false,selected=[],played=1;
 const moving=()=>window.gsap&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const onPage=()=>document.body.dataset.view==='game';
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
 const cardName=card=>WILD.includes(card.v)?VALUE_NAME[card.v]:`${FLAVOR[card.f].name} ${VALUE_NAME[card.v]||card.v}`;
 const notify=message=>window.toast?window.toast(message):alert(message);
 const sound=(name,times)=>window.snoomySound?.play(name,times);
 // Browsers only allow vibration after the person has tapped the page at least once.
 const buzz=pattern=>{if(navigator.userActivation?.hasBeenActive===false)return;try{navigator.vibrate?.(pattern);}catch{}};

 async function api(path,body){
  const response=await fetch('/api/game'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
  const data=await response.json().catch(()=>({error:'Server belum merespons. Coba lagi.'}));
  if(!response.ok){const error=Error(data.error);error.status=response.status;throw error;}
  return data;
 }
 function face(card,tag='div'){
  const node=el(tag,null,`card ${card.f||'wild'}`);
  const value=VALUE[card.v]||card.v;
  node.dataset.id=card.id;
  node.setAttribute('aria-label',cardName(card));
  node.append(el('span',value,'corner'),el('span',value,'value'),el('span',WILD.includes(card.v)?VALUE_NAME[card.v]:`${FLAVOR[card.f].mark} ${FLAVOR[card.f].name}`,'flavor-tag'),el('span',value,'corner end'));
  for(const part of node.children)part.setAttribute('aria-hidden','true');
  return node;
 }
 const sortKey=card=>ORDER.indexOf(card.f)*100+(/^\d$/.test(card.v)?Number(card.v):10+Object.keys(VALUE).indexOf(card.v));
 const byId=id=>game.hand.find(card=>card.id===id);

 function render(next){
  const before=game;game=next;
  const yourTurn=game.status==='playing'&&game.turn===game.you;
  selected=yourTurn?selected.filter(byId):[];
  section.dataset.state=game.status;
  navLink?.classList.toggle('has-turn',yourTurn&&!onPage());
  document.title=yourTurn?`✦ Giliranmu · ${title}`:title;
  if(quick){quick.textContent=yourTurn?'Giliranmu ✦':game.status==='playing'?`Menunggu ${game.turn}…`:'Main kartu berdua';quick.classList.toggle('attention',yourTurn);}
  $('#game-score').replaceChildren(el('span',`${game.you} ${game.wins[game.you]}`,'you'),el('span','–'),el('span',`${game.wins[game.opponent]} ${game.opponent}`));
  const status=game.status==='none'?'Belum ada ronde. Mulai satu ♡':game.status==='finished'?`${game.winner===game.you?'Kamu':game.winner} menang ronde ${game.round} ♡`:yourTurn?(game.penalty?`Balas dengan ${game.penaltyType==='plus4'?'+4':'+2 atau +4'}, atau ambil ${game.penalty} kartu.`:game.drawn?'Kartu barumu cocok. Mainkan atau simpan.':'Giliranmu ✦'):`Menunggu ${game.turn}…`;
  $('#game-status').textContent=status;
  $('#game-status').classList.toggle('yours',yourTurn);
  $('#game-new').textContent=game.status==='playing'?'Mulai ulang':'Main baru';
  $('#game-table').hidden=game.status==='none';
  $('#game-empty').hidden=game.status!=='none';
  feedback(before,yourTurn);
  if(game.status==='none')return;
  $('#game-opponent-name').textContent=`${game.opponent} · ${game.opponentCount} kartu`;
  $('#game-last').textContent=game.log.at(-1)?.text||'';
  backs.replaceChildren(...Array.from({length:Math.min(game.opponentCount,14)},()=>el('span',null,'card back')));
  backs.setAttribute('aria-label',`${game.opponent} memegang ${game.opponentCount} kartu`);
  $('#game-draw-count').textContent=yourTurn&&game.penalty?`Ambil ${game.penalty} kartu`:`${game.drawCount} kartu`;
  drawPile.disabled=!yourTurn||!!game.drawn||selected.length>0;
  drawPile.classList.toggle('owed',yourTurn&&game.penalty>0);
  drawPile.setAttribute('aria-label',yourTurn&&game.penalty?`Ambil ${game.penalty} kartu`:'Ambil satu kartu');
  $('#game-penalty').hidden=!game.penalty;
  $('#game-penalty').textContent=`+${game.penalty}`;
  const topCard=face(game.top);top.replaceChildren(topCard);
  const flavor=FLAVOR[game.flavor];
  $('#game-flavor').textContent=`Rasa sekarang: ${flavor.mark} ${flavor.name}`;
  $('#game-flavor').className=`game-flavor ${game.flavor}`;
  renderHand(yourTurn);
  $('#game-pass').hidden=!(yourTurn&&game.drawn)||selected.length>0;
  $('#game-log').replaceChildren(...game.log.slice(-4).reverse().map(entry=>el('li',entry.text)));
  const result=$('#game-result');result.hidden=game.status!=='finished';
  if(game.status==='finished')result.querySelector('p').textContent=game.winner===game.you?'Kamu menang! ♡':`${game.winner} menang kali ini ♡`;
  animate(before,topCard,yourTurn);
 }

 // While stacking, only cards sharing the first card's number or symbol stay active.
 function renderHand(yourTurn=game.status==='playing'&&game.turn===game.you){
  const value=selected.length?byId(selected[0])?.v:null;
  const cards=[...game.hand].sort((a,b)=>sortKey(a)-sortKey(b));
  hand.replaceChildren(...cards.map(card=>{
   const button=face(card,'button');button.type='button';
   const ok=yourTurn&&(value?card.v===value:game.playable.includes(card.id));
   button.classList.toggle('playable',ok);button.disabled=!ok;
   if(card.id===game.drawn)button.classList.add('fresh');
   const order=selected.indexOf(card.id);
   if(order>=0){button.classList.add('selected');button.dataset.order=order+1;button.setAttribute('aria-pressed','true');}
   return button;
  }));
  hand.classList.toggle('stacking',selected.length>0);
  hand.setAttribute('aria-label',`Kartumu, ${cards.length} kartu`);
  const last=selected.length?byId(selected.at(-1)):null;
  $('#game-you-name').textContent=selected.length?(WILD.includes(last.v)?`${selected.length} dipilih · ketuk kartu sejenis untuk menumpuk`:`${selected.length} dipilih · rasa berikutnya ${FLAVOR[last.f].mark} ${FLAVOR[last.f].name}`):`Kartumu · ${game.hand.length}`;
  stackPlay.hidden=stackCancel.hidden=!selected.length;
  stackPlay.textContent=`Mainkan ${selected.length} kartu`;
  const remaining=game.hand.length-Math.max(selected.length,1);
  callButton.hidden=!(yourTurn&&remaining===1&&(game.playable.length||selected.length));
  if(callButton.hidden)calling=false;
  callButton.setAttribute('aria-pressed',String(calling));
  drawPile.disabled=!yourTurn||!!game.drawn||selected.length>0;
 }

 // Sounds and vibration follow every change, including the opponent's moves.
 function feedback(before,yourTurn){
  if(!before||before.status==='none'||game.status==='none'||document.hidden)return;
  if(yourTurn&&before.status==='playing'&&before.turn!==game.you){
   buzz(game.penalty?[30,60,30]:25);
   sound(game.penalty?'penalty':'turn');
  }
  if(!onPage())return;
  if(game.status==='finished'&&before.status==='playing'){sound(game.winner===game.you?'win':'lose');return;}
  if(game.round!==before.round)return;
  if(before.top?.id!==game.top.id)sound('play',before.turn===game.you?played:Math.max(1,before.opponentCount-game.opponentCount));
  const drawn=game.hand.length-before.hand.length;
  if(drawn>0&&before.top?.id===game.top.id)sound('draw',drawn);
 }

 function animate(before,topCard,yourTurn){
  const source=from;from=null;
  if(!moving()||!before||before.status==='none'||!onPage())return;
  const gsap=window.gsap;
  if(before.top?.id!==game.top.id&&game.round===before.round){
   const start=source||backs.getBoundingClientRect(),end=topCard.getBoundingClientRect();
   gsap.from(topCard,{x:start.left+start.width/2-end.left-end.width/2,y:start.top+start.height/2-end.top-end.height/2,rotation:source?-14:14,scale:.75,duration:.55,ease:'power3.out',clearProps:'transform'});
  }
  const known=new Set((before.hand||[]).map(card=>card.id));
  const fresh=[...hand.children].filter(node=>!known.has(node.dataset.id));
  if(fresh.length&&fresh.length<7){
   const pile=drawPile.getBoundingClientRect();
   fresh.forEach((node,i)=>{const box=node.getBoundingClientRect();gsap.from(node,{x:pile.left-box.left,y:pile.top-box.top,rotation:12,opacity:0,duration:.5,delay:i*.08,ease:'power3.out',clearProps:'transform,opacity'});});
  }
  if(game.opponentCount>before.opponentCount)gsap.from([...backs.children].slice(before.opponentCount),{scale:0,duration:.35,stagger:.06,ease:'back.out(2)',clearProps:'transform'});
  if(game.status==='finished'&&before.status==='playing')gsap.from('#game-result',{scale:.7,opacity:0,duration:.6,ease:'back.out(1.8)',clearProps:'transform,opacity'});
  if(yourTurn&&before.turn!==game.you)gsap.fromTo('#game-status',{scale:.9},{scale:1,duration:.5,ease:'back.out(3)',clearProps:'transform'});
  if(before.log?.at(-1)?.text!==game.log.at(-1)?.text)gsap.fromTo('#game-last',{y:6,scale:.9,opacity:0},{y:0,scale:1,opacity:1,duration:.4,ease:'back.out(2)',clearProps:'transform,opacity'});
  if(game.status==='finished'&&before.status==='playing'&&game.winner===game.you)confetti();
 }

 function confetti(){
  const box=$('#game-result').getBoundingClientRect(),colors=['var(--matcha)','var(--pink)','var(--taro)','var(--vanila)','var(--plum)'];
  for(let i=0;i<28;i++){
   const piece=el('span',null,'confetti');piece.setAttribute('aria-hidden','true');piece.style.background=colors[i%colors.length];
   document.body.append(piece);
   window.gsap.set(piece,{left:box.left+box.width/2,top:box.top+box.height/2,xPercent:-50,yPercent:-50});
   window.gsap.to(piece,{x:(Math.random()-.5)*Math.min(innerWidth,700),y:-120-Math.random()*220,rotation:Math.random()*720-360,duration:.9,ease:'power3.out'});
   window.gsap.to(piece,{y:'+=320',opacity:0,duration:1.1,delay:.75,ease:'power1.in',onComplete:()=>piece.remove()});
  }
 }
 async function load(){
  if(!user||busy)return;
  try{const next=await api('');if(!busy&&(!game||next.version!==game.version||next.you!==game.you))render(next);}
  catch(error){if(error.status===401)stop();}
 }
 function schedule(){
  clearTimeout(timer);
  if(!user)return;
  const delay=document.hidden?30000:!onPage()?15000:game?.status==='playing'&&game.turn!==game.you?1500:5000;
  timer=setTimeout(async()=>{await load();schedule();},delay);
 }
 function stop(){clearTimeout(timer);user=null;game=null;selected=[];navLink?.classList.remove('has-turn');document.title=title;}
 async function send(path,body={}){
  if(busy||!game)return;
  busy=true;section.setAttribute('aria-busy','true');
  try{const next=await api(path,{...body,version:game.version});busy=false;render(next);}
  catch(error){busy=false;notify(error.message);if(error.status===409)await load();}
  finally{busy=false;section.removeAttribute('aria-busy');schedule();}
 }
 function commit(ids,box){
  from=box;played=ids.length;selected=[];
  if(WILD.includes(byId(ids[0]).v)){pendingWild=ids;pick.showModal();renderHand();return;}
  send('/play',{cards:ids,call:calling});
 }

 hand.addEventListener('click',event=>{
  const button=event.target.closest('.card');
  if(!button||button.disabled||!game)return;
  const card=byId(button.dataset.id);
  buzz(8);
  if(selected.length){
   // Tapping the first card again cancels; tapping another toggles it in the stack.
   selected=card.id===selected[0]?[]:selected.includes(card.id)?selected.filter(id=>id!==card.id):[...selected,card.id];
   sound('tap');renderHand();return;
  }
  if(game.hand.some(other=>other.id!==card.id&&other.v===card.v)){selected=[card.id];sound('tap');renderHand();return;}
  commit([card.id],button.getBoundingClientRect());
 });
 stackPlay.addEventListener('click',()=>{
  const first=hand.querySelector(`[data-id="${selected[0]}"]`);
  commit([...selected],first?.getBoundingClientRect()||null);
 });
 stackCancel.addEventListener('click',()=>{selected=[];renderHand();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selected.length&&onPage()&&!document.querySelector('dialog[open]')){selected=[];renderHand();}});
 pick.addEventListener('click',event=>{
  const choice=event.target.closest('[data-flavor]');
  if(event.target.closest('[data-pick-close]')){pick.close();pendingWild=null;from=null;return;}
  if(!choice||!pendingWild)return;
  pick.close();
  send('/play',{cards:pendingWild,flavor:choice.dataset.flavor,call:calling});pendingWild=null;
 });
 pick.addEventListener('close',()=>{pendingWild=null;});
 drawPile.addEventListener('click',()=>send('/draw'));
 $('#game-pass').addEventListener('click',()=>send('/pass'));
 callButton.addEventListener('click',()=>{calling=!calling;callButton.setAttribute('aria-pressed',String(calling));if(calling)sound('call');});
 const syncSound=()=>{const on=!window.snoomySound?.muted;soundButton.setAttribute('aria-pressed',String(on));soundButton.setAttribute('aria-label',on?'Matikan efek suara':'Nyalakan efek suara');};
 soundButton.addEventListener('click',()=>{window.snoomySound?.setMuted(!window.snoomySound.muted);syncSound();sound('pop');});
 syncSound();
 const start=restart=>{
  if(restart&&!confirm('Mulai ulang ronde ini? Kartu sekarang akan dikocok ulang.'))return;
  selected=[];
  send('/new',restart?{restart:true}:{});
 };
 $('#game-new').addEventListener('click',()=>start(game?.status==='playing'));
 $('#game-again').addEventListener('click',()=>start(false));
 $('#game-start').addEventListener('click',()=>start(false));

 document.addEventListener('snoomy-session',event=>{
  const next=event.detail?.user||null;
  if(next===user)return;
  stop();user=next;
  if(user){load();schedule();}
 });
 document.addEventListener('snoomy-route',event=>{
  if(event.detail.page==='game'){navLink?.classList.remove('has-turn');load();}
  schedule();
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();schedule();});
})();
