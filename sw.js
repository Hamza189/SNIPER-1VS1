/* SNIPER DUEL — service worker (03-11-2026, docs/CARGA.md). Keeps the game's files on the device so a second visit does
   not download them again, nor ask the server about each one (GitHub Pages lets the browser keep them only 10 min).

   - A file asked for with a version (?v=…) never changes under that name: build.py gives each file the hash of its own
     content, so it is served from the device without asking the network (cache first). When a file changes its name
     changes too, and the old copy of that same file is dropped.
   - Everything else (the page itself, version.json, the online server's API) goes to the network as always; the page and
     version.json fall back to the saved copy only without connection.
   - Only GET requests to the game's site and to its R2 files (…workers.dev/assets/…) with ?v= are kept.
   The page registers it on https only (not in the local tests); ?sw=0 removes it from that device. */
'use strict';
const CACHE = 'sd-archivos-v1', PAGES = 'sd-pagina-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k !== PAGES) await caches.delete(k);
  await self.clients.claim();
})()));
const versioned = u => u.searchParams.has('v') && /\/(assets|vendor)\//.test(u.pathname);
async function fromCache(req) {
  const c = await caches.open(CACHE), hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    const copy = res.clone();
    (async () => {   // keep it, and drop the older versions of the same file
      await c.put(req, copy);
      const path = new URL(req.url).pathname;
      for (const k of await c.keys()) { const u = new URL(k.url); if (u.pathname === path && k.url !== req.url) await c.delete(k); }
    })().catch(() => {});
  }
  return res;
}
async function pageNetworkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) { const copy = res.clone(); caches.open(PAGES).then(c => c.put(req, copy)).catch(() => {}); }
    return res;
  } catch (e) {
    const hit = await (await caches.open(PAGES)).match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw e;
  }
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const u = new URL(req.url);
  if (versioned(u) && (u.origin === self.location.origin || /\.workers\.dev$/.test(u.hostname))) { e.respondWith(fromCache(req)); return; }
  if (u.origin === self.location.origin && (req.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname))) { e.respondWith(pageNetworkFirst(req)); return; }
});
