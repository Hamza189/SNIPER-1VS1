/* PENETRACIÓN y BALA DURA en el servidor (10-11-2026, aprobado por el propietario: «sí, está bien»).
   Dos clientes de verdad sobre la red simulada (test/simnet.js) en el PUEBLO, a cada lado de una caja del mapa que la
   página exporta como atravesable (core/mapdata.js 'pen'):
   - caja fina (de madera): la bala del rifle pasa con el 75 % del daño, lleve o no BALA DURA;
   - pared media: sin BALA DURA se queda en ella; con BALA DURA pasa, con el daño según lo que recorre dentro;
   - el evento 'hit' lo dice (thru), y los tiros sin nada en medio siguen igual.
   Run: node test/penroom.test.js */
'use strict';
const { createSim, lookAt, INDEX, MAP } = require('./simnet.js');
const G = require('../core/geom.js'), PEN = require('../core/pen.js'), GS = require('../core/gunstats.js'), CFG = require('../core/config.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const evs = (c, k) => c.events.filter(e => e.k === k);
const TORSO = 1.17, EYE = 1.62;

// inside a movement box? (the players must stand in the open)
const blocked = (M, x, z) => M.colliders.some(c => x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4 && c.minY < 1.8 && c.maxY > 0.1);
// two spots on both sides of a penetrable box: the only map surface between A's eye and B's torso is that box
function across(cls, mapId) {
  const M = mapId ? MAP.maps[mapId] : MAP, IX = mapId ? G.createMapIndex(M) : INDEX;
  for (const pb of M.pen || []) {
    if (pb.cls !== cls || pb.cy - pb.hy > 0.9 || pb.cy + pb.hy < 1.75 || pb.cy - pb.hy < -0.2 && false) continue;
    for (const ax of [[1, 0], [0, 1]]) for (const D of [2.5, 3.5]) {
      const c = Math.cos(pb.yaw || 0), s = Math.sin(pb.yaw || 0);
      // the box's local axis (x or z) in the world
      const ux = ax[0] ? c : s, uz = ax[0] ? -s : c, h = ax[0] ? pb.hx : pb.hz;
      const a = [pb.cx - ux * (h + D), pb.cz - uz * (h + D)], b = [pb.cx + ux * (h + D), pb.cz + uz * (h + D)];
      if (blocked(M, a[0], a[1]) || blocked(M, b[0], b[1])) continue;
      const o = [a[0], EYE, a[1]], t = [b[0], TORSO, b[1]];
      const d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]], L = Math.hypot(...d); d[0] /= L; d[1] /= L; d[2] /= L;
      const tr = PEN.through(pb, o[0], o[1], o[2], d[0], d[1], d[2]);
      const mh = G.segMap(IX, o[0], o[1], o[2], d[0], d[1], d[2], L);
      if (!tr || !mh || Math.abs(mh.t - tr.t0) > 0.03 || tr.along > PEN.MAX_ALONG[cls]) continue;
      const g = tr.t1 + 0.005, rest = G.segMap(IX, o[0] + d[0] * g, o[1] + d[1] * g, o[2] + d[2] * g, d[0], d[1], d[2], L - g - 0.4);
      if (rest) continue;
      // nothing else on the ground between them either (the players stand on y = 0)
      if (!G.losClear(IX, a[0], 0.3, a[1], a[0] + ux * 0.6, 0.3, a[1] + uz * 0.6)) continue;
      return { pb, a, b, along: tr.along, mapId };
    }
  }
  return null;
}
function shootThrough(spot, hard) {
  let shoot = false;
  const S = createSim(Object.assign({ latency: 30 }, spot.mapId ? { maps: spot.mapId } : {}));
  const { A, B } = S.setupMatch((c, S) => { const s = S.room.seats.B.p.ms; return Object.assign(lookAt(c, [s.x, s.y + TORSO, s.z]), { fire: shoot, adsHeld: true, hard }); }, () => ({ yaw: 0 }));
  const yawA = Math.atan2(-(spot.b[0] - spot.a[0]), -(spot.b[1] - spot.a[1]));
  S.room.debug.place('A', spot.a[0], spot.a[1], yawA); S.room.debug.place('B', spot.b[0], spot.b[1], -yawA); S.run(400);
  S.run(800); shoot = true; S.run(20); shoot = false; S.run(600);
  return { S, A, B, hit: evs(A, 'hit')[0], shots: evs(A, 'shot').length };
}

console.log('\nPENETRACIÓN EN EL SERVIDOR (PUEBLO)');
check('el mapa del servidor trae las cajas atravesables de la página', Array.isArray(MAP.pen) && MAP.pen.some(p => p.cls === 'thin') && MAP.pen.some(p => p.cls === 'medium'),
  MAP.pen && MAP.pen.length + ' cajas');
const full = GS.dmgAt(CFG.rifles.halcon, 'torso', 6);
{ const sp = across('thin');
  check('hay una caja fina con sitio a los dos lados', !!sp, sp && sp.pb.cx.toFixed(1) + ',' + sp.pb.cz.toFixed(1));
  if (sp) {
    const r = shootThrough(sp, false);
    check('caja fina, sin BALA DURA: el tiro pasa y da al torso con el 75 %', r.hit && r.hit.part === 'torso' && r.hit.dmg === Math.round(full * 0.75) && r.hit.thru === 1,
      r.hit ? r.hit.part + ' ' + r.hit.dmg + ' (entero ' + full + ') thru ' + r.hit.thru : 'sin impacto, ' + r.shots + ' tiros');
  }
}
{ let sp = null; for (const id of [null, 'arena', 'casa', 'casa2', 'barrio']) if (!sp) sp = across('medium', id);
  check('hay una pared media con sitio a los dos lados', !!sp, sp && (sp.mapId || 'pueblo') + ' ' + sp.pb.cx.toFixed(1) + ',' + sp.pb.cz.toFixed(1) + ' recorre ' + sp.along.toFixed(2) + ' m');
  if (sp) {
    const r0 = shootThrough(sp, false);
    check('pared media, sin BALA DURA: la bala se queda en la pared', r0.shots === 1 && !r0.hit && r0.S.room.seats.B.hp === 100, r0.hit ? 'impacto ' + r0.hit.dmg : 'B con ' + r0.S.room.seats.B.hp);
    const r1 = shootThrough(sp, true), want = Math.round(full * PEN.mulMedium(sp.along));
    check('pared media, con BALA DURA: pasa, con el daño según el grosor', r1.hit && r1.hit.part === 'torso' && r1.hit.dmg === want && r1.hit.thru === 1,
      r1.hit ? r1.hit.dmg + ' (esperado ' + want + ', × ' + PEN.mulMedium(sp.along).toFixed(2) + ')' : 'sin impacto');
  }
}
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
