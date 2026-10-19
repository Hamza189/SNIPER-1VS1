/* SNIPER DUEL — ¿el personaje animado cabe en las zonas de impacto del servidor (core/hitbox.js)?

   Lee el GLB sin Three.js, aplica los morph targets y el skinning a cada vértice en cada clip (60 Hz) y mide
   cuánto sale cada parte de su zona: cabeza → esfera; tronco y piernas → la caja de torso o de piernas
   (la más cercana); brazos y manos exentos (sujetan el arma). Las zonas se comprimen en vertical con la
   altura de los ojos, como hace el servidor (agachado 1,0 m, deslizándose 0,85 m: el clip lleva el morph).

   node tools/check-character-hitbox.js FILE.glb [--lod 0] [--json out.json] [--tol 0.04]
   Falla (código 1) si en idle/aim/crouch/slide/andar algo sale más de la tolerancia (4 cm; la cabeza
   en reposo, 0). Excepción del propietario: en walk_*, sprint y crouch_walk los pies pueden salir de la
   caja de piernas hasta 45 cm solo en el eje de la marcha (las piernas: muslo, rodilla y pie; el tronco no).                                              */
'use strict';
const fs = require('fs'), path = require('path');
const HB = require(path.join(__dirname, '..', 'core', 'hitbox.js'));
const args = process.argv.slice(2);
const file = args.find(a => a.endsWith('.glb'));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const LOD = +opt('lod', 0), TOL = +opt('tol', 0.04), STRIDE = 0.45;
if (!file) { console.log('uso: node tools/check-character-hitbox.js FILE.glb [--lod 0] [--json out.json]'); process.exit(2); }

const b = fs.readFileSync(file);
let off = 12, J, BIN;
while (off < b.length) { const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4), ch = b.slice(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) J = JSON.parse(ch.toString('utf8')); else if (type === 0x004e4942) BIN = ch; off += 8 + len; }
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function acc(i) {
  const a = J.accessors[i], bv = J.bufferViews[a.bufferView], n = NC[a.type], base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const dv = new DataView(BIN.buffer, BIN.byteOffset), out = new Float64Array(a.count * n);
  const sz = { 5126: 4, 5123: 2, 5121: 1, 5125: 4 }[a.componentType], stride = bv.byteStride || sz * n;
  const rd = { 5126: o => dv.getFloat32(o, true), 5123: o => dv.getUint16(o, true), 5121: o => dv.getUint8(o), 5125: o => dv.getUint32(o, true) }[a.componentType];
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = rd(base + k * stride + c * sz);
  return { d: out, n, count: a.count };
}
// --- matrices 4x4 (columna mayor, como glTF)
const mul = (a, c) => { const o = new Float64Array(16); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { let s = 0; for (let q = 0; q < 4; q++) s += a[q * 4 + r] * c[k * 4 + q]; o[k * 4 + r] = s; } return o; };
function trs(t, q, s) {
  const [x, y, z, w] = q || [0, 0, 0, 1], [sx, sy, sz] = s || [1, 1, 1], [tx, ty, tz] = t || [0, 0, 0];
  return Float64Array.from([(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1]);
}
const nodes = J.nodes, parent = new Array(nodes.length).fill(-1);
nodes.forEach((n, i) => (n.children || []).forEach(c => parent[c] = i));
const meshNode = nodes.findIndex(n => n.name === 'personaje_LOD' + LOD);
if (meshNode < 0) { console.log('no hay personaje_LOD' + LOD); process.exit(2); }
const prim = J.meshes[nodes[meshNode].mesh].primitives[0], skin = J.skins[nodes[meshNode].skin];
const POS = acc(prim.attributes.POSITION).d, JO = acc(prim.attributes.JOINTS_0).d, WE = acc(prim.attributes.WEIGHTS_0).d, ZO = acc(prim.attributes._ZONE).d;
const TG = (prim.targets || []).map(t => acc(t.POSITION).d), TN = (J.meshes[nodes[meshNode].mesh].extras || {}).targetNames || [];
const IBM = acc(skin.inverseBindMatrices).d, NV = POS.length / 3, joints = skin.joints;
const KH = (J.scenes[0].extras || {}).heightMorphs || { agachado: 1 / 1.62, deslizar: 0.85 / 1.62 };

function sampleTrack(times, vals, n, t, rot) {
  let k = 0; while (k < times.length - 1 && times[k + 1] < t) k++;
  if (t <= times[0]) return Array.from(vals.slice(0, n));
  if (k >= times.length - 1) return Array.from(vals.slice((times.length - 1) * n, times.length * n));
  const t0 = times[k], t1 = times[k + 1], u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
  const a = vals.slice(k * n, k * n + n), c = vals.slice((k + 1) * n, (k + 1) * n + n);
  if (rot) { let d = 0; for (let i = 0; i < 4; i++) d += a[i] * c[i]; const s = d < 0 ? -1 : 1; const o = [0, 1, 2, 3].map(i => a[i] * (1 - u) + s * c[i] * u); const L = Math.hypot(...o); return o.map(v => v / L); }
  return [...Array(n)].map((_, i) => a[i] * (1 - u) + c[i] * u);
}
function evaluate(anim, t) {
  const st = nodes.map(n => ({ t: n.translation || [0, 0, 0], r: n.rotation || [0, 0, 0, 1], s: n.scale || [1, 1, 1] }));
  let mw = (J.meshes[nodes[meshNode].mesh].weights || []).slice();
  for (const ch of anim.channels) {
    const sm = anim.samplers[ch.sampler], times = acc(sm.input).d, out = acc(sm.output), p = ch.target.path;
    if (p === 'weights') { if (ch.target.node === meshNode) mw = sampleTrack(times, out.d, mw.length, t, false); continue; }
    st[ch.target.node][p === 'translation' ? 't' : p === 'rotation' ? 'r' : 's'] = sampleTrack(times, out.d, p === 'rotation' ? 4 : 3, t, p === 'rotation');
  }
  const W = new Array(nodes.length);
  const world = i => W[i] || (W[i] = parent[i] < 0 ? trs(st[i].t, st[i].r, st[i].s) : mul(world(parent[i]), trs(st[i].t, st[i].r, st[i].s)));
  const SM = joints.map((j, k) => mul(world(j), IBM.subarray(k * 16, k * 16 + 16)));
  let k = 1; TN.forEach((n, i) => { if (KH[n]) k -= (mw[i] || 0) * (1 - KH[n]); });
  return { SM, mw, k };
}
function vertex(e, i, out) {
  let x = POS[i * 3], y = POS[i * 3 + 1], z = POS[i * 3 + 2];
  e.mw.forEach((w, m) => { if (w) { x += TG[m][i * 3] * w; y += TG[m][i * 3 + 1] * w; z += TG[m][i * 3 + 2] * w; } });
  out[0] = out[1] = out[2] = 0;
  for (let c = 0; c < 4; c++) { const w = WE[i * 4 + c]; if (!w) continue; const M = e.SM[JO[i * 4 + c]];
    out[0] += w * (M[0] * x + M[4] * y + M[8] * z + M[12]); out[1] += w * (M[1] * x + M[5] * y + M[9] * z + M[13]); out[2] += w * (M[2] * x + M[6] * y + M[10] * z + M[14]); }
  return out;
}
const P = HB.PARTS, head = P.find(p => p.part === 'head'), boxes = P.filter(p => p.type === 'box');
function measure(anim, t, stride) {
  const e = evaluate(anim, t), k = e.k, v = [0, 0, 0];
  const r = { head: -1, body: [0, 0, 0], minY: Infinity, maxY: -Infinity, k, worst: null, wn: 0, ax: [null, null, null] };
  for (let i = 0; i < NV; i++) {
    const zone = ZO[i]; vertex(e, i, v);
    r.minY = Math.min(r.minY, v[1]); r.maxY = Math.max(r.maxY, v[1]);
    if (zone === 3) continue;
    if (zone === 0) { r.head = Math.max(r.head, Math.hypot(v[0], v[1] - head.y * k, v[2]) - head.r); continue; }
    // tronco: vale cualquiera de las tres zonas (el cuello cae en la esfera); piernas: su caja o la del torso
    // (cadera), y en la marcha la caja de piernas se alarga hasta 45 cm en el eje del paso
    const sh = zone === 1 ? Math.hypot(v[0], v[1] - head.y * k, v[2]) - head.r : Infinity;
    if (sh <= 0) continue;
    let best = [sh, 0, 0], bn = sh;
    for (const B of boxes) { const legs = B.part === 'legs', sx = legs && zone === 2 && stride === 0 ? STRIDE : 0, sz = legs && zone === 2 && stride === 2 ? STRIDE : 0;
      const ex = [Math.max(0, Math.abs(v[0]) - B.hx - sx), Math.max(0, Math.abs(v[1] - B.y * k) - B.hy * k), Math.max(0, Math.abs(v[2]) - B.hz - sz)];
      const n = Math.hypot(...ex); if (n < bn) { bn = n; best = ex; } }
    for (let a = 0; a < 3; a++) { if (best[a] > r.body[a]) r.ax[a] = { i, at: v.map(x => +x.toFixed(3)) }; r.body[a] = Math.max(r.body[a], best[a]); }
    if (bn > r.wn) { r.wn = bn; r.worst = { i, at: v.map(x => +x.toFixed(3)), ex: best.map(x => +(x * 100).toFixed(1)) }; }
  }
  return r;
}
const CHECK = /^(idle_rifle|aim_rifle|aim_pistol|idle_pistol|walk_|sprint|crouch_|slide)/;
const report = { file, lod: LOD, tolerance: TOL, clips: {}, failures: [] };
// pose de reposo (sin animación): la cabeza tiene que caber en la esfera sin tolerancia
const rest = measure({ channels: [], samplers: [] }, 0);
report.rest = { headExcessCm: +(rest.head * 100).toFixed(2), bodyExcessCm: rest.body.map(v => +(v * 100).toFixed(2)), height: +rest.maxY.toFixed(3) };
if (rest.head > 1e-4) report.failures.push('reposo: la cabeza sale ' + (rest.head * 100).toFixed(1) + ' cm de su esfera');
if (rest.maxY > 1.78 + 1e-3) report.failures.push('reposo: altura ' + rest.maxY.toFixed(3) + ' m > 1,78');
for (const an of J.animations) {
  const dur = (an.extras && an.extras.duration) || Math.max(...an.samplers.map(s => { const a = J.accessors[s.input]; return a.max ? a.max[0] : 0; }));
  const n = Math.max(1, Math.ceil(dur * 60)), m = { head: -1, body: [0, 0, 0], minY: Infinity, maxY: -Infinity, wn: 0, worst: null, ax: [null, null, null] };
  const stride = !CHECK.test(an.name) ? -1 : /^walk_(left|right)/.test(an.name) ? 0 : /^(walk_|sprint|crouch_walk)/.test(an.name) ? 2 : -1;
  for (let f = 0; f <= n; f++) { const r = measure(an, Math.min(dur, f / 60), stride); m.head = Math.max(m.head, r.head); for (let a = 0; a < 3; a++) { if (r.body[a] > m.body[a]) m.ax[a] = Object.assign({ t: +(f / 60).toFixed(3) }, r.ax[a]); m.body[a] = Math.max(m.body[a], r.body[a]); } m.minY = Math.min(m.minY, r.minY); m.maxY = Math.max(m.maxY, r.maxY); if (r.wn > m.wn) { m.wn = r.wn; m.worst = Object.assign({ t: +(f / 60).toFixed(3) }, r.worst); } }
  const row = { worst: m.worst, worstAxis: m.ax, headCm: +(Math.max(0, m.head) * 100).toFixed(1), bodyCm: m.body.map(v => +(v * 100).toFixed(1)), minY: +m.minY.toFixed(3), maxY: +m.maxY.toFixed(3), checked: CHECK.test(an.name) };
  report.clips[an.name] = row;
  if (!row.checked) continue;
  if (m.head > TOL + 1e-4) report.failures.push(an.name + ': cabeza ' + row.headCm + ' cm fuera de la esfera');
  const lim = [TOL, TOL, TOL];
  m.body.forEach((v, a) => { if (v > lim[a] + 1e-4) report.failures.push(an.name + ': cuerpo ' + (v * 100).toFixed(1) + ' cm fuera en ' + 'xyz'[a] + ' (límite ' + (lim[a] * 100) + ')'); });
}
const pad = (s, n) => String(s).padEnd(n);
console.log('reposo: cabeza ' + report.rest.headExcessCm + ' cm · cuerpo x/y/z ' + report.rest.bodyExcessCm.join(' / ') + ' cm · altura ' + report.rest.height + ' m');
console.log(pad('clip', 15) + pad('cabeza cm', 11) + pad('cuerpo x/y/z cm', 22) + 'y mín / máx');
for (const [n, r] of Object.entries(report.clips)) console.log(pad(n, 15) + pad(r.headCm, 11) + pad(r.bodyCm.join(' / '), 22) + r.minY + ' / ' + r.maxY + (r.checked ? '' : '  (no se exige)') + (args.includes('--detail') && r.worst ? '  peor x/y/z: ' + JSON.stringify(r.worstAxis.map(w => w && w.at)) : ''));
const jp = opt('json', null); if (jp) fs.writeFileSync(jp, JSON.stringify(report, null, 1));
if (report.failures.length) { console.log('\n✘ ' + report.failures.join('\n✘ ')); process.exit(1); }
console.log('\n✔ cabe en las zonas de impacto (±' + TOL * 100 + ' cm)');
