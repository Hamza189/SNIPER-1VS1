/* Las rutas de los bots del SERVIDOR (core/bots.js) con el A* en C++/WebAssembly (wasm/astar.cpp) frente al de
   JavaScript, en todos los mapas: la red de cada mapa en un solo trozo (también CASA ATLAS 2.0 · NUEVA, JARDÍN y BARRIO,
   con su navReach), rutas que solo pasan por puntos enlazados, del mismo largo (salvo empates) y cuánto tarda cada uno.
   Run: node test/astar.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const M = require('../core/mapdata.js'), G = require('../core/geom.js'), B = require('../core/bots.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
console.log('\nRUTAS DE LOS BOTS DEL SERVIDOR: C++/WebAssembly frente a JavaScript');
check('el módulo se carga (assets/wasm/astar.wasm)', B.useWasm(new WebAssembly.Module(fs.readFileSync(path.join(__dirname, '..', 'assets', 'wasm', 'astar.wasm')))));
const len = (g, p) => { let L = 0; for (let k = 1; k < p.length; k++) L += Math.hypot(g.pts[p[k]][0] - g.pts[p[k - 1]][0], g.pts[p[k]][1] - g.pts[p[k - 1]][1]); return L; };
for (const id of Object.keys(M.maps)) {
  const map = M.maps[id], ix = G.createMapIndex(map), g = B.navGraph(map, ix), n = g.pts.length;
  // one piece?
  const comp = new Int32Array(n).fill(-1); let pieces = 0, big = 0;
  for (let s = 0; s < n; s++) { if (comp[s] >= 0) continue; const q = [s]; comp[s] = pieces; let m = 0; while (q.length) { const k = q.pop(); m++; for (const j of g.nbr[k]) if (comp[j] < 0) { comp[j] = pieces; q.push(j); } } pieces++; big = Math.max(big, m); }
  check(id + ': su red, casi entera en un trozo (≥ 99 %)', big >= n * 0.99, pieces + ' trozos · el mayor ' + big + ' de ' + n);
  let seed = 11; const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const Q = []; for (let k = 0; k < 60; k++) Q.push([(r() * n) | 0, (r() * n) | 0]);
  let tJ = 0, tW = 0, bad = 0, longer = 0, empty = 0, worstJ = 0, worstW = 0;
  for (const [a, b] of Q) {
    g.noWasm = true; let t = process.hrtime.bigint(); const pj = B.astar(g, a, b); const dj = Number(process.hrtime.bigint() - t) / 1e6; tJ += dj; worstJ = Math.max(worstJ, dj);
    g.noWasm = false; t = process.hrtime.bigint(); const pw = B.astar(g, a, b); const dw = Number(process.hrtime.bigint() - t) / 1e6; tW += dw; worstW = Math.max(worstW, dw);
    if (pj.length && !pw.length) empty++;
    for (let k = 1; k < pw.length; k++) if (!g.nbr[pw[k - 1]].includes(pw[k])) { bad++; break; }
    if (pw.length && pj.length && len(g, pw) > len(g, pj) + 1e-6) longer++;
    if (pw.length && (pw[0] !== a || pw[pw.length - 1] !== b)) bad++;
  }
  check(id + ': rutas válidas, nunca más largas que las de JavaScript', bad === 0 && longer === 0 && empty === 0,
    'JS media ' + (tJ / Q.length).toFixed(2) + ' ms (peor ' + worstJ.toFixed(1) + ') · C++ media ' + (tW / Q.length).toFixed(3) + ' ms (peor ' + worstW.toFixed(2) + ')' + (bad + longer + empty ? ' · mal ' + bad + ' · más largas ' + longer + ' · vacías ' + empty : ''));
}
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
