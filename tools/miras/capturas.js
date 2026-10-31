/* Capturas de las MIRAS (31-10-2026, docs/MIRAS.md): con cada mira, sin apuntar (el rifle con la mira montada) y
   apuntando, desde el mismo sitio de PUEBLO 3.0 mirando a la fila este (40–80 m), con un bot quieto a ~45 m.
   Tamaño de un iPhone 15 Pro Max en horizontal (932×430 a 2×). WebGL por software: vale para el aspecto, no para FPS.
   node tools/miras/capturas.js OUT_DIR        env ONLY=punto,x2 · URLX=&aa=0 · CADERA=1 (también sin apuntar) */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const OUT = process.argv[2] || '.';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); localStorage.setItem('sniperduel_p3', 'true'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + (process.env.PAGE || '') + '?pueblo=3&ktx2=0' + (process.env.URLX || ''), { timeout: 180000 });   // env PAGE=otra.html
  await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 180000 });
  await p.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
  await p.addStyleTag({ content: '#lockHint,#fpsBox{display:none!important}' });
  await p.evaluate(async () => { __SD.setTrain('off'); __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.setOffMap('pueblo'); __SD.startMatch();
    const t = performance.now(); while (!(__SD.state === 'playing' && __SD.LOAD.phase === 'ready') && performance.now() - t < 90000) await new Promise(r => setTimeout(r, 100)); });
  await p.waitForFunction(() => __SD.P3W && __SD.P3W.kit, null, { timeout: 120000 });
  const ids = process.env.ONLY ? process.env.ONLY.split(',') : await p.evaluate(() => SDMiras.ORDER);
  for (const id of ids) {
    for (const ads of process.env.CADERA === '1' ? [0, 1] : [1]) {
      await p.evaluate(async ([id, ads]) => {
        const S = __SD, w = ms => new Promise(r => setTimeout(r, ms));
        S.setMira(id); S.freeze(true);
        Object.assign(S.PM, { x: -30, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x: -30, y: 0, z: 0 });
        S.P.yaw = -Math.PI / 2 + 0.05; S.P.pitch = 0.012;
        // one bot standing still in the line of fire, the others out of sight
        const bots = S.BOTS; bots.forEach((bt, i) => { bt.g.visible = i === 0; if (bt.glint) bt.glint.visible = false; });
        if (bots[0]) { bots[0].g.position.set(15, 0, -2.5); if (bots[0].pos) bots[0].pos.set(15, 0, -2.5); }
        S.WCORE.ads = ads; S.WS.zoomCur = S.WS.zoom; S.input.scopeToggle = !!ads;
        for (let i = 0; i < 20; i++) { S.advance(16); await w(10); }
      }, [id, ads]);
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(OUT, 'mira-' + id + (ads ? '-apuntando' : '-cadera') + '.png') });
      console.log(id, ads ? 'apuntando' : 'cadera');
    }
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
