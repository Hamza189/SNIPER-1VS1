/* The asset contract's validator (tools/validate-glb.js) on small GLB files written here:
   a valid building that fits its 8 × 6 × 4 m box with three LODs passes; one exported in centimetres,
   one with a free-standing wall in the street (false cover), one too heavy, and one with Draco
   compression are rejected.  Run: node test/glb.contract.test.js                                       */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

// boxes [x0,y0,z0,x1,y1,z1] → one mesh per node name
function writeGLB(file, nodes, opts) {
  opts = opts || {};
  const bins = [], json = { asset: { version: '2.0', generator: 'test' }, scenes: [{ nodes: [] }], scene: 0, nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [], materials: [{ name: 'sd_estuco', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }] };
  if (opts.draco) { json.extensionsUsed = ['KHR_draco_mesh_compression']; }
  let off = 0;
  const push = (arr, target) => { const b = Buffer.from(arr.buffer); bins.push(b); json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length, target }); off += b.length; while (off % 4) { bins.push(Buffer.alloc(1)); off++; } return json.bufferViews.length - 1; };
  for (const [name, boxes] of Object.entries(nodes)) {
    const pos = [], nrm = [], idx = [];
    for (const [x0, y0, z0, x1, y1, z1] of boxes) {
      const F = [[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
        [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
        [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]]];
      for (const f of F) { const b = pos.length / 3; for (let k = 0; k < 4; k++) { pos.push(...f[k]); nrm.push(...f[4]); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    }
    const P = new Float32Array(pos), N = new Float32Array(nrm), I = new Uint16Array(idx);
    const mn = [0, 1, 2].map(c => Math.min(...pos.filter((_, i) => i % 3 === c))), mx = [0, 1, 2].map(c => Math.max(...pos.filter((_, i) => i % 3 === c)));
    json.accessors.push({ bufferView: push(P, 34962), componentType: 5126, count: P.length / 3, type: 'VEC3', min: mn, max: mx });
    json.accessors.push({ bufferView: push(N, 34962), componentType: 5126, count: N.length / 3, type: 'VEC3' });
    json.accessors.push({ bufferView: push(I, 34963), componentType: 5123, count: I.length, type: 'SCALAR' });
    const a = json.accessors.length;
    json.meshes.push({ name, primitives: [{ attributes: opts.nonormals ? { POSITION: a - 3 } : { POSITION: a - 3, NORMAL: a - 2 }, indices: a - 1, material: 0 }] });
    json.nodes.push({ name, mesh: json.meshes.length - 1, scale: opts.cm ? [100, 100, 100] : undefined });
    json.scenes[0].nodes.push(json.nodes.length - 1);
  }
  if (opts.wrap) { json.nodes.push({ name: opts.wrap, children: json.scenes[0].nodes.slice() }); json.scenes[0].nodes = [json.nodes.length - 1]; }   // one root node, as trimesh writes ('world')
  const bin = Buffer.concat(bins); json.buffers.push({ byteLength: bin.length });
  let js = Buffer.from(JSON.stringify(json)); while (js.length % 4) js = Buffer.concat([js, Buffer.from(' ')]);
  const out = Buffer.alloc(12 + 8 + js.length + 8 + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(js.length, 12); out.writeUInt32LE(0x4e4f534a, 16); js.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + js.length); out.writeUInt32LE(0x004e4942, 24 + js.length); bin.copy(out, 28 + js.length);
  fs.writeFileSync(file, out);
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdglb-'));
const run = (f, extra) => { try { const o = execFileSync('node', [path.join(__dirname, '..', 'tools', 'validate-glb.js'), f].concat(extra || []), { encoding: 'utf8' }); return { ok: true, o }; } catch (e) { return { ok: false, o: e.stdout }; } };
// a valid house: 8 × 6 m, walls 4 m, a balcony at 2.6 m sticking out 0.6 m, three LODs
const house = [[-4, 0, -3, 4, 4, 3], [-1, 2.6, 3, 1, 2.75, 3.6]];
writeGLB(path.join(dir, 'ok.glb'), { casa_LOD0: house, casa_LOD1: house, casa_LOD2: [[-4, 0, -3, 4, 4, 3]] });
const ok = run(path.join(dir, 'ok.glb'), ['--box', '8,6,4']);
check('un edificio que cabe en su caja 8 × 6 × 4 m con tres LOD pasa', ok.ok, ok.o.split('\n').filter(l => /✔|✘/.test(l)).join(' '));
writeGLB(path.join(dir, 'wrap.glb'), { casa_LOD0: house, casa_LOD1: house, casa_LOD2: house.concat([[5, 0, 0, 7, 1.2, 0.3]]) }, { wrap: 'world' });
const wrap = run(path.join(dir, 'wrap.glb'), ['--box', '8,6,4']);
check('LOD dentro de un nodo raíz (como exporta trimesh: "world"): los encuentra y revisa cada uno (un muro suelto solo en el LOD2 se detecta)', !wrap.ok && /casa_LOD2/.test(wrap.o) && /casa_LOD0 \d+ tri/.test(wrap.o) && /cobertura falsa/.test(wrap.o), wrap.o.split('\n').filter(l => /nodos|✘/.test(l)).join(' '));
writeGLB(path.join(dir, 'nonrm.glb'), { casa_LOD0: house }, { nonormals: true });
const nn = run(path.join(dir, 'nonrm.glb'));
check('sin normales: rechazado; tools/glb-add-normals.js las añade (caras planas) y entonces pasa', !nn.ok && /sin normales/.test(nn.o) && (() => { try { execFileSync('node', [path.join(__dirname, '..', 'tools', 'glb-add-normals.js'), path.join(dir, 'nonrm.glb'), path.join(dir, 'nonrm-fixed.glb')]); return run(path.join(dir, 'nonrm-fixed.glb')).ok; } catch (e) { return false; } })());
writeGLB(path.join(dir, 'cm.glb'), { casa_LOD0: house }, { cm: true });
const cm = run(path.join(dir, 'cm.glb'));
check('exportado en centímetros: rechazado', !cm.ok && /centímetros/.test(cm.o));
writeGLB(path.join(dir, 'wall.glb'), { casa_LOD0: house.concat([[5, 0, 0, 7, 1.2, 0.3]]) });
const wall = run(path.join(dir, 'wall.glb'), ['--box', '8,6,4']);
check('un muro suelto en la calle (cobertura falsa): rechazado', !wall.ok && /cobertura falsa/.test(wall.o));
const many = []; for (let i = 0; i < 1400; i++) many.push([-4 + (i % 40) * 0.2, 0, 3, -3.9 + (i % 40) * 0.2, 0.1 + (i / 40 | 0) * 0.1, 3.05]);
writeGLB(path.join(dir, 'heavy.glb'), { casa_LOD0: house, casa_LOD2: many });
const heavy = run(path.join(dir, 'heavy.glb'));
check('un LOD2 por encima de su presupuesto: rechazado', !heavy.ok && /casa_LOD2: \d+ triángulos/.test(heavy.o));
writeGLB(path.join(dir, 'draco.glb'), { casa_LOD0: house }, { draco: true });
const dr = run(path.join(dir, 'draco.glb'));
check('con compresión Draco (el cargador r128 del juego no la lee): rechazado', !dr.ok && /Draco|draco/.test(dr.o));
const kit = run(path.join(__dirname, '..', 'assets', 'kit.glb'));
check('el kit actual del juego pasa las reglas obligatorias', kit.ok);
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
