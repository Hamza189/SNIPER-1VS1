/* PUEBLO 3.0 vegetation (Poly Haven dandelion_01 and grass_medium_02, CC0): where plants grow in a dry Mediterranean town —
   at the foot of walls and planters, along the kerbs, in the cracks next to them and round the drains — never in the middle of
   a street. Pure placement (testable without WebGL): the page turns the list into a few instanced meshes.
   The same seed everywhere: every player sees the same plants (they are 15–40 cm tall: nobody can hide in them). */
const SDFlora = (() => {
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // density per profile: ALTO all, MEDIO 60 %, BAJO 25 % (same places, fewer plants)
  const KEEP = { alto: 1, medio: 0.6, bajo: 0.25 };
  // opt: { colliders, region:[x0,x1,z0,z1], kerbs:[[axis,c,a0,a1,side],…], drains:[[x,z],…], avoid(x,z), profile, seed }
  function scatter(opt) {
    const R = rng(opt.seed || 0x5eed), keep = KEEP[opt.profile] ?? 1, [X0, X1, Z0, Z1] = opt.region, out = [];
    const C = opt.colliders.filter(c => c.minY < 0.3 && c.maxX > X0 - 2 && c.minX < X1 + 2 && c.maxZ > Z0 - 2 && c.minZ < Z1 + 2);
    const inside = (x, z, m) => C.some(c => x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m);
    const ok = (x, z) => x > X0 && x < X1 && z > Z0 && z < Z1 && !inside(x, z, 0.03) && !(opt.avoid && opt.avoid(x, z));
    const add = (kind, x, z, big) => {
      if (!ok(x, z)) return;
      const grass = kind === 'grass';
      out.push({ kind, variant: Math.floor(R() * 5), x, z, ry: R() * Math.PI * 2,
        s: (grass ? 0.95 + R() * 0.55 : 0.8 + R() * 0.45) * (big ? 1.15 : 1),   // grass cards: 0.2–0.45 m clumps × 0.95–1.5
        dry: grass && R() < 0.72,                         // mostly dry straw, some green where it is damp
        tilt: (R() - 0.5) * 0.18, tint: 0.85 + R() * 0.25, keepR: R() });
    };
    // a clump: 2–7 plants round a point (plants grow in groups, not alone and evenly spaced); grass is drawn as 4-triangle
    // cards (17-10-2026), so clumps can be full; dandelions (real 3D, ~200 triangles) stay a minority
    const clump = (x, z, nx, nz, big) => {
      const n = 2 + Math.floor(R() * (big ? 6 : 4));
      for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, r = R() * 0.3;
        add(R() < (big ? 0.88 : 0.82) ? 'grass' : 'dandelion', x + Math.cos(a) * r + nx * R() * 0.12, z + Math.sin(a) * r + nz * R() * 0.12, big); }
    };
    // 1) the foot of walls, planters and other low obstacles: along each face, 0.05–0.25 m out, in gaps
    for (const c of C) {
      if (c.maxY < 0.3) continue;
      const faces = [[c.minX, c.minZ, c.maxX, c.minZ, 0, -1], [c.minX, c.maxZ, c.maxX, c.maxZ, 0, 1], [c.minX, c.minZ, c.minX, c.maxZ, -1, 0], [c.maxX, c.minZ, c.maxX, c.maxZ, 1, 0]];
      for (const [ax, az, bx, bz, nx, nz] of faces) {
        const L = Math.hypot(bx - ax, bz - az); if (L < 0.3) continue;
        // corners collect more (dust and seeds pile up there)
        for (const t of [0.04, 0.96]) if (R() < 0.8) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t, o = 0.08 + R() * 0.15; clump(x + nx * o, z + nz * o, nx, nz, true); }
        const n = Math.floor(L / 1.8);
        for (let i = 0; i < n; i++) if (R() < 0.7) { const t = R(), o = 0.06 + R() * 0.2; clump(ax + (bx - ax) * t + nx * o, az + (bz - az) * t + nz * o, nx, nz, false); }
      }
    }
    // 2) kerbs: plants in the joint between pavement and street, a few cracks just next to it
    // a kerb: [axis, c, a0, a1, side] — axis 'z': the line x = c from z = a0 to a1 ('x': z = c from x = a0 to a1);
    // side: ±1, towards the street
    for (const [axis, c, a0, a1, side] of opt.kerbs || []) {
      const P = (u, v) => axis === 'z' ? [c + v, u] : [u, c + v], N = axis === 'z' ? [side, 0] : [0, side];
      for (let u = a0; u < a1; u += 0.6 + R() * 1.6) {
        if (R() < 0.6) { const [x, z] = P(u, side * (0.04 + R() * 0.08)); clump(x, z, N[0], N[1], false); }
        if (R() < 0.12) { const [x, z] = P(u + R(), -side * (0.15 + R() * 0.5)); add(R() < 0.6 ? 'grass' : 'dandelion', x, z, false); }   // a crack
      }
    }
    // 3) round the drains (damp): a ring of green tufts
    for (const [x, z] of opt.drains || []) for (let i = 0; i < 5; i++) { const a = R() * Math.PI * 2, r = 0.62 + R() * 0.25; if (R() < 0.7) add('grass', x + Math.cos(a) * r, z + Math.sin(a) * r, false); }
    for (const p of out) if (p.kind === 'grass' && opt.drains && opt.drains.some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 1)) p.dry = false;
    return out.filter(p => p.keepR < keep);
  }
  return { scatter, KEEP, rng };
})();
if (typeof module !== 'undefined') module.exports = SDFlora;
