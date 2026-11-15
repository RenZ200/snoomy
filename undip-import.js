// Turns a class schedule copied from SIAP / Gentayu into Snoomy weekly schedules.
// Accepted input (pasted or uploaded by the student who is logged in to SIAP themself):
// - JSON as SIAP returns it (rows with hari, waktu_mulai, waktu_selesai, kode_mk, nama_mk,
//   nama_kelas, nama_ruang, nama_dosen, tanggal_pertemuan), at any nesting depth;
// - a copied table (tab, semicolon or comma separated) with a header row;
// - free text, one class per line, e.g. "Senin 07:00-09:30 Termodinamika | A.502".
// Snoomy never logs in to SIAP and never stores SSO credentials.

export const SOURCE = 'siap';
const MAX_ITEMS = 80;
const DAYS = {senin:1,selasa:2,rabu:3,kamis:4,jumat:5,"jum'at":5,jumaat:5,sabtu:6,minggu:7,ahad:7,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,sunday:7,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,sun:7};
const DAY_WORD = /\b(senin|selasa|rabu|kamis|jum'?at|jumaat|sabtu|minggu|ahad|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const RANGE = /(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*(?:-|–|—|s\s?\/\s?d|s\.?\s?d\.?|sampai|to)\s*(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?/i;
const CODE = /\b[A-Z]{2,6}\d{3,7}\b/;
const ROOM = /\b(?:ruang(?:an)?|room|r\.)\s*:?\s*([A-Za-z0-9][\w.\- ]{0,30}?)(?=\s*(?:[|·•,;]|$))/i;
const ROOM_TOKEN = /\b[A-Z]{1,3}[.\-]\d{2,4}[A-Z]?\b/;
const EXAM = /\b(ujian|uts|uas)\b/i;

const ALIASES = {
 day: ['hari','hari_matakuliah','hari_matakuliah_lihat','nama_hari','day'],
 start: ['waktu_mulai','jam_mulai','mulai','start','start_time'],
 end: ['waktu_selesai','jam_selesai','selesai','end','end_time'],
 range: ['waktu','jam','waktu_matakuliah_lihat','time'],
 course: ['nama_mk','nama_matakuliah','matakuliah','mata_kuliah','nama_mata_kuliah','course','nama'],
 code: ['kode_mk','kode_matakuliah','kode_mata_kuliah','kode','code'],
 klass: ['nama_kelas','kelas','kelas_matakuliah','class'],
 room: ['nama_ruang','ruang','ruangan','kdruang','room'],
 lecturer: ['nama_dosen','dosen','dosen_matakuliah','dosen_matakuliah_lihat','dosen_pengampu','pengampu','lecturer'],
 date: ['tanggal_pertemuan','tanggal','date'],
 kind: ['jenis_perkuliahan','jenis'],
};
const keyOf = k => String(k).trim().toLowerCase().replace(/[^a-z0-9']+/g,'_').replace(/^_|_$/g,'');
const clean = (v,max) => String(v ?? '').replace(/\s+/g,' ').trim().slice(0,max);

function time(h,m){const hh=Number(h),mm=Number(m);return hh<24&&mm<60?`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`:null;}
function parseTime(value){const m=String(value ?? '').match(/^\s*(\d{1,2})[:.](\d{2})/);return m?time(m[1],m[2]):null;}
function parseDay(value){
 if(value===null||value===undefined||value==='')return null;
 if(typeof value==='number'||/^\s*\d\s*$/.test(String(value))){const n=Number(value);return n>=1&&n<=7?n:null;}
 const m=String(value).match(DAY_WORD);return m?DAYS[m[1].toLowerCase()]??null:null;
}
function dayFromDate(value){
 const m=String(value ?? '').match(/(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
 if(!m)return null;
 const [y,mo,d]=m[1]?[m[1],m[2],m[3]]:[m[6],m[5],m[4]];
 const date=new Date(Date.UTC(Number(y),Number(mo)-1,Number(d)));
 return Number.isNaN(date.getTime())?null:(date.getUTCDay()+6)%7+1;
}
function pick(row,field){for(const alias of ALIASES[field])if(row[alias]!==undefined&&row[alias]!==null&&String(row[alias]).trim()!=='')return row[alias];return undefined;}

// One SIAP-shaped record → a candidate class, or a reason it was skipped.
function fromRecord(raw){
 const row={};for(const [k,v] of Object.entries(raw))if(v===null||['string','number'].includes(typeof v))row[keyOf(k)]=v;
 const kind=pick(row,'kind');
 if(kind&&EXAM.test(String(kind)))return {skip:'exam'};
 let start=parseTime(pick(row,'start')), end=parseTime(pick(row,'end'));
 if(!start||!end){const r=String(pick(row,'range') ?? '').match(RANGE);if(r){start=time(r[1],r[2]);end=time(r[3],r[4]);}}
 const day=parseDay(pick(row,'day')) ?? dayFromDate(pick(row,'date'));
 const course=clean(pick(row,'course'),120);
 if(!course&&!start&&!day)return null;
 if(!day||!start||!end||!course)return {skip:'incomplete'};
 return {day,start,end,course,code:clean(pick(row,'code'),30),klass:clean(pick(row,'klass'),30),room:clean(pick(row,'room'),80),lecturer:clean(pick(row,'lecturer'),120)};
}
function* records(value,depth=0){
 if(depth>6||value===null||typeof value!=='object')return;
 if(Array.isArray(value)){for(const v of value)yield* records(v,depth+1);return;}
 const flat=Object.values(value).some(v=>v===null||['string','number'].includes(typeof v));
 if(flat)yield value;
 for(const v of Object.values(value))if(v&&typeof v==='object')yield* records(v,depth+1);
}
function splitRow(line,sep){return sep===','?line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).slice(0,-1).map(c=>c.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"')):line.split(sep);}
function table(lines){
 const sep=['\t',';',','].find(s=>lines[0].includes(s));
 if(!sep)return null;
 const header=splitRow(lines[0],sep).map(keyOf);
 const known=Object.values(ALIASES).flat();
 if(header.filter(h=>known.includes(h)||/^(jam|waktu)/.test(h)).length<2)return null;
 return lines.slice(1).map(line=>{const cells=splitRow(line,sep);return Object.fromEntries(header.map((h,i)=>[h,cells[i]?.trim() ?? '']));});
}
function freeText(lines){
 const out=[];let currentDay=null;
 for(const line of lines){
  const dayHere=parseDay(line), range=line.match(RANGE);
  if(dayHere&&!range){currentDay=dayHere;continue;}
  if(!range){out.push({skip:'unreadable',line});continue;}
  if(EXAM.test(line)){out.push({skip:'exam'});continue;}
  const day=dayHere ?? dayFromDate(line) ?? currentDay;
  let rest=line.replace(RANGE,' ').replace(DAY_WORD,' ').replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/,' ');
  const code=(rest.match(CODE)||[''])[0];rest=rest.replace(CODE,' ');
  let room='';const roomMatch=rest.match(ROOM);if(roomMatch){room=roomMatch[1];rest=rest.replace(roomMatch[0],' ');}
  const parts=rest.split(/\s*[|·•;]\s*|\s+-\s+|,\s*/).map(p=>p.trim()).filter(p=>/[A-Za-z]/.test(p));
  if(!room){const i=parts.findIndex(p=>ROOM_TOKEN.test(p)&&p.length<=12);if(i>0||(i===0&&parts.length>1)){room=parts[i];parts.splice(i,1);}}
  let klass='';const k=parts.findIndex(p=>/^kelas\s+\S+$/i.test(p)||/^[A-Z]$/.test(p));if(k>0){klass=parts[k].replace(/^kelas\s+/i,'');parts.splice(k,1);}
  const course=clean(parts.shift(),120);
  const lecturer=clean(parts.find(p=>/(dr\.|prof|s\.t|m\.t|ph\.?d|ir\.|,\s*m\.)/i.test(p)||p.split(' ').length>=2) ?? '',120);
  if(!day||!course){out.push({skip:'incomplete',line});continue;}
  out.push({day,start:time(range[1],range[2]),end:time(range[3],range[4]),course,code,klass,room:clean(room,80),lecturer});
 }
 return out;
}

export function parseSchedule(input){
 const text=String(input ?? '').replace(/^﻿/,'').trim();
 if(!text)return {items:[],skipped:{},format:'empty'};
 let candidates,format;
 if(/^[\[{]/.test(text)){
  try{candidates=[...records(JSON.parse(text))].map(fromRecord).filter(Boolean);format='json';}
  catch{candidates=null;}
 }
 if(!candidates){
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const rows=table(lines);
  if(rows){candidates=rows.map(fromRecord).filter(Boolean);format='table';}
  else{candidates=freeText(lines);format='text';}
 }
 const skipped={};const seen=new Map();
 for(const c of candidates){
  if(c.skip){skipped[c.skip]=(skipped[c.skip]||0)+1;continue;}
  if(!c.start||!c.end||c.end<=c.start){skipped.time=(skipped.time||0)+1;continue;}
  // SIAP lists every meeting; one weekly slot per course, class, day and start time.
  const slot=[c.code||c.course,c.klass,c.day,c.start].join('|').toLowerCase();
  const prev=seen.get(slot);
  if(prev){for(const f of ['room','lecturer','code','klass'])if(!prev[f]&&c[f])prev[f]=c[f];continue;}
  seen.set(slot,{...c});
 }
 const sorted=[...seen.values()].sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start));
 // Stable id: course name + nth weekly meeting. Name only (not code or class), because a Gentayu copy
 // may lack the code/class that an IRS export has; a moved room or time is then an update, not delete + add.
 const counter=new Map();
 const items=sorted.slice(0,MAX_ITEMS).map(c=>{
  const base=courseKey(c.course);
  const n=(counter.get(base)||0)+1;counter.set(base,n);
  return {external_id:`${base}#${n}`.slice(0,200),day:c.day,start:c.start,end:c.end,course:c.course,lecturer:c.lecturer,room:c.room,code:c.code,klass:c.klass};
 });
 if(sorted.length>MAX_ITEMS)skipped.limit=sorted.length-MAX_ITEMS;
 return {items,skipped,format};
}

export const courseKey=name=>String(name ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
const FIELDS=['day','start','end','course','lecturer','room'];
// existing: rows {schedule_id, external_id, day, start, end, course, lecturer, room} already imported for this owner.
export function diffSchedule(existing,items){
 const byId=new Map(existing.map(r=>[r.external_id,r]));
 const add=[],update=[],same=[],pending=[],relink=[];
 const match=(item,old)=>{
  byId.delete(old.external_id);
  const changes=FIELDS.filter(f=>String(old[f] ?? '')!==String(item[f] ?? ''));
  if(changes.length)update.push({...item,schedule_id:old.schedule_id,changes,before:Object.fromEntries(changes.map(f=>[f,old[f]]))});
  else{same.push(item);if(old.external_id!==item.external_id)relink.push({schedule_id:old.schedule_id,external_id:item.external_id});}
 };
 for(const item of items){const old=byId.get(item.external_id);if(old)match(item,old);else pending.push(item);}
 // Fallback for rows imported under an older id: same course name, closest day/time first.
 for(const item of pending){
  const key=courseKey(item.course);
  const candidates=[...byId.values()].filter(r=>courseKey(r.course)===key).sort((a,b)=>(a.day===item.day?0:1)-(b.day===item.day?0:1)||Math.abs(a.day-item.day)-Math.abs(b.day-item.day));
  if(candidates[0])match(item,candidates[0]);else add.push(item);
 }
 return {add,update,remove:[...byId.values()],same:same.length,relink};
}
