/* SNIPER DUEL — graphics profiles and automatic resolution (Stage C). Pure: no DOM.
   Profiles change only how the picture is drawn (resolution, shadows), never the simulation,
   the hit zones, the fog distance or what is visible: the rival is drawn the same way in all.

   AUTO = MEDIO on phones, ALTO on computers, and then the resolution follows the real FPS:
   every 1.5 s, if the frame rate is clearly under the target the internal resolution drops a
   step; when it has stayed comfortably over the target for a while it goes back up.
   Stable (PUEBLO 3.0): it never goes below 0.75 of the profile's resolution (the scene and the rival
   stay sharp), and if going up a step made it drop again soon after, that step becomes a ceiling:
   no endless up-down-up. */
(function (root) {
'use strict';
const PROFILES = {
  bajo:  { label: 'BAJO',  prMax: 1.0,  shadows: false, shadowMap: 0 },
  medio: { label: 'MEDIO', prMax: 1.35, shadows: true,  shadowMap: 1024 },
  alto:  { label: 'ALTO',  prMax: 2.0,  shadows: true,  shadowMap: 2048 }
};
const ADAPT = { window: 1.5, minScale: 0.75, down: 0.1, up: 0.05, lowAt: 0.85, highAt: 0.96, upAfter: 3, settle: 10 };

function resolve(choice, touch) { return PROFILES[choice] ? choice : (touch ? 'medio' : 'alto'); }
// device pixel ratio actually used for a profile and an adaptive scale
function pixelRatio(profile, dpr, scale) { return Math.max(0.5, Math.min(dpr || 1, PROFILES[profile].prMax) * (scale || 1)); }

function createAdaptive(target, enabled) {
  return { target: target || 60, enabled: enabled !== false, scale: 1, acc: 0, frames: 0, fps: 0, goodFor: 0, changed: 0, ceiling: 1, sinceUp: 1e9, upFrom: 1 };
}
// feed the duration of one rendered frame (s). Returns true when scale changed.
function feed(a, dt) {
  if (!(dt > 0) || dt > 0.5) return false;          // a pause or a background tab: ignore
  a.acc += dt; a.frames++;
  if (a.acc < ADAPT.window) return false;
  a.fps = a.frames / a.acc; const win = a.acc; a.acc = 0; a.frames = 0;
  if (!a.enabled) return false;
  a.sinceUp += win;
  if (a.fps < a.target * ADAPT.lowAt && a.scale > ADAPT.minScale) {
    if (a.sinceUp < ADAPT.settle) a.ceiling = Math.min(a.ceiling, a.scale);   // the last step up was too much
    a.scale = Math.max(ADAPT.minScale, Math.round((a.scale - ADAPT.down) * 100) / 100); a.goodFor = 0; a.changed++; return true;
  }
  const next = Math.min(1, Math.round((a.scale + ADAPT.up) * 100) / 100);
  if (a.fps >= a.target * ADAPT.highAt && a.scale < 1 && next < a.ceiling - 1e-6) {
    a.goodFor += win;
    if (a.goodFor >= ADAPT.upAfter) { a.scale = next; a.goodFor = 0; a.changed++; a.sinceUp = 0; return true; }
  } else a.goodFor = 0;
  return false;
}
// FPS cap: only the 30 FPS option limits (every 2nd frame on a 60 Hz screen, every 4th at
// 120 Hz); otherwise every display frame is drawn (144 Hz monitors keep 144). The simulation
// keeps its 120 Hz ticks either way.
function drawEvery(cap, refreshHz) { return cap === 30 ? Math.max(1, Math.round((refreshHz || 60) / 30)) : 1; }
function shouldDraw(cap, frameIndex, refreshHz) { return frameIndex % drawEvery(cap, refreshHz) === 0; }

const SDQuality = { PROFILES, ADAPT, resolve, pixelRatio, createAdaptive, feed, drawEvery, shouldDraw };
if (typeof module !== 'undefined' && module.exports) module.exports = SDQuality; else root.SDQuality = SDQuality;
})(typeof window !== 'undefined' ? window : globalThis);
