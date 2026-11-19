/* ZONAS DEL KIT (19-11-2026, docs/RENDIMIENTO-IPHONE.md): por defecto el kit de PUEBLO 3.0/4.0 va en una sola zona por
   material (menos llamadas de dibujo); &kitzonas=0 = las 10 zonas de antes; &kitzonas=3, oeste, este y fuera. Lo que se ve
   no cambia:
   - los mismos triángulos y los mismos materiales, en menos mallas
   - menos llamadas de dibujo en una vuelta de cámara
   - sin errores
   Run: node test/kitzonas.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const run = async q => {
    const ctx = await b.newContext({ viewport: { width: 932, height: 430 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); localStorage.setItem('sniperduel_menuOld', 'true'); } catch (e) {} });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + '?pueblo=4' + q, { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.P3W && __SD.P3W.kit && __SD.P3W.meshes.length, null, { timeout: 240000 });
    await p.evaluate(() => { const S = __SD; S.setTrain('off'); S.setMode('duel'); if (S.setDuelLethal) S.setDuelLethal(false); S.setOffMap('pueblo'); S.startMatch(); });
    await p.waitForFunction(() => __SD.state === 'playing', null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(2000);
    const r = await p.evaluate(() => {
      const S = __SD, R = S.renderer, ms = S.P3W.meshes;
      let tris = 0; const mats = new Set();
      for (const m of ms) { const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; mats.add(m.material.name || m.material.uuid); }
      S.freeze(true); let calls = 0; const n = 12; R.info.autoReset = false;
      for (let i = 0; i < n; i++) { S.P.yaw = i / n * Math.PI * 2; R.info.reset(); S.advance(16); calls += R.info.render.calls; }
      R.info.autoReset = true;
      return { meshes: ms.length, tris, mats: mats.size, calls: Math.round(calls / n) };
    });
    await ctx.close(); return { r, errs };
  };
  try {
    const A = await run('&kitzonas=0'), B = await run(''), C = await run('&kitzonas=3');
    console.log('\nZONAS DEL KIT (PUEBLO 4.0, ALTO)');
    check('por defecto (una zona): los mismos triángulos y materiales que con &kitzonas=0, en menos mallas', B.r.tris === A.r.tris && B.r.mats === A.r.mats && B.r.meshes < A.r.meshes, JSON.stringify({ hoy: A.r, una: B.r }));
    check('por defecto: menos llamadas de dibujo', B.r.calls < A.r.calls * 0.8, A.r.calls + ' → ' + B.r.calls);
    check('kitzonas=3: los mismos triángulos, menos llamadas', C.r.tris === A.r.tris && C.r.calls < A.r.calls, JSON.stringify(C.r));
    check('sin errores', !A.errs.length && !B.errs.length && !C.errs.length, A.errs.concat(B.errs, C.errs).slice(0, 2).join(' | '));
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
