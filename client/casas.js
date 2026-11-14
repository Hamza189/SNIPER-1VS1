/* SNIPER DUEL — CASAS HABITABLES del PUEBLO (14-11-2026, docs/CASAS-HABITABLES.md).
   Casas del PUEBLO que se pueden usar por dentro: entrar y salir por puertas de verdad, asomarse y disparar por las
   ventanas, cubrirse detrás de tabiques, mostradores y cajas, y en las de dos plantas subir por la escalera y salir a
   los balcones.
     · ENCALADA  [11, 31]   casita blanca de zócalo amarillo (1 planta)
     · TERRACOTA [30, 17]   casa naranja de esquina con balcones (2 plantas)
     · ARENISCA  [-31,-31]  casa de arenisca junto al depósito de agua (2 plantas)
     · PIEDRA    [-31, 37]  casa de mampostería y ocre (2 plantas, más bajas)
     · COLMADO   [-12, 27]  tienda con escaparate y mostrador en la calle norte (1 planta alta)
     · TALLER    [3, 43]    taller con portón al final de la calle norte (1 planta)
     · BODEGA    [33, -8]   almacén junto a la calle transversal (1 planta alta)
     · CASONA    [31, -33]  casa señorial del sur con balcones (2 plantas)
   Lo que se ve NO decide. Este módulo da (1) las CAJAS (movimiento y balas, formato de client/casa.js:
   { n, s, a:[x0,y0,z0], b:[x1,y1,z1], f } con s = 1 sólida, 0 solo movimiento, 2 solo balas; f = superficie), (2) las
   RAMPAS de las escaleras (core/movement.js), (3) los PUNTOS de navegación de la planta baja, (4) la geometría que se ve
   por material (claves de KIT3D.LOOK: el mismo material y las mismas texturas que PUEBLO 3.0) y (5) las piezas del kit
   (contraventanas, balcones, faroles, macetas, toldo) para PUEBLO 3.0. Puro: Node y navegador.
   Medidas del jugador (core/config.js): radio 0,35 · escalón 0,45 · salto ≈ 1,0 · de pie 1,8 · agachado 1,2. */
(function (root) {
'use strict';
const T_WALL = 0.3;        // muros: yeso de 0,3 m ('medium' en core/pen.js → solo la BALA DURA los atraviesa)
const SLAB = 0.2;          // forjados (hormigón)
const DOOR_W = 1.3, DOOR_H = 2.35;
const WIN_W = 1.2, WIN_SILL = 1.1, WIN_TOP = 2.3;    // ventana: de pie (ojos a 1,62) te asomas; agachado (1,0) te cubres
const FR_W = 1.2, FR_H = 2.35;                        // puerta balconera
const INNER = 0xefe9dd;                               // pintura de dentro

// ---- las casas. Caras: 'n' (z mínima, mira a −z), 's' (z máxima), 'w' (x mínima), 'e' (x máxima). u: metros a lo largo
//      de la cara desde el centro (en n/s crece con x; en w/e con z). Ventanas: número (u) u objeto {u, w, sill, top}.
//      fl: altura del forjado de la planta alta (su cara de abajo); la planta alta pisa a fl + SLAB.
const HOUSES = [
  { id: 'encalada', key: '11,31', x: 11, z: 31, w: 8, d: 6, h: 4, floors: 1, tint: 0xf3efe6, wallMat: 'stucco',
    plinth: { h: 0.95, col: 0xe2a92a, mat: 'stucco' }, shutter: 0x2f7d34, door: 0x2f8a35, frame: 0xd28a2c, top: 'eave',
    doors: [{ face: 'w', u: 1.2 }, { face: 'e', u: -1.0 }],
    wins: { w: [-1.4], e: [1.4], n: [-1.8, 1.8], s: [-1.8, 1.8] },
    walls: [{ a: [11, 0, 28.3], b: [11.12, 2.6, 31.1] }],
    crates: [[13.6, 33.1], [8.6, 28.9]], extras: ['pots'] },
  { id: 'terracota', key: '30,17', x: 30, z: 17, w: 14, d: 10, h: 7, floors: 2, fl: 3.3, tint: 0xe8792b, wallMat: 'stucco',
    plinth: { h: 1.1, col: 0xd9c7a3, mat: 'stone' }, shutter: 0x3b6f9a, door: 0x3b6f9a, frame: 0xf2ece0, top: 'cornice',
    doors: [{ face: 'w', u: 0 }, { face: 'n', u: -5.0 }],
    wins: { w: [-3.2, 3.2], e: [-3.2], n: [0.5, 4.5], s: [-4.5, -1.5, 1.5, 4.5] },
    up: { w: { balcony: [-3.2, 0, 3.2] }, e: [-3.2, 0, 3.2], n: { balcony: [-4.5, -1.5, 1.5, 4.5] }, s: [-4.5, -1.5, 1.5, 4.5] },
    stair: { face: 'e', along: 'z', from: 4.6, to: -1.4 },
    walls: [{ a: [26.5, 0, 12.3], b: [26.62, 2.6, 15.6] }, { a: [26.5, 0, 17.2], b: [26.62, 2.6, 21.7] }],
    walls2: [{ a: [30.4, 3.5, 12.3], b: [30.52, 6.1, 15.4] }],
    crates: [[24.2, 20.6], [33.4, 13.2]], extras: ['lantern', 'pots'] },
  { id: 'arenisca', key: '-31,-31', x: -31, z: -31, w: 14, d: 12, h: 7, floors: 2, fl: 3.3, tint: 0xd6b07a, wallMat: 'stucco',
    plinth: { h: 0.9, col: 0x9c7a52, mat: 'stone' }, shutter: 0x2c5e2e, door: 0x7a1f1a, frame: 0xc9a46c, top: 'cornice', quoins: true,
    doors: [{ face: 'e', u: 0.5 }, { face: 's', u: 2.0 }],
    wins: { e: [-3.6, 3.8], w: [-3.6, 0, 3.6], n: [1.5, 4.5], s: [-4.5, -1.2, 5.0] },
    up: { e: [-3.6, 0.5, 3.8], w: [-3.6, 0, 3.6], n: [-4.5, -1.5, 1.5, 4.5], s: { balcony: [-1.2], win: [-4.5, 2.0, 5.0] } },
    stair: { face: 'n', along: 'x', from: -1.2, to: -6.4 },
    walls: [{ a: [-31.06, 0, -36.7], b: [-30.94, 2.6, -33.2] }, { a: [-31.06, 0, -31.4], b: [-30.94, 2.6, -25.3] }],
    walls2: [{ a: [-34.5, 3.5, -31.06], b: [-24.3, 6.1, -30.94] }],
    crates: [[-36.6, -26.6], [-26.0, -34.0]], extras: ['lantern'] },
  { id: 'piedra', key: '-31,37', x: -31, z: 37, w: 14, d: 10, h: 6, floors: 2, fl: 2.9, tint: 0xdcb98a, wallMat: 'stucco',
    plinth: { h: 2.6, col: 0xffffff, mat: 'rubble' }, shutter: 0x6e4a2c, door: 0x5e4026, frame: 0xd9c9a8, top: 'eave',
    doors: [{ face: 'n', u: -2.0 }, { face: 'e', u: 1.5 }],
    wins: { n: [2.5, 5.0], e: [-2.5], s: [-4.0, 0, 4.0] },
    up: { n: [-4.5, -1.5, 1.5, 4.5], e: [-2.5, 1.5], w: [-2.5, 2.5], s: [-4.5, -1.5, 1.5, 4.5] },
    stair: { face: 'w', along: 'z', from: 3.8, to: -2.0 },
    walls: [{ a: [-31.06, 0, 32.3], b: [-30.94, 2.6, 35.8] }, { a: [-31.06, 0, 37.4], b: [-30.94, 2.6, 41.7] }],
    walls2: [{ a: [-30.0, 3.1, 37.44], b: [-24.3, 5.4, 37.56] }],
    crates: [[-28.0, 40.6], [-35.0, 33.5]], extras: ['lantern', 'pots', 'climber'] },
  { id: 'colmado', key: '-12,27', x: -12, z: 27, w: 10, d: 6, h: 5, floors: 1, tint: 0xebd394, wallMat: 'stucco',
    plinth: { h: 0.6, col: 0xffffff, mat: 'azulejo' }, shutter: 0x356b52, door: 0x2f6b4a, frame: 0xf4efe4, top: 'eave',
    doors: [{ face: 'e', u: 1.7 }, { face: 'w', u: -1.5 }],
    wins: { e: [{ u: -1.0, w: 2.4, sill: 1.05, top: 2.5, shop: true }], n: [-2.5, 2.5], s: [-3.0, 1.0], w: [1.4] },
    walls: [{ a: [-10.2, 0, 25.0], b: [-9.6, 1.05, 27.6] }],             // el mostrador (cobertura agachado)
    crates: [[-15.8, 28.8]], extras: ['awning', 'pots', 'lantern'] },
  { id: 'taller', key: '3,43', x: 3, z: 43, w: 12, d: 5, h: 4, floors: 1, tint: 0xb9aca0, wallMat: 'stucco',
    plinth: { h: 0.5, col: 0xb8b2a8, mat: 'concrete' }, shutter: 0x4f6b52, door: 0x3c5a78, frame: 0xc8c0b4, top: 'coping',
    doors: [{ face: 'n', u: -2.0, w: 2.8, h: 2.6 }, { face: 'n', u: 3.6 }],
    wins: { s: [{ u: -3.0, sill: 1.3, top: 2.2 }, { u: 0, sill: 1.3, top: 2.2 }, { u: 3.0, sill: 1.3, top: 2.2 }], w: [0], e: [0] },
    walls: [{ a: [4.5, 0, 44.4], b: [7.5, 0.95, 45.2] }],                // el banco de trabajo
    crates: [[-1.5, 44.3]], extras: ['lantern'] },
  { id: 'bodega', key: '33,-8', x: 33, z: -8, w: 10, d: 12, h: 5, floors: 1, tint: 0xe9dcc0, wallMat: 'stucco',
    plinth: { h: 0.9, col: 0xd8ccb4, mat: 'stone' }, shutter: 0x2f6a9a, door: 0x2a5a80, frame: 0xf2ece0, top: 'eave',
    doors: [{ face: 's', u: -1.5 }, { face: 'w', u: -2.0 }],
    wins: { s: [2.5], w: [-4.5, 1.5, 4.0], e: [-3.0, 0, 3.0], n: [-2.5, 2.5] },
    walls: [{ a: [28.3, 0, -8.06], b: [32.2, 2.6, -7.94] }, { a: [33.8, 0, -8.06], b: [37.7, 2.6, -7.94] }],
    crates: [[36.6, -12.8], [29.6, -3.6]], extras: ['pots', 'lantern'] },
  { id: 'casona', key: '31,-33', x: 31, z: -33, w: 12, d: 10, h: 8, floors: 2, fl: 3.5, tint: 0xe8bfae, wallMat: 'stucco',
    plinth: { h: 1.0, col: 0xe6dccb, mat: 'stone' }, shutter: 0x3e5f4a, door: 0x2f4f6a, frame: 0xeee6d8, top: 'cornice', quoins: true,
    doors: [{ face: 's', u: 0 }, { face: 'w', u: 1.5 }],
    wins: { s: [-4.0, 4.0], w: [-2.5], e: [-2.5, 2.5], n: [-4.0] },
    up: { s: { balcony: [-4.0, 0, 4.0] }, w: [-2.5, 1.5], e: [-2.5, 2.5], n: [-4.5, -1.5, 1.5, 4.5] },
    stair: { face: 'n', along: 'x', from: 4.5, to: -1.5 },
    walls: [{ a: [28.94, 0, -37.7], b: [29.06, 2.8, -34.2] }, { a: [28.94, 0, -32.6], b: [29.06, 2.8, -28.3] }],
    walls2: [{ a: [33.5, 3.7, -33.06], b: [36.7, 6.6, -32.94] }],
    crates: [[26.4, -36.6], [35.8, -29.4]], extras: ['lantern', 'pots'] },
];
for (const H of HOUSES) { if (H.floors === 2 && H.fl == null) H.fl = 3.3; H.up = H.up || {}; }
const byKey = {}; for (const h of HOUSES) byKey[h.key] = h;
const upY = H => H.fl + SLAB;   // planta alta

// ---- geometría de una cara: mundo ↔ (u, y). out = signo de la normal hacia fuera.
function faceFrame(H, f) {
  const hx = H.w / 2, hz = H.d / 2;
  if (f === 'n') return { L: H.w, axis: 'x', c: H.x, plane: H.z - hz, out: -1, inner: H.z - hz + T_WALL, N: [0, 0, -1] };
  if (f === 's') return { L: H.w, axis: 'x', c: H.x, plane: H.z + hz, out: 1, inner: H.z + hz - T_WALL, N: [0, 0, 1] };
  if (f === 'w') return { L: H.d - 2 * T_WALL, axis: 'z', c: H.z, plane: H.x - hx, out: -1, inner: H.x - hx + T_WALL, N: [-1, 0, 0] };
  return { L: H.d - 2 * T_WALL, axis: 'z', c: H.z, plane: H.x + hx, out: 1, inner: H.x + hx - T_WALL, N: [1, 0, 0] };
}
// a box spanning u0..u1, y0..y1 in the wall of face f. Across the wall s runs from the inner face (0) to the outer face
// (T_WALL); the box takes s in [T_WALL − off − t, T_WALL − off] (t: thickness, default the whole wall; off < 0 stands out)
function faceBox(H, f, u0, u1, y0, y1, t, off) {
  const F = faceFrame(H, f); t = t == null ? T_WALL : t; off = off || 0;
  const w = s => F.plane + F.out * (s - T_WALL), p0 = w(T_WALL - off - t), p1 = w(T_WALL - off);
  const n0 = Math.min(p0, p1), n1 = Math.max(p0, p1);
  if (F.axis === 'x') return { a: [F.c + u0, y0, n0], b: [F.c + u1, y1, n1] };
  return { a: [n0, y0, F.c + u0], b: [n1, y1, F.c + u1] };
}
// a point on face f: u along it, y up, o out of the outer face
function facePt(H, f, u, y, o) { const F = faceFrame(H, f), n = F.plane + F.out * (o || 0); return F.axis === 'x' ? [F.c + u, y, n] : [n, y, F.c + u]; }
const faceRy = f => ({ n: Math.PI, s: 0, w: -Math.PI / 2, e: Math.PI / 2 })[f];   // kit pieces: local +z = out of the facade

// the openings of a house: per face, list of { u0, u1, y0, y1, kind, shop }
function openings(H) {
  const O = { n: [], s: [], w: [], e: [] };
  for (const d of H.doors) { const w = d.w || DOOR_W; O[d.face].push({ u0: d.u - w / 2, u1: d.u + w / 2, y0: 0, y1: d.h || DOOR_H, kind: 'door', wide: w > 2 }); }
  const win = (f, spec, y, kind) => { const o = typeof spec === 'number' ? { u: spec } : spec, w = o.w || WIN_W;
    O[f].push({ u0: o.u - w / 2, u1: o.u + w / 2, y0: y + (o.sill != null ? o.sill : WIN_SILL), y1: y + (o.top != null ? o.top : WIN_TOP), kind, shop: !!o.shop }); };
  for (const f in H.wins || {}) for (const o of H.wins[f]) win(f, o, 0, 'win');
  if (H.floors === 2) {
    const y = upY(H);
    for (const f in H.up) {
      const spec = H.up[f], list = Array.isArray(spec) ? spec : (spec.win || []), bal = Array.isArray(spec) ? [] : (spec.balcony || []);
      for (const o of list) win(f, o, y, 'win2');
      for (const u of bal) O[f].push({ u0: u - FR_W / 2, u1: u + FR_W / 2, y0: y, y1: y + FR_H, kind: 'balcony' });
    }
  }
  return O;
}
// solid wall pieces of one face, from 0 to top, minus the openings
function wallPieces(H, f, top, O) {
  const F = faceFrame(H, f), ops = O[f], L = F.L / 2, cuts = new Set([-L, L]);
  for (const o of ops) { cuts.add(Math.max(-L, o.u0)); cuts.add(Math.min(L, o.u1)); }
  const us = [...cuts].sort((a, b) => a - b), out = [];
  for (let i = 0; i < us.length - 1; i++) {
    const u0 = us[i], u1 = us[i + 1]; if (u1 - u0 < 1e-6) continue;
    const um = (u0 + u1) / 2, holes = ops.filter(o => um > o.u0 && um < o.u1).sort((a, b) => a.y0 - b.y0);
    let y = 0;
    for (const o of holes) { if (o.y0 > y + 1e-6) out.push({ u0, u1, y0: y, y1: o.y0 }); y = Math.max(y, o.y1); }
    if (top > y + 1e-6) out.push({ u0, u1, y0: y, y1: top });
  }
  const merged = [];   // neighbouring columns with the same span become one box
  for (const p of out) {
    const q = merged.find(m => Math.abs(m.u1 - p.u0) < 1e-6 && Math.abs(m.y0 - p.y0) < 1e-6 && Math.abs(m.y1 - p.y1) < 1e-6);
    if (q) q.u1 = p.u1; else merged.push(Object.assign({}, p));
  }
  for (const p of merged) { p.end0 = Math.abs(p.u0 + L) < 1e-6; p.end1 = Math.abs(p.u1 - L) < 1e-6; }
  return merged;
}
const r3 = v => Math.round(v * 1000) / 1000;
const B = (n, s, a, b, f, extra) => Object.assign({ n, s, a: a.map(r3), b: b.map(r3), f }, extra || {});

// ---- the stair of a two-storey house: a ramp from the floor to the upper floor along an inner wall
function stairOf(H) {
  if (H.floors !== 2 || !H.stair) return null;
  const S = H.stair, F = faceFrame(H, S.face), W = 1.1, top = upY(H);
  const lo = Math.min(S.from, S.to), hi = Math.max(S.from, S.to), highAtMin = S.to < S.from;
  const n0 = F.out > 0 ? F.inner - W : F.inner, n1 = n0 + W;
  const ramp = S.along === 'x' ? { minX: H.x + lo, maxX: H.x + hi, minZ: n0, maxZ: n1, axis: 'x', hLow: 0, hHigh: top, highAtMin }
                               : { minX: n0, maxX: n1, minZ: H.z + lo, maxZ: H.z + hi, axis: 'z', hLow: 0, hHigh: top, highAtMin };
  // the hole in the upper floor: over the whole ramp plus 0.25 m on its open side (head room on the way up)
  const hole = S.along === 'x' ? { x0: ramp.minX - 0.05, x1: ramp.maxX + 0.05, z0: F.out > 0 ? n0 - 0.25 : n0, z1: F.out > 0 ? n1 : n1 + 0.25 }
                               : { x0: F.out > 0 ? n0 - 0.25 : n0, x1: F.out > 0 ? n1 : n1 + 0.25, z0: ramp.minZ - 0.05, z1: ramp.maxZ + 0.05 };
  return { ramp, hole, W, top, highAtMin, along: S.along, out: F.out, face: S.face };
}
// the stair's steps: what you see, and (as 'solo balas' boxes) what stops a bullet under them; you walk on the ramp
function steps(H, n) {
  const st = stairOf(H); if (!st) return [];
  const r = st.ramp, len = r.axis === 'x' ? r.maxX - r.minX : r.maxZ - r.minZ, out = [];
  const pos = t => st.highAtMin ? (r.axis === 'x' ? r.maxX : r.maxZ) - t * len : (r.axis === 'x' ? r.minX : r.minZ) + t * len;
  for (let k = 0; k < n; k++) { const y = st.top * (k + 1) / n, a = Math.min(pos(k / n), pos((k + 1) / n)), b = Math.max(pos(k / n), pos((k + 1) / n));
    out.push(r.axis === 'x' ? { a: [a, 0, r.minZ], b: [b, y, r.maxZ] } : { a: [r.minX, 0, a], b: [r.maxX, y, b] }); }
  return out;
}

// ---- every box of a house (movement + bullets)
function boxes(H) {
  const out = [], O = openings(H), top = H.h, hx = H.w / 2, hz = H.d / 2, X0 = H.x - hx, X1 = H.x + hx, Z0 = H.z - hz, Z1 = H.z + hz;
  for (const f of ['n', 's', 'w', 'e']) for (const p of wallPieces(H, f, top, O)) { const q = faceBox(H, f, p.u0, p.u1, p.y0, p.y1);
    out.push(B(H.id + '_muro_' + f, 1, q.a, q.b, 'plaster', { face: f, end0: p.end0, end1: p.end1 })); }
  // parapet round the roof (the old box went up to h + 0.35: the outline does not change)
  out.push(B(H.id + '_pretil_n', 1, [X0, top, Z0], [X1, top + 0.35, Z0 + T_WALL], 'plaster'));
  out.push(B(H.id + '_pretil_s', 1, [X0, top, Z1 - T_WALL], [X1, top + 0.35, Z1], 'plaster'));
  out.push(B(H.id + '_pretil_w', 1, [X0, top, Z0 + T_WALL], [X0 + T_WALL, top + 0.35, Z1 - T_WALL], 'plaster'));
  out.push(B(H.id + '_pretil_e', 1, [X1 - T_WALL, top, Z0 + T_WALL], [X1, top + 0.35, Z1 - T_WALL], 'plaster'));
  out.push(B(H.id + '_tejado', 1, [X0 + T_WALL, top - SLAB, Z0 + T_WALL], [X1 - T_WALL, top, Z1 - T_WALL], 'concrete'));
  const st = stairOf(H);
  if (H.floors === 2) {
    const y0 = H.fl, y1 = upY(H), ix0 = X0 + T_WALL, ix1 = X1 - T_WALL, iz0 = Z0 + T_WALL, iz1 = Z1 - T_WALL, h = st.hole;
    const parts = [[ix0, iz0, h.x0, iz1], [h.x1, iz0, ix1, iz1], [h.x0, iz0, h.x1, h.z0], [h.x0, h.z1, h.x1, iz1]];
    parts.forEach((p, i) => { if (p[2] - p[0] > 0.02 && p[3] - p[1] > 0.02) out.push(B(H.id + '_forjado_' + i, 1, [p[0], y0, p[1]], [p[2], y1, p[3]], 'concrete')); });
    // railing on the open side of the hole, along its lower half (the top end stays open to step off the stair)
    const lowEnd = st.highAtMin ? 'max' : 'min', len = st.along === 'x' ? h.x1 - h.x0 : h.z1 - h.z0, rl = len * 0.55;
    if (st.along === 'x') {
      const zr = st.out > 0 ? h.z0 : h.z1, xa = lowEnd === 'max' ? h.x1 - rl : h.x0, xb = lowEnd === 'max' ? h.x1 : h.x0 + rl;
      out.push(B(H.id + '_baranda', 0, [xa, y1, zr - 0.04], [xb, y1 + 1.0, zr + 0.04], ''));
    } else {
      const xr = st.out > 0 ? h.x0 : h.x1, za = lowEnd === 'max' ? h.z1 - rl : h.z0, zb = lowEnd === 'max' ? h.z1 : h.z0 + rl;
      out.push(B(H.id + '_baranda', 0, [xr - 0.04, y1, za], [xr + 0.04, y1 + 1.0, zb], ''));
    }
    // the steps stop bullets (4 blocks), but not the feet (you walk on the ramp)
    steps(H, 4).forEach((s, i) => out.push(B(H.id + '_escalon_' + i, 2, s.a, s.b, 'wood')));
    // balconies: a floor outside each balcony door and a railing (movement only: you shoot over it)
    for (const f of ['n', 's', 'w', 'e']) for (const o of O[f].filter(o => o.kind === 'balcony')) {
      const F = faceFrame(H, f), D = 0.9, t0 = F.out > 0 ? F.plane : F.plane - D, t1 = t0 + D;
      const A = F.axis === 'x' ? [F.c + o.u0 - 0.15, y1 - 0.18, t0] : [t0, y1 - 0.18, F.c + o.u0 - 0.15], Bb = F.axis === 'x' ? [F.c + o.u1 + 0.15, y1, t1] : [t1, y1, F.c + o.u1 + 0.15];
      out.push(B(H.id + '_balcon_' + f, 1, A, Bb, 'concrete', { face: f, u: (o.u0 + o.u1) / 2 }));
      const rail = F.out > 0 ? t1 - 0.05 : t0, railB = rail + 0.05;
      if (F.axis === 'x') { out.push(B(H.id + '_balaustrada_' + f, 0, [A[0], y1, rail], [Bb[0], y1 + 1.05, railB], ''));
        out.push(B(H.id + '_balaustrada_' + f, 0, [A[0], y1, t0], [A[0] + 0.05, y1 + 1.05, t1], '')); out.push(B(H.id + '_balaustrada_' + f, 0, [Bb[0] - 0.05, y1, t0], [Bb[0], y1 + 1.05, t1], '')); }
      else { out.push(B(H.id + '_balaustrada_' + f, 0, [rail, y1, A[2]], [railB, y1 + 1.05, Bb[2]], ''));
        out.push(B(H.id + '_balaustrada_' + f, 0, [t0, y1, A[2]], [t1, y1 + 1.05, A[2] + 0.05], '')); out.push(B(H.id + '_balaustrada_' + f, 0, [t0, y1, Bb[2] - 0.05], [t1, y1 + 1.05, Bb[2]], '')); }
    }
    for (const w of H.walls2 || []) out.push(B(H.id + '_tabique2', 1, w.a, w.b, 'plaster'));
  }
  // door leaves, open 90° inwards beside each door (wood: they stop bullets and feet like the real thing)
  for (const f of ['n', 's', 'w', 'e']) for (const o of O[f].filter(o => o.kind === 'door' && !o.wide)) {
    const F = faceFrame(H, f), lw = (o.u1 - o.u0) - 0.1, ins = F.out > 0 ? -1 : 1, u = o.u1 - 0.06, i0 = Math.min(F.inner, F.inner + ins * lw), i1 = Math.max(F.inner, F.inner + ins * lw);
    out.push(F.axis === 'x' ? B(H.id + '_hoja_' + f, 1, [F.c + u, 0.02, i0], [F.c + u + 0.05, o.y1 - 0.05, i1], 'wood') : B(H.id + '_hoja_' + f, 1, [i0, 0.02, F.c + u], [i1, o.y1 - 0.05, F.c + u + 0.05], 'wood'));
  }
  for (const w of H.walls || []) out.push(B(H.id + '_tabique', 1, w.a, w.b, 'plaster'));
  for (const c of H.crates || []) out.push(B(H.id + '_caja', 1, [c[0] - 0.55, 0, c[1] - 0.55], [c[0] + 0.55, 1.1, c[1] + 0.55], 'crate'));
  return out;
}
function ramps(H) { const s = stairOf(H); return s ? [s.ramp] : []; }

// ---- navigation points inside (ground floor) and the two points of each door, linked; the page joins the outer ones
//      to its own grid. Bots walk on the ground floor only (they never use stairs).
function nav(H, bxs) {
  const body = bxs.filter(b => b.s !== 2 && b.b[1] > 0.45 && b.a[1] < 1.8);
  const free = (x, z, r) => !body.some(b => x > b.a[0] - r && x < b.b[0] + r && z > b.a[2] - r && z < b.b[2] + r) &&
    !ramps(H).some(p => x > p.minX - r && x < p.maxX + r && z > p.minZ - r && z < p.maxZ + r);
  const pts = [], hx = H.w / 2 - T_WALL - 0.5, hz = H.d / 2 - T_WALL - 0.5;
  for (let x = -hx; x <= hx + 1e-6; x += 1.0) for (let z = -hz; z <= hz + 1e-6; z += 1.0) { const X = r3(H.x + x), Z = r3(H.z + z); if (free(X, Z, 0.4)) pts.push({ x: X, z: Z, n: [], inside: true }); }
  const doors = [];
  for (const d of H.doors) {
    const F = faceFrame(H, d.face), p = (k) => F.axis === 'x' ? [r3(F.c + d.u), r3(F.plane + F.out * k)] : [r3(F.plane + F.out * k), r3(F.c + d.u)];
    const o = p(1.3), i = p(-1.0), io = pts.length; pts.push({ x: o[0], z: o[1], n: [], door: 'out' }); pts.push({ x: i[0], z: i[1], n: [], door: 'in', inside: true });
    pts[io].n.push(io + 1); pts[io + 1].n.push(io); doors.push(io);
  }
  const clear = (a, b) => { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.2); for (let k = 1; k < n; k++) { const t = k / n; if (!free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.35)) return false; } return true; };
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j]; if (!a.inside || !b.inside) continue; const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < 1.55 && clear(a, b)) { a.n.push(j); b.n.push(i); }
  }
  return { pts, doorsOut: doors };
}

// ---- what you see: boxes per material key (KIT3D.LOOK names; UVs in metres, the page scales them by the tile).
//      opt.kit: PUEBLO 3.0 draws shutters, balconies and the rest with the kit (kitPieces), so they are left out here.
//      A box may carry cin = [axis, sign, colour]: the face pointing that way (the inside of a wall) takes that colour.
function visual(H, opt) {
  opt = opt || {};
  const V = {}, add = (k, a, b, col, extra) => (V[k] || (V[k] = [])).push(Object.assign({ a: a.map(r3), b: b.map(r3), col: col == null ? null : col }, extra || {}));
  const O = openings(H), top = H.h, hx = H.w / 2, hz = H.d / 2, X0 = H.x - hx, X1 = H.x + hx, Z0 = H.z - hz, Z1 = H.z + hz;
  const wallK = H.wallMat || 'stucco', plinthK = (H.plinth && H.plinth.mat) || 'stone';
  for (const b of boxes(H)) {
    if (/_muro_/.test(b.n)) {
      const F = faceFrame(H, b.face), ax = F.axis === 'x' ? 2 : 0, cin = [ax, -F.out, INNER];
      if (b.a[1] < 0.01 && H.plinth) {   // plinth: the lower part, standing 2.5 cm out of the facade (a ledge on top)
        const ph = Math.min(H.plinth.h, b.b[1]), a = b.a.slice(), c = [b.b[0], ph, b.b[2]], e = 0.025;
        if (F.out > 0) c[ax] += e; else a[ax] -= e;
        const along = ax === 2 ? 0 : 2; if (b.end0) a[along] -= e; if (b.end1) c[along] += e;   // round the corners
        add(plinthK, a, c, H.plinth.col, { cin });
        if (b.b[1] > ph) add(wallK, [b.a[0], ph, b.a[2]], b.b, H.tint, { cin });
      } else add(wallK, b.a, b.b, H.tint, { cin });
    } else if (/_pretil_/.test(b.n)) add(wallK, b.a, b.b, H.tint);
    else if (/_tejado/.test(b.n)) { add('stucco', b.a, [b.b[0], b.b[1] - 0.02, b.b[2]], 0xf2eee6); add('roofterr', [b.a[0], b.b[1] - 0.02, b.a[2]], b.b, 0xd8a080); }
    else if (/_forjado_/.test(b.n)) { add('stucco', b.a, [b.b[0], b.b[1] - 0.02, b.b[2]], 0xf2eee6); add('herring', [b.a[0], b.b[1] - 0.02, b.a[2]], b.b, 0xd8c8b8); }
    else if (/_tabique/.test(b.n)) add('stucco', b.a, b.b, b.b[1] < 1.2 ? 0x8a6a4c : 0xeee8dc);   // a counter / bench is wood-coloured
    else if (/_hoja_/.test(b.n)) add('wood', b.a, b.b, H.door);
    else if (/_balcon_/.test(b.n)) { if (!opt.kit) add('stone', b.a, b.b, 0xe2d8c4); }
    else if (/_baranda|_balaustrada/.test(b.n)) {
      if (opt.kit && /_balaustrada/.test(b.n)) continue;   // the kit balcony has its own ironwork
      const alongX = b.b[0] - b.a[0] >= b.b[2] - b.a[2], L = alongX ? b.b[0] - b.a[0] : b.b[2] - b.a[2], mx = (b.a[0] + b.b[0]) / 2, mz = (b.a[2] + b.b[2]) / 2, r = 0.025;
      const rail = (y0, y1) => alongX ? add('iron', [b.a[0], y0, mz - r], [b.b[0], y1, mz + r]) : add('iron', [mx - r, y0, b.a[2]], [mx + r, y1, b.b[2]]);
      rail(b.b[1] - 0.05, b.b[1]); rail(b.a[1] + 0.06, b.a[1] + 0.1);
      const n = Math.max(1, Math.round(L / 0.12));
      for (let k = 0; k <= n; k++) { const t = (alongX ? b.a[0] : b.a[2]) + L * k / n, q = 0.012;
        if (alongX) add('iron', [t - q, b.a[1], mz - q], [t + q, b.b[1], mz + q]); else add('iron', [mx - q, b.a[1], t - q], [mx + q, b.b[1], t + q]); }
    }
    else if (/_caja/.test(b.n)) add('crate', b.a, b.b, null);
  }
  add('herring', [X0 + T_WALL, 0.0, Z0 + T_WALL], [X1 - T_WALL, 0.035, Z1 - T_WALL], 0xd8c8b8);   // the ground floor (over any pavement drawn under the house)
  // skirting inside (dark band 12 cm), just in front of the inner face
  for (const f of ['n', 's', 'w', 'e']) for (const p of wallPieces(H, f, 0.15, O)) { const q = faceBox(H, f, p.u0, p.u1, 0.035, 0.15, 0.015, T_WALL); add('stone', q.a, q.b, 0x8f8070); }
  // frames, sills, steps and (without the kit) shutters
  for (const f of ['n', 's', 'w', 'e']) {
    for (const o of O[f]) {
      const fw = 0.12, out = 0.04;
      const fb = (u0, u1, y0, y1) => { const q = faceBox(H, f, u0, u1, y0, y1, out, -out); add('stone', q.a, q.b, H.frame); };
      fb(o.u0 - fw, o.u0, o.y0, o.y1 + fw); fb(o.u1, o.u1 + fw, o.y0, o.y1 + fw); fb(o.u0 - fw, o.u1 + fw, o.y1, o.y1 + fw);
      if (o.kind === 'win' || o.kind === 'win2') { const q = faceBox(H, f, o.u0 - fw - 0.03, o.u1 + fw + 0.03, o.y0 - 0.07, o.y0, 0.13, -0.13); add('stone', q.a, q.b, H.frame); }
      if (!opt.kit && (o.kind === 'win' || o.kind === 'win2' || o.kind === 'balcony') && !o.shop) {
        const sw = (o.u1 - o.u0) / 2;
        for (const [u0, u1] of [[o.u0 - fw - sw, o.u0 - fw], [o.u1 + fw, o.u1 + fw + sw]]) { const q = faceBox(H, f, u0, u1, o.y0, o.y1, 0.035, -0.035); add('wood', q.a, q.b, H.shutter); }
      }
      if (o.kind === 'door') { const st = faceBox(H, f, o.u0 - 0.15, o.u1 + 0.15, 0, 0.1, 0.35, -0.35); add('stone', st.a, st.b, 0xbfb6a6); }
      if (o.shop) {   // the shop window: a low wooden counter under it, inside
        const q = faceBox(H, f, o.u0, o.u1, o.y0 - 0.06, o.y0, 0.5, T_WALL - 0.2); add('wood', q.a, q.b, 0x6e4a2c);
      }
    }
  }
  // corner quoins, the top (cornice, tiled eave or a plain coping), a band between the floors
  if (H.quoins) for (const [cx, cz] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) for (let y = H.plinth.h, k = 0; y < top - 0.3; y += 0.42, k++) {
    const l = k % 2 ? 0.45 : 0.7, sx = cx < H.x ? 1 : -1, sz = cz < H.z ? 1 : -1, e = 0.03;
    add('stone', [Math.min(cx - sx * e, cx + sx * l), y, Math.min(cz - sz * e, cz + sz * 0.3)], [Math.max(cx - sx * e, cx + sx * l), y + 0.38, Math.max(cz - sz * e, cz + sz * 0.3)], H.frame);
    add('stone', [Math.min(cx - sx * e, cx + sx * 0.3), y, Math.min(cz - sz * e, cz + sz * l)], [Math.max(cx - sx * e, cx + sx * 0.3), y + 0.38, Math.max(cz - sz * e, cz + sz * l)], H.frame);
  }
  const ring = (k, y0, y1, e, inw, col) => { add(k, [X0 - e, y0, Z0 - e], [X1 + e, y1, Z0 + inw], col); add(k, [X0 - e, y0, Z1 - inw], [X1 + e, y1, Z1 + e], col);
    add(k, [X0 - e, y0, Z0 + inw], [X0 + inw, y1, Z1 - inw], col); add(k, [X1 - inw, y0, Z0 + inw], [X1 + e, y1, Z1 - inw], col); };
  if (H.top === 'eave') { ring('rooftiles', top, top + 0.12, 0.35, 0.3, 0xc06a44); ring('stucco', top - 0.18, top, 0.08, 0.1, 0xf4efe4); }
  else if (H.top === 'coping') ring('concrete', top + 0.35, top + 0.42, 0.05, 0.32, 0xd8d0c4);
  else { ring('stone', top - 0.28, top - 0.1, 0.1, 0.1, H.frame); ring('stone', top - 0.1, top, 0.16, 0.1, H.frame); ring('stone', top + 0.35, top + 0.4, 0.04, 0.32, H.frame); }
  if (H.floors === 2) ring('stone', H.fl, H.fl + 0.18, 0.05, 0.1, H.frame);
  for (const s of steps(H, 16)) add('wood', s.a, s.b, 0x7a5638);
  return V;
}

// ---- PUEBLO 3.0 kit pieces for a house (P3W.place format: { k, x, y, z, ry, s, c })
function kitPieces(H) {
  const out = [], O = openings(H), ex = H.extras || [], R = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(Math.abs(H.x * 131 + H.z * 17) + 7);
  const put = (k, f, u, y, o, extra) => { const p = facePt(H, f, u, y, o); out.push(Object.assign({ k, x: r3(p[0]), y: r3(p[1]), z: r3(p[2]), ry: faceRy(f) }, extra || {})); };
  for (const f of ['n', 's', 'w', 'e']) for (const o of O[f]) {
    const fw = 0.12, h = o.y1 - o.y0;
    if ((o.kind === 'win' || o.kind === 'win2') && !o.shop) {   // folded open shutters, one each side
      const sw = (o.u1 - o.u0) / 2, k = o.kind === 'win2' ? 'shutter_lo' : 'shutter', s = [sw / 0.5, h / 1.4, 1];   // upstairs: the light piece
      put(k, f, o.u0 - fw - sw / 2, o.y0, 0.005, { s, c: H.shutter }); put(k, f, o.u1 + fw + sw / 2, o.y0, 0.005, { s, c: H.shutter });
    }
    if (o.kind === 'balcony') {
      const sw = (o.u1 - o.u0) / 2;
      put('shutter_tall_lo', f, o.u0 - fw - sw / 2, o.y0, 0.005, { s: [sw / 0.5, h / 2.2, 1], c: H.shutter }); put('shutter_tall_lo', f, o.u1 + fw + sw / 2, o.y0, 0.005, { s: [sw / 0.5, h / 2.2, 1], c: H.shutter });
      put('balcony', f, (o.u0 + o.u1) / 2, o.y0, 0, { s: [(o.u1 - o.u0 + 0.3) / 1.7, 1.05, 0.9 / 0.52] });
      if (ex.includes('pots') && R() < 0.6) put('pot_small', f, o.u1 + 0.05, o.y0, 0.65);
    }
    if (o.kind === 'door') {
      if (ex.includes('lantern')) { const u = o.u1 + 0.45 < faceFrame(H, f).L / 2 - 0.3 ? o.u1 + 0.45 : o.u0 - 0.45; put('lantern', f, u, Math.min(2.85, H.h - 0.6), 0); }
      if (ex.includes('pots') && !o.wide) put(R() < 0.5 ? 'pot_small' : 'pot_agave', f, o.u0 - 0.45, 0.0, 0.2);
    }
    if (o.shop && ex.includes('awning')) put('awning', f, (o.u0 + o.u1) / 2, o.y1 + 0.42, 0, { s: [(o.u1 - o.u0 + 0.3) / 2.6, 1, 1], c: 0x2f6b4a });
  }
  if (ex.includes('bougain')) { const f = H.doors[0].face, L = faceFrame(H, f).L; put('bougain', f, Math.min(L / 2 - 0.8, H.doors[0].u + 1.6), 0, 0, { s: [1, Math.min(1.1, (H.h - 0.4) / 3.6), 1] }); }
  if (ex.includes('climber')) for (const o of O[H.doors[0].face].filter(o => o.kind === 'win2').slice(0, 1)) put('climber', H.doors[0].face, (o.u0 + o.u1) / 2, o.y1 + 0.45, 0);
  return out;
}

// ---- triangles of a list of boxes, with UVs in metres on each face (world space) and vertex colours.
//      Faces resting on the ground (y = 0, facing down) are left out.
function mesh(list) {
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  const srgb = c => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  for (const bx of list) {
    const [x0, y0, z0] = bx.a, [x1, y1, z1] = bx.b, c = bx.col == null ? [1, 1, 1] : srgb(bx.col), ci = bx.cin ? srgb(bx.cin[2]) : null;
    const F = [
      [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], p => [-p[2], p[1]]],
      [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], p => [p[2], p[1]]],
      [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], p => [p[0], -p[2]]],
      [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], p => [p[0], p[2]]],
      [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], p => [p[0], p[1]]],
      [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], p => [-p[0], p[1]]],
    ];
    for (const [n, q, U] of F) {
      if (n[1] < 0 && y0 < 0.001) continue;
      const cc = ci && n[bx.cin[0]] === bx.cin[1] ? ci : c, b = pos.length / 3;
      for (const p of q) { pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); const t = U(p); uv.push(t[0], t[1]); col.push(cc[0], cc[1], cc[2]); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), col: new Float32Array(col), idx: new Uint32Array(idx) };
}
// is a point inside one of the houses (bots, rats and flora can ask)
function inside(x, z, m) { m = m || 0; for (const H of HOUSES) if (Math.abs(x - H.x) < H.w / 2 + m && Math.abs(z - H.z) < H.d / 2 + m) return H; return null; }

const SDCasas = { HOUSES, byKey, T_WALL, SLAB, DOOR_W, DOOR_H, WIN_W, WIN_SILL, WIN_TOP, upY, openings, wallPieces, boxes, ramps, stairOf, steps, nav, visual, kitPieces, mesh, inside, faceFrame };
if (typeof module !== 'undefined' && module.exports) module.exports = SDCasas; else root.SDCasas = SDCasas;
})(typeof window !== 'undefined' ? window : globalThis);
