/* CASAS HABITABLES (14-11-2026) en la página, con PUEBLO 4.0 (el único pueblo desde el 24-11-2026; mapa 'pueblo4' del servidor):
   - el mapa 'pueblo4' de core/mapdata.js es exactamente el PUEBLO que dibuja la página
   - las casas: cajas, proxies de bala,
     rampas, mallas y puntos de navegación unidos a la red por las puertas; sin errores ni texturas que falten
   - con el movimiento del juego y el mundo vivo (W) se entra por una puerta de cada casa y se sube a la planta alta
   - una bala real (spawnBullet) disparada por una ventana sale; contra el muro, choca
   - casasSolid(true) / casasSolid(false): ida y vuelta entre las cajas de antes y las casas
   - un duelo de 25 s con 2 bots en PUEBLO sin errores
   Run: node test/casas.browser.test.js   (WebGL por software) */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nCASAS: playwright no está instalado, se omite'); process.exit(0); }
const ss = require('../tools/static-server.js'), C = require('../client/casas.js'), NH = C.HOUSES.length;
const OLD = C.HOUSES.map(H => [H.x - H.w / 2, H.x + H.w / 2, H.z - H.d / 2]);
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); } catch (e) {} });
    const open = async q => { const p = await ctx.newPage(), errs = [], bad = [];
      p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (/\/assets\//.test(r.url()) && !/\/personaje\//.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
      await p.goto(srv.url + '?carga=1&vm=0' + q); await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.W, null, { timeout: 180000 }); return { p, errs, bad }; };
    // the server's 'pueblo4' is exactly this page's PUEBLO
    { const { p, errs } = await open('');
      const { dumpWorld } = require('../tools/export-map.js'), M = require('../core/mapdata.js').maps.pueblo4, d = await dumpWorld(p, 'pueblo');
      check("el mapa 'pueblo4' del servidor coincide con el PUEBLO de la página (si cambias el pueblo: node tools/export-map.js)", !!M && JSON.stringify(d.tris) === JSON.stringify(M.tris) && JSON.stringify(d.ds) === JSON.stringify(M.ds) && JSON.stringify(d.colliders) === JSON.stringify(M.colliders) && JSON.stringify(d.ramps) === JSON.stringify(M.ramps) && JSON.stringify(d.nav) === JSON.stringify(M.nav) && JSON.stringify(d.pen) === JSON.stringify(M.pen), (d.tris.length / 9) + ' triángulos · ' + d.colliders.length + ' cajas');
      const m = await p.evaluate(() => { const S = __SD; return { p4: S.P3ON, world: S.WORLD_ID }; });
      check('sin errores al cargar', errs.length === 0 && m.p4, JSON.stringify(m) + (errs.length ? ' · ' + errs.join(' | ') : ''));
      await p.close(); }
    const { p, errs, bad } = await open('');
    await p.evaluate(() => __SD.setWorld('pueblo'));
    const st = await p.evaluate(() => { const S = __SD, W = S.WORLDS.pueblo; return { on: S.CASAS.on, houses: S.CASAS.houses.length, cols: S.CASAS.cols.every(c => W.colliders.includes(c)), rays: S.CASAS.rays.length, ramps: W.ramps.filter(r => S.CASAS.ramps.includes(r)).length,
      calls: S.CASAS.calls, tris: S.CASAS.tris, nav: W.nav.filter(n => n.casa).length, linked: W.nav.filter(n => n.casa && n.n.some(j => !W.nav[j].casa)).length,
      old: W.colliders.filter(c => (c.minY === 0 && c.minX === 7 && c.maxX === 15 && c.minZ === 28)).length, kit: S.CASAS.kit.length, shadow: !!S.CASAS.shadow }; });
    check('por defecto: las ' + NH + ' casas, sus cajas en el mundo, proxies de bala y 4 escaleras', st.on && st.houses === NH && st.cols && st.rays > 300 && st.ramps === 4 && st.old === 0, JSON.stringify(st));
    check('dibujo: ≤ 48 llamadas (por material y cuarto del pueblo; con lo de dentro de PUEBLO 4.0) y < 40 000 triángulos (más las piezas del kit y una malla de sombras)', st.calls <= 48 && st.tris < 40000 && st.kit > 100 && st.shadow, st.calls + ' llamadas · ' + st.tris + ' triángulos · ' + st.kit + ' piezas');
    check('navegación: puntos interiores unidos a la red por las ' + C.HOUSES.reduce((n, H) => n + H.doors.length, 0) + ' puertas', st.nav > 400 && st.linked >= C.HOUSES.reduce((n, H) => n + H.doors.length, 0), st.nav + ' puntos · ' + st.linked + ' enlaces');
    check('sin errores ni texturas que falten', errs.length === 0 && bad.length === 0, errs.concat(bad).join(' | ') || 'ninguno');
    // walk with the game's own movement and the live world
    const walks = await p.evaluate(HS => { const S = __SD, out = [];
      const go = (x, z, y, dx, dz, t) => { const s = SDMovement.createState(x, y || 0, z), yaw = Math.atan2(-dx, -dz);
        for (let i = 0; i < t * 60; i++) SDMovement.step(s, { mx: 0, mz: -1, yaw }, 1 / 60, S.W, SD_CONFIG.move); return s; };
      for (const H of HS) { const d = H.doors[0], n = { w: [-1, 0], e: [1, 0], n: [0, -1], s: [0, 1] }[d.face];
        const x = d.face === 'n' || d.face === 's' ? H.x + d.u : H.x + n[0] * (H.w / 2 + 2), z = d.face === 'n' || d.face === 's' ? H.z + n[1] * (H.d / 2 + 2) : H.z + d.u;
        const s = go(x, z, 0, -n[0], -n[1], 1.6); out.push({ id: H.id, inside: Math.abs(s.x - H.x) < H.w / 2 - 0.4 && Math.abs(s.z - H.z) < H.d / 2 - 0.4 }); }
      return out; }, C.HOUSES);
    for (const w of walks) check(w.id + ': se entra por la puerta con el movimiento del juego', w.inside);
    const up = await p.evaluate(() => { const S = __SD, out = [];
      for (const r of S.CASAS.ramps) { const s = SDMovement.createState(0, 0, 0), ax = r.axis, hiMin = r.highAtMin;
        // stand on the low end of the ramp and walk to the high end
        s.x = ax === 'x' ? (hiMin ? r.maxX - 0.3 : r.minX + 0.3) : (r.minX + r.maxX) / 2; s.z = ax === 'z' ? (hiMin ? r.maxZ - 0.3 : r.minZ + 0.3) : (r.minZ + r.maxZ) / 2;
        const dx = ax === 'x' ? (hiMin ? -1 : 1) : 0, dz = ax === 'z' ? (hiMin ? -1 : 1) : 0, yaw = Math.atan2(-dx, -dz);
        for (let i = 0; i < 180; i++) SDMovement.step(s, { mx: 0, mz: -1, yaw }, 1 / 60, S.W, SD_CONFIG.move);
        out.push(+(s.y - r.hHigh).toFixed(2)); } return out; });
    check('las 4 escaleras llevan a la planta alta', up.length === 4 && up.every(d => Math.abs(d) < 0.05), up.join(' · '));
    // bullets through the live ray list: out of a window, into a wall (encalada, west window at u -1.4)
    const sh = await p.evaluate(() => { const S = __SD, rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(-1, 0, 0);
      const first = (z, y) => { o.set(10, y, z); rc.set(o, d); rc.far = 6; const h = rc.intersectObjects(S.W.ray, false)[0]; return h ? h.object.name + '@' + h.distance.toFixed(2) : 'nada'; };
      return { win: first(29.6, 1.62), wall: first(28.6, 1.62), crouch: first(29.6, 1.0) }; });
    check('rayo de bala por la ventana: sale', !/casas_encalada_muro/.test(sh.win), sh.win);
    check('rayo al lado de la ventana y agachado bajo el alféizar: el muro lo para', /casas_encalada_muro/.test(sh.wall) && /casas_encalada_muro/.test(sh.crouch), sh.wall + ' · ' + sh.crouch);
    // online fallback and back
    const fb = await p.evaluate(() => { const S = __SD, W = S.WORLDS.pueblo, has = () => W.colliders.filter(c => c.minY === 0 && c.minX === 7 && c.maxX === 15 && c.minZ === 28).length;
      S.casasSolid(true); const a = { solid: has(), cols: S.CASAS.cols.some(c => W.colliders.includes(c)), ramps: W.ramps.filter(r => S.CASAS.ramps.includes(r)).length, vis: S.CASAS.meshes.some(m => m.visible) };
      S.casasSolid(false); const b = { solid: has(), cols: S.CASAS.cols.every(c => W.colliders.includes(c)), ramps: W.ramps.filter(r => S.CASAS.ramps.includes(r)).length, vis: S.CASAS.meshes.every(m => m.visible) };
      return { a, b }; });
    check('casasSolid(true): vuelven las cajas de antes (y se ocultan las casas)', fb.a.solid === 1 && !fb.a.cols && fb.a.ramps === 0 && !fb.a.vis, JSON.stringify(fb.a));
    check('casasSolid(false): vuelven las casas', fb.b.solid === 0 && fb.b.cols && fb.b.ramps === 4 && fb.b.vis, JSON.stringify(fb.b));
    // a short duel in PUEBLO
    await p.evaluate(() => { const b = document.querySelector('#mapSeg [data-map=pueblo]'); if (b) b.click(); __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.startMatch(); });
    await p.waitForFunction(() => __SD.state === 'playing', null, { timeout: 120000 });
    await p.evaluate(() => { __SD.BOTS.forEach(b => { b.minIn = 0; }); for (let i = 0; i < 25 * 30; i++) { __SD.simTick(1 / 30);
      __SD.BOTS.forEach(b => { if (b.alive && __SD.CASAS.houses.some(H => Math.abs(b.g.position.x - H.x) < H.w / 2 && Math.abs(b.g.position.z - H.z) < H.d / 2)) b.minIn++; }); } });
    const du = await p.evaluate(() => ({ w: __SD.WORLD_ID, bots: __SD.BOTS.filter(x => x.alive).length, framesInside: __SD.BOTS.reduce((n, b) => n + (b.minIn || 0), 0), inWall: __SD.BOTS.filter(x => x.alive && __SD.CASAS.cols.some(c => c.minY < 1 && c.maxY > 1 && x.g.position.x > c.minX + 0.05 && x.g.position.x < c.maxX - 0.05 && x.g.position.z > c.minZ + 0.05 && x.g.position.z < c.maxZ - 0.05)).length }));
    check('duelo de 25 s en PUEBLO con casas: bots vivos, ninguno dentro de un muro, sin errores', du.w === 'pueblo' && du.bots >= 1 && du.inWall === 0 && errs.length === 0, JSON.stringify(du) + (errs.length ? ' · ' + errs.join(' | ') : ''));
  } catch (e) { fail++; console.log('  FAIL excepción: ' + e.message); }
  finally { await b.close(); srv.close && srv.close(); }
  console.log('\nCASAS (navegador): ' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
