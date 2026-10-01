if (window.self === window.top) location.replace('/#budgeting');
else document.documentElement.classList.add('budget-embedded');
// The outer player keeps running; its controls step aside for modal forms.
const notifyModal=()=>window.parent.postMessage({type:'snoomy-modal',open:!!document.querySelector('dialog[open]')},location.origin);
const modalObserver=new MutationObserver(notifyModal);
document.querySelectorAll('dialog').forEach(dialog=>modalObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
import './budget-ui.js';
const $=s=>document.querySelector(s);
let activeUser=null,loading=false;
function session(user){activeUser=user;document.dispatchEvent(new CustomEvent('snoomy-session',{detail:{user}}));$('#profile').textContent=user?`${user} · Ganti`:'Pilih profil';}
function login(){session(null);if(!$('#login-dialog').open)$('#login-dialog').showModal();}
async function api(path,body){const res=await fetch('/api'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok){const e=Error(data.error||'Gagal terhubung.');e.status=res.status;throw e;}return data;}
async function refresh(){if(loading)return;loading=true;try{const data=await api('/state');session(data.user);$('#sync').textContent='Tersimpan di server · sinkron tiap 10 detik';}catch(e){if(e.status===401)login();$('#sync').textContent=e.status===401?'Pilih profil untuk melanjutkan':'Belum tersambung · mencoba lagi';}finally{loading=false;}}
$('#login-dialog').addEventListener('cancel',e=>e.preventDefault());
$('#login-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{await api('/login',Object.fromEntries(new FormData(e.target)));$('#login-dialog').close();$('#login-error').textContent='';e.target.pin.value='';await refresh();}catch(err){$('#login-error').textContent=err.message;}finally{button.disabled=false;}};
$('#profile').onclick=async()=>{if(!activeUser)return login();try{await api('/logout',{});$('#login-form').reset();login();}catch(e){$('#sync').textContent=e.message;}};
refresh();setInterval(()=>{if(!document.hidden&&!$('#budget-dialog').open)refresh();},10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#budget-dialog').open)refresh();});
