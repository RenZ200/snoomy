// Seberapa Kenal Aku: answer in secret, open together. Open answers are judged by the person the question is about.
(() => {
 const games=window.SnoomyGames,panel=document.querySelector('#play-quiz');
 if(!games||!panel)return;
 const part=name=>panel.querySelector(`[data-${name}]`);
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
 const button=(text,data,className)=>{const node=el('button',text,className);node.type='button';Object.assign(node.dataset,data);return node;};
 let shown='';

 const lead=(game,q)=>q.kind==='who'?'Menurut kamu':q.about===game.you?'Jawab jujur soal kamu':`Tebak jawaban ${q.about}`;
 const verdict=entry=>entry.kind==='who'?(entry.right?'Kompak ♡':'Beda jawaban'):entry.right?`${entry.about==='Moreno'?'Cahya':'Moreno'} bener`:`${entry.about==='Moreno'?'Cahya':'Moreno'} salah`;
 function answers(game,list){
  const box=el('div',null,'quiz-answers');
  for(const name of ['Moreno','Cahya']){const item=el('p',null,'quiz-answer');item.append(el('small',name===game.you?'Kamu':name),el('span',list[name]));box.append(item);}
  return box;
 }
 function stage(game){
  const box=part('stage'),q=game.question;
  if(game.status==='finished'){
   box.replaceChildren(el('h3',`Skor ronde ini: ${game.you} ${game.scores[game.you]}, ${game.opponent} ${game.scores[game.opponent]}`,'quiz-final'),
    ...game.past.map(entry=>{const row=el('article',null,`quiz-past ${entry.right?'right':'wrong'}`);row.append(el('p',entry.text,'quiz-past-q'),answers(game,entry.answers),el('small',verdict(entry)));return row;}));
   shown='';
   return;
  }
  // A poll must not wipe an answer that is still being typed.
  const key=`${game.you}.${game.round}.${game.index}.${game.stage}.${game.yours!=null}`;
  if(key===shown)return;
  shown=key;
  const card=el('article',null,'quiz-card');
  card.append(el('p',`Pertanyaan ${game.index+1} dari ${game.total}${q.custom?` · dari ${q.about}`:''}`,'quiz-count'),el('small',lead(game,q),'quiz-lead'),el('h3',q.text));
  if(game.stage==='reveal'){
   card.append(answers(game,game.answers));
   if(q.kind==='know'){
    if(q.about===game.you){const row=el('div',null,'quiz-actions');row.append(el('p',`Tebakan ${game.opponent} bener nggak?`),button('Bener',{mark:'yes'}),button('Salah',{mark:'no'},'secondary'));card.append(row);}
    else card.append(el('p',`Nunggu ${q.about} nilai jawabanmu…`,'quiz-wait'));
   }else{
    card.append(el('p',game.right?(q.kind==='who'?'Kompak! Dua-duanya dapet poin ♡':`${q.about===game.you?game.opponent:'Kamu'} bener ♡`):q.kind==='who'?'Beda jawaban, nggak ada poin.':`${q.about===game.you?game.opponent:'Kamu'} salah nebak.`,'quiz-wait'),button('Lanjut',{next:'1'}));
   }
  }else if(game.yours!=null){
   card.append(el('p',`Jawabanmu: ${game.yours}`,'quiz-mine'),el('p',`Nunggu ${game.opponent} jawab. Jawabanmu masih rahasia.`,'quiz-wait'));
  }else if(q.kind==='know'){
   const form=el('form',null,'quiz-form'),input=el('input');
   input.type='text';input.name='text';input.maxLength=120;input.required=true;input.autocomplete='off';input.placeholder='Tulis jawabanmu…';input.setAttribute('aria-label','Jawabanmu');
   form.append(input,button('Kirim',{}));form.lastChild.type='submit';card.append(form);
  }else{
   const row=el('div',null,'quiz-choices');
   for(const option of q.kind==='who'?['Moreno','Cahya']:q.options)row.append(button(option,{answer:option},'secondary'));
   card.append(row);
  }
  const last=game.last&&game.stage==='answer'?el('div',null,`quiz-past ${game.last.right?'right':'wrong'}`):null;
  if(last)last.append(el('p',`Barusan: ${game.last.text}`,'quiz-past-q'),answers(game,game.last.answers),el('small',verdict(game.last)));
  box.replaceChildren(card,...(last?[last]:[]));
  if(window.gsap&&games.moving()&&games.isOpen('quiz'))window.gsap.from(card,{y:14,opacity:0,duration:.35,ease:'power2.out',clearProps:'all'});
 }
 function queue(game){
  part('mine').replaceChildren(...game.mine.map(item=>{const row=el('li');row.append(el('span',item.text),button('Hapus',{unask:item.id},'quiz-remove'));row.lastChild.setAttribute('aria-label',`Hapus pertanyaan: ${item.text}`);return row;}));
  part('theirs').textContent=game.theirs?`${game.opponent} nyiapin ${game.theirs} pertanyaan rahasia ✦`:'';
 }
 const ctrl=games.board('quiz',{
  prompt:game=>game.stage==='reveal'?(game.question.kind==='know'?'Nilai jawabannya ✦':'Jawabannya kebuka ✦'):'Jawab diem-diem ✦',
  result:game=>game.winner?`${game.winner===game.you?'Kamu':game.winner} paling kenal! ${Math.max(...Object.values(game.scores))}–${Math.min(...Object.values(game.scores))}`:'Seri! Sama-sama kenal ♡',
  restartText:'Mulai ulang ronde ini? Jawaban ronde ini akan hilang.',
  render(game,before,{open}){
   if(open&&before?.stage==='answer'&&game.stage==='reveal')games.sound('draw');
   stage(game);queue(game);
   part('players').replaceChildren(...['Moreno','Cahya'].map(user=>{
    const row=el('p',`${user===game.you?'Kamu':user} · ${game.scores[user]} poin`,`board-player ${user==='Moreno'?'matcha':'stroberi'}${game.turn===user&&game.status==='playing'?' turn':''}`);
    return row;
   }));
  },
 });
 part('stage').addEventListener('click',event=>{
  const target=event.target.closest('button');
  if(!target)return;
  if(target.dataset.answer){games.buzz(8);ctrl.move({action:'answer',text:target.dataset.answer});}
  if(target.dataset.mark){games.buzz(8);ctrl.move({action:'mark',right:target.dataset.mark==='yes'});}
  if(target.dataset.next)ctrl.move({action:'next'});
 });
 part('stage').addEventListener('submit',event=>{
  event.preventDefault();
  const text=event.target.elements.text.value.trim();
  if(text){games.buzz(8);ctrl.move({action:'answer',text});}
 });
 part('ask').addEventListener('submit',async event=>{
  event.preventDefault();
  const input=part('ask-text'),text=input.value.trim();
  if(!text)return;
  if(await ctrl.move({action:'ask',text}))input.value='';
 });
 part('mine').addEventListener('click',event=>{
  const id=event.target.closest('[data-unask]')?.dataset.unask;
  if(id)ctrl.move({action:'unask',id:Number(id)});
 });
})();
