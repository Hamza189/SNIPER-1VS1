/* Comparativa de los aspectos de arma: arma.glb (JPG de 2K) frente a arma_ktx2.glb (KTX2 a la resolución del original),
   con la misma cámara de 1ª persona. Escribe .work/ktx2-armas/<id>_<jpg|ktx2>.png; tools/ktx2/sheet.py arma las hojas.
     node tools/ktx2/armas-compare.js [titan ultima vector sahara]
   WebGL por software: sirve para comparar el aspecto, no para medir FPS. */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const OUT = path.join(__dirname, '..', '..', '.work', 'ktx2-armas');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['titan', 'ultima', 'vector', 'sahara'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const q of ['?ktx2=0', '']) {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
    const p = await ctx.newPage();
    await p.goto(srv.url + q, { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 180000 });
    await p.evaluate(() => { document.querySelector('canvas').requestPointerLock = () => Promise.reject(new Error('sin captura'));
      __SD.setDuelLethal(false); __SD.setMode('range'); __SD.setTrain('off'); __SD.startMatch(); });
    await p.waitForTimeout(2000);
    for (const id of ids) {
      await p.evaluate(id => __SD.setWskin('rifle', id), id);
      await p.waitForFunction(() => __SD.WS_ST.rifle.objs.length > 0, null, { timeout: 240000 });
      // the same view every time: standing still, the rifle against the range's wall (nothing moving behind it), no HUD
      await p.evaluate(() => { Object.assign(__SD.PM, { x: 2, z: 75, vx: 0, vz: 0 }); __SD.P.yaw = Math.PI / 2; __SD.P.pitch = 0;
        for (const s of ['#hud', '#touch', '#h2', '#lockHint']) { const e = document.querySelector(s); if (e) e.style.visibility = 'hidden'; } });
      await p.waitForTimeout(2500);
      // the breathing sway moves the rifle with time: the same exact frame in both pictures (clock stopped, sway at 0)
      await p.evaluate(() => { __SD.MANUAL.on = true; __SD.P.swayT = 0; __SD.advance(33); __SD.advance(33); });
      await p.screenshot({ path: path.join(OUT, id + '_' + (q ? 'jpg' : 'ktx2') + '.png') });
      await p.evaluate(() => { __SD.MANUAL.on = false; });
      console.log(id, q || '(KTX2)', 'ok');
    }
    await ctx.close();
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
