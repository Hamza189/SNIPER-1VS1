/* La red de los bots en C++/WebAssembly (wasm/nav.cpp, client/navwasm.js) frente a su versión JavaScript (navGrid de
   client/casa2.js), en los cuatro mapas que la usan: mismos puntos, mismas coordenadas y mismos enlaces, y cuánto tarda
   cada una. Run: node test/navwasm.test.js */
'use strict';
const NW = require('../client/navwasm.js');
const C = require('../client/casa.js'), C2 = require('../client/casa2.js'), J = require('../client/casa2j.js'), BA = require('../client/barrio.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
console.log('\nRED DE LOS BOTS: C++/WebAssembly frente a JavaScript');
check('el módulo WebAssembly se carga (assets/wasm/nav.wasm)', NW.ready && !NW.failed, NW.exp ? Object.keys(NW.exp).join(' ') : 'no');
const time = f => { const t = process.hrtime.bigint(); const r = f(); return [r, Number(process.hrtime.bigint() - t) / 1e6]; };
for (const [name, L, bx] of [['CASA ATLAS 2.0', C2, C2.boxes(C)], ['diseño 2', C2.v2, C2.v2.boxes(C)], ['JARDÍN', J, J.boxes()], ['BARRIO', BA, BA.boxes()]]) {
  const cols = bx.map(b => ({ minX: b.a[0], minY: b.a[1], minZ: b.a[2], maxX: b.b[0], maxY: b.b[1], maxZ: b.b[2] }));
  for (const rad of [undefined, 0.5]) {
    NW.off = true; const [js, tJ] = time(() => L.navGrid(cols, 0.35, 1.8, rad));
    NW.off = false; const [wa, tW] = time(() => L.navGrid(cols, 0.35, 1.8, rad));
    let same = js.length === wa.length, where = '';
    for (let k = 0; same && k < js.length; k++) {
      const a = js[k], b = wa[k];
      if (a.x !== b.x || a.z !== b.z || a.n.length !== b.n.length || a.n.some((v, q) => v !== b.n[q])) { same = false; where = 'punto ' + k + ': ' + JSON.stringify(a).slice(0, 80) + ' / ' + JSON.stringify(b).slice(0, 80); }
    }
    check(name + (rad ? ' (margen 0,5 m)' : '') + ': la misma red', same && NW.runs > 0, same ? js.length + ' puntos · JS ' + tJ.toFixed(0) + ' ms · C++ ' + tW.toFixed(0) + ' ms (×' + (tJ / tW).toFixed(1) + ')' : where || (js.length + ' / ' + wa.length));
  }
}
NW.off = false;
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
