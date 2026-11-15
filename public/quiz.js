// Seberapa Kenal Aku: answer in secret, open together. Open answers are judged by the person the question is about.
(() => {
 const games=window.SnoomyGames,panel=document.querySelector('#play-quiz');
 if(!games||!panel)return;
 const part=name=>panel.querySelector(`[data-${name}]`);
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
 const button=(text,data,className)=>{const node=el('button',text,className);node.type='button';Object.assign(node.dataset,data);return node;};
 const KIND={know:'Tebak-tebakan',pair:'Pilih satu',who:'Siapa hayo'};
 const rival=name=>name==='Moreno'?'Cahya':'Moreno',tone=name=>name==='Moreno'?'matcha':'stroberi';
 let shown='';

 const lead=(game,q)=>q.kind==='who'?'Menurut kamu':q.about===game.you?'Jawab jujur soal kamu':`Tebak jawaban ${q.about}`;
 const verdict=entry=>entry.kind==='who'?(entry.right?'Kompak ♡':'Beda jawaban'):`${rival(entry.about)} ${entry.right?'bener':'salah'}`;
 const stamp=(right,text)=>el('span',text,`quiz-stamp ${right?'right':'wrong'}`);
 function answers(game,list){
  const box=el('div',null,'quiz-answers');
  for(const name of ['Moreno','Cahya']){const item=el('p',null,`quiz-answer ${tone(name)}`);item.append(el('small',name===game.you?'Kamu':name),el('span',list[name]));box.append(item);}
  return box;
 }
 function waiting(text){
  const line=el('p',text,'quiz-wait'),dots=el('span',null,'dots');
  dots.setAttribute('aria-hidden','true');dots.append(el('i'),el('i'),el('i'));
  line.append(dots);return line;
 }
 function steps(game){
  const list=el('ol',null,'quiz-steps');
  list.setAttribute('aria-label',`Pertanyaan ${game.index+1} dari ${game.total}`);
  for(let i=0;i<game.total;i++)list.append(el('li',null,i<game.index?'done':i===game.index?'now':''));
  return list;
 }
 function recap(game,entry,prefix=''){
  const row=el('article',null,`quiz-past ${entry.right?'right':'wrong'}`);
  row.append(el('p',prefix+entry.text,'quiz-past-q'),answers(game,entry.answers),stamp(entry.right,verdict(entry)));
  return row;
 }
 function stage(game){
  const box=part('stage'),q=game.question;
  // A poll must not wipe an answer that is still being typed, nor restart an entrance that is still playing.
  const key=game.status==='finished'?`${game.you}.${game.round}.done`:`${game.you}.${game.round}.${game.index}.${game.stage}.${game.yours!=null}`;
  if(key===shown)return;
  shown=key;
  if(game.status==='finished'){
   const final=el('div',null,'quiz-final');
   for(const name of [game.you,game.opponent]){const total=el('p',null,`quiz-total ${tone(name)}${game.winner===name?' best':''}`);total.append(el('strong',String(game.scores[name])),el('small',name===game.you?'Kamu':name));final.append(total);}
   final.children[0].after(el('span','poin','quiz-total-mid'));
   box.replaceChildren(final,...game.past.map((entry,index)=>{const row=recap(game,entry,`${index+1}. `);row.style.setProperty('--i',index);return row;}));
   return;
  }
  const card=el('article',null,`quiz-card enter kind-${q.kind}`),head=el('div',null,'quiz-top');
  head.append(el('span',KIND[q.kind],'quiz-kind'),el('span',`${game.index+1} / ${game.total}`,'quiz-count'));
  card.append(head,steps(game),el('small',lead(game,q)+(q.custom?` · soal dari ${q.about}`:''),'quiz-lead'),el('h3',q.text));
  if(game.stage==='reveal'){
   const both=answers(game,game.answers);
   both.classList.add('reveal');card.append(both);
   if(q.kind==='know'){
    if(q.about===game.you){const row=el('div',null,'quiz-actions');row.append(el('p',`Tebakan ${game.opponent} bener nggak?`),button('Bener ♡',{mark:'yes'}),button('Salah',{mark:'no'},'secondary'));card.append(row);}
    else card.append(waiting(`Nunggu ${q.about} nilai jawabanmu`));
   }else{
    const row=el('div',null,'quiz-actions');
    row.append(stamp(game.right,game.right?(q.kind==='who'?'Kompak! +1 buat berdua':`${q.about===game.you?game.opponent:'Kamu'} bener`):q.kind==='who'?'Beda jawaban':`${q.about===game.you?game.opponent:'Kamu'} salah nebak`),button('Lanjut',{next:'1'}));
    card.append(row);
   }
  }else if(game.yours!=null){
   const mine=el('p',null,'quiz-mine');
   mine.append(el('small','Jawabanmu dikunci'),el('span',game.yours));
   card.append(mine,waiting(`Nunggu ${game.opponent} jawab`));
  }else if(q.kind==='know'){
   const form=el('form',null,'quiz-form'),input=el('input');
   input.type='text';input.name='text';input.maxLength=120;input.required=true;input.autocomplete='off';input.placeholder='Tulis jawabanmu…';input.setAttribute('aria-label','Jawabanmu');
   form.append(input,button('Kunci',{}));form.lastChild.type='submit';card.append(form);
  }else if(q.kind==='pair'){
   const row=el('div',null,'quiz-choices pair');
   row.append(button(q.options[0],{answer:q.options[0]},'quiz-pick matcha'),el('span','atau','quiz-or'),button(q.options[1],{answer:q.options[1]},'quiz-pick stroberi'));
   card.append(row);
  }else{
   const row=el('div',null,'quiz-choices');
   for(const name of ['Moreno','Cahya']){const pick=button(null,{answer:name},`quiz-pick who ${tone(name)}`);pick.append(el('i',name[0]),el('span',name===game.you?'Aku':name));row.append(pick);}
   card.append(row);
  }
  box.replaceChildren(card,...(game.last&&game.stage==='answer'?[recap(game,game.last,'Barusan: ')]:[]));
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
   const sameRound=before?.status==='playing'&&before.round===game.round;
   const opened=sameRound&&before.stage==='answer'&&game.stage==='reveal'&&before.index===game.index;
   const judged=sameRound&&(game.index>before.index||game.status==='finished')&&game.last?.kind==='know';
   stage(game);queue(game);
   part('players').replaceChildren(...['Moreno','Cahya'].map(user=>
    el('p',`${user===game.you?'Kamu':user} · ${game.scores[user]} poin`,`board-player ${tone(user)}${game.turn===user&&game.status==='playing'?' turn':''}${sameRound&&game.scores[user]>before.scores[user]?' bump':''}`)));
   if(!open)return;
   if(opened)games.sound('draw');
   if((opened&&game.right)||(judged&&game.last.right)){games.sound('pop');games.confetti(part('stage').firstElementChild,18);}
  },
 });
 part('stage').addEventListener('click',event=>{
  const target=event.target.closest('button');
  if(!target)return;
  if(target.dataset.answer){games.buzz(8);target.classList.add('chosen');ctrl.move({action:'answer',text:target.dataset.answer});}
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
