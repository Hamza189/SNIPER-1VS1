/* Screenshots of the HUD 2 (?hud=2) for docs/hud2/: phone sizes (iPhone 15 Pro Max and iPhone 8 in landscape,
   Samsung-like 915×412) and PC, with the inventory open and the HUD editor. Software WebGL: looks only, not FPS.
   Run: node tools/capture-hud2.js [outDir]   (default docs/hud2) */
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const out = process.argv[2] || path.join(__dirname, '..', 'docs', 'hud2');
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const shots = [
    ['movil-iphone15promax', { width: 932, height: 430 }, true],
    ['movil-iphone8', { width: 667, height: 375 }, true],
    ['movil-samsung', { width: 915, height: 412 }, true],
    ['pc', { width: 1280, height: 720 }, false]
  ];
  for (const [name, vp, touch] of shots) {
    for (const flag of ['', '&hud=2']) {
      const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      const p = await ctx.newPage();
      await p.goto(srv.url + '?perf=low' + flag);
      await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
      await p.evaluate(() => { document.querySelector('canvas').requestPointerLock = () => Promise.reject(new Error('x')); __SD.setDuelLethal(false); __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); });
      await p.waitForFunction(() => __SD.state === 'playing' && __SD.LOAD.phase === 'ready', null, { timeout: 30000 });
      await sleep(800);
      const tag = flag ? 'hud2' : 'actual';
      await p.screenshot({ path: path.join(out, name + '-' + tag + '.png') });
      if (flag) {
        await p.evaluate(() => { __SD.setPrimaryChoice('shotgun'); __SD.input.select = 'pistol'; }); await sleep(1500);
        await p.evaluate(() => { __SD.input.firePressed = true; }); await sleep(400);
        await p.keyboard.press('KeyI');   // the same key on every device (touch players tap the backpack in the bar)
        await sleep(500);
        await p.screenshot({ path: path.join(out, name + '-hud2-inventario.png') });
        await p.evaluate(() => { __SD.setPrimaryChoice('rifle'); __SD.toMenu(); __SD.openEditor(); }); await sleep(500);
        await p.screenshot({ path: path.join(out, name + '-hud2-editor.png') });
        await p.evaluate(() => document.getElementById('edCancel').click());
      }
      await ctx.close();
    }
    console.log('capturas ' + name);
  }
  await b.close(); srv.close && srv.close(); process.exit(0);
})();
