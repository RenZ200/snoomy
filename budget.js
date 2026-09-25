import { Router } from 'express';
const bad = message => { const e=Error(message);e.status=400;throw e; };
const text=(v,name,max=180,optional=false)=>{if(typeof v!=='string'||v.trim().length>max||(!optional&&!v.trim()))bad(`${name} tidak valid.`);return v.trim();};
const money=(v,zero=false)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<(zero?0:1)||v>100000000000)bad('Nominal harus rupiah bulat, maksimal 100 miliar.');return v;};
const choice=(v,values)=>{if(!values.includes(v))bad('Pilihan tidak valid.');return v;};
const date=v=>{if(typeof v!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)bad('Tanggal tidak valid (tahun 2000–2099).');return v;};
export function validateBudget(kind,b={}) {
 if(!b||typeof b!=='object')bad('Data tidak valid.');
 if(kind==='transaction') {
  const scope=choice(b.scope,['daily','date']),type=choice(b.type,['income','expense']);
  if(scope==='date'&&type!=='expense')bad('Jurnal pacaran mencatat pengeluaran.');
  const photo=b.photo||'';
  if(typeof photo!=='string'||photo.length>280000||(photo&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)))bad('Foto terlalu besar atau format tidak valid.');
  return {scope,type,amount:money(b.amount),category:text(b.category,'Kategori',50),date:date(b.date),note:text(b.note??'','Catatan',500,true),person:choice(b.person,['Moreno','Cahya','Berdua']),payer:scope==='date'?choice(b.payer,['Moreno','Cahya','Split']):'Split',place:text(b.place??'','Tempat',120,true),photo:scope==='date'?photo:''};
 }
 if(kind==='limit') {
  if(typeof b.month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(b.month))bad('Bulan tidak valid.');
  const scope=choice(b.scope,['daily','date']);
  return {scope,month:b.month,category:scope==='date'?'Semua':text(b.category,'Kategori',50),amount:money(b.amount)};
 }
 if(kind==='reminder')return {title:text(b.title,'Nama momen',100),date:date(b.date),target:money(b.target,true)};
 if(kind==='goal')return {title:text(b.title,'Nama target',100),date:date(b.date),target:money(b.target),saved:money(b.saved,true)};
 bad('Jenis catatan tidak valid.');
}
export function mountBudget(app,db) {
 const router=Router();
 router.get('/',async(req,res)=>{const rows=await db.prepare('SELECT * FROM budget_records ORDER BY id DESC').all();res.json(rows.map(r=>({id:r.id,kind:r.kind,createdBy:r.created_by,...JSON.parse(r.data)})));});
 router.post('/:kind',async(req,res)=>{const data=validateBudget(req.params.kind,req.body);const result=await db.prepare('INSERT INTO budget_records(kind,data,created_by) VALUES(?,?,?)').run(req.params.kind,JSON.stringify(data),req.user);res.status(201).json({id:Number(result.lastInsertRowid)});});
 router.put('/:id',async(req,res)=>{if(!/^[1-9]\d*$/.test(req.params.id))return res.status(400).json({error:'ID tidak valid.'});const row=await db.prepare('SELECT * FROM budget_records WHERE id=?').get(req.params.id);if(!row)return res.status(404).json({error:'Catatan tidak ditemukan.'});const data=validateBudget(row.kind,req.body);await db.prepare('UPDATE budget_records SET data=? WHERE id=?').run(JSON.stringify(data),req.params.id);res.json({ok:true});});
 router.delete('/:id',async(req,res)=>{if(!/^[1-9]\d*$/.test(req.params.id))return res.status(400).json({error:'ID tidak valid.'});const r=await db.prepare('DELETE FROM budget_records WHERE id=?').run(req.params.id);res.status(r.changes?200:404).json(r.changes?{ok:true}:{error:'Catatan tidak ditemukan.'});});
 app.use('/api/budget',router);
}
