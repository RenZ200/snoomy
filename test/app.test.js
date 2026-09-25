import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('shared data, ownership, PIN, validation, CRUD, persistence after restart', async () => {
 const temp=mkdtempSync(join(tmpdir(),'matcha-duo-test-'));
 let child,base;
 async function start(){
  child=spawn(process.execPath,['server.js'],{env:{...process.env,DATABASE_URL:'',NODE_ENV:'test',VERCEL:'',PORT:'31987',DB_PATH:join(temp,'test.sqlite'),MORENO_PIN:'1234',CAHYA_PIN:'5678',COOKIE_SECURE:'false'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server timeout')),30000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});child.stdout.on('data',d=>{if(String(d).includes('siap')){clearTimeout(timer);resolve();}});child.stderr.on('data',()=>{});});
  base='http://127.0.0.1:31987/api';
 }
 async function stop(){if(child&&child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
 async function request(path,method='GET',body,cookie){const res=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 async function login(user,pin){const result=await request('/login','POST',{user,pin});assert.equal(result.status,200);return result.cookie;}
 try{
  await start();
  assert.equal((await request('/state')).status,401);
  assert.equal((await request('/budget')).status,401);
  assert.equal((await request('/login','POST',{user:'Moreno',pin:'0000'})).status,401);
  const moreno=await login('Moreno','1234'), cahya=await login('Cahya','5678');
  const schedule={day:1,start:'08:00',end:'09:40',course:'Statistika',lecturer:'',room:'A1'};
  const created=await request('/schedules','POST',schedule,moreno);assert.equal(created.status,201);
  assert.equal((await request('/schedules','POST',{...schedule,end:'07:00'},moreno)).status,400);
  assert.equal((await request('/schedules/'+created.body.id,'PUT',schedule,cahya)).status,403);
  assert.equal((await request('/schedules/'+created.body.id,'DELETE',{},cahya)).status,403);
  assert.equal((await request('/schedules/'+created.body.id,'PUT',{...schedule,room:'B2'},moreno)).status,200);
  const task={title:'Tugas bersama',deadline:'2026-09-24',assignee:'Berdua',priority:'Tinggi'};
  assert.equal((await request('/tasks','POST',{...task,deadline:'2026-02-30'},moreno)).status,400);
  const added=await request('/tasks','POST',task,moreno);assert.equal(added.status,201);
  assert.equal((await request('/tasks/'+added.body.id,'PUT',{done:true},cahya)).status,200);
  let state=(await request('/state','GET',undefined,cahya)).body;
  assert.equal(state.tasks[0].done,1);assert.equal(state.schedules[0].room,'B2');
  const budget=await request('/budget/transaction','POST',{scope:'daily',type:'income',amount:150000,category:'Uang saku',date:'2026-09-25',person:'Moreno'},moreno);assert.equal(budget.status,201);
  assert.equal((await request('/budget','GET',undefined,cahya)).body[0].amount,150000);
  await stop();await start();
  assert.equal((await request('/budget','GET',undefined,moreno)).body[0].amount,150000);
  assert.equal((await request('/state','GET',undefined,moreno)).status,200);
  const fresh=await login('Moreno','1234');state=(await request('/state','GET',undefined,fresh)).body;
  assert.equal(state.schedules.length,1);assert.equal(state.tasks.length,1);assert.equal(state.tasks[0].done,1);
  assert.equal((await request('/schedules/'+created.body.id,'DELETE',{},fresh)).status,200);
  assert.equal((await request('/tasks/'+added.body.id,'DELETE',{},fresh)).status,200);
  const empty=(await request('/state','GET',undefined,fresh)).body;assert.equal(empty.schedules.length,0);assert.equal(empty.tasks.length,0);
  assert.equal((await request('/logout','POST',{},fresh)).status,200);assert.equal((await request('/state','GET',undefined,fresh)).status,401);
 } finally {await stop();rmSync(temp,{recursive:true,force:true});}
});
