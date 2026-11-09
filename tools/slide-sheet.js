/* Hoja del DESLIZAMIENTO (09-11-2026, client/soldier2.js slidePose): los cuatro operadores (SOLDADO v2, S.W.A.T. op2,
   FSB op3, MILITAR op4) deslizándose, el de antes (el clip que encoge) y el nuevo, de lado, de frente y de espaldas,
   y corriendo con el arma vistos por detrás. Las cajas de impacto del deslizamiento en verde (core/hitbox.js; la de
   antes, aplastada, y la nueva SLIDE si existe).
   node tools/slide-sheet.js SALIDA.png      env GPU=0: WebGL por software */
'use strict';
const fs = require('fs');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || 'slide-sheet.png', GPU = process.env.GPU !== '0';
const ARGS = GPU ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const srv = await ss.start(), b = await chromium.launch({ args: ARGS });
  const ctx = await b.newContext({ viewport: { width: 800, height: 600 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.goto(srv.url + '?vm=1&pj=mix');
  await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 180000 });
  const PACKS = ['v2', 'op2', 'op3', 'op4'];
  for (const k of PACKS) {
    const root = k === 'v2' ? 'assets/personaje/' : 'assets/personaje/pro/' + k + '/';
    await p.evaluate(r => __SD.pj2Load(r), root);
    await p.waitForFunction(r => __SD.PJ2.tpls[r], root, { timeout: 300000 });
  }
  const png = await p.evaluate(PACKS => {
    const S = __SD, T = THREE, r = S.renderer, FW = 220, FH = 260, LW = 110;
    const views = [
      { n: 'antes · lado', slide2: false, cam: [-3.2, 0.7, 0.2], look: 0.45 },
      { n: 'nuevo · lado', slide2: true, cam: [-3.2, 0.7, 0.2], look: 0.45 },
      { n: 'nuevo · frente', slide2: true, cam: [0.6, 0.8, 3.2], look: 0.45 },
      { n: 'nuevo · espalda', slide2: true, cam: [-1.2, 1.2, -3.0], look: 0.5 },
      { n: 'correr · espalda', run: true, cam: [-0.5, 1.7, -2.6], look: 1.1 }
    ];
    const sc = new T.Scene(); sc.background = new T.Color(0x2a2620);
    sc.add(new T.HemisphereLight(0xfff0dc, 0x2a241c, 0.9));
    const key = new T.DirectionalLight(0xffffff, 1.8); key.position.set(3, 4, 2); sc.add(key);
    sc.add(new T.GridHelper(20, 40, 0x6a5a44, 0x4a4034));
    const pc = new T.PerspectiveCamera(32, FW / FH, 0.05, 60);
    r.setPixelRatio(1); r.setSize(FW, FH, false); r.setRenderTarget(null); r.setViewport(0, 0, FW, FH); r.setScissorTest(false);
    const sheet = document.createElement('canvas'); sheet.width = LW + FW * views.length; sheet.height = FH * PACKS.length + 24;
    const x = sheet.getContext('2d'); x.fillStyle = '#16130f'; x.fillRect(0, 0, sheet.width, sheet.height);
    x.fillStyle = '#e9d3ae'; x.font = '13px monospace'; views.forEach((v, i) => x.fillText(v.n, LW + i * FW + 6, 16));
    // the hit boxes of a slide (core/hitbox.js): the squashed standing ones, and SLIDE when it exists
    const boxes = (parts, k, col) => { const g = new T.Group(); for (const P of parts) {
      const geo = P.type === 'sphere' ? new T.SphereGeometry(P.r, 12, 8) : new T.BoxGeometry(2 * P.hx, 2 * P.hy * k, 2 * P.hz);
      const m = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineBasicMaterial({ color: col })); m.position.set(0, P.y * k, P.z || 0); g.add(m); } return g; };
    const H = SDHitbox, kOld = H.scaleOf(0.85);
    PACKS.forEach((pack, pi) => {
      x.fillStyle = '#e9d3ae'; x.fillText({ v2: 'SOLDADO', op2: 'S.W.A.T.', op3: 'FSB', op4: 'MILITAR' }[pack], 6, 24 + pi * FH + 20);
      views.forEach((v, vi) => {
        const R = S.makeSoldier(S.BOT_MAT, { variant: 'B' }); S.pj2SetPack(R, pack);
        const g = new T.Group(); g.add(R.root); sc.add(g);
        // the body faces +z in the game's frame: the hit boxes are drawn in the same frame
        const hb = v.run ? null : (v.slide2 && H.SLIDE ? boxes(H.SLIDE, 1, 0x58e08a) : boxes(H.PARTS, kOld, 0x58e08a));
        if (hb) g.add(hb);
        for (let t = 0; t < 0.9; t += 1 / 60) S.animateSoldier(R, v.run ? { wpn: 'rifle', vz: 7, sprint: true, aim: 0 } : { wpn: 'rifle', slide: 1, slide2: v.slide2, aim: 0, vz: 6 }, 1 / 60);
        g.updateMatrixWorld(true);
        pc.position.set(v.cam[0], v.cam[1], v.cam[2]); pc.lookAt(0, v.look, 0.1);
        r.render(sc, pc); x.drawImage(r.domElement, LW + vi * FW, 24 + pi * FH, FW, FH);
        sc.remove(g);
      });
    });
    return sheet.toDataURL('image/png');
  }, PACKS);
  fs.writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
  console.log('hoja: ' + OUT);
  await b.close(); srv.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
