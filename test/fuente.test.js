/* LA FUENTE (14-11-2026, client/fuente.js) sin navegador: los chorros salen de los caños de la fuente del kit, caen dentro de
   la pila (5 × 5 por dentro, muros de ±2,5 a ±2,75) sin tocar el pilar, todo por debajo de la taza; el agua a 0,6 m (los
   muros llegan a 0,8). Solo se ve: no añade cajas ni blancos de bala.   Ejecutar: node test/fuente.test.js */
'use strict';
const F = require('../client/fuente.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
// a stand-in for the few THREE pieces build() uses (geometry only)
class V3 { constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
class Attr { constructor(a, n) { this.array = a; this.itemSize = n; this.count = a.length / n; } }
class Geo { constructor() { this.attributes = {}; this.index = null; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(i) { this.index = { count: i.length, array: i }; } computeBoundingSphere() {} }
class Plane extends Geo { constructor(w, h) { super(); this.w = w; this.h = h; this.attributes.position = new Attr(new Float32Array(12), 3); this.index = { count: 6 }; } }
class Mat { constructor(o) { Object.assign(this, o || {}); this.userData = {}; } }
class Obj { constructor(g, m) { this.geometry = g; this.material = m; this.position = new V3(); this.rotation = new V3(); this.isMesh = true; } }
class Color { constructor() {} convertSRGBToLinear() { return this; } }
const T = { BufferGeometry: Geo, Float32BufferAttribute: Attr, PlaneGeometry: Plane, CircleGeometry: Plane, MeshStandardMaterial: Mat, ShaderMaterial: Mat, Mesh: Obj,
  Points: class extends Obj { constructor(g, m) { super(g, m); this.isMesh = false; this.isPoints = true; } }, Group: class { constructor() { this.children = []; } add(o) { this.children.push(o); } },
  Vector3: V3, Vector4: class { constructor(...a) { this.v = a; } }, Sphere: class {}, Color, UniformsUtils: { merge: a => Object.assign({}, ...a) }, UniformsLib: { fog: {} }, DoubleSide: 2, AdditiveBlending: 2 };
const f = F.build(T, { x: 0, z: 0, level: 0.6, jets: true });
check('agua, fondo de cáusticas, taza, chorros, espuma y gotas: ' + f.calls + ' llamadas de dibujo', f.calls === 6, f.calls);
check('pocos triángulos (' + f.tris + ')', f.tris < 6000, f.tris);
check('8 sitios donde cae el agua (4 caños + 4 hilos de la taza)', f.land.length === 8);
check('todos caen dentro de la pila y lejos del pilar (0,45) y del borde (2,5)', f.land.every(l => Math.max(Math.abs(l[0]), Math.abs(l[1])) < 2.2 && Math.hypot(l[0], l[1]) > 0.75), f.land.map(l => Math.hypot(l[0], l[1]).toFixed(2)).join(' '));
const jets = f.meshes.find(m => m.name === 'fuente_chorros'), P = jets.geometry.attributes.position.array;
let maxY = 0, outB = 0, inPillar = 0;
for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; maxY = Math.max(maxY, y); if (Math.max(Math.abs(x), Math.abs(z)) > 2.45) outB++; if (y < 2.4 && Math.hypot(x, z) < 0.45) inPillar++; }
check('ningún chorro sale de la pila', outB === 0, outB);
check('ningún chorro atraviesa el fuste del pilar (radio 0,44 hasta 2,4 m)', inPillar === 0, inPillar);
check('nada por encima de 3 m (el borbotón de la taza llega a ~2,9)', maxY < 3.0, maxY.toFixed(2));
check('el agua de la pila a 0,6 m, por debajo del borde (0,8)', f.meshes.find(m => m.name === 'fuente_agua').position.y === 0.6);
check('sin chorros (PUEBLO 2.0): solo el agua y el fondo', F.build(T, { jets: false }).calls === 2);
console.log('\n' + pass + ' ok, ' + fail + ' fallos');
process.exit(fail ? 1 : 0);
