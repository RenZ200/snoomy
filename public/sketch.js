// Tebak Gambar: a shared canvas. The drawer's strokes go up every moment or so, the guesser's copy redraws from them.
(() => {
 const games=window.SnoomyGames,panel=document.querySelector('#play-sketch');
 if(!games||!panel)return;
 const COLORS=['#241726','#E75CA6','#D6483C','#E8A33D','#93AE6B','#5B8FB9','#8B6BB1','#fffcf5'],ERASER=7,SIZES=[5,11,24],SEND_EVERY=1100,MAX_POINTS=11000;
 const part=name=>panel.querySelector(`[data-${name}]`);
 const canvas=part('canvas'),paint=canvas.getContext('2d'),players=part('players');
 let strokes=[],current=null,dirty=false,from=0,sending=false,timer=null,round=0,color=0,size=1,saved=0;
 const mine=()=>ctrl.game?.status==='playing'&&ctrl.game.stage==='draw'&&ctrl.game.drawer===ctrl.game.you;
 const points=()=>strokes.reduce((total,line)=>total+line.p.length/2,0);

 function line({c,s,p}){
  paint.strokeStyle=paint.fillStyle=COLORS[c];paint.lineWidth=SIZES[s];
  if(p.length===2){paint.beginPath();paint.arc(p[0],p[1],SIZES[s]/2,0,Math.PI*2);paint.fill();return;}
  paint.beginPath();paint.moveTo(p[0],p[1]);
  for(let i=2;i<p.length-2;i+=2)paint.quadraticCurveTo(p[i],p[i+1],(p[i]+p[i+2])/2,(p[i+1]+p[i+3])/2);
  paint.lineTo(p[p.length-2],p[p.length-1]);paint.stroke();
 }
 function redraw(list=strokes){
  paint.fillStyle=COLORS[ERASER];paint.fillRect(0,0,canvas.width,canvas.height);
  paint.lineCap=paint.lineJoin='round';
  list.forEach(line);
 }
 // Everything from `from` onward goes up again, so a stroke still being drawn, an undo and a lost response all heal themselves.
 async function flush(){
  if(sending||!dirty||!mine())return;
  sending=true;dirty=false;
  const start=from;from=current?strokes.length-1:strokes.length;
  try{await ctrl.push({action:'ink',from:start,add:strokes.slice(start)});}
  catch(error){if(mine())touched(start);if(error.status!==409)games.notify(error.message);}
  sending=false;
 }
 const pump=()=>{timer=null;flush();if(dirty&&mine())timer=setTimeout(pump,SEND_EVERY);};
 function touched(index){dirty=true;from=Math.min(from,index);if(!timer)timer=setTimeout(pump,SEND_EVERY);}
 const spot=event=>{const box=canvas.getBoundingClientRect();return [Math.round((event.clientX-box.left)/box.width*canvas.width),Math.round((event.clientY-box.top)/box.height*canvas.height)];};

 canvas.addEventListener('pointerdown',event=>{
  if(!mine()||current)return;
  if(points()>=MAX_POINTS){games.notify('Gambarnya udah kepenuhan. Hapus sedikit dulu.');return;}
  event.preventDefault();canvas.setPointerCapture(event.pointerId);
  current={c:color,s:size,p:spot(event)};strokes.push(current);line(current);touched(strokes.length-1);
 });
 canvas.addEventListener('pointermove',event=>{
  if(!current)return;
  const moves=event.getCoalescedEvents?.();
  for(const moved of moves?.length?moves:[event]){
   const [x,y]=spot(moved),p=current.p;
   if(Math.hypot(x-p[p.length-2],y-p[p.length-1])<4)continue;
   paint.strokeStyle=COLORS[current.c];paint.lineWidth=SIZES[current.s];
   paint.beginPath();paint.moveTo(p[p.length-2],p[p.length-1]);paint.lineTo(x,y);paint.stroke();
   p.push(x,y);
  }
  touched(strokes.length-1);
 });
 const lift=()=>{if(!current)return;current=null;redraw();touched(strokes.length-1);flush();};
 canvas.addEventListener('pointerup',lift);
 canvas.addEventListener('pointercancel',lift);

 part('tools').addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button)return;
  games.buzz(8);
  if(button.dataset.color){color=Number(button.dataset.color);if(color===ERASER&&size===0)size=1;}
  if(button.dataset.size)size=Number(button.dataset.size);
  if(button.dataset.tool==='undo'&&strokes.length){strokes.pop();redraw();touched(strokes.length);}
  if(button.dataset.tool==='clear'&&strokes.length&&confirm('Hapus semua gambarnya?')){strokes=[];redraw();touched(0);}
  tools();
 });
 function tools(){
  for(const button of part('tools').querySelectorAll('[data-color]'))button.setAttribute('aria-pressed',String(Number(button.dataset.color)===color));
  for(const button of part('tools').querySelectorAll('[data-size]'))button.setAttribute('aria-pressed',String(Number(button.dataset.size)===size));
 }
 part('tools').querySelectorAll('[data-color]').forEach(button=>{button.style.setProperty('--swatch',COLORS[button.dataset.color]);});
 tools();

 part('choices').addEventListener('click',event=>{
  const button=event.target.closest('[data-index]');
  if(button){games.buzz(8);ctrl.move({action:'pick',index:Number(button.dataset.index)});}
 });
 part('guess').addEventListener('submit',async event=>{
  event.preventDefault();
  const input=part('guess-text'),text=input.value.trim();
  if(!text)return;
  input.value='';
  try{const game=await ctrl.push({action:'guess',text},3);if(game?.status==='playing')games.sound('pop');}
  catch(error){input.value=text;games.notify(error.message);}
 });
 part('giveup').addEventListener('click',async()=>{
  if(!confirm('Nyerah? Katanya bakal kebuka.'))return;
  try{await ctrl.push({action:'giveup'},3);}catch(error){games.notify(error.message);}
 });
 // The finished drawing goes into the shared album with the word as its caption.
 part('save').addEventListener('click',async()=>{
  const game=ctrl.game,button=part('save');
  button.disabled=true;
  try{
   const blob=await new Promise(done=>canvas.toBlob(done,'image/png'));
   const data=await new Promise((done,fail)=>{const reader=new FileReader();reader.onload=()=>done(String(reader.result).split(',')[1]);reader.onerror=fail;reader.readAsDataURL(blob);});
   const response=await fetch('/api/gallery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,mime:'image/png',key:crypto.randomUUID(),caption:`Tebak Gambar: ${game.word} (gambaran ${game.drawer})`})});
   const reply=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(reply.error||'Belum bisa disimpan. Coba lagi.');
   saved=game.round;button.textContent='Tersimpan ♡';games.notify('Gambarnya masuk ke Galeri ♡');
  }catch(error){button.disabled=false;games.notify(error.message);}
 });

 const ctrl=games.board('sketch',{
  prompt:game=>game.stage==='pick'?'Pilih kata yang mau kamu gambar ✦':'Tebak gambarnya ✦',
  note:game=>game.status==='finished'&&!game.winner?`Ronde ${game.round} nyerah`:game.status==='playing'&&game.stage==='draw'&&game.drawer===game.you?`Gambar yang jelas. ${game.opponent} lagi nebak ✦`:null,
  fast:game=>game.stage==='draw',
  result:game=>game.winner?`${game.winner===game.you?'Kamu':game.winner} bener! Katanya: ${game.word}`:`Nyerah. Katanya: ${game.word}`,
  restartText:'Mulai ulang ronde ini? Gambarnya akan hilang.',
  render(game,before,{yourTurn}){
   const fresh=game.round!==round,drawing=game.status==='playing'&&game.stage==='draw'&&game.drawer===game.you;
   if(fresh){round=game.round;current=null;dirty=false;from=game.strokes.length;strokes=game.strokes;redraw();}
   else if(!drawing){strokes=game.strokes;from=strokes.length;redraw();}
   part('word').textContent=game.status==='finished'||game.drawer===game.you?(game.word||''):game.hint;
   part('word-label').textContent=game.status==='finished'?'Katanya':game.drawer===game.you?'Gambar ini':'Tebak ini';
   part('word-box').hidden=game.stage==='pick';
   part('tools').hidden=!drawing;
   part('guess').hidden=!(game.status==='playing'&&game.stage==='draw'&&game.drawer!==game.you);
   canvas.classList.toggle('can-draw',drawing);
   const picking=game.status==='playing'&&game.stage==='pick';
   part('choices').hidden=!(picking&&yourTurn);
   part('wait').hidden=!(picking&&!yourTurn);
   if(picking)part('wait').textContent=`${game.drawer} lagi milih kata…`;
   if(picking&&yourTurn)part('choices').replaceChildren(...game.choices.map((word,index)=>{const button=document.createElement('button');button.type='button';button.dataset.index=index;button.textContent=word;return button;}));
   const save=part('save');
   save.hidden=game.status!=='finished'||!game.strokes.length;
   if(!save.hidden){save.disabled=saved===game.round;save.textContent=saved===game.round?'Tersimpan ♡':'Simpan ke Galeri';}
   players.replaceChildren(...['Moreno','Cahya'].map(user=>{
    const row=document.createElement('p');
    row.className=`board-player ${user==='Moreno'?'matcha':'stroberi'}${user===game.drawer?' turn':''}`;
    row.textContent=`${user===game.you?'Kamu':user} · ${user===game.drawer?'gambar':'nebak'}`;
    return row;
   }));
  },
 });
})();
