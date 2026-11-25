/* depuración del horneado: el código del sombreado de un material «+lm» tal y como lo compila la GPU.
   node tools/lightmap/probe.js [bajo|alto] [material] */
const { chromium } = require('playwright');
const ss = require('../static-server.js');
(async () => {
  const q = process.argv[2] || 'bajo', mat = process.argv[3] || 'kit_slabs';
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.addInitScript(q => { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 2 })); }, q);
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=1&lm=1');
  await p.waitForFunction(() => window.__SD && __SD.LM.ready, null, { timeout: 120000 });
  await p.evaluate(() => { __SD.setWorld('pueblo'); __SD.renderer.compile(__SD.scene, __SD.camera); });
  console.log(await p.evaluate(mat => {
    const S = __SD, r = S.renderer, gl = r.getContext(); let m = null;
    S.scene.traverse(o => { if (!m && o.material && o.material.name === mat + '+lm') m = o.material; });
    if (!m) return 'sin material ' + mat + '+lm';
    const pr = r.properties.get(m), prog = pr.program || (pr.programs && [...pr.programs.values()][0]);
    if (!prog) return 'sin programa';
    const sh = gl.getAttachedShaders(prog.program).map(s => gl.getShaderSource(s)), fs = sh.find(s => /gl_FragColor|pc_fragColor/.test(s) && /sdLm/.test(s)) || sh[1];
    const i = fs.indexOf('sdLmSun'), j = fs.indexOf('getDirectionalDirectLightIrradiance( directionalLight');
    return 'shadowMap ' + r.shadowMap.enabled + ' · USE_SHADOWMAP ' + /#define USE_SHADOWMAP/.test(fs) + ' · USE_AOMAP ' + /#define USE_AOMAP/.test(fs) + '\n' + fs.slice(j - 50, j + 700);
  }, mat));
  await b.close(); srv.close();
})();
