// Empat Sejajar: seven column buttons; a tap drops your disc into that column.
(() => {
 const games=window.SnoomyGames,panel=document.querySelector('#play-four');
 if(!games||!panel)return;
 const ROWS=6,COLS=7,COLOR={Moreno:'matcha',Cahya:'stroberi'};
 const board=panel.querySelector('[data-board]'),players=panel.querySelector('[data-players]');
 const columns=Array.from({length:COLS},(_,col)=>{
  const button=document.createElement('button');
  button.type='button';button.className='four-col';button.dataset.col=col;button.disabled=true;
  for(let row=0;row<ROWS;row++){const cell=document.createElement('span');cell.className='four-cell';button.append(cell);}
  return button;
 });
 board.replaceChildren(...columns);
 const disc=who=>{
  const node=document.createElement('i');node.className=`disc ${COLOR[who]}`;
  const face=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');
  face.setAttribute('class','ci');face.setAttribute('aria-hidden','true');use.setAttribute('href',`#cs-${COLOR[who]}`);face.append(use);
  node.append(face);return node;
 };

 const ctrl=games.board('four',{
  prompt:()=>'Giliranmu, pilih kolom ✦',
  restartText:'Mulai ulang ronde ini? Semua koin akan dikosongkan.',
  render(game,before,{yourTurn,animate}){
   const fresh=game.last&&game.last.n!==before?.last?.n?game.last:null;
   const winning=new Set((game.line||[]).map(([r,c])=>`${r},${c}`));
   columns.forEach((button,col)=>{
    const free=game.board.findLastIndex(cells=>!cells[col]);
    button.disabled=!yourTurn||free<0;
    button.setAttribute('aria-label',free<0?`Kolom ${col+1} penuh`:`Kolom ${col+1}, ${free+1} lubang kosong`);
    [...button.children].forEach((cell,row)=>{
     const who=game.board[row][col],current=cell.firstChild?.classList[1];
     if(!who)cell.replaceChildren();
     else if(current!==COLOR[who])cell.replaceChildren(disc(who));
     cell.classList.toggle('win',winning.has(`${row},${col}`));
    });
   });
   players.replaceChildren(...['Moreno','Cahya'].map(user=>{
    const row=document.createElement('p');
    row.className=`board-player ${COLOR[user]}${game.turn===user&&game.status==='playing'?' turn':''}`;
    row.textContent=`${user===game.you?'Kamu':user} · ${COLOR[user]==='matcha'?'koin matcha':'koin stroberi'}`;
    return row;
   }));
   if(!fresh||!animate)return;
   // The new disc falls from the top of its column and settles with a small bounce.
   const cell=columns[fresh.col].children[fresh.row],piece=cell.firstChild;
   games.sound('play');
   window.gsap.from(piece,{y:-(fresh.row+1)*cell.offsetHeight*1.08,duration:.32+fresh.row*.05,ease:'bounce.out',clearProps:'transform'});
   if(game.line)window.gsap.fromTo(board.querySelectorAll('.four-cell.win .disc'),{scale:1},{scale:1.14,duration:.25,yoyo:true,repeat:3,delay:.5,ease:'power1.inOut',clearProps:'transform'});
  },
 });
 board.addEventListener('click',event=>{
  const button=event.target.closest('.four-col');
  if(!button||button.disabled)return;
  games.buzz(8);
  ctrl.move({action:'drop',col:Number(button.dataset.col)});
 });
})();
