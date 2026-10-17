/* Shadow stability: the sun's shadow box follows the camera in whole shadow-map texels, so walking does not make
   shadow edges crawl (distant walls showed moving stripes, worse in the 8× scope). Measured: pixels that change a lot
   between two renders whose camera moved 3–15 cm straight ahead (the scene itself barely changes).
   Run: node test/shadow.browser.test.js   (software WebGL is fine: nothing is timed) */
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
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(srv.url + '?vm=1&pueblo=3');
  await p.waitForFunction(() => window.__SD && __SD.P3W && __SD.P3W.kit, null, { timeout: 120000 }); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const S = __SD, T = THREE, R = S.renderer; S.setWorld('pueblo'); S.MANUAL.on = true;
    for (const b of S.RANGE_BOTS.concat(S.BOTS)) b.g.visible = false;
    const W = 480, H = 270, rt = new T.WebGLRenderTarget(W, H), buf = [new Uint8Array(W * H * 4), new Uint8Array(W * H * 4)], cam = new T.PerspectiveCamera(75, W / H, 0.05, 600);
    const views = [[-8, -8, -2.356, -0.06, 1], [0, 0, 0.0, 0.02, 8]], out = {};
    for (const snap of [false, true]) { S.setSunSnap(snap); let tot = 0, n = 0;
      for (const [x, z, yaw, pitch, zoom] of views) for (let k = 0; k < 3; k++) {
        for (let j = 0; j < 2; j++) { cam.fov = 75 / zoom; cam.updateProjectionMatrix(); cam.position.set(x, 1.62, z); cam.rotation.set(pitch, yaw, 0, 'YXZ');
          cam.position.addScaledVector(new T.Vector3(0, 0, -1).applyEuler(cam.rotation), (k * 2 + j) * 0.031); cam.updateMatrixWorld(true);
          S.sunFollow(cam.position); S.scene.updateMatrixWorld(true); R.setRenderTarget(rt); R.render(S.scene, cam); R.readRenderTargetPixels(rt, 0, 0, W, H, buf[j]); }
        let big = 0; for (let i = 0; i < buf[0].length; i += 4) if (Math.abs(buf[0][i] - buf[1][i]) + Math.abs(buf[0][i + 1] - buf[1][i + 1]) + Math.abs(buf[0][i + 2] - buf[1][i + 2]) > 60) big++;
        tot += big / (W * H); n++; }
      out[snap ? 'snap' : 'free'] = tot / n * 100; }
    S.setSunSnap(true); R.setRenderTarget(null); return out; });
  check('caminar no hace bailar las sombras: el parpadeo baja al menos a la mitad con la sombra por texeles', r.snap < r.free / 2, 'antes ' + r.free.toFixed(2) + ' % → ahora ' + r.snap.toFixed(2) + ' % de píxeles');
  check('parpadeo restante pequeño (< 1 % de la imagen)', r.snap < 1, r.snap.toFixed(2) + ' %');
  const f = await p.evaluate(() => { const S = __SD, sh = S.P3W.ctx.shadows; let px = null;
    S.scene.traverse(o => { if (o.name === 'shadow_proxies') px = o; });
    // the proxies are 0.3 m inside the collision boxes: no vertex of theirs may sit on a box face
    let onFace = 0; if (px) { const P = px.geometry.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      for (const c of S.W.colliders) if ((Math.abs(x - c.minX) < 0.02 || Math.abs(x - c.maxX) < 0.02) && (Math.abs(z - c.minZ) < 0.02 || Math.abs(z - c.maxZ) < 0.02)) { onFace++; break; } } }
    return { fade: S.SHADOW_FADE && /sdF/.test(THREE.ShaderChunk.lights_fragment_begin), nb: S.sun.shadow.normalBias, map: S.sun.shadow.mapSize.x,
      doorCast: ['door_arch', 'door_panel'].filter(k => sh(k, 'wood') || sh(k, 'stone')).length, balcony: sh('balcony', 'stucco'), proxy: !!px, onFace }; });
  check('fundido de sombra en el shader del sol (pared rozada por el sol y lejos de 40 a 58 m)', f.fade);
  check('desplazamiento normal según el texel de sombra (ALTO 2048 → 3,6 cm)', Math.abs(f.nb - 0.6 * 124 / f.map) < 1e-6 && f.nb > 0.03, f.nb.toFixed(4) + ' m con ' + f.map);
  check('marcos y hojas de puerta ya no proyectan sombra (manchas a rayas en la pared); los balcones sí', f.doorCast === 0 && f.balcony);
  check('las cajas de sombra de los edificios quedan dentro de la pared (ninguna esquina coincide con la de su caja de colisión)', f.proxy && f.onFace === 0, f.onFace + ' esquinas coincidentes');
  check('sin errores en la página', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
