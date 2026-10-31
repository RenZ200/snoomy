// Talks to YouTube embeds through the player's postMessage protocol, so no third-party
// script (and no wider Content-Security-Policy) is needed. Used by Nonton bareng and Musik kita.
window.SnoomyYouTube = (() => {
 const ORIGIN='https://www.youtube-nocookie.com';
 const ID=/^[A-Za-z0-9_-]{11}$/;
 const players=new Set();
 addEventListener('message',event=>{
  if(event.origin!==ORIGIN)return;
  let data;
  try{data=typeof event.data==='string'?JSON.parse(event.data):event.data;}catch{return;}
  for(const player of players)if(event.source===player.frame.contentWindow)player.receive(data);
 });

 function embed(id,{start=0,autoplay=false,title='Video YouTube'}={}){
  const frame=document.createElement('iframe');
  const query=new URLSearchParams({enablejsapi:'1',playsinline:'1',rel:'0',origin:location.origin});
  if(start>0)query.set('start',String(Math.floor(start)));
  if(autoplay)query.set('autoplay','1');
  frame.src=`${ORIGIN}/embed/${id}?${query}`;
  frame.title=title;
  frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen=true;
  frame.referrerPolicy='strict-origin-when-cross-origin';
  return frame;
 }

 // States: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued.
 function connect(frame,{onReady,onState,onTime,onError}={}){
  const player={frame,ready:false,state:-1,time:0,duration:0,timer:null};
  const post=message=>frame.contentWindow?.postMessage(JSON.stringify({...message,id:1,channel:'widget'}),ORIGIN);
  const setState=next=>{if(next!==player.state){player.state=next;onState?.(next);}};
  player.command=(func,args=[])=>post({event:'command',func,args});
  player.receive=data=>{
   if(!player.ready&&data.event!=='onError'){
    player.ready=true;clearInterval(player.timer);
    player.command('addEventListener',['onStateChange']);player.command('addEventListener',['onError']);
    onReady?.();
   }
   if(data.event==='onStateChange')setState(data.info);
   if(data.event==='onError')onError?.(data.info);
   if((data.event==='infoDelivery'||data.event==='initialDelivery')&&data.info){
    if(typeof data.info.duration==='number')player.duration=data.info.duration;
    if(typeof data.info.playerState==='number')setState(data.info.playerState);
    if(typeof data.info.currentTime==='number'){player.time=data.info.currentTime;onTime?.(player.time);}
   }
  };
  // The player answers only after it hears "listening", so keep asking until it does.
  const listen=()=>{
   clearInterval(player.timer);player.ready=false;
   let tries=0;
   player.timer=setInterval(()=>{post({event:'listening'});if(player.ready||++tries>60)clearInterval(player.timer);},250);
  };
  frame.addEventListener('load',listen);
  players.add(player);
  player.destroy=()=>{clearInterval(player.timer);players.delete(player);frame.removeEventListener('load',listen);};
  return player;
 }

 function parse(input){
  const text=String(input||'').trim();
  if(ID.test(text))return {id:text,start:0};
  let url;
  try{url=new URL(/^https?:\/\//i.test(text)?text:`https://${text}`);}catch{return null;}
  const host=url.hostname.replace(/^(www|m|music)\./,'');
  let id=null;
  if(host==='youtu.be')id=url.pathname.slice(1).split('/')[0];
  else if(host==='youtube.com'||host==='youtube-nocookie.com')id=url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1];
  return id&&ID.test(id)?{id,start:0}:null;
 }
 const watchUrl=id=>`https://www.youtube.com/watch?v=${id}`;
 const errorText=code=>code===101||code===150||code===153?'Pemilik video ini tidak mengizinkannya diputar di luar YouTube.':code===100?'Video ini tidak ditemukan atau dibuat privat.':'Video ini tidak bisa diputar sekarang.';
 return {embed,connect,parse,watchUrl,errorText};
})();
