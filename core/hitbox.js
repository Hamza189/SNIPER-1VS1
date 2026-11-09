/* SNIPER DUEL — the hit zones of a player body, shared by the server (what a bullet hits) and
   the browser (the rival's 3D model is built from the same sizes, so what you see is what
   you hit). Local frame: x right, y up, z = the way the body faces. The body is squashed
   vertically with the eye height (standing 1.62 m, crouched 1.0, sliding 0.85). */
(function (root) {
'use strict';
const STAND_EYE = 1.62;
const PARTS = [
  { part: 'head',  type: 'sphere', y: 1.63, r: 0.15 },
  { part: 'torso', type: 'box', y: 1.17, hx: 0.245, hy: 0.31, hz: 0.16 },
  { part: 'legs',  type: 'box', y: 0.43, hx: 0.19, hy: 0.43, hz: 0.11 }
];
/* SLIDE (09-11-2026, propuesta; el propietario eligió «caja nueva»): las zonas de un jugador que se desliza con las
   piernas por delante (client/soldier2.js slidePose): baja y alargada, sin aplastar. z: hacia donde mira el cuerpo.
   Solo la usa quien pasa pl.slide = true; el servidor NO la usa todavía (hasta su aprobación para el online). */
const SLIDE = [
  { part: 'head',  type: 'sphere', y: 0.90, z: -0.30, r: 0.15 },
  { part: 'torso', type: 'box', y: 0.58, z: -0.14, hx: 0.245, hy: 0.24, hz: 0.20 },
  { part: 'legs',  type: 'box', y: 0.20, z: 0.40, hx: 0.22, hy: 0.20, hz: 0.48 }
];
// the body faces where the player looks: view yaw → model rotation about Y
function bodyYaw(viewYaw) { return viewYaw + Math.PI; }
function scaleOf(eye) { return Math.max(0.45, Math.min(1, (eye || STAND_EYE) / STAND_EYE)); }
/* first body part hit by the segment, or null.
   pl = { x, y, z, eye, yaw }  (feet position, eye height above the feet, view yaw) */
function segPlayer(G, pl, ox, oy, oz, dx, dy, dz, len) {
  const sl = !!pl.slide, k = sl ? 1 : scaleOf(pl.eye), a = bodyYaw(pl.yaw), sa = Math.sin(a), ca = Math.cos(a);
  let best = null;
  for (const P of sl ? SLIDE : PARTS) {
    const cy = pl.y + P.y * k, cx = pl.x + sa * (P.z || 0), cz = pl.z + ca * (P.z || 0);
    const t = P.type === 'sphere' ? G.segSphere(ox, oy, oz, dx, dy, dz, len, cx, cy, cz, P.r)
                                  : G.segBox(ox, oy, oz, dx, dy, dz, len, cx, cy, cz, P.hx, P.hy * k, P.hz, a);
    if (t >= 0 && (!best || t < best.t)) best = { t, part: P.part };
  }
  return best;
}
const SDHitbox = { STAND_EYE, PARTS, SLIDE, bodyYaw, scaleOf, segPlayer };
if (typeof module !== 'undefined' && module.exports) module.exports = SDHitbox; else root.SDHitbox = SDHitbox;
})(typeof window !== 'undefined' ? window : globalThis);
