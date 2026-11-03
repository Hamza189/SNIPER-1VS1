/* What a frame of PUEBLO costs, part by part, on the PC's real graphics card (03-11-2026: the iPhone ran PUEBLO at 55 FPS
   with the CPU at 3 ms, so the time goes in the GPU). Each variant is the same page with one thing taken out (a URL
   flag); the camera turns a full circle in the plaza at eye height, at the iPhone's size (932×430 at 2×), quality ALTO,
   and every frame is timed until the GPU has finished it (gl.finish). The difference with the base is what that part
   costs. A PC GPU is not an iPhone GPU: the ORDER of the costs is what this tells, not the iPhone's milliseconds.
   node tools/gpu-coste.js [salida.json]
   env: DPR=4 (more pixels: a PC GPU this fast needs it to show the differences) · VARIANTS='base:;sinSombras:sombras=0;sinAA:aa=0;sinHierba:flora=0;sinSombraKit:kitsombra=0' · FRAMES=48 · ROUNDS=2 */
'use strict';
const fs = require('fs');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '';
const FRAMES = +(process.env.FRAMES || 48), ROUNDS = +(process.env.ROUNDS || 2);
const VARIANTS = (process.env.VARIANTS || 'base:;sinSombras:sombras=0;sinAA:aa=0;sinHierba:flora=0;sinSombraKit:kitsombra=0;sinRatas:ratas=0').split(';').map(v => { const i = v.indexOf(':'); return [v.slice(0, i), v.slice(i + 1)]; });
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const res = {};
  for (let round = 0; round < ROUNDS; round++) for (const [name, extra] of VARIANTS) {
    const ctx = await b.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: +(process.env.DPR || 2) });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); localStorage.setItem('sniperduel_menuOld', 'true'); } catch (e) {} });
    const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto(srv.url + '?vm=1&pueblo=3' + (extra ? '&' + extra : ''), { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.VMA.ready && __SD.P3W && __SD.P3W.kit && (!__SD.E10.on || __SD.E10.ready || __SD.E10.failed) && (!__SD.FLORA.on || __SD.FLORA.ready || __SD.FLORA.failed), null, { timeout: 240000 });
    await p.evaluate(() => { const S = __SD; S.setTrain('off'); S.setMode('duel'); S.setDuelLethal(false); S.setOffMap('pueblo'); S.startMatch(); });
    await p.waitForFunction(() => __SD.state === 'playing', null, { timeout: 120000 });
    await p.waitForTimeout(2500);
    const r = await p.evaluate(n => {
      const S = __SD, gl = S.renderer.getContext();
      S.freeze(true); S.MANUAL.on = true; document.getElementById('hud').hidden = true;
      for (const bt of (S.BOTS || [])) { bt.g.visible = false; if (bt.glint) bt.glint.visible = false; }
      Object.assign(S.PM, { x: 2, y: 0, z: 10, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x: 2, y: 0, z: 10 });
      for (let i = 0; i < 12; i++) { S.P.yaw = i / 12 * Math.PI * 2; S.advance(16); }   // warm up: every direction once
      gl.finish();
      const ms = [];
      for (let i = 0; i < n; i++) { S.P.yaw = i / n * Math.PI * 2; S.P.pitch = -0.04; const t = performance.now(); S.advance(16); gl.finish(); ms.push(performance.now() - t); }
      ms.sort((a, b) => a - b);
      return { med: +ms[ms.length >> 1].toFixed(2), p90: +ms[Math.floor(ms.length * 0.9)].toFixed(2), mean: +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2), gpu: (() => { const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })() };
    }, FRAMES);
    (res[name] = res[name] || []).push(r);
    console.log('ronda ' + (round + 1) + ' · ' + name.padEnd(13) + ' mediana ' + r.med + ' ms · p90 ' + r.p90 + ' ms');
    await ctx.close();
  }
  const base = res.base ? Math.min(...res.base.map(x => x.med)) : 0;
  console.log('\nlo mejor de ' + ROUNDS + ' rondas (mediana por fotograma, CPU + GPU hasta terminar):');
  for (const [name] of VARIANTS) { const best = Math.min(...res[name].map(x => x.med)); console.log('  ' + name.padEnd(13) + String(best).padStart(6) + ' ms' + (name === 'base' ? '' : '   ' + (best - base >= 0 ? '+' : '') + (best - base).toFixed(2) + ' ms frente a base')); }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
