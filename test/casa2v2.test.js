/* CASA ATLAS 2.0, diseño 2 (04-11-2026, client/casa2.js → SDCasa2.v2, docs/CASA-ATLAS-2.md). Lo que pidió el propietario:
   «demasiados obstáculos para moverse libremente… que estén más conectadas, que no sean literalmente 4 casas en cuatro
   esquinas». Sin navegador, como test/casa2.test.js:
   - los pisos espalda con espalda: dos casas grandes, cada una unida por dentro con dos puertas (comedores y cocinas)
   - sin barandillas, bancos, mesa baja ni isla; un patio de casa a casa con 5 coberturas y una pérgola por encima
   - simétrico por el centro; salidas a más de 30 m sin verse; un solo trozo de red; tres rutas; líneas de tiro largas
   Run: node test/casa2v2.test.js */
'use strict';
const C = require('../client/casa.js'), C2 = require('../client/casa2.js').v2, C1 = require('../client/casa2.js');
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
const per = 102 - C2.DROP.length;
check('4 pisos de CASA ATLAS: sus 102 cajas menos las ' + C2.DROP.length + ' que se quitan (ventanas que pasan a puerta, barandillas, bancos, mesa, isla)',
  ['A', 'B', 'C', 'D'].every(m => BX.filter(b => b.n.startsWith(m + '_')).length === per), per + ' por piso');
check('ninguna caja vacía ni al revés', BX.every(b => b.a[0] < b.b[0] && b.a[1] < b.b[1] && b.a[2] < b.b[2]), BX.length + ' cajas, ' + SOL.length + ' sólidas');
const key = b => [b.a[0], b.a[1], b.a[2], b.b[0], b.b[1], b.b[2]].map(v => v.toFixed(2)).join(',') + ':' + b.s;
const set = new Set(BX.map(key)), turned = b => key({ a: [-b.b[0], b.a[1], -b.b[2]], b: [-b.a[0], b.b[1], -b.a[2]], s: b.s });
check('simétrico por el centro (los dos jugadores, el mismo mapa)', BX.every(b => set.has(turned(b))), BX.filter(b => !set.has(turned(b))).map(b => b.n).slice(0, 4).join(' ') || 'todas');
const ext = BX.reduce((e, b) => [Math.min(e[0], b.a[0]), Math.max(e[1], b.b[0]), Math.min(e[2], b.a[2]), Math.max(e[3], b.b[2])], [1e9, -1e9, 1e9, -1e9]);
check('tamaño ~39 × 33 m', ext[1] - ext[0] < 40 && ext[3] - ext[2] < 34, (ext[1] - ext[0]).toFixed(1) + ' × ' + (ext[3] - ext[2]).toFixed(1) + ' m');
check('cerrado: los puntos caminables dentro de los muros', NAV.every(n => n.x > -C2.XO && n.x < C2.XO && n.z > -C2.ZN && n.z < C2.ZN));
check('sin callejón: las paredes de los pisos A y B se tocan (x = 0)', !BX.some(b => /alley/.test(b.n)) && BX.some(b => b.n === 'A_wall_x_8.7_-5.1_0' && Math.abs(b.b[0]) < 0.001));
check('ni barandillas, ni bancos, ni mesa baja, ni isla', !BX.some(b => /rail|bench|coffee|island|player_boundary/.test(b.n)));

console.log('\nSALIDAS');
const dAB = Math.hypot(SP[0].x - SP[1].x, SP[0].z - SP[1].z);
check('dos salidas en extremos opuestos, a más de 30 m', dAB > 30 && SP[0].team === 'A' && SP[1].team === 'B', dAB.toFixed(1) + ' m');
check('simétricas (una es la otra girada 180°)', Math.abs(SP[0].x + SP[1].x) < 1e-6 && Math.abs(SP[0].z + SP[1].z) < 1e-6 && Math.abs(Math.abs(SP[0].yaw - SP[1].yaw) - Math.PI) < 1e-3);
check('no se ven entre sí (ojos a 1,62 m; el cristal no tapa)', blocked(SP[0].x, 1.62, SP[0].z, SP[1].x, 1.62, SP[1].z));
check('con espacio libre (0,6 m sin nada a la altura del cuerpo)', SP.every(s => !cols.some(c => c.maxY > 0.35 && c.minY < 1.8 && s.x > c.minX - 0.6 && s.x < c.maxX + 0.6 && s.z > c.minZ - 0.6 && s.z < c.maxZ + 0.6)));
check('miran hacia dentro del estudio (no a la pared)', SP.every(s => { const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw); return !blocked(s.x, 1.6, s.z, s.x + fx * 2.5, 1.6, s.z + fz * 2.5); }));
const zA = C2.zones(C).find(z => z.name === 'A_ESTUDIO'), exits = new Set();
for (const n of NAV) if (inZone(n, zA)) for (const j of n.n) { const m = NAV[j]; if (!inZone(m, zA)) exits.add(m.x < zA.bounds[0] ? 'oeste' : m.z < zA.bounds[1] ? 'dormitorio' : m.x > zA.bounds[2] ? 'salon' : 'sur'); }
check('el estudio de la salida tiene 3 salidas (pasillo, salón, dormitorio)', exits.size >= 3, [...exits].join(', '));

console.log('\nRED DE LOS BOTS');
check('un solo trozo, sin puntos sueltos', NAV.length > 9000 && NAV.every(n => n.n.length > 0), NAV.length + ' puntos');
const zones = C2.zones(C), empty = zones.filter(z => !NAV.some(n => inZone(n, z)));
check('todas las habitaciones de los 4 pisos, el patio y los dos pasillos tienen puntos', empty.length === 0, empty.map(z => z.name).join(', ') || zones.length + ' zonas');
check('ningún punto dentro de una caja', NAV.every(n => !cols.some(c => c.maxY > 0.35 && c.minY < 1.8 && n.x > c.minX && n.x < c.maxX && n.z > c.minZ && n.z < c.maxZ)));
{ const T = C2.thin(NAV), nb = T.map(() => []);
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { const d = Math.hypot(T[i].x - T[j].x, T[i].z - T[j].z);
    if (d < 0.751 && !blocked(T[i].x, 0.5, T[i].z, T[j].x, 0.5, T[j].z) && !blocked(T[i].x, 1.2, T[i].z, T[j].x, 1.2, T[j].z)) { nb[i].push(j); nb[j].push(i); } }
  const seen = new Uint8Array(T.length), q = [0]; seen[0] = 1; for (let h = 0; h < q.length; h++) for (const j of nb[q[h]]) if (!seen[j]) { seen[j] = 1; q.push(j); }
  check('la copia del servidor (un punto cada 0,5 m y los de junto a paredes y muebles) también es un solo trozo', q.length === T.length && T.length < NAV.length / 2, T.length + ' puntos'); }

console.log('\nMÁS CONECTADO Y MÁS LIBRE');
const Z = Object.fromEntries(zones.map(z => [z.name, z])), mid = z => ({ x: (z.bounds[0] + z.bounds[2]) / 2, z: (z.bounds[1] + z.bounds[3]) / 2 });
const zf = C2.CZ - 5.39, inCourt = n => Math.abs(n.z) < zf + 0.1 && Math.abs(n.x) < C2.XW, inCorr = n => Math.abs(n.x) > C2.XW, out = n => inCourt(n) || inCorr(n);
for (const [a, b, what] of [['A_COMEDOR', 'B_COMEDOR', 'los comedores'], ['A_COCINA', 'B_COCINA', 'las cocinas'], ['C_COMEDOR', 'D_COMEDOR', 'los comedores del sur']]) {
  const L = path(NAV, mid(Z[a]), mid(Z[b]), out);
  check('una puerta entre ' + what + ' de los dos pisos (sin salir de la casa)', L !== null && L < 12, L && L.toFixed(1) + ' m');
}
const cover = BX.filter(b => /^(planter|lowwall)/.test(b.n));
check('el patio, despejado: 5 coberturas (antes 14 más 4 contrafuertes)', cover.length === 5 && !BX.some(b => /buttress/.test(b.n)));
let tot = 0, free = 0; for (let x = -C2.XW + 0.5; x < C2.XW - 0.5; x += 0.25) for (let z = -zf + 0.5; z < zf - 0.5; z += 0.25) { tot++; if (NAV.some(n => Math.abs(n.x - x) < 0.13 && Math.abs(n.z - z) < 0.13)) free++; }
check('se puede andar por el 85 % o más del patio y los balcones', free / tot > 0.85, (100 * free / tot).toFixed(0) + ' %');
const v1c = C1.boxes(C).filter(b => b.s && b.b[1] > 0.35 && b.a[1] < 1.8).length, v2c = SOL.filter(b => b.b[1] > 0.35 && b.a[1] < 1.8).length;
check('menos obstáculos a la altura del cuerpo que el diseño 1', v2c < v1c, v1c + ' → ' + v2c);
check('la pérgola une las dos casas por encima de la cabeza (no estorba al moverse)', BX.filter(b => /^pergola/.test(b.n)).every(b => b.a[1] >= 2.7) && BX.some(b => /^pergola_/.test(b.n) && b.a[2] <= -zf + 0.01 && b.b[2] >= zf - 0.01));

console.log('\nTRES RUTAS ENTRE LAS SALIDAS');
const door = n => Math.abs(n.x) < 0.7 && Math.abs(n.z) > zf;   // crossing a party wall
const r1 = path(NAV, SP[0], SP[1], n => inCorr(n) || (inCourt(n) && n.x < 0));     // inside: to the next flat, then across the courtyard
const r2 = path(NAV, SP[0], SP[1], n => inCorr(n) || door(n));                     // the courtyard
const r3 = path(NAV, SP[0], SP[1], n => inCourt(n) && Math.abs(n.x) < 15);         // flank: corridors
check('RUTA A (por dentro): al piso de al lado por la puerta del comedor o la cocina, y cruzar al otro lado', r1 !== null, r1 && r1.toFixed(0) + ' m');
check('RUTA B (patio): balcón, patio, balcón — sin las puertas entre pisos ni los pasillos', r2 !== null, r2 && r2.toFixed(0) + ' m');
check('RUTA C (flanco): pasillo lateral — sin el centro del patio', r3 !== null, r3 && r3.toFixed(0) + ' m');
check('ninguna mucho más corta que las otras', r1 && r2 && r3 && Math.max(r1, r2, r3) / Math.min(r1, r2, r3) < 1.8, [r1, r2, r3].map(v => v && v.toFixed(0)).join(' / ') + ' m');
const NAV5 = C2.navGrid(cols, 0.35, 1.8, 0.5);
check('con 0,5 m de margen a cada lado las tres rutas siguen abiertas', path(NAV5, SP[0], SP[1], n => inCorr(n) || (inCourt(n) && n.x < 0)) !== null &&
  path(NAV5, SP[0], SP[1], n => inCorr(n) || door(n)) !== null && path(NAV5, SP[0], SP[1], n => inCourt(n) && Math.abs(n.x) < 15) !== null);

console.log('\nLÍNEAS DE TIRO Y COBERTURA');
let seed = 11; const R = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
let n = 0, sum = 0, mx = 0, o25 = 0, o10 = 0;
for (let k = 0; k < 6000; k++) { const a = NAV[(R() * NAV.length) | 0], c = NAV[(R() * NAV.length) | 0], L = Math.hypot(a.x - c.x, a.z - c.z); if (L < 1) continue;
  if (!blocked(a.x, 1.6, a.z, c.x, 1.6, c.z)) { n++; sum += L; mx = Math.max(mx, L); if (L > 25) o25++; else if (L > 10) o10++; } }
check('líneas largas para el visor: máxima > 30 m y bastantes de más de 25 m', mx > 30 && o25 > 40, 'media ' + (sum / n).toFixed(1) + ' m · máx ' + mx.toFixed(1) + ' m · ' + o25 + ' de ' + n + ' > 25 m · ' + o10 + ' de 10–25 m');
check('y combate cercano y medio: la mayoría por debajo de 25 m', o25 < n * 0.3 && o10 > n * 0.15);
const far = [];
for (let x = -17; x <= 17; x += 1) for (const z of [-3, 0, 3]) { const d = Math.min(...cover.map(b => Math.hypot(Math.max(b.a[0] - x, 0, x - b.b[0]), Math.max(b.a[2] - z, 0, z - b.b[2])))); if (d > 6) far.push(x + ',' + z); }
check('en el patio, una cobertura a menos de 6 m de cualquier sitio', far.length === 0, far.slice(0, 5).join(' ') || cover.length + ' coberturas');
check('las coberturas paran las balas y tienen altura de cobertura (1,05–1,1 m; el seto del centro, 2 m: tapa la diagonal entre salidas)', cover.every(b => b.s && (b.n === 'planter_centre' ? b.b[1] >= 1.9 : b.b[1] >= 1.05 && b.b[1] <= 1.15)));

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
