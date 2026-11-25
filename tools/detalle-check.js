/* MÁS DETALLE: cuántas calcomanías y objetos se crearon en cada mapa y dónde (depuración). node tools/detalle-check.js */
const { chromium } = require('playwright');
const ss = require('./static-server.js');
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.addInitScript(() => localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 2 })));
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (/detalle/.test(m.text())) console.log('consola', m.text()); });
  await p.goto(srv.url + '?vm=1&detalle=1');
  await p.waitForFunction(() => window.__SD && __SD.P3W && __SD.P3W.kit, null, { timeout: 120000 });
  await p.evaluate(() => __SD.setWorld('barrio')); await p.waitForFunction(() => __SD.BAR.ready || __SD.BAR.failed, null, { timeout: 90000 });
  console.log(await p.evaluate(() => {
    const C = __SD.WORLDS.pueblo.colliders, tall = C.filter(c => c.maxY - c.minY >= 2.4 && c.minY <= 0.5);
    const at = (x, y, z) => C.filter(c => x > c.minX && x < c.maxX && y > c.minY && y < c.maxY && z > c.minZ && z < c.maxZ).map(c => [c.minX, c.minY, c.minZ, c.maxX, c.maxY, c.maxZ].map(v => +(+v).toFixed(1)).join(','));
    const B = C.map(c => ({ a: [c.minX, c.minY, c.minZ], b: [c.maxX, c.maxY, c.maxZ] }));
    const r1 = SDDetalle.plan({ boxes: B, bounds: [-48.5, -48.5, 48.5, 48.5] }), r2 = SDDetalle.plan({ boxes: B, bounds: [-48.5, -48.5, 48.5, 48.5], skip: (x, z) => !!SDCasas.inside(x, z, 0.4) });
    const base = { boxes: B, bounds: [-48.5, -48.5, 48.5, 48.5] }, tries = {};
    for (const [k, v] of [['seed', 20261125], ['posters', true], ['groundY', () => 0.02], ['skip', (x, z) => Math.hypot(x, z) < 5]]) tries[k] = SDDetalle.plan(Object.assign({}, base, { [k]: v })).faces;
    const before = JSON.stringify(__SD.DET.stats.pueblo); __SD.DET.done.pueblo = false; __SD.detBuild('pueblo');
    return JSON.stringify({ tries, before, again: __SD.DET.stats.pueblo, planFaces: r1.faces, planFacesSkip: r2.faces, n: C.length, tall: tall.length, sample: tall.slice(0, 3), inStreet: at(0, 1, 38), inStreet2: at(0.5, 0.3, 20), types: [...new Set(C.slice(0, 50).map(c => typeof c.minX))] });
  }));
  console.log(await p.evaluate(() => {
    const out = { stats: __SD.DET.stats, meshes: [] };
    __SD.scene.traverse(o => { if (/^detalle_/.test(o.name)) { const g = o.geometry; g.computeBoundingBox(); const bb = g.boundingBox;
      out.meshes.push({ n: o.name, vis: o.visible, verts: g.attributes.position.count, bb: [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map(v => +v.toFixed(1)), parent: o.parent && o.parent.type }); } });
    return JSON.stringify(out, null, 1);
  }));
  await b.close(); srv.close();
})();
