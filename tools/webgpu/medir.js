/* ENGINE NEXT GENERATION, paso 8 (10-11-2026): mide la misma escena del PUEBLO con r128 (el juego, WebGL), r186 WebGL y
   r186 WebGPU, en la GPU del PC, al tamaño del iPhone (932×430) con ×2 o ×3 píxeles. Cada fotograma se cronometra hasta
   que la GPU lo termina. Saca también una captura de cada uno para comparar el aspecto.
   La GPU del PC NO es la del iPhone: vale para comparar los tres entre sí en esta máquina.
   node tools/webgpu/medir.js [salida.json]    env DPR=3 · N=240 · ROUNDS=3 */
'use strict';
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const fs = require('fs'), path = require('path');
const DPR = +(process.env.DPR || 3), N = +(process.env.N || 240), ROUNDS = +(process.env.ROUNDS || 3);
(async () => {
  const srv = await ss.start(), url = srv.url.replace('127.0.0.1', 'localhost');   // WebGPU needs a secure context
  // Google Chrome (channel): Playwright's own Chromium has no dxil.dll, so its WebGPU cannot make a device on Windows
  const b = await chromium.launch({ channel: process.env.CH || 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const out = [];
  for (let r = 0; r < ROUNDS; r++) for (const [name, page] of [['r128 WebGL (juego)', 'tools/webgpu/bench128.html'], ['r186 WebGL', 'tools/webgpu/bench.html?r=gl'], ['r186 WebGPU', 'tools/webgpu/bench.html?r=gpu']]) {
    const ctx = await b.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: DPR }), p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(url + page + (page.includes('?') ? '&' : '?') + 'n=' + N);
    const o = await p.waitForFunction(() => window.OUT, null, { timeout: 300000 }).then(h => h.jsonValue());
    if (r === 0) await p.screenshot({ path: path.join('.work', 'webgpu', name.replace(/[^a-z0-9]+/gi, '_') + '.png') });
    o.nombre = name; o.ronda = r + 1; if (errs.length) o.errores = errs.slice(0, 3);
    console.log(name.padEnd(20), JSON.stringify(o.error ? o : { backend: o.backend, px: o.px, fps: o.fps, fotograma: o.fotograma, cpu: o.cpuRender, llamadas: o.llamadas, tri: o.triangulos }));
    out.push(o); await ctx.close();
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  await b.close(); srv.close();
})();
