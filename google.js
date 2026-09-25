import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { hash } from './google-model.js';
import { withGoogleLock, syncCalendar } from './google-sync.js';
export const scope='https://www.googleapis.com/auth/calendar.app.created';
export function configuration(env=process.env) {
 const {GOOGLE_CLIENT_ID:clientId,GOOGLE_CLIENT_SECRET:secret,GOOGLE_REDIRECT_URI:redirect,GOOGLE_TOKEN_ENCRYPTION_KEY:key}=env;
 if(!clientId||!secret||!redirect||!key)return null;
 try {const url=new URL(redirect);if(url.pathname!=='/google/callback'||(url.protocol!=='https:'&&url.hostname!=='localhost'))return null;
  const bytes=Buffer.from(key,'base64');if(bytes.length!==32)return null;return {clientId,secret,redirect,key:bytes};}catch{return null;}
}
export function encrypt(value,key) {
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return [iv,cipher.getAuthTag(),bytes].map(b=>b.toString('base64')).join('.');
}
export function decrypt(value,key) {
 const [iv,tag,bytes]=value.split('.').map(v=>Buffer.from(v,'base64'));
 const cipher=createDecipheriv('aes-256-gcm',key,iv);cipher.setAuthTag(tag);
 return JSON.parse(Buffer.concat([cipher.update(bytes),cipher.final()]).toString('utf8'));
}
const failure=(message,status=502)=>Object.assign(Error(message),{status});
async function request(url,options={}) {
 let response;try{response=await fetch(url,{...options,signal:AbortSignal.timeout(8000)});}catch{throw failure('Google belum merespons. Coba sinkronkan lagi.');}
 const data=response.status===204?{}:await response.json().catch(()=>({}));
 if(!response.ok){const e=failure(response.status===412?'Acara di Google baru berubah. Sinkronkan lagi sebelum melanjutkan.':response.status===401||data.error==='invalid_grant'?'Izin Google berakhir. Hubungkan ulang akun Google.':'Google belum bisa menyelesaikan permintaan. Periksa izin dan coba lagi.');e.googleStatus=response.status;throw e;}
 return data;
}
async function tokenRequest(config,body) {
 return request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.secret,...body})});
}
export function mountGoogle(app,db,{cookie}) {
 const config=configuration();
 const requireConfig=()=>{if(!config)throw failure('Koneksi Google belum diaktifkan oleh pemilik Snoomy.',503);return config;};
 const connection=user=>db.prepare('SELECT * FROM google_connections WHERE user_name=?').get(user);
 const saveTokens=(user,tokens)=>db.prepare('UPDATE google_connections SET tokens=? WHERE user_name=?').run(encrypt(tokens,config.key),user);
 async function access(user,row) {
  let tokens;try{tokens=decrypt(row.tokens,config.key);}catch{throw failure('Kunci koneksi berubah. Hubungkan ulang akun Google.',409);}
  if(tokens.expires>Date.now()+60000)return tokens.access_token;
  const next=await tokenRequest(config,{refresh_token:tokens.refresh_token,grant_type:'refresh_token'});
  tokens={...tokens,...next,expires:Date.now()+Number(next.expires_in)*1000};await saveTokens(user,tokens);return tokens.access_token;
 }
 async function remoteFor(user,row) {
  const token=await access(user,row);
  const call=(path,method='GET',body,etag)=>request('https://www.googleapis.com/calendar/v3'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{}),...(etag?{'If-Match':etag}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!row.calendar_id){const c=await call('/calendars','POST',{summary:'Snoomy · '+user,timeZone:'Asia/Jakarta',description:'Jadwal kuliah dan deadline tugas Snoomy. Edit seluruh seri untuk jadwal mingguan.'});row.calendar_id=c.id;await db.prepare('UPDATE google_connections SET calendar_id=? WHERE user_name=?').run(c.id,user);}
  const path='/calendars/'+encodeURIComponent(row.calendar_id)+'/events';
  return {calendarId:row.calendar_id,
   list:page=>call(path+'?singleEvents=false&showDeleted=true&maxResults=2500'+(page?'&pageToken='+encodeURIComponent(page):'')),
   async get(id){try{return await call(path+'/'+encodeURIComponent(id));}catch(e){if([404,410].includes(e.googleStatus))return null;throw e;}},
   async create(body){try{return await call(path,'POST',body);}catch(e){if(e.googleStatus===409){const found=await this.get(body.id);if(found&&found.status!=='cancelled')return {...found,recovered:true};}throw e;}},
   update:(id,body,etag)=>call(path+'/'+encodeURIComponent(id),'PATCH',body,etag),
   async remove(id,etag){try{return await call(path+'/'+encodeURIComponent(id),'DELETE',null,etag);}catch(e){if(![404,410].includes(e.googleStatus))throw e;}},
  };
 }
 // Registered before /api authentication. State is one-use, bound to the browser AND live Snoomy session.
 app.get('/google/callback',async(req,res)=>{
  res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  try{
   requireConfig();const state=typeof req.query.state==='string'?req.query.state:'';
   const browser=(req.headers.cookie||'').split('; ').find(v=>v.startsWith('snoomy_oauth='))?.slice(13)||'';
   if(!/^[a-f0-9]{64}$/.test(state)||!browser)throw failure('State tidak valid.',400);
   const record=await db.prepare('DELETE FROM google_states WHERE state_hash=? AND browser_hash=? AND expires>? RETURNING *').get(hash(state),hash(browser),Date.now());
   if(!record)throw failure('Koneksi kedaluwarsa.',400);
   const session=await db.prepare('SELECT user_name FROM sessions WHERE token_hash=? AND expires>?').get(record.session_hash,Date.now());
   if(session?.user_name!==record.user_name||req.query.error||typeof req.query.code!=='string')throw failure('Koneksi dibatalkan.',400);
   const tokens=await tokenRequest(config,{code:req.query.code,code_verifier:decrypt(record.verifier,config.key),redirect_uri:config.redirect,grant_type:'authorization_code'});
   if(!tokens.refresh_token||!tokens.scope?.split(' ').includes(scope))throw failure('Izin Calendar belum lengkap.',400);
   await withGoogleLock(db,async()=>{
    const old=await connection(record.user_name);
    // Reauthorization must still be able to read the existing Snoomy calendar (prevents switching accounts accidentally).
    if(old?.calendar_id)await request('https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(old.calendar_id),{headers:{Authorization:'Bearer '+tokens.access_token}});
    await db.prepare(`INSERT INTO google_connections(user_name,tokens) VALUES(?,?) ON CONFLICT(user_name) DO UPDATE SET tokens=excluded.tokens`).run(record.user_name,encrypt({...tokens,expires:Date.now()+Number(tokens.expires_in)*1000},config.key));
   });
   res.clearCookie('snoomy_oauth',{path:'/google/callback'});res.redirect('/?google=connected#google-calendar');
  }catch{res.clearCookie('snoomy_oauth',{path:'/google/callback'});res.redirect('/?google=failed#google-calendar');}
 });
 return function mountAuthenticated() {
  app.get('/api/google/status',async(req,res)=>{const row=await connection(req.user);res.json({configured:Boolean(config),connected:Boolean(row?.tokens),lastSynced:row?.last_synced||null,calendarId:row?.calendar_id||null});});
  app.post('/api/google/connect',async(req,res)=>{
   requireConfig();const state=randomBytes(32).toString('hex'),browser=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url');
   await db.prepare('DELETE FROM google_states WHERE expires<? OR user_name=?').run(Date.now(),req.user);
   await db.prepare('INSERT INTO google_states(state_hash,browser_hash,session_hash,user_name,verifier,expires) VALUES(?,?,?,?,?,?)').run(hash(state),hash(browser),hash(cookie(req)),req.user,encrypt(verifier,config.key),Date.now()+600000);
   res.cookie('snoomy_oauth',browser,{httpOnly:true,secure:config.redirect.startsWith('https:'),sameSite:'lax',path:'/google/callback',maxAge:600000});
   const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
   url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirect,response_type:'code',scope,access_type:'offline',prompt:'consent select_account',state,code_challenge:Buffer.from(hash(verifier),'hex').toString('base64url'),code_challenge_method:'S256'}).toString();
   res.json({url:url.href});
  });
  app.post('/api/google/disconnect',async(req,res)=>{
   await withGoogleLock(db,async()=>{
    await db.prepare("UPDATE google_connections SET tokens='' WHERE user_name=?").run(req.user);
    await db.prepare('DELETE FROM google_states WHERE user_name=?').run(req.user);
   });res.json({ok:true});
  });
  app.post('/api/google/sync',async(req,res)=>{
   requireConfig();
   const result=await withGoogleLock(db,async()=>{
    const row=await connection(req.user);if(!row?.tokens)throw failure('Hubungkan Google Calendar dulu.',409);
    const remote=await remoteFor(req.user,row);
    const result=await syncCalendar(db,req.user,remote,{resolution:req.body?.resolution});
    const now=Date.now();await db.prepare('UPDATE google_connections SET last_synced=? WHERE user_name=?').run(now,req.user);
    return {...result,lastSynced:now};
   });res.json(result);
  });
 };
}
