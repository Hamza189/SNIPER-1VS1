/* CASA ATLAS 1V1 (experimental map) in the real page:
   - hidden from the menus without ?casa=1 (and the GLB is not downloaded); offered with it, remembered; ?casa=0 hides it
   - DUELO VS BOTS on it: the GLB loads (no 404 / errors), the match starts at spawn A with 1 bot (2 on ÉLITE)
   - what you see matches the boxes: rays at 0.4–2.6 m against both faces of every wall box meet the drawn wall within 6 cm
     (the other way round, drawn walls with no box, is checked on the GLB itself by tools/casa/validate_casa.py)
   - client bullets (Three.js raycast on the page's boxes) = server bullets (core/geom.js on core/mapdata.js): 400 random shots
   - a bot plays 40 s: moves along its paths, never inside a box nor out of the flat; switching maps restores the ground and
     the sun's shadow box
   Run: node test/casa.browser.test.js   (software WebGL is fine: nothing is timed) */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
async function open(b, url, opts) {
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(o => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: o.q || 'alto', v: 3 })); if (o.diff != null) localStorage.setItem('sniperduel_diff', String(o.diff)); } catch (e) {} }, opts || {});
  const p = await ctx.newPage(), errs = [], bad = [], files = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (/casa/i.test(m.text()) && m.type() !== 'log') errs.push(m.text()); });
  p.on('response', r => { const u = r.url(); if (/\/assets\//.test(u) && r.status() >= 400) bad.push(r.status() + ' ' + u.replace(/^.*\/assets\//, '')); if (/casa_atlas/.test(u)) files.push(u.replace(/^.*\/assets\//, '').replace(/\?.*/, '')); });
  await p.goto(url); await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.WORLDS.casa);
  return { ctx, p, errs, bad, files };
}
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  console.log('\nSIN ?casa=1');
  { const o = await open(b, srv.url + '?vm=0'); await o.p.waitForTimeout(1500);
    const r = await o.p.evaluate(() => ({ btn: [...document.querySelectorAll('[data-map=casa]')].map(x => x.hidden), exp: __SD.CASA.exp, built: !!__SD.WORLDS.casa }));
    check('el botón CASA ATLAS no aparece en los menús', r.btn.length === 2 && r.btn.every(h => h), JSON.stringify(r.btn));
    check('el mapa existe igualmente (para poder unirse a una sala online en él)', r.built && !r.exp);
    check('no se descarga el GLB del mapa', o.files.length === 0, o.files.join(' '));
    await o.ctx.close(); }

  console.log('\nCON ?casa=1 · DUELO VS BOTS');
  const o = await open(b, srv.url + '?vm=1&casa=1', { diff: 1 }), p = o.p;
  const m0 = await p.evaluate(() => ({ btn: [...document.querySelectorAll('[data-map=casa]')].map(x => x.hidden), exp: __SD.CASA.exp, stored: localStorage.getItem('sniperduel_casaExp') }));
  check('con ?casa=1 aparece en DUELO VS BOTS y en ONLINE, y se recuerda', m0.btn.every(h => !h) && m0.exp && m0.stored === 'true');
  await p.evaluate(() => { __SD.setMode('duel'); document.querySelector('#mapSeg [data-map=casa]').click(); __SD.startMatch(); });
  await p.waitForFunction(() => __SD.state === 'playing' && __SD.CASA.ready, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  const st = await p.evaluate(() => { const S = __SD; return { world: S.WORLD_ID, tris: S.CASA.tris, lamp: S.CASA.lampTris, calls: S.CASA.calls, bots: S.BOTS.filter(x => x.alive).length,
    pos: [S.PM.x, S.PM.z], sp: S.WORLDS.casa.spawns[0], same: S.W.colliders === S.WORLDS.casa.colliders, nav: S.NAV.length, ground: S.LIGHT.sun.shadow.camera.right }; });
  check('la partida empieza en CASA ATLAS con el GLB cargado (10 108 triángulos menos las lámparas del techo, 32 piezas)', st.world === 'casa' && st.tris + st.lamp === 10108 && st.lamp > 0 && st.calls === 32, st.tris + ' + ' + st.lamp + ' de lámparas / ' + st.calls);
  check('1 bot en NORMAL', st.bots === 1, st.bots);
  check('apareces en la salida A', Math.hypot(st.pos[0] - st.sp.x, st.pos[1] - st.sp.z) < 0.05, st.pos.map(v => v.toFixed(2)).join(', '));
  check('las colisiones activas son las del mapa', st.same && st.nav > 1000, st.nav + ' puntos de navegación');
  check('caja de sombras del sol ajustada al piso (±16 m)', st.ground === 16);
  check('todo carga sin 404 ni errores', o.bad.length === 0 && o.errs.length === 0, o.bad.concat(o.errs).slice(0, 3).join(' | ') || o.files.join(' '));
  check('solo se descarga el GLB del mapa (sin techo)', o.files.length === 1 && /casa_atlas\.glb$/.test(o.files[0]), o.files.join(' '));

  console.log('\nLO QUE SE VE = LAS CAJAS');
  const vis = await p.evaluate(() => {
    const S = __SD, T = THREE, rc = new T.Raycaster(), root = S.CASA.root; root.updateMatrixWorld(true);
    const meshes = []; root.traverse(q => { if (q.isMesh && !/glass|green_leaf|light_glow|details__/.test(q.name)) meshes.push(q); });
    const walls = SDCasa.boxes.filter(b => b.s && /^wall_/.test(b.n));
    let worst = 0, where = '', n = 0;
    for (const b of walls) {
      const alongX = b.b[0] - b.a[0] > b.b[2] - b.a[2];
      for (const side of [-1, 1]) for (let t = 0.1; t <= 0.9; t += 0.2) for (let y = Math.max(0.4, b.a[1] + 0.1); y <= Math.min(2.6, b.b[1] - 0.1); y += 0.55) {
        const face = alongX ? (side < 0 ? b.a[2] : b.b[2]) : (side < 0 ? b.a[0] : b.b[0]);
        const u = alongX ? b.a[0] + (b.b[0] - b.a[0]) * t : b.a[2] + (b.b[2] - b.a[2]) * t;
        const o = alongX ? new T.Vector3(u, y, face + side * 1.0) : new T.Vector3(face + side * 1.0, y, u);
        const d = alongX ? new T.Vector3(0, 0, -side) : new T.Vector3(-side, 0, 0);
        // only rays that start in open air (not inside furniture or another wall)
        if (SDCasa.boxes.some(q => q.s && o.x > q.a[0] && o.x < q.b[0] && o.y > q.a[1] && o.y < q.b[1] && o.z > q.a[2] && o.z < q.b[2])) continue;
        rc.set(o, d); rc.far = 3; const h = rc.intersectObjects(meshes, false)[0]; n++;
        // something drawn in front of the wall (furniture against it) is fine: only behind the face counts
        const late = h ? h.distance - 1.0 : 9;
        if (late > worst) { worst = late; where = b.n + ' lado ' + side + ' y=' + y.toFixed(2) + ' t=' + t.toFixed(1); }
      }
    }
    return { worst, where, n };
  });
  check('cada caja de pared tiene su pared dibujada a menos de 6 cm de la cara (' + vis.n + ' rayos)', vis.worst < 0.06, 'peor ' + (vis.worst * 100).toFixed(1) + ' cm · ' + vis.where);

  console.log('\nBALAS: CLIENTE = SERVIDOR');
  await p.addScriptTag({ path: path.join(__dirname, '..', 'core', 'geom.js') });
  await p.addScriptTag({ path: path.join(__dirname, '..', 'core', 'mapdata.js') });
  const cmp = await p.evaluate(() => {
    const S = __SD, T = THREE, ix = SDGeom.createMapIndex(SD_MAP.maps.casa), rc = new T.Raycaster(); let seed = 12345; const R = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let same = 0, worst = 0, both = 0; const n = 400;
    for (let i = 0; i < n; i++) {
      const o = new T.Vector3(-8.5 + 17 * R(), 0.2 + 2.6 * R(), -6.5 + 13.4 * R()), d = new T.Vector3(R() - 0.5, (R() - 0.5) * 0.6, R() - 0.5).normalize();
      rc.set(o, d); rc.near = 0; rc.far = 30; const h = rc.intersectObjects(S.W.ray, false)[0], sv = SDGeom.segMap(ix, o.x, o.y, o.z, d.x, d.y, d.z, 30);
      const a = h ? h.distance : -1, bb = sv ? sv.t : -1, e = Math.abs(a - bb); if (e < 0.003) same++; if (a > 0 && bb > 0) both++; if (e > worst) worst = e;
    }
    return { same, n, worst, both };
  });
  check('400 disparos al azar: mismo impacto en el cliente y en el servidor (±3 mm)', cmp.same === cmp.n, cmp.same + '/' + cmp.n + ' · peor ' + (cmp.worst * 1000).toFixed(1) + ' mm · ' + cmp.both + ' tocan algo');

  console.log('\nUN BOT JUGANDO 40 s');
  const bot = await p.evaluate(() => {
    const S = __SD, B = S.BOTS.find(x => x.alive), W = S.WORLDS.casa; let inBox = 0, out = 0, moved = 0, last = [B.g.position.x, B.g.position.z], states = new Set();
    S.setDuelLethal(false);
    for (let i = 0; i < 1200; i++) { S.simTick(1 / 30); const x = B.g.position.x, z = B.g.position.z; states.add(B.state);
      if (W.colliders.some(c => c.maxY > 0.45 && c.minY < 1.8 && x > c.minX + 0.05 && x < c.maxX - 0.05 && z > c.minZ + 0.05 && z < c.maxZ - 0.05)) inBox++;
      if (x < -8.7 || x > 8.7 || z < -6.7 || z > 7.0) out++;
      moved += Math.hypot(x - last[0], z - last[1]); last = [x, z]; }
    return { inBox, out, moved, states: [...states], alive: B.alive };
  });
  check('el bot se mueve por el piso', bot.moved > 5, bot.moved.toFixed(1) + ' m · ' + bot.states.join(', '));
  check('nunca dentro de una caja ni fuera del piso', bot.inBox === 0 && bot.out === 0, bot.inBox + ' / ' + bot.out);

  console.log('\nBOTS EN CASA: RED DE NAVEGACIÓN (auditoría 18-10-2026, J1 y J2)');
  const navr = await p.evaluate(() => {
    const S = __SD, NAV = S.WORLDS.casa.nav, B = S.BOTS.find(x => x.alive);
    // pieces of the walkable grid that are not joined to each other
    const comp = new Int32Array(NAV.length).fill(-1), sizes = [];
    for (let i = 0; i < NAV.length; i++) { if (comp[i] >= 0) continue; const c = sizes.length, q = [i]; comp[i] = c; let n = 0;
      while (q.length) { const k = q.pop(); n++; for (const j of NAV[k].n) if (comp[j] < 0) { comp[j] = c; q.push(j); } } sizes.push(n); }
    const main = sizes.indexOf(Math.max(...sizes));
    let off = 0; const N = 300;
    for (let i = 0; i < N; i++) { B.spawn(); if (comp[B.node] !== main) off++; }
    // walking along a path: ticks in which the bot stands still although it is in 'move'
    B.spawn(); let mv = 0, still = 0;
    for (let i = 0; i < 3600; i++) { const x = B.g.position.x, z = B.g.position.z, st = B.state; S.simTick(1 / 120);
      if (st === 'move' && B.state === 'move') { mv++; if (Math.hypot(B.g.position.x - x, B.g.position.z - z) < 1e-6) still++; } }
    return { sizes, off, N, mv, still };
  });
  check('ningún bot aparece en un trozo de la red separado del resto (300 apariciones)', navr.off === 0, navr.off + '/' + navr.N + ' · trozos ' + navr.sizes.join('/'));
  check('caminando por su ruta, el bot no se queda parado al cambiar de punto (< 1 % de ticks)', navr.mv > 200 && navr.still / navr.mv < 0.01, navr.still + '/' + navr.mv + ' ticks parados');
  const back = await p.evaluate(() => { __SD.toMenu(); __SD.setOffMap('arena'); return { w: __SD.WORLD_ID, gy: __SD.WORLDS && THREE && __SD.scene.children.find(o => o.geometry && o.geometry.parameters && o.geometry.parameters.width === 400).position.y, sc: __SD.LIGHT.sun.shadow.camera.right, casaVis: __SD.CASA.root.visible }; });
  check('volver a la ARENA: suelo y sombras como antes, el piso oculto', back.w === 'arena' && back.gy === 0 && back.sc === 62 && !back.casaVis, JSON.stringify(back));
  await o.ctx.close();

  console.log('\nÉLITE y ?casa=0');
  { const o2 = await open(b, srv.url + '?vm=0&casa=1', { diff: 2 }); await o2.p.evaluate(() => { __SD.setMode('duel'); __SD.setOffMap('casa'); __SD.startMatch(); });
    await o2.p.waitForFunction(() => __SD.state === 'playing', null, { timeout: 120000 }); await o2.p.waitForTimeout(500);
    check('ÉLITE: 2 bots', (await o2.p.evaluate(() => __SD.BOTS.filter(x => x.alive).length)) === 2);
    await o2.p.goto(srv.url + '?vm=0&casa=0'); await o2.p.waitForFunction(() => window.__SD && __SD.WORLDS); await o2.p.waitForTimeout(500);
    const r = await o2.p.evaluate(() => ({ exp: __SD.CASA.exp, off: __SD.OFFMAP, hid: document.querySelector('#mapSeg [data-map=casa]').hidden }));
    check('?casa=0 lo vuelve a ocultar y el mapa elegido vuelve a la ARENA', !r.exp && r.hid && r.off === 'arena', JSON.stringify(r));
    await o2.ctx.close(); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
