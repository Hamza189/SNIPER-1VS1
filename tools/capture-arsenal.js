/* Capturas del ARSENAL (GUNSMITH, 08-11-2026, docs/GUNSMITH.md): ARMAS con el HALCÓN, un modelo de otro autor, el
   selector de mira, la pestaña DAÑO y el cuchillo, en PC (1366 × 768) y móvil en horizontal (844 × 390).
   node tools/capture-arsenal.js CARPETA      env GPU=0: WebGL por software (por defecto, la GPU del PC) · ONLY=pc|movil */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.', GPU = process.env.GPU !== '0';
const ARGS = GPU ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start(), b = await chromium.launch({ args: ARGS });
  for (const [tag, vp, mob] of [['pc', { width: 1366, height: 768 }, false], ['movil', { width: 844, height: 390 }, true]]) {
    if (process.env.ONLY && process.env.ONLY !== tag) continue;
    const ctx = await b.newContext({ viewport: vp, hasTouch: mob, isMobile: mob, deviceScaleFactor: mob ? 2 : 1 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url, { timeout: 180000 }); await p.waitForFunction(() => window.__SD && __SD.M2 && __SD.M2.room && __SD.VMA.ready, null, { timeout: 180000 });
    const shot = async n => { await new Promise(r => setTimeout(r, 900)); await p.screenshot({ path: path.join(OUT, tag + '-' + n + '.png') }); console.log(tag, n); };
    await p.evaluate(() => document.querySelector('#m2 .m2Nav [data-tab=armas]').click());
    await p.waitForFunction(() => __SD.M2.item, null, { timeout: 60000 }); await shot('1-halcon');
    await p.evaluate(() => document.querySelector('#gsRifles [data-ws=ultima]').click());
    await p.waitForFunction(() => __SD.WS_ST.rifle.cur === 'ultima' && __SD.WS_ST.rifle.objs.length && !__SD.WS_ST.rifle.light && __SD.M2.item, null, { timeout: 300000 }).catch(() => {});
    await shot('2-ultima');
    await p.evaluate(() => document.querySelector('#gsAcc [data-acc=mira]').click()); await shot('3-mira');
    await p.evaluate(() => { document.querySelector('#gsPick [data-opt=x4]').click(); document.querySelector('#gsPickX').click(); document.querySelector('#gsTabs [data-gt=dmg]').click(); });
    await shot('4-dano');
    await p.evaluate(() => { document.querySelector('#gsTabs [data-gt=stats]').click(); document.querySelector('#gsKnives [data-ws=tactica]').click(); });
    await p.waitForFunction(() => __SD.WS_ST.knife.objs.length && !__SD.WS_ST.knife.light && __SD.M2.item, null, { timeout: 120000 }).catch(() => {});
    await shot('5-cuchillo');
    console.log(tag, 'errores:', errs.join(' | ') || 'ninguno');
    await ctx.close();
  }
  await b.close(); srv.close(); process.exit(0);
})();
