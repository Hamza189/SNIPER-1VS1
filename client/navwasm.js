/* SNIPER DUEL — la red de los bots en C++/WebAssembly (17-11-2026, wasm/nav.cpp → assets/wasm/nav.wasm, 6 KB).
   navGrid() de client/casa2.js (CASA ATLAS 2.0, sus diseños y BARRIO) la usa si ya está cargada; si no (o si falla),
   sigue con su versión JavaScript, que da exactamente el mismo resultado (test/navwasm.test.js).
   - Navegador: se pide al abrir la página, en segundo plano. ?navwasm=0 la desactiva en esa carga.
   - Node (pruebas, export-map): se carga al momento desde el disco.
   SDNavWasm.off = true fuerza la versión JavaScript (para comparar). */
(function (root) {
'use strict';
const W = { ready: false, failed: false, off: false, exp: null, runs: 0, ms: 0 };
function attach(instance) { W.exp = instance.exports; W.ready = true; }
if (typeof module !== 'undefined' && module.exports) {
  try {
    const fs = require('fs'), path = require('path');
    attach(new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(__dirname, '..', 'assets', 'wasm', 'nav.wasm'))), {}));
  } catch (e) { W.failed = true; }
} else if (typeof WebAssembly === 'undefined' || /[?&]navwasm=0\b/.test(location.search)) {
  W.off = true;
} else {
  // asked once the page is parsed, with the hash of its content as its version (ASSET_V from build.py, docs/CARGA.md:
  // it is declared after this module in the same script)
  // (try: run before the page's ASSET_V exists — test/smoke.test.js — typeof itself throws on a const not yet declared)
  const go = () => { const u = 'assets/wasm/nav.wasm'; let v = ''; try { v = ASSET_V[u] || ''; } catch (e) {}
    fetch(v ? u + '?v=' + v : u).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => WebAssembly.instantiate(b, {})).then(r => attach(r.instance)).catch(() => { W.failed = true; }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}
// the same answer as navGrid() in JavaScript: [{ x, z, n: [neighbour indices] }]
W.build = (cols, step, standH, R, XO, ZN) => {
  const E = W.exp, t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  E.nav_reset();
  const n = cols.length, box = new Float64Array(E.memory.buffer, E.nav_boxes(n), n * 6);
  for (let i = 0; i < n; i++) { const c = cols[i], o = i * 6; box[o] = c.minX; box[o + 1] = c.minY; box[o + 2] = c.minZ; box[o + 3] = c.maxX; box[o + 4] = c.maxY; box[o + 5] = c.maxZ; }
  const cnt = E.nav_build(n, step, standH, R, XO, ZN), buf = E.memory.buffer;   // the memory may have grown: new views
  const X = new Float64Array(buf, E.nav_x(), cnt), Z = new Float64Array(buf, E.nav_z(), cnt), off = new Int32Array(buf, E.nav_off(), cnt + 1);
  const adj = new Int32Array(buf, E.nav_adj(), Math.max(1, off[cnt])), out = new Array(cnt);
  for (let k = 0; k < cnt; k++) { const nb = []; for (let q = off[k]; q < off[k + 1]; q++) nb.push(adj[q]); out[k] = { x: X[k], z: Z[k], n: nb }; }
  W.runs++; W.ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
  return out;
};
const SDNavWasm = W;
if (typeof module !== 'undefined' && module.exports) module.exports = SDNavWasm; else root.SDNavWasm = SDNavWasm;
})(typeof window !== 'undefined' ? window : globalThis);
