/* TEXTURAS POR DISTANCIA (?stream=1, docs/TEXTURAS-DISTANCIA.md): arranca el PUEBLO, captura con las texturas
   pequeñas, deja que suban las buenas y vuelve a capturar desde la misma cámara; luego pasa al BARRIO y mira que las del
   PUEBLO se sueltan. Cuenta llamadas, memoria de texturas y lo que se ha cargado.
     node tools/stream-check.js [salida_dir]     env: URLX="&streamktx2=0" (solo JPG), Q=alto|medio|bajo
   SwiftShader: vale para aspecto y memoria, no para FPS. */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const fs = require('fs');
const OUT = process.argv[2] || '.', Q = process.env.Q || 'alto', URLX = process.env.URLX || '';
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.W || 1100), height: +(process.env.H || 560) } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 2 })), Q);
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => { if (/stream|ktx2/i.test(m.text())) console.log('consola', m.text().slice(0, 200)); });
  await p.goto(srv.url + '?vm=1&stream=1' + URLX);
  await p.addStyleTag({ content: '#lockHint{display:none!important}' });
  await p.waitForFunction(() => window.__SD && __SD.P3W && __SD.P3W.kit, null, { timeout: 180000 });
  await p.evaluate(() => { const S = __SD; S.setTrain('off'); S.setMode('duel'); S.startMatch(); });
  await p.waitForTimeout(1500);
  const view = () => p.evaluate(() => { const S = __SD; S.setWorld('pueblo'); S.freeze(true); S.SHOT.noVM = true; S.MANUAL.on = true; document.getElementById('hud').hidden = true;
    Object.assign(S.PM, { x: 0.5, y: 0, z: 38, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x: 0.5, y: 0, z: 38 }); S.P.yaw = 0; S.P.pitch = -0.05;
    for (const b of S.RANGE_BOTS.concat(S.BOTS)) b.g.visible = false; });
  const info = () => p.evaluate(() => { const S = __SD, r = S.renderer; r.info.autoReset = false; r.info.reset(); S.advance(16); const o = { calls: r.info.render.calls, tris: r.info.render.triangles };
    r.info.autoReset = true; const st = S.STREAM.s.st, c = {}; for (const k in st) c[st[k].state] = (c[st[k].state] || 0) + 1;
    return Object.assign(o, { estados: c, stats: S.STREAM.stats, texMB: S.perfTexMB(), reg: Object.keys(S.STREAM.reg).length }); });
  const shot = async f => { const d = await p.evaluate(() => { __SD.advance(16); return __SD.renderer.domElement.toDataURL('image/png'); }); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); };
  await view(); await p.evaluate(() => { __SD.advance(16); __SD.advance(16); });
  console.log('al empezar', JSON.stringify(await info()));
  await shot(OUT + '/stream-antes.png');
  // let it load: frames of 100 ms until nothing is loading (one at a time)
  let last = -1, same = 0;
  for (let i = 0; i < 200; i++) {
    const s = await p.evaluate(() => { for (let k = 0; k < 6; k++) __SD.advance(100); const st = __SD.STREAM.s.st, mine = SDPacks.keys('pueblo'); return { busy: __SD.STREAM.busy, lo: [...mine].filter(k => !st[k] || st[k].state === 'lo' || st[k].state === 'loading').length }; });
    same = !s.busy && s.lo === last ? same + 1 : 0; last = s.lo;
    if (!s.busy && (s.lo === 0 || same >= 5)) break;   // what stays small is farther than 40 m: as it should
    if (i % 10 === 0) console.log('  quedan', s.lo);
    await p.waitForTimeout(150);
  }
  await p.evaluate(() => { __SD.advance(16); __SD.advance(16); });
  console.log('cargadas', JSON.stringify(await info()));
  // GPU memory of the streamed textures: what they take now against all of them as JPG (4 bytes a pixel, + mipmaps)
  console.log('memoria', JSON.stringify(await p.evaluate(() => { let now = 0, jpg = 0; const P = SDPacks.PACKS.pueblo;
    for (const e of P) { jpg += e.w * e.h * 4 * 4 / 3; const st = __SD.STREAM.s.st[e.k]; now += st && st.state === 'hi' ? e.w * e.h * 4 / 3 : Math.min(e.w, 256) * Math.min(e.h, 256) * 4 * 4 / 3; }
    return { puebloAhoraMB: +(now / 1048576).toFixed(1), puebloTodoJpgMB: +(jpg / 1048576).toFixed(1) }; })));
  await shot(OUT + '/stream-despues.png');
  // to the BARRIO: the PUEBLO's go back to small after 20 s out of sight
  await p.evaluate(() => __SD.setWorld('barrio')); await p.waitForFunction(() => __SD.BAR.ready || __SD.BAR.failed, null, { timeout: 90000 });
  await p.evaluate(() => { for (let k = 0; k < 50; k++) __SD.advance(500); });
  console.log('en el BARRIO 26 s', JSON.stringify(await p.evaluate(() => { const st = __SD.STREAM.s.st, c = {}; for (const k in st) c[st[k].state] = (c[st[k].state] || 0) + 1; return { estados: c, stats: __SD.STREAM.stats, texMB: __SD.perfTexMB() }; })));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
