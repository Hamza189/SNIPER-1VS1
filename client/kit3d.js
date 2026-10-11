/* SNIPER DUEL — PUEBLO 3.0: the architecture kit in Three.js (assets/kit.glb, built by tools/blender/kit.py).

   KIT3D.load(T, url, done)           → loads the kit: { pieces: { name: [{ geometry, mat }] } }
   KIT3D.material(T, name, ctx)       → the shared material for a kit / town material name
                                         ctx: { texLoad(name, normal, own), low, env }
   KIT3D.place(T, kit, list, ctx)     → instanced meshes for a list of placements
        placement: { k: piece, x, y, z, ry, s: [sx, sy, sz], c: tint (sRGB hex, for tintable parts) }
   Every piece is drawn with one InstancedMesh per material, so a whole town costs a few dozen draws.
   Materials take their colour from the vertex colours of the kit (baked shading, flower colours…)
   multiplied by the instance tint (walls, shutters, awnings) where the material allows it. */
(function (root) {
'use strict';

// look of every material: texture (assets/tex/<tex>_c.jpg), metres per repeat, roughness, metalness,
// normal strength, base colour, emissive, vertex colours, tinted per instance, two-sided
const LOOK = {
  stucco:     { tex: 'stucco', tile: 2.4, r: 0.92, n: 0.45, col: 0xffffff, tint: true },
  stone:      { tex: 'stone', tile: 1.1, r: 0.8, n: 0.55, col: 0xffffff },
  frame:      { r: 0.55, col: 0xeee9df },
  wood:       { tex: 'wood', tile: 0.9, r: 0.6, n: 0.35, col: 0xffffff, tint: true },
  woodraw:    { tex: 'wood', tile: 0.9, r: 0.8, n: 0.55, col: 0x8a6a4c },
  iron:       { r: 0.5, m: 0.5, col: 0x2b2826, two: true },
  glass:      { r: 0.05, m: 0.1, col: 0x2e3a40, env: 0.55, alpha: 0.6 },
  tile:       { r: 0.72, col: 0xc06a44 },
  terracotta: { tex: 'concrete', tile: 1.4, r: 0.85, n: 0.3, col: 0xc77a52 },
  leaf:       { r: 0.85, col: 0xffffff },
  cloth:      { r: 0.92, col: 0xffffff, tint: true, two: true },
  clothw:     { r: 0.92, col: 0xf1ece2, two: true },
  clothv:     { r: 0.9, col: 0xffffff, two: true },
  lamp:       { r: 0.3, col: 0xfff2d2, emissive: 0xffd896, ei: 0.9 },
  metal:      { r: 0.45, m: 0.3, col: 0xffffff, tint: true },
  zinc:       { r: 0.42, m: 0.65, col: 0x9a9e9c },
  azulejo:    { tex: 'azulejo', tile: 0.6, r: 0.2, rough: true, n: 0.4, col: 0xffffff },
  ceramic:    { r: 0.22, col: 0xffffff },
  dark:       { r: 1.0, col: 0x17130f },
  water:      { r: 0.05, m: 0.25, col: 0x46706c, env: 0.8 },
  concrete:   { tex: 'concrete', tile: 2.2, r: 0.9, n: 0.4, col: 0xd8d0c4 },
  sign:       { r: 0.7, col: 0xffffff },
  // generated walls and ground (client/town3.js): colour from the vertex colours
  rubble:     { tex: 'rubble', tile: 1.7, r: 0.9, n: 0.9, col: 0xffffff },
  brick:      { tex: 'brick', tile: 1.3, r: 0.85, n: 0.7, col: 0xffffff },
  roofterr:   { tex: 'slabs', tile: 1.6, r: 0.85, n: 0.4, col: 0xffffff },
  rooftiles:  { tex: 'rooftiles', tile: 1.0, r: 0.75, n: 0.8, col: 0xffffff },
  setts:      { tex: 'setts', tile: 1.9, r: 0.75, n: 0.9, rough: true, col: 0xffffff },
  slabs:      { tex: 'slabs', tile: 3.2, r: 0.75, n: 0.5, rough: true, col: 0xffffff },
  asphalt:    { tex: 'asphalt', tile: 4.5, r: 0.85, n: 0.5, rough: true, col: 0xffffff },
  earth:      { tex: 'earth', tile: 3.6, r: 0.95, n: 0.6, col: 0xffffff },
  hill:       { r: 1.0, col: 0xffffff },
  herring:    { tex: 'herring', tile: 0.8, r: 0.85, n: 0.6, col: 0xffffff },
  pebbles:    { tex: 'pebbles', tile: 1.0, r: 0.8, n: 0.9, col: 0xffffff },
};
const TINT = new Set(Object.keys(LOOK).filter(k => LOOK[k].tint));

function material(T, name, ctx) {
  ctx = ctx || {};
  const cache = ctx.cache || (ctx.cache = {});
  if (cache[name]) return cache[name];
  const L = LOOK[name] || { r: 0.8, col: 0xcccccc };
  const o = { vertexColors: true, roughness: L.r, metalness: L.m || 0, color: new T.Color(L.col) };
  // shared: the geometry's UVs are already in texture repeats (one shared texture per file);
  // otherwise the UVs are in metres and the material gets its own copy with the repeat set
  const own = !ctx.shared, rep = own ? 1 / (L.tile || 1) : 1;
  if (L.tex && ctx.texLoad) {
    const c = ctx.texLoad(L.tex, false, own); if (c) { if (own) c.repeat.set(rep, rep); o.map = c; }
    if (!ctx.low && L.n) { const n = ctx.texLoad(L.tex, true, own); if (n) { if (own) n.repeat.set(rep, rep); o.normalMap = n; o.normalScale = new T.Vector2(L.n, L.n); } }
    if (!ctx.low && L.rough) { const r = ctx.texLoad(L.tex + '_r', false, own, true); if (r) { if (own) r.repeat.set(rep, rep); o.roughnessMap = r; o.roughness = 1; } }
  }
  if (L.emissive) { o.emissive = new T.Color(L.emissive); o.emissiveIntensity = L.ei || 1; }
  if (L.env && ctx.env) { o.envMap = ctx.env; o.envMapIntensity = L.env; }
  if (L.two) o.side = T.DoubleSide;
  if (L.alpha) { o.transparent = true; o.opacity = L.alpha; o.depthWrite = false; }
  const m = new T.MeshStandardMaterial(o);
  m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear();
  m.userData.cs = 1; m.name = 'kit_' + name;
  cache[name] = m;
  return m;
}

// glTF vertex colours are linear already (the exporter converts); nothing to do there
function load(T, url, done, fail) {
  if (!T.GLTFLoader) { if (fail) fail('no GLTFLoader'); return; }
  new T.GLTFLoader().load(url, g => {
    const pieces = {};
    g.scene.updateMatrixWorld(true);
    for (const o of g.scene.children) {
      const parts = [];
      const add = m => { if (m.isMesh) parts.push({ geometry: m.geometry, mat: (m.material && m.material.name || 'stucco').replace(/\.\d+$/, '') }); };
      if (o.isMesh) add(o); else o.traverse(add);
      pieces[o.name] = parts;
    }
    done({ pieces });
  }, undefined, e => { if (fail) fail(e); });
}

const _m = { p: null, q: null, s: null, M: null, c: null };
function place(T, kit, list, ctx) {
  if (!_m.M) { _m.p = new T.Vector3(); _m.q = new T.Quaternion(); _m.s = new T.Vector3(); _m.M = new T.Matrix4(); _m.c = new T.Color(); _m.e = new T.Euler(); }
  const byPiece = {};
  for (const p of list) (byPiece[p.k] || (byPiece[p.k] = [])).push(p);
  const out = [];
  let tris = 0;
  for (const k in byPiece) {
    const parts = kit.pieces[k]; if (!parts) continue;
    const L = byPiece[k];
    for (const part of parts) {
      const mat = material(T, part.mat, ctx);
      // a geometry of its own (sharing the kit's buffers) with a bounding sphere around all its instances,
      // so the camera culls the group correctly (r128 InstancedMesh only knows the piece's own bounds)
      const src = part.geometry; if (!src.boundingSphere) src.computeBoundingSphere();
      const geo = new T.BufferGeometry();
      for (const a in src.attributes) geo.setAttribute(a, src.attributes[a]);
      if (src.index) geo.setIndex(src.index);
      const im = new T.InstancedMesh(geo, mat, L.length);
      const tint = TINT.has(part.mat);
      for (let i = 0; i < L.length; i++) {
        const p = L[i];
        _m.p.set(p.x, p.y || 0, p.z); _m.e.set(0, p.ry || 0, 0); _m.q.setFromEuler(_m.e);
        if (p.s) _m.s.set(p.s[0], p.s[1], p.s[2]); else _m.s.set(1, 1, 1);
        _m.M.compose(_m.p, _m.q, _m.s); im.setMatrixAt(i, _m.M);
        if (tint) { _m.c.setHex(p.c == null ? 0xffffff : p.c).convertSRGBToLinear(); im.setColorAt(i, _m.c); }
      }
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.name = 'kit_' + k + '_' + part.mat;
      // shadows: only big shapes (balconies, awnings, eaves, doors, the fountain, trees)
      im.castShadow = ctx && ctx.shadows ? ctx.shadows(k, part.mat) : false;
      im.receiveShadow = true;
      {
        let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9, sc = 1;
        for (const p of L) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y || 0); y1 = Math.max(y1, p.y || 0); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); if (p.s) sc = Math.max(sc, Math.abs(p.s[0]), Math.abs(p.s[1]), Math.abs(p.s[2])); }
        const c = new T.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        const bs = src.boundingSphere;
        geo.boundingSphere = new T.Sphere(c, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + (bs.center.length() + bs.radius) * sc);
      }
      out.push(im);
      const idx = geo.index ? geo.index.count : geo.attributes.position.count;
      tris += idx / 3 * L.length;
    }
  }
  return { meshes: out, tris };
}

/* merge(T, kit, list, ctx, regionOf) → static meshes: every placement baked into one mesh per region and
   material (and shadow flag), instead of one instanced mesh per piece and material. Far fewer draw calls
   (what costs most on phones), the same triangles. UVs are pre-scaled to the material's tile size so the
   textures can be shared (one copy in memory each); the instance tint is baked into the vertex colours. */
function merge(T, kit, list, ctx, regionOf) {
  ctx = ctx || {};
  const groups = {};
  const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const M = new T.Matrix4(), N3 = new T.Matrix3(), q = new T.Quaternion(), e = new T.Euler(), pv = new T.Vector3(), sv = new T.Vector3(), v = new T.Vector3(), n = new T.Vector3();
  let tris = 0;
  for (const p of list) {
    const parts = kit.pieces[p.k]; if (!parts) continue;
    pv.set(p.x, p.y || 0, p.z); e.set(0, p.ry || 0, 0); q.setFromEuler(e);
    if (p.s) sv.set(p.s[0], p.s[1], p.s[2]); else sv.set(1, 1, 1);
    M.compose(pv, q, sv); N3.getNormalMatrix(M);
    const region = regionOf ? regionOf(p) : 'all';
    let tr = 1, tg = 1, tb = 1;
    if (p.c != null) { tr = lin((p.c >> 16 & 255) / 255); tg = lin((p.c >> 8 & 255) / 255); tb = lin((p.c & 255) / 255); }
    for (const part of parts) {
      if (part.mat === 'sign') continue;
      const cast = ctx.shadows ? !!ctx.shadows(p.k, part.mat) : false;
      const own = ctx.separate && ctx.separate.has(p.k) ? p.k : '';   // kept apart (named after the piece)
      const key = region + '|' + part.mat + '|' + (cast ? 1 : 0) + '|' + own;
      const g = groups[key] || (groups[key] = { region, mat: part.mat, cast, own, pos: [], nrm: [], uv: [], col: [], idx: [] });
      const src = part.geometry, P = src.attributes.position, Nn = src.attributes.normal, U = src.attributes.uv, C = src.attributes.color;
      const L = LOOK[part.mat] || {}, sc = 1 / (L.tile || 1), tint = TINT.has(part.mat);
      // r128 returns the raw integers of normalized attributes: scale them back to 0..1
      const cn = C && C.normalized ? (C.array instanceof Uint16Array ? 1 / 65535 : C.array instanceof Uint8Array ? 1 / 255 : 1) : 1;
      const base = g.pos.length / 3;
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(M); g.pos.push(v.x, v.y, v.z);
        if (Nn) { n.fromBufferAttribute(Nn, i).applyMatrix3(N3).normalize(); g.nrm.push(n.x, n.y, n.z); } else g.nrm.push(0, 1, 0);
        if (U) g.uv.push(U.getX(i) * sc, U.getY(i) * sc); else g.uv.push(0, 0);
        let r = 1, gg = 1, b = 1; if (C) { r = C.getX(i) * cn; gg = C.getY(i) * cn; b = C.getZ(i) * cn; }
        if (tint) { r *= tr; gg *= tg; b *= tb; }
        g.col.push(r, gg, b);
      }
      if (src.index) { const I = src.index; for (let i = 0; i < I.count; i++) g.idx.push(base + I.getX(i)); tris += I.count / 3; }
      else { for (let i = 0; i < P.count; i++) g.idx.push(base + i); tris += P.count / 3; }
    }
  }
  const meshes = [];
  for (const key in groups) {
    const g = groups[key];
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(g.nrm, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute('color', new T.Float32BufferAttribute(g.col, 3));
    geo.setIndex(g.pos.length / 3 > 65535 ? new T.Uint32BufferAttribute(g.idx, 1) : new T.Uint16BufferAttribute(g.idx, 1));
    geo.computeBoundingSphere();
    const m = new T.Mesh(geo, material(T, g.mat, Object.assign(ctx, { shared: true })));
    m.name = 'kit_' + g.region + '_' + g.mat + (g.cast ? '_cast' : '') + (g.own ? '@' + g.own : '');
    m.castShadow = g.cast; m.receiveShadow = true;
    meshes.push(m);
  }
  return { meshes, tris };
}

const KIT3D = { LOOK, TINT, material, load, place, merge };
if (typeof module !== 'undefined' && module.exports) module.exports = KIT3D; else root.KIT3D = KIT3D;
})(typeof window !== 'undefined' ? window : globalThis);
