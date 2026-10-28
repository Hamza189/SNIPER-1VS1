/* Retratos de los aspectos de arma (?pj=pro): los dibuja el propio juego (mismo motor y materiales) de lado, con luz de
   estudio, y los guarda en assets/armas/<id>/retrato.jpg (560×245). El HALCÓN R7 y la NAVAJA salen de
   assets/viewmodels.glb. Repetir cuando cambie un arma (tools/arma-ext).
   Run: node tools/arma-retratos.js */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const ROOT = path.join(__dirname, '..');
const LIST = [['halcon', 'viewmodels:HALCON'], ['navaja', 'viewmodels:NAVAJA'], ['titan', 'titan'], ['ratio', 'ratio'], ['vector', 'vector'], ['lince', 'lince'], ['tactica', 'tactica']];

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 560, height: 245 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.goto(srv.url + '?vm=1');
  await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
  for (const [id, src] of LIST) {
    const url = await p.evaluate(async ([id, src]) => {
      const S = __SD, T = THREE, r = S.renderer;
      const load = u => new Promise((ok, ko) => new T.GLTFLoader().load(u, ok, undefined, ko));
      let obj;
      if (src.startsWith('viewmodels:')) { const g = await load('assets/viewmodels.glb'); obj = g.scene.getObjectByName(src.split(':')[1]); }
      else obj = (await load('assets/armas/' + src + '/arma.glb')).scene;
      const sc = new T.Scene(); sc.background = new T.Color(0x1c1915);
      sc.add(new T.HemisphereLight(0xfff0dc, 0x2a241c, 1.0));
      const key = new T.DirectionalLight(0xffffff, 2.0); key.position.set(2, 3, 1); sc.add(key);
      const rim = new T.DirectionalLight(0xffb070, 1.0); rim.position.set(-2, 1, -3); sc.add(rim);
      obj.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.material.envMap = S.scene.environment || null; } });
      sc.add(obj); obj.updateMatrixWorld(true);
      const bb = new T.Box3().setFromObject(obj), c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3());
      const len = Math.max(sz.z, sz.x), dist = len * 1.25;
      const pc = new T.PerspectiveCamera(28, 560 / 245, 0.01, 20);
      pc.position.set(c.x + dist * 0.98, c.y + dist * 0.12, c.z + dist * 0.18); pc.lookAt(c);
      r.setPixelRatio(2); r.setSize(560, 245, false); r.setRenderTarget(null); r.setViewport(0, 0, 560, 245); r.setScissorTest(false);
      r.render(sc, pc);
      const cv = document.createElement('canvas'); cv.width = 560; cv.height = 245; const x = cv.getContext('2d');
      x.drawImage(r.domElement, 0, 0, 560, 245); x.fillStyle = '#ff8a2b'; x.fillRect(0, 241, 560, 4);
      return cv.toDataURL('image/jpeg', 0.86);
    }, [id, src]);
    const dir = path.join(ROOT, 'assets', 'armas', id); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'retrato.jpg'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log(id + ': ' + path.relative(ROOT, f) + ' (' + Math.round(fs.statSync(f).size / 1024) + ' KB)');
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
