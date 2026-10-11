/* SNIPER DUEL — PUEBLO 3.0: a Mediterranean town on top of the same collision boxes.

   build(buildings, opt) → { geo: { material: {pos, nrm, uv, col, idx} }, place: [kit placements], signs: [...], tris }
     Six families of buildings (whitewashed house, stone house, terracotta house with balconies, shop,
     workshop, townhouse), each with its own proportions, openings, surrounds, plinth, eaves, colours and
     narrative details; the openings and ornaments are pieces of the Blender kit (assets/kit.glb, drawn by
     client/kit3d.js), the walls are generated here with real recesses and baked shading.
   ground(opt)     → the streets, pavements, plaza and the earth of the slice
   backdrop(opt)   → the town outside the perimeter walls (houses with tiled roofs, a bell tower, trees)
   props(opt)      → plaza and street furniture that replaces old visuals inside their boxes

   GAMEPLAY IS UNTOUCHED: walls lie on the faces of the collision boxes; openings go at most REVEAL into
   them; nothing is added at body height away from a wall except inside existing boxes; what sticks out
   over the street is above 2 m (balconies, awnings, lanterns, laundry) or below 0.12 m (kerbs, drains),
   and low decoration against a wall stays under 0.65 m (a crouching player is 1.2 m). test/town3.test.js
   checks all of this, and the false-cover check in test/cover.test.js checks the drawn result.

   Pure (no Three.js). Game frame: x right, y up, z towards the viewer. Colours are sRGB hex. */
(function (root) {
'use strict';

const REVEAL = 0.22;
const MATS = ['stucco', 'stone', 'rubble', 'brick', 'azulejo', 'roofterr', 'rooftiles', 'setts', 'slabs', 'asphalt', 'earth', 'concrete', 'dark', 'hill', 'herring', 'pebbles',
  'p0plaza', 'p0cobble', 'p0side', 'p0patch'];   // P0 ground pack (assets/3d/imports/…p0_ground_pack_v1): only with opt.p0
const hex = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function rng(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.uni = (a0, b0) => a0 + (b0 - a0) * f();
  f.pick = arr => arr[Math.floor(f() * arr.length) % arr.length];
  f.int = (a0, b0) => a0 + Math.floor(f() * (b0 - a0 + 1));
  return f;
}
// smooth value noise (stains, ground patches): same everywhere, no randomness per call
function vnoise(x, y, seed) {
  const h = (i, j) => { let n = (i * 374761393 + j * 668265263 + (seed | 0) * 1442695041) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/* ----------------------------------------------------------------- geometry builder (merged meshes) */
function createBuilder() { const B = {}; for (const k of MATS) B[k] = { pos: [], nrm: [], uv: [], col: [], idx: [] }; return B; }
function planarUV(p, n) {
  const ax = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : (Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2);
  if (ax === 1) return [p[0], p[2]];
  if (ax === 0) return [p[2] * (n[0] > 0 ? -1 : 1), p[1]];
  return [p[0] * (n[2] < 0 ? -1 : 1), p[1]];
}
// a quad facing `want`; col: one colour or four (one per corner)
function quad(B, m, pts, want, col) {
  const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
  let cols = Array.isArray(col[0]) ? col : [col, col, col, col];
  if (dot(n, want) < 0) { pts = [pts[3], pts[2], pts[1], pts[0]]; cols = [cols[3], cols[2], cols[1], cols[0]]; }
  const nn = unit(want), g = B[m], i0 = g.pos.length / 3;
  for (let k = 0; k < 4; k++) {
    const p = pts[k], c = cols[k];
    g.pos.push(p[0], p[1], p[2]); g.nrm.push(nn[0], nn[1], nn[2]);
    const uv = B.uvFn ? B.uvFn(p, nn) : planarUV(p, nn); g.uv.push(uv[0], uv[1]);
    g.col.push(c[0], c[1], c[2]);
  }
  g.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
}
function box(B, m, x0, y0, z0, x1, y1, z1, col, skip) {
  skip = skip || '';
  const P = (x, y, z) => [x, y, z];
  if (skip.indexOf('-x') < 0) quad(B, m, [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], [-1, 0, 0], col);
  if (skip.indexOf('+x') < 0) quad(B, m, [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], [1, 0, 0], col);
  if (skip.indexOf('-y') < 0) quad(B, m, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], [0, -1, 0], col);
  if (skip.indexOf('+y') < 0) quad(B, m, [P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0)], [0, 1, 0], col);
  if (skip.indexOf('-z') < 0) quad(B, m, [P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)], [0, 0, -1], col);
  if (skip.indexOf('+z') < 0) quad(B, m, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], [0, 0, 1], col);
}
function flat(B, m, x0, z0, x1, z1, y, col) {
  quad(B, m, [[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]], [0, 1, 0], col);
}
function pack(B) {
  const out = {}; let tris = 0;
  for (const k of MATS) {
    const g = B[k]; if (!g.idx.length) continue;
    out[k] = { pos: new Float32Array(g.pos), nrm: new Float32Array(g.nrm), uv: new Float32Array(g.uv), col: new Float32Array(g.col),
      idx: g.pos.length / 3 > 65535 ? new Uint32Array(g.idx) : new Uint16Array(g.idx) };
    tris += g.idx.length / 3;
  }
  return { geo: out, tris };
}

/* ----------------------------------------------------------------- a facade
   O: bottom-left corner on the outer face, R: along the wall, N: outwards; L × H metres */
function facade(B, O, R, N, L, H) {
  const F = { O, R, N, L, H, ry: Math.atan2(N[0], N[2]) };
  F.p = (u, v, out) => add(add(O, mul(R, u)), add([0, v, 0], mul(N, out || 0)));
  F.rect = (m, u0, u1, v0, v1, out, col) => quad(B, m, [F.p(u0, v0, out), F.p(u1, v0, out), F.p(u1, v1, out), F.p(u0, v1, out)], N, col);
  F.slab = (m, u0, u1, v0, v1, o0, o1, col, sides) => {
    const c = [F.p(u0, v0, o0), F.p(u1, v0, o0), F.p(u1, v1, o0), F.p(u0, v1, o0), F.p(u0, v0, o1), F.p(u1, v0, o1), F.p(u1, v1, o1), F.p(u0, v1, o1)];
    quad(B, m, [c[4], c[5], c[6], c[7]], N, col);
    if (sides === false) return;
    quad(B, m, [c[0], c[3], c[7], c[4]], mul(R, -1), col);
    quad(B, m, [c[1], c[2], c[6], c[5]], R, col);
    quad(B, m, [c[3], c[2], c[6], c[7]], [0, 1, 0], col);
    quad(B, m, [c[0], c[1], c[5], c[4]], [0, -1, 0], col);
  };
  // a kit piece on this face: u along the wall, v up, out from the face
  F.kit = (list, k, u, v, out, extra) => {
    const p = F.p(u, v, out || 0);
    list.push(Object.assign({ k, x: p[0], y: p[1], z: p[2], ry: F.ry }, extra || {}));
  };
  return F;
}
/* the wall of a facade with rectangular openings; bands: [[v0, v1, material, colour]] from the bottom up;
   shading baked in the vertex colours: darker at the foot, under the eave, in the reveals, plus slow stains */
function wallFace(B, F, holes, bands, seed, eaveShade) {
  const { L, H } = F;
  const us = new Set([0, L]), vs = new Set([0, H]);
  for (const h of holes) { us.add(h[0]); us.add(h[1]); vs.add(h[2]); vs.add(h[3]); }
  for (const b of bands) { vs.add(b[0]); vs.add(b[1]); }
  for (let u = 1.5; u < L; u += 1.5) us.add(u);          // cells ≤ 1.5 m: room for the stains
  for (let v = 1.2; v < H; v += 1.2) vs.add(v);
  const U = [...us].sort((a, b) => a - b), V = [...vs].sort((a, b) => a - b);
  const inside = (u, v) => holes.some(h => h[0] < u && u < h[1] && h[2] < v && v < h[3]);
  const shadeAt = (u, v, base) => {
    let k = 0.78 + 0.22 * Math.min(1, v / 1.3);                              // ground contact
    if (eaveShade) k *= 1 - 0.18 * Math.max(0, 1 - (H - v) / 0.9);          // under the eave
    const s = vnoise(u * 0.45 + seed, v * 0.35, seed) - 0.5, s2 = vnoise(u * 1.3, v * 0.25 + seed, seed + 7) - 0.5;
    k *= 1 + s * 0.09 + s2 * 0.05;
    return mul(base, k);
  };
  const bandAt = v => bands.find(b => b[0] <= v && v < b[1]) || bands[bands.length - 1];
  for (let j = 0; j < V.length - 1; j++) {
    const v0 = V[j], v1 = V[j + 1], vm = (v0 + v1) / 2, bd = bandAt(vm);
    for (let i = 0; i < U.length - 1; i++) {
      const u0 = U[i], u1 = U[i + 1];
      if (inside((u0 + u1) / 2, vm)) continue;
      F.rect(bd[2], u0, u1, v0, v1, 0, [shadeAt(u0, v0, bd[3]), shadeAt(u1, v0, bd[3]), shadeAt(u1, v1, bd[3]), shadeAt(u0, v1, bd[3])]);
    }
  }
  const d = -REVEAL;
  for (const [u0, u1, v0, v1] of holes) {
    const bd = bandAt(Math.min(H - 0.01, (v0 + v1) / 2)), c = bd[3];
    const cf = shadeAt(u0, v0 + 0.5, c), cb = mul(cf, 0.62);
    const C = [cf, cf, cb, cb];
    quad(B, bd[2], [F.p(u0, v0, 0), F.p(u0, v1, 0), F.p(u0, v1, d), F.p(u0, v0, d)], F.R, C);
    quad(B, bd[2], [F.p(u1, v0, 0), F.p(u1, v1, 0), F.p(u1, v1, d), F.p(u1, v0, d)], mul(F.R, -1), C);
    quad(B, bd[2], [F.p(u0, v1, 0), F.p(u1, v1, 0), F.p(u1, v1, d), F.p(u0, v1, d)], [0, -1, 0], [mul(cf, 0.8), mul(cf, 0.8), mul(cb, 0.85), mul(cb, 0.85)]);
    if (v0 > 0.01) quad(B, bd[2], [F.p(u0, v0, 0), F.p(u1, v0, 0), F.p(u1, v0, d), F.p(u0, v0, d)], [0, 1, 0], C);
  }
}

/* ----------------------------------------------------------------- the six families */
const OPEN = {   // opening sizes [width, height] of the kit pieces
  win_std: [1.0, 1.4], win_std_cur: [1.0, 1.4], win_tall: [1.0, 2.2], win_small: [0.6, 0.6], win_arch: [1.0, 1.8],
  door_arch: [1.4, 2.7], door_panel: [1.2, 2.4], door_garage: [2.8, 2.6], shopfront: [2.6, 2.6],
};
const SHUT_GREEN = [0x3f7a4e, 0x4d7f3c, 0x356b52], SHUT_BLUE = [0x2f6a9a, 0x3b78a8, 0x2a5a80], SHUT_BROWN = [0x6e4a2c, 0x7a5434, 0x5e4026];
const FAMILIES = {
  // whitewashed house: irregular openings, painted plinth and window bands, green or blue shutters, tile eave
  encalada: { name: 'Casa encalada', wall: [0xf4f0e6, 0xf1ebdf, 0xf6f2ea], band: [0x3f6f9e, 0xcf9b3e, 0x7f8a7a], shut: SHUT_GREEN.concat(SHUT_BLUE),
    door: 'door_panel', win: ['win_std', 'win_std_cur'], rec: 'band', plinth: 'paint', top: 'eave', bay: 2.6, irregular: 0.35, extras: ['bougain', 'pots', 'planters', 'climber'] },
  // stone house: rubble ground floor, ochre render above, arched door, natural wood shutters
  piedra: { name: 'Casa de piedra', wall: [0xdcb98a, 0xd4ae7c], shut: SHUT_BROWN, door: 'door_arch', win: ['win_std', 'win_small'], rec: 'stone',
    plinth: 'rubble', top: 'eave', bay: 2.9, irregular: 0.25, extras: ['lantern', 'climber', 'agave', 'pots'] },
  // terracotta house: warm render, stone surrounds, balconies on the upper floors, cane blinds
  terracota: { name: 'Casa terracota', wall: [0xc9734c, 0xcf7f58, 0xc26a46], shut: [0x5b7a3a, 0x4c6f8a, 0x7a5a3a], door: 'door_panel', win: ['win_std'], tall: true, rec: 'stone',
    plinth: 'stone', top: 'cornice', bay: 2.5, irregular: 0.0, extras: ['balconies', 'persianas', 'planters', 'laundry', 'lantern'] },
  // shop: pale yellow, shopfronts with awnings and a sign, glazed tiles, blinds upstairs
  comercio: { name: 'Comercio', wall: [0xebd394, 0xe8cb84], band: [0xf4efe4], shut: SHUT_GREEN, door: 'door_panel', win: ['win_std'], rec: 'band', plinth: 'azulejo',
    top: 'eave', bay: 2.6, irregular: 0.1, shop: true, awning: [0xb0302a, 0x2f6b4a, 0x2d5a8a], extras: ['persianas', 'pots', 'bench', 'lantern', 'ac'] },
  // workshop: weathered render with bare brick, roller shutter, high small windows, pipes and boxes
  taller: { name: 'Taller', wall: [0xb9aca0, 0xb0a596], shut: SHUT_BROWN, door: 'door_panel', win: ['win_small'], rec: 'none', plinth: 'concrete', top: 'coping',
    bay: 3.2, irregular: 0.3, garage: [0x4f6b52, 0x3c5a78, 0x8a3b2a], extras: ['ac', 'meter', 'brick', 'pipes'] },
  // townhouse: salmon render, stone quoins and plinth, a long balcony on the main floor, cornice
  senorial: { name: 'Casa señorial', wall: [0xe8bfae, 0xe4c7b8], shut: [0x3e5f4a, 0x2f4f6a], door: 'door_panel', win: ['win_std'], tall: true, rec: 'stone', plinth: 'stone',
    quoins: true, top: 'cornice', bay: 2.4, irregular: 0.0, extras: ['balcony_long', 'lantern', 'reja', 'plaque'] },
};
const SHOP_NAMES = ['ULTRAMARINOS LA ROSA', 'PANADERÍA SOL', 'BAR EL FARO', 'MERCERÍA ALBA', 'TALLER MARÍN', 'FERRETERÍA CRUZ'];

function building(B, b, fam, opt, place, signs) {
  const [bx, bz, w, d, h] = b;
  const R = rng(Math.round(bx * 7919 + bz * 104729 + w * 31 + d * 17) >>> 0);
  const F0 = FAMILIES[fam];
  const wall = hex(R.pick(F0.wall));
  const bandCol = F0.band ? R.pick(F0.band) : 0xf4efe4;
  const shut = R.pick(F0.shut);
  const x0 = bx - w / 2, x1 = bx + w / 2, z0 = bz - d / 2, z1 = bz + d / 2;
  const floors = h < 5.8 ? 1 : Math.max(1, Math.round(h / 3.0)), fh = h / floors;
  const attic = floors === 1 && h >= 4.9;   // a tall single floor: small 'cámara' windows above
  const faces = [
    ['+z', facade(B, [x0, 0, z1], [1, 0, 0], [0, 0, 1], w, h)],
    ['-z', facade(B, [x1, 0, z0], [-1, 0, 0], [0, 0, -1], w, h)],
    ['+x', facade(B, [x1, 0, z1], [0, 0, -1], [1, 0, 0], d, h)],
    ['-x', facade(B, [x0, 0, z0], [0, 0, 1], [-1, 0, 0], d, h)],
  ];
  // the front faces the street or the plaza (opt.front overrides); the back faces the town wall
  const toC = opt.frontDir ? opt.frontDir : unit([-bx, 0, -bz]);
  const ranked = faces.slice().sort((a, b2) => dot(b2[1].N, toC) - dot(a[1].N, toC));
  const front = ranked[0][0], back = ranked[3][0];
  const toMid = unit([-bx, 0, -bz]);
  const side1 = [ranked[1], ranked[2]].sort((a, b2) => dot(b2[1].N, toMid) - dot(a[1].N, toMid))[0][0];
  const plinthH = F0.plinth === 'rubble' ? Math.min(fh, 3.0) : F0.plinth === 'azulejo' ? 0.6 : F0.plinth === 'concrete' ? 0.5 : F0.plinth === 'paint' ? 0.85 : 0.9;
  const plinthMat = { rubble: 'rubble', azulejo: 'azulejo', concrete: 'concrete', paint: 'stucco', stone: 'stone' }[F0.plinth];
  const plinthCol = F0.plinth === 'paint' ? hex(bandCol) : F0.plinth === 'rubble' ? [1, 1, 1] : F0.plinth === 'azulejo' ? [1, 1, 1] : hex(0xe6dccb);
    for (const [key, F] of faces) {
    const L = F.L, holes = [], kits = [];
    const isFront = key === front, isBack = key === back;
    if (isFront && opt.fronts) opt.fronts.push({ c: F.p(L / 2, 0, 0), N: F.N, R: F.R, L, fam });
    for (let k = 0, nW = Math.floor(L / (isBack ? 1.4 : 2.6)); k < nW; k++) F.kit(place, 'weeds', R.uni(0.3, L - 0.3), 0, R.uni(0.08, 0.2), { ry: R.uni(0, 6.28) });
    const bayW = F0.bay * (isBack ? 1.25 : 1);
    const nb = Math.max(1, Math.floor((L - 0.6) / bayW)), step = L / nb;
    const bays = []; for (let i = 0; i < nb; i++) bays.push((i + 0.5) * step + (F0.irregular ? R.uni(-0.35, 0.35) * F0.irregular * step : 0));
    // ground floor
    const gf = [];   // [type, u]
    const shopFace = F0.shop && (isFront || (key === side1 && L >= 7));
    if (shopFace) {   // shops: one or two shopfronts and the door to the flats
      if (L < 7) gf.push(['shopfront', L * 0.37], [F0.door, L * 0.83]);
      else {
        const n2 = Math.max(2, Math.floor((L - 0.6) / 3.4)), st = L / n2;
        for (let i = 0; i < n2; i++) gf.push([i === n2 - 1 && n2 > 2 ? F0.door : 'shopfront', (i + 0.5) * st]);
      }
    } else if (isFront) {
      const mid = Math.floor(nb / 2);
      if (F0.garage && L >= 6) {
        for (let i = 0; i < nb; i++) gf.push([i === mid ? 'door_garage' : (i === mid + 1 || (nb > 2 && i === 0) ? F0.door : 'win_small_hi'), bays[i]]);
      } else for (let i = 0; i < nb; i++) gf.push([i === mid ? F0.door : (R() < 0.85 ? R.pick(F0.win) : null), bays[i]]);
    } else {
      for (let i = 0; i < nb; i++) {
        const r = R();
        if (!isBack && L >= 9 && r < 0.18) gf.push([F0.garage ? 'door_panel' : F0.door, bays[i]]);
        else if (r < (isBack ? 0.45 : 0.78)) gf.push([F0.garage ? 'win_small_hi' : R.pick(F0.win), bays[i]]);
      }
    }
    // keep big openings apart: drop anything that would overlap
    const used = [];
    const fits = (u0, u1) => u0 > 0.45 && u1 < L - 0.45 && used.every(([a, b2]) => u1 < a - 0.35 || u0 > b2 + 0.35);
    const opening = (type, u, v0) => {
      const [ow, oh] = OPEN[type === 'win_small_hi' ? 'win_small' : type];
      const u0 = u - ow / 2, u1 = u + ow / 2;
      if (!fits(u0, u1)) return null;
      if (v0 + oh > h - 0.35) return null;
      used.push([u0, u1]);
      holes.push([u0, u1, v0, v0 + oh]);
      return [u0, u1, v0, v0 + oh];
    };
    const deco = [];
    for (const [type, u] of gf) {
      if (!type) continue;
      const v0 = type === 'win_small_hi' ? Math.min(2.0, h - 1.1) : type.startsWith('win') ? 1.0 : 0;
      const hb = opening(type, u, v0); if (!hb) continue;
      deco.push({ type: type === 'win_small_hi' ? 'win_small' : type, u, v0, fl: 0, hb });
    }
    if (attic && !isBack) for (const o of deco.slice()) {
      const v0 = Math.max(o.hb[3] + (o.type === 'shopfront' ? 0.95 : 0.55), h - 1.35), [ow, oh] = OPEN.win_small;
      if (v0 + oh > h - 0.4) continue;
      holes.push([o.u - ow / 2, o.u + ow / 2, v0, v0 + oh]); deco.push({ type: 'win_small', u: o.u, v0, fl: 1, hb: [o.u - ow / 2, o.u + ow / 2, v0, v0 + oh] });
    }
    // upper floors: same bays (a facade reads as a grid), with family rules
    for (let fl = 1; fl < floors; fl++) {
      const vb = fl * fh;
      const usedFl = [];
      for (let i = 0; i < nb; i++) {
        const u = bays[i];
        if (F0.irregular && R() < F0.irregular * 0.5) continue;
        if (isBack && R() < 0.35) continue;
        let type = R.pick(F0.win);
        if (F0.tall && (fl === 1 || R() < 0.4) && fh >= 2.8 && !isBack) type = 'win_tall';
        if (fam === 'piedra' && fl === floors - 1 && R() < 0.5) type = 'win_small';
        const [ow, oh] = OPEN[type];
        const v0 = type === 'win_tall' ? vb + 0.12 : type === 'win_small' ? vb + 1.1 : vb + 0.95;
        if (v0 + oh > Math.min(h - 0.38, vb + fh - 0.25)) continue;
        if (u - ow / 2 < 0.45 || u + ow / 2 > L - 0.45 || usedFl.some(([a, b2]) => u + ow / 2 > a - 0.3 && u - ow / 2 < b2 + 0.3)) continue;
        usedFl.push([u - ow / 2, u + ow / 2]);
        holes.push([u - ow / 2, u + ow / 2, v0, v0 + oh]);
        deco.push({ type, u, v0, fl, hb: [u - ow / 2, u + ow / 2, v0, v0 + oh] });
      }
    }
    // the wall: plinth band + render
    const bands = [];
    if (F0.plinth === 'rubble') bands.push([0, plinthH, 'rubble', [1, 1, 1]], [plinthH, h, 'stucco', wall]);
    else bands.push([0, h, 'stucco', wall]);
    wallFace(B, F, holes, bands, bx * 0.37 + bz * 0.11 + L, F0.top === 'eave');
    // plinth on the face (broken at the doors)
    if (F0.plinth !== 'rubble') {
      const doors = deco.filter(x => x.v0 < 0.01).map(x => [x.hb[0], x.hb[1]]).sort((a, b2) => a[0] - b2[0]);
      let u = 0;
      for (const [a, b2] of doors.concat([[L, L]])) {
        if (a - u > 0.05) {
          if (plinthMat === 'stucco') F.rect('stucco', u, a, 0, plinthH, 0.004, [mul(plinthCol, 0.82), mul(plinthCol, 0.82), plinthCol, plinthCol]);
          else F.slab(plinthMat, u, a, 0, plinthH, 0, plinthMat === 'azulejo' ? 0.015 : 0.05, plinthMat === 'concrete' ? hex(0xd2cabd) : plinthCol);
          if (plinthMat === 'azulejo') F.slab('stone', u, a, plinthH, plinthH + 0.05, 0, 0.035, hex(0xe8e0d0));
        }
        u = b2;
      }
    }
    // quoins (townhouse) and a band at each floor
    if (F0.quoins) {
      let v = plinthH, k = 0;
      while (v + 0.34 < h - 0.4) { const ln = k % 2 ? 0.32 : 0.52; F.slab('stone', 0, ln, v, v + 0.32, 0, 0.035, hex(0xe9dfca)); F.slab('stone', L - ln, L, v, v + 0.32, 0, 0.035, hex(0xe9dfca)); v += 0.36; k++; }
    }
    if (fam === 'senorial' || fam === 'terracota') for (let fl = 1; fl < floors; fl++) F.slab('stone', 0, L, fl * fh - 0.14, fl * fh - 0.02, 0, 0.05, hex(0xe6dcc6));
    // workshop: bare brick where the render fell off
    if (F0.extras.includes('brick')) {
      for (let k = 0; k < 3; k++) {
        const pu = R.uni(0.6, L - 1.6), pv = R.uni(0.6, h - 1.4), pw = R.uni(0.6, 1.3), ph = R.uni(0.4, 0.9);
        if (!holes.some(hh => pu < hh[1] + 0.2 && pu + pw > hh[0] - 0.2 && pv < hh[3] + 0.2 && pv + ph > hh[2] - 0.2)) F.rect('brick', pu, pu + pw, pv, pv + ph, 0.003, [1, 1, 1]);
      }
    }
    // the kit pieces in and around the openings
    for (const o of deco) {
      const [u0, u1, v0, v1] = o.hb, u = o.u;
      const t = o.type;
      if (t === 'shopfront') {
        F.kit(kits, 'shopfront', u, v0);
        const aw = R.pick(F0.awning);
        F.kit(kits, 'awning', u, v1 + 0.32, 0, { c: aw });
        const name = SHOP_NAMES[(signs.length + Math.floor(bx * 3 + bz)) % SHOP_NAMES.length];
        signs.push({ text: name, p: F.p(u, v1 + 0.42, 0), ry: F.ry, c: aw });
        if (F0.extras.includes('pots')) F.kit(kits, 'pot_big', u1 + 0.42, 0, 0.32);
        continue;
      }
      if (t === 'door_garage') {
        F.kit(kits, 'door_garage', u, v0, 0, { c: R.pick(F0.garage) });
        signs.push({ text: 'TALLER MARÍN', p: F.p(u, v1 + 0.28, 0), ry: F.ry, c: 0x3a4a5a });
        continue;
      }
      if (t.startsWith('door')) {
        F.kit(kits, t, u, v0, 0, { c: shut });
        if (F0.extras.includes('lantern')) F.kit(kits, 'lantern', u1 + 0.45 < L - 0.3 ? u1 + 0.45 : u0 - 0.45, 2.85);
        if (F0.extras.includes('climber') && v1 + 1.0 < h - 0.5 && R() < 0.7) F.kit(kits, 'climber', u, v1 + 0.45);
        if (F0.extras.includes('bougain') && R() < 0.8) { const bu = u1 + 0.9 < L - 0.5 ? u1 + 0.75 : u0 - 0.75; if (bu > 0.6 && v1 + 1.4 < h) F.kit(kits, 'bougain', bu, 0, 0, { s: [1, Math.min(1.15, (h - 0.4) / 3.6), 1] }); }
        if (F0.extras.includes('pots') && R() < 0.8) F.kit(kits, R() < 0.5 ? 'pot_big' : 'pot_small', u0 - 0.45 > 0.4 ? u0 - 0.45 : u1 + 0.45, 0, 0.3);
        if (F0.extras.includes('agave') && R() < 0.8) F.kit(kits, 'pot_agave', u1 + 0.42 < L - 0.4 ? u1 + 0.42 : u0 - 0.42, 0, 0.3);
        if (F0.extras.includes('meter')) F.kit(kits, 'meter_box', u1 + 0.6 < L - 0.4 ? u1 + 0.55 : u0 - 0.55, 0.35);
        continue;
      }
      // windows
      F.kit(kits, t, u, v0);
      const narrow = t === 'win_small';
      if (!narrow) {
        if (F0.rec === 'stone' && (t === 'win_std' || t === 'win_std_cur' || t === 'win_tall')) F.kit(kits, t === 'win_tall' ? 'rec_stone_tall' : 'rec_stone', u, v0);
        if (F0.rec === 'band' && (t === 'win_std' || t === 'win_std_cur' || t === 'win_tall')) F.kit(kits, t === 'win_tall' ? 'rec_band_tall' : 'rec_band', u, v0, 0, { c: bandCol });
        const shutterOk = u0 - 0.58 > 0.05 && u1 + 0.58 < L - 0.05 && !deco.some(x => x !== o && Math.abs(x.v0 - v0) < 2 && (Math.abs(x.hb[0] - u1) < 0.62 || Math.abs(x.hb[1] - u0) < 0.62));
        const blinds = F0.extras.includes('persianas') && (o.fl > 0 || R() < 0.3) && R() < 0.7;
        if (blinds) F.kit(kits, 'persiana', u, v1 + 0.04, 0, { c: shut, s: [1, R.uni(0.5, Math.min(1.25, (v1 - v0) * 0.9)), 1] });
        else if (shutterOk && o.fl + (F0.irregular ? 1 : 0) > 0 || shutterOk && R() < 0.6) {
          const sh = t === 'win_tall' ? 'shutter_tall' : 'shutter';
          F.kit(kits, sh, u0 - 0.285 - (F0.rec === 'stone' ? 0.13 : F0.rec === 'band' ? 0.15 : 0), v0, 0, { c: shut });
          F.kit(kits, sh, u1 + 0.285 + (F0.rec === 'stone' ? 0.13 : F0.rec === 'band' ? 0.15 : 0), v0, 0, { c: shut });
        }
        if (o.fl === 0 && (F0.extras.includes('reja') || (t !== 'win_tall' && R() < 0.35))) F.kit(kits, 'reja', u, v0 - 0.05);
        if (t === 'win_tall' && o.fl > 0) {
          if (F0.extras.includes('balcony_long') && o.fl === 1) F.kit(kits, 'balcony', u, v0 - 0.12);
          else F.kit(kits, 'balcony', u, v0 - 0.12);
          if (F0.extras.includes('planters') && R() < 0.5) F.kit(kits, 'pot_small', u + 0.55, v0 - 0.12, 0.25);
        } else if (F0.extras.includes('planters') && o.fl > 0 && R() < 0.4) F.kit(kits, 'planter', u, v0 + 0.012);
      }
    }
    // long balcony on the townhouse's main floor: joins neighbouring tall windows
    // details on the wall
    if (F0.extras.includes('laundry') && !isFront && floors > 1 && L >= 5) {
      const v = fh + 2.75;
      if (v < h - 0.4 && R() < 0.8) F.kit(kits, 'laundry', L / 2, v);
    }
    if (F0.extras.includes('ac') && !isFront && floors > 1 && R() < 0.8) {
      const u = R.uni(0.8, L - 1.6), v = R.uni(fh + 0.3, Math.max(fh + 0.4, h - 1.2));
      if (!holes.some(hh => u - 0.45 < hh[1] && u + 0.45 > hh[0] && v - 0.1 < hh[3] && v + 0.65 > hh[2])) F.kit(kits, 'ac_unit', u, v);
    }
    if (F0.extras.includes('ac') && isFront && F0.garage) {
      const u = L - 0.9, v = h - 1.1;
      if (!holes.some(hh => u - 0.45 < hh[1] && u + 0.45 > hh[0] && v - 0.1 < hh[3] && v + 0.65 > hh[2])) F.kit(kits, 'ac_unit', u, v);
    }
    if (F0.extras.includes('plaque') && isFront) F.kit(kits, 'plaque', 0.6, 2.9);
    // downpipes at one end of the long faces
    if ((L >= 7 || F0.extras.includes('pipes')) && (key === '+z' || key === '-z' || F0.extras.includes('pipes')) && R() < 0.85) {
      const u = R() < 0.5 ? 0.16 : L - 0.16;
      for (let v = 0.5; v < h - 0.55; v += 1) F.kit(kits, 'pipe', u, v, 0, { s: [1, Math.min(1, h - 0.55 - v), 1] });
      F.kit(kits, 'pipe_shoe', u, 0); F.kit(kits, 'pipe_head', u, h);
    }
    // top of the wall: eave tiles, cornice or plain coping (the parapet above is the old cap box)
    if (F0.top === 'eave' || F0.top === 'cornice') {
      const n = Math.max(1, Math.round(L)), sx = (L + 0.3) / n;
      for (let i = 0; i < n; i++) F.kit(kits, F0.top, -0.15 + (i + 0.5) * sx, h, 0, { s: [sx, 1, 1], c: F0.top === 'eave' ? 0xffffff : undefined });
    }
    for (const kk of kits) place.push(kk);
  }
  // the parapet: the old cap box (w + 0.4 × 0.35 × d + 0.4, already solid for bullets), in the wall's
  // colour with a stone coping; the flat roof inside is a terrace of terracotta tiles
  const m = 0.2, top = h + 0.35;
  const parCol = F0.top === 'coping' ? hex(0xc9c0b2) : mul(wall, 0.97);
  box(B, 'stucco', x0 - m, h, z0 - m, x1 + m, top - 0.07, z1 + m, parCol, '+y');
  box(B, 'stone', x0 - m - 0.02, top - 0.07, z0 - m - 0.02, x1 + m + 0.02, top, z1 + m + 0.02, hex(0xe2d8c4), '-y+y');
  const lip = 0.24;
  for (const [a0, b0, a1, b1] of [[x0 - m, z0 - m, x1 + m, z0 - m + lip], [x0 - m, z1 + m - lip, x1 + m, z1 + m], [x0 - m, z0 - m + lip, x0 - m + lip, z1 + m - lip], [x1 + m - lip, z0 - m + lip, x1 + m, z1 + m - lip]])
    flat(B, 'stone', a0 - (a0 === x0 - m ? 0.02 : 0), b0 - (b0 === z0 - m ? 0.02 : 0), a1 + (a1 === x1 + m ? 0.02 : 0), b1 + (b1 === z1 + m ? 0.02 : 0), top, hex(0xe2d8c4));
  flat(B, 'roofterr', x0 - m + lip, z0 - m + lip, x1 + m - lip, z1 + m - lip, top - 0.001, hex(0xd8a080));
  return [x0, x1, z0, z1];
}

/* ----------------------------------------------------------------- the ground of the slice */
const KERB = 0.2;
function ground(opt) {
  const B = createBuilder();
  const S = opt.slice || { x0: -49.5, x1: 49.5, z0: -11, z1: 49.5 };
  const foot = opt.footprints || [];
  // opt.p0: the P0 ground pack's materials (plaza, cobbles, pavements, worn patches) instead of the old ones; same layout
  // (the zone tints stay as they were: measured in the game, the pack's textures burn to white under this sun
  // with a white vertex colour)
  const p0 = !!opt.p0;
  const M_SET = p0 ? 'p0cobble' : 'setts', M_PLAZA = p0 ? 'p0plaza' : 'slabs', M_SIDE = p0 ? 'p0side' : 'slabs', M_FORE = p0 ? 'p0patch' : 'herring';
  const C_SET = hex(0xcbc5bb), C_SLAB = hex(0xd6cab6);
  // north street: irregular cobbles with a stone gutter down the middle
  flat(B, M_SET, -4.5, 3.5 + KERB, -0.22, S.z1, 0.012, C_SET);
  flat(B, M_SET, 0.22, 3.5 + KERB, 4.5, S.z1, 0.012, C_SET);
  for (let z = 3.5 + KERB; z < S.z1; z += 1.2) flat(B, 'slabs', -0.22, z, 0.22, Math.min(S.z1, z + 1.18), 0.006, hex(0xbdb3a3));
  // the cross street: old asphalt, repaired; a painted crossing at the plaza
  flat(B, 'asphalt', S.x0, -3.5, -11 - KERB, 3.5, 0.012, [1, 1, 1]);
  flat(B, 'asphalt', 11 + KERB, -3.5, S.x1, 3.5, 0.012, [1, 1, 1]);
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) { const z = -3.0 + k * 1.2; flat(B, 'concrete', sx * (11 + KERB + 1.0), z, sx * (11 + KERB + 3.2), z + 0.5, 0.016, hex(0xd9d4c8)); }
  // plaza: limestone slabs, a band of cobbles round the edge and round the fountain
  const P = 11;
  flat(B, M_PLAZA, -P + 0.9, -P + 0.9, P - 0.9, P - 0.9, 0.016, C_SLAB);
  for (const [a0, b0, a1, b1] of [[-P, -P, P, -P + 0.9], [-P, P - 0.9, P, P], [-P, -P + 0.9, -P + 0.9, P - 0.9], [P - 0.9, -P + 0.9, P, P - 0.9]]) flat(B, M_SET, a0, b0, a1, b1, 0.018, hex(0xcfc6b8));
  for (const [a0, b0, a1, b1] of [[-4.2, -4.2, 4.2, -3.2], [-4.2, 3.2, 4.2, 4.2], [-4.2, -3.2, -3.2, 3.2], [3.2, -3.2, 4.2, 3.2]]) flat(B, M_SET, a0, b0, a1, b1, 0.02, hex(0xc4b8a4));
  // dark basalt bands dividing the plaza into squares (and framing the fountain)
  const DK = hex(0x6a635a);
  for (const c of [-7.6, 7.6]) { flat(B, M_PLAZA, c - 0.2, -P + 0.9, c + 0.2, P - 0.9, 0.019, DK); flat(B, M_PLAZA, -P + 0.9, c - 0.2, P - 0.9, c + 0.2, 0.0195, DK); }
  for (const c of [-4.4, 4.4]) { flat(B, M_PLAZA, c - 0.15, -4.4, c + 0.15, 4.4, 0.021, DK); flat(B, M_PLAZA, -4.4, c - 0.15, 4.4, c + 0.15, 0.0215, DK); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {   // pebble rosettes in the four corner squares
    const cx = sx * 8.95, cz = sz * 8.95, r = 1.05;
    const pts = [[cx - r, 0.022, cz - r], [cx + r, 0.022, cz - r], [cx + r, 0.022, cz + r], [cx - r, 0.022, cz + r]];
    B.uvFn = p => [(p[0] - cx + r) / (2 * r), (p[2] - cz + r) / (2 * r)];
    quad(B, 'pebbles', pts, [0, 1, 0], [1, 1, 1]);
    B.uvFn = null;
  }
  // kerbs (9 cm, like PUEBLO 2.0: no step for the feet) along the north street and the cross street
  const kz = (a, b2, x) => { if (b2 - a > 0.1) box(B, 'stone', x - KERB / 2, 0, a, x + KERB / 2, 0.09, b2, hex(0xd9cfbd), '-y'); };
  const kx = (a, b2, z) => { if (b2 - a > 0.1) box(B, 'stone', a, 0, z - KERB / 2, b2, 0.09, z + KERB / 2, hex(0xd9cfbd), '-y'); };
  for (const x of [-4.5 - KERB / 2, 4.5 + KERB / 2]) kz(P + KERB, S.z1, x);
  for (const z of [-3.5 - KERB / 2, 3.5 + KERB / 2]) { kx(S.x0, -P - KERB, z); kx(P + KERB, S.x1, z); }
  kx(-P - KERB, -4.5 - KERB, P + KERB / 2); kx(4.5 + KERB, P + KERB, P + KERB / 2);
  kz(-P, -3.5 - KERB, -P - KERB / 2); kz(3.5 + KERB, P, -P - KERB / 2); kz(-P, -3.5 - KERB, P + KERB / 2); kz(3.5 + KERB, P, P + KERB / 2);
  // drains: grates every 12 m by the kerbs, a manhole on the cross street
  for (let z = 16; z < S.z1; z += 12) for (const x of [-4.1, 4.1]) { flat(B, 'dark', x - 0.2, z - 0.35, x + 0.2, z + 0.35, 0.02, hex(0x2a2622)); for (let k = 0; k < 6; k++) flat(B, 'concrete', x - 0.2, z - 0.33 + k * 0.12, x + 0.2, z - 0.29 + k * 0.12, 0.024, hex(0x5a554e)); }
  for (const x of [-24, 30]) { const c = [x, 0]; for (let k = 0; k < 10; k++) { const a0 = k * Math.PI / 5, a1 = (k + 1) * Math.PI / 5; quad(B, 'concrete', [[c[0], 0.02, c[1]], [c[0] + 0.4 * Math.cos(a0), 0.02, c[1] + 0.4 * Math.sin(a0)], [c[0] + 0.4 * Math.cos(a1), 0.02, c[1] + 0.4 * Math.sin(a1)], [c[0], 0.02, c[1]]], [0, 1, 0], hex(0x6a645a)); } }
  // pavements round the buildings: slabs with a kerb edge
  for (const [x0, x1, z0, z1] of foot) {
    const p = 1.5;
    flat(B, M_SIDE, x0 - p, z0 - p, x1 + p, z1 + p, 0.022, hex(0xcdc2ae));
    kx(x0 - p, x1 + p, z0 - p); kx(x0 - p, x1 + p, z1 + p); kz(z0 - p + KERB / 2, z1 + p - KERB / 2, x0 - p); kz(z0 - p + KERB / 2, z1 + p - KERB / 2, x1 + p);
  }
  // forecourts in front of the buildings that face open ground: herringbone brick or a pebble rosette
  for (const fr of opt.fronts || []) {
    const depth = 3.2, wdt = Math.min(fr.L * 0.7, 7);
    const c0 = add(fr.c, mul(fr.N, 1.5)), c1 = add(c0, mul(fr.N, depth));
    const mid = mul(add(c0, c1), 0.5);
    if ((Math.abs(mid[0]) <= 4.5 + depth && mid[2] > 0) || Math.abs(mid[2]) <= 3.5 + depth || (Math.abs(mid[0]) <= P + depth && Math.abs(mid[2]) <= P + depth)) continue;
    const a = add(c0, mul(fr.R, -wdt / 2)), b2 = add(c0, mul(fr.R, wdt / 2)), cc = add(c1, mul(fr.R, wdt / 2)), dd = add(c1, mul(fr.R, -wdt / 2));
    const peb = fr.fam === 'encalada' || fr.fam === 'piedra';
    if (peb) {   // one rosette over a square in the middle, herringbone around it
      const sq = Math.min(depth, wdt) - 0.2, m0 = add(mid, mul(fr.R, -sq / 2)), m1 = add(mid, mul(fr.R, sq / 2));
      const p0 = add(m0, mul(fr.N, -sq / 2)), p1 = add(m1, mul(fr.N, -sq / 2)), p2 = add(m1, mul(fr.N, sq / 2)), p3 = add(m0, mul(fr.N, sq / 2));
      const pts = [p0, p1, p2, p3].map(p => [p[0], 0.03, p[2]]);
      B.uvFn = p => { const dx = sub(p, pts[0]); return [dot(dx, fr.R) / sq, dot(dx, fr.N) / sq]; };
      quad(B, 'pebbles', pts, [0, 1, 0], [1, 1, 1]);
      B.uvFn = null;
    }
    quad(B, M_FORE, [a, b2, cc, dd].map(p => [p[0], 0.026, p[2]]), [0, 1, 0], hex(0xd8c8b8));
    for (const [p, q] of [[a, dd], [b2, cc], [dd, cc]]) {   // stone edging
      const e = sub(q, p), L2 = Math.hypot(e[0], e[2]), u = [e[0] / L2, 0, e[2] / L2], nn = [-u[2], 0, u[0]];
      const P0 = add(p, mul(nn, -0.1)), P1 = add(q, mul(nn, -0.1)), P2 = add(q, mul(nn, 0.1)), P3 = add(p, mul(nn, 0.1));
      quad(B, 'stone', [P0, P1, P2, P3].map(v => [v[0], 0.035, v[2]]), [0, 1, 0], hex(0xd9cfbd));
    }
  }
  // the rest of the slice: compacted earth with slow patches (a grid with baked colour variation)
  const cell = 2;
  const inRoad = (x, z) => (Math.abs(x) <= 4.5 && z > 0) || (Math.abs(z) <= 3.5) || (Math.abs(x) <= P && Math.abs(z) <= P);
  for (let x = S.x0; x < S.x1 - 0.01; x += cell) for (let z = Math.max(S.z0, 0); z < S.z1 - 0.01; z += cell) {
    const xa = x, xb = Math.min(S.x1, x + cell), za = z, zb = Math.min(S.z1, z + cell);
    if (inRoad((xa + xb) / 2, (za + zb) / 2)) continue;
    const c = (px, pz) => { const n = vnoise(px * 0.08, pz * 0.08, 3), n2 = vnoise(px * 0.3, pz * 0.3, 5); const k = 0.86 + n * 0.22 + (n2 - 0.5) * 0.08; return mix([k, k * 0.98, k * 0.95], [0.78, 0.8, 0.62], Math.max(0, n2 - 0.72) * 1.6); };
    quad(B, 'earth', [[xa, 0.008, za], [xa, 0.008, zb], [xb, 0.008, zb], [xb, 0.008, za]], [0, 1, 0], [c(xa, za), c(xa, zb), c(xb, zb), c(xb, za)]);
    if (opt.place && vnoise(xa * 0.21, za * 0.21, 9) > 0.62) opt.place.push({ k: 'weeds', x: xa + 1, y: 0, z: za + 1, ry: xa * 1.3 + za, s: [1.4, 1, 1.4] });
  }
  return pack(B);
}

/* ----------------------------------------------------------------- the town outside the walls
   Rows of houses whose facades rise from the perimeter walls (their ground floor IS the wall), tiled
   roofs, a bell tower, trees; nobody can go there (beyond the 4 m walls). */
function backdrop(opt, place) {
  const B = createBuilder();
  const R = rng(opt.seed || 77);
  const fams = Object.keys(FAMILIES);
  const sides = opt.sides || [
    // [origin, along, out (towards the town), length, which part]
    { O: [-50, 0, 50], R: [1, 0, 0], N: [0, 0, -1], L: 100 },     // north wall, inner face z = 50
    { O: [-50, 0, 0], R: [0, 0, 1], N: [1, 0, 0], L: 50 },         // west wall (north half), inner face x = -50
    { O: [50, 0, 50], R: [0, 0, -1], N: [-1, 0, 0], L: 50 },       // east wall (north half)
  ];
  for (const sd of sides) {
    let u = 0;
    while (u < sd.L - 0.5) {
      const wdt = Math.min(sd.L - u, R.uni(5.5, 9.5));
      const fam = R.pick(fams), F0 = FAMILIES[fam];
      const H = R.pick([7.2, 8.5, 10, 11.5, 13]);
      const depth = R.uni(7, 10);
      // facade frame: origin at this house's left end, facing the town
      const O = add(sd.O, mul(sd.R, u));
      // the facade faces N (into the town); R for the facade must be along with N × up = R → our F expects
      // R to the right when looking at the face: looking along -N, right is cross(-N, up)
      const Rf = unit(cross([0, 1, 0], sd.N));
      const flip = dot(Rf, sd.R) < 0;
      const Ff = facade(B, flip ? add(O, mul(sd.R, wdt)) : O, Rf, sd.N, wdt, H);
      const wall = hex(R.pick(F0.wall)), shut = R.pick(F0.shut);
      const holes = [], kits = [];
      const floors = Math.max(2, Math.round(H / 3.0)), fh = H / floors;
      const nb = Math.max(1, Math.floor(wdt / 2.6)), step = wdt / nb;
      for (let fl = 0; fl < floors; fl++) for (let i = 0; i < nb; i++) {
        const uc = (i + 0.5) * step;
        if (fl === 0) {   // ground floor = the 4 m perimeter wall: doors and barred windows, an archway sometimes
          const r = R();
          if (r < 0.25 && wdt > 4) { holes.push([uc - 0.7, uc + 0.7, 0, 2.7]); kits.push(['door_arch', uc, 0, { c: shut }]); }
          else if (r < 0.5) { holes.push([uc - 0.6, uc + 0.6, 0, 2.4]); kits.push(['door_panel', uc, 0, { c: shut }]); }
          else if (r < 0.85) { holes.push([uc - 0.5, uc + 0.5, 1.0, 2.4]); kits.push(['win_std', uc, 1.0], ['reja', uc, 0.95]); }
          continue;
        }
        if (R() < 0.15) continue;
        const v0 = fl * fh + 0.95, tall = fam === 'terracota' || fam === 'senorial';
        if (tall && fh >= 2.8) { holes.push([uc - 0.5, uc + 0.5, fl * fh + 0.12, fl * fh + 2.32]); kits.push(['win_tall', uc, fl * fh + 0.12], ['balcony', uc, fl * fh], ['shutter_tall', uc - 0.8, fl * fh + 0.12, { c: shut }], ['shutter_tall', uc + 0.8, fl * fh + 0.12, { c: shut }]); }
        else if (v0 + 1.4 < H - 0.4) { holes.push([uc - 0.5, uc + 0.5, v0, v0 + 1.4]); kits.push([R() < 0.5 ? 'win_std' : 'win_std_cur', uc, v0]);
          if (R() < 0.5) kits.push(['shutter', uc - 0.8, v0, { c: shut }], ['shutter', uc + 0.8, v0, { c: shut }]); else kits.push(['persiana', uc, v0 + 1.44, { c: shut, s: [1, R.uni(0.4, 1.1), 1] }]);
          if (R() < 0.3) kits.push(['planter', uc, v0 + 0.012]); }
      }
      const valid = holes.filter(h => h[0] > 0.3 && h[1] < wdt - 0.3);
      wallFace(B, Ff, valid, [[0, H, 'stucco', wall]], u * 0.7 + sd.L, true);
      const LO = { win_std: 'win_lo', win_std_cur: 'win_lo', win_tall: 'win_tall_lo', shutter: 'shutter_lo', shutter_tall: 'shutter_tall_lo', balcony: 'balcony_lo' };
      for (const [k, uu, vv, ex] of kits) if (uu > 0.6 && uu < wdt - 0.6) Ff.kit(place, vv > 3.5 && LO[k] ? LO[k] : k, uu, vv, 0, ex);
      if (R() < 0.25 && H > 9) Ff.kit(place, 'laundry', wdt / 2, fh * 2 + 2.6);
      // eave along the front, a tiled roof sloping back, gable walls on the sides
      const n = Math.max(1, Math.round(wdt)), sx = wdt / n;
      for (let i = 0; i < n; i++) Ff.kit(place, 'eave_lo', (i + 0.5) * sx, H, 0, { s: [sx, 1, 1] });
      const back = mul(sd.N, -depth), ridgeH = H + depth * 0.5 * 0.55;
      const a = Ff.p(-0.05, H, 0.28), b = Ff.p(wdt + 0.05, H, 0.28);
      const cA = add(Ff.p(-0.05, ridgeH, 0), mul(back, 0.5)), cB = add(Ff.p(wdt + 0.05, ridgeH, 0), mul(back, 0.5));
      B.uvFn = (p) => { const along = dot(p, Ff.R), up = Math.hypot(p[1] - H, dot(sub(p, a), sd.N)); return [along / 2.2, up / 2.0]; };
      const rc = mix(hex(0xc8704a), hex(R.pick([0xb06040, 0xd08060, 0xa85a3a])), 0.5);
      quad(B, 'rooftiles', [a, b, cB, cA], add(sd.N, [0, 1.6, 0]), rc);
      quad(B, 'rooftiles', [cA, cB, add(b, mul(back, 1)), add(a, mul(back, 1))], add(mul(sd.N, -1), [0, 1.6, 0]), mul(rc, 0.8));
      B.uvFn = null;
      for (const [uu, sgn] of [[0, -1], [wdt, 1]]) {   // gable ends
        const p0 = Ff.p(uu, 0, 0), p1 = Ff.p(uu, H, 0), p2 = add(Ff.p(uu, 0, 0), back), p3 = add(Ff.p(uu, H, 0), back), apx = add(Ff.p(uu, ridgeH, 0), mul(back, 0.5));
        quad(B, 'stucco', [p0, p1, p3, p2], mul(Ff.R, sgn), mul(wall, 0.85));
        quad(B, 'stucco', [p1, apx, apx, p3], mul(Ff.R, sgn), mul(wall, 0.85));
      }
      // a chimney now and then
      if (R() < 0.4) { const cpos = add(Ff.p(R.uni(1, wdt - 1), ridgeH - 0.6, 0), mul(back, 0.35)); box(B, 'stucco', cpos[0] - 0.3, cpos[1], cpos[2] - 0.3, cpos[0] + 0.3, cpos[1] + 1.4, cpos[2] + 0.3, wall, '-y'); box(B, 'rooftiles', cpos[0] - 0.42, cpos[1] + 1.4, cpos[2] - 0.42, cpos[0] + 0.42, cpos[1] + 1.52, cpos[2] + 0.42, hex(0xb86a46)); }
      u += wdt;
    }
  }
  // landmarks and trees behind the rows
  place.push({ k: 'bell_tower', x: -30, y: 0, z: 61, ry: 0, c: 0xf2ece0 });
  for (let k = 0; k < 16; k++) {
    const x = R.uni(-58, 58), z = R.uni(62, 80), t = R();
    place.push({ k: t < 0.45 ? 'cypress' : t < 0.75 ? 'olive' : 'palm', x, y: 0, z, ry: R.uni(0, 6.28), s: t < 0.45 ? [1, R.uni(0.8, 1.25), 1] : [1, 1, 1] });
  }
  for (let k = 0; k < 10; k++) {
    const side = R() < 0.5 ? -1 : 1, x = side * R.uni(60, 74), z = R.uni(4, 55), t = R();
    place.push({ k: t < 0.5 ? 'cypress' : 'olive', x, y: 0, z, ry: R.uni(0, 6.28) });
  }
  return pack(B);
}

/* ----------------------------------------------------------------- distant hills (instead of the buttes) */
function hills(opt) {
  const B = createBuilder();
  const R = rng(91);
  const seg = 48, r0 = 120, r1 = 210, rings = 6;
  const hgt = (a, t) => { const n = vnoise(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10, 4) * 0.7 + vnoise(Math.cos(a) * 9 + 5, Math.sin(a) * 9, 8) * 0.3; return Math.sin(Math.PI * Math.min(1, t * 1.15)) * (10 + n * 30) * (0.4 + t * 0.6); };
  for (let i = 0; i < seg; i++) for (let j = 0; j < rings; j++) {
    const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, t0 = j / rings, t1 = (j + 1) / rings;
    const P = (a, t) => { const r = r0 + (r1 - r0) * t; return [Math.cos(a) * r, hgt(a, t) - 1, Math.sin(a) * r]; };
    const p = [P(a0, t0), P(a1, t0), P(a1, t1), P(a0, t1)];
    const col = (a, t, y) => { const n = vnoise(Math.cos(a) * 14, Math.sin(a) * 14 + t * 6, 2); const scrub = mix(hex(0xb49a72), hex(0x7f8a5a), Math.min(1, n * 1.3)); return mul(mix(scrub, hex(0xc8b28a), Math.max(0, 1 - y / 18) * 0.3), 0.92 + n * 0.1); };
    const nrm = unit(cross(sub(p[3], p[0]), sub(p[1], p[0])));
    quad(B, 'hill', p, nrm[1] < 0 ? mul(nrm, -1) : nrm, [col(a0, t0, p[0][1]), col(a1, t0, p[1][1]), col(a1, t1, p[2][1]), col(a0, t1, p[3][1])]);
  }
  return pack(B);
}

// the slice: buildings in the north half get a family each (P3-5 would extend this to the whole town)
const SLICE_FAMILIES = { '-12,27': 'comercio', '11,31': 'encalada', '3,43': 'taller', '-32,16': 'senorial', '30,17': 'terracota', '-31,37': 'piedra', '33,38': 'senorial' };
function build(buildings, opt) {
  const B = createBuilder(), place = [], signs = [], foot = [], fronts = [];
  for (const b of buildings) {
    const fam = (opt.families || SLICE_FAMILIES)[b[0] + ',' + b[1]];
    if (!fam) continue;
    // the north street buildings front onto the street (x = 0), the others onto the plaza
    const frontDir = Math.abs(b[0]) < 20 && b[1] > 12 ? (b[1] > 40 ? [0, 0, -1] : [-Math.sign(b[0]), 0, 0]) : null;
    foot.push(building(B, b, fam, Object.assign({}, opt, { frontDir, fronts }), place, signs));
  }
  const r = pack(B);
  return { geo: r.geo, tris: r.tris, place, signs, footprints: foot, fronts };
}

const SDTown3 = { REVEAL, MATS, OPEN, FAMILIES, SLICE_FAMILIES, SHOP_NAMES, build, ground, backdrop, hills, vnoise };
if (typeof module !== 'undefined' && module.exports) module.exports = SDTown3; else root.SDTown3 = SDTown3;
})(typeof window !== 'undefined' ? window : globalThis);
