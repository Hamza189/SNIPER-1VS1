/* SNIPER DUEL — player settings (sensitivity, invert Y, touch options).
   Pure: no DOM. The page loads/saves them through a small storage adapter. */
(function (root) {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const DEFAULTS = {
  sensH: 1,        // horizontal look sensitivity
  sensV: 1,        // vertical look sensitivity
  adsSens: 1,      // extra multiplier while the scope is up (on top of the automatic zoom scaling)
  touchLook: 1,    // extra multiplier for finger dragging (only used on touch screens)
  invertY: false,
  leftFire: false, // second FIRE button on the left side (3-4 finger play)
  releaseFire: true, // touch, rifle: holding FIRE raises the scope, lifting the finger fires
  quality: 'auto',  // graphics: auto | bajo | medio | alto
  fpsCap: 60,       // 60 or 30 (30 saves battery and heat on phones)
  showFps: false,   // small FPS counter on screen
  // aiming (ADS)
  // crouch button/key: slide = tap to crouch, and after a slide you stand up on your own (phones) | toggle = tap in, tap out
  // (stays crouched after a slide) | hold = crouched while held (PC: C / Ctrl held, as always)
  crouchMode: 'hold',
  view: 'fp',       // fp = 1ª persona | tp = 3ª persona (cámara detrás del hombro; con la mira, siempre 1ª persona)
  adsMode: 'holdDrag', // touch MIRA button: holdDrag (hold = aim, drag the same finger) | hold | toggle (tap in, tap out; turn with any free finger)
  adsH: 1,          // horizontal multiplier while aiming (any weapon)
  adsV: 1,          // vertical multiplier while aiming (any weapon)
  touchDead: 2,     // px a finger must travel before it starts turning the camera (stops jitter on touch-down)
  smooth: 0,        // 0 = direct; up to 0.8 = softer turning (adds a little delay)
  calmVM: false,    // reduce the weapon's visual bob and sway (accessibility); never changes the aim
  // audio (0..1 per channel; the final level is master × channel)
  volMaster: 1, volShots: 1, volFx: 1, volSteps: 1, volAmb: 1, mute: false,
  // gameplay info (only what the player sees; never the rules)
  hitmarkers: true, dmgDir: true,
  minimap: true,    // minimap at the top left: the map from above and the enemies when they shoot
  // accessibility
  lowFlash: false,  // softer red damage flash and screen shake (visual only)
  // HUD 2 (?hud=2) only: peek keys and modes, mouse wheel to switch weapons
  leanKeyL: 'KeyQ', leanKeyR: 'KeyE',
  leanMode: 'hold',   // PC keys: hold (lean while the key is down) | toggle (press in, press out)
  leanTouch: 'toggle', // touch buttons: toggle (tap in, tap out: the left thumb stays on the stick) | hold
  wheelSwap: false,   // mouse wheel switches weapons when not aiming (aiming: it still changes the zoom)
  // 30-10-2026 (owner: the settings of the big mobile shooters, «añade todo lo que puedas»)
  leftFireAds: false, // the left FIRE button only shows while aiming
  // sensitivity per situation, on top of horizontal/vertical: no sight in 1st / 3rd person, and each zoom of the scope
  sensFP: 1, sensTP: 1, scope4: 1, scope8: 1,
  // gyroscope (phones): turning the phone turns the camera. off | ads (only while aiming) | on (always)
  gyro: 'off', gyroSens: 1, gyroAds: 1, gyroInv: false,
  // crosshair: colour, style, line length, thickness, extra gap (the gap still opens with the real spread), dark outline
  xColor: '#f4ead8', xStyle: 'crossdot', xLen: 10, xThick: 2, xGap: 3, xOutline: true,
  // scope: colour of the centre dot, and the lines in that colour too (illuminated reticle)
  retColor: '#ff3b2f', retLit: false,
  hitColor: '#ffffff', // hit marker (kills stay red, headshots gold)
  blood: 'red',        // hit effect on bodies: red | green | yellow
  bright: 1,           // brightness (exposure), 0.7..1.4
  look: 'clasico',     // picture style (applies on reload): clasico | vivo | realista | suave | cine
  cvd: 'off',          // colour-blind correction (applies on reload): off | prot | deut | trit
  volUi: 1,            // menus and buttons, its own volume
  vibrate: false       // vibration when firing and when hit (Android; iPhone browsers cannot vibrate)
};
// which settings each tab of AJUSTES owns (its RESTAURAR resets only these)
const CATEGORIES = {
  controles: ['view', 'crouchMode', 'adsMode', 'leftFire', 'leftFireAds', 'releaseFire', 'leanKeyL', 'leanKeyR', 'leanMode', 'leanTouch', 'wheelSwap'],
  sensibilidad: ['sensH', 'sensV', 'adsSens', 'adsH', 'adsV', 'touchLook', 'touchDead', 'smooth', 'invertY', 'sensFP', 'sensTP', 'scope4', 'scope8', 'gyro', 'gyroSens', 'gyroAds', 'gyroInv'],
  mira: ['xColor', 'xStyle', 'xLen', 'xThick', 'xGap', 'xOutline', 'retColor', 'retLit', 'hitColor', 'blood'],
  graficos: ['quality', 'fpsCap', 'showFps', 'bright', 'look', 'cvd'],
  audio: ['volMaster', 'volShots', 'volFx', 'volSteps', 'volAmb', 'volUi', 'mute', 'vibrate'],
  jugabilidad: ['hitmarkers', 'dmgDir', 'minimap'],
  accesibilidad: ['calmVM', 'lowFlash']
};
// Phones start from different values (agreed after testing on iPhone); PC defaults are unchanged.
// A device that already saved its settings keeps them; RESTAURAR goes back to these.
// adsSens 1.3 → 0.8 on 12-10-2026 (owner's choice: aiming on the move was too twitchy compared with COD Mobile)
const TOUCH_DEFAULTS = { touchLook: 1.6, adsSens: 0.8, crouchMode: 'slide' };   // crouchMode 'slide': owner's request 25-10-2026
function defaults(touch) { return Object.assign({}, DEFAULTS, touch ? TOUCH_DEFAULTS : {}, { v: VERSION }); }
const RANGES = { sensH: [0.2, 3], sensV: [0.2, 3], adsSens: [0.3, 2], touchLook: [0.3, 4], adsH: [0.3, 2], adsV: [0.3, 2], touchDead: [0, 12], smooth: [0, 0.8],
  volMaster: [0, 1], volShots: [0, 1], volFx: [0, 1], volSteps: [0, 1], volAmb: [0, 1], volUi: [0, 1],
  sensFP: [0.3, 3], sensTP: [0.3, 3], scope4: [0.3, 2], scope8: [0.3, 2], gyroSens: [0.2, 4], gyroAds: [0.2, 4],
  xLen: [3, 24], xThick: [1, 5], xGap: [0, 30], bright: [0.7, 1.4] };
// mixed: a quick tap fixes the sight (tap again to leave), holding aims only while held
const ADS_MODES = ['holdDrag', 'hold', 'toggle', 'mixed'];
const GYRO_MODES = ['off', 'ads', 'on'];
// the colours offered (crosshair, scope dot, hit marker): bone (the HUD's), white, red, yellow, green, cyan, blue, magenta, black
const PALETTE = ['#f4ead8', '#ffffff', '#ff3b2f', '#ffe14d', '#4dff6a', '#3de0ff', '#3d7bff', '#ff4dd2', '#000000'];
const X_STYLES = ['crossdot', 'cross', 'dot', 'circle', 'tee'];
const BLOODS = ['red', 'green', 'yellow'];
const LOOKS = ['clasico', 'vivo', 'realista', 'suave', 'cine'];
const CVDS = ['off', 'prot', 'deut', 'trit'];
const CROUCH_MODES = ['slide', 'toggle', 'hold'];

// any stored object → a complete, valid settings object (unknown keys dropped, numbers clamped)
// settings format version (stored as v), for future migrations
const VERSION = 3;
function sanitize(o, touch) {
  const s = defaults(touch);
  if (!o || typeof o !== 'object') return s;
  for (const k of Object.keys(RANGES)) {
    const v = Number(o[k]);
    if (o[k] !== undefined && o[k] !== null && o[k] !== '' && isFinite(v)) s[k] = clamp(v, RANGES[k][0], RANGES[k][1]);
  }
  for (const k of ['invertY', 'leftFire', 'releaseFire', 'showFps', 'calmVM', 'mute', 'hitmarkers', 'dmgDir', 'minimap', 'lowFlash', 'wheelSwap',
    'leftFireAds', 'gyroInv', 'xOutline', 'retLit', 'vibrate']) if (typeof o[k] === 'boolean') s[k] = o[k];
  for (const k of ['xColor', 'retColor', 'hitColor']) if (PALETTE.includes(o[k])) s[k] = o[k];
  if (GYRO_MODES.includes(o.gyro)) s.gyro = o.gyro;
  if (X_STYLES.includes(o.xStyle)) s.xStyle = o.xStyle;
  if (BLOODS.includes(o.blood)) s.blood = o.blood;
  if (LOOKS.includes(o.look)) s.look = o.look;
  if (CVDS.includes(o.cvd)) s.cvd = o.cvd;
  // peek keys: a key code (the HUD 2 settings only offer free keys); never the same key for both sides
  const KEY = /^[A-Za-z][A-Za-z0-9]{1,19}$/;
  if (KEY.test(o.leanKeyL) && KEY.test(o.leanKeyR) && o.leanKeyL !== o.leanKeyR) { s.leanKeyL = o.leanKeyL; s.leanKeyR = o.leanKeyR; }
  if (o.leanMode === 'hold' || o.leanMode === 'toggle') s.leanMode = o.leanMode;
  if (o.leanTouch === 'hold' || o.leanTouch === 'toggle') s.leanTouch = o.leanTouch;
  if (ADS_MODES.includes(o.adsMode)) s.adsMode = o.adsMode;
  if (CROUCH_MODES.includes(o.crouchMode)) s.crouchMode = o.crouchMode;
  if (o.view === 'fp' || o.view === 'tp') s.view = o.view;
  if (['auto', 'bajo', 'medio', 'alto'].includes(o.quality)) s.quality = o.quality;
  if (o.fpsCap === 30 || o.fpsCap === 60) s.fpsCap = o.fpsCap;
  s.v = VERSION;
  return s;
}
// reads from a store with get(key, default); migrates the old single "sens" value
function load(store, touch) {
  const saved = store.get('settings', null);
  // v3: a phone still on the old default aiming sensitivity (1.3) moves to the new one; a value the player chose stays
  if (saved && touch && typeof saved === 'object' && !(saved.v >= 3) && saved.adsSens === 1.3) return sanitize(Object.assign({}, saved, { adsSens: TOUCH_DEFAULTS.adsSens }), touch);
  if (saved) return sanitize(saved, touch);
  const old = Number(store.get('sens', 1));
  return sanitize(isFinite(old) ? { sensH: old, sensV: old } : {}, touch);
}
function save(store, s, touch) { store.set('settings', sanitize(s, touch)); }
// one tab back to its defaults, the rest untouched
function resetCategory(s, cat, touch) {
  const d = defaults(touch), o = Object.assign({}, s);
  for (const k of CATEGORIES[cat] || []) o[k] = d[k];
  return sanitize(o, touch);
}

/* Converts a pointer movement in pixels into a yaw/pitch change in radians.
   ctx = { scoped (rifle scope up), ads (0..1, any weapon), fovRatio (tan(fov/2)/tan(baseFov/2)), touch,
           tp (3rd person camera), zoom (4 or 8: the scope's zoom) }
   Linear (no acceleration): the same finger travel always turns the same amount. */
function sitMul(s, ctx) {
  const a = Math.max(0, Math.min(1, ctx.ads || 0)), m = v => v == null ? 1 : v;
  // no sight: 1st or 3rd person (fades out while the sight comes up); the scope: its zoom's own multiplier
  const view = 1 + (m(ctx.tp ? s.sensTP : s.sensFP) - 1) * (1 - a);
  return { a, view, scope: ctx.scoped ? s.adsSens * m(ctx.zoom === 4 ? s.scope4 : s.scope8) : 1 };
}
function lookDelta(dx, dy, s, ctx) {
  const base = ctx.touch ? 0.0042 : 0.0022, M = sitMul(s, ctx);
  const k = base * ctx.fovRatio * M.scope * M.view * (ctx.touch ? s.touchLook : 1);
  const a = M.a;
  const h = 1 + ((s.adsH == null ? 1 : s.adsH) - 1) * a, v = 1 + ((s.adsV == null ? 1 : s.adsV) - 1) * a;
  return { yaw: -dx * k * s.sensH * h, pitch: -dy * k * s.sensV * v * (s.invertY ? -1 : 1) };
}
/* Gyroscope: the phone's own turn (degrees, already in screen axes: yaw left +, pitch up +) → the camera's (radians).
   At 1 the camera turns as much as the phone (1:1) with no sight; the scope divides it by its zoom (fovRatio) like
   the finger. Only on for 'on', or for 'ads' while aiming. Never adds anything the player did not do. */
function gyroActive(s, ctx) { return s.gyro === 'on' || (s.gyro === 'ads' && (ctx.ads || 0) > 0.5); }
function gyroDelta(yawDeg, pitchDeg, s, ctx) {
  if (!gyroActive(s, ctx)) return { yaw: 0, pitch: 0 };
  const M = sitMul(s, ctx), sens = (ctx.ads || 0) > 0.5 ? s.gyroAds : s.gyroSens, inv = s.gyroInv ? -1 : 1;
  const k = Math.PI / 180 * sens * ctx.fovRatio * (ctx.scoped ? M.scope : 1) * inv;
  return { yaw: yawDeg * k, pitch: pitchDeg * k * (s.invertY ? -1 : 1) };
}
/* Frame-rate independent smoothing of the look input (0 = off). Returns the part to apply now;
   the rest stays in st (a small reservoir that empties within ~0.1-0.3 s). */
function smoothLook(st, dx, dy, smooth, dt) {
  st.x = (st.x || 0) + dx; st.y = (st.y || 0) + dy;
  if (!(smooth > 0)) { const o = { dx: st.x, dy: st.y }; st.x = st.y = 0; return o; }
  const k = 1 - Math.pow(smooth * 0.5, Math.max(0, dt) * 60 * 0.6);
  const o = { dx: st.x * k, dy: st.y * k }; st.x -= o.dx; st.y -= o.dy;
  if (Math.abs(st.x) < 0.01 && Math.abs(st.y) < 0.01) { o.dx += st.x; o.dy += st.y; st.x = st.y = 0; }
  return o;
}

const SDSettings = { VERSION, CATEGORIES, resetCategory, DEFAULTS, TOUCH_DEFAULTS, ADS_MODES, CROUCH_MODES, GYRO_MODES, PALETTE, X_STYLES, BLOODS, LOOKS, CVDS,
  defaults, RANGES, sanitize, load, save, lookDelta, gyroActive, gyroDelta, smoothLook };
if (typeof module !== 'undefined' && module.exports) module.exports = SDSettings; else root.SDSettings = SDSettings;
})(typeof window !== 'undefined' ? window : globalThis);
