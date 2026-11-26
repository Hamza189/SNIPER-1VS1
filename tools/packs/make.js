/* PAQUETES DE TEXTURAS POR MAPA y versiones para cargar por distancia (25-11-2026, docs/TEXTURAS-DISTANCIA.md).
     node tools/packs/make.js            → lista, versiones pequeñas, KTX2 y client/packs.js
     node tools/packs/make.js --lista    → solo lista qué texturas pide cada mapa
   1. Abre el juego (ALTO) y apunta qué texturas de assets/tex/ pide el PUEBLO y cuáles el BARRIO.
   2. Versión pequeña de cada una (lado ≤ 256 px, JPG) en assets/tex/lo/: con ella arranca el mapa.
   3. Versión KTX2 (UASTC, la del sistema de siempre, docs/KTX2.md) en assets/tex/ktx2/: la que se carga al acercarse.
      Se codifica desde la imagen volteada en vertical (los JPG se cargan con flipY y los KTX2 no), con mipmaps.
      Como el resto de KTX2, va a Cloudflare R2 (node tools/r2-subir.js) y no al repositorio.
   4. client/packs.js: el paquete de cada mapa (texturas y tamaños), que el juego lleva dentro. */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), WORK = path.join(__dirname, '.work');
const ONLY_LIST = process.argv.includes('--lista');
(async () => {
  fs.mkdirSync(WORK, { recursive: true });
  const { chromium } = require('playwright');
  const ss = require('../static-server.js');
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.addInitScript(() => localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 2 })));
  const p = await ctx.newPage(); let phase = 'pueblo'; const got = { pueblo: new Set(), barrio: new Set() };
  p.on('request', r => { const m = r.url().match(/assets\/tex\/([a-z0-9_]+)\.jpg/); if (m) got[phase].add(m[1]); });
  await p.goto(srv.url + '?vm=1&stream=0');
  await p.waitForFunction(() => window.__SD && __SD.P3W && __SD.P3W.kit, null, { timeout: 180000 });
  await p.waitForTimeout(2000);
  phase = 'barrio';
  await p.evaluate(() => __SD.setWorld('barrio')); await p.waitForFunction(() => __SD.BAR.ready || __SD.BAR.failed, null, { timeout: 90000 });
  await p.waitForTimeout(2000);
  // which textures the meshes of each map really use (the loading screen asks for everything at the start, so the order
  // of the downloads does not tell)
  const used = await p.evaluate(() => {
    const out = {};
    for (const id of ['pueblo', 'barrio']) {
      const s = new Set();
      for (const o0 of __SD.WORLDS[id].objs) o0.traverse(o => { if (!o.material) return; for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap']) {
        const t = m[k], src = t && t.image && (t.image.currentSrc || t.image.src); const mm = src && String(src).match(/assets\/tex\/([a-z0-9_]+)\.jpg/); if (mm) s.add(mm[1]); } });
      out[id] = [...s];
    }
    return out;
  });
  await b.close(); srv.close();
  got.pueblo = new Set(used.pueblo.filter(k => got.pueblo.has(k) || got.barrio.has(k))); got.barrio = new Set(used.barrio);
  // a texture both maps use goes in the PUEBLO's pack (loaded first); the BARRIO's pack has only its own
  for (const k of got.pueblo) got.barrio.delete(k);
  const maps = { pueblo: [...got.pueblo].sort(), barrio: [...got.barrio].sort() };
  console.log('PUEBLO', maps.pueblo.length, 'texturas · BARRIO', maps.barrio.length);
  if (ONLY_LIST) { console.log(JSON.stringify(maps, null, 1)); return; }
  const all = [...maps.pueblo, ...maps.barrio];
  // 2 + flipped PNG sources for 3 (Python + Pillow)
  fs.writeFileSync(path.join(WORK, 'list.json'), JSON.stringify(all));
  const py = spawnSync('python3', [path.join(__dirname, 'lo.py'), path.join(WORK, 'list.json'), WORK], { stdio: 'inherit' });
  if (py.status) process.exit(py.status);
  // 3: KTX2, only what is missing or older than its JPG
  const jobs = [];
  fs.mkdirSync(path.join(ROOT, 'assets', 'tex', 'ktx2'), { recursive: true });
  for (const k of all) {
    const out = path.join(ROOT, 'assets', 'tex', 'ktx2', k + '.ktx2'), src = path.join(ROOT, 'assets', 'tex', k + '.jpg');
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(src).mtimeMs) continue;
    jobs.push({ in: path.join(WORK, k + '_flip.png'), out, kind: /_n$/.test(k) ? 'normal' : /_r$/.test(k) ? 'linear' : 'srgb', rdo: 1 });
  }
  if (jobs.length) {
    fs.writeFileSync(path.join(WORK, 'jobs.json'), JSON.stringify(jobs));
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'ktx2', 'encode.js'), path.join(WORK, 'jobs.json')], { stdio: 'inherit' });
    if (r.status) process.exit(r.status);
  }
  // 4: the packs
  const size = f => fs.existsSync(f) ? fs.statSync(f).size : 0, dim = JSON.parse(fs.readFileSync(path.join(WORK, 'dims.json'), 'utf8'));
  const packs = {};
  for (const id in maps) packs[id] = maps[id].map(k => ({ k, w: dim[k][0], h: dim[k][1],
    lo: size(path.join(ROOT, 'assets/tex/lo', k + '.jpg')), jpg: size(path.join(ROOT, 'assets/tex', k + '.jpg')), ktx2: size(path.join(ROOT, 'assets/tex/ktx2', k + '.ktx2')) }));
  const sum = (id, f) => packs[id].reduce((s, e) => s + e[f], 0);
  const js = `/* SNIPER DUEL — PAQUETES DE TEXTURAS POR MAPA (generado por tools/packs/make.js el ${new Date().toISOString().slice(0, 10)}; no editar a mano).
   Para cada mapa, las texturas de assets/tex/ que pide: k (nombre), w × h, y lo que pesa cada versión en bytes:
   lo (assets/tex/lo/, ≤ 256 px, con la que arranca), jpg (la de siempre) y ktx2 (assets/tex/ktx2/, en R2).
   docs/TEXTURAS-DISTANCIA.md. Puro: Node y navegador. */
(function (root) {
'use strict';
const PACKS = ${JSON.stringify(packs)};
const SDPacks = { PACKS, keys: id => new Set((PACKS[id] || []).map(e => e.k)), all: () => new Set(Object.values(PACKS).flat().map(e => e.k)) };
if (typeof module !== 'undefined' && module.exports) module.exports = SDPacks; else root.SDPacks = SDPacks;
})(typeof window !== 'undefined' ? window : globalThis);
`;
  fs.writeFileSync(path.join(ROOT, 'client', 'packs.js'), js);
  for (const id in packs) console.log(id + ': ' + packs[id].length + ' texturas · pequeñas ' + (sum(id, 'lo') / 1e6).toFixed(2) + ' MB · JPG ' + (sum(id, 'jpg') / 1e6).toFixed(2) + ' MB · KTX2 ' + (sum(id, 'ktx2') / 1e6).toFixed(2) + ' MB');
})().catch(e => { console.error(e); process.exit(1); });
