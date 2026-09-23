import express from 'express';
import { createAuth } from './auth.js';
import { openDatabase } from './database.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const app = express();
const users = ['Moreno', 'Cahya'];
const pins = { Moreno: process.env.MORENO_PIN || '', Cahya: process.env.CAHYA_PIN || '' };
if (Object.values(pins).some(p => p && !/^\d{4}$/.test(p))) throw Error('PIN harus 4 digit.');
if (process.env.NODE_ENV === 'production' && (!pins.Moreno || !pins.Cahya || process.env.COOKIE_SECURE !== 'true')) throw Error('Hosting memerlukan kedua PIN dan COOKIE_SECURE=true.');
const db = await openDatabase();
const auth = createAuth(db);
app.get('/health', (req,res) => res.json({ok:true}));
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use((req,res,next) => {
 res.set('X-Content-Type-Options','nosniff');
 res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 if(req.path.startsWith('/api')) res.set('Cache-Control','no-store');
 if(!['GET','HEAD','OPTIONS'].includes(req.method) && !req.is('application/json')) return res.status(415).json({error:'Gunakan JSON.'});
 next();
});
const cookie = req => (req.headers.cookie || '').split('; ').find(c => c.startsWith('duo='))?.slice(4);
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
app.post('/api/logout',async (req,res)=>{await auth.remove(cookie(req));res.clearCookie('duo');res.json({ok:true});});
app.get('/api/state',async (req,res)=>res.json({user:req.user,schedules:await db.prepare('SELECT * FROM schedules ORDER BY day,start').all(),tasks:await db.prepare('SELECT * FROM tasks ORDER BY done,deadline,id DESC').all()}));
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
app.delete('/api/schedules/:id',async (req,res)=>{await own(req);await db.prepare('DELETE FROM schedules WHERE id=?').run(req.params.id);res.json({ok:true});});
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
app.use(express.static(resolve(root,'public')));
app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint tidak ditemukan.'}));
app.use((err,req,res,next)=>{if(!err.status)console.error('Permintaan server gagal:',err.code || 'internal');res.status(err.status||500).json({error:err.status?err.message:'Server sedang bermasalah.'});});
export default app;
if (!process.env.VERCEL) {
 const server=app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Snoomy siap di http://localhost:${server.address().port}`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async ()=>{await db.close();process.exit(0);}));
}
