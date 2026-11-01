// Ludo board: a 15×15 grid drawn once, eight tokens moving on top of it, and a die.
(() => {
 const games=window.SnoomyGames,panel=document.querySelector('#play-ludo');
 if(!games||!panel)return;
 const PLAYERS=['Moreno','Cahya'],COLOR={Moreno:'matcha',Cahya:'stroberi'},FLAVOR={Moreno:'matcha',Cahya:'stroberi'};
 const START={Moreno:1,Cahya:27},SAFE=[1,9,14,22,27,35,40,48],BASE=-1,LAST=50,HOME=56;
 // The 52-square loop, clockwise from the top square of the left arm; [row, column] on the 15×15 board.
 const LOOP=[
  ...[0,1,2,3,4,5].map(c=>[6,c]),...[5,4,3,2,1,0].map(r=>[r,6]),[0,7],
  ...[0,1,2,3,4,5].map(r=>[r,8]),...[9,10,11,12,13,14].map(c=>[6,c]),[7,14],
  ...[14,13,12,11,10,9].map(c=>[8,c]),...[9,10,11,12,13,14].map(r=>[r,8]),[14,7],
  ...[14,13,12,11,10,9].map(r=>[r,6]),...[5,4,3,2,1,0].map(c=>[8,c]),[7,0],
 ];
 const YARD={Moreno:[[1.5,1.5],[1.5,3.5],[3.5,1.5],[3.5,3.5]],Cahya:[[10.5,10.5],[10.5,12.5],[12.5,10.5],[12.5,12.5]]};
 const LANE={Moreno:p=>[7,p-LAST],Cahya:p=>[7,14-(p-LAST)]};
 const NEST={Moreno:[7,6],Cahya:[7,8]};
 const spot=(user,progress,index)=>progress===BASE?YARD[user][index]:progress===HOME?NEST[user]:progress>LAST?LANE[user](progress):LOOP[(START[user]+progress)%52];
 const where=progress=>progress===BASE?'di kandang':progress===HOME?'sudah pulang':progress>LAST?`di jalur pulang (${HOME-progress} lagi)`:`${HOME-progress} langkah lagi`;

 const board=panel.querySelector('[data-board]'),diceButton=panel.querySelector('[data-roll]'),hint=panel.querySelector('[data-hint]'),players=panel.querySelector('[data-players]');
 const layer=document.createElement('div');layer.className='token-layer';
 const tokens={};
 function build(){
  const cells=[];
  const add=(r,c,className,rows=1,cols=1)=>{const cell=document.createElement('span');cell.className=className;cell.style.gridArea=`${r+1}/${c+1}/span ${rows}/span ${cols}`;cells.push(cell);};
  add(0,0,'yard matcha',6,6);add(0,9,'yard taro',6,6);add(9,0,'yard vanila',6,6);add(9,9,'yard stroberi',6,6);
  add(6,6,'nest',3,3);
  const owner={1:'matcha',14:'taro',27:'stroberi',40:'vanila'};
  LOOP.forEach(([r,c],i)=>add(r,c,`track${owner[i]?` start ${owner[i]}`:SAFE.includes(i)?' star':''}`));
  for(let k=1;k<=5;k++){add(7,k,'track lane matcha');add(7,14-k,'track lane stroberi');add(k,7,'track lane taro');add(14-k,7,'track lane vanila');}
  for(const user of PLAYERS)tokens[user]=[0,1,2,3].map(index=>{
   const token=document.createElement('button');
   token.type='button';token.className=`token ${COLOR[user]}`;token.disabled=true;token.dataset.user=user;token.dataset.index=index;
   const face=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');
   face.setAttribute('class','ci');face.setAttribute('aria-hidden','true');use.setAttribute('href',`#cs-${FLAVOR[user]}`);face.append(use);
   token.append(face);layer.append(token);return token;
  });
  board.replaceChildren(...cells,layer);
 }
 build();
 const dice=games.dice(diceButton);
 let timeline=null;

 const put=(token,[r,c],scale=1)=>{token.style.setProperty('--y',r);token.style.setProperty('--x',c);token.style.setProperty('--s',scale);token.style.setProperty('--h',0);};
 // Final places for every token; tokens sharing a square sit side by side.
 function place(game){
  const groups=new Map();
  for(const user of PLAYERS)game.tokens[user].forEach((progress,index)=>{
   const at=spot(user,progress,index),key=at.join();
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push([user,index,at]);
  });
  for(const list of groups.values())list.forEach(([user,index,[r,c]],k)=>{
   const [dx,dy,scale]=games.spread(list.length,k);
   put(tokens[user][index],[r+dy,c+dx],progress(game,user,index)===HOME?Math.min(scale,.7):scale);
  });
 }
 const progress=(game,user,index)=>game.tokens[user][index];
 // The squares a token passes through, one hop at a time.
 function path(user,index,from,to){
  if(from===BASE)return [spot(user,0,index)];
  const steps=[];
  for(let p=from+1;p<=to;p++)steps.push(spot(user,p,index));
  return steps;
 }
 function controls(game,{yourTurn}){
  const animating=!!timeline;
  diceButton.disabled=!game.canRoll||animating||game.status!=='playing';
  diceButton.classList.toggle('ready',!diceButton.disabled);
  for(const user of PLAYERS)tokens[user].forEach((token,index)=>{
   const can=!animating&&user===game.you&&game.movable.includes(index);
   token.disabled=!can;token.classList.toggle('movable',can);
   token.setAttribute('aria-label',`Bidak ${index+1} ${user}, ${where(game.tokens[user][index])}${can?'. Ketuk untuk jalan':''}`);
  });
  hint.textContent=game.status!=='playing'?'':game.canRoll?'Ketuk dadu untuk melempar':game.movable.length?`Dadu ${game.dice}: ketuk bidak yang menyala`:yourTurn?'':`${game.turn} sedang main…`;
  players.replaceChildren(...PLAYERS.map(user=>{
   const home=game.tokens[user].filter(p=>p===HOME).length,row=document.createElement('p');
   row.className=`board-player ${COLOR[user]}${game.turn===user&&game.status==='playing'?' turn':''}`;
   row.textContent=`${user===game.you?'Kamu':user} · ${home}/4 pulang`;
   return row;
  }));
  board.setAttribute('aria-label',`Papan ludo. ${PLAYERS.map(user=>`${user}: ${game.tokens[user].filter(p=>p===HOME).length} bidak pulang, ${game.tokens[user].filter(p=>p===BASE).length} di kandang`).join('. ')}.`);
 }

 const ctrl=games.board('ludo',{
  prompt:game=>game.phase==='move'?`Dadu ${game.dice}. Pilih bidak yang jalan`:'Giliranmu, lempar dadu ✦',
  render(game,before,context){
   timeline?.kill();timeline=null;
   const last=game.last,earlier=before?.last;
   // A roll is new when its number changed; a move is new when a token was picked since (or with) that roll.
   const rolled=!!last&&last.n!==earlier?.n,moved=!!last&&last.token!=null&&(rolled||earlier?.token==null);
   if(!context.animate||!(rolled||moved)){
    dice.show(game.dice);place(game);controls(game,context);return;
   }
   // Replay the newest roll: the die, then the token hopping square by square, then anyone it captured.
   place(before);
   const tl=window.gsap.timeline({onComplete:()=>{timeline=null;place(game);controls(game,context);}});
   timeline=tl;
   if(rolled)dice.roll(tl,last.roll);else dice.show(last.roll);
   if(moved){
    const token=tokens[last.who][last.token];
    path(last.who,last.token,last.from,last.to).forEach(([r,c],i)=>{
     tl.to(token,{'--y':r,'--x':c,'--s':1,duration:.14,ease:'power1.inOut',onStart:()=>games.sound('tap')},i?'>':'+=.05');
     tl.to(token,{'--h':-.35,duration:.07,yoyo:true,repeat:1,ease:'power1.out'},'<');
    });
    for(const hit of last.captured||[]){
     const victim=tokens[PLAYERS.find(user=>user!==last.who)][hit.token];
     tl.add(()=>games.sound('lose'));
     tl.to(victim,{'--y':YARD[victim.dataset.user][hit.token][0],'--x':YARD[victim.dataset.user][hit.token][1],'--s':1,duration:.45,ease:'power2.inOut'});
    }
   }
   controls(game,context);
  },
 });
 diceButton.addEventListener('click',()=>{if(!diceButton.disabled){games.buzz(8);ctrl.move({action:'roll'});}});
 layer.addEventListener('click',event=>{
  const token=event.target.closest('.token');
  if(!token||token.disabled)return;
  games.buzz(8);
  ctrl.move({action:'move',token:Number(token.dataset.index)});
 });
})();
