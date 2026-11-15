// Kartu Ngobrol: one card on a shared table. Either of you opens the next one (button, swipe or a deck chip) and the
// old card flies off the stack on both phones.
(() => {
 const games=window.SnoomyGames,panel=document.querySelector('#play-talk');
 if(!games||!panel)return;
 const part=name=>panel.querySelector(`[data-${name}]`);
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
 const card=part('card'),stack=part('stack'),SWIPE=80;
 let throwTo=-1,drag=null,deckKey='';

 // The card that was on top leaves as a copy, so the real card can already show the next text underneath it.
 function deal(){
  const ghost=card.cloneNode(true);
  ghost.classList.add('ghost');ghost.setAttribute('aria-hidden','true');ghost.removeAttribute('data-card');
  ghost.style.setProperty('--to',throwTo);
  for(const node of ghost.querySelectorAll('[data-card-save]'))node.tabIndex=-1;
  stack.append(ghost);
  setTimeout(()=>ghost.remove(),600);
  card.style.transform='';
  card.classList.remove('enter','settle');void card.offsetWidth;card.classList.add('enter');
  throwTo=-1;
 }

 const ctrl=games.board('talk',{
  note:game=>game.by&&game.by!==game.you?`${game.by} buka kartu ini ✦`:'Kartu ini buat kalian berdua ✦',
  render(game,before,{open}){
   const fresh=!!before&&before.status!=='none'&&before.n!==game.n;
   if(fresh&&open&&games.moving())deal();else card.style.transform='';
   card.dataset.deck=game.card.deck;
   part('card-label').textContent=game.card.label;
   part('card-no').textContent=`#${game.n}`;
   part('card-text').textContent=game.card.text;
   part('card-text').classList.toggle('long',game.card.text.length>90);
   part('card-by').textContent=game.by?`Dibuka ${game.by===game.you?'kamu':game.by}`:'';
   const save=part('card-save'),was=save.getAttribute('aria-pressed')==='true';
   save.textContent=game.isSaved?'♥ Disimpan':'♡ Simpan';
   save.setAttribute('aria-pressed',String(game.isSaved));
   if(game.isSaved&&!was&&!fresh&&before){save.classList.remove('pop');void save.offsetWidth;save.classList.add('pop');}
   const decks=part('decks'),key=game.decks.map(deck=>deck.id).join();
   if(key!==deckKey){
    deckKey=key;
    decks.replaceChildren(...game.decks.map(deck=>{
     const button=el('button',deck.label,'talk-deck');
     button.type='button';button.dataset.deck=deck.id;
     return button;
    }));
   }
   for(const button of decks.children)button.setAttribute('aria-pressed',String(button.dataset.deck===game.deck));
   part('count').textContent=`${game.total} kartu · ${game.n} udah kebuka`;
   part('saved-count').textContent=game.saved.length;
   part('saved').replaceChildren(...game.saved.map(item=>{
    const row=el('li');row.append(el('small',item.label),el('span',item.text));
    const remove=el('button','Hapus','quiz-remove');remove.type='button';remove.dataset.unsave=item.id;remove.setAttribute('aria-label',`Hapus dari simpanan: ${item.text}`);
    row.append(remove);return row;
   }));
   if(fresh&&open)games.sound('draw');
  },
 });
 const next=async(body,direction=-1)=>{
  games.buzz(8);throwTo=direction;
  if(!await ctrl.move({action:'next',...body})){throwTo=-1;card.classList.add('settle');card.style.transform='';}
 };
 part('next').addEventListener('click',()=>next());
 part('card-save').addEventListener('click',()=>{games.buzz(8);ctrl.move({action:'save'});});
 part('decks').addEventListener('click',event=>{
  const deck=event.target.closest('[data-deck]')?.dataset.deck;
  if(deck)next({deck});
 });
 part('saved').addEventListener('click',event=>{
  const id=event.target.closest('[data-unsave]')?.dataset.unsave;
  if(id)ctrl.move({action:'save',id:Number(id)});
 });

 // Swipe the card sideways to open the next one. Up and down still scroll the page.
 card.addEventListener('pointerdown',event=>{
  if(event.target.closest('button')||ctrl.busy||!event.isPrimary)return;
  drag={id:event.pointerId,x:event.clientX,dx:0};
  card.classList.remove('settle','enter');
 });
 card.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  drag.dx=event.clientX-drag.x;
  if(Math.abs(drag.dx)<6)return;
  try{card.setPointerCapture(drag.id);}catch{}
  card.style.transform=`translateX(${drag.dx}px) rotate(${drag.dx/22}deg)`;
 });
 const release=event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const {dx}=drag;drag=null;
  if(event.type==='pointerup'&&Math.abs(dx)>SWIPE)next({},Math.sign(dx));
  else{card.classList.add('settle');card.style.transform='';}
 };
 card.addEventListener('pointerup',release);
 card.addEventListener('pointercancel',release);
 card.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();next({},event.key==='ArrowRight'?1:-1);}});
})();
