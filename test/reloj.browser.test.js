/* Reloj de la partida, minimapa y ajustes de sala en la página real (28-10-2026):
   - contra bots: el reloj sale con los minutos del menú (10 por defecto) y al acabarse termina la partida (empate si van
     iguales)
   - minimapa: se ve, el mapa sale de las cajas de colisión, un disparo enemigo delante sale ARRIBA del centro (el mapa gira
     con tu vista), se apaga en AJUSTES; en el móvil va arriba a la derecha (la vida está a la izquierda)
   - online (servidor local): quien crea la sala elige 5 bajas y 5 minutos, el otro lo ve y su reloj empieza en 5:00
   Run: node test/reloj.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
const { startServer } = require('../server/node.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start(), gs = await startServer({ port: 0 });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async (q, o) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 960, height: 540 } }, o || {}));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + '?perf=low&server=' + encodeURIComponent('http://127.0.0.1:' + gs.port) + (q || ''), { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 180000 });
    return { ctx, p, errs };
  };
  const duel = p => p.evaluate(() => { __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.setOffMap('pueblo'); __SD.startMatch(); })
    .then(() => p.waitForFunction(() => __SD.state === 'playing', null, { timeout: 120000 }));
  try {
    console.log('\nRELOJ CONTRA BOTS');
    const A = await open();
    check('por defecto: 10 minutos', await A.p.evaluate(() => __SD.OFF_TIME === 10 && document.querySelector('#offTimeSeg [data-t="10"]').getAttribute('aria-pressed') === 'true'));
    await duel(A.p);
    await A.p.waitForTimeout(400);
    check('al empezar el reloj marca 10:00 (o 9:59) bajo el marcador', await A.p.evaluate(() => !document.getElementById('clock').hidden && /^(10:00|9:59)$/.test(document.getElementById('clock').textContent)), await A.p.textContent('#clock'));
    await A.p.evaluate(() => __SD.toMenu()); await A.p.click('#offTimeSeg [data-t="5"]');
    await duel(A.p);
    check('5 MIN en el menú: el reloj empieza en 5:00 y se guarda', await A.p.waitForFunction(() => /^(5:00|4:59)$/.test(document.getElementById('clock').textContent), null, { timeout: 5000 }).then(() => true, () => false) && await A.p.evaluate(() => JSON.parse(localStorage.getItem('sniperduel_offTime')) === 5));
    await A.p.evaluate(() => { __SD.STATS.start -= 300; });
    check('se acaba el tiempo 0–0: EMPATE, «Se acabó el tiempo»', await A.p.waitForFunction(() => __SD.state === 'over', null, { timeout: 5000 }).then(() => true, () => false)
      && await A.p.evaluate(() => document.getElementById('overTitle').textContent === 'EMPATE' && /Se acabó el tiempo/.test(document.getElementById('overEyebrow').textContent)));
    await A.p.evaluate(() => __SD.toMenu()); await A.p.click('#offTimeSeg [data-t="0"]'); await duel(A.p);
    check('SIN LÍMITE: no hay reloj', await A.p.evaluate(() => document.getElementById('clock').hidden));

    console.log('\nMINIMAPA');
    await A.p.waitForTimeout(300);
    const m = await A.p.evaluate(() => { const L = __SD.miniLayer(); return { shown: !document.getElementById('mini').hidden, L: !!L, w: L && L.cv.width, r: L && L.radius }; });
    check('se ve y el mapa sale de las cajas de colisión del pueblo', m.shown && m.L && m.w > 200, JSON.stringify(m));
    // a rival shot 12 m in front of you → a red dot above the centre (the map turns with your view)
    const px = await A.p.evaluate(async () => {
      const P = __SD.P, PM = __SD.PM; __SD.MINI.pings.length = 0;
      __SD.miniPing(PM.x - Math.sin(P.yaw) * 12, PM.z - Math.cos(P.yaw) * 12); __SD.MINI.last = 0;
      await new Promise(r => setTimeout(r, 250));
      const cv = document.getElementById('mini'), g = cv.getContext('2d'), c = cv.width / 2, R = __SD.miniLayer().radius, k = (c - 2 * Math.min(2, devicePixelRatio)) / R;
      const at = (x, y) => Array.from(g.getImageData(Math.round(x), Math.round(y), 1, 1).data);
      return { up: at(c, c - 12 * k), down: at(c, c + 12 * k) };
    });
    check('un disparo delante sale arriba del centro, en rojo', px.up[0] > 150 && px.up[1] < 120 && !(px.down[0] > 150 && px.down[1] < 120), JSON.stringify(px));
    await A.p.evaluate(() => { __SD.SETTINGS.minimap = false; }); await A.p.waitForTimeout(200);
    check('AJUSTES › Minimapa apagado: no se ve', await A.p.evaluate(() => document.getElementById('mini').hidden));
    await A.p.evaluate(() => { __SD.SETTINGS.minimap = true; });
    check('sin errores (bots)', A.errs.length === 0, A.errs.slice(0, 2).join(' | '));
    await A.ctx.close();
    const M = await open('', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    await duel(M.p); await M.p.waitForTimeout(300);
    const pos = await M.p.evaluate(() => { const r = document.getElementById('mini').getBoundingClientRect(), v = document.getElementById('vitals').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, vRight: v.right, vBottom: v.bottom, w: innerWidth }; });
    check('móvil: arriba a la derecha, sin tapar la vida', pos.right > pos.w - 30 && pos.top < 20 && pos.left > pos.vRight, JSON.stringify(pos));
    if (process.env.SHOTS) await M.p.screenshot({ path: process.env.SHOTS + '/reloj-movil.png' });
    await M.ctx.close();

    console.log('\nAJUSTES DE SALA ONLINE');
    const H = await open('&pj=0');
    await H.p.click('#mpBtn'); await H.p.fill('#mpName', 'Hamza'); await H.p.click('#mpCreate');
    await H.p.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent), null, { timeout: 15000 });
    const sala = await H.p.textContent('#mpCodeBig');
    const N = await open('&pj=0&sala=' + sala);
    await N.p.fill('#mpName', 'Novia'); await N.p.click('#mpJoin');
    await N.p.waitForFunction(() => document.querySelectorAll('#mpPlayers li').length === 2, null, { timeout: 15000 });
    check('el invitado no puede cambiar los ajustes', await N.p.evaluate(() => [...document.querySelectorAll('#mpKillSeg button,#mpTimeSeg button')].every(b => b.disabled)));
    await H.p.click('#mpKillSeg [data-k="5"]'); await H.p.click('#mpTimeSeg [data-t="5"]');
    check('quien crea elige 5 bajas y 5 min: el invitado lo ve marcado', await N.p.waitForFunction(() => document.querySelector('#mpKillSeg [data-k="5"]').getAttribute('aria-pressed') === 'true' && document.querySelector('#mpTimeSeg [data-t="5"]').getAttribute('aria-pressed') === 'true', null, { timeout: 10000 }).then(() => true, () => false));
    if (process.env.SHOTS) await H.p.screenshot({ path: process.env.SHOTS + '/reloj-sala.png' });
    await H.p.click('#mpReady'); await N.p.click('#mpReady');
    check('en la partida: PRIMERO A 5 y el reloj desde 5:00', await N.p.waitForFunction(() => __SD.NET.N && __SD.NET.N.phase === 'playing' && /^(5:00|4:5\d)$/.test(document.getElementById('clock').textContent) && /PRIMERO A 5\b/.test(document.querySelector('#score .goal').textContent), null, { timeout: 60000 }).then(() => true, () => false), await N.p.textContent('#clock'));
    check('sin errores (online)', H.errs.length === 0 && N.errs.length === 0, H.errs.concat(N.errs).slice(0, 2).join(' | '));
    await H.ctx.close(); await N.ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close(); await gs.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
