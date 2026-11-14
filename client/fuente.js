/* SNIPER DUEL — LA FUENTE DE LA PLAZA (14-11-2026, docs/FUENTE.md). Solo lo que se ve (y se oye): no cambia ninguna
   caja ni bala. Sustituye el agua plana de la pila (un plano verde azulado sin movimiento) por:
     · agua con ondas animadas (varias ondas + ruido), anillos donde cae el agua, espuma en los bordes y en las caídas,
       transparencia según el ángulo (se ve el fondo de cerca y refleja el cielo de lejos) y brillo del sol;
     · fondo de azulejo con cáusticas (los reflejos de luz que se mueven en el fondo de una piscina);
     · cuatro chorros de los caños, cuatro hilos que rebosan de la taza, un borbotón en lo alto, espuma y gotas.
   Todo con la geometría de la fuente del kit (tools/blender/kit.py, fountain): pila de 5 × 5 por dentro, caños a 0,6 m
   del eje y 1,22 m de alto en las diagonales, taza de 0,79 m de radio a 2,56–2,6 m.
   SDFuente.build(T, opt) → { group, meshes, water(material), update(seconds), tris, calls }.  opt: { x, z, env, level, jets } */
(function (root) {
'use strict';
const G = 9.81;

// a tube along a polyline (points [x,y,z], radii), uv: u around, v along; a: per-vertex opacity
function tube(P, R, A, sides, out) {
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const p = P[i], q = P[Math.min(n - 1, i + 1)], o = P[Math.max(0, i - 1)];
    let d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; const l = Math.hypot(d[0], d[1], d[2]) || 1; d = [d[0] / l, d[1] / l, d[2] / l];
    const up = Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    let s1 = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]]; const l1 = Math.hypot(s1[0], s1[1], s1[2]); s1 = s1.map(v => v / l1);
    const s2 = [d[1] * s1[2] - d[2] * s1[1], d[2] * s1[0] - d[0] * s1[2], d[0] * s1[1] - d[1] * s1[0]];
    const base = out.pos.length / 3;
    for (let k = 0; k <= sides; k++) {
      const a = k / sides * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), nx = s1[0] * c + s2[0] * s, ny = s1[1] * c + s2[1] * s, nz = s1[2] * c + s2[2] * s;
      out.pos.push(p[0] + nx * R[i], p[1] + ny * R[i], p[2] + nz * R[i]); out.nrm.push(nx, ny, nz); out.uv.push(k / sides, i / (n - 1)); out.a.push(A[i]);
    }
    if (i < n - 1) for (let k = 0; k < sides; k++) { const a = base + k, b = a + sides + 1; out.idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
}
// a surface of revolution round the y axis through the profile [[r, y]…]
function lathe(prof, A, cx, cz, segs, out) {
  const n = prof.length;
  for (let i = 0; i < n; i++) {
    const [r, y] = prof[i], base = out.pos.length / 3, q = prof[Math.min(n - 1, i + 1)], o = prof[Math.max(0, i - 1)];
    const dr = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dr, dy) || 1, nr = dy / l, ny = -dr / l;
    for (let k = 0; k <= segs; k++) { const a = k / segs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      out.pos.push(cx + c * r, y, cz + s * r); out.nrm.push(c * nr, ny, s * nr); out.uv.push(k / segs, i / (n - 1)); out.a.push(A[i]); }
    if (i < n - 1) for (let k = 0; k < segs; k++) { const a = base + k, b = a + segs + 1; out.idx.push(a, b, a + 1, a + 1, b, b + 1); }
  }
}
function geo(T, o) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(o.pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(o.nrm, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(o.uv, 2)); if (o.a) g.setAttribute('aA', new T.Float32BufferAttribute(o.a, 1));
  g.setIndex(o.idx); g.computeBoundingSphere(); return g;
}
const NOISE = `
float sdH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sdN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sdH(i), sdH(i + vec2(1.0, 0.0)), f.x), mix(sdH(i + vec2(0.0, 1.0)), sdH(i + vec2(1.0, 1.0)), f.x), f.y); }`;
const TAIL = `
  #include <tonemapping_fragment>
  #include <encodings_fragment>
  #include <fog_fragment>`;

// ---- the water surface: a MeshStandardMaterial (lights, shadows, fog, sky reflection as the rest of the town) whose
//      normal, colour, opacity and roughness are computed per pixel from moving waves
function waterMaterial(T, time, opt) {
  opt = opt || {};
  const rings = []; for (let i = 0; i < 8; i++) rings.push(new T.Vector3(0, 0, 0));
  (opt.rings || []).slice(0, 8).forEach((r, i) => rings[i].set(r[0], r[1], r[2] == null ? 1 : r[2]));
  const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.0, transparent: true, envMap: opt.env || null, envMapIntensity: opt.envI || 1.1 });
  m.name = 'fuente_agua'; m.userData.cs = 1;
  const U = { uTime: time, uRings: { value: rings }, uEdge: { value: new T.Vector4(opt.edge ? opt.edge[0] : 0, opt.edge ? opt.edge[1] : 0, opt.edge ? opt.edge[2] : 2.5, opt.edge ? opt.edge[3] : 0) },
    uDeep: { value: new T.Color(opt.deep || 0x0c3a43).convertSRGBToLinear() }, uShallow: { value: new T.Color(opt.shallow || 0x3d8a88).convertSRGBToLinear() }, uWave: { value: opt.wave || 1 } };
  m.userData.uniforms = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uTime; uniform vec3 uRings[8]; uniform vec4 uEdge; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uWave;\nvarying vec3 vWp;\n' + NOISE +
      '\nvec2 sdW(vec2 p, vec2 d, float k, float w, float a){ return d * (a * k * cos(dot(p, d) * k + uTime * w)); }\n' +
      sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec2 p = vWp.xz; vec2 g = vec2(0.0);
    g += sdW(p, vec2(0.8, 0.6), 3.1, 1.7, 0.010 * uWave);
    g += sdW(p, vec2(-0.49, 0.87), 4.7, 2.3, 0.007 * uWave);
    g += sdW(p, vec2(0.95, -0.31), 7.3, 3.1, 0.0045 * uWave);
    g += sdW(p, vec2(-0.71, -0.71), 11.0, 4.0, 0.0028 * uWave);
    g += sdW(p, vec2(0.2, -0.98), 17.0, 5.3, 0.0016 * uWave);
    float e = 0.035, s = 6.5; vec2 q = p * s + vec2(uTime * 0.55, uTime * 0.31);
    float n0 = sdN(q), nx = sdN(q + vec2(e * s, 0.0)), nz = sdN(q + vec2(0.0, e * s));
    g += vec2(nx - n0, nz - n0) / e * 0.010 * uWave;
    float foam = 0.0;
    for (int i = 0; i < 8; i++) {
      vec3 R = uRings[i]; if (R.z <= 0.0) continue;
      vec2 d = p - R.xy; float r = length(d) + 1e-4;
      float a = R.z * 0.012 * exp(-r * 2.0);
      g += (d / r) * cos(r * 24.0 - uTime * 10.0 + float(i) * 1.7) * 24.0 * a;
      foam += R.z * smoothstep(0.26, 0.02, r) * (0.45 + 0.55 * sdN(d * 16.0 + vec2(uTime * 3.1, -uTime * 2.3)));
    }
    vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
    float ed = uEdge.w > 0.5 ? uEdge.z - length(p - uEdge.xy) : uEdge.z - max(abs(p.x - uEdge.x), abs(p.y - uEdge.y));
    foam += smoothstep(0.08, 0.0, ed) * (0.35 + 0.65 * sdN(p * 13.0 + uTime * 1.3));
    foam = clamp(foam, 0.0, 1.0);
    float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
    diffuseColor.rgb = mix(uShallow, uDeep, 0.3 + 0.7 * fres);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 0.94), foam * 0.85);
    diffuseColor.a = clamp(mix(0.68, 0.97, fres) + foam * 0.45, 0.0, 1.0);
    roughnessFactor = mix(roughnessFactor, 0.75, foam);
  }`);
  };
  m.customProgramCacheKey = () => 'fuente_agua';
  return m;
}

// ---- falling water: streaks running down the stream, brighter at the edges; unlit (water lit by the sky)
const STREAM_V = `attribute float aA; varying vec2 vUv; varying float vA; varying vec3 vN; varying vec3 vV;
  #include <fog_pars_vertex>
  void main(){ vUv = uv; vA = aA; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const STREAM_F = `uniform float uTime; uniform vec3 uCol; varying vec2 vUv; varying float vA; varying vec3 vN; varying vec3 vV;
  #include <fog_pars_fragment>
  ${NOISE}
  void main(){
    float n = sdN(vec2(vUv.x * 7.0, vUv.y * 16.0 - uTime * 11.0)) * 0.6 + sdN(vec2(vUv.x * 15.0 + 3.0, vUv.y * 33.0 - uTime * 17.0)) * 0.4;
    float streak = smoothstep(0.42, 0.85, n);
    float fres = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float a = (0.16 + 0.55 * fres + 0.45 * streak) * vA;
    vec3 c = mix(uCol * 0.8, vec3(1.0), clamp(streak * 0.7 + fres * 0.35, 0.0, 1.0));
    gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
    ${TAIL}
  }`;

// ---- foam where the water lands: round patches that churn
function foamMaterial(T, time) {
  const m = new T.ShaderMaterial({
    uniforms: Object.assign(T.UniformsUtils.merge([T.UniformsLib.fog]), { uTime: time }),
    vertexShader: `varying vec2 vUv; varying float vS;
      #include <fog_pars_vertex>
      attribute float aA;
      void main(){ vUv = uv; vS = aA; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vS;
      #include <fog_pars_fragment>
      ${NOISE}
      void main(){
        vec2 d = vUv * 2.0 - 1.0; float r = length(d);
        float t = uTime * 2.2 + vS * 7.0;
        float n = sdN(d * 5.0 + vec2(t, -t * 0.7)) * 0.6 + sdN(d * 11.0 - vec2(t * 1.3, t)) * 0.4;
        float ring = smoothstep(0.08, 0.0, abs(r - fract(t * 0.35) * 0.9)) * (1.0 - fract(t * 0.35));
        float a = (smoothstep(1.0, 0.15, r) * smoothstep(0.3, 0.75, n) + ring * 0.5) * 0.85;
        gl_FragColor = vec4(vec3(0.93, 0.96, 0.96), clamp(a, 0.0, 1.0));
        ${TAIL}
      }`,
    transparent: true, depthWrite: false, fog: true });
  m.name = 'fuente_espuma'; return m;
}

// ---- light patterns moving on the bottom of the pool (added on top of the tiles)
function causticMaterial(T, time) {
  const m = new T.ShaderMaterial({
    uniforms: Object.assign(T.UniformsUtils.merge([T.UniformsLib.fog]), { uTime: time }),
    vertexShader: `varying vec2 vP;
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; varying vec2 vP;
      #include <fog_pars_fragment>
      ${NOISE}
      float cell(vec2 p){ vec2 i = floor(p), f = fract(p); float d = 1.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)); vec2 h = vec2(sdH(i + o), sdH(i + o + 7.3));
          h = 0.5 + 0.45 * sin(uTime * 0.9 + 6.2831 * h); d = min(d, length(o + h - f)); }
        return d; }
      void main(){
        vec2 p = vP * 2.4 + vec2(sdN(vP * 1.3 + uTime * 0.2), sdN(vP * 1.3 - uTime * 0.2)) * 0.6;
        float c = pow(1.0 - smoothstep(0.0, 0.32, cell(p)), 2.0) * 0.7 + pow(1.0 - smoothstep(0.0, 0.28, cell(p * 1.7 + 3.1)), 2.0) * 0.35;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.86) * c * 0.38, 1.0);
        ${TAIL}
      }`,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: true });
  m.name = 'fuente_causticas'; return m;
}

// ---- drops: points thrown up where the jets land, falling back (all in the vertex shader)
function dropMaterial(T, time, scale) {
  const m = new T.ShaderMaterial({
    uniforms: Object.assign(T.UniformsUtils.merge([T.UniformsLib.fog]), { uTime: time, uScale: { value: scale || 1 } }),
    vertexShader: `attribute vec4 aS; attribute vec3 aDir; uniform float uTime; uniform float uScale; varying float vF;
      #include <fog_pars_vertex>
      void main(){
        float life = 0.42 + aS.y * 0.25, t = fract(uTime / life + aS.x) * life;
        vec3 v = aDir * (0.7 + aS.z * 0.9);
        vec3 p = position + v * t + vec3(0.0, -4.905 * t * t, 0.0);
        vF = 1.0 - t / life;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = uScale * (0.018 + aS.w * 0.02) * 520.0 / max(0.5, -mvPosition.z);
        #include <fog_vertex>
      }`,
    fragmentShader: `varying float vF;
      #include <fog_pars_fragment>
      void main(){ vec2 d = gl_PointCoord * 2.0 - 1.0; float r = dot(d, d); if (r > 1.0) discard;
        gl_FragColor = vec4(vec3(0.94, 0.97, 0.98), (1.0 - r) * 0.75 * vF);
        ${TAIL}
      }`,
    transparent: true, depthWrite: false, fog: true });
  m.name = 'fuente_gotas'; return m;
}

// a sky cube for the reflection, painted with the town's sky colours (top, middle, horizon, ground)
function skyEnv(T, top, mid, hor, ground) {
  if (typeof document === 'undefined') return null;
  const hex = c => '#' + ('00000' + c.toString(16)).slice(-6);
  const face = (a, b, c) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
    if (g) { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, a); gr.addColorStop(0.5, b); gr.addColorStop(1, c); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); } return cv; };
  const side = () => face(hex(mid), hex(hor), hex(ground));
  const t = new T.CubeTexture([side(), side(), face(hex(top), hex(top), hex(top)), face(hex(ground), hex(ground), hex(ground)), side(), side()]);
  t.encoding = T.sRGBEncoding; t.needsUpdate = true; return t;
}

function build(T, opt) {
  opt = opt || {};
  const X = opt.x || 0, Z = opt.z || 0, LV = opt.level || 0.6, time = { value: 0 }, group = new T.Group(), meshes = [];
  group.name = 'fuente';
  const spoutA = [0, 1, 2, 3].map(k => k * Math.PI / 2 + Math.PI / 4), lipA = [0, 1, 2, 3].map(k => k * Math.PI / 2);
  // where the water falls: rings in the basin
  const jets = [], land = [];
  if (opt.jets !== false) {
    for (const a of spoutA) {   // spouts: out at 0.6 m, 1.22 m high, thrown 2.6 m/s outwards
      const c = Math.cos(a), s = Math.sin(a), P = [], Rr = [], A = [], vx = 2.6, vy = -0.1, y0 = 1.22, r0 = 0.6;
      const tEnd = (vy + Math.sqrt(vy * vy + 2 * G * (y0 - LV))) / G;
      for (let i = 0; i <= 18; i++) { const t = tEnd * i / 18, r = r0 + vx * t, y = y0 + vy * t - G * t * t / 2; P.push([X + c * r, y, Z + s * r]); Rr.push(0.022 + 0.022 * i / 18); A.push(i === 18 ? 0.5 : 1); }
      jets.push({ P, R: Rr, A }); land.push([X + c * (r0 + vx * tEnd), Z + s * (r0 + vx * tEnd), 1]);
      jets.push({ P, R: Rr.map(r => r * 2.3), A: A.map(a2 => a2 * 0.28) });   // spray round the stream
    }
    for (const a of lipA) {     // the bowl overflows in four threads between the spouts
      const c = Math.cos(a), s = Math.sin(a), P = [], Rr = [], A = [], vx = 0.32, y0 = 2.57, r0 = 0.83;
      const tEnd = Math.sqrt(2 * (y0 - LV) / G);
      for (let i = 0; i <= 18; i++) { const t = tEnd * i / 18, r = r0 + vx * t, y = y0 - G * t * t / 2; P.push([X + c * r, y, Z + s * r]); Rr.push(0.03 + 0.016 * i / 18); A.push(i === 0 ? 0.3 : 0.85); }
      jets.push({ P, R: Rr, A }); land.push([X + c * (r0 + vx * tEnd), Z + s * (r0 + vx * tEnd), 0.75]);
    }
  }
  // the basin water (5 × 5 inside the walls), its tiled floor and the caustics on it
  const env = opt.env || null;
  const water = waterMaterial(T, time, { env, rings: land, edge: [X, Z, 2.5, 0], deep: opt.deep, shallow: opt.shallow });
  const wm = new T.Mesh(new T.PlaneGeometry(5, 5, 1, 1), water); wm.rotation.x = -Math.PI / 2; wm.position.set(X, LV, Z); wm.name = 'fuente_agua'; wm.renderOrder = 2; wm.receiveShadow = true;
  group.add(wm); meshes.push(wm);
  if (opt.floorMat) { const f = new T.Mesh(new T.PlaneGeometry(5, 5, 1, 1), opt.floorMat); f.rotation.x = -Math.PI / 2; f.position.set(X, 0.035, Z); f.name = 'fuente_fondo'; f.receiveShadow = true; group.add(f); meshes.push(f); }
  const cm = new T.Mesh(new T.PlaneGeometry(4.96, 4.96, 1, 1), causticMaterial(T, time)); cm.rotation.x = -Math.PI / 2; cm.position.set(X, 0.04, Z); cm.name = 'fuente_causticas'; cm.renderOrder = 1;
  group.add(cm); meshes.push(cm);
  // the bowl's own water (a disc of 0.7 m at 2.585 m) with rings from the bubbler
  const bowlMat = opt.jets !== false ? waterMaterial(T, time, { env, rings: [[X, Z, 0.8]], edge: [X, Z, 0.7, 1], deep: opt.deep, shallow: opt.shallow, wave: 0.6 }) : null;
  if (bowlMat) { const b = new T.Mesh(new T.CircleGeometry(0.71, 24), bowlMat); b.rotation.x = -Math.PI / 2; b.position.set(X, 2.59, Z); b.name = 'fuente_taza'; b.renderOrder = 2; group.add(b); meshes.push(b); }
  // streams (one mesh: the jets, their spray, the overflow threads and the bubbler)
  if (jets.length) {
    const o = { pos: [], nrm: [], uv: [], a: [], idx: [] };
    for (const j of jets) tube(j.P, j.R, j.A, 7, o);
    lathe([[0.012, 2.6], [0.03, 2.72], [0.045, 2.83], [0.09, 2.87], [0.18, 2.83], [0.29, 2.72], [0.36, 2.6]], [0.9, 0.9, 0.8, 0.7, 0.55, 0.45, 0.2], X, Z, 14, o);
    const sm = new T.Mesh(geo(T, o), new T.ShaderMaterial({ uniforms: Object.assign(T.UniformsUtils.merge([T.UniformsLib.fog, { uCol: { value: new T.Color(0xcfe8ea).convertSRGBToLinear() } }]), { uTime: time }),
      vertexShader: STREAM_V, fragmentShader: STREAM_F, transparent: true, depthWrite: false, side: T.DoubleSide, fog: true }));
    sm.material.name = 'fuente_chorros'; sm.name = 'fuente_chorros'; sm.renderOrder = 4; group.add(sm); meshes.push(sm);
    // foam patches where they land
    const f = { pos: [], nrm: [], uv: [], a: [], idx: [] };
    land.forEach((L, i) => { const r = 0.3 + 0.12 * L[2], b = f.pos.length / 3, y = LV + 0.006;
      f.pos.push(L[0] - r, y, L[1] - r, L[0] + r, y, L[1] - r, L[0] + r, y, L[1] + r, L[0] - r, y, L[1] + r);
      for (let k = 0; k < 4; k++) { f.nrm.push(0, 1, 0); f.a.push(i * 0.137); } f.uv.push(0, 0, 1, 0, 1, 1, 0, 1); f.idx.push(b, b + 2, b + 1, b, b + 3, b + 2); });
    const fm = new T.Mesh(geo(T, f), foamMaterial(T, time)); fm.name = 'fuente_espuma'; fm.renderOrder = 3; group.add(fm); meshes.push(fm);
    // drops thrown up where the water lands
    if (opt.drops !== false) {
    const N = 26, pos = [], S = [], D = []; let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const L of land) for (let k = 0; k < N; k++) { const a = rnd() * 6.2832, up = 0.9 + rnd() * 1.1;
      pos.push(L[0] + (rnd() - 0.5) * 0.12, LV + 0.02, L[1] + (rnd() - 0.5) * 0.12); S.push(rnd(), rnd(), rnd() * L[2], rnd()); D.push(Math.cos(a) * 0.55, up, Math.sin(a) * 0.55); }
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); pg.setAttribute('aS', new T.Float32BufferAttribute(S, 4)); pg.setAttribute('aDir', new T.Float32BufferAttribute(D, 3));
    pg.boundingSphere = new T.Sphere(new T.Vector3(X, 1, Z), 3);
    const pm = new T.Points(pg, dropMaterial(T, time, opt.pointScale)); pm.name = 'fuente_gotas'; pm.renderOrder = 5; group.add(pm); meshes.push(pm);
    }
  }
  let tris = 0; for (const m of meshes) if (m.isMesh) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  return { group, meshes, water, bowl: bowlMat, time, tris: Math.round(tris), calls: meshes.length, land,
    update(sec) { time.value = sec % 3600; } };
}

const SDFuente = { build, waterMaterial, skyEnv, tube, lathe };
if (typeof module !== 'undefined' && module.exports) module.exports = SDFuente; else root.SDFuente = SDFuente;
})(typeof window !== 'undefined' ? window : globalThis);
