import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { postgresAdapter } from '../database.js';
import { toEvent, fromEvent, pick } from '../google-model.js';
import { syncCalendar, withGoogleLock } from '../google-sync.js';
import { encrypt, decrypt, configuration } from '../google.js';
import { mountGoogle, scope } from '../google.js';
import { createAuth } from '../auth.js';
import express from 'express';

function remote() {
 const events=new Map();let sequence=0;
 const save=e=>{const next={...e,etag:String(++sequence)};events.set(e.id,next);return structuredClone(next);};
 return {calendarId:'test',events,save,
  list:async()=>({items:[...events.values()].map(e=>structuredClone(e))}),
  get:async id=>structuredClone(events.get(id)),
  create:async e=>events.has(e.id)?{...structuredClone(events.get(e.id)),recovered:true}:save(e),
  async update(id,body,etag){assert.equal(events.get(id).etag,etag);return save({...events.get(id),...body});},
  async remove(id,etag){assert.equal(events.get(id).etag,etag);save({id,status:'cancelled'});},
 };
}
function sqlite(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));return db;}
test('event conversions preserve WIB, weekly recurrence, completion and reject unsupported shapes',()=>{
 const row={owner:'Moreno',day:7,start:'08:00',end:'10:00',course:'Kuliah',lecturer:'Dosen',room:'A'};
 assert.deepEqual(fromEvent(toEvent('schedule',row),'Moreno').row,row);
 const task={title:'Skripsi',deadline:'2026-12-31',assignee:'Berdua',priority:'Tinggi',done:1};
 assert.deepEqual(fromEvent(toEvent('task',task),'Moreno',task).row,task);
 assert.equal(toEvent('task',task).end.date,'2027-01-01');
 assert.throws(()=>fromEvent({...toEvent('schedule',row),recurrence:['RRULE:FREQ=WEEKLY;COUNT=2']},'Moreno'));
 assert.throws(()=>fromEvent({...toEvent('task',task),end:{date:'2027-01-02'}},'Moreno'));
 assert.throws(()=>fromEvent({...toEvent('schedule',row),recurringEventId:'series'},'Moreno'));
});
test('OAuth configuration and token encryption fail closed',()=>{
 const key=randomBytes(32),cipher=encrypt({refresh_token:'private-token'},key);
 assert.ok(!cipher.includes('private-token'));assert.deepEqual(decrypt(cipher,key),{refresh_token:'private-token'});
 assert.throws(()=>decrypt(cipher,randomBytes(32)));
 assert.equal(configuration({}),null);
 const env={GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_REDIRECT_URI:'https://snoomy.vercel.app/google/callback',GOOGLE_TOKEN_ENCRYPTION_KEY:key.toString('base64')};
 assert.ok(configuration(env));assert.equal(configuration({...env,GOOGLE_REDIRECT_URI:'http://example.com/google/callback'}),null);
});
for(const dialect of ['SQLite','PostgreSQL'])test(`${dialect}: two-way CRUD, shared tasks, conflict resolution, lease, import and reassignment`,async()=>{
 let db;
 if(dialect==='SQLite')db=sqlite();else {
  const engine=new PGlite();await engine.exec(readFileSync(new URL('../schema-postgres.sql',import.meta.url),'utf8'));
  const client={query:async(sql,args)=>{const r=await engine.query(sql,args);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};},release(){}};
  db=postgresAdapter({...client,connect:async()=>client,end:()=>engine.close()});
 }
 try {
  const a=remote(),b=remote();b.calendarId='cahya';
  await db.prepare('INSERT INTO schedules(owner,day,start,end,course,lecturer,room) VALUES(?,?,?,?,?,?,?)').run('Moreno',1,'08:00','09:00','Math','Dosen','A');
  await db.prepare('INSERT INTO schedules(owner,day,start,end,course,lecturer,room) VALUES(?,?,?,?,?,?,?)').run('Cahya',2,'08:00','09:00','English','','B');
  await db.prepare('INSERT INTO tasks(title,deadline,assignee,priority) VALUES(?,?,?,?)').run('Together','2026-10-01','Berdua','Tinggi');
  await withGoogleLock(db,()=>syncCalendar(db,'Moreno',a));assert.equal(a.events.size,2);
  await syncCalendar(db,'Cahya',b);assert.equal(b.events.size,2);
  assert.equal((await syncCalendar(db,'Moreno',a)).changed,0);
  const maps=await db.prepare('SELECT * FROM google_maps WHERE user_name=?').all('Moreno');
  const sm=maps.find(m=>m.kind==='schedule'),tm=maps.find(m=>m.kind==='task');
  a.save({...a.events.get(sm.event_id),summary:'Google edit',location:'C'});
  await syncCalendar(db,'Moreno',a);assert.equal((await db.prepare('SELECT * FROM schedules WHERE id=?').get(sm.local_id)).course,'Google edit');
  await db.prepare('UPDATE tasks SET done=1 WHERE id=?').run(tm.local_id);
  await syncCalendar(db,'Moreno',a);assert.equal(a.events.get(tm.event_id).summary,'[Selesai] Together');
  await syncCalendar(db,'Cahya',b);assert.ok([...b.events.values()].some(e=>e.summary==='[Selesai] Together'));
  a.save({...a.events.get(sm.event_id),summary:'Remote conflict'});
  await db.prepare('UPDATE schedules SET course=? WHERE id=?').run('Local conflict',sm.local_id);
  let r=await syncCalendar(db,'Moreno',a);assert.equal(r.conflicts.length,1);assert.equal(a.events.get(sm.event_id).summary,'Remote conflict');
  const c=r.conflicts[0];r=await syncCalendar(db,'Moreno',a,{resolution:{id:c.id,version:c.version,side:'google'}});assert.equal(r.conflicts.length,0);
  assert.equal((await db.prepare('SELECT * FROM schedules WHERE id=?').get(sm.local_id)).course,'Remote conflict');
  a.save({id:'newtask',summary:'From Google',start:{date:'2026-10-03'},end:{date:'2026-10-04'}});
  await syncCalendar(db,'Moreno',a);await syncCalendar(db,'Moreno',a);
  assert.equal((await db.prepare("SELECT * FROM tasks WHERE title='From Google'").all()).length,1);
  a.save({id:tm.event_id,status:'cancelled'});await syncCalendar(db,'Moreno',a);
  assert.equal(await db.prepare('SELECT * FROM tasks WHERE id=?').get(tm.local_id),undefined);
  await syncCalendar(db,'Cahya',b);assert.ok([...b.events.values()].some(e=>e.status==='cancelled'));
  await db.prepare('DELETE FROM schedules WHERE id=?').run(sm.local_id);await syncCalendar(db,'Moreno',a);assert.equal(a.events.get(sm.event_id).status,'cancelled');
  const imported=await db.prepare("SELECT * FROM tasks WHERE title='From Google'").get();
  await db.prepare('UPDATE tasks SET assignee=? WHERE id=?').run('Cahya',imported.id);await syncCalendar(db,'Moreno',a);
  assert.equal(a.events.get('newtask').status,'cancelled');assert.equal((await db.prepare('SELECT * FROM tasks WHERE id=?').get(imported.id)).assignee,'Cahya');
  await withGoogleLock(db,async()=>{await assert.rejects(withGoogleLock(db,async()=>{}),/sedang berjalan/);});
  await withGoogleLock(db,async()=>{});
 }finally{await db.close();}
});
test('concurrent Snoomy writes do not get overwritten by a stale Google snapshot',async()=>{
 const db=sqlite(),a=remote();
 try{
  db.prepare('INSERT INTO tasks(title,deadline,assignee,priority) VALUES(?,?,?,?)').run('Original','2026-10-01','Moreno','Sedang');
  await syncCalendar(db,'Moreno',a);
  const map=db.prepare('SELECT * FROM google_maps').get();
  a.save({...a.events.get(map.event_id),summary:'Remote'});
  // An intervening write between the local read and remote fetch must fail the CAS.
  a.list=async()=>({items:[]});const get=a.get;
  a.get=async id=>{db.prepare('UPDATE tasks SET title=? WHERE id=?').run('Concurrent',map.local_id);return get(id);};
  const result=await syncCalendar(db,'Moreno',a);assert.ok(result.warnings.length);
  assert.equal(db.prepare('SELECT title FROM tasks').get().title,'Concurrent');
 }finally{db.close();}
});
test('pagination, exceptions and export retry preserve data and avoid duplicates',async()=>{
 const db=sqlite(),a=remote();
 try{
  db.prepare('INSERT INTO schedules(owner,day,start,end,course,lecturer,room) VALUES(?,?,?,?,?,?,?)').run('Moreno',1,'08:00','09:00','Class','','');
  await syncCalendar(db,'Moreno',a);const map=db.prepare('SELECT * FROM google_maps').get();
  a.save({id:'exception',recurringEventId:map.event_id,status:'cancelled'});
  a.save({...a.events.get(map.event_id),summary:'Changed series'});
  let result=await syncCalendar(db,'Moreno',a);assert.ok(result.warnings.length);assert.equal(db.prepare('SELECT course FROM schedules').get().course,'Class');
  a.events.delete('exception');
  const list=a.list;a.list=async page=>page?list():{items:[],nextPageToken:'page2'};
  await syncCalendar(db,'Moreno',a);assert.equal(db.prepare('SELECT course FROM schedules').get().course,'Changed series');
  // Simulate a crash after a remote create but before the mapping is saved.
  db.prepare('DELETE FROM google_maps').run();
  await syncCalendar(db,'Moreno',a);assert.equal(a.events.size,1);
  assert.equal((await syncCalendar(db,'Moreno',a)).conflicts.length,0);
 }finally{db.close();}
});
test('OAuth state is session/browser bound, one-use, and stores encrypted credentials',async()=>{
 const db=sqlite(),auth=createAuth(db),session=await auth.create('Moreno');
 const savedEnv={...process.env},originalFetch=globalThis.fetch;
 Object.assign(process.env,{GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',GOOGLE_REDIRECT_URI:'http://localhost:31990/google/callback',GOOGLE_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64')});
 const app=express();app.use(express.json());
 const cookie=req=>(req.headers.cookie||'').split('; ').find(c=>c.startsWith('duo='))?.slice(4);
 const mount=mountGoogle(app,db,{cookie});
 app.use('/api',async(req,res,next)=>{const s=await auth.find(cookie(req));if(!s)return res.sendStatus(401);req.user=s.user;next();});mount();
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 globalThis.fetch=async(url,options)=>String(url).startsWith('https://oauth2.googleapis.com/')?new Response(JSON.stringify({access_token:'access',refresh_token:'secret-refresh',scope,expires_in:3600}),{status:200}):originalFetch(url,options);
 try{
  assert.equal((await fetch(base+'/api/google/status')).status,401);
  const start=await fetch(base+'/api/google/connect',{method:'POST',headers:{cookie:'duo='+session,'Content-Type':'application/json'},body:'{}'});
  const body=await start.json(),url=new URL(body.url),oauthCookie=start.headers.get('set-cookie').split(';')[0];
  assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  const callback=base+'/google/callback?state='+url.searchParams.get('state')+'&code=test';
  assert.match((await fetch(callback,{redirect:'manual'})).headers.get('location'),/failed/);
  const success=await fetch(callback,{redirect:'manual',headers:{cookie:oauthCookie}});assert.match(success.headers.get('location'),/connected/);
  const row=db.prepare('SELECT * FROM google_connections').get();assert.equal(row.user_name,'Moreno');assert.ok(!row.tokens.includes('secret-refresh'));
  assert.match((await fetch(callback,{redirect:'manual',headers:{cookie:oauthCookie}})).headers.get('location'),/failed/);
  const status=await (await fetch(base+'/api/google/status',{headers:{cookie:'duo='+session}})).json();assert.equal(status.connected,true);assert.equal(status.tokens,undefined);
  await fetch(base+'/api/google/disconnect',{method:'POST',headers:{cookie:'duo='+session,'Content-Type':'application/json'},body:'{}'});
  assert.equal(db.prepare('SELECT tokens FROM google_connections').get().tokens,'');
 }finally{globalThis.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in savedEnv))delete process.env[k];Object.assign(process.env,savedEnv);await new Promise(r=>server.close(r));db.close();}
});
