/* Retratos de los personajes para elegir personaje (?pj=pro / ?pj=mix): los dibuja el propio juego (mismo motor, mismos
   materiales, texturas 4K) en una escena aparte con luz de estudio y los guarda en assets/personaje/retratos/<id>.jpg
   (480×600). Repetir cuando cambie un personaje.
   Run: node tools/skin-portraits.js   (WebGL por software: tarda un poco) */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = path.join(__dirname, '..', 'assets', 'personaje', 'retratos');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 480, height: 600 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.goto(srv.url + '?vm=1&pj=mix');
  await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 120000 });
  for (const k of ['op2', 'op3', 'op4']) await p.evaluate(r => __SD.pj2Load(r), 'assets/personaje/pro/' + k + '/');
  await p.waitForFunction(() => ['op2', 'op3', 'op4'].every(k => __SD.PJ2.tpls['assets/personaje/pro/' + k + '/']), null, { timeout: 240000 });
  await p.waitForTimeout(500);
  for (const id of Object.keys(await p.evaluate(() => __SD.SKINS))) {
    const url = await p.evaluate(id => {
      const S = __SD, T = THREE, r = S.renderer, cam = S.camera;
      const sc = new T.Scene();
      sc.background = new T.Color(0x16130f);
      sc.environment = S.scene.environment || null;
      sc.add(new T.HemisphereLight(0xfff0dc, 0x2a241c, 0.85));
      const key = new T.DirectionalLight(0xfff4e6, 2.1); key.position.set(2.2, 3.2, 3.4); sc.add(key);
      const rim = new T.DirectionalLight(0xffa860, 1.5); rim.position.set(-3, 2.4, -2.6); sc.add(rim);
      const floor = new T.Mesh(new T.CircleGeometry(1.1, 48), new T.MeshStandardMaterial({ color: 0x0e0c0a, roughness: 1 })); floor.rotation.x = -Math.PI / 2; sc.add(floor);
      const R = S.makeSoldier(S.BOT_MAT, { variant: 'B' }); S.pj2SetPack(R, S.SKINS[id].pack);
      const g = new T.Group(); g.add(R.root); g.rotation.y = -0.22; sc.add(g);
      // the soldier's LOD follows the game camera: put it close for LOD0
      cam.position.set(0, 1.5, 3); cam.updateMatrixWorld();
      for (let i = 0; i < 40; i++) S.animateSoldier(R, { wpn: 'rifle', vx: 0, vz: 0, pitch: 0, aim: 0 }, 1 / 30);
      const pc = new T.PerspectiveCamera(30, 480 / 600, 0.1, 50);
      pc.position.set(0.35, 1.42, 3.2); pc.lookAt(-0.12, 1.2, 0);
      r.setPixelRatio(2); r.setSize(480, 600, false); r.setRenderTarget(null); r.setViewport(0, 0, 480, 600); r.setScissorTest(false);
      r.render(sc, pc);
      const c = document.createElement('canvas'); c.width = 480; c.height = 600;
      const x = c.getContext('2d'); x.drawImage(r.domElement, 0, 0, 480, 600);
      const v = x.createRadialGradient(240, 250, 160, 240, 300, 420); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = v; x.fillRect(0, 0, 480, 600);
      x.fillStyle = '#ff8a2b'; x.fillRect(0, 594, 480, 6);
      return c.toDataURL('image/jpeg', 0.86);
    }, id);
    const f = path.join(OUT, id + '.jpg');
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
    console.log(id + ': ' + path.relative(path.join(__dirname, '..'), f) + ' (' + Math.round(fs.statSync(f).size / 1024) + ' KB)');
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
