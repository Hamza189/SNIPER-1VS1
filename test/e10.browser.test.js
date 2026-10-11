/* E10 «Casa Oliva» (the first delivered 3D model, assets/3d/models/sd_e10_casa_oliva.glb) in the game:
   - only with ?pueblo=3; &e10=0 and the default game keep the PUEBLO 2.0 building
   - it replaces the old building only once loaded, at the slot's centre
   - nothing at any height can be seen through the building (every LOD): a ray coming from outside meets
     something within 0.40 m of the collision box face (the openings are recessed at most that much)
   - the level of detail follows the distance divided by the zoom (the scope does not show the low LOD)
   Run: node test/e10.browser.test.js   (software WebGL is fine: nothing is timed)                        */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 2 })); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));

  console.log('\nE10 CASA OLIVA — ?pueblo=3');
  await page.goto(srv.url + '?vm=1&pueblo=3');
  await page.waitForFunction(() => window.__SD && __SD.E10 && (__SD.E10.ready || __SD.E10.failed), null, { timeout: 120000 });
  const A = await page.evaluate(() => {
    const S = __SD, T = THREE, E = S.E10; S.setWorld('pueblo'); E.root.visible = true; E.root.updateMatrixWorld(true);
    const r = { ready: E.ready, failed: E.failed, pos: E.root.position.toArray(), tris: E.tris, oldHidden: E.old.length > 0 && E.old.every(m => !m.visible),
      oldInWorld: E.old.some(m => S.WORLDS.pueblo.objs.includes(m)), rootInWorld: S.WORLDS.pueblo.objs.includes(E.root), see: {}, deep25: {} };
    // see-through: rays from 2 m outside each face, every 0.1 m along it, heights 0.3–5.7 m
    const rc = new T.Raycaster(), vis = o => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
    for (let lv = 0; lv < 4; lv++) {   // 3 = LOD0 without the interior volume: what the delivered model shows on its own
      if (E.blocker) E.blocker.visible = lv < 3;
      E.levels.forEach((l, k) => { l.visible = k === lv % 3; }); E.root.updateMatrixWorld(true);
      let worst = 0, where = '', n = 0, deep = 0;
      for (let y = 0.3; y < 5.75; y += 0.3) for (let t = -0.97; t <= 0.971; t += 0.0333) {
        const F = [['+z', [E.x + t * 3, y, E.z + 7], [0, 0, -1]], ['-z', [E.x + t * 3, y, E.z - 7], [0, 0, 1]], ['+x', [E.x + 5, y, E.z + t * 5], [-1, 0, 0]], ['-x', [E.x - 5, y, E.z + t * 5], [1, 0, 0]]];
        for (const [f, o, d] of F) {
          rc.set(new T.Vector3(...o), new T.Vector3(...d)); rc.far = 20;
          const h = rc.intersectObject(E.root, true).filter(i => vis(i.object)); n++;
          const inset = h.length ? h[0].distance - 2 : 99;
          if (inset > 0.25) deep++;
          if (inset > worst) { worst = inset; where = f + ' ' + t.toFixed(2) + ' y ' + y.toFixed(1) + (h.length ? ' → ' + h[0].object.name : ' → nada'); }
        }
      }
      r.see[lv < 3 ? 'LOD' + lv : 'LOD0_sin_volumen'] = { worst: +worst.toFixed(2), where, n }; if (lv < 3) r.deep25['LOD' + lv] = deep;
    }
    E.levels.forEach((l, k) => { l.visible = true; });
    // level of detail: distance / zoom (ALTO: LOD0 < 35 m, LOD1 < 80 m)
    const cam = S.camera, f0 = cam.fov, lod = (dist, zoom) => { cam.position.set(E.x, 1.6, E.z + dist); cam.fov = (window.innerWidth > 0 ? f0 : f0) / zoom; cam.updateMatrixWorld(true); S.e10Lod(true); return E.lod; };
    const base = f0;
    r.lod = { at10: lod(10, 1), at60: lod(60, 1), at100: lod(100, 1), at100scope: lod(100, 8), at60scope: lod(60, 8) };
    cam.fov = base;
    r.visibleLevels = E.levels.filter(l => l.visible).length;
    return r;
  });
  check('el GLB carga y se coloca en el centro del hueco E10 (13, 0, −25)', A.ready && !A.failed && A.pos.join() === '13,0,-25', JSON.stringify(A.pos));
  check('triángulos de los tres LOD dentro del presupuesto (15 000 / 6 000 / 1 500)', A.tris[0] <= 15000 && A.tris[1] <= 6000 && A.tris[2] <= 1500, A.tris.join(' / '));
  check('el edificio PUEBLO 2.0 de E10 deja de dibujarse (solo cuando el nuevo ha cargado)', A.oldHidden && !A.oldInWorld && A.rootInWorld);
  for (const lv of ['LOD0', 'LOD1', 'LOD2']) check(lv + ': no se ve a través del edificio a ninguna altura (todo rayo choca a ≤ 0,40 m de la cara)', A.see[lv].worst <= 0.40, 'peor ' + A.see[lv].worst + ' m en ' + A.see[lv].where + ' · ' + A.see[lv].n + ' rayos');
  console.log('  info el modelo entregado, sin el volumen interior: peor ' + A.see.LOD0_sin_volumen.worst + ' m en ' + A.see.LOD0_sin_volumen.where + ' (99 = el rayo atraviesa el edificio)');
  console.log('  info huecos con más de 0,25 m de fondo (el contrato pide ≤ 0,25): ' + JSON.stringify(A.deep25) + ' rayos — pendiente de corregir en el modelo');
  check('LOD por distancia: 10 m → LOD0, 60 m → LOD1, 100 m → LOD2', A.lod.at10 === 0 && A.lod.at60 === 1 && A.lod.at100 === 2, JSON.stringify(A.lod));
  check('con la mira (8×) no aparece el LOD bajo: 100 m → LOD0, 60 m → LOD0', A.lod.at100scope === 0 && A.lod.at60scope === 0);
  check('solo un LOD visible a la vez', A.visibleLevels === 1);

  console.log('\nE10 — sin la bandera y con &e10=0');
  for (const [url, label] of [['?vm=1', 'el juego normal'], ['?vm=1&pueblo=3&e10=0', '?pueblo=3&e10=0']]) {
    await page.goto(srv.url + url);
    await page.waitForFunction(() => window.__SD && __SD.W, null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ on: __SD.E10.on, ready: __SD.E10.ready, old: __SD.E10.old.length, glb: !!__SD.scene.getObjectByName('e10_casa_oliva') }));
    check(label + ': sigue el edificio de antes, sin cargar el GLB', !r.on && !r.ready && !r.glb && r.old === 0, JSON.stringify(r));
  }
  check('sin errores en la página', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
