/* PUEBLO 4.0 EN LÍNEA (17-11-2026): dos navegadores reales con ?pueblo=4 contra el servidor Node de verdad.
   - A crea la sala con ?pueblo=4 y elige PUEBLO: el servidor juega su mapa 'pueblo4' y la página lo ve como 'pueblo'
   - el enlace de invitación lleva &pueblo=4
   - B entra con el enlace SIN la bandera: su página se recarga sola con ?pueblo=4 y vuelve a la sala
   - en la partida, A entra andando por la puerta oeste de la ENCALADA y el servidor lo deja dentro (con el mapa
     'pueblo' de siempre la casa es una caja maciza y se quedaría fuera)
   Run: node test/pueblo4.online.browser.test.js   (WebGL por software: no mide FPS) */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nPUEBLO 4.0 EN LÍNEA: playwright no está instalado, se omite'); process.exit(0); }
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
    const ctx = await browser.newContext({ viewport: { width: 667, height: 375 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(web.url + '?perf=low&server=' + encodeURIComponent(server) + (q || ''), { timeout: 180000 });
    await page.waitForFunction(() => window.__SD, null, { timeout: 180000 });
    return page;
  };
  try {
    console.log('\nPUEBLO 4.0 EN LÍNEA (servidor local)');
    const A = await open('&pueblo=4');
    check('A con ?pueblo=4: casas habitables y PUEBLO 4.0 cargados', await A.evaluate(() => __SD.CASAS.on && __SD.P3ON));
    await A.click('#m2 .m2Mode[data-sel=online]'); await A.click('#m2Play'); await A.fill('#mpName', 'Hamza'); await A.click('#mpCreate');
    check('A crea la sala', await until(A, () => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent)));
    const code = await A.textContent('#mpCodeBig'), link = await A.textContent('#mpLink');
    check('el enlace de invitación lleva &pueblo=4', link.endsWith('?sala=' + code + '&pueblo=4'), link);
    const maps = await A.evaluate(() => __SD.NET.N.maps);
    check("la página de A no ofrece el PUEBLO clásico ni ve 'pueblo4' (lo llama 'pueblo')", maps.includes('pueblo') && !maps.includes('pueblo4') && maps.filter(m => m === 'pueblo').length === 1, JSON.stringify(maps));
    await A.click('#mpMapSeg button[data-map="pueblo"]');
    check("A elige PUEBLO: el servidor pone su mapa 'pueblo4'", await until(A, () => __SD.NET.N.mapSrv === 'pueblo4' && __SD.NET.N.map === 'pueblo') && srv.rooms.get(code).debug.mapId === 'pueblo4', srv.rooms.get(code).debug.mapId);
    // B joins with a link WITHOUT the flag: the page must reload itself with ?pueblo=4 and rejoin
    const B = await open('&sala=' + code);
    check('B (sin bandera) empieza con el PUEBLO de siempre', await B.evaluate(() => !__SD.CASAS.on));
    await until(B, c => document.getElementById('mpCode').value === c, code);
    await B.fill('#mpName', 'Novia'); await B.click('#mpJoin');
    const back = await until(B, () => /[?&]pueblo=4\b/.test(location.search + '') || (window.__SD && __SD.CASAS && __SD.CASAS.on), null, 60000);
    await B.waitForFunction(() => window.__SD && __SD.NET && __SD.NET.N && __SD.NET.N.phase === 'lobby', null, { timeout: 180000 }).catch(() => {});
    const bs = await B.evaluate(() => ({ casas: __SD.CASAS.on, map: __SD.NET.N && __SD.NET.N.map, srv: __SD.NET.N && __SD.NET.N.mapSrv }));
    check('B se recarga sola con ?pueblo=4 y vuelve a la sala', back && bs.casas && bs.map === 'pueblo' && bs.srv === 'pueblo4', JSON.stringify(bs));
    check('los dos en la sala', await until(A, () => (__SD.NET.N.players || []).filter(Boolean).length === 2, null, 20000));
    await A.click('#mpReady'); await B.click('#mpReady');
    check("los dos juegan en PUEBLO 4.0 y el servidor en 'pueblo4'", await until(A, () => __SD.WORLD_ID === 'pueblo' && __SD.NET.N.phase === 'playing', null, 20000) && await until(B, () => __SD.WORLD_ID === 'pueblo' && __SD.NET.N.phase === 'playing', null, 20000) && srv.rooms.get(code).debug.mapId === 'pueblo4');
    check('en línea las casas son las del servidor (no las cajas macizas)', await A.evaluate(() => !__SD.CASAS.isSolid));
    // A walks in through the ENCALADA's west door (x 7, z 32.2): the server lets it in
    const room = srv.rooms.get(code);
    room.debug.place('A', 5, 32.2, -Math.PI / 2); room.debug.place('B', -30, 0, Math.PI / 2);
    await sleep(1500);
    await A.evaluate(() => { __SD.P.yaw = -Math.PI / 2; __SD.P.pitch = 0; __SD.NET.N.corrMax = 0; __SD.input.keys.KeyW = true; });
    await sleep(1800); await A.evaluate(() => { __SD.input.keys.KeyW = false; }); await sleep(1200);
    const st = room.debug.seat('A'), p = st.p.ms || st.p, corr = +(await A.evaluate(() => __SD.NET.N.corrMax)) || 0;
    check('A entra andando en la ENCALADA y el servidor lo deja dentro (x 7…15)', p.x > 8 && p.x < 14.5 && Math.abs(p.z - 32.2) < 1.5, p.x.toFixed(2) + ', ' + p.z.toFixed(2));
    check('sin correcciones grandes del servidor al entrar (página y servidor con las mismas paredes)', corr < 0.5, corr.toFixed(3) + ' m');
    check('sin errores en las páginas', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ninguno');
  } catch (e) { fail++; console.log('  FAIL excepción: ' + e.message); }
  finally { await browser.close(); web.close && web.close(); srv.close && srv.close(); }
  console.log('\nPUEBLO 4.0 EN LÍNEA: ' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
