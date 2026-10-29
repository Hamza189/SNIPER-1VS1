/* Comparación de calidad KTX2 frente a las texturas de siempre (docs/KTX2.md): el propio juego dibuja cada personaje
   en la misma pose, con la misma luz y la misma cámara, una vez con sus JPG (calidad ALTO de PC: 4K S.W.A.T./FSB) y otra
   con ?ktx2=1, de cuerpo entero y la cara/pecho de cerca (lo que se ve con la mira).
   Guarda las imágenes en la carpeta OUT (por defecto la temporal) para tools/ktx2/sheet.py, que mide la diferencia
   (PSNR) y monta la hoja docs/img/ktx2-comparacion.jpg.
     node tools/ktx2/compare.js [op2 op3 op4 soldado]      OUT=<carpeta> */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const OUT = process.env.OUT || path.join(os.tmpdir(), 'ktx2_compare');
const IDS = { op2: 'swat', op3: 'fsb', op4: 'militar', soldado: 'soldado' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const want = process.argv.slice(2).filter(a => IDS[a]); const packs = want.length ? want : Object.keys(IDS);
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const mode of ['jpg', 'ktx2']) {
    const ctx = await b.newContext({ viewport: { width: 480, height: 600 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('error de la página: ' + e.message));
    await p.goto(srv.url + '?vm=1&pj=pro' + (mode === 'ktx2' ? '&ktx2=1' : ''));
    await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 180000 });
    for (const k of packs) {
      const id = IDS[k];
      const shots = await p.evaluate(async id => {
        const S = __SD, T = THREE, r = S.renderer, cam = S.camera, pack = S.SKINS[id].pack;
        const root = pack === 'v2' ? 'assets/personaje/' : 'assets/personaje/pro/' + pack + '/';
        S.pj2Load(root);
        for (let i = 0; i < 2400 && !S.PJ2.tpls[root]; i++) await new Promise(r => setTimeout(r, 100));
        const sc = new T.Scene(); sc.background = new T.Color(0x16130f); sc.environment = S.scene.environment || null;
        sc.add(new T.HemisphereLight(0xfff0dc, 0x2a241c, 0.85));
        const key = new T.DirectionalLight(0xfff4e6, 2.1); key.position.set(2.2, 3.2, 3.4); sc.add(key);
        const rim = new T.DirectionalLight(0xffa860, 1.5); rim.position.set(-3, 2.4, -2.6); sc.add(rim);
        const R = S.makeSoldier(S.BOT_MAT, { variant: 'B' }); S.pj2SetPack(R, pack);
        const g = new T.Group(); g.add(R.root); g.rotation.y = -0.22; sc.add(g);
        cam.position.set(0, 1.5, 3); cam.updateMatrixWorld();
        for (let i = 0; i < 40; i++) S.animateSoldier(R, { wpn: 'rifle', vx: 0, vz: 0, pitch: 0, aim: 0 }, 1 / 30);
        // wait for the colour of the variant (it arrives after the model)
        const mat = () => R.v2 && R.v2.meshes[0].material;
        for (let i = 0; i < 600; i++) { const m = mat(); if (m && m.map && (m.map.isCompressedTexture || (m.map.image && /color_/.test(m.map.image.currentSrc || m.map.image.src || '')))) break; await new Promise(r => setTimeout(r, 100)); }
        await new Promise(r => setTimeout(r, 600));
        const shot = (pos, look, fov) => {
          const pc = new T.PerspectiveCamera(fov, 480 / 600, 0.05, 50); pc.position.set(pos[0], pos[1], pos[2]); pc.lookAt(look[0], look[1], look[2]);
          r.setPixelRatio(1); r.setSize(480, 600, false); r.setRenderTarget(null); r.setViewport(0, 0, 480, 600); r.setScissorTest(false);
          r.render(sc, pc);
          const c = document.createElement('canvas'); c.width = 480; c.height = 600; c.getContext('2d').drawImage(r.domElement, 0, 0, 480, 600);
          return c.toDataURL('image/png');
        };
        const out = { body: shot([0.35, 1.42, 3.2], [-0.12, 1.2, 0], 30), face: shot([0.18, 1.62, 0.95], [-0.02, 1.48, 0], 22), tex: mat() && mat().map && (mat().map.isCompressedTexture ? 'KTX2 ' + mat().map.mipmaps[0].width : 'JPG ' + (mat().map.image && mat().map.image.width)) };
        sc.remove(g);
        return out;
      }, id);
      for (const v of ['body', 'face']) fs.writeFileSync(path.join(OUT, k + '_' + v + '_' + mode + '.png'), Buffer.from(shots[v].split(',')[1], 'base64'));
      console.log(mode + ' · ' + k + ' · color ' + shots.tex);
    }
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log('imágenes en ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
