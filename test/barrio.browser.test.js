/* BARRIO (04-11-2026, client/barrio.js, mapa «barrio») en la página, con ?barrio=1:
   - el servidor lo tiene con las mismas cajas; sale en los menús del duelo y online
   - carga el garaje y las torres y empieza en la salida A con 2 bots; sin errores ni archivos que falten
   - lo que se ve coincide con las cajas de balas: rayos a 0,5 y 1,4 m contra cada caja sólida, desde fuera
   - los bots se mueven 40 s sin meterse en nada
   Run: node test/barrio.browser.test.js   (WebGL por software) */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nJARDÍN: playwright no está instalado, se omite'); process.exit(0); }
const ss = require('../tools/static-server.js');
const MAP = require('../core/mapdata.js'), J = require('../client/barrio.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
(async () => {
  const M = MAP.maps.barrio;
  check('el servidor lo tiene: sus cajas, las salidas y su red', M && M.colliders.length === J.boxes().length && M.spawns.length === 2 && M.nav.length > 3000, M && M.colliders.length + ' cajas · ' + M.nav.length + ' puntos');
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); localStorage.setItem('sniperduel_diff', '1'); } catch (e) {} });
    const p = await ctx.newPage(), errs = [], bad = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (/\/assets\//.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await p.goto(srv.url + (process.env.PAGE || '') + '?vm=0&barrio=1'); await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.W, null, { timeout: 180000 });
    const menu = await p.evaluate(() => ({ duel: !!document.querySelector('#mapSeg [data-map=barrio]:not([hidden])'), online: !!document.querySelector('#mpMapSeg [data-map=barrio]:not([hidden])') }));
    check('con ?barrio=1 sale en el duelo y en el online', menu.duel && menu.online, JSON.stringify(menu));
    await p.evaluate(() => { document.querySelector('#mapSeg [data-map=barrio]').click(); __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.startMatch(); });
    await p.waitForFunction(() => __SD.BAR.ready && __SD.state === 'playing', null, { timeout: 180000 });
    const SP = J.spawns()[0];
    const st = await p.evaluate(() => ({ w: __SD.WORLD_ID, bots: __SD.BOTS.filter(x => x.alive).length, pos: [__SD.PM.x, __SD.PM.z], calls: __SD.BAR.calls, tris: Math.round(__SD.BAR.tris) }));
    check('carga el garaje y las torres y empieza en la salida A con 2 bots', st.w === 'barrio' && st.bots === 2 && Math.hypot(st.pos[0] - SP.x, st.pos[1] - SP.z) < 0.5, JSON.stringify(st));
    check('sin errores ni archivos que falten', errs.length === 0 && bad.length === 0, errs.concat(bad).join(' | ') || 'ninguno');

    // every solid box with a face reachable from the walkable side: the model and the bullet box agree within 3 cm
    const vis = await p.evaluate(([XO, ZN]) => { const S = __SD, rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), meshes = [];
      S.BAR.root.traverse(m => { if (m.isMesh && !/torres/.test(m.parent && m.parent.name)) meshes.push(m); });
      const hit = (list, ox, oy, oz, dx, dz, far) => { o.set(ox, oy, oz); d.set(dx, 0, dz).normalize(); rc.set(o, d); rc.near = 0; rc.far = far; const h = rc.intersectObjects(list, false); return h.length ? h[0].distance : null; };
      const nav = S.WORLDS.barrio.nav, solid = S.WORLDS.barrio.colliders, boxes = S.W.ray.filter(m => m.name && m.name.startsWith('barrio_') && !/floor_ray/.test(m.name));
      let tried = 0, agree = 0, invisible = 0, leaves = 0, nTried = 0, nAgree = 0; const badL = [], nBad = [];
      for (const m of boxes) { const bb = new THREE.Box3().setFromObject(m); if (bb.max.y < 0.6 || bb.min.y > 1.3) continue;
        const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const y of [0.5, 1.0]) {
          if (y < bb.min.y || y > bb.max.y) continue;
          const ox = dx > 0 ? bb.min.x - 0.6 : dx < 0 ? bb.max.x + 0.6 : cx, oz = dz > 0 ? bb.min.z - 0.6 : dz < 0 ? bb.max.z + 0.6 : cz;
          if (Math.abs(ox) > XO || Math.abs(oz) > ZN) continue;
          if (solid.some(c => c.maxY > y && c.minY < y && ox > c.minX && ox < c.maxX && oz > c.minZ && oz < c.maxZ)) continue;   // the ray starts inside something
          if (!nav.some(n => Math.abs(n.x - ox) < 0.35 && Math.abs(n.z - oz) < 0.35)) continue;   // only from where a player can stand
          // the garage's side walls are planes in its model: edge-on (their 11 cm front edge, at the open side) there is nothing to hit
          if (/^barrio_g_wall_(windows|door)/.test(m.name) && Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z) < 0.2 && (dx ? bb.max.z - bb.min.z < 0.2 : bb.max.x - bb.min.x < 0.2)) continue;
          const r = hit(S.W.ray, ox, y, oz, dx, dz, 0.7); if (r === null) continue; tried++;
          const a = hit(meshes, ox, y, oz, dx, dz, 0.75);
          // the model may be hit first (a frame, a counter in front of the wall): fine. A box with nothing drawn there is not.
          // 10 cm: wall ends tucked into the crossing wall (CASA ATLAS's own boxes, the same in designs 1 and 2)
          if (a !== null && a <= r + 0.10) agree++; else if (/planter/.test(m.name) && y > 0.7) leaves++; else if (!(/planter/.test(m.name) && y > 0.7)) { invisible++; if (badL.length < 6) badL.push(m.name + ' ' + [dx, dz] + ' y' + y + ' ' + (a && a.toFixed(2)) + '/' + r.toFixed(2)); }
          if (!/^barrio_g_/.test(m.name) && y === 0.5) { nTried++; if (a !== null && Math.abs(a - r) <= 0.03) nAgree++; else if (nBad.length < 6) nBad.push(m.name + ' ' + [dx, dz] + ' y' + y + ' ' + (a && a.toFixed(2)) + '/' + r.toFixed(2)); }
        } }
      return { tried, agree, invisible, leaves, badL, nTried, nAgree, nBad }; }, [J.XO, J.ZN]);
    check('sin paredes invisibles: en cada cara de caja de balas se ve algo a menos de 10 cm (pared, marco o mueble delante)', vis.tried > 150 && vis.invisible === 0, vis.agree + ' de ' + vis.tried + (vis.badL.length ? ' · ' + vis.badL.join(' | ') : ''));
    // the new pieces at 0.5 m, like design 2 (above it the hedge is rounded leaves and the low walls have a wider rim)
    check('edificios, muros y coberturas se ven justo donde su caja (±3 cm; los garajes: su modelo, sin paredes invisibles)', vis.nTried > 50 && vis.nAgree === vis.nTried, vis.nAgree + ' de ' + vis.nTried + (vis.nBad.length ? ' · ' + vis.nBad.join(' | ') : ''));

    const bot = await p.evaluate(([XO, ZN]) => { const S = __SD, W = S.WORLDS.barrio, bots = S.BOTS.filter(x => x.alive); let inBox = 0, out = 0; const moved = bots.map(() => 0), last = bots.map(b => [b.g.position.x, b.g.position.z]);
      for (let i = 0; i < 1200; i++) { S.simTick(1 / 30); bots.forEach((Bt, k) => { const x = Bt.g.position.x, z = Bt.g.position.z;
        if (W.colliders.some(c => c.maxY > 0.45 && c.minY < 1.8 && x > c.minX + 0.05 && x < c.maxX - 0.05 && z > c.minZ + 0.05 && z < c.maxZ - 0.05)) inBox++;
        if (Math.abs(x) > XO || Math.abs(z) > ZN) out++; moved[k] += Math.hypot(x - last[k][0], z - last[k][1]); last[k] = [x, z]; }); }
      return { inBox, out, moved: moved.map(m => +m.toFixed(1)) }; }, [J.XO, J.ZN]);
    check('los bots se mueven 40 s sin meterse en nada ni salir', bot.moved.every(m => m > 5) && bot.inBox === 0 && bot.out === 0, bot.moved.join(' / ') + ' m · ' + bot.inBox + '/' + bot.out);
    check('sin errores', errs.length === 0, errs.slice(0, 3).join(' | ') || 'ninguno');
    await ctx.close();
  } catch (e) { check('sin excepciones', false, e.message); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
