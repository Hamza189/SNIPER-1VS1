/* MENÚ 2 (docs/MENU-2.md): the map pictures of MAPAS and of the mode cards, taken with the game itself (its maps, its
   light, quality ALTO) from fixed cameras, so they are real views and can be made again after a map changes.
   Run: node tools/menu2-mapas.js [carpeta]   → <carpeta>/mapa_<id>.jpg (by default assets/menu/)
   Software WebGL: the look is right, it is slow (a few minutes). */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || path.join(__dirname, '..', 'assets', 'menu');
// [map, x, y (feet), z, yaw, pitch] — yaw 0 looks towards -z (as tools/capture-scenes.js)
const VIEWS = {
  arena: ['arena', -23, 6, -15, -2.2, -0.3],
  pueblo: ['pueblo', 8, 9, -12, 2.83, -0.25],
  casa: ['casa', -4.3, 0, 4.6, -0.8, -0.03],
  casaxl: ['casaxl', 9, 7, 19, 0.2, -0.33]
};
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); localStorage.setItem('sniperduel_menu2', 'false'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=1');
  await p.addStyleTag({ content: '#lockHint,#updBanner{display:none!important}' }); await p.waitForTimeout(2500);
  await p.evaluate(() => { __SD.setTrain('off'); __SD.setMode('duel'); __SD.startMatch(); });
  await p.waitForTimeout(2000);
  for (const [id, [world, x, y, z, yaw, pitch]] of Object.entries(VIEWS)) {
    if (ONLY && !ONLY.includes(id)) continue;
    await p.evaluate(w => { __SD.setWorld(w); if (w === 'casa') __SD.casaLoad(); if (w === 'casaxl') __SD.casaxlLoad(); }, world);
    if (world === 'casa') await p.waitForFunction(() => __SD.CASA.ready || __SD.CASA.failed, null, { timeout: 180000 });
    if (world === 'casaxl') await p.waitForFunction(() => __SD.XL.ready || __SD.XL.failed, null, { timeout: 240000 });
    await p.waitForTimeout(2500);
    await p.evaluate(([world, x, y, z, yaw, pitch]) => {
      const S = __SD; S.setWorld(world); S.freeze(true); S.SHOT.noVM = true; S.MANUAL.on = true;
      document.getElementById('hud').hidden = true; document.getElementById('touch').hidden = true;
      Object.assign(S.PM, { x, y, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y, z }); S.P.yaw = yaw; S.P.pitch = pitch;
      for (const b of S.RANGE_BOTS.concat(S.BOTS)) { b.g.visible = false; if (b.glint) b.glint.visible = false; }
      for (let i = 0; i < 4; i++) S.advance(16);
    }, [world, x, y, z, yaw, pitch]);
    await p.waitForTimeout(400);
    const f = path.join(OUT, 'mapa_' + id + '.jpg');
    await p.screenshot({ path: f, type: 'jpeg', quality: 82, timeout: 240000 });
    console.log(f, Math.round(fs.statSync(f).size / 1024) + ' KB');
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
