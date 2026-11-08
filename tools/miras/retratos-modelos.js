/* Retratos de las MIRAS en cada MODELO del rifle (08-11-2026, GUNSMITH, docs/GUNSMITH.md). El ARSENAL enseña la mira
   montada en el rifle que llevas, no siempre en el HALCÓN (owner: «no enseñes miniaturas falsas»). El propio juego monta
   cada mira en cada modelo (setWskin + setMira: el mismo rifle de tus manos, con su mira quitada o puesta igual que en la
   partida) y aquí se dibuja con la luz y el encuadre de tools/miras/retratos.js. Sale assets/miras/<modelo>/<mira>.jpg
   (560×245). Los del HALCÓN siguen en assets/miras/<mira>.jpg.
   Run: node tools/miras/retratos-modelos.js [modelo…]     env GPU=0: WebGL por software */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const ROOT = path.join(__dirname, '..', '..');
const ARGS = process.env.GPU === '0' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'];

(async () => {
  const srv = await ss.start(), b = await chromium.launch({ args: ARGS });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.goto(srv.url + '?vm=1&arsenal=0', { timeout: 180000 });
  await p.waitForFunction(() => window.__SD && __SD.VMA && __SD.VMA.ready && window.SDMiras, null, { timeout: 180000 });
  const models = process.argv.slice(2).length ? process.argv.slice(2) : ['titan', 'ultima', 'vector', 'sahara'];
  const ids = await p.evaluate(() => SDMiras.ORDER);
  for (const model of models) {
    await p.evaluate(m => __SD.setWskin('rifle', m), model);
    await p.waitForFunction(m => { const S = __SD.WS_ST.rifle; return S.cur === m && S.objs.length && !S.light; }, model, { timeout: 600000 });
    const dir = path.join(ROOT, 'assets', 'miras', model); fs.mkdirSync(dir, { recursive: true });
    for (const id of ids) {
      const url = await p.evaluate(async id => {
        const S = __SD, T = THREE, r = S.renderer;
        S.setMira(id); await new Promise(res => setTimeout(res, 150));
        // the rifle in your hands as it is now, in its own coordinates (the HALCÓN's frame: barrel towards −z)
        const sc = new T.Scene(); sc.background = new T.Color(0x1c1915);
        sc.add(new T.HemisphereLight(0xfff0dc, 0x2a241c, 1.0));
        const key = new T.DirectionalLight(0xffffff, 2.0); key.position.set(2, 3, 1); sc.add(key);
        const rim = new T.DirectionalLight(0xffb070, 1.0); rim.position.set(-2, 1, -3); sc.add(rim);
        const gun = new T.Group(); sc.add(gun);
        const GUN = S.VMA.R.root.parent;   // the group the rifle hangs from in the viewmodel
        for (const c of GUN.children) { if (!c.visible || c === S.RIF.flash) continue; gun.add(c.clone(true)); }
        gun.updateMatrixWorld(true);
        // framing: like the HALCÓN's portraits (the back half and the optic, from the right and a little behind), around
        // where the optic is on this model
        const opt = gun.getObjectByName('mira_' + id), c = new T.Vector3(0, 0.045, -0.03);
        if (opt) { opt.getWorldPosition(c); c.y -= 0.005; c.z -= 0.01; }
        const pc = new T.PerspectiveCamera(26, 560 / 245, 0.01, 20);
        pc.position.set(c.x + 0.6, c.y + 0.13, c.z + 0.2); pc.lookAt(c);
        const tm = r.toneMapping; r.toneMapping = T.ACESFilmicToneMapping;
        const size = new T.Vector2(); r.getSize(size); const pr = r.getPixelRatio();
        r.setPixelRatio(2); r.setSize(560, 245, false); r.setRenderTarget(null); r.setViewport(0, 0, 560, 245); r.setScissorTest(false);
        r.render(sc, pc);
        const cv = document.createElement('canvas'); cv.width = 560; cv.height = 245; const x = cv.getContext('2d');
        x.drawImage(r.domElement, 0, 0, 560, 245); x.fillStyle = '#ff8a2b'; x.fillRect(0, 241, 560, 4);
        r.toneMapping = tm; r.setPixelRatio(pr); r.setSize(size.x, size.y, false);
        return cv.toDataURL('image/jpeg', 0.86);
      }, id);
      const f = path.join(dir, id + '.jpg'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
      console.log(model + '/' + id + ': ' + Math.round(fs.statSync(f).size / 1024) + ' KB');
    }
  }
  await p.evaluate(() => { __SD.setWskin('rifle', 'halcon'); __SD.setMira('sniper'); });
  await b.close(); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
