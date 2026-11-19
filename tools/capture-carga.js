/* PANTALLA DE CARGA (?carga=2): pictures in the PC (1366 × 768), the iPhone in landscape with Safari's bars (932 × 320) and
   an Android phone in landscape (800 × 360). The characters are slowed down on purpose so the bar is caught half way.
   node tools/capture-carga.js [carpeta]   (default docs/img/carga) */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || path.join(__dirname, '..', 'docs', 'img', 'carga');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const devs = [['pc', { viewport: { width: 1366, height: 768 } }], ['iphone', { viewport: { width: 932, height: 320 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }],
    ['android', { viewport: { width: 800, height: 360 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true }]];
  for (const [name, opt] of devs) {
    const ctx = await b.newContext(opt);
    await ctx.route(/personaje\/.*personaje(_2k|_ktx2)?\.glb/, async r => { await new Promise(res => setTimeout(res, 6000)); r.continue(); });
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
    const p = await ctx.newPage();
    await p.goto(srv.url + '?vm=1&carga=2');
    await p.waitForFunction(() => window.__SD && __SD.CARGA && !document.getElementById('cgSkip').hidden, null, { timeout: 120000, polling: 200 });
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    console.log(name, await p.evaluate(() => document.getElementById('cgPct').textContent + ' · ' + document.getElementById('cgWhat').textContent));
    await ctx.close();
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
