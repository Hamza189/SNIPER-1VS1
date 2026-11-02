/* MIRAS (31-10-2026): las ópticas del rifle como accesorio (client/miras.js). Sin navegador.
   - catálogo: 8 miras, cada una con UN aumento (el propietario: en el móvil no se puede cambiar el zoom apuntando):
     punto rojo, holográfica, 2×, 3×, 4×, 6×, la de siempre 8× (por defecto) y largo alcance 12×; nombres y descripciones
   - la sensibilidad usa «hasta 4×» o «más de 4×»
   - dónde se monta en cada rifle: el pie siempre sobre el riel; la mira de siempre no se mueve
   - retículas: las marcas de caída y adelanto son ángulos reales a cada zoom; las de punto, anillo y chevrón tienen tamaño fijo
   - los modelos se construyen (con THREE de vendor) con pocas mallas y su línea de mira a la altura declarada
   Run: node test/miras.test.js */
'use strict';
const path = require('path');
const M = require('../client/miras.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);

console.log('\nCATÁLOGO');
check('8 miras ordenadas por aumento, la de siempre por defecto', M.ORDER.join(',') === 'punto,holo,x2,tactica,x4,x6,sniper,largo' && M.DEFAULT === 'sniper' && M.get('nada') === M.OPTICS.sniper && M.ORDER.length === Object.keys(M.OPTICS).length);
check('cada una con un solo aumento (sin botón de zoom), todos distintos', M.ORDER.every(id => M.OPTICS[id].zooms.length === 1) && new Set(M.ORDER.map(id => M.OPTICS[id].zooms[0])).size === 8);
check('lo que pidió el propietario: punto rojo, 2×, 4×, 6×, 8× (la de siempre) y 12×, cada uno aparte', M.OPTICS.punto.kind === 'reflex' && [['x2', 2], ['x4', 4], ['x6', 6], ['sniper', 8], ['largo', 12]].every(([id, z]) => M.OPTICS[id].zooms[0] === z));
check('4×, 6×, 8× y 12×: cada uno con su retícula y su círculo (más grande cuanto menos aumento, más oscuro cuanto más)', (() => {
  const t = ['x4', 'x6', 'sniper', 'largo'].map(id => M.OPTICS[id]);
  return new Set(t.map(o => o.reticle)).size === 4 && t.every((o, i) => !i || (o.ring < t[i - 1].ring && o.rs < t[i - 1].rs)) && M.OPTICS.sniper.ring === 46 && M.OPTICS.sniper.rs === 0.72; })());
check('cada una con nombre, tipo y retícula conocidos', M.ORDER.every(id => { const o = M.OPTICS[id];
  return o.name && o.desc && o.zooms[0] >= 1 && ['tube', 'prism', 'reflex'].includes(o.kind) && ['bdc', 'fino', 'mil', 'duplex', 'cruz', 'chevron', 'holo', 'dot'].includes(o.reticle) && (o.kind !== 'tube' || o.ring > 0); }));
check('la de siempre: 8× con su retícula de caída y su círculo de siempre', M.OPTICS.sniper.zooms.join() === '8' && M.OPTICS.sniper.reticle === 'bdc' && M.OPTICS.sniper.builtin);
check('sanitize: solo ids del catálogo', M.sanitize('holo') === 'holo' && M.sanitize('__proto__') === 'sniper' && M.sanitize(undefined) === 'sniper');

console.log('\nZOOM Y SENSIBILIDAD');
check('la rueda o el botón no cambian el aumento: cada mira se queda en el suyo', M.ORDER.every(id => M.nextZoom(id, M.OPTICS[id].zooms[0]) === M.OPTICS[id].zooms[0]));
check('al cambiar de mira se pone su aumento', M.firstZoom('largo', 8) === 12 && M.firstZoom('tactica', 8) === 3 && M.firstZoom('x4', 8) === 4 && M.firstZoom('sniper', 4) === 8);
check('etiqueta con coma decimal', M.zoomLabel(1.25) === '1,25×' && M.zoomLabel(8) === '8×' && M.zoomLabel(1.5) === '1,5×');
check('sensibilidad: hasta 4× usa «visor hasta 4×», más de 4× la otra (4 y 8 como antes)', M.sensKey(4) === 'scope4' && M.sensKey(1.25) === 'scope4' && M.sensKey(3) === 'scope4' && M.sensKey(6) === 'scope8' && M.sensKey(8) === 'scope8' && M.sensKey(12) === 'scope8');

console.log('\nMONTAJE EN CADA RIFLE');
check('la mira de siempre: el apuntado de siempre (línea de mira a 6,8 cm)', near(M.placement('halcon', 'sniper').axisY, 0.068) && near(M.placement('titan', 'sniper').axisY, 0.068));
let footOk = true, info = [];
for (const r in M.RIFLES) for (const id of M.ORDER) {
  if (M.OPTICS[id].builtin) continue;
  const P = M.placement(r, id), O = M.OPTICS[id], R = M.RIFLES[r].rail;
  const f0 = P.z + O.foot[0], f1 = P.z + O.foot[1], long = O.foot[1] - O.foot[0] > R.z[1] - R.z[0];
  if (!long && (f0 < R.z[0] - 1e-9 || f1 > R.z[1] + 1e-9)) { footOk = false; info.push(r + '/' + id); }
  if (!(P.axisY > R.y) || Math.abs(P.y - (R.y + (R.rise || 0) * -P.z)) > 1e-9) { footOk = false; info.push(r + '/' + id + ' y'); }
}
check('en los 6 rifles el pie de cada mira queda sobre su riel, a la altura del riel', footOk, info.join(' '));
check('HALCÓN + PUNTO ROJO: el punto en la misma línea que la mira de siempre (±1 mm), a 17 cm del ojo', Math.abs(M.placement('halcon', 'punto').axisY - 0.068) < 0.001 && Math.abs(0.27 - (M.placement('halcon', 'punto').z + M.OPTICS.punto.rear) - 0.173) < 0.002, JSON.stringify(M.placement('halcon', 'punto')));
check('LARGO ALCANCE y VISOR 6× en el HALCÓN: el ocular a 7 cm del ojo', near(M.placement('halcon', 'largo').z + M.OPTICS.largo.rear, 0.2, 1e-6) && near(M.placement('halcon', 'x6').z + M.OPTICS.x6.rear, 0.2, 1e-6));
check('SAHARA: la mira sigue la inclinación de su riel', M.placement('lince', 'holo').tilt > 0.01 && M.placement('halcon', 'holo').tilt === 0);

console.log('\nRETÍCULAS');
const G = { gravity: 9.81, zero: 50, speed: 600 }, MV = { crouch: 1.95, walk: 4.05, sprint: 7 };
const ctx = (zoom, extra) => Object.assign({ zoom, H: 430, rpx: 198, fovBase: 70, gun: G, move: MV }, extra);
const b8 = M.reticle('bdc', ctx(8)), b4 = M.reticle('bdc', ctx(4));
check('marcas de caída a 8× el doble de lejos del centro que a 4× (ángulos reales)', Math.abs(b8.u / b4.u - Math.tan(35 * Math.PI / 180 / 4) / Math.tan(35 * Math.PI / 180 / 8)) < 1e-9 && /100/.test(b8.labels));
const y100 = +b8.marks.match(/M-3\.2 ([0-9.]+)H/)[1], want = G.gravity * 50 / (2 * G.speed * G.speed) * 1000 * b8.u;
check('a 100 m la marca cae donde cae la bala (0,68 mrad bajo el cero de 50 m)', Math.abs(y100 - want) < 0.01, y100 + ' / ' + want.toFixed(3));
const f12 = M.reticle('fino', ctx(12));
check('LARGO ALCANCE 12×: retícula fina con 250 m y las tres de adelanto', /250/.test(f12.labels) && (f12.labels.match(/>A</g) || []).length === 2 && (f12.labels.match(/>C</g) || []).length === 2 && f12.crossW < b8.crossW);
const ch = M.reticle('chevron', ctx(3)), ho = M.reticle('holo', ctx(1.5)), dt = M.reticle('dot', ctx(1.25)), cz = M.reticle('cruz', ctx(2)), unit = 198 / 100;
check('2×: cruz fina con hueco en el centro y punto iluminado', cz.cross.length > 0 && cz.dot * unit >= 1.4 && /M-52 0H-/.test(cz.cross) && cz.lit === '');
const dx = M.reticle('duplex', ctx(4)), ml = M.reticle('mil', ctx(6));
check('4×: cruz gruesa por fuera y fina en el centro, sin punto', dx.postW > 3 && /M-34 0H34/.test(dx.cross) && dx.dot === 0 && dx.marks === '');
const nd = (ml.mils.match(/a/g) || []).length / 2, st = 5 * ml.u, firstX = parseFloat(ml.mils.split('a')[0].slice(1)) + Math.max(0.35, 0.0016 * 430 / unit);
check('6×: un punto cada 5 milésimas en los cuatro brazos (ángulo real a 6×) y el centro iluminado', nd >= 16 && nd % 4 === 0 && Math.abs(firstX - st) < 0.02 && ml.dot > 0, nd + ' puntos · paso ' + st.toFixed(2));
check('chevrón: la punta en el centro y ~3 % de la altura de la imagen', /^M0 0L/.test(ch.lit) && Math.abs(parseFloat(ch.lit.split('L')[1]) * unit - 0.03 * 430) < 0.2 && ch.cross === '');
check('holográfica: anillo de ~6 % de la altura y punto central', Math.abs(parseFloat(ho.ring.slice(1)) * -unit - 0.06 * 430) < 0.2 && ho.dot > 0 && ho.glow > ho.dot);
check('miras de ventana (02-11): punto, holográfica, 2× y 3× con el rifle a la vista, su ventana medida en cada rifle (5–25 % de media pantalla)',
  ['punto', 'holo', 'x2', 'tactica'].every(id => M.OPTICS[id].kind === 'reflex' && M.OPTICS[id].win) &&
  Object.keys(M.RIFLES).every(r => ['punto', 'holo', 'x2', 'tactica'].every(id => { const k = M.windowFrac(id, M.placement(r, id)); return k > 0.05 && k < 0.25; })));
check('miras de ventana: la retícula entera dentro de la ventana (el propietario: «tiene que verse la mira entera y la retícula dentro»)', ['cruz', 'chevron', 'holo', 'dot'].every(st => {
  const R = M.reticle(st, { zoom: st === 'cruz' ? 2 : 3, H: 430, rpx: 26, fovBase: 70, gun: { gravity: 9.81, zero: 50, speed: 850 }, move: { crouch: 1, walk: 3, sprint: 6 }, see: true });
  const nums = (R.posts + R.cross + R.lit + R.ring).match(/-?\d+(\.\d+)?/g) || [];
  return nums.every(n => Math.abs(+n) <= 95) && R.dot <= 16 && (st !== 'holo' || parseFloat(R.ring.slice(1)) >= -62); }));
check('punto rojo: al menos 2 px y con halo', dt.dot * unit >= 2 && dt.glow > dt.dot && dt.ring === '' && dt.lit === '');

console.log('\nMODELOS');
global.window = undefined;
const T = require('../vendor/three.min.js');
let ok = true, notes = [];
for (const id of M.ORDER) {
  const g = M.build(T, id, null);
  if (M.OPTICS[id].builtin) { if (g !== null) ok = false; continue; }
  const meshes = g.children.filter(o => o.isMesh), tris = meshes.reduce((s, o) => s + o.geometry.attributes.position.count / 3, 0);
  const bb = new T.Box3().setFromObject(g);
  notes.push(id + ' ' + meshes.length + ' mallas ' + tris + ' tri');
  if (meshes.length > 9 || tris > 9000 || bb.min.y < -0.002 || g.userData.axis !== M.OPTICS[id].axis) ok = false;
  if (Math.abs(bb.max.z - M.OPTICS[id].rear) > 0.004) { ok = false; notes.push(id + ' rear ' + bb.max.z.toFixed(4)); }
}
check('las 7 miras nuevas: como mucho 9 mallas y 9000 triángulos, nada por debajo del riel, el final donde dice el catálogo', ok, notes.join(' · '));

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
