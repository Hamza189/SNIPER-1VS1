/* La imagen que sale al compartir el enlace del juego (WhatsApp, redes): el menú principal con tu operador, 1200 × 630,
   en assets/app/compartir.jpg (la lee la etiqueta og:image de la página). Repetirla cuando cambie el menú.
   Uso: node tools/compartir.js            (GPU=1: con la tarjeta gráfica del PC; si no, WebGL por software) */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const ss = require('./static-server.js');

(async () => {
  const srv = await ss.start();
  const gpu = process.env.GPU === '1';
  const b = await chromium.launch({ args: gpu ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', mute: true, v: 3 })); localStorage.setItem('sniperduel_skin', '"militar"'); } catch (e) {} });
  const p = await ctx.newPage();
  await p.goto(srv.url + '?carga=1', { timeout: 180000 });
  await p.waitForFunction(() => window.__SD && __SD.M2 && __SD.M2.on && __SD.PJ2 && Object.keys(__SD.PJ2.tpls).length > 0, null, { timeout: 180000 });
  await p.waitForTimeout(6000);   // the operator's 3D model and the room's textures
  const out = path.join(__dirname, '..', 'assets', 'app', 'compartir.jpg');
  await p.screenshot({ path: out, type: 'jpeg', quality: 86 });
  console.log('hecho:', out);
  await b.close(); await srv.close();
})().catch(e => { console.error(e); process.exit(1); });
