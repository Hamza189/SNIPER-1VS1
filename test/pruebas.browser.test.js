/* AJUSTES › EN PRUEBA (19-11-2026, docs/EN-PRUEBA.md): the experimental features as switches inside the game, for the
   home-screen shortcut (it always opens the plain link; on the iPhone it keeps its own memory, apart from Safari).
   - every switch shows what is running now; the plain link (no flags) and a phone-sized page in "app" mode
   - SÍ on SALA 1V1 NUEVA: remembered, RECARGAR appears; after reloading the plain address the new room is on
   - a flag in the address is removed by RECARGAR, so the switch decides
   - RESTAURAR ESTA SECCIÓN forgets what is remembered: back to the defaults
   Run: node test/pruebas.browser.test.js */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nEN PRUEBA: playwright no está instalado, se omite'); process.exit(0); }
const statics = require('../tools/static-server.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const until = async (p, fn, a, ms) => { try { await p.waitForFunction(fn, a, { timeout: ms || 20000, polling: 150 }); return true; } catch (e) { return false; } };
(async () => {
  const web = await statics.start(), errors = [];
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    console.log('\nAJUSTES › EN PRUEBA');
    const ctx = await browser.newContext({ viewport: { width: 932, height: 320 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
    const load = async q => { await p.goto(web.url + '?perf=low' + (q || ''), { timeout: 120000 }); await p.waitForFunction(() => window.__SD, null, { timeout: 120000 }); };
    const tab = async () => { await p.evaluate(() => { __SD.openSettings('menu'); document.querySelector('.setTabs button[data-tab="pruebas"]').click(); }); await until(p, () => document.querySelectorAll('#fxList .fxRow').length > 5); };
    const st = () => p.evaluate(() => [...document.querySelectorAll('#fxList .fxRow')].reduce((o, r) => { o[r.dataset.k] = r.querySelector('[aria-pressed="true"]').dataset.v === '1'; return o; }, {}));
    await load(''); await tab();
    const s0 = await st(), real0 = await p.evaluate(() => ({ lobby2: __SD.LB.on, menuOld: !!__SD.M2.on }));
    check('la pestaña EN PRUEBA sale en AJUSTES con sus interruptores', Object.keys(s0).length >= 10, Object.keys(s0).join(','));
    check('cada interruptor dice lo que está funcionando ahora', s0.lobby2 === real0.lobby2 && s0.menuOld === real0.menuOld, JSON.stringify(s0));
    check('sin nada elegido no pide recargar', await p.evaluate(() => document.getElementById('fxReloadRow').hidden));
    const want = !s0.lobby2;
    await p.click('#fxList .fxRow[data-k="lobby2"] button[data-v="' + (want ? 1 : 0) + '"]');
    check('SALA 1V1 NUEVA cambiada: se recuerda en el dispositivo y sale RECARGAR PARA APLICAR', await p.evaluate(w => JSON.parse(localStorage.getItem('sniperduel_lobby2')) === w && !document.getElementById('fxReloadRow').hidden && document.querySelector('#fxList .fxRow[data-k="lobby2"]').classList.contains('changed'), want));
    await Promise.all([p.waitForNavigation({ timeout: 120000 }), p.click('#fxReload')]); await p.waitForFunction(() => window.__SD, null, { timeout: 120000 });
    check('tras recargar la sala nueva está ' + (want ? 'activa' : 'quitada') + ' (sin bandera en el enlace)', await p.evaluate(w => __SD.LB.on === w && !/lobby=/.test(location.search), want));
    // a flag in the address loses against the switch after RECARGAR (the shortcut never carries flags)
    await load('&lobby=' + (want ? 1 : 2)); await tab();
    check('un enlace viejo con bandera manda en esa visita', (await st()).lobby2 === !want);
    await p.click('#fxList .fxRow[data-k="lobby2"] button[data-v="' + (want ? 1 : 0) + '"]');
    await Promise.all([p.waitForNavigation({ timeout: 120000 }), p.click('#fxReload')]); await p.waitForFunction(() => window.__SD, null, { timeout: 120000 });
    check('RECARGAR quita la bandera del enlace: decide el interruptor', await p.evaluate(w => __SD.LB.on === w && !/lobby=/.test(location.search), want));
    // RESTAURAR ESTA SECCIÓN
    await tab(); await p.click('#setResetTab');
    check('RESTAURAR ESTA SECCIÓN olvida lo recordado y pide recargar', await p.evaluate(() => localStorage.getItem('sniperduel_lobby2') === null && !document.getElementById('fxReloadRow').hidden));
    await Promise.all([p.waitForNavigation({ timeout: 120000 }), p.click('#fxReload')]); await p.waitForFunction(() => window.__SD, null, { timeout: 120000 });
    check('tras restaurar vuelve lo de por defecto', await p.evaluate(v => __SD.LB.on === v, real0.lobby2));
    const vis = await p.evaluate(() => { __SD.openSettings('menu'); document.querySelector('.setTabs button[data-tab="pruebas"]').click(); const t = document.querySelector('.setTabs button[data-tab="pruebas"]').getBoundingClientRect(); return t.width > 0 && t.height > 0; });
    check('en el móvil (932 × 320) la pestaña se ve', vis);
    check('sin errores de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ninguno');
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await browser.close(); web.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
