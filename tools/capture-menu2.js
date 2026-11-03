/* MENÚ 2 (?menu=2, docs/MENU-2.md): real captures of every section, on a PC window and on an iPhone in landscape,
   with the game's own engine (software WebGL here: right for the look, not for FPS).
   Run: node tools/capture-menu2.js [carpeta] [pc|movil|todo]   (SKIN=clasico|fsb|… elige el operador)   → <carpeta>/menu2_<tamaño>_<sección>.png */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const out = process.argv[2] || path.join(__dirname, '..', 'docs', 'menu2');
const which = process.argv[3] || 'todo';
const SIZES = { pc: { width: 1600, height: 900, touch: false }, movil: { width: 932, height: 430, touch: true, dpr: 3 } };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [name, sz] of Object.entries(SIZES)) {
    if (which !== 'todo' && which !== name) continue;
    const ctx = await b.newContext({ viewport: { width: sz.width, height: sz.height }, hasTouch: sz.touch, isMobile: sz.touch, deviceScaleFactor: sz.touch ? 2 : 1 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(skin => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); if (skin) localStorage.setItem('sniperduel_skin', JSON.stringify(skin)); } catch (e) {} }, process.env.SKIN || '');
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('error de la página: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') console.log('consola: ' + m.text()); });
    await p.goto(srv.url + '?menu=2');
    await p.waitForFunction(() => window.__SD && __SD.VMA.ready && __SD.M2 && __SD.M2.room, null, { timeout: 120000 });
    // the operator's character (KTX2/JPG) arrives a little later
    await p.waitForFunction(() => __SD.M2.opShown, null, { timeout: 240000 }).catch(() => console.log('el personaje no ha llegado'));
    await p.waitForTimeout(1500);
    // software WebGL is slow at this size: the clock-driven loop stops and each capture draws its own frames
    const t0 = await p.evaluate(() => { __SD.MANUAL.on = true; const t = performance.now(); __SD.advance(16); return performance.now() - t; });
    console.log(name, 'un fotograma del menú (WebGL por software):', t0.toFixed(0), 'ms');
    for (const tab of ['inicio', 'personaje', 'armas', 'armas-cuchillo', 'mapas', 'opciones', 'ajustes']) {
      await p.evaluate(t => {
        const S = __SD; document.getElementById('m2Sheet').hidden = true; if (!document.getElementById('settings').hidden) S.closeSettings();
        if (t === 'opciones') { S.m2Tab('inicio'); document.getElementById('m2Opts').click(); return; }
        if (t === 'armas-cuchillo') { S.m2Tab('armas'); document.querySelector('#m2Cat [data-cat=knife]').click(); return; }
        if (t === 'armas') { S.M2.cat = 'rifle'; }
        S.m2Tab(t);
      }, tab);
      await p.waitForTimeout(tab.startsWith('armas') ? 1500 : 300);
      await p.evaluate(() => { for (let i = 0; i < 40; i++) __SD.advance(33); });
      const f = path.join(out, 'menu2_' + name + '_' + tab + '.png');
      await p.screenshot({ path: f, timeout: 240000 });
      console.log(f);
    }
    const info = await p.evaluate(() => { const r = __SD.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
    console.log(name, 'último fotograma: llamadas de dibujo', info.calls, '· triángulos', info.tris);
    await ctx.close();
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
