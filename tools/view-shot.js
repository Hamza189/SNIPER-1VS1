/* Screenshots of tools/viewer.html: node tools/view-shot.js OUT.png "obj=VIBORA9&yaw=90&dist=0.3" [more query strings → a grid] */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
(async () => {
  const out = process.argv[2], qs = process.argv.slice(3);
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +(process.env.VW || 640), height: +(process.env.VH || 480) } });
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'log') console.log('LOG', m.text()); });
  const files = [];
  for (let i = 0; i < qs.length; i++) {
    await p.goto(srv.url + 'tools/viewer.html?' + qs[i]);
    await p.waitForFunction(() => window.VIEW && VIEW.ready, null, { timeout: 30000 });
    const info = await p.evaluate(() => ({ tris: VIEW.tris, error: VIEW.error }));
    if (i === 0) console.log(JSON.stringify(info));
    const f = out.replace(/\.png$/, '') + '-' + i + '.png'; await p.screenshot({ path: f }); files.push(f);
  }
  await b.close(); srv.close();
  console.log(files.join(' '));
})();
