const CACHE="fio-v8-completed-tasks";
const ASSETS=[
  "./","./index.html","./styles.css","./app.js","./manifest.webmanifest",
  "./icons/icon-192.png","./icons/icon-512.png","./icons/icon-192-maskable.png","./icons/icon-512-maskable.png","./icons/apple-touch-icon-180.png","./icons/apple-touch-icon.png"
];
self.addEventListener("install",e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())
));
self.addEventListener("activate",e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  .then(()=>self.clients.claim())
));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached) return cached;
      return fetch(e.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return response;
      }).catch(()=>caches.match("./index.html"));
    })
  );
});
