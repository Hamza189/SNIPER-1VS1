/* Vuelta completa a un personaje 3D (?pj=pro): 8 ángulos de cuerpo entero y 8 de la cabeza de cerca, con el mismo motor
   y materiales del juego, para buscar agujeros, caras que se ven del revés, transparencias y ojos. Comparar antes/después.
   Run: node tools/skin-turntable.js [op2|op3|op4] [salida.png]   (WebGL por software) */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const pack = process.argv[2] || 'op3';
const out = process.argv[3] || path.join(require('os').tmpdir(), 'vuelta-' + pack + '.png');

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 480 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.goto(srv.url + '?vm=1&pj=mix');
  await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 120000 });
  const root = 'assets/personaje/pro/' + pack + '/';
  await p.evaluate(r => __SD.pj2Load(r), root);
  await p.waitForFunction(r => __SD.PJ2.tpls[r], root, { timeout: 240000 });
  await p.waitForTimeout(400);
  const png = await p.evaluate(pack => {
    const S = __SD, T = THREE, r = S.renderer, cam = S.camera, FW = 220, FH = 300, HW = 220, HH = 220, N = 8;
    const sheet = document.createElement('canvas'); sheet.width = FW * N; sheet.height = FH + HH;
    const x = sheet.getContext('2d');
    const sc = new T.Scene(); sc.background = new T.Color(0x8fa3b8);   // cielo claro: lo transparente se ve
    sc.environment = S.scene.environment || null;
    sc.add(new T.HemisphereLight(0xfff0dc, 0x5a4a38, 0.9));
    const key = new T.DirectionalLight(0xfff4e6, 1.8); key.position.set(2.5, 4, 3); sc.add(key);
    const R = S.makeSoldier(S.BOT_MAT, { variant: 'B' }); S.pj2SetPack(R, pack);
    const g = new T.Group(); g.add(R.root); sc.add(g);
    cam.position.set(0, 1.5, 2); cam.updateMatrixWorld();
    for (let i = 0; i < 30; i++) S.animateSoldier(R, { wpn: 'rifle', vx: 0, vz: 0, pitch: 0, aim: 1 }, 1 / 30);
    r.setPixelRatio(1); r.setRenderTarget(null); r.setScissorTest(false);
    const shot = (w, h, pos, look, fov) => { const pc = new T.PerspectiveCamera(fov, w / h, 0.05, 50); pc.position.copy(pos); pc.lookAt(look); r.setSize(w, h, false); r.setViewport(0, 0, w, h); r.render(sc, pc); };
    for (let k = 0; k < N; k++) {
      const a = k / N * Math.PI * 2, d = new T.Vector3(Math.sin(a), 0, Math.cos(a));
      shot(FW, FH, d.clone().multiplyScalar(3.4).setY(1.0), new T.Vector3(0, 0.9, 0), 34); x.drawImage(r.domElement, k * FW, 0, FW, FH);
      shot(HW, HH, d.clone().multiplyScalar(0.75).setY(1.66), new T.Vector3(0, 1.62, 0), 34); x.drawImage(r.domElement, k * HW, FH, HW, HH);
      x.fillStyle = '#000'; x.font = '13px monospace'; x.fillText(Math.round(a * 180 / Math.PI) + '°', k * FW + 6, 16);
    }
    return sheet.toDataURL('image/png');
  }, pack);
  fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
  console.log('vuelta: ' + out);
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
