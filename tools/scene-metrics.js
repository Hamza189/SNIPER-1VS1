/* Scene metrics for the before/after table (PUEBLO 2.0 vs PUEBLO 3.0 slice), per graphics profile, with
   and without bots: draw calls and triangles at the four P3-4 cameras, time until the scene is complete,
   texture memory, and a relative frame cost.
   node tools/scene-metrics.js OUT.json
   Software WebGL (swiftshader): calls / triangles / memory are exact; times are NOT phone performance. */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || 'metrics.json';
const VIEWS = [['calle', 1.5, 0, 12, Math.PI, 0.03], ['plaza', 9, 0, -8, 2.65, 0.02], ['fachada', -9, 0, 17, 2.76, 0.12], ['general', 8, 9, -12, 2.83, -0.25]];
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const rows = [];
  for (const flag of ['', '&pueblo=3']) for (const q of ['bajo', 'medio', 'alto']) for (const bots of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 1170, height: 540 }, deviceScaleFactor: 1 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 2 })); } catch (e) {} }, q);
    const p = await ctx.newPage();
    const t0 = Date.now();
    await p.goto(srv.url + '?vm=1' + flag);
    await p.waitForFunction(f => window.__SD && __SD.W && (!f || (__SD.P3W && __SD.P3W.kit)), !!flag, { timeout: 120000 });
    const ready = await p.evaluate(() => Math.round(__SD.P3W && __SD.P3W.loadedAt || performance.now()));
    const r = await p.evaluate(([bots]) => {
      const S = __SD; S.setTrain('off'); S.setMode('duel'); S.startMatch(); S.setWorld('pueblo'); S.freeze(true); S.SHOT.noVM = true; S.MANUAL.on = true;
      const out = {};
      const VIEWS = [['calle', 1.5, 0, 12, Math.PI, 0.03], ['plaza', 9, 0, -8, 2.65, 0.02], ['fachada', -9, 0, 17, 2.76, 0.12], ['general', 8, 9, -12, 2.83, -0.25]];
      // bots: put the three of them in view of every camera (standing in the plaza and the street)
      const spots = [[3, 0, 6], [-2, 0, 16], [6, 0, -2]];
      S.BOTS.forEach((bt, i) => { if (!bots) { bt.g.visible = false; if (bt.glint) bt.glint.visible = false; } else if (spots[i]) { bt.alive = true; bt.g.visible = true; bt.g.position.set(...spots[i]); } });
      for (const [name, x, y, z, yaw, pitch] of VIEWS) {
        Object.assign(S.PM, { x, y, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y, z }); S.P.yaw = yaw; S.P.pitch = pitch;
        S.advance(16);
        const rr = S.renderer; rr.info.autoReset = false; rr.info.reset();
        const t = performance.now(); S.advance(16); const ms = performance.now() - t;
        out[name] = { calls: rr.info.render.calls, tris: rr.info.render.triangles, ms: Math.round(ms) }; rr.info.autoReset = true;
      }
      // texture memory: every texture the scene uses (with mipmaps)
      const seen = new Set(); let bytes = 0;
      S.scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) { const t = m && m[k]; if (!t || seen.has(t.uuid) || !t.image) continue; seen.add(t.uuid); const w = t.image.width || 0, h = t.image.height || 0; bytes += w * h * 4 * 1.33; } });
      out.texMB = Math.round(bytes / 1048576 * 10) / 10; out.textures = seen.size;
      out.geometries = S.renderer.info.memory.geometries;
      return out;
    }, [bots]);
    rows.push({ pueblo: flag ? '3.0' : '2.0', q, bots, readyMs: ready, ...r });
    console.log(flag ? '3.0' : '2.0', q, bots ? 'bots' : '-', 'listo ' + ready + ' ms', JSON.stringify(r));
    await ctx.close();
  }
  require('fs').writeFileSync(OUT, JSON.stringify(rows, null, 1));
  await b.close(); srv.close(); process.exit(0);
})();
