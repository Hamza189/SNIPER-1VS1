/* Phase 2A tests: weapon switching, knife, melee resolution, rifle interactions, training bots.
   Pure core only (no browser). Run: node test/phase2.test.js */
'use strict';
const CFG = require('../core/config.js');
const M = require('../core/movement.js');
const W = require('../core/weapon.js');
const ME = require('../core/melee.js');
const TR = require('../core/trainer.js');

let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const DT = 1 / CFG.TICK, kc = CFG.knives.tactica, lc = CFG.loadout, rc = CFG.rifles.halcon, mc = CFG.move;
const cmd = o => Object.assign({ select: null, attack: false, inspect: false }, o);
function runL(L, seconds, c, onEv) { let t = 0; const n = Math.round(seconds / DT); for (let i = 0; i < n; i++) { const ev = ME.tickLoadout(L, typeof c === 'function' ? c(t) : (c || cmd({})), DT); t += DT; if (onEv) ev.forEach(e => onEv(e, t)); } }
// a fresh rifle that is already raised
function readyRifle() { const w = W.createState(rc); for (let i = 0; i < 70; i++) W.tick(w, {}, DT, { sprinting: false, alive: true }); return w; }
// runs loadout + rifle together like the game does each tick
function both(L, w, seconds, inFn, onEv) {
  let t = 0; const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    const inp = inFn ? inFn(t) : {};
    const lev = ME.tickLoadout(L, cmd({ select: inp.select, attack: inp.attack && L.active === 'knife', inspect: inp.inspect }), DT);
    const wev = W.tick(w, { fire: inp.fire && L.active === 'rifle', ads: inp.ads, reload: inp.reload }, DT, { sprinting: false, alive: true, holstered: ME.rifleHolstered(L) });
    t += DT; if (onEv) { lev.forEach(e => onEv(e, t)); wev.forEach(e => onEv(e, t)); }
  }
}

console.log('\nCAMBIO DE ARMA');
{ const L = ME.createLoadout(kc, lc); let drawnAt = -1;
  runL(L, 1, t => cmd({ select: t < DT ? 'knife' : null }), (e, t) => { if (e.type === 'drawn' && drawnAt < 0) drawnAt = t; });
  check('rifle → navaja: guardar rifle + sacar navaja', Math.abs(drawnAt - (lc.rifleHolster + kc.draw)) < DT * 2, drawnAt.toFixed(3) + ' s');
  check('navaja equipada', L.active === 'knife' && L.phase === 'ready');
  check('con navaja, +8 % de velocidad', Math.abs(ME.speedMul(L) - 1.08) < 1e-9);
  drawnAt = -1;
  runL(L, 1, t => cmd({ select: t < DT ? 'rifle' : null }), (e, t) => { if (e.type === 'drawn' && drawnAt < 0) drawnAt = t; });
  check('navaja → rifle: guardar navaja + sacar rifle', Math.abs(drawnAt - (kc.holster + lc.rifleDraw)) < DT * 2, drawnAt.toFixed(3) + ' s');
  check('con rifle la velocidad es normal', ME.speedMul(L) === 1);
  // pressing the same weapon does nothing
  let evs = 0; runL(L, 0.5, cmd({ select: 'rifle' }), () => evs++);
  check('pulsar el arma que ya tienes no hace nada', evs === 0 && L.phase === 'ready');
  // change of mind halfway
  runL(L, 0.05, t => cmd({ select: t < DT ? 'knife' : null }));
  runL(L, 1, t => cmd({ select: t < DT ? 'rifle' : null }));
  check('cambiar de idea a mitad de cambio acaba con el arma pedida', L.active === 'rifle' && L.phase === 'ready');
}
{ // movement speed with knife, through the real movement module
  const s = M.createState(), base = M.createState();
  for (let i = 0; i < 120; i++) { M.step(s, { mz: -1, yaw: 0, speedMul: 1.08 }, DT, { colliders: [], ramps: [] }, mc); M.step(base, { mz: -1, yaw: 0 }, DT, { colliders: [], ramps: [] }, mc); }
  check('velocidad real con navaja = andar × 1,08', Math.abs(Math.hypot(s.vx, s.vz) - mc.walk * 1.08) < 0.01, Math.hypot(s.vx, s.vz).toFixed(2) + ' vs ' + Math.hypot(base.vx, base.vz).toFixed(2));
}

console.log('\nNAVAJA');
{ const L = ME.createLoadout(kc, lc); runL(L, 1, t => cmd({ select: t < DT ? 'knife' : null }));
  let swings = [], hits = [];
  runL(L, 2, cmd({ attack: true }), (e, t) => { if (e.type === 'swing') swings.push(t); if (e.type === 'knifeHit') hits.push(t); });
  const gaps = swings.slice(1).map((t, i) => t - swings[i]);
  check('ataque manteniendo pulsado: un golpe cada 0,40 s', gaps.length >= 3 && gaps.every(g => Math.abs(g - kc.interval) < DT * 1.5), gaps.map(g => g.toFixed(3)).join(' '));
  check('cada golpe comprueba el impacto una sola vez, a los 0,12 s', hits.length === swings.length && hits.every((h, i) => Math.abs(h - swings[i] - kc.hitAt) < DT * 1.5), hits.length + ' comprobaciones');
  const sides = []; const L2 = ME.createLoadout(kc, lc); runL(L2, 1, t => cmd({ select: t < DT ? 'knife' : null }));
  runL(L2, 1.3, cmd({ attack: true }), e => { if (e.type === 'swing') sides.push(e.side); });
  check('golpes alternos (derecha / revés)', sides.length >= 3 && sides.every((s, i) => i === 0 || s === -sides[i - 1]), sides.join(','));
}
{ const L = ME.createLoadout(kc, lc); let swung = false;
  runL(L, 0.25, t => cmd({ select: t < DT ? 'knife' : null, attack: true }), e => { if (e.type === 'swing') swung = true; });
  check('no se puede atacar mientras se saca la navaja', !swung);
  let swingAt = -1; runL(L, 0.5, t => cmd({ attack: t < DT }), (e, t) => { if (e.type === 'swing' && swingAt < 0) swingAt = t; });
  check('un clic 0,1 s antes de estar lista se guarda y ataca al estar lista', swingAt > 0 && swingAt <= 0.1 + DT * 2, swingAt.toFixed(3) + ' s');
}
{ const L = ME.createLoadout(kc, lc); runL(L, 1, t => cmd({ select: t < DT ? 'knife' : null }));
  let insp = false, swung = false;
  runL(L, 0.3, t => cmd({ inspect: t < DT }), e => { if (e.type === 'inspect') insp = true; });
  check('F inspecciona la navaja', insp && L.knife.state === 'inspect');
  runL(L, 0.1, t => cmd({ attack: t < DT }), e => { if (e.type === 'swing') swung = true; });
  check('atacar cancela la inspección al instante', swung && L.knife.state === 'attack');
  runL(L, 1, cmd({}));
  const L3 = ME.createLoadout(kc, lc); let i3 = false; runL(L3, 0.2, t => cmd({ inspect: true }), e => { if (e.type === 'inspect') i3 = true; });
  check('con el rifle, F no hace nada', !i3);
}
{ const L = ME.createLoadout(kc, lc); runL(L, 1, t => cmd({ select: t < DT ? 'knife' : null }));
  let hit = false; runL(L, 0.06, cmd({ attack: true }));
  runL(L, 0.4, t => cmd({ select: t < DT ? 'rifle' : null }), e => { if (e.type === 'knifeHit') hit = true; });
  check('cambiar de arma a mitad de un golpe lo cancela (sin daño fantasma)', !hit && L.active === 'rifle');
}

console.log('\nRIFLE + CAMBIO DE ARMA');
{ const L = ME.createLoadout(kc, lc), w = readyRifle(); let fires = [];
  // shoot, swap to knife and straight back, keep pulling the trigger
  both(L, w, 2, t => ({ fire: true, select: t > 0.02 && t < 0.03 ? 'knife' : (t > 0.4 && t < 0.41 ? 'rifle' : null) }), (e, t) => { if (e.type === 'fire') fires.push(t); });
  check('cambiar de arma no permite saltarse el cerrojo', fires.length >= 2 && fires[1] - fires[0] >= rc.bolt - DT, fires.length >= 2 ? (fires[1] - fires[0]).toFixed(3) + ' s entre disparos (cerrojo ' + rc.bolt + ' s)' : fires.length + ' disparos');
}
{ const L = ME.createLoadout(kc, lc), w = readyRifle(); let fires = 0;
  both(L, w, 0.02, () => ({ fire: true }), e => { if (e.type === 'fire') fires++; });
  both(L, w, 0.5, t => ({ select: t < DT ? 'knife' : null }));
  const boltT = w.t, st = w.state;
  both(L, w, 0.5, () => ({}));
  check('el cerrojo sigue su ciclo con la navaja en la mano (no se reinicia)', st === 'bolt' && (w.state === 'ready' || w.t > boltT), st + ' → ' + w.state);
}
{ const L = ME.createLoadout(kc, lc), w = readyRifle(); let magIn = -1, t0 = 0;
  // empty-ish: fire once then manual reload
  both(L, w, 0.02, () => ({ fire: true }));
  both(L, w, 1.0, () => ({}));
  both(L, w, 0.02, () => ({ reload: true }));
  both(L, w, 1.0, () => ({}));                       // 1 s into the reload
  const progressBefore = w.t;
  both(L, w, 2.0, t => ({ select: t < DT ? 'knife' : null }));   // 2 s with the knife out
  const progressWhileKnife = w.t, ammoWhileKnife = w.ammo;
  check('la recarga se pausa en cuanto empiezas a guardar el rifle (no avanza, no se completa)', Math.abs(progressWhileKnife - progressBefore) < DT * 2 && ammoWhileKnife === rc.mag - 1, 'progreso ' + progressBefore.toFixed(2) + ' → ' + progressWhileKnife.toFixed(2) + ' s');
  let t = 0;
  both(L, w, 3, tt => ({ select: tt < DT ? 'rifle' : null }), (e, tt) => { if (e.type === 'magIn' && magIn < 0) magIn = tt; });
  const remaining = rc.reload * rc.reloadKeys.magIn[1] - progressWhileKnife;
  check('al volver al rifle la recarga continúa donde estaba (no se reinicia)', magIn > 0 && Math.abs(magIn - (kc.holster + lc.rifleDraw + remaining)) < DT * 3, 'cargador dentro a los ' + magIn.toFixed(2) + ' s');
  check('la recarga termina con el cargador lleno', w.ammo === rc.mag);
}
{ const L = ME.createLoadout(kc, lc), w = readyRifle();
  both(L, w, 1, t => ({ select: t < DT ? 'knife' : null, ads: true }));
  check('con la navaja no se puede usar la mira', w.ads === 0);
  let fired = false; both(L, w, 0.3, () => ({ fire: true }), e => { if (e.type === 'fire') fired = true; });
  check('con la navaja el rifle no dispara', !fired);
  let earliest = -1;
  both(L, w, 1, t => ({ select: t < DT ? 'rifle' : null, fire: true }), (e, t) => { if (e.type === 'fire' && earliest < 0) earliest = t; });
  check('al volver al rifle solo dispara cuando está completamente sacado', earliest >= kc.holster + lc.rifleDraw - DT, earliest.toFixed(3) + ' s');
}

console.log('\nGOLPE CUERPO A CUERPO');
const att = (x, z, fx, fz) => ({ x, z, eyeY: 1.62, fx, fz });
const tgt = (x, z, fx, fz, extra) => Object.assign({ ref: 'T', x, z, y0: 0, y1: 1.8, radius: 0.3, fx, fz }, extra || {});
{ // attacker at origin looking -z (fx=0,fz=-1)
  check('alcance: objetivo a 2,2 m (cuerpo a 1,9 m) → impacta', !!ME.resolve(att(0, 0, 0, -1), [tgt(0, -2.2, 0, 1)], kc));
  check('alcance: objetivo a 2,4 m (cuerpo a 2,1 m) → no llega', !ME.resolve(att(0, 0, 0, -1), [tgt(0, -2.4, 0, 1)], kc));
  check('fuera del cono frontal (de lado a 1,5 m) → no impacta', !ME.resolve(att(0, 0, 0, -1), [tgt(1.5, -0.3, 0, 1)], kc));
  check('pegado (0,7 m) el cono se abre → impacta aunque esté a un lado', !!ME.resolve(att(0, 0, 0, -1), [tgt(0.5, -0.45, 0, 1)], kc));
  check('detrás de ti → no impacta', !ME.resolve(att(0, 0, 0, -1), [tgt(0, 1.2, 0, 1)], kc));
  const front = ME.resolve(att(0, 0, 0, -1), [tgt(0, -1.5, 0, 1)], kc);
  check('de frente: 50 de daño', front && !front.back && front.damage === 50);
  const back = ME.resolve(att(0, 0, 0, -1), [tgt(0, -1.5, 0, -1)], kc);
  check('por la espalda: 100 de daño', back && back.back && back.damage === 100);
  // same positions, only the target's orientation changes
  const side = ME.resolve(att(0, 0, 0, -1), [tgt(0, -1.5, 1, 0)], kc);
  check('espalda decidida por la orientación del objetivo, no por su posición (de lado = frontal)', side && !side.back && side.damage === 50);
  const angled = ME.resolve(att(0, 0, 0, -1), [tgt(0, -1.5, Math.sin(0.9), -Math.cos(0.9))], kc);
  check('espalda con el objetivo girado 52° → sigue siendo por la espalda', angled && angled.back);
  const twoT = ME.resolve(att(0, 0, 0, -1), [tgt(0, -1.9, 0, 1, { ref: 'lejos' }), tgt(0.1, -1.0, 0, 1, { ref: 'cerca' })], kc);
  check('con dos objetivos golpea al más cercano', twoT && twoT.target.ref === 'cerca');
  check('una pared en medio bloquea el golpe', !ME.resolve(att(0, 0, 0, -1), [tgt(0, -1.5, 0, 1)], kc, () => false));
  check('objetivo muy por debajo (otra planta) → no impacta', !ME.resolve(att(0, 0, 0, -1), [tgt(0, -1.5, 0, 1, { y0: -3, y1: -1.2 })], kc));
}

console.log('\nPOSES DE LA NAVAJA');
{ const cont = (f, args) => { let mx = 0, prev = f(0, ...args); for (let p = 0.002; p <= 1.0001; p += 0.002) { const q = f(Math.min(p, 1), ...args); for (const k of ['x', 'y', 'z', 'rx', 'ry', 'rz']) mx = Math.max(mx, Math.abs(q[k] - prev[k])); if (q.twirl !== undefined) mx = Math.max(mx, Math.abs(Math.sin(q.twirl) - Math.sin(prev.twirl)), Math.abs(Math.cos(q.twirl) - Math.cos(prev.twirl))); prev = q; } return mx; };
  const atRest = o => ['x', 'y', 'z', 'rx', 'ry', 'rz'].every(k => Math.abs(o[k]) < 1e-6);
  check('golpe: empieza y acaba en reposo', atRest(ME.slashPose(0, 1)) && atRest(ME.slashPose(1, 1)) && atRest(ME.slashPose(1, -1)));
  check('golpe: movimiento continuo', cont(ME.slashPose, [1]) < 0.06, cont(ME.slashPose, [1]).toFixed(4));
  check('sacar navaja: acaba en reposo y es continuo', atRest(ME.drawPose(1)) && cont(ME.drawPose, []) < 0.03);
  const ip = ME.inspectPose(1);
  check('inspección: acaba en reposo y es continua', atRest(ip) && Math.abs(Math.sin(ip.twirl)) < 1e-6 && cont(ME.inspectPose, []) < 0.07, cont(ME.inspectPose, []).toFixed(4));
}

console.log('\nBOTS DE ENTRENAMIENTO');
// the shooting range layout (same numbers as src/page.html)
const L0 = 62, box = (x, z, w, d, h) => ({ minX: x - w / 2, minY: 0, minZ: z - d / 2, maxX: x + w / 2, maxY: h, maxZ: z + d / 2 });
const RANGE = { colliders: [
  box(-17.5, 114, 1, 124, 5), box(17.5, 114, 1, 124, 5), box(0, 176.5, 36, 1, 7), box(0, 173.5, 34, 3, 2.5), box(0, L0, 10, 0.8, 1.05),
  box(-12, 60, 6, 6, 3), box(6, L0 + 48, 3, 0.8, 1.05), box(-11, L0 + 33, 1.2, 1.2, 1.2), box(12, L0 + 78, 1.2, 1.2, 2.4), box(-5, L0 + 97, 4, 0.8, 1.05),
  box(-6, L0 + 20, 0.4, 0.3, 1.8), box(7, L0 + 100, 0.4, 0.3, 1.8)  // two static dummies as obstacles
], ramps: [] };
const COVERS = [{ x: 6, z: L0 + 48 }, { x: -11, z: L0 + 33 }, { x: 12, z: L0 + 78 }, { x: -5, z: L0 + 97 }];
function lcg(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
for (const level of ['easy', 'normal', 'hard']) {
  const diff = CFG.training[level], area = CFG.training.area, rnd = lcg(level.length * 97);
  const bots = [];
  for (let i = 0; i < diff.count; i++) { const s = M.createState(area.minX + 2 + rnd() * 26, 0, area.minZ + 4 + rnd() * 90); bots.push({ s, b: TR.createBrain(rnd), stuck: 0, maxStuck: 0, dist: 0, slides: 0, crouch: 0, outside: 0, nan: false }); }
  const player = { x: 2, z: 57.5 };
  const seconds = 120, n = seconds / DT;
  for (let i = 0; i < n; i++) {
    for (const o of bots) {
      if (i % 600 === 0 && i > 0 && rnd() < 0.3) o.b.hurt = true;               // as if shot now and then
      const c = TR.think(o.b, o.s, player, area, COVERS, diff, DT, rnd);
      const x0 = o.s.x, z0 = o.s.z;
      const ev = M.step(o.s, c, DT, RANGE, mc);
      ev.forEach(e => { if (e.type === 'slideStart') o.slides++; });
      if (o.s.crouch) o.crouch++;
      const moved = Math.hypot(o.s.x - x0, o.s.z - z0); o.dist += moved;
      const wants = Math.hypot(c.mx, c.mz) > 0.3;
      if (wants && moved < 0.3 * DT && !c.crouch) o.stuck += DT; else o.stuck = 0;
      o.maxStuck = Math.max(o.maxStuck, o.stuck);
      if (o.s.x < area.minX - 1.5 || o.s.x > area.maxX + 1.5 || o.s.z < area.minZ - 3 || o.s.z > area.maxZ + 3) o.outside++;
      if (!isFinite(o.s.x + o.s.z + o.s.y)) o.nan = true;
    }
  }
  const avgSpeed = bots.reduce((a, o) => a + o.dist, 0) / bots.length / seconds;
  check(level + ': ' + bots.length + ' bots, 2 min sin salirse de la zona', bots.every(o => o.outside === 0), bots.map(o => o.outside).join(','));
  check(level + ': ningún bot se queda atascado más de 1 s', bots.every(o => o.maxStuck < 1), 'máx ' + Math.max(...bots.map(o => o.maxStuck)).toFixed(2) + ' s');
  check(level + ': sin valores inválidos', bots.every(o => !o.nan));
  const sl = bots.reduce((a, o) => a + o.slides, 0);
  if (level === 'easy') check('fácil: se mueven despacio y sin slides', avgSpeed < 3.2 && sl === 0, avgSpeed.toFixed(2) + ' m/s de media, ' + sl + ' slides');
  if (level === 'hard') check('difícil: más rápidos y con slides', avgSpeed > 3.5 && sl > 3, avgSpeed.toFixed(2) + ' m/s de media, ' + sl + ' slides');
  if (level === 'normal') check('normal: velocidad intermedia', avgSpeed > 2.5, avgSpeed.toFixed(2) + ' m/s de media');
}
{ // toLocal round-trip
  let mx = 0; for (let k = 0; k < 50; k++) { const yaw = k * 0.37, a = k * 0.91, wx = Math.cos(a), wz = Math.sin(a);
    const l = TR.toLocal(wx, wz, yaw); const s = M.createState(); M.step(s, { mx: l.mx, mz: l.mz, yaw }, DT, { colliders: [], ramps: [] }, mc);
    const vl = Math.hypot(s.vx, s.vz); mx = Math.max(mx, Math.abs(s.vx / vl - wx) + Math.abs(s.vz / vl - wz)); }
  check('la IA traduce bien su dirección a controles de jugador', mx < 1e-6, mx.toExponential(1));
}

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
