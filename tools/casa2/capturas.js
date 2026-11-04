/* Capturas de CASA ATLAS 2.0 (02-11-2026, docs/CASA-ATLAS-2.md): vista aérea, cada módulo, el patio, el callejón, los
   pasillos, las salidas y las líneas largas, a la altura de los ojos (1,62 m) salvo las aéreas; y la CASA ATLAS original
   con la misma cámara para comparar. WebGL por software: vale para el aspecto, no para FPS.
   node tools/casa2/capturas.js CARPETA      env ONLY=aerea,patio · Q=alto · W=1280 H=720 · URLX=&aa=0 */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const OUT = process.argv[2] || '.', ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const PI = Math.PI;
// [nombre, mapa, x, y, z, yaw, pitch]   yaw 0 = mirando a −z (norte), −π/2 = a +x (este), π = a +z (sur)
const VIEWS = [
  ['aerea', 'casa2', 0, 36, 0.01, 0, -1.5707],
  ['aerea-diagonal', 'casa2', -4, 20, 30, 0, -0.62],
  ['spawn-A', 'casa2', -17.94, 0, -8.63, -PI / 2, 0],
  ['spawn-B', 'casa2', 17.94, 0, 8.63, PI / 2, 0],
  ['patio-largo', 'casa2', -20.2, 0, 0.6, -PI / 2, 0],
  ['patio-centro', 'casa2', -6, 0, -1.8, -PI / 2 - 0.35, -0.02],
  ['callejon', 'casa2', 0.3, 0, -15.8, PI, 0],
  ['pasillo-oeste', 'casa2', -20.3, 0, -15.6, PI, 0],
  ['cocina-a-callejon', 'casa2', -4.6, 0, -12.6, -PI / 2 - 0.3, -0.02],
  ['balcon-a-patio', 'casa2', -13.4, 0, -4.0, PI - 0.25, -0.03],
  ['estudio-desde-pasillo', 'casa2', -20.4, 0, -10.2, -PI / 2 + 0.35, 0],
  ['salon-B', 'casa2', 12.2, 0, -8.0, PI / 2 + 0.8, -0.03],
  ['casa-original-spawn', 'casa', -7.45, 0, 0.95, -PI / 2, 0],
  ['casa2-modulo-A-spawn', 'casa2', -17.94, 0, -8.63, -PI / 2, 0],
];
// diseño 2 (04-11-2026, «casa2b»: los pisos espalda con espalda, patio despejado y pérgola). env MAP=casa2b
const VIEWS_B = [
  ['aerea', 'casa2b', 0, 36, 0.01, 0, -1.5707],
  ['aerea-diagonal', 'casa2b', -4, 20, 30, 0, -0.62],
  ['aerea-diseno-1', 'casa2', 0, 36, 0.01, 0, -1.5707],
  ['spawn-A', 'casa2b', -16.24, 0, -8.63, -PI / 2, 0],
  ['patio-largo', 'casa2b', -18.6, 0, 0.4, -PI / 2, 0],
  ['patio-centro', 'casa2b', -7, 0, -2.6, -PI / 2 - 0.3, -0.02],
  ['pergola', 'casa2b', -4.5, 0, -2.4, -PI / 2 - 0.5, 0.32],
  ['balcon-a-patio', 'casa2b', -12.6, 0, -3.6, PI - 0.25, -0.03],
  ['comedor-a-comedor', 'casa2b', -3.4, 0, -6.3, -PI / 2, -0.02],
  ['cocina-a-cocina', 'casa2b', -3.0, 0, -11.9, -PI / 2, -0.02],
  ['pasillo-oeste', 'casa2b', -18.6, 0, -15.6, PI, 0],
  ['salon-B', 'casa2b', 10.6, 0, -8.0, PI / 2 + 0.8, -0.03],
];
const MAPID = process.env.MAP || 'casa2';
if (MAPID === 'casa2b') VIEWS.splice(0, VIEWS.length, ...VIEWS_B);
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 3 })); } catch (e) {} }, process.env.Q || 'alto');
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?casa=1&casa2=1&ktx2=0' + (MAPID === 'casa2b' ? '&casa2v=2' : '&casa2v=1') + (process.env.URLX || ''), { timeout: 180000 });
  await p.waitForFunction(() => window.__SD && __SD.W && __SD.WORLDS.casa2, null, { timeout: 180000 });
  await p.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
  await p.addStyleTag({ content: '#hud,#lockHint,#fpsBox,#cross,#touch,#mini,#h2bar{display:none!important}' });
  await p.evaluate(async id => { const S = __SD; S.setTrain('off'); S.setMode('duel'); S.setDuelLethal(false); S.setOffMap(id); S.startMatch();
    const t = performance.now(); while (!(S.state === 'playing' && S.C2S[id].ready) && performance.now() - t < 120000) await new Promise(r => setTimeout(r, 100)); }, MAPID);
  for (const [name, world, x, y, z, yaw, pitch] of VIEWS) {
    if (ONLY && !ONLY.includes(name)) continue;
    const info = await p.evaluate(async ([world, x, y, z, yaw, pitch]) => {
      const S = __SD, w = ms => new Promise(r => setTimeout(r, ms));
      if (S.WORLD_ID !== world) { S.setWorld(world); const t = performance.now(); while (!(world === 'casa' ? S.CASA.ready : !S.C2S[world] || S.C2S[world].ready) && performance.now() - t < 60000) await w(100); }
      S.freeze(true); S.SHOT.noVM = true; S.MANUAL.on = true;
      for (const bt of S.BOTS) { bt.g.visible = false; if (bt.glint) bt.glint.visible = false; }
      Object.assign(S.PM, { x, y, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y, z }); S.P.yaw = yaw; S.P.pitch = pitch;
      const R = S.renderer; for (let k = 0; k < 4; k++) S.advance(16);
      R.info.autoReset = false; R.info.reset(); S.advance(16); const i = R.info.render, out = { calls: i.calls, tris: i.triangles }; R.info.autoReset = true;
      await w(150); return out;
    }, [world, x, y, z, yaw, pitch]);
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    console.log(name.padEnd(24), 'llamadas', info.calls, '· triángulos', info.tris);
  }
  await b.close(); srv.close(); process.exit(0);
})();
