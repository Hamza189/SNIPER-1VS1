/* En la partida (19-11-2026, el propietario): cambiar el aspecto desde la pausa sin salir, bajas más llamativas y RADAR.
   - pausa: OPERADOR Y ARMA abre la lista de operadores y rifles encima de la pausa; elegir otro operador lo cambia al
     momento; VOLVER deja la pausa como estaba; CAMUFLAJE abre CAJAS Y OBJETOS en la pestaña de camuflajes
   - baja: el aviso del centro sale en rojo vivo con brillo (clase kill) y la línea del registro también
   - radar: a los 12 s de partida los bots salen 3 s en el minimapa, aunque esté apagado; ?radar=0 lo quita
   Run: node test/pausa.browser.test.js   (GPU=0: WebGL por software) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const GPU = process.env.GPU === '0' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist'];

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: GPU });
  const open = async (q, settings) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    if (settings) await ctx.addInitScript(s => { try { localStorage.setItem('sniperduel_settings', JSON.stringify(s)); } catch (e) {} }, settings);
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + '?carga=1&pj=pro' + (q || ''), { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 180000 });
    return { ctx, p, errs };
  };
  const play = p => p.evaluate(async () => { __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.setOffMap('arena'); __SD.startMatch();
    const t = performance.now(); while (!(__SD.state === 'playing' && __SD.LOAD.phase === 'ready') && performance.now() - t < 90000) await new Promise(r => setTimeout(r, 100)); });
  try {
    console.log('\nRADAR');
    const A = await open('&radar=1', { minimap: false });
    await play(A.p);
    const r0 = await A.p.evaluate(() => ({ on: __SD.RADAR.on, next: __SD.RADAR.next, t: __SD.gameTime, pings: __SD.MINI.pings.length, mini: !document.getElementById('mini').hidden }));
    check('al empezar: radar puesto, primer barrido a los 12 s, sin puntos y el minimapa apagado', r0.on && Math.abs(r0.next - r0.t - 12) < 0.6 && r0.pings === 0 && !r0.mini, JSON.stringify(r0));
    // at the very moment of the sweep: the bots alive then
    // at the very moment of the sweep (the bots' own shots also show on the minimap: only the radar's dots count)
    const r1 = await A.p.evaluate(async () => { const t0 = performance.now(); while (__SD.RADAR.at < 0 && performance.now() - t0 < 25000) await new Promise(r => setTimeout(r, 20));
      const bots = __SD.BOTS.filter(b => b.alive), rp = __SD.MINI.pings.filter(p => p.radar); return { pings: rp.length, bots: bots.length, t: +(__SD.RADAR.at).toFixed(1), mini: !document.getElementById('mini').hidden,
      near: rp.every(p => bots.some(b => Math.hypot(b.g.position.x - p.x, b.g.position.z - p.z) < 0.6)) }; });
    check('a los 12 s: los bots salen en el minimapa, cada punto donde está un bot', r1.pings >= 1 && r1.pings <= r1.bots && r1.near && r1.t >= 11.5 && r1.t < 14, JSON.stringify(r1));
    check('con el minimapa apagado, se enciende durante el barrido', r1.mini);
    await A.p.waitForTimeout(3600);
    check('a los 3 s: el minimapa vuelve a apagarse', await A.p.evaluate(() => document.getElementById('mini').hidden));

    console.log('\nBAJA MÁS LLAMATIVA');
    const k = await A.p.evaluate(() => { const bot = __SD.BOTS.find(b => b.alive); __SD.onKill(bot, false, 42); const c = document.getElementById('callout'), m = document.getElementById('calloutMain');
      const f = document.querySelector('#feed div'); return { cls: c.className, color: getComputedStyle(m).color, glow: getComputedStyle(m).textShadow, feed: f && f.className, fbg: f && getComputedStyle(f).backgroundImage }; });
    check('el aviso de la baja sale en rojo vivo con brillo', /\bkill\b/.test(k.cls) && k.color === 'rgb(255, 52, 52)' && /rgba\(255, 40, 30/.test(k.glow), k.cls + ' ' + k.color);
    check('y la línea del registro, con fondo rojo', /\bkill\b/.test(k.feed) && /gradient/.test(k.fbg), k.feed);

    console.log('\nPAUSA: TU ASPECTO SIN SALIR');
    await A.p.evaluate(() => __SD.pause());
    await A.p.waitForFunction(() => !document.getElementById('pause').hidden, null, { timeout: 5000 }).catch(() => {});
    const has = await A.p.evaluate(() => ({ pause: !document.getElementById('pause').hidden, look: !!document.getElementById('pauseLook'), camo: !!document.getElementById('pauseCamo') }));
    check('la pausa tiene OPERADOR Y ARMA y CAMUFLAJE', has.pause && has.look && has.camo, JSON.stringify(has));
    await A.p.click('#pauseLook');
    const o = await A.p.evaluate(() => ({ skin: !document.getElementById('skinOv').hidden, under: document.getElementById('pause').classList.contains('under'), rifles: document.querySelectorAll('#wsRifleGrid .skinCard').length }));
    check('OPERADOR Y ARMA abre operadores y rifles encima de la pausa', o.skin && o.under, JSON.stringify(o));
    const other = await A.p.evaluate(() => { const c = [...document.querySelectorAll('#skinGrid .skinCard')].find(x => x.getAttribute('aria-pressed') !== 'true'); if (c) c.click(); return c && c.dataset.skin; });
    check('elegir otro operador lo cambia al momento', !!other && await A.p.evaluate(s => document.querySelector('#skinGrid .skinCard[data-skin="' + s + '"]').getAttribute('aria-pressed') === 'true', other), other);
    check('al elegirlo, la lista se cierra y vuelve la pausa (la partida sigue en pausa)', await A.p.evaluate(() => document.getElementById('skinOv').hidden && !document.getElementById('pause').hidden && !document.getElementById('pause').classList.contains('under') && __SD.state === 'paused'));
    await A.p.click('#pauseCamo');
    const iv = await A.p.evaluate(() => ({ inv: !document.getElementById('invOv').hidden, tab: (document.querySelector('#invTabs [aria-pressed="true"],#invTabs .on') || {}).dataset }));
    check('CAMUFLAJE abre CAJAS Y OBJETOS en camuflajes', iv.inv && iv.tab && iv.tab.tab === 'camo', JSON.stringify(iv));
    check('sin errores', A.errs.length === 0, A.errs.slice(0, 3).join(' | '));
    await A.ctx.close();

    console.log('\nRADAR APAGADO');
    const B = await open('&radar=0');
    await play(B.p);
    await B.p.waitForTimeout(13500);
    check('?radar=0: a los 13 s, ningún punto del RADAR en el minimapa (los de los bots que disparan sí salen)', await B.p.evaluate(() => !__SD.RADAR.on && !__SD.MINI.pings.some(p => p.radar)));
    await B.p.evaluate(() => localStorage.removeItem('sniperduel_radarOff'));
    await B.ctx.close();
  } catch (e) { fail++; console.log('  FAIL excepción: ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
