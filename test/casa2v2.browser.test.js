/* CASA ATLAS 2.0 · diseño 2 (04-11-2026, client/casa2.js → SDCasa2.v2, mapa «casa2b») en la página, con ?casa2v=2:
   - el servidor la tiene (core/mapdata.js) con las mismas cajas; sale en lugar del diseño 1 en los menús del duelo y online
   - carga y empieza en la salida A con 2 bots; los mismos materiales que CASA ATLAS; ≤ 40 mallas
   - lo que se ve coincide con las cajas; las 12 puertas nuevas (4 pisos × comedor, cocina y estudio) abiertas de verdad
   - balcones sin barandillas; murete, jardinera y seto del centro paran las balas; los bots se mueven 40 s sin meterse en nada
   Run: node test/casa2v2.browser.test.js   (WebGL por software: no se mide tiempo; env PAGE=otra.html) */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nCASA 2.0 · DISEÑO 2: playwright no está instalado, se omite'); process.exit(0); }
const ss = require('../tools/static-server.js');
const MAP = require('../core/mapdata.js'), C = require('../client/casa.js'), C2 = require('../client/casa2.js').v2;
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
(async () => {
  console.log('\nDATOS');
  const M = MAP.maps.casa2b;
  check('el servidor la tiene: sus cajas, las salidas A y B y su red ligera', M && M.colliders.length === C2.boxes(C).length && M.spawns.length === 2 && M.nav.length > 3000 && M.nav.length < 6000,
    M && M.colliders.length + ' cajas · ' + M.nav.length + ' puntos');
  check('y el diseño 1 sigue igual en el servidor (las salas en CASA ATLAS 2.0 de hoy no cambian)', MAP.maps.casa2 && MAP.maps.casa2.colliders.length === require('../client/casa2.js').boxes(C).length);
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); localStorage.setItem('sniperduel_diff', '1'); } catch (e) {} });
    const p = await ctx.newPage(), errs = [], bad = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (/\/assets\//.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await p.goto(srv.url + (process.env.PAGE || '') + '?vm=0&casa2v=2'); await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.W, null, { timeout: 180000 });

    console.log('\nMENÚS');
    const menu = await p.evaluate(() => ({ duel: !!document.querySelector('#mapSeg [data-map=casa2b]:not([hidden])'), online: !!document.querySelector('#mpMapSeg [data-map=casa2b]:not([hidden])'),
      old: !!document.querySelector('#mapSeg [data-map=casa2]'), boxes: __SD.WORLDS.casa2b.colliders.length, local: !!__SD.WORLDS.casa2b.local }));
    check('con ?casa2v=2 sale la nueva en lugar de la de hoy, en el duelo y en el online', menu.duel && menu.online && !menu.old && !menu.local, JSON.stringify(menu));
    check('las mismas cajas que client/casa2.js', menu.boxes === C2.boxes(C).length);

    await p.evaluate(() => { document.querySelector('#mapSeg [data-map=casa2b]').click(); __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.startMatch(); });
    await p.waitForFunction(() => __SD.C2B.ready && __SD.state === 'playing', null, { timeout: 180000 });
    const SP = C2.spawns(C)[0];
    const st = await p.evaluate(() => ({ w: __SD.WORLD_ID, bots: __SD.BOTS.filter(x => x.alive).length, pos: [__SD.PM.x, __SD.PM.z], casaVis: __SD.CASA.root.visible, old: !!(__SD.C2.root && __SD.C2.root.visible) }));
    check('carga y empieza en la salida A, con 2 bots (NORMAL); ni la CASA ATLAS pequeña ni el diseño 1 a la vista', st.w === 'casa2b' && st.bots === 2 && Math.hypot(st.pos[0] - SP.x, st.pos[1] - SP.z) < 0.5 && !st.casaVis && !st.old, JSON.stringify(st));
    check('sin errores ni archivos que falten', errs.length === 0 && bad.length === 0, errs.concat(bad).join(' | ') || 'ninguno');

    console.log('\nMATERIALES Y DIBUJO');
    const mat = await p.evaluate(() => { const S = __SD, own = new Set(), mine = new Set(); let tris = 0, calls = 0;
      S.CASA.root.traverse(o => { if (o.isMesh) own.add(o.material); });
      S.C2B.root.traverse(o => { if (!o.isMesh) return; calls++; tris += o.geometry.attributes.position.count / 3; mine.add(o.material); });
      const extra = [...mine].filter(m => !own.has(m));
      return { same: extra.every(m => /_c2b$/.test(m.name)), extra: extra.map(m => m.name).sort(), mats: mine.size, tris: Math.round(tris), calls,
        glass: extra.some(m => /glass/.test(m.name) && m.opacity < 0.2 && m.envMapIntensity > 1), floors: extra.filter(m => m.map && m.normalMap && m.roughnessMap).length }; });
    check('los materiales de CASA ATLAS más 4 copias propias (3 suelos escaneados y el cristal); la CASA ATLAS y el diseño 1 no cambian', mat.same && mat.extra.length === 4, mat.mats + ' materiales · ' + mat.extra.join(' '));
    check('suelos con color, relieve y rugosidad; cristal más claro que refleja el cielo', mat.floors === 3 && mat.glass);
    const keep = await p.evaluate(() => { let ok = true; __SD.CASA.root.traverse(o => { if (o.isMesh && /_c2b$/.test(o.material.name)) ok = false; }); return ok; });
    check('la CASA ATLAS original sigue con sus materiales', keep);
    check('≤ 40 mallas, ≤ 60 000 triángulos', mat.calls <= 40 && mat.tris <= 60000, mat.calls + ' mallas · ' + mat.tris + ' triángulos');

    console.log('\nLO QUE SE VE = LAS CAJAS');
    const vis = await p.evaluate(([extras, cuts, mods, XO, ZN]) => { const S = __SD, rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), meshes = [];
      S.C2B.root.updateMatrixWorld(true); S.C2B.root.traverse(m => { if (m.isMesh && !/glass/.test(m.name)) meshes.push(m); });
      const hit = (list, ox, oy, oz, dx, dy, dz, far) => { o.set(ox, oy, oz); d.set(dx, dy, dz).normalize(); rc.set(o, d); rc.near = 0; rc.far = far; const h = rc.intersectObjects(list, false); return h.length ? h[0].distance : null; };
      const bad = [];
      for (const e of extras) { if (!e.s) continue; const cx = (e.a[0] + e.b[0]) / 2, cz = (e.a[2] + e.b[2]) / 2;
        if (e.a[1] > 2) {   // the pergola: from 1 m below, straight up
          const a = hit(meshes, cx, e.a[1] - 1, cz, 0, 1, 0, 1.2), r = hit(S.W.ray, cx, e.a[1] - 1, cz, 0, 1, 0, 1.2);
          if (a === null || r === null || Math.abs(a - r) > 0.03) bad.push(e.n + ' arriba ' + a + '/' + r); continue; }
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ox = dx > 0 ? e.a[0] - 1.5 : dx < 0 ? e.b[0] + 1.5 : cx, oz = dz > 0 ? e.a[2] - 1.5 : dz < 0 ? e.b[2] + 1.5 : cz;
          if (Math.abs(ox) > XO - 0.01 || Math.abs(oz) > ZN - 0.01) continue;
          const a = hit(meshes, ox, 0.5, oz, dx, 0, dz, 1.6), r = hit(S.W.ray, ox, 0.5, oz, dx, 0, dz, 1.6);
          if (a === null || r === null || Math.abs(a - r) > 0.03 || a > 1.53) bad.push(e.n + ' ' + [dx, dz] + ' ' + a + '/' + r); } }
      const doors = [], cut = cuts.filter(c => /door/.test(c.n));
      for (const M of mods) for (const c of cut) { const lx = (c.a[0] + c.b[0]) / 2, lz = (c.a[2] + c.b[2]) / 2, x = lx * M.sx + M.t[0], z = lz * M.sz + M.t[1], dx = Math.sign(lx) * M.sx;
        for (const y of [0.3, 1.2, 2.0]) { const a = hit(meshes, x - dx, y, z, dx, 0, 0, 2), r = hit(S.W.ray, x - dx, y, z, dx, 0, 0, 2); if (a !== null || r !== null) doors.push(M.id + ' ' + c.n + ' y' + y + ' ' + a + '/' + r); }
        const walk = S.W.colliders.filter(k => k.maxY > 0.35 && k.minY < 1.8 && x > k.minX - 0.36 && x < k.maxX + 0.36 && z > k.minZ - 0.36 && z < k.maxZ + 0.36);
        if (walk.length) doors.push(M.id + ' ' + c.n + ' cuerpo'); }
      return { bad, doors, n: extras.filter(e => e.s).length, nd: mods.length * cut.length }; }, [C2.extras(), C2.CUTS, C2.MODS, C2.XO, C2.ZN]);
    check('cada pieza nueva (muros, muretes, jardineras, seto, pérgola) se ve donde está su caja de balas, a ±3 cm', vis.bad.length === 0, vis.bad.slice(0, 4).join(' | ') || vis.n + ' piezas');
    check('las ' + vis.nd + ' puertas nuevas, abiertas para la vista, las balas y el cuerpo', vis.nd === 12 && vis.doors.length === 0, vis.doors.slice(0, 4).join(' | ') || '4 pisos × 3 puertas × 3 alturas');
    // from each balcony door straight into the courtyard: nothing in the way (rails and benches gone)
    const bal = await p.evaluate(([mods, CZ]) => { const out = [];
      for (const M of mods) for (const lx of [-3.1, 6.15]) { const x = lx * M.sx + M.t[0], z0 = (5.6) * M.sz + M.t[1], z1 = (7.6) * M.sz + M.t[1];
        for (let t = 0; t <= 1; t += 0.1) { const z = z0 + (z1 - z0) * t; if (__SD.W.colliders.some(k => k.maxY > 0.35 && k.minY < 1.8 && x > k.minX - 0.3 && x < k.maxX + 0.3 && z > k.minZ - 0.3 && z < k.maxZ + 0.3)) { out.push(M.id + ' ' + lx); break; } } }
      return out; }, [C2.MODS, C2.CZ]);
    check('del balcón al patio en línea recta, sin barandilla ni bancos', bal.length === 0, bal.join(' ') || '8 puertas de balcón');

    console.log('\nCOBERTURAS Y BALAS');
    const cov = await p.evaluate(() => { const S = __SD, rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3();
      const first = (ox, oy, oz, tx, tz) => { o.set(ox, oy, oz); d.set(tx - ox, 0, tz - oz); const L = d.length(); d.normalize(); rc.set(o, d); rc.near = 0; rc.far = L; const h = rc.intersectObjects(S.W.ray, false); return h.length ? h[0].object.name : ''; };
      return { low: first(-7.2, 0.7, -1, -7.2, 3), high: first(-7.2, 1.5, -1, -7.2, 3), pot: first(-13.2, 0.8, 1, -13.2, -3), hedge: first(0, 1.6, -3, 0, 3), glass: first(-13.2, 1.4, -3.9, -13.2, -1) }; });
    check('agachado detrás del murete: la bala se queda en el murete', /lowwall/.test(cov.low), cov.low);
    check('de pie se dispara por encima del murete', !/lowwall/.test(cov.high), cov.high || 'nada');
    check('la jardinera para la bala', /planter/.test(cov.pot), cov.pot);
    check('el seto del centro tapa a la altura de los ojos', /planter_centre/.test(cov.hedge), cov.hedge);
    check('del balcón al patio nada para la bala (sin barandilla)', cov.glass === '', cov.glass || 'nada');

    console.log('\nLOS BOTS 40 s');
    const bot = await p.evaluate(([XO, ZN]) => { const S = __SD, W = S.WORLDS.casa2b, bots = S.BOTS.filter(x => x.alive); let inBox = 0, out = 0; const moved = bots.map(() => 0), last = bots.map(b => [b.g.position.x, b.g.position.z]);
      for (let i = 0; i < 1200; i++) { S.simTick(1 / 30); bots.forEach((Bt, k) => { const x = Bt.g.position.x, z = Bt.g.position.z;
        if (W.colliders.some(c => c.maxY > 0.45 && c.minY < 1.8 && x > c.minX + 0.05 && x < c.maxX - 0.05 && z > c.minZ + 0.05 && z < c.maxZ - 0.05)) inBox++;
        if (Math.abs(x) > XO || Math.abs(z) > ZN) out++; moved[k] += Math.hypot(x - last[k][0], z - last[k][1]); last[k] = [x, z]; }); }
      return { inBox, out, moved: moved.map(m => +m.toFixed(1)) }; }, [C2.XO, C2.ZN]);
    check('los bots se mueven por el complejo', bot.moved.every(m => m > 5), bot.moved.join(' / ') + ' m');
    check('nunca dentro de una caja ni fuera del complejo', bot.inBox === 0 && bot.out === 0, bot.inBox + ' / ' + bot.out);
    const back = await p.evaluate(() => { __SD.toMenu(); __SD.setOffMap('arena'); __SD.setWorld('arena'); return { w: __SD.WORLD_ID, sc: __SD.LIGHT.sun.shadow.camera.right, vis: __SD.C2B.root.visible }; });
    check('volver a la ARENA: sombras como antes y el complejo oculto', back.w === 'arena' && back.sc === 62 && !back.vis, JSON.stringify(back));
    check('sin errores', errs.length === 0, errs.slice(0, 3).join(' | ') || 'ninguno');
    await ctx.close();
  } catch (e) { check('sin excepciones', false, e.message); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
