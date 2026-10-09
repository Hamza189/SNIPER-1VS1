/* Stage D: the complete 1v1 in two REAL browser windows (independent contexts) against the
   real Node server: create room → join with the invitation link → ready → countdown → see
   each other → move → shoot → damage → kill → score on both → victory → rematch.
   It drives the page through its own buttons and input; only the starting positions and the
   score before the last kill are set through the server's test hooks.
   Not a test of Safari/Android or of real networks.  Run: node test/online.browser.test.js */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nONLINE EN NAVEGADOR: playwright no está instalado, se omite'); process.exit(0); }
const { startServer } = require('../server/node.js');
const statics = require('../tools/static-server.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000, polling: 100 }); return true; } catch (e) { return false; } }

(async () => {
  const srv = await startServer({ port: 0, debug: true });
  const web = await statics.start();
  const server = 'http://127.0.0.1:' + srv.port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const open = async (q) => {
    const ctx = await browser.newContext({ viewport: { width: 667, height: 375 } });   // iPhone 8 landscape
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(web.url + '?perf=low&server=' + encodeURIComponent(server) + (q || ''));  // perf=low: no GPU on the test machine
    await page.waitForFunction(() => window.__SD);
    return page;
  };
  try {
    console.log('\nPARTIDA 1v1 EN DOS NAVEGADORES REALES (servidor local)');
    const A = await open('');
    await A.click('#mpBtn'); await A.fill('#mpName', 'Hamza'); await A.click('#mpCreate');
    if (process.env.SHOTS) { await sleep(300); await A.screenshot({ path: process.env.SHOTS + '/lobby-movil.png' }); }
    check('A crea la sala y ve el código', await until(A, () => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent)));
    const code = await A.textContent('#mpCodeBig');
    const link = await A.textContent('#mpLink');
    check('enlace de invitación con el código', link.endsWith('?sala=' + code), link);
    const B = await open('&sala=' + code);
    check('B abre el enlace: el código ya está puesto', await until(B, c => document.getElementById('mpCode').value === c, code));
    await B.fill('#mpName', 'Novia'); await B.click('#mpJoin');
    check('los dos ven a los dos jugadores en el lobby', await until(A, () => document.querySelectorAll('#mpPlayers li').length === 2) && await until(B, () => document.querySelectorAll('#mpPlayers li').length === 2));
    // map choice: the creator picks, the guest sees it and cannot change it
    check('la sala empieza con ARENA DE PRUEBAS elegida', await until(B, () => { const b = document.querySelector('#mpMapSeg button[aria-pressed="true"]'); return b && b.dataset.map === 'arena'; }));
    await A.click('#mpMapSeg button[data-map="pueblo"]');
    check('A cambia a PUEBLO y B lo ve', await until(B, () => __SD.NET.N.map === 'pueblo'));
    check('B no puede cambiar el mapa', await B.evaluate(() => document.querySelector('#mpMapSeg button[data-map="arena"]').disabled));
    await A.click('#mpMapSeg button[data-map="arena"]'); await until(B, () => __SD.NET.N.map === 'arena');
    const vis = await B.evaluate(() => { const r = document.getElementById('mpReady').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 && r.width > 0; });
    check('en una pantalla de móvil apaisado el botón LISTO se ve sin desplazar', vis);
    await A.click('#mpReady'); await B.click('#mpReady');
    check('cuenta atrás en los dos', await until(A, () => !document.getElementById('countdown').hidden) && await until(B, () => __SD.NET.N.phase === 'countdown' || __SD.NET.N.phase === 'playing'));
    check('los dos juegan en la ARENA (mapa del servidor = mapa dibujado)', await until(A, () => __SD.WORLD_ID === 'arena', null, 9000) && await until(B, () => __SD.WORLD_ID === 'arena', null, 9000) && srv.rooms.get(code).debug.mapId === 'arena');
    check('empieza la partida en los dos', await until(A, () => __SD.NET.N.phase === 'playing' && __SD.state === 'playing', null, 9000) && await until(B, () => __SD.NET.N.phase === 'playing', null, 9000));
    check('el marcador muestra el nombre del rival', (await A.textContent('#kBotsLbl')) === 'NOVIA' && (await B.textContent('#kBotsLbl')) === 'HAMZA');
    // face to face across the arena, 36 m apart on an open lane
    const room = srv.rooms.get(code);
    room.debug.place('A', -18, -3, -Math.PI / 2); room.debug.place('B', 18, -3, Math.PI / 2);
    await sleep(1500);
    const seen = async (pg) => pg.evaluate(() => { const R = __SD.REMOTE; return R && R.g.visible ? { x: R.g.position.x, z: R.g.position.z } : null; });
    // (waits on the pages: on a 2-CPU machine two software-rendered pages can fall a few seconds behind)
    const at = (pg, x, z) => until(pg, ([x, z]) => { const R = __SD.REMOTE; return R && R.g.visible && Math.abs(R.g.position.x - x) < 0.5 && Math.abs(R.g.position.z - z) < 0.5; }, [x, z], 6000);
    const okA = await at(A, 18, -3), okB = await at(B, -18, -3), sa = await seen(A), sb = await seen(B);
    check('A ve a B en su sitio', okA, sa && sa.x.toFixed(2) + ',' + sa.z.toFixed(2));
    check('B ve a A en su sitio', okB, sb && sb.x.toFixed(2) + ',' + sb.z.toFixed(2));
    // B walks: A sees it move (the test teleport above is a legitimate server correction: start counting after it)
    await B.evaluate(() => { __SD.NET.N.corrMax = 0; });
    await B.evaluate(() => { __SD.input.keys.KeyD = true; }); await sleep(1500); await B.evaluate(() => { __SD.input.keys.KeyD = false; }); await sleep(1500);
    const sa2 = await seen(A), real = room.seats.B.p.ms;
    check('B se mueve y A lo ve moverse', sa2 && Math.hypot(sa2.x - sa.x, sa2.z - sa.z) > 1 && Math.hypot(sa2.x - real.x, sa2.z - real.z) < 0.6, sa2 && Math.hypot(sa2.x - sa.x, sa2.z - sa.z).toFixed(2) + ' m');
    const predOk = await B.evaluate(() => __SD.NET.N.corrMax);
    check('la predicción de B no tuvo que corregir', predOk < 0.01, predOk.toFixed(4) + ' m · comandos descartados por el servidor: ' + (room.seats.B.dropped || 0));
    // back to the open lane for the shooting part (the walk may have put a crate in the way)
    room.debug.place('B', 18, -3, Math.PI / 2); await sleep(1200);
    // A aims at B's chest with the scope and fires through the real input path
    const aimAndFire = async (pg, y) => {
      const who = pg === A ? 'A' : 'B', s0 = room.seats[who].shots, h0 = room.seats[who].hits;
      await aim(pg, y);
      if (room.seats[who].shots === s0 || room.seats[who].hits === h0) {
        const R = await pg.evaluate(() => { const R = __SD.REMOTE, ls = __SD.NET.N.lastShot; return { lf: __SD.NET.lastFire, shot: ls && { o: ls.o, d: ls.d, c: ls.corrected }, aim: [__SD.AIM.yaw, __SD.AIM.pitch, __SD.AIM.ox, __SD.AIM.oy, __SD.AIM.oz], rx: R.g.position.x, rz: R.g.position.z, x: __SD.P.pos.x, z: __SD.P.pos.z, yaw: __SD.P.yaw, pitch: __SD.P.pitch, ads: __SD.WCORE.ads, st: __SD.WCORE.state, ammo: __SD.WCORE.ammo, alive: __SD.P.alive, ph: __SD.NET.N.phase, gst: __SD.state }; });
        console.log('       diagnóstico ' + who + ': disparos ' + (room.seats[who].shots - s0) + ' impactos ' + (room.seats[who].hits - h0) + ' · ' + JSON.stringify(R) + ' · servidor rival ' + JSON.stringify((({ x, z }) => ({ x, z }))(room.seats[who === 'A' ? 'B' : 'A'].p.ms)) + ' · ' + room.log.slice(-4).join(' | '));
      }
    };
    const aim = async (pg, y) => {
      const who = pg === A ? 'A' : 'B', me = room.seats[who].p.ms, op = room.seats[who === 'A' ? 'B' : 'A'].p.ms;
      await until(pg, ([mx, mz, ox, oz]) => { const R = __SD.REMOTE, P = __SD.P; return Math.hypot(P.pos.x - mx, P.pos.z - mz) < 0.2 && R && R.g.visible && Math.hypot(R.g.position.x - ox, R.g.position.z - oz) < 0.3; }, [me.x, me.z, op.x, op.z], 6000);
      // wait for the scope to be fully up (game time, not wall time: a software GPU can run at a few FPS)
      await pg.evaluate(() => { __SD.input.scope = true; }); await sleep(300); await until(pg, () => __SD.WCORE.ads >= 1, null, 4000);
      await pg.evaluate((yy) => { const R = __SD.REMOTE, P = __SD.P, eye = P.pos.y + __SD.PM.eye;
        const dx = R.g.position.x - P.pos.x, dy = R.g.position.y + yy - eye, dz = R.g.position.z - P.pos.z, d = Math.hypot(dx, dz);
        P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, d); }, y);
      await sleep(400);
      await pg.evaluate(() => { __SD.input.firePressed = true; }); await sleep(900);
      await pg.evaluate(() => { __SD.input.scope = false; });
    };
    await aimAndFire(A, 1.17);
    check('A dispara: B recibe daño (lo confirma el servidor)', await until(B, () => __SD.P.hp < 100, null, 3000), await B.evaluate(() => __SD.P.hp));
    check('A ve el impacto confirmado', await A.evaluate(() => __SD.STATS.hits) === 1);
    room.debug.set('B', 'hp', 10); room.debug.set('B', 'lastHit', 1e15);  // no regeneration while the slow test aims
    await sleep(1200);
    await aimAndFire(A, 1.17);
    check('segundo disparo: B muere y ve la pantalla de eliminado', await until(B, () => !document.getElementById('death').hidden && __SD.state === 'dead', null, 3000));
    // each page applies the kill when its own message arrives (frames are slow without a GPU): wait up to 2 s each
    check('el marcador cambia en los dos: 1–0', await until(A, () => document.getElementById('kYou').textContent === '1', null, 2000) && await until(B, () => document.getElementById('kBots').textContent === '1', null, 2000));
    check('B reaparece a los 3 s', await until(B, () => __SD.state === 'playing' && __SD.P.alive && document.getElementById('death').hidden, null, 6000));
    // B shoots A too
    room.debug.place('A', -18, -3, -Math.PI / 2); room.debug.place('B', 18, -3, Math.PI / 2); await sleep(1500);
    await aimAndFire(B, 1.17);
    check('B dispara a A y A recibe daño', await until(A, () => __SD.P.hp < 100, null, 3000));
    // last kill: 9 → 10
    room.debug.set('A', 'kills', 9); room.debug.set('B', 'hp', 10); room.debug.set('B', 'lastHit', 1e15);  // no regeneration while the slow test aims await sleep(1500);
    await aimAndFire(A, 1.17);
    const vic = await until(A, () => !document.getElementById('over').hidden, null, 4000);
    if (!vic) { console.log('       diagnóstico: fase ' + room.phase + ' · disparos A ' + room.seats.A.shots + ' impactos ' + room.seats.A.hits + ' · vida B ' + Math.round(room.seats.B.hp) + ' viva ' + room.seats.B.alive + ' · arma A ' + room.seats.A.p.w.state + ' balas ' + room.seats.A.p.w.ammo + ' · bajas A ' + room.seats.A.kills + ' muertes B ' + room.seats.B.deaths + ' activo A ' + room.seats.A.p.load.active);
      console.log('       ' + room.log.slice(-6).join(' | ')); }
    check('décima baja: A ve VICTORIA', await until(A, () => !document.getElementById('over').hidden && document.getElementById('overTitle').textContent === 'VICTORIA', null, 4000));
    // (8 s: with two pages drawing by software in one machine, a page can lag a few seconds)
    const der = await until(B, () => !document.getElementById('over').hidden && document.getElementById('overTitle').textContent === 'DERROTA', null, 8000);
    if (!der) console.log('       diagnóstico B: ' + JSON.stringify(await B.evaluate(() => ({ st: __SD.state, ph: __SD.NET.N.phase, over: !document.getElementById('over').hidden, title: document.getElementById('overTitle').textContent, net: __SD.NET.status, dead: !document.getElementById('death').hidden, alive: __SD.P.alive }))) + ' · errores ' + errors.slice(-3).join(' | '));
    check('B ve DERROTA', der);
    await A.click('#again'); await sleep(300);
    check('revancha de uno solo: espera al rival', await A.textContent('#overEyebrow') === 'Esperando al rival…' && room.phase === 'over');
    await B.click('#again');
    check('los dos aceptan: empieza otra partida sin recargar la página', await until(A, () => __SD.NET.N.phase === 'playing' && __SD.state === 'playing', null, 9000) && await until(B, () => __SD.NET.N.phase === 'playing', null, 9000));
    check('marcador a 0–0 y 5 balas', await A.textContent('#kYou') === '0' && await B.textContent('#kYou') === '0' && room.seats.A.p.w.ammo === 5);
    // VÍBORA 9 online: A draws the pistol, B hears and sees it, the server confirms the damage
    room.debug.place('A', -10, -3, -Math.PI / 2); room.debug.place('B', 10, -3, Math.PI / 2); await sleep(1200);
    await A.evaluate(() => { __SD.input.select = 'pistol'; });
    check('A saca la pistola: el servidor y B lo ven', await until(A, () => __SD.LOAD.active === 'pistol' && __SD.LOAD.phase === 'ready', null, 5000) && await until(B, () => __SD.NET.N.remotePose() && __SD.NET.N.remotePose().wpn === 'pistol', null, 5000) && room.seats.A.p.load.active === 'pistol');
    { const hp0 = room.seats.B.hp;
      await A.evaluate(() => { const R = __SD.REMOTE, P = __SD.P, eye = P.pos.y + __SD.PM.eye; const dx = R.g.position.x - P.pos.x, dy = R.g.position.y + 1.17 - eye, dz = R.g.position.z - P.pos.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); });
      await A.evaluate(() => { __SD.input.scope = true; }); await sleep(300); await until(A, () => __SD.PCORE.ads >= 1, null, 4000);
      await A.evaluate(() => { __SD.input.firePressed = true; }); await sleep(300); await A.evaluate(() => { __SD.input.scope = false; });
      // hip/iron-sight spread can move the hit from torso to head or legs: any pistol zone is fine, a rifle number is not
      const PCv = require('../core/config.js').pistols.vibora, d = 20, f = d <= PCv.falloff.from ? 1 : Math.max(PCv.falloff.min, 1 - (1 - PCv.falloff.min) * (d - PCv.falloff.from) / (PCv.falloff.to - PCv.falloff.from));
      const hitP = await until(B, () => __SD.P.hp < 100, null, 4000), lost = hp0 - room.seats.B.hp;
      check('disparo de pistola a 20 m: el servidor quita daño de pistola (cabeza 90 / torso 34 / piernas 26, con caída por distancia)', hitP && Object.values(PCv.dmg).some(v => Math.abs(lost - v * f) < 2.5), hp0 + ' → ' + Math.round(room.seats.B.hp) + ' (−' + lost.toFixed(1) + ')');
      check('el disparo llega a B como de pistola', await B.evaluate(() => __SD.NET.N.lastShot && __SD.NET.N.lastShot.w === 'pistol'));
      check('munición de la pistola igual en A y en el servidor', await A.evaluate(() => __SD.PCORE.ammo) === room.seats.A.p.pw.ammo); }
    // FURIA 12 online: A picks it in the pause menu (real click), gets it at the next spawn, fires point blank
    await A.evaluate(() => __SD.pause()); await sleep(300);
    if (process.env.SHOTS) await A.screenshot({ path: process.env.SHOTS + '/pausa-movil.png' });
    await A.locator('#pause .kitSeg button[data-kit="shotgun"]').click(); await sleep(400);
    await A.evaluate(() => __SD.resume());
    check('A elige FURIA 12 en la pausa: el servidor lo sabe, pero A sigue con su arma hasta reaparecer', room.seats.A.kit === 'shotgun' && room.seats.A.p.load.active !== 'shotgun');
    { const sa = room.debug.seat('A'); sa.alive = false; sa.diedAt = room.now; }
    check('al reaparecer, A lleva la escopeta (servidor, su página y lo que ve B)', await until(A, () => __SD.LOAD.active === 'shotgun' && __SD.P.alive, null, 8000) && room.seats.A.p.load.active === 'shotgun' && await until(B, () => __SD.NET.N.remotePose() && __SD.NET.N.remotePose().wpn === 'shotgun', null, 5000));
    room.debug.place('A', -2, -3, -Math.PI / 2); room.debug.place('B', 2, -3, Math.PI / 2); room.debug.set('B', 'lastHit', 1e15); await sleep(1500);
    { const hp0 = room.seats.B.hp, d0 = room.seats.B.deaths;
      await A.evaluate(() => { const R = __SD.REMOTE, P = __SD.P, eye = P.pos.y + __SD.PM.eye; const dx = R.g.position.x - P.pos.x, dy = R.g.position.y + 1.17 - eye, dz = R.g.position.z - P.pos.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); });
      await A.evaluate(() => { __SD.input.scope = true; }); await sleep(300); await until(A, () => __SD.SCORE.ads >= 1 && __SD.SCORE.state === 'ready', null, 4000);
      await A.evaluate(() => { __SD.input.firePressed = true; }); await sleep(600); await A.evaluate(() => { __SD.input.scope = false; });
      const dead = room.seats.B.deaths > d0, lost = dead ? hp0 : hp0 - room.seats.B.hp;
      check('escopeta a 4 m al pecho: el servidor suma los perdigones (mata o casi)', dead || lost >= 90, dead ? 'B eliminado' : '−' + Math.round(lost));
      check('el disparo llega a B como de escopeta y B lo dibuja con el mismo patrón', await B.evaluate(() => __SD.NET.N.lastShot && __SD.NET.N.lastShot.w === 'shotgun' && typeof __SD.NET.N.lastShot.n === 'number'));
      check('cartuchos iguales en A y en el servidor', await until(A, n => __SD.SCORE.ammo === n, room.seats.A.p.sw.ammo, 2000) && room.seats.A.p.sw.ammo === 5, room.seats.A.p.sw.ammo); }
    // the pause menu does not stop the online match, and B dropping shows RECONECTANDO
    await A.evaluate(() => __SD.pause()); await sleep(500);
    check('pausa en online: el servidor sigue y A no dispara', room.phase === 'playing' && await A.evaluate(() => __SD.state) === 'paused');
    await A.evaluate(() => __SD.resume());
    await B.evaluate(() => { __SD.NET.ws.close(); });
    check('B pierde la conexión: A ve que el rival se ha desconectado', await until(A, () => !document.getElementById('netBanner').hidden, null, 4000));
    check('B reconecta solo y la partida sigue', await until(B, () => __SD.NET.status === 'online' && __SD.NET.N.phase === 'playing', null, 8000) && await until(A, () => document.getElementById('netBanner').hidden, null, 4000));
    await A.click('#hud', { force: true }).catch(() => {});
    await A.evaluate(() => __SD.toMenu());
    check('A sale al menú: vuelve el juego offline', await until(A, () => __SD.mode !== 'online' && !document.getElementById('mp').hidden || !document.getElementById('menu').hidden, null, 3000));
    check('B ve la victoria por abandono', await until(B, () => !document.getElementById('over').hidden && document.getElementById('overTitle').textContent === 'VICTORIA', null, 5000));
    await B.click('#again');
    check('B pulsa ESPERAR OTRO RIVAL: vuelve al lobby de su sala', await until(B, () => !document.getElementById('mp').hidden && !document.getElementById('mpLobby').hidden, null, 5000));
    check('sin errores de JavaScript en ninguna de las dos páginas', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ninguno');
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await browser.close(); web.close(); await srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
