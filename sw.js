const CACHE = 'entry-sally-s1';
const MINE = /^entry-sally-/;   // only this app's caches; never touch the general Entry app on the same site
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  // Bypass the browser HTTP cache so the new files (not stale ones) get cached.
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(FILES.map(f => fetch(new Request(f, {cache: 'no-store'})).then(r => { if (!r.ok) throw new Error(f); return c.put(f, r); }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter(k => k !== CACHE && MINE.test(k));
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    // Pages loaded by an older version get reloaded into this one.
    if (old.length) {
      const cs = await self.clients.matchAll({type: 'window'});
      cs.forEach(c => { try { c.navigate(c.url); } catch (err) {} });
    }
  })());
});
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }
// Network-first when online (fresh files), cache fallback when offline.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const nav = req.mode === 'navigate';
    try {
      const r = await Promise.race([fetch(req, {cache: nav ? 'no-store' : 'no-cache'}), timeout(5000)]);
      if (r && r.ok) { cache.put(nav ? './index.html' : req, r.clone()); return r; }
      throw new Error('bad response');
    } catch (err) {
      const hit = nav ? (await cache.match('./index.html')) : (await cache.match(req, {ignoreSearch: true}));
      return hit || Response.error();
    }
  })());
});
