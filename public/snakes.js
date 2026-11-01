// Ular Tangga: a 10×10 board drawn once with its ladders and snakes, two tokens and a die.
(() => {
 const games=window.SnoomyGames,panel=document.querySelector('#play-snakes');
 if(!games||!panel)return;
 const PLAYERS=['Moreno','Cahya'],COLOR={Moreno:'matcha',Cahya:'stroberi'},GOAL=100;
 const LADDERS={3:22,8:30,28:55,36:44,51:72,58:77,71:92,80:99};
 const SNAKES={17:4,32:10,47:26,62:18,74:53,88:69,95:56,97:78};
 const SVG='http://www.w3.org/2000/svg';
 // Square n as [row, column]; 1 is bottom left and the rows run back and forth. 0 is the start strip below the board.
 const cell=(n,user='Moreno')=>{
  if(n<=0)return [10,PLAYERS.indexOf(user)*1.1+.2];
  const i=n-1,up=Math.floor(i/10),across=i%10;
  return [9-up,up%2?9-across:across];
 };
 const centre=n=>{const [r,c]=cell(n);return [c+.5,r+.5];};
 // A snake is one smooth S-curve from its head down to its tail.
 function curve(from,to){
  const [hx,hy]=centre(from),[tx,ty]=centre(to),dx=tx-hx,dy=ty-hy,length=Math.hypot(dx,dy),bend=Math.min(1.3,length*.32);
  const px=-dy/length*bend,py=dx/length*bend;
  return [[hx,hy],[hx+dx*.33+px,hy+dy*.33+py],[hx+dx*.66-px,hy+dy*.66-py],[tx,ty]];
 }
 const bezier=([a,b,c,d],t)=>[0,1].map(k=>(1-t)**3*a[k]+3*(1-t)**2*t*b[k]+3*(1-t)*t*t*c[k]+t**3*d[k]);

 const board=panel.querySelector('[data-board]'),diceButton=panel.querySelector('[data-roll]'),hint=panel.querySelector('[data-hint]'),players=panel.querySelector('[data-players]');
 const layer=document.createElement('div');layer.className='token-layer';
 const tokens={};
 function shape(tag,attributes,parent){const node=document.createElementNS(SVG,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);parent.append(node);return node;}
 function build(){
  const cells=[];
  for(let n=1;n<=GOAL;n++){
   const [r,c]=cell(n),square=document.createElement('span');
   square.className=`square tone-${(r+c)%4}${LADDERS[n]?' ladder-foot':''}${SNAKES[n]?' snake-head':''}${n===GOAL?' goal':''}${{100:' c-tl',91:' c-tr',1:' c-bl',10:' c-br'}[n]||''}`;
   square.style.gridArea=`${r+1}/${c+1}`;
   square.textContent=n===GOAL?'100 ♡':n;
   cells.push(square);
  }
  const strip=document.createElement('span');strip.className='start-strip';strip.textContent='Mulai';cells.push(strip);
  const art=document.createElementNS(SVG,'svg');
  art.setAttribute('class','snakes-art');art.setAttribute('viewBox','0 0 10 10');art.setAttribute('aria-hidden','true');
  for(const [foot,top] of Object.entries(LADDERS)){
   const [ax,ay]=centre(Number(foot)),[bx,by]=centre(top),length=Math.hypot(bx-ax,by-ay),ux=(bx-ax)/length,uy=(by-ay)/length,px=-uy*.17,py=ux*.17;
   const group=shape('g',{class:'ladder'},art);
   for(const side of [1,-1])shape('line',{x1:ax+px*side,y1:ay+py*side,x2:bx+px*side,y2:by+py*side,class:'rail'},group);
   for(let t=.3;t<length-.1;t+=.42)shape('line',{x1:ax+ux*t+px,y1:ay+uy*t+py,x2:ax+ux*t-px,y2:ay+uy*t-py,class:'rung'},group);
  }
  Object.entries(SNAKES).forEach(([head,tail],i)=>{
   const [a,b,c,d]=curve(Number(head),tail),line=`M${a} C${b} ${c} ${d}`;
   const group=shape('g',{class:`snake ${i%2?'taro':'stroberi'}`},art);
   shape('path',{d:line,class:'snake-edge'},group);
   shape('path',{d:line,class:'snake-body'},group);
   shape('path',{d:line,class:'snake-spots'},group);
   shape('circle',{cx:a[0],cy:a[1],r:.24,class:'snake-head'},group);
   for(const side of [-1,1])shape('circle',{cx:a[0]+side*.09,cy:a[1]-.05,r:.045,class:'snake-eye'},group);
  });
  for(const user of PLAYERS){
   const token=document.createElement('span');
   token.className=`token ${COLOR[user]}`;token.setAttribute('aria-hidden','true');
   const face=document.createElementNS(SVG,'svg'),use=document.createElementNS(SVG,'use');
   face.setAttribute('class','ci');use.setAttribute('href',`#cs-${COLOR[user]}`);face.append(use);
   token.append(face);layer.append(token);tokens[user]=token;
  }
  board.replaceChildren(...cells,art,layer);
 }
 build();
 const dice=games.dice(diceButton);
 let timeline=null;

 const put=(token,[r,c],scale=1)=>{token.style.setProperty('--y',r);token.style.setProperty('--x',c);token.style.setProperty('--s',scale);token.style.setProperty('--h',0);};
 function place(game){
  const [a,b]=PLAYERS.map(user=>game.positions[user]);
  PLAYERS.forEach((user,i)=>{
   const shared=a===b&&a>0,[dx,dy,scale]=shared?games.spread(2,i):[0,0,1];
   const [r,c]=cell(game.positions[user],user);
   put(tokens[user],[r+dy,c+dx],scale);
  });
 }
 function controls(game,{yourTurn}){
  const animating=!!timeline;
  diceButton.disabled=!game.canRoll||animating;
  diceButton.classList.toggle('ready',!diceButton.disabled);
  hint.textContent=game.status!=='playing'?'':game.canRoll?'Ketuk dadu untuk melempar':yourTurn?'':`${game.turn} sedang main…`;
  players.replaceChildren(...PLAYERS.map(user=>{
   const row=document.createElement('p'),at=game.positions[user];
   row.className=`board-player ${COLOR[user]}${game.turn===user&&game.status==='playing'?' turn':''}`;
   row.textContent=`${user===game.you?'Kamu':user} · ${at?`petak ${at}`:'belum masuk'}`;
   return row;
  }));
  board.setAttribute('aria-label',`Papan ular tangga. ${PLAYERS.map(user=>`${user} di ${game.positions[user]?`petak ${game.positions[user]}`:'garis mulai'}`).join(', ')}.`);
 }

 const ctrl=games.board('snakes',{
  prompt:()=>'Giliranmu, lempar dadu ✦',
  render(game,before,context){
   timeline?.kill();timeline=null;
   const last=game.last;
   if(!context.animate||!last||last.n===before.last?.n){dice.show(game.dice);place(game);controls(game,context);return;}
   // Replay the newest roll: the die, a hop per square (bouncing back from 100), then the ladder or snake.
   place(before);
   const token=tokens[last.who],tl=window.gsap.timeline({onComplete:()=>{timeline=null;place(game);controls(game,context);}});
   timeline=tl;
   dice.roll(tl,last.roll);
   const steps=[];
   for(let n=last.from+1;n<=Math.min(last.from+last.roll,GOAL);n++)steps.push(n);
   if(last.bounced)for(let n=GOAL-1;n>=last.to;n--)steps.push(n);
   steps.forEach((n,i)=>{
    const [r,c]=cell(n);
    tl.to(token,{'--y':r,'--x':c,'--s':1,duration:.13,ease:'power1.inOut',onStart:()=>games.sound('tap')},i?'>':'+=.05');
    tl.to(token,{'--h':-.4,duration:.065,yoyo:true,repeat:1,ease:'power1.out'},'<');
   });
   if(last.via==='ladder'){
    const [r,c]=cell(last.end);
    tl.add(()=>games.sound('win'),'+=.1');
    tl.to(token,{'--y':r,'--x':c,duration:.7,ease:'power2.inOut'});
   }else if(last.via==='snake'){
    const points=curve(last.to,last.end);
    tl.add(()=>games.sound('lose'),'+=.1');
    for(let k=1;k<=10;k++){const [x,y]=bezier(points,k/10);tl.to(token,{'--x':x-.5,'--y':y-.5,duration:.09,ease:'none'});}
   }
   controls(game,context);
  },
 });
 diceButton.addEventListener('click',()=>{if(!diceButton.disabled){games.buzz(8);ctrl.move({action:'roll'});}});
})();
