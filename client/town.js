/* SNIPER DUEL — PUEBLO 2.0: the town's buildings and streets as detailed geometry, generated in the
   browser from the same layout the game already uses (no download, a few milliseconds to build).

   What it makes for every building box [x, z, w, d, h, tint]:
     plaster walls with recessed windows (frame, glass, sill, lintel, shutters open or closed, flower
     boxes) and doors (panelled leaf, stone surround, step, wall lamp), balconies with iron railings on the
     upper floors, a stone plinth, quoins, floor bands, a two-step cornice, the roof cap, downpipes,
     air-con units, and on the roofs nobody can reach: coping, a water tank, chimneys and an aerial.
   And the streets: cobbled roads with kerbs, the paved plaza and a paved apron around each building.

   GAMEPLAY IS UNTOUCHED: walls lie exactly on the faces of the collision boxes the game and the server use
   (players and bullets keep hitting those boxes). Windows and doors are set at most 0.16 m into the wall;
   what sticks out is small and flat against the wall or above head height; nothing is put where players
   walk, and the roof players can reach stays clear.

   Pure: no Three.js. Output per material: { pos, nrm, uv (metres), col (vertex colour), idx }.
   Game frame: x right, y up, z towards the viewer. */
(function (root) {
'use strict';

const MATS = ['plaster', 'stone', 'wood', 'glass', 'iron', 'metal', 'roof', 'cobble', 'paving', 'lamp', 'crate', 'cloth', 'paint', 'rubber', 'water', 'concrete', 'bag'];
const DEPTH = 0.16;          // how far windows and doors go into the wall
const hex = h => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const STONE = hex(0xd9ccb4), STONE_DK = hex(0xb8a88e), IRON = hex(0x2a2724), GLASS = hex(0x8fa3ad), WHITE = [1, 1, 1];
const FRAME = hex(0xe6e0d4);
const SHUTTERS = [0x4f7a5a, 0x3f6f8c, 0x7a4a2e, 0x6e7c3a, 0x8c3b2e, 0x4b5f6e, 0xb08a3a];
const DOORS = [0x5a3a24, 0x3a4a3a, 0x2e3e52, 0x6b2f22, 0x4a3426];
const FLOWERS = [0x5f7d3a, 0x6b8a3e, 0xb84a5a, 0xc8506a];

// small seeded random (the same town on every device)
function rng(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.uni = (a0, b0) => a0 + (b0 - a0) * f();
  f.pick = arr => arr[Math.floor(f() * arr.length) % arr.length];
  f.int = (a0, b0) => a0 + Math.floor(f() * (b0 - a0 + 1));
  return f;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function createBuilder() {
  const B = {};
  for (const k of MATS) B[k] = { pos: [], nrm: [], uv: [], col: [], idx: [] };
  return B;
}
// world-planar UVs in metres along the face's main axis
function planarUV(p, n) {
  const ax = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : (Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2);
  if (ax === 1) return [p[0], p[2]];
  if (ax === 0) return [p[2] * (n[0] > 0 ? -1 : 1), p[1]];
  return [p[0] * (n[2] < 0 ? -1 : 1), p[1]];
}
// a little dirt / occlusion near the ground
function shade(c, y, ao) {
  if (!ao) return c;
  const k = 0.72 + 0.28 * Math.min(1, Math.max(0, y / 1.1));
  return [c[0] * k, c[1] * k, c[2] * k];
}
// one quad facing along want (the point order is fixed if needed)
function quad(B, m, pts, want, col, ao) {
  if (B.xf) {   // a prop's own frame: rotate about y, then move into place
    const X = B.xf, c = X.c, s = X.s;
    const tp = p => [X.x + p[0] * c + p[2] * s, X.y + p[1], X.z - p[0] * s + p[2] * c];
    pts = pts.map(tp);
    want = [want[0] * c + want[2] * s, want[1], -want[0] * s + want[2] * c];
  }
  const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
  if (dot(n, want) < 0) pts = [pts[3], pts[2], pts[1], pts[0]];
  const nn = unit(want), g = B[m], i0 = g.pos.length / 3;
  for (const p of pts) {
    g.pos.push(p[0], p[1], p[2]); g.nrm.push(nn[0], nn[1], nn[2]);
    let uv = planarUV(p, nn); if (B.uvFn) uv = B.uvFn(uv[0], uv[1]); g.uv.push(uv[0], uv[1]);
    const c = shade(col, p[1], ao !== false); g.col.push(c[0], c[1], c[2]);
  }
  g.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
}
function box(B, m, x0, y0, z0, x1, y1, z1, col, skip, ao) {
  skip = skip || '';
  const P = (x, y, z) => [x, y, z];
  if (skip.indexOf('-x') < 0) quad(B, m, [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], [-1, 0, 0], col, ao);
  if (skip.indexOf('+x') < 0) quad(B, m, [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], [1, 0, 0], col, ao);
  if (skip.indexOf('-y') < 0) quad(B, m, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], [0, -1, 0], col, ao);
  if (skip.indexOf('+y') < 0) quad(B, m, [P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0)], [0, 1, 0], col, ao);
  if (skip.indexOf('-z') < 0) quad(B, m, [P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)], [0, 0, -1], col, ao);
  if (skip.indexOf('+z') < 0) quad(B, m, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], [0, 0, 1], col, ao);
}
function cyl(B, m, cx, y0, cz, r, h, col, seg) {
  seg = seg || 10;
  for (let i = 0; i < seg; i++) {
    const a0 = 2 * Math.PI * i / seg, a1 = 2 * Math.PI * (i + 1) / seg, am = (a0 + a1) / 2;
    const p0 = [cx + r * Math.cos(a0), y0, cz + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), y0, cz + r * Math.sin(a1)];
    quad(B, m, [p0, p1, [p1[0], y0 + h, p1[2]], [p0[0], y0 + h, p0[2]]], [Math.cos(am), 0, Math.sin(am)], col, true);
  }
  for (let i = 0; i < seg; i += 2) {    // top as quads (fan of pairs)
    const a = i => [cx + r * Math.cos(2 * Math.PI * i / seg), y0 + h, cz + r * Math.sin(2 * Math.PI * i / seg)];
    quad(B, m, [[cx, y0 + h, cz], a(i), a(i + 1), a(i + 2)], [0, 1, 0], col, false);
  }
}

/* A wall face seen from outside: origin O (bottom-left on the outer surface), right R, outward N. */
function facade(B, O, R, N, L, H) {
  const F = { L, H, N, R };
  F.p = (u, v, out) => add(add(O, mul(R, u)), add([0, v, 0], mul(N, out || 0)));
  F.rect = (m, u0, u1, v0, v1, out, col, ao) => quad(B, m, [F.p(u0, v0, out), F.p(u1, v0, out), F.p(u1, v1, out), F.p(u0, v1, out)], N, col, ao);
  // a block on (o > 0) or in (o < 0) the wall between depths o0 < o1; its back is never seen
  F.slab = (m, u0, u1, v0, v1, o0, o1, col, ao, thin) => {
    const c = [F.p(u0, v0, o0), F.p(u1, v0, o0), F.p(u1, v1, o0), F.p(u0, v1, o0), F.p(u0, v0, o1), F.p(u1, v0, o1), F.p(u1, v1, o1), F.p(u0, v1, o1)];
    quad(B, m, [c[4], c[5], c[6], c[7]], N, col, ao);
    if (thin) return;                                    // bars: front only (two-sided material)
    quad(B, m, [c[0], c[3], c[7], c[4]], mul(R, -1), col, ao);
    quad(B, m, [c[1], c[2], c[6], c[5]], R, col, ao);
    if (o1 - o0 <= 0.061 && v1 - v0 < 0.5) return;   // a few cm deep: top and bottom are never seen
    quad(B, m, [c[3], c[2], c[6], c[7]], [0, 1, 0], col, ao);
    quad(B, m, [c[0], c[1], c[5], c[4]], [0, -1, 0], col, ao);
  };
  // the wall itself with rectangular recesses [u0,u1,v0,v1], reveals going `depth` in
  F.wall = (m, holes, depth, col) => {
    const us = [...new Set([0, L, ...holes.map(h => h[0]), ...holes.map(h => h[1])])].sort((a, b) => a - b);
    const vs = [...new Set([0, H, ...holes.map(h => h[2]), ...holes.map(h => h[3])])].sort((a, b) => a - b);
    const inside = (u, v) => holes.some(h => h[0] < u && u < h[1] && h[2] < v && v < h[3]);
    // merge cells row by row into long strips (fewer triangles)
    for (let j = 0; j < vs.length - 1; j++) {
      let start = null;
      for (let i = 0; i <= us.length - 1; i++) {
        const solid = i < us.length - 1 && !inside((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2);
        if (solid && start === null) start = us[i];
        if (!solid && start !== null) { F.rect(m, start, us[i], vs[j], vs[j + 1], 0, col); start = null; }
      }
    }
    const d = -depth;
    for (const [u0, u1, v0, v1] of holes) {
      quad(B, m, [F.p(u0, v0, 0), F.p(u0, v1, 0), F.p(u0, v1, d), F.p(u0, v0, d)], R, col);
      quad(B, m, [F.p(u1, v0, 0), F.p(u1, v1, 0), F.p(u1, v1, d), F.p(u1, v0, d)], mul(R, -1), col);
      quad(B, m, [F.p(u0, v1, 0), F.p(u1, v1, 0), F.p(u1, v1, d), F.p(u0, v1, d)], [0, -1, 0], col);
      quad(B, m, [F.p(u0, v0, 0), F.p(u1, v0, 0), F.p(u1, v0, d), F.p(u0, v0, d)], [0, 1, 0], col);
    }
  };
  return F;
}

function building(B, b, opt) {
  const [bx, bz, w, d, h, ti] = b;
  const R = rng(Math.round(bx * 7919 + bz * 104729 + w * 31 + d * 17) >>> 0);
  const tint = hex(opt.tints[ti]);
  const x0 = bx - w / 2, x1 = bx + w / 2, z0 = bz - d / 2, z1 = bz + d / 2;
  const reach = (opt.reachable || []).some(r => r[0] === bx && r[1] === bz);
  const floors = Math.max(1, Math.round(h / 3.1)), fh = h / floors;
  const shutter = hex(R.pick(SHUTTERS)), doorc = hex(R.pick(DOORS));
  const quoins = R() < 0.6;
  const faces = [
    ['+z', facade(B, [x0, 0, z1], [1, 0, 0], [0, 0, 1], w, h)],
    ['-z', facade(B, [x1, 0, z0], [-1, 0, 0], [0, 0, -1], w, h)],
    ['+x', facade(B, [x1, 0, z1], [0, 0, -1], [1, 0, 0], d, h)],
    ['-x', facade(B, [x0, 0, z0], [0, 0, 1], [-1, 0, 0], d, h)],
  ];
  const toC = [-bx, 0, -bz];
  const front = faces.slice().sort((a, b2) => dot(b2[1].N, toC) - dot(a[1].N, toC))[0][0];
  for (const [key, F] of faces) {
    const L = F.L, holes = [], deco = [];
    const nb = Math.max(1, Math.floor((L - 1.0) / 2.5)), step = L / nb;
    const doorBays = new Set();
    if (key === front) { doorBays.add(Math.floor(nb / 2)); if (nb >= 4 && R() < 0.5) doorBays.add(R() < 0.5 ? 0 : nb - 1); }
    else if (L >= 10 && R() < 0.35) doorBays.add(Math.floor(R() * nb));
    for (let fl = 0; fl < floors; fl++) {
      const vb = fl * fh;
      for (let bi = 0; bi < nb; bi++) {
        const uc = (bi + 0.5) * step;
        if (fl === 0 && doorBays.has(bi)) { holes.push([uc - 0.6, uc + 0.6, 0, 2.3]); deco.push(['door', uc, vb]); continue; }
        const r = R();
        if (fl > 0 && r < 0.22 && step >= 2.2) { holes.push([uc - 0.55, uc + 0.55, vb + 0.15, vb + 2.35]); deco.push(['balcony', uc, vb]); }
        else if (r < 0.9) {
          const wv0 = vb + (fl === 0 ? 1.0 : 0.95), wv1 = Math.min(wv0 + (fl === 0 ? 1.25 : 1.45), vb + fh - 0.35);
          if (wv1 - wv0 < 0.7) continue;
          const ww = fl === 0 && R() < 0.4 ? 0.5 : 0.55;
          holes.push([uc - ww, uc + ww, wv0, wv1]); deco.push(['window', uc, vb, wv0, wv1, ww, fl === 0]);
        }
      }
    }
    F.wall('plaster', holes, DEPTH, tint);
    // stone plinth, broken at the doors
    const doors = deco.filter(x => x[0] === 'door').map(x => [x[1] - 0.6, x[1] + 0.6]).sort((a, b2) => a[0] - b2[0]);
    let u = 0;
    for (const [a, b2] of doors.concat([[L, L]])) { if (a - u > 0.05) F.slab('stone', u, a, 0, 0.75, 0, 0.05, STONE_DK); u = b2; }
    if (quoins && h > 3.6) {
      let v = 0.75, k = 0;
      while (v + 0.36 < h - 0.4) { const ln = k % 2 === 0 ? 0.55 : 0.35; F.slab('stone', 0, ln, v, v + 0.34, 0, 0.03, STONE); F.slab('stone', L - ln, L, v, v + 0.34, 0, 0.03, STONE); v += 0.38; k++; }
    }
    for (let fl = 1; fl < floors; fl++) F.slab('stone', 0, L, fl * fh - 0.12, fl * fh + 0.02, 0, 0.05, STONE);
    F.slab('stone', -0.06, L + 0.06, h - 0.34, h - 0.2, 0, 0.06, STONE, false);
    F.slab('stone', -0.14, L + 0.14, h - 0.2, h, 0, 0.14, STONE, false);
    for (const dc of deco) {
      if (dc[0] === 'window') {
        const [, uc, , wv0, wv1, ww, ground] = dc, a = uc - ww, b2 = uc + ww, mid = (wv0 + wv1) / 2;
        F.rect('glass', a, b2, wv0, wv1, -DEPTH + 0.02, GLASS, false);
        for (const [p0, p1, q0, q1] of [[a, a + 0.07, wv0, wv1], [b2 - 0.07, b2, wv0, wv1], [a, b2, wv0, wv0 + 0.07], [a, b2, wv1 - 0.07, wv1], [uc - 0.03, uc + 0.03, wv0, wv1], [a, b2, mid + 0.12, mid + 0.17]])
          F.slab('wood', p0, p1, q0, q1, -DEPTH + 0.02, -DEPTH + 0.08, FRAME, false, true);
        F.slab('stone', a - 0.1, b2 + 0.1, wv0 - 0.07, wv0 + 0.01, 0, 0.09, STONE);
        F.slab('stone', a - 0.06, b2 + 0.06, wv1, wv1 + 0.12, 0, 0.03, STONE);
        if (ground) {
          const n = Math.floor((b2 - a) / 0.14);
          for (let i = 1; i < n; i++) { const uu = a + i * (b2 - a) / n; F.slab('iron', uu - 0.012, uu + 0.012, wv0 + 0.02, wv1 - 0.02, -0.03, -0.006, IRON, false, true); }
          F.slab('iron', a + 0.02, b2 - 0.02, mid - 0.015, mid + 0.015, -0.035, -0.005, IRON, false, true);
        } else {
          const r = R();
          if (r < 0.25) {
            F.slab('wood', a, b2, wv0, wv1, -0.1, -0.06, shutter, false);
            F.slab('wood', uc - 0.01, uc + 0.01, wv0, wv1, -0.06, -0.055, mul(shutter, 0.6), false, true);
          } else if (r < 0.85) {
            F.slab('wood', a - ww - 0.03, a - 0.03, wv0, wv1, 0, 0.035, shutter, false);
            F.slab('wood', b2 + 0.03, b2 + ww + 0.03, wv0, wv1, 0, 0.035, shutter, false);
          }
          if (r > 0.7) {
            F.slab('wood', a + 0.05, b2 - 0.05, wv0 + 0.01, wv0 + 0.2, 0.09, 0.27, hex(0x8a5a3a), false);
            for (let i = 0; i < 4; i++) { const uu = a + 0.12 + i * (b2 - a - 0.24) / 3; F.slab('paving', uu - 0.09, uu + 0.09, wv0 + 0.2, wv0 + 0.36, 0.11, 0.26, hex(R.pick(FLOWERS)), false); }
          }
        }
      } else if (dc[0] === 'door') {
        const uc = dc[1], a = uc - 0.6, b2 = uc + 0.6;
        F.rect('wood', a, b2, 0, 2.3, -DEPTH + 0.01, doorc, false);
        for (const [p0, p1] of [[a + 0.08, uc - 0.04], [uc + 0.04, b2 - 0.08]]) {
          F.slab('wood', p0, p1, 0.25, 1.05, -DEPTH + 0.01, -DEPTH + 0.04, doorc, false);
          F.slab('wood', p0, p1, 1.2, 2.1, -DEPTH + 0.01, -DEPTH + 0.04, doorc, false);
        }
        F.slab('stone', a - 0.22, a, 0, 2.52, 0, 0.05, STONE);
        F.slab('stone', b2, b2 + 0.22, 0, 2.52, 0, 0.05, STONE);
        F.slab('stone', a - 0.22, b2 + 0.22, 2.3, 2.52, 0, 0.07, STONE);
        F.slab('stone', a - 0.1, b2 + 0.1, 0, 0.1, 0, 0.35, STONE_DK);
        const lu = b2 + 0.8 < L ? b2 + 0.55 : a - 0.55;
        F.slab('iron', lu - 0.03, lu + 0.03, 2.55, 2.62, 0, 0.3, IRON, false);
        F.slab('lamp', lu - 0.1, lu + 0.1, 2.3, 2.55, 0.18, 0.38, WHITE, false);
        F.slab('iron', lu - 0.12, lu + 0.12, 2.55, 2.6, 0.16, 0.4, IRON, false);
      } else if (dc[0] === 'balcony') {
        const uc = dc[1], vb = dc[2], a = uc - 0.55, b2 = uc + 0.55;
        F.rect('glass', a, b2, vb + 0.15, vb + 2.35, -DEPTH + 0.02, GLASS, false);
        for (const [p0, p1, q0, q1] of [[a, a + 0.08, vb + 0.15, vb + 2.35], [b2 - 0.08, b2, vb + 0.15, vb + 2.35], [a, b2, vb + 2.27, vb + 2.35], [uc - 0.03, uc + 0.03, vb + 0.15, vb + 2.35]])
          F.slab('wood', p0, p1, q0, q1, -DEPTH + 0.02, -DEPTH + 0.08, FRAME, false, true);
        F.slab('wood', a - 0.58, a - 0.03, vb + 0.15, vb + 2.35, 0, 0.035, shutter, false);
        F.slab('wood', b2 + 0.03, b2 + 0.58, vb + 0.15, vb + 2.35, 0, 0.035, shutter, false);
        const s0 = a - 0.45, s1 = b2 + 0.45;
        F.slab('stone', s0, s1, vb + 0.03, vb + 0.15, 0, 0.62, STONE);
        for (const uu of [s0 + 0.12, s1 - 0.12]) F.slab('stone', uu - 0.06, uu + 0.06, vb - 0.22, vb + 0.03, 0, 0.32, STONE);
        F.slab('iron', s0 + 0.02, s1 - 0.02, vb + 1.08, vb + 1.12, 0.56, 0.6, IRON, false);
        F.slab('iron', s0 + 0.02, s1 - 0.02, vb + 0.2, vb + 0.23, 0.56, 0.6, IRON, false, true);
        const n = Math.floor((s1 - s0) / 0.12);
        for (let i = 0; i <= n; i++) { const uu = s0 + 0.03 + i * (s1 - s0 - 0.06) / n; F.slab('iron', uu - 0.01, uu + 0.01, vb + 0.15, vb + 1.08, 0.57, 0.59, IRON, false, true); }
        // side rails: a thin plate of bars seen from the side
        for (const s of [s0 + 0.03, s1 - 0.03]) {
          const side = facade(B, F.p(s, 0, 0), F.N, mul(F.R, s < uc ? -1 : 1), 0.6, 0);
          for (let i = 0; i < 5; i++) { const o = 0.04 + i * 0.13; side.slab('iron', o, o + 0.02, vb + 0.15, vb + 1.08, -0.01, 0.01, IRON, false, true); }
        }
      }
    }
    if (L >= 8 && (key === '+z' || key === '-z')) {
      const uu = R() < 0.5 ? L - 0.25 : 0.25;
      F.slab('metal', uu - 0.05, uu + 0.05, 0.1, h - 0.34, 0.04, 0.14, hex(0x8a8378), false);
      F.slab('metal', uu - 0.08, uu + 0.08, 0, 0.12, 0.04, 0.3, hex(0x8a8378));
    }
    if ((key === '+x' || key === '-x') && floors > 1 && R() < 0.6) {
      const uu = R.uni(1.0, Math.max(1.1, L - 1.8)), v = fh + R.uni(1.9, 2.3);
      if (!holes.some(hh => hh[0] - 0.2 < uu + 0.8 && uu < hh[1] + 0.2 && hh[2] - 0.2 < v + 0.55 && v < hh[3] + 0.2)) {
        F.slab('metal', uu, uu + 0.8, v, v + 0.55, 0, 0.3, hex(0xd8d6cf), false);
        F.slab('iron', uu + 0.12, uu + 0.68, v + 0.08, v + 0.47, 0.3, 0.305, hex(0x55524c), false, true);
      }
    }
  }
  // roof cap (the same box as the old one: w+0.4 × 0.35 × d+0.4) with the walkable top
  const m = 0.2;
  box(B, 'stone', x0 - m, h, z0 - m, x1 + m, h + 0.35, z1 + m, STONE, '+y-y', false);
  box(B, 'stone', x0 - m, h - 0.001, z0 - m, x1 + m, h, z1 + m, STONE, '+y-x+x-z+z', false);
  quad(B, 'roof', [[x0 - m, h + 0.35, z0 - m], [x0 - m, h + 0.35, z1 + m], [x1 + m, h + 0.35, z1 + m], [x1 + m, h + 0.35, z0 - m]], [0, 1, 0], WHITE, false);
  if (!reach) {
    for (const [a0, b0, a1, b1] of [[x0 - m, z0 - m, x1 + m, z0 - m + 0.25], [x0 - m, z1 + m - 0.25, x1 + m, z1 + m], [x0 - m, z0 - m + 0.25, x0 - m + 0.25, z1 + m - 0.25], [x1 + m - 0.25, z0 - m + 0.25, x1 + m, z1 + m - 0.25]])
      box(B, 'stone', a0, h + 0.35, b0, a1, h + 0.5, b1, STONE, '-y', false);
    const top = h + 0.35;
    if (R() < 0.8) {
      const tx = bx + R.uni(-w / 4, w / 4), tz = bz + R.uni(-d / 4, d / 4);
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) box(B, 'iron', tx + dx - 0.04, top, tz + dz - 0.04, tx + dx + 0.04, top + 0.6, tz + dz + 0.04, IRON, '-y+y', false);
      cyl(B, 'metal', tx, top + 0.6, tz, 0.75, 1.1, hex(0x9aa0a0), 10);
    }
    const nCh = R.int(1, 2);
    for (let i = 0; i < nCh; i++) {
      const cx = bx + R.uni(-w / 2 + 0.8, w / 2 - 0.8), cz = bz + R.uni(-d / 2 + 0.8, d / 2 - 0.8);
      box(B, 'plaster', cx - 0.35, top, cz - 0.35, cx + 0.35, top + 1.1, cz + 0.35, tint, '-y');
      box(B, 'stone', cx - 0.42, top + 1.1, cz - 0.42, cx + 0.42, top + 1.22, cz + 0.42, STONE, '', false);
    }
    if (R() < 0.6) {
      const ax = bx + R.uni(-w / 3, w / 3), az = bz + R.uni(-d / 3, d / 3);
      box(B, 'iron', ax - 0.025, top, az - 0.025, ax + 0.025, top + 2.4, az + 0.025, IRON, '-y', false);
      [1.2, 0.9, 0.6].forEach((l, i) => box(B, 'iron', ax - l / 2, top + 1.6 + i * 0.3, az - 0.015, ax + l / 2, top + 1.63 + i * 0.3, az + 0.015, IRON, '', false));
    }
  }
  return [x0, x1, z0, z1];
}

const GROUND_TINT = { cobble: hex(0xb8ae9e), paving: hex(0xab9e88) };
function flat(B, m, x0, z0, x1, z1, y) {
  quad(B, m, [[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]], [0, 1, 0], GROUND_TINT[m] || WHITE, false);
}
function streets(B, foot) {
  flat(B, 'cobble', -4.5, -49, 4.5, 49, 0.012);
  flat(B, 'cobble', -49, -3.5, 49, 3.5, 0.013);
  const P = 11, k = 0.22;
  flat(B, 'paving', -P, -P, P, P, 0.016);
  const kx = (a, b2, z) => { if (b2 - a > 0.1) box(B, 'stone', a, 0, z - k / 2, b2, 0.09, z + k / 2, STONE_DK, '-y', false); };
  const kz = (a, b2, x) => { if (b2 - a > 0.1) box(B, 'stone', x - k / 2, 0, a, x + k / 2, 0.09, b2, STONE_DK, '-y', false); };
  for (const x of [-4.5 - k / 2, 4.5 + k / 2]) { kz(-49, -P, x); kz(P, 49, x); }
  for (const z of [-3.5 - k / 2, 3.5 + k / 2]) { kx(-49, -P, z); kx(P, 49, z); }
  for (const s of [-1, 1]) {
    kx(-P, -4.5 - k, s * (P + k / 2)); kx(4.5 + k, P, s * (P + k / 2));
    kz(-P, -3.5 - k, s * (P + k / 2)); kz(3.5 + k, P, s * (P + k / 2));
  }
  for (const [x0, x1, z0, z1] of foot) flat(B, 'paving', x0 - 1.1, z0 - 1.1, x1 + 1.1, z1 + 1.1, 0.018);
}

/* ------------------------------------------------------------------ props
   Every prop is drawn in its own frame (B.xf: position + rotation about y) and fits the box or cylinder
   the game already uses for it, so what you see is what stops you and the bullets. */
function tri(B, m, a, b, c, want, col, ao) { quad(B, m, [a, b, c, c], want, col, ao); }
// a prism: convex profile [[x, y]…] (counter-clockwise seen from +z) extruded from z0 to z1
function prism(B, m, prof, z0, z1, col, ao) {
  const n = prof.length;
  for (let i = 0; i < n; i++) {
    const a = prof[i], b = prof[(i + 1) % n], e = [b[0] - a[0], b[1] - a[1]];
    quad(B, m, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], [e[1], -e[0], 0], col, ao);
  }
  for (let i = 1; i < n - 1; i++) {
    tri(B, m, [prof[0][0], prof[0][1], z1], [prof[i][0], prof[i][1], z1], [prof[i + 1][0], prof[i + 1][1], z1], [0, 0, 1], col, ao);
    tri(B, m, [prof[0][0], prof[0][1], z0], [prof[i][0], prof[i][1], z0], [prof[i + 1][0], prof[i + 1][1], z0], [0, 0, -1], col, ao);
  }
}
// a thin square tube from a to b (cables, braces)
function tube(B, m, a, b, r, col) {
  const d = unit(sub(b, a)), up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const s1 = mul(unit(cross(d, up)), r), s2 = mul(unit(cross(d, s1)), r);
  const ring = [add(s1, s2), sub(s1, s2), mul(add(s1, s2), -1), sub(s2, s1)];
  for (let i = 0; i < 4; i++) {
    const o0 = ring[i], o1 = ring[(i + 1) % 4], nrm = add(o0, o1);
    quad(B, m, [add(a, o0), add(a, o1), add(b, o1), add(b, o0)], nrm, col, false);
  }
}
function setXf(B, x, y, z, ry) { B.xf = { x, y, z, c: Math.cos(ry || 0), s: Math.sin(ry || 0) }; }

const WOOD_CRATE = [0x9a7448, 0x8a6a42, 0xa47c4c, 0x7f6240];
const BAG_TONES = [0xa89878, 0x9c8d70, 0xb3a283, 0x8f8268, 0xa39276];
const BARREL_PAINT = [0x8a3a24, 0x2f5a7a, 0x4f6b3a, 0xb08a2a, 0x6a6a64];
const CAR_PAINT = [0x5d7a7c, 0x8a4a38, 0xc2b28c, 0x4a5a6e, 0x7a7f6a];

function crate(B, R, sz) {
  const h = sz / 2, t = 0.09, o = 0.025, col = hex(R.pick(WOOD_CRATE)), dk = mul(col, 0.72);
  box(B, 'crate', -h + 0.02, 0, -h + 0.02, h - 0.02, sz - 0.02, h - 0.02, col, '-y');
  // frame boards on every vertical edge, the top and bottom edges, and a middle board on each face
  for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) {
    const xa = sx < 0 ? -h - o : h - t + o, xb = sx < 0 ? -h + t - o : h + o, za = sz2 < 0 ? -h - o : h - t + o, zb = sz2 < 0 ? -h + t - o : h + o;
    box(B, 'crate', xa, 0, za, xb, sz, zb, dk, '-y');
  }
  for (const y of [0, sz - t]) {
    box(B, 'crate', -h - o, y, -h - o, h + o, y + t, -h + t - o, dk, '');
    box(B, 'crate', -h - o, y, h - t + o, h + o, y + t, h + o, dk, '');
    box(B, 'crate', -h - o, y, -h + t - o, -h + t - o, y + t, h - t + o, dk, '');
    box(B, 'crate', h - t + o, y, -h + t - o, h + o, y + t, h - t + o, dk, '');
  }
  const ym = sz / 2 - t / 2;
  box(B, 'crate', -h + t, ym, -h - o, h - t, ym + t, -h + 0.02, dk, '-y+y');
  box(B, 'crate', -h + t, ym, h - 0.02, h - t, ym + t, h + o, dk, '-y+y');
  box(B, 'crate', -h - o, ym, -h + t, -h + 0.02, ym + t, h - t, dk, '-y+y');
  box(B, 'crate', h - 0.02, ym, -h + t, h + o, ym + t, h - t, dk, '-y+y');
}
// a pillow: rounded section (8 points), ends pinched; along z from z0 to z1
function pillow(B, m, cx, y0, w, h, z0, z1, col) {
  const hw = w / 2, k = Math.min(h * 0.42, hw * 0.5);
  // six-point section: flat-ish bottom, bulging sides, rounded top
  const sec = (s) => [[-hw * s, y0 + k], [-hw * s + k * 0.6, y0], [hw * s - k * 0.6, y0], [hw * s, y0 + k],
    [hw * s * 0.8, y0 + h * (0.5 + 0.5 * s)], [-hw * s * 0.8, y0 + h * (0.5 + 0.5 * s)]];
  const L = z1 - z0, zs = [z0, z0 + Math.min(0.12, L * 0.2), z1 - Math.min(0.12, L * 0.2), z1], sc = [0.72, 1, 1, 0.72];
  const rings = zs.map((z, i) => sec(sc[i]).map(p => [cx + p[0], p[1] - (1 - sc[i]) * h * 0.18, z]));
  const NS = 6;
  for (let r = 0; r < 3; r++) for (let i = 0; i < NS; i++) {
    const a = rings[r][i], b = rings[r][(i + 1) % NS], c = rings[r + 1][(i + 1) % NS], d = rings[r + 1][i];
    const e = [b[0] - a[0], b[1] - a[1]];
    const nz = r === 0 ? -0.5 : r === 2 ? 0.5 : 0;
    quad(B, m, [a, b, c, d], unit([e[1], -e[0], nz]), col, true);
  }
  for (const [ri, nz] of [[0, -1], [3, 1]]) { const R = rings[ri]; quad(B, m, [R[0], R[1], R[2], R[3]], [0, 0, nz], col, true); quad(B, m, [R[0], R[3], R[4], R[5]], [0, 0, nz], col, true); }
}
// sandbag wall filling a w × h × d box: one soft roll per row (staggered by half a bag); the 'bag'
// texture draws the bags, their joints and ties (one bag per repeat: 0.56 m × the row height)
const BAG_LEN = 0.56;
function sandbags(B, R, w, h, d) {
  const along = w >= d, len = along ? w : d, thick = along ? d : w;
  const rows = Math.max(3, Math.round(h / 0.21)), bh = h / rows;
  const X = B.xf;
  if (along) B.xf = { x: X.x, y: X.y, z: X.z, c: -X.s, s: X.c };   // rolls along x: turn the frame a quarter
  for (let r = 0; r < rows; r++) {
    const y0 = r * bh;
    const du = r % 2 ? BAG_LEN / 2 : 0, base = B.xf.y + y0;
    B.uvFn = (u, v) => [u + du, (v - base) * (0.21 / bh) + r * 0.21];   // each row = one row of whole bags, staggered
    pillow(B, 'bag', 0, y0, thick - 0.03, bh + 0.02, -len / 2, len / 2, hex(R.pick(BAG_TONES)));
  }
  B.uvFn = null;
  B.xf = X;
}
function barrel(B, R, r, h) {
  const col = hex(R.pick(BARREL_PAINT));
  cyl(B, 'metal', 0, 0, 0, r * 0.97, h, col, 14);
  for (const y of [0.04, h * 0.33, h * 0.66, h - 0.07]) cyl(B, 'metal', 0, y, 0, r, 0.035, mul(col, 0.8), 14);
  box(B, 'iron', r * 0.35, h, -0.05, r * 0.55, h + 0.012, 0.05, IRON, '-y', false);
}
function car(B, R) {
  const col = hex(R.pick(CAR_PAINT)), L = 2.1, W = 0.93;
  // lower body (side profile in x/y, extruded across the width)
  prism(B, 'paint', [[-L, 0.32], [L - 0.05, 0.32], [L, 0.55], [L - 0.15, 0.98], [-L + 0.2, 1.0], [-L, 0.7]], -W, W, col, true);
  // cabin with sloped screens
  prism(B, 'paint', [[-1.25, 0.98], [0.95, 0.98], [0.45, 1.7], [-1.05, 1.72]], -W + 0.06, W - 0.06, col, true);
  prism(B, 'glass', [[-1.2, 1.02], [0.9, 1.02], [0.43, 1.66], [-1.01, 1.68]], -W + 0.04, W - 0.04, hex(0x2a3438), false);
  // bumpers, lights, wheel arches
  box(B, 'rubber', L - 0.04, 0.3, -W + 0.05, L + 0.06, 0.5, W - 0.05, hex(0x2a2826), '', false);
  box(B, 'rubber', -L - 0.06, 0.3, -W + 0.05, -L + 0.02, 0.5, W - 0.05, hex(0x2a2826), '', false);
  for (const s of [-1, 1]) {
    box(B, 'lamp', L - 0.02, 0.62, s * (W - 0.3) - 0.14, L + 0.01, 0.76, s * (W - 0.3) + 0.14, hex(0xe8e0c8), '', false);
    box(B, 'paint', -L - 0.01, 0.62, s * (W - 0.3) - 0.14, -L + 0.01, 0.76, s * (W - 0.3) + 0.14, hex(0x8a2018), '', false);
  }
  for (const [wx, wz] of [[1.35, 0.82], [-1.35, 0.82], [1.35, -0.82], [-1.35, -0.82]]) {   // tyres flush with the collision box
    const sxf = B.xf; const X = sxf;
    // wheel: a cylinder lying across the car
    B.xf = { x: X.x + wx * X.c + wz * X.s, y: X.y, z: X.z - wx * X.s + wz * X.c, c: X.c, s: X.s };
    const seg = 12, r = 0.36, hw = 0.13;
    for (let i = 0; i < seg; i++) {
      const a0 = 2 * Math.PI * i / seg, a1 = 2 * Math.PI * (i + 1) / seg, am = (a0 + a1) / 2;
      const p = (a, z) => [r * Math.cos(a), r + r * Math.sin(a), z];
      quad(B, 'rubber', [p(a0, -hw), p(a1, -hw), p(a1, hw), p(a0, hw)], [Math.cos(am), Math.sin(am), 0], hex(0x1d1b19), false);
    }
    for (const z of [-hw, hw]) for (let i = 0; i < seg; i += 2) {
      const p = a => [r * 0.62 * Math.cos(2 * Math.PI * a / seg), r + r * 0.62 * Math.sin(2 * Math.PI * a / seg), z * 1.01];
      quad(B, 'metal', [[0, r, z * 1.01], p(i), p(i + 1), p(i + 2)], [0, 0, z], hex(0x8f8d86), false);
    }
    B.xf = sxf;
  }
}
function pole(B, h) {
  cyl(B, 'crate', 0, 0, 0, 0.11, h, hex(0x6a5038), 7);
  box(B, 'crate', -0.9, h - 0.7, -0.06, 0.9, h - 0.58, 0.06, hex(0x5a4430), '', false);
  for (const x of [-0.75, -0.25, 0.25, 0.75]) cyl(B, 'glass', x, h - 0.58, 0, 0.04, 0.12, hex(0xb8d0d0), 6);
}
function tower(B, legH, r, tankH) {
  // braces between the legs (the legs and the tank themselves are drawn by legs/tank props)
  const L = 1.4;
  for (let i = 0; i < 4; i++) {
    const c = [[-L, -L], [L, -L], [L, L], [-L, L]], a = c[i], b = c[(i + 1) % 4];
    for (const [y0, y1] of [[0.6, 3.6], [3.6, 6.6]]) {
      tube(B, 'iron', [a[0], y0, a[1]], [b[0], y1, b[1]], 0.035, IRON);
      tube(B, 'iron', [b[0], y0, b[1]], [a[0], y1, a[1]], 0.035, IRON);
    }
    tube(B, 'iron', [a[0], 3.6, a[1]], [b[0], 3.6, b[1]], 0.04, IRON);
  }
  // ladder up the south side
  for (const x of [-0.25, 0.25]) tube(B, 'iron', [x, 0, L + 0.25], [x, legH + 0.6, L + 0.25], 0.025, IRON);
  for (let y = 0.3; y < legH + 0.5; y += 0.35) tube(B, 'iron', [-0.25, y, L + 0.25], [0.25, y, L + 0.25], 0.018, IRON);
}

/* props: [{t:'crate'|'bags'|'barrel'|'car'|'pole'|'leg'|'tank'|'cap'|'tower'|'block', x, y, z, ry, …size}]
   → material groups like build() */
function props(list, seed) {
  const B = createBuilder(), R = rng(seed || 7);
  for (const p of list) {
    setXf(B, p.x, p.y || 0, p.z, p.ry || 0);
    if (p.t === 'crate') crate(B, R, p.s || 1.2);
    else if (p.t === 'bags') sandbags(B, R, p.w, p.h, p.d);
    else if (p.t === 'barrel') barrel(B, R, p.r, p.h);
    else if (p.t === 'car') car(B, R);
    else if (p.t === 'pole') pole(B, p.h);
    else if (p.t === 'leg') box(B, 'iron', -p.w / 2, 0, -p.d / 2, p.w / 2, p.h, p.d / 2, hex(0x5b4a3e), '-y');
    else if (p.t === 'tank') {
      cyl(B, 'metal', 0, -p.h / 2, 0, p.r, p.h, hex(0x8f8a7e), 18);
      for (const y of [-p.h / 2 + 0.1, 0, p.h / 2 - 0.12]) cyl(B, 'metal', 0, y, 0, p.r + 0.03, 0.06, hex(0x6d685e), 18);
    } else if (p.t === 'cap') {
      const seg = 18, r = p.r, h = p.h;
      for (let i = 0; i < seg; i++) {
        const a0 = 2 * Math.PI * i / seg, a1 = 2 * Math.PI * (i + 1) / seg, am = (a0 + a1) / 2;
        tri(B, 'metal', [r * Math.cos(a0), -h / 2, r * Math.sin(a0)], [r * Math.cos(a1), -h / 2, r * Math.sin(a1)], [0, h / 2, 0], [Math.cos(am), r / h, Math.sin(am)], hex(0x7d786d), false);
      }
    } else if (p.t === 'tower') tower(B, p.h, p.r, 3.2);
    else if (p.t === 'block') {   // concrete wall / pillar / slab with world-scale texture and a coping on long walls
      const hx = p.w / 2, hz = p.d / 2, col = hex(p.dark ? 0x9a948a : 0xc4beb2);
      box(B, 'concrete', -hx, 0, -hz, hx, p.h, hz, col, '-y');
      if (p.h > 1.5 && (p.w > 3 || p.d > 3) && Math.min(p.w, p.d) <= 1.2)
        box(B, 'concrete', -hx - 0.05, p.h, -hz - 0.05, hx + 0.05, p.h + 0.08, hz + 0.05, mul(col, 0.85), '', false);
    }
  }
  B.xf = null;
  const out = {}; let tris = 0;
  for (const k of MATS) {
    const g = B[k]; if (!g.idx.length) continue;
    out[k] = { pos: new Float32Array(g.pos), nrm: new Float32Array(g.nrm), uv: new Float32Array(g.uv), col: new Float32Array(g.col),
      idx: g.pos.length / 3 > 65535 ? new Uint32Array(g.idx) : new Uint16Array(g.idx) };
    tris += g.idx.length / 3;
  }
  out.tris = tris;
  return out;
}

/* buildings: [[x, z, w, d, h, tintIndex]…]; opt: { tints: [hex…], reachable: [[x, z]…] }
   → { plaster: {pos, nrm, uv, col, idx}, stone: …, … , tris } (empty materials left out) */
// opt.part: 'buildings' (only the buildings), 'streets' (only the streets and aprons), or both
function build(buildings, opt) {
  const B = createBuilder(), foot = [];
  const part = opt.part || 'all';
  if (part !== 'streets') for (const b of buildings) foot.push(building(B, b, opt));
  else for (const [bx, bz, w, d] of buildings) foot.push([bx - w / 2, bx + w / 2, bz - d / 2, bz + d / 2]);
  if (part !== 'buildings') streets(B, foot);
  const out = {}; let tris = 0;
  for (const k of MATS) {
    const g = B[k]; if (!g.idx.length) continue;
    out[k] = { pos: new Float32Array(g.pos), nrm: new Float32Array(g.nrm), uv: new Float32Array(g.uv), col: new Float32Array(g.col),
      idx: g.pos.length / 3 > 65535 ? new Uint32Array(g.idx) : new Uint16Array(g.idx) };
    tris += g.idx.length / 3;
  }
  out.tris = tris;
  return out;
}

const SDTown = { build, props, MATS, DEPTH };
if (typeof module !== 'undefined' && module.exports) module.exports = SDTown; else root.SDTown = SDTown;
})(typeof window !== 'undefined' ? window : globalThis);
