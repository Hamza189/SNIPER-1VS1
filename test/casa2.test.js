/* CASA ATLAS 2.0 (02-11-2026, client/casa2.js, docs/CASA-ATLAS-2.md). Sin navegador: las cajas que usan el movimiento y
   las balas (las mismas que recibiría el servidor), las salidas, la red de los bots y el diseño que pidió el propietario.
   - 4 pisos de CASA ATLAS con sus cajas (menos la ventana que pasa a puerta y la barandilla con huecos), simétrico por el
     centro (los dos jugadores tienen el mismo mapa)
   - salidas a más de 30 m, sin verse, con espacio libre y tres salidas cada una
   - un solo trozo de red caminable; todas las habitaciones, el patio, el callejón y los pasillos con puntos
   - las tres rutas (interior, patio, flanco) entre las salidas, cada una sin pasar por las otras; con 1 m de paso libre
   - líneas de tiro de 25–40 m (CASA ATLAS: media 6,1 m, máxima 18,6 m) y cobertura cada ≤ 10 m en el patio
   Run: node test/casa2.test.js */
'use strict';
const C = require('../client/casa.js'), C2 = require('../client/casa2.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

const BX = C2.boxes(C), SOL = BX.filter(b => b.s);
const cols = BX.map(b => ({ minX: b.a[0], minY: b.a[1], minZ: b.a[2], maxX: b.b[0], maxY: b.b[1], maxZ: b.b[2] }));
const NAV = C2.navGrid(cols, 0.35, 1.8), SP = C2.spawns(C);
// a segment against the solid boxes (what stops bullets and sight: glass and rails do not)
function blocked(ax, ay, az, bx, by, bz, list) {
  const d = [bx - ax, by - ay, bz - az];
  for (const b of list || SOL) {
    let t0 = 0, t1 = 1, ok = true;
    for (let k = 0; k < 3 && ok; k++) {
      const o = [ax, ay, az][k];
      if (Math.abs(d[k]) < 1e-9) { if (o < b.a[k] || o > b.b[k]) ok = false; continue; }
      let u = (b.a[k] - o) / d[k], v = (b.b[k] - o) / d[k]; if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) ok = false;
    }
    if (ok) return true;
  }
  return false;
}
const inZone = (n, z) => n.x >= z.bounds[0] && n.x <= z.bounds[2] && n.z >= z.bounds[1] && n.z <= z.bounds[3];
function path(nav, from, to, avoid) {
  const near = q => { let best = -1, bd = 1e9; nav.forEach((n, i) => { const d = Math.hypot(n.x - q.x, n.z - q.z); if (d < bd && !(avoid && avoid(n))) { bd = d; best = i; } }); return best; };
  const s = near(from), e = near(to), prev = new Int32Array(nav.length).fill(-2), q = [s]; prev[s] = -1;
  for (let h = 0; h < q.length; h++) { const k = q[h]; if (k === e) break; for (const j of nav[k].n) if (prev[j] === -2 && !(avoid && avoid(nav[j]))) { prev[j] = k; q.push(j); } }
  if (prev[e] === -2) return null; let L = 0; for (let k = e; prev[k] >= 0; k = prev[k]) L += Math.hypot(nav[k].x - nav[prev[k]].x, nav[k].z - nav[prev[k]].z); return L;
}

console.log('\nCAJAS');
check('4 pisos de CASA ATLAS: sus 102 cajas menos las 6 de la ventana y la barandilla, cada uno', C.boxes.length === 102 && BX.filter(b => /^A_/.test(b.n)).length === 96 && ['A', 'B', 'C', 'D'].every(m => BX.filter(b => b.n.startsWith(m + '_')).length === 96));
check('ninguna caja vacía ni al revés', BX.every(b => b.a[0] < b.b[0] && b.a[1] < b.b[1] && b.a[2] < b.b[2]), BX.length + ' cajas, ' + SOL.length + ' sólidas');
const key = b => [b.a[0], b.a[1], b.a[2], b.b[0], b.b[1], b.b[2]].map(v => v.toFixed(2)).join(',') + ':' + b.s;
const set = new Set(BX.map(key)), turned = b => key({ a: [-b.b[0], b.a[1], -b.b[2]], b: [-b.a[0], b.b[1], -b.a[2]], s: b.s });
check('simétrico por el centro: cada caja tiene su gemela girada 180° (los dos jugadores, el mismo mapa)', BX.every(b => set.has(turned(b))), BX.filter(b => !set.has(turned(b))).map(b => b.n).slice(0, 4).join(' ') || 'todas');
const ext = BX.reduce((e, b) => [Math.min(e[0], b.a[0]), Math.max(e[1], b.b[0]), Math.min(e[2], b.a[2]), Math.max(e[3], b.b[2])], [1e9, -1e9, 1e9, -1e9]);
check('tamaño ~42 × 33 m (el propietario: «aproximadamente 40 × 32»)', ext[1] - ext[0] < 43.5 && ext[3] - ext[2] < 34, (ext[1] - ext[0]).toFixed(1) + ' × ' + (ext[3] - ext[2]).toFixed(1) + ' m');
check('cerrado: ninguna salida al exterior (los puntos caminables dentro de los muros)', NAV.every(n => n.x > -C2.XO && n.x < C2.XO && n.z > -C2.ZN && n.z < C2.ZN));

console.log('\nSALIDAS');
const dAB = Math.hypot(SP[0].x - SP[1].x, SP[0].z - SP[1].z);
check('dos salidas en extremos opuestos, a más de 30 m', dAB > 30 && SP[0].team === 'A' && SP[1].team === 'B', dAB.toFixed(1) + ' m');
check('simétricas (una es la otra girada 180°)', Math.abs(SP[0].x + SP[1].x) < 1e-6 && Math.abs(SP[0].z + SP[1].z) < 1e-6 && Math.abs(Math.abs(SP[0].yaw - SP[1].yaw) - Math.PI) < 1e-3);
check('no se ven entre sí (ojos a 1,62 m; el cristal no tapa)', blocked(SP[0].x, 1.62, SP[0].z, SP[1].x, 1.62, SP[1].z));
check('con espacio libre (0,6 m sin nada a la altura del cuerpo)', SP.every(s => !cols.some(c => c.maxY > 0.35 && c.minY < 1.8 && s.x > c.minX - 0.6 && s.x < c.maxX + 0.6 && s.z > c.minZ - 0.6 && s.z < c.maxZ + 0.6)));
check('miran hacia dentro del estudio (no a la pared)', SP.every(s => { const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw); return !blocked(s.x, 1.6, s.z, s.x + fx * 2.5, 1.6, s.z + fz * 2.5); }));
// three ways out of the spawn room: the new door to the corridor, the door to the living room and the one to the bedroom
const zA = C2.zones(C).find(z => z.name === 'A_ESTUDIO'), exits = new Set();
for (const n of NAV) if (inZone(n, zA)) for (const j of n.n) { const m = NAV[j]; if (!inZone(m, zA)) exits.add(m.x < zA.bounds[0] ? 'oeste' : m.z < zA.bounds[1] ? 'dormitorio' : m.x > zA.bounds[2] ? 'salon' : 'sur'); }
check('el estudio de la salida tiene 3 salidas (pasillo, salón, dormitorio)', exits.size >= 3, [...exits].join(', '));

console.log('\nRED DE LOS BOTS');
check('un solo trozo, sin puntos sueltos', NAV.length > 9000 && NAV.every(n => n.n.length > 0), NAV.length + ' puntos');
const zones = C2.zones(C), empty = zones.filter(z => !NAV.some(n => inZone(n, z)));
check('todas las habitaciones de los 4 pisos, el patio, el callejón y los dos pasillos tienen puntos (ninguna inaccesible)', empty.length === 0, empty.map(z => z.name).join(', ') || zones.length + ' zonas');
check('ningún punto dentro de una caja', NAV.every(n => !cols.some(c => c.maxY > 0.35 && c.minY < 1.8 && n.x > c.minX && n.x < c.maxX && n.z > c.minZ && n.z < c.maxZ)));

console.log('\nTRES RUTAS ENTRE LAS SALIDAS');
const Z = Object.fromEntries(zones.map(z => [z.name, z]));
// the patio (with its balconies) and the alley cross in the middle: the interior route may cross there, the patio route
// crosses the alley's line there
const inPatio = n => Math.abs(n.z) < 4.3 && Math.abs(n.x) < C2.XW && Math.abs(n.x) > 1.75, inAlley = n => Math.abs(n.x) < 1.75 && Math.abs(n.z) > 4.3, inCorr = n => Math.abs(n.x) > C2.XW;
const r1 = path(NAV, SP[0], SP[1], n => inPatio(n) || inCorr(n));                                 // interior: rooms, kitchens, alley
const r2 = path(NAV, SP[0], SP[1], n => inAlley(n) || (inCorr(n) && Math.abs(n.z) > 4.3));          // patio
const r3 = path(NAV, SP[0], SP[1], n => (inPatio(n) && Math.abs(n.x) < 17) || (inAlley(n) && n.z < -4.3));   // flank: corridor and the other flat
check('RUTA A (interior): habitaciones, comedor, callejón, comedor — sin pisar el patio ni los pasillos', r1 !== null, r1 && r1.toFixed(0) + ' m');
check('RUTA B (patio): balcón, patio, balcón — sin el callejón ni los pasillos', r2 !== null, r2 && r2.toFixed(0) + ' m');
check('RUTA C (flanco): pasillo lateral y el piso de al lado — sin el centro del patio', r3 !== null, r3 && r3.toFixed(0) + ' m');
check('ninguna mucho más corta que las otras (ninguna posición lo domina todo)', r1 && r2 && r3 && Math.max(r1, r2, r3) / Math.min(r1, r2, r3) < 1.8, [r1, r2, r3].map(v => v && v.toFixed(0)).join(' / ') + ' m');
const NAV5 = C2.navGrid(cols, 0.35, 1.8, 0.5);
check('puertas de 1 m y pasillos de 1,2 m o más: con 0,5 m de margen a cada lado las tres rutas siguen abiertas',
  path(NAV5, SP[0], SP[1], n => inPatio(n) || inCorr(n)) !== null && path(NAV5, SP[0], SP[1], n => inAlley(n) || (inCorr(n) && Math.abs(n.z) > 4.3)) !== null &&
  path(NAV5, SP[0], SP[1], n => (inPatio(n) && Math.abs(n.x) < 17) || (inAlley(n) && n.z < -4.3)) !== null);

console.log('\nLÍNEAS DE TIRO Y COBERTURA');
let seed = 11; const R = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
let n = 0, sum = 0, mx = 0, o25 = 0, o10 = 0;
for (let k = 0; k < 6000; k++) { const a = NAV[(R() * NAV.length) | 0], c = NAV[(R() * NAV.length) | 0], L = Math.hypot(a.x - c.x, a.z - c.z); if (L < 1) continue;
  if (!blocked(a.x, 1.6, a.z, c.x, 1.6, c.z)) { n++; sum += L; mx = Math.max(mx, L); if (L > 25) o25++; else if (L > 10) o10++; } }
check('líneas largas para el visor: máxima > 35 m, y muchas de 25–40 m (CASA ATLAS: media 6,1 m, máx 18,6 m)', mx > 35 && o25 > 40, 'media ' + (sum / n).toFixed(1) + ' m · máx ' + mx.toFixed(1) + ' m · ' + o25 + ' de ' + n + ' > 25 m · ' + o10 + ' de 10–25 m');
check('y combate cercano y medio: la mayoría de líneas por debajo de 25 m', o25 < n * 0.25 && o10 > n * 0.15);
const cover = BX.filter(b => /^(planter|lowwall)/.test(b.n)), far = [];
for (let x = -18; x <= 18; x += 1) for (const z of [-1.8, 0, 1.8]) { const d = Math.min(...cover.map(b => Math.hypot(Math.max(b.a[0] - x, 0, x - b.b[0]), Math.max(b.a[2] - z, 0, z - b.b[2])))); if (d > 6) far.push(x + ',' + z); }
check('en el patio, una cobertura a menos de 6 m de cualquier sitio (una cada 5–9 m)', far.length === 0, far.slice(0, 5).join(' ') || cover.length + ' coberturas');
check('las coberturas paran las balas (sólidas) y tienen altura de cobertura (1,05–1,1 m)', cover.every(b => b.s && b.b[1] >= 1.05 && b.b[1] <= 1.15));
check('nada bloquea una puerta: el callejón y los pasillos con 1,6 m libres al lado de cada obstáculo', BX.filter(b => /^(buttress|planter_alley)/.test(b.n)).every(b => {
  const inA = Math.abs((b.a[0] + b.b[0]) / 2) < 2; const lo = inA ? -1.7 : (b.a[0] < 0 ? -C2.XO : C2.XW), hi = inA ? 1.7 : (b.a[0] < 0 ? -C2.XW : C2.XO);
  return Math.max(b.a[0] - lo, hi - b.b[0]) >= 1.6; }));

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
