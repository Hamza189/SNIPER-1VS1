/* Hoja de las MIRAS en cada rifle (31-10-2026, docs/MIRAS.md): filas = HALCÓN R7, TITÁN, ÚLTIMA, VECTOR y SAHARA;
   columnas = las 7 miras. Cada casilla la dibuja el propio juego: su mira de siempre quitada con las mismas reglas
   (SDMiras.RIFLES: materiales o triángulos por encima del riel) y la mira nueva donde la pone SDMiras.placement.
   node tools/miras/hoja.js [salida.jpg]      (por defecto docs/img/miras-rifles.jpg)   env PAGE=otra.html */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const ROOT = path.join(__dirname, '..', '..');
const OUT = process.argv[2] || path.join(ROOT, 'docs', 'img', 'miras-rifles.jpg');
const CW = 300, CH = 131;

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: CW, height: CH } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.goto(srv.url + (process.env.PAGE || '') + '?vm=1');
  await p.waitForFunction(() => window.__SD && __SD.WORLDS && window.SDMiras, null, { timeout: 120000 });
  const url = await p.evaluate(async ([CW, CH]) => {
    const S = __SD, T = THREE, r = S.renderer, M = SDMiras;
    const load = u => new Promise((ok, ko) => new T.GLTFLoader().load(u, ok, undefined, ko));
    const vm = await load('assets/viewmodels.glb'); if (window.SDVM) SDVM.refine(vm.scene, T, S.ENV, { low: false });
    const rifles = [['halcon', null], ['titan', 'titan'], ['ultima', 'ratio'], ['vector', 'vector'], ['sahara', 'lince']];
    const sheet = document.createElement('canvas'); sheet.width = CW * M.ORDER.length; sheet.height = CH * rifles.length + 22;
    const x = sheet.getContext('2d'); x.fillStyle = '#14120f'; x.fillRect(0, 0, sheet.width, sheet.height);
    x.font = '600 13px monospace'; x.fillStyle = '#ff8a2b';
    M.ORDER.forEach((id, i) => x.fillText(M.get(id).name + ' ' + M.get(id).short, i * CW + 8, 15));
    for (let ri = 0; ri < rifles.length; ri++) {
      const [name, dir] = rifles[ri], key = dir || 'halcon';
      for (let oi = 0; oi < M.ORDER.length; oi++) {
        const id = M.ORDER[oi];
        // a fresh copy of the rifle each time (its scope is cut out of it)
        let rifle;
        if (!dir) { rifle = vm.scene.getObjectByName('HALCON').clone(true); rifle.position.set(0, 0, 0); rifle.rotation.set(0, 0, 0); }
        else { rifle = (await load('assets/armas/' + dir + '/arma.glb')).scene; rifle.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.material.envMap = S.ENV; o.material.envMapIntensity = 0.55; } }); }
        const sc = new T.Scene(); sc.background = new T.Color(0x1c1915);
        sc.add(new T.HemisphereLight(0xfff0dc, 0x2a241c, 1.0));
        const key1 = new T.DirectionalLight(0xffffff, 2.0); key1.position.set(2, 3, 1); sc.add(key1);
        const rim = new T.DirectionalLight(0xffb070, 1.0); rim.position.set(-2, 1, -3); sc.add(rim);
        const gun = new T.Group(); sc.add(gun); gun.add(rifle); gun.updateMatrixWorld(true);
        if (!M.get(id).builtin) {
          const st = M.RIFLES[key].strip, inv = new T.Matrix4().copy(gun.matrixWorld).invert(), m4 = new T.Matrix4();
          const body = dir ? rifle.getObjectByName('cuerpo') : rifle;
          body.traverse(o => { if (!o.isMesh) return;
            if (!dir && !/^r_body/.test(o.name) && !(o.parent && /^r_body/.test(o.parent.name))) return;
            const mn = (o.material && o.material.name) || '';
            if (st.mats && st.mats.some(m => mn.startsWith(m))) { o.visible = false; return; }
            if (st.box) { m4.multiplyMatrices(inv, o.matrixWorld); const ng = S.miraClipGeo(o.geometry, m4, st.box); if (ng) o.geometry = ng; } });
          const P = M.placement(key, id), opt = M.build(T, id, S.ENV); opt.position.set(0, P.y, P.z); opt.rotation.x = P.tilt; gun.add(opt);
        }
        sc.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (!m || m.userData.cs) continue; m.userData.cs = 1;
          for (const k of ['color', 'emissive']) if (m[k] && m[k].isColor) m[k].convertSRGBToLinear(); m.needsUpdate = true; } });
        r.toneMapping = T.ACESFilmicToneMapping;
        const c = new T.Vector3(0, 0.05, 0.0), pc = new T.PerspectiveCamera(26, CW / CH, 0.01, 20);
        pc.position.set(c.x + 0.66, c.y + 0.14, c.z + 0.22); pc.lookAt(c);
        r.setPixelRatio(1); r.setSize(CW, CH, false); r.setRenderTarget(null); r.setViewport(0, 0, CW, CH); r.setScissorTest(false);
        r.render(sc, pc);
        x.drawImage(r.domElement, oi * CW, 22 + ri * CH, CW, CH);
        if (oi === 0) { x.fillStyle = '#ffd25e'; x.fillText(name.toUpperCase(), 6, 22 + ri * CH + 16); }
      }
    }
    return sheet.toDataURL('image/jpeg', 0.86);
  }, [CW, CH]);
  fs.writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
  console.log('hoja: ' + path.relative(ROOT, OUT) + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
