/* Hoja de camuflajes (cajas, core/items.js): el propio juego dibuja su rifle de 1ª persona con cada camuflaje, con el
   mismo material retocado que se ve en la partida (client/camo.js), de lado y con luz de estudio.
   Sale docs/img/camuflajes.jpg (todos sobre el HALCÓN R7) y docs/img/camuflajes-aspectos.jpg (tres sobre cada aspecto).
   Run: node tools/camo-sheet.js */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const ROOT = path.join(__dirname, '..');
const BIG = process.env.CAMO_BIG ? process.env.CAMO_BIG.split(',') : null;   // CAMO_BIG=camo_oro,camo_dragon → big shots in the scratch folder OUT
const W = BIG ? 900 : 420, H = BIG ? 394 : 184;

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 600 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.goto(srv.url + '?vm=1&pj=pro');
  await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.R, null, { timeout: 180000 });
  // one studio picture of the first-person rifle as it is now (whatever skin and camouflage it wears)
  await p.evaluate(([W, H]) => {
    window.__shot = (label, color) => {
      const S = __SD, T = THREE, r = S.renderer, hal = S.VMA.R.root;
      const obj = hal.clone(true); obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); obj.scale.set(1, 1, 1);
      obj.traverse(o => { if (o.isMesh) o.visible = o.visible !== false; });
      const sc = new T.Scene(); sc.background = new T.Color(0x1c1915); sc.environment = S.scene.environment || null;
      sc.add(new T.HemisphereLight(0xfff0dc, 0x2a241c, 1.0));
      const key = new T.DirectionalLight(0xffffff, 2.0); key.position.set(2, 3, 1); sc.add(key);
      const rim = new T.DirectionalLight(0xffb070, 1.0); rim.position.set(-2, 1, -3); sc.add(rim);
      sc.add(obj); obj.updateMatrixWorld(true);
      const bb = new T.Box3(); obj.traverse(o => { if (o.isMesh && o.visible) bb.expandByObject(o); });
      const c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3()), dist = Math.max(sz.z, sz.x) * 1.22;
      const pc = new T.PerspectiveCamera(28, W / H, 0.01, 20); pc.position.set(c.x + dist * 0.98, c.y + dist * 0.12, c.z + dist * 0.18); pc.lookAt(c);
      r.setPixelRatio(1); r.setSize(W, H, false); r.setRenderTarget(null); r.setViewport(0, 0, W, H); r.setScissorTest(false);
      r.render(sc, pc);
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
      x.drawImage(r.domElement, 0, 0, W, H);
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, H - 26, W, 26); x.fillStyle = color || '#f4ead8'; x.font = '15px monospace'; x.fillText(label, 10, H - 8);
      return cv;
    };
    window.__sheet = (cells, cols) => {
      const rows = Math.ceil(cells.length / cols), cv = document.createElement('canvas'); cv.width = cols * W; cv.height = rows * H;
      const x = cv.getContext('2d'); x.fillStyle = '#0f0d0a'; x.fillRect(0, 0, cv.width, cv.height);
      cells.forEach((c, i) => x.drawImage(c, (i % cols) * W, Math.floor(i / cols) * H));
      return cv.toDataURL('image/jpeg', 0.88);
    };
  }, [W, H]);
  const save = (name, url) => { const f = path.join(ROOT, 'docs', 'img', name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log(path.relative(ROOT, f) + ' (' + Math.round(fs.statSync(f).size / 1024) + ' KB)'); };
  if (BIG) {
    const url = await p.evaluate(async ids => { const S = __SD, cells = []; S.setWskin('rifle', 'halcon');
      for (const id of ids) { S.INV.equip = { camo: id }; S.camoApply(); S.INV.time.value = 1.3; cells.push(__shot(id)); } return __sheet(cells, 1); }, BIG);
    fs.writeFileSync(process.env.OUT, Buffer.from(url.split(',')[1], 'base64')); await b.close(); srv.close(); return;
  }
  // 1) every camouflage on the HALCÓN R7
  const url1 = await p.evaluate(async () => {
    const S = __SD, cells = [];
    S.setWskin('rifle', 'halcon');
    for (const it of [null].concat(SDItems.ITEMS.filter(x => x.type === 'camo'))) {
      S.INV.equip = it ? { camo: it.id } : {}; S.camoApply(); S.INV.time.value = 1.3;
      cells.push(__shot(it ? it.name + ' · ' + SDItems.RARITY[it.r].name : 'HALCÓN R7 · DE SERIE', it ? SDItems.RARITY[it.r].color : null));
    }
    return __sheet(cells, 3);
  });
  save('camuflajes.jpg', url1);
  // 2) three camouflages on each weapon skin (they load from assets/armas)
  const url2 = await p.evaluate(async () => {
    const S = __SD, cells = [], wait = ms => new Promise(r => setTimeout(r, ms));
    for (const sk of ['titan', 'ultima', 'vector', 'sahara']) {
      S.setWskin('rifle', sk);
      for (let i = 0; i < 200 && !(S.WS_ST.rifle.objs.length); i++) await wait(100);
      for (const id of [null, 'camo_bosque', 'camo_carbono', 'camo_dragon']) {
        S.INV.equip = id ? { camo: id } : {}; S.camoApply(); S.INV.time.value = 1.3;
        const it = id && SDItems.byId(id);
        cells.push(__shot(sk.toUpperCase() + ' · ' + (it ? it.name : 'DE SERIE'), it ? SDItems.RARITY[it.r].color : null));
      }
    }
    S.setWskin('rifle', 'halcon'); S.INV.equip = {}; S.camoApply();
    return __sheet(cells, 4);
  });
  save('camuflajes-aspectos.jpg', url2);
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
