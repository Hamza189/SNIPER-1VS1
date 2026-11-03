/* CARGA: where the start of the game goes (03-11-2026, owner: «los personajes, armas, mapas tardan en cargar»).
   Opens the game like a phone (iPhone size, touch, the CPU slowed down CPU× with Chrome's own throttling, the PC's real
   GPU), twice: the first visit (empty cache) and the second (everything already downloaded once). For each: requests and
   MB, when the page is ready, the first frame of the menu, the menu's operator on screen, and the JavaScript functions
   that took the most time (a CPU profile of the first seconds).
   node tools/carga.js [salida.json]       env: CPU=4 · SECS=20 · URL=extra flags · BASE=other server */
'use strict';
const fs = require('fs');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '', CPU = +(process.env.CPU || 4), SECS = +(process.env.SECS || 20), EXTRA = process.env.URL || '';
(async () => {
  const srv = process.env.BASE ? null : await ss.start();
  const base = process.env.BASE || srv.url;
  const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('sniperduel_settings')) localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
  const res = {};
  for (const visit of ['primera', 'segunda']) {
    const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
    let reqs = 0, bytes = 0, fromCache = 0; const t0 = Date.now();
    p.on('requestfinished', async r => { reqs++; try { const s = await r.sizes(); bytes += s.responseBodySize; } catch (e) {} });
    p.on('response', r => { if (r.fromServiceWorker() || r.status() === 304) fromCache++; });
    await p.goto(base + (EXTRA ? '?' + EXTRA : ''), { waitUntil: 'load', timeout: 240000 });
    const tLoad = Date.now() - t0;
    const mark = async (fn, ms) => { const t = Date.now(); try { await p.waitForFunction(fn, null, { timeout: ms, polling: 100 }); return Date.now() - t0; } catch (e) { return null; } };
    const tSD = await mark(() => window.__SD && __SD.WORLDS, 120000);
    const tVM = await mark(() => __SD.VMA && __SD.VMA.ready, 120000);
    const tOp = await mark(() => !__SD.M2 || !__SD.M2.on || __SD.M2.opShown === true, 180000);
    const tMap = await mark(() => !__SD.P3ON || (__SD.P3W && __SD.P3W.kit), 180000);
    await p.waitForTimeout(Math.max(0, SECS * 1000 - (Date.now() - t0)));
    const prof = (await cdp.send('Profiler.stop')).profile;
    // self time per function (ms), the biggest first
    const dt = {}, byId = new Map(prof.nodes.map(n => [n.id, n]));
    for (let i = 0; i < prof.samples.length; i++) { const n = byId.get(prof.samples[i]), cf = n.callFrame;
      const k = (cf.functionName || '(anónima)') + ' · ' + (cf.url || '').replace(/^.*\//, '').replace(/\?.*$/, '') + ':' + (cf.lineNumber + 1);
      dt[k] = (dt[k] || 0) + (prof.timeDeltas[i] || 0) / 1000; }
    // inclusive time (the function and everything it calls) of the game's own functions, until the page is ready
    const kids = new Map(prof.nodes.map(n => [n.id, n.children || []])), selfMs = new Map();
    for (let i = 0; i < prof.samples.length; i++) selfMs.set(prof.samples[i], (selfMs.get(prof.samples[i]) || 0) + (prof.timeDeltas[i] || 0) / 1000);
    const incl = new Map(); const tot = id => { if (incl.has(id)) return incl.get(id); let t = selfMs.get(id) || 0; for (const c of kids.get(id)) t += tot(c); incl.set(id, t); return t; };
    const game = {};
    for (const n of prof.nodes) { const cf = n.callFrame; if (!/index\.html|^\/?$|127\.0\.0\.1:\d+\/(\?|$)/.test(cf.url) && cf.url !== base + (EXTRA ? '?' + EXTRA : '')) continue;
      const k = (cf.functionName || '(anónima)') + ':' + (cf.lineNumber + 1); game[k] = Math.max(game[k] || 0, tot(n.id)); }
    const gtop = Object.entries(game).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, Math.round(v)]);
    const top = Object.entries(dt).filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => [k, Math.round(v)]);
    const busy = Math.round(Object.entries(dt).filter(([k]) => !/^\(idle\)/.test(k)).reduce((s, [, v]) => s + v, 0));
    const gc = Math.round(Object.entries(dt).filter(([k]) => /garbage/.test(k)).reduce((s, [, v]) => s + v, 0));
    res[visit] = { gtop, reqs, MB: +(bytes / 1048576).toFixed(1), cacheHits: fromCache, load: tLoad, juego: tSD, armas: tVM, operador: tOp, pueblo3: tMap, cpuOcupada: busy, gc, top };
    console.log('\n== ' + visit + ' visita (CPU ×' + CPU + '): ' + reqs + ' peticiones · ' + res[visit].MB + ' MB · desde caché ' + fromCache);
    console.log('   página cargada ' + tLoad + ' ms · juego listo ' + tSD + ' · armas ' + tVM + ' · tu operador ' + tOp + ' · kit del pueblo ' + tMap + ' · CPU ocupada ' + busy + ' ms (recolector ' + gc + ')');
    for (const [k, v] of top) console.log('   ' + String(v).padStart(6) + ' ms  ' + k.slice(0, 110));
    console.log('   — funciones del juego, tiempo con lo que llaman:');
    for (const [k, v] of gtop) console.log('   ' + String(v).padStart(6) + ' ms  ' + k.slice(0, 110));
    await p.close();
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  await b.close(); if (srv) srv.close();
})().catch(e => { console.error(e); process.exit(1); });
