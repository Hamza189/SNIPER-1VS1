/* CASA ATLAS 1V1 online in two REAL browser windows against the real Node server: A (with ?casa=1) creates the room and
   picks the map; B opens the invitation link WITHOUT ?casa=1 and still gets the map (shown, loaded, cannot change it);
   both play on it: spawns A/B, they see each other through a doorway, a hit through the real input, a wall that stops it.
   Run: node test/casa.online.browser.test.js */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nCASA ONLINE: playwright no está instalado, se omite'); process.exit(0); }
const { startServer } = require('../server/node.js');
const statics = require('../tools/static-server.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(page, fn, arg, ms) { try { await page.waitForFunction(fn, arg, { timeout: ms || 8000, polling: 100 }); return true; } catch (e) { return false; } }
(async () => {
  const srv = await startServer({ port: 0, debug: true }), web = await statics.start(), server = 'http://127.0.0.1:' + srv.port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [], files = { A: 0, B: 0 };
  const open = async (who, q) => {
    const ctx = await browser.newContext({ viewport: { width: 667, height: 375 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(who + ': ' + e.message));
    page.on('response', r => { if (/casa_atlas\.glb/.test(r.url()) && r.status() < 400) files[who]++; });
    await page.goto(web.url + '?perf=low&server=' + encodeURIComponent(server) + q); await page.waitForFunction(() => window.__SD);
    return page;
  };
  try {
    console.log('\nCASA ATLAS 1V1 ONLINE (dos navegadores, servidor local)');
    const A = await open('A', '&casa=1');
    await A.click('#mpBtn'); await A.fill('#mpName', 'Hamza'); await A.click('#mpCreate');
    check('A crea la sala', await until(A, () => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent)));
    const code = await A.textContent('#mpCodeBig');
    const B = await open('B', '&sala=' + code);
    check('B (sin ?casa=1) no ve el mapa experimental en su menú', await B.evaluate(() => document.querySelector('#mpMapSeg [data-map=casa]').hidden));
    await B.fill('#mpName', 'Novia'); await B.click('#mpJoin');
    check('los dos en el lobby', await until(A, () => document.querySelectorAll('#mpPlayers li').length === 2) && await until(B, () => document.querySelectorAll('#mpPlayers li').length === 2));
    await A.click('#mpMapSeg button[data-map="casa"]');
    check('A elige CASA ATLAS y B lo ve marcado (sin poder cambiarlo)', await until(B, () => __SD.NET.N.map === 'casa' && !document.querySelector('#mpMapSeg [data-map=casa]').hidden && document.querySelector('#mpMapSeg [data-map=casa]').getAttribute('aria-pressed') === 'true' && document.querySelector('#mpMapSeg [data-map=casa]').disabled));
    check('B empieza a cargar el mapa ya en el lobby', await until(B, () => __SD.CASA.ready || __SD.CASA.loading, null, 4000));
    await A.click('#mpReady'); await B.click('#mpReady');
    const room = srv.rooms.get(code);
    check('los dos juegan en CASA ATLAS (mapa del servidor = mapa dibujado, GLB cargado)', await until(A, () => __SD.WORLD_ID === 'casa' && __SD.CASA.ready && __SD.NET.N.phase === 'playing', null, 20000) && await until(B, () => __SD.WORLD_ID === 'casa' && __SD.CASA.ready && __SD.NET.N.phase === 'playing', null, 20000) && room.debug.mapId === 'casa');
    const sa = room.seats.A.p.ms, sb = room.seats.B.p.ms;
    check('aparecen en las salidas A y B del mapa', Math.abs(sa.x + 7.45) < 0.05 && Math.abs(sb.x - 7.1) < 0.05, sa.x.toFixed(2) + ',' + sa.z.toFixed(2) + ' / ' + sb.x.toFixed(2) + ',' + sb.z.toFixed(2));
    check('cada uno descarga el GLB una vez', files.A === 1 && files.B === 1, JSON.stringify(files));
    // across the living room, 4.9 m apart
    room.debug.place('A', -2.5, 0.8, -Math.PI / 2); room.debug.place('B', 2.4, 0.4, Math.PI / 2); await sleep(1500);
    const at = (pg, x, z) => until(pg, ([x, z]) => { const R = __SD.REMOTE; return R && R.g.visible && Math.abs(R.g.position.x - x) < 0.5 && Math.abs(R.g.position.z - z) < 0.5; }, [x, z], 8000);
    check('A ve a B y B ve a A en su sitio', await at(A, 2.4, 0.4) && await at(B, -2.5, 0.8));
    const fire = async (pg, who, y) => {
      const me = room.seats[who].p.ms, op = room.seats[who === 'A' ? 'B' : 'A'].p.ms;
      await until(pg, ([mx, mz, ox, oz]) => { const R = __SD.REMOTE, P = __SD.P; return Math.hypot(P.pos.x - mx, P.pos.z - mz) < 0.2 && R && Math.hypot(R.g.position.x - ox, R.g.position.z - oz) < 0.3; }, [me.x, me.z, op.x, op.z], 8000);
      await pg.evaluate(() => { __SD.input.scope = true; }); await sleep(300); await until(pg, () => __SD.WCORE.ads >= 1, null, 5000);
      await pg.evaluate(yy => { const R = __SD.REMOTE, P = __SD.P, eye = P.pos.y + __SD.PM.eye, dx = R.g.position.x - P.pos.x, dy = R.g.position.y + yy - eye, dz = R.g.position.z - P.pos.z;
        P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, y);
      await sleep(400); await pg.evaluate(() => { __SD.input.firePressed = true; }); await sleep(1000); await pg.evaluate(() => { __SD.input.scope = false; });
    };
    let h0 = room.seats.A.hits; await fire(A, 'A', 1.17);
    check('A dispara cruzando el salón: el servidor confirma el impacto y B pierde vida', room.seats.A.hits === h0 + 1 && await until(B, () => __SD.P.hp < 100, null, 4000), room.seats.A.hits - h0);
    room.debug.set('B', 'hp', 100); room.debug.set('B', 'lastHit', 1e15);
    // the study–living room wall between them (z = -0.6): the shot is fired, nothing is hit
    room.debug.place('A', -5.7, -0.6, -Math.PI / 2); room.debug.place('B', -3.6, -0.6, Math.PI / 2); await sleep(1800);
    const s0 = room.seats.A.shots; h0 = room.seats.A.hits;
    await A.evaluate(() => { const P = __SD.P; P.yaw = -Math.PI / 2; P.pitch = 0; __SD.input.firePressed = true; }); await sleep(1200);
    check('a través del tabique: disparo registrado, ningún impacto', room.seats.A.shots === s0 + 1 && room.seats.A.hits === h0, (room.seats.A.shots - s0) + ' disparo, ' + (room.seats.A.hits - h0) + ' impactos');
    check('sin errores en las páginas', errors.length === 0, errors.slice(0, 2).join(' | '));
  } catch (e) { check('sin excepciones', false, e.message); }
  await browser.close(); web.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
