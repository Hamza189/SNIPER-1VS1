/* CASAS HABITABLES del PUEBLO (?casas=1, 14-11-2026) sin navegador, con el código de movimiento real (core/movement.js):
   - cada casa cabe en su solar de siempre y no se sale de la caja antigua (el servidor y los mapas vecinos no cambian)
   - por cada puerta se entra y se sale andando; por las ventanas no se cuela uno andando (el alféizar para)
   - en las casas de dos plantas se sube la escalera hasta la planta alta y se sale al balcón
   - asomarse: de pie junto a una ventana los ojos (1,62 m) quedan en el hueco; agachado (1,2 m) detrás del muro
   - balas: una bala por el hueco de la ventana pasa; contra el muro, el tabique o la caja se para
   - navegación interior: todos los puntos de dentro conectados con las puertas
   Ejecutar: node test/casas.test.js */
'use strict';
const C = require('../client/casas.js'), MAP = require('../core/mapdata.js'), SDMovement = require('../core/movement.js'), CFG = require('../core/config.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const M = CFG.move, P = MAP.maps.pueblo;

// the pueblo world with the three solid boxes replaced by the houses
const isOld = c => C.HOUSES.some(H => Math.abs(c.minX - (H.x - H.w / 2)) < 1e-6 && Math.abs(c.maxX - (H.x + H.w / 2)) < 1e-6 && Math.abs(c.minZ - (H.z - H.d / 2)) < 1e-6 && Math.abs(c.maxZ - (H.z + H.d / 2)) < 1e-6 && c.minY === 0);
const old = P.colliders.filter(isOld);
const world = { colliders: P.colliders.filter(c => !isOld(c)), ramps: (P.ramps || []).slice() };
const ALL = [];
for (const H of C.HOUSES) { const b = C.boxes(H); ALL.push(...b);
  for (const x of b) world.colliders.push({ minX: x.a[0], minY: x.a[1], minZ: x.a[2], maxX: x.b[0], maxY: x.b[1], maxZ: x.b[2] });
  world.ramps.push(...C.ramps(H)); }
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
function walk(s, dx, dz, t, o) { o = o || {}; const yaw = yawTo(dx, dz);
  for (let i = 0; i < t * 60; i++) SDMovement.step(s, { mx: 0, mz: -1, yaw, crouch: !!o.crouch, jump: !!o.jump && i % 20 === 0 }, 1 / 60, world, M);
  return s; }
const at = (x, z, y) => { const s = SDMovement.createState(x, y || 0, z); for (let i = 0; i < 30; i++) SDMovement.step(s, { mx: 0, mz: 0, yaw: 0 }, 1 / 60, world, M); return s; };
const inBox = (H, x, z, m) => Math.abs(x - H.x) < H.w / 2 - (m || 0) && Math.abs(z - H.z) < H.d / 2 - (m || 0);
function seg(o, d, len, boxes) { let best = Infinity, hit = null;   // slab test, axis-aligned boxes
  for (const b of boxes) { let t0 = 0, t1 = len, ok = true;
    for (let k = 0; k < 3 && ok; k++) { if (Math.abs(d[k]) < 1e-9) { if (o[k] < b.a[k] || o[k] > b.b[k]) ok = false; continue; }
      let ta = (b.a[k] - o[k]) / d[k], tb = (b.b[k] - o[k]) / d[k]; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) ok = false; }
    if (ok && t0 < best) { best = t0; hit = b; } }
  return hit; }
const SOLID = ALL.filter(b => b.s);

console.log('\nSOLAR');
check('las tres cajas antiguas están en el mapa del servidor', old.length === 3, old.length);
for (const H of C.HOUSES) {
  const b = C.boxes(H), out = b.filter(x => !/_balcon|_balaustrada/.test(x.n) && (x.a[0] < H.x - H.w / 2 - 1e-6 || x.b[0] > H.x + H.w / 2 + 1e-6 || x.a[2] < H.z - H.d / 2 - 1e-6 || x.b[2] > H.z + H.d / 2 + 1e-6 || x.b[1] > H.h + 0.35 + 1e-6));
  check(H.id + ': nada se sale de la caja antigua (salvo los balcones)', out.length === 0, out.map(x => x.n).join(' '));
  const bal = b.filter(x => /_balcon_/.test(x.n));
  check(H.id + ': balcones a menos de 1,05 m de la fachada', bal.every(x => Math.min(H.x - H.w / 2 - x.a[0], H.z - H.d / 2 - x.a[2], x.b[0] - H.x - H.w / 2, x.b[2] - H.z - H.d / 2) >= -1e-6 ? Math.max(H.x - H.w / 2 - x.a[0], H.z - H.d / 2 - x.a[2], x.b[0] - H.x - H.w / 2, x.b[2] - H.z - H.d / 2) <= 1.05 : true), bal.length + ' balcones');
}

console.log('\nENTRAR Y SALIR (movimiento real, radio ' + M.radius + ')');
for (const H of C.HOUSES) for (const d of H.doors) {
  const F = d.face, n = F === 'w' ? [-1, 0] : F === 'e' ? [1, 0] : F === 'n' ? [0, -1] : [0, 1];
  const px = F === 'n' || F === 's' ? H.x + d.u : H.x + n[0] * (H.w / 2 + 2), pz = F === 'n' || F === 's' ? H.z + n[1] * (H.d / 2 + 2) : H.z + d.u;
  const s = walk(at(px, pz), -n[0], -n[1], 1.6);
  check(H.id + ' puerta ' + F + ': se entra andando', inBox(H, s.x, s.z, 0.4), s.x.toFixed(2) + ', ' + s.z.toFixed(2));
  const o = walk(s, n[0], n[1], 2.2);
  check(H.id + ' puerta ' + F + ': se sale andando', !inBox(H, o.x, o.z, -0.4), o.x.toFixed(2) + ', ' + o.z.toFixed(2));
}

console.log('\nVENTANAS: asomarse, no colarse andando');
for (const H of C.HOUSES) {
  const O = C.openings(H);
  for (const f of ['w', 'e', 'n', 's']) { const w = O[f].find(o => o.kind === 'win'); if (!w) continue;
    const n = f === 'w' ? [-1, 0] : f === 'e' ? [1, 0] : f === 'n' ? [0, -1] : [0, 1], u = (w.u0 + w.u1) / 2;
    const ix = f === 'n' || f === 's' ? H.x + u : H.x + n[0] * (H.w / 2 - 1.2), iz = f === 'n' || f === 's' ? H.z + n[1] * (H.d / 2 - 1.2) : H.z + u;
    const s0 = at(ix, iz); if (!inBox(H, s0.x, s0.z, 0.3)) { check(H.id + ' ventana ' + f + ': punto interior libre', false); continue; }
    const s = walk(s0, n[0], n[1], 2.0);
    check(H.id + ' ventana ' + f + ' (u ' + u + '): andando contra ella te quedas dentro', inBox(H, s.x, s.z, 0), s.x.toFixed(2) + ', ' + s.z.toFixed(2));
    const eye = s.y + M.eyeStand, eyeC = s.y + M.eyeCrouch;
    check(H.id + ' ventana ' + f + ': de pie los ojos en el hueco, agachado tras el muro', eye > w.y0 + 0.2 && eye < w.y1 - 0.1 && eyeC < w.y0, eye.toFixed(2) + ' / ' + eyeC.toFixed(2));
    // a bullet out of the window (straight out, from the eyes) passes; 0.6 m to the side of the hole hits the wall
    const o = [s.x, eye, s.z], d = [n[0], 0, n[1]];
    check(H.id + ' ventana ' + f + ': la bala sale por el hueco', !seg(o, d, 3, SOLID.filter(b => /_muro_/.test(b.n))));
    const side = f === 'n' || f === 's' ? [w.u1 - u + 0.5, 0] : [0, w.u1 - u + 0.5];
    const hit = seg([s.x + side[0], eye, s.z + side[1]], d, 3, SOLID);
    check(H.id + ' ventana ' + f + ': al lado del hueco el muro para la bala', hit && /_muro_|_tabique/.test(hit.n), hit && hit.n);
  }
}

console.log('\nESCALERAS Y PLANTA ALTA');
for (const H of C.HOUSES.filter(h => h.floors === 2)) {
  const st = C.stairOf(H), r = st.ramp, ax = r.axis, lowAt = st.highAtMin ? (ax === 'x' ? r.maxX : r.maxZ) : (ax === 'x' ? r.minX : r.minZ), dir = st.highAtMin ? -1 : 1;
  // start beside the low end of the stair (on the open side), step onto it and climb
  const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2, side = -st.out;
  const sx = ax === 'x' ? lowAt + dir * 0.5 : cx + side * 1.2, sz = ax === 'x' ? cz + side * 1.2 : lowAt + dir * 0.5;
  let s = at(sx, sz);
  s = walk(s, ax === 'x' ? 0 : -side, ax === 'x' ? -side : 0, 0.5);
  s = walk(s, ax === 'x' ? dir : 0, ax === 'x' ? 0 : dir, 3.0);
  s = walk(s, ax === 'x' ? 0 : side, ax === 'x' ? side : 0, 1.0);
  check(H.id + ': se sube la escalera hasta la planta alta (' + C.SLAB + ' m de forjado a 3,5)', Math.abs(s.y - 3.5) < 0.05 && inBox(H, s.x, s.z, 0.3), 'y ' + s.y.toFixed(2) + ' en ' + s.x.toFixed(1) + ', ' + s.z.toFixed(1));
  // walk around the upper floor: to the centre
  s = walk(s, H.x - s.x, H.z - s.z, Math.hypot(H.x - s.x, H.z - s.z) / 3.5);
  check(H.id + ': se anda por la planta alta (centro)', Math.abs(s.y - 3.5) < 0.05, 'y ' + s.y.toFixed(2) + ' en ' + s.x.toFixed(1) + ', ' + s.z.toFixed(1));
  // balcony: from inside, walk out through each balcony door; the railing keeps you on it
  const O = C.openings(H);
  for (const f of ['w', 'e', 'n', 's']) for (const o of O[f].filter(o => o.kind === 'balcony')) {
    const n = f === 'w' ? [-1, 0] : f === 'e' ? [1, 0] : f === 'n' ? [0, -1] : [0, 1], u = (o.u0 + o.u1) / 2;
    const ix = f === 'n' || f === 's' ? H.x + u : H.x + n[0] * (H.w / 2 - 1.2), iz = f === 'n' || f === 's' ? H.z + n[1] * (H.d / 2 - 1.2) : H.z + u;
    let b = at(ix, iz, 3.5); b = walk(b, n[0], n[1], 2.0);
    const outside = f === 'n' || f === 's' ? (b.z - H.z) * n[1] > H.d / 2 : (b.x - H.x) * n[0] > H.w / 2;
    check(H.id + ' balcón ' + f + ' (u ' + u + '): se sale al balcón y la baranda no deja caer', outside && Math.abs(b.y - 3.5) < 0.05, b.x.toFixed(2) + ', ' + b.y.toFixed(2) + ', ' + b.z.toFixed(2));
    b = walk(b, n[0], n[1], 1.0, { jump: true });
    check(H.id + ' balcón ' + f + ': saltando contra la baranda tampoco se cae', b.y > 3.4, 'y ' + b.y.toFixed(2));
  }
  // upper floor: the hole railing keeps you out of the stair's low half
  check(H.id + ': hay baranda en el hueco de la escalera', C.boxes(H).some(b => /_baranda$/.test(b.n)));
}

console.log('\nCOBERTURA (balas dentro)');
for (const H of C.HOUSES) {
  const t = C.boxes(H).filter(b => /_tabique$|_caja$/.test(b.n));
  for (const b of t) { const cx = (b.a[0] + b.b[0]) / 2, cz = (b.a[2] + b.b[2]) / 2, thinX = b.b[0] - b.a[0] < b.b[2] - b.a[2], caja = /_caja$/.test(b.n);
    let o = thinX ? [cx - 2, 1.0, cz] : [cx, 1.0, cz - 2], d = thinX ? [1, 0, 0] : [0, 0, 1];
    if (caja) { const L = Math.hypot(cx - H.x, cz - H.z); d = [(cx - H.x) / L, 0, (cz - H.z) / L]; o = [cx - d[0] * 2, 0.8, cz - d[2] * 2]; }
    const hit = seg(o, d, 4, SOLID);
    check(H.id + ' ' + b.n + ': para la bala a 1 m', hit === b || (hit && /_tabique|_caja/.test(hit.n)), hit && hit.n); }
}

console.log('\nNAVEGACIÓN INTERIOR');
for (const H of C.HOUSES) {
  const N = C.nav(H, C.boxes(H)), pts = N.pts, seen = new Uint8Array(pts.length), q = [N.doorsOut[0]]; seen[q[0]] = 1;
  while (q.length) { const k = q.pop(); for (const j of pts[k].n) if (!seen[j]) { seen[j] = 1; q.push(j); } }
  const lost = pts.filter((p, i) => !seen[i]).length;
  check(H.id + ': ' + pts.length + ' puntos, todos unidos con la primera puerta', lost === 0, lost + ' sueltos');
  check(H.id + ': las dos puertas unidas por dentro', N.doorsOut.every(i => seen[i]));
}
console.log('\n' + pass + ' ok, ' + fail + ' fallos');
process.exit(fail ? 1 : 0);
