/* TEXTURAS POR DISTANCIA: al salir de un mapa, sus texturas buenas se sueltan (vuelven a la pequeña y dejan la GPU).
   Sube una (setts_c) en el PUEBLO, pasa al BARRIO y adelanta 21 s la decisión.   node tools/stream-soltar.js */
const { chromium } = require('playwright');
const ss = require('./static-server.js');
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 480, height: 270 } });
  await ctx.addInitScript(() => localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 2 })));
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=1&stream=1');
  await p.waitForFunction(() => window.__SD && __SD.P3W && __SD.P3W.kit, null, { timeout: 180000 });
  await p.evaluate(() => { __SD.setWorld('pueblo'); __SD.streamUp('setts_c'); });
  await p.waitForFunction(() => __SD.STREAM.s.st.setts_c && __SD.STREAM.s.st.setts_c.state !== 'loading', null, { timeout: 60000 });
  const slot = () => p.evaluate(() => { let c = 0, lo = 0; __SD.scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) { const t = m.map; if (t && t.isCompressedTexture && m.name === 'kit_setts') c++; else if (t && t.userData && t.userData.stream === 'setts_c') lo++; } }); return { estado: __SD.STREAM.s.st.setts_c.state, comprimidas: c, pequenas: lo }; });
  console.log('en el PUEBLO, subida', JSON.stringify(await slot()));
  await p.evaluate(() => { __SD.setWorld('barrio'); __SD.streamStep(0.6); __SD.streamStep(21); __SD.streamStep(0.6); });
  console.log('en el BARRIO, 21 s después', JSON.stringify(await slot()), JSON.stringify(await p.evaluate(() => __SD.STREAM.stats)));
  await p.evaluate(() => { __SD.setWorld('pueblo'); __SD.streamStep(0.6); });
  await p.waitForFunction(() => __SD.STREAM.s.st.setts_c.state === 'hi', null, { timeout: 60000 }).catch(() => {});
  console.log('de vuelta en el PUEBLO', JSON.stringify(await slot()));
  await b.close(); srv.close();
})();
