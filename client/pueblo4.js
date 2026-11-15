/* SNIPER DUEL — PUEBLO 4.0 (15-11-2026, docs/PUEBLO-4.md). Solo lo que se ve: ninguna caja, bala ni punto de navegación.
   Bandera: ?pueblo4=0 vuelve a PUEBLO 3.1 al instante.
     · weather(m, key): desgaste en el sombreado de los materiales COMPARTIDOS del pueblo (los de KIT3D.LOOK), sin texturas
       nuevas: suciedad que sube del suelo (irregular), churretes verticales, manchas grandes, un tono distinto por manzana,
       más rugosidad abajo; en el suelo, manchas grandes que rompen la repetición del adoquín y las losas.
     · dress(place): piezas del kit que dicen que allí vive gente, en las fachadas de PUEBLO 3.0: ropa tendida, aparatos de
       aire, jardineras en los alféizares, placas y contadores junto a puertas. Todo pegado a la fachada; lo que está
       a la altura del cuerpo es bajo (≤ 0,5 m) o plano.
     · cables(): tendido eléctrico y telefónico entre fachadas, a más de 5 m (geometría de tubos, una llamada).
   Puro (Node y navegador); el sombreado necesita el navegador. */
(function (root) {
'use strict';
const WALL = { stucco: 1, plaster: 1, stone: 0.8, rubble: 0.75, brick: 0.85, azulejo: 0.5, concrete: 0.9, wood: 0.55, frame: 0.6, roofterr: 0.6, rooftiles: 0.5 };
const FLOOR = { setts: 1, slabs: 0.9, asphalt: 1, earth: 0.7, herring: 0.6, pebbles: 0.8, p0side: 0.9, p0plaza: 0.9, p0cobble: 1, p0patch: 0.8, plaza: 0.9 };
const GLSL = `
varying vec3 vP4W; uniform float uP4K;
float p4h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float p4n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(p4h(i), p4h(i + vec2(1.0, 0.0)), f.x), mix(p4h(i + vec2(0.0, 1.0)), p4h(i + vec2(1.0, 1.0)), f.x), f.y); }`;
const WALL_FRAG = `
  float p4Dirt = 0.0;
  {
    vec3 w = vP4W;
    float n1 = p4n(w.xz * 0.31 + vec2(w.y * 0.13, 0.0));
    float n2 = p4n(vec2((w.x + w.z) * 2.3, w.y * 0.35));
    float nb = p4n(floor(w.xz / 6.5) * 1.37 + 0.5);
    float base = 1.0 - smoothstep(0.02, 0.75 + 0.6 * n1, w.y);
    p4Dirt = base * 0.34 + smoothstep(0.58, 0.95, n2) * 0.10 * smoothstep(0.6, 2.5, w.y) + smoothstep(0.62, 0.92, n1) * 0.08;
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.70, 0.62, 0.52), clamp(p4Dirt * uP4K, 0.0, 0.6));
    diffuseColor.rgb *= 0.94 + 0.12 * nb;
  }`;
const FLOOR_FRAG = `
  float p4Dirt = 0.0;
  {
    vec2 q = vP4W.xz;
    float a = p4n(q * 0.17), b = p4n(q * 0.71 + 13.0), c = p4n(q * 2.9 - 7.0);
    p4Dirt = smoothstep(0.55, 0.9, a) * 0.5 + smoothstep(0.6, 0.95, b) * 0.35;
    diffuseColor.rgb *= (0.9 + 0.16 * a) * mix(1.0, 0.82, clamp(p4Dirt * uP4K, 0.0, 1.0)) * (0.97 + 0.06 * c);
  }`;
// wear in the shader of one shared material (kit3d calls it for every material it makes when ctx.decorate is set)
function weather(m, key) {
  const k = WALL[key] != null ? WALL[key] : FLOOR[key]; if (k == null || !m || m.isShaderMaterial) return false;
  const floor = FLOOR[key] != null, prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (typeof prev === 'function' && prev !== m.constructor.prototype.onBeforeCompile) prev.call(m, sh, r);
    sh.uniforms.uP4K = { value: k };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP4W;')
      .replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vP4W = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vP4W = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + (floor ? FLOOR_FRAG : WALL_FRAG))
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = min(1.0, roughnessFactor + 0.18 * p4Dirt);');
  };
  const prevKey = m.customProgramCacheKey;
  m.customProgramCacheKey = () => 'p4' + (floor ? 'f' : 'w') + (prevKey ? prevKey.call(m) : '');
  m.userData.p4 = floor ? 'suelo' : 'muro';
  return true;
}

// a seeded random
const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
// kit pieces that show people live here, on the PUEBLO 3.0 facades: works from the window and door placements already
// in the list (their position, rotation and size tell where the facade is)
function dress(place, opt) {
  opt = opt || {}; const R = rng(opt.seed || 90411), out = [], used = new Set();
  const right = ry => [Math.cos(ry), 0, -Math.sin(ry)], fwd = ry => [Math.sin(ry), 0, Math.cos(ry)];
  const at = (p, du, dy, dout) => { const r = right(p.ry), f = fwd(p.ry); return [p.x + r[0] * du + f[0] * dout, p.y + dy, p.z + r[2] * du + f[2] * dout]; };
  const put = (k, pos, ry, extra) => out.push(Object.assign({ k, x: +pos[0].toFixed(3), y: +pos[1].toFixed(3), z: +pos[2].toFixed(3), ry }, extra || {}));
  const inside = (x, z) => Math.abs(x) < 49 && Math.abs(z) < 49;
  const wins = place.filter(p => /^win_(std|tall|std_cur|lo|tall_lo)$/.test(p.k) && inside(p.x, p.z));
  for (const w of wins) {
    const key = Math.round(w.x * 2) + ',' + Math.round(w.z * 2) + ',' + Math.round(w.y); if (used.has(key)) continue; used.add(key);
    const up = w.y > 2.4, t = R();
    if (up && t < 0.2) put('laundry', at(w, 0, -0.12, 0.05), w.ry, { s: [0.9 + R() * 0.25, 1, 1] });                // washing under the window
    else if (up && t < 0.4) put('planter', at(w, 0, -0.02, 0.06), w.ry, { s: [1.15, 1, 1] });                       // a window box on the sill
    else if (up && t < 0.5 && w.k !== 'win_tall') put('ac_unit', at(w, (R() < 0.5 ? -1 : 1) * 1.15, 0.25, 0.0), w.ry); // an air conditioner beside it
  }
  const doors = place.filter(p => /^door_(arch|panel)$/.test(p.k) && inside(p.x, p.z));
  for (const d of doors) {
    const t = R(), side = R() < 0.5 ? -1 : 1;
    put('plaque', at(d, side * 1.15, 1.75, 0.0), d.ry);                                                    // the number by the door
    if (t < 0.45) put('meter_box', at(d, -side * 1.25, 0.25, 0.0), d.ry);                                  // the meter box
  }
  return out;
}

// overhead cables: a few spans across the streets between facades (above 5 m), and along the facades; tubes of 1.2 cm
function cables(opt) {
  opt = opt || {};
  const spans = opt.spans || [
    [[-4.6, 5.6, 14], [4.6, 5.4, 18]], [[-4.6, 5.2, 24], [4.6, 5.9, 22]], [[-4.6, 5.5, 33], [4.6, 5.3, 36]],         // north street
    [[-4.6, 5.4, -15], [4.6, 5.7, -18]], [[-4.6, 5.8, -26], [4.6, 5.2, -24]], [[-4.6, 5.1, -38], [4.6, 5.5, -35]],   // south street
    [[-18, 5.6, 3.6], [-15, 5.3, -3.6]], [[17, 5.5, -3.6], [21, 5.8, 3.6]], [[-36, 5.2, -3.6], [-34, 5.6, 3.6]], [[36, 5.4, 3.6], [33, 5.1, -3.6]],  // cross street
  ];
  const pos = [], nrm = [], idx = [], r = opt.r || 0.012, sides = 4, seg = 14;
  for (const [a, b] of spans) for (const off of [0, 0.22]) {
    const P = [];
    for (let i = 0; i <= seg; i++) { const t = i / seg, sag = 0.35 * 4 * t * (1 - t) + off * 0.3;
      P.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag - off, a[2] + (b[2] - a[2]) * t + off * 0.4]); }
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[Math.min(P.length - 1, i + 1)], o = P[Math.max(0, i - 1)];
      let d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; const l = Math.hypot(...d) || 1; d = d.map(v => v / l);
      let s1 = [d[1] * 0 - d[2] * 1, d[2] * 0 - d[0] * 0, d[0] * 1 - d[1] * 0]; const l1 = Math.hypot(...s1) || 1; s1 = s1.map(v => v / l1);
      const s2 = [d[1] * s1[2] - d[2] * s1[1], d[2] * s1[0] - d[0] * s1[2], d[0] * s1[1] - d[1] * s1[0]], base = pos.length / 3;
      for (let k = 0; k < sides; k++) { const an = k / sides * Math.PI * 2, c = Math.cos(an), sn = Math.sin(an), n = [s1[0] * c + s2[0] * sn, s1[1] * c + s2[1] * sn, s1[2] * c + s2[2] * sn];
        pos.push(p[0] + n[0] * r, p[1] + n[1] * r, p[2] + n[2] * r); nrm.push(n[0], n[1], n[2]); }
      if (i < P.length - 1) for (let k = 0; k < sides; k++) { const a0 = base + k, a1 = base + (k + 1) % sides, b0 = a0 + sides, b1 = a1 + sides; idx.push(a0, b0, a1, a1, b0, b1); }
    }
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint32Array(idx), spans: spans.length };
}

const SDPueblo4 = { WALL, FLOOR, weather, dress, cables };
if (typeof module !== 'undefined' && module.exports) module.exports = SDPueblo4; else root.SDPueblo4 = SDPueblo4;
})(typeof window !== 'undefined' ? window : globalThis);
