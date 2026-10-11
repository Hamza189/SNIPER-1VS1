/* Fixed-camera captures of the maps, for fair before/after comparisons (same camera, FOV, size, quality).
   node tools/capture-scenes.js OUT_DIR [prefix]      env: Q=alto|medio|bajo  W=1170 H=540  ONLY=pueblo-plaza,…
   Uses software WebGL (swiftshader): good for comparing looks, NOT for measuring phone performance. */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.', PRE = process.argv[3] || 'scene';
const Q = process.env.Q || 'alto', URLX = process.env.URLX ? '&' + process.env.URLX : '', VW = +(process.env.W || 1170), VH = +(process.env.H || 540);
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
  // PUEBLO 3.0 vertical slice: the four views of the P3-4 comparison (north street + plaza)
  ['p3-calle', 'pueblo', 1.5, 0, 12, Math.PI, 0.03],
  ['p3-plaza', 'pueblo', 9, 0, -8, 2.65, 0.02],
  ['p3-fachada', 'pueblo', -9, 0, 17, 2.76, 0.12],
  ['p3-general', 'pueblo', 8, 9, -12, 2.83, -0.25],
];
// VIEW='name,world,x,y,z,yaw,pitch[;…]' adds views for this run
if (process.env.VIEW) for (const v of process.env.VIEW.split(';')) { const a = v.split(','); VIEWS.push([a[0], a[1], ...a.slice(2).map(Number)]); }
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : process.env.VIEW ? process.env.VIEW.split(';').map(v => v.split(',')[0]) : null;
// LOOKX='{"exp":1.1,"hemiI":1.2}' → light overrides for tuning (not saved anywhere)
const LOOKX = process.env.LOOKX || '';
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 2 })); } catch (e) {} }, Q);
  if (LOOKX) await ctx.addInitScript(j => { window.__LOOKX = S => { const o = JSON.parse(j), L = S.LIGHT;
    if (o.exp != null) S.renderer.toneMappingExposure = o.exp; if (o.sunI != null) L.sun.intensity = o.sunI; if (o.hemiI != null) L.hemi.intensity = o.hemiI; }; }, LOOKX);
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=1' + URLX);
  await p.addStyleTag({ content: '#lockHint{display:none!important}' }); await p.waitForTimeout(2500);
  // MODE=duel (default: what a match in PUEBLO looks like, fog included) or range; BOTS=1 keeps the bots
  const MODE = process.env.MODE || 'duel', KEEPBOTS = process.env.BOTS === '1';
  await p.evaluate(m => { __SD.setTrain('off'); __SD.setMode(m); __SD.startMatch(); }, MODE);
  if (/pueblo=3/.test(URLX)) await p.waitForFunction(() => __SD.P3W && __SD.P3W.kit && (!__SD.E10.on || __SD.E10.ready || __SD.E10.failed), null, { timeout: 90000 });
  await p.waitForTimeout(1500);
  const metrics = {};
  for (const [name, world, x, y, z, yaw, pitch] of VIEWS) {
    if (ONLY && !ONLY.includes(name)) continue;
    const m = await p.evaluate(([world, x, y, z, yaw, pitch, keep]) => {
      const S = __SD; S.setWorld(world); S.freeze(true); S.SHOT.noVM = true; S.MANUAL.on = true;   // one frame at a time (software GL is slow)
      document.getElementById('hud').hidden = true; const lh = document.getElementById('lockHint'); if (lh) lh.hidden = true;
      if (window.__LOOKX) window.__LOOKX(S);
      Object.assign(S.PM, { x, y, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y, z }); S.P.yaw = yaw; S.P.pitch = pitch;
      if (!keep) for (const b of S.RANGE_BOTS.concat(S.BOTS)) { b.g.visible = false; if (b.glint) b.glint.visible = false; }
      S.advance(16); S.advance(16);   // let the colour fixes and the textures settle
      const r = S.renderer; r.info.autoReset = false; r.info.reset(); S.advance(16); const i = r.info.render; const o = { calls: i.calls, tris: i.triangles }; r.info.autoReset = true; return o;
    }, [world, x, y, z, yaw, pitch, KEEPBOTS]);
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + '/' + PRE + '-' + name + '.png', timeout: 180000 });
    metrics[name] = m; console.log(name, JSON.stringify(m));
  }
  require('fs').writeFileSync(OUT + '/' + PRE + '-metrics.json', JSON.stringify({ quality: Q, size: [VW, VH], metrics }, null, 1));
  await b.close(); process.exit(0);
})();
