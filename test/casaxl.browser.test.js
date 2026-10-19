/* CASA ATLAS XL (experimental map, ChatGPT 18-10-2026) in the real page, client only (duel vs bots):
   - offered in the duel menu, NOT in the online menu (the server does not have it yet); core/mapdata.js does not include it
   - client/casaxl.js = collision_map.json of the delivery (98 boxes), spawns more than 30 m apart without line of sight
   - one connected walking grid (bots can reach everything), the GLB and the roof load without errors
   - a bot plays 40 s: moves, never inside a box nor out of the plot
   - sightlines (rays at 1.6 m against the real bullet boxes): far longer than CASA ATLAS (mean 6.1 m, max 18.6 m)
   Run: node test/casaxl.browser.test.js   (software WebGL is fine: nothing is timed) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
const MAP = require('../core/mapdata.js'), SDCasaXL = require('../client/casaxl.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
(async () => {
  console.log('\nDATOS');
  check('el servidor no lo tiene todavía (core/mapdata.js sin casaxl): no hace falta desplegar', !MAP.maps.casaxl);
  check('98 cajas de la entrega (90 sólidas, 8 de cristal solo para el movimiento)', SDCasaXL.boxes.length === 98 && SDCasaXL.boxes.filter(b => b.s).length === 90);
  const [A, B] = SDCasaXL.spawns, dAB = Math.hypot(A.x - B.x, A.z - B.z);
  check('salidas A y B a más de 30 m', dAB > 30, dAB.toFixed(1) + ' m');

  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); localStorage.setItem('sniperduel_diff', '1'); } catch (e) {} });
  const p = await ctx.newPage(), errs = [], bad = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { if (/\/assets\//.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await p.goto(srv.url + '?vm=0'); await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.WORLDS.casaxl);

  console.log('\nMENÚ');
  const menu = await p.evaluate(() => ({ duel: !document.querySelector('#mapSeg [data-map=casaxl]').hidden, online: !!document.querySelector('#mpMapSeg [data-map=casaxl]'),
    all: [...document.querySelectorAll('#mapSeg button')].filter(x => !x.hidden).map(x => x.dataset.map) }));
  check('el menú del duelo ofrece los cuatro mapas', menu.duel && menu.all.join() === 'arena,pueblo,casa,casaxl', menu.all.join());
  check('el menú online no lo ofrece', !menu.online);

  console.log('\nPARTIDA CONTRA BOTS');
  await p.evaluate(() => { document.querySelector('#mapSeg [data-map=casaxl]').click(); __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.startMatch(); });
  await p.waitForFunction(() => __SD.XL.ready && __SD.state === 'playing' && __SD.XL.roof, null, { timeout: 120000 });
  const st = await p.evaluate(() => ({ w: __SD.WORLD_ID, bots: __SD.BOTS.filter(x => x.alive).length, pos: [__SD.PM.x, __SD.PM.z] }));
  check('carga el GLB y el techo y empieza en la salida A', st.w === 'casaxl' && Math.hypot(st.pos[0] - A.x, st.pos[1] - A.z) < 0.5, JSON.stringify(st.pos));
  check('2 bots en NORMAL', st.bots === 2, st.bots);
  check('sin errores ni archivos que falten', errs.length === 0 && bad.length === 0, errs.concat(bad).join(' | ') || 'ninguno');
  const nav = await p.evaluate(() => { const N = __SD.WORLDS.casaxl.nav, seen = new Int8Array(N.length); let c = 0;
    for (let i = 0; i < N.length; i++) { if (seen[i]) continue; c++; const q = [i]; seen[i] = 1; while (q.length) { const k = q.pop(); for (const j of N[k].n) if (!seen[j]) { seen[j] = 1; q.push(j); } } } return { n: N.length, c }; });
  check('la red de los bots es un solo trozo', nav.c === 1, nav.n + ' puntos');
  const los = await p.evaluate(() => { const S = __SD, N = S.WORLDS.casaxl.nav, rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3();
    let seed = 7; const R = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); let n = 0, sum = 0, mx = 0, o25 = 0;
    for (let k = 0; k < 3000; k++) { const a = N[(R() * N.length) | 0], c = N[(R() * N.length) | 0], L = Math.hypot(a.x - c.x, a.z - c.z); if (L < 1) continue;
      o.set(a.x, 1.6, a.z); d.set(c.x - a.x, 0, c.z - a.z).normalize(); rc.set(o, d); rc.near = 0; rc.far = L;
      if (!rc.intersectObjects(S.W.ray, false).length) { n++; sum += L; if (L > mx) mx = L; if (L > 25) o25++; } }
    const sp = S.WORLDS.casaxl.spawns, L = Math.hypot(sp[1].x - sp[0].x, sp[1].z - sp[0].z);
    o.set(sp[0].x, 1.62, sp[0].z); d.set(sp[1].x - sp[0].x, 0, sp[1].z - sp[0].z).normalize(); rc.set(o, d); rc.near = 0; rc.far = L;
    return { mean: sum / n, mx, o25: 100 * o25 / n, blocked: rc.intersectObjects(S.W.ray, false).length > 0 }; });
  check('las salidas no se ven entre sí', los.blocked);
  check('líneas de tiro largas: media > 10 m y máxima > 35 m (CASA ATLAS: 6,1 / 18,6)', los.mean > 10 && los.mx > 35, 'media ' + los.mean.toFixed(1) + ' m · máx ' + los.mx.toFixed(1) + ' m · ' + los.o25.toFixed(0) + ' % > 25 m');

  console.log('\nUN BOT JUGANDO 40 s');
  const bot = await p.evaluate(() => { const S = __SD, Bt = S.BOTS.find(x => x.alive), W = S.WORLDS.casaxl; let inBox = 0, out = 0, moved = 0, last = [Bt.g.position.x, Bt.g.position.z];
    for (let i = 0; i < 1200; i++) { S.simTick(1 / 30); const x = Bt.g.position.x, z = Bt.g.position.z;
      if (W.colliders.some(c => c.maxY > 0.45 && c.minY < 1.8 && x > c.minX + 0.05 && x < c.maxX - 0.05 && z > c.minZ + 0.05 && z < c.maxZ - 0.05)) inBox++;
      if (x < -19.8 || x > 19.8 || z < -15.8 || z > 15.8) out++; moved += Math.hypot(x - last[0], z - last[1]); last = [x, z]; }
    return { inBox, out, moved }; });
  check('el bot se mueve por la parcela', bot.moved > 5, bot.moved.toFixed(1) + ' m');
  check('nunca dentro de una caja ni fuera de la parcela', bot.inBox === 0 && bot.out === 0, bot.inBox + ' / ' + bot.out);
  const back = await p.evaluate(() => { __SD.toMenu(); __SD.setOffMap('arena'); return { w: __SD.WORLD_ID, sc: __SD.LIGHT.sun.shadow.camera.right, vis: __SD.XL.root.visible }; });
  check('volver a la ARENA: sombras como antes y la villa oculta', back.w === 'arena' && back.sc === 62 && !back.vis, JSON.stringify(back));
  await ctx.close();

  console.log('\n&xltex=1 (texturas CC0 del juego en lugar de las de la entrega)');
  { const c2 = await b.newContext({ viewport: { width: 640, height: 360 } });
    await c2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await c2.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); } catch (e) {} });
    const q = await c2.newPage(), e2 = [], bad2 = [];
    q.on('pageerror', e => e2.push(e.message)); q.on('response', r => { if (/\/assets\//.test(r.url()) && r.status() >= 400) bad2.push(r.status() + ' ' + r.url()); });
    await q.goto(srv.url + '?vm=0&xlv=1&xltex=1');   // the CC0 retexture only applies to the first delivery await q.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.WORLDS.casaxl);
    await q.evaluate(() => { document.querySelector('#mapSeg [data-map=casaxl]').click(); __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.startMatch(); });
    await q.waitForFunction(() => __SD.XL.ready && __SD.XL.roof && __SD.state === 'playing', null, { timeout: 240000 }); await q.waitForTimeout(1500);   // ~20 more textures to decode in software WebGL: slow on a busy machine
    const m = await q.evaluate(() => { const out = {}; for (const r of [__SD.XL.root, __SD.XL.roof]) r.traverse(o => { if (o.isMesh && o.material && o.material.map) { const s = (o.material.map.image && (o.material.map.image.currentSrc || o.material.map.image.src)) || ''; out[o.material.name] = s.split('/').pop().split('?')[0] || 'glb'; } }); return out; });
    check('estuco, adoquín, caliza y teja usan las texturas del juego (MEDIO)', m.sd_estuco === 'p1m_stucco_c.jpg' && m.sd_adoquin === 'p0ccm_cobble_c.jpg' && m.sd_suelo_caliza === 'p0v3m_plaza_c.jpg' && m.sd_teja === 'p1m_rooftiles_c.jpg', JSON.stringify([m.sd_estuco, m.sd_adoquin, m.sd_suelo_caliza, m.sd_teja]));
    check('vidrio, agua y vegetación conservan las suyas', m.sd_vidrio === 'glb' && m.sd_agua === 'glb' && m.sd_vegetacion === 'glb', JSON.stringify([m.sd_vidrio, m.sd_agua, m.sd_vegetacion]));
    check('sin errores ni texturas que falten', e2.length === 0 && bad2.length === 0, e2.concat(bad2).join(' | ') || 'ninguno');
    await c2.close(); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
