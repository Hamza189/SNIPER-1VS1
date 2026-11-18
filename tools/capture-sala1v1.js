/* SALA 1V1 (?lobby=2): captures of the room on the screens that matter, with the real GPU (ANGLE d3d11) and the local server.
   Two players: the host on the screen being captured, the guest on a PC page. Screens: the owner's iPhone in landscape with
   Safari's bars (932 × 320, 3×), the same without bars (932 × 430), an Android in landscape (800 × 360), an iPhone held
   upright (430 × 932) and a PC (1600 × 900).
   Run: node tools/capture-sala1v1.js <folder> [prefix]      (Playwright 1.56 with Chromium) */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { startServer } = require('../server/node.js');
const statics = require('./static-server.js');
const out = process.argv[2] || 'docs/sala1v1', pre = process.argv[3] || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (p, fn, a, ms) => { try { await p.waitForFunction(fn, a, { timeout: ms || 60000, polling: 250 }); return true; } catch (e) { return false; } };
const SCREENS = [
  { id: 'iphone-safari', w: 932, h: 320, dpr: 3, touch: true },
  { id: 'iphone', w: 932, h: 430, dpr: 3, touch: true },
  { id: 'android', w: 800, h: 360, dpr: 2.6, touch: true },
  { id: 'iphone-vertical', w: 430, h: 932, dpr: 3, touch: true },
  { id: 'pc', w: 1600, h: 900, dpr: 1, touch: false }
];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await startServer({ port: 0 }), web = await statics.start(), server = 'http://127.0.0.1:' + srv.port;
  const b = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const open = async (sc, q) => {
    const c = await b.newContext({ viewport: { width: sc.w, height: sc.h }, deviceScaleFactor: sc.dpr, hasTouch: sc.touch, isMobile: sc.touch });
    await c.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await c.newPage(); await p.goto(web.url + '?server=' + encodeURIComponent(server) + '&lobby=2' + (q || ''), { timeout: 120000 });
    await p.waitForFunction(() => window.__SD, null, { timeout: 120000 }); return p;
  };
  const shot = async (p, name) => { await sleep(1500); await p.screenshot({ path: path.join(out, pre + name + '.png') }); console.log('  ' + pre + name); };
  for (const sc of SCREENS) {
    const A = await open(sc);
    await A.evaluate(() => { __SD.SETTINGS.showFps = true; __SD.gfxApply(); });   // the owner has the FPS counter on
    await A.click('#m2 .m2Mode[data-sel=online]');
    await until(A, () => __SD.LB.pv && __SD.LB.pv[0].visible, null, 120000);
    await A.fill('#lbName', 'Hamza'); await A.click('#lbCreate');
    await until(A, () => /^[A-Z0-9]{6}$/.test(document.getElementById('lbCodeTopTxt').textContent));
    await A.evaluate(() => { if (__SD.LB.inv) document.getElementById('lbInvClose').click(); });
    await shot(A, sc.id + '-1-solo');
    const code = await A.textContent('#lbCodeTopTxt');
    const B = await open(SCREENS[4], '&sala=' + code);
    await until(B, () => !document.getElementById('lbHome').hidden); await B.fill('#lbName', 'Faisal'); await B.click('#lbJoin');
    await until(A, () => document.getElementById('lbCount').textContent === '2/2' && __SD.LB.pv[1].visible, null, 120000);
    await A.click('#lbReady');
    await shot(A, sc.id + '-2-rival');
    await B.context().close(); await A.context().close();
  }
  await b.close(); web.close(); await srv.close();
})();
