/* ¿Dónde gasta la CPU el juego? (18-11-2026, ENGINE NEXT GENERATION: qué pasar a C++). Perfilador de muestras de
   Chrome (CDP) sobre la página real, con la GPU del PC, en dos fases:
     carga   — desde abrir la página hasta que la partida está en marcha (mapa, modelos, redes, compilación…)
     partida — N segundos jugando contra bots
   Saca las funciones con más tiempo propio (sin contar las que llaman). Tiempos del PC, no del iPhone: sirve para
   saber QUÉ pesa, no cuánto pesará en el móvil.
   node tools/wasm/perfil.js [mapa=pueblo] [segundos=20]   env Q=alto · BOTS=5 · URLX=&algo=1 · OUT=perfil.json */
'use strict';
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const fs = require('fs');
const MAP = process.argv[2] || 'pueblo', SECS = +(process.argv[3] || 20);
function top(profile, n) {
  const byId = new Map(); for (const nd of profile.nodes) byId.set(nd.id, nd);
  const dt = (profile.endTime - profile.startTime) / 1000 / Math.max(1, profile.samples.length);   // ms per sample
  const self = new Map(); let total = 0, idle = 0;
  for (const id of profile.samples) {
    const nd = byId.get(id), f = nd.callFrame, name = f.functionName || '(anónima)';
    total += dt; if (/^\((idle|program|garbage collector)\)$/.test(name)) { if (name === '(idle)') idle += dt; }
    const key = name + ' · ' + (f.url ? f.url.replace(/^.*\//, '').replace(/\?.*$/, '') : '') + ':' + (f.lineNumber + 1);
    self.set(key, (self.get(key) || 0) + dt);
  }
  const rows = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, ms]) => ({ fn: k, ms: +ms.toFixed(1) }));
  return { total: +total.toFixed(0), idle: +idle.toFixed(0), busy: +(total - idle).toFixed(0), rows };
}
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ channel: process.env.CH || 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const ctx = await b.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 3 })); localStorage.setItem('sniperduel_diff', '2'); } catch (e) {} }, process.env.Q || 'alto');
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  // 1) carga
  await cdp.send('Profiler.start'); const t0 = Date.now();
  await p.goto(srv.url + '?ktx2=0&casa2=1&barrio=1' + (process.env.URLX || ''), { timeout: 180000 });
  await p.waitForFunction(() => window.__SD && __SD.W && __SD.WORLDS, null, { timeout: 180000 });
  await p.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
  await p.evaluate(map => { const S = __SD; S.setTrain('off'); S.setMode('duel'); S.setDuelLethal(false); S.setOffMap(map); S.startMatch(); }, MAP);
  await p.waitForFunction(() => __SD.state === 'playing', null, { timeout: 180000 });
  await new Promise(r => setTimeout(r, 1500));
  const load = top((await cdp.send('Profiler.stop')).profile, 25); load.wall = Date.now() - t0;
  // 2) partida: los bots juegan; el jugador gira despacio para que se dibuje todo el mapa
  await cdp.send('Profiler.start');
  await p.evaluate(secs => new Promise(res => { const S = __SD, t = performance.now(); const step = () => { S.P.yaw += 0.01; if (performance.now() - t < secs * 1000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); }), SECS);
  const play = top((await cdp.send('Profiler.stop')).profile, 25);
  const info = await p.evaluate(() => ({ bots: __SD.BOTS.filter(b => b.alive).length, map: __SD.WORLD_ID }));
  const out = { mapa: MAP, info, carga: load, partida: play };
  const show = (t, o) => { console.log('\n== ' + t + ': ' + (o.wall ? o.wall + ' ms de reloj, ' : '') + o.busy + ' ms de CPU ocupada de ' + o.total);
    for (const r of o.rows) console.log(String(r.ms).padStart(8) + ' ms  ' + r.fn); };
  show('CARGA', load); show('PARTIDA ' + SECS + ' s (' + info.bots + ' bots, ' + info.map + ')', play);
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
  await b.close(); srv.close();
})();
