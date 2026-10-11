/* Adds vertex normals to the primitives of a GLB that has none (trimesh exports without them unless
   include_normals=True). Area-weighted average of the faces around each vertex. It refuses when a vertex is
   shared by faces at more than 30°: that geometry needs split vertices (hard edges) from the exporter, and
   averaging would smooth the corners wrongly.  Everything else in the file is copied byte for byte.
   node tools/glb-add-normals.js IN.glb OUT.glb            (OUT is a new file; IN is never changed)        */
'use strict';
const fs = require('fs');
const [IN, OUT] = process.argv.slice(2);
if (!IN || !OUT || IN === OUT) { console.log('uso: node tools/glb-add-normals.js IN.glb OUT.glb'); process.exit(2); }
const buf = fs.readFileSync(IN);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('no es un GLB');
const jl = buf.readUInt32LE(12), J = JSON.parse(buf.slice(20, 20 + jl).toString('utf8'));
const binStart = 20 + jl + 8, binLen = buf.readUInt32LE(20 + jl), BIN = buf.slice(binStart, binStart + binLen);
const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function read(ai) {
  const a = J.accessors[ai], bv = J.bufferViews[a.bufferView], n = NC[a.type], A = CT[a.componentType];
  const stride = bv.byteStride || n * A.BYTES_PER_ELEMENT, off = (bv.byteOffset || 0) + (a.byteOffset || 0), out = new Float64Array(a.count * n);
  const dv = new DataView(BIN.buffer, BIN.byteOffset);
  const get = { 5126: (o) => dv.getFloat32(o, true), 5125: (o) => dv.getUint32(o, true), 5123: (o) => dv.getUint16(o, true), 5121: (o) => dv.getUint8(o) }[a.componentType];
  for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = get(off + i * stride + c * A.BYTES_PER_ELEMENT);
  return out;
}
const extra = []; let extraLen = 0, added = 0, worst = 0, sharpShared = 0;
const binAligned = Math.ceil(binLen / 4) * 4;
for (const m of J.meshes) for (const p of m.primitives) {
  if (p.attributes.NORMAL != null || (p.mode != null && p.mode !== 4)) continue;
  const P = read(p.attributes.POSITION), nv = P.length / 3;
  const I = p.indices != null ? read(p.indices) : Float64Array.from({ length: nv }, (_, i) => i);
  const N = new Float64Array(nv * 3), first = new Float64Array(nv * 3), seen = new Uint8Array(nv);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx, fl = Math.hypot(fx, fy, fz);
    if (fl < 1e-12) continue;
    for (const v of [a, b, c]) {
      const k = v / 3;
      if (!seen[k]) { seen[k] = 1; first[v] = fx / fl; first[v + 1] = fy / fl; first[v + 2] = fz / fl; }
      else { const dot = (first[v] * fx + first[v + 1] * fy + first[v + 2] * fz) / fl; const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI; if (ang > worst) worst = ang; if (ang > 30) sharpShared++; }
      N[v] += fx; N[v + 1] += fy; N[v + 2] += fz;
    }
  }
  const F = new Float32Array(nv * 3);
  for (let k = 0; k < nv; k++) { const l = Math.hypot(N[k * 3], N[k * 3 + 1], N[k * 3 + 2]) || 1; F[k * 3] = N[k * 3] / l; F[k * 3 + 1] = N[k * 3 + 1] / l; F[k * 3 + 2] = N[k * 3 + 2] / l; if (!seen[k]) F[k * 3 + 1] = 1; }
  const bytes = Buffer.from(F.buffer);
  J.bufferViews.push({ buffer: 0, byteOffset: binAligned + extraLen, byteLength: bytes.length, target: 34962 });
  J.accessors.push({ bufferView: J.bufferViews.length - 1, componentType: 5126, count: nv, type: 'VEC3' });
  p.attributes.NORMAL = J.accessors.length - 1;
  extra.push(bytes); extraLen += bytes.length; added++;
}
console.log('primitivas con normales nuevas: ' + added + ' · mayor ángulo entre caras que comparten vértice: ' + worst.toFixed(1) + '°');
if (sharpShared) { console.log('✘ ' + sharpShared + ' vértices compartidos por caras a más de 30°: hace falta exportar con normales (aristas duras) desde el origen'); process.exit(1); }
if (!added) { console.log('nada que hacer: todas las primitivas ya tenían normales'); process.exit(0); }
const newBin = Buffer.concat([BIN, Buffer.alloc(binAligned - binLen), ...extra]);
J.buffers[0].byteLength = newBin.length;
J.asset.generator = (J.asset.generator || '') + ' + sniper-duel glb-add-normals';
let js = Buffer.from(JSON.stringify(J)); if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - js.length % 4, 0x20)]);
const out = Buffer.alloc(12 + 8 + js.length + 8 + newBin.length);
out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
out.writeUInt32LE(js.length, 12); out.writeUInt32LE(0x4e4f534a, 16); js.copy(out, 20);
out.writeUInt32LE(newBin.length, 20 + js.length); out.writeUInt32LE(0x004e4942, 24 + js.length); newBin.copy(out, 28 + js.length);
fs.writeFileSync(OUT, out);
console.log('✔ escrito ' + OUT + ' (' + (out.length / 1048576).toFixed(2) + ' MB)');
