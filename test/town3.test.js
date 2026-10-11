/* PUEBLO 3.0 (client/town3.js + assets/kit.glb): the new town must not change the game.
   - six families of buildings, the same town on every device, a sane budget
   - walls on the collision boxes; nothing new at body height away from a wall
   - every kit piece, where it is placed: inside / against a solid box, low against a wall (≤ 0.65 m), or
     above head height near a wall — never a free-standing visual that looks like cover and is not
   Run: node test/town3.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const T3 = require('../client/town3.js');
const MAP = require('../core/mapdata.js').maps.pueblo;
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'page.html'), 'utf8');
const BUILDINGS = JSON.parse(src.match(/const BUILDINGS=(\[\[.*?\]\]);/)[1]);
const BOXES = MAP.colliders;   // the solid boxes the server uses (buildings with their caps, walls, crates, cars…)
const slice = BUILDINGS.filter(b => T3.SLICE_FAMILIES[b[0] + ',' + b[1]]);

// kit piece bounds (local frame) from the GLB
function kitBounds() {
  const b = fs.readFileSync(path.join(__dirname, '..', 'assets', 'kit.glb'));
  const n = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + n).toString());
  const out = {};
  for (const node of j.nodes) {
    if (node.mesh == null) continue;
    const m = j.meshes[node.mesh]; let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const p of m.primitives) { const a = j.accessors[p.attributes.POSITION]; for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], a.min[i]); mx[i] = Math.max(mx[i], a.max[i]); } }
    out[node.name] = { mn, mx };
  }
  return out;
}
const KB = kitBounds();
function worldBox(p) {
  const k = KB[p.k]; if (!k) return null;
  const s = p.s || [1, 1, 1], c = Math.cos(p.ry || 0), sn = Math.sin(p.ry || 0);
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const x of [k.mn[0], k.mx[0]]) for (const y of [k.mn[1], k.mx[1]]) for (const z of [k.mn[2], k.mx[2]]) {
    const lx = x * s[0], ly = y * s[1], lz = z * s[2];
    const w = [p.x + lx * c + lz * sn, (p.y || 0) + ly, p.z - lx * sn + lz * c];
    for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], w[i]); mx[i] = Math.max(mx[i], w[i]); }
  }
  return { mn, mx };
}
// horizontal gap between a box [mn,mx] and the nearest solid box (0 = touching / inside), only boxes that
// reach the given height
function gapToSolid(mn, mx, yLo) {
  let best = 1e9;
  for (const c of BOXES) {
    if (c.maxY < Math.min(yLo, 1.0)) continue;
    const dx = Math.max(0, c.minX - mx[0], mn[0] - c.maxX), dz = Math.max(0, c.minZ - mx[2], mn[2] - c.maxZ);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}
// how far a box sticks out of the solid boxes (the part outside, measured horizontally)
function outside(mn, mx) {
  // the largest distance from any corner (at body height) to the nearest solid box
  let worst = 0;
  for (const x of [mn[0], mx[0], (mn[0] + mx[0]) / 2]) for (const z of [mn[2], mx[2], (mn[2] + mx[2]) / 2]) {
    let best = 1e9;
    for (const c of BOXES) {
      if (c.maxY < 0.5) continue;
      const dx = Math.max(0, c.minX - x, x - c.maxX), dz = Math.max(0, c.minZ - z, z - c.maxZ);
      best = Math.min(best, Math.hypot(dx, dz));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

console.log('\nPUEBLO 3.0: FAMILIAS Y EDIFICIOS');
const t0 = Date.now(), A = T3.build(BUILDINGS, {}), ms = Date.now() - t0, B = T3.build(BUILDINGS, {});
const fams = new Set(slice.map(b => T3.SLICE_FAMILIES[b[0] + ',' + b[1]]));
check('al menos 6 familias de edificios distintas en la vertical slice', fams.size >= 6, [...fams].join(', '));
check('las familias se distinguen (color, remate, huecos, zócalo)', new Set(Object.values(T3.FAMILIES).map(f => [f.wall[0], f.top, f.plinth, f.door, f.rec].join('|'))).size === Object.keys(T3.FAMILIES).length);
check('siempre el mismo pueblo en cada dispositivo', A.tris === B.tris && A.place.length === B.place.length && A.geo.stucco.pos.every((v, i) => v === B.geo.stucco.pos[i]));
check('se genera rápido y con un presupuesto razonable', ms < 1500 && A.tris < 60000, A.tris + ' triángulos de muros, ' + A.place.length + ' piezas del kit, ' + ms + ' ms');
check('cada pieza colocada existe en el kit', A.place.every(p => KB[p.k]), A.place.filter(p => !KB[p.k]).map(p => p.k).slice(0, 3).join(','));
const used = new Set(A.place.map(p => p.k));
check('variedad real del kit en uso (≥ 20 piezas distintas)', used.size >= 20, used.size + ' piezas: ' + [...used].sort().join(' '));

// walls exactly on the box faces (or inside them, in the reveals)
const inBox = (x, z, b, tol) => Math.abs(x - b[0]) <= b[2] / 2 + tol && Math.abs(z - b[1]) <= b[3] / 2 + tol;
let off = 0, offEx = '';
for (const k of ['stucco', 'rubble']) { const g = A.geo[k]; if (!g) continue;
  for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2];
    if (y > 0.2 && y < 2.0 && !slice.some(b => inBox(x, z, b, 0.006))) { off++; offEx = k + ' ' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2); } } }
check('los muros van sobre las caras de las cajas de colisión', off === 0, off ? off + ' vértices fuera, p. ej. ' + offEx : '0 fuera');
let stray = 0, strayEx = '';
for (const k of T3.MATS) { const g = A.geo[k]; if (!g) continue;
  for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2];
    if (y > 0.12 && y < 2.0 && !slice.some(b => inBox(x, z, b, 0.42))) { stray++; strayEx = k + ' ' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2); } } }
check('nada generado a la altura del cuerpo lejos de un muro', stray === 0, stray ? stray + ', p. ej. ' + strayEx : 'ninguno');
let roofOver = 0;
for (const k of T3.MATS) { const g = A.geo[k]; if (!g) continue;
  for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2];
    const b = slice.find(bb => inBox(x, z, bb, 0.25)); if (b && y > b[4] + 0.351) roofOver++; } }
check('nada por encima de la caja del pretil (azoteas sin coberturas falsas)', roofOver === 0, roofOver + ' vértices');

console.log('\nPUEBLO 3.0: PIEZAS DEL KIT (sin coberturas falsas)');
const bad = [], low = [], over = [];
const THIN = new Set(['lamp_post', 'street_pole', 'orange_tree']);
for (const p of A.place) {
  const wb = worldBox(p); if (!wb) continue;
  const { mn, mx } = wb;
  if (mx[1] <= 0.12) continue;                                   // on the ground
  if (mn[1] < 2.0 && mx[1] > 0.12) {                               // reaches body height
    const out = outside([mn[0], Math.max(mn[1], 0.12), mn[2]], [mx[0], Math.min(mx[1], 2.0), mx[2]]);
    if (out <= 0.45) continue;                                     // flat on a wall / inside a solid box
    if (mx[1] <= 0.66 && out <= 0.66) { low.push(p.k); continue; }  // low decoration against a wall
    bad.push(p.k + ' @' + p.x.toFixed(1) + ',' + p.z.toFixed(1) + ' sale ' + out.toFixed(2) + ' m, alto ' + mx[1].toFixed(2));
  } else {                                                         // above head height
    const g = gapToSolid(mn, mx, mn[1]);
    if (g > 1.2) over.push(p.k + ' ' + g.toFixed(2));
  }
}
check('ninguna pieza parece cobertura sin serlo (a la altura del cuerpo)', bad.length === 0, bad.length ? bad.slice(0, 4).join(' | ') : low.length + ' piezas bajas contra muro (≤ 0,66 m)');
check('lo que vuela sobre la calle (balcones, toldos, faroles, ropa) va pegado a las fachadas', over.length === 0, over.slice(0, 4).join(' | ') || 'todo a ≤ 1,2 m de un muro');

console.log('\nPUEBLO 3.0: SUELO Y FONDO');
const G = T3.ground({ footprints: A.footprints, fronts: A.fronts });
let gHigh = 0; for (const k of T3.MATS) { const g = G.geo[k]; if (!g) continue; for (let i = 1; i < g.pos.length; i += 3) if (g.pos[i] > 0.0901) gHigh++; }
check('el suelo nuevo no levanta nada (≤ 9 cm, bordillos incluidos)', gHigh === 0, gHigh + ' vértices altos; ' + G.tris + ' triángulos');
const BP = [], BK = T3.backdrop({}, BP);
let inside = 0, insideEx = '';
for (const k of T3.MATS) { const g = BK.geo[k]; if (!g) continue;
  for (let i = 0; i < g.pos.length; i += 3) { const x = g.pos[i], y = g.pos[i + 1], z = g.pos[i + 2];
    const lim = y > 4.2 ? 49.5 : 49.99;   // above the 4 m walls, eaves may overhang half a metre
    if (Math.abs(x) < lim && Math.abs(z) < lim) { inside++; insideEx = k + ' ' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2); } } }
check('el pueblo de fuera queda detrás de los muros perimetrales (aleros: ≤ 0,5 m por encima de 4 m)', inside === 0, inside ? inside + ', p. ej. ' + insideEx : BK.tris + ' triángulos, ' + BP.length + ' piezas');
let bpBad = [];
for (const p of BP) { const wb = worldBox(p); if (!wb) continue; const { mn, mx } = wb;
  if (mx[1] > 0.12 && mn[1] < 2.0 && Math.max(Math.abs(mn[0]), Math.abs(mx[0])) < 50 - 0.62 && Math.max(Math.abs(mn[2]), Math.abs(mx[2])) < 50 - 0.62) bpBad.push(p.k); }
check('las piezas del pueblo de fuera no invaden la zona de juego', bpBad.length === 0, bpBad.slice(0, 5).join(','));

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
