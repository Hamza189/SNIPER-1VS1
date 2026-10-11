/* First-person weapon captures at a fixed spot (hip, idle), one manual frame each.
   node tools/capture-vm.js OUT_DIR [prefix]   env: Q=alto  W=1170 H=540 */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.', PRE = process.argv[3] || 'vm';
const Q = process.env.Q || 'alto', VW = +(process.env.W || 1170), VH = +(process.env.H || 540);
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 2 })); } catch (e) {} }, Q);
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=1'); await p.waitForTimeout(2500);
  for (const [w, prim] of [['rifle', 'rifle'], ['pistol', 'rifle'], ['knife', 'rifle'], ['shotgun', 'shotgun']]) {
    await p.evaluate(prim => { const S = __SD; S.MANUAL.on = false; S.setPrimaryChoice(prim); S.setTrain('off'); S.setMode('range'); S.startMatch(); S.setWorld('arena'); Object.assign(S.PM, { x: -20, y: 0, z: 0 }); }, prim);
    await p.waitForTimeout(800);
    await p.evaluate(w => { const S = __SD; S.input.select = w === 'shotgun' ? 'rifle' : w; }, w);
    await p.waitForTimeout(2500);
    await p.evaluate(() => { const S = __SD; S.MANUAL.on = true; S.setWorld('arena'); Object.assign(S.PM, { x: -20, y: 0, z: 0, vx: 0, vz: 0 }); Object.assign(S.PMprev, { x: -20, y: 0, z: 0 }); S.P.yaw = -Math.PI / 2; S.P.pitch = -0.05;
      document.getElementById('hud').hidden = true; for (const b of S.RANGE_BOTS) b.g.visible = false; for (let i = 0; i < 8; i++) S.advance(16); });
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '/' + PRE + '-' + w + '.png', timeout: 180000 });
    console.log(w);
  }
  await b.close(); process.exit(0);
})();
