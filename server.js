import express from 'express';
import { mountGallery } from './gallery.js';
import { mountGoogle } from './google.js';
import { mountBudget } from './budget.js';
import { mountGame } from './game.js';
import { mountParty } from './party.js';
import { mountBoardGames } from './boardgames.js';
import { mountReal, mountRealTick } from './real.js';
import { createPush } from './push.js';
import { mountChat } from './chat.js';
import { mountSurprise } from './surprise.js';
import { createAuth } from './auth.js';
import { parseSchedule, diffSchedule, parseMeetings, SOURCE as SIAP_SOURCE } from './undip-import.js';
import { openDatabase } from './database.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual, randomBytes, createHash } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const app = express();
const users = ['Moreno', 'Cahya'];
const pins = { Moreno: process.env.MORENO_PIN || '', Cahya: process.env.CAHYA_PIN || '' };
if (Object.values(pins).some(p => p && !/^\d{4}$/.test(p))) throw Error('PIN harus 4 digit.');
if (process.env.NODE_ENV === 'production' && (!pins.Moreno || !pins.Cahya || process.env.COOKIE_SECURE !== 'true') && !process.env.VERCEL) throw Error('Hosting memerlukan kedua PIN dan COOKIE_SECURE=true.');
const db = await openDatabase();
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const auth = createAuth(db);
app.get('/health', (req,res) => res.json({ok:true}));
app.disable('x-powered-by');
app.use('/api/gallery', express.json({ limit: '4200kb' }));
// A Real post carries two compressed photos and a preview.
app.use('/api/real', express.json({ limit: '1600kb' }));
app.use('/api/surprise', express.json({ limit: '2200kb' }));
app.use(express.json({ limit: '350kb' }));
app.use((req,res,next) => {
 res.set('X-Content-Type-Options','nosniff');
 res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; frame-src 'self' https://www.youtube-nocookie.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
 if(req.path.startsWith('/api')) res.set('Cache-Control','no-store');
 if(!['GET','HEAD','OPTIONS'].includes(req.method) && !req.is('application/json')) return res.status(415).json({error:'Gunakan JSON.'});
 next();
});
const cookie = req => (req.headers.cookie || '').split('; ').find(c => c.startsWith('duo='))?.slice(4);
const mountGoogleAuthenticated=mountGoogle(app,db,{cookie});
const push=createPush(db);
// The scheduled reminder check needs no login; it can only start a Real that is already due.
mountRealTick(app,db,{push});
// The browser extension sends the SIAP schedule page here with a personal sync token (no Snoomy cookie).
app.post('/api/undip/push',async (req,res)=>{
 const token=/^Bearer (snm_[A-Za-z0-9_-]{20,100})$/.exec(req.get('authorization')||'')?.[1];
 const row=token&&await db.prepare('SELECT user_name,last_used FROM sync_tokens WHERE token_hash=?').get(tokenHash(token));
 if(!row)return res.status(401).json({error:'Token sinkron tidak valid. Buat token baru di Snoomy.'});
 if(Date.now()-Number(row.last_used)<30000)return res.status(429).json({error:'Terlalu sering. Coba lagi sebentar.'});
 await db.prepare('UPDATE sync_tokens SET last_used=? WHERE token_hash=?').run(Date.now(),tokenHash(token));
 let result;
 try{result={ok:true,...await siapApply(row.user_name,await siapPlan(row.user_name,req.body?.text),false)};if(Array.isArray(req.body?.meetings))result.meetings=await siapMeetings(row.user_name,req.body.meetings);}
 catch(e){result={ok:false,error:e.status?e.message:'Server sedang bermasalah.'};}
 await db.prepare('UPDATE sync_tokens SET last_result=? WHERE token_hash=?').run(JSON.stringify({...result,at:Date.now()}),tokenHash(token));
 res.status(result.ok?200:400).json({user:row.user_name,...result});
});
app.post('/api/login', async (req,res) => {
 const {user,pin=''} = req.body || {};
 if(!users.includes(user)) return res.status(400).json({error:'Pilih profil yang valid.'});
 if(!await auth.attempt(user)) return res.status(429).json({error:'Terlalu banyak percobaan. Tunggu 5 menit.'});
 const expected = Buffer.from(pins[user]), given = Buffer.from(String(pin));
 if(expected.length && (given.length !== expected.length || !timingSafeEqual(given,expected))) {
  return res.status(401).json({error:'PIN belum cocok.'});
 }
 await auth.reset(user);
 await auth.remove(cookie(req));
 const token=await auth.create(user);
 res.cookie('duo',token,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',maxAge:86400000});
 res.json({user});
});
app.use('/api', async (req,res,next) => {
 const session=await auth.find(cookie(req));
 if(!session) return res.status(401).json({error:'Silakan pilih profil lagi.'});
 req.user=session.user; next();
});
mountGoogleAuthenticated();
app.post('/api/logout',async (req,res)=>{await auth.remove(cookie(req));res.clearCookie('duo');res.json({ok:true});});
app.get('/api/state',async (req,res)=>res.json({user:req.user,...await meetingState(),schedules:await db.prepare('SELECT s.*, ss.source FROM schedules s LEFT JOIN schedule_sources ss ON ss.schedule_id=s.id ORDER BY s.day,s.start').all(),tasks:await db.prepare('SELECT * FROM tasks ORDER BY done,deadline,id DESC').all()}));
const fail = message => { const e=Error(message);e.status=400;throw e; };
function str(value,label,max=120,optional=false) {
 if(typeof value !== 'string' || (!optional && !value.trim()) || value.trim().length>max) fail(`${label} tidak valid (maksimal ${max} karakter).`);
 return value.trim();
}
function schedule(body) {
 const day=Number(body.day), start=body.start, end=body.end;
 if(!Number.isInteger(day)||day<1||day>7||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||end<=start) fail('Hari/jam tidak valid. Jam selesai harus setelah mulai.');
 return [day,start,end,str(body.course,'Matkul'),str(body.lecturer ?? '','Dosen',120,true),str(body.room ?? '','Ruangan',80,true)];
}
function task(body) {
 const title=str(body.title,'Judul',180), deadline=body.deadline;
 if(typeof deadline!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||!Number.isFinite(Date.parse(deadline))||new Date(deadline).toISOString().slice(0,10)!==deadline) fail('Tanggal deadline tidak valid.');
 if(![...users,'Berdua'].includes(body.assignee)||!['Rendah','Sedang','Tinggi'].includes(body.priority)) fail('Penanggung jawab/prioritas tidak valid.');
 return [title,deadline,body.assignee,body.priority];
}
async function own(req) {
 const row=await db.prepare('SELECT * FROM schedules WHERE id=?').get(req.params.id);
 if(!row) {const e=Error('Jadwal tidak ditemukan.');e.status=404;throw e;}
 if(row.owner!==req.user) {const e=Error('Hanya pemilik yang bisa mengubah jadwal.');e.status=403;throw e;}
}
app.post('/api/schedules',async (req,res)=>{const values=schedule(req.body); const r=await db.prepare('INSERT INTO schedules(owner,day,start,end,course,lecturer,room) VALUES(?,?,?,?,?,?,?)').run(req.user,...values);res.status(201).json({id:Number(r.lastInsertRowid)});});
app.put('/api/schedules/:id',async (req,res)=>{await own(req);await db.prepare('UPDATE schedules SET day=?,start=?,end=?,course=?,lecturer=?,room=? WHERE id=?').run(...schedule(req.body),req.params.id);res.json({ok:true});});
app.delete('/api/schedules/:id',async (req,res)=>{await own(req);await db.prepare('DELETE FROM schedules WHERE id=?').run(req.params.id);await db.prepare('DELETE FROM schedule_sources WHERE schedule_id=?').run(req.params.id);res.json({ok:true});});
// Import a class schedule the student copied from SIAP / Gentayu after logging in there themself.
// Only rows previously imported by this user are updated or removed; manual schedules are never touched.
async function transaction(fn){
 if(db.exec){db.exec('BEGIN IMMEDIATE');try{const result=await fn(db);db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 return db.transaction(fn);
}
async function siapPlan(user,text){
 if(typeof text!=='string'||!text.trim())fail('Tempel atau unggah jadwal dari SIAP/Gentayu dulu.');
 if(text.length>300000)fail('Data terlalu besar (maksimal 300 ribu karakter).');
 const parsed=parseSchedule(text);
 if(!parsed.items.length)fail('Belum ada jadwal yang terbaca. Pastikan ada hari, jam mulai–selesai, dan nama matkul.');
 for(const item of parsed.items)schedule(item);
 await db.prepare('DELETE FROM schedule_sources WHERE owner=? AND schedule_id NOT IN (SELECT id FROM schedules)').run(user);
 const existing=await db.prepare('SELECT ss.schedule_id, ss.external_id, s.day, s.start, s.end, s.course, s.lecturer, s.room FROM schedule_sources ss JOIN schedules s ON s.id=ss.schedule_id WHERE ss.owner=? AND ss.source=?').all(user,SIAP_SOURCE);
 return {...parsed,diff:diffSchedule(existing,parsed.items)};
}
async function siapApply(user,plan,keep){
 const now=Date.now();
 await transaction(async conn=>{
  for(const item of plan.diff.add){
   const r=await conn.prepare('INSERT INTO schedules(owner,day,start,end,course,lecturer,room) VALUES(?,?,?,?,?,?,?)').run(user,...schedule(item));
   await conn.prepare('INSERT INTO schedule_sources(schedule_id,owner,source,external_id,imported) VALUES(?,?,?,?,?)').run(Number(r.lastInsertRowid),user,SIAP_SOURCE,item.external_id,now);
  }
  for(const item of plan.diff.update){
   await conn.prepare('UPDATE schedules SET day=?,start=?,end=?,course=?,lecturer=?,room=? WHERE id=? AND owner=?').run(...schedule(item),item.schedule_id,user);
   await conn.prepare('UPDATE schedule_sources SET external_id=?,imported=? WHERE schedule_id=?').run(item.external_id,now,item.schedule_id);
  }
  for(const link of plan.diff.relink)await conn.prepare('UPDATE schedule_sources SET external_id=?,imported=? WHERE schedule_id=?').run(link.external_id,now,link.schedule_id);
  if(!keep)for(const row of plan.diff.remove){
   await conn.prepare('DELETE FROM schedules WHERE id=? AND owner=?').run(row.schedule_id,user);
   await conn.prepare('DELETE FROM schedule_sources WHERE schedule_id=?').run(row.schedule_id);
  }
 });
 return {added:plan.diff.add.length,updated:plan.diff.update.length,removed:keep?0:plan.diff.remove.length,same:plan.diff.same};
}
// Dated SIAP meetings: replaced as a whole on every extension sync (the calendar is the source of truth).
async function siapMeetings(user,list){
 const meetings=parseMeetings(list);
 if(!meetings.length)return 0;
 await transaction(async conn=>{
  await conn.prepare('DELETE FROM schedule_meetings WHERE owner=?').run(user);
  for(let i=0;i<meetings.length;i+=50){
   const chunk=meetings.slice(i,i+50);
   await conn.prepare('INSERT INTO schedule_meetings(owner,external_id,date,start,end,course,room,kind) VALUES '+chunk.map(()=>'(?,?,?,?,?,?,?,?)').join(','))
    .run(...chunk.flatMap(m=>[user,m.id,m.date,m.start,m.end,m.course,m.room,m.kind]));
  }
 });
 return meetings.length;
}
// This week and next (Monday-based, WIB), plus each owner's covered date range.
async function meetingState(){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
 const t=Date.parse(today+'T00:00:00Z'), monday=t-((new Date(t).getUTCDay()+6)%7)*86400000;
 const iso=ms=>new Date(ms).toISOString().slice(0,10);
 const meetings=await db.prepare('SELECT owner, external_id AS id, date, start, end, course, room, kind FROM schedule_meetings WHERE date BETWEEN ? AND ? ORDER BY date,start').all(iso(monday),iso(monday+13*86400000));
 const ranges=await db.prepare('SELECT owner, MIN(date) AS from_date, MAX(date) AS to_date FROM schedule_meetings GROUP BY owner').all();
 // Ranges are clipped to the window the client receives meetings for, so dates outside it fall back to weekly.
 const from=iso(monday),to=iso(monday+13*86400000);
 return {meetings,meetingRange:Object.fromEntries(ranges.map(r=>[r.owner,{from:r.from_date>from?r.from_date:from,to:r.to_date<to?r.to_date:to}]))};
}
const planView=({format,skipped,items,diff})=>({format,skipped,total:items.length,add:diff.add,update:diff.update,remove:diff.remove,same:diff.same});
app.post('/api/undip/preview',async (req,res)=>res.json(planView(await siapPlan(req.user,req.body?.text))));
app.post('/api/undip/import',async (req,res)=>res.json(await siapApply(req.user,await siapPlan(req.user,req.body?.text),req.body.keepMissing===true)));
// Personal sync token for the "Snoomy × SIAP" browser extension. Only its SHA-256 hash is stored.
app.get('/api/undip/token',async (req,res)=>{
 const row=await db.prepare('SELECT created,last_used,last_result FROM sync_tokens WHERE user_name=?').get(req.user);
 res.json(row?{exists:true,created:Number(row.created),lastUsed:Number(row.last_used)||null,lastResult:row.last_result?JSON.parse(row.last_result):null}:{exists:false});
});
app.post('/api/undip/token',async (req,res)=>{
 const token='snm_'+randomBytes(32).toString('base64url');
 await transaction(async conn=>{
  await conn.prepare('DELETE FROM sync_tokens WHERE user_name=?').run(req.user);
  await conn.prepare('INSERT INTO sync_tokens(user_name,token_hash,created,last_used,last_result) VALUES(?,?,?,?,?)').run(req.user,tokenHash(token),Date.now(),0,'');
 });
 res.status(201).json({token});
});
app.delete('/api/undip/token',async (req,res)=>{await db.prepare('DELETE FROM sync_tokens WHERE user_name=?').run(req.user);res.json({ok:true});});
app.post('/api/tasks',async (req,res)=>{const r=await db.prepare('INSERT INTO tasks(title,deadline,assignee,priority) VALUES(?,?,?,?)').run(...task(req.body));res.status(201).json({id:Number(r.lastInsertRowid)});});
app.put('/api/tasks/:id',async (req,res)=>{
 const row=await db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
 if(!row)return res.status(404).json({error:'Tugas tidak ditemukan.'});
 const values=task({...row,...req.body});
 const done=req.body.done ?? row.done;
 if(![0,1,true,false].includes(done))fail('Status tidak valid.');
 await db.prepare('UPDATE tasks SET title=?,deadline=?,assignee=?,priority=?,done=? WHERE id=?').run(...values,Number(done),req.params.id);res.json({ok:true});
});
app.delete('/api/tasks/:id',async (req,res)=>{const r=await db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id);res.status(r.changes?200:404).json(r.changes?{ok:true}:{error:'Tugas tidak ditemukan.'});});
mountBudget(app,db);
mountGallery(app,db);
mountGame(app,db);
mountBoardGames(app,db);
mountParty(app,db);
push.mount(app);
mountReal(app,db,{push});
mountChat(app,db,{push});
mountSurprise(app,db);
app.use(express.static(resolve(root,'public')));
app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint tidak ditemukan.'}));
app.use((err,req,res,next)=>{if(!err.status)console.error('Permintaan server gagal:',err.code || 'internal');res.status(err.status||500).json({error:err.status?err.message:'Server sedang bermasalah.'});});
export default app;
if (!process.env.VERCEL) {
 const server=app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Snoomy siap di http://localhost:${server.address().port}`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async ()=>{await db.close();process.exit(0);}));
}
