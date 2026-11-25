/* ILUMINACIÓN HORNEADA, paso 2 de 3 (docs/ILUMINACION-HORNEADA.md): el segundo juego de UV (uv2) y el atlas.
     node tools/lightmap/pack.js [--solo encalada] [--size 2048]
   Lee lo que sacó dump.js; las mallas que RECIBEN horneado son las del PUEBLO generadas por código (p3_* de
   client/town3.js y casas_* de client/casas.js); todas las demás (kit, coches, E10…) solo hacen sombra en Blender.
   Cada trozo plano conectado (un «chart»: los cuadriláteros de town3/casas tienen sus propios 4 vértices) se proyecta
   sobre su plano y se coloca en el atlas por estantes, con margen alrededor para el filtrado y los mipmaps. Los vértices
   que no reciben (fuera de --solo) apuntan a un cuadrado blanco reservado en la esquina (0,0): sin efecto.
   Escribe assets/lightmaps/pueblo.json + pueblo_uv2.bin (lo que carga el juego) y .work/bake.json + uv2.f32 (para
   Blender). Determinista: misma entrada → mismo atlas. */
'use strict';
const fs = require('fs'), path = require('path');
const LM = require('../../client/lightmap.js');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const WORK = path.join(__dirname, '.work'), SRC = path.join(WORK, 'pueblo');
const OUTD = path.join(__dirname, '..', '..', 'assets', 'lightmaps');
const SIZE = +(arg('size') || 2048), PAD = +(arg('pad') || 2), WHITE = 4;
const SOLO = arg('solo');
const HOUSES = require('../../client/casas.js').HOUSES;
const J = require(SRC + '.json'), B = fs.readFileSync(SRC + '.bin');
const f32 = (o, n) => new Float32Array(B.buffer.slice(B.byteOffset + o, B.byteOffset + o + n * 4));
const u32 = (o, n) => new Uint32Array(B.buffer.slice(B.byteOffset + o, B.byteOffset + o + n * 4));

// which meshes receive, and how many texels per metre relative to the rest (the town outside is far: fewer)
function scaleOf(name) {
  if (!/^(p3_|casas_)/.test(name) || /^p3_(sign|hills)/.test(name)) return 0;
  if (/^p3_backdrop/.test(name)) return 0.35;
  if (/^p3_ground_earth/.test(name)) return 0.5;
  return 1;
}
let region = null;
if (SOLO) {
  const H = HOUSES.find(h => h.id === SOLO); if (!H) throw new Error('casa desconocida: ' + SOLO);
  region = { x0: H.x - H.w / 2 - 0.6, x1: H.x + H.w / 2 + 0.6, z0: H.z - H.d / 2 - 0.6, z1: H.z + H.d / 2 + 0.6, y1: H.h + 2 };
}
const names = {}; for (const m of J.meshes) names[m.name + '#' + m.verts] = (names[m.name + '#' + m.verts] || 0) + 1;

// charts of every receiving mesh
const charts = [], meshes = [];
for (const m of J.meshes) {
  const sc = scaleOf(m.name); if (!sc || names[m.name + '#' + m.verts] > 1) continue;
  if (SOLO && !/^casas_/.test(m.name)) continue;
  const P = f32(m.pos, m.verts * 3), N = f32(m.nrm, m.verts * 3), I = u32(m.ix, m.idx);
  // union-find over shared vertex indices
  const par = new Int32Array(m.verts).map((_, i) => i), find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
  for (let t = 0; t < I.length; t += 3) { join(I[t], I[t + 1]); join(I[t], I[t + 2]); }
  const base = Int32Array.from({ length: m.verts }, (_, i) => find(i));   // the pieces before welding
  // weld: separate quads of the same plane that touch (same position, same normal) are one piece of wall → no seams,
  // and far fewer pieces (each piece costs its margin in the atlas)
  { const seen = new Map(), q = x => Math.round(x * 500);
    for (let t = 0; t < I.length; t += 3) {
      const i = I[t] * 3, j = I[t + 1] * 3, k = I[t + 2] * 3;
      let nx = (P[j + 1] - P[i + 1]) * (P[k + 2] - P[i + 2]) - (P[j + 2] - P[i + 2]) * (P[k + 1] - P[i + 1]),
        ny = (P[j + 2] - P[i + 2]) * (P[k] - P[i]) - (P[j] - P[i]) * (P[k + 2] - P[i + 2]),
        nz = (P[j] - P[i]) * (P[k + 1] - P[i + 1]) - (P[j + 1] - P[i + 1]) * (P[k] - P[i]);
      const l = Math.hypot(nx, ny, nz); if (l < 1e-12) continue; nx /= l; ny /= l; nz /= l;
      const nk = Math.round(nx * 50) + ',' + Math.round(ny * 50) + ',' + Math.round(nz * 50) + ',' + Math.round((nx * P[i] + ny * P[i + 1] + nz * P[i + 2]) * 200);
      for (const v of [I[t], I[t + 1], I[t + 2]]) {
        const key = nk + '|' + q(P[v * 3]) + ',' + q(P[v * 3 + 1]) + ',' + q(P[v * 3 + 2]);
        const o = seen.get(key); if (o == null) seen.set(key, v); else join(o, v);
      }
    } }
  const groups = new Map();
  for (let t = 0; t < I.length; t += 3) { const r = find(I[t]); (groups.get(r) || groups.set(r, []).get(r)).push(t); }
  const entry = { m, sc, P, N, uv: new Float32Array(m.verts * 2).fill(-1), charts: 0 };
  meshes.push(entry);
  // a welded piece that is mostly empty (the kerb round the plaza: a ring 45 m wide) wastes the atlas: back to its parts
  const todo = [...groups.values()].map(tris => ({ tris, split: true }));
  while (todo.length) {
    const { tris, split } = todo.shift();
    // area-weighted normal and the vertices of this chart
    let nx = 0, ny = 0, nz = 0; const vs = new Set();
    for (const t of tris) {
      const i = I[t] * 3, j = I[t + 1] * 3, k = I[t + 2] * 3; vs.add(I[t]); vs.add(I[t + 1]); vs.add(I[t + 2]);
      const ux = P[j] - P[i], uy = P[j + 1] - P[i + 1], uz = P[j + 2] - P[i + 2], vx = P[k] - P[i], vy = P[k + 1] - P[i + 1], vz = P[k + 2] - P[i + 2];
      nx += uy * vz - uz * vy; ny += uz * vx - ux * vz; nz += ux * vy - uy * vx;
    }
    const nl = Math.hypot(nx, ny, nz); if (nl < 1e-9) continue;
    nx /= nl; ny /= nl; nz /= nl;
    const V = [...vs].sort((a, b) => a - b);
    if (region) {   // --solo: only charts inside the house's box
      let cx = 0, cy = 0, cz = 0; for (const v of V) { cx += P[v * 3]; cy += P[v * 3 + 1]; cz += P[v * 3 + 2]; }
      cx /= V.length; cy /= V.length; cz /= V.length;
      if (cx < region.x0 || cx > region.x1 || cz < region.z0 || cz > region.z1 || cy > region.y1) continue;
    }
    // tangent frame: u horizontal on walls (x on floors), v up the wall
    let ux = 1, uy = 0, uz = 0;
    if (Math.abs(ny) < 0.9) { ux = nz; uy = 0; uz = -nx; } else { const d = ux * nx; ux -= d * nx; uy -= d * ny; uz -= d * nz; }
    const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9; const pr = [];
    for (const v of V) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], pu = x * ux + y * uy + z * uz, pv = x * vx + y * vy + z * vz; pr.push(pu, pv); u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
    if (split && (u1 - u0) * (v1 - v0) > 2 && nl / 2 < 0.3 * (u1 - u0) * (v1 - v0)) {
      const parts = new Map(); for (const t of tris) { const r = base[I[t]]; (parts.get(r) || parts.set(r, []).get(r)).push(t); }
      if (parts.size > 1) { for (const p of parts.values()) todo.push({ tris: p, split: false }); continue; }
    }
    charts.push({ e: entry, V, pr, u0, v0, eu: u1 - u0, ev: v1 - v0, sc, id: charts.length });
    entry.charts++;
  }
}
// packing at density d (texels per metre): shelves, tallest first; returns the atlas height used
function pack(d, W) {
  const items = charts.map(c => { const dd = Math.min(d * c.sc, 1000 / Math.max(c.eu, c.ev, 1e-3)); return { c, dd, w: Math.max(1, Math.ceil(c.eu * dd)) + 2 * PAD, h: Math.max(1, Math.ceil(c.ev * dd)) + 2 * PAD }; });
  items.sort((a, b) => b.h - a.h || b.w - a.w || a.c.id - b.c.id);
  let x = WHITE, y = 0, sh = WHITE;
  for (const it of items) {
    if (x + it.w > W) { y += sh; x = 0; sh = 0; }
    it.x = x; it.y = y; x += it.w; sh = Math.max(sh, it.h);
  }
  return { items, h: y + sh };
}
const W = SIZE;
let lo = 0.5, hi = SOLO ? 64 : 32, best = null;
for (let k = 0; k < 24; k++) { const d = (lo + hi) / 2, r = pack(d, W); if (r.h <= SIZE) { lo = d; best = Object.assign(r, { d }); } else hi = d; }
if (!best) throw new Error('no cabe ni a 0,5 texeles por metro');
const H = SIZE;
for (const it of best.items) {
  const c = it.c, uv = c.e.uv;
  for (let i = 0; i < c.V.length; i++) {
    uv[c.V[i] * 2] = (it.x + PAD + (c.pr[i * 2] - c.u0) * it.dd) / W;
    uv[c.V[i] * 2 + 1] = (it.y + PAD + (c.pr[i * 2 + 1] - c.v0) * it.dd) / H;
  }
}
// vertices that do not receive → the white corner
for (const e of meshes) for (let i = 0; i < e.uv.length; i += 2) if (e.uv[i] < 0) { e.uv[i] = (WHITE / 2) / W; e.uv[i + 1] = (WHITE / 2) / H; }

fs.mkdirSync(OUTD, { recursive: true });
const index = { made: new Date().toISOString().slice(0, 10), w: W, h: H, density: +best.d.toFixed(2), solo: SOLO || null, meshes: [] };
const u16 = [], f = []; let off = 0;
const bake = { w: W, h: H, pad: PAD, white: WHITE, meshes: [], rects: best.items.map(it => [it.x, it.y, it.w, it.h, it.c.e.m.name, +it.c.eu.toFixed(2), +it.c.ev.toFixed(2)]) };
const recv = new Map(meshes.map(e => [e.m, e]));
for (const m of J.meshes) {
  const e = recv.get(m), bm = { name: m.name, mat: m.mat, verts: m.verts, idx: m.idx, pos: m.pos, nrm: m.nrm, ix: m.ix, uv: -1 };
  if (e && e.charts) {
    index.meshes.push({ name: m.name, verts: m.verts, sig: m.sig, off });
    for (let i = 0; i < e.uv.length; i++) u16.push(Math.round(Math.min(1, Math.max(0, e.uv[i])) * 65535));
    off += e.uv.length * 2;
    bm.uv = f.length * 4; for (let i = 0; i < e.uv.length; i++) f.push(e.uv[i]);
  }
  bake.meshes.push(bm);
}
fs.writeFileSync(path.join(OUTD, 'pueblo.json'), JSON.stringify(index));
fs.writeFileSync(path.join(OUTD, 'pueblo_uv2.bin'), Buffer.from(new Uint16Array(u16).buffer));
fs.writeFileSync(path.join(WORK, 'bake.json'), JSON.stringify(bake));
fs.writeFileSync(path.join(WORK, 'uv2.f32'), Buffer.from(new Float32Array(f).buffer));
const used = best.items.reduce((s, it) => s + it.w * it.h, 0);
console.log('reciben', index.meshes.length, 'mallas,', charts.length, 'trozos · densidad', best.d.toFixed(2), 'texeles/m · atlas', W + '×' + H,
  '· ocupado', (100 * used / (W * H)).toFixed(0) + ' %', '· uv2', (off / 1024).toFixed(0) + ' KB');
