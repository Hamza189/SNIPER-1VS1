/* CASA ATLAS 2.0 · JARDÍN (04-11-2026, client/casa2j.js: el GLB de ChatGPT con sus 365 cajas). Sin navegador:
   - cajas sanas y simétricas por el centro (los dos jugadores, el mismo mapa); cerrado
   - salidas a más de 30 m, sin verse, con espacio libre
   - un solo trozo de red caminable (y la copia del servidor, como enlazan sus bots)
   - tres rutas entre salidas (por dentro, por el patio, por el jardín del flanco); líneas de tiro largas
   Run: node test/casa2j.test.js */
'use strict';
const J = require('../client/casa2j.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const BX = J.boxes(), SOL = BX.filter(b => b.s), SP = J.spawns();
const cols = BX.map(b => ({ minX: b.a[0], minY: b.a[1], minZ: b.a[2], maxX: b.b[0], maxY: b.b[1], maxZ: b.b[2] }));
const NAV = J.navGrid(cols, 0.35, 1.8);
function blocked(ax, ay, az, bx, by, bz) {
  const d = [bx - ax, by - ay, bz - az];
  for (const b of SOL) { let t0 = 0, t1 = 1, ok = true;
    for (let k = 0; k < 3 && ok; k++) { const o = [ax, ay, az][k]; if (Math.abs(d[k]) < 1e-9) { if (o < b.a[k] || o > b.b[k]) ok = false; continue; }
      let u = (b.a[k] - o) / d[k], v = (b.b[k] - o) / d[k]; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) ok = false; }
    if (ok) return true; }
  return false;
}
function path(nav, from, to, avoid) {
  const near = q => { let best = -1, bd = 1e9; nav.forEach((n, i) => { const d = Math.hypot(n.x - q.x, n.z - q.z); if (d < bd && !(avoid && avoid(n))) { bd = d; best = i; } }); return best; };
  const s = near(from), e = near(to), prev = new Int32Array(nav.length).fill(-2), q = [s]; prev[s] = -1;
  for (let h = 0; h < q.length; h++) { const k = q[h]; if (k === e) break; for (const j of nav[k].n) if (prev[j] === -2 && !(avoid && avoid(nav[j]))) { prev[j] = k; q.push(j); } }
  if (prev[e] === -2) return null; let L = 0; for (let k = e; prev[k] >= 0; k = prev[k]) L += Math.hypot(nav[k].x - nav[prev[k]].x, nav[k].z - nav[prev[k]].z); return L;
}

console.log('\nCAJAS');
check('365 cajas, ninguna vacía ni al revés', BX.length === 365 && BX.every(b => b.a[0] < b.b[0] && b.a[1] < b.b[1] && b.a[2] < b.b[2]), SOL.length + ' sólidas');
const key = b => [b.a[0], b.a[1], b.a[2], b.b[0], b.b[1], b.b[2]].map(v => v.toFixed(2)).join(',') + ':' + b.s;
const set = new Set(BX.map(key)), turned = b => key({ a: [-b.b[0], b.a[1], -b.b[2]], b: [-b.a[0], b.b[1], -b.a[2]], s: b.s });
check('simétrico por el centro', BX.every(b => set.has(turned(b))), BX.filter(b => !set.has(turned(b))).map(b => b.n).slice(0, 4).join(' ') || 'todas');
check('cerrado: los puntos caminables dentro de los límites', NAV.every(n => Math.abs(n.x) < J.XO && Math.abs(n.z) < J.ZN));
check('tejados y pérgola por encima de la cabeza (no estorban al moverse)', BX.filter(b => /roof|porch|pergola/.test(b.n)).every(b => b.a[1] >= 2.7));

console.log('\nSALIDAS');
const dAB = Math.hypot(SP[0].x - SP[1].x, SP[0].z - SP[1].z);
check('dos salidas opuestas a más de 30 m y simétricas', dAB > 30 && Math.abs(SP[0].x + SP[1].x) < 1e-6 && Math.abs(SP[0].z + SP[1].z) < 1e-6, dAB.toFixed(1) + ' m');
check('no se ven entre sí (ojos a 1,62 m; el cristal no tapa)', blocked(SP[0].x, 1.62, SP[0].z, SP[1].x, 1.62, SP[1].z));
check('con espacio libre (0,6 m)', SP.every(s => !cols.some(c => c.maxY > 0.35 && c.minY < 1.8 && s.x > c.minX - 0.6 && s.x < c.maxX + 0.6 && s.z > c.minZ - 0.6 && s.z < c.maxZ + 0.6)));

console.log('\nRED DE LOS BOTS');
check('un solo trozo, sin puntos sueltos', NAV.length > 9000 && NAV.every(n => n.n.length > 0), NAV.length + ' puntos');
check('ningún punto dentro de una caja', NAV.every(n => !cols.some(c => c.maxY > 0.35 && c.minY < 1.8 && n.x > c.minX && n.x < c.maxX && n.z > c.minZ && n.z < c.maxZ)));
{ const T = J.thin(NAV), nb = T.map(() => []);
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { const d = Math.hypot(T[i].x - T[j].x, T[i].z - T[j].z);
    if (d < 0.751 && !blocked(T[i].x, 0.5, T[i].z, T[j].x, 0.5, T[j].z) && !blocked(T[i].x, 1.2, T[i].z, T[j].x, 1.2, T[j].z)) { nb[i].push(j); nb[j].push(i); } }
  const seen = new Uint8Array(T.length), q = [0]; seen[0] = 1; for (let h = 0; h < q.length; h++) for (const j of nb[q[h]]) if (!seen[j]) { seen[j] = 1; q.push(j); }
  check('la copia del servidor también es un solo trozo', q.length === T.length && T.length < NAV.length / 2, T.length + ' puntos'); }

console.log('\nRUTAS Y LÍNEAS DE TIRO');
const inCourt = n => Math.abs(n.z) < 4.2 && Math.abs(n.x) < 17, side = n => Math.abs(n.x) > 17;
const r1 = path(NAV, SP[0], SP[1], n => side(n) || (inCourt(n) && n.x < 0));
const r2 = path(NAV, SP[0], SP[1], n => side(n) || (Math.abs(n.x) < 0.7 && Math.abs(n.z) > 4.2));
const r3 = path(NAV, SP[0], SP[1], n => inCourt(n) && Math.abs(n.x) < 12);
check('tres rutas: por dentro, por el patio y por el jardín del flanco', r1 && r2 && r3, [r1, r2, r3].map(v => v && v.toFixed(0)).join(' / ') + ' m');
let seed = 11; const R = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
let n = 0, sum = 0, mx = 0, o25 = 0;
for (let k = 0; k < 6000; k++) { const a = NAV[(R() * NAV.length) | 0], c = NAV[(R() * NAV.length) | 0], L = Math.hypot(a.x - c.x, a.z - c.z); if (L < 1) continue;
  if (!blocked(a.x, 1.6, a.z, c.x, 1.6, c.z)) { n++; sum += L; mx = Math.max(mx, L); if (L > 25) o25++; } }
check('líneas largas para el visor (máxima > 30 m)', mx > 30 && o25 > 20, 'media ' + (sum / n).toFixed(1) + ' m · máx ' + mx.toFixed(1) + ' m · ' + o25 + ' de ' + n + ' > 25 m');

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
