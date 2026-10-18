/* CASA ATLAS vs the other maps: draw calls, triangles, texture memory and a RELATIVE render cost (ms per frame in
   software WebGL on this machine: only useful to compare maps with each other, never a phone's FPS).
   node tools/casa/perf.js OUT.json   (env Q=alto,bajo  URLX=pueblo=3  TIME=1: also time frames, GPU-synchronous —
   with software WebGL that takes seconds per frame and says nothing about phones) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const OUT = process.argv[2] || 'perf.json', QS = (process.env.Q || 'alto,medio,bajo').split(','), URLX = process.env.URLX || 'pueblo=3';
const VIEWS = {
  casa: [['spawnA', -7.45, 0, 0.95, -Math.PI / 2, 0], ['salon', -4.2, 0, 4.6, -0.8, 0], ['cocina', 4.6, 0, 0.3, -0.5, 0], ['pasillo', 2.4, 0, -2.5, Math.PI / 2, 0]],
  arena: [['oeste', -21, 0, 0, -Math.PI / 2, 0.02], ['sur', 0, 0, 14.5, 0, -0.04], ['centro', -9, 0, -8, -0.9, 0], ['este', 21, 0, 3, Math.PI / 2, 0]],
  pueblo: [['calle', 1.5, 0, 12, Math.PI, 0.03], ['plaza', 9, 0, -8, 2.65, 0.02], ['fachada', -9, 0, 17, 2.76, 0.12], ['esquina', -21, 0, -19, 0.69, 0.05]],
};
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const rows = [];
  for (const q of QS) {
    const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 3 })); } catch (e) {} }, q);
    const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto(srv.url + '?vm=1&casa=1&' + URLX);
    await p.waitForFunction(() => window.__SD && __SD.W && (!__SD.P3ON || __SD.P3W.kit) && (!__SD.FLORA.on || __SD.FLORA.ready || __SD.FLORA.failed), null, { timeout: 180000 });
    await p.evaluate(() => { __SD.setTrain('off'); __SD.setMode('duel'); __SD.startMatch(); __SD.setWorld('casa'); });
    await p.waitForFunction(() => __SD.CASA.ready, null, { timeout: 120000 });
    for (const world of Object.keys(VIEWS)) {
      const r = await p.evaluate(([world, views, timed]) => {
        const S = __SD, R = S.renderer; S.setWorld(world); S.freeze(true); S.SHOT.noVM = true; S.MANUAL.on = true;
        for (const bt of S.BOTS) { bt.g.visible = false; if (bt.glint) bt.glint.visible = false; }
        const out = [];
        for (const [name, x, y, z, yaw, pitch] of views) {
          Object.assign(S.PM, { x, y, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y, z }); S.P.yaw = yaw; S.P.pitch = pitch;
          S.advance(16); S.advance(16);
          R.info.autoReset = false; R.info.reset(); S.advance(16); const i = R.info.render, calls = i.calls, tris = i.triangles; R.info.autoReset = true;
          const gl = R.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // waits for the GPU
          let ms = 0; if (timed) { sync(); const t0 = performance.now(); for (let k = 0; k < 6; k++) { S.advance(16); sync(); } ms = (performance.now() - t0) / 6; }
          out.push({ name, calls, tris, ms: +ms.toFixed(1) });
        }
        return { out, tex: R.info.memory.textures, geo: R.info.memory.geometries };
      }, [world, VIEWS[world], process.env.TIME === '1']);
      const avg = k => +(r.out.reduce((s, v) => s + v[k], 0) / r.out.length).toFixed(1);
      rows.push({ q, world, calls: avg('calls'), tris: Math.round(avg('tris')), ms: avg('ms'), views: r.out });
      console.log(q.padEnd(6), world.padEnd(7), 'llamadas', avg('calls'), '· triángulos', Math.round(avg('tris')), '· ms/fotograma (relativo)', avg('ms'));
    }
    await ctx.close();
  }
  require('fs').writeFileSync(OUT, JSON.stringify(rows, null, 1));
  await b.close(); srv.close(); process.exit(0);
})();
