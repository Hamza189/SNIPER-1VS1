/* Aspectos de arma (?pj=pro, tools/arma-ext): rifles y cuchillo CC BY en la 1ª persona.
   - al elegir uno, el modelo del HALCÓN / NAVAJA se oculta y el nuevo ocupa su sitio; el cerrojo y el cargador del
     aspecto cuelgan de los del HALCÓN (se mueven con sus animaciones) y el fogonazo sale de su boca
   - disparar y recargar funcionan igual (solo cambia el aspecto); volver al HALCÓN lo deja como siempre
   Run: node test/armas.browser.test.js   (SHOTS=carpeta para capturas) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    console.log('\nASPECTOS DE ARMA');
    const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); } catch (e) {} });
    const p = await ctx.newPage(), errs = [], bad = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('response', r => { if (/\/assets\/armas\//.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await p.goto(srv.url + '?vm=1&pj=pro');
    await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 120000 });
    check('la ventana de personaje trae «Tu rifle» (5) y «Tu cuchillo» (2)', await p.evaluate(() => document.querySelectorAll('#wsRifleGrid .skinCard').length === 5 && document.querySelectorAll('#wsKnifeGrid .skinCard').length === 2));
    await p.evaluate(() => { document.querySelector('canvas').requestPointerLock = () => Promise.reject(new Error('sin captura')); __SD.setDuelLethal(false); __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); __SD.BOTS.forEach(b => { b.alive = false; b.g.visible = false; }); });
    await p.waitForTimeout(1500);
    for (const id of ['titan', 'ultima', 'vector', 'sahara']) {
      await p.evaluate(id => __SD.setWskin('rifle', id), id);
      const ok = await p.waitForFunction(() => __SD.WS_ST.rifle.objs.length > 0, null, { timeout: 60000 }).then(() => true, () => false);
      const r = await p.evaluate(() => { const S = __SD.WS_ST.rifle, R = __SD.RIF; return { hid: S.base.meshes.every(m => !m.visible), n: S.objs.length, boltZ: R.boltZ, bolt: R.bolt.children.some(c => S.objs.includes(c)), mag: R.mag.children.some(c => S.objs.includes(c)) }; });
      check(id + ': el HALCÓN se oculta y el aspecto ocupa su sitio (cuerpo' + (r.bolt ? ', cerrojo' : '') + (r.mag ? ', cargador' : '') + ')', ok && r.hid && r.n >= 1, JSON.stringify(r));
      if (process.env.SHOTS) { await p.waitForTimeout(600); await p.screenshot({ path: process.env.SHOTS + '/arma-' + id + '.png' }); }
      // fire: the bolt cycles with the skin's bolt
      const shots0 = await p.evaluate(() => __SD.STATS.shots);
      await p.evaluate(() => { __SD.input.firePressed = true; });
      // (waits for the events, not a fixed time: software WebGL under load runs the game slower than the clock)
      const cyc = await p.waitForFunction(() => __SD.WCORE.state === 'bolt', null, { timeout: 15000 }).then(() => true, () => false);
      if (process.env.SHOTS) { await p.waitForTimeout(300); await p.screenshot({ path: process.env.SHOTS + '/arma-' + id + '-cerrojo.png' }); }
      const done = await p.waitForFunction(s0 => __SD.STATS.shots === s0 + 1 && __SD.WCORE.state === 'ready', shots0, { timeout: 20000 }).then(() => true, () => false);
      check(id + ': dispara y acciona el cerrojo igual que siempre', cyc && done, await p.evaluate(s0 => (__SD.STATS.shots - s0) + ' disparo · ' + __SD.WCORE.state, shots0));
    }
    await p.evaluate(() => __SD.setWskin('rifle', 'halcon'));
    check('volver al HALCÓN: su modelo vuelve y el cerrojo a su sitio', await p.evaluate(() => { const S = __SD.WS_ST.rifle; return S.base.meshes.every(m => m.visible) && S.objs.length === 0 && Math.abs(__SD.RIF.boltZ - 0.08) < 1e-6; }));
    // knife
    await p.evaluate(() => { __SD.setWskin('knife', 'tactica'); __SD.input.select = 'knife'; });
    const kn = await p.waitForFunction(() => __SD.WS_ST.knife.objs.length > 0 && __SD.LOAD.active === 'knife', null, { timeout: 60000 }).then(() => true, () => false);
    check('cuchillo TÁCTICA en la mano en lugar de la NAVAJA', kn && await p.evaluate(() => __SD.WS_ST.knife.base.meshes.every(m => !m.visible)));
    if (process.env.SHOTS) { await p.waitForTimeout(800); await p.screenshot({ path: process.env.SHOTS + '/arma-tactica.png' }); }
    check('créditos CC BY de las armas en AJUSTES › GRÁFICOS', await p.evaluate(() => ['Aleksandr', 'drepi.3d', 'Vlasov Daniil', 'awakov_dawid', 'lunea'].every(n => document.getElementById('credits').textContent.includes(n))));
    check('se guarda lo elegido', await p.evaluate(() => JSON.parse(localStorage.getItem('sniperduel_wsKnife')) === 'tactica' && JSON.parse(localStorage.getItem('sniperduel_wsRifle')) === 'halcon'));
    check('sin 404 ni errores', bad.length === 0 && errs.length === 0, bad.concat(errs).slice(0, 3).join(' | '));
    await ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
