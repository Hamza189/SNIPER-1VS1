/* SNIPER DUEL — camuflajes del rifle (objetos 'camo' de core/items.js; docs/INVENTARIO-Y-CAJAS.md).
   - El dibujo se hace aquí, en un canvas de 256×256 que se repite sin costuras (nada que descargar).
   - El material del arma se clona y se retoca (onBeforeCompile): el dibujo se proyecta por los tres ejes del arma
     (sin depender de sus UV), conserva el detalle de la textura original (golpes, grabados, sombras), y en los
     legendarios lo más claro del dibujo brilla y late. Tres lecturas de textura más, solo en el rifle de tu 1ª persona.
   Solo aspecto: ni la forma del arma ni nada del juego cambia. */
(function (root) {
'use strict';
const N = 256, SCALE = 5;   // un dibujo cada 20 cm del arma
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// ruido que se repite cada N píxeles (c celdas por lado)
function vnoise(r, c) {
  const g = new Float32Array(c * c); for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (i, j) => g[(((j % c) + c) % c) * c + (((i % c) + c) % c)];
  return (x, y) => {
    const fx = x / N * c, fy = y / N * c, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), a = at(ix, iy), b = at(ix + 1, iy), d = at(ix, iy + 1), e = at(ix + 1, iy + 1);
    return a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy;
  };
}
function fbm(seed, c0, oct) {
  const r = rng(seed), L = []; for (let o = 0; o < oct; o++) L.push(vnoise(r, c0 << o));
  return (x, y) => { let v = 0, w = 0.5, t = 0; for (const n of L) { v += n(x, y) * w; t += w; w *= 0.5; } return v / t; };
}
// cada dibujo: put(x, y, [r, g, b]) para cada píxel; algunos dibujan además con el contexto 2D (after)
const PAT = {
  liso(C, s, put) { const n = fbm(s, 4, 4), r = rng(s + 9);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = mix(C[0], C[1], sstep(0.3, 0.72, n(x, y))), k = (r() - 0.5) * 6; put(x, y, [c[0] + k, c[1] + k, c[2] + k]); } },
  manchas(C, s, put) { const a = fbm(s, 3, 4), b = fbm(s + 1, 3, 4), d = fbm(s + 2, 4, 3);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let c = mix(C[0], C[2], sstep(0.52, 0.555, a(x, y))); c = mix(c, C[1], sstep(0.565, 0.6, b(x, y))); c = mix(c, C[3], sstep(0.63, 0.665, d(x, y))); put(x, y, c); } },
  pixel(C, s, put) { const a = fbm(s, 3, 3), b = fbm(s + 1, 4, 3), d = fbm(s + 2, 5, 2), P = 8;
    for (let j = 0; j < N / P; j++) for (let i = 0; i < N / P; i++) {
      const cx = i * P + P / 2, cy = j * P + P / 2;
      const c = d(cx, cy) > 0.64 ? C[3] : b(cx, cy) > 0.56 ? C[1] : a(cx, cy) > 0.52 ? C[2] : C[0];
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) put(i * P + x, j * P + y, c); } },
  rayas(C, s, put) { const w = fbm(s, 4, 3), n = fbm(s + 1, 6, 3), m = fbm(s + 2, 3, 3);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = Math.sin(2 * Math.PI * (x / N * 5 + (w(x, y) - 0.5) * 1.6 + 0.12 * Math.sin(2 * Math.PI * y / N * 2)));
      let c = mix(C[0], C[2], sstep(0.55, 0.62, m(x, y))); c = mix(c, C[1], sstep(0.3, 0.42, v + (n(x, y) - 0.5) * 0.9)); put(x, y, c); } },
  carbono(C, s, put) { const P = 8;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = Math.floor(x / P), j = Math.floor(y / P), along = (i + j) % 2 ? x % P : y % P, across = (i + j) % 2 ? y % P : x % P;
      const t = (0.5 - 0.5 * Math.cos(2 * Math.PI * (across + 0.5) / P)) * (0.82 + 0.18 * Math.sin(2 * Math.PI * along / 3));
      put(x, y, mix(C[0], C[1], t)); } },
  cristal(C, s, put) { const r = rng(s), K = 22, pts = []; for (let k = 0; k < K; k++) pts.push([r() * N, r() * N, r()]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let d1 = 1e9, d2 = 1e9, p1 = null;
      for (const p of pts) { let dx = Math.abs(x - p[0]), dy = Math.abs(y - p[1]); if (dx > N / 2) dx = N - dx; if (dy > N / 2) dy = N - dy; const d = Math.hypot(dx, dy); if (d < d1) { d2 = d1; d1 = d; p1 = p; } else if (d < d2) d2 = d; }
      const edge = d2 - d1; let c = mix(C[0], C[1], p1[2] * 0.8); c = mix(c, C[2], (1 - sstep(0, 5, edge)) * 0.9 + sstep(14, 0, d1) * 0.15); put(x, y, c); } },
  escamas(C, s, put) { const W = 64, H = 32, R = W * 0.6, n = fbm(s, 6, 2);
    // la escama que se ve es la de la fila más baja que cubre el píxel (las de abajo tapan a las de arriba)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let best = null; const ry = Math.floor(y / H);
      for (let r = ry - 2; r <= ry + 1; r++) { const off = ((r % 2) + 2) % 2 ? W / 2 : 0, cy = r * H;
        for (let k = -1; k <= N / W; k++) { const cx = k * W + off; let dx = Math.abs(x - cx); if (dx > N / 2) dx = N - dx; const d = Math.hypot(dx, y - cy);
          if (d < R && y >= cy - 1 && (!best || r > best.r)) best = { r, t: d / R }; } }
      const t = best ? best.t : 1; let c = mix(C[1], C[0], sstep(0.0, 0.7, t));
      c = mix(c, C[2], sstep(0.85, 0.97, t) * (0.7 + 0.6 * n(x, y))); put(x, y, c); } },
  circuito(C, s, put) { const n = fbm(s, 4, 2);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = mix(C[0], C[1], n(x, y) > 0.55 ? 0.8 : 0.1); put(x, y, c); } },
};
// pistas del circuito: líneas en una rejilla de 16 px que se cierra sobre sí misma, con sus puntos de soldadura
function circuitTraces(g, C, s) {
  const r = rng(s + 3), P = 16, M = N / P, col = 'rgb(' + C[2].join(',') + ')';
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2; g.lineCap = 'square';
  const seg = (x0, y0, x1, y1) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.beginPath(); g.moveTo(x0 + ox, y0 + oy); g.lineTo(x1 + ox, y1 + oy); g.stroke(); } };
  const dot = (x, y, rad) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.beginPath(); g.arc(x + ox, y + oy, rad, 0, 7); g.fill(); } };
  for (let k = 0; k < 15; k++) {
    let i = Math.floor(r() * M), j = Math.floor(r() * M), dir = Math.floor(r() * 4); const len = 4 + Math.floor(r() * 9);
    dot(i * P + P / 2, j * P + P / 2, 3);
    for (let q = 0; q < len; q++) {
      if (r() < 0.3) dir = (dir + (r() < 0.5 ? 1 : 3)) % 4;
      const di = [1, 0, -1, 0][dir], dj = [0, 1, 0, -1][dir];
      seg(i * P + P / 2, j * P + P / 2, (i + di) * P + P / 2, (j + dj) * P + P / 2); i += di; j += dj;
    }
    dot(i * P + P / 2, j * P + P / 2, 2.5);
  }
}
// el dibujo de un objeto → canvas 256×256
function draw(it) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'), im = g.createImageData(N, N), d = im.data, C = it.c.map(rgb), s = hash(it.id);
  const put = (x, y, c) => { const k = (y * N + x) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255; };
  (PAT[it.pat] || PAT.liso)(C, s, put);
  g.putImageData(im, 0, 0);
  if (it.pat === 'circuito') circuitTraces(g, C, s);
  return cv;
}
function texture(T, it, renderer) {
  const t = new T.CanvasTexture(draw(it)); t.wrapS = t.wrapT = T.RepeatWrapping;
  try { t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); } catch (e) {}
  return t;
}
// brillo medio (luz lineal) de la textura y el color de un material: el camuflaje conserva el detalle a su alrededor
function detail(m) {
  try {
    // a texture compressed for the GPU (KTX2) cannot be drawn on a canvas: tools/ktx2/make.py stores its average
    // brightness in the material (extras.lum → userData.lum)
    const lum = m.userData && m.userData.lum;
    if (lum != null && m.map) { const c = m.color ? 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b : 1, a = lum * c; return a > 0.002 ? 1 / a : 0; }
    const im = m.map && m.map.image; if (!im) return 0;
    const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data, L = x => Math.pow(x / 255, 2.2); let s = 0;
    for (let i = 0; i < d.length; i += 4) s += 0.2126 * L(d[i]) + 0.7152 * L(d[i + 1]) + 0.0722 * L(d[i + 2]);
    const col = m.color ? 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b : 1, avg = s / 256 * col;
    return avg > 0.002 ? 1 / avg : 0;
  } catch (e) { return 0; }
}
// copia del material con el camuflaje (time: { value } compartido para que lata; det: detail(m) o 0 = color liso)
function patch(T, m, it, tex, time, det) {
  const u = { uCamo: { value: tex }, uCamoScale: { value: SCALE }, uCamoDetail: { value: det || 0 }, uCamoMetal: { value: it.metal == null ? -1 : it.metal },
    uCamoRough: { value: it.rough == null ? -1 : it.rough }, uCamoGlow: { value: it.glow || 0 }, uCamoTime: time };
  const n = m.clone(); n.name = m.name;
  if (it.metal != null && it.metal > 0.5) n.envMapIntensity = Math.max(n.envMapIntensity || 0, 1.2);   // metal: it has to reflect
  n.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCamoP;\nvarying vec3 vCamoN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCamoP = position;\nvCamoN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', ['#include <common>',
      'uniform sampler2D uCamo;uniform float uCamoScale;uniform float uCamoDetail;uniform float uCamoMetal;uniform float uCamoRough;uniform float uCamoGlow;uniform float uCamoTime;',
      'varying vec3 vCamoP;varying vec3 vCamoN;',
      'vec3 camoAt(){vec3 w=abs(normalize(vCamoN));w=w*w*w*w;w/=(w.x+w.y+w.z+1e-5);vec3 p=vCamoP*uCamoScale;',
      ' vec3 c=texture2D(uCamo,p.zy).rgb*w.x+texture2D(uCamo,p.xz).rgb*w.y+texture2D(uCamo,p.xy).rgb*w.z;return pow(c,vec3(2.2));}'].join('\n'))
      .replace('#include <map_fragment>', '#include <map_fragment>\nvec3 camoC=camoAt();float camoL=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));\ndiffuseColor.rgb=camoC*(uCamoDetail>0.0?clamp(camoL*uCamoDetail,0.3,1.7):1.0);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif(uCamoRough>=0.0)roughnessFactor=uCamoRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif(uCamoMetal>=0.0)metalnessFactor=uCamoMetal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif(uCamoGlow>0.0){float camoG=smoothstep(0.25,0.7,max(camoC.r,max(camoC.g,camoC.b)));\ntotalEmissiveRadiance+=camoC*camoG*uCamoGlow*(1.1+0.6*sin(uCamoTime*2.4+(vCamoP.x+vCamoP.y+vCamoP.z)*14.0));}');
  };
  n.customProgramCacheKey = () => 'sdcamo';
  return n;
}
// muestra para el inventario y la caja: un rifle de perfil relleno con el dibujo (el cañón, en acero)
function swatch(it, w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  const k = Math.min(w / 200, h / 70), ox = (w - 200 * k) / 2, oy = (h - 70 * k) / 2, P = (x, y) => [ox + x * k, oy + y * k];
  const poly = pts => { g.beginPath(); pts.forEach((p, i) => { const q = P(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); };
  const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  g.fillStyle = '#8f949a'; rect(148, 33, 194, 37.5); g.fill(); rect(188, 31, 198, 39.5); g.fill();         // cañón y freno
  g.fillStyle = '#1c1d20'; rect(100, 43, 112, 55); g.fill(); rect(91, 24, 97, 30); g.fill(); rect(111, 24, 117, 30); g.fill();
  const body = [[4, 28], [22, 25], [60, 30], [70, 28], [120, 28], [127, 32], [150, 32], [150, 40], [121, 40], [109, 44], [99, 59], [88, 59], [92, 44], [70, 44], [60, 40], [26, 52], [4, 55]];
  const scope = [[72, 12], [82, 15], [124, 15], [136, 10], [136, 27], [124, 23], [82, 23], [72, 26]];
  const fillCamo = pts => {
    poly(pts); g.save(); g.clip();
    const pat = g.createPattern(draw(it), 'repeat'), z = 0.35 * k; g.setTransform(z, 0, 0, z, 0, 0); g.fillStyle = pat; g.fillRect(0, 0, w / z, h / z);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const sh = g.createLinearGradient(0, oy + 10 * k, 0, oy + 60 * k); sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h); g.restore();
    poly(pts); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = Math.max(1, k); g.stroke();
  };
  fillCamo(body); fillCamo(scope);
  return cv;
}
const SDCamo = { draw, texture, detail, patch, swatch, SCALE };
if (typeof module !== 'undefined' && module.exports) module.exports = SDCamo; else root.SDCamo = SDCamo;
})(typeof window !== 'undefined' ? window : globalThis);
