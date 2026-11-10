/* SALA 1V1 (?lobby=2, 10-11-2026, docs/SALA-1V1.md): the new waiting room in two REAL browsers (independent contexts: a PC
   window of 1600 × 900 and a phone in landscape, 932 × 430 with touch) against the real Node server.
   crear sala → invitación (enlace copiado) → entra el segundo → los dos operadores juntos en el hangar → cambiar mapa →
   LISTO los dos → (cambiar mapa quita los LISTO) → iniciar → los dos cargan el mismo mapa → caída y reconexión en la
   partida → salir y volver (fin por abandono) → revancha → partida 2. Also: the screen of always comes back with ?lobby=1.
   It drives the page through its own buttons; the only shortcut is moving the server's pause clock (60 s) forward.
   Captures (PC and phone) with SHOTS=<folder>; with --gpu the browser uses the real GPU (ANGLE d3d11), else software.
   Run: node test/sala1v1.browser.test.js */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nSALA 1V1 EN NAVEGADOR: playwright no está instalado, se omite'); process.exit(0); }
const { startServer } = require('../server/node.js');
const statics = require('../tools/static-server.js');
const gpu = process.argv.includes('--gpu'), SHOTS = process.env.SHOTS;
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000, polling: 100 }); return true; } catch (e) { return false; } }

(async () => {
  const srv = await startServer({ port: 0, debug: true });
  const web = await statics.start();
  const server = 'http://127.0.0.1:' + srv.port;
  const browser = await chromium.launch({ args: gpu ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const ctxOf = async phone => {
    const ctx = await browser.newContext(phone ? { viewport: { width: 932, height: 430 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 1600, height: 900 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: web.url.replace(/\/$/, '') });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    return ctx;
  };
  const open = async (ctx, q) => {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(web.url + '?' + (gpu ? '' : 'perf=low&') + 'server=' + encodeURIComponent(server) + (q || ''), { timeout: 120000 });
    await page.waitForFunction(() => window.__SD, null, { timeout: 120000 });
    return page;
  };
  const shot = async (pg, name) => { if (SHOTS) { await sleep(600); await pg.screenshot({ path: SHOTS + '/' + name + '.png' }); } };
  const opShown = (pg, k) => until(pg, k => { const L = __SD.LB; return !!(L.pv && L.pv[k].visible && L.room); }, k, 120000);
  try {
    console.log('\nSALA 1V1 (?lobby=2) EN DOS NAVEGADORES REALES: PC Y MÓVIL (servidor local)');
    const ctxA = await ctxOf(false), ctxB = await ctxOf(true);
    const A = await open(ctxA, '&lobby=2');
    check('con ?lobby=2 la sala nueva está activa', await A.evaluate(() => __SD.LB.on));
    await A.click('#m2 .m2Mode[data-sel=online]');
    check('INICIO › MULTIJUGADOR 1V1 abre su propia pantalla: CREAR SALA PRIVADA y UNIRSE con código', await until(A, () => !document.getElementById('lb').hidden && !document.getElementById('lbHome').hidden && document.getElementById('menu').hidden && document.getElementById('mp').hidden)
      && /CREAR SALA PRIVADA/.test(await A.textContent('#lbCreate')) && /UNIRSE CON CÓDIGO/.test(await A.textContent('#lbHome')));
    check('el hangar 3D se dibuja con tu operador en su sitio', await opShown(A, 0) && await A.evaluate(() => __SD.LB.vis && !__SD.M2.room));
    await shot(A, 'pc-1-inicio');
    await A.fill('#lbName', 'Hamza');
    await A.click('#lbCreate'); await A.click('#lbCreate').catch(() => {});   // a double tap creates one room only
    check('A crea la sala: ve el código arriba y en INVITAR', await until(A, () => /^[A-Z0-9]{6}$/.test(document.getElementById('lbCodeTopTxt').textContent) && !document.getElementById('lbRoom').hidden));
    check('pulsar dos veces CREAR no crea dos salas', srv.rooms.size === 1, srv.rooms.size + ' sala(s)');
    const code = await A.textContent('#lbCodeTopTxt'), room = srv.rooms.get(code);
    check('la sala del servidor sabe que el anfitrión inicia con su botón (hs)', room.seats.A && room.seats.A.hostBtn === true && await A.evaluate(() => __SD.NET.N.hs === 1));
    check('INVITAR abierto en el PC con el código', !(await A.locator('#lbInvite').isHidden()) && (await A.textContent('#lbInvCodeTxt')) === code);
    await A.click('#lbCopyLink');
    const link = await A.evaluate(() => navigator.clipboard.readText());
    check('copiar enlace: el enlace de la sala (lleva también la sala nueva)', link.endsWith('?sala=' + code + '&lobby=2'), link);
    await A.click('#lbCopyCode');
    check('copiar código', (await A.evaluate(() => navigator.clipboard.readText())) === code);
    check('compartir por WhatsApp está (el menú del móvil sale donde el navegador lo tiene)', !(await A.locator('#lbWhats').isHidden()));
    check('solo A: 1/2, INICIAR desactivado, el sitio del rival vacío', (await A.textContent('#lbCount')) === '1/2' && await A.locator('#lbStart').isDisabled() && await A.evaluate(() => !__SD.LB.pv[1].visible) && /ESPERANDO RIVAL/.test(await A.textContent('#lbTagOp')));
    await shot(A, 'pc-2-sala-sola');
    // B: the phone opens the invitation link
    const B = await open(ctxB, '&sala=' + code + '&lobby=2');
    check('B (móvil) abre el enlace: pantalla de la sala nueva con el código puesto', await until(B, c => !document.getElementById('lbHome').hidden && document.getElementById('lbCode').value === c, code));
    await B.fill('#lbName', 'Faisal'); await B.click('#lbJoin');
    check('B entra: los dos ven 2/2 sin recargar', await until(A, () => document.getElementById('lbCount').textContent === '2/2') && await until(B, () => document.getElementById('lbCount').textContent === '2/2'));
    check('A ve aparecer al rival en su sitio (tiempo real) y B ve a los dos', await opShown(A, 1) && await opShown(B, 0) && await opShown(B, 1));
    check('nombres sobre los operadores: A ve «Faisal» a la derecha y B se ve a sí mismo a la izquierda', /Faisal/.test(await A.textContent('#lbTagOp')) && /Faisal/.test(await B.textContent('#lbTagMe')) && /Hamza/.test(await B.textContent('#lbTagOp')) && /ANFITRIÓN/.test(await B.textContent('#lbTagOp')));
    const sk = await A.evaluate(() => ({ pj2: __SD.PJ2.on, packs: __SD.LB.rigs.map(R => R.skinPack === undefined ? 'sin' : R.skinPack), held: !!__SD.LB.held, gun: !!__SD.VMA.R }));
    check('cada operador lleva su personaje del juego (pj2; en calidad BAJA la figura simple) y A lleva su rifle en las manos', (!sk.pj2 || sk.packs.every(k => k !== 'sin')) && (sk.held || !sk.gun), JSON.stringify(sk));
    check('solo 2 plazas: un tercero no entra', await (async () => { const C = await open(await ctxOf(false), '&lobby=2'); await C.click('#m2 .m2Mode[data-sel=online]'); await C.fill('#lbCode', code); await C.click('#lbJoin');
      const ok = await until(C, () => /LLENA|EMPEZADO/.test(document.getElementById('lbMsg').textContent), null, 6000); await C.close(); return ok; })());
    // the map: the host chooses, the guest sees it and cannot change it
    const cards = await A.$$eval('#lbMapRow .lbMap', b => b.map(x => x.dataset.map));
    check('tarjetas con capturas reales, solo de mapas que existen y el servidor tiene', cards.length >= 2 && cards.every(id => ['arena', 'pueblo', 'casa', 'casa2', 'casa2b', 'casa2c', 'barrio'].includes(id)) && await A.$$eval('#lbMapRow .lbMap img', im => im.every(i => /assets\/menu\/mapa_/.test(i.src))), cards.join(','));
    check('B no puede elegir mapa', await B.$$eval('#lbMapRow .lbMap', b => b.every(x => x.disabled)));
    await A.click('#lbMapRow .lbMap[data-map="pueblo"]');
    check('A elige PUEBLO: B lo ve marcado al momento', await until(B, () => { const b = document.querySelector('#lbMapRow .lbMap[aria-pressed="true"]'); return b && b.dataset.map === 'pueblo'; }) && room.debug.mapId === 'pueblo');
    // LISTO, and changing the map takes it back
    await A.click('#lbReady'); await B.click('#lbReady');
    check('LISTO los dos: A puede INICIAR, B no (inicia el anfitrión)', await until(A, () => !document.getElementById('lbStart').disabled) && await B.locator('#lbStart').isDisabled() && room.phase === 'lobby');
    await shot(A, 'pc-3-sala-dos-listos'); await shot(B, 'movil-1-sala-dos-listos');
    await A.click('#lbMapRow .lbMap[data-map="arena"]');
    check('A cambia a ARENA: los dos LISTO vuelven a NO y B lo ve', await until(B, () => document.getElementById('lbReady').getAttribute('aria-pressed') === 'false' && __SD.NET.N.map === 'arena') && await until(A, () => document.getElementById('lbStart').disabled));
    check('B ve el aviso del cambio de mapa', await until(B, () => /ARENA/.test(document.getElementById('lbStatusTxt').textContent)));
    // the guest leaves and comes back with the code (before the match)
    await B.click('#lbLeave');
    check('B sale: A ve 1/2 y el sitio vacío', await until(A, () => document.getElementById('lbCount').textContent === '1/2' && !__SD.LB.pv[1].visible) && await until(B, () => !document.getElementById('lbHome').hidden));
    await B.fill('#lbCode', code); await B.click('#lbJoin');
    check('B vuelve con el código: 2/2 otra vez', await until(A, () => document.getElementById('lbCount').textContent === '2/2') && await until(B, () => document.getElementById('lbCount').textContent === '2/2'));
    // the guest's network drops in the room: same seat when it comes back
    await B.evaluate(() => { __SD.NET.ws.close(); });
    check('B pierde la red en la sala y vuelve solo, en su plaza B', await until(B, () => __SD.NET.status === 'online' && __SD.NET.N.you === 'B', null, 8000) && await until(A, () => document.getElementById('lbCount').textContent === '2/2'));
    await B.click('#lbReady'); await A.click('#lbReady');
    check('en el móvil apaisado LISTO e INICIAR se ven sin desplazar', await B.evaluate(() => ['lbReady', 'lbStart'].every(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; })));
    await until(A, () => !document.getElementById('lbStart').disabled);
    await A.click('#lbStart');
    check('INICIAR: cuenta atrás en los dos', await until(A, () => __SD.NET.N.phase === 'countdown' || __SD.NET.N.phase === 'playing') && await until(B, () => __SD.NET.N.phase === 'countdown' || __SD.NET.N.phase === 'playing'));
    check('los dos cargan el mismo mapa que el servidor (ARENA)', await until(A, () => __SD.WORLD_ID === 'arena', null, 15000) && await until(B, () => __SD.WORLD_ID === 'arena', null, 15000) && room.debug.mapId === 'arena' && room.match === 1);
    check('la sala se oculta y su hangar se libera al jugar', await until(A, () => document.getElementById('lb').hidden && !__SD.LB.room, null, 6000) && await until(B, () => document.getElementById('lb').hidden && !__SD.LB.room, null, 6000));
    check('empieza la partida en los dos', await until(A, () => __SD.NET.N.phase === 'playing', null, 9000) && await until(B, () => __SD.NET.N.phase === 'playing', null, 9000));
    // drop and reconnect in the match
    await B.evaluate(() => { __SD.NET.ws.close(); });
    check('B pierde la red jugando: pausa y vuelve solo, la partida sigue', await until(A, () => !document.getElementById('netBanner').hidden || __SD.NET.N.phase === 'paused', null, 4000) && await until(B, () => __SD.NET.status === 'online' && __SD.NET.N.phase === 'playing', null, 9000) && room.phase === 'playing');
    // B closes the game (leaves without a goodbye): after 60 s A wins; then B opens the link again and both ask for a rematch
    await B.close();
    check('B cierra el juego: el servidor pausa la partida', await until(A, () => __SD.NET.N.phase === 'paused', null, 9000) && room.phase === 'paused');
    room.pausedAt -= 61000;   // the 60 s of RECONECTANDO, without waiting them
    check('pasados 60 s gana A por abandono', await until(A, () => !document.getElementById('over').hidden && document.getElementById('overTitle').textContent === 'VICTORIA', null, 6000) && room.winner === 'A');
    const B2 = await open(ctxB, '&sala=' + code + '&lobby=2');
    check('B abre el enlace otra vez: vuelve a su sala (misma plaza) a la pantalla final', await until(B2, () => __SD.NET.N && __SD.NET.N.you === 'B' && __SD.NET.N.phase === 'over' && !document.getElementById('lbRoom').hidden, null, 10000)
      && /REVANCHA/.test(await B2.textContent('#lbReady')) && /FIN|REVANCHA/.test(await B2.textContent('#lbTagOp')));
    await shot(B2, 'movil-2-revancha');
    await B2.click('#lbReady'); await A.click('#again');
    check('REVANCHA los dos: partida 2 en el mismo mapa, en los dos', await until(A, () => __SD.NET.N.match === 2 && (__SD.NET.N.phase === 'countdown' || __SD.NET.N.phase === 'playing'), null, 8000) && await until(B2, () => __SD.NET.N.match === 2 && __SD.WORLD_ID === 'arena', null, 15000) && room.match === 2);
    // the screen of always comes back with ?lobby=1
    const C = await open(ctxA, '&lobby=1');
    check('con ?lobby=1 vuelve la pantalla de salas de siempre', await C.evaluate(() => !__SD.LB.on) && await (async () => { await C.click('#m2 .m2Mode[data-sel=online]'); await C.click('#m2Play'); return until(C, () => !document.getElementById('mp').hidden && document.getElementById('lb').hidden); })());
    check('sin errores de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ninguno');
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await browser.close(); web.close(); await srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
