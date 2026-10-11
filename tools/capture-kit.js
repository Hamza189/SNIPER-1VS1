/* Photographs the kit sheets (tools/kit-viewer.html): node tools/capture-kit.js OUT_DIR
   Real renders of the kit by the game's engine (Three.js), not Blender renders. */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.';
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 560 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  for (const set of ['openings', 'ornaments', 'props', 'street']) {
    await p.goto(srv.url + 'tools/kit-viewer.html?set=' + set);
    await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
    await p.screenshot({ path: OUT + '/kit-' + set + '.png', timeout: 180000 }); console.log('kit-' + set);
  }
  await b.close(); srv.close(); process.exit(0);
})();
