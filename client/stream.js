/* SNIPER DUEL — TEXTURAS POR DISTANCIA (25-11-2026, docs/TEXTURAS-DISTANCIA.md). Bandera: ?stream=1.
   Cada mapa arranca con la versión pequeña de sus texturas (assets/tex/lo/, ≤ 256 px: el paquete del mapa en
   client/packs.js) y cambia a la buena cuando la cámara se acerca a algo que la usa: en KTX2 (comprimida en la GPU,
   el sistema de siempre, docs/KTX2.md) donde se puede, y si no en JPG. Lo que lleva un rato lejos (o en un mapa que ya
   no se ve) vuelve a la pequeña y suelta la memoria de la GPU.
   Aquí solo la decisión (pura, con prueba: test/stream.test.js); la carga y el cambio de texturas están en src/page.html. */
(function (root) {
'use strict';
const DEF = { near: 40, far: 70, evictAfter: 20, every: 0.5 };
function create(opt) { return Object.assign({ st: {}, t: 0 }, DEF, opt || {}); }
// dist: { key: metres to the nearest thing that uses it (Infinity when nothing that uses it is shown) }
// → { up: keys to load now, nearest first; down: keys to send back to the small version }
function decide(S, dist, dt) {
  const up = [], down = [];
  for (const k in dist) {
    const st = S.st[k] || (S.st[k] = { state: 'lo', farFor: 0 }), d = dist[k];
    if (st.state === 'lo' && d < S.near) up.push(k);
    if (st.state === 'hi') { st.farFor = d > S.far ? st.farFor + dt : 0; if (S.evict !== false && st.farFor >= S.evictAfter) down.push(k); }
  }
  up.sort((a, b) => dist[a] - dist[b] || (a < b ? -1 : 1));
  return { up, down };
}
const set = (S, k, state) => { const st = S.st[k] || (S.st[k] = { state: 'lo', farFor: 0 }); st.state = state; st.farFor = 0; };
// distance from a point to a sphere's surface (0 inside)
const toSphere = (px, py, pz, cx, cy, cz, r) => Math.max(0, Math.hypot(px - cx, py - cy, pz - cz) - r);
const SDStream = { DEF, create, decide, set, toSphere };
if (typeof module !== 'undefined' && module.exports) module.exports = SDStream; else root.SDStream = SDStream;
})(typeof window !== 'undefined' ? window : globalThis);
