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
// the body faces where the player looks: view yaw → model rotation about Y
function bodyYaw(viewYaw) { return viewYaw + Math.PI; }
function scaleOf(eye) { return Math.max(0.45, Math.min(1, (eye || STAND_EYE) / STAND_EYE)); }
/* first body part hit by the segment, or null.
   pl = { x, y, z, eye, yaw }  (feet position, eye height above the feet, view yaw) */
function segPlayer(G, pl, ox, oy, oz, dx, dy, dz, len) {
  const k = scaleOf(pl.eye), a = bodyYaw(pl.yaw);
  let best = null;
  for (const P of PARTS) {
    const cy = pl.y + P.y * k;
    const t = P.type === 'sphere' ? G.segSphere(ox, oy, oz, dx, dy, dz, len, pl.x, cy, pl.z, P.r)
                                  : G.segBox(ox, oy, oz, dx, dy, dz, len, pl.x, cy, pl.z, P.hx, P.hy * k, P.hz, a);
    if (t >= 0 && (!best || t < best.t)) best = { t, part: P.part };
  }
  return best;
}
const SDHitbox = { STAND_EYE, PARTS, bodyYaw, scaleOf, segPlayer };
if (typeof module !== 'undefined' && module.exports) module.exports = SDHitbox; else root.SDHitbox = SDHitbox;
})(typeof window !== 'undefined' ? window : globalThis);
