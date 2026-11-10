/* Exporta la caja ATLAS DROP (tools/caja/modelo.js) a assets/caja/atlas_drop.glb con el Three.js r128 del juego
   (vendor/three.min.js) y su GLTFExporter (tools/caja/GLTFExporter.js, r128, MIT). Saca también dos capturas
   (docs/img/caja/juego_cerrada.png y juego_abierta.png) con la misma cámara que las del diseño original.
   Run: node tools/caja/exportar.js */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 760 } })).newPage();
  p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.setContent('<!doctype html><body style="margin:0;background:#09121b"></body>');
  for (const f of ['vendor/three.min.js', 'tools/caja/GLTFExporter.js', 'tools/caja/modelo.js']) await p.addScriptTag({ path: path.join(ROOT, f) });
  const out = await p.evaluate(async () => {
    const A = window.ASSET;
    const glb = await new Promise(ok => new THREE.GLTFExporter().parse(A.root, ok, { binary: true, animations: A.animations, onlyVisible: true }));
    let tris = 0, meshes = 0; A.root.traverse(o => { if (o.isMesh) { meshes++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
    // pictures: same camera and lights as the original preview
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(1000, 760); r.setPixelRatio(1);
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = .85; document.body.appendChild(r.domElement);
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x09121b);
    const cam = new THREE.PerspectiveCamera(38, 1000 / 760, .01, 30); cam.position.set(3.2, 2.7, 4.1); cam.lookAt(0, 1.0, 0);
    sc.add(new THREE.HemisphereLight(0xaccfe8, 0x364251, .65));
    for (const [pos, color, power] of [[[2, 4, 3], 0xe6f4ff, 1.3], [[-3, 2, -2], 0x1d9dff, .7], [[2, 1, -2], 0xffa24a, .8]]) { const l = new THREE.DirectionalLight(color, power); l.position.set(...pos); sc.add(l); }
    sc.add(A.root);
    const shots = {}; r.render(sc, cam); shots.cerrada = r.domElement.toDataURL('image/png');
    const mx = new THREE.AnimationMixer(A.root); const ac = mx.clipAction(A.animations[0]); ac.setLoop(THREE.LoopOnce, 1); ac.clampWhenFinished = true; ac.play(); mx.update(3);
    r.render(sc, cam); shots.abierta = r.domElement.toDataURL('image/png');
    const bytes = new Uint8Array(glb); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { glb: btoa(s), tris, meshes, shots };
  });
  fs.mkdirSync(path.join(ROOT, 'assets/caja'), { recursive: true }); fs.mkdirSync(path.join(ROOT, 'docs/img/caja'), { recursive: true });
  const f = path.join(ROOT, 'assets/caja/atlas_drop.glb'); fs.writeFileSync(f, Buffer.from(out.glb, 'base64'));
  for (const k in out.shots) fs.writeFileSync(path.join(ROOT, 'docs/img/caja/juego_' + k + '.png'), Buffer.from(out.shots[k].split(',')[1], 'base64'));
  console.log('assets/caja/atlas_drop.glb: ' + Math.round(fs.statSync(f).size / 1024) + ' KB, ' + out.meshes + ' mallas, ' + Math.round(out.tris) + ' triángulos');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
