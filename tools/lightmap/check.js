const { chromium } = require('playwright');
const ss = require('../static-server.js');
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  p.on('console', m => { if (/horneado|lightmap|lm/i.test(m.text())) console.log('consola', m.text().slice(0, 300)); });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=1&lm=1');
  await p.waitForTimeout(15000);
  console.log(await p.evaluate(() => JSON.stringify({ on: __SD.LM.on, ready: __SD.LM.ready, failed: __SD.LM.failed, res: __SD.LM.res && { m: __SD.LM.res.meshes, v: __SD.LM.res.verts, s: __SD.LM.res.skipped }, ix: __SD.LM.index,
    names: __SD.CASAS.meshes.slice(0, 40).map(m => m.name + '#' + m.geometry.attributes.position.count + (m.geometry.attributes.uv2 ? '*' : '')) })));
  await b.close(); srv.close();
})();
