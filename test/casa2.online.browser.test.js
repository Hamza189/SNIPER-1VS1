/* CASA ATLAS 2.0 online (aprobada por el propietario el 02-11-2026) en dos navegadores DE VERDAD contra el servidor Node
   real: A crea la sala y elige el mapa; B entra con el enlace y lo recibe (lo ve marcado, lo carga, no puede cambiarlo);
   juegan en él: salidas A y B (el estudio del piso A y el del D), se ven a través del patio, un impacto con la entrada
   real, la pared del estudio lo para, y al morir se reaparece dentro del complejo.
   Run: node test/casa2.online.browser.test.js        --v2: el diseño 2 (mapa casa2b, con ?casa2v=2) */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nCASA 2.0 ONLINE: playwright no está instalado, se omite'); process.exit(0); }
const { startServer } = require('../server/node.js');
const statics = require('../tools/static-server.js');
const V2 = process.argv.includes('--v2'), ID = V2 ? 'casa2b' : 'casa2', ST = V2 ? 'C2B' : 'C2';
const C = require('../client/casa.js'), C2 = V2 ? require('../client/casa2.js').v2 : require('../client/casa2.js');
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
    await page.goto(web.url + (process.env.PAGE || '') + '?perf=low&server=' + encodeURIComponent(server) + (V2 ? '&casa2v=2' : '') + q); await page.waitForFunction(() => window.__SD);
    return page;
  };
  try {
    console.log('\nCASA ATLAS 2.0 ONLINE (dos navegadores, servidor local)' + (V2 ? ' · DISEÑO 2' : ''));
    const A = await open('A', '');
    await A.click('#m2 .m2Mode[data-sel=online]'); await A.click('#m2Play');   // MENÚ 2: MULTIJUGADOR + JUGAR
    await A.fill('#mpName', 'Hamza'); await A.click('#mpCreate');
    check('A crea la sala', await until(A, () => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent)));
    const code = await A.textContent('#mpCodeBig');
    const B = await open('B', '&sala=' + code);
    check('B ve CASA ATLAS 2.0 en su menú online', await B.evaluate(id => !document.querySelector('#mpMapSeg [data-map=' + id + ']').hidden, ID));
    await B.fill('#mpName', 'Novia'); await B.click('#mpJoin');
    check('los dos en el lobby', await until(A, () => document.querySelectorAll('#mpPlayers li').length === 2) && await until(B, () => document.querySelectorAll('#mpPlayers li').length === 2));
    await A.click('#mpMapSeg button[data-map="' + ID + '"]');
    check('A elige CASA ATLAS 2.0 y B lo ve marcado (sin poder cambiarlo)', await until(B, id => { const b = document.querySelector('#mpMapSeg [data-map=' + id + ']'); return __SD.NET.N.map === id && !b.hidden &&
      b.getAttribute('aria-pressed') === 'true' && b.disabled; }, ID));
    check('B empieza a cargar el mapa ya en el lobby', await until(B, st => __SD[st].ready || __SD[st].loading || __SD.CASA.loading, ST, 4000));
    await A.click('#mpReady'); await B.click('#mpReady');
    const room = srv.rooms.get(code);
    const playing = ([id, st]) => __SD.WORLD_ID === id && __SD[st].ready && __SD.NET.N.phase === 'playing';
    check('los dos juegan en CASA ATLAS 2.0 (mapa del servidor = mapa dibujado, cargado)', await until(A, playing, [ID, ST], 30000) &&
      await until(B, playing, [ID, ST], 30000) && room.debug.mapId === ID);
    const SP = C2.spawns(C), sa = room.seats.A.p.ms, sb = room.seats.B.p.ms;
    check('aparecen en las salidas A y B del mapa (a 40 m, sin verse)', Math.hypot(sa.x - SP[0].x, sa.z - SP[0].z) < 0.05 && Math.hypot(sb.x - SP[1].x, sb.z - SP[1].z) < 0.05,
      sa.x.toFixed(2) + ',' + sa.z.toFixed(2) + ' / ' + sb.x.toFixed(2) + ',' + sb.z.toFixed(2));
    check('cada uno descarga el GLB de CASA ATLAS una vez (el mismo para los 4 pisos)', files.A === 1 && files.B === 1, JSON.stringify(files));
    // across the patio, 12.5 m apart, between the planters
    const PA = V2 ? [-6, -3] : [-6, -1.8], PB = V2 ? [6, -3] : [6, 1.8];   // diseño 2: a lo largo del balcón (el seto del centro tapa la diagonal)
    room.debug.place('A', PA[0], PA[1], -Math.PI / 2); room.debug.place('B', PB[0], PB[1], Math.PI / 2); await sleep(1500);
    const at = (pg, x, z) => until(pg, ([x, z]) => { const R = __SD.REMOTE; return R && R.g.visible && Math.abs(R.g.position.x - x) < 0.5 && Math.abs(R.g.position.z - z) < 0.5; }, [x, z], 8000);
    check('A ve a B y B ve a A en su sitio', await at(A, PB[0], PB[1]) && await at(B, PA[0], PA[1]));
    const fire = async (pg, who, y) => {
      const me = room.seats[who].p.ms, op = room.seats[who === 'A' ? 'B' : 'A'].p.ms;
      await until(pg, ([mx, mz, ox, oz]) => { const R = __SD.REMOTE, P = __SD.P; return Math.hypot(P.pos.x - mx, P.pos.z - mz) < 0.2 && R && Math.hypot(R.g.position.x - ox, R.g.position.z - oz) < 0.3; }, [me.x, me.z, op.x, op.z], 8000);
      await pg.evaluate(() => { __SD.input.scope = true; }); await sleep(300); await until(pg, () => __SD.WCORE.ads >= 1, null, 5000);
      await pg.evaluate(yy => { const R = __SD.REMOTE, P = __SD.P, eye = P.pos.y + __SD.PM.eye, dx = R.g.position.x - P.pos.x, dy = R.g.position.y + yy - eye, dz = R.g.position.z - P.pos.z;
        P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, y);
      await sleep(400); await pg.evaluate(() => { __SD.input.firePressed = true; }); await sleep(1000); await pg.evaluate(() => { __SD.input.scope = false; });
    };
    let h0 = room.seats.A.hits; await fire(A, 'A', 1.17);
    check('A dispara cruzando el patio: el servidor confirma el impacto y B pierde vida', room.seats.A.hits === h0 + 1 && await until(B, () => __SD.P.hp < 100, null, 4000), room.seats.A.hits - h0);
    room.debug.set('B', 'hp', 100); room.debug.set('B', 'lastHit', 1e15);
    // the wall between the study and the living room of flat A (x −15.3): the shot is fired, nothing is hit
    const dx = V2 ? 1.7 : 0;   // the flats are 1.7 m closer to the centre in the second design
    room.debug.place('A', -17.2 + dx, -11.3, -Math.PI / 2); room.debug.place('B', -13.6 + dx, -11.3, Math.PI / 2); await sleep(1800);
    const s0 = room.seats.A.shots; h0 = room.seats.A.hits;
    await A.evaluate(() => { const P = __SD.P; P.yaw = -Math.PI / 2; P.pitch = 0; __SD.input.firePressed = true; }); await sleep(1200);
    check('a través de la pared del estudio: disparo registrado, ningún impacto', room.seats.A.shots === s0 + 1 && room.seats.A.hits === h0, (room.seats.A.shots - s0) + ' disparo, ' + (room.seats.A.hits - h0) + ' impactos');
    // a kill (head shot) and the respawn: inside the complex, on its walkable grid (the server's)
    room.debug.place('A', PA[0], PA[1], -Math.PI / 2); room.debug.place('B', PB[0], PB[1], Math.PI / 2); await sleep(1500);
    const k0 = room.seats.A.kills; await fire(A, 'A', 1.6);   // the head: one rifle shot
    const dead = await until(B, () => !__SD.P.alive, null, 5000) || room.seats.A.kills > k0;
    const back = await until(B, () => __SD.P.alive, null, 12000); const nb = room.seats.B.p.ms;
    check('B muere y reaparece dentro del complejo (no dentro de una caja)', dead && back && Math.abs(nb.x) < C2.XO && Math.abs(nb.z) < C2.ZN &&
      !C2.boxes(C).some(b => b.b[1] > 0.35 && b.a[1] < 1.8 && nb.x > b.a[0] && nb.x < b.b[0] && nb.z > b.a[2] && nb.z < b.b[2]), nb.x.toFixed(1) + ',' + nb.z.toFixed(1));
    check('sin errores en las páginas', errors.length === 0, errors.slice(0, 2).join(' | '));
  } catch (e) { check('sin excepciones', false, e.message); }
  await browser.close(); web.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
