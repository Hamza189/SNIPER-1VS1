/* SNIPER DUEL — ray/segment tests without Three.js, for the multiplayer server.
   - createMapIndex(SD_MAP): puts the map triangles into a 2D grid (XZ) so a bullet segment only
     tests the few triangles near it.
   - segMap(index, x0,y0,z0, dx,dy,dz, len): first map hit along a segment (Möller–Trumbore,
     front faces only unless the material is double sided — the same rule as Three.js
     raycasting of the same triangles) → { t, x, y, z } or null.
   - segBox / segSphere: oriented player hit boxes (rotated about Y) and the head sphere. */
(function (root) {
'use strict';
const CELL = 4, EPS = 1e-9;

function createMapIndex(map) {
  const T = map.tris, n = T.length / 9, cells = new Map(), big = [];
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    const minX = Math.min(T[o], T[o + 3], T[o + 6]), maxX = Math.max(T[o], T[o + 3], T[o + 6]);
    const minZ = Math.min(T[o + 2], T[o + 5], T[o + 8]), maxZ = Math.max(T[o + 2], T[o + 5], T[o + 8]);
    if (maxX - minX > 60 || maxZ - minZ > 60) { big.push(i); continue; } // ground plane: tested always
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const k = cx + ',' + cz; let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(i);
      }
  }
  return { T, ds: map.ds || null, cells, big, stamp: new Uint32Array(n), mark: 0, world: { colliders: map.colliders, ramps: map.ramps } };
}
// ray (origin o, unit dir d) against triangle i → distance or -1
function triHit(T, i, ox, oy, oz, dx, dy, dz, both) {
  const o = i * 9;
  const ax = T[o], ay = T[o + 1], az = T[o + 2];
  const e1x = T[o + 3] - ax, e1y = T[o + 4] - ay, e1z = T[o + 5] - az;
  const e2x = T[o + 6] - ax, e2y = T[o + 7] - ay, e2z = T[o + 8] - az;
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (both ? (det > -EPS && det < EPS) : det < EPS) return -1; // single sided: back faces are not hit (as in Three.js)
  const inv = 1 / det, tx = ox - ax, ty = oy - ay, tz = oz - az;
  const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) return -1;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv; if (v < 0 || u + v > 1) return -1;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t >= 0 ? t : -1;
}
function segMap(ix, ox, oy, oz, dx, dy, dz, len, near) {
  const nr = near || 0;
  let best = Infinity;
  const test = i => { const t = triHit(ix.T, i, ox, oy, oz, dx, dy, dz, !ix.ds || ix.ds[i] === 1); if (t >= nr && t <= len && t < best) best = t; };
  ix.mark = (ix.mark + 1) >>> 0; if (ix.mark === 0) { ix.stamp.fill(0); ix.mark = 1; }
  const x1 = ox + dx * len, z1 = oz + dz * len;
  const c0x = Math.floor(Math.min(ox, x1) / CELL), c1x = Math.floor(Math.max(ox, x1) / CELL);
  const c0z = Math.floor(Math.min(oz, z1) / CELL), c1z = Math.floor(Math.max(oz, z1) / CELL);
  for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
    const a = ix.cells.get(cx + ',' + cz); if (!a) continue;
    for (const i of a) { if (ix.stamp[i] === ix.mark) continue; ix.stamp[i] = ix.mark; test(i); }
  }
  for (const i of ix.big) test(i);
  return best === Infinity ? null : { t: best, x: ox + dx * best, y: oy + dy * best, z: oz + dz * best };
}
// clear straight line between two points (for spawns and the knife)
function losClear(ix, ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
  if (d < 0.5) return true;
  return !segMap(ix, ax, ay, az, dx / d, dy / d, dz / d, d - 0.25, 0.2);
}
// segment vs box centred at (cx,cy,cz), half sizes (hx,hy,hz), rotated by yaw about Y → t or -1
function segBox(ox, oy, oz, dx, dy, dz, len, cx, cy, cz, hx, hy, hz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // into the box frame (inverse rotation about Y)
  const rx = ox - cx, rz = oz - cz;
  const lx = c * rx - s * rz, lz = s * rx + c * rz, ly = oy - cy;
  const ldx = c * dx - s * dz, ldz = s * dx + c * dz, ldy = dy;
  let t0 = 0, t1 = len;
  const slab = (p, d, h) => {
    if (Math.abs(d) < EPS) return p >= -h && p <= h;
    let a = (-h - p) / d, b = (h - p) / d; if (a > b) { const k = a; a = b; b = k; }
    if (a > t0) t0 = a; if (b < t1) t1 = b; return t0 <= t1;
  };
  if (!slab(lx, ldx, hx) || !slab(ly, ldy, hy) || !slab(lz, ldz, hz)) return -1;
  return t0;
}
function segSphere(ox, oy, oz, dx, dy, dz, len, cx, cy, cz, r) {
  const lx = ox - cx, ly = oy - cy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz, c = lx * lx + ly * ly + lz * lz - r * r;
  if (c <= 0) return 0;
  const disc = b * b - c; if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 && t <= len ? t : -1;
}
const SDGeom = { CELL, createMapIndex, segMap, losClear, segBox, segSphere, triHit };
if (typeof module !== 'undefined' && module.exports) module.exports = SDGeom; else root.SDGeom = SDGeom;
})(typeof window !== 'undefined' ? window : globalThis);
