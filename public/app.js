const $ = s => document.querySelector(s);
const days = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
let state = {user:null,schedules:[],tasks:[]}, filter='active', editing=null, toastTimer, refreshing=false;
const escape = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wibDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dayIndex = () => (new Date(wibDate()+'T12:00:00Z').getUTCDay()+6)%7+1;
const dateLabel = value => new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
const distance = value => Math.round((Date.parse(value+'T00:00:00Z')-Date.parse(wibDate()+'T00:00:00Z'))/86400000);
const minutes = time => {const [h,m]=time.split(':');return h*60+Number(m);};
const clock = value => `${String(Math.floor(value/60)).padStart(2,'0')}.${String(value%60).padStart(2,'0')}`;
const wibNow = () => {const [h,m]=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).split(':');return Number(h)*60+Number(m);};
const greeting = now => now<240?'Selamat malam':now<600?'Selamat pagi':now<900?'Selamat siang':now<1080?'Selamat sore':'Selamat malam';
// Gaps of at least an hour between 07.00 and 21.00 WIB when neither of you has class, from now on.
function freeTogether(classes,now){
 const busy=classes.map(s=>[minutes(s.start),minutes(s.end)]).sort((a,b)=>a[0]-b[0]);
 const slots=[];let cursor=Math.max(420,Math.ceil(now/15)*15);
 for(const [start,end] of busy){if(start-cursor>=60)slots.push([cursor,start]);cursor=Math.max(cursor,end);}
 if(1260-cursor>=60)slots.push([cursor,1260]);
 return slots;
}
const plusDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const weekDates=()=>{const t=wibDate(),d=dayIndex();return days.map((_,i)=>plusDays(t,i+1-d));};
const courseKey=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// Classes on one date. Weekly schedules apply, except that SIAP classes follow the dated SIAP
// calendar (moved, extra or cancelled meetings) for owners whose synced calendar covers the date.
function classesOn(date,day){
 const weekly=state.schedules.filter(s=>s.day===day), ranges=state.meetingRange||{};
 const covered=owner=>ranges[owner]&&date>=ranges[owner].from&&date<=ranges[owner].to;
 const out=weekly.filter(s=>s.source!=='siap'||!covered(s.owner));
 for(const owner of Object.keys(ranges)){
  if(!covered(owner))continue;
  const slots=weekly.filter(s=>s.owner===owner&&s.source==='siap'), used=new Set();
  for(const m of (state.meetings||[]).filter(m=>m.owner===owner&&m.date===date)){
   const match=slots.find(s=>!used.has(s.id)&&courseKey(s.course)===courseKey(m.course)&&s.start===m.start);
   if(match)used.add(match.id);
   out.push({...(match||{}),id:match?match.id:'m'+m.id,owner,day,start:m.start,end:m.end,course:m.course,room:m.room||match?.room||'',lecturer:match?.lecturer||'',source:'siap',changed:!match,roomChanged:!!(match&&m.room&&m.room!==match.room)});
  }
  for(const s of slots)if(!used.has(s.id))out.push({...s,cancelled:true});
 }
 return out.sort((a,b)=>a.start.localeCompare(b.start));
}
function due(task){const d=distance(task.deadline);return d<0?`Lewat ${-d} hari`:d===0?'Hari ini':d===1?'Besok':dateLabel(task.deadline);}
// A toast can carry one action (for example "Urungkan"); it then stays a little longer.
function toast(message,action){
 const box=$('#toast');box.textContent=message;
 if(action){const button=document.createElement('button');button.type='button';button.className='toast-action';button.textContent=action.label;button.onclick=()=>{box.hidden=true;action.run();};box.append(button);}
 box.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,action?7000:4000);
}
function showLogin(){document.dispatchEvent(new CustomEvent('snoomy-session',{detail:{user:null}}));if($('#edit-dialog').open)$('#edit-dialog').close();if(!$('#login-dialog').open)$('#login-dialog').showModal();}
async function api(path,method='GET',body){
 const response=await fetch('/api'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await response.json();
 if(!response.ok){if(response.status===401&&path!='/login'){state.user=null;showLogin();}throw Error(data.error||'Permintaan gagal.');}if(method!=='GET'&&/^\/(schedules|tasks)/.test(path))document.dispatchEvent(new Event('snoomy-data-changed'));return data;
}
async function refresh(){if(refreshing)return;refreshing=true;try{state=await api('/state');render();document.dispatchEvent(new CustomEvent('snoomy-session',{detail:{user:state.user}}));$('#sync').textContent='Tersimpan di server · sinkron tiap 10 detik';}catch(e){$('#sync').textContent='Belum tersambung · mencoba lagi';if(state.user)toast(e.message);}finally{refreshing=false;}}
let live={now:new Set(),next:null};
const liveBadge=s=>live.now.has(s.id)?'<span class="live-badge now">Sekarang</span>':live.next===s.id?'<span class="live-badge next">Berikutnya</span>':'';
function classCard(s,list=[s]){const conflict=!s.cancelled&&list.some(o=>o!==s&&!o.cancelled&&o.start<s.end&&o.end>s.start);return `<article class="class-card ${s.owner==='Cahya'?'cahya':''} ${live.now.has(s.id)?'is-now':''} ${s.cancelled?'is-cancelled':''}">${liveBadge(s)}<span class="owner">${s.owner}</span>${s.source==='siap'?'<span class="src-badge" title="Dari SIAP / Gentayu">SIAP</span>':''}<small>${s.start} – ${s.end}</small>${s.changed?'<small class="chg-badge">Jadwal berubah</small>':''}${s.roomChanged?'<small class="chg-badge">Ruang pindah</small>':''}${s.cancelled?'<small class="cancel-badge">Tidak ada kelas</small>':''}<strong>${escape(s.course)}</strong>${s.room?`<small>${escape(s.room)}</small>`:''}${s.lecturer?`<small>${escape(s.lecturer)}</small>`:''}${conflict?'<small class="conflict">Bentrok</small>':''}${s.owner===state.user&&Number.isInteger(s.id)?`<div class="card-actions"><button class="text-button" data-action="edit-schedule" data-id="${s.id}">Edit</button><button class="text-button" data-action="delete-schedule" data-id="${s.id}">Hapus</button></div>`:''}</article>`;}
function taskCard(t){const urgent=!t.done&&distance(t.deadline)<=1;return `<article class="task ${urgent?'urgent':''} ${distance(t.deadline)<0?'overdue':''} ${t.done?'done':''}"><input type="checkbox" aria-label="Tandai ${escape(t.title)} ${t.done?'belum selesai':'selesai'}" data-action="check-task" data-id="${t.id}" ${t.done?'checked':''}><div class="task-main"><div class="task-title">${escape(t.title)}</div><div class="task-meta"><span class="who ${t.assignee.toLowerCase()}">${t.assignee==='Berdua'?'♡ Berdua':t.assignee}</span><span class="${urgent?'due':''}">${due(t)}</span><span class="priority ${t.priority==='Tinggi'?'high':''}">${t.priority}</span></div></div><div class="card-actions"><button class="text-button" data-action="edit-task" data-id="${t.id}">Edit</button><button class="text-button" data-action="delete-task" data-id="${t.id}">Hapus</button></div></article>`;}
function render(){
 const now=wibNow();
 document.body.dataset.user=state.user;
 $('#greeting').innerHTML=`<span class="greet">${greeting(now)},</span> ${escape(state.user)}!`;
 $('#profile').textContent=state.user;$('#profile').setAttribute('aria-label',`Profil ${state.user}, buka menu`);
 $('#today').textContent=new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date());
 const todayAll=classesOn(wibDate(),dayIndex()), today=todayAll.filter(s=>!s.cancelled);
 live={now:new Set(today.filter(s=>minutes(s.start)<=now&&now<minutes(s.end)).map(s=>s.id)),next:today.filter(s=>minutes(s.start)>now).sort((a,b)=>a.start.localeCompare(b.start))[0]?.id??null};
 $('#class-count').textContent=`${today.length} kelas`;
 $('#ql-calendar').textContent=today.length?`${today.length} kelas hari ini`:'Hari ini bebas kelas';
 const free=freeTogether(today,now);
 $('#free-together').hidden=now>=1200;
 $('#free-together').textContent=!today.length?'Kalian sama-sama bebas hari ini ♡':free.length?`Kosong bareng: ${free.slice(0,2).map(([a,b])=>`${clock(a)}–${clock(b)}`).join(' · ')}`:'Sisa hari ini cukup padat. Semangat ♡';
 $('#today-classes').innerHTML=todayAll.length?todayAll.map(s=>`<div class="mini ${live.now.has(s.id)?'is-now':''} ${s.cancelled?'is-cancelled':''}"><span class="dot ${s.owner==='Cahya'?'cahya':''}"></span><span class="time">${s.start}<br>${s.end}</span><div><strong>${escape(s.course)}</strong><p>${s.owner}${s.room?' · '+escape(s.room):''}${s.cancelled?' · tidak ada kelas':s.changed?' · jadwal berubah':s.roomChanged?' · ruang pindah':''}</p>${liveBadge(s)}</div></div>`).join(''):'<p class="empty">Tidak ada kelas hari ini. Waktunya tarik napas ♡</p>';
 const soon=state.tasks.filter(t=>!t.done&&distance(t.deadline)<=3);
 $('#soon-tasks').innerHTML=soon.length?soon.slice(0,4).map(t=>`<div class="mini mini-task"><input type="checkbox" aria-label="Tandai ${escape(t.title)} selesai" data-action="check-task" data-id="${t.id}"><div><strong>${escape(t.title)}</strong><p>${t.assignee} · ${due(t)}</p></div></div>`).join(''):'<p class="empty">Belum ada deadline dalam 3 hari ke depan. Lega!</p>';
 const dates=weekDates();
 $('#week').innerHTML=days.map((d,i)=>{const items=classesOn(dates[i],i+1);return `<section class="day ${dayIndex()===i+1?'current':''}"><h3>${d} <span class="day-date">${Number(dates[i].slice(8))}</span></h3>${items.length?items.map(s=>classCard(s,items)).join(''):'<p class="empty">Ruang kosong ♡</p>'}</section>`;}).join('');
 const tasks=state.tasks.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));
 const group=t=>t.done?'Selesai':distance(t.deadline)<0?'Terlambat':distance(t.deadline)<=1?'Hari ini & besok':distance(t.deadline)<=7?'Minggu ini':'Nanti';
 const counts=tasks.reduce((all,t)=>({...all,[group(t)]:(all[group(t)]||0)+1}),{});
 $('#task-list').innerHTML=tasks.length?tasks.map((t,i)=>(i&&group(tasks[i-1])===group(t)?'':`<h3 class="task-group ${group(t)==='Terlambat'?'late':''}">${group(t)} <span>${counts[group(t)]}</span></h3>`)+taskCard(t)).join(''):'<p class="empty empty-big">Belum ada tugas di sini. Mulai dari satu hal kecil?</p>';
 const done=state.tasks.filter(t=>t.done).length;
 $('#task-count').textContent=`${done} dari ${state.tasks.length} selesai`;
 $('#task-count').style.setProperty('--done',state.tasks.length?done/state.tasks.length:0);
 const open=state.tasks.length-done;
 $('#ql-todos').textContent=open?`${open} belum selesai`:'Semua beres ♡';
}
const options=(values,selected)=>values.map(v=>`<option ${v===selected?'selected':''}>${v}</option>`).join('');
function openEditor(type,id=null){
 if(!state.user)return showLogin();
 editing={type,id};const item=(type==='schedule'?state.schedules:state.tasks).find(t=>t.id===id)||{};
 $('#form-title').textContent=`${id?'Edit':'Tambah'} ${type==='schedule'?'jadwal '+state.user:'tugas'}`;
 if(type==='schedule')$('#fields').innerHTML=`<label>Nama matkul<input name="course" autofocus required maxlength="120" value="${escape(item.course||'')}" placeholder="Contoh: Statistika"></label><label>Hari<select name="day">${days.map((d,i)=>`<option value="${i+1}" ${item.day===i+1?'selected':''}>${d}</option>`).join('')}</select></label><div class="form-row"><label>Jam mulai<input name="start" type="time" required value="${item.start||'08:00'}"></label><label>Jam selesai<input name="end" type="time" required value="${item.end||'09:40'}"></label></div><label>Dosen (opsional)<input name="lecturer" maxlength="120" value="${escape(item.lecturer||'')}"></label><label>Ruangan (opsional)<input name="room" maxlength="80" value="${escape(item.room||'')}"></label>`;
 else $('#fields').innerHTML=`<label>Judul tugas<input name="title" autofocus required maxlength="180" value="${escape(item.title||'')}" placeholder="Apa yang mau kita beresin?"></label><label>Deadline<input name="deadline" type="date" required value="${item.deadline||wibDate()}"></label><div class="form-row"><label>Untuk siapa?<select name="assignee">${options(['Moreno','Cahya','Berdua'],item.assignee||'Berdua')}</select></label><label>Prioritas<select name="priority">${options(['Rendah','Sedang','Tinggi'],item.priority||'Sedang')}</select></label></div>`;
 $('#form-error').textContent='';$('#edit-dialog').showModal();
}
$('#login-dialog').addEventListener('cancel',e=>e.preventDefault());
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{await api('/login','POST',Object.fromEntries(new FormData(e.target)));$('#login-dialog').close();$('#login-error').textContent='';e.target.pin.value='';await refresh();}catch(error){$('#login-error').textContent=error.message;}finally{button.disabled=false;}});
$('#profile').onclick=async()=>{try{await api('/logout','POST',{});state={user:null,schedules:[],tasks:[]};$('#login-form').reset();showLogin();}catch(e){toast(e.message);}};
$('#add-schedule').onclick=()=>openEditor('schedule');$('#add-task').onclick=()=>openEditor('task');
$('#close-dialog').onclick=$('#cancel-dialog').onclick=()=>$('#edit-dialog').close();
$('#edit-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const body=Object.fromEntries(new FormData(e.target));if(editing.type==='schedule'&&body.end<=body.start)throw Error('Jam selesai harus setelah jam mulai.');await api(`/${editing.type==='schedule'?'schedules':'tasks'}${editing.id?'/'+editing.id:''}`,editing.id?'PUT':'POST',body);$('#edit-dialog').close();await refresh();toast('Rencana tersimpan ♡');}catch(error){$('#form-error').textContent=error.message;}finally{button.disabled=false;}};
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-filter],[data-action]');if(!button)return;
 if(button.dataset.filter){filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();return;}
 const {action,id}=button.dataset, type=action.endsWith('schedule')?'schedule':'task';
 if(action.startsWith('edit'))return openEditor(type,Number(id));
 if(action.startsWith('delete')&&!confirm(`Hapus ${type==='schedule'?'jadwal':'tugas'} ini?`))return;
 button.disabled=true;
 try{if(action==='check-task'){const done=button.checked;await api('/tasks/'+id,'PUT',{done});if(done)toast('Tugas selesai ♡',{label:'Urungkan',run:async()=>{try{await api('/tasks/'+id,'PUT',{done:false});await refresh();}catch(error){toast(error.message);}}});}else await api(`/${type==='schedule'?'schedules':'tasks'}/${id}`,'DELETE',{});await refresh();}catch(error){if(action==='check-task')button.checked=!button.checked;toast(error.message);}finally{button.disabled=false;}
});
refresh();setInterval(()=>{if(!document.hidden&&state.user&&!$('#edit-dialog').open)refresh();},10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user&&!$('#edit-dialog').open)refresh();});

document.addEventListener("snoomy-schedules-imported",e=>{const r=e.detail||{};toast(`Jadwal SIAP tersimpan: ${r.added||0} baru, ${r.updated||0} berubah, ${r.removed||0} dihapus.`);refresh();});
document.addEventListener("snoomy-google-synced",()=>{if(!$("#edit-dialog").open)refresh();});
