/* depuración del horneado: qué malla, cara, normal y uv2 hay en unos píxeles de una vista fija (la de capture-scenes).
   node tools/lightmap/pixel.js x,y,z,yaw,pitch px,py [px,py …]       (vista de 1170×540, como capture-scenes) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../static-server.js');
(async () => {
  const [x, y, z, yaw, pitch] = process.argv[2].split(',').map(Number), pts = process.argv.slice(3).map(s => s.split(',').map(Number));
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1170, height: 540 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 2 })); });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=1&lm=1');
  await p.waitForFunction(() => window.__SD && __SD.P3W && __SD.P3W.kit && __SD.LM.ready, null, { timeout: 180000 });
  await p.evaluate(() => { __SD.setTrain('off'); __SD.setMode('duel'); __SD.startMatch(); });
  await p.waitForTimeout(1500);
  const res = await p.evaluate(([x, y, z, yaw, pitch, pts]) => {
    const S = __SD, T = window.THREE; S.setWorld('pueblo'); S.freeze(true); S.MANUAL.on = true;
    Object.assign(S.PM, { x, y, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y, z }); S.P.yaw = yaw; S.P.pitch = pitch;
    S.advance(16); S.advance(16);
    const cam = S.camera, rc = new T.Raycaster(), out = [], cv = S.renderer.domElement, W = cv.clientWidth, H = cv.clientHeight;
    const objs = []; S.scene.traverse(o => { if (o.isMesh && o.visible && o.material && o.material.visible !== false) objs.push(o); });
    for (const [px, py] of pts) {
      rc.setFromCamera({ x: px / W * 2 - 1, y: -(py / H) * 2 + 1 }, cam);
      const h = rc.intersectObjects(objs, false).slice(0, 3);
      out.push([px, py, h.map(q => { const g = q.object.geometry, u2 = g.attributes.uv2, f = q.face; let uv2 = null;
        if (u2 && f) { const bc = new T.Vector3(); T.Triangle.getBarycoord(q.point, ...[f.a, f.b, f.c].map(i => new T.Vector3().fromBufferAttribute(g.attributes.position, i).applyMatrix4(q.object.matrixWorld)), bc);
          uv2 = [0, 1].map(k => bc.x * u2.array[f.a * 2 + k] + bc.y * u2.array[f.b * 2 + k] + bc.z * u2.array[f.c * 2 + k]).map(v => +(v * 2048).toFixed(2)); }
        return { m: q.object.name, d: +q.distance.toFixed(3), p: q.point.toArray().map(v => +v.toFixed(3)), n: f && f.normal.toArray().map(v => +v.toFixed(2)), uv2 }; })]);
    }
    return out;
  }, [x, y, z, yaw, pitch, pts]);
  for (const r of res) console.log(JSON.stringify(r));
  await b.close(); srv.close(); process.exit(0);
})();
