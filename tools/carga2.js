/* PANTALLA DE CARGA (?carga=2, docs/CARGA.md): antes / después, en PC y como un móvil.
   For each run: when the game is really ready to play (your operator and the bots at full resolution, the guns, the
   textures, nothing left on its way), the GPU texture memory then (__SD.cgMem: everything on the GPU, also character
   templates and weapon skins not in the scene, and renderer.info.memory), and the hitches when a match starts right
   then: how long startMatch() takes and the longest frames of its first 3 s.
   node tools/carga2.js [salida.json]
   env: DEV=pc,movil · MODES=antes,despues · URL=extra flags (default r2=1: the KTX2 files of the real web)
        GPU=0 → WebGL by software (counts only, no times) · CPU=4 (the phone's CPU slowdown) */
'use strict';
const fs = require('fs');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '', CPU = +(process.env.CPU || 4), EXTRA = process.env.URL == null ? 'r2=1' : process.env.URL;
const DEVS = (process.env.DEV || 'pc,movil').split(','), MODES = (process.env.MODES || 'antes,despues').split(',');
const GPU = process.env.GPU !== '0';
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const res = {};
  for (const dev of DEVS) for (const mode of MODES) {
    const phone = dev === 'movil';
    const ctx = await b.newContext(phone ? { viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
    const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
    if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    const q = [EXTRA, mode === 'despues' ? 'carga=2' : 'carga=1'].filter(Boolean).join('&');
    const t0 = Date.now();
    await p.goto(srv.url + '?' + q, { timeout: 240000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 240000, polling: 100 });
    const tJuego = Date.now() - t0;
    // ready = the same conditions in both runs (what the first match uses), plus, with the screen, the screen gone
    const ready = () => {
      const S = __SD, own = S.SKINS[S.SKIN].pack, root = own ? (own === 'v2' ? 'assets/personaje/' : 'assets/personaje/pro/' + own + '/') : null;
      const bots = S.BOTS[0] && S.BOTS[0].rig, P = S.PJ2;
      const pj = !P.on || ((!root || P.tpls[root] || P.failedRoots[root]) && (!bots || (bots.v2 && !bots.v2prev)));
      const tex = S.TEX && (!S.TEX.asked || (S.TEX.ok || 0) + (S.TEX.fail || 0) >= S.TEX.asked);
      const scr = !S.CARGA.on || (S.CARGA.done || S.CARGA.skipped);
      return !!(S.VMA.ready && pj && tex && scr && (!S.M2.on || S.M2.opShown) && !(S.M2.R && S.M2.R.v2prev));
    };
    let tReady = null;
    try { await p.waitForFunction(ready, null, { timeout: 240000, polling: 100 }); tReady = Date.now() - t0; } catch (e) {}
    const mem = await p.evaluate(() => Object.assign(__SD.cgMem(), { heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }));
    // and once it has settled (a texture still arriving at «ready» counts too): +8 s in the menu
    if (process.env.MEM8) await p.waitForTimeout(8000);   // (then the match is no longer «at once»)
    const mem8 = await p.evaluate(() => __SD.cgMem());
    if (process.env.PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    // a match at once: the cost of startMatch and the first 3 s of frames
    const hitch = await p.evaluate(() => new Promise(res => {
      const S = __SD; S.setMode('duel');
      const t = performance.now(); S.startMatch(); const call = performance.now() - t;
      const fr = []; let last = performance.now(); const end = last + 3000;
      const f = () => { const now = performance.now(); fr.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else {
        fr.sort((a, b) => b - a); res({ startMatchMs: Math.round(call), frames: fr.length, maxMs: Math.round(fr[0] || 0), top3: fr.slice(0, 3).map(Math.round), over50: fr.filter(x => x > 50).length, over100: fr.filter(x => x > 100).length }); } };
      requestAnimationFrame(f);
    }));
    const rep = await p.evaluate(() => __SD.CARGA.report);
    if (process.env.PROF) {   // where the start of the match goes (self time per function)
      const prof = (await cdp.send('Profiler.stop')).profile, dt = {}, byId = new Map(prof.nodes.map(n => [n.id, n]));
      for (let i = 0; i < prof.samples.length; i++) { const cf = byId.get(prof.samples[i]).callFrame; const k = (cf.functionName || '(anónima)') + ':' + (cf.lineNumber + 1) + ' ' + (cf.url || '').replace(/^.*\//, '').slice(0, 20); dt[k] = (dt[k] || 0) + (prof.timeDeltas[i] || 0) / 1000; }
      console.log('   perfil: ' + Object.entries(dt).filter(([k]) => !/^\((idle|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => Math.round(v) + ' ' + k).join(' · '));
    }
    res[dev + '_' + mode] = { juego: tJuego, listo: tReady, mem, mem8, hitch, carga: rep && { listo: rep.listo, minimo: rep.minimo, todo: rep.todo, warm: rep.warm }, errs: errs.slice(0, 3) };
    console.log('\n== ' + dev + ' · ' + mode + (phone ? ' (CPU ×' + CPU + ')' : '') + (GPU ? '' : ' [WebGL por software: tiempos no válidos]'));
    console.log('   juego arrancado ' + tJuego + ' ms · listo para jugar ' + tReady + ' ms' + (rep ? ' · pantalla: mínimo ' + rep.minimo + ', memoria lista ' + rep.listo + ', 100 % ' + rep.todo : ''));
    console.log('   texturas en la GPU ' + mem.texMB + ' MB (' + mem.n + ') · renderer.info texturas ' + mem.textures + ' geometrías ' + mem.geometries + ' · JS ' + mem.heapMB + ' MB · a los +8 s: ' + mem8.texMB + ' MB');
    console.log('   partida al momento: startMatch ' + hitch.startMatchMs + ' ms · fotograma más largo ' + hitch.maxMs + ' ms ' + JSON.stringify(hitch.top3) + ' · >50 ms: ' + hitch.over50 + ' · >100 ms: ' + hitch.over100 + ' (' + hitch.frames + ' fotogramas)');
    if (errs.length) console.log('   errores: ' + errs.join(' | '));
    await ctx.close();
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
