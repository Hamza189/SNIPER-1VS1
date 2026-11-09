/* Estadísticas de las armas: una sola fuente (08-11-2026, GUNSMITH, core/gunstats.js, docs/GUNSMITH.md).
   - las cifras de la ficha son las de core/config.js (nada inventado)
   - el daño por distancia de la pistola y la escopeta sigue su caída; el rifle no cae
   - la caída de la bala y el tiempo de vuelo coinciden con una bala del servidor (core/weapon.js paso a paso)
   - y lo que importa: en una sala del servidor real (core/room.js) cada impacto quita EXACTAMENTE lo que dice el ARSENAL
     para esa zona y esa distancia (cabeza, torso y piernas)
   Run: node test/gunstats.test.js */
'use strict';
const GS = require('../core/gunstats.js'), CFG = require('../core/config.js'), Wp = require('../core/weapon.js');
const { createSim, lookAt, INDEX, MAP } = require('./simnet.js');
const G = require('../core/geom.js'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const R = CFG.rifles.halcon, P = CFG.pistols.vibora, SG = CFG.shotguns.furia;

console.log('\nFICHA (core/config.js)');
const S = GS.sheet(R);
check('daño por zona, cadencia, cargador, recarga, apuntar, bala y alcance: los de la configuración', S.dmg.head === R.dmg.head && S.dmg.torso === R.dmg.torso && S.dmg.legs === R.dmg.legs &&
  S.rpm === Math.round(60 / R.bolt) && S.mag === R.mag && S.reload === R.reload && S.ads === R.adsTime && S.speed === R.speed && S.maxRange === R.maxRange && S.zero === R.zero, JSON.stringify(S.dmg) + ' · ' + S.rpm + '/min');
check('movilidad: la del movimiento (andar, correr, apuntando × ' + CFG.move.adsMul + ')', S.walk === CFG.move.walk && S.sprint === CFG.move.sprint && Math.abs(S.adsWalk - CFG.move.walk * CFG.move.adsMul) < 0.01);
check('disparos para eliminar (vida 100): cabeza 1, torso 2, piernas 2', S.table[0].headShots === 1 && S.table[0].torsoShots === 2 && S.table[0].legsShots === 2);
check('el rifle no pierde daño con la distancia (de 10 a 450 m)', S.table.every(r => r.head === 250 && r.torso === 85 && r.legs === 55) && S.table[S.table.length - 1].d === 450);
check('la pistola sí: × 1 hasta ' + P.falloff.from + ' m y × ' + P.falloff.min + ' desde ' + P.falloff.to + ' m', GS.dmgAt(P, 'torso', P.falloff.from) === P.dmg.torso && GS.dmgAt(P, 'torso', P.falloff.to + 5) === Math.round(P.dmg.torso * P.falloff.min) &&
  GS.dmgAt(P, 'torso', (P.falloff.from + P.falloff.to) / 2) === Math.round(P.dmg.torso * (1 + P.falloff.min) / 2));
check('la escopeta, por perdigón, también', GS.dmgAt(SG, 'torso', 5) === SG.dmg.torso && GS.dmgAt(SG, 'torso', 40) === Math.round(SG.dmg.torso * SG.falloff.min));

console.log('\nBALÍSTICA (la del servidor)');
{ const f = GS.flight(R, R.zero);
  check('a la distancia de puesta a cero (' + R.zero + ' m) la bala pasa por la retícula', Math.abs(f.y) < 0.002, (f.y * 1000).toFixed(1) + ' mm');
  // a server bullet, step by step (core/room.js: Wp.stepBullet at 1/TICK), fired zeroLift above the line of sight
  const th = Wp.zeroLift(R), b = Wp.createBullet(0, 0, 0, Math.cos(th), Math.sin(th), 0, R), pts = [];
  while (b.x < 300) { Wp.stepBullet(b, 1 / CFG.TICK, R); pts.push([b.x, b.y, b.age]); }
  const at = d => { const i = pts.findIndex(p => p[0] >= d), a = i > 0 ? pts[i - 1] : [0, 0, 0], c = pts[i], k = (d - a[0]) / (c[0] - a[0]); return [a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k]; };
  const bad = [100, 200, 300].filter(d => { const s = at(d), g = GS.flight(R, d); return Math.abs(s[0] - g.y) > 0.003 || Math.abs(s[1] - g.t) > 0.002; });
  check('caída y tiempo de vuelo a 100, 200 y 300 m = los de una bala del servidor', bad.length === 0, GS.table(R, [100, 200, 300]).map(r => r.d + ' m: ' + r.dropCm + ' cm, ' + r.ms + ' ms').join(' · '));
  check('más allá del alcance máximo no hay bala', GS.flight(R, R.maxRange + 1) === null);
}

console.log('\nUNA SOLA FUENTE');
{ const room = fs.readFileSync(path.join(__dirname, '..', 'core', 'room.js'), 'utf8'), page = fs.readFileSync(path.join(__dirname, '..', 'src', 'page.html'), 'utf8');
  check('el servidor calcula el daño con core/gunstats.js (no con una copia)', /const dmgAt = GS\.dmgAt;/.test(room) && !/function dmgAt/.test(room));
  check('el juego contra bots también (sin la cuenta repetida)', (page.match(/SDGunStats\.dmgAt\(/g) || []).length >= 2 && !/f\.min\)\*\(dist-f\.from\)/.test(page)); }

console.log('\nEN UNA SALA DEL SERVIDOR (core/room.js)');
// two open spots d metres apart, with a clear line of sight (the same search as test/room.test.js)
function openPair(d) {
  for (const [x, z] of MAP.nav) { const x2 = x + d; if (!MAP.nav.some(n => n[0] === x2 && n[1] === z)) continue;
    if (G.losClear(INDEX, x, 1.6, z, x2, 1.6, z) && G.losClear(INDEX, x, 0.4, z, x2, 0.4, z) && G.losClear(INDEX, x, 1.2, z, x2, 1.2, z)) return [[x, z], [x2, z]]; }
  return null;
}
const evs = (c, k) => c.events.filter(e => e.k === k);
for (const [d, part, y] of [[24, 'head', 1.63], [24, 'torso', 1.17], [24, 'legs', 0.43], [36, 'torso', 1.17]]) {
  const pair = openPair(d); if (!pair) { check('tramo despejado de ' + d + ' m', false); continue; }
  let shoot = false;
  const Sm = createSim({ latency: 30 });
  const { A, B } = Sm.setupMatch((c, S2) => { const s = S2.room.seats.B.p.ms; return Object.assign(lookAt(c, [s.x, s.y + y, s.z]), { fire: shoot, adsHeld: true }); }, () => ({ yaw: 0 }));
  const yawA = Math.atan2(-(pair[1][0] - pair[0][0]), -(pair[1][1] - pair[0][1])), yawB = Math.atan2(-(pair[0][0] - pair[1][0]), -(pair[0][1] - pair[1][1]));
  Sm.room.debug.place('A', pair[0][0], pair[0][1], yawA); Sm.room.debug.place('B', pair[1][0], pair[1][1], yawB); Sm.run(400);
  Sm.run(800); shoot = true; Sm.run(20); shoot = false; Sm.run(600);
  const h = evs(A, 'hit')[0], row = GS.table(R, [h ? h.dist : d])[0];
  check('a ' + d + ' m, ' + ({ head: 'cabeza', torso: 'torso', legs: 'piernas' })[part] + ': el servidor quita lo que dice el ARSENAL', h && h.part === part && h.dmg === row[part] && h.dmg === GS.dmgAt(R, part, h.dist), h ? h.part + ' ' + h.dmg + ' (ARSENAL: ' + row[part] + ')' : 'sin impacto');
}

console.log('\nRIFLES DISTINTOS (tabla de prueba del 08-11, solo contra bots)');
{ const Me = require('../core/melee.js'), Pl = require('../core/player.js');
  const T = { titan: [250, 90, 60, 1.10, 7, 2.80, 0.26, 720, 0.93], ultima: [250, 95, 70, 1.15, 5, 2.70, 0.28, 680, 0.88], vector: [220, 75, 50, 0.75, 6, 2.10, 0.16, 560, 1.05], sahara: [250, 80, 55, 0.90, 5, 2.20, 0.18, 610, 1.03] };
  const bad = Object.keys(T).filter(id => { const g = CFG.rifles[id], t = T[id]; return !g || g.dmg.head !== t[0] || g.dmg.torso !== t[1] || g.dmg.legs !== t[2] || g.bolt !== t[3] || g.mag !== t[4] || g.reload !== t[5] || g.adsTime !== t[6] || g.speed !== t[7] || g.moveMul !== t[8]; });
  check('TITÁN, ÚLTIMA, VECTOR y SAHARA con las cifras aprobadas; el HALCÓN R7 sin cambios', bad.length === 0 && R.dmg.torso === 85 && R.bolt === 0.95 && R.mag === 5 && R.reload === 2.35 && R.adsTime === 0.2 && R.speed === 600 && !R.moveMul, bad.join() || 'ok');
  const L = Me.createLoadout(CFG.knives.tactica, CFG.loadout, P, SG);
  check('con el rifle en la mano, la velocidad es la del modelo (HALCÓN × 1; sin config × 1)', Me.speedMul(L, R) === 1 && Me.speedMul(L) === 1 && Me.speedMul(L, CFG.rifles.titan) === 0.93 && Me.speedMul(L, CFG.rifles.vector) === 1.05);
  const walk = g => { const pl = Pl.create(0, 0, 0, g); for (let i = 0; i < 240; i++) Pl.step(pl, { mz: -1, yaw: 0 }, 1 / 120, { colliders: [], ramps: [] }); return Math.hypot(pl.ms.vx, pl.ms.vz); };
  const vh = walk(R), vt = walk(CFG.rifles.titan);
  check('un jugador con el TITÁN anda un 7 % más lento (el mismo tick que usa el servidor)', Math.abs(vt / vh - 0.93) < 0.01, vh.toFixed(2) + ' → ' + vt.toFixed(2) + ' m/s');
  const room = fs.readFileSync(path.join(__dirname, '..', 'core', 'room.js'), 'utf8');
  check('el servidor sigue con el HALCÓN R7 para todos (no lee los otros rifles)', /const GUN = CFG\.rifles\.halcon/.test(room) && !/rifles\.(titan|ultima|vector|sahara)/.test(room));
  const sh = GS.sheet(CFG.rifles.ultima);
  check('la ficha del ARSENAL lleva también el balanceo, el retroceso y el perfil de cada rifle', sh.sway === CFG.rifles.ultima.sway && sh.recoil === CFG.rifles.ultima.recoil.pitch && sh.role === CFG.rifles.ultima.role && sh.moveMul === 0.88); }

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
