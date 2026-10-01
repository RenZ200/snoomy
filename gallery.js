import { createHash } from 'node:crypto';

export const FILE_LIMIT = 3 * 1024 * 1024;
export const ALBUM_LIMIT = 60 * 1024 * 1024;
const fail = (message, status=400) => { throw Object.assign(Error(message), {status}); };
export function mediaType(b) {
 if(b.length<12) return null;
 if(b.subarray(0,3).equals(Buffer.from([255,216,255]))) return 'image/jpeg';
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
 if(['GIF87a','GIF89a'].includes(b.toString('ascii',0,6))) return 'image/gif';
 if(b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP') return 'image/webp';
 if(b.toString('ascii',4,8)==='ftyp' && /^(isom|iso[2-9]|mp4[12]|avc1|M4V )$/.test(b.toString('ascii',8,12))) return 'video/mp4';
 if(b.subarray(0,4).equals(Buffer.from([26,69,223,163])) && b.subarray(0,128).includes(Buffer.from('webm'))) return 'video/webm';
 return null;
}
const caption = v => {
 if(typeof v!=='string'||v.trim().length>180) fail('Catatan maksimal 180 karakter.');
 return v.trim();
};
// SQLite's synchronous driver needs one queue across awaited transaction callbacks.
export function galleryTransaction(db) {
 let tail=Promise.resolve();
 return fn => {
  if(db.transaction) return db.transaction(fn);
  const result=tail.then(async()=>{
   db.exec('BEGIN IMMEDIATE');
   try {const value=await fn(db);db.exec('COMMIT');return value;}
   catch(e){db.exec('ROLLBACK');throw e;}
  });
  tail=result.catch(()=>{});return result;
 };
}
export function mountGallery(app,db) {
 const transaction=galleryTransaction(db);
 app.get('/api/gallery',async(req,res)=>{
  const rows=await db.prepare('SELECT id,owner,caption,mime,size,created FROM gallery ORDER BY created DESC,id DESC').all();
  const {used}=await db.prepare('SELECT used FROM gallery_quota WHERE id=1').get();
  res.json({items:rows,used:Number(used),limit:ALBUM_LIMIT,fileLimit:FILE_LIMIT});
 });
 app.post('/api/gallery',async(req,res)=>{
  const {data,mime,key}=req.body||{};
  const note=caption(req.body?.caption??'');
  if(typeof key!=='string'||! /^[a-zA-Z0-9-]{16,64}$/.test(key)) fail('Kode unggahan tidak valid.');
  if(typeof data!=='string'||!data.length||data.length>Math.ceil(FILE_LIMIT/3)*4||/[^A-Za-z0-9+/=]/.test(data)) fail('File tidak valid atau lebih dari 3 MB.');
  const bytes=Buffer.from(data,'base64');
  if(bytes.toString('base64')!==data||bytes.length>FILE_LIMIT||mediaType(bytes)!==mime||!mime) fail('Gunakan JPG, PNG, WebP, GIF, MP4 atau WebM yang valid.');
  const hash=createHash('sha256').update(bytes).digest('hex');
  const result=await transaction(async tx=>{
   // Locks this singleton row on PostgreSQL, serializing quota and idempotency checks.
   await tx.prepare('UPDATE gallery_quota SET used=used WHERE id=1').run();
   const previous=await tx.prepare('SELECT id,owner,hash FROM gallery WHERE upload_key=?').get(key);
   if(previous){if(previous.owner!==req.user||previous.hash!==hash)fail('Kode unggahan sudah digunakan.',409);return {id:previous.id};}
   const count=await tx.prepare('SELECT COUNT(*) AS total FROM gallery').get();
   if(Number(count.total)>=300)fail('Album sudah berisi 300 momen. Hapus beberapa untuk menambah lagi.',409);
   const reserved=await tx.prepare('UPDATE gallery_quota SET used=used+? WHERE id=1 AND used+?<=?').run(bytes.length,bytes.length,ALBUM_LIMIT);
   if(!reserved.changes)fail('Album penuh (60 MB). Hapus beberapa momen untuk menambah ruang.',409);
   const r=await tx.prepare('INSERT INTO gallery(owner,caption,mime,size,created,data,upload_key,hash) VALUES(?,?,?,?,?,?,?,?)').run(req.user,note,mime,bytes.length,new Date().toISOString(),data,key,hash);
   return {id:Number(r.lastInsertRowid)};
  });res.status(201).json(result);
 });
 app.get('/api/gallery/:id/media',async(req,res)=>{
  const row=await db.prepare('SELECT mime,size,data FROM gallery WHERE id=?').get(req.params.id);
  if(!row)return res.sendStatus(404);
  const bytes=Buffer.from(row.data,'base64'),size=bytes.length;
  res.set({'Content-Type':row.mime,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','Content-Disposition':'inline','Cross-Origin-Resource-Policy':'same-origin'});
  const range=req.headers.range;
  if(range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!match||(!match[1]&&!match[2]))return res.status(416).set('Content-Range',`bytes */${size}`).end();
   let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
   let end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return res.status(416).set('Content-Range',`bytes */${size}`).end();
   return res.status(206).set({'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1)}).end(bytes.subarray(start,end+1));
  }
  res.set('Content-Length',String(size)).end(bytes);
 });
 app.delete('/api/gallery/:id',async(req,res)=>{
  await transaction(async tx=>{
   await tx.prepare('UPDATE gallery_quota SET used=used WHERE id=1').run();
   const row=await tx.prepare('SELECT owner,size FROM gallery WHERE id=?').get(req.params.id);
   if(!row)fail('Momen tidak ditemukan.',404);
   if(row.owner!==req.user)fail('Hanya pengunggah yang bisa menghapus momen.',403);
   await tx.prepare('DELETE FROM gallery WHERE id=?').run(req.params.id);
   await tx.prepare('UPDATE gallery_quota SET used=used-? WHERE id=1').run(row.size);
  });res.json({ok:true});
 });
}
