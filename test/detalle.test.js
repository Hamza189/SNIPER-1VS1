/* MÁS DETALLE (client/detalle.js, docs/DETALLE.md) sin navegador, con las cajas REALES del servidor (core/mapdata.js)
   del PUEBLO 4.0 y del BARRIO: lo nuevo es solo lo que se ve y no crea coberturas falsas.   node test/detalle.test.js */
'use strict';
const D = require('../client/detalle.js'), M = require('../core/mapdata.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const boxesOf = id => M.maps[id].colliders.map(c => ({ a: [c.minX, c.minY, c.minZ], b: [c.maxX, c.maxY, c.maxZ] }));
const inside = (B, x, y, z, m) => B.some(b => x > b.a[0] - m && x < b.b[0] + m && z > b.a[2] - m && z < b.b[2] + m && y > b.a[1] - m && y < b.b[1] + m);
for (const [id, opt] of [['pueblo4', { bounds: [-48.5, -48.5, 48.5, 48.5], posters: true, skip: (x, z) => Math.hypot(x, z) < 5 }],
  ['barrio', { bounds: [-27.8, -19.8, 27.8, 19.8], posters: true, tags: true, damp: true }]]) {
  const B = boxesOf(id), o = Object.assign({ boxes: B, seed: 1 }, opt), r = D.plan(o);
  console.log(id + ': ' + B.length + ' cajas → ' + r.faces + ' tramos de pared, ' + r.decals.length + ' calcomanías, ' + r.props.length + ' objetos');
  check(id + ': hay detalle (≥ 100 calcomanías, ≥ 30 objetos)', r.decals.length >= 100 && r.props.length >= 30);
  check(id + ': lo mismo cada vez (semilla fija)', JSON.stringify(D.plan(o)) === JSON.stringify(r));
  const pin = r.props.filter(p => inside(B, p.x, 0.05, p.z, 0.0));
  check(id + ': ningún objeto dentro de una caja', pin.length === 0, pin.length);
  check(id + ': objetos a ras de suelo (y = suelo) y de ' + D.MAX_PROP_H * 100 + ' cm como mucho', r.props.every(p => p.y < 0.6) && D.MAX_PROP_H <= 0.12);
  const flat = r.decals.filter(d => d.n[1] === 1), wall = r.decals.filter(d => d.n[1] === 0);
  check(id + ': las del suelo, planas y a menos de 3 cm de él', flat.every(d => d.u[1] === 0 && d.v[1] === 0 && d.c[1] < 0.65));
  check(id + ': las de pared, verticales y a 2 cm de la cara', wall.every(d => d.v[0] === 0 && d.v[2] === 0 && d.u[1] === 0));
  const bad = r.decals.filter(d => { const u = d.u, v = d.v; return (u[1] * v[2] - u[2] * v[1]) * d.n[0] + (u[2] * v[0] - u[0] * v[2]) * d.n[1] + (u[0] * v[1] - u[1] * v[0]) * d.n[2] <= 0; });
  check(id + ': todas miran hacia fuera (se ven, el texto se lee)', bad.length === 0, bad.length);
  const lost = r.decals.filter(d => inside(B, d.c[0] + d.n[0] * 0.05, d.c[1] + 0.05, d.c[2] + d.n[2] * 0.05, -0.01));
  check(id + ': ninguna metida dentro de una caja', lost.length === 0, lost.length);
}
// posters never over what is already on the wall
{
  const B = [{ a: [-5, 0, -5], b: [5, 8, 5] }], avoid = [];
  for (let x = -4.5; x <= 4.5; x += 0.5) avoid.push({ x, y: 1.9, z: -5, r: 0.9 });
  const r = D.plan({ boxes: B, bounds: [-20, -20, 20, 20], posters: true, avoid, density: 3, seed: 5 });
  const onN = r.decals.filter(d => d.n[2] === -1 && d.c[1] > 1);
  check('carteles: ninguno sobre ventanas o puertas (cara norte llena de ellas)', onN.length === 0, onN.length);
}
console.log(`\n${pass} ok, ${fail} fallos`);
process.exit(fail ? 1 : 0);
