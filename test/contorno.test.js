/* EL CONTORNO DEL PUEBLO (client/contorno.js, 26-11-2026) sin navegador, con el mapa del servidor (core/mapdata.js,
   'pueblo4') y el código de movimiento real (core/movement.js):
   - el muro cierra todo el polígono (no hay hueco por donde salir) y el servidor tiene sus cajas
   - se llega andando a la plazuela del este, al fondo del callejón del sur y al patio del oeste
   - andando contra cada muro no se sale; los puntos de la red de los bots están dentro (≥ 2,9 m del muro)
   - las cajas de madera no quedan dentro de las manzanas que entran
   Ejecutar: node test/contorno.test.js */
'use strict';
const O = require('../client/contorno.js'), MAP = require('../core/mapdata.js'), SDMovement = require('../core/movement.js'), CFG = require('../core/config.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const P = MAP.maps.pueblo4, M = CFG.move, world = { colliders: P.colliders, ramps: P.ramps || [] };
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
function walk(s, dx, dz, t) { const yaw = yawTo(dx, dz); for (let i = 0; i < t * 60; i++) SDMovement.step(s, { mx: 0, mz: -1, yaw }, 1 / 60, world, M); return s; }
const at = (x, z) => { const s = SDMovement.createState(x, 0, z); for (let i = 0; i < 20; i++) SDMovement.step(s, { mx: 0, mz: 0, yaw: 0 }, 1 / 60, world, M); return s; };
const inBoxes = (x, z, y) => P.colliders.some(c => x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ && y >= c.minY && y <= c.maxY);

console.log('\nEL POLÍGONO');
const S = O.sides();
check('ya no es un cuadrado: ' + O.POLY.length + ' esquinas, lados de ' + Math.min(...S.map(s => s.L)) + ' a ' + Math.max(...S.map(s => s.L)) + ' m', O.POLY.length > 4);
check('todos los lados rectos (norte-sur o este-oeste: cajas de movimiento rectas)', S.every(s => Math.abs(s.R[0]) === 1 || Math.abs(s.R[2]) === 1));
check('el pueblo de antes sigue dentro (la plaza, las calles, los edificios)', [[0, 0], [0, 45], [0, -45], [45, 0], [-45, 0], [30, 30], [-30, -30], [45, 45], [-45, -45]].every(p => O.inside(p[0], p[1], 2)));
check('lo nuevo está dentro: plazuela, callejón, patio', O.inside(58, -1, 2) && O.inside(20, -57, 2) && O.inside(-53, -24, 2));
check('y las manzanas que entran, fuera', !O.inside(-46, 47) && !O.inside(46, -46));

console.log('\nEL MURO CIERRA (mapa del servidor)');
const W = O.walls(), key = c => [c.minX, c.minY, c.minZ, c.maxX, c.maxY, c.maxZ].map(v => Math.round(v * 1000)).join(',');
const inMap = new Set(P.colliders.map(key));
check('el servidor tiene las ' + W.length + ' cajas del muro (si falla: node tools/export-map.js)', W.every(c => inMap.has(key(c))), W.filter(c => !inMap.has(key(c))).length + ' que faltan');
check('ya no está el muro recto de antes en x = 50 (donde se abre la plazuela)', !P.colliders.some(c => c.minX === 50 && c.maxX === 51 && c.minZ <= -10 && c.maxZ >= 8));
// half a metre outside every side, all along it (every 0.25 m, at 1 m high): always inside a wall box
let holes = 0;
for (const s of S) for (let u = 0; u <= s.L; u += 0.25) { const x = s.O[0] + s.R[0] * u - s.N[0] * 0.5, z = s.O[2] + s.R[2] * u - s.N[2] * 0.5; if (!inBoxes(x, z, 1)) holes++; }
check('sin huecos: medio metro por fuera de cada lado siempre hay muro', holes === 0, holes + ' puntos sin muro');

console.log('\nANDANDO (radio 0,35)');
let s = walk(at(14, 2.5), 1, 0, 14);   // (z 2.5: beside the sandbags at x 20)
check('por la calle transversal hasta el fondo de la plazuela del este', s.x > 61 && s.x < 62, s.x.toFixed(2) + ', ' + s.z.toFixed(2));
s = walk(at(18.2, -40), 0, -1, 8);   // (beside the crate at the end)
check('al fondo del callejón del sur', s.z < -59 && s.z > -60, s.x.toFixed(2) + ', ' + s.z.toFixed(2));
s = walk(at(-44, -24), -1, 0, 8);
check('al fondo del patio del oeste', s.x < -55 && s.x > -56, s.x.toFixed(2) + ', ' + s.z.toFixed(2));
let out = 0;
for (const sd of S) { const u = sd.L / 2, x = sd.O[0] + sd.R[0] * u + sd.N[0] * 1.5, z = sd.O[2] + sd.R[2] * u + sd.N[2] * 1.5;
  if (inBoxes(x, z, 1)) continue;
  const r = walk(at(x, z), -sd.N[0], -sd.N[2], 3); if (!O.inside(r.x, r.z, 0.3)) { out++; console.log('    se sale por', sd.O, '→', r.x.toFixed(2), r.z.toFixed(2)); } }
check('andando contra cada muro no se sale', out === 0, out);

console.log('\nRED DE LOS BOTS Y CAJAS');
check('todos los puntos de la red dentro, a ≥ 2,9 m del muro', P.nav.every(p => O.inside(p[0], p[1], 2.9)), P.nav.filter(p => !O.inside(p[0], p[1], 2.9)).length);
check('hay puntos en la plazuela, el callejón y el patio', P.nav.some(p => p[0] > 51) && P.nav.some(p => p[1] < -51) && P.nav.some(p => p[0] < -51));
const crates = P.colliders.filter(c => Math.abs(c.maxX - c.minX - 1.2) < 1e-3 && Math.abs(c.maxZ - c.minZ - 1.2) < 1e-3 && c.minY === 0 && c.minZ < 52);   // (z > 52: the shooting range's, behind the north wall)
check('ninguna caja de madera (' + crates.length + ') fuera del pueblo ni metida en el muro', crates.every(c => O.inside((c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2, 0.7)));
console.log(`\n${pass} ok, ${fail} fallos`);
process.exit(fail ? 1 : 0);
