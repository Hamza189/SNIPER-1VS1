/* SNIPER DUEL — ILUMINACIÓN HORNEADA (24-11-2026, docs/ILUMINACION-HORNEADA.md). Bandera: ?lm=1 (sin ella, nada cambia).
   Blender hornea, una vez y fuera del juego (tools/lightmap/), dos cosas del PUEBLO en una imagen (atlas):
     · R = oclusión ambiental: rincones, esquinas, aleros, jambas de ventanas y el suelo junto a las paredes, más oscuros;
     · G = la sombra del sol, suave, con el mismo sol que el juego (LOOK.sunPos);
     · B = la misma oclusión a 8 m: cuánto cielo ve cada punto (dentro de las casas, más oscuro; junto a puertas y
       ventanas, más claro).
   En el juego no se calcula nada de eso: cada malla que lo tiene recibe un segundo juego de UV (uv2, del archivo
   assets/lightmaps/pueblo_uv2.bin) y su material una copia con esa imagen. Coste: una lectura de textura por píxel.
     · La oclusión oscurece la luz del cielo (aoMap de three.js) y, un poco, la del sol (uAoSun).
     · La sombra horneada del sol se usa donde la de tiempo real no llega: lejos (se apaga de 40 a 58 m), en los muros
       que el sol roza, y en BAJO (sin sombras de tiempo real), que así también tiene sombras.
   Solo lo que se ve: ni cajas, ni balas, ni el servidor. Si la geometría del juego cambia y ya no coincide con la que se
   horneó (nº de vértices y firma de posiciones), esa malla se queda como estaba: nunca se ve mal, solo sin horneado.
   Puro donde puede (Node y navegador); apply()/material() necesitan three.js. */
(function (root) {
'use strict';

// firma de una malla: suma ponderada de sus posiciones (las mismas en el horneado y en el juego)
function sig(pos) {
  let s = 0; for (let i = 0; i < pos.length; i += 3) s += pos[i] + 3 * pos[i + 1] + 7 * pos[i + 2];
  return Math.round(s * 100) / 100;
}
// índice (json) + uv2 (bin, Uint16 normalizado) → { 'nombre#vértices': { sig, uv2: Float32Array } }
function decode(index, buf) {
  const out = {}, u16 = new Uint16Array(buf);
  for (const m of index.meshes) {
    const a = u16.subarray(m.off / 2, m.off / 2 + m.verts * 2), uv = new Float32Array(m.verts * 2);
    for (let i = 0; i < uv.length; i++) uv[i] = a[i] / 65535;
    out[m.name + '#' + m.verts] = { sig: m.sig, uv2: uv };
  }
  return out;
}
// ¿esta malla es la que se horneó? (nombre, nº de vértices y firma)
function match(data, name, pos) {
  const d = data[name + '#' + (pos.length / 3)];
  if (!d) return null;
  return Math.abs(sig(pos) - d.sig) <= Math.max(0.5, Math.abs(d.sig) * 1e-6) ? d : null;
}

// la copia de un material con el horneado (una por material de origen); conserva su desgaste (onBeforeCompile)
const SUN_A = 'directLight.color *= mix( 1.0, sdS, sdF );';
const SUN_IRR = 'getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );';
function material(T, base, tex, opt) {
  opt = opt || {};
  const cache = opt.cache || (opt.cache = new Map());
  if (cache.has(base)) return cache.get(base);
  const m = base.clone();
  m.userData = Object.assign({}, base.userData, { lm: 1 });
  m.name = base.name + '+lm';
  m.aoMap = tex; m.aoMapIntensity = opt.ao != null ? opt.ao : 1;
  const prev = base.onBeforeCompile, prevKey = base.customProgramCacheKey;
  const U = { uAoSun: { value: opt.aoSun != null ? opt.aoSun : 0.35 }, uLmSun: { value: opt.sun != null ? opt.sun : 1 }, uLmFar: { value: opt.far != null ? opt.far : 0.75 },
    uLmBias: { value: opt.bias != null ? opt.bias : 1 } };
  m.userData.lmU = U;
  m.onBeforeCompile = (sh, r) => {
    if (typeof prev === 'function' && prev !== T.Material.prototype.onBeforeCompile) prev.call(m, sh, r);
    sh.uniforms.uAoSun = U.uAoSun; sh.uniforms.uLmSun = U.uLmSun; sh.uniforms.uLmFar = U.uLmFar; sh.uniforms.uLmBias = U.uLmBias;
    let L = T.ShaderChunk.lights_fragment_begin;
    // la sombra horneada (G) sustituye a la de tiempo real donde esta se apaga (lejos, muros rozados) …
    if (L.includes(SUN_A)) L = L.replace(SUN_A, 'directLight.color *= mix( sdLmSun, sdS, sdF );');
    // … y en BAJO (sin mapa de sombras) es la única; la oclusión oscurece un poco también el sol
    L = L.replace(SUN_IRR, SUN_IRR + '\n#ifndef USE_SHADOWMAP\n directLight.color *= sdLmSun;\n#endif\n directLight.color *= mix( 1.0, sdLm.r, uAoSun );');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uAoSun; uniform float uLmSun; uniform float uLmFar; uniform float uLmBias;')
      // B counts the ground as hiding the sky: a wall in an open square sees ~0.6 of it and should not darken at all
      // (the hemisphere light already gives the lower half its ground colour); inside the houses B is ~0.15.
      // (26-11-2026) three.js's own occlusion (aomap_fragment) uses the same read: one read of the image, not two
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= mix( 1.0, clamp( sdLm.b * 1.6, 0.0, 1.0 ), uLmFar );\n' + T.ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vUv2 ).r', 'sdLm.r'))
      .replace('#include <lights_fragment_begin>', 'vec4 sdLm = texture2D( aoMap, vUv2, uLmBias ); float sdLmSun = mix( 1.0, sdLm.g, uLmSun );\n' + L);
    // (26-11-2026, the owner: «desde lejos se ven rayas que parpadean») uLmBias: the image is read one mipmap level
    // softer; close by (the image magnified) nothing changes, from far away the 14 cm texels no longer flicker
    // &lmdbg=1: the baked image as it is read (R oclusión, G sol, B cielo), to check the uv2
    if (opt.debug) sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor = vec4( sdLm.rgb, 1.0 );');
  };
  m.customProgramCacheKey = () => 'lm' + (opt.debug ? 'd' : '') + (typeof prevKey === 'function' ? prevKey.call(base) : '');
  m.needsUpdate = true;
  cache.set(base, m);
  return m;
}

// pone el horneado en las mallas de la escena que coinciden; devuelve cuántas y sus vértices
function apply(T, scene, data, tex, opt) {
  opt = opt || {};
  const res = { meshes: 0, verts: 0, skipped: [] };
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position) return;
    const P = o.geometry.attributes.position, key = o.name + '#' + P.count;
    if (!data[key]) return;
    const d = match(data, o.name, P.array);
    if (!d) { res.skipped.push(o.name); return; }
    o.geometry.setAttribute('uv2', new T.BufferAttribute(d.uv2, 2));
    const base = Array.isArray(o.material) ? o.material[0] : o.material;
    o.userData.lmBase = base;
    o.material = material(T, base, tex, opt);
    res.meshes++; res.verts += P.count;
  });
  return res;
}
// vuelve a los materiales de antes (para comparar sin recargar)
function remove(scene) {
  scene.traverse(o => { if (o.userData && o.userData.lmBase) { o.material = o.userData.lmBase; delete o.userData.lmBase; } });
}

const SDLightmap = { sig, decode, match, material, apply, remove };
if (typeof module !== 'undefined' && module.exports) module.exports = SDLightmap; else root.SDLightmap = SDLightmap;
})(typeof window !== 'undefined' ? window : globalThis);
