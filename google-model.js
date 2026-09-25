// Snoomy supports weekly classes and single-day deadlines, all interpreted in WIB.
import { createHash } from 'node:crypto';
export const fields = {
 schedule: ['owner','day','start','end','course','lecturer','room'],
 task: ['title','deadline','assignee','priority','done'],
};
export const table = kind => kind === 'schedule' ? 'schedules' : 'tasks';
export const pick = (kind, row) => row ? Object.fromEntries(fields[kind].map(k=>[k,row[k]])) : null;
export const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export const hash = value => createHash('sha256').update(value).digest('hex');
const dateOK = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10)===s;
const nextDay = s => new Date(Date.parse(s)+86400000).toISOString().slice(0,10);
const dayOf = s => (new Date(s+'T12:00:00Z').getUTCDay()+6)%7+1;
function wib(value) {
 const d=new Date(value); if(!Number.isFinite(d.getTime()))return null;
 return new Date(d.getTime()+7*3600000).toISOString();
}
export function toEvent(kind,row,anchor='2026-01-05') {
 if(kind==='task')return {summary:(row.done?'[Selesai] ':'')+row.title,
  start:{date:row.deadline},end:{date:nextDay(row.deadline)},
  description:'Deadline Snoomy. Tambahkan [Selesai] di awal judul untuk mencentang tugas. Penanggung jawab dan prioritas diubah lewat Snoomy.'};
 const monday=new Date(anchor+'T12:00:00Z');
 monday.setUTCDate(monday.getUTCDate()-dayOf(anchor)+row.day);
 const date=monday.toISOString().slice(0,10);
 return {summary:row.course,location:row.room,description:row.lecturer,
  start:{dateTime:date+'T'+row.start+':00+07:00',timeZone:'Asia/Jakarta'},
  end:{dateTime:date+'T'+row.end+':00+07:00',timeZone:'Asia/Jakarta'},recurrence:['RRULE:FREQ=WEEKLY']};
}
export function fromEvent(event,user,previous=null) {
 if(event.status==='cancelled')return null;
 if(event.recurringEventId)throw Error('Perubahan satu kejadian kuliah belum didukung. Edit seluruh seri di Google.');
 const title=(event.summary||'').trim();
 if(!title)throw Error('Acara tanpa judul belum bisa masuk Snoomy.');
 if(event.start?.date) {
  const date=event.start.date;
  if(!dateOK(date)||event.end?.date!==nextDay(date)||event.recurrence?.length)throw Error('Tugas harus acara seharian satu tanggal, tanpa pengulangan.');
  const done=title.startsWith('[Selesai] ')?1:0, clean=done?title.slice(10).trim():title;
  if(!clean||clean.length>180)throw Error('Judul tugas maksimal 180 karakter.');
  return {kind:'task',row:{title:clean,deadline:date,assignee:previous?.assignee||user,priority:previous?.priority||'Sedang',done}};
 }
 const start=wib(event.start?.dateTime),end=wib(event.end?.dateTime);
 if(!start||!end||start.slice(0,10)!==end.slice(0,10)||end<=start||start.slice(17,23)!=='00.000'||end.slice(17,23)!=='00.000')throw Error('Jadwal harus mulai dan selesai pada hari yang sama, dengan waktu dalam menit penuh.');
 const recurrence=event.recurrence||[];
 const rule=recurrence.length===1?recurrence[0]:'';
 const tokens=Object.fromEntries(rule.replace(/^RRULE:/,'').split(';').map(x=>x.split('=')));
 const day=dayOf(start.slice(0,10)),weekday=['MO','TU','WE','TH','FR','SA','SU'][day-1];
 if(!rule.startsWith('RRULE:')||tokens.FREQ!=='WEEKLY'||Object.keys(tokens).some(k=>!['FREQ','INTERVAL','BYDAY','WKST'].includes(k))||tokens.INTERVAL&&tokens.INTERVAL!=='1'||tokens.BYDAY&&tokens.BYDAY!==weekday)throw Error('Kuliah harus berulang mingguan satu hari, tanpa tanggal akhir.');
 if(event.start.timeZone && event.start.timeZone!=='Asia/Jakarta')throw Error('Gunakan zona waktu Asia/Jakarta untuk seri kuliah.');
 if(title.length>120||(event.location||'').length>80||(event.description||'').length>120)throw Error('Nama matkul/dosen maksimal 120 karakter dan ruangan 80 karakter.');
 return {kind:'schedule',row:{owner:user,day,start:start.slice(11,16),end:end.slice(11,16),course:title,lecturer:event.description||'',room:event.location||''}};
}
