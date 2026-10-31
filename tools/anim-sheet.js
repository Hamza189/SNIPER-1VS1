/* Transiciones de animación de un personaje 3D (GF-2): cada caso (esprintar, saltar y aterrizar, morir, disparar, apuntar,
   recibir un impacto…) se reproduce a 60 FPS con las mismas entradas que dan el rival online o los bots, y se mide el
   «salto de pose»: lo que más gira un hueso en un solo fotograma (grados). Al andar normal ronda los 6–9°; un cambio de
   golpe (pesos 0/1) da 20–90°. Saca una hoja de fotogramas vista de lado y un JSON con las medidas.
   Run: node tools/anim-sheet.js [op4|op2|op3|v2] [carpeta-salida]   (WebGL por software: para ver y medir, no para FPS)
   Para medir la versión de antes: git show HEAD:index.html > _antes.html y PAGE=_antes.html node tools/anim-sheet.js … */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const pack = process.argv[2] || 'op4';
const outDir = process.argv[3] || path.join(require('os').tmpdir(), 'anim-sheet');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 480 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); } catch (e) {} });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('error de la página: ' + e.message));
  await p.goto(srv.url + (process.env.PAGE || '') + '?vm=1&pj=mix');
  await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 120000 });
  const root = pack === 'v2' ? 'assets/personaje/' : 'assets/personaje/pro/' + pack + '/';
  await p.evaluate(r => __SD.pj2Load(r), root);
  await p.waitForFunction(r => __SD.PJ2.tpls[r], root, { timeout: 240000 });
  const res = await p.evaluate(pack => {
    const S = __SD, T = THREE, r = S.renderer;
    const FW = 120, FH = 170, LW = 170, NF = 12;
    // casos: t (s) → estado (las mismas entradas que RemotePlayer.update y Bot.animate) y qué ventana se dibuja
    const W = 4.05, A = 32, D = 9;
    const C = [
      { name: 'esprint (rival)', T: 2.0, from: 0.4, to: 1.75, st: t => t < 0.5 ? { vz: W } : t < 1.3 ? { vz: Math.min(7, W + (t - 0.5) * A), sprint: true } : { vz: Math.max(W, 7 - (t - 1.3) * D) } },
      { name: 'salto (rival)', T: 1.7, from: 0.3, to: 1.45, st: t => ({ vz: W, air: t >= 0.4 && t < 0.99 }) },
      { name: 'muerte (rival)', T: 1.9, from: 0.3, to: 1.9, st: t => t < 0.4 ? { vz: W, aim: 0.5 } : { dead: Math.min(1, (t - 0.4) / 0.5), aim: 0.5, kill: t - 0.4 } },
      { name: 'disparo rifle', T: 1.4, from: 0.25, to: 1.35, st: t => ({ aim: 1, bolt: t >= 0.3 && t < 1.25 ? (t - 0.3) / 0.95 : 0, fire: t >= 0.3 ? t - 0.3 : -1 }) },
      { name: 'escopeta', T: 1.3, from: 0.25, to: 1.2, st: t => ({ wpn: 'shotgun', aim: 1, bolt: t >= 0.3 && t < 1.08 ? (t - 0.3) / 0.78 : 0, fire: t >= 0.3 ? t - 0.3 : -1 }) },
      { name: 'pistola (2 tiros)', T: 1.0, from: 0.25, to: 0.95, st: t => ({ wpn: 'pistol', aim: 1, fire: t >= 0.6 ? t - 0.6 : t >= 0.3 ? t - 0.3 : -1 }) },
      { name: 'apuntar (bot)', T: 1.6, from: 0.2, to: 1.5, st: t => ({ aim: t >= 0.3 && t < 1.0 ? 1 : 0 }) },
      { name: 'impacto (bot)', T: 1.0, from: 0.25, to: 0.95, st: (t, I) => ({ aim: 1, flinch: t >= 0.3 ? 0.7 * Math.exp(-7 * (t - 0.3)) : 0, hit: t >= 0.3 ? t - 0.3 : -1 }) },
      { name: 'parar de andar', T: 1.2, from: 0.3, to: 1.1, st: t => ({ vz: t < 0.5 ? W : Math.max(0, W - (t - 0.5) * 36) }) },
      { name: 'cambio a pistola', T: 1.0, from: 0.3, to: 0.9, st: t => ({ aim: 1, wpn: t < 0.4 ? 'rifle' : 'pistol' }) },
      { name: 'recarga escopeta', T: 1.9, from: 0.3, to: 1.85, st: t => { const r = t >= 0.3 ? t - 0.3 : -1, S = { start: 0.32, each: 0.4 };
        return { wpn: 'shotgun', aim: 0.3, reload: r < 0 ? 0 : 1 - Math.exp(-8 * r), relPh: r < S.start ? 0 : ((r - S.start) % S.each) / S.each }; } },
      { name: 'muerte por la espalda', T: 1.9, from: 0.3, to: 1.9, st: t => t < 0.4 ? { vz: W, aim: 0.5 } : { dead: Math.min(1, (t - 0.4) / 0.5), aim: 0.5, deathFront: true } },
      { name: 'impacto por un lado', T: 1.0, from: 0.25, to: 0.95, st: t => ({ aim: 1, flinch: t >= 0.3 ? 0.7 * Math.exp(-7 * (t - 0.3)) : 0, hit: t >= 0.3 ? t - 0.3 : -1, hitX: 1, hitZ: 0 }) },
      { name: 'salto largo', T: 2.0, from: 0.3, to: 1.9, st: t => ({ air: t >= 0.4 && t < 1.3 }) }
    ];
    const sc = new T.Scene(); sc.background = new T.Color(0x2a2620);
    sc.add(new T.HemisphereLight(0xfff0dc, 0x2a241c, 0.9));
    const key = new T.DirectionalLight(0xffffff, 1.8); key.position.set(3, 4, 2); sc.add(key);
    sc.add(new T.GridHelper(200, 400, 0x6a5a44, 0x4a4034));
    const pc = new T.PerspectiveCamera(30, FW / FH, 0.1, 60);
    r.setPixelRatio(1); r.setSize(FW, FH, false); r.setRenderTarget(null); r.setViewport(0, 0, FW, FH); r.setScissorTest(false);
    const sheet = document.createElement('canvas'); sheet.width = FW * NF + LW; sheet.height = FH * C.length;
    const x = sheet.getContext('2d'); x.fillStyle = '#16130f'; x.fillRect(0, 0, sheet.width, sheet.height);
    const dt = 1 / 60, q0 = new T.Quaternion(), q1 = new T.Quaternion(), out = [];
    C.forEach((c, ci) => {
      const R = S.makeSoldier(S.BOT_MAT, { variant: 'B' }); S.pj2SetPack(R, pack);
      const g = new T.Group(); g.add(R.root); sc.add(g);
      const I = R.v2, bones = []; I.root.traverse(o => { if (o.isBone) bones.push(o); });
      const prev = bones.map(() => new T.Quaternion());
      let t = 0, k = 0, peak = 0, peakAt = 0, peakBone = '', calm = 0, n = 0;
      const series = [];
      for (let i = 0; t < c.T - 1e-6; i++, t += dt) {
        const st = Object.assign({ wpn: 'rifle', pitch: 0, aim: 0 }, c.st(t, I));
        if (st.flinch != null) R.flinch = st.flinch;
        g.position.z += (st.vz || 0) * dt;
        S.animateSoldier(R, st, dt); g.updateMatrixWorld(true);
        let m = 0, mb = '';
        bones.forEach((bn, j) => { bn.getWorldQuaternion(q1); if (i > 0) { const a = 2 * Math.acos(Math.min(1, Math.abs(q1.dot(prev[j])))) * 180 / Math.PI; if (a > m) { m = a; mb = bn.name; } } prev[j].copy(q1); });
        // los primeros 0,25 s se descartan: el personaje recién creado se coloca
        if (t >= 0.25) { series.push(+m.toFixed(1)); if (m > peak) { peak = m; peakAt = t; peakBone = mb; } calm += m; n++; }
        // fotogramas de la ventana
        const want = c.from + (c.to - c.from) * k / (NF - 1);
        if (k < NF && t >= want - 1e-6) {
          pc.position.set(g.position.x - 4.2, 1.0, g.position.z + 0.6); pc.lookAt(g.position.x, 0.85, g.position.z);
          r.render(sc, pc); x.drawImage(r.domElement, LW + k * FW, ci * FH, FW, FH);
          x.fillStyle = '#e9d3ae'; x.font = '11px monospace'; x.fillText(t.toFixed(2) + ' s', LW + k * FW + 4, ci * FH + FH - 6); k++;
        }
      }
      sc.remove(g); R.root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.dispose && !o.isSkinnedMesh) {} });
      const row = { name: c.name, pico: +peak.toFixed(1), en: +peakAt.toFixed(2), hueso: peakBone, media: +(calm / Math.max(1, n)).toFixed(1), serie: series };
      out.push(row);
      x.fillStyle = '#e9d3ae'; x.font = '13px monospace'; x.fillText(c.name, 6, ci * FH + 20);
      x.fillText('pico ' + row.pico + '°/fot.', 6, ci * FH + 44); x.fillText('a ' + row.en + ' s', 6, ci * FH + 62); x.fillText(row.hueso, 6, ci * FH + 80);
      x.fillText('media ' + row.media + '°', 6, ci * FH + 98);
    });
    return { rows: out, png: sheet.toDataURL('image/png') };
  }, pack);
  fs.writeFileSync(path.join(outDir, 'transiciones-' + pack + '.png'), Buffer.from(res.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(outDir, 'transiciones-' + pack + '.json'), JSON.stringify(res.rows, null, 1));
  for (const r of res.rows) console.log(r.name.padEnd(20) + ' pico ' + String(r.pico).padStart(5) + '°/fotograma a ' + String(r.en).padStart(4) + ' s (' + r.hueso + ') · media ' + r.media + '°');
  console.log('hoja: ' + path.join(outDir, 'transiciones-' + pack + '.png'));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
