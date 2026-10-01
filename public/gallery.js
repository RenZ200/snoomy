(() => {
 const $=s=>document.querySelector(s),grid=$('#gallery-grid'),upload=$('#gallery-upload'),lightbox=$('#gallery-lightbox');
 const type=m=>m.startsWith('video/')?'video':m==='image/gif'?'gif':'photo';
 const label={photo:'Foto',gif:'GIF',video:'Video'};
 let user=null,items=[],kind='all',shown=12,busy=false,previewURL=null,selected=null,uploadKey=null,epoch=0;
 const size=n=>`${(n/1024/1024).toFixed(1)} MB`;
 const date=v=>new Date(v).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
 function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
 async function api(path,options={}){const r=await fetch('/api/gallery'+path,{...options,headers:{'Content-Type':'application/json',...options.headers}});const d=await r.json().catch(()=>({error:'Server belum merespons. Coba lagi.'}));if(!r.ok)throw Error(d.error);return d;}
 function motion(){if(!window.gsap||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const tl=window.gsap.timeline({paused:true});tl.fromTo(grid.querySelectorAll('.gallery-card'),{y:12,opacity:0},{y:0,opacity:1,duration:.35,stagger:.035,clearProps:'all',ease:'power2.out'},0);tl.play();}
 function render(){
  grid.replaceChildren();const filtered=items.filter(i=>kind==='all'||type(i.mime)===kind);
  if(!filtered.length){const empty=el('div',null,'gallery-empty');empty.append(el('h3',items.length?'Belum ada momen jenis ini.':'Cerita kita mulai di sini.'),el('p',items.length?'Coba filter lain atau simpan momen baru.':'Pajang satu foto favorit, lalu tambah ceritanya sedikit demi sedikit.'));grid.append(empty);}
  for(const item of filtered.slice(0,shown)){
   const card=el('article',null,'gallery-card'),button=el('button',null,'gallery-open');button.type='button';button.setAttribute('aria-label',`Buka ${label[type(item.mime)]}: ${item.caption||'Momen dari '+item.owner}`);
   // GIFs play on explicit open; animated media never autoplays in the album grid.
   if(type(item.mime)==='photo'){const img=el('img');img.src=`/api/gallery/${item.id}/media`;img.alt=item.caption||'Momen bersama';img.loading='lazy';img.decoding='async';button.append(img);}
   else button.append(el('span',type(item.mime)==='gif'?'GIF ♡':'▷','gallery-video-icon'));
   button.append(el('span',label[type(item.mime)],'gallery-kind'));button.onclick=()=>open(item);
   card.append(button,el('p',item.caption||'Satu momen manis.'),el('small',`${item.owner} · ${date(item.created)}`));grid.append(card);
  }
  $('#gallery-more').hidden=filtered.length<=shown;motion();
 }
 async function load(){if(!user)return;const version=epoch;$('#gallery-status').textContent='Mengambil momen kita…';grid.setAttribute('aria-busy','true');try{const data=await api('');if(version!==epoch)return;items=data.items;$('#gallery-space').textContent=`${items.length} momen · ${size(data.used)} dari ${size(data.limit)} terpakai · maks. 3 MB/file`;$('#gallery-status').textContent='';render();}catch(e){if(version===epoch)$('#gallery-status').textContent=e.message;}finally{grid.removeAttribute('aria-busy');}}
 function media(mime,src){const node=el(mime.startsWith('video/')?'video':'img');node.src=src;if(node.tagName==='VIDEO'){node.controls=true;node.preload='metadata';node.playsInline=true;}else node.alt='Pratinjau momen';return node;}
 function open(item){selected=item;$('#gallery-full').replaceChildren(media(item.mime,`/api/gallery/${item.id}/media`));$('#gallery-note').textContent=item.caption;$('#gallery-author').textContent=`Disimpan oleh ${item.owner} · ${date(item.created)} · ${size(item.size)}`;$('#gallery-delete').hidden=item.owner!==user;$('#gallery-delete-confirm').hidden=true;$('#gallery-detail-status').textContent='';lightbox.showModal();}
 lightbox.addEventListener('close',()=>{$('#gallery-full').replaceChildren();selected=null;});$('#gallery-lightbox-close').onclick=()=>lightbox.close();
 $('#gallery-delete').onclick=()=>{$('#gallery-delete-confirm').hidden=false;$('#gallery-delete-yes').focus();};$('#gallery-delete-no').onclick=()=>{$('#gallery-delete-confirm').hidden=true;$('#gallery-delete').focus();};
 $('#gallery-delete-yes').onclick=async()=>{if(!selected)return;const b=$('#gallery-delete-yes');b.disabled=true;try{await api('/'+selected.id,{method:'DELETE'});lightbox.close();await load();}catch(e){$('#gallery-detail-status').textContent=e.message;}finally{b.disabled=false;}};
 function clearPreview(){if(previewURL)URL.revokeObjectURL(previewURL);previewURL=null;$('#gallery-preview').replaceChildren();}
 $('#gallery-add').onclick=()=>{if(!user){$('#gallery-status').textContent='Pilih profil dulu untuk menyimpan momen.';return;}$('#gallery-form').reset();clearPreview();uploadKey=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');$('#gallery-upload-status').textContent='';$('#gallery-progress').hidden=true;upload.showModal();};
 document.querySelectorAll('[data-gallery-close]').forEach(b=>b.onclick=()=>{if(!busy)upload.close();});upload.addEventListener('cancel',e=>{if(busy)e.preventDefault();});upload.addEventListener('close',clearPreview);
 $('#gallery-file').onchange=()=>{clearPreview();uploadKey=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');const f=$('#gallery-file').files[0];$('#gallery-upload-status').textContent='';if(!f)return;if(f.size>3*1024*1024){$('#gallery-upload-status').textContent='File lebih dari 3 MB. Kompres dulu, lalu pilih ulang.';return;}previewURL=URL.createObjectURL(f);$('#gallery-preview').append(media(f.type,previewURL));};
 $('#gallery-form').onsubmit=async e=>{
  e.preventDefault();if(busy)return;const f=$('#gallery-file').files[0];if(!f)return;
  if(f.size>3*1024*1024){$('#gallery-upload-status').textContent='Maksimal 3 MB per file. Kompres dulu, ya.';return;}
  busy=true;$('#gallery-save').disabled=true;$('#gallery-file').disabled=true;document.querySelectorAll('[data-gallery-close]').forEach(b=>b.disabled=true);$('#gallery-progress').hidden=false;$('#gallery-progress').value=0;$('#gallery-upload-status').textContent='Menyiapkan momen…';
  try{
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('File tidak bisa dibaca.'));reader.readAsDataURL(f);});
   await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST','/api/gallery');xhr.setRequestHeader('Content-Type','application/json');xhr.timeout=90000;xhr.upload.onprogress=e=>{if(e.lengthComputable)$('#gallery-progress').value=e.loaded/e.total*100;$('#gallery-upload-status').textContent='Mengunggah dan menyimpan…';};xhr.onload=()=>{let d;try{d=JSON.parse(xhr.responseText);}catch{}if(xhr.status>=200&&xhr.status<300)resolve();else reject(Error(d?.error||'Unggahan belum berhasil. Coba lagi.'));};xhr.onerror=xhr.ontimeout=()=>reject(Error('Koneksi terputus. Coba simpan lagi; unggahan yang sama tidak akan digandakan.'));xhr.send(JSON.stringify({data,mime:f.type,caption:$('#gallery-caption').value,key:uploadKey}));});
   upload.close();kind='all';shown=12;updateFilters();await load();$('#gallery-status').textContent='Momen baru sudah dipajang ♡';
  }catch(e){$('#gallery-upload-status').textContent=e.message;}finally{busy=false;$('#gallery-save').disabled=false;$('#gallery-file').disabled=false;document.querySelectorAll('[data-gallery-close]').forEach(b=>b.disabled=false);}
 };
 function updateFilters(){document.querySelectorAll('#gallery-filters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));}
 $('#gallery-filters').onclick=e=>{const b=e.target.closest('[data-kind]');if(!b)return;kind=b.dataset.kind;shown=12;updateFilters();render();};$('#gallery-more').onclick=()=>{shown+=12;render();};$('#gallery-refresh').onclick=load;
 document.addEventListener('snoomy-session',e=>{if(user===e.detail.user)return;user=e.detail.user;epoch++;items=[];grid.replaceChildren();lightbox.close();if(!busy)upload.close();$('#gallery-space').textContent='';if(user&&location.hash==='#gallery')load();});
 document.addEventListener('snoomy-route',e=>{if(e.detail.page==='gallery'&&user)load();else if(e.detail.page!=='gallery'){lightbox.close();if(!busy)upload.close();}});
})();
