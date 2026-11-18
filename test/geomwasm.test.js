/* Balas y líneas de visión del servidor en C++/WebAssembly (wasm/geom.cpp → assets/wasm/geom.wasm, docs/WASM.md):
   - da EXACTAMENTE la misma distancia que segMap() en JavaScript (bit a bit) en todos los mapas del servidor, con segmentos
     al azar (balas largas, vistas de bots, cortos de cuchillo, con y sin «near») y con los de verdad de los bots
   - más rápido que JavaScript
   - sin el módulo, o con ix.noWasm, sigue la versión JavaScript
   Run: node test/geomwasm.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const G = require('../core/geom.js'), MAP = require('../core/mapdata.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const mod = new WebAssembly.Module(fs.readFileSync(path.join(__dirname, '..', 'assets', 'wasm', 'geom.wasm')));
check('el módulo de C++ se carga', G.useWasm(mod) && G.wasm);

console.log('\nLA MISMA DISTANCIA QUE JAVASCRIPT, BIT A BIT');
const maps = Object.assign({ raiz: MAP }, MAP.maps);
let totJs = 0, totWa = 0;
for (const id in maps) {
  const m = maps[id];
  const J = G.createMapIndex(m); J.noWasm = true;
  const W = G.createMapIndex(m);
  // límites del mapa (sin el suelo grande)
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let k = 0; k < m.tris.length; k += 3) { const x = m.tris[k], z = m.tris[k + 2]; if (Math.abs(x) < 400 && Math.abs(z) < 400) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } }
  const R = rng(id.length * 7919 + 13), segs = [];
  for (let i = 0; i < 8000; i++) {
    const ox = x0 + (x1 - x0) * R(), oz = z0 + (z1 - z0) * R(), oy = R() * 8 - 0.5;
    let dx = R() * 2 - 1, dy = (R() * 2 - 1) * (R() < 0.7 ? 0.15 : 1), dz = R() * 2 - 1; const d = Math.hypot(dx, dy, dz) || 1; dx /= d; dy /= d; dz /= d;
    const kind = R(), len = kind < 0.3 ? 400 + R() * 600 : kind < 0.8 ? 5 + R() * 120 : 0.3 + R() * 4;
    segs.push([ox, oy, oz, dx, dy, dz, len, R() < 0.5 ? 0 : 0.2]);
  }
  // también los de las cajas y paredes de verdad: entre dos puntos de la red de los bots, a la altura de los ojos
  let hits = 0, bad = 0, first = '';
  for (const s of segs) {
    const a = G.segMap(J, ...s), b = G.segMap(W, ...s);
    if (a) hits++;
    const same = (!a && !b) || (a && b && Object.is(a.t, b.t) && Object.is(a.x, b.x) && Object.is(a.y, b.y) && Object.is(a.z, b.z));
    if (!same) { bad++; if (!first) first = JSON.stringify({ s, a, b }); }
  }
  let losBad = 0;
  for (let i = 0; i < 5000; i++) { const ax = x0 + (x1 - x0) * R(), az = z0 + (z1 - z0) * R(), bx = x0 + (x1 - x0) * R(), bz = z0 + (z1 - z0) * R(), y = 0.5 + R() * 1.5;
    if (G.losClear(J, ax, y, az, bx, y, bz) !== G.losClear(W, ax, y, az, bx, y, bz)) losBad++; }
  // tiempo
  let t0 = process.hrtime.bigint(); for (const s of segs) G.segMap(J, ...s); const js = Number(process.hrtime.bigint() - t0) / 1e6;
  t0 = process.hrtime.bigint(); for (const s of segs) G.segMap(W, ...s); const wa = Number(process.hrtime.bigint() - t0) / 1e6;
  totJs += js; totWa += wa;
  check(id + ': ' + segs.length + ' segmentos (' + hits + ' chocan) y 5 000 líneas de visión, iguales', bad === 0 && losBad === 0 && W.wa >= 0,
    (bad || losBad ? first + ' · distintos ' + bad + ' · vista ' + losBad + ' · ' : '') + m.tris.length / 9 + ' triángulos · JS ' + js.toFixed(0) + ' ms · C++ ' + wa.toFixed(0) + ' ms (×' + (js / wa).toFixed(1) + ')');
}
check('C++ más rápido que JavaScript en total', totWa < totJs, 'JS ' + totJs.toFixed(0) + ' ms · C++ ' + totWa.toFixed(0) + ' ms (×' + (totJs / totWa).toFixed(1) + ')');

console.log('\nSIN EL MÓDULO');
{ const I = G.createMapIndex(MAP.maps.arena); I.noWasm = true;
  check('con ix.noWasm se usa JavaScript (no se copia el mapa)', G.segMap(I, 0, 1.5, 0, 1, 0, 0, 300) !== undefined && I.wa === undefined);
  G.useWasm(null);
  const K = G.createMapIndex(MAP.maps.arena);
  check('sin módulo: JavaScript, y da lo mismo', !G.wasm && JSON.stringify(G.segMap(K, 0, 1.5, 0, 1, 0, 0, 300)) === JSON.stringify(G.segMap(I, 0, 1.5, 0, 1, 0, 0, 300)) && K.wa === undefined); }

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
