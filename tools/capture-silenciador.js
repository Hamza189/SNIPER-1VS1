/* Capturas del SILENCIADOR (GUNSMITH, 09-11-2026, docs/GUNSMITH.md): en el ARSENAL (HALCÓN y VECTOR) y en la mano,
   en una partida contra bots (sin y con silenciador, en el momento del disparo).
   node tools/capture-silenciador.js CARPETA      env GPU=0: WebGL por software (por defecto, la GPU del PC) */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.', GPU = process.env.GPU !== '0';
const ARGS = GPU ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start(), b = await chromium.launch({ args: ARGS });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(srv.url, { timeout: 180000 }); await p.waitForFunction(() => window.__SD && __SD.M2 && __SD.M2.room && __SD.VMA.ready, null, { timeout: 180000 });
  const shot = async (n, ms) => { await new Promise(r => setTimeout(r, ms === undefined ? 900 : ms)); await p.screenshot({ path: path.join(OUT, n + '.jpg'), quality: 82 }); console.log(n); };
  const sil = () => p.evaluate(() => { document.querySelector('#gsAcc [data-acc=muzzle]').click(); document.querySelector('#gsPick [data-opt=sil]').click(); document.querySelector('#gsPickX').click(); });
  await p.evaluate(() => document.querySelector('#m2 .m2Nav [data-tab=armas]').click());
  await p.waitForFunction(() => __SD.M2.item, null, { timeout: 60000 });
  await sil(); await shot('silenciador-halcon');
  await p.evaluate(() => document.querySelector('#gsRifles [data-ws=vector]').click());
  await p.waitForFunction(() => __SD.WS_ST.rifle.cur === 'vector' && __SD.WS_ST.rifle.objs.length && !__SD.WS_ST.rifle.light && __SD.M2.item, null, { timeout: 300000 }).catch(() => {});
  await sil(); await shot('silenciador-vector');
  // in the hands: the HALCÓN without and with it, at the shot
  await p.evaluate(() => { document.querySelector('#gsRifles [data-ws=halcon]').click(); document.getElementById('gsSave').click(); document.querySelector('#m2 .m2Nav [data-tab=inicio]').click(); });
  for (const on of [false, true]) {
    await p.evaluate(on => { const c = JSON.parse(localStorage.getItem('sniperduel_gsCfg') || '{"v":1,"models":{}}'); c.models.halcon = Object.assign(c.models.halcon || { mira: 'sniper', camo: '' }, { muzzle: on ? 'sil' : 'none' });
      localStorage.setItem('sniperduel_gsCfg', JSON.stringify(c)); document.querySelector('canvas').requestPointerLock = () => Promise.reject(new Error('sin captura'));
      __SD.setDuelLethal(false); __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); __SD.BOTS.forEach(b => { b.alive = false; b.g.visible = false; }); }, on);
    await p.waitForFunction(() => __SD.state === 'playing' && __SD.WCORE.state === 'ready', null, { timeout: 60000 });
    await shot('mano-' + (on ? 'con' : 'sin'), 600);
    await p.evaluate(() => { __SD.input.firePressed = true; });
    await p.waitForFunction(() => __SD.WCORE.state === 'bolt', null, { timeout: 20000 });
    await shot('disparo-' + (on ? 'con' : 'sin'), 0);
    await p.evaluate(() => { __SD.pause && __SD.pause(); });
  }
  console.log('errores:', errs.join(' | ') || 'ninguno');
  await b.close(); srv.close(); process.exit(0);
})();
