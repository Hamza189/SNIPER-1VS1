/* Capturas del visor de la revisión 03 (Playwright + Chromium; SwiftShader: sirve para ver el aspecto, no para FPS).
   node capture.js [salida] [lista,de,tomas]   tomas: clip@t:vista:variante:arma  */
'use strict';
const path = require('path'), fs = require('fs');
const rev = path.resolve(__dirname, '..'), repo = path.resolve(rev, '../../../../..');
const { chromium } = require(path.join(repo, 'node_modules/playwright'));
const out = path.resolve(process.argv[2] || path.join(rev, 'preview'));
fs.mkdirSync(out, { recursive: true });
const DEFAULT = ['idle_rifle@0:front:B:rifle', 'idle_rifle@0:side:B:rifle', 'idle_rifle@0:back:B:rifle', 'idle_rifle@0:angle:B:rifle',
  'aim_rifle@0:angle:B:rifle', 'aim_rifle@0:close:B:rifle', 'idle_rifle@0:close:B:rifle', 'walk_fwd@0.1:side:B:rifle', 'walk_fwd@0.43:side:B:rifle', 'sprint@0.1:angle:B:rifle',
  'crouch_idle@0:angle:B:rifle', 'slide@0:angle:B:rifle', 'death_front@1.25:angle:B:-', 'death_back@1.25:angle:B:-',
  'fire_rifle@0.6:angle:B:rifle', 'reload_rifle@1.2:angle:B:rifle', 'aim_pistol@0:angle:B:pistol', 'idle_rifle@0:angle:A:rifle', 'idle_rifle@0:angle:bots:rifle'];
const shots = process.argv[3] ? process.argv[3].split(',') : DEFAULT;
(async () => {
  const server = await require(path.join(repo, 'tools/static-server')).start();
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  try {
    const p = await browser.newPage({ viewport: { width: 760, height: 900 } });
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(server.url + 'assets/3d/imports/2026-10-19_personaje/revision_03/viewer.html' + (process.env.GLB ? '?glb=' + process.env.GLB : ''));
    await p.waitForFunction(() => window.ready || window.error, null, { timeout: 120000 });
    const err = await p.evaluate(() => window.error);
    if (err) throw new Error(err);
    await p.evaluate(() => { document.querySelector('#ui').style.display = 'none'; });
    for (const s of shots) {
      const [ct, view, variant, wpn] = s.split(':'), [clip, t] = ct.split('@');
      await p.evaluate(async ([clip, t, view, variant, wpn, boxes]) => { const boxes_ = v => { document.dispatchEvent(new CustomEvent('boxes', { detail: v })); }; await setVariant(variant); setWeapon(wpn); setClip(clip, +t); boxes_(boxes); setView(view); },
        [clip, t || 0, view, variant || 'B', wpn || 'rifle', !!process.env.BOXES]);
      const f = path.join(out, s.replace(/[:@]/g, '_') + '.png');
      await p.screenshot({ path: f });
    }
    console.log(JSON.stringify(await p.evaluate(() => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles })), null, 0));
  } finally { await browser.close(); server.close(); }
  if (errors.length) { console.log('ERRORES', errors); process.exitCode = 1; }
})().catch(e => { console.error(e); process.exitCode = 1; });
