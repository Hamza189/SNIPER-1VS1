/* SNIPER DUEL — MENÚ 2 (?menu=2, 02-11-2026, docs/MENU-2.md): the dark tactical room behind the new main menu, and
   the maths that frames the operator and the weapon in the free parts of the screen. Owner: «la sala oscura debería ser
   la referencia principal … un menú con personalidad sin convertirlo en una copia de otros shooters».

   Light on purpose: one room of ~30 boxes and planes (two textures of the game, shared with nothing else so their repeat
   is their own), five lights without shadows, a blob shadow and a few hundred dust motes. The operator, his rifle and the
   weapon on show are the game's own (page.html puts them in). Nothing here touches the rules: it is only what you see.

   Room space: metres, the operator stands at the origin looking at +z (towards the camera); the back wall is at z -4.6.
   buildRoom() is the only part that needs THREE (passed in); the rest is plain maths so node can test it. */
(function (root) {
'use strict';
const TABS = ['inicio', 'personaje', 'armas', 'mapas', 'ajustes'];
// the maps of the game; online: the room's server knows it (all four since CASA ATLAS 2.0 went online, 02-11-2026; the
// CASA ATLAS XL was retired by the owner the same day)
const MAPS = [
  { id: 'arena', name: 'ARENA', sub: 'Patio cerrado de 48 × 32 m · coberturas bajas y un bloque central', online: true },
  { id: 'pueblo', name: 'PUEBLO', sub: 'Pueblo abandonado · calles largas, tejados y torre del agua', online: true },
  { id: 'casa', name: 'CASA ATLAS', sub: 'Piso de 18 × 14 m · combate a corta distancia', online: true, exp: true },
  { id: 'casa2', name: 'CASA ATLAS 2.0', sub: '4 pisos de CASA ATLAS unidos · 43 × 33 m con patio central', online: true }
];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
// frame-rate independent ease towards b (k = how fast, 1/s)
const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);
// the angle a goes to b the short way round
const dampAngle = (a, b, k, dt) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * (1 - Math.exp(-k * dt)); };   // continuous: no jump of 2π
// camera distance so that h metres fill frac of the picture's height with a vertical fov in degrees
const frameDist = (h, frac, fov) => h / (Math.max(0.05, frac) * 2 * Math.tan(fov * Math.PI / 360));
/* where the operator goes: the free part of the screen (a rect in CSS px) for each tab, as an offset of the camera's
   picture (THREE's setViewOffset) and the distance that makes him fill it. vw, vh: the window. Returns
   {dist, ox, oy}: the camera's picture moves ox px right and oy px down so the room's centre lands in the rect's. */
function stageFrame(rect, vw, vh, fov, height) {
  const r = rect && rect.width > 20 && rect.height > 20 ? rect : { left: 0, top: 0, width: vw, height: vh };
  const frac = clamp(r.height / vh, 0.25, 1) * 0.94;
  return { dist: frameDist(height || 2.05, frac, fov), ox: r.left + r.width / 2 - vw / 2, oy: r.top + r.height / 2 - vh / 2 };
}
/* the weapon on show (ARMAS): its slot on screen (CSS px) → a point in front of the camera and how many metres a pixel is
   at that depth. ndc: the slot's centre in the camera's picture (-1..1), already counting the picture's offset. */
function slotPlace(rect, vw, vh, fov, depth) {
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const perPx = 2 * depth * Math.tan(fov * Math.PI / 360) / vh;
  return { ndcX: cx / vw * 2 - 1, ndcY: 1 - cy / vh * 2, perPx, width: rect.width * perPx, height: rect.height * perPx };
}
// a gentle "breathing" and weight shift for the operator in the menu (on top of the game's idle animation): rad / m
function idleSway(t) {
  return { yaw: Math.sin(t * 0.37) * 0.035 + Math.sin(t * 0.13) * 0.02, lean: Math.sin(t * 0.29 + 1.1) * 0.012, bob: Math.sin(t * 1.55) * 0.004 };
}

function buildRoom(T, opt) {
  opt = opt || {};
  const tex = opt.tex || (() => null), low = !!opt.low;
  const scene = new T.Scene();
  scene.background = new T.Color(0x09090a);
  scene.fog = new T.Fog(0x09090a, 7.5, 17);
  const add = (geo, mat, x, y, z, ry) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); return m; };
  const rep = (t, u, v) => { if (t) { t.repeat.set(u, v); } return t; };
  // floor: the game's concrete, darkened; walls: the same concrete and the metal of the town, almost black
  const floorMat = new T.MeshStandardMaterial({ color: 0x2e2c29, roughness: 0.82, metalness: 0.05, map: rep(tex('concrete'), 5, 5), normalMap: low ? null : rep(tex('concrete', true), 5, 5) });
  if (floorMat.normalMap) floorMat.normalScale.set(0.6, 0.6);
  const wallMat = new T.MeshStandardMaterial({ color: 0x161617, roughness: 0.92, map: rep(tex('concrete'), 4, 2) });
  const ribMat = new T.MeshStandardMaterial({ color: 0x0f1011, roughness: 0.55, metalness: 0.5, map: rep(tex('metal'), 0.3, 3) });
  const crateMat = new T.MeshStandardMaterial({ color: 0x2a2d27, roughness: 0.6, metalness: 0.45, map: rep(tex('metal'), 1, 1) });
  const crateDark = new T.MeshStandardMaterial({ color: 0x18191c, roughness: 0.55, metalness: 0.5, map: rep(tex('metal'), 1, 1) });
  const trimMat = new T.MeshStandardMaterial({ color: 0x111214, roughness: 0.4, metalness: 0.7 });
  const lampMat = new T.MeshBasicMaterial({ color: 0xe9f1ff });
  const accentMat = new T.MeshBasicMaterial({ color: 0xff8a2b });
  add(new T.PlaneGeometry(18, 18).rotateX(-Math.PI / 2), floorMat, 0, 0, -1);
  add(new T.BoxGeometry(18, 7, 0.3), wallMat, 0, 3.5, -4.75);
  add(new T.BoxGeometry(0.3, 7, 12), wallMat, -6.2, 3.5, -0.5);
  add(new T.BoxGeometry(0.3, 7, 12), wallMat, 6.2, 3.5, -0.5);
  // the back wall: steel ribs every 1.5 m and a skirting band; an orange LED line low on the wall (the only colour)
  const rib = new T.BoxGeometry(0.16, 7, 0.22);
  for (let x = -6; x <= 6.01; x += 1.5) add(rib, ribMat, x, 3.5, -4.5);
  add(new T.BoxGeometry(18, 0.35, 0.12), trimMat, 0, 0.175, -4.55);
  add(new T.BoxGeometry(5.2, 0.025, 0.02), accentMat, -2.2, 0.42, -4.48);
  add(new T.BoxGeometry(1.4, 0.025, 0.02), accentMat, 3.6, 0.42, -4.48);
  // ceiling lights: two slanted strips and one long one (what lights the room in the reference), each with a soft glow
  const glowTex = (() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); if (!g) return null;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new T.CanvasTexture(c); return t;
  })();
  const glowMat = new T.MeshBasicMaterial({ color: 0xb9c9e4, map: glowTex, transparent: true, opacity: 0.4, depthWrite: false, blending: T.AdditiveBlending, fog: false });
  const strips = [[-2.3, 2.95, -4.1, 0.24, 2.4], [2.5, 2.7, -3.8, -0.3, 2.0], [0.3, 3.25, -4.25, 0.04, 3.2]];
  const lamps = new T.Group(); scene.add(lamps);
  for (const [x, y, z, rz, L] of strips) {
    const g = new T.Group(); g.position.set(x, y, z); g.rotation.set(0.1, 0.35 * Math.sign(x || 1), rz); lamps.add(g);
    const tube = new T.Mesh(new T.BoxGeometry(L, 0.07, 0.16), lampMat); g.add(tube);
    const can = new T.Mesh(new T.BoxGeometry(L + 0.1, 0.05, 0.2), trimMat); can.position.y = 0.06; g.add(can);
    const glow = new T.Mesh(new T.PlaneGeometry(L * 1.3, 0.5), glowMat); glow.position.set(0, -0.02, 0.1); g.add(glow);
  }
  // the haze under each lamp: an open cone, additive and very faint (light through dust)
  const haze = new T.MeshBasicMaterial({ color: 0x7f93b4, transparent: true, opacity: low ? 0.01 : 0.014, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
  for (const [x, y, z] of strips) { const c = new T.Mesh(new T.CylinderGeometry(0.4, 1.9, y, 20, 1, true), haze); c.position.set(x * 0.9, y / 2, z); c.matrixAutoUpdate = false; c.updateMatrix(); scene.add(c); }
  // crates: a stack on the right, one on the left, a long one behind (gun cases) — lids and edges as dark trims
  const crate = (w, h, d, x, z, y0, ry, mat) => {
    const g = new T.Group(); g.position.set(x, (y0 || 0) + h / 2, z); g.rotation.y = ry || 0; scene.add(g);
    g.add(new T.Mesh(new T.BoxGeometry(w, h, d), mat || crateMat));
    const lid = new T.Mesh(new T.BoxGeometry(w + 0.04, 0.06, d + 0.04), trimMat); lid.position.y = h / 2 - 0.12; g.add(lid);
    for (const sx of [-1, 1]) { const e = new T.Mesh(new T.BoxGeometry(0.05, h + 0.01, 0.05), trimMat); e.position.set(sx * (w / 2), 0, d / 2); g.add(e); }
    const latch = new T.Mesh(new T.BoxGeometry(0.12, 0.08, 0.03), ribMat); latch.position.set(0, h / 2 - 0.2, d / 2 + 0.015); g.add(latch);
    return g;
  };
  crate(1.5, 0.95, 1.0, 2.4, -2.1, 0, -0.35, crateMat);
  crate(1.1, 0.62, 0.85, 2.55, -2.2, 0.95, -0.2, crateDark);
  crate(1.2, 1.05, 1.0, -2.6, -2.6, 0, 0.4, crateDark);
  crate(2.4, 0.5, 0.6, -0.6, -3.9, 0, 0, crateMat);
  // the operator's spot: a dark rubber mat and a soft contact shadow
  const stand = new T.Group(); scene.add(stand);
  add(new T.BoxGeometry(2.2, 0.02, 1.6), new T.MeshStandardMaterial({ color: 0x151514, roughness: 0.95 }), 0, 0.01, 0);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    if (g) {
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const sh = new T.Mesh(new T.PlaneGeometry(1.5, 1.2).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
      sh.position.y = 0.025; stand.add(sh);
    }
  }
  // lights: a warm key from the front left, a cold rim from behind on the right, a faint orange bounce near the LED line
  const lights = {};
  lights.hemi = new T.HemisphereLight(0x8d98aa, 0x0c0b0a, 0.14); scene.add(lights.hemi);
  const key = lights.key = new T.SpotLight(0xffefdc, 3.2, 16, 0.3, 0.8, 1.1); key.position.set(-2.4, 4.4, 3.4); scene.add(key);
  key.target.position.set(0, 1.0, 0); scene.add(key.target);
  const rim = lights.rim = new T.SpotLight(0xb8cdf2, 3.5, 14, 0.32, 0.6, 1.2); rim.position.set(2.4, 3.6, -3.2); scene.add(rim);
  rim.target.position.set(0, 1.3, 0); scene.add(rim.target);
  const rim2 = lights.rim2 = new T.SpotLight(0xc7d6ef, 2.0, 14, 0.3, 0.7, 1.2); rim2.position.set(-2.8, 3.4, -2.8); scene.add(rim2);
  rim2.target.position.set(0, 1.2, 0); scene.add(rim2.target);
  lights.fill = new T.DirectionalLight(0xdde4ee, 0.12); lights.fill.position.set(1, 2, 5); scene.add(lights.fill);
  lights.accent = new T.PointLight(0xff8a2b, 0.9, 4.5, 1.5); lights.accent.position.set(-1.5, 0.45, -4.0); scene.add(lights.accent);
  // dust motes drifting through the light (a few hundred points, one draw call)
  const N = low ? 120 : 320, pos = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) { const s = [Math.random() * 7 - 3.5, Math.random() * 3.4, Math.random() * 6 - 4.2, Math.random() * Math.PI * 2]; seed.push(s); pos[i * 3] = s[0]; pos[i * 3 + 1] = s[1]; pos[i * 3 + 2] = s[2]; }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  const dust = new T.Points(pg, new T.PointsMaterial({ color: 0xc9d4e6, size: 0.012, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, fog: true, map: glowTex }));
  dust.frustumCulled = false; scene.add(dust);
  function frame(t) {
    const a = pg.attributes.position.array;
    for (let i = 0; i < N; i++) { const s = seed[i]; a[i * 3] = s[0] + Math.sin(t * 0.07 + s[3]) * 0.35; a[i * 3 + 1] = (s[1] + t * 0.025 * (0.5 + (i % 7) / 7)) % 3.4; a[i * 3 + 2] = s[2] + Math.cos(t * 0.05 + s[3]) * 0.3; }
    pg.attributes.position.needsUpdate = true;
  }
  // everything this room made, for when it is no longer needed (the menu frees it while you play)
  function dispose() {
    const seen = new Set();
    scene.traverse(o => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      for (const m of [].concat(o.material || [])) { if (!m || seen.has(m)) continue; seen.add(m); for (const k of ['map', 'normalMap']) if (m[k] && !seen.has(m[k])) { seen.add(m[k]); m[k].dispose(); } m.dispose(); }
    });
  }
  return { scene, stand, lights, lamps, frame, dispose, exposure: 0.78 };
}

const SDMenu2 = { TABS, MAPS, clamp, damp, dampAngle, frameDist, stageFrame, slotPlace, idleSway, buildRoom };
if (typeof module !== 'undefined' && module.exports) module.exports = SDMenu2; else root.SDMenu2 = SDMenu2;
})(typeof window !== 'undefined' ? window : globalThis);
