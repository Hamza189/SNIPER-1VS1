/* CASA ATLAS 2.0 (02-11-2026) en la página de verdad (aprobada por el propietario el mismo día: también online):
   - sale en los menús del duelo y del online; ?casa2=0 la oculta; core/mapdata.js (el servidor) tiene sus mismas cajas
   - su red de 11 000 puntos solo se construye cuando hace falta (no al abrir la página)
   - carga sobre el GLB de CASA ATLAS: los MISMOS materiales y texturas (nada nuevo en la GPU salvo vértices), ~40 llamadas
   - lo que se ve coincide con las cajas: cada pieza nueva tiene su caja a ±3 cm, y las puertas nuevas están abiertas para
     la vista, las balas y el cuerpo (sin paredes invisibles ni agujeros)
   - las coberturas paran las balas por abajo y se dispara por encima de pie
   - los bots juegan 40 s: se mueven, nunca dentro de una caja ni fuera del complejo
   Run: node test/casa2.browser.test.js   (WebGL por software: no se mide tiempo; env PAGE=otra.html) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
const MAP = require('../core/mapdata.js'), C = require('../client/casa.js'), C2 = require('../client/casa2.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
(async () => {
  console.log('\nDATOS');
  check('el servidor la tiene: sus 434 cajas, las salidas A y B y su red ligera (un punto de cada cuatro)', MAP.maps.casa2 && MAP.maps.casa2.colliders.length === C2.boxes(C).length &&
    MAP.maps.casa2.spawns.length === 2 && MAP.maps.casa2.nav.length > 2500 && MAP.maps.casa2.nav.length < 4000, MAP.maps.casa2 && MAP.maps.casa2.nav.length + ' puntos');
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const mk = async (q) => { const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); localStorage.setItem('sniperduel_diff', '1'); } catch (e) {} });
      const p = await ctx.newPage(), errs = [], bad = [];
      p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (/\/assets\//.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
      await p.goto(srv.url + (process.env.PAGE || '') + '?vm=0' + q); await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.W, null, { timeout: 180000 });
      return { ctx, p, errs, bad }; };

    console.log('\nCON ?casa2=0');
    { const { ctx, p } = await mk('&casa2=0');
      const r = await p.evaluate(() => ({ world: !!__SD.WORLDS.casa2, btn: document.querySelector('#mapSeg [data-map=casa2]').hidden && document.querySelector('#mpMapSeg [data-map=casa2]').hidden }));
      check('oculta en los menús (el mundo existe igual: un amigo puede unirse a una sala en ella)', r.world && r.btn, JSON.stringify(r)); await ctx.close(); }

    console.log('\nPOR DEFECTO');
    const { ctx, p, errs, bad } = await mk('');
    const lazy = await p.evaluate(() => { const d = Object.getOwnPropertyDescriptor(__SD.WORLDS.casa2, 'nav'); return !!(d && d.get); });
    const menu = await p.evaluate(() => ({ duel: !document.querySelector('#mapSeg [data-map=casa2]').hidden, online: !document.querySelector('#mpMapSeg [data-map=casa2]').hidden,
      local: !!__SD.WORLDS.casa2.local, nav: __SD.WORLDS.casa2.nav.length, boxes: __SD.WORLDS.casa2.colliders.length }));
    check('sale en el menú del duelo y en el online; no es solo del cliente', menu.duel && menu.online && !menu.local, JSON.stringify(menu));
    check('su red se construye la primera vez que se pide, no al abrir la página', lazy);
    check('las mismas cajas que client/casa2.js (las que recibirá el servidor)', menu.boxes === C2.boxes(C).length, menu.boxes + ' cajas · ' + menu.nav + ' puntos');
    await p.evaluate(() => { document.querySelector('#mapSeg [data-map=casa2]').click(); __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.startMatch(); });
    await p.waitForFunction(() => __SD.C2.ready && __SD.state === 'playing', null, { timeout: 180000 });
    const SP = C2.spawns(C)[0];
    const st = await p.evaluate(() => ({ w: __SD.WORLD_ID, bots: __SD.BOTS.filter(x => x.alive).length, pos: [__SD.PM.x, __SD.PM.z], sun: __SD.LIGHT.sun.shadow.camera.right, casaVis: __SD.CASA.root.visible }));
    check('carga y empieza en la salida A, con 2 bots (NORMAL)', st.w === 'casa2' && st.bots === 2 && Math.hypot(st.pos[0] - SP.x, st.pos[1] - SP.z) < 0.5, JSON.stringify(st));
    check('sombras ajustadas al complejo (±23 m) y la CASA ATLAS pequeña oculta', st.sun === 23 && !st.casaVis);
    check('sin errores ni archivos que falten', errs.length === 0 && bad.length === 0, errs.concat(bad).join(' | ') || 'ninguno');

    console.log('\nMATERIALES Y DIBUJO');
    const mat = await p.evaluate(() => { const S = __SD, own = new Set(), tex = new Set(), mine = new Set(); let tris = 0, calls = 0;
      S.CASA.root.traverse(o => { if (o.isMesh) own.add(o.material); });
      S.C2.root.traverse(o => { if (!o.isMesh) return; calls++; tris += o.geometry.attributes.position.count / 3; mine.add(o.material);
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (o.material[k]) tex.add(o.material[k]); });
      return { same: [...mine].every(m => own.has(m)), mats: mine.size, tex: tex.size, tris: Math.round(tris), calls }; });
    check('todos sus materiales son los de CASA ATLAS (mismos objetos: ninguna textura cargada dos veces)', mat.same, mat.mats + ' materiales · ' + mat.tex + ' texturas');
    check('una malla por material del piso (4 pisos en una): ≤ 40 mallas, ≤ 60 000 triángulos', mat.calls <= 40 && mat.tris <= 60000, mat.calls + ' mallas · ' + mat.tris + ' triángulos');

    console.log('\nLO QUE SE VE = LAS CAJAS');
    const vis = await p.evaluate(([extras, cuts, mods]) => { const S = __SD, rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), meshes = [];
      S.C2.root.updateMatrixWorld(true); S.C2.root.traverse(m => { if (m.isMesh && !/glass/.test(m.name)) meshes.push(m); });
      const hit = (list, ox, oy, oz, dx, dz, far) => { o.set(ox, oy, oz); d.set(dx, 0, dz).normalize(); rc.set(o, d); rc.near = 0; rc.far = far; const h = rc.intersectObjects(list, false); return h.length ? h[0].distance : null; };
      // each new solid piece: from 1.5 m outside, at 0.5 m high, towards its middle: the model and the bullet box at the same
      // distance (the first thing hit may be a wall next to it, as long as both agree)
      const bad = [];
      for (const e of extras) { if (!e.s) continue; const cx = (e.a[0] + e.b[0]) / 2, cz = (e.a[2] + e.b[2]) / 2;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ox = dx > 0 ? e.a[0] - 1.5 : dx < 0 ? e.b[0] + 1.5 : cx, oz = dz > 0 ? e.a[2] - 1.5 : dz < 0 ? e.b[2] + 1.5 : cz;
          if (Math.abs(ox) > 21.27 || Math.abs(oz) > 16.36) continue;   // the outside of the boundary is never seen
          const a = hit(meshes, ox, 0.5, oz, dx, dz, 1.6), r = hit(S.W.ray, ox, 0.5, oz, dx, dz, 1.6);
          if (a === null || r === null || Math.abs(a - r) > 0.03 || a > 1.53) bad.push(e.n + ' ' + [dx, dz] + ' ' + a + '/' + r); } }
      // the new doors: through their middle at 1.2 m (eye, bullet and body height), 1 m each side: nothing, neither seen nor for bullets
      const doors = [], cut = cuts.filter(c => /door/.test(c.n));
      for (const M of mods) for (const c of cut) { const lx = (c.a[0] + c.b[0]) / 2, lz = (c.a[2] + c.b[2]) / 2, x = lx * M.sx + M.t[0], z = lz * M.sz + M.t[1], dx = Math.sign(lx) * M.sx;
        for (const y of [0.3, 1.2, 2.0]) { const a = hit(meshes, x - dx, y, z, dx, 0, 2), r = hit(S.W.ray, x - dx, y, z, dx, 0, 2); if (a !== null || r !== null) doors.push(M.id + ' ' + c.n + ' y' + y + ' ' + a + '/' + r); }
        const walk = S.W.colliders.filter(k => k.maxY > 0.35 && k.minY < 1.8 && x > k.minX - 0.36 && x < k.maxX + 0.36 && z > k.minZ - 0.36 && z < k.maxZ + 0.36);
        if (walk.length) doors.push(M.id + ' ' + c.n + ' cuerpo'); }
      return { bad, doors, n: extras.filter(e => e.s).length }; }, [C2.extras(), C2.CUTS, C2.MODS]);
    check('cada pieza nueva (muros, muretes, jardineras, contrafuertes) se ve donde está su caja de balas, a ±3 cm', vis.bad.length === 0, vis.bad.slice(0, 4).join(' | ') || vis.n + ' piezas × 4 lados');
    check('las 8 puertas nuevas, abiertas para la vista, las balas y el cuerpo (sin paredes invisibles)', vis.doors.length === 0, vis.doors.slice(0, 4).join(' | ') || '4 pisos × 2 puertas × 3 alturas');

    console.log('\nCOBERTURAS Y BALAS');
    const cov = await p.evaluate(() => { const S = __SD, rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3();
      const first = (ox, oy, oz, tx, tz) => { o.set(ox, oy, oz); d.set(tx - ox, 0, tz - oz); const L = d.length(); d.normalize(); rc.set(o, d); rc.near = 0; rc.far = L; const h = rc.intersectObjects(S.W.ray, false); return h.length ? h[0].object.name : ''; };
      return { low: first(-12, 0.7, -0.35, -5, -0.35), high: first(-12, 1.5, -0.35, -5, -0.35), pot: first(-6, 0.8, -1.55, 0, -1.55), glass: first(-13.2, 1.4, -3.2, -13.2, 3.2) }; });
    check('agachado detrás del murete: la bala se queda en el murete', /lowwall/.test(cov.low), cov.low);
    check('de pie se dispara por encima del murete', !/lowwall/.test(cov.high), cov.high || 'nada');
    check('la jardinera para la bala', /planter/.test(cov.pot), cov.pot);
    check('las cristaleras de los balcones dejan pasar la bala (como en CASA ATLAS) y las barandillas también', !/glass|rail/.test(cov.glass), cov.glass || 'nada');

    console.log('\nLOS BOTS 40 s');
    const bot = await p.evaluate(() => { const S = __SD, W = S.WORLDS.casa2, bots = S.BOTS.filter(x => x.alive); let inBox = 0, out = 0; const moved = bots.map(() => 0), last = bots.map(b => [b.g.position.x, b.g.position.z]);
      for (let i = 0; i < 1200; i++) { S.simTick(1 / 30); bots.forEach((Bt, k) => { const x = Bt.g.position.x, z = Bt.g.position.z;
        if (W.colliders.some(c => c.maxY > 0.45 && c.minY < 1.8 && x > c.minX + 0.05 && x < c.maxX - 0.05 && z > c.minZ + 0.05 && z < c.maxZ - 0.05)) inBox++;
        if (Math.abs(x) > 21.3 || Math.abs(z) > 16.4) out++; moved[k] += Math.hypot(x - last[k][0], z - last[k][1]); last[k] = [x, z]; }); }
      return { inBox, out, moved: moved.map(m => +m.toFixed(1)) }; });
    check('los bots se mueven por el complejo', bot.moved.every(m => m > 5), bot.moved.join(' / ') + ' m');
    check('nunca dentro de una caja (muebles, paredes) ni fuera del complejo', bot.inBox === 0 && bot.out === 0, bot.inBox + ' / ' + bot.out);
    const back = await p.evaluate(() => { __SD.toMenu(); __SD.setOffMap('arena'); __SD.setWorld('arena'); return { w: __SD.WORLD_ID, sc: __SD.LIGHT.sun.shadow.camera.right, vis: __SD.C2.root.visible }; });
    check('volver a la ARENA: sombras como antes y el complejo oculto', back.w === 'arena' && back.sc === 62 && !back.vis, JSON.stringify(back));
    check('sin errores', errs.length === 0, errs.slice(0, 3).join(' | ') || 'ninguno');
    await ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
