/* SNIPER DUEL — CASA ATLAS 2.0 (02-11-2026, owner: «amplía la CASA ATLAS original que ya me gusta: duplica sus módulos,
   reutiliza sus materiales y conéctalos… un complejo residencial con rutas, flanqueos y líneas de visión»).

   Four copies of the original CASA ATLAS flat (assets/maps/casa_atlas/casa_atlas.glb + client/casa.js), nothing remade:
   its GLB, its PBR materials and textures, its furniture and its collision boxes, placed 2 × 2 round a central patio.

            x −21.3 ………………………………………………………… +21.3                 A  as it is            (NW)
     z −16.4  ┌──┬────────────┬──┬────────────┬──┐               B  mirrored (x)        (NE)
              │W │  A (spawn) │al│  B         │E │               C  mirrored (z)        (SW)
              │  │   balcony  │le│   balcony  │  │               D  turned 180°         (SE, spawn)
              │co├────────────┤y ├────────────┤co│
              │rr│  PATIO  (5 m between the balcony rails, 42 m long)  │
              │id├────────────┤  ├────────────┤rr│     the layout is symmetric through the centre (A ↔ D, B ↔ C):
              │or│   balcony  │  │   balcony  │id│     both players get exactly the same map
              │  │  C         │  │  D (spawn) │or│
     z +16.4  └──┴────────────┴──┴────────────┴──┘
   Every flat keeps its rooms and furniture; three openings join it to the rest:
   · its dining-room window becomes a door to the ALLEY between the flats (interior route: rooms → dining room → alley →
     dining room; 2.3 m wide. Not the kitchen's: between its island and the counter there are only 0.85 m)
   · its study window becomes a door to the side CORRIDOR (flank route; each spawn room has three ways out)
   · two gaps in the balcony rail lead down to the PATIO (open route, the long sniper lines: 40 m along the patio, 32 m
     along the alley and the corridors), with low walls and planters every 5–9 m
   Removed: the window's sill, glass and frame (their triangles and their boxes: no invisible walls, no holes), the rail
   bars where the gaps are, and the pot plants standing in the new doors.

   Pure data and maths (Node and browser): the boxes (movement + bullets, the server gets them through
   tools/export-map.js), the spawns, the walkable grid, and build(), which merges the 4 copies of each GLB mesh into one
   (same materials: no texture is loaded twice; ~38 draw calls, like one flat). */
(function (root) {
'use strict';
const CX = 10.49, CZ = 9.58;           // module centres: alley 3.4 m (between the flats' east walls), patio 5 m (between the rails)
const XW = 19.28, XO = 21.28;          // the side corridors: from the flats' outer wall to the boundary wall (2 m)
const ZN = 16.37;                      // north / south boundary (the flats' outer wall face)
const MODS = [                          // sx, sz: mirror (−1) on that axis; t: where the flat's origin goes
  { id: 'A', sx: 1, sz: 1, t: [-CX, -CZ] },
  { id: 'B', sx: -1, sz: 1, t: [CX, -CZ] },
  { id: 'C', sx: 1, sz: -1, t: [-CX, CZ] },
  { id: 'D', sx: -1, sz: -1, t: [CX, CZ] },
];
// in each flat (its own coordinates): every triangle with ALL its vertices inside one of these goes
const CUTS = [
  { n: 'dining_door', a: [8.55, -0.05, 2.105], b: [8.85, 2.405, 4.495] },      // sill, glass and frame of the dining-room window
  { n: 'dining_plant', a: [7.55, -0.05, 4.2], b: [8.35, 0.75, 4.85] },          // the pot plant at its end
  { n: 'study_door', a: [-8.85, -0.05, -0.445], b: [-8.55, 2.455, 1.945] },    // the same in the study (west) window
  { n: 'study_plant', a: [-8.5, -0.05, 0.75], b: [-7.8, 0.65, 1.4] },          // the pot plant in front of it
  { n: 'rail_bars', a: [-8.7, 0.1, 6.9], b: [8.7, 1.2, 7.1] },                 // the rail's two long bars (posts stay)
];
// their boxes in client/casa.js
const DROP = ['wall_x_8.7_3.3_0', 'glass_e_s', 'wall_x_-8.7_0.75_0', 'glass_w', 'balcony_front_player_boundary', 'rail_front_tall'];
// the rail again, with two gaps in front of the balcony doors (between its posts: 1.64 m clear)
const RAIL = [[-8.65, -3.27], [-1.63, 3.53], [5.17, 8.65]];


/* ---------------- boxes ---------------- */
// a box of the flat moved to module M (mirrors swap the ends)
function place(M, a, b) {
  const x0 = a[0] * M.sx + M.t[0], x1 = b[0] * M.sx + M.t[0], z0 = a[2] * M.sz + M.t[1], z1 = b[2] * M.sz + M.t[1];
  return { a: [Math.min(x0, x1), a[1], Math.min(z0, z1)], b: [Math.max(x0, x1), b[1], Math.max(z0, z1)] };
}
// boxes of the new parts (world): s solid (bullets hit it) with its surface f; v what it looks like (build)
function extras() {
  const E = [], add = (n, a, b, s, f, v) => E.push({ n, a, b, s: s ? 1 : 0, f: f || '', v });
  const H = 3.12;
  // boundary: the two side walls and the ends of the corridors and the alley (the flats close the rest)
  add('boundary_w', [-XO - 0.2, 0, -ZN - 0.2], [-XO, H, ZN + 0.2], 1, 'plaster', 'wall');
  add('boundary_e', [XO, 0, -ZN - 0.2], [XO + 0.2, H, ZN + 0.2], 1, 'plaster', 'wall');
  for (const s of [-1, 1]) {
    const z0 = s < 0 ? -ZN - 0.2 : ZN, z1 = s < 0 ? -ZN : ZN + 0.2, k = s < 0 ? 'n' : 's';
    add('boundary_' + k + '_w', [-XO, 0, z0], [-XW, H, z1], 1, 'plaster', 'wall');
    add('boundary_' + k + '_alley', [-1.79, 0, z0], [1.79, H, z1], 1, 'plaster', 'wall');
    add('boundary_' + k + '_e', [XW, 0, z0], [XO, H, z1], 1, 'plaster', 'wall');
  }
  // patio cover (symmetric through the centre). Low walls 1.05 m: cover crouching, you shoot over them standing.
  // Planters 1.1 m (the shrub inside the box). Every 5–9 m along the 42 m patio; the middle of the alley stays open.
  const wall = (n, cx, cz, lx, lz) => add(n, [cx - lx / 2, 0, cz - lz / 2], [cx + lx / 2, 1.05, cz + lz / 2], 1, 'plaster', 'lowwall');
  const pot = (n, cx, cz, l) => add(n, [cx - l / 2, 0, cz - l / 2], [cx + l / 2, 1.1, cz + l / 2], 1, 'concrete', 'planter');
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'w' : 'e';
    pot('planter_' + k + '_cross_n', s * 2.75, -s * 1.55, 1.0);    // round the crossing of the alley and the patio
    pot('planter_' + k + '_cross_s', s * 2.75, s * 1.55, 1.0);
    wall('lowwall_' + k + '_mid', s * 8.6, s * 0.35, 2.6, 0.32);   // across the middle of each half
    pot('planter_' + k + '_far_n', s * 13.6, -s * 1.5, 1.1);
    pot('planter_' + k + '_far_s', s * 15.4, s * 1.45, 1.1);
    wall('lowwall_' + k + '_end', s * 18.4, -s * 0.2, 0.32, 2.2);  // at the corridor's mouth
    // the corridor: two buttresses against the boundary wall (1.6 m stay clear) and the alley: two planters at its sides
    for (const zz of [-8.2, 8.2]) add('buttress_' + k + (zz < 0 ? '_n' : '_s'), [s < 0 ? -XO : XO - 0.4, 0, zz - 0.45], [s < 0 ? -XO + 0.4 : XO, 1.6, zz + 0.45], 1, 'plaster', 'wall');
    pot('planter_alley_' + k, s * 1.1, s * 9.6, 0.9);            // between the dining-room door and the kitchen window
  }
  return E;
}
// the rail of a flat: movement only (bullets go through it, as in CASA ATLAS), 1.16 m and the 3.3 m one (no climbing)
function railBoxes(M) {
  const out = [];
  for (const [x0, x1] of RAIL) {
    const lo = Math.min(x0, x1) - (x0 === -8.65 ? 0.15 : 0), hi = Math.max(x0, x1) + (x1 === 8.65 ? 0.15 : 0);
    out.push(Object.assign({ n: 'rail_' + M.id + '_' + x0, s: 0, f: 'plaster' }, place(M, [lo, 0, 6.96], [hi, 1.16, 7.08])));
    out.push(Object.assign({ n: 'railtall_' + M.id + '_' + x0, s: 0, f: '' }, place(M, [lo, 0, 6.96], [hi, 3.3, 7.08])));
  }
  return out;
}
// all boxes of CASA ATLAS 2.0, in the same format as client/casa.js: { n, a, b, s, f }
function boxes(casa) {
  const out = [];
  for (const M of MODS) {
    for (const bx of casa.boxes) {
      if (DROP.includes(bx.n)) continue;
      out.push(Object.assign({ n: M.id + '_' + bx.n, s: bx.s, f: bx.f }, place(M, bx.a, bx.b)));
    }
    out.push(...railBoxes(M));
  }
  for (const e of extras()) out.push({ n: e.n, a: e.a, b: e.b, s: e.s, f: e.f });
  return out;
}
// the two spawns: the study of A and of D (as in CASA ATLAS, turned with their flat). 37 m apart, walls in between.
function yawOf(M, yaw) {
  const dx = -Math.sin(yaw) * M.sx, dz = -Math.cos(yaw) * M.sz;
  return Math.atan2(-dx, -dz);
}
function spawns(casa) {
  const s = casa.spawns[0], r = v => Math.round(v * 1000) / 1000;
  return [MODS[0], MODS[3]].map((M, i) => ({ team: i ? 'B' : 'A', x: r(s.x * M.sx + M.t[0]), z: r(s.z * M.sz + M.t[1]), yaw: r(yawOf(M, s.yaw)) }));
}
// rooms of each flat (for the tests and the bots): the CASA ATLAS zones moved to each module, plus the new spaces
function zones(casa) {
  const out = [];
  for (const M of MODS) for (const z of casa.zones) {
    const p = place(M, [z.bounds[0], 0, z.bounds[1]], [z.bounds[2], 0, z.bounds[3]]);
    out.push({ name: M.id + '_' + z.name, bounds: [p.a[0], p.a[2], p.b[0], p.b[2]] });
  }
  out.push({ name: 'PATIO', bounds: [-XW, -2.5, XW, 2.5] }, { name: 'CALLEJON', bounds: [-1.7, -ZN, 1.7, ZN] },
    { name: 'PASILLO_O', bounds: [-XO, -ZN, -XW, ZN] }, { name: 'PASILLO_E', bounds: [XW, -ZN, XO, ZN] });
  return out;
}

/* ---------------- walkable grid (spawns and bots) ----------------
   Same rule as CASA ATLAS (0.25 m points, 0.4 m clear of anything at body height, linked to the 8 neighbours when the
   line between them is clear), with the boxes in 2 m buckets. Only the big connected part is kept: the few pockets the
   flat already had (a balcony corner behind its bench, a corner of the bathroom) are no place to spawn in. */
function navGrid(cols, step, standH, rad) {
  const R = rad || 0.4;   // clearance from the boxes (the tests ask 0.5: every route through doors of 1 m or more)
  const body = cols.filter(c => c.maxY > step && c.minY < standH), B = 2, NB = 64, bk = new Map();
  const bkey = (i, j) => (i + NB) * 1024 + (j + NB);
  for (const c of body) for (let i = Math.floor((c.minX - R) / B); i <= Math.floor((c.maxX + R) / B); i++)
    for (let j = Math.floor((c.minZ - R) / B); j <= Math.floor((c.maxZ + R) / B); j++) { const k = bkey(i, j); if (!bk.has(k)) bk.set(k, []); bk.get(k).push(c); }
  const blk = (x, z, r) => { const l = bk.get(bkey(Math.floor(x / B), Math.floor(z / B))); if (!l) return false;
    for (const c of l) if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true; return false; };
  const G = 0.25, NX = Math.round(2 * XO / G), NZ = Math.round(2 * ZN / G), cell = new Int32Array((NX + 1) * (NZ + 1)).fill(-1), all = [];
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
    const X = +(-XO + i * G).toFixed(2), Z = +(-ZN + j * G).toFixed(2);
    if (!blk(X, Z, R)) { cell[i * (NZ + 1) + j] = all.length; all.push({ x: X, z: Z, i, j, n: [] }); } }
  for (const nd of all) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const i = nd.i + di, j = nd.j + dj; if (i < 0 || j < 0 || i > NX || j > NZ) continue;
    const k = cell[i * (NZ + 1) + j]; if (k < 0) continue;
    let ok = true; for (let t = 0.25; t < 1; t += 0.25) if (blk(nd.x + di * G * t, nd.z + dj * G * t, R)) { ok = false; break; }
    if (ok) nd.n.push(k);
  }
  // the biggest connected part, renumbered
  const comp = new Int32Array(all.length).fill(-1), size = [];
  for (let s = 0; s < all.length; s++) { if (comp[s] >= 0) continue; const c = size.length, q = [s]; comp[s] = c; let m = 0;
    while (q.length) { const k = q.pop(); m++; for (const j of all[k].n) if (comp[j] < 0) { comp[j] = c; q.push(j); } } size.push(m); }
  const big = size.indexOf(Math.max(...size)), re = new Int32Array(all.length).fill(-1), nav = [];
  for (let k = 0; k < all.length; k++) if (comp[k] === big) { re[k] = nav.length; nav.push(all[k]); }
  return nav.map(nd => ({ x: nd.x, z: nd.z, n: nd.n.map(j => re[j]) }));
}

/* ---------------- the model (THREE passed in) ----------------
   src: the loaded CASA ATLAS scene (casa_atlas.glb, already prepared by the page). Each of its meshes becomes ONE mesh
   with the 4 flats in it (cut where the openings are; mirrored flats with their triangles turned back the right way),
   with the same material object: nothing new on the GPU but the vertices. The new parts (boundary, floors, low walls,
   planters, rail bars) are boxes in the flat's own materials, UVs at the flat's scale (1.2 m per texture repeat). */
function build(T, src) {
  const out = new T.Group(); out.name = 'casa_atlas_2';
  const buckets = new Map(), srcMats = {};
  const bucket = (name, mat) => { if (!buckets.has(name)) buckets.set(name, { mat, p: [], n: [], u: [] }); return buckets.get(name); };
  const inCut = (x, y, z) => { for (const c of CUTS) if (x >= c.a[0] && x <= c.b[0] && y >= c.a[1] && y <= c.b[1] && z >= c.a[2] && z <= c.b[2]) return true; return false; };
  const v = new T.Vector3(), nm = new T.Matrix3(), crown = [];
  src.updateMatrixWorld(true);
  src.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry, P = g.attributes.position, Nn = g.attributes.normal, U = g.attributes.uv, I = g.index;
    const n = I ? I.count : P.count, mw = o.matrixWorld; nm.getNormalMatrix(mw);
    srcMats[o.material.name] = o.material;
    const B = bucket(o.name, o.material);
    // the flat's triangles once, in its own coordinates; the cut ones out
    const tri = [];
    for (let i = 0; i + 2 < n; i += 3) {
      const id = [0, 1, 2].map(k => I ? I.getX(i + k) : i + k), w = id.map(k => v.fromBufferAttribute(P, k).applyMatrix4(mw).toArray());
      if (w.every(p => inCut(p[0], p[1], p[2]))) {
        // the pot plant taken out of the study door: its leaves become the shrubs of the planters
        if (o.name === 'details__green_leaf') crown.push(id.map((k, j) => ({ p: w[j], n: Nn ? v.fromBufferAttribute(Nn, k).applyMatrix3(nm).normalize().toArray() : [0, 1, 0] })));
        continue;
      }
      tri.push(id.map((k, j) => ({ p: w[j], n: Nn ? v.fromBufferAttribute(Nn, k).applyMatrix3(nm).normalize().toArray() : [0, 1, 0], u: U ? [U.getX(k), U.getY(k)] : [0, 0] })));
    }
    for (const M of MODS) {
      const flip = M.sx * M.sz < 0;
      for (const t of tri) for (const q of flip ? [t[0], t[2], t[1]] : t) {
        B.p.push(q.p[0] * M.sx + M.t[0], q.p[1], q.p[2] * M.sz + M.t[1]); B.n.push(q.n[0] * M.sx, q.n[1], q.n[2] * M.sz); B.u.push(q.u[0], q.u[1]);
      }
    }
  });
  // new parts: textured boxes, UVs like the flat's (u along the face / 1.2 m, v down from the top: 1 − y / 1.2)
  const boxGeo = (B, a, b, faces) => {
    const k = 1.2, [x0, y0, z0] = a, [x1, y1, z1] = b;
    const quad = (p, nn, uv) => { for (const i of [0, 1, 2, 0, 2, 3]) { B.p.push(...p[i]); B.n.push(...nn); B.u.push(...uv[i]); } };
    const side = (pa, pb, nn) => {   // vertical face from pa to pb (bottom corners, seen from outside: left to right)
      const L = Math.hypot(pb[0] - pa[0], pb[2] - pa[2]) / k;
      quad([[pa[0], y0, pa[2]], [pb[0], y0, pb[2]], [pb[0], y1, pb[2]], [pa[0], y1, pa[2]]], nn, [[0, 1 - y0 / k], [L, 1 - y0 / k], [L, 1 - y1 / k], [0, 1 - y1 / k]]);
    };
    if (faces.includes('s')) {
      side([x0, 0, z1], [x1, 0, z1], [0, 0, 1]); side([x1, 0, z0], [x0, 0, z0], [0, 0, -1]);
      side([x1, 0, z1], [x1, 0, z0], [1, 0, 0]); side([x0, 0, z0], [x0, 0, z1], [-1, 0, 0]);
    }
    if (faces.includes('t')) quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0 / k, z1 / k], [x1 / k, z1 / k], [x1 / k, z0 / k], [x0 / k, z0 / k]]);
  };
  const MB = name => bucket(name, srcMats[{ architecture__wall_plaster: 'sd_apto_wall_plaster', architecture__balcony_stone: 'sd_apto_balcony_stone',
    details__terracotta: 'sd_apto_terracotta', details__green_leaf: 'sd_apto_green_leaf', architecture__metal_dark: 'sd_apto_metal_dark',
    details__trim_white: 'sd_apto_trim_white' }[name]]);
  for (const e of extras()) {
    if (e.v === 'wall') { boxGeo(MB('architecture__wall_plaster'), e.a, e.b, 'st'); continue; }
    if (e.v === 'lowwall') { boxGeo(MB('architecture__wall_plaster'), e.a, [e.b[0], e.b[1] - 0.06, e.b[2]], 's');
      boxGeo(MB('details__trim_white'), [e.a[0] - 0.03, e.b[1] - 0.06, e.a[2] - 0.03], [e.b[0] + 0.03, e.b[1], e.b[2] + 0.03], 'st'); continue; }
    if (e.v === 'planter') {   // stone planter with a white rim, the shrub (the flat's own leaves) fills the top
      const top = 0.7; boxGeo(MB('architecture__balcony_stone'), e.a, [e.b[0], top - 0.05, e.b[2]], 's');
      boxGeo(MB('details__trim_white'), [e.a[0] - 0.02, top - 0.05, e.a[2] - 0.02], [e.b[0] + 0.02, top, e.b[2] + 0.02], 'st');
      if (crown.length) {
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (const t of crown) for (const q of t) { x0 = Math.min(x0, q.p[0]); x1 = Math.max(x1, q.p[0]); y0 = Math.min(y0, q.p[1]); y1 = Math.max(y1, q.p[1]); z0 = Math.min(z0, q.p[2]); z1 = Math.max(z1, q.p[2]); }
        const L = e.b[0] - e.a[0] - 0.08, kx = L / (x1 - x0), kz = (e.b[2] - e.a[2] - 0.08) / (z1 - z0), ky = (e.b[1] - 0.03 - top + 0.06) / (y1 - y0);
        const cx = (e.a[0] + e.b[0]) / 2, cz = (e.a[2] + e.b[2]) / 2, B = MB('details__green_leaf');
        for (const t of crown) for (const q of t) {
          B.p.push(cx + (q.p[0] - (x0 + x1) / 2) * kx, top - 0.06 + (q.p[1] - y0) * ky, cz + (q.p[2] - (z0 + z1) / 2) * kz);
          const nx = q.n[0] / kx, ny = q.n[1] / ky, nz = q.n[2] / kz, l = Math.hypot(nx, ny, nz) || 1; B.n.push(nx / l, ny / l, nz / l); B.u.push(0, 0);
        }
      }
    }
  }
  for (const M of MODS) for (const [x0, x1] of RAIL) for (const [y0, y1] of [[0.17, 0.22], [1.07, 1.13]]) {
    const p = place(M, [x0, y0, 6.96], [x1, y1, 7.04]); boxGeo(MB('architecture__metal_dark'), p.a, p.b, 'st');
  }
  // floors: the patio, the alley and the corridors in the balcony's stone (5 mm under the flats' floors: no flicker)
  const F = MB('architecture__balcony_stone'), y = -0.005;
  for (const [a, b] of [[[-XO, -2.6], [XO, 2.6]], [[-1.79, -ZN], [1.79, ZN]], [[-XO, -ZN], [-XW, ZN]], [[XW, -ZN], [XO, ZN]]])
    boxGeo(F, [a[0], y - 0.3, a[1]], [b[0], y, b[1]], 't');
  for (const [name, B] of buckets) {
    if (!B.p.length || !B.mat) continue;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(B.u, 2)); g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new T.Mesh(g, B.mat); m.name = name; m.matrixAutoUpdate = false; m.updateMatrix(); out.add(m);
  }
  return out;
}

const SDCasa2 = { id: 'CASA_ATLAS_2', CX, CZ, XW, XO, ZN, MODS, CUTS, DROP, RAIL, place, extras, boxes, spawns, zones, navGrid, build };
if (typeof module !== 'undefined' && module.exports) module.exports = SDCasa2; else root.SDCasa2 = SDCasa2;
})(typeof window !== 'undefined' ? window : globalThis);
