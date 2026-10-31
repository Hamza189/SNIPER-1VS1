/* GAME FEEL — línea base y comparativas (GF-0, 30-10-2026). Mide siempre lo mismo para poder comparar antes y después:
   ARENA y PUEBLO 3.0 (duelo contra 1 bot) y una SALA online con 5 bots (servidor local), con la cámara girando a la
   misma velocidad. Por escena: fotogramas (media, p50, p95, p99, máx, 1 % bajo), pasos de simulación y personajes
   animados por fotograma, y el tiempo de CPU por partes (__SD.PROF, ?prof=1).
     node tools/gf-medir.js <etiqueta> [segundos=8]        → .work/gf/<etiqueta>.json
   env GPU=1: Chromium con la GPU del PC (si no, WebGL por software: vale para la CPU por partes, NO para FPS del móvil).
   env ONLY=arena,pueblo,sala5 · env URLX="&gf=1" (banderas extra) · env PAGE=_antes.html (otra versión de la página). */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ss = require('./static-server.js');
const { startServer } = require('../server/node.js');
const label = process.argv[2] || 'medida', secs = +(process.argv[3] || 8);
const ONLY = (process.env.ONLY || 'arena,pueblo,sala5').split(','), URLX = process.env.URLX || '';

const stats = a => { const s = a.slice().sort((x, y) => x - y), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))] || 0, avg = a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  return { n: a.length, avg: +avg.toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +(s[s.length - 1] || 0).toFixed(2), fps: +(1000 / avg).toFixed(1), low1: +(1000 / q(0.99)).toFixed(1) }; };

(async () => {
  const srv = await ss.start(), gs = ONLY.includes('sala5') ? await startServer({ port: 0 }) : null;
  const gpu = process.env.GPU === '1';
  // (the headless shell reaches the real GPU through ANGLE/D3D11: on the owner's PC the GTX 1050 Ti)
  const b = await chromium.launch(gpu ? { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] }
    : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = { label, date: new Date().toISOString(), gpu, scenes: {} };
  const open = async () => {
    const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); localStorage.setItem('sniperduel_p3', 'true'); } catch (e) {} });
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const q = '?prof=1' + URLX + (gs ? '&server=' + encodeURIComponent('http://127.0.0.1:' + gs.port) : '');
    await p.goto(srv.url + (process.env.PAGE || "") + q, { timeout: 180000 });   // env PAGE=_antes.html: another build (git show HEAD:index.html > _antes.html)
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 180000 });
    await p.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
    if (!out.renderer) out.renderer = await p.evaluate(() => { const g = __SD.renderer.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
    return { ctx, p, errs };
  };
  const record = p => p.evaluate(async secs => {
    __SD.PERF.spin = 2 * Math.PI / 10; await new Promise(r => setTimeout(r, 2500));
    __SD.PROF.reset(); const dt = []; let last = 0, run = true;
    const tick = t => { if (last) dt.push(t - last); last = t; if (run) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    await new Promise(r => setTimeout(r, secs * 1000)); run = false; __SD.PERF.spin = 0;
    return { dt, parts: __SD.PROF.avg(), info: { calls: __SD.renderer.info.render.calls, tris: __SD.renderer.info.render.triangles, programs: __SD.renderer.info.programs.length } };
  }, secs);
  for (const id of ONLY) {
    const { ctx, p, errs } = await open();
    if (id === 'sala5') {
      await p.click('#mpBtn'); await p.fill('#mpName', 'Medida'); await p.click('#mpCreate');
      await p.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent), null, { timeout: 15000 });
      await p.click('#mpMapSeg [data-map="pueblo"]'); await p.click('#mpModeSeg [data-mode="todos"]');
      await p.waitForFunction(() => !document.getElementById('mpCustom').hidden, null, { timeout: 10000 });
      await p.click('#mpBotsSeg [data-b="5"]'); await p.click('#mpReady');
      await p.waitForFunction(() => __SD.NET.N && __SD.NET.N.phase === 'playing', null, { timeout: 60000 });
    } else {
      await p.evaluate(async id => { __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.setOffMap(id); __SD.startMatch();
        const t = performance.now(); while (!(__SD.state === 'playing' && __SD.LOAD.phase === 'ready') && performance.now() - t < 120000) await new Promise(r => setTimeout(r, 100)); }, id);
    }
    await p.waitForTimeout(4000);   // characters and textures finish arriving
    const r = await record(p);
    out.scenes[id] = { frame: stats(r.dt), parts: r.parts, info: r.info, errors: errs.slice(0, 3) };
    const f = out.scenes[id].frame, pa = r.parts;
    console.log(id.padEnd(7), 'fotograma media', f.avg, 'p95', f.p95, 'p99', f.p99, 'máx', f.max, '→', f.fps, 'FPS (1 % bajo', f.low1 + ')',
      '| pasos/fot', pa.ticksN, 'animados/fot', pa.animN, '| CPU ms: sim', pa.sim, 'bots', pa.bots, 'anim', pa.anim, 'cámara', pa.camara, 'red', pa.red, 'dibujo', pa.dibujo, 'arma', pa.arma1p, 'hud', pa.hud, 'efectos', pa.efectos, 'mundo', pa.mundo,
      '| llamadas', r.info.calls, (errs.length ? '| ERRORES ' + errs[0] : ''));
    await ctx.close();
  }
  await b.close(); srv.close(); if (gs) gs.close();
  fs.mkdirSync(path.join(__dirname, '..', '.work', 'gf'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', '.work', 'gf', label + '.json'), JSON.stringify(out, null, 1));
  console.log('renderer:', out.renderer, '→ .work/gf/' + label + '.json');
})();
