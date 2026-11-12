// Atomic local asset cache. No CDN, backend or account. Bump VERSION when publishing edits.
const VERSION='v3-combat-20261112-1',PREFIX='nodo09-'+self.registration.scope+'-',CACHE=PREFIX+VERSION;
const FILES=['./','index.html','style.css','icon.svg','three.module.min.js','game.js','physics.js','input.js','level.js','render.js','combat.js','hud.js','preferences.js','settings-v2.js','refinements.js','weapon-models.js','world-v2.js','world-v3.js','navigation.js','match.js','soldier.js','audio.js','supplies.js','aim-support.js','combat-feedback.js','combat-ui.js','loot-visuals.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
// A new worker activates after existing game tabs close, never in the middle of a match.
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url),scope=new URL(self.registration.scope);
 if(e.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||url.searchParams.has('qa'))return;
 e.respondWith((async()=>{const cache=await caches.open(CACHE);if(e.request.mode==='navigate')return await cache.match('index.html')||fetch(e.request);
 const local=FILES.find(f=>new URL(f,scope).pathname===url.pathname);if(!local)return fetch(e.request);return await cache.match(local)||fetch(e.request);})());
});
