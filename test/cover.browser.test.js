/* False cover check on what the page really draws (PUEBLO 2.0 and the PUEBLO 3.0 slice, ?pueblo=3).
   "False cover": something you can see that looks like it would stop a bullet but does not (or hides a
   player while the bullets go through). Bullets hit the collision boxes and the ray targets (the server's
   copy is core/mapdata.js); every drawn vertex in the playable area is checked against them:
     body height (0.12–2.0 m): on or within 0.45 m of a solid box, or low decoration (≤ 0.66 m) against
       one, or a whitelisted thin post (lamp posts, street poles, a tree trunk: ≤ 0.13 m from its axis)
     overhead (2.0–6.5 m): within 1.2 m of a solid box (balconies, awnings, lanterns), or a tree crown /
       lamp head on the whitelist
     above a roof: nothing higher than the box's top (+5 cm) — reported for PUEBLO 2.0 (its rooftop tanks
       and chimneys, unchanged), must be zero in the PUEBLO 3.0 slice
   Run: node test/cover.browser.test.js   (needs Playwright; software WebGL is fine: nothing is timed) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

async function audit(page, url, p3, canary) {
  await page.goto(url);
  await page.waitForFunction(p3 => window.__SD && __SD.W && (!p3 || (__SD.P3W && __SD.P3W.kit && (!__SD.E10.on || __SD.E10.ready || __SD.E10.failed))), p3, { timeout: 90000 });
  return page.evaluate(canary => {
    const S = __SD, T = THREE; S.setWorld('pueblo'); const W = S.WORLDS.pueblo;
    // E10 (Casa Oliva, a delivered GLB): all three LOD levels are checked, not only the one in view
    if (S.E10 && S.E10.ready) S.E10.levels.forEach(l => { l.visible = true; });
    if (canary) {   // a fake crate in the open (drawn, no collision): the check must catch it
      const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial()); m.position.set(7.5, 0.5, -7.5); m.name = 'canary'; S.scene.add(m); W.objs.push(m);
    }
    const solids = [];
    for (const c of W.colliders) solids.push([c.minX, c.minY, c.minZ, c.maxX, c.maxY, c.maxZ]);
    const bb = new T.Box3();
    for (const o of W.ray) { if (o.geometry && o.geometry.type === 'PlaneGeometry') continue; bb.setFromObject(o); if (bb.max.x - bb.min.x > 150) continue; solids.push([bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z]); }
    const hd = (x, y, z, minTop) => { let best = 1e9; for (const s of solids) { if (s[4] < minTop || s[1] > y + 0.05) continue; const dx = Math.max(0, s[0] - x, x - s[3]), dz = Math.max(0, s[2] - z, z - s[5]); const d = Math.hypot(dx, dz); if (d < best) best = d; } return best; };
    const inSolid = (x, y, z) => solids.some(s => x >= s[0] - 0.05 && x <= s[3] + 0.05 && z >= s[2] - 0.05 && z <= s[5] + 0.05 && y >= s[1] - 0.05 && y <= s[4] + 0.05);
    const overRoof = (x, y, z) => !inSolid(x, y, z) && solids.some(s => x > s[0] + 0.02 && x < s[3] - 0.02 && z > s[2] + 0.02 && z < s[5] - 0.02 && y > s[4] + 0.05 && y < s[4] + 6);
    const THIN = /@(lamp_post|street_pole)$|_woodraw(_cast)?@orange_tree$/, CROWN = /@(orange_tree|lamp_post|street_pole)$/;
    const AXES = (S.P3W && S.P3W.axes) || [];
    const out = { body: 0, over: 0, roof: 0, verts: 0, ex: [], rx: [], roofBy: {}, meshes: 0, e10: { on: !!(S.E10 && S.E10.on), ready: !!(S.E10 && S.E10.ready), failed: !!(S.E10 && S.E10.failed), lods: {} } };
    const v = new T.Vector3(), M = new T.Matrix4(), IM = new T.Matrix4();
    const vis = o => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; };
    for (const o of W.objs) {
      o.traverse(m => {
        if (!m.isMesh || !vis(m) || !m.geometry || !m.geometry.attributes.position) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        if (mats.every(mt => !mt || mt.visible === false || mt.colorWrite === false)) return;
        if (/^p3_(hills|backdrop|ground)|^streets_|^town_(cobble|paving)/.test(m.name)) return;
        out.meshes++;
        { const lm = /^e10_LOD(\d)/.exec(m.name); if (lm) out.e10.lods[lm[1]] = (out.e10.lods[lm[1]] || 0) + 1; }
        m.updateMatrixWorld(true);
        const pos = m.geometry.attributes.position, n = m.isInstancedMesh ? m.count : 1;
        const step = Math.max(1, Math.floor(pos.count / 60000));   // every vertex (subsampled only in huge meshes)
        for (let i = 0; i < n; i++) {
          if (m.isInstancedMesh) { m.getMatrixAt(i, IM); M.multiplyMatrices(m.matrixWorld, IM); } else M.copy(m.matrixWorld);

          for (let k = 0; k < pos.count; k += step) {
            v.fromBufferAttribute(pos, k).applyMatrix4(M);
            const x = v.x, y = v.y, z = v.z;
            if (Math.abs(x) > 49.9 || Math.abs(z) > 49.9 || y <= 0.12) continue;
            out.verts++;
            if (y < 2.0) {
              const d = hd(x, y, z, Math.min(y, 1.0) - 0.02);
              if (d <= 0.45 || (y <= 0.66 && d <= 0.66)) continue;
              if (THIN.test(m.name) && AXES.some(a => Math.hypot(x - a[0], z - a[1]) <= 0.13)) continue;
              if (x > -17.3 && x < -16.7 && z > -19.45 && z < -19.25) continue;   // water tower ladder (PUEBLO 2.0): see-through rails
              out.body++; if (out.ex.length < 8) out.ex.push(m.name + ' ' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2) + ' a ' + d.toFixed(2) + ' m');
            } else if (y < 6.5) {
              if (hd(x, y, z, 0) <= 1.2 || CROWN.test(m.name)) { if (!CROWN.test(m.name) && !THIN.test(m.name) && overRoof(x, y, z)) { out.roof++; out.roofBy[m.name] = (out.roofBy[m.name] || 0) + 1; if (/^p3_|^kit_|^e10_/.test(m.name) && out.rx.length < 6) out.rx.push(m.name + ' ' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2)); } continue; }
              out.over++; if (out.ex.length < 6) out.ex.push('arriba ' + m.name + ' ' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2));
            } else if (!CROWN.test(m.name) && !THIN.test(m.name) && overRoof(x, y, z)) { out.roof++; out.roofBy[m.name] = (out.roofBy[m.name] || 0) + 1; if (/^p3_|^kit_|^e10_/.test(m.name) && out.rx.length < 6) out.rx.push(m.name + ' ' + x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2)); }
          }
        }
      });
    }
    return out;
  }, canary);
}

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  console.log('\nCOBERTURAS FALSAS — PUEBLO 2.0 (sin bandera)');
  const A = await audit(page, srv.url + '?vm=1', false);
  check('a la altura del cuerpo: todo lo que se ve para las balas', A.body === 0, A.body + ' vértices de ' + A.verts + ' en ' + A.meshes + ' mallas' + (A.ex.length ? ': ' + A.ex.join(' | ') : ''));
  check('sobre la calle: nada suelto lejos de un muro', A.over === 0, A.over + '');
  console.log('  info PUEBLO 2.0 tiene ' + A.roof + ' vértices sobre azoteas inalcanzables sin colisión (depósitos, chimeneas, antenas): ' + JSON.stringify(A.roofBy));
  console.log('\nCOBERTURAS FALSAS — PUEBLO 3.0 (?pueblo=3)');
  const B = await audit(page, srv.url + '?vm=1&pueblo=3', true);
  check('a la altura del cuerpo: todo lo que se ve para las balas', B.body === 0, B.body + ' vértices de ' + B.verts + ' en ' + B.meshes + ' mallas' + (B.ex.length ? ': ' + B.ex.join(' | ') : ''));
  check('sobre la calle: nada suelto lejos de un muro', B.over === 0, B.over + '');
  check('E10 Casa Oliva (GLB): carga y se coloca en ?pueblo=3', B.e10.ready && !B.e10.failed, JSON.stringify(B.e10));
  check('E10: se comprueban sus tres LOD (no solo el visible)', ['0', '1', '2'].every(k => B.e10.lods[k] > 0), JSON.stringify(B.e10.lods));
  const p3roof = Object.keys(B.roofBy).filter(k => /^p3_|^kit_|^e10_/.test(k)).reduce((s, k) => s + B.roofBy[k], 0);
  check('azoteas de la vertical slice: nada por encima de la caja (+5 cm)', p3roof === 0, p3roof + ' vértices nuevos ' + JSON.stringify(Object.fromEntries(Object.entries(B.roofBy).filter(([k]) => /^p3_|^kit_|^e10_/.test(k)))) + ' ' + B.rx.join(' | ') + '; el resto (' + (B.roof - p3roof) + ') es PUEBLO 2.0 fuera de la slice');
  const C = await audit(page, srv.url + '?vm=1&pueblo=3', true, true);
  check('el detector encuentra una caja falsa puesta a propósito en la plaza', C.body > B.body && C.ex.some(e => e.startsWith('canary')), (C.body - B.body) + ' vértices de la caja');
  check('sin errores en la página', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
