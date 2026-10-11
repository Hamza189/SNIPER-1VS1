/* PUEBLO 2.0 geometry (client/town.js): the detailed town must not change the game.
   - nothing new stands where players walk (at body height, outside the buildings' boxes)
   - the roof players can reach stays clear; props stay inside the boxes that collide
   - the same town is built every time (seeded), with a sane triangle budget
   Run: node test/town.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const T = require('../client/town.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'page.html'), 'utf8');
const BUILDINGS = JSON.parse(src.match(/const BUILDINGS=(\[\[.*?\]\]);/)[1]);
const TINTS = [0xe8c9a0, 0xd9a882, 0xcbbfa8, 0xe3d6be, 0xbf916c, 0xd8b48f];
const opt = { tints: TINTS, reachable: [[-9, -31]] };

console.log('\nPUEBLO 2.0: EDIFICIOS Y CALLES');
const t0 = Date.now(), A = T.build(BUILDINGS, opt), ms = Date.now() - t0, B = T.build(BUILDINGS, opt);
check('se genera el pueblo entero (14 edificios) en poco tiempo', A.tris > 20000 && ms < 1500, A.tris + ' triángulos, ' + ms + ' ms');
check('siempre el mismo pueblo (mismo resultado en cada dispositivo)', A.tris === B.tris && A.plaster.pos.every((v, i) => v === B.plaster.pos[i]));
check('presupuesto razonable para móvil (< 90 000 triángulos)', A.tris < 90000, A.tris);
// every vertex between 0.12 m and 2.0 m high (where a body is) must be inside or on a building box
// (plus 0.62 m for balconies, which only start above 2 m, and 0.36 m for door steps, which are below 0.12 m)
const near = (x, z) => BUILDINGS.some(([bx, bz, w, d]) => Math.abs(x - bx) <= w / 2 + 0.42 && Math.abs(z - bz) <= d / 2 + 0.42);
let stray = 0, worst = '';
for (const k of T.MATS) {
  const g = A[k]; if (!g) continue;
  for (let i = 0; i < g.pos.length; i += 3) {
    const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2];
    if (y > 0.12 && y < 2.0 && !near(x, z)) { stray++; worst = k + ' ' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2); }
  }
}
check('nada nuevo a la altura del cuerpo fuera de los edificios (no tapa ni estorba)', stray === 0, stray ? stray + ' vértices, p. ej. ' + worst : 'ninguno');
// walls on the collision faces: the plaster never sits outside the box by more than the frame depth
let off = 0;
{ const g = A.plaster;
  for (let i = 0; i < g.pos.length; i += 3) {
    const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2];
    if (y > 0.2 && y < 2.0 && !BUILDINGS.some(([bx, bz, w, d]) => Math.abs(x - bx) <= w / 2 + 0.001 && Math.abs(z - bz) <= d / 2 + 0.001)) off++;
  } }
check('las paredes van exactamente sobre las cajas de colisión', off === 0, off + ' vértices fuera');
// the reachable roof (ramp south-west of the plaza): nothing above its walkable top
{ const [bx, bz, w, d, h] = BUILDINGS.find(b => b[0] === -9 && b[1] === -31);
  let above = 0;
  for (const k of T.MATS) { const g = A[k]; if (!g) continue;
    for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2];
      if (Math.abs(x - bx) < w / 2 + 0.2 && Math.abs(z - bz) < d / 2 + 0.2 && y > h + 0.351) above++; } }
  check('la azotea a la que se sube por la rampa queda despejada', above === 0, above + ' vértices encima'); }

console.log('\nPUEBLO 2.0: OBJETOS (dentro de sus cajas de siempre)');
const inBox = (P, x0, y0, z0, x1, y1, z1, tol) => { let out = 0; for (const k of T.MATS) { const g = P[k]; if (!g) continue;
  for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2];
    if (x < x0 - tol || x > x1 + tol || y < y0 - tol || y > y1 + tol || z < z0 - tol || z > z1 + tol) out++; } } return out; };
{ const P = T.props([{ t: 'crate', x: 5, y: 0, z: 5, ry: 0 }]);
  check('caja: dentro de su cubo de 1,2 m (± 3 cm de tablas)', inBox(P, 4.4, 0, 4.4, 5.6, 1.2, 5.6, 0.031) === 0); }
{ const P = T.props([{ t: 'bags', x: 0, y: 0, z: 0, w: 6, h: 1.05, d: 0.8 }]), Q = T.props([{ t: 'bags', x: 0, y: 0, z: 0, w: 0.8, h: 1.05, d: 5 }]);
  check('sacos terreros: dentro del muro bajo (a lo largo y a lo ancho)', inBox(P, -3, 0, -0.4, 3, 1.05, 0.4, 0.03) === 0 && inBox(Q, -0.4, 0, -2.5, 0.4, 1.05, 2.5, 0.03) === 0, inBox(P, -3, 0, -0.4, 3, 1.05, 0.4, 0.03) + ' / ' + inBox(Q, -0.4, 0, -2.5, 0.4, 1.05, 2.5, 0.03)); }
{ const P = T.props([{ t: 'barrel', x: 0, y: 0, z: 0, r: 0.36, h: 1 }]);
  check('bidón: dentro de su cilindro', inBox(P, -0.37, 0, -0.37, 0.37, 1.02, 0.37, 0.001) === 0); }
{ const P = T.props([{ t: 'car', x: 0, y: 0, z: 0, ry: 0 }]);
  check('coche: dentro de su caja de colisión (4,2 × 1,9 m)', inBox(P, -2.1, 0, -0.95, 2.1, 1.9, 0.95, 0.07) === 0); }
{ const P = T.props([{ t: 'block', x: 0, y: 0, z: 0, w: 6, h: 3, d: 0.6 }]);
  check('muro de hormigón: su caja más el remate (8 cm)', inBox(P, -3, 0, -0.3, 3, 3, 0.3, 0.081) === 0); }

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
