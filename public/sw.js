// Snoomy app shell: network first so edits show up at once, cached copy only when offline.
// API calls, uploads and other origins always go straight to the network.
const CACHE='snoomy-shell-v16';
const SHELL=['/','/style.css','/polish.css','/poster.css','/google-calendar.css','/music.css','/gallery.css','/cards.css','/boards.css','/real.css','/chat.css','/surprise.css','/media.css','/revamp.css','/app.js','/navigation.js','/motion.js','/google-calendar.js','/gallery.js','/sfx.js','/games.js','/cards.js','/ludo.js','/four.js','/snakes.js','/sketch.js','/quiz.js','/talk.js','/real.js','/chat.js','/surprise.js','/yt.js','/watch.js','/music.js','/pwa.js','/qol.js','/revamp.js','/vendor/gsap.min.js','/mascot.svg','/icons/icon-192.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const {request}=event,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok&&response.type==='basic'){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
  return response;
 }).catch(()=>caches.match(request,{ignoreSearch:true}).then(hit=>hit||(request.mode==='navigate'?caches.match('/'):Response.error()))));
});
// Real reminders arrive as push messages, also while Snoomy is closed. Every push shows a notification.
self.addEventListener('push',event=>{
 let data={};
 try{data=event.data?.json()||{};}catch{}
 event.waitUntil(self.registration.showNotification(data.title||'⚡ Waktunya Real!',{
  body:data.body||'Dua menit. Kamera belakang & depan, apa adanya.',
  tag:data.tag||'snoomy',renotify:true,icon:'/icons/icon-192.png',badge:'/icons/badge-96.png',vibrate:[80,60,80],data:{url:data.url||'/#real'},
 }));
});
// A tap opens Snoomy at the right place: an open window jumps there, otherwise a new one opens.
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL(event.notification.data?.url||'/#real',self.location.origin);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
  const open=windows.find(client=>new URL(client.url).origin===url.origin);
  if(!open)return self.clients.openWindow(url.href);
  open.postMessage({type:'snoomy-open',hash:url.hash});
  return open.focus();
 }));
});
