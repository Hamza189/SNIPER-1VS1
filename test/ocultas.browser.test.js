/* SOLO PARA LAS BALAS (24-11-2026, src/page.html rayHide, docs/claude-code/ENGINE_NEXT_GEN_INFORME.md §8): las mallas de
   material invisible que solo usan las balas y las líneas de visión quedan ocultas (three.js ya no las recorre en cada
   fotograma). Lo que se ve y lo que pasa con las balas no cambia:
   - en PUEBLO, ARENA y CASA ATLAS: más de mil mallas menos que recorrer en PUEBLO, y las matrices del fotograma más baratas
   - en la misma página y el mismo momento, ocultas y a la vista como antes: las mismas llamadas de dibujo y triángulos (una
     vuelta de cámara) y 3 000 rayos al azar contra el mapa chocan a la misma distancia
   - tras una partida entera con bots, ninguna oculta se ha movido (su matriz es la de su posición)
   - al cambiar de mapa y volver, y con las casas macizas de antes (?casas=0), siguen bien
   - sin errores
   Run: node test/ocultas.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const run = async (q, map) => {
    const ctx = await b.newContext({ viewport: { width: 640, height: 300 }, hasTouch: true, isMobile: true });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    // the same random numbers in both runs (bots, where they appear...), so the two can be compared
    await ctx.addInitScript(() => { let s = 987654321; Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); });
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_menuOld', 'true'); localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + '?carga=1' + q, { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.P3W && (__SD.P3W.kit || !__SD.P3ON), null, { timeout: 240000 });
    await p.evaluate(m => { const S = __SD; S.setTrain('off'); S.setMode('duel'); S.setDuelLethal(false); S.setOffMap(m); S.startMatch(); }, map);
    await p.waitForFunction(() => __SD.state === 'playing', null, { timeout: 180000 }).catch(() => {});
    await p.waitForTimeout(2000);
    // A/B in the same page and the same frozen moment: hidden (now) and shown again (as before ?ocultas=0)
    const r = await p.evaluate(() => {
      const S = __SD, sc = S.scene, R = S.renderer, hid = sc.children.filter(c => c.userData.rayHid && !c.visible);
      const show = on => { for (const c of hid) c.visible = on; };
      S.freeze(true);
      const walk = () => { let n = 0; sc.traverseVisible(() => n++); return n; };
      const turn = () => { R.info.autoReset = false; let calls = 0, tris = 0;
        for (let i = 0; i < 12; i++) { S.P.yaw = i / 12 * Math.PI * 2; R.info.reset(); S.advance(16); calls += R.info.render.calls; tris += R.info.render.triangles; }
        R.info.autoReset = true; return { calls: calls / 12, tris: tris / 12 }; };
      const mat = () => { const t0 = performance.now(); for (let i = 0; i < 100; i++) S.sceneUpdate(); return (performance.now() - t0) / 100; };
      show(true); const wA = walk(), dA = turn(); show(false); const wB = walk(), dB = turn(); show(true); const dA2 = turn(); show(false);   // A, B, A again: what changes by itself (particles, water) between two turns
      // the matrices of a frame alone: 9 rounds each way, alternating, the best of each (the PC may be busy)
      const tA = [], tB = []; for (let k = 0; k < 9; k++) { show(true); tA.push(mat()); show(false); tB.push(mat()); }
      // 3 000 rays against the map (same seed both ways)
      const rays = () => { let s = 12345; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        const ray = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), hits = [];
        for (let i = 0; i < 3000; i++) { o.set(rnd() * 120 - 60, 0.3 + rnd() * 6, rnd() * 120 - 60); d.set(rnd() * 2 - 1, (rnd() * 2 - 1) * 0.3, rnd() * 2 - 1).normalize();
          ray.set(o, d); ray.far = 150; const h = ray.intersectObjects(S.W.ray, false); hits.push(h.length ? h[0].distance : -1); }
        return hits; };
      show(true); const hA = rays(); show(false); const hB = rays();
      return { hidden: hid.length, wA, wB, dA, dB, dA2, msA: +Math.min(...tA).toFixed(4), msB: +Math.min(...tB).toFixed(4),
        hits: hA.filter(h => h >= 0).length, rayDiff: hA.filter((h, i) => h !== hB[i]).length };
    });
    // a whole match with bots that shoot; then: has any hidden mesh moved?
    const moved = await p.evaluate(() => { const S = __SD; S.setDuelLethal(true); S.freeze(false); S.MANUAL.on = true;
      const ro = S.renderer.render; S.renderer.render = function () {};
      for (let i = 0; i < 900; i++) { S.P.yaw += 0.01; S.advance(1000 / 60); }
      S.renderer.render = ro;
      const M = new THREE.Matrix4(); let n = 0, bad = [];
      for (const c of S.scene.children) { if (!c.userData.rayHid) continue; n++; M.compose(c.position, c.quaternion, c.scale);
        let dd = 0; for (let k = 0; k < 16; k++) dd = Math.max(dd, Math.abs(M.elements[k] - c.matrix.elements[k]), Math.abs(c.matrixWorld.elements[k] - c.matrix.elements[k]));
        if (dd > 1e-9) bad.push(c.name || c.geometry.type); }
      return { n, bad: bad.slice(0, 5), nb: bad.length }; });
    await ctx.close(); return { r, moved, errs };
  };
  try {
    for (const map of ['pueblo', 'arena', 'casa']) {
      console.log('\n' + map.toUpperCase());
      const B = await run('', map), r = B.r;
      check('menos objetos que recorrer en cada fotograma', r.wB < r.wA && (map !== 'pueblo' || r.wA - r.wB > 1000) && r.msB < r.msA,
        r.wA + ' → ' + r.wB + ' (ocultas ' + r.hidden + ') · matrices ' + r.msA + ' → ' + r.msB + ' ms');
      // identical, or no further from either «as before» turn than those two are from each other (+1 call / 10 triangles in 12 frames)
      const same = (x, y) => x.calls === y.calls && x.tris === y.tris, near = (x, k) => Math.abs(x.calls - r.dB.calls) <= Math.abs(r.dA.calls - r.dA2.calls) + 1 / 12 + 1e-9 && Math.abs(x.tris - r.dB.tris) <= Math.abs(r.dA.tris - r.dA2.tris) + 10 / 12 + 1e-9;
      check('las mismas llamadas de dibujo y triángulos', same(r.dA, r.dB) || same(r.dA2, r.dB) || (near(r.dA) && near(r.dA2)),
        r.dA.calls.toFixed(2) + ' → ' + r.dB.calls.toFixed(2) + ' (y otra vez como antes ' + r.dA2.calls.toFixed(2) + ') llamadas · ' + r.dA.tris.toFixed(1) + ' → ' + r.dB.tris.toFixed(1) + ' (' + r.dA2.tris.toFixed(1) + ') triángulos');
      check('3 000 rayos chocan donde siempre', r.rayDiff === 0, r.hits + ' chocan' + (r.rayDiff ? ' · distintos ' + r.rayDiff : ''));
      check('tras una partida con bots, ninguna oculta se ha movido', B.moved.nb === 0 && B.moved.n === r.hidden, B.moved.n + ' ocultas' + (B.moved.nb ? ' · movidas: ' + B.moved.bad.join(', ') : ''));
      check('sin errores', !B.errs.length, B.errs.slice(0, 2).join(' | '));
    }
    console.log('\nCAMBIO DE MAPA Y CASAS DE ANTES');
    const swap = async q => {
      const ctx = await b.newContext({ viewport: { width: 640, height: 300 } });
      const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(srv.url + '?carga=1' + q, { timeout: 180000 });
      await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.CASAS, null, { timeout: 240000 });
      const w = await p.evaluate(() => { const S = __SD, sc = S.scene, shown = () => sc.children.filter(c => c.visible && c.isMesh && c.material && c.material.visible !== false).length;
        const h0 = sc.children.filter(c => c.userData.rayHid).length;
        S.setWorld('arena'); S.setWorld('pueblo'); const back = sc.children.filter(c => c.userData.rayHid && c.visible).length, shownPueblo = shown();
        const has = S.CASAS.on && S.CASAS.solid.length; let solid = -1, after = -1;
        if (has) { S.casasSolid(true); solid = S.CASAS.solid.filter(x => x.m.visible && x.m.material.visible !== false).length; S.casasSolid(false); after = S.CASAS.solid.filter(x => x.m.visible && x.m.material.visible !== false).length; }
        return { h0, back, shownPueblo, solid, after }; });
      await ctx.close(); return { w, errs };
    };
    const A = await swap('&ocultas=0'), B = await swap('');
    check('al volver a PUEBLO las ocultas siguen ocultas, y se ve lo mismo', B.w.h0 > 0 && B.w.back === 0 && B.w.shownPueblo === A.w.shownPueblo, JSON.stringify({ antes: A.w, ahora: B.w }));
    check('las casas macizas de antes (?casas=0): igual que con ?ocultas=0', B.w.solid === A.w.solid && B.w.after === A.w.after, 'macizas a la vista ' + A.w.solid + ' → ' + B.w.solid + ' · al quitarlas ' + A.w.after + ' → ' + B.w.after);
    check('sin errores', !A.errs.length && !B.errs.length, A.errs.concat(B.errs).slice(0, 2).join(' | '));
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
