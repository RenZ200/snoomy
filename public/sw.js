// Snoomy app shell: network first so edits show up at once, cached copy only when offline.
// API calls, uploads and other origins always go straight to the network.
const CACHE='snoomy-shell-v3';
const SHELL=['/','/style.css','/polish.css','/poster.css','/google-calendar.css','/music.css','/gallery.css','/cards.css','/app.js','/navigation.js','/motion.js','/google-calendar.js','/gallery.js','/cards.js','/music.js','/pwa.js','/qol.js','/vendor/gsap.min.js','/mascot.svg','/icons/icon-192.png'];
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
