/* SNIPER DUEL — POSPROCESADO POR CALIDAD (25-11-2026, docs/POSPROCESADO.md). Bandera: ?post=1 (sin ella, nada cambia).
   Lo que hace un juego de tiros moderno después de dibujar la escena, en pocas pasadas a pantalla completa y sin
   librerías nuevas (Three.js r128 tal cual):
     · ALTO:  oclusión ambiental de pantalla (SSAO, a media resolución, solo la escena: el arma no), brillo de las luces
              fuertes (bloom en dos tamaños), suavizado de bordes FXAA y corrección de color.
     · MEDIO: bloom en un tamaño y corrección de color; el suavizado es el MSAA 4× de siempre (render target con
              multimuestreo en WebGL 2; si no hay WebGL 2, FXAA).
     · BAJO:  nada (se dibuja como siempre).
   La corrección de color va después del tono ACES y del ESTILO DE IMAGEN del jugador (que siguen igual): un poco más de
   contraste, sombras algo frías y luces algo cálidas, saturación suave y viñeta.
   Uso en el bucle:  P.begin() → renderer.render(escena) → P.afterScene(cámara) → (el arma) → P.end()
   Necesita three.js (no es puro). */
(function (root) {
'use strict';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// SSAO from the depth buffer: view-space position from depth, normal from the neighbours, 8 samples on a disc whose size
// is a fixed radius in metres; a range check keeps far geometry from darkening what is in front
const SSAO_FS = `
uniform sampler2D tDepth; uniform vec2 uTexel; uniform mat4 uInvProj; uniform float uNear, uFar, uRadius, uPower;
varying vec2 vUv;
vec3 vpos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 c = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vec4 v = uInvProj * c; return v.xyz / v.w; }
// interleaved gradient noise: an ordered pattern the 3×3 blur removes (white noise left grain)
float rnd(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.9999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = vpos(vUv);
  vec3 px = vpos(vUv + vec2(uTexel.x, 0.0)) - P, py = vpos(vUv + vec2(0.0, uTexel.y)) - P;
  vec3 nx = vpos(vUv - vec2(uTexel.x, 0.0)) - P, ny = vpos(vUv - vec2(0.0, uTexel.y)) - P;
  vec3 N = normalize(cross(abs(px.z) < abs(nx.z) ? px : -nx, abs(py.z) < abs(ny.z) ? py : -ny));
  float r = uRadius / max(0.2, -P.z);               // metres → screen fraction (about: the projection does the rest)
  float a = rnd(gl_FragCoord.xy) * 6.2831, occ = 0.0;
  for (int i = 0; i < 12; i++) {
    float t = (float(i) + 0.5) / 12.0, ang = a + float(i) * 2.39996;
    vec2 off = vec2(cos(ang), sin(ang)) * r * sqrt(t);
    vec3 S = vpos(vUv + off) - P;
    float l = length(S);
    occ += max(0.0, dot(N, S / max(l, 1e-4)) - 0.08) * (1.0 - smoothstep(uRadius * 0.5, uRadius * 1.6, l));
  }
  float ao = pow(clamp(1.0 - occ / 12.0 * 1.6, 0.0, 1.0), uPower);
  gl_FragColor = vec4(vec3(ao), 1.0);
}`;
// a 3×3 blur (taps two texels apart) that keeps edges: weights by how alike the AO values are
const BLUR4_FS = `uniform sampler2D tIn; uniform vec2 uTexel; varying vec2 vUv;
void main(){ float c = texture2D(tIn, vUv).r, s = c, w = 1.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { if (x == 0 && y == 0) continue;
    float v = texture2D(tIn, vUv + vec2(float(x), float(y)) * 1.5 * uTexel).r, k = 1.0 - min(1.0, abs(v - c) * 3.0); s += v * k; w += k; }
  gl_FragColor = vec4(vec3(s / w), 1.0); }`;
// bright parts of the picture (the picture is already tone mapped and in sRGB: a soft knee around the threshold)
const BRIGHT_FS = `uniform sampler2D tIn; uniform vec2 uTexel; uniform float uThr; varying vec2 vUv;
void main(){ vec3 c = (texture2D(tIn, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tIn, vUv + uTexel * vec2(0.5, -0.5)).rgb
  + texture2D(tIn, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tIn, vUv + uTexel * vec2(0.5, 0.5)).rgb) * 0.25;
  float l = max(c.r, max(c.g, c.b)), k = smoothstep(uThr, uThr + 0.18, l);
  gl_FragColor = vec4(c * k, 1.0); }`;
const GAUSS_FS = `uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
void main(){ vec3 s = texture2D(tIn, vUv).rgb * 0.2270270;
  s += (texture2D(tIn, vUv + uDir * 1.3846154).rgb + texture2D(tIn, vUv - uDir * 1.3846154).rgb) * 0.3162162;
  s += (texture2D(tIn, vUv + uDir * 3.2307692).rgb + texture2D(tIn, vUv - uDir * 3.2307692).rgb) * 0.0702703;
  gl_FragColor = vec4(s, 1.0); }`;
// the last pass, to the screen: FXAA (optional), bloom, colour grading, vignette
const FINAL_FS = `uniform sampler2D tIn, tB1, tB2; uniform vec2 uTexel; uniform float uFxaa, uBloom, uB2, uCon, uSat, uVig, uSplit; varying vec2 vUv;
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 fxaa(vec2 uv){
  vec3 rgbM = texture2D(tIn, uv).rgb;
  if (uFxaa < 0.5) return rgbM;
  vec3 nw = texture2D(tIn, uv + vec2(-1.0, -1.0) * uTexel).rgb, ne = texture2D(tIn, uv + vec2(1.0, -1.0) * uTexel).rgb;
  vec3 sw = texture2D(tIn, uv + vec2(-1.0, 1.0) * uTexel).rgb, se = texture2D(tIn, uv + vec2(1.0, 1.0) * uTexel).rgb;
  float lNW = luma(nw), lNE = luma(ne), lSW = luma(sw), lSE = luma(se), lM = luma(rgbM);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.0312, lMax * 0.125)) return rgbM;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float red = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0), rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
  dir = clamp(dir * rcp, -8.0, 8.0) * uTexel;
  vec3 A = 0.5 * (texture2D(tIn, uv - dir * 0.1667).rgb + texture2D(tIn, uv + dir * 0.1667).rgb);
  vec3 B = A * 0.5 + 0.25 * (texture2D(tIn, uv - dir * 0.5).rgb + texture2D(tIn, uv + dir * 0.5).rgb);
  float lB = luma(B);
  return (lB < lMin || lB > lMax) ? A : B;
}
void main(){
  vec3 c = fxaa(vUv);
  c += texture2D(tB1, vUv).rgb * uBloom + texture2D(tB2, vUv).rgb * uB2;
  float l = luma(c);
  c = mix(vec3(l), c, uSat);                                             // saturation
  c = mix(c, c * c * (3.0 - 2.0 * c), uCon);                             // contrast (S curve, black and white stay)
  c *= mix(vec3(0.97, 1.0, 1.04), vec3(1.03, 1.0, 0.95), smoothstep(0.15, 0.75, l)) * uSplit + (1.0 - uSplit);   // cool shadows, warm lights
  vec2 q = vUv - 0.5; c *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(q, q) * 2.2);                                     // vignette
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
const MUL_FS = 'uniform sampler2D tIn; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tIn, vUv).rgb, 1.0); }';

// settings per level; touch: phones and tablets (SSAO at a lower resolution there)
const LEVELS = {
  // bloom only on what is really bright (lamps, the sky by the sun, sunlit white at its brightest): at 0.8 the
  // whitewashed walls glowed and the horizon hazed over (captures of 25-11)
  alto:  { ssao: true, bloom2: true, fxaa: true, msaa: false, bloom: 0.22, b2: 0.14, thr: 0.9, con: 0.16, sat: 0.98, vig: 0.2, split: 1 },
  medio: { ssao: false, bloom2: false, fxaa: false, msaa: true, bloom: 0.2, b2: 0, thr: 0.9, con: 0.13, sat: 0.98, vig: 0.16, split: 1 },
};
function level(profile) { return LEVELS[profile] ? profile : null; }

function create(T, renderer, opt) {
  opt = opt || {};
  const gl2 = !!(renderer.capabilities && renderer.capabilities.isWebGL2);
  const P = { on: true, lvl: null, L: null, w: 0, h: 0, rt: null, ssaoRT: null, ssaoRT2: null, b: [], active: false, calls: 0, touch: !!opt.touch, ssaoOff: !!opt.noSsao };
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), sc = new T.Scene();
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), null); quad.frustumCulled = false; sc.add(quad);
  const mat = (fs, u, extra) => Object.assign(new T.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false }), extra || {});
  const M = {
    ssao: mat(SSAO_FS, { tDepth: { value: null }, uTexel: { value: new T.Vector2() }, uInvProj: { value: new T.Matrix4() }, uNear: { value: 0.05 }, uFar: { value: 600 }, uRadius: { value: 0.55 }, uPower: { value: 1.4 } }),
    blur: mat(BLUR4_FS, { tIn: { value: null }, uTexel: { value: new T.Vector2() } }),
    mul: mat(MUL_FS, { tIn: { value: null } }, { transparent: true, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.DstColorFactor, blendDst: T.ZeroFactor }),
    bright: mat(BRIGHT_FS, { tIn: { value: null }, uTexel: { value: new T.Vector2() }, uThr: { value: 0.8 } }),
    gauss: mat(GAUSS_FS, { tIn: { value: null }, uDir: { value: new T.Vector2() } }),
    final: mat(FINAL_FS, { tIn: { value: null }, tB1: { value: null }, tB2: { value: null }, uTexel: { value: new T.Vector2() }, uFxaa: { value: 0 }, uBloom: { value: 0.5 }, uB2: { value: 0 }, uCon: { value: 0.15 }, uSat: { value: 1.05 }, uVig: { value: 0.2 }, uSplit: { value: 1 } }),
  };
  for (const k in M) M[k].userData.cs = 1;   // the game's colour fixes leave these alone
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(sc, cam); P.calls++; };
  const rtOpt = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: false, stencilBuffer: false };
  const free = () => { for (const r of [P.rt, P.ssaoRT, P.ssaoRT2, ...P.b]) if (r) r.dispose(); P.rt = P.ssaoRT = P.ssaoRT2 = null; P.b = []; };
  function build(w, h) {
    free(); P.w = w; P.h = h;
    const L = P.L, useMsaa = L.msaa && gl2 && T.WebGLMultisampleRenderTarget;
    if (useMsaa) { P.rt = new T.WebGLMultisampleRenderTarget(w, h, { format: T.RGBAFormat, encoding: T.sRGBEncoding }); P.rt.samples = 4; }
    else {
      P.rt = new T.WebGLRenderTarget(w, h, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, encoding: T.sRGBEncoding });
      if (L.ssao && !P.ssaoOff) { P.rt.depthTexture = new T.DepthTexture(w, h); P.rt.depthTexture.type = T.UnsignedIntType; }
    }
    P.fxaa = L.fxaa || (L.msaa && !useMsaa);
    P.rt.texture.generateMipmaps = false;
    if (P.rt.depthTexture) {
      const s = P.touch ? 3 : 2, sw = Math.max(1, Math.round(w / s)), sh = Math.max(1, Math.round(h / s));
      P.ssaoRT = new T.WebGLRenderTarget(sw, sh, rtOpt); P.ssaoRT2 = new T.WebGLRenderTarget(sw, sh, rtOpt);
    }
    const q = [4, 8];
    for (let i = 0; i < (L.bloom2 ? 2 : 1); i++) {
      const bw = Math.max(1, Math.round(w / q[i])), bh = Math.max(1, Math.round(h / q[i]));
      P.b.push(new T.WebGLRenderTarget(bw, bh, rtOpt), new T.WebGLRenderTarget(bw, bh, rtOpt));
    }
  }
  P.setLevel = profile => {
    const l = P.on ? level(profile) : null;
    if (l === P.lvl) return; P.lvl = l; P.L = l ? LEVELS[l] : null; free(); P.w = P.h = 0;
  };
  // start of a frame: the scene goes into the render target (false = this frame is drawn as always)
  const _v = new T.Vector2();
  P.begin = () => {
    P.active = false; P.calls = 0; if (!P.L) return false;
    renderer.getDrawingBufferSize(_v); const w = _v.x | 0, h = _v.y | 0; if (!w || !h) return false;
    if (w !== P.w || h !== P.h || !P.rt) build(w, h);
    renderer.setRenderTarget(P.rt); renderer.clear(); P.active = true; return true;
  };
  // after the scene, before the weapon: the SSAO darkens the scene's colour (the weapon is drawn on top, untouched)
  P.afterScene = camera => {
    if (!P.active || !P.ssaoRT) return;
    const u = M.ssao.uniforms; u.tDepth.value = P.rt.depthTexture; u.uTexel.value.set(1 / P.ssaoRT.width, 1 / P.ssaoRT.height);
    u.uInvProj.value.copy(camera.projectionMatrixInverse); u.uNear.value = camera.near; u.uFar.value = camera.far;
    pass(M.ssao, P.ssaoRT);
    M.blur.uniforms.tIn.value = P.ssaoRT.texture; M.blur.uniforms.uTexel.value.set(1 / P.ssaoRT.width, 1 / P.ssaoRT.height); pass(M.blur, P.ssaoRT2);
    M.mul.uniforms.tIn.value = P.ssaoRT2.texture; pass(M.mul, P.rt);
  };
  // end of the frame: bloom and the last pass to the screen
  P.end = () => {
    if (!P.active) return; P.active = false; const L = P.L;
    const blur = (src, a, b) => {
      M.bright.uniforms.tIn.value = src; M.bright.uniforms.uTexel.value.set(1 / P.w, 1 / P.h); M.bright.uniforms.uThr.value = L.thr; pass(M.bright, a);
      M.gauss.uniforms.tIn.value = a.texture; M.gauss.uniforms.uDir.value.set(1 / a.width, 0); pass(M.gauss, b);
      M.gauss.uniforms.tIn.value = b.texture; M.gauss.uniforms.uDir.value.set(0, 1 / a.height); pass(M.gauss, a);
      return a.texture;
    };
    const b1 = blur(P.rt.texture, P.b[0], P.b[1]), b2 = P.b[2] ? blur(P.b[0].texture, P.b[2], P.b[3]) : b1;
    const u = M.final.uniforms;
    u.tIn.value = P.rt.texture; u.tB1.value = b1; u.tB2.value = b2; u.uTexel.value.set(1 / P.w, 1 / P.h); u.uFxaa.value = P.fxaa ? 1 : 0;
    u.uBloom.value = L.bloom; u.uB2.value = P.b[2] ? L.b2 : 0; u.uCon.value = L.con; u.uSat.value = L.sat; u.uVig.value = L.vig; u.uSplit.value = L.split;
    pass(M.final, null);
  };
  P.dispose = () => { free(); for (const k in M) M[k].dispose(); quad.geometry.dispose(); };
  P.M = M; P.LEVELS = LEVELS;
  return P;
}

const SDPost = { LEVELS, level, create };
if (typeof module !== 'undefined' && module.exports) module.exports = SDPost; else root.SDPost = SDPost;
})(typeof window !== 'undefined' ? window : globalThis);
