export const rupiah=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits: n%1?1:0}).format(n);
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function periodRange(month,period,day){if(period==='month')return [month+'-01',month+'-31'];if(period==='day')return [day,day];const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return [start,d.toISOString().slice(0,10)];}
export function totals(rows){const income=rows.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0),expense=rows.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);return {income,expense,balance:income-expense};}
export function categories(rows){const result=Object.create(null);for(const r of rows.filter(r=>r.type==='expense'))result[r.category]=(result[r.category]||0)+r.amount;return Object.entries(result).sort((a,b)=>b[1]-a[1]);}
export function debt(rows){return rows.filter(r=>r.scope==='date'&&r.type==='expense').reduce((sum,r)=>sum+(r.payer==='Moreno'?r.amount/2:r.payer==='Cahya'?-r.amount/2:0),0);}
export const level=(spent,limit)=>spent>limit?'over':spent>=limit*.8?'near':'safe';
export function nextAnnual(date,now=today()){const year=Number(now.slice(0,4)),md=date.slice(5);for(let y=year;y<=year+8;y++){const candidate=`${y}-${md}`,d=new Date(candidate+'T12:00:00Z');if(Number.isFinite(+d)&&d.toISOString().slice(0,10)===candidate&&candidate>=now)return candidate;}}
export function limitRows(rows,scope,month){const latest=new Map();for(const r of rows.filter(r=>r.kind==='limit'&&r.scope===scope&&r.month===month).sort((a,b)=>a.id-b.id))latest.set(r.category,r);return [...latest.values()];}
