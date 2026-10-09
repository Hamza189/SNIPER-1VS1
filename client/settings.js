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
  releaseFire: true // touch, rifle: holding FIRE raises the scope, lifting the finger fires
};
// Phones start from different values (agreed after testing on iPhone); PC defaults are unchanged.
// A device that already saved its settings keeps them; RESTAURAR goes back to these.
const TOUCH_DEFAULTS = { touchLook: 1.6, adsSens: 1.3 };
function defaults(touch) { return Object.assign({}, DEFAULTS, touch ? TOUCH_DEFAULTS : {}); }
const RANGES = { sensH: [0.2, 3], sensV: [0.2, 3], adsSens: [0.3, 2], touchLook: [0.3, 4] };

// any stored object → a complete, valid settings object (unknown keys dropped, numbers clamped)
function sanitize(o, touch) {
  const s = defaults(touch);
  if (!o || typeof o !== 'object') return s;
  for (const k of Object.keys(RANGES)) {
    const v = Number(o[k]);
    if (o[k] !== undefined && o[k] !== null && o[k] !== '' && isFinite(v)) s[k] = clamp(v, RANGES[k][0], RANGES[k][1]);
  }
  for (const k of ['invertY', 'leftFire', 'releaseFire']) if (typeof o[k] === 'boolean') s[k] = o[k];
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
   ctx = { scoped, fovRatio (tan(fov/2)/tan(baseFov/2)), touch } */
function lookDelta(dx, dy, s, ctx) {
  const base = ctx.touch ? 0.0042 : 0.0022;
  const k = base * ctx.fovRatio * (ctx.scoped ? s.adsSens : 1) * (ctx.touch ? s.touchLook : 1);
  return { yaw: -dx * k * s.sensH, pitch: -dy * k * s.sensV * (s.invertY ? -1 : 1) };
}

const SDSettings = { DEFAULTS, TOUCH_DEFAULTS, defaults, RANGES, sanitize, load, save, lookDelta };
if (typeof module !== 'undefined' && module.exports) module.exports = SDSettings; else root.SDSettings = SDSettings;
})(typeof window !== 'undefined' ? window : globalThis);
