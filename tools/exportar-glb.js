/* Exporta a GLB (para verlo en Blender o en cualquier visor; no es parte del juego) lo que monta la página:
     casas-habitables.glb — las 8 casas habitables con sus piezas del kit (contraventanas, balcones, faroles…), una por grupo
     fuente.glb           — la fuente de la plaza con su agua (el agua animada se exporta quieta: el GLB no lleva shaders)
     pueblo3.glb          — el PUEBLO 3.0 entero, tal como se ve (sin los proxies invisibles de las balas)
   Las piezas del kit van «instanciadas» en el juego (una malla, muchas copias); aquí se convierten en mallas normales.
     pueblo4-ligero.glb   — el mismo pueblo en una malla por material y texturas de 512 px (referencia/arte, PUEBLO 4.0)
   Uso: node tools/exportar-glb.js CARPETA_DE_SALIDA [casas,fuente,pueblo,pueblo-ligero]     (necesita playwright; tarda unos minutos con WebGL por software) */
'use strict';
const { chromium } = require('playwright'), path = require('path'), fs = require('fs'), ss = require('./static-server.js');
const OUT = process.argv[2] || path.join(__dirname, '..', '.work', 'glb');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await ss.start(); const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=0&pueblo=4&ktx2=0', { timeout: 180000 });
  await p.waitForFunction(() => window.__SD && __SD.W && __SD.P3W && __SD.P3W.kit && (!__SD.E10.on || __SD.E10.ready || __SD.E10.failed), null, { timeout: 240000 });
  await p.evaluate(() => __SD.setWorld('pueblo')); await p.waitForTimeout(8000);   // textures
  await p.addScriptTag({ path: path.join(__dirname, 'caja', 'GLTFExporter.js') });
  const run = async (what) => p.evaluate(async (what) => {
    const S = __SD, T = THREE;
    // an InstancedMesh → plain meshes (one per instance, with its colour baked into the vertex colours)
    const unInstance = (im, keep) => { const out = new T.Group(); out.name = im.name; const M = new T.Matrix4(), c = new T.Color();
      for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, M); const W = new T.Matrix4().multiplyMatrices(im.matrixWorld, M);
        const pos = new T.Vector3().setFromMatrixPosition(W); if (keep && !keep(pos)) continue;
        const g = new T.BufferGeometry(), src = im.geometry;   // plain (not interleaved) copies: the exporter needs them
        for (const k in src.attributes) { if (k === 'skinIndex' || k === 'skinWeight') continue; const at = src.attributes[k], n = at.count, sz = at.itemSize, arr = new Float32Array(n * sz);
          for (let q = 0; q < n; q++) for (let w = 0; w < sz; w++) arr[q * sz + w] = w === 0 ? at.getX(q) : w === 1 ? at.getY(q) : w === 2 ? at.getZ(q) : at.getW(q);
          g.setAttribute(k, new T.BufferAttribute(arr, sz, at.normalized)); }
        if (src.index) g.setIndex(Array.from(src.index.array)); g.applyMatrix4(W);
        if (im.instanceColor) { im.getColorAt(i, c); const n = g.attributes.position.count, ca = g.attributes.color, col = new Float32Array(n * 3).fill(1); if (ca) for (let q = 0; q < n; q++) { col[q * 3] = ca.getX(q); col[q * 3 + 1] = ca.getY(q); col[q * 3 + 2] = ca.getZ(q); }
          for (let k = 0; k < n; k++) { col[k * 3] *= c.r; col[k * 3 + 1] *= c.g; col[k * 3 + 2] *= c.b; } g.setAttribute('color', new T.BufferAttribute(col, 3)); }
        out.add(new T.Mesh(g, im.material)); }
      return out; };
    // a mesh in world space (its own copy), shader materials replaced by a plain one of a similar look (glTF has no shaders)
    const plain = (m) => { const mat = m.material && m.material.isShaderMaterial ? new T.MeshStandardMaterial({ color: 0xcfe8ea, transparent: true, opacity: 0.55, roughness: 0.1 }) : m.material;
      if (mat && mat.name === 'fuente_agua' && mat.isMeshStandardMaterial) { const w = mat.clone(); w.onBeforeCompile = () => {}; w.color.setHex(0x2f7f80); w.opacity = 0.8; return new T.Mesh(m.geometry.clone().applyMatrix4(m.matrixWorld), w); }
      return new T.Mesh(m.geometry.clone().applyMatrix4(m.matrixWorld), mat); };
    const root = new T.Group();
    // kit pieces: the town has them baked into big meshes; here they are placed again (KIT3D.place) only where we want them
    const kitGroup = (list, name) => { const g = new T.Group(); g.name = name; if (!list.length) return g;
      const r = KIT3D.place(T, S.P3W.kit, list, S.P3W.ctx); for (const im of r.meshes) { im.updateMatrixWorld(true); const u = unInstance(im); if (u.children.length) g.add(u); } return g; };
    if (what === 'casas') {
      root.name = 'CASAS_HABITABLES';
      const ctx = S.P3W.ctx, LK = KIT3D.LOOK;
      for (const H of S.CASAS.houses) {
        const g = new T.Group(); g.name = H.id; const v = SDCasas.visual(H, { kit: true });
        for (const k in v) { const d = SDCasas.mesh(v[k]), geo = new T.BufferGeometry(), tile = k === 'crate' ? 1 : (LK[k] && LK[k].tile) || 1;
          if (tile !== 1) for (let i = 0; i < d.uv.length; i++) d.uv[i] /= tile;
          const col = d.col; for (let i = 0; i < col.length; i++) col[i] = col[i] <= 0.04045 ? col[i] / 12.92 : Math.pow((col[i] + 0.055) / 1.055, 2.4);
          geo.setAttribute('position', new T.BufferAttribute(d.pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(d.nrm, 3)); geo.setAttribute('uv', new T.BufferAttribute(d.uv, 2)); geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setIndex(new T.BufferAttribute(d.idx, 1));
          const m = new T.Mesh(geo, k === 'crate' ? S.MAT.crate : KIT3D.material(T, k, ctx)); m.name = H.id + '_' + k; g.add(m); }
        g.add(kitGroup(SDCasas.kitPieces(H), H.id + '_kit'));
        root.add(g);
      }
    } else if (what === 'fuente') {
      root.name = 'FUENTE';
      root.add(kitGroup([{ k: 'fountain', x: 0, y: 0, z: 0, ry: 0 }].concat([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ k: 'lamp_post', x: sx * 2.75, y: 0.8, z: sz * 2.75, ry: Math.atan2(-sx, -sz) + Math.PI / 2 }))), 'fuente_piedra'));
      if (S.FUENTE.f) for (const m of S.FUENTE.f.meshes) if (m.isMesh) { m.updateMatrixWorld(true); const c = plain(m); c.name = m.name; root.add(c); }
    } else {
      root.name = 'PUEBLO_3';
      for (const o of S.WORLDS.pueblo.objs) { if (!o.visible) continue; o.updateMatrixWorld(true);
        o.traverse(m => { if (m.isPoints || m.isSprite || m.isLine || !m.isMesh || !m.visible) return; const mats = [].concat(m.material); if (mats.every(x => !x || x.visible === false || x.colorWrite === false)) return;
          if (m.isInstancedMesh) { const u = unInstance(m); root.add(u); return; }
          const c = plain(m); c.name = m.name; root.add(c); }); }
      if (what === 'pueblo-ligero') {   // PUEBLO 4.0: one mesh per material (world space), for reference/art; the game never loads it
        const by = new Map(); root.traverse(m => { if (m.isMesh && !Array.isArray(m.material)) { const k = m.material; (by.get(k) || by.set(k, []).get(k)).push(m); } });
        const lite = new T.Group(); lite.name = 'PUEBLO_4_LIGERO';
        for (const [mat, list] of by) {
          let nv = 0, ni = 0; const hasC = list.some(m => m.geometry.attributes.color), hasUV = list.some(m => m.geometry.attributes.uv);
          for (const m of list) { const g = m.geometry; m.updateMatrixWorld(true); nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
          if (!nv) continue;
          const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = hasUV ? new Float32Array(nv * 2) : null, Cc = hasC ? new Float32Array(nv * 3).fill(1) : null, I = new Uint32Array(ni);
          let v = 0, i = 0; const nm = new T.Matrix3(), vv = new T.Vector3();
          for (const m of list) { const g = m.geometry, A = g.attributes, n = A.position.count; nm.getNormalMatrix(m.matrixWorld);
            for (let q = 0; q < n; q++) { vv.fromBufferAttribute(A.position, q).applyMatrix4(m.matrixWorld); P.set([vv.x, vv.y, vv.z], (v + q) * 3);
              if (A.normal) { vv.fromBufferAttribute(A.normal, q).applyMatrix3(nm).normalize(); N.set([vv.x, vv.y, vv.z], (v + q) * 3); }
              if (U && A.uv) U.set([A.uv.getX(q), A.uv.getY(q)], (v + q) * 2); if (Cc && A.color) Cc.set([A.color.getX(q), A.color.getY(q), A.color.getZ(q)], (v + q) * 3); }
            if (g.index) for (let q = 0; q < g.index.count; q++) I[i++] = g.index.getX(q) + v; else for (let q = 0; q < n; q++) I[i++] = q + v;
            v += n; }
          const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3));
          // lighter: no vertex colour if it is all white, no UV if the material has no texture, 16-bit indices when they fit
          const white = Cc && Cc.every(x => x > 0.996), texd = mat.map || mat.normalMap || mat.roughnessMap || mat.aoMap;
          if (U && texd) g.setAttribute('uv', new T.BufferAttribute(U, 2)); if (Cc && !white) g.setAttribute('color', new T.BufferAttribute(Cc, 3));
          g.setIndex(new T.BufferAttribute(nv < 65536 ? Uint16Array.from(I) : I, 1));
          const mm = new T.Mesh(g, mat); mm.name = (mat.name || 'mat') + '_todo'; lite.add(mm); }
        root.clear(); root.add(lite); root.name = 'PUEBLO_4';
      }
    }
    let tris = 0; root.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    const glb = await new Promise(res => new T.GLTFExporter().parse(root, res, { binary: true, maxTextureSize: what === 'pueblo-ligero' ? 512 : 1024, embedImages: true }));
    const u8 = new Uint8Array(glb); let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    return { b64: btoa(s), tris: Math.round(tris), n: root.children.length };
  }, what);
  const LIST = { casas: 'casas-habitables.glb', fuente: 'fuente.glb', pueblo: 'pueblo3.glb', 'pueblo-ligero': 'pueblo4-ligero.glb' };
  const want = (process.argv[3] || 'casas,fuente,pueblo-ligero').split(',');
  for (const [what, file] of Object.entries(LIST).filter(([w]) => want.includes(w))) {
    const r = await run(what), f = path.join(OUT, file); fs.writeFileSync(f, Buffer.from(r.b64, 'base64'));
    console.log(file + ': ' + r.n + ' grupos · ' + r.tris + ' triángulos · ' + (fs.statSync(f).size / 1048576).toFixed(1) + ' MB');
  }
  await b.close(); srv.close();
})();
