/* Exporta el PUEBLO tal como lo monta el juego a un GLB (para tools/webgpu/bench*.html y para verlo en Blender; no es
   parte del juego). Lo llama tools/webgpu/preparar.js.   node tools/webgpu/exportar-pueblo.js SALIDA.glb */
const { chromium } = require('playwright'); const path = require('path'); const DIR = path.join(__dirname, '..', '..', '.work', 'webgpu'); const ss = require('../static-server.js'); const fs = require('fs');
(async () => { const srv = await ss.start(); const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (/E10/.test(m.text())) console.log(m.text()); });
  await p.goto(srv.url + '?ktx2=0', { timeout: 180000 }); await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.W, null, { timeout: 180000 });
  await p.evaluate(() => { __SD.setWorld('pueblo'); }); await new Promise(r => setTimeout(r, 25000));   // textures and the town models
  await p.addScriptTag({ path: path.join(DIR, 'GLTFExporter.js') });
  const out = await p.evaluate(async () => {
    const T = THREE, S = __SD, root = new T.Group(); root.name = 'PUEBLO';
    const objs = S.WORLDS.pueblo.objs.filter(o => o.visible);
    if (S.E10 && S.E10.root && !objs.includes(S.E10.root)) { console.log('E10 aparte'); objs.push(S.E10.root); }
    console.log('E10', !!(S.E10 && S.E10.root), S.E10 && S.E10.ready);
    for (const o of objs) { const c = o.clone(true); c.matrixAutoUpdate = false; c.matrix.copy(o.matrixWorld); root.add(c); }
    // drop what cannot be drawn by a viewer (points, sprites, invisible bullet proxies)
    const kill = []; root.traverse(o => { if (o.isPoints || o.isSprite || o.isLine || (o.isMesh && o.material && !Array.isArray(o.material) && o.material.visible === false)) kill.push(o); });
    for (const o of kill) o.parent && o.parent.remove(o);
    let tris = 0; root.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    const glb = await new Promise((res, rej) => new T.GLTFExporter().parse(root, res, { binary: true, onlyVisible: true, maxTextureSize: 1024, embedImages: true }));
    const u8 = new Uint8Array(glb); let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    return { b64: btoa(s), n: objs.length, tris: Math.round(tris) };
  });
  fs.writeFileSync(process.argv[2], Buffer.from(out.b64, 'base64')); console.log('objetos', out.n, '· triángulos', out.tris, '·', (fs.statSync(process.argv[2]).size / 1048576).toFixed(1), 'MB');
  await b.close(); srv.close(); })();
