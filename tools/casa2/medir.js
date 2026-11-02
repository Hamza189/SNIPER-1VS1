/* CASA ATLAS (original) · CASA ATLAS 2.0 · CASA ATLAS XL, medidos igual (02-11-2026, docs/CASA-ATLAS-2.md): lo que se
   descarga del mapa, cuánto tarda en estar listo, llamadas de dibujo, triángulos, texturas en la GPU (estimadas por el
   juego) y ms por fotograma en 3 vistas. Una página nueva por mapa (nada se comparte entre medidas).
   node tools/casa2/medir.js [SALIDA.json]     env GPU=1: la GPU del PC (ms reales de ESTE PC, no del iPhone) · Q=alto */
'use strict';
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const PI = Math.PI, gpu = process.env.GPU === '1', Q = process.env.Q || 'alto';
const MAPS = {
  casa: { q: '&casa=1', ready: '__SD.CASA.ready', views: [[-7.45, 0.95, -PI / 2], [-4.2, 4.6, -0.8], [4.6, 0.3, -0.5]] },
  casa2: { q: '&casa=1&casa2=1', ready: '__SD.C2.ready', views: [[-17.94, -8.63, -PI / 2], [-20.2, 0.6, -PI / 2], [0.3, -15.8, PI]] },
  casaxl: { q: '&casa=1', ready: '__SD.XL.ready&&__SD.XL.roof', views: [[-14, -8, -PI / 2], [0, 0, 0], [10, 10, PI]] },
};
(async () => {
  const srv = await ss.start(), rows = [];
  const b = await chromium.launch(gpu ? { args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] } : { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const id of Object.keys(MAPS)) {
    const M = MAPS[id], ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 3 })); } catch (e) {} }, Q);
    const p = await ctx.newPage(), bytes = {};
    p.on('response', async r => { const u = r.url(); if (/assets\/maps\//.test(u)) { try { bytes[u.split('/').pop().split('?')[0]] = (await r.body()).length; } catch (e) {} } });
    await p.goto(srv.url + '?vm=1&ktx2=0' + M.q, { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.W && __SD.WORLDS, null, { timeout: 180000 });
    const tex0 = await p.evaluate(() => __SD.perfTexMB().real);
    const t0 = Date.now();
    await p.evaluate(id => { const S = __SD; S.setTrain('off'); S.setMode('duel'); S.setDuelLethal(false); S.setOffMap(id); S.startMatch(); }, id);
    await p.waitForFunction(M.ready + '&&__SD.state==="playing"', null, { timeout: 240000 });
    const loadMs = Date.now() - t0;
    const r = await p.evaluate(([views, timed]) => {
      const S = __SD, R = S.renderer, gl = R.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      S.freeze(true); S.MANUAL.on = true; for (const bt of S.BOTS) { bt.g.visible = false; if (bt.glint) bt.glint.visible = false; }
      const out = [];
      for (const [x, z, yaw] of views) {
        Object.assign(S.PM, { x, y: 0, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y: 0, z }); S.P.yaw = yaw; S.P.pitch = 0;
        for (let k = 0; k < 4; k++) S.advance(16);
        R.info.autoReset = false; R.info.reset(); S.advance(16); const calls = R.info.render.calls, tris = R.info.render.triangles; R.info.autoReset = true;
        let ms = 0; if (timed) { sync(); const t = performance.now(); for (let k = 0; k < 40; k++) { S.advance(16); sync(); } ms = (performance.now() - t) / 40; }
        out.push({ calls, tris, ms: +ms.toFixed(2) });
      }
      return { out, tex: S.perfTexMB().real, ntex: R.info.memory.textures, geo: R.info.memory.geometries };
    }, [M.views, gpu]);
    const avg = k => +(r.out.reduce((s, v) => s + v[k], 0) / r.out.length).toFixed(1);
    const row = { map: id, q: Q, gpu, descarga_MB: +(Object.values(bytes).reduce((s, v) => s + v, 0) / 1048576).toFixed(2), archivos: bytes, listo_ms: loadMs,
      llamadas: avg('calls'), triangulos: Math.round(avg('tris')), ms: gpu ? avg('ms') : null, texturas_MB_total: +r.tex.toFixed(1), texturas_MB_del_mapa: +(r.tex - tex0).toFixed(1), n_texturas: r.ntex, geometrias: r.geo };
    rows.push(row);
    console.log(id.padEnd(7), 'descarga', row.descarga_MB, 'MB · listo', loadMs, 'ms · llamadas', row.llamadas, '· triángulos', row.triangulos, gpu ? '· ' + row.ms + ' ms/fotograma' : '', '· texturas del mapa', row.texturas_MB_del_mapa, 'MB');
    await ctx.close();
  }
  if (process.argv[2]) require('fs').writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
  await b.close(); srv.close(); process.exit(0);
})();
