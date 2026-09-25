import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {postgresAdapter} from '../database.js';
import {mountBudget,validateBudget} from '../budget.js';
import {totals,categories,debt,periodRange,nextAnnual,level} from '../public/budget-core.js';
const transaction={scope:'daily',type:'expense',amount:25000,category:'Makan',date:'2026-09-25',note:'Lunch',person:'Moreno'};
test('budget validation, period boundaries, totals and equal split',()=>{
 assert.throws(()=>validateBudget('transaction',{...transaction,amount:-1}));
 assert.throws(()=>validateBudget('transaction',{...transaction,amount:1.5}));
 assert.throws(()=>validateBudget('transaction',{...transaction,date:'2026-02-30'}));
 assert.throws(()=>validateBudget('transaction',{...transaction,scope:'date',type:'income'}));
 assert.throws(()=>validateBudget('transaction',{...transaction,photo:'javascript:alert(1)'}));
 assert.throws(()=>validateBudget('limit',{scope:'daily',month:'2026-13',category:'Makan',amount:3}));
 assert.equal(validateBudget('reminder',{title:'Anniversary',date:'2026-09-25',target:0}).target,0);
 assert.deepEqual(totals([transaction,{...transaction,type:'income',amount:100000}]),{income:100000,expense:25000,balance:75000});
 assert.deepEqual(categories([{...transaction,category:'__proto__'}]),[['__proto__',25000]]);
 assert.equal(debt([{...transaction,scope:'date',payer:'Moreno',amount:100001},{...transaction,scope:'date',payer:'Cahya',amount:20000},{...transaction,scope:'date',payer:'Split',amount:70000}]),40000.5);
 assert.deepEqual(periodRange('2026-09','week','2026-09-01'),['2026-08-31','2026-09-06']);
 assert.equal(nextAnnual('2020-09-24','2026-09-25'),'2027-09-24');
 assert.equal(nextAnnual('2020-02-29','2026-09-25'),'2028-02-29');
 assert.equal(level(79,100),'safe');assert.equal(level(80,100),'near');assert.equal(level(101,100),'over');
});
for(const engine of ['sqlite','postgres'])test(`budget CRUD through API with ${engine}`,async()=>{
 let db;if(engine==='sqlite'){db=new DatabaseSync(':memory:');db.exec(readFileSync('schema.sql','utf8'));}else{const pg=new PGlite();await pg.exec(readFileSync('schema-postgres.sql','utf8'));db=postgresAdapter({query:async(s,a)=>{const r=await pg.query(s,a);return {rows:r.rows,rowCount:r.affectedRows??r.rows.length};},end:()=>pg.close()});}
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.user='Moreno';next();});mountBudget(app,db);app.use((err,req,res,next)=>res.status(err.status||500).json({error:err.message}));
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));const base=`http://localhost:${server.address().port}/api/budget`;
 async function req(path='',method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 try{const records=[['transaction',transaction],['transaction',{...transaction,scope:'date',payer:'Moreno',place:'Cafe',photo:''}],['limit',{scope:'daily',month:'2026-09',category:'Makan',amount:100000}],['reminder',{title:'Anniversary',date:'2020-09-25',target:100000}],['goal',{title:'Liburan',date:'2027-01-01',target:1000000,saved:200000}]];
 for(const [kind,data] of records){const r=await req('/'+kind,'POST',data);assert.equal(r.status,201);assert.ok(r.data.id);}
 const list=(await req()).data;assert.equal(list.length,5);const row=list.find(r=>r.kind==='transaction'&&r.scope==='daily');assert.equal((await req('/'+row.id,'PUT',{...transaction,amount:50000})).status,200);assert.equal((await req()).data.find(r=>r.id===row.id).amount,50000);
 assert.equal((await req('/transaction','POST',{...transaction,amount:0})).status,400);assert.equal((await req('/999999','PUT',transaction)).status,404);assert.equal((await req('/bad','DELETE')).status,400);assert.equal((await req('/'+row.id,'DELETE')).status,200);assert.equal((await req('/'+row.id,'DELETE')).status,404);
 }finally{await new Promise(r=>server.close(r));await db.close();}
});
