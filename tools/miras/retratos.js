/* Retratos de las MIRAS (31-10-2026, docs/MIRAS.md): cada mira montada en el HALCÓN R7, dibujada por el propio juego
   (el mismo motor, los mismos materiales y la misma forma de quitar la mira de siempre: __SD.miraClipGeo), de lado y algo
   por detrás, con luz de estudio. Se guardan en assets/miras/<id>.jpg (560×245, como los retratos de las armas).
   Repetir cuando cambie una mira (client/miras.js) o el HALCÓN.
   Run: node tools/miras/retratos.js */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const ROOT = path.join(__dirname, '..', '..');

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 560, height: 245 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.goto(srv.url + (process.env.PAGE || '') + '?vm=1');   // env PAGE=otra.html: another build
  await p.waitForFunction(() => window.__SD && __SD.WORLDS && window.SDMiras, null, { timeout: 120000 });
  const ids = await p.evaluate(() => SDMiras.ORDER);
  const dir = path.join(ROOT, 'assets', 'miras'); fs.mkdirSync(dir, { recursive: true });
  for (const id of ids) {
    const url = await p.evaluate(async id => {
      const S = __SD, T = THREE, r = S.renderer, M = SDMiras;
      const g = await new Promise((ok, ko) => new T.GLTFLoader().load('assets/viewmodels.glb', ok, undefined, ko));
      if (window.SDVM) SDVM.refine(g.scene, T, S.ENV, { low: false });   // the materials as the game shows them
      const hal = g.scene.getObjectByName('HALCON'); hal.position.set(0, 0, 0); hal.rotation.set(0, 0, 0);
      const sc = new T.Scene(); sc.background = new T.Color(0x1c1915);
      sc.add(new T.HemisphereLight(0xfff0dc, 0x2a241c, 1.0));
      const key = new T.DirectionalLight(0xffffff, 2.0); key.position.set(2, 3, 1); sc.add(key);
      const rim = new T.DirectionalLight(0xffb070, 1.0); rim.position.set(-2, 1, -3); sc.add(rim);
      const gun = new T.Group(); sc.add(gun); gun.add(hal); gun.updateMatrixWorld(true);
      if (!M.get(id).builtin) {
        // the HALCÓN's own scope out, exactly as in the game
        const inv = new T.Matrix4().copy(gun.matrixWorld).invert(), m4 = new T.Matrix4(), box = M.RIFLES.halcon.strip.box;
        hal.traverse(o => { if (!o.isMesh) return; if (!/^r_body/.test(o.name) && !(o.parent && /^r_body/.test(o.parent.name))) return;
          m4.multiplyMatrices(inv, o.matrixWorld); const ng = S.miraClipGeo(o.geometry, m4, box); if (ng) o.geometry = ng; });
        const P = M.placement('halcon', id), opt = M.build(T, id, S.ENV);
        opt.position.set(0, P.y, P.z); opt.rotation.x = P.tilt; gun.add(opt);
      }
      // colours are sRGB hex, as in the game: converted to linear once, like csFix() does in the page
      sc.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (!m || m.userData.cs) continue; m.userData.cs = 1;
        for (const k of ['color', 'emissive']) if (m[k] && m[k].isColor) m[k].convertSRGBToLinear(); m.needsUpdate = true; } });
      r.toneMapping = T.ACESFilmicToneMapping;
      // framing: the back half of the rifle and the optic, seen from the right and a little behind
      const c = new T.Vector3(0, 0.045, -0.03), pc = new T.PerspectiveCamera(26, 560 / 245, 0.01, 20);
      pc.position.set(c.x + 0.6, c.y + 0.13, c.z + 0.2); pc.lookAt(c);
      r.setPixelRatio(2); r.setSize(560, 245, false); r.setRenderTarget(null); r.setViewport(0, 0, 560, 245); r.setScissorTest(false);
      r.render(sc, pc);
      const cv = document.createElement('canvas'); cv.width = 560; cv.height = 245; const x = cv.getContext('2d');
      x.drawImage(r.domElement, 0, 0, 560, 245); x.fillStyle = '#ff8a2b'; x.fillRect(0, 241, 560, 4);
      return cv.toDataURL('image/jpeg', 0.86);
    }, id);
    const f = path.join(dir, id + '.jpg'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log(id + ': ' + path.relative(ROOT, f) + ' (' + Math.round(fs.statSync(f).size / 1024) + ' KB)');
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
