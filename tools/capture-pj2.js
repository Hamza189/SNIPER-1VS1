/* Capturas y medidas del personaje 3D (?pj=2) en el juego real, frente al soldado de cajas (sin bandera):
   tres bots colocados a 7, 14 y 30 m delante de la cámara (apuntando, andando, agachado) en el mapa elegido,
   la misma cámara con y sin ?pj=2. Mide llamadas de dibujo, triángulos y ms de CPU de la animación de los 3 bots.
   SwiftShader: sirve para comparar aspecto y contar llamadas/triángulos, no para FPS de GPU.

   node tools/capture-pj2.js [salida=docs/next-level/pj2] [mapas=pueblo,casaxl] [calidad=alto]           */
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const out = path.resolve(process.argv[2] || 'docs/next-level/pj2');
const maps = (process.argv[3] || 'pueblo,casaxl').split(',');
const Q = process.argv[4] || 'alto';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const report = {};
  try {
    for (const map of maps) { let fixedCam = null; for (const pj of [true, false]) {
      const ctx = await b.newContext({ viewport: { width: 1100, height: 620 } });
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 3 })); } catch (e) {} }, Q);
      const p = await ctx.newPage(), errs = [], bad = [];
      p.on('pageerror', e => errs.push(e.message));
      p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
      const url = srv.url + '?vm=1' + (map === 'pueblo' ? '&pueblo=3' : '') + (pj ? '&pj=2' : '');
      await p.goto(url);
      await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
      if (map === 'pueblo') await p.waitForFunction(() => __SD.P3W && __SD.P3W.kit, null, { timeout: 180000 });
      await p.evaluate(m => { __SD.setMode('duel'); __SD.setOffMap(m); __SD.startMatch(); }, map);
      await p.waitForTimeout(2500);
      if (pj) await p.waitForFunction(() => __SD.PJ2.tpl || __SD.PJ2.failed, null, { timeout: 120000 });
      if (map === 'casaxl') await p.waitForFunction(() => __SD.XL && (__SD.XL.ready || __SD.XL.failed), null, { timeout: 180000 }).catch(() => {});
      const r = await p.evaluate(async fixedCam => {
        const S = __SD, cam = S.camera, bots = S.BOTS;
        S.pause();
        for (const e of document.body.children) if (!e.contains(S.renderer.domElement)) e.style.visibility = 'hidden';
        // la cámara a la altura de los ojos, hacia donde hay más espacio libre (rayos contra el mapa); los bots delante
        const P0 = S.P.pos, V = S.camera.position.constructor, rc = new THREE.Raycaster();
        let best = 0, bestYaw = 0;
        for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, d = new V(-Math.sin(a), 0, -Math.cos(a)); let free = 1e9;
          for (const h of [0.3, 1.0, 1.6]) { rc.set(new V(P0.x, P0.y + h, P0.z), d); rc.far = 45; const hit = rc.intersectObjects(S.W.ray, true)[0]; free = Math.min(free, hit ? hit.distance : 45); }
          if (free > best) { best = free; bestYaw = a; } }
        if (fixedCam) { P0.x = fixedCam.x; P0.y = fixedCam.y; P0.z = fixedCam.z; bestYaw = fixedCam.yaw; best = fixedCam.free; }
        cam.position.set(P0.x, P0.y + 1.62, P0.z); cam.rotation.set(-0.04, bestYaw, 0, 'YXZ'); cam.updateMatrixWorld();
        const fwd = new S.camera.position.constructor(0, 0, -1).applyQuaternion(cam.quaternion); fwd.y = 0; fwd.normalize();
        const right = new S.camera.position.constructor(-fwd.z, 0, fwd.x);
        const lim = Math.max(10, best - 2), spots = [[Math.min(7, lim * 0.3), -1.2, 'aim'], [Math.min(14, lim * 0.6), 1.4, 'walk'], [Math.min(30, lim * 0.95), -0.4, 'crouch']];
        while (bots.length < 3) bots.push(new bots[0].constructor(bots.length));
        const used = bots.slice(0, 3);
        used.forEach((bt, i) => { const [d, s, kind] = spots[i];
          bt.alive = true; bt.g.visible = true; bt.state = 'watch';
          bt.g.position.set(P0.x + fwd.x * d + right.x * s, P0.y, P0.z + fwd.z * d + right.z * s);
          bt.g.rotation.set(0, Math.atan2(-fwd.x, -fwd.z) + (kind === 'walk' ? 1.2 : 0.35), 0);
          bt.kind = kind; });
        for (const bt of bots.slice(3)) bt.g.visible = false;
        const st = kind => kind === 'aim' ? { vx: 0, vz: 0, pitch: 0, wpn: 'rifle', aim: 1 } : kind === 'walk' ? { vx: 0, vz: 3.4, pitch: 0, wpn: 'rifle', aim: 0 } :
          { vx: 0, vz: 0, pitch: 0, wpn: 'rifle', aim: 1, crouch: 1 };
        // ms de CPU de la animación (los 3 bots, 300 fotogramas)
        for (let k = 0; k < 30; k++) for (const bt of used) S.animateSoldier(bt.rig, st(bt.kind), 1 / 60);
        const t0 = performance.now();
        for (let k = 0; k < 300; k++) for (const bt of used) { S.animateSoldier(bt.rig, st(bt.kind), 1 / 60); bt.g.updateMatrixWorld(true); }
        const animMs = (performance.now() - t0) / 300;
        for (const bt of used) S.animateSoldier(bt.rig, st(bt.kind), 0.17);
        // llamadas y triángulos: con los bots y sin ellos (la diferencia es lo que cuestan)
        const R = S.renderer, info = () => { R.info.reset(); R.render(S.scene, cam); return { calls: R.info.render.calls, tris: R.info.render.triangles }; };
        R.info.autoReset = false;
        const withB = info();
        for (const bt of used) bt.g.visible = false;
        const without = info();
        for (const bt of used) bt.g.visible = true;
        R.info.autoReset = true;
        R.render(S.scene, cam);
        const lods = used.map(bt => bt.rig.v2 ? bt.rig.v2.lod : -1);
        return { cam: { x: P0.x, y: P0.y, z: P0.z, yaw: bestYaw, free: best }, world: S.WORLD_ID, free: +best.toFixed(1), bots: used.length, animMs, calls: withB.calls - without.calls, tris: withB.tris - without.tris, total: withB, lods, v2: used.map(bt => !!bt.rig.v2) };
      }, fixedCam);
      fixedCam = r.cam;
      const name = map + (pj ? '_pj2' : '_antes');
      await p.locator('canvas').first().screenshot({ path: path.join(out, name + '.png') });
      // primer plano del bot que apunta
      await p.evaluate(() => { const S = __SD, bt = S.BOTS[0], cam = S.camera, q = bt.g.position;
        const c0 = cam.position.clone(), dx = c0.x - q.x, dz = c0.z - q.z, L = Math.hypot(dx, dz) || 1;
        cam.position.set(q.x + dx / L * 3.0, q.y + 1.45, q.z + dz / L * 3.0); cam.lookAt(q.x, q.y + 0.95, q.z);
        S.renderer.render(S.scene, cam); });
      await p.locator('canvas').first().screenshot({ path: path.join(out, name + '_cerca.png') });
      report[name] = Object.assign(r, { errors: errs.slice(0, 5), http: bad.slice(0, 5) });
      console.log(name, JSON.stringify(report[name]));
      await ctx.close();
    } }
  } finally { await b.close(); srv.close(); }
  fs.writeFileSync(path.join(out, 'medidas.json'), JSON.stringify(report, null, 1));
})().catch(e => { console.error(e); process.exitCode = 1; });
