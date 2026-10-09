/* Real-browser test: opens index.html in headless Chromium (Playwright, WebGL by software)
   exactly as GitHub Pages serves it, and checks what the player actually sees.
   It is a real engine + real DOM + real CSS test, but NOT a test of Safari, Android or of
   real performance (software rendering on a server).
   Run: node test/browser.test.js   (needs the playwright package; skipped if missing) */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nNAVEGADOR REAL: playwright no está instalado, se omite'); process.exit(0); }

const root = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
// ids of the overlays that must only appear when the game asks for them
const OVERLAYS = ['lockHint', 'loadErr', 'rotate', 'settings', 'editPanel', 'pause', 'over', 'death', 'selfTestOut', 'dbg'];
const shown = page => page.evaluate(ids => ids.filter(id => { const e = document.getElementById(id); return e && e.checkVisibility && e.checkVisibility(); }), OVERLAYS);

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const open = async (opts) => {
    const ctx = await browser.newContext(opts);
    // fonts come from Google; the test machine has no internet, the game must not depend on them
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1500);
    return { ctx, page };
  };
  try {
    console.log('\nPC (1280×720, ratón)');
    { const { ctx, page } = await open({ viewport: { width: 1280, height: 720 } });
      const st = await page.evaluate(() => ({ three: window.THREE && THREE.REVISION, sd: !!window.__SD, menu: document.querySelector('#menu, .menu, #start') ? 1 : 0, play: !!Array.from(document.querySelectorAll('button')).find(b => /JUGAR/.test(b.textContent) && b.checkVisibility()) }));
      check('Three.js r128 cargado desde el propio sitio (sin CDN)', st.three === '128');
      check('el juego arranca', st.sd);
      const ov = await shown(page);
      check('en el menú no se ve ninguna pantalla que debería estar oculta', ov.length === 0, ov.join(', ') || 'ninguna');
      check('el botón JUGAR se ve', st.play);
      // the server's copy of the map (core/mapdata.js) is exactly the world the page builds
      const { dumpWorld } = require('../tools/export-map.js'), MAPF = require('../core/mapdata.js');
      for (const id of ['pueblo', 'arena']) {
        const d = await dumpWorld(page, id), M = MAPF.maps[id];
        check('mapa ' + id + ': el del servidor coincide con el del juego (si cambias un mapa: node tools/export-map.js)', !!M && JSON.stringify(d.tris) === JSON.stringify(M.tris) && JSON.stringify(d.ds) === JSON.stringify(M.ds) && JSON.stringify(d.colliders) === JSON.stringify(M.colliders) && JSON.stringify(d.ramps) === JSON.stringify(M.ramps) && JSON.stringify(d.nav) === JSON.stringify(M.nav), (d.tris.length / 9) + ' triángulos');
      }
      check('después de comprobar los mapas la página sigue en el pueblo', await page.evaluate(() => __SD.WORLD_ID === 'pueblo'));
      const dup = await page.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => c[e.id] = (c[e.id] || 0) + 1); return Object.keys(c).filter(k => c[k] > 1); });
      check('ningún id repetido en la página (si se repite, un dato se escribe en el sitio equivocado)', dup.length === 0, dup.join(', ') || 'ninguno');
      // real mouse click on JUGAR → the browser really captures the mouse (Pointer Lock)
      await page.evaluate(() => __SD.setMode('range'));
      await page.getByRole('button', { name: 'JUGAR', exact: true }).click();
      await page.waitForTimeout(1500);
      const locked = await page.evaluate(() => document.pointerLockElement === document.querySelector('canvas'));
      check('clic real en JUGAR: el navegador captura el ratón (Pointer Lock)', locked);
      // with the mouse captured, keep moving it the same way: the view must keep turning (no screen edge)
      const turn = await page.evaluate(async () => {
        const y0 = __SD.P.yaw;
        for (let i = 0; i < 40; i++) { window.dispatchEvent(new MouseEvent('mousemove', { movementX: 120, movementY: 0 })); await new Promise(r => requestAnimationFrame(r)); }
        return (y0 - __SD.P.yaw) * 180 / Math.PI;
      });
      check('ratón capturado: sigue girando sin tope (más de 360° hacia el mismo lado)', turn > 360, turn.toFixed(0) + '°');
      await page.waitForTimeout(1000);
      const res = await page.evaluate(() => __SD.aimSelfTest());
      const head = res[0] || '';
      check('autotest de puntería con el motor real: 0 fallidas', /✔ AUTOTEST/.test(head), head.replace(/^. /, ''));
      if (!/✔ AUTOTEST/.test(head)) res.filter(l => l.startsWith('✘')).forEach(l => console.log('       ' + l));
      const ov2 = await shown(page);
      check('jugando no tapa nada ninguna pantalla oculta', ov2.length === 0, ov2.join(', ') || 'ninguna');
      // pointer lock refused once (e.g. clicking too soon after Esc): the game must keep asking
      // on every click and tell the player, instead of falling back to a camera stuck at the screen edges
      const lk = await page.evaluate(async () => {
        const c = document.querySelector('canvas'); let calls = 0;
        c.requestPointerLock = () => { calls++; return Promise.reject(new Error('denied')); };
        __SD.pause(); await new Promise(r => setTimeout(r, 300)); __SD.resume(); await new Promise(r => setTimeout(r, 900));
        const hint = document.getElementById('lockHint').checkVisibility();
        const before = calls;
        c.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
        c.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
        return { hint, before, after: calls };
      });
      check('si el navegador no captura el ratón, sale el aviso HAZ CLIC', lk.hint);
      check('cada clic vuelve a pedir capturar el ratón (antes se rendía tras el primer fallo)', lk.after - lk.before === 2, lk.before + ' → ' + lk.after + ' peticiones');
      await page.evaluate(() => __SD.pause());
      check('en pausa el aviso desaparece', !(await page.evaluate(() => document.getElementById('lockHint').checkVisibility())));
      await ctx.close();
    }
    console.log('\nVERSIÓN NUEVA PUBLICADA');
    { const { ctx, page } = await open({ viewport: { width: 1280, height: 720 } });
      await page.waitForTimeout(5000);
      check('con la versión al día no sale ningún aviso', await page.evaluate(() => document.getElementById('updBanner').hidden));
      await ctx.route(/version\.json/, r => r.fulfill({ contentType: 'application/json', body: '{"hash":"0000000000"}' }));
      await page.waitForTimeout(61500);   // the page checks every 60 s
      check('si se publica otra versión, el menú ofrece ACTUALIZAR', await page.evaluate(() => !document.getElementById('updBanner').hidden));
      await ctx.close();
    }
    console.log('\nGRÁFICOS');
    { const { ctx, page } = await open({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
      const q = await page.evaluate(async () => {
        const S = __SD, r = {};
        const set = async (k, v) => { S.SETTINGS[k] = v; document.querySelector('#qSeg button[data-q="' + (k === 'quality' ? v : S.SETTINGS.quality) + '"]').click(); await new Promise(f => setTimeout(f, 50)); };
        await set('quality', 'bajo'); r.bajo = { pr: S.renderer.getPixelRatio(), sh: S.renderer.shadowMap.enabled };
        await set('quality', 'alto'); r.alto = { pr: S.renderer.getPixelRatio(), sh: S.renderer.shadowMap.enabled };
        document.getElementById('sShowFps').click(); await new Promise(f => setTimeout(f, 1800));
        r.fps = document.getElementById('fpsBox').checkVisibility() ? document.getElementById('fpsBox').textContent : null;
        document.getElementById('sShowFps').click();
        document.querySelector('#qSeg button[data-q="auto"]').click();
        return r; });
      check('BAJO: sin sombras y resolución 1×; ALTO: sombras y resolución 2× (pantalla 2×)', !q.bajo.sh && q.bajo.pr === 1 && q.alto.sh && q.alto.pr === 2, JSON.stringify(q.bajo) + ' ' + JSON.stringify(q.alto));
      check('el contador de FPS aparece al activarlo', !!q.fps && /FPS/.test(q.fps), q.fps);
      await ctx.close();
    }
    console.log('\nMÓVIL (emulación de pantalla táctil 844×390; NO es Safari ni Android reales)');
    { const { ctx, page } = await open({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
      const ov = await shown(page);
      check('horizontal: menú sin pantallas indebidas (sin aviso de girar)', ov.length === 0, ov.join(', ') || 'ninguna');
      await page.evaluate(() => { __SD.setMode('range'); __SD.startMatch(); }); await page.waitForTimeout(1200);
      const t = await page.evaluate(() => { const e = document.getElementById('touch'); return e && e.checkVisibility(); });
      check('al jugar aparecen los controles táctiles', t);
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
      const ov2 = await shown(page);
      check('en vertical sale el aviso GIRA EL MÓVIL', ov2.includes('rotate'), ov2.join(', '));
      await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(600);
      const ov3 = await shown(page);
      check('al volver a horizontal el aviso desaparece', !ov3.includes('rotate'), ov3.join(', ') || 'ninguna');
      await ctx.close();
    }
    { // narrow phones: the health block must not run into the score
      const bad = [];
      for (const [w, h] of [[568, 320], [667, 375]]) {
        const { ctx, page } = await open({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
        await page.evaluate(() => { __SD.setMode('duel'); __SD.startMatch(); }); await page.waitForTimeout(800);
        const o = await page.evaluate(() => { const v = document.getElementById('vitals').getBoundingClientRect(), t = document.getElementById('score').getBoundingClientRect(); return v.right > t.left && v.top < t.bottom; });
        if (o) bad.push(w + '×' + h); await ctx.close();
      }
      check('móviles estrechos (568 y 667 px): la vida no tapa el marcador', bad.length === 0, bad.join(', ') || 'sin solapes');
    }
    check('sin errores de JavaScript en la página', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ninguno');
  } catch (e) { fail++; console.log('  FAIL ' + e.message); }
  await browser.close(); server.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
