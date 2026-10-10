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
  adsMode: 'holdDrag', // touch MIRA button: holdDrag (hold = aim, drag the same finger) | hold | toggle (tap in, tap out; turn with any free finger)
  adsH: 1,          // horizontal multiplier while aiming (any weapon)
  adsV: 1,          // vertical multiplier while aiming (any weapon)
  touchDead: 2,     // px a finger must travel before it starts turning the camera (stops jitter on touch-down)
  smooth: 0,        // 0 = direct; up to 0.8 = softer turning (adds a little delay)
  calmVM: false     // reduce the weapon's visual bob and sway (accessibility); never changes the aim
};
// Phones start from different values (agreed after testing on iPhone); PC defaults are unchanged.
// A device that already saved its settings keeps them; RESTAURAR goes back to these.
const TOUCH_DEFAULTS = { touchLook: 1.6, adsSens: 1.3 };
function defaults(touch) { return Object.assign({}, DEFAULTS, touch ? TOUCH_DEFAULTS : {}, { v: 2 }); }
const RANGES = { sensH: [0.2, 3], sensV: [0.2, 3], adsSens: [0.3, 2], touchLook: [0.3, 4], adsH: [0.3, 2], adsV: [0.3, 2], touchDead: [0, 12], smooth: [0, 0.8] };
const ADS_MODES = ['holdDrag', 'hold', 'toggle'];

// any stored object → a complete, valid settings object (unknown keys dropped, numbers clamped)
// settings format version (stored as v), for future migrations
const VERSION = 2;
function sanitize(o, touch) {
  const s = defaults(touch);
  if (!o || typeof o !== 'object') return s;
  for (const k of Object.keys(RANGES)) {
    const v = Number(o[k]);
    if (o[k] !== undefined && o[k] !== null && o[k] !== '' && isFinite(v)) s[k] = clamp(v, RANGES[k][0], RANGES[k][1]);
  }
  for (const k of ['invertY', 'leftFire', 'releaseFire', 'showFps', 'calmVM']) if (typeof o[k] === 'boolean') s[k] = o[k];
  if (ADS_MODES.includes(o.adsMode)) s.adsMode = o.adsMode;
  if (['auto', 'bajo', 'medio', 'alto'].includes(o.quality)) s.quality = o.quality;
  if (o.fpsCap === 30 || o.fpsCap === 60) s.fpsCap = o.fpsCap;
  s.v = VERSION;
  return s;
}
// reads from a store with get(key, default); migrates the old single "sens" value
function load(store, touch) {
  const saved = store.get('settings', null);
  if (saved) return sanitize(saved, touch);
  const old = Number(store.get('sens', 1));
  return sanitize(isFinite(old) ? { sensH: old, sensV: old } : {}, touch);
}
function save(store, s, touch) { store.set('settings', sanitize(s, touch)); }

/* Converts a pointer movement in pixels into a yaw/pitch change in radians.
   ctx = { scoped (rifle scope up), ads (0..1, any weapon), fovRatio (tan(fov/2)/tan(baseFov/2)), touch }
   Linear (no acceleration): the same finger travel always turns the same amount. */
function lookDelta(dx, dy, s, ctx) {
  const base = ctx.touch ? 0.0042 : 0.0022;
  const k = base * ctx.fovRatio * (ctx.scoped ? s.adsSens : 1) * (ctx.touch ? s.touchLook : 1);
  const a = Math.max(0, Math.min(1, ctx.ads || 0));
  const h = 1 + ((s.adsH == null ? 1 : s.adsH) - 1) * a, v = 1 + ((s.adsV == null ? 1 : s.adsV) - 1) * a;
  return { yaw: -dx * k * s.sensH * h, pitch: -dy * k * s.sensV * v * (s.invertY ? -1 : 1) };
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

const SDSettings = { VERSION, DEFAULTS, TOUCH_DEFAULTS, ADS_MODES, defaults, RANGES, sanitize, load, save, lookDelta, smoothLook };
if (typeof module !== 'undefined' && module.exports) module.exports = SDSettings; else root.SDSettings = SDSettings;
})(typeof window !== 'undefined' ? window : globalThis);
