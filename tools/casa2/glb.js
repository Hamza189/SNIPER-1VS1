/* Lector mínimo de GLB (sin dependencias) para las herramientas de CASA ATLAS 2.0: mallas con sus posiciones, normales,
   UV e índices ya en espacio del mundo del archivo (los nodos de casa_atlas.glb no tienen transformaciones).
   const { meshes } = require('./glb.js').read('assets/maps/casa_atlas/casa_atlas.glb') */
'use strict';
const fs = require('fs');
const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function read(file) {
  const b = fs.readFileSync(file), L = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + L).toString('utf8'));
  const bin = b.slice(20 + L + 8);
  const acc = i => {
    const a = j.accessors[i], v = j.bufferViews[a.bufferView], n = N[a.type], off = (v.byteOffset || 0) + (a.byteOffset || 0);
    const C = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : a.componentType === 5123 ? Uint16Array : Uint8Array;
    const stride = v.byteStride || n * C.BYTES_PER_ELEMENT, out = new (C === Float32Array ? Float32Array : Uint32Array)(a.count * n);
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) {
      const o = off + k * stride + c * C.BYTES_PER_ELEMENT;
      out[k * n + c] = C === Float32Array ? bin.readFloatLE(o) : C === Uint32Array ? bin.readUInt32LE(o) : C === Uint16Array ? bin.readUInt16LE(o) : bin.readUInt8(o);
    }
    return out;
  };
  const meshes = [];
  for (const nd of j.nodes) {
    if (nd.mesh === undefined) continue;
    for (const p of j.meshes[nd.mesh].primitives) {
      meshes.push({ name: nd.name, material: j.materials[p.material].name, pos: acc(p.attributes.POSITION), nor: p.attributes.NORMAL !== undefined ? acc(p.attributes.NORMAL) : null,
        uv: p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null, idx: acc(p.indices) });
    }
  }
  return { json: j, meshes };
}
// triangles grouped into connected pieces (shared vertices): each with its bounding box and triangle list
function pieces(m) {
  const n = m.pos.length / 3, par = new Int32Array(n).map((_, i) => i);
  const f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  // vertices at the same place count as joined (boxes split their corners per face)
  const key = new Map();
  for (let i = 0; i < n; i++) { const k = m.pos[i * 3].toFixed(4) + ',' + m.pos[i * 3 + 1].toFixed(4) + ',' + m.pos[i * 3 + 2].toFixed(4); if (key.has(k)) par[f(i)] = f(key.get(k)); else key.set(k, i); }
  for (let t = 0; t < m.idx.length; t += 3) { const a = f(m.idx[t]), b = f(m.idx[t + 1]), c = f(m.idx[t + 2]); par[b] = a; par[f(c)] = a; }
  const g = new Map();
  for (let t = 0; t < m.idx.length; t += 3) {
    const r = f(m.idx[t]); if (!g.has(r)) g.set(r, { tris: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
    const P = g.get(r); P.tris.push(t / 3);
    for (let k = 0; k < 3; k++) { const v = m.idx[t + k]; for (let c = 0; c < 3; c++) { P.min[c] = Math.min(P.min[c], m.pos[v * 3 + c]); P.max[c] = Math.max(P.max[c], m.pos[v * 3 + c]); } }
  }
  return [...g.values()];
}
module.exports = { read, pieces };
