/* Capturas de BARRIO (04-11-2026, docs/BARRIO.md): vista aérea, la calle, los garajes, el callejón trasero y la salida,
   a la altura de los ojos (1,62 m) salvo las aéreas. WebGL por software: vale para el aspecto, no para FPS.
   node tools/barrio/capturas.js CARPETA      env ONLY=aerea,calle · Q=alto */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const OUT = process.argv[2] || '.', ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, PI = Math.PI;
// [nombre, x, y, z, yaw, pitch]   yaw 0 = mirando a −z, −π/2 = a +x
const VIEWS = [
  ['aerea', 0, 48, 0.01, 0, -1.5707], ['aerea-diagonal', -6, 22, 34, 0, -0.55],
  ['salida-A', -26.5, 0, -18.7, -PI / 2, 0], ['calle-oeste', -26, 0, 3, -PI / 2, 0], ['calle-centro', -8, 0, -6.5, -PI / 2 - 0.5, 0.02],
  ['garaje-dentro', -13.6, 0, -12.2, PI, 0], ['garaje-desde-calle', -9, 0, -3, PI / 2 + 0.6, 0.05], ['callejon-trasero', -20, 0, -18.7, -PI / 2, 0],
  ['torres', 0, 0, 6, 0, 0.18],
];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 3 })); } catch (e) {} }, process.env.Q || 'alto');
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?barrio=1&ktx2=0', { timeout: 180000 });
  await p.waitForFunction(() => window.__SD && __SD.W && __SD.WORLDS.barrio, null, { timeout: 180000 });
  await p.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
  await p.addStyleTag({ content: '#hud,#lockHint,#fpsBox,#cross,#touch,#mini,#h2bar{display:none!important}' });
  await p.evaluate(async () => { const S = __SD; S.setTrain('off'); S.setMode('duel'); S.setDuelLethal(false); S.setOffMap('barrio'); S.startMatch();
    const t = performance.now(); while (!(S.state === 'playing' && S.BAR.ready) && performance.now() - t < 150000) await new Promise(r => setTimeout(r, 100)); });
  for (const [name, x, y, z, yaw, pitch] of VIEWS) {
    if (ONLY && !ONLY.includes(name)) continue;
    const info = await p.evaluate(async ([x, y, z, yaw, pitch]) => {
      const S = __SD; S.freeze(true); S.SHOT.noVM = true; S.MANUAL.on = true;
      for (const bt of S.BOTS) { bt.g.visible = false; if (bt.glint) bt.glint.visible = false; }
      Object.assign(S.PM, { x, y, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y, z }); S.P.yaw = yaw; S.P.pitch = pitch;
      const R = S.renderer; for (let k = 0; k < 4; k++) S.advance(16);
      R.info.autoReset = false; R.info.reset(); S.advance(16); const i = R.info.render, out = { calls: i.calls, tris: i.triangles }; R.info.autoReset = true;
      await new Promise(r => setTimeout(r, 150)); return out;
    }, [x, y, z, yaw, pitch]);
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    console.log(name.padEnd(20), 'llamadas', info.calls, '· triángulos', info.tris);
  }
  await b.close(); srv.close(); process.exit(0);
})();
