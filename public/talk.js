// Kartu Ngobrol: one card on a shared table. Either of you opens the next one and it flips on both phones.
(() => {
 const games=window.SnoomyGames,panel=document.querySelector('#play-talk');
 if(!games||!panel)return;
 const part=name=>panel.querySelector(`[data-${name}]`);
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
 const card=part('card');

 const ctrl=games.board('talk',{
  note:game=>game.by&&game.by!==game.you?`${game.by} buka kartu ini ✦`:'Kartu ini buat kalian berdua ✦',
  render(game,before,{open,animate}){
   const fresh=before?.n!==game.n;
   card.dataset.deck=game.card.deck;
   part('card-label').textContent=game.card.label;
   part('card-text').textContent=game.card.text;
   const save=part('card-save');
   save.textContent=game.isSaved?'♥ Disimpan':'♡ Simpan';
   save.setAttribute('aria-pressed',String(game.isSaved));
   part('decks').replaceChildren(...game.decks.map(deck=>{
    const button=el('button',deck.label,'talk-deck');
    button.type='button';button.dataset.deck=deck.id;button.setAttribute('aria-pressed',String(deck.id===game.deck));
    return button;
   }));
   part('count').textContent=`${game.total} kartu · ${game.n} udah kebuka`;
   part('saved-count').textContent=game.saved.length;
   part('saved').replaceChildren(...game.saved.map(item=>{
    const row=el('li');row.append(el('small',item.label),el('span',item.text));
    const remove=el('button','Hapus','quiz-remove');remove.type='button';remove.dataset.unsave=item.id;remove.setAttribute('aria-label',`Hapus dari simpanan: ${item.text}`);
    row.append(remove);return row;
   }));
   if(!fresh||!before)return;
   if(open)games.sound('draw');
   if(animate)window.gsap.fromTo(card,{rotationY:-80,opacity:.3},{rotationY:0,opacity:1,duration:.42,ease:'back.out(1.5)',clearProps:'transform,opacity'});
  },
 });
 part('next').addEventListener('click',()=>{games.buzz(8);ctrl.move({action:'next'});});
 part('card-save').addEventListener('click',()=>{games.buzz(8);ctrl.move({action:'save'});});
 part('decks').addEventListener('click',event=>{
  const deck=event.target.closest('[data-deck]')?.dataset.deck;
  if(deck){games.buzz(8);ctrl.move({action:'next',deck});}
 });
 part('saved').addEventListener('click',event=>{
  const id=event.target.closest('[data-unsave]')?.dataset.unsave;
  if(id)ctrl.move({action:'save',id:Number(id)});
 });
})();
