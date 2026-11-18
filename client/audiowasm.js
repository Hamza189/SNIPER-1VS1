/* SNIPER DUEL — el sonido generado al empezar, en C++/WebAssembly (18-11-2026, wasm/audio.cpp → assets/wasm/audio.wasm).
   audioInit() (src/page.html) lo usa si ya está cargado; si no, sigue con su versión JavaScript. ?audiowasm=0 la fuerza.
   make(n, rl, sr) → { noise, l, r }: n muestras de ruido y la reverberación (rl muestras por canal). */
(function (root) {
'use strict';
const W = { ready: false, failed: false, off: false, exp: null, ms: 0 };
if (typeof module !== 'undefined' && module.exports) {
  try {
    const fs = require('fs'), path = require('path');
    W.exp = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(path.join(__dirname, '..', 'assets', 'wasm', 'audio.wasm'))), {}).exports; W.ready = true;
  } catch (e) { W.failed = true; }
} else if (typeof WebAssembly === 'undefined' || typeof fetch === 'undefined' || /[?&]audiowasm=0\b/.test(location.search)) {
  W.off = true;
} else {
  // asked once the page is parsed, with its version (ASSET_V from build.py, docs/CARGA.md); try: if it runs before the
  // page's ASSET_V exists (test/smoke.test.js), typeof itself throws on a const not yet declared
  const go = () => { const u = 'assets/wasm/audio.wasm'; let v = ''; try { v = ASSET_V[u] || ''; } catch (e) {}
    fetch(v ? u + '?v=' + v : u).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(b => WebAssembly.instantiate(b, {})).then(r => { W.exp = r.instance.exports; W.ready = true; }).catch(() => { W.failed = true; }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}
W.make = (n, rl, sr) => {
  const E = W.exp, t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  E.au_make(n, rl, sr, (Math.random() * 4294967295) >>> 0 || 1);
  const buf = E.memory.buffer;
  const out = { noise: new Float32Array(buf, E.au_noise(), n), l: new Float32Array(buf, E.au_ir_l(), rl), r: new Float32Array(buf, E.au_ir_r(), rl) };
  W.ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
  return out;
};
const SDAudioWasm = W;
if (typeof module !== 'undefined' && module.exports) module.exports = SDAudioWasm; else root.SDAudioWasm = SDAudioWasm;
})(typeof window !== 'undefined' ? window : globalThis);
