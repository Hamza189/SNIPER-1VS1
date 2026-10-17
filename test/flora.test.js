/* client/flora.js — where the plants go (no WebGL). Run: node test/flora.test.js */
'use strict';
const F = require('../client/flora.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
// a street 9 m wide (x −4.5…4.5) between two rows of houses, a planter and a drain
const C = [{ minX: -12, maxX: -5.5, minY: 0, maxY: 6, minZ: 0, maxZ: 40 }, { minX: 5.5, maxX: 12, minY: 0, maxY: 6, minZ: 0, maxZ: 40 },
  { minX: 3, maxX: 4.2, minY: 0, maxY: 0.8, minZ: 18, maxZ: 22 }, { minX: -1, maxX: 1, minY: 2.5, maxY: 3, minZ: 10, maxZ: 11 }];
const opt = p => ({ colliders: C, region: [-20, 20, 0, 40], profile: p, seed: 7, drains: [[1.9, 20]],
  kerbs: [['z', -4.5, 0, 40, 1], ['z', 4.5, 0, 40, -1]] });
const A = F.scatter(opt('alto')), M = F.scatter(opt('medio')), B = F.scatter(opt('bajo'));
const inBox = p => C.some(c => c.minY < 0.3 && p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ);
check('hay vegetación de los dos tipos', A.some(p => p.kind === 'grass') && A.some(p => p.kind === 'dandelion'), A.length + ' plantas');
check('ninguna dentro de una pared, jardinera o caja', !A.some(inBox));
// distance to the nearest thing a plant can grow against: a wall or low obstacle (≥ 0.3 m tall), a kerb line or a drain
const near = p => Math.min(
  ...C.filter(c => c.maxY >= 0.3 && c.minY < 0.3).map(c => Math.hypot(Math.max(c.minX - p.x, 0, p.x - c.maxX), Math.max(c.minZ - p.z, 0, p.z - c.maxZ))),
  Math.abs(Math.abs(p.x) - 4.5), Math.hypot(p.x - 1.9, p.z - 20));
const lost = A.filter(p => near(p) > 1.2);
check('ninguna suelta en medio de la calle o de una explanada (todas a menos de 1,2 m de una pared, jardinera, bordillo o alcantarilla)', lost.length === 0, lost.length + ' sueltas · máx ' + Math.max(...A.map(near)).toFixed(2) + ' m');
check('casi todas pegadas a lo que las sostiene (90 % a menos de 0,7 m)', A.filter(p => near(p) < 0.7).length / A.length > 0.9, Math.round(A.filter(p => near(p) < 0.7).length / A.length * 100) + ' %');
// the check above must catch a misplaced plant: one in the open middle of the street
check('…y la comprobación detecta una planta en mitad de la calzada', near({ x: 0, z: 30 }) > 1.2);
check('sobre todo hierba seca, verde junto a la alcantarilla', A.filter(p => p.kind === 'grass' && p.dry).length > A.filter(p => p.kind === 'grass' && !p.dry).length && A.filter(p => Math.hypot(p.x - 1.9, p.z - 20) < 1 && p.kind === 'grass').every(p => !p.dry));
check('MEDIO ≈ 60 % y BAJO ≈ 25 % de ALTO, en los mismos sitios', Math.abs(M.length / A.length - 0.6) < 0.12 && Math.abs(B.length / A.length - 0.25) < 0.1 && B.every(b => A.some(a => a.x === b.x && a.z === b.z)), A.length + ' / ' + M.length + ' / ' + B.length);
check('el mismo resultado cada vez (todos los jugadores ven las mismas plantas)', JSON.stringify(F.scatter(opt('alto'))) === JSON.stringify(A));
check('variación de tamaño y orientación', new Set(A.map(p => p.s.toFixed(2))).size > 20 && new Set(A.map(p => p.variant)).size === 5);
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
