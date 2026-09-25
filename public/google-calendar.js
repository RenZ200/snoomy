(() => {
const panel=document.querySelector('#google-calendar');
let user=null,busy=false,status=null,lastAttempt=0,epoch=0;
const $=s=>panel.querySelector(s);
async function api(path,body) {
 const r=await fetch('/api/google/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Koneksi gagal.');return data;
}
function draw() {
 $('#google-connect').disabled=busy||!status?.configured||!user;
 $('#google-connect').textContent=status?.connected?'Hubungkan ulang':'Hubungkan Google Calendar';
 $('#google-sync').hidden=$('#google-disconnect').hidden=!status?.connected;
 $('#google-sync').disabled=$('#google-disconnect').disabled=busy;
 $('#google-state').textContent=!user?'Masuk ke profilmu untuk menghubungkan kalender.':!status?.configured?'Setup Google belum selesai. Pemilik Snoomy perlu memasang kredensial OAuth di Vercel.':status.connected?`Kalender ${user} terhubung${status.lastSynced?' · Terakhir '+new Date(Number(status.lastSynced)).toLocaleString('id-ID'):''}.`:`Hubungkan akun Google milik ${user}.`;
}
const label=row=>!row?'Dihapus':row.title?`${row.title} · ${row.deadline}${row.done?' · Selesai':''}`:`${row.course} · Hari ${row.day}, ${row.start}–${row.end}`;
function showResult(data) {
 const list=$('#google-conflicts');list.replaceChildren();
 for(const item of data.conflicts){
  const box=document.createElement('article');box.className='google-conflict';
  const title=document.createElement('h3');title.textContent='Dua versi: '+item.title;box.append(title);
  for(const side of ['local','google']){
   const p=document.createElement('p');p.textContent=(side==='local'?'Snoomy: ':'Google: ')+label(item[side]);box.append(p);
   const button=document.createElement('button');button.className='secondary';button.textContent='Pakai versi '+(side==='local'?'Snoomy':'Google');
   // A deleted item can be accepted, but is never silently resurrected.
   button.disabled=Boolean(item[side]&&!item[side==='local'?'google':'local']);
   button.onclick=()=>sync({id:item.id,version:item.version,side});box.append(button);
  }list.append(box);
 }
 $('#google-message').textContent=[data.conflicts.length?`${data.conflicts.length} konflik perlu dipilih. Kedua versi disimpan sampai kamu memilih.`:'Kalender sudah disinkronkan ♡',...data.warnings].join(' ');
}
async function sync(resolution) {
 if(busy||!user||!status?.connected)return;
 const generation=epoch;busy=true;lastAttempt=Date.now();draw();$('#google-message').textContent='Menyamakan rencana kita…';
 try{const data=await api('sync',resolution?{resolution}:{});if(generation!==epoch)return;status.lastSynced=data.lastSynced;showResult(data);document.dispatchEvent(new Event('snoomy-google-synced'));}
 catch(e){if(generation===epoch)$('#google-message').textContent=e.message;}
 finally{busy=false;draw();}
}
$('#google-connect').onclick=async()=>{busy=true;draw();try{const data=await api('connect',{});window.location.assign(data.url);}catch(e){$('#google-message').textContent=e.message;busy=false;draw();}};
$('#google-sync').onclick=()=>sync();
$('#google-disconnect').onclick=async()=>{
 if(!confirm('Putuskan sinkronisasi? Kalender dan acara di Google tetap ada.'))return;
 busy=true;draw();try{await api('disconnect',{});status.connected=false;$('#google-conflicts').replaceChildren();$('#google-message').textContent='Sinkronisasi terputus. Izin aplikasi juga bisa dicabut lewat pengaturan akun Google.';}catch(e){$('#google-message').textContent=e.message;}finally{busy=false;draw();}
};
document.addEventListener('snoomy-session',async e=>{
 if(user===e.detail.user)return;user=e.detail.user;const generation=++epoch;status=null;$('#google-conflicts').replaceChildren();draw();
 if(!user)return;
 try{const data=await api('status');if(generation!==epoch)return;status=data;draw();if(status.connected)sync();}catch(e){if(generation===epoch)$('#google-message').textContent=e.message;}
});
setInterval(()=>{if(!document.hidden&&!document.querySelector('dialog[open]')&&Date.now()-lastAttempt>=60000)sync();},5000);
document.addEventListener('snoomy-data-changed',()=>{setTimeout(()=>sync(),800);});
const params=new URLSearchParams(location.search);
if(params.has('google')){$('#google-message').textContent=params.get('google')==='connected'?'Izin Google tersimpan. Masuk kembali jika diminta, lalu sinkronkan.':'Koneksi belum berhasil. Gunakan akun Google yang sama, cek test user dan pengaturan OAuth, lalu coba lagi.';params.delete('google');history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);}
draw();

})();
