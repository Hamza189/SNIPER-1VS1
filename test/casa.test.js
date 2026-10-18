/* CASA ATLAS 1V1 (experimental map, 18-10-2026) without a browser:
   - the server's boxes (core/mapdata.js, exported from the page) are exactly client/casa.js: same movement boxes, a bullet
     box for every solid one and none for glass, plants, rails and the no-standing caps
   - spawns A/B free at the game's radius (0.35 m) and connected; every zone reachable
   - every door can be walked through with the real movement code; the glass walls cannot
   - nobody gets out of the flat (windows, balcony rails) jumping, nor stands on the tall furniture
   - bullets: walls and the TV stop them, glass and the balcony rail do not
   - an online 1v1 on the map (simulated network): fixed spawns, a headshot, a wall that stops it, a shot through glass
   Run: node test/casa.test.js */
'use strict';
const SDCasa = require('../client/casa.js'), MAP = require('../core/mapdata.js'), G = require('../core/geom.js');
const SDMovement = require('../core/movement.js'), CFG = require('../core/config.js');
const { createSim, lookAt } = require('./simnet.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const CM = MAP.maps.casa, IX = G.createMapIndex(CM), M = CFG.move, R = M.radius;
const solid = SDCasa.boxes.filter(b => b.s), moveOnly = SDCasa.boxes.filter(b => !b.s);
const byName = n => SDCasa.boxes.find(b => b.n === n);

console.log('\nCLIENTE = SERVIDOR');
check('el servidor conoce el mapa casa', !!CM && Array.isArray(CM.colliders));
const same = CM.colliders.length === SDCasa.boxes.length && SDCasa.boxes.every((b, i) => { const c = CM.colliders[i];
  return [c.minX, c.minY, c.minZ].every((v, k) => Math.abs(v - b.a[k]) < 1e-6) && [c.maxX, c.maxY, c.maxZ].every((v, k) => Math.abs(v - b.b[k]) < 1e-6); });
check('cajas de movimiento del servidor idénticas a client/casa.js (' + SDCasa.boxes.length + ')', same);
check('triángulos de bala: 12 por caja sólida + el suelo, nada más', CM.tris.length / 9 === solid.length * 12 + 2, CM.tris.length / 9 + ' = ' + solid.length + ' × 12 + 2');
check('las cajas originales de ChatGPT están todas (78)', SDCasa.boxes.filter(b => !/^(tv_panel|headboard|chair_|bench_|glass_|plant_|rail_.*_tall|nostand_)/.test(b.n)).length === 78);
check('salidas fijas A y B en el servidor, iguales que en el cliente', CM.spawns && CM.spawns.length === 2 && CM.spawns.every((s, i) => s.team === SDCasa.spawns[i].team && s.x === SDCasa.spawns[i].x && s.z === SDCasa.spawns[i].z));

console.log('\nRECORRIDO (radio 0.35 m, escalón 0.45 m)');
const body = CM.colliders.filter(c => c.maxY > M.step && c.minY < M.heightStand);
const freeAt = (x, z, r) => !body.some(c => x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r);
for (const s of CM.spawns) check('salida ' + s.team + ' libre a radio 0.35', freeAt(s.x, s.z, R), s.x + ', ' + s.z);
{ const Gs = 0.05, X0 = -8.7, Z0 = -6.7, nx = Math.round(17.4 / Gs), nz = Math.round(13.7 / Gs), seen = new Uint8Array(nx * nz), ok = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) ok[i * nz + k] = freeAt(X0 + i * Gs, Z0 + k * Gs, R) ? 1 : 0;
  const cell = (x, z) => Math.round((x - X0) / Gs) * nz + Math.round((z - Z0) / Gs);
  const q = [cell(CM.spawns[0].x, CM.spawns[0].z)]; seen[q[0]] = 1;
  while (q.length) { const c = q.pop(), i = Math.floor(c / nz), k = c % nz;
    for (const [a, b] of [[i + 1, k], [i - 1, k], [i, k + 1], [i, k - 1]]) { if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const j = a * nz + b; if (ok[j] && !seen[j]) { seen[j] = 1; q.push(j); } } }
  check('B alcanzable desde A andando', !!seen[cell(CM.spawns[1].x, CM.spawns[1].z)]);
  for (const z of SDCasa.zones) { let n = 0, f = 0; const [x0, z0, x1, z1] = z.bounds;
    for (let x = x0 + 0.05; x < x1; x += 0.1) for (let zz = z0 + 0.05; zz < z1; zz += 0.1) { const c = cell(x, zz); if (ok[c]) { f++; if (seen[c]) n++; } }
    check('zona ' + z.name + ' alcanzable (rincones muertos < 6 %: detrás de la mesilla, entre váter y lavabo)', f > 0 && n >= f * 0.94, n + '/' + f + ' puntos libres'); }
  const outside = [...seen].reduce((n, v, c) => n + (v && (X0 + Math.floor(c / nz) * Gs > 8.7 || Z0 + (c % nz) * Gs > 7.0) ? 1 : 0), 0);
  check('ningún punto alcanzable fuera del piso', outside === 0);
}
// walk with the real movement code: start, face (yaw), hold forward (optionally sprint + jump), for t seconds
const world = { colliders: CM.colliders, ramps: [] };
function walk(x, z, yaw, t, o) { o = o || {}; const s = SDMovement.createState(x, o.y || 0, z);
  for (let i = 0; i < t * 60; i++) SDMovement.step(s, { mx: 0, mz: -1, yaw, sprint: !!o.sprint, jump: !!o.jump && i % 20 === 0 }, 1 / 60, world, M);
  return s; }
// doors: every wall piece that starts high (≥ 2 m) is the lintel of an opening; glass walls are the openings the glass closes
const lintels = SDCasa.boxes.filter(b => /^wall_/.test(b.n) && b.a[1] >= 2.0);
const glass = moveOnly.filter(b => /^glass_/.test(b.n));
let doors = 0;
for (const l of lintels) {
  const alongX = /^wall_z_/.test(l.n), c = [(l.a[0] + l.b[0]) / 2, (l.a[2] + l.b[2]) / 2], span = alongX ? l.b[0] - l.a[0] : l.b[2] - l.a[2];
  const glazed = glass.some(g => c[0] > g.a[0] - 0.05 && c[0] < g.b[0] + 0.05 && c[1] > g.a[2] - 0.05 && c[1] < g.b[2] + 0.05);
  const res = [];
  for (const dir of [1, -1]) {   // both ways through
    let st = null;
    for (const off of [1.0, 1.3, 0.7, 1.6]) { const p = alongX ? [c[0], c[1] - dir * off] : [c[0] - dir * off, c[1]]; if (freeAt(p[0], p[1], R)) { st = p; break; } }
    st = st;
    if (!st) { res.push('sin sitio'); continue; }
    const yaw = alongX ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    const s = walk(st[0], st[1], yaw, 2.5), crossed = alongX ? (s.z - c[1]) * dir > 0.5 : (s.x - c[0]) * dir > 0.5;
    res.push(crossed ? 'pasa' : 'no pasa');
  }
  if (glazed) check('cristalera ' + l.n + ' (' + span.toFixed(2) + ' m): no se cruza', res.every(r => r !== 'pasa'), res.join(' / '));
  else { doors++; check('puerta ' + l.n + ' (' + span.toFixed(2) + ' m): se cruza en los dos sentidos', res.every(r => r === 'pasa'), res.join(' / ')); }
}
check('puertas encontradas: al menos 9', doors >= 9, doors);

console.log('\nSALIRSE DEL MAPA');
const inside = s => s.x > -8.72 && s.x < 8.72 && s.z > -6.72 && s.z < 7.05;
for (const g of glass.concat(moveOnly.filter(b => /^rail_/.test(b.n)))) {
  const cx = (g.a[0] + g.b[0]) / 2, cz = (g.a[2] + g.b[2]) / 2, thinX = g.b[0] - g.a[0] < g.b[2] - g.a[2];
  // face out of the flat (or out of the bathroom for the shower screen): start 1.1 m before it
  const outX = thinX ? (cx > 0 ? 1 : -1) : 0, outZ = thinX ? 0 : (cz > 0 ? 1 : -1);
  let st = null; const half = thinX ? (g.b[2] - g.a[2]) / 2 : (g.b[0] - g.a[0]) / 2;
  for (const lat of [0, -0.4, 0.4, -0.8, 0.8, -1.2, 1.2].filter(l => Math.abs(l) < half)) for (const off of [1.1, 0.8, 1.5, 0.6]) {
    const x = cx - outX * off + (thinX ? 0 : lat), z = cz - outZ * off + (thinX ? lat : 0); if (!st && freeAt(x, z, R)) st = [x, z]; }
  if (!st) { check(g.n + ': sitio para probar', false); continue; }
  const yaw = Math.atan2(outX, outZ) + Math.PI, s = walk(st[0], st[1], yaw, 4, { sprint: true, jump: true });
  const crossed = thinX ? (s.x - cx) * outX > 0.05 : (s.z - cz) * outZ > 0.05;
  check(g.n + ': corriendo y saltando contra él no se pasa', !crossed && inside(s), s.x.toFixed(2) + ', ' + s.y.toFixed(2) + ', ' + s.z.toFixed(2));
}
for (const b of moveOnly.filter(b => /^nostand_/.test(b.n))) {
  const s = SDMovement.createState((b.a[0] + b.b[0]) / 2, b.a[1], (b.a[2] + b.b[2]) / 2);
  for (let i = 0; i < 60; i++) SDMovement.step(s, { mx: 0, mz: 0, yaw: 0 }, 1 / 60, world, M);
  check(b.n.replace('nostand_', 'encima de ') + ' (' + b.a[1] + ' m): no se puede quedar', s.y < b.a[1] - 0.3, 'acaba a ' + s.y.toFixed(2) + ' m');
}

console.log('\nBALAS (servidor)');
const seg = (a, b) => { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d); return G.segMap(IX, a[0], a[1], a[2], d[0] / l, d[1] / l, d[2] / l, l); };
let wallsOk = 0, wallsN = 0;
for (const b of solid.filter(b => /^wall_/.test(b.n) && b.a[1] < 0.1 && b.b[1] > 2.5)) {
  const alongX = b.b[0] - b.a[0] > b.b[2] - b.a[2], c = [(b.a[0] + b.b[0]) / 2, 1.5, (b.a[2] + b.b[2]) / 2];
  const a = alongX ? [c[0], 1.5, c[2] - 1] : [c[0] - 1, 1.5, c[2]], e = alongX ? [c[0], 1.5, c[2] + 1] : [c[0] + 1, 1.5, c[2]];
  wallsN++; if (seg(a, e) && seg(e, a)) wallsOk++;
}
check('todas las paredes paran las balas por los dos lados', wallsOk === wallsN, wallsOk + '/' + wallsN);
for (const g of glass) {
  const cx = (g.a[0] + g.b[0]) / 2, cz = (g.a[2] + g.b[2]) / 2, thinX = g.b[0] - g.a[0] < g.b[2] - g.a[2], y = Math.min(1.7, (g.b[1] + 1.3) / 2);
  const a = thinX ? [cx - 1, y, cz] : [cx, y, cz - 1], e = thinX ? [cx + 1, y, cz] : [cx, y, cz + 1];
  check('el cristal ' + g.n + ' no para las balas', !seg(a, e) && !seg(e, a));
}
check('la barandilla del balcón no para las balas', !seg([0, 0.6, 6.5], [0, 0.6, 9]));
check('el televisor de pie para las balas', !!seg([-1.2, 1.5, -3.0], [-1.2, 1.5, -1.0]));
check('una planta no para las balas (son hojas)', !seg([-5.0, 0.5, 4.15], [-3.0, 0.5, 4.15]));
check('por encima de los tabiques (sin techo) las balas salen', !seg([-6, 3.4, 0], [6, 3.4, 0]));

console.log('\n1V1 ONLINE EN CASA ATLAS (red simulada)');
{ const S = createSim({ maps: 'casa', latency: 30 });
  let shoot = false;
  const { A, B } = S.setupMatch((c, S) => { const s = S.room.seats.B.p.ms; return Object.assign(lookAt(c, [s.x, s.y + 1.63, s.z]), { fire: shoot, adsHeld: true }); }, () => ({ yaw: 0 }));
  const sa = A.events.find(e => e.k === 'start').m.spawn, sb = B.events.find(e => e.k === 'start').m.spawn;
  check('la sala empieza en CASA ATLAS', A.N.map === 'casa' && B.N.map === 'casa');
  check('aparecen en las salidas A (estudio) y B (cocina)', Math.abs(sa.x - CM.spawns[0].x) < 0.01 && Math.abs(sa.z - CM.spawns[0].z) < 0.01 && Math.abs(sb.x - CM.spawns[1].x) < 0.01 && Math.abs(sb.z - CM.spawns[1].z) < 0.01, JSON.stringify([sa, sb]));
  check('sin línea de visión entre las salidas', !G.losClear(IX, sa.x, 1.6, sa.z, sb.x, 1.6, sb.z));
  const shot = (pa, pb, ms) => { S.room.debug.place('A', pa[0], pa[1], 0); S.room.debug.place('B', pb[0], pb[1], 0); S.run(ms || 900); A.N.corrMax = 0;   // (a test teleport is a legitimate correction)
    const h0 = A.events.filter(e => e.k === 'hit').length, s0 = A.events.filter(e => e.k === 'shot').length; shoot = true; S.run(20); shoot = false; S.run(600);
    return { hits: A.events.filter(e => e.k === 'hit').slice(h0), shots: A.events.filter(e => e.k === 'shot').length - s0 }; };
  let r = shot([-2.5, 0.8], [2.4, 0.4]);
  check('headshot cruzando el salón', r.hits.some(h => h.part === 'head'), r.hits.map(h => h.part).join());
  S.run(3300);
  r = shot([-5.7, -0.6], [-3.6, -0.6]);
  check('el tabique estudio–salón para la bala', r.hits.length === 0 && r.shots >= 1);
  r = shot([0.0, 6.2], [0.0, 4.2]);
  check('a través de la cristalera del balcón sí se acierta', r.hits.length === 1, r.hits.map(h => h.part).join());
  S.run(3300);
  r = shot([-1.2, -2.9], [-1.2, -0.6]);
  check('el televisor de pie para la bala', r.hits.length === 0 && r.shots >= 1);
  check('sin correcciones de predicción tras colocarlos', A.N.corrMax < 0.05, A.N.corrMax.toFixed(3));
}
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
