/* SNIPER DUEL — MIRAS: optics for the rifle as accessories you can change (31-10-2026, owner: «añade más miras y que sean
   como accesorio que se puedan cambiar»). Pure data and maths; build() is the only part that needs THREE (passed in).

   Only what you SEE changes: the magnification, the reticle, the picture round it and the model on the rifle. The rules
   stay the server's and are the same with any optic: the rifle shot is exact once the sight is up (ads ≥ scopeAt), the
   ADS time, the recoil, the spread and the damage do not change, so no optic is an advantage the rival cannot pick too.

   kind  tube   a scope: dark ring round the picture, the rifle hidden while you look through it (as always)
         prism  a short scope: the same, with a much wider picture
         reflex a sight you look through (red dot, holographic, 2× and 3×): the rifle and the whole sight stay in view and the
                reticle sits inside its window (sized to the window: owner, 02-11-2026, «tiene que verse la mira entera y la
                retícula dentro»; the 2× and the 3× were scopes filling the screen). win: its apertures [radius, z], the one
                that looks smallest from the eye is the window
   Gun space (the HALCÓN R7's, which every rifle model is converted to): x right, y up, -z forward, bore y 0.004; the
   eye is at z +0.27 when aiming (the ADS pose puts the gun origin 27 cm in front of it). */
(function (root) {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// rear: the optic's back end, relative to its own origin (the middle of its foot, on the rail); foot: what touches the
// rail [front, back]; axis: height of the line of sight above the rail; eye: where its back end should sit (gun z).
// One magnification each (owner, 31-10-2026: «la mira x4, x8 y x12 tienen que ser independientes y diferentes cada una
// con sus características; en el móvil apuntando es imposible alejar o acercar, solo jugamos con dos dedos»): no zoom
// button, you pick the optic. ring: radius of the clear picture of a scope (vmin; lower power = bigger eye box) and rs:
// where its dark edge starts (a high power one closes in more)
const OPTICS = {
  punto: { name: 'PUNTO ROJO', short: '1,25×', zooms: [1.25], kind: 'reflex', reticle: 'dot', win: [[0.0127, -0.024]], axis: 0.034, rear: 0.0195, foot: [-0.018, 0.018], eye: 0.1,
    desc: 'Lo más rápido para cerca: casi sin aumento, el rifle a la vista y un punto rojo en el centro.' },
  holo: { name: 'HOLOGRÁFICA', short: '1,5×', zooms: [1.5], kind: 'reflex', reticle: 'holo', win: [[0.0155, -0.036]], axis: 0.032, rear: 0.046, foot: [-0.044, 0.044], eye: 0.08,
    desc: 'Ventana grande: ves todo alrededor. Anillo con punto central (el punto es donde va la bala).' },
  x2: { name: 'VISOR 2×', short: '2×', zooms: [2], kind: 'reflex', reticle: 'cruz', win: [[0.0136, -0.035], [0.0172, -0.07], [0.0176, 0.072]], axis: 0.034, rear: 0.072, foot: [-0.035, 0.035], eye: 0.17,
    desc: 'Poco aumento y mucho campo: para media distancia. El rifle y la mira se ven; cruz fina con punto iluminado dentro del ocular.' },
  tactica: { name: 'TÁCTICA 3×', short: '3×', zooms: [3], kind: 'reflex', reticle: 'chevron', win: [[0.015, -0.03], [0.0196, -0.078], [0.0168, 0.064]], axis: 0.034, rear: 0.064, foot: [-0.025, 0.025], eye: 0.16,
    desc: 'Visor corto de prisma: el rifle y la mira se ven y alrededor sigues viendo. Chevrón iluminado: la punta es donde va la bala.' },
  x4: { name: 'VISOR 4×', short: '4×', zooms: [4], kind: 'tube', reticle: 'duplex', ring: 54, rs: 0.78, axis: 0.034, rear: 0.17, foot: [-0.05, 0.05], eye: 0.19,
    desc: 'Visor de caza clásico: el círculo más grande de los visores y una cruz gruesa por fuera y fina en el centro, fácil de seguir.' },
  x6: { name: 'VISOR 6×', short: '6×', zooms: [6], kind: 'tube', reticle: 'mil', ring: 50, rs: 0.75, axis: 0.036, rear: 0.2, foot: [-0.06, 0.06], eye: 0.2,
    desc: 'Retícula de puntos cada 5 milésimas para medir y adelantar: una persona de pie a 100 m mide unos 3,5 puntos.' },
  sniper: { name: 'FRANCOTIRADOR', short: '8×', zooms: [8], kind: 'tube', reticle: 'bdc', ring: 46, rs: 0.72, builtin: true,
    desc: 'La de siempre del rifle. Marcas de caída a 100, 150 y 200 m y de adelanto para un blanco agachado, andando o corriendo.' },
  largo: { name: 'LARGO ALCANCE', short: '12×', zooms: [12], kind: 'tube', reticle: 'fino', ring: 42, rs: 0.64, axis: 0.036, rear: 0.205, foot: [-0.1, 0.07], eye: 0.2,
    desc: 'El que más aumenta, para lado a lado del mapa: círculo más pequeño y oscuro, retícula fina con marcas hasta 250 m y punto iluminado.' },
};
const ORDER = ['punto', 'holo', 'x2', 'tactica', 'x4', 'x6', 'sniper', 'largo'];   // by magnification
const DEFAULT = 'sniper';
const has = id => typeof id === 'string' && Object.prototype.hasOwnProperty.call(OPTICS, id);
function get(id) { return has(id) ? OPTICS[id] : OPTICS[DEFAULT]; }
function sanitize(id) { return has(id) ? id : DEFAULT; }
// the zoom after this one (the mouse wheel and the zoom button cycle through the optic's own: one each, since 31-10)
function nextZoom(id, cur) { const z = get(id).zooms, i = z.indexOf(cur); return z[(i + 1) % z.length]; }
function firstZoom(id, prev) { const z = get(id).zooms; return z.includes(prev) ? prev : z[z.length - 1]; }
function zoomLabel(z) { return String(Math.round(z * 100) / 100).replace('.', ',') + '×'; }
// which sensitivity slider applies: «Visor hasta 4×» (scope4) or «Visor de más de 4×» (scope8)
function sensKey(z) { return z > 4.01 ? 'scope8' : 'scope4'; }

/* The rifles: the top of the rail an optic stands on (y, and how it rises towards the front: dy per metre of -z), the
   part of the rail it can stand on [front z, back z], and what their own scope is, to hide it (gun space, measured on
   the vertices of each model: docs/MIRAS.md). strip.mats: whole materials · strip.box: [front z, back z, y] every
   triangle whose centre is above y between those two z. */
const RIFLES = {
  halcon: { rail: { y: 0.0345, z: [-0.47, 0.095] }, strip: { box: [-0.27, 0.215, 0.0352] } },
  proc: { rail: { y: 0.041, z: [-0.1, 0.14] }, strip: { parts: true } },
  titan: { rail: { y: 0.052, z: [0.085, 0.265] }, strip: { mats: ['Optical'] } },
  ratio: { rail: { y: 0.0675, z: [-0.4, 0.035] }, strip: { mats: ['05_Scope'], box: [-0.3, 0.16, 0.07] } },
  lince: { rail: { y: 0.0492, rise: 0.013, z: [-0.4, 0.04] }, strip: { mats: ['Zoom'] } },
  vector: { rail: { y: 0.0638, z: [-0.4, 0.02] }, strip: { box: [-0.38, 0.19, 0.066] } },
};
const ADS_Y = 0.068;   // the built-in scope's line of sight (the ADS pose aims it at the centre of the screen)
/* Where an optic goes on a rifle: z of its origin (its back end as close to its eye position as the rail allows, its foot
   always on the rail), y of the rail there, the tilt of the rail, and the line of sight (gun y) the ADS pose aims. */
function placement(rifle, id) {
  const R = (RIFLES[rifle] || RIFLES.halcon).rail, O = get(id);
  if (O.builtin) return { z: 0, y: 0, tilt: 0, axisY: ADS_Y };
  let z = O.eye - O.rear;
  const lo = R.z[0] - O.foot[0], hi = R.z[1] - O.foot[1];
  z = lo > hi ? (lo + hi) / 2 : clamp(z, lo, hi);
  const y = R.y + (R.rise || 0) * -z, tilt = Math.atan(R.rise || 0);
  return { z, y, tilt, axisY: y + O.axis };
}

/* How big the window of a sight you look through looks: its radius as a fraction of half the screen height (the
   viewmodel camera: vertical field of view VM_FOV), for the eye ads metres behind the gun origin (the ADS pose). */
const VM_FOV = 50;
function windowFrac(id, place, ads) {
  const O = get(id); if (!O.win || !place) return 0;
  let k = Infinity; for (const [r, z] of O.win) { const d = (ads || 0.27) - (place.z + z); if (d > 0.01) k = Math.min(k, r / d); }
  return k === Infinity ? 0 : k / Math.tan(VM_FOV * Math.PI / 360);
}

/* The reticle for the SVG of the sight (viewBox -100…100 over the sight's circle, radius rpx px).
   c = { zoom, H (picture height, px), rpx, gun: {gravity, zero, speed}, move: {crouch, walk, sprint} }
   bdc / fino / mil: real angles at this zoom (drop below the 50 m zero, lead of a target crossing your view, 5 mrad
   dots); duplex / cruz / chevron / holo / dot: a fixed size on screen (at 1,25–4× the true sizes would be a pixel or two).
   c.see: a sight you look through, the viewBox is its window: everything stays inside it (cut to the window's size). */
function reticle(style, c) {
  const fov = c.fovBase / c.zoom, pxPerMrad = (c.H / 2) / Math.tan(fov * Math.PI / 360) / 1000, unit = c.rpx / 100, u = pxPerMrad / unit;
  const G = c.gun, drop = d => G.gravity * (d - G.zero) / (2 * G.speed * G.speed) * 1000, lead = v => v / G.speed * 1000;
  const f = v => (Math.round(v * 100) / 100).toString(), cap = (v, m) => c.see ? Math.min(v, m) : v;
  const o = { posts: '', postW: 0, cross: '', crossW: 0, marks: '', marksW: 0.4, labels: '', mils: '', lit: '', dot: 0, glow: 0, ring: '', ringW: 0, u, pxPerMrad };
  if (style === 'bdc' || style === 'fino') {
    const fine = style === 'fino', g = fine ? 1.4 : 2.2, edge = fine ? 58 : 42;
    o.posts = 'M-100 0H-' + edge + 'M' + edge + ' 0H100M0 -100V-' + edge + 'M0 ' + edge + 'V100'; o.postW = fine ? 1.5 : 2.6;
    o.cross = 'M-' + edge + ' 0H-' + g + 'M' + g + ' 0H' + edge + 'M0 -' + edge + 'V-' + g + 'M0 ' + g + 'V' + edge; o.crossW = fine ? 0.3 : 0.45;
    o.marksW = fine ? 0.3 : 0.4;
    // fino: the numbers alternate right / left and one too close to the last on its side is left out (the four marks are
    // a few units apart); bdc keeps its look of always
    const lastY = [-99, -99]; let side = 0;
    for (const [d, w] of fine ? [[100, 2.6], [150, 2.2], [200, 1.9], [250, 1.6]] : [[100, 3.2], [150, 2.6], [200, 2.1]]) {
      const y = drop(d) * u; if (y > edge - 2) continue;
      o.marks += 'M' + f(-w) + ' ' + f(y) + 'H' + f(w);
      if (!fine) { o.labels += '<text x="' + f(w + 0.8) + '" y="' + f(y + 1.1) + '">' + d + '</text>'; continue; }
      if (y - lastY[side] < 3.4) side = 1 - side;
      if (y - lastY[side] >= 3.4) { o.labels += '<text x="' + f(side ? -w - 0.8 : w + 0.8) + '" y="' + f(y + 1.1) + '"' + (side ? ' text-anchor="end"' : '') + '>' + d + '</text>'; lastY[side] = y; side = 1 - side; }
    }
    for (const [v, h, t] of [[c.move.crouch, 1.4, ''], [c.move.walk, 2.4, 'A'], [c.move.sprint, 3.4, 'C']]) {
      const x = lead(v) * u; if (x > edge - 2) continue;
      o.marks += 'M' + f(x) + ' ' + f(-h) + 'V' + f(h) + 'M' + f(-x) + ' ' + f(-h) + 'V' + f(h);
      if (t) o.labels += '<text x="' + f(x - 1) + '" y="' + f(-h - 1) + '">' + t + '</text><text x="' + f(-x - 1) + '" y="' + f(-h - 1) + '">' + t + '</text>';
    }
    o.dot = fine ? 0.55 : 0.75;
  } else if (style === 'duplex') {
    // classic hunting duplex: thick posts to a third of the way in, a thin cross in the middle, nothing on the centre
    const e = 34;
    o.posts = 'M-100 0H-' + e + 'M' + e + ' 0H100M0 -100V-' + e + 'M0 ' + e + 'V100'; o.postW = 3.2;
    o.cross = 'M-' + e + ' 0H' + e + 'M0 -' + e + 'V' + e; o.crossW = 0.42;
  } else if (style === 'mil') {
    // a dot every 5 mrad along the four arms (real angles at this zoom: a 1.75 m person at 100 m is 17.5 mrad, 3.5 dots),
    // a small gap and a lit centre dot
    const e = 60, g = 1.3, step = 5 * u, r = Math.max(0.35, 0.0016 * c.H / unit);
    o.posts = 'M-100 0H-' + e + 'M' + e + ' 0H100M0 -100V-' + e + 'M0 ' + e + 'V100'; o.postW = 1.8;
    o.cross = 'M-' + e + ' 0H-' + g + 'M' + g + ' 0H' + e + 'M0 -' + e + 'V-' + g + 'M0 ' + g + 'V' + e; o.crossW = 0.3;
    for (let k = 1; k * step < e - 1; k++) for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = sx * k * step, y = sy * k * step;
      o.mils += 'M' + f(x - r) + ' ' + f(y) + 'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0';
    }
    o.dot = Math.max(1.1 / unit, 0.0028 * c.H / unit); o.glow = o.dot * 2;
  } else if (style === 'cruz') {
    // thin cross with a gap, thicker posts outside, an illuminated dot (fixed size: at 2× the true angles are tiny)
    const g = cap(Math.max(1.2, 0.012 * c.H / unit), 9), e = c.see ? 58 : 52, end = c.see ? 94 : 100;
    o.posts = 'M-' + end + ' 0H-' + e + 'M' + e + ' 0H' + end + 'M0 ' + e + 'V' + end; o.postW = cap(Math.max(0.8, 0.005 * c.H / unit), 5);
    o.cross = 'M-' + e + ' 0H-' + f(g) + 'M' + f(g) + ' 0H' + e + 'M0 -' + e + 'V-' + f(g) + 'M0 ' + f(g) + 'V' + e; o.crossW = cap(Math.max(0.25, 0.0022 * c.H / unit), 1.6);
    o.dot = cap(Math.max(1.4 / unit, 0.0045 * c.H / unit), 4); o.glow = o.dot * 2.2;
  } else if (style === 'chevron') {
    // the tip of the chevron is the aim point; a post below it and lines at the sides, none crossing the centre
    const s = cap(Math.max(1.6, 0.03 * c.H / unit), 17);   // ~3 % of the picture height (in a window: an eighth of it)
    o.lit = 'M0 0L' + f(s) + ' ' + f(s * 0.9) + 'L' + f(s * 0.62) + ' ' + f(s * 0.9) + 'L0 ' + f(s * 0.34) + 'L' + f(-s * 0.62) + ' ' + f(s * 0.9) + 'L' + f(-s) + ' ' + f(s * 0.9) + 'Z';
    const end = c.see ? 92 : 100;
    o.posts = 'M0 ' + f(s * 1.6) + 'V' + end + 'M-' + end + ' 0H-' + f(s * 3.2) + 'M' + f(s * 3.2) + ' 0H' + end; o.postW = cap(Math.max(0.5, 0.0035 * c.H / unit), 3.5);
  } else if (style === 'holo') {
    const r = cap(0.06 * c.H / unit, 62), w = cap(Math.max(0.35, 0.0045 * c.H / unit), 4.5), t = c.see ? r * 0.37 : 0.022 * c.H / unit;
    o.ring = 'M' + f(-r) + ' 0A' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(r) + ' 0A' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-r) + ' 0' +
      'M0 ' + f(-r) + 'V' + f(-r + t) + 'M0 ' + f(r) + 'V' + f(r - t) + 'M' + f(-r) + ' 0H' + f(-r + t) + 'M' + f(r) + ' 0H' + f(r - t);
    o.ringW = w; o.dot = cap(Math.max(1.4 / unit, 0.0042 * c.H / unit), 5); o.glow = o.dot * 2.4;
  } else if (style === 'dot') {
    o.dot = cap(Math.max(2 / unit, 0.0058 * c.H / unit), 16); o.glow = o.dot * 2.6;
  }
  return o;
}

/* ------------------------------------------------------------------ models (THREE passed in)
   Built from code (original work, no third-party asset): lathe profiles for the round bodies, bevelled boxes for the
   rest, one mesh per material. Origin = the middle of the foot on the rail top; the line of sight at y = O.axis. */
function build(T, id, env) {
  const O = get(id); if (O.builtin) return null;
  const A = O.axis, parts = {};
  const mat = (k, o) => { if (!parts[k]) parts[k] = { m: new T.MeshStandardMaterial(Object.assign({ envMap: env || null }, o)), g: [] }; return parts[k]; };
  const M = {
    body: () => mat('body', { color: 0x1c1d20, metalness: 0.45, roughness: 0.42, envMapIntensity: 0.8 }),
    dark: () => mat('dark', { color: 0x2b2e33, metalness: 0.55, roughness: 0.34, envMapIntensity: 1 }),
    fde: () => mat('fde', { color: 0x8a7856, metalness: 0.12, roughness: 0.58, envMapIntensity: 0.4 }),
    rubber: () => mat('rubber', { color: 0x141414, metalness: 0, roughness: 0.92, envMapIntensity: 0.25 }),
    inner: () => mat('inner', { color: 0x0c0c0d, metalness: 0, roughness: 0.95, envMapIntensity: 0.15, side: T.BackSide }),   // the inside of a tube you look through
    steel: () => mat('steel', { color: 0x9a9ea4, metalness: 0.95, roughness: 0.28, envMapIntensity: 1.25 }),
    accent: () => mat('accent', { color: 0xe0702a, metalness: 0, roughness: 0.5, emissive: 0x2a0d00, envMapIntensity: 0.4 }),
    lens: () => mat('lens', { color: 0x1d4a63, metalness: 0.3, roughness: 0.04, emissive: 0x0c2233, envMapIntensity: 1.6 }),
    lensR: () => mat('lensR', { color: 0x6a3420, metalness: 0.35, roughness: 0.05, emissive: 0x1a0804, envMapIntensity: 1.5, transparent: true, opacity: 0.55, depthWrite: false }),
    eye: () => mat('eye', { color: 0x080b0e, metalness: 0.2, roughness: 0.08, emissive: 0x010304, envMapIntensity: 0.35 }),
    glass: () => mat('glass', { color: 0x9fd3e8, metalness: 0, roughness: 0.05, envMapIntensity: 0.6, transparent: true, opacity: 0.1, depthWrite: false, side: T.DoubleSide }),
    fiber: () => mat('fiber', { color: 0x7dff6a, metalness: 0, roughness: 0.4, emissive: 0x2a8a1c, envMapIntensity: 0.3 }),
  };
  const add = (geo, m, x, y, z, rx, ry, rz) => { if (rx || ry || rz) geo.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0))); geo.translate(x || 0, y || 0, z || 0); m().g.push(geo); return geo; };
  // round body along z: profile [[r, z], …] from the back (+z) to the front (−z), on the line of sight
  const lathe = (pts, m, segs, y) => { const g = new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], -p[1])), segs || 32); g.rotateX(-Math.PI / 2); return add(g, m, 0, y == null ? A : y, 0); };
  const zcyl = (r1, r2, z0, z1, m, y, segs, x, open) => { const g = new T.CylinderGeometry(r1, r2, Math.abs(z0 - z1), segs || 28, 1, !!open); g.rotateX(Math.PI / 2); return add(g, m, x || 0, y == null ? A : y, (z0 + z1) / 2); };
  const xcyl = (r, len, x, y, z, m, segs) => { const g = new T.CylinderGeometry(r, r, len, segs || 20); g.rotateZ(Math.PI / 2); return add(g, m, x, y, z); };
  const ycyl = (r, h, x, y, z, m, segs) => add(new T.CylinderGeometry(r, r, h, segs || 20), m, x, y, z);
  const box = (w, h, d, x, y, z, m, rx, ry, rz) => add(new T.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  // a box with rounded long edges (along z): a rounded rectangle in x-y, extruded
  const rbox = (w, h, d, r, x, y, z, m, hole) => {
    const s = new T.Shape(), a = w / 2, b = h / 2;
    s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.quadraticCurveTo(a, -b, a, -b + r); s.lineTo(a, b - r); s.quadraticCurveTo(a, b, a - r, b);
    s.lineTo(-a + r, b); s.quadraticCurveTo(-a, b, -a, b - r); s.lineTo(-a, -b + r); s.quadraticCurveTo(-a, -b, -a + r, -b);
    if (hole) { const h = new T.Path(); h.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(h); }
    const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: hole ? 16 : 4 }); g.translate(0, 0, -d / 2); return add(g, m, x, y, z);
  };
  const disc = (r, z, m, y, back) => { const g = new T.CircleGeometry(r, 28); if (!back) g.rotateY(Math.PI); return add(g, m, 0, y == null ? A : y, z); };
  // picatinny clamp: a foot on the rail, its cross bolt and the nut on the right
  const clampFoot = (len, w, z) => { box(w, 0.006, len, 0, 0.003, z, M.body); xcyl(0.0026, w + 0.006, 0, 0.0035, z, M.steel, 10); ycyl(0.0046, 0.004, w / 2 + 0.004, 0.0035, z, M.steel, 6).rotateZ(Math.PI / 2); };

  if (id === 'punto') {
    // micro red dot on a riser (the dot sits on the same line as the big scope's: no head movement to change sights)
    clampFoot(0.034, 0.024, 0);
    box(0.018, A - 0.0185, 0.028, 0, 0.006 + (A - 0.0185) / 2, 0, M.body);                 // riser
    for (const sx of [-1, 1]) box(0.0012, A - 0.024, 0.018, sx * 0.0091, 0.006 + (A - 0.0185) / 2, 0, M.dark);   // lightening cuts
    box(0.02, 0.006, 0.026, 0, A - 0.0125, 0, M.body);                                       // the tube's base
    lathe([[0.0146, 0.0195], [0.0146, 0.0168], [0.0135, 0.0165], [0.0135, -0.0165], [0.0147, -0.0168], [0.015, -0.024], [0.0128, -0.024]], M.body, 36);
    zcyl(0.0129, 0.0129, -0.0238, 0.0164, M.inner, A, 32, 0, true);                              // the inside of the tube (open: you look through it)
    ycyl(0.0062, 0.005, 0, A + 0.0158, 0.002, M.dark); ycyl(0.0048, 0.0016, 0, A + 0.0188, 0.002, M.body);            // elevation cap
    xcyl(0.0074, 0.008, 0.0174, A, 0.002, M.dark); xcyl(0.0032, 0.0012, 0.0218, A + 0.0035, 0.002, M.accent, 10);      // brightness dial
    disc(0.0127, -0.019, M.lensR); disc(0.0127, 0.0165, M.glass, A, true);
  } else if (id === 'holo') {
    // holographic: base with the battery across it, the electronics at the back, a hood over a big window
    box(0.032, 0.01, 0.088, 0, 0.005, 0, M.body);
    xcyl(0.0026, 0.04, 0, 0.004, 0.024, M.steel, 10);
    box(0.004, 0.006, 0.03, -0.018, 0.005, 0.024, M.dark, 0, 0.12, 0);                       // quick-release lever
    xcyl(0.0072, 0.034, 0, 0.0085, -0.03, M.body); xcyl(0.008, 0.004, 0.0185, 0.0085, -0.03, M.dark, 24);             // battery and its cap (under the window)
    // the electronics: a low block at the back, under the window (it must never cross the line of sight)
    const eh = A - 0.0175 - 0.01;
    box(0.036, eh, 0.03, 0, 0.01 + eh / 2, 0.031, M.body);
    for (const sx of [-1, 1]) box(0.008, Math.min(0.004, eh * 0.7), 0.003, sx * 0.008, 0.01 + eh / 2, 0.0465, M.rubber);   // buttons
    box(0.0025, 0.004, 0.006, 0.0182, 0.01 + eh / 2, 0.031, M.accent);
    const y0 = A - 0.016, y1 = A + 0.015, zf = -0.036, zb = 0.016;
    for (const sx of [-1, 1]) box(0.0045, y1 + 0.005 - 0.01, zb - zf, sx * 0.0196, (0.01 + y1 + 0.005) / 2, (zf + zb) / 2, M.body);   // hood sides
    rbox(0.044, 0.007, zb - zf, 0.002, 0, y1 + 0.0035, (zf + zb) / 2, M.body);                   // hood top
    box(0.044, y0 - 0.01, 0.006, 0, (0.01 + y0) / 2, zf + 0.003, M.body);                        // window frame (bottom)
    add(new T.PlaneGeometry(0.0347, y1 - y0), M.glass, 0, (y0 + y1) / 2, zf + 0.004);   // one pane: looking through it tints little
  } else if (id === 'tactica') {
    // short prism scope in sand colour: housing, eyepiece, objective, a fibre on top, two adjusters, thumbscrew mount
    box(0.026, 0.016, 0.05, 0, 0.008, 0, M.fde);
    for (const sz of [-1, 1]) { xcyl(0.006, 0.006, -0.017, 0.007, sz * 0.015, M.dark, 16); box(0.003, 0.014, 0.004, -0.0215, 0.007, sz * 0.015, M.dark); }
    rbox(0.042, 0.036, 0.06, 0.006, 0, A, 0, M.fde, 0.0155);                                    // housing, bored through
    zcyl(0.0151, 0.0151, 0.0302, -0.0302, M.inner, A, 32, 0, true);
    lathe([[0.016, 0.03], [0.0172, 0.046], [0.0185, 0.055], [0.0188, 0.058]], M.fde, 32);
    lathe([[0.0192, 0.056], [0.0196, 0.064], [0.0168, 0.064]], M.rubber, 32);
    lathe([[0.017, -0.03], [0.019, -0.048], [0.0212, -0.068], [0.0218, -0.078], [0.0196, -0.078]], M.fde, 32);
    box(0.016, 0.004, 0.036, 0, A + 0.02, 0.006, M.fde);                                         // top rail
    for (let i = -1; i <= 1; i++) box(0.0165, 0.0022, 0.004, 0, A + 0.0212, 0.006 + i * 0.01, M.dark);
    zcyl(0.0019, 0.0019, 0.03, -0.024, M.fiber, A + 0.0245, 10, 0.009);                          // fibre (lights the chevron)
    ycyl(0.0068, 0.006, 0, A + 0.021, -0.022, M.dark); xcyl(0.0068, 0.006, 0.0237, A, -0.022, M.dark);
    disc(0.0195, -0.074, M.lensR); disc(0.0166, 0.058, M.glass, A, true);
  } else if (id === 'x2') {
    // compact 2× scope: quick-release cantilever mount, 30 mm tube, big eyepiece, illumination knob
    box(0.026, 0.008, 0.07, 0, 0.004, 0, M.body);
    for (const z of [-0.02, 0.02]) { box(0.018, A - 0.008 - 0.012, 0.012, 0, 0.008 + (A - 0.02) / 2, z, M.body); zcyl(0.0178, 0.0178, z + 0.006, z - 0.006, M.body, A, 32, 0, true); }
    box(0.004, 0.006, 0.026, -0.0155, 0.006, 0, M.dark, 0, 0.1, 0);                               // throw lever
    zcyl(0.015, 0.015, 0.035, -0.035, M.body, A, 32, 0, true); zcyl(0.0136, 0.0136, 0.035, -0.035, M.inner, A, 32, 0, true);   // open: you look through it
    lathe([[0.015, 0.035], [0.0195, 0.05], [0.0205, 0.062]], M.body, 32);
    lathe([[0.0208, 0.06], [0.0212, 0.072], [0.0175, 0.072]], M.rubber, 32);
    lathe([[0.015, -0.035], [0.0185, -0.05], [0.019, -0.07], [0.0172, -0.07]], M.body, 32);
    xcyl(0.0085, 0.008, -0.0185, A, 0, M.dark, 24); xcyl(0.0035, 0.0012, -0.0232, A + 0.004, 0, M.accent, 10);   // illumination
    ycyl(0.0075, 0.006, 0, A + 0.018, 0, M.dark); ycyl(0.0058, 0.0016, 0, A + 0.0218, 0, M.body);
    disc(0.0172, -0.068, M.lensR); disc(0.0172, 0.07, M.glass, A, true);
  } else if (id === 'x4') {
    // classic 4× hunting scope: 1" tube on two low rings, small capped turrets, 32 mm objective, bronze line on the ocular
    for (const z of [-0.04, 0.04]) {
      clampFoot(0.016, 0.022, z);
      box(0.016, A - 0.006 - 0.011, 0.012, 0, 0.006 + (A - 0.017) / 2, z, M.body);
      zcyl(0.0168, 0.0168, z + 0.006, z - 0.006, M.body, A, 32);
      for (const sx of [-1, 1]) xcyl(0.0019, 0.0035, sx * 0.0162, A + 0.009, z, M.steel, 10);
    }
    zcyl(0.0128, 0.0128, 0.1, -0.08, M.body, A, 36);
    rbox(0.03, 0.025, 0.04, 0.006, 0, A, 0, M.body);
    ycyl(0.0098, 0.012, 0, A + 0.0185, 0, M.dark, 24); xcyl(0.0098, 0.01, 0.0195, A, 0, M.dark, 24);
    lathe([[0.0128, 0.1], [0.0182, 0.118], [0.0186, 0.155], [0.0192, 0.17], [0.0158, 0.17]], M.body, 36);
    zcyl(0.0189, 0.0189, 0.128, 0.132, M.accent, A, 36);
    lathe([[0.0128, -0.08], [0.0212, -0.112], [0.0215, -0.15], [0.0196, -0.15]], M.body, 36);
    disc(0.0194, -0.148, M.lens); disc(0.0158, 0.166, M.eye, A, true);
  } else if (id === 'x6') {
    // 6× scope on two picatinny rings: 30 mm tube, capped turrets, 44 mm objective
    for (const z of [-0.05, 0.05]) {
      clampFoot(0.018, 0.024, z);
      box(0.018, A - 0.006 - 0.012, 0.014, 0, 0.006 + (A - 0.018) / 2, z, M.body);
      zcyl(0.0192, 0.0192, z + 0.007, z - 0.007, M.body, A, 32);
      for (const sx of [-1, 1]) xcyl(0.0022, 0.004, sx * 0.0185, A + 0.011, z, M.steel, 10);
    }
    zcyl(0.015, 0.015, 0.11, -0.1, M.body, A, 36);
    rbox(0.034, 0.028, 0.05, 0.007, 0, A, -0.005, M.body);
    ycyl(0.012, 0.014, 0, A + 0.021, -0.005, M.dark, 28); ycyl(0.0105, 0.002, 0, A + 0.029, -0.005, M.body, 28);
    xcyl(0.012, 0.012, 0.022, A, -0.005, M.dark, 28);
    lathe([[0.015, 0.11], [0.019, 0.125], [0.019, 0.14]], M.body, 36);
    zcyl(0.0196, 0.0196, 0.14, 0.16, M.dark, A, 36);
    lathe([[0.0198, 0.16], [0.0205, 0.185], [0.0212, 0.2], [0.0172, 0.2]], M.rubber, 36);
    lathe([[0.015, -0.1], [0.026, -0.14], [0.026, -0.195], [0.0266, -0.195], [0.0266, -0.2], [0.0245, -0.2]], M.body, 40);
    disc(0.0242, -0.197, M.lens); disc(0.0172, 0.196, M.eye, A, true);
  } else if (id === 'largo') {
    // long-range scope: one-piece mount, 34 mm tube, big turrets, side focus wheel, 56 mm objective with a sunshade
    box(0.024, 0.008, 0.17, 0, 0.004, -0.015, M.body);
    for (const z of [-0.065, 0.045]) {
      box(0.02, A - 0.008 - 0.012, 0.016, 0, 0.008 + (A - 0.02) / 2, z, M.body);
      zcyl(0.0205, 0.0205, z + 0.008, z - 0.008, M.body, A, 32);
      for (const sx of [-1, 1]) xcyl(0.0024, 0.004, sx * 0.0195, A + 0.012, z, M.steel, 10);
    }
    zcyl(0.017, 0.017, 0.115, -0.135, M.body, A, 36);
    rbox(0.038, 0.032, 0.066, 0.008, 0, A, -0.01, M.body);
    ycyl(0.0145, 0.006, 0, A + 0.019, -0.01, M.body, 28); ycyl(0.0168, 0.018, 0, A + 0.031, -0.01, M.dark, 28);
    ycyl(0.012, 0.002, 0, A + 0.041, -0.01, M.body, 28); box(0.0012, 0.0006, 0.009, 0, A + 0.0423, -0.006, M.accent);
    xcyl(0.0145, 0.016, 0.026, A, -0.01, M.dark, 28); box(0.0006, 0.0012, 0.009, 0.0342, A, -0.006, M.accent);
    xcyl(0.028, 0.005, -0.0215, A, -0.01, M.dark, 36); xcyl(0.012, 0.008, -0.0245, A, -0.01, M.body, 28);               // focus wheel
    lathe([[0.017, 0.115], [0.0205, 0.13], [0.0205, 0.15]], M.body, 36);
    zcyl(0.0218, 0.0218, 0.15, 0.17, M.dark, A, 36); box(0.004, 0.016, 0.006, 0.019, A + 0.016, 0.16, M.dark, 0, 0, -0.7);   // power ring + throw lever
    lathe([[0.021, 0.17], [0.0225, 0.19], [0.0228, 0.205], [0.0188, 0.205]], M.rubber, 36);
    lathe([[0.017, -0.135], [0.031, -0.18], [0.031, -0.25], [0.0316, -0.25], [0.0316, -0.33], [0.0298, -0.33]], M.body, 40);
    disc(0.0285, -0.248, M.lens); disc(0.0185, 0.2, M.eye, A, true);
  }
  // one mesh per material
  const g = new T.Group(); g.name = 'mira_' + id;
  for (const k in parts) {
    const geos = parts[k].g.map(x => x.index ? x.toNonIndexed() : x), n = geos.reduce((s, x) => s + x.attributes.position.count, 0);
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3); let o = 0;
    for (const x of geos) { if (!x.attributes.normal) x.computeVertexNormals(); P.set(x.attributes.position.array, o * 3); N.set(x.attributes.normal.array, o * 3); o += x.attributes.position.count; }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(P, 3)); geo.setAttribute('normal', new T.BufferAttribute(N, 3)); geo.computeBoundingSphere();
    const mesh = new T.Mesh(geo, parts[k].m); mesh.name = 'mira_' + id + '_' + k; parts[k].m.name = 'MIRA_' + k;
    if (parts[k].m.transparent) mesh.renderOrder = 2;
    g.add(mesh);
  }
  g.userData.axis = A;
  return g;
}

const SDMiras = { OPTICS, ORDER, DEFAULT, RIFLES, ADS_Y, VM_FOV, get, sanitize, nextZoom, firstZoom, zoomLabel, sensKey, placement, windowFrac, reticle, build };
if (typeof module !== 'undefined' && module.exports) module.exports = SDMiras; else root.SDMiras = SDMiras;
})(typeof window !== 'undefined' ? window : globalThis);
