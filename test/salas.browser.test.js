/* Salas personalizadas en la página real con el servidor local (docs/SALAS-PERSONALIZADAS.md):
   - TODOS CONTRA TODOS: quien crea la sala elige 3 bots y empieza sola; ve a los 3 bots del servidor moverse y disparar,
     el marcador dice TÚ y LÍDER, y se le puede dar a un bot
   - EQUIPOS con una amiga: los dos en ROJO contra 2 bots AZUL; el marcador dice ROJO y AZUL, la compañera lleva la
     marca azul y no se le puede disparar; el minimapa la enseña siempre
   Run: node test/salas.browser.test.js   (SHOTS=<carpeta> guarda capturas) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
const { startServer } = require('../server/node.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start(), gs = await startServer({ port: 0 });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async (q) => {
    const ctx = await b.newContext({ viewport: { width: 960, height: 600 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + '?perf=low&pj=0&server=' + encodeURIComponent('http://127.0.0.1:' + gs.port) + (q || ''), { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 180000 });
    // no pointer lock in the test browser
    await p.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
    return { ctx, p, errs };
  };
  const create = async (P, name) => {
    await P.p.click('#mpBtn'); await P.p.fill('#mpName', name); await P.p.click('#mpCreate');
    await P.p.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent), null, { timeout: 15000 });
    return P.p.textContent('#mpCodeBig');
  };
  const shot = async (p, name) => { if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/' + name + '.png' }); };
  try {
    console.log('\nTODOS CONTRA TODOS CON BOTS');
    const A = await open();
    await create(A, 'Hamza');
    check('el lobby tiene el modo (1 CONTRA 1 por defecto) y los ajustes de bots salen al elegir TODOS', await A.p.evaluate(() => document.querySelector('#mpModeSeg [data-mode="duelo"]').getAttribute('aria-pressed') === 'true' && document.getElementById('mpCustom').hidden));
    await A.p.click('#mpModeSeg [data-mode="todos"]');
    await A.p.waitForFunction(() => !document.getElementById('mpCustom').hidden, null, { timeout: 10000 });
    await A.p.click('#mpBotsSeg [data-b="3"]'); await A.p.click('#mpDiffSeg [data-d="0"]');
    check('3 bots RECLUTA: el lobby lo anuncia y deja empezar sola', await A.p.waitForFunction(() => /\+ 3 BOTS DEL SERVIDOR · RECLUTA/.test(document.getElementById('mpPlayers').textContent) && /Pulsa LISTO/.test(document.getElementById('mpStatus').textContent), null, { timeout: 10000 }).then(() => true, () => false), await A.p.textContent('#mpPlayers'));
    await shot(A.p, 'salas-lobby-todos');
    await A.p.click('#mpReady');
    check('empieza: 3 rivales (bots) en el campo y el marcador dice TÚ / LÍDER', await A.p.waitForFunction(() => __SD.NET.N && __SD.NET.N.phase === 'playing' && Object.keys(__SD.REMOTES).length === 3 && Object.values(__SD.REMOTES).filter(r => r.g.visible).length >= 2
      && document.querySelector('#score .you span').textContent === 'TÚ' && document.getElementById('kBotsLbl').textContent === 'LÍDER', null, { timeout: 60000 }).then(() => true, () => false),
      await A.p.evaluate(() => Object.keys(__SD.REMOTES).join(',') + ' · ' + document.getElementById('kBotsLbl').textContent));
    const p0 = await A.p.evaluate(() => Object.fromEntries(Object.entries(__SD.REMOTES).map(([k, r]) => [k, [r.g.position.x, r.g.position.z]])));
    // 8 s of play: the bots move on screen and fire (their shots arrive as events from the server)
    const fired = await A.p.evaluate(async () => { const by = new Set(); for (let i = 0; i < 40; i++) { const ls = __SD.NET.N.lastShot; if (ls && ls.by !== __SD.NET.N.you) by.add(ls.by); await new Promise(r => setTimeout(r, 200)); } return [...by]; });
    const moved = await A.p.evaluate(p0 => Object.entries(__SD.REMOTES).filter(([k, r]) => Math.hypot(r.g.position.x - p0[k][0], r.g.position.z - p0[k][1]) > 1).length, p0);
    check('los bots del servidor se mueven y disparan (8 s)', moved >= 1 && fired.length >= 1, moved + ' de 3 se movieron · dispararon ' + fired.join(','));
    check('a los bots se les puede disparar (sus zonas de impacto están en los blancos)', await A.p.evaluate(() => { const T = __SD.shotTargets(); return Object.values(__SD.REMOTES).filter(r => r.alive).some(r => r.hit.some(m => T.includes(m))); }));
    await shot(A.p, 'salas-partida-todos');
    check('sin errores (todos contra todos)', A.errs.length === 0, A.errs.slice(0, 2).join(' | '));
    await A.ctx.close();

    console.log('\nEQUIPOS CON UNA AMIGA');
    const H = await open(); const sala = await create(H, 'Hamza');
    await H.p.click('#mpModeSeg [data-mode="equipos"]');
    await H.p.waitForFunction(() => !document.getElementById('mpTeamSeg').hidden, null, { timeout: 10000 });
    const N = await open('&sala=' + sala);
    await N.p.fill('#mpName', 'Novia'); await N.p.click('#mpJoin');
    await N.p.waitForFunction(() => __SD.NET.N && __SD.NET.N.you === 'B', null, { timeout: 15000 });
    await H.p.click('#mpTeamSeg [data-team="rojo"]'); await N.p.click('#mpTeamSeg [data-team="rojo"]');
    check('los dos eligen ROJO: el lobby los marca y anuncia 2 bots que rellenan', await H.p.waitForFunction(() => document.querySelectorAll('#mpPlayers li.rojo').length === 2 && /\+ 2 BOTS/.test(document.getElementById('mpPlayers').textContent), null, { timeout: 10000 }).then(() => true, () => false));
    check('la amiga no puede cambiar el modo pero sí su equipo', await N.p.evaluate(() => [...document.querySelectorAll('#mpModeSeg button')].every(b => b.disabled) && [...document.querySelectorAll('#mpTeamSeg button')].every(b => !b.disabled)));
    await shot(H.p, 'salas-lobby-equipos');
    await H.p.click('#mpReady'); await N.p.click('#mpReady');
    check('empieza: marcador ROJO / AZUL', await H.p.waitForFunction(() => __SD.NET.N && __SD.NET.N.phase === 'playing' && document.querySelector('#score .you span').textContent === 'ROJO' && document.getElementById('kBotsLbl').textContent === 'AZUL', null, { timeout: 60000 }).then(() => true, () => false));
    await H.p.waitForTimeout(1500);
    const mate = await H.p.evaluate(() => { const R = __SD.REMOTES.B; return { has: !!R, mark: !!(R && R.mate && R.mate.visible), enemies: Object.keys(__SD.REMOTES).filter(k => k !== 'B').length }; });
    check('la compañera lleva la marca azul; los 2 bots son los rivales', mate.has && mate.mark && mate.enemies === 2, JSON.stringify(mate));
    check('a la compañera no se le puede disparar; a los bots rivales sí', await H.p.evaluate(() => { const T = __SD.shotTargets(), R = __SD.REMOTES.B;
      return !!R && !R.hit.some(m => T.includes(m)) && Object.keys(__SD.REMOTES).filter(k => k !== 'B').some(k => __SD.REMOTES[k].alive && __SD.REMOTES[k].hit.some(m => T.includes(m))); }));
    await shot(H.p, 'salas-partida-equipos');
    check('sin errores (equipos)', H.errs.length === 0 && N.errs.length === 0, H.errs.concat(N.errs).slice(0, 2).join(' | '));
    await H.ctx.close(); await N.ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close(); await gs.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
