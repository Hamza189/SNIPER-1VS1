/* ILUMINACIÓN HORNEADA, paso 1 de 3 (docs/ILUMINACION-HORNEADA.md): saca del juego la geometría REAL del PUEBLO tal y
   como se dibuja (las mismas mallas, en coordenadas del mundo), para hornearla en Blender.
     node tools/lightmap/dump.js [salida]        (por defecto tools/lightmap/.work/pueblo)
   Escribe <salida>.json (lista de mallas: nombre, material, nº de vértices e índices, desplazamientos) y <salida>.bin
   (posiciones y normales Float32 en el mundo, índices Uint32). Solo lo opaco del PUEBLO (ni cielo, ni agua, ni cristal,
   ni hierba, ni las cajas invisibles de colisión, ni las sombras de mentira). Software WebGL: no se dibuja nada, solo se
   espera a que el kit esté puesto. */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ss = require('../static-server.js');
const OUT = process.argv[2] || path.join(__dirname, '.work', 'pueblo');
(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 2 })); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?vm=1&lm=0');
  await p.waitForFunction(() => window.__SD && __SD.P3W && __SD.P3W.kit, null, { timeout: 180000 });
  await p.evaluate(() => __SD.setWorld('pueblo'));
  await p.waitForTimeout(1500);
  const res = await p.evaluate(() => {
    const S = __SD, out = [], chunks = [];
    const b64 = a => { const u = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
    const T = window.THREE, v = new T.Vector3(), n = new T.Vector3(), N3 = new T.Matrix3();
    const shown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
    S.scene.updateMatrixWorld(true);
    S.scene.traverse(o => {
      // the buildings' shadow boxes (drawn only into the shadow map): the town's facades are not closed volumes, so
      // without them the sun would shine through the buildings in the bake. Not the boxes inside the 8 houses you can
      // walk into (their insides would go black)
      if (o.isMesh && o.name === 'shadow_proxies') {
        const P = o.geometry.attributes.position, keep = [];
        for (let t = 0; t < P.count; t += 3) {
          const cx = (P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3, cz = (P.getZ(t) + P.getZ(t + 1) + P.getZ(t + 2)) / 3;
          if (!(window.SDCasas && SDCasas.inside(cx, cz, 0.5))) keep.push(t);
        }
        const pos = new Float32Array(keep.length * 9), nrm = new Float32Array(keep.length * 9);
        keep.forEach((t, k) => { for (let j = 0; j < 3; j++) { v.fromBufferAttribute(P, t + j).applyMatrix4(o.matrixWorld); pos.set([v.x, v.y, v.z], k * 9 + j * 3); nrm.set([0, 1, 0], k * 9 + j * 3); } });
        const idx = Uint32Array.from({ length: keep.length * 3 }, (_, i) => i);
        out.push({ name: o.name, mat: 'sombra', verts: keep.length * 3, idx: idx.length, sig: 0 });
        chunks.push(b64(pos), b64(nrm), b64(idx));
        return;
      }
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !shown(o)) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || !m.visible || m.transparent || m.alphaTest > 0 || m.isMeshBasicMaterial || m.isShaderMaterial || m.colorWrite === false) return;
      const g = o.geometry, P = g.attributes.position; if (!P || !g.attributes.normal) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const c = g.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
      if (Math.abs(c.x) > 140 || Math.abs(c.z) > 140) return;   // ni el campo de tiro ni los cerros lejanos
      if (/^(casas_sombras|p3_hills|p4_cables)/.test(o.name)) return;
      N3.getNormalMatrix(o.matrixWorld);
      const pos = new Float32Array(P.count * 3), nrm = new Float32Array(P.count * 3), Nn = g.attributes.normal;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
        n.fromBufferAttribute(Nn, i).applyMatrix3(N3).normalize(); nrm[i * 3] = n.x; nrm[i * 3 + 1] = n.y; nrm[i * 3 + 2] = n.z;
      }
      const idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: P.count }, (_, i) => i);
      out.push({ name: o.name, mat: m.name || '', verts: P.count, idx: idx.length, sig: window.SDLightmap ? SDLightmap.sig(P.array) : 0 });
      chunks.push(b64(pos), b64(nrm), b64(idx));
    });
    return { meshes: out, chunks };
  });
  let off = 0; const bufs = [];
  res.meshes.forEach((m, i) => {
    const [a, b2, c] = [0, 1, 2].map(k => Buffer.from(res.chunks[i * 3 + k], 'base64'));
    m.pos = off; off += a.length; m.nrm = off; off += b2.length; m.ix = off; off += c.length;
    bufs.push(a, b2, c);
  });
  fs.writeFileSync(OUT + '.bin', Buffer.concat(bufs));
  fs.writeFileSync(OUT + '.json', JSON.stringify({ made: new Date().toISOString(), meshes: res.meshes }, null, 1));
  const tv = res.meshes.reduce((s, m) => s + m.verts, 0), tt = res.meshes.reduce((s, m) => s + m.idx / 3, 0);
  console.log('mallas', res.meshes.length, 'vértices', tv, 'triángulos', tt, '→', OUT + '.json/.bin', (off / 1e6).toFixed(1) + ' MB');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
