/* La red de los bots en C++/WebAssembly dentro del juego (17-11-2026): la página carga assets/wasm/nav.wasm, el BARRIO y
   la CASA ATLAS 2.0 construyen su red con ella, da lo mismo que con ?navwasm=0 (la versión JavaScript) y cuánto tarda
   cada una en la página. WebGL por software: los tiempos son de la CPU de este PC.  Run: node test/navwasm.browser.test.js */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nNAVWASM: playwright no está instalado, se omite'); process.exit(0); }
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
(async () => {
  const srv = await ss.start(), b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const run = async q => {
    const ctx = await b.newContext({ viewport: { width: 640, height: 360 } }); await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = [], bad = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (/\/assets\//.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await p.goto(srv.url + '?barrio=1' + q + (/navwasm=0/.test(q) ? '&audiowasm=0' : '')); await p.waitForFunction(() => window.__SD && __SD.WORLDS && window.SDNavWasm, null, { timeout: 180000 });
    if (!/navwasm=0/.test(q)) await p.waitForFunction(() => (SDNavWasm.ready || SDNavWasm.failed) && window.SDAudioWasm && (SDAudioWasm.ready || SDAudioWasm.failed), null, { timeout: 30000 }).catch(() => {});
    const r = await p.evaluate(() => { const out = { ready: SDNavWasm.ready, off: SDNavWasm.off, maps: {} };
      for (const id of ['barrio', 'casa2', 'casa2b']) { const W = __SD.WORLDS[id]; if (!W) continue; const t = performance.now(), nav = W.nav;
        out.maps[id] = { n: nav.length, ms: +(performance.now() - t).toFixed(1), sig: nav.reduce((s, p, k) => (s + p.x * 7 + p.z * 13 + p.n.length * (k % 97)) % 1e9, 0) }; }
      out.runs = SDNavWasm.runs;
      // the sound (18-11-2026): audioInit() with the C++ noise and reverb when SDAudioWasm is loaded
      out.audio = { ready: !!(window.SDAudioWasm && SDAudioWasm.ready), off: !!(window.SDAudioWasm && SDAudioWasm.off) };
      try { __SD.audioInit && __SD.audioInit(); } catch (e) { out.audio.err = String(e); }
      const AU = __SD.AU; out.audio.noise = !!(AU && AU.noise && AU.noise.length > 0); out.audio.ms = window.SDAudioWasm ? +SDAudioWasm.ms.toFixed(1) : null;
      return out; });
    await ctx.close(); return Object.assign(r, { errs, bad });
  };
  console.log('\nRED DE LOS BOTS EN LA PÁGINA: C++/WebAssembly y JavaScript');
  const W = await run(''), J = await run('&navwasm=0');
  check('la página carga nav.wasm y las redes se hacen con él', W.ready && W.runs >= 3 && W.bad.length === 0, JSON.stringify({ ready: W.ready, runs: W.runs, bad: W.bad }));
  check('con ?navwasm=0 se usa la versión JavaScript', J.off && J.runs === 0);
  check('el sonido inicial se genera con C++ (audio.wasm) y queda listo', W.audio.ready && W.audio.noise && !W.audio.err, JSON.stringify(W.audio));
  for (const id of Object.keys(W.maps)) check(id + ': la misma red con las dos', W.maps[id].n === J.maps[id].n && W.maps[id].sig === J.maps[id].sig, W.maps[id].n + ' puntos · C++ ' + W.maps[id].ms + ' ms · JS ' + J.maps[id].ms + ' ms');
  check('sin errores', W.errs.length === 0 && J.errs.length === 0, W.errs.concat(J.errs).slice(0, 2).join(' | ') || 'ninguno');
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas'); process.exit(fail ? 1 : 0);
})();
