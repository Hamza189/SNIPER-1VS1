/* Measures how the bots really move (same code as the game: core/trainer.js + core/movement.js for the
   training bots; the duel bots' path following is reproduced from page.html: 3.4 m/s between nav nodes).
   For a player watching from 50 m it reports: speed, speed ACROSS the line of sight (what you must lead),
   how often the sideways direction flips, the shortest time between flips, and the biggest change of
   velocity in one tick (an "instant" turn shows up as a huge acceleration).
   node tools/bot-motion-audit.js [seconds]                                          */
'use strict';
const CFG = require('../core/config.js');
const MV = require('../core/movement.js');
const TR = require('../core/trainer.js');
const DT = 1 / CFG.TICK, SECS = +(process.argv[2] || 120);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const AREA = CFG.training.area;
const WORLD = { colliders: [], ramps: [] };
const player = { x: 0, z: AREA.minZ - 10 };   // behind the line, looking down the range

function measure(name, stepFn) {
  const r = rng(12345);
  const st = MV.createState(0, 0, AREA.minZ + 45);
  const speeds = [], lat = [], flips = [];
  let lastSign = 0, lastFlip = 0, maxAcc = 0, pvx = 0, pvz = 0, t = 0, still = 0;
  for (let i = 0; i < SECS / DT; i++) {
    t += DT;
    stepFn(st, r);
    const vx = st.vx, vz = st.vz, sp = Math.hypot(vx, vz);
    // line of sight from the player to the bot, and the sideways direction
    const lx = st.x - player.x, lz = st.z - player.z, ll = Math.hypot(lx, lz) || 1;
    const sideways = (vx * lz - vz * lx) / ll;     // velocity across the line of sight
    speeds.push(sp); lat.push(Math.abs(sideways));
    if (sp < 0.3) still += DT;
    const sg = Math.abs(sideways) > 0.8 ? Math.sign(sideways) : 0;
    if (sg && lastSign && sg !== lastSign) { flips.push(t - lastFlip); lastFlip = t; }
    if (sg) lastSign = sg;
    const acc = Math.hypot(vx - pvx, vz - pvz) / DT; if (i > 10) maxAcc = Math.max(maxAcc, acc); pvx = vx; pvz = vz;
  }
  const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  return { name, vMean: mean(speeds), vP95: pct(speeds, 0.95), latMean: mean(lat), latP90: pct(lat, 0.9), flipsPerMin: flips.length / SECS * 60,
    flipMin: flips.length ? Math.min(...flips) : null, flipMedian: flips.length ? pct(flips, 0.5) : null, maxAcc, stillPct: still / SECS * 100 };
}

const rows = [];
// training bots, free behaviour (the CAMPO DE TIRO's ENTRENAMIENTO levels)
for (const lvl of ['easy', 'normal', 'hard']) {
  const diff = CFG.training[lvl];
  let brain = null;
  rows.push(measure('entrenamiento ' + lvl, (st, r) => {
    brain = brain || TR.createBrain(r);
    const c = TR.think(brain, st, player, AREA, [], diff, DT, r);
    MV.step(st, c, DT, WORLD, CFG.move);
  }));
}
// fixed patterns (core/trainer.js PATTERNS, not yet offered in the menu)
for (const kind of ['walk', 'run', 'strafe']) {
  const b = {};
  rows.push(measure('patrón ' + kind, (st, r) => { const c = TR.pattern(b, st, player, AREA, kind, DT, r); MV.step(st, c, DT, WORLD, CFG.move); }));
}
// duel bots (page.html Bot.update0 'move', reproduced here): walk 3.4 m/s along nav nodes (3 m grid, 8
// directions). OLD = straight to the node, direction changed in one tick; NEW = steering with 9 m/s²
// toward the next node, switching to the following one 0.9 m before (a curve instead of a corner)
for (const smooth of [false, true]) {
  const S = 3; let x = 0, z = AREA.minZ + 45, vx = 0, vz = 0; const path = [];
  const next = (r, px, pz) => { const d = [[S, 0], [-S, 0], [0, S], [0, -S], [S, S], [S, -S], [-S, S], [-S, -S]][Math.floor(r() * 8)];
    let tx = px + d[0], tz = pz + d[1]; if (Math.abs(tx) > 12 || tz < AREA.minZ + 20 || tz > AREA.minZ + 70) { tx = px - d[0]; tz = pz - d[1]; } return [tx, tz]; };
  rows.push(measure('duelo ' + (smooth ? 'AHORA (giro suave)' : 'ANTES (esquinas)'), (st, r) => {
    while (path.length < 3) { const [px, pz] = path.length ? path[path.length - 1] : [x, z]; path.push(next(r, px, pz)); }
    const [tx, tz] = path[0]; const mx = tx - x, mz = tz - z, md = Math.hypot(mx, mz);
    if (!smooth) {
      if (md < 0.25) { path.shift(); return; }
      const sp = Math.min(3.4 * DT, md); vx = mx / md * sp / DT; vz = mz / md * sp / DT;
    } else {
      if (md < 0.9) { path.shift(); return; }
      const tvx = mx / md * 3.4, tvz = mz / md * 3.4, dx = tvx - vx, dz = tvz - vz, d = Math.hypot(dx, dz), m = 9 * DT;
      if (d <= m) { vx = tvx; vz = tvz; } else { vx += dx / d * m; vz += dz / d * m; }
    }
    x += vx * DT; z += vz * DT; st.x = x; st.z = z; st.vx = vx; st.vz = vz;
  }));
}
console.log('\nMOVIMIENTO REAL DE LOS BOTS (' + SECS + ' s simulados por fila; jugador mirando desde detrás de la línea)');
console.log('jugador: andar ' + CFG.move.walk + ' m/s, correr ' + CFG.move.sprint + ' m/s, apuntando ' + (CFG.move.walk * CFG.move.adsMul) + ' m/s\n');
console.log('fila                     v media  v p95  lateral media  lateral p90  cambios/min  mín entre cambios  mediana  acel. máx   quieto');
for (const r of rows) console.log(r.name.padEnd(24), r.vMean.toFixed(2).padStart(6), r.vP95.toFixed(2).padStart(6), r.latMean.toFixed(2).padStart(13), r.latP90.toFixed(2).padStart(12),
  r.flipsPerMin.toFixed(1).padStart(12), (r.flipMin == null ? '-' : r.flipMin.toFixed(2) + ' s').padStart(18), (r.flipMedian == null ? '-' : r.flipMedian.toFixed(2) + ' s').padStart(8), (r.maxAcc.toFixed(0) + ' m/s²').padStart(11), (r.stillPct.toFixed(0) + ' %').padStart(8));
// how much you must lead (bullet: 600 m/s, slightly longer flight with the drop)
const v0 = CFG.rifles.halcon.speed;
console.log('\nADELANTO NECESARIO (vuelo de la bala ' + v0 + ' m/s) — cm a lo ancho; anchura del torso 44 cm, cabeza 30 cm');
console.log('dist     t vuelo   2,4 m/s (agachado)  3,4 m/s (bot duelo)  4,6 m/s (andar)  7,0 m/s (correr)');
for (const d of [25, 50, 75, 100]) { const t = d / v0; console.log((d + ' m').padEnd(8), (t * 1000).toFixed(0).padStart(5) + ' ms', ...[2.4, 3.4, 4.6, 7].map(v => (v * t * 100).toFixed(0).padStart(v === 2.4 ? 14 : 17) + ' cm')); }
if (require.main === module && process.env.JSON) require('fs').writeFileSync(process.env.JSON, JSON.stringify(rows, null, 1));
module.exports = { rows };
