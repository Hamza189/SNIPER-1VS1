/* Medir cómo camina un personaje 3D (?pj=pro): hoja de fotogramas de un ciclo visto de lado y de frente, y cuánto patina
   el pie apoyado (m/s respecto al suelo: 0 = pie clavado), cuánto sube y baja la cadera y los pasos por minuto, a las
   velocidades reales del juego (core/config.js): 4,6 de frente, 3,9 hacia atrás, 4,6 de lado, 2,3 apuntando con la mira
   y 2,76 (bots fáciles).
   Run: node tools/gait-sheet.js [op2|op3|op4] [salida.png]   (WebGL por software: sirve para ver y medir, no para FPS) */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const pack = process.argv[2] || 'op2';
const out = process.argv[3] || path.join(require('os').tmpdir(), 'gait-' + pack + '.png');
const CASES = [
  ['de frente 4,6', 0, 4.6], ['apuntando 2,3', 0, 2.3], ['bot fácil 2,76', 0, 2.76], ['diagonal atrás 4,6', 3.25, -3.25], ['agachado lateral 2,4', 2.4, 0, 1],
  ['atrás 3,9', 0, -3.91], ['lateral 4,6', 4.6, 0], ['diagonal 4,6', 3.25, 3.25]];

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 480 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); } catch (e) {} });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.goto(srv.url + '?vm=1&pj=mix');
  await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 120000 });
  const root = 'assets/personaje/pro/' + pack + '/';
  await p.evaluate(r => __SD.pj2Load(r), root);
  await p.waitForFunction(r => __SD.PJ2.tpls[r], root, { timeout: 240000 });
  const res = await p.evaluate(([CASES, pack]) => {
    const S = __SD, T = THREE, r = S.renderer, cam = S.camera;
    const FW = 150, FH = 210, NF = 8, LW = 190;
    const sheet = document.createElement('canvas'); sheet.width = FW * NF + LW; sheet.height = FH * CASES.length * 2;
    const x = sheet.getContext('2d'); x.fillStyle = '#16130f'; x.fillRect(0, 0, sheet.width, sheet.height);
    const sc = new T.Scene(); sc.background = new T.Color(0x2a2620);
    sc.add(new T.HemisphereLight(0xfff0dc, 0x2a241c, 0.9));
    const key = new T.DirectionalLight(0xffffff, 1.8); key.position.set(3, 4, 2); sc.add(key);
    sc.add(new T.GridHelper(200, 400, 0x6a5a44, 0x4a4034));
    const R = S.makeSoldier(S.BOT_MAT, { variant: 'B' }); S.pj2SetPack(R, pack);
    const g = new T.Group(); g.add(R.root); sc.add(g);
    const I = R.v2, bone = n => I.root.getObjectByName(n);
    const pc = new T.PerspectiveCamera(30, FW / FH, 0.1, 60);
    r.setPixelRatio(1); r.setSize(FW, FH, false); r.setRenderTarget(null); r.setViewport(0, 0, FW, FH); r.setScissorTest(false);
    const st = (vx, vz, cr) => ({ wpn: 'rifle', vx, vz, crouch: cr || 0, pitch: 0, aim: Math.hypot(vx, vz) < 2.5 ? 1 : 0.4 });
    const dt = 1 / 120;
    const step = (vx, vz, cr) => { g.position.x += vx * dt; g.position.z += vz * dt; cam.position.set(g.position.x, 1.5, g.position.z + 3); S.animateSoldier(R, st(vx, vz, cr), dt); g.updateMatrixWorld(true); };
    const rows = [];
    CASES.forEach(([name, vx, vz, cr], ci) => {
      g.position.set(0, 0, 0);
      for (let i = 0; i < 120; i++) step(vx, vz, cr);
      // 3 s: the lowest foot (planted) should not move over the ground
      // each ankle: planted while it is within 1 cm of its lowest height (the swing foot of a low step is not counted)
      let slide = 0, n = 0, maxHip = -1e9, minHip = 1e9, cyc = 0, lastPh = I.phase, lift = 0;
      const ph0 = I.phase, tr = { LeftFoot: [], RightFoot: [] };
      for (let i = 0; i < 360; i++) {
        step(vx, vz, cr);
        for (const k in tr) tr[k].push(bone(k).getWorldPosition(new T.Vector3()));
        const hy = bone('Hips').getWorldPosition(new T.Vector3()).y; maxHip = Math.max(maxHip, hy); minHip = Math.min(minHip, hy);
        if (I.phase < lastPh) cyc++; lastPh = I.phase;
      }
      for (const k in tr) { const a = tr[k], lo = Math.min(...a.map(v => v.y)), hi = Math.max(...a.map(v => v.y)); lift = Math.max(lift, hi - lo);
        for (let i = 31; i < a.length; i++) if (a[i].y < lo + 0.01 && a[i - 1].y < lo + 0.01) { slide += Math.hypot(a[i].x - a[i - 1].x, a[i].z - a[i - 1].z) / dt; n++; } }
      const row = { name, slide: +(slide / Math.max(1, n)).toFixed(2), bob: +((maxHip - minHip) * 100).toFixed(1), lift: Math.round(lift * 100), steps: Math.round((cyc + I.phase - ph0) / 3 * 2 * 60) };
      rows.push(row);
      for (const vi of [0, 1]) {
        const y0 = (ci * 2 + vi) * FH;
        x.fillStyle = '#e9d3ae'; x.font = '15px monospace'; x.fillText(name + ' m/s', 8, y0 + 22); x.fillText(vi ? 'de frente' : 'de lado', 8, y0 + 42);
        if (!vi) { x.fillText('patina ' + row.slide + ' m/s', 8, y0 + 72); x.fillText('rebote ' + row.bob + ' cm', 8, y0 + 92); x.fillText(row.steps + ' pasos/min', 8, y0 + 112); x.fillText('pie sube ' + row.lift + ' cm', 8, y0 + 132); }
        const p0 = I.phase; let k = 0, guard = 0;
        while (k < NF && guard++ < 4000) {
          step(vx, vz, cr);
          const want = (p0 + k / NF) % 1, d = Math.abs(I.phase - want);
          if (d < 0.01 || d > 0.99) {
            const c = g.position;
            if (vi) pc.position.set(c.x, 1.0, c.z + 4.6); else pc.position.set(c.x - 4.6, 1.0, c.z);
            pc.lookAt(c.x, 0.9, c.z); r.render(sc, pc); x.drawImage(r.domElement, LW + k * FW, y0, FW, FH); k++;
          }
        }
      }
    });
    return { rows, png: sheet.toDataURL('image/png') };
  }, [CASES, pack]);
  fs.writeFileSync(out, Buffer.from(res.png.split(',')[1], 'base64'));
  for (const r of res.rows) console.log(r.name.padEnd(16) + ' patina ' + String(r.slide).padStart(5) + ' m/s · rebote ' + String(r.bob).padStart(4) + ' cm · pie sube ' + String(r.lift).padStart(2) + ' cm · ' + r.steps + ' pasos/min');
  console.log('hoja: ' + out);
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
