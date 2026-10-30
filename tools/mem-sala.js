/* Memoria de una sala con bots en un «móvil» (docs/RENDIMIENTO-IPHONE.md): el caso en que Safari cerró la partida el
   29-10-2026 (sala TODOS CONTRA TODOS, 5 bots, PUEBLO 3.0, ALTO, rifle ÚLTIMA). Servidor local + página real.
   Cuenta lo que ocupa cada cosa, no los FPS (WebGL por software):
   - gpu: texturas en la tarjeta gráfica (las comprimidas por sus bytes reales)
   - cpu_ktx2: la copia que three.js guarda en JavaScript de cada textura comprimida (no hace falta tras subirla)
   - cpu_bitmap: las imágenes JPG/PNG decodificadas que guarda three.js (ImageBitmap de los GLB)
     node tools/mem-sala.js [bots=5] [segundos=60] [más parámetros de URL, p. ej. "&ktx2=0"] */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const { startServer } = require('../server/node.js');
const bots = +(process.argv[2] || 5), secs = +(process.argv[3] || 60), extra = process.argv[4] || '';

(async () => {
  const srv = await ss.start(), gs = await startServer({ port: 0 });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); localStorage.setItem('sniperduel_wsRifle', JSON.stringify('ultima')); } catch (e) {} });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(srv.url + '?pueblo=3&server=' + encodeURIComponent('http://127.0.0.1:' + gs.port) + extra, { timeout: 180000 });
  await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 180000 });
  await p.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
  await p.click('#mpBtn'); await p.fill('#mpName', 'Medida'); await p.click('#mpCreate');
  await p.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent), null, { timeout: 15000 });
  await p.click('#mpMapSeg [data-map="pueblo"]');
  await p.click('#mpModeSeg [data-mode="todos"]');
  await p.waitForFunction(() => !document.getElementById('mpCustom').hidden, null, { timeout: 10000 });
  await p.click('#mpBotsSeg [data-b="' + bots + '"]');
  await p.click('#mpReady');
  await p.waitForFunction(() => __SD.NET.N && __SD.NET.N.phase === 'playing', null, { timeout: 60000 });
  const measure = () => p.evaluate(() => {
    const seen = new Set(); let gpu = 0, ktx = 0, bmp = 0, n = 0;
    const up = o => { for (const m of [].concat(o.material || [])) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap']) {
      const t = m && m[k]; if (!t || seen.has(t)) continue; seen.add(t); n++;
      if (t.isCompressedTexture) { const by = (t.userData && t.userData.gpuBytes) || t.mipmaps.reduce((s, x) => s + (x.data ? x.data.byteLength : 0), 0); gpu += by; ktx += t.mipmaps.reduce((s, x) => s + (x.data ? x.data.byteLength : 0), 0); }
      else { const im = t.image || {}, w = im.naturalWidth || im.width || 0, h = im.naturalHeight || im.height || 0; gpu += w * h * 4 * 4 / 3; if (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap) bmp += w * h * 4; }
    } };
    __SD.scene.traverse(up); __SD.scene.children; const MB = x => Math.round(x / 1048576);
    return { texturas: n, gpu: MB(gpu), cpu_ktx2: MB(ktx), cpu_bitmap: MB(bmp), heap: performance.memory ? MB(performance.memory.usedJSHeapSize) : null,
      personajes: Object.keys(__SD.PJ2.tpls).map(r => r.replace('assets/personaje/', '') || 'v2').join(' '), rifle: __SD.WS_ST.rifle.cur + (__SD.WS_ST.ktx2.rifleultima ? ' (KTX2)' : ''), rivales: Object.keys(__SD.REMOTES).length };
  });
  for (let t = 0; t <= secs; t += 15) { console.log(t + ' s', JSON.stringify(await measure())); if (t < secs) await p.waitForTimeout(15000); }
  // the first-person weapon lives in its own scene
  console.log('rifle (escena de 1ª persona):', JSON.stringify(await p.evaluate(() => { let g = 0, c = 0; const s = new Set(); for (const o of __SD.WS_ST.rifle.objs) o.traverse(x => { if (x.isMesh) for (const k of ['map', 'normalMap', 'roughnessMap']) { const t = x.material[k]; if (t && !s.has(t)) { s.add(t); if (t.isCompressedTexture) { g += (t.userData && t.userData.gpuBytes) || t.mipmaps.reduce((a, m) => a + (m.data ? m.data.byteLength : 0), 0); c += t.mipmaps.reduce((a, m) => a + (m.data ? m.data.byteLength : 0), 0); } } } }); return { gpu: Math.round(g / 1048576), cpu_ktx2: Math.round(c / 1048576) }; })));
  console.log('errores', errs.length, errs.slice(0, 2).join(' | '));
  await b.close(); srv.close(); gs.close && gs.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
