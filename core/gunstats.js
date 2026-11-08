/* SNIPER DUEL — estadísticas de las armas: UNA sola fuente (08-11-2026, GUNSMITH, docs/GUNSMITH.md).
   - dmgAt: el daño de un impacto según la zona y la distancia. Es la cuenta del servidor (antes vivía dentro de
     core/room.js y repetida dos veces en la página para las partidas contra bots): ahora la usan los dos y el ARSENAL.
   - flight: dónde va la bala a una distancia, con la balística de las balas de verdad (core/weapon.js: misma velocidad,
     gravedad y puesta a cero; el cañón sube zeroLift sobre la línea de mira), paso a paso como en el servidor.
   - sheet: lo que enseña el ARSENAL (pestañas ESTADÍSTICAS y DAÑO), sacado de core/config.js. Nada inventado: si un
     valor no existe en el juego, no sale.
   Puro (Node y navegador). */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const CFG = isNode ? require('./config.js') : root.SD_CONFIG;
const Wp = isNode ? require('./weapon.js') : root.SDWeapon;
const HP = 100;            // vida de un jugador (core/room.js RULES.hp; el juego contra bots usa la misma)
const STEP = 1 / CFG.TICK; // el paso de las balas del servidor (core/config.js TICK)
const PARTS = ['head', 'torso', 'legs'];

// daño de un impacto: × 1 hasta falloff.from, baja en línea recta hasta × falloff.min en falloff.to (el rifle no tiene caída)
function dmgAt(gun, part, dist) {
  const f = gun.falloff; let k = 1;
  if (f) k = dist <= f.from ? 1 : dist >= f.to ? f.min : 1 - (1 - f.min) * (dist - f.from) / (f.to - f.from);
  return Math.round(gun.dmg[part] * k);
}
// la bala a d metros por la línea de mira: altura respecto a la retícula (m, + por encima) y tiempo de vuelo (s);
// null si no llega (más allá de maxRange)
function flight(gun, d) {
  if (d > (gun.maxRange || Infinity)) return null;
  const th = Wp.zeroLift(gun), b = Wp.createBullet(0, 0, 0, Math.cos(th), Math.sin(th), 0, gun);
  let px = 0, py = 0, pt = 0;
  for (let i = 0; i < 100000 && b.x < d; i++) { px = b.x; py = b.y; pt = b.age; Wp.stepBullet(b, STEP, gun); }
  const k = (d - px) / Math.max(1e-9, b.x - px);
  return { y: py + (b.y - py) * k, t: pt + (b.age - pt) * k };
}
const shotsToKill = dmg => dmg > 0 ? Math.ceil(HP / dmg) : Infinity;
// la tabla de daño a varias distancias (las que existen para esa arma: hasta su alcance máximo)
function table(gun, dists) {
  return (dists || [10, 50, 100, 200, 300, 450]).filter(d => d <= (gun.maxRange || Infinity)).map(d => {
    const r = { d }, f = flight(gun, d);
    for (const p of PARTS) { r[p] = dmgAt(gun, p, d); r[p + 'Shots'] = shotsToKill(r[p]); }
    r.dropCm = f ? Math.round(-f.y * 100) || 0 : null; r.ms = f ? Math.round(f.t * 1000) : null;
    return r;
  });
}
// la ficha de un arma de fuego (rifle, escopeta o pistola de core/config.js) y la del movimiento (igual con todas)
function sheet(gun) {
  const M = CFG.move;
  return {
    name: gun.name, dmg: { head: gun.dmg.head, torso: gun.dmg.torso, legs: gun.dmg.legs }, pellets: gun.pellets || 1,
    rpm: Math.round(60 / gun.bolt), bolt: gun.bolt, mag: gun.mag, reload: gun.reload, ads: gun.adsTime,
    speed: gun.speed, gravity: gun.gravity, zero: gun.zero, maxRange: gun.maxRange, falloff: gun.falloff || null,
    hipSpread: gun.hipSpread, moveMul: gun.moveMul || 1,
    walk: +(M.walk * (gun.moveMul || 1)).toFixed(2), sprint: +(M.sprint * (gun.moveMul || 1)).toFixed(2), adsWalk: +(M.walk * (gun.moveMul || 1) * M.adsMul).toFixed(2),
    hp: HP, table: table(gun)
  };
}
// la del cuchillo
function knifeSheet(k) {
  const M = CFG.move;
  return { name: k.name, front: k.dmgFront, back: k.dmgBack, range: k.range, interval: k.interval, rpm: Math.round(60 / k.interval),
    moveMul: k.moveMul || 1, walk: +(M.walk * (k.moveMul || 1)).toFixed(2), sprint: +(M.sprint * (k.moveMul || 1)).toFixed(2),
    hits: { front: shotsToKill(k.dmgFront), back: shotsToKill(k.dmgBack) }, hp: HP };
}

const SDGunStats = { HP, PARTS, dmgAt, flight, table, sheet, knifeSheet, shotsToKill };
if (isNode) module.exports = SDGunStats; else root.SDGunStats = SDGunStats;
})(typeof window !== 'undefined' ? window : globalThis);
