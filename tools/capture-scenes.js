/* Fixed-camera captures of the maps, for fair before/after comparisons (same camera, FOV, size, quality).
   node tools/capture-scenes.js OUT_DIR [prefix]      env: Q=alto|medio|bajo  W=1170 H=540  ONLY=pueblo-plaza,…
   Uses software WebGL (swiftshader): good for comparing looks, NOT for measuring phone performance. */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.', PRE = process.argv[3] || 'scene';
const Q = process.env.Q || 'alto', VW = +(process.env.W || 1170), VH = +(process.env.H || 540);
// [name, world, x, y (feet), z, yaw, pitch]  — yaw 0 looks towards -z
const VIEWS = [
  ['pueblo-plaza', 'pueblo', 2, 0, 24, 0, 0.02],
  ['pueblo-calle-norte', 'pueblo', 0.5, 0, 38, 0, 0.0],
  ['pueblo-fachada', 'pueblo', 25.5, 0, 6.5, -2.62, 0.12],
  ['pueblo-esquina-oeste', 'pueblo', -21, 0, -19, 0.69, 0.05],
  ['pueblo-fila-este', 'pueblo', 19, 0, 2, -Math.PI / 2, 0.04],
  ['pueblo-alto', 'pueblo', -2, 10, 30, 0.08, -0.32],
  ['arena-oeste', 'arena', -21, 0, 0, -Math.PI / 2, 0.02],
  ['arena-sur', 'arena', 0, 0, 14.5, 0, -0.04],
  ['arena-alto', 'arena', -23, 6, -15, -2.2, -0.3],
];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 2 })); } catch (e) {} }, Q);
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=1'); await p.waitForTimeout(2500);
  await p.evaluate(() => { __SD.setTrain('off'); __SD.setMode('range'); __SD.startMatch(); });
  await p.waitForTimeout(1500);
  const metrics = {};
  for (const [name, world, x, y, z, yaw, pitch] of VIEWS) {
    if (ONLY && !ONLY.includes(name)) continue;
    const m = await p.evaluate(([world, x, y, z, yaw, pitch]) => {
      const S = __SD; S.setWorld(world); S.freeze(true); S.SHOT.noVM = true; S.MANUAL.on = true;   // one frame at a time (software GL is slow)
      document.getElementById('hud').hidden = true;
      Object.assign(S.PM, { x, y, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y, z }); S.P.yaw = yaw; S.P.pitch = pitch;
      for (const b of S.RANGE_BOTS) b.g.visible = false;
      S.advance(16); S.advance(16);   // let the colour fixes and the textures settle
      const r = S.renderer; r.info.autoReset = false; r.info.reset(); S.advance(16); const i = r.info.render; const o = { calls: i.calls, tris: i.triangles }; r.info.autoReset = true; return o;
    }, [world, x, y, z, yaw, pitch]);
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '/' + PRE + '-' + name + '.png', timeout: 180000 });
    metrics[name] = m; console.log(name, JSON.stringify(m));
  }
  require('fs').writeFileSync(OUT + '/' + PRE + '-metrics.json', JSON.stringify({ quality: Q, size: [VW, VH], metrics }, null, 1));
  await b.close(); process.exit(0);
})();
