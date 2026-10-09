/* Stage D: the PUBLIC game page (GitHub Pages) + the PUBLIC server (Cloudflare), two
   independent browsers, as two players would use them. Run on GitHub's machines by
   .github/workflows/public-check.yml (this container cannot reach those sites).
   Run: node test/public.browser.test.js [pageUrl] */
'use strict';
const { chromium } = require('playwright');
const page0 = process.argv[2] || 'https://hamza189.github.io/SNIPER-1VS1/';
const results = []; let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); results.push({ n, ok: !!c, i: i === undefined ? null : String(i) }); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(p, fn, arg, ms) { try { await p.waitForFunction(fn, arg, { timeout: ms || 10000, polling: 100 }); return true; } catch (e) { return false; } }
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const open = async q => { const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } }); const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|fonts/.test(m.text())) errors.push(m.text()); });
    await p.goto(page0 + '?perf=low' + (q || ''), { waitUntil: 'load' }); await p.waitForFunction(() => window.__SD, null, { timeout: 20000 }); return p; };
  try {
    console.log('\nPÁGINA PÚBLICA + SERVIDOR PÚBLICO: ' + page0);
    const A = await open('');
    check('la página pública carga el juego', await A.evaluate(() => !!window.THREE && document.getElementById('loadErr').hidden));
    await A.click('#mpBtn'); await A.fill('#mpName', 'Prueba A'); await A.click('#mpCreate');
    check('A crea sala en el servidor público', await until(A, () => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent), null, 15000), await A.textContent('#mpMsg'));
    const code = await A.textContent('#mpCodeBig');
    const B = await open('&sala=' + code);
    await B.fill('#mpName', 'Prueba B'); await B.click('#mpJoin');
    check('B entra con el enlace de invitación', await until(A, () => document.querySelectorAll('#mpPlayers li').length === 2, null, 15000));
    await A.click('#mpReady'); await B.click('#mpReady');
    check('la partida empieza en los dos', await until(A, () => __SD.NET.N.phase === 'playing', null, 15000) && await until(B, () => __SD.NET.N.phase === 'playing', null, 15000));
    await B.evaluate(() => { __SD.input.keys.KeyW = true; }); await sleep(2500); await B.evaluate(() => { __SD.input.keys.KeyW = false; }); await sleep(1500);
    const seen = await A.evaluate(() => { const R = __SD.REMOTE; return R && { x: R.g.position.x, z: R.g.position.z }; });
    const real = await B.evaluate(() => ({ x: __SD.PM.x, z: __SD.PM.z }));
    check('A ve a B donde B está', seen && Math.hypot(seen.x - real.x, seen.z - real.z) < 0.8, seen && Math.hypot(seen.x - real.x, seen.z - real.z).toFixed(2) + ' m');
    check('ping visible', await A.evaluate(() => /ms$/.test(document.getElementById('netStatTxt').textContent)), await A.textContent('#netStatTxt'));
    check('predicción sin correcciones', await B.evaluate(() => __SD.NET.N.corrMax) < 0.05, await B.evaluate(() => __SD.NET.N.corrMax.toFixed(4)));
    await A.evaluate(() => __SD.toMenu()); await sleep(800);
    check('A sale: B ve la victoria por abandono', await until(B, () => !document.getElementById('over').hidden, null, 8000));
    check('sin errores de JavaScript', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ninguno');
  } catch (e) { check('sin excepciones', false, e && e.message); }
  await browser.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  if (process.env.GITHUB_ACTIONS) {
    console.log('::notice title=Página pública + servidor::' + pass + ' correctas, ' + fail + ' fallidas · ' + results.map(r => (r.ok ? '✔ ' : '✘ ') + r.n + (r.i ? ' (' + r.i + ')' : '')).join(' | ').slice(0, 900));
    for (const r of results) if (!r.ok) console.log('::error title=Falla::' + r.n + (r.i ? ' (' + r.i + ')' : ''));
  }
  process.exit(fail ? 1 : 0);
})();
