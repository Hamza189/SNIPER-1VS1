/* First-person captures aiming down the sights (and from the hip) of the pistol and the shotgun, on a phone-shaped
   screen with touch (field of view 70°) or a desktop one, to judge how much of the view the weapon covers.
   node tools/capture-ads.js OUT_DIR [prefix]   env: W=844 H=390 TOUCH=1 (default: iPhone landscape) */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.', PRE = process.argv[3] || 'ads';
const VW = +(process.env.W || 844), VH = +(process.env.H || 390), TOUCH = process.env.TOUCH !== '0';
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, hasTouch: TOUCH, isMobile: TOUCH });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 2 })); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=1'); await p.waitForFunction(() => window.__SD && __SD.VMA && __SD.VMA.ready !== false, null, { timeout: 90000 }); await p.waitForTimeout(3000);
  for (const [w, prim] of [['pistol', 'rifle'], ['shotgun', 'shotgun']]) {
    await p.evaluate(prim => { const S = __SD; S.MANUAL.on = false; S.setPrimaryChoice(prim); S.setTrain('off'); S.setMode('range'); S.startMatch(); S.setWorld('arena'); Object.assign(S.PM, { x: -20, y: 0, z: 0 }); }, prim);
    await p.waitForTimeout(800);
    await p.evaluate(w => { __SD.input.select = w === 'shotgun' ? 'rifle' : w; }, w);
    await p.waitForTimeout(2500);
    for (const ads of [0, 1]) {
      await p.evaluate(ads => { const S = __SD; S.MANUAL.on = true; S.setWorld('arena'); Object.assign(S.PM, { x: -20, y: 0, z: 0, vx: 0, vz: 0 }); Object.assign(S.PMprev, { x: -20, y: 0, z: 0 }); S.P.yaw = -Math.PI / 2; S.P.pitch = -0.02;
        document.getElementById('hud').hidden = true; const t = document.getElementById('touch'); if (t) t.hidden = true;
        for (const b of S.RANGE_BOTS) b.g.visible = false; S.input.scopeHeld = !!ads; S.input.scope = !!ads; for (let i = 0; i < 40; i++) S.advance(16); }, ads);
      await p.waitForTimeout(250);
      const cdp = await ctx.newCDPSession(p); const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      require('fs').writeFileSync(OUT + '/' + PRE + '-' + w + (ads ? '-ads' : '-cadera') + '.png', Buffer.from(data, 'base64'));
      console.log(w, ads ? 'ads' : 'cadera');
    }
  }
  await b.close(); srv.close(); process.exit(0);
})();
