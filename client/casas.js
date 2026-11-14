/* SNIPER DUEL — CASAS HABITABLES del PUEBLO (14-11-2026, docs/CASAS-HABITABLES.md, bandera ?casas=1).
   Tres casas del PUEBLO que ahora se pueden usar por dentro: entrar y salir por puertas de verdad, asomarse y disparar por
   las ventanas, cubrirse detrás de los tabiques y las jambas, y en las dos de dos plantas subir por la escalera.
     · ENCALADA   [11, 31]  — la casita blanca de zócalo amarillo y contraventanas verdes (1 planta)
     · TERRACOTA  [30, 17]  — la casa naranja de esquina con balcones (2 plantas, balcones transitables)
     · ARENISCA   [-31,-31] — la casa de arenisca con contraventanas verdes junto al depósito de agua (2 plantas)
   Lo de siempre: lo que se ve NO decide. Este módulo da (1) las CAJAS (movimiento y balas, mismo formato que client/casa.js:
   { n, s, a:[x0,y0,z0], b:[x1,y1,z1], f } con s = 1 sólida / 0 solo movimiento, f = superficie), (2) las RAMPAS de las
   escaleras (formato de core/movement.js), (3) los PUNTOS de navegación interiores y (4) la geometría que se ve, por
   material, en metros. La página (src/page.html) quita la caja maciza de esas tres casas y pone esto. Puro: Node y navegador.
   Medidas del jugador (core/config.js): radio 0,35 · escalón 0,45 · salto ≈ 1,0 · de pie 1,8 · agachado 1,2.            */
(function (root) {
'use strict';
const T_WALL = 0.3;        // grosor de los muros (yeso: 'medium' para la penetración → solo BALA DURA la atraviesa)
const SLAB = 0.2;          // forjado entre plantas (hormigón)
const DOOR_W = 1.3, DOOR_H = 2.35;
const WIN_W = 1.2, WIN_SILL = 1.1, WIN_TOP = 2.3;    // ventana: alféizar a 1,1 (de pie asomas los ojos a 1,62; agachado, a 1,0, quedas cubierto)
const FR_W = 1.2, FR_H = 2.35;                        // puerta balconera de la planta alta

// ---- las tres casas. face: 'w' (x mínima, mira a −x), 'e', 'n' (z mínima, mira a −z), 's'. u: posición a lo largo de la
//      cara (m, desde el centro; en n/s crece con x, en w/e crece con z). Las ventanas se reparten solas entre puertas.
const HOUSES = [
  { id: 'encalada', key: '11,31', x: 11, z: 31, w: 8, d: 6, h: 4, floors: 1, tint: 0xf3efe6, plinth: { h: 0.95, col: 0xe2a92a, mat: 'stucco' },
    shutter: 0x2f7d34, door: 0x2f8a35, frame: 0xd28a2c, trim: 'stucco', eave: true,
    doors: [{ face: 'w', u: 1.2 }, { face: 'e', u: -1.0 }],
    wins: { w: [-1.4], e: [1.4], n: [-1.8, 1.8], s: [-1.8, 1.8] },
    walls: [{ a: [11, 0, 31 - 2.7], b: [11.12, 2.6, 31 + 0.1] }],          // tabique interior con hueco (cobertura)
    crates: [[13.6, 33.1], [8.6, 28.9]] },
  { id: 'terracota', key: '30,17', x: 30, z: 17, w: 14, d: 10, h: 7, floors: 2, tint: 0xe8792b, plinth: { h: 1.1, col: 0xd9c7a3, mat: 'stone' },
    shutter: 0x3b6f9a, door: 0x3b6f9a, frame: 0xf2ece0, trim: 'stone',
    doors: [{ face: 'w', u: 0 }, { face: 'n', u: -5.0 }],
    wins: { w: [-3.2, 3.2], e: [-3.2], n: [0.5, 4.5], s: [-4.5, -1.5, 1.5, 4.5] },
    up: { w: { balcony: [-3.2, 0, 3.2] }, e: [-3.2, 0, 3.2], n: { balcony: [-4.5, -1.5, 1.5, 4.5] }, s: [-4.5, -1.5, 1.5, 4.5] },
    stair: { face: 'e', along: 'z', from: 4.6, to: -1.4 },             // a lo largo del muro este, sube hacia z menor
    walls: [{ a: [26.5, 0, 12.3], b: [26.62, 2.6, 15.6] }, { a: [26.5, 0, 17.2], b: [26.62, 2.6, 21.7] }],
    walls2: [{ a: [30.4, 3.5, 12.3], b: [30.52, 6.1, 15.4] }],
    crates: [[24.2, 20.6], [33.4, 13.2]] },
  { id: 'arenisca', key: '-31,-31', x: -31, z: -31, w: 14, d: 12, h: 7, floors: 2, tint: 0xd6b07a, plinth: { h: 0.9, col: 0x9c7a52, mat: 'stone' },
    shutter: 0x2c5e2e, door: 0x7a1f1a, frame: 0xc9a46c, trim: 'stone', quoins: true,
    doors: [{ face: 'e', u: 0.5 }, { face: 's', u: 2.0 }],
    wins: { e: [-3.6, 3.8], w: [-3.6, 0, 3.6], n: [1.5, 4.5], s: [-4.5, -1.2, 5.0] },
    up: { e: [-3.6, 0.5, 3.8], w: [-3.6, 0, 3.6], n: [-4.5, -1.5, 1.5, 4.5], s: { balcony: [-1.2] , win: [-4.5, 2.0, 5.0] } },
    stair: { face: 'n', along: 'x', from: -1.2, to: -6.4 },           // a lo largo del muro norte, sube hacia x menor
    walls: [{ a: [-31.06, 0, -36.7], b: [-30.94, 2.6, -33.2] }, { a: [-31.06, 0, -31.4], b: [-30.94, 2.6, -25.3] }],
    walls2: [{ a: [-34.5, 3.5, -31.06], b: [-24.3, 6.1, -30.94] }],
    crates: [[-36.6, -26.6], [-26.0, -34.0]] },
];
const byKey = {}; for (const h of HOUSES) byKey[h.key] = h;

// ---- geometría de una cara: mundo ↔ (u, y). n/s: u = x − cx; w/e: u = z − cz. out = signo de la normal hacia fuera.
function faceFrame(H, f) {
  const hx = H.w / 2, hz = H.d / 2;
  if (f === 'n') return { L: H.w, axis: 'x', c: H.x, plane: H.z - hz, out: -1, inner: H.z - hz + T_WALL };
  if (f === 's') return { L: H.w, axis: 'x', c: H.x, plane: H.z + hz, out: 1, inner: H.z + hz - T_WALL };
  if (f === 'w') return { L: H.d - 2 * T_WALL, axis: 'z', c: H.z, plane: H.x - hx, out: -1, inner: H.x - hx + T_WALL };
  return { L: H.d - 2 * T_WALL, axis: 'z', c: H.z, plane: H.x + hx, out: 1, inner: H.x + hx - T_WALL };
}
// a box spanning u0..u1, y0..y1 in the wall of face f. Across the wall, s runs from the inner face (0) to the outer face
// (T_WALL); the box takes s in [T_WALL − off − t, T_WALL − off] (t: thickness, default the whole wall; off < 0 stands out)
function faceBox(H, f, u0, u1, y0, y1, t, off) {
  const F = faceFrame(H, f); t = t == null ? T_WALL : t; off = off || 0;
  const w = s => F.plane + F.out * (s - T_WALL), p0 = w(T_WALL - off - t), p1 = w(T_WALL - off);
  const n0 = Math.min(p0, p1), n1 = Math.max(p0, p1);
  if (F.axis === 'x') return { a: [F.c + u0, y0, n0], b: [F.c + u1, y1, n1] };
  return { a: [n0, y0, F.c + u0], b: [n1, y1, F.c + u1] };
}
// the openings of a house: per face, list of { u0, u1, y0, y1, kind }
function openings(H) {
  const O = { n: [], s: [], w: [], e: [] };
  for (const d of H.doors) O[d.face].push({ u0: d.u - DOOR_W / 2, u1: d.u + DOOR_W / 2, y0: 0, y1: DOOR_H, kind: 'door' });
  for (const f in H.wins) for (const u of H.wins[f]) O[f].push({ u0: u - WIN_W / 2, u1: u + WIN_W / 2, y0: WIN_SILL, y1: WIN_TOP, kind: 'win' });
  if (H.floors === 2) {
    const y = 3.3 + SLAB;
    for (const f in H.up) {
      const spec = H.up[f], list = Array.isArray(spec) ? spec : (spec.win || []), bal = Array.isArray(spec) ? [] : (spec.balcony || []);
      for (const u of list) O[f].push({ u0: u - WIN_W / 2, u1: u + WIN_W / 2, y0: y + WIN_SILL, y1: y + WIN_TOP, kind: 'win2' });
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
    for (const o of holes) { if (o.y0 > y + 1e-6) out.push({ u0, u1, y0: y, y1: o.y0, kind: y === 0 ? 'base' : 'mid' }); y = Math.max(y, o.y1); }
    if (top > y + 1e-6) out.push({ u0, u1, y0: y, y1: top, kind: holes.length ? 'lintel' : 'full' });
  }
  // merge vertical pieces of neighbouring columns that have the same span (fewer boxes)
  const merged = [];
  for (const p of out) {
    const q = merged.find(m => Math.abs(m.u1 - p.u0) < 1e-6 && Math.abs(m.y0 - p.y0) < 1e-6 && Math.abs(m.y1 - p.y1) < 1e-6);
    if (q) q.u1 = p.u1; else merged.push(Object.assign({}, p));
  }
  return merged;
}
const r3 = v => Math.round(v * 1000) / 1000;
const B = (n, s, a, b, f) => ({ n, s, a: a.map(r3), b: b.map(r3), f });

// ---- the stair of a two-storey house: a ramp from the floor to the upper floor along an inner wall
function stairOf(H) {
  if (H.floors !== 2 || !H.stair) return null;
  const S = H.stair, F = faceFrame(H, S.face), W = 1.1, top = 3.3 + SLAB;
  const lo = Math.min(S.from, S.to), hi = Math.max(S.from, S.to), highAtMin = S.to < S.from;
  const n0 = F.out > 0 ? F.inner - W : F.inner, n1 = n0 + W;
  const ramp = S.along === 'x' ? { minX: H.x + lo, maxX: H.x + hi, minZ: n0, maxZ: n1, axis: 'x', hLow: 0, hHigh: top, highAtMin }
                               : { minX: n0, maxX: n1, minZ: H.z + lo, maxZ: H.z + hi, axis: 'z', hLow: 0, hHigh: top, highAtMin };
  // the hole in the upper floor: over the whole ramp plus 0.25 m on its open side (head room on the way up)
  const hole = S.along === 'x' ? { x0: ramp.minX - 0.05, x1: ramp.maxX + 0.05, z0: F.out > 0 ? n0 - 0.25 : n0, z1: F.out > 0 ? n1 : n1 + 0.25 }
                               : { x0: F.out > 0 ? n0 - 0.25 : n0, x1: F.out > 0 ? n1 : n1 + 0.25, z0: ramp.minZ - 0.05, z1: ramp.maxZ + 0.05 };
  return { ramp, hole, W, top, highAtMin, along: S.along, out: F.out };
}

// ---- every box of a house (movement + bullets)
function boxes(H) {
  const out = [], O = openings(H), top = H.h, hx = H.w / 2, hz = H.d / 2, X0 = H.x - hx, X1 = H.x + hx, Z0 = H.z - hz, Z1 = H.z + hz;
  for (const f of ['n', 's', 'w', 'e']) for (const p of wallPieces(H, f, top, O)) { const q = faceBox(H, f, p.u0, p.u1, p.y0, p.y1); out.push(B(H.id + '_muro_' + f, 1, q.a, q.b, 'plaster')); }
  // parapet round the flat roof (or the eave line of the cottage): the old box went up to h + 0.35
  out.push(B(H.id + '_pretil_n', 1, [X0, top, Z0], [X1, top + 0.35, Z0 + T_WALL], 'plaster'));
  out.push(B(H.id + '_pretil_s', 1, [X0, top, Z1 - T_WALL], [X1, top + 0.35, Z1], 'plaster'));
  out.push(B(H.id + '_pretil_w', 1, [X0, top, Z0 + T_WALL], [X0 + T_WALL, top + 0.35, Z1 - T_WALL], 'plaster'));
  out.push(B(H.id + '_pretil_e', 1, [X1 - T_WALL, top, Z0 + T_WALL], [X1, top + 0.35, Z1 - T_WALL], 'plaster'));
  // roof (the same height as before: nobody gets on it from inside, there is no way up)
  out.push(B(H.id + '_tejado', 1, [X0 + T_WALL, top - SLAB, Z0 + T_WALL], [X1 - T_WALL, top, Z1 - T_WALL], 'concrete'));
  // upper floor with the stair hole
  const st = stairOf(H);
  if (H.floors === 2) {
    const y0 = 3.3, y1 = 3.3 + SLAB, ix0 = X0 + T_WALL, ix1 = X1 - T_WALL, iz0 = Z0 + T_WALL, iz1 = Z1 - T_WALL, h = st.hole;
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
    // balconies: a floor outside each balcony door (the upper floor level) and a railing (movement only: you shoot over it)
    for (const f of ['n', 's', 'w', 'e']) for (const o of O[f].filter(o => o.kind === 'balcony')) {
      const F = faceFrame(H, f), D = 0.9, t0 = F.out > 0 ? F.plane : F.plane - D, t1 = t0 + D;
      const A = F.axis === 'x' ? [F.c + o.u0 - 0.15, y1 - 0.18, t0] : [t0, y1 - 0.18, F.c + o.u0 - 0.15], Bb = F.axis === 'x' ? [F.c + o.u1 + 0.15, y1, t1] : [t1, y1, F.c + o.u1 + 0.15];
      out.push(B(H.id + '_balcon_' + f, 1, A, Bb, 'concrete'));
      const rail = F.out > 0 ? t1 - 0.05 : t0, railB = rail + 0.05;
      if (F.axis === 'x') { out.push(B(H.id + '_balaustrada_' + f, 0, [A[0], y1, rail], [Bb[0], y1 + 1.05, railB], ''));
        out.push(B(H.id + '_balaustrada_' + f, 0, [A[0], y1, t0], [A[0] + 0.05, y1 + 1.05, t1], '')); out.push(B(H.id + '_balaustrada_' + f, 0, [Bb[0] - 0.05, y1, t0], [Bb[0], y1 + 1.05, t1], '')); }
      else { out.push(B(H.id + '_balaustrada_' + f, 0, [rail, y1, A[2]], [railB, y1 + 1.05, Bb[2]], ''));
        out.push(B(H.id + '_balaustrada_' + f, 0, [t0, y1, A[2]], [t1, y1 + 1.05, A[2] + 0.05], '')); out.push(B(H.id + '_balaustrada_' + f, 0, [t0, y1, Bb[2] - 0.05], [t1, y1 + 1.05, Bb[2]], '')); }
    }
    for (const w of H.walls2 || []) out.push(B(H.id + '_tabique2', 1, w.a, w.b, 'plaster'));
  }
  for (const w of H.walls || []) out.push(B(H.id + '_tabique', 1, w.a, w.b, 'plaster'));
  for (const c of H.crates || []) out.push(B(H.id + '_caja', 1, [c[0] - 0.55, 0, c[1] - 0.55], [c[0] + 0.55, 1.1, c[1] + 0.55], 'crate'));
  return out;
}
function ramps(H) { const s = stairOf(H); return s ? [s.ramp] : []; }

// ---- navigation points inside (ground floor) and the two points of each door, linked; the page joins the outer ones
//      to its own grid. Bots walk on the ground floor only (they never use stairs).
function nav(H, bxs) {
  const body = bxs.filter(b => b.b[1] > 0.45 && b.a[1] < 1.8);
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
  // links inside: neighbours whose straight line is clear (sampled every 0.2 m, 0.35 m clearance)
  const clear = (a, b) => { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.2); for (let k = 1; k < n; k++) { const t = k / n; if (!free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.35)) return false; } return true; };
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j]; if (!a.inside || !b.inside) continue; const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < 1.55 && clear(a, b)) { a.n.push(j); b.n.push(i); }
  }
  return { pts, doorsOut: doors };
}

// ---- what you see: boxes per material key (metres; the page turns them into meshes with world-space UVs)
//      keys: wall (stucco, tinted), plinth, trim (frames, quoins, cornice), wood (door leaves, shutters: tinted),
//      iron, floor (interior floors), ceil (ceilings), roof (flat roof / tiles), glassless frames are 'trim'
function visual(H) {
  const V = {}, add = (k, a, b, col) => (V[k] || (V[k] = [])).push({ a: a.map(r3), b: b.map(r3), col: col == null ? null : col });
  const O = openings(H), top = H.h, hx = H.w / 2, hz = H.d / 2, X0 = H.x - hx, X1 = H.x + hx, Z0 = H.z - hz, Z1 = H.z + hz;
  for (const b of boxes(H)) {
    if (/_muro_/.test(b.n)) {
      // the plinth band of the outer skin: the lower H.plinth.h metres of every wall piece that reaches the ground
      if (b.a[1] < 0.01 && H.plinth) { const ph = Math.min(H.plinth.h, b.b[1]); add('plinth', b.a, [b.b[0], ph, b.b[2]], H.plinth.col); if (b.b[1] > ph) add('wall', [b.a[0], ph, b.a[2]], b.b, H.tint); }
      else add('wall', b.a, b.b, H.tint);
    } else if (/_pretil_/.test(b.n)) add(H.eave ? 'wall' : 'trim', b.a, b.b, H.eave ? H.tint : H.trim === 'stucco' ? 0xf4f1ea : null);
    else if (/_tejado/.test(b.n)) { add('ceil', [b.a[0], b.a[1] - 0.001, b.a[2]], [b.b[0], b.a[1] + 0.02, b.b[2]], 0xf2eee6); add('roof', [b.a[0], b.b[1] - 0.02, b.a[2]], b.b, null); }
    else if (/_forjado_/.test(b.n)) { add('ceil', b.a, [b.b[0], b.a[1] + 0.02, b.b[2]], 0xf2eee6); add('floor', [b.a[0], b.b[1] - 0.02, b.a[2]], b.b, null); }
    else if (/_tabique/.test(b.n)) add('wall', b.a, b.b, 0xeee8dc);
    else if (/_balcon_/.test(b.n)) add('trim', b.a, b.b, null);
    else if (/_baranda|_balaustrada/.test(b.n)) {   // a top rail, a bottom rail and bars every 12 cm
      const alongX = b.b[0] - b.a[0] >= b.b[2] - b.a[2], L = alongX ? b.b[0] - b.a[0] : b.b[2] - b.a[2], mx = (b.a[0] + b.b[0]) / 2, mz = (b.a[2] + b.b[2]) / 2, r = 0.025;
      const rail = (y0, y1) => alongX ? add('iron', [b.a[0], y0, mz - r], [b.b[0], y1, mz + r]) : add('iron', [mx - r, y0, b.a[2]], [mx + r, y1, b.b[2]]);
      rail(b.b[1] - 0.05, b.b[1]); rail(b.a[1] + 0.06, b.a[1] + 0.1);
      const n = Math.max(1, Math.round(L / 0.12));
      for (let k = 0; k <= n; k++) { const t = (alongX ? b.a[0] : b.a[2]) + L * k / n, q = 0.012;
        if (alongX) add('iron', [t - q, b.a[1], mz - q], [t + q, b.b[1], mz + q]); else add('iron', [mx - q, b.a[1], t - q], [mx + q, b.b[1], t + q]); }
    }
    else if (/_caja/.test(b.n)) add('crate', b.a, b.b, null);
  }
  // interior floor (ground) and the inner face colour: the interior walls are painted lighter (a thin skin inside)
  add('floor', [X0 + T_WALL, 0.0, Z0 + T_WALL], [X1 - T_WALL, 0.012, Z1 - T_WALL], null);
  for (const f of ['n', 's', 'w', 'e']) for (const p of wallPieces(H, f, top - (H.floors === 2 ? 0 : 0), O)) {
    const q = faceBox(H, f, p.u0, p.u1, p.y0, p.y1, 0.012, T_WALL - 0.006);   // 1.2 cm skin on the inner face
    add('inner', q.a, q.b, 0xefe9dd);
  }
  // window and door frames (trim), sills, shutters opened against the wall, door leaves swung inwards
  for (const f of ['n', 's', 'w', 'e']) {
    const F = faceFrame(H, f);
    for (const o of O[f]) {
      const fw = 0.12, out = 0.04;   // frame width, how far it stands out of the wall
      const fb = (u0, u1, y0, y1) => { const q = faceBox(H, f, u0, u1, y0, y1, out, -out); add('trim', q.a, q.b, H.frame); };
      fb(o.u0 - fw, o.u0, o.y0, o.y1 + fw); fb(o.u1, o.u1 + fw, o.y0, o.y1 + fw); fb(o.u0 - fw, o.u1 + fw, o.y1, o.y1 + fw);
      if (o.kind !== 'door' && o.kind !== 'balcony') { const q = faceBox(H, f, o.u0 - fw, o.u1 + fw, o.y0 - 0.06, o.y0, 0.12, -0.12); add('trim', q.a, q.b, H.frame); }
      if (o.kind !== 'door') {   // two shutters folded open against the facade on each side
        const sw = (o.u1 - o.u0) / 2, h0 = o.y0, h1 = o.y1;
        for (const [u0, u1] of [[o.u0 - fw - sw, o.u0 - fw], [o.u1 + fw, o.u1 + fw + sw]]) { const q = faceBox(H, f, u0, u1, h0, h1, 0.035, -0.035); add('wood', q.a, q.b, H.shutter); }
      } else {                   // the door leaf, open 90° inwards against the inside of the wall
        const lw = DOOR_W - 0.1, ins = F.out > 0 ? -1 : 1, u = o.u1 - 0.04;
        if (F.axis === 'x') add('wood', [F.c + u, 0.02, Math.min(F.inner, F.inner + ins * lw)], [F.c + u + 0.05, DOOR_H - 0.05, Math.max(F.inner, F.inner + ins * lw)], H.door);
        else add('wood', [Math.min(F.inner, F.inner + ins * lw), 0.02, F.c + u], [Math.max(F.inner, F.inner + ins * lw), DOOR_H - 0.05, F.c + u + 0.05], H.door);
        const st = faceBox(H, f, o.u0 - 0.15, o.u1 + 0.15, 0, 0.12, 0.35, -0.35); add('trim', st.a, st.b, 0xbfb6a6);   // the step
      }
    }
  }
  // stone corner quoins and the cornice under the parapet (sandstone house), eave of tiles (cottage)
  if (H.quoins) for (const [cx, cz] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) for (let y = H.plinth.h, k = 0; y < top - 0.2; y += 0.42, k++) {
    const l = k % 2 ? 0.45 : 0.7, sx = cx < H.x ? 1 : -1, sz = cz < H.z ? 1 : -1, e = 0.03;
    add('trim', [Math.min(cx - sx * e, cx + sx * l), y, Math.min(cz - sz * e, cz + sz * 0.3)], [Math.max(cx - sx * e, cx + sx * l), y + 0.38, Math.max(cz - sz * e, cz + sz * 0.3)], H.frame);
    add('trim', [Math.min(cx - sx * e, cx + sx * 0.3), y, Math.min(cz - sz * e, cz + sz * l)], [Math.max(cx - sx * e, cx + sx * 0.3), y + 0.38, Math.max(cz - sz * e, cz + sz * l)], H.frame);
  }
  if (!H.eave) { const e = 0.12; add('trim', [X0 - e, top - 0.25, Z0 - e], [X1 + e, top, Z0 + 0.1], H.frame); add('trim', [X0 - e, top - 0.25, Z1 - 0.1], [X1 + e, top, Z1 + e], H.frame);
    add('trim', [X0 - e, top - 0.25, Z0], [X0 + 0.1, top, Z1], H.frame); add('trim', [X1 - 0.1, top - 0.25, Z0], [X1 + e, top, Z1], H.frame); }
  else { const e = 0.35; add('roof', [X0 - e, top, Z0 - e], [X1 + e, top + 0.12, Z0 + 0.3], null); add('roof', [X0 - e, top, Z1 - 0.3], [X1 + e, top + 0.12, Z1 + e], null);
    add('roof', [X0 - e, top, Z0], [X0 + 0.3, top + 0.12, Z1], null); add('roof', [X1 - 0.3, top, Z0], [X1 + e, top + 0.12, Z1], null); }
  // a horizontal band (imposta) between the floors
  if (H.floors === 2) { const y = 3.3, e = 0.05; add('trim', [X0 - e, y, Z0 - e], [X1 + e, y + 0.18, Z0 + 0.1], H.frame); add('trim', [X0 - e, y, Z1 - 0.1], [X1 + e, y + 0.18, Z1 + e], H.frame);
    add('trim', [X0 - e, y, Z0], [X0 + 0.1, y + 0.18, Z1], H.frame); add('trim', [X1 - 0.1, y, Z0], [X1 + e, y + 0.18, Z1], H.frame); }
  // the stair: real steps (what you see; you walk on the ramp under them)
  const st = stairOf(H);
  if (st) { const r = st.ramp, n = 16, len = r.axis === 'x' ? r.maxX - r.minX : r.maxZ - r.minZ;
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, y = st.top * (k + 1) / n;
      const pos = t => st.highAtMin ? (r.axis === 'x' ? r.maxX : r.maxZ) - t * len : (r.axis === 'x' ? r.minX : r.minZ) + t * len;
      const a = Math.min(pos(t0), pos(t1)), b = Math.max(pos(t0), pos(t1));
      if (r.axis === 'x') add('wood', [a, 0, r.minZ], [b, y, r.maxZ], 0x7a5638); else add('wood', [r.minX, 0, a], [r.maxX, y, b], 0x7a5638); } }
  return V;
}

// ---- triangles of a list of boxes (per material), with UVs in metres on each face (world space), and vertex colours
function mesh(list) {
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  const srgb = c => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  for (const bx of list) {
    const [x0, y0, z0] = bx.a, [x1, y1, z1] = bx.b, c = bx.col == null ? [1, 1, 1] : srgb(bx.col);
    const F = [   // normal, 4 corners (counter-clockwise from outside), uv axes
      [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], p => [-p[2], p[1]]],
      [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], p => [p[2], p[1]]],
      [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], p => [p[0], -p[2]]],
      [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], p => [p[0], p[2]]],
      [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], p => [p[0], p[1]]],
      [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], p => [-p[0], p[1]]],
    ];
    for (const [n, q, U] of F) {
      const b = pos.length / 3;
      for (const p of q) { pos.push(p[0], p[1], p[2]); nrm.push(n[0], n[1], n[2]); const t = U(p); uv.push(t[0], t[1]); col.push(c[0], c[1], c[2]); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), col: new Float32Array(col), idx: new Uint32Array(idx) };
}
// spawn-safe: is a point inside one of the houses (bots/rats/flora can ask)
function inside(x, z, m) { m = m || 0; for (const H of HOUSES) if (Math.abs(x - H.x) < H.w / 2 + m && Math.abs(z - H.z) < H.d / 2 + m) return H; return null; }

const SDCasas = { HOUSES, byKey, T_WALL, SLAB, DOOR_W, DOOR_H, WIN_W, WIN_SILL, WIN_TOP, openings, wallPieces, boxes, ramps, stairOf, nav, visual, mesh, inside };
if (typeof module !== 'undefined' && module.exports) module.exports = SDCasas; else root.SDCasas = SDCasas;
})(typeof window !== 'undefined' ? window : globalThis);
