/* Prepara la prueba aislada de WebGPU (ENGINE NEXT GENERATION, 10-11-2026) en .work/webgpu/ (no se sube al repositorio):
   Three.js r186 de npm (jsDelivr) para tools/webgpu/bench.html, el GLTFExporter de r128 y el PUEBLO exportado.
   node tools/webgpu/preparar.js   y luego   node tools/webgpu/medir.js */
'use strict';
const fs = require('fs'), path = require('path'), https = require('https'), { execFileSync } = require('child_process');
const DIR = path.join(__dirname, '..', '..', '.work', 'webgpu'), R186 = 'https://cdn.jsdelivr.net/npm/three@0.186.1/', R128 = 'https://cdn.jsdelivr.net/npm/three@0.128.0/';
const FILES = [[R186 + 'build/three.webgpu.js', 'three/three.webgpu.js'], [R186 + 'build/three.module.js', 'three/three.module.js'], [R186 + 'build/three.core.js', 'three/three.core.js'],
  [R186 + 'build/three.tsl.js', 'three/three.tsl.js'], [R186 + 'examples/jsm/loaders/GLTFLoader.js', 'three/loaders/GLTFLoader.js'],
  [R186 + 'examples/jsm/utils/BufferGeometryUtils.js', 'three/utils/BufferGeometryUtils.js'], [R186 + 'examples/jsm/utils/SkeletonUtils.js', 'three/utils/SkeletonUtils.js'],
  [R128 + 'examples/js/exporters/GLTFExporter.js', 'GLTFExporter.js']];
const get = (u, f) => new Promise((res, rej) => https.get(u, r => { if (r.statusCode !== 200) return rej(new Error(r.statusCode + ' ' + u)); fs.mkdirSync(path.dirname(f), { recursive: true }); const w = fs.createWriteStream(f); r.pipe(w); w.on('finish', res); }).on('error', rej));
(async () => {
  for (const [u, f] of FILES) { const out = path.join(DIR, f); if (!fs.existsSync(out)) { await get(u, out); console.log('bajado', f); } }
  const glb = path.join(DIR, 'pueblo.glb');
  if (!fs.existsSync(glb)) execFileSync(process.execPath, [path.join(__dirname, 'exportar-pueblo.js'), glb], { stdio: 'inherit' });
  console.log('listo:', DIR);
})().catch(e => { console.error(e.message); process.exit(1); });
