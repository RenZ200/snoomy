// Small conveniences: remembered profile, tap-outside to close, offline notice.
(() => {
 const KEY='snoomy-last-user';
 const read=()=>{try{return localStorage.getItem(KEY);}catch{return null;}};
 const write=value=>{try{localStorage.setItem(KEY,value);}catch{}};

 // Each phone usually belongs to one person: preselect their profile and jump to the PIN.
 const login=document.querySelector('#login-dialog');
 if(login){
  const select=login.querySelector('select[name=user]'),pin=login.querySelector('input[name=pin]');
  const prepare=()=>{
   const last=read();
   if(last&&[...select.options].some(option=>option.value===last))select.value=last;
   setTimeout(()=>(last?pin:select)?.focus());
  };
  new MutationObserver(()=>{if(login.open)prepare();}).observe(login,{attributes:true,attributeFilter:['open']});
  if(login.open)prepare();
  login.querySelector('form')?.addEventListener('submit',()=>write(select.value));
 }

 // Tapping the dimmed area around a dialog closes it, like pressing Escape. Login must stay open.
 document.addEventListener('click',event=>{
  const dialog=event.target;
  if(!(dialog instanceof HTMLDialogElement)||!dialog.open||dialog===login||!event.clientX&&!event.clientY)return;
  const box=dialog.getBoundingClientRect();
  if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
 });

 const note=document.createElement('p');
 note.className='offline-note';note.setAttribute('role','status');note.hidden=true;
 note.textContent='Kamu sedang offline. Perubahan belum bisa disimpan.';
 document.body.append(note);
 const update=()=>{note.hidden=navigator.onLine;document.body.classList.toggle('is-offline',!navigator.onLine);};
 addEventListener('online',update);addEventListener('offline',update);update();
})();
