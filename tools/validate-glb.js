/* Validates a 3D asset (GLB) against the SNIPER DUEL asset contract (docs/ASSETS-3D.md) before it goes into
   the game. Reads the file itself (no Three.js): structure, units and axes, origin, triangles per LOD, materials,
   textures (sizes from the image headers), extensions the r128 loader cannot read, and — with --box — whether the
   model respects the collision box of its slot in the map (no false cover).

   node tools/validate-glb.js FILE.glb [--box W,D,H] [--lod0 N] [--lod1 N] [--lod2 N] [--json out.json]
     --box   footprint W × D (m) and wall height H (m) of the collision box the model must fit
   Exit code 1 when a hard rule fails (the asset must not be integrated as it is).                     */
'use strict';
const fs = require('fs');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--') && !/^[\d.,]+$/.test(a));
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
if (!file) { console.log('uso: node tools/validate-glb.js FILE.glb [--box W,D,H] [--json out.json]'); process.exit(2); }

const BUDGET = { lod0: +(opt('lod0') || 15000), lod1: +(opt('lod1') || 6000), lod2: +(opt('lod2') || 1500), materials: 8, tex: 2048, fileMB: 6 };
const UNSUPPORTED = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu', 'KHR_mesh_quantization', 'EXT_texture_webp', 'KHR_materials_variants'];

function readGLB(path) {
  const b = fs.readFileSync(path);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('no es un GLB (falta la cabecera glTF)');
  const version = b.readUInt32LE(4);
  let off = 12, json = null, bin = null;
  while (off < b.length) {
    const len = b.readUInt32LE(off), type = b.readUInt32LE(off + 4), chunk = b.slice(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8')); else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  return { version, json, bin, size: b.length };
}
const COMP = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
function accessor(g, i) {
  const a = g.json.accessors[i], bv = g.json.bufferViews[a.bufferView], [Arr, sz] = COMP[a.componentType], n = NCOMP[a.type];
  const stride = bv.byteStride || sz * n, base = (bv.byteOffset || 0) + (a.byteOffset || 0), out = new Float64Array(a.count * n);
  const dv = new DataView(g.bin.buffer, g.bin.byteOffset);
  const rd = { 5120: o => dv.getInt8(o), 5121: o => dv.getUint8(o), 5122: o => dv.getInt16(o, true), 5123: o => dv.getUint16(o, true), 5125: o => dv.getUint32(o, true), 5126: o => dv.getFloat32(o, true) }[a.componentType];
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = rd(base + k * stride + c * sz);
  return { data: out, n, count: a.count, min: a.min, max: a.max };
}
function imageSize(g, img) {
  let buf = null;
  if (img.bufferView != null) { const bv = g.json.bufferViews[img.bufferView]; buf = g.bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength); }
  if (!buf) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'png', bytes: buf.length };
  if (buf[0] === 0xff && buf[1] === 0xd8) { let o = 2; while (o < buf.length) { if (buf[o] !== 0xff) { o++; continue; } const m = buf[o + 1], l = buf.readUInt16BE(o + 2); if (m >= 0xc0 && m <= 0xc3) return { w: buf.readUInt16BE(o + 7), h: buf.readUInt16BE(o + 5), type: 'jpeg', bytes: buf.length }; o += 2 + l; } }
  return { w: 0, h: 0, type: img.mimeType || '?', bytes: buf.length };
}
// world matrices of the node tree
function mat4mul(a, b) { const o = new Array(16).fill(0); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
function nodeMatrix(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}

const R = { file, ok: true, errors: [], warnings: [], info: {} };
const err = m => { R.errors.push(m); R.ok = false; }, warn = m => R.warnings.push(m);
let g;
try { g = readGLB(file); } catch (e) { console.log('✘ ' + e.message); process.exit(1); }
const J = g.json;
R.info.sizeMB = +(g.size / 1048576).toFixed(2);
R.info.generator = J.asset && J.asset.generator;
if (!J.asset || J.asset.version !== '2.0') err('glTF ' + (J.asset && J.asset.version) + ': hace falta glTF 2.0');
if (g.size > BUDGET.fileMB * 1048576) err('archivo de ' + R.info.sizeMB + ' MB (máximo ' + BUDGET.fileMB + ' MB)');
for (const e of (J.extensionsRequired || []).concat(J.extensionsUsed || [])) if (UNSUPPORTED.includes(e)) err('usa ' + e + ': el cargador de Three.js r128 del juego no lo lee (exportar sin compresión)');
if ((J.animations || []).length) warn((J.animations || []).length + ' animaciones (el contrato las pide solo si se acuerdan)');
if ((J.cameras || []).length || (J.extensions && J.extensions.KHR_lights_punctual)) warn('trae cámaras o luces: el juego las ignora (mejor quitarlas)');

// geometry: bounding box in world space, triangles per top-level node (LODs by name), attributes
const stats = {}; let bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; const allVerts = [];
const walk = (ni, parent, top) => {
  const n = J.nodes[ni], M = mat4mul(parent, nodeMatrix(n));
  const name = top == null ? (n.name || 'node' + ni) : top;
  if (n.mesh != null) {
    const st = stats[name] || (stats[name] = { tris: 0, prims: 0, mats: new Set(), noNormals: 0, noUV: 0 });
    for (const p of J.meshes[n.mesh].primitives) {
      st.prims++; if (p.material != null) st.mats.add(p.material);
      if (p.attributes.NORMAL == null) st.noNormals++;
      if (p.attributes.TEXCOORD_0 == null) st.noUV++;
      const pos = accessor(g, p.attributes.POSITION);
      const idxCount = p.indices != null ? J.accessors[p.indices].count : pos.count;
      if ((p.mode == null ? 4 : p.mode) === 4) st.tris += idxCount / 3;
      for (let k = 0; k < pos.count; k++) {
        const x = pos.data[k * 3], y = pos.data[k * 3 + 1], z = pos.data[k * 3 + 2];
        const wx = M[0] * x + M[4] * y + M[8] * z + M[12], wy = M[1] * x + M[5] * y + M[9] * z + M[13], wz = M[2] * x + M[6] * y + M[10] * z + M[14];
        bb = [Math.min(bb[0], wx), Math.min(bb[1], wy), Math.min(bb[2], wz), Math.max(bb[3], wx), Math.max(bb[4], wy), Math.max(bb[5], wz)];
        if (/LOD0|^[^_]*$/i.test(name) || !/LOD\d/i.test(name)) allVerts.push([wx, wy, wz]);
      }
    }
  }
  for (const c of n.children || []) walk(c, M, name);
};
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const ni of (J.scenes[J.scene || 0].nodes)) walk(ni, I, null);
R.info.bounds = { min: bb.slice(0, 3).map(v => +v.toFixed(3)), max: bb.slice(3).map(v => +v.toFixed(3)), size: [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]].map(v => +v.toFixed(3)) };
R.info.nodes = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { tris: v.tris, materials: v.mats.size, primitives: v.prims }]));
const size = R.info.bounds.size;
if (size[1] > 60 || Math.max(size[0], size[2]) > 80) err('mide ' + size.join(' × ') + ' m: ¿está en centímetros? (1 unidad = 1 metro)');
if (size[1] < 0.05 && Math.max(size[0], size[2]) > 1) warn('casi plano en Y: ¿el eje vertical es Y? (glTF: +Y arriba)');
if (Math.abs(bb[1]) > 0.05) warn('el punto más bajo está en y = ' + bb[1].toFixed(3) + ' m (el contrato pide el origen a ras de suelo)');
const cx = (bb[0] + bb[3]) / 2, cz = (bb[2] + bb[5]) / 2;
for (const [k, v] of Object.entries(stats)) { if (v.noNormals) err(k + ': ' + v.noNormals + ' primitivas sin normales'); if (v.noUV) warn(k + ': ' + v.noUV + ' primitivas sin UV (no podrán llevar textura)'); }
// LODs: <id>_LOD0 / _LOD1 / _LOD2 at the top of the tree
const lods = Object.keys(stats).filter(k => /_LOD\d$/i.test(k));
R.info.lods = lods;
for (const k of lods) { const l = +k.slice(-1), lim = BUDGET['lod' + l]; if (lim && stats[k].tris > lim) err(k + ': ' + stats[k].tris + ' triángulos (presupuesto ' + lim + ')'); if (stats[k].mats.size > BUDGET.materials) warn(k + ': ' + stats[k].mats.size + ' materiales (cada uno es una llamada de dibujo)'); }
if (!lods.length) warn('sin nodos _LOD0 / _LOD1 / _LOD2 (el contrato pide tres niveles para ALTO / MEDIO / BAJO)');
// materials and textures
R.info.materials = (J.materials || []).map(m => ({ name: m.name, alpha: m.alphaMode || 'OPAQUE', double: !!m.doubleSided, baseColor: !!(m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture), normal: !!m.normalTexture, orm: !!(m.pbrMetallicRoughness && m.pbrMetallicRoughness.metallicRoughnessTexture), ao: !!m.occlusionTexture }));
for (const m of R.info.materials) if (m.alpha === 'BLEND') warn('material ' + m.name + ': transparencia BLEND (mejor MASK para vegetación; BLEND solo vidrio)');
R.info.textures = (J.images || []).map((img, i) => Object.assign({ name: img.name || 'img' + i }, imageSize(g, img) || {}));
for (const t of R.info.textures) { if (t.w > BUDGET.tex || t.h > BUDGET.tex) err('textura ' + t.name + ' de ' + t.w + '×' + t.h + ' (máximo ' + BUDGET.tex + ')'); if (t.w && ((t.w & (t.w - 1)) || (t.h & (t.h - 1)))) warn('textura ' + t.name + ' ' + t.w + '×' + t.h + ' no es potencia de 2 (mipmaps peores en WebGL1)'); }
R.info.textureMB = +(R.info.textures.reduce((s, t) => s + (t.w * t.h * 4 * 1.33 || 0), 0) / 1048576).toFixed(1);
// gameplay envelope (no false cover) against the slot's collision box
const box = opt('box');
if (box) {
  const [W, D, H] = box.split(',').map(Number);
  if (Math.abs(cx) > 0.05 || Math.abs(cz) > 0.05) warn('la huella no está centrada en el origen (' + cx.toFixed(2) + ', ' + cz.toFixed(2) + ')');
  let body = 0, over = 0, above = 0, ex = '';
  for (const [x, y, z] of allVerts) {
    const dx = Math.max(0, Math.abs(x) - W / 2), dz = Math.max(0, Math.abs(z) - D / 2), d = Math.hypot(dx, dz);
    if (y > 0.12 && y < 2.0 && d > 0.45 && !(y <= 0.66 && d <= 0.66)) { body++; ex = ex || [x, y, z].map(v => v.toFixed(2)).join(','); }
    else if (y >= 2.0 && y < H + 0.35 && d > 1.2) over++;
    else if (y > H + 0.4 && d < 0.6) above++;
  }
  R.info.envelope = { W, D, H, bodyOut: body, overhangOut: over, aboveCap: above };
  if (body) err(body + ' vértices a la altura del cuerpo a más de 0,45 m de la caja ' + W + '×' + D + ' (cobertura falsa), p. ej. ' + ex);
  if (over) err(over + ' vértices por encima de 2 m a más de 1,2 m de la fachada');
  if (above) warn(above + ' vértices por encima de la caja (+0,4 m): tejado / chimeneas sin colisión — hay que ampliar la caja del mapa (cambio en el servidor) o bajarlos');
}

const T = s => console.log(s);
T('\nVALIDACIÓN GLB — ' + file);
T('  tamaño ' + R.info.sizeMB + ' MB · generador ' + (R.info.generator || '—'));
T('  medidas ' + size.join(' × ') + ' m (X × Y × Z) · mín ' + R.info.bounds.min.join(', ') + ' · máx ' + R.info.bounds.max.join(', '));
T('  nodos: ' + Object.entries(R.info.nodes).slice(0, 12).map(([k, v]) => k + ' ' + v.tris + ' tri / ' + v.materials + ' mat').join(' · ') + (Object.keys(R.info.nodes).length > 12 ? ' · …' : ''));
T('  materiales ' + R.info.materials.length + ' · texturas ' + R.info.textures.length + ' (' + R.info.textureMB + ' MB en GPU) ' + R.info.textures.slice(0, 6).map(t => t.name + ' ' + t.w + '×' + t.h).join(', '));
if (R.info.envelope) T('  caja ' + R.info.envelope.W + '×' + R.info.envelope.D + '×' + R.info.envelope.H + ' m: fuera a la altura del cuerpo ' + R.info.envelope.bodyOut + ' · voladizos lejanos ' + R.info.envelope.overhangOut + ' · sobre la caja ' + R.info.envelope.aboveCap);
for (const e of R.errors) T('  ✘ ' + e);
for (const w of R.warnings) T('  · ' + w);
T(R.ok ? '  ✔ cumple las reglas obligatorias' : '  ✘ NO se puede integrar tal cual');
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(R, null, 1));
process.exit(R.ok ? 0 : 1);
