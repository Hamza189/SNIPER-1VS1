/* Film strip of a real in-game action, advanced frame by frame (for judging animations).
   node tools/film.js OUT.png weaponKey action frames stepMs
   weaponKey: Digit1 | Digit2 | Digit3 ; action: click | KeyR | KeyF | none */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const [out, key, action, frames, step] = process.argv.slice(2);
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url); await p.waitForTimeout(2000);
  await p.evaluate(pr => { __SD.setWorld('arena'); __SD.setMode('range'); if (pr) __SD.setPrimaryChoice(pr); }, process.env.PRIMARY || '');
  await p.getByRole('button', { name: 'JUGAR', exact: true }).click(); await p.waitForTimeout(1000);
  await p.keyboard.press(key || 'Digit2');
  await p.waitForFunction(() => __SD.LOAD.phase === 'ready', null, { timeout: 20000 });
  // stop the real-time loop: from here on every frame is advanced by hand
  await p.evaluate(() => { window.__realRAF = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; });
  await p.waitForTimeout(300);
  if (process.env.PRE === 'shoot') { await p.mouse.down(); for (let i = 0; i < 4; i++) await p.evaluate(() => __SD.advance(60)); await p.mouse.up(); for (let i = 0; i < 25; i++) await p.evaluate(() => __SD.advance(80)); }
  if (action === 'click') { await p.mouse.down(); }
  else if (action && action !== 'none') await p.keyboard.down(action);
  const shots = [];
  const N = +frames || 12, dt = +step || 50;
  for (let i = 0; i < N; i++) {
    await p.evaluate(ms => __SD.advance(ms), dt);
    if (i === 1) { if (action === 'click') await p.mouse.up(); else if (action && action !== 'none') await p.keyboard.up(action); }
    const f = out.replace(/\.png$/, '') + '-' + String(i).padStart(2, '0') + '.png';
    await p.screenshot({ path: f }); shots.push(f);
  }
  console.log(shots.join(' '));
  await b.close(); srv.close();
})();
