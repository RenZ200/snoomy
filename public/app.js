const $ = s => document.querySelector(s);
const days = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
let state = {user:null,schedules:[],tasks:[]}, filter='active', editing=null, toastTimer, refreshing=false;
const escape = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wibDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dayIndex = () => (new Date(wibDate()+'T12:00:00Z').getUTCDay()+6)%7+1;
const dateLabel = value => new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
const distance = value => Math.round((Date.parse(value+'T00:00:00Z')-Date.parse(wibDate()+'T00:00:00Z'))/86400000);
function due(task){const d=distance(task.deadline);return d<0?`Lewat ${-d} hari`:d===0?'Hari ini':d===1?'Besok':dateLabel(task.deadline);}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4000);}
function showLogin(){document.dispatchEvent(new CustomEvent('snoomy-session',{detail:{user:null}}));if($('#edit-dialog').open)$('#edit-dialog').close();if(!$('#login-dialog').open)$('#login-dialog').showModal();}
async function api(path,method='GET',body){
 const response=await fetch('/api'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await response.json();
 if(!response.ok){if(response.status===401&&path!='/login'){state.user=null;showLogin();}throw Error(data.error||'Permintaan gagal.');}if(method!=='GET'&&/^\/(schedules|tasks)/.test(path))document.dispatchEvent(new Event('snoomy-data-changed'));return data;
}
async function refresh(){if(refreshing)return;refreshing=true;try{state=await api('/state');render();document.dispatchEvent(new CustomEvent('snoomy-session',{detail:{user:state.user}}));$('#sync').textContent='Tersimpan di server · sinkron tiap 10 detik';}catch(e){$('#sync').textContent='Belum tersambung · mencoba lagi';if(state.user)toast(e.message);}finally{refreshing=false;}}
function classCard(s){const conflict=state.schedules.some(o=>o.id!==s.id&&o.day===s.day&&o.start<s.end&&o.end>s.start);return `<article class="class-card ${s.owner==='Cahya'?'cahya':''}"><span class="owner">${s.owner}</span><small>${s.start} – ${s.end}</small><strong>${escape(s.course)}</strong>${s.room?`<small>${escape(s.room)}</small>`:''}${s.lecturer?`<small>${escape(s.lecturer)}</small>`:''}${conflict?'<small class="conflict">Bentrok</small>':''}${s.owner===state.user?`<div class="card-actions"><button class="text-button" data-action="edit-schedule" data-id="${s.id}">Edit</button><button class="text-button" data-action="delete-schedule" data-id="${s.id}">Hapus</button></div>`:''}</article>`;}
function taskCard(t){const urgent=!t.done&&distance(t.deadline)<=1;return `<article class="task ${urgent?'urgent':''} ${distance(t.deadline)<0?'overdue':''} ${t.done?'done':''}"><input type="checkbox" aria-label="Tandai ${escape(t.title)} ${t.done?'belum selesai':'selesai'}" data-action="check-task" data-id="${t.id}" ${t.done?'checked':''}><div class="task-main"><div class="task-title">${escape(t.title)}</div><div class="task-meta"><span>${t.assignee==='Berdua'?'♡ Berdua':t.assignee}</span><span class="${urgent?'due':''}">${due(t)}</span><span class="priority ${t.priority==='Tinggi'?'high':''}">${t.priority}</span></div></div><div class="card-actions"><button class="text-button" data-action="edit-task" data-id="${t.id}">Edit</button><button class="text-button" data-action="delete-task" data-id="${t.id}">Hapus</button></div></article>`;}
function render(){
 $('#greeting').textContent=`Halo, ${state.user}!`;
 $('#profile').textContent=`${state.user} · Ganti`;
 $('#today').textContent=new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date());
 const today=state.schedules.filter(s=>s.day===dayIndex());
 $('#class-count').textContent=`${today.length} kelas`;
 $('#today-classes').innerHTML=today.length?today.map(s=>`<div class="mini"><span class="dot ${s.owner==='Cahya'?'cahya':''}"></span><span class="time">${s.start}<br>${s.end}</span><div><strong>${escape(s.course)}</strong><p>${s.owner}${s.room?' · '+escape(s.room):''}</p></div></div>`).join(''):'<p class="empty">Tidak ada kelas hari ini. Waktunya tarik napas ♡</p>';
 const soon=state.tasks.filter(t=>!t.done&&distance(t.deadline)<=3);
 $('#soon-tasks').innerHTML=soon.length?soon.slice(0,4).map(t=>`<div class="mini"><span aria-hidden="true">${distance(t.deadline)<=1?'✦':'♡'}</span><div><strong>${escape(t.title)}</strong><p>${t.assignee} · ${due(t)}</p></div></div>`).join(''):'<p class="empty">Belum ada deadline dalam 3 hari ke depan. Lega!</p>';
 $('#week').innerHTML=days.map((d,i)=>{const items=state.schedules.filter(s=>s.day===i+1);return `<section class="day ${dayIndex()===i+1?'current':''}"><h3>${d}</h3>${items.length?items.map(classCard).join(''):'<p class="empty">Ruang kosong ♡</p>'}</section>`;}).join('');
 const tasks=state.tasks.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));
 $('#task-list').innerHTML=tasks.length?tasks.map(taskCard).join(''):'<p class="empty empty-big">Belum ada tugas di sini. Mulai dari satu hal kecil?</p>';
 $('#task-count').textContent=`${state.tasks.filter(t=>t.done).length} dari ${state.tasks.length} selesai`;
}
const options=(values,selected)=>values.map(v=>`<option ${v===selected?'selected':''}>${v}</option>`).join('');
function openEditor(type,id=null){
 if(!state.user)return showLogin();
 editing={type,id};const item=(type==='schedule'?state.schedules:state.tasks).find(t=>t.id===id)||{};
 $('#form-title').textContent=`${id?'Edit':'Tambah'} ${type==='schedule'?'jadwal '+state.user:'tugas'}`;
 if(type==='schedule')$('#fields').innerHTML=`<label>Nama matkul<input name="course" required maxlength="120" value="${escape(item.course||'')}" placeholder="Contoh: Statistika"></label><label>Hari<select name="day">${days.map((d,i)=>`<option value="${i+1}" ${item.day===i+1?'selected':''}>${d}</option>`).join('')}</select></label><div class="form-row"><label>Jam mulai<input name="start" type="time" required value="${item.start||'08:00'}"></label><label>Jam selesai<input name="end" type="time" required value="${item.end||'09:40'}"></label></div><label>Dosen (opsional)<input name="lecturer" maxlength="120" value="${escape(item.lecturer||'')}"></label><label>Ruangan (opsional)<input name="room" maxlength="80" value="${escape(item.room||'')}"></label>`;
 else $('#fields').innerHTML=`<label>Judul tugas<input name="title" required maxlength="180" value="${escape(item.title||'')}" placeholder="Apa yang mau kita beresin?"></label><label>Deadline<input name="deadline" type="date" required value="${item.deadline||wibDate()}"></label><div class="form-row"><label>Untuk siapa?<select name="assignee">${options(['Moreno','Cahya','Berdua'],item.assignee||'Berdua')}</select></label><label>Prioritas<select name="priority">${options(['Rendah','Sedang','Tinggi'],item.priority||'Sedang')}</select></label></div>`;
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
 try{if(action==='check-task')await api('/tasks/'+id,'PUT',{done:button.checked});else await api(`/${type==='schedule'?'schedules':'tasks'}/${id}`,'DELETE',{});await refresh();}catch(error){if(action==='check-task')button.checked=!button.checked;toast(error.message);}finally{button.disabled=false;}
});
refresh();setInterval(()=>{if(!document.hidden&&state.user&&!$('#edit-dialog').open)refresh();},10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user&&!$('#edit-dialog').open)refresh();});

document.addEventListener("snoomy-google-synced",()=>{if(!$("#edit-dialog").open)refresh();});
