import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {DatabaseSync} from 'node:sqlite';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {postgresAdapter} from '../database.js';
import {mountGallery,ALBUM_LIMIT,FILE_LIMIT} from '../gallery.js';

for(const engine of ['sqlite','postgres'])test(`gallery ${engine}: persistence, formats, ownership, range, quota and idempotency`,async()=>{
 let db,pg;
 if(engine==='sqlite'){db=new DatabaseSync(':memory:');db.exec(readFileSync('schema.sql','utf8'));}
 else{
  pg=new PGlite();await pg.exec(readFileSync('schema-postgres.sql','utf8'));
  const client={query:async(s,a)=>{const r=await pg.query(s,a);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};},release(){}};
  db=postgresAdapter({...client,connect:async()=>client,end:()=>pg.close()});
 }
 const app=express();app.use(express.json({limit:'4200kb'}));app.use((req,res,next)=>{if(!req.headers['x-user'])return res.status(401).json({});req.user=req.headers['x-user'];next();});mountGallery(app,db);app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api/gallery`;
 const request=(path='',method='GET',body,user='Moreno',headers={})=>fetch(base+path,{method,headers:{'x-user':user,'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});
 const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');
 const payload={mime:'image/gif',caption:'<img onerror=alert(1)>',data:gif.toString('base64'),key:randomUUID()};
 try{
  assert.equal((await request('','GET',null,'')).status,401);
  assert.equal((await request('','POST',{...payload,data:Buffer.from('<svg>bad</svg>').toString('base64'),mime:'image/svg+xml'})).status,400);
  assert.equal((await request('','POST',{...payload,data:'not base64'})).status,400);
  const created=await request('','POST',payload);assert.equal(created.status,201);const {id}=await created.json();
  const again=await request('','POST',payload);assert.equal((await again.json()).id,id);
  assert.equal((await request('','POST',payload,'Cahya')).status,409);
  const list=await(await request('','GET',null,'Cahya')).json();assert.equal(list.items.length,1);assert.equal(list.used,gif.length);assert.equal(list.items[0].data,undefined);
  const media=await request(`/${id}/media`);assert.deepEqual(Buffer.from(await media.arrayBuffer()),gif);
  const range=await request(`/${id}/media`,'GET',null,'Cahya',{Range:'bytes=0-5'});assert.equal(range.status,206);assert.equal(await range.text(),'GIF89a');
  assert.equal((await request(`/${id}/media`,'GET',null,'Moreno',{Range:'bytes=99999-'})).status,416);
  assert.equal((await request(`/${id}/media`,'GET',null,'Moreno',{Range:'bytes=-0'})).status,416);
  assert.equal((await request(`/${id}`,'DELETE',null,'Cahya')).status,403);
  // Full 3 MB body exercises the production parser size and avoids regex stack overflows.
  const large=Buffer.alloc(FILE_LIMIT);gif.copy(large);
  assert.equal((await request('','POST',{...payload,key:randomUUID(),data:large.toString('base64')})).status,201);
  assert.equal((await request('','POST',{...payload,key:randomUUID(),data:Buffer.alloc(FILE_LIMIT+1).toString('base64')})).status,400);
  await db.prepare('UPDATE gallery_quota SET used=? WHERE id=1').run(ALBUM_LIMIT-gif.length+1);
  assert.equal((await request('','POST',{...payload,key:randomUUID()})).status,409);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM gallery').get()).n,2);
  assert.equal((await request(`/${id}`,'DELETE')).status,200);
  assert.equal((await request(`/${id}/media`)).status,404);
 }finally{await new Promise(r=>server.close(r));await db.close();}
});
