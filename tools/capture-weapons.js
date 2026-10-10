/* Captures the first-person weapons in fixed poses (for before/after comparisons).
   node tools/capture-weapons.js OUT_DIR [prefix]   (needs playwright; software WebGL) */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.', PRE = process.argv[3] || 'cap';
const POSES = {
  pistol: [['hip', {}], ['ads', { ads: 1 }], ['fuego', { flash: 1, slide: 1 }], ['recarga-15', { reload: 0.15 }], ['recarga-45', { reload: 0.45 }], ['recarga-62', { reload: 0.62 }], ['recarga-78', { reload: 0.78 }], ['sacar', { draw: 0.45 }]],
  rifle: [['hip', {}], ['ads', { ads: 1 }], ['cerrojo-30', { bolt: 0.3 }], ['cerrojo-55', { bolt: 0.55 }], ['recarga-30', { reload: 0.3 }], ['recarga-70', { reload: 0.7 }]],
  knife: [['hip', {}]],
};
if (process.env.POSES) Object.assign(POSES, JSON.parse(process.env.POSES));
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto' })); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url); await p.waitForTimeout(2000);
  await p.evaluate(() => { __SD.setWorld('arena'); __SD.setMode('range'); });
  await p.getByRole('button', { name: 'JUGAR', exact: true }).click();
  await p.waitForTimeout(1500);
  const wf = fn => p.waitForFunction(fn, null, { timeout: 15000, polling: 50 }).catch(() => console.log('timeout', fn.toString()));
  for (const w of Object.keys(POSES)) {
    if (ONLY && !ONLY.includes(w)) continue;
    const key = { rifle: 'Digit1', pistol: 'Digit2', knife: 'Digit3' }[w];
    await p.keyboard.press(key); await wf(new Function('return __SD.LOAD.active===' + JSON.stringify(w) + '&&__SD.LOAD.phase==="ready"'));
    await p.waitForTimeout(600);
    for (const [name, pose] of POSES[w]) {
      if (pose.ads) { await p.mouse.down({ button: 'right' }); await p.waitForTimeout(1200); }
      await p.evaluate(([w, pose]) => { const S = __SD; S.freeze(true);
        if (S.capturePose) return S.capturePose(w, pose);
        const d = {}; for (const k of ['reload', 'draw', 'slide', 'flash', 'bolt']) if (pose[k] !== undefined) d[k] = pose[k];
        if (w === 'pistol') S.PIS.debug = Object.keys(d).length ? d : null; if (w === 'rifle') S.RIF.debug = Object.keys(d).length ? d : null;
        if (pose.flash) S.WS.flashT = 1; }, [w, pose]);
      await p.waitForTimeout(400);
      await p.screenshot({ path: OUT + '/' + PRE + '-' + w + '-' + name + '.png' });
      await p.evaluate(w => { const S = __SD; if (S.capturePose) S.capturePose(w, null); S.PIS.debug = null; S.RIF.debug = null; S.WS.flashT = 0; S.freeze(false); }, w);
      if (pose.ads) { await p.mouse.up({ button: 'right' }); await p.waitForTimeout(600); }
    }
  }
  await b.close(); srv.close();
})();
