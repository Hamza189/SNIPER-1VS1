/* SNIPER DUEL — player settings (sensitivity, invert Y, touch options).
   Pure: no DOM. The page loads/saves them through a small storage adapter. */
(function (root) {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const DEFAULTS = {
  sensH: 1,        // horizontal look sensitivity
  sensV: 1,        // vertical look sensitivity
  adsSens: 1,      // extra multiplier while the scope is up (on top of the automatic zoom scaling)
  touchLook: 1,    // extra multiplier for finger dragging
  invertY: false,
  leftFire: false, // second FIRE button on the left side (3-4 finger play)
  releaseFire: true // touch, rifle: holding FIRE raises the scope, lifting the finger fires
};
const RANGES = { sensH: [0.2, 3], sensV: [0.2, 3], adsSens: [0.3, 2], touchLook: [0.3, 3] };

// any stored object → a complete, valid settings object (unknown keys dropped, numbers clamped)
function sanitize(o) {
  const s = Object.assign({}, DEFAULTS);
  if (!o || typeof o !== 'object') return s;
  for (const k of Object.keys(RANGES)) {
    const v = Number(o[k]);
    if (o[k] !== undefined && o[k] !== null && o[k] !== '' && isFinite(v)) s[k] = clamp(v, RANGES[k][0], RANGES[k][1]);
  }
  for (const k of ['invertY', 'leftFire', 'releaseFire']) if (typeof o[k] === 'boolean') s[k] = o[k];
  return s;
}
// reads from a store with get(key, default); migrates the old single "sens" value
function load(store) {
  const saved = store.get('settings', null);
  if (saved) return sanitize(saved);
  const old = Number(store.get('sens', 1));
  return sanitize(isFinite(old) ? { sensH: old, sensV: old } : {});
}
function save(store, s) { store.set('settings', sanitize(s)); }

/* Converts a pointer movement in pixels into a yaw/pitch change in radians.
   ctx = { scoped, fovRatio (tan(fov/2)/tan(baseFov/2)), touch } */
function lookDelta(dx, dy, s, ctx) {
  const base = ctx.touch ? 0.0042 : 0.0022;
  const k = base * ctx.fovRatio * (ctx.scoped ? s.adsSens : 1) * (ctx.touch ? s.touchLook : 1);
  return { yaw: -dx * k * s.sensH, pitch: -dy * k * s.sensV * (s.invertY ? -1 : 1) };
}

const SDSettings = { DEFAULTS, RANGES, sanitize, load, save, lookDelta };
if (typeof module !== 'undefined' && module.exports) module.exports = SDSettings; else root.SDSettings = SDSettings;
})(typeof window !== 'undefined' ? window : globalThis);
