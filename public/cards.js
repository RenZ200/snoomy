// Kartu Snoomy table: polls the shared match and sends one move at a time. Four rule sets share the table:
// Kartu Snoomy, Klasik, Bolak-balik (double-sided cards with a dark side) and Tanpa Ampun.
(() => {
 const $=s=>document.querySelector(s);
 const section=$('#game');
 if(!section)return;
 const FLAVOR={matcha:{name:'Matcha'},stroberi:{name:'Stroberi'},taro:{name:'Taro'},vanila:{name:'Vanila'},kopi:{name:'Kopi'},anggur:{name:'Anggur'},jeruk:{name:'Jeruk'},laut:{name:'Laut'}};
 const LIGHT=['matcha','stroberi','taro','vanila'],DARK=['kopi','anggur','jeruk','laut'];
 const VALUE={plus1:'+1',plus2:'+2',cplus4:'+4',plus4:'+4',wrev4:'+4',wild2:'+2',plus5:'+5',plus6:'+6',plus10:'+10',skip:'⊘',skipall:'⊘⊘',reverse:'⇆',swap:'⇄',flip:'◐',discard:'≡',wild:'★',wildcolor:'◎',roulette:'◎'};
 // Action cards are drawn as symbols; numbers and draw cards as type.
 const GLYPH=['skip','skipall','reverse','swap','flip','discard','wild','wildcolor','roulette'];
 const VALUE_NAME={plus1:'Tambah 1',plus2:'Tambah 2',cplus4:'Tambah 4',plus4:'Tambah 4',wrev4:'Putar Arah +4',wild2:'Ganti Rasa +2',plus5:'Tambah 5',plus6:'Tambah 6',plus10:'Tambah 10',skip:'Lewati',skipall:'Lewati Semua',reverse:'Putar Arah',swap:'Tukar Kartu',flip:'Balik',discard:'Buang Semua',wild:'Ganti Rasa',wildcolor:'Ambil Sampai Warna',roulette:'Rolet Warna'};
 const MODE={snoomy:{name:'Kartu Snoomy',note:'Aturan asli Snoomy: tumpuk kartu kembar, Tukar Kartu, +2 dan +4 menumpuk.'},klasik:{name:'Klasik',note:'Aturan kartu warna yang biasa: 108 kartu, +2 dan +4 langsung diambil.'},balik:{name:'Bolak-balik',note:'Kartu dua sisi. Kartu Balik membalik semuanya ke sisi gelap yang lebih galak.'},ganas:{name:'Tanpa Ampun',note:'168 kartu, +6 dan +10, tumpuk tambah tanpa batas. Pegang 25 kartu = kalah.'}};
 // Wild cards have no flavour of their own, whatever the rule set.
 const isWild=card=>card.f==null;
 const ORDER=[...LIGHT,...DARK,null];
 const hand=$('#game-hand'),top=$('#game-top'),drawPile=$('#game-draw'),backs=$('#game-opponent-hand'),pick=$('#game-flavor-pick'),callButton=$('#game-call');
 const stackPlay=$('#game-stack-play'),stackCancel=$('#game-stack-cancel'),soundButton=$('#game-sound'),panel=$('#play-cards');
 let game=null,user=null,busy=false,timer,pendingWild=null,from=null,calling=false,selected=[],played=1,restarting=false;
 const moving=()=>window.gsap&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 // The table is "open" while Permainan shows Kartu Snoomy; other games and pages are covered by the game picker.
 const onPage=()=>document.body.dataset.view==='game'&&(window.SnoomyGames?.active()??'cards')==='cards';
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
 const cardName=card=>isWild(card)?VALUE_NAME[card.v]:`${FLAVOR[card.f].name} ${VALUE_NAME[card.v]||card.v}`;
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
 const symbol=name=>{
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');
  svg.setAttribute('class','ci');svg.setAttribute('aria-hidden','true');use.setAttribute('href',`#cs-${name}`);svg.append(use);return svg;
 };
 // A printed card: value and flavour symbol in two corners, the value large in a tilted oval.
 // Dark-side cards (Bolak-balik) remap the four colours, so their wild cards spin in the dark colours.
 function face(card,tag='div',side=game?.side){
  const wild=isWild(card);
  const node=el(tag,null,`card ${card.f||'wild'}${wild&&!GLYPH.includes(card.v)?' plus4':''}${side==='dark'?' dark':''}`);
  const value=()=>GLYPH.includes(card.v)?symbol(card.v):el('b',VALUE[card.v]||card.v);
  const corner=className=>{const box=el('span',null,className);box.append(value());if(card.v!=='wild')box.append(symbol(wild?'wild':card.f));return box;};
  const pip=el('span',null,'pip');pip.append(value());
  if(card.id)node.dataset.id=card.id;
  if(!GLYPH.includes(card.v)&&(VALUE[card.v]||card.v).length>2)node.classList.add('long');
  node.setAttribute('aria-label',cardName(card));
  node.append(corner('corner'),pip,corner('corner end'));
  for(const part of node.children)part.setAttribute('aria-hidden','true');
  return node;
 }
 const sortKey=card=>ORDER.indexOf(card.f)*100+(/^\d$/.test(card.v)?Number(card.v):10+Object.keys(VALUE).indexOf(card.v));
 const byId=id=>game.hand.find(card=>card.id===id);

 function render(next){
  const before=game;game=next;
  const yourTurn=game.status==='playing'&&game.turn===game.you;
  selected=yourTurn?selected.filter(byId):[];
  panel.dataset.state=game.status;
  // The game picker keeps the menu dot, tab title and Beranda shortcut up to date for every game.
  window.SnoomyGames?.report('cards',game);
  $('#game-score').replaceChildren(el('span',`${game.you} ${game.wins[game.you]}`,'you'),el('span','–'),el('span',`${game.wins[game.opponent]} ${game.opponent}`));
  const answer=game.mode==='ganas'?`kartu tambah minimal +${game.penaltyLast}`:game.penaltyType==='plus4'?'+4':'+2 atau +4';
  const status=game.status==='none'?'Belum ada ronde. Mulai satu ♡':game.status==='finished'?`${game.winner===game.you?'Kamu':game.winner} menang ronde ${game.round} ♡`:yourTurn?(game.penalty?`Balas dengan ${answer}, atau ambil ${game.penalty} kartu.`:game.drawn?'Kartu barumu cocok. Mainkan atau simpan.':'Giliranmu ✦'):`Menunggu ${game.turn}…`;
  const mode=game.mode||'snoomy';
  $('#game-mode').textContent=`${MODE[mode].name}${mode==='balik'&&game.status!=='none'?` · sisi ${game.side==='dark'?'gelap':'terang'}`:''}`;
  $('#game-mode').hidden=game.status==='none';
  panel.dataset.mode=mode;panel.dataset.side=game.side||'light';
  for(const list of section.querySelectorAll('[data-rules]'))list.hidden=list.dataset.rules!==mode;
  $('#game-status').textContent=status;
  $('#game-status').classList.toggle('yours',yourTurn);
  $('#game-new').textContent=game.status==='playing'?'Mulai ulang':'Main baru';
  $('#game-table').hidden=game.status==='none';
  $('#game-empty').hidden=game.status!=='none';
  feedback(before,yourTurn);
  if(game.status==='none')return;
  $('#game-opponent-name').textContent=`${game.opponent} · ${game.opponentCount} kartu`;
  $('#game-last').textContent=game.log.at(-1)?.text||'';
  // Bolak-balik: the back of your partner's cards is their other side, so you see it as at a real table.
  const otherSide=game.side==='dark'?'light':'dark';
  backs.replaceChildren(...(game.opponentBacks?game.opponentBacks.slice(0,14).map(card=>face(card,'span',otherSide)):Array.from({length:Math.min(game.opponentCount,14)},()=>el('span',null,'card back'))));
  backs.classList.toggle('faces',!!game.opponentBacks);
  backs.setAttribute('aria-label',`${game.opponent} memegang ${game.opponentCount} kartu`);
  $('#game-draw-count').textContent=yourTurn&&game.penalty?`Ambil ${game.penalty} kartu`:`${game.drawCount} kartu`;
  drawPile.disabled=!yourTurn||!!game.drawn||selected.length>0;
  drawPile.classList.toggle('owed',yourTurn&&game.penalty>0);
  drawPile.setAttribute('aria-label',yourTurn&&game.penalty?`Ambil ${game.penalty} kartu`:'Ambil satu kartu');
  $('#game-penalty').hidden=!game.penalty;
  $('#game-penalty').textContent=`+${game.penalty}`;
  const topCard=face(game.top);top.replaceChildren(topCard);
  $('#game-flavor').replaceChildren(symbol(game.flavor),el('span',`${game.side==='dark'?'Warna':'Rasa'} sekarang: ${FLAVOR[game.flavor].name}`));
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
  hand.classList.toggle('waiting',!yourTurn);
  hand.setAttribute('aria-label',`Kartumu, ${cards.length} kartu`);
  const last=selected.length?byId(selected.at(-1)):null;
  $('#game-you-name').textContent=selected.length?(isWild(last)?`${selected.length} dipilih · ketuk kartu sejenis untuk menumpuk`:`${selected.length} dipilih · rasa berikutnya ${FLAVOR[last.f].name}`):`Kartumu · ${game.hand.length}`;
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
  if(!onPage())return;
  if(yourTurn&&before.status==='playing'&&before.turn!==game.you){
   buzz(game.penalty?[30,60,30]:25);
   sound(game.penalty?'penalty':'turn');
  }
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
 // Only the open table polls; while it is closed the game picker checks every game now and then.
 function schedule(){
  clearTimeout(timer);
  if(!user||!onPage()||document.hidden)return;
  timer=setTimeout(async()=>{await load();schedule();},game?.status==='playing'&&game.turn!==game.you?1500:5000);
 }
 function stop(){clearTimeout(timer);user=null;game=null;selected=[];}
 async function send(path,body={}){
  if(busy||!game)return;
  busy=true;panel.setAttribute('aria-busy','true');
  try{const next=await api(path,{...body,version:game.version});busy=false;render(next);}
  catch(error){busy=false;notify(error.message);if(error.status===409)await load();}
  finally{busy=false;panel.removeAttribute('aria-busy');schedule();}
 }
 function commit(ids,box){
  from=box;played=ids.length;selected=[];
  if(isWild(byId(ids[0]))){pendingWild=ids;openPick();renderHand();return;}
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
  // Only Kartu Snoomy lets twins be played together.
  if(game.mode==='snoomy'&&game.hand.some(other=>other.id!==card.id&&other.v===card.v)){selected=[card.id];sound('tap');renderHand();return;}
  commit([card.id],button.getBoundingClientRect());
 });
 stackPlay.addEventListener('click',()=>{
  const first=hand.querySelector(`[data-id="${selected[0]}"]`);
  commit([...selected],first?.getBoundingClientRect()||null);
 });
 stackCancel.addEventListener('click',()=>{selected=[];renderHand();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selected.length&&onPage()&&!document.querySelector('dialog[open]')){selected=[];renderHand();}});
 // The colour choice follows the side in play: the dark side of Bolak-balik has its own four colours.
 function openPick(){
  const colours=game.side==='dark'?DARK:LIGHT;
  pick.querySelector('.flavor-options').replaceChildren(...colours.map(name=>{
   const button=el('button',null,name);button.type='button';button.dataset.flavor=name;
   button.append(symbol(name),FLAVOR[name].name);return button;
  }));
  pick.querySelector('h2').textContent=game.side==='dark'?'Pilih warna baru':'Pilih rasa baru';
  pick.showModal();
 }
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
 // A new match asks which rule set to play; "Main lagi" keeps the current one.
 const modePick=$('#game-mode-pick');
 const chooseMode=restart=>{
  restarting=restart;
  for(const button of modePick.querySelectorAll('[data-mode]'))button.setAttribute('aria-current',String(button.dataset.mode===(game?.mode||'snoomy')));
  modePick.querySelector('[data-mode-hint]').textContent=restart?'Ronde sekarang akan dikocok ulang.':'';
  modePick.showModal();
 };
 for(const [key,info] of Object.entries(MODE)){
  const button=modePick.querySelector(`[data-mode="${key}"]`);
  if(button)button.replaceChildren(el('strong',info.name),el('small',info.note));
 }
 modePick.addEventListener('click',event=>{
  if(event.target.closest('[data-mode-close]')){modePick.close();return;}
  const choice=event.target.closest('[data-mode]');
  if(!choice)return;
  modePick.close();selected=[];
  send('/new',{mode:choice.dataset.mode,...(restarting?{restart:true}:{})});
 });
 $('#game-new').addEventListener('click',()=>chooseMode(game?.status==='playing'));
 $('#game-again').addEventListener('click',()=>{selected=[];send('/new',{});});
 $('#game-start').addEventListener('click',()=>chooseMode(false));

 document.addEventListener('snoomy-session',event=>{
  const next=event.detail?.user||null;
  if(next===user)return;
  stop();user=next;
  if(user){load();schedule();}
 });
 document.addEventListener('snoomy-route',()=>{if(onPage())load();schedule();});
 document.addEventListener('snoomy-game',()=>{if(onPage())load();schedule();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&onPage())load();schedule();});
})();
