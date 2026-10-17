/* client/rats.js — the rat's brain without WebGL: states, walls, fleeing to the drain and coming back out.
   Run: node test/rats.test.js */
'use strict';
const R = require('../client/rats.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
// a small street: a wall along x = 2 (2 m long) and a crate; the drain at the origin
const boxes = [{ minX: 2, maxX: 2.4, minZ: -3, maxZ: 3 }, { minX: -1.6, maxX: -1, minZ: 0.8, maxZ: 1.4 }];
const inBox = (x, z, m) => boxes.some(c => x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m);
const world = {
  blocked: (x, z) => inBox(x, z, 0.1) || Math.abs(x) > 8 || Math.abs(z) > 8,
  clear(x0, z0, x1, z1) { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25); for (let i = 1; i <= n; i++) if (this.blocked(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n)) return false; return true; },
  wallDist: (x, z) => Math.min(...boxes.map(c => Math.hypot(Math.max(c.minX - x, 0, x - c.maxX), Math.max(c.minZ - z, 0, z - c.maxZ)))),
};
const b = R.brain({ x: 0, z: 0 }, 1234, world);
const far = { x: 30, z: 30 }, dt = 1 / 30, seen = new Set();
let inside = 0, maxD = 0, moved = 0, px = b.x, pz = b.z, maxSpeed = 0;
for (let i = 0; i < 30 * 120; i++) { b.update(dt, far); seen.add(b.state); if (inBox(b.x, b.z, 0)) inside++; maxD = Math.max(maxD, Math.hypot(b.x, b.z)); moved += Math.hypot(b.x - px, b.z - pz); px = b.x; pz = b.z; maxSpeed = Math.max(maxSpeed, b.speed); }
console.log('\nSOLA (2 minutos)');
check('pasa por reposo, olfateo y exploración', ['idle', 'sniff', 'explore'].every(s => seen.has(s)), [...seen].join(', '));
check('se mueve de verdad y a paso de rata (≤ 0,35 m/s)', moved > 3 && maxSpeed <= 0.33, moved.toFixed(1) + ' m · máx ' + maxSpeed.toFixed(2) + ' m/s');
check('nunca se mete dentro de una pared o una caja', inside === 0, inside + ' fotogramas');
check('no se aleja de su alcantarilla', maxD < R.CFG.patch + 0.8, maxD.toFixed(2) + ' m');
console.log('\nHUIDA');
b.x = 1.2; b.z = -1.5; b.state = 'idle'; b.t = 5;
const near = { x: 1.2, z: -4.5 };
b.update(dt, near);
check('el jugador a 3 m: huye en el mismo fotograma', b.state === 'flee');
let t = 0, top = 0; while (b.state === 'flee' && t < 8) { b.update(dt, near); top = Math.max(top, b.speed); t += dt; }
check('corre (más de 2 m/s) y llega a la alcantarilla en pocos segundos', top > 2 && b.state === 'hidden', top.toFixed(2) + ' m/s · ' + t.toFixed(1) + ' s');
for (let i = 0; i < 30; i++) b.update(dt, near);
check('se mete en la alcantarilla (deja de verse)', !b.visible && b.sink > 0.9);
for (let i = 0; i < 30 * 20; i++) b.update(dt, near);
check('con el jugador cerca no vuelve a salir', b.state === 'hidden');
for (let i = 0; i < 30 * 15; i++) b.update(dt, far);
check('con el jugador lejos sale otra vez', b.state !== 'hidden' && b.visible, b.state);
console.log('\nDISPARO');
for (let i = 0; i < 30 * 3; i++) b.update(dt, far);
const st = b.state;
b.update(dt, Object.assign({ shotAt: 1, shotX: 10, shotZ: 0 }, far));
check('un disparo a 10 m la asusta', b.state === 'flee', st + ' → ' + b.state);
const b2 = R.brain({ x: 0, z: 0 }, 99, world); for (let i = 0; i < 10; i++) b2.update(dt, far);
b2.update(dt, Object.assign({ shotAt: 2, shotX: 50, shotZ: 0 }, far));
check('un disparo a 50 m no', b2.state !== 'flee');
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
