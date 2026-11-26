/* SNIPER DUEL — EL CONTORNO DEL PUEBLO (26-11-2026, docs/CONTORNO.md). El propietario: «mejora el diseño del mapa, un
   cuadrado perfecto no tiene gracia». Antes, un muro de 100 × 100 m. Ahora un polígono de lados rectos (las cajas de
   movimiento son rectas) con entrantes y salientes, como el recinto de un pueblo viejo:
     · CALLEJÓN al sur (x 17…23, hasta z = −60): estrecho, sin salida; desde el fondo se ve el pueblo hasta el muro
       norte (al norte no: detrás del muro norte está el campo de tiro)
     · PLAZUELA DEL MIRADOR al este, al final de la calle transversal (x 50…62, z −10…8): la línea de tiro más larga
       del mapa (112 m, del muro oeste al fondo de la plazuela)
     · PATIO al oeste (x −56…−50, z −30…−18)
     · dos manzanas que entran en el pueblo: noroeste (x −50…−41, z 44…50) y sureste (x 43…50, z −50…−42)
   De aquí salen: los muros (cajas de 1 m hacia fuera y 4 m de alto: movimiento y balas), las fachadas del pueblo de
   fuera (client/town3.js backdrop, una fila de casas por lado), el suelo de lo nuevo y qué puntos de la red de los bots
   quedan dentro. Puro: Node y navegador. Lo comprueba test/contorno.test.js. */
(function (root) {
'use strict';
// the playable area, counter-clockwise seen from above (x east, z north): inside is on the left of each side
const POLY = [
  [-50, -50], [17, -50], [17, -60], [23, -60], [23, -50], // south wall and the CALLEJÓN
  [43, -50], [43, -42], [50, -42],                        // the south-east block comes in
  [50, -10], [62, -10], [62, 8], [50, 8],                 // the east wall opens on the PLAZUELA (the cross street runs into it)
  [50, 50],                                               // north wall (behind it, the shooting range)
  [-41, 50], [-41, 44], [-50, 44],                        // the north-west block comes in
  [-50, -18], [-56, -18], [-56, -30], [-50, -30],         // the west wall and the PATIO
];
const WALL_T = 1, WALL_H = 4;

// the sides: O (start, on the inner face), R (along), N (towards the town), L (metres); convex ends close the corner
function sides() {
  const out = [], n = POLY.length;
  for (let i = 0; i < n; i++) {
    const a = POLY[i], b = POLY[(i + 1) % n], c = POLY[(i + 2) % n], z = POLY[(i - 1 + n) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), R = [(b[0] - a[0]) / L, 0, (b[1] - a[1]) / L], N = [-R[2], 0, R[0]];
    const turn = (p, q, r) => (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);   // > 0: a left turn (convex corner)
    out.push({ O: [a[0], 0, a[1]], R, N, L, convex0: turn(z, a, b) > 0, convex1: turn(a, b, c) > 0, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] });
  }
  return out;
}
// the walls: one box behind each side (towards the outside), longer by WALL_T at convex corners (no gap at the corner)
function walls() {
  return sides().map(s => {
    const e0 = s.convex0 ? WALL_T : 0, e1 = s.convex1 ? WALL_T : 0, ax = Math.abs(s.R[0]) > 0.5 ? 0 : 2;
    const p0 = s.O[ax] - (ax === 0 ? s.R[0] : s.R[2]) * e0, p1 = s.O[ax] + (ax === 0 ? s.R[0] : s.R[2]) * (s.L + e1);
    const f = ax === 0 ? s.O[2] : s.O[0], nOut = -(ax === 0 ? s.N[2] : s.N[0]), q0 = Math.min(f, f + nOut * WALL_T), q1 = Math.max(f, f + nOut * WALL_T);
    const lo = Math.min(p0, p1), hi = Math.max(p0, p1);
    return ax === 0 ? { minX: lo, maxX: hi, minZ: q0, maxZ: q1 } : { minX: q0, maxX: q1, minZ: lo, maxZ: hi };
  }).map(b => Object.assign(b, { minY: 0, maxY: WALL_H }));
}
// is (x, z) inside the playable area, at least m metres from the walls (m < 0: up to -m outside)
function inside(x, z, m) {
  m = m || 0; let c = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, zi] = POLY[i], [xj, zj] = POLY[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  if (!m) return c;
  let d = Infinity;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [ax, az] = POLY[j], [bx, bz] = POLY[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return m > 0 ? c && d >= m : c || d <= -m;
}
// the bounding box of the playable area
function bounds() { const xs = POLY.map(p => p[0]), zs = POLY.map(p => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; }
// the new ground (outside the old square of 99 × 99 m): [x0, z0, x1, z1, kind]
const AREAS = [
  [49.5, -10, 62, 8, 'plaza'],        // PLAZUELA DEL MIRADOR: slabs; the cross street's asphalt runs into it
  [17, -60, 23, -49.5, 'setts'],      // CALLEJÓN: cobbles
  [-56, -30, -49.5, -18, 'earth'],    // PATIO: earth
];
const SDContorno = { POLY, WALL_T, WALL_H, sides, walls, inside, bounds, AREAS };
if (typeof module !== 'undefined' && module.exports) module.exports = SDContorno; else root.SDContorno = SDContorno;
})(typeof window !== 'undefined' ? window : globalThis);
