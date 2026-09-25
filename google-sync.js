import { randomBytes } from 'node:crypto';
import { fields, table, pick, same, hash, toEvent, fromEvent } from './google-model.js';

// One database lease covers both profiles because a shared task may be in both calendars.
export async function withGoogleLock(db, fn) {
 const owner=randomBytes(16).toString('hex'),now=Date.now();
 const lock=await db.prepare(`UPDATE google_lock SET owner=?,expires=? WHERE id=1 AND expires<?`).run(owner,now+90000,now);
 if(!lock.changes){const e=Error('Sinkronisasi sedang berjalan. Coba sebentar lagi.');e.status=409;throw e;}
 try{return await fn();}finally{await db.prepare('UPDATE google_lock SET expires=0 WHERE id=1 AND owner=?').run(owner);}
}
async function compareAndChange(db,kind,id,old,row) {
 const keys=fields[kind],where='id=? AND '+keys.map(k=>`${k}=?`).join(' AND ');
 const args=[id,...keys.map(k=>old[k])];
 const result=row
  ? await db.prepare(`UPDATE ${table(kind)} SET ${keys.map(k=>`${k}=?`).join(',')} WHERE ${where}`).run(...keys.map(k=>row[k]),...args)
  : await db.prepare(`DELETE FROM ${table(kind)} WHERE ${where}`).run(...args);
 return Boolean(result.changes);
}
async function importEvent(db,user,event,kind,row) {
 const keys=fields[kind];
 const insert=conn=>conn.prepare(`INSERT INTO ${table(kind)}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`);
 const map=(conn,id)=>conn.prepare('INSERT INTO google_maps(user_name,kind,local_id,event_id,baseline) VALUES(?,?,?,?,?)').run(user,kind,id,event.id,JSON.stringify(row));
 // Native SQLite executes this block synchronously. PostgreSQL uses a dedicated connection.
 if(db.exec) {
  db.exec('BEGIN IMMEDIATE');
  try {const r=insert(db).run(...keys.map(k=>row[k]));map(db,Number(r.lastInsertRowid));db.exec('COMMIT');}
  catch(e){db.exec('ROLLBACK');throw e;}
 } else await db.transaction(async conn=>{const r=await insert(conn).run(...keys.map(k=>row[k]));await map(conn,Number(r.lastInsertRowid));});
}
export async function syncCalendar(db,user,remote,{resolution}={}) {
 const started=Date.now(),result={conflicts:[],warnings:[],changed:0};
 const checkTime=()=>{if(Date.now()-started>40000){const e=Error('Sebagian data sudah disinkronkan. Klik sinkronkan lagi untuk melanjutkan.');e.status=503;throw e;}};
 const events=new Map();let page;
 do {checkTime();const list=await remote.list(page);for(const e of list.items||[])events.set(e.id,e);page=list.nextPageToken;}while(page);
 const maps=await db.prepare('SELECT * FROM google_maps WHERE user_name=?').all(user);
 const mapped=new Set(maps.map(m=>m.event_id));
 // An exception cannot be represented by Snoomy's weekly-only model. Protect its entire series.
 const exceptions=new Set([...events.values()].filter(e=>e.recurringEventId).map(e=>e.recurringEventId));
 for(const map of maps) {
  checkTime();
  if(exceptions.has(map.event_id)){result.warnings.push('Satu seri punya perubahan per kejadian. Kembalikan pengecualiannya di Google sebelum menyinkronkan seri itu.');continue;}
  const record=await db.prepare(`SELECT * FROM ${table(map.kind)} WHERE id=?`).get(map.local_id);
  const local=pick(map.kind,record),base=JSON.parse(map.baseline);
  let event=events.get(map.event_id);
  if(!event)event=await remote.get(map.event_id);
  let other=null;
  try{if(event&&event.status!=='cancelled'){const converted=fromEvent(event,user,base);if(converted.kind!==map.kind)throw Error('Jenis acara berubah. Kembalikan jenisnya di Google.');other=converted.row;}}
  catch(e){result.warnings.push(e.message);continue;}
  const eligible=local&&(map.kind==='schedule'?local.owner===user:[user,'Berdua'].includes(local.assignee));
  // Reassignment removes the old account's copy without deleting the shared Snoomy record.
  if(local&&!eligible){if(other)await remote.remove(map.event_id,event.etag);await db.prepare('DELETE FROM google_maps WHERE id=?').run(map.id);continue;}
  if(same(local,other)){if(!same(base,local))await db.prepare('UPDATE google_maps SET baseline=? WHERE id=?').run(JSON.stringify(local),map.id);continue;}
  const localChanged=!same(local,base),remoteChanged=!same(other,base);
  let side=localChanged?'local':'google';
  if(localChanged&&remoteChanged){
   const version=hash(JSON.stringify([local,other,event?.etag]));
   if(resolution?.id===map.id&&resolution.version===version&&['local','google'].includes(resolution.side))side=resolution.side;
   else {result.conflicts.push({id:map.id,version,title:local?.course||local?.title||base?.course||base?.title||'Acara',local,google:other});continue;}
  }
  if(side==='google') {
   // Deleted local rows are not resurrected automatically, even when resolving a conflict.
   if(!local&&other){result.warnings.push('Item sudah dihapus dari Snoomy. Pilih versi Snoomy untuk menghapus salinan Google, atau buat item baru.');continue;}
   if(local&&!await compareAndChange(db,map.kind,map.local_id,local,other)){result.warnings.push('Ada edit baru di Snoomy saat sinkronisasi. Akan dicoba lagi.');continue;}
   await db.prepare('UPDATE google_maps SET baseline=? WHERE id=?').run(JSON.stringify(other),map.id);
  } else {
   if(local) {
    if(!other){result.warnings.push('Acara sudah dihapus di Google. Pilih versi Google untuk menghapus item Snoomy, atau buat item baru di Snoomy.');continue;}
    await remote.update(map.event_id,toEvent(map.kind,local,event.start?.dateTime?.slice(0,10)),event.etag);
   } else if(other)await remote.remove(map.event_id,event.etag);
   await db.prepare('UPDATE google_maps SET baseline=? WHERE id=?').run(JSON.stringify(local),map.id);
  }
  result.changed++;
 }
 for(const event of events.values()) {
  checkTime();if(mapped.has(event.id)||event.status==='cancelled'||event.recurringEventId)continue;
  if(exceptions.has(event.id)){result.warnings.push('Seri dengan pengecualian per kejadian belum didukung.');continue;}
  // Generated IDs may exist after a successful Google write followed by a database timeout.
  if(event.id.startsWith('5000'))continue;
  try{const {kind,row}=fromEvent(event,user);await importEvent(db,user,event,kind,row);result.changed++;}
  catch(e){if(e.code)throw e;result.warnings.push(e.message);}
 }
 const existing=await db.prepare('SELECT kind,local_id FROM google_maps WHERE user_name=?').all(user);
 for(const kind of ['schedule','task']) {
  const rows=await db.prepare(kind==='schedule'?'SELECT * FROM schedules WHERE owner=?':"SELECT * FROM tasks WHERE assignee=? OR assignee='Berdua'").all(user);
  for(const record of rows){checkTime();if(existing.some(m=>m.kind===kind&&m.local_id===record.id))continue;
   const local=pick(kind,record),id='5000'+hash(`${user}:${kind}:${record.id}:${remote.calendarId}`);
   const event=await remote.create({...toEvent(kind,local),id});
   await db.prepare('INSERT INTO google_maps(user_name,kind,local_id,event_id,baseline) VALUES(?,?,?,?,?)').run(user,kind,record.id,event.id,JSON.stringify(event.recovered?null:local));result.changed++;
  }
 }
 result.warnings=[...new Set(result.warnings)];return result;
}
