/* SNIPER DUEL — BARRIO (04-11-2026, owner: «mapa con torres y garaje», from the material of 04-11). A city street
   between two rows of buildings, with the two Sketchfab pieces the owner sent:
   · «an abandoned garage» (dasy444, Sketchfab Standard): a real-scale ruined garage room (6.3 × 3.6 m, ceiling 2.3 m),
     open on one side. Two of them, one in each row, open onto the street (point symmetry: the second one is the first
     turned 180°). Its collision is ours (walls, roof, the car and the high rubble), drawn by its own model.
   · «street city (7) for games» (dasy444, Sketchfab Standard): blocks of flats, scaled ×3.5 (≈ 43 m), as the skyline
     behind both rows. Never walked on, beyond the boundary: no boxes.
   Everything else is boxes in the game's own textures (brick, concrete, plaster, metal, asphalt, pavement).

            x −28 ……………………………………………………………………………………… +28
     z −20  ┌──────────── back lane (spawn A at its west end) ───────────────────┐
            │ N0  │a│   N1    │ G │    N2    │a│    N3     │a│    N4    │      │   G: garage, open to the street
     z −8.5 ├───── pavement ────────────────────────────────────────────────────┤   a: alleys to the back lane
            │                         STREET (asphalt, 10 m)                    │
            ├───── pavement ────────────────────────────────────────────────────┤
     z +20  └──────────────── back lane (spawn B at its east end) ───────────────┘
   Point-symmetric through the centre: both players get the same map.

   Pure data and maths (Node and browser): boxes (movement + bullets; the server gets them through tools/export-map.js),
   spawns, the walkable grid (the same functions as CASA ATLAS 2.0) and build(), which draws the boxes and places the
   two models. */
(function (root) {
'use strict';
const XO = 28, ZN = 20;                // boundary
const LANE = 17.4;                     // the back lanes: |z| from 17.4 to 20
const ROW = 8.5;                       // the building rows: |z| from 8.5 to 17.4 (pavement 5 → 8.5, street |z| < 5)
const GAR = { t: [-13, -12.2], yaw: -Math.PI / 2 };   // garage A: open side (its +x) towards the street (+z)

// the garage room in its own coordinates (from its meshes): walls, the closed partition, the roof, the pillar, the car and
// the rubble heaps too high to step on. The low rubble (≤ 0.36 m) is walked over.
const GARAGE_LOCAL = [
  { n: 'g_wall_back', a: [-3.14, 0, -1.83], b: [-3.0, 2.34, 1.91], f: 'concrete' },
  { n: 'g_wall_windows', a: [-3.14, 0, -1.83], b: [3.09, 2.34, -1.72], f: 'concrete' },
  { n: 'g_wall_door', a: [-3.14, 0, 1.77], b: [3.09, 2.34, 1.91], f: 'concrete' },
  { n: 'g_partition', a: [-0.74, 0, -1.76], b: [-0.62, 2.34, 1.79], f: 'concrete' },
  { n: 'g_roof', a: [-3.14, 2.28, -1.83], b: [3.14, 2.5, 1.91], f: 'concrete' },
  { n: 'g_pillar', a: [1.62, 0, 1.58], b: [1.77, 2.28, 1.72], f: 'metal' },
  { n: 'g_car', a: [0.91, 0, -0.1], b: [2.32, 0.53, 1.42], f: 'metal' },
  { n: 'g_rubble', a: [-0.62, 0, -1.66], b: [0.86, 0.56, -0.64], f: 'dirt' },
];
// local (x, z) → world, turned by yaw about Y (three.js convention) and moved to t
const turn = (x, z, yaw, t) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [x * c + z * s + t[0], -x * s + z * c + t[1]]; };
function placeBox(a, b, yaw, t) {
  const p = [turn(a[0], a[2], yaw, t), turn(b[0], b[2], yaw, t), turn(a[0], b[2], yaw, t), turn(b[0], a[2], yaw, t)];
  const r = v => Math.round(v * 1000) / 1000;
  return { a: [r(Math.min(...p.map(q => q[0]))), a[1], r(Math.min(...p.map(q => q[1])))], b: [r(Math.max(...p.map(q => q[0]))), b[1], r(Math.max(...p.map(q => q[1])))] };
}
const GARAGES = [{ id: 'A', yaw: GAR.yaw, t: GAR.t }, { id: 'B', yaw: GAR.yaw + Math.PI, t: [-GAR.t[0], -GAR.t[1]] }];

/* ---------------- boxes ----------------  { n, a, b, s (stops bullets), f (surface), v (what it looks like) } */
function boxes() {
  const E = [], add = (n, a, b, s, f, v) => E.push({ n, a, b, s: s ? 1 : 0, f, v });
  // the north half; the south half is the same turned 180° (point symmetry)
  const half = [];
  const h = (n, a, b, f, v) => half.push({ n, a, b, f, v });
  // boundary: the back wall behind the lane and the two ends of the lane (4 m)
  h('bound_back', [-XO, 0, -ZN - 0.3], [XO, 4, -ZN], 'concrete', 'wallc');
  h('bound_lane_w', [-XO - 0.3, 0, -ZN], [-XO, 4, -LANE], 'concrete', 'wallc');
  h('bound_lane_e', [XO, 0, -ZN], [XO + 0.3, 4, -LANE], 'concrete', 'wallc');
  // the street ends: a 3 m site hoarding across each end, half of it on each side of the street (the other half is the
  // south half's): from the north row to the middle
  h('bound_end_w', [-XO - 0.3, 0, -ROW], [-XO, 3, 0], 'metal', 'hoard');
  h('bound_end_e', [XO, 0, -ROW], [XO + 0.3, 3, 0], 'metal', 'hoard');
  // the north row: four buildings and the garage, with three alleys to the back lane (2.6–4 m wide)
  h('bld_N0', [-XO, 0, -LANE], [-24, 7.5, -ROW], 'plaster', 'bplaster');
  h('bld_N1', [-21.4, 0, -LANE], [-15, 9, -ROW], 'plaster', 'bbrick');
  h('bld_N1b', [-15, 0, -LANE], [-11, 6, -15.4], 'plaster', 'bbrick');          // the building the garage is set into (behind it)
  h('bld_N2', [-11, 0, -LANE], [-2.6, 8, -ROW], 'concrete', 'bconcrete');
  h('bld_N3', [1.4, 0, -LANE], [10, 10, -ROW], 'plaster', 'bplaster');
  h('bld_N4', [13.6, 0, -LANE], [24.4, 7, -ROW], 'plaster', 'bbrick');
  h('bld_N5', [26.6, 0, -LANE], [XO, 6, -ROW], 'concrete', 'bconcrete');
  // cover on the street and the pavement (north half; the south half mirrors them)
  h('cont_1', [-19.5, 0, -3.9], [-13.5, 2.6, -1.5], 'metal', 'container');     // shipping container along the street
  h('barrier_1', [-7.5, 0, 0.9], [-4.5, 1.05, 1.5], 'concrete', 'barrier');   // jersey barrier (cover crouching)
  h('barrier_2', [-24.5, 0, 1.8], [-21.5, 1.05, 2.4], 'concrete', 'barrier');
  h('car_1', [2, 0, -3.6], [6.2, 1.4, -1.8], 'metal', 'wreck');               // burnt-out car
  h('bin_1', [-9, 0, -7.4], [-7.2, 1.3, -6.2], 'metal', 'bin');               // skip on the pavement
  h('crates_1', [17, 0, -7.6], [18.6, 1.2, -6.2], 'wood', 'crate');
  h('kiosk', [-1.5, 0, -0.6], [1.5, 2.4, 0.6], 'metal', 'kiosk');             // the news kiosk in the middle (both halves: symmetric)
  // the back lane: crates and a skip (the flank route keeps 1.6 m clear)
  h('lane_crates', [-8, 0, -20], [-6.6, 1.2, -18.8], 'wood', 'crate');
  h('lane_bin', [6, 0, -20], [7.8, 1.3, -18.9], 'metal', 'bin');
  for (const q of half) {
    add(q.n + '_n', q.a, q.b, 1, q.f, q.v);
    if (q.n === 'kiosk') continue;   // already symmetric
    add(q.n + '_s', [-q.b[0], q.a[1], -q.b[2]], [-q.a[0], q.b[1], -q.a[2]], 1, q.f, q.v);
  }
  // the two garages (their boxes, drawn by the model)
  for (const G of GARAGES) for (const g of GARAGE_LOCAL) E.push(Object.assign({ n: g.n + '_' + G.id, s: 1, f: g.f, v: 'garage' }, placeBox(g.a, g.b, G.yaw, G.t)));
  return E;
}
// spawns: the outer ends of the back lanes, looking along them (walls and two rows of buildings in between)
function spawns() { return [{ team: 'A', x: -26.5, z: -18.7, yaw: -Math.PI / 2 }, { team: 'B', x: 26.5, z: 18.7, yaw: Math.PI / 2 }]; }
function zones() {
  return [{ name: 'CALLE', bounds: [-XO, -5, XO, 5] }, { name: 'ACERA_N', bounds: [-XO, -ROW, XO, -5] }, { name: 'ACERA_S', bounds: [-XO, 5, XO, ROW] },
    { name: 'CALLEJON_N', bounds: [-XO, -ZN, XO, -LANE] }, { name: 'CALLEJON_S', bounds: [-XO, LANE, XO, ZN] },
    { name: 'GARAJE_A', bounds: [-14.8, -14.6, -11.3, -9.4] }, { name: 'GARAJE_B', bounds: [11.3, 9.4, 14.8, 14.6] }];
}

/* ---------------- the model (THREE passed in) ----------------
   M: materials by kind (from the page: its own textures). garage: the loaded garage scene. towers: the loaded street7
   scene. Boxes are drawn with UVs in metres (the material's texture repeat sets its size). */
function build(T, M, garage, towers, opts) {
  opts = opts || {};
  const out = new T.Group(); out.name = 'barrio';
  const buckets = new Map(), bucket = k => { if (!buckets.has(k)) buckets.set(k, { p: [], n: [], u: [] }); return buckets.get(k); };
  const quad = (B, p, nn, uv) => { for (const i of [0, 1, 2, 0, 2, 3]) { B.p.push(...p[i]); B.n.push(...nn); B.u.push(...uv[i]); } };
  const box = (k, a, b, faces) => {
    const B = bucket(k), [x0, y0, z0] = a, [x1, y1, z1] = b, f = faces || 'stb';
    const side = (pa, pb, nn) => { const L = Math.hypot(pb[0] - pa[0], pb[2] - pa[2]), u0 = (pa[0] + pa[2]);
      quad(B, [[pa[0], y0, pa[2]], [pb[0], y0, pb[2]], [pb[0], y1, pb[2]], [pa[0], y1, pa[2]]], nn, [[u0, y0], [u0 + L, y0], [u0 + L, y1], [u0, y1]]); };
    if (f.includes('s')) { side([x0, 0, z1], [x1, 0, z1], [0, 0, 1]); side([x1, 0, z0], [x0, 0, z0], [0, 0, -1]); side([x1, 0, z1], [x1, 0, z0], [1, 0, 0]); side([x0, 0, z0], [x0, 0, z1], [-1, 0, 0]); }
    if (f.includes('t')) quad(B, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]]);
    if (f.includes('b')) quad(B, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
  };
  // ground: street, pavements (kerb 12 cm), lanes, alleys and the garage fronts
  box('asphalt', [-XO, -0.3, -5], [XO, -0.005, 5], 't');
  for (const s of [-1, 1]) {
    const z0 = s < 0 ? -ROW : 5, z1 = s < 0 ? -5 : ROW; box('pavement', [-XO, -0.3, z0], [XO, 0.0, z1], 't');
    const l0 = s < 0 ? -ZN : LANE, l1 = s < 0 ? -LANE : ZN; box('lane', [-XO, -0.3, l0], [XO, -0.005, l1], 't');
    box('lane', [-XO, -0.3, s < 0 ? -LANE : ROW], [XO, -0.01, s < 0 ? -ROW : LANE], 't');   // under the buildings and in the alleys
  }
  for (const e of boxes()) {
    if (e.v === 'garage') continue;
    const k = { wallc: 'concrete', hoard: 'hoard', bplaster: 'plaster', bbrick: 'brick', bconcrete: 'concrete', container: 'container', barrier: 'barrier', wreck: 'wreck', bin: 'bin', crate: 'crate', kiosk: 'kiosk' }[e.v] || 'concrete';
    box(k, e.a, e.b, /^b/.test(e.v) ? 'st' : 'stb');
    // buildings: a darker plinth (1 m) and a cornice; the kiosk a roof slab; the container ribs
    if (/^b/.test(e.v)) { box('plinth', [e.a[0] - 0.02, 0, e.a[2] - 0.02], [e.b[0] + 0.02, 1, e.b[2] + 0.02], 's'); box('cornice', [e.a[0] - 0.15, e.b[1] - 0.35, e.a[2] - 0.15], [e.b[0] + 0.15, e.b[1], e.b[2] + 0.15], 'stb'); }
    if (e.v === 'kiosk') box('kioskroof', [e.a[0] - 0.3, e.b[1], e.a[2] - 0.3], [e.b[0] + 0.3, e.b[1] + 0.12, e.b[2] + 0.3], 'stb');
  }
  for (const [k, B] of buckets) {
    if (!B.p.length || !M[k]) continue;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(B.u, 2));
    g.computeBoundingSphere(); const m = new T.Mesh(g, M[k]); m.name = 'barrio_' + k; m.matrixAutoUpdate = false; m.updateMatrix(); out.add(m);
  }
  // the garages: its model as it is (ground at 0), turned and placed
  if (garage) for (const G of GARAGES) { const g = garage.clone(true); g.name = 'garaje_' + G.id; g.rotation.y = G.yaw; g.position.set(G.t[0], 0, G.t[1]); g.updateMatrixWorld(true); out.add(g); }
  // the skyline: the blocks of flats ×3.5 behind each row, beyond the boundary (fog fades them)
  // (opts.oneSkyline: only the north one, behind the row you face from the street most; ~86 000 triangles each)
  if (towers) for (const [x, z, yaw] of (opts.oneSkyline ? [[-40, -112, 0]] : [[-40, -112, 0], [40, 112, Math.PI]])) {
    const t = towers.clone(true); t.name = 'torres'; t.scale.setScalar(3.5); t.rotation.y = yaw; t.position.set(x, -0.2, z); t.updateMatrixWorld(true); out.add(t);
  }
  return out;
}

const C2 = typeof module !== 'undefined' && module.exports ? require('./casa2.js') : root.SDCasa2;
const G = C2.make({ CX: 0, CZ: 0, XW: XO, XO, ZN, CUTS: [], DROP: [], RAIL: null }, 2);
const SDBarrio = { id: 'BARRIO', XO, ZN, LANE, ROW, GARAGES, GARAGE_LOCAL, boxes, spawns, zones, build, navGrid: G.navGrid, thin: G.thin,
  garage: 'assets/maps/barrio/garaje.glb', towers: 'assets/maps/barrio/torres.glb' };
if (typeof module !== 'undefined' && module.exports) module.exports = SDBarrio; else root.SDBarrio = SDBarrio;
})(typeof window !== 'undefined' ? window : globalThis);
