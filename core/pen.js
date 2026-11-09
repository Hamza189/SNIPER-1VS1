/* SNIPER DUEL — PENETRACIÓN de las balas de francotirador (09-11-2026, docs/GUNSMITH.md «Penetración y BALA DURA»).
   Del propietario: «¿en la vida real no atraviesa cajas, madera fina o chapa?… Lo de la BALA DURA es para las paredes
   medio gruesas o gruesas; obviamente que no pase por 2 paredes gruesas».
   - classify(surf, thick): qué es una caja del mapa para la bala, según su superficie y su grosor de verdad:
       'thin'   cajas de madera, madera fina (≤ 12 cm) y chapa (≤ 10 cm): la atraviesa cualquier rifle;
       'medium' tabique de yeso (≤ 20 cm): solo con BALA DURA;
       null     lo demás: hormigón, muros de carga (yeso de más de 20 cm), tierra, límites del mapa. Nunca.
   - through(box, o, d): por dónde entra y sale la bala de una caja (método de las losas, con el giro en Y de la caja),
     y cuánto recorre dentro. Un ángulo rasante alarga ese recorrido; si pasa del máximo de su clase, se queda dentro.
   - pass(state, cls, along, hard): si la bala sigue y con cuánto daño. Como mucho 2 superficies; de ellas, una sola
     'medium' (y solo con BALA DURA). Cada una multiplica el daño (MUL).
   Lo que se ve nunca decide: son siempre las cajas de balas del mapa (las mismas que exporta tools/export-map.js).
   Puro (Node y navegador). Hoy solo lo usan las partidas sin conexión; el servidor no lo usa hasta que el propietario
   lo apruebe. */
(function (root) {
'use strict';
// how much of the damage is left after each kind of surface (proposal pending the owner's approval for online)
const MUL = { thin: 0.75, medium: 0.5 };
// the most a bullet travels inside one surface of that kind (a grazing shot through a thin plank may be longer)
const MAX_ALONG = { thin: 2.2, medium: 0.45 };   // thin: a 1,2-m crate crossed corner to corner is 2,08 m
const MAX_SURF = 2;
const LIMIT = { wood: 0.12, metal: 0.10, plaster: 0.20 };
function classify(surf, thick) {
  if (surf === 'crate') return 'thin';                        // wooden crates (hollow): whatever their size
  if (surf === 'wood' && thick <= LIMIT.wood + 1e-6) return 'thin';
  if (surf === 'metal' && thick <= LIMIT.metal + 1e-6) return 'thin';
  if (surf === 'plaster' && thick <= LIMIT.plaster + 1e-6) return 'medium';
  return null;
}
// box: { cx, cy, cz, hx, hy, hz, yaw }; o: origin, d: unit direction → { t0, t1, along } or null (t along the ray)
function through(b, ox, oy, oz, dx, dy, dz) {
  const c = Math.cos(b.yaw || 0), s = Math.sin(b.yaw || 0);
  const rx = ox - b.cx, rz = oz - b.cz;
  const lx = c * rx - s * rz, lz = s * rx + c * rz, ly = oy - b.cy;
  const ldx = c * dx - s * dz, ldz = s * dx + c * dz, ldy = dy;
  let t0 = -Infinity, t1 = Infinity;
  const slab = (p, d, h) => {
    if (Math.abs(d) < 1e-9) return p >= -h && p <= h;
    let a = (-h - p) / d, e = (h - p) / d; if (a > e) { const k = a; a = e; e = k; }
    if (a > t0) t0 = a; if (e < t1) t1 = e; return t0 <= t1;
  };
  if (!slab(lx, ldx, b.hx) || !slab(ly, ldy, b.hy) || !slab(lz, ldz, b.hz) || t1 < 0) return null;
  return { t0: Math.max(0, t0), t1, along: t1 - Math.max(0, t0) };
}
function createState() { return { n: 0, medium: 0, mul: 1 }; }
// may the bullet go on through this surface? state is updated when it does
function pass(st, cls, along, hard) {
  if (!cls || st.n >= MAX_SURF) return false;
  if (cls === 'medium' && (!hard || st.medium >= 1)) return false;
  if (!(along <= MAX_ALONG[cls])) return false;
  st.n++; if (cls === 'medium') st.medium++;
  st.mul *= MUL[cls];
  return true;
}
const SDPen = { MUL, MAX_ALONG, MAX_SURF, LIMIT, classify, through, createState, pass };
if (typeof module !== 'undefined' && module.exports) module.exports = SDPen; else root.SDPen = SDPen;
})(typeof window !== 'undefined' ? window : globalThis);
