/* Automated tests for the pure game core. Run: node test/core.test.js */
'use strict';
const CFG = require('../core/config.js');
const M = require('../core/movement.js');
const W = require('../core/weapon.js');

let pass = 0, fail = 0;
function check(name, cond, info) {
  if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); }
  else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); }
}
const mc = CFG.move, rc = CFG.rifles.halcon, DT = 1 / CFG.TICK;
const EMPTY = { colliders: [], ramps: [] };
const cmd = o => Object.assign({ mx: 0, mz: 0, yaw: 0, sprint: false, crouch: false, crouchPressed: false, jump: false, ads: 0, reloading: false }, o);
function run(s, c, seconds, world, onEv) {
  const n = Math.round(seconds / DT); let t = 0;
  for (let i = 0; i < n; i++) { const ev = M.step(s, typeof c === 'function' ? c(t) : c, DT, world || EMPTY, mc); t += DT; if (onEv) ev.forEach(e => onEv(e, t)); }
}
const hs = s => Math.hypot(s.vx, s.vz);

console.log('\nMOVIMIENTO');
{ const s = M.createState(); let t95 = -1, t = 0;
  for (let i = 0; i < 120; i++) { M.step(s, cmd({ mz: -1 }), DT, EMPTY, mc); t += DT; if (t95 < 0 && hs(s) >= mc.walk * 0.95) t95 = t; }
  check('andar: alcanza velocidad en < 0,15 s', t95 > 0 && t95 < 0.15, t95.toFixed(3) + ' s');
  check('andar: velocidad máxima = walk', Math.abs(hs(s) - mc.walk) < 0.01, hs(s).toFixed(2));
  check('andar hacia delante con yaw 0 va hacia -z', s.vz < -4 && Math.abs(s.vx) < 1e-6);
  let ts = -1; t = 0;
  for (let i = 0; i < 60; i++) { M.step(s, cmd({}), DT, EMPTY, mc); t += DT; if (ts < 0 && hs(s) < 0.01) ts = t; }
  check('soltar: se para en < 0,12 s', ts > 0 && ts < 0.12, ts.toFixed(3) + ' s');
}
{ const s = M.createState(); run(s, cmd({ mz: -1, sprint: true }), 1);
  check('sprint: velocidad = sprint', Math.abs(hs(s) - mc.sprint) < 0.01 && s.sprinting, hs(s).toFixed(2));
  run(s, cmd({ mz: -1 }), 0.1);
  check('soltar sprint: la inercia baja suave (no corte brusco)', hs(s) > mc.walk + 0.5, hs(s).toFixed(2) + ' m/s tras 0,1 s');
  run(s, cmd({ mz: -1 }), 0.4);
  check('soltar sprint: acaba a velocidad de andar', Math.abs(hs(s) - mc.walk) < 0.01, hs(s).toFixed(2));
}
{ const s = M.createState(); run(s, cmd({ mx: 1 }), 0.5); const v0 = s.vx; let t = 0, flip = -1;
  for (let i = 0; i < 60; i++) { M.step(s, cmd({ mx: -1 }), DT, EMPTY, mc); t += DT; if (flip < 0 && s.vx <= -mc.walk * 0.9) flip = t; }
  check('cambio de dirección (strafe) en < 0,25 s', v0 > 4 && flip > 0 && flip < 0.25, flip.toFixed(3) + ' s');
}
{ const s = M.createState(); run(s, cmd({ mz: -1, sprint: true, ads: 1 }), 0.6);
  check('con mira no se puede esprintar', !s.sprinting && hs(s) <= mc.walk * mc.adsMul + 0.01, hs(s).toFixed(2));
}
{ const s = M.createState(); let maxY = 0, air = 0, landed = false;
  M.step(s, cmd({ jump: true }), DT, EMPTY, mc);
  for (let i = 0; i < 240 && !landed; i++) { M.step(s, cmd({}), DT, EMPTY, mc); air += DT; maxY = Math.max(maxY, s.y); if (s.onGround) landed = true; }
  check('salto: altura ~1 m (sube a cajas de 1,2 m)', maxY > 0.85 && maxY < 1.1, maxY.toFixed(2) + ' m');
  check('salto: tiempo en el aire < 0,7 s (no flotante)', air < 0.7, air.toFixed(3) + ' s');
}
{ const s = M.createState(); let jumped = false; s.onGround = true;
  M.step(s, cmd({}), DT, EMPTY, mc); s.y = 0.3; s.onGround = true; // stand on air: simulate walking off a ledge
  const ledge = { colliders: [], ramps: [] };
  M.step(s, cmd({}), DT, ledge, mc); // now airborne
  run(s, cmd({}), 0.05, ledge);
  M.step(s, cmd({ jump: true }), DT, ledge, mc, ); if (s.vy > 5) jumped = true;
  check('coyote time: se puede saltar 0,06 s después de caer de un borde', jumped);
}
{ const s = M.createState(); s.y = 0.2; s.onGround = false; s.vy = -2; let jumpedOnLand = false;
  run(s, t => cmd({ jump: t < DT }), 0.25, EMPTY, e => { if (e.type === 'jump') jumpedOnLand = true; });
  check('jump buffer: pulsar salto justo antes de aterrizar salta al tocar suelo', jumpedOnLand);
}
{ const s = M.createState(); run(s, cmd({ mz: -1, sprint: true }), 1);
  const v0 = hs(s); let started = null, ended = null, dist = 0; const x0 = s.z;
  run(s, t => cmd({ mz: -1, sprint: true, crouch: true, crouchPressed: t < DT }), 1.5, EMPTY, (e, t) => { if (e.type === 'slideStart') started = e.speed; if (e.type === 'slideEnd' && ended === null) ended = t; });
  dist = Math.abs(s.z - x0);
  check('slide: empieza al agacharse esprintando', started !== null, started && started.toFixed(2) + ' m/s');
  check('slide: conserva y suma velocidad inicial', started > v0, v0.toFixed(2) + ' → ' + (started || 0).toFixed(2));
  check('slide: dura entre 0,7 y 1,15 s', ended > 0.7 && ended <= mc.slideMaxTime + 0.01, ended && ended.toFixed(3) + ' s');
  check('slide: recorre 5-9 m', dist > 5 && dist < 9.5, dist.toFixed(2) + ' m (incluye el tramo agachado)');
  check('slide: acaba agachado a velocidad baja', s.crouch && !s.sliding && hs(s) <= mc.crouch + 0.01, hs(s).toFixed(2));
}
{ const s = M.createState(); run(s, cmd({ mz: -1, sprint: true }), 1); let speeds = [];
  run(s, t => cmd({ mz: -1, crouch: true, crouchPressed: t < DT }), 0.6, EMPTY, null);
  // sample deceleration smoothness
  const a = M.createState(); run(a, cmd({ mz: -1, sprint: true }), 1);
  let prev = null, maxJump = 0;
  run(a, t => cmd({ mz: -1, crouch: true, crouchPressed: t < DT }), 1.2, EMPTY, null);
  const b = M.createState(); run(b, cmd({ mz: -1, sprint: true }), 1);
  for (let i = 0; i < 150; i++) { M.step(b, cmd({ mz: -1, crouch: true, crouchPressed: i === 0 }), DT, EMPTY, mc); const v = hs(b); if (prev !== null && i > 0) maxJump = Math.max(maxJump, Math.abs(v - prev)); prev = v; }
  check('slide: la velocidad cae de forma gradual (sin saltos)', maxJump < 0.12, 'máx cambio por tick ' + maxJump.toFixed(3) + ' m/s');
}
{ const s = M.createState(); run(s, cmd({ mz: -1, sprint: true }), 1);
  let endT = null;
  run(s, t => cmd({ mz: -1, crouch: t < 0.3, crouchPressed: t < DT }), 0.5, EMPTY, (e, t) => { if (e.type === 'slideEnd' && endT === null) endT = t; });
  check('slide: soltar agacharse lo cancela (control)', endT !== null && endT < 0.32, endT && endT.toFixed(3) + ' s');
}
{ const s = M.createState(); run(s, cmd({ mz: -1, sprint: true }), 1);
  run(s, t => cmd({ mz: -1, crouch: true, crouchPressed: t < DT }), 0.25);
  const sp = hs(s); let jumped = false;
  run(s, t => cmd({ mz: -1, crouch: true, jump: t < DT }), 0.05, EMPTY, e => { if (e.type === 'jump') jumped = true; });
  check('slide-jump: salta conservando velocidad (con tope)', jumped && hs(s) > mc.walk && hs(s) <= mc.slideJumpCap + 0.01, sp.toFixed(2) + ' → ' + hs(s).toFixed(2));
}
{ const s = M.createState(); run(s, cmd({ mz: -1, sprint: true }), 1); let n = 0;
  run(s, t => cmd({ mz: -1, sprint: true, crouch: t % 0.3 < 0.15, crouchPressed: (t % 0.3) < DT }), 1.2, EMPTY, e => { if (e.type === 'slideStart') n++; });
  check('slide: el cooldown impide encadenar slides sin parar', n <= 2, n + ' slides en 1,2 s');
}
{ const s = M.createState(); run(s, cmd({ mx: 0.3, mz: -1, sprint: true }), 1);
  const ang0 = Math.atan2(s.vx, -s.vz);
  run(s, t => cmd({ mx: 1, mz: -1, crouch: true, crouchPressed: t < DT }), 0.4);
  const ang1 = Math.atan2(s.vx, -s.vz);
  check('slide: girar a la derecha desvía la trayectoria a la derecha', ang1 > ang0 + 0.2, (ang0 * 57.3).toFixed(0) + '° → ' + (ang1 * 57.3).toFixed(0) + '°');
}
{ const s = M.createState(); s.y = 4; s.onGround = false; s.vy = -12; s.vz = -6; let imp = 0;
  run(s, cmd({ mz: -1 }), 0.4, EMPTY, e => { if (e.type === 'land') imp = e.impact; });
  check('aterrizaje fuerte: genera evento con impacto', imp > 10, imp.toFixed(1) + ' m/s');
}
{ // jump in the air: strafe input cannot add speed beyond take-off speed
  const s = M.createState(); run(s, cmd({ mz: -1 }), 0.5); M.step(s, cmd({ mz: -1, jump: true }), DT, EMPTY, mc);
  let maxV = 0; run(s, cmd({ mx: 1, mz: -1 }), 0.4, EMPTY); maxV = hs(s);
  check('aire: el control aéreo no añade velocidad (sin bunny-hop infinito)', maxV <= mc.walk + 0.05, maxV.toFixed(2));
}
{ // wall collision
  const world = { colliders: [{ minX: -5, minY: 0, minZ: -3, maxX: 5, maxY: 3, maxZ: -2 }], ramps: [] };
  const s = M.createState(); run(s, cmd({ mz: -1 }), 2, world);
  check('pared: no se atraviesa', s.z >= -2 + mc.radius - 0.01, 'z=' + s.z.toFixed(3));
  check('pared: la velocidad hacia la pared se anula', Math.abs(s.vz) < 0.01);
  const s2 = M.createState(); s2.x = 0; run(s2, cmd({ mx: 0.6, mz: -1 }), 2, world);
  check('pared: se desliza a lo largo de ella', s2.x > 2, 'x=' + s2.x.toFixed(2));
}
{ // crate 1.2 high: blocked walking, climbable jumping
  const world = { colliders: [{ minX: -0.6, minY: 0, minZ: -2.2, maxX: 0.6, maxY: 1.2, maxZ: -1.0 }], ramps: [] };
  const s = M.createState(); run(s, cmd({ mz: -1 }), 1, world);
  check('caja 1,2 m: andando no se sube', s.y === 0 && s.z > -1.0);
  const j = M.createState(); j.z = 0.2; run(j, t => cmd({ mz: -1, jump: t < DT }), 0.45, world);
  check('caja 1,2 m: saltando sí se sube', Math.abs(j.y - 1.2) < 0.01, 'y=' + j.y.toFixed(2));
}
{ // ramp
  const world = { colliders: [], ramps: [{ minX: -5, maxX: 5, minZ: -33, maxZ: -30, axis: 'x', hLow: 0, hHigh: 4.35, highAtMin: true }] };
  const s = M.createState(6, 0, -31.5); s.onGround = true; let maxY = 0, air = 0;
  for (let i = 0; i < 480; i++) { M.step(s, cmd({ mx: 0, mz: -1, yaw: Math.PI / 2 }), DT, world, mc); maxY = Math.max(maxY, s.y); if (!s.onGround && s.x > -4.9) air++; }
  check('rampa: se sube hasta arriba', maxY > 4.2, 'altura máx ' + maxY.toFixed(2));
  check('rampa: sin despegar del suelo al subir', air === 0, air + ' ticks en el aire');
  const d = M.createState(-4.9, 4.3, -31.5); d.onGround = true; air = 0;
  for (let i = 0; i < 300; i++) { M.step(d, cmd({ mz: -1, yaw: -Math.PI / 2 }), DT, world, mc); if (!d.onGround) air++; }
  check('rampa: se baja pegado al suelo', d.y === 0 && air < 3, air + ' ticks en el aire');
}
{ // FPS independence: same input at 120 Hz tick, different frame splits → same result
  const a = M.createState(), b = M.createState();
  const pat = t => cmd({ mz: -1, sprint: t < 1, crouch: t > 1 && t < 1.6, crouchPressed: Math.abs(t - 1.0) < DT / 2, jump: Math.abs(t - 2) < DT / 2, mx: t > 2.2 ? 1 : 0 });
  let t = 0; for (let i = 0; i < 360; i++) { M.step(a, pat(t), DT, EMPTY, mc); t += DT; }
  // b: a simulated "30 FPS" frame loop that accumulates and runs the same fixed ticks
  let acc = 0; t = 0; const frames = 90; for (let f = 0; f < frames; f++) { acc += 1 / 30; while (acc >= DT - 1e-9) { M.step(b, pat(t), DT, EMPTY, mc); t += DT; acc -= DT; } }
  check('independiente de FPS: 30 FPS y 120 FPS dan la misma posición', Math.hypot(a.x - b.x, a.z - b.z, a.y - b.y) < 1e-6, 'Δ=' + Math.hypot(a.x - b.x, a.z - b.z).toExponential(1));
}

console.log('\nARMA');
{ const w = W.createState(rc); const ctx = { sprinting: false, alive: true }; let t = 0, readyAt = -1;
  while (t < 1) { const ev = W.tick(w, { fire: false, ads: false }, DT, ctx); t += DT; if (ev.some(e => e.type === 'ready') && readyAt < 0) readyAt = t; }
  check('levantar el arma tarda raise', Math.abs(readyAt - rc.raise) < DT * 1.5, readyAt.toFixed(3));
  let ev = W.tick(w, { fire: true }, DT, ctx);
  check('disparo cuando está lista', ev.some(e => e.type === 'fire') && w.ammo === rc.mag - 1);
  // hold trigger spam: next shot exactly when bolt locks
  t = 0; let next = -1, lockT = -1, order = [];
  for (let i = 0; i < 240; i++) { ev = W.tick(w, { fire: true }, DT, ctx); t += DT; ev.forEach(e => order.push(e.type)); if (ev.some(e => e.type === 'boltLock') && lockT < 0) lockT = t; if (ev.some(e => e.type === 'fire')) { next = t; break; } }
  check('cerrojo: no se puede disparar antes de completarlo', next >= rc.bolt - DT, next.toFixed(3) + ' s');
  check('cerrojo: el siguiente disparo sale en el mismo tick del cierre', Math.abs(next - lockT) < 1e-9 && next - rc.bolt < DT * 1.5);
  check('cerrojo: orden de eventos levantar→atrás→expulsar→adelante→cierre→listo→disparo',
    order.join(',').startsWith('boltLift,boltBack,eject,boltFwd,boltLock,ready,fire'), order.slice(0, 7).join('→'));
}
{ const w = W.createState(rc); const ctx = { sprinting: false, alive: true };
  for (let i = 0; i < 70; i++) W.tick(w, {}, DT, ctx);
  let fired = 0, t = 0;
  // press once 0.1 s before the bolt finishes → buffered shot fires on lock
  W.tick(w, { fire: true }, DT, ctx); t = 0;
  for (let i = 0; i < 200; i++) { const p = Math.abs(t - (rc.bolt - 0.1)) < DT / 2; const ev = W.tick(w, { fire: p }, DT, ctx); t += DT; if (ev.some(e => e.type === 'fire')) fired++; }
  check('buffer del gatillo: pulsar 0,1 s antes del cierre dispara al cerrar', fired === 1);
}
{ const w = W.createState(rc); const ctx = { sprinting: false, alive: true }; let t = 0;
  for (let i = 0; i < 70; i++) W.tick(w, {}, DT, ctx);
  for (let i = 0; i < 120; i++) { W.tick(w, { ads: true }, DT, ctx); t += DT; if (w.ads >= 1) break; }
  check('ADS completo en adsTime', Math.abs(t - rc.adsTime) < DT * 1.5, t.toFixed(3) + ' s');
  check('con mira completa la dispersión es 0', W.spread(w, { speed: 6, airborne: true }) === 0);
  w.ads = rc.scopeAt; check('dispersión 0 justo al aparecer la mira (quickscope consistente)', W.spread(w, { speed: 0 }) === 0);
  w.ads = rc.scopeAt - 0.01; const s1 = W.spread(w, { speed: 0 });
  w.ads = 0; const s0 = W.spread(w, { speed: 0 });
  check('antes de la mira: dispersión reducida respecto a cadera', s1 < s0 && s1 > 0, (s0 * 1000).toFixed(1) + ' → ' + (s1 * 1000).toFixed(1) + ' mrad');
  check('cadera: moverse y saltar abre el cono', W.spread(w, { speed: 7, airborne: true }) > s0 * 2);
}
{ const w = W.createState(rc); let ctx = { sprinting: true, alive: true };
  for (let i = 0; i < 70; i++) W.tick(w, { ads: true }, DT, ctx);
  check('esprintando no hay ADS', w.ads === 0);
  let ev = W.tick(w, { fire: true }, DT, ctx);
  check('esprintando no dispara', !ev.some(e => e.type === 'fire'));
  ctx = { sprinting: false, alive: true }; let t = 0, firedAt = -1;
  for (let i = 0; i < 60; i++) { ev = W.tick(w, { fire: i === 0 }, DT, ctx); t += DT; if (ev.some(e => e.type === 'fire')) { firedAt = t; break; } }
  check('al dejar de esprintar dispara tras sprintOut (con buffer)', firedAt > 0 && firedAt <= rc.sprintOut + rc.fireBuffer, firedAt.toFixed(3) + ' s');
}
{ const w = W.createState(rc); const ctx = { sprinting: false, alive: true };
  for (let i = 0; i < 70; i++) W.tick(w, {}, DT, ctx);
  let shots = 0, reloadStart = false, magIn = -1, t = 0, end = -1;
  for (let i = 0; i < 1200; i++) { const ev = W.tick(w, { fire: !reloadStart }, DT, ctx); t += DT; ev.forEach(e => { if (e.type === 'fire') shots++; if (e.type === 'reloadStart') reloadStart = true; if (e.type === 'magIn') magIn = t; if (e.type === 'reloadEnd') end = t; }); if (end > 0) break; }
  check('5 disparos y recarga automática al vaciar', shots === 5 && reloadStart, shots + ' disparos');
  check('la munición vuelve a 5 tras recargar', w.ammo === rc.mag);
  W.tick(w, { reload: true }, DT, ctx);
  check('recargar con el cargador lleno no hace nada', w.state === 'ready');
  W.tick(w, { fire: true }, DT, ctx); W.tick(w, {}, DT, ctx);
  const st = w.state; for (let i = 0; i < 130; i++) W.tick(w, {}, DT, ctx);
  W.tick(w, { reload: true }, DT, ctx);
  check('recarga manual con munición gastada', st === 'bolt' && w.state === 'reload');
  for (let i = 0; i < 60; i++) W.tick(w, { ads: true }, DT, ctx);
  check('recargando no hay ADS', w.ads === 0);
}
{ const k = rc.boltKeys; const end = W.boltPose(1, k), mid = W.boltPose(0.45, k), start = W.boltPose(0, k);
  check('pose de cerrojo vuelve exactamente a reposo al quedar lista', Math.abs(end.lift) < 1e-6 && Math.abs(end.back) < 1e-6 && Math.abs(end.tilt) < 1e-6);
  check('pose de cerrojo: atrás del todo cuando expulsa', mid.back > 0.95 && mid.lift > 0.95);
  check('pose de cerrojo empieza en reposo', start.lift === 0 && start.back === 0);
  let maxStep = 0, prev = W.boltPose(0, k); for (let p = 0.002; p <= 1; p += 0.002) { const q = W.boltPose(p, k); maxStep = Math.max(maxStep, Math.abs(q.lift - prev.lift), Math.abs(q.back - prev.back), Math.abs(q.tilt - prev.tilt)); prev = q; }
  check('pose de cerrojo continua (sin saltos)', maxStep < 0.03, maxStep.toFixed(4));
  const rEnd = W.reloadPose(1, rc); let rMax = 0, rp = W.reloadPose(0, rc);
  for (let p = 0.002; p <= 1; p += 0.002) { const q = W.reloadPose(p, rc); rMax = Math.max(rMax, Math.abs(q.tilt - rp.tilt), Math.abs(q.lift - rp.lift), Math.abs(q.back - rp.back)); rp = q; }
  check('pose de recarga vuelve a reposo y es continua', Math.abs(rEnd.tilt) < 1e-6 && rEnd.magDrop === 0 && rMax < 0.1, rMax.toFixed(4));
}

console.log('\nBALÍSTICA');
function flyTo(range, lift) {
  const dir = { x: 0, y: Math.sin(lift), z: -Math.cos(lift) };
  const b = W.createBullet(0, 0, 0, dir.x, dir.y, dir.z, rc);
  let prev = { y: 0, z: 0, t: 0 };
  while (b.z > -range) { prev = { y: b.y, z: b.z, t: b.age }; W.stepBullet(b, DT, rc); }
  const f = (-range - prev.z) / (b.z - prev.z);
  return { y: prev.y + (b.y - prev.y) * f, t: prev.t + (b.age - prev.t) * f };
}
{ const lift = W.zeroLift(rc);
  const at50 = flyTo(50, lift), at25 = flyTo(25, lift), at100 = flyTo(100, lift), at130 = flyTo(130, lift);
  check('a 50 m la bala cruza la retícula (calibración)', Math.abs(at50.y) < 0.005, (at50.y * 100).toFixed(2) + ' cm');
  check('a 25 m impacta casi en la retícula', Math.abs(at25.y) < 0.03, (at25.y * 100).toFixed(1) + ' cm');
  check('a 100 m cae menos que el radio de la cabeza (13 cm)', at100.y < 0 && at100.y > -0.13, (at100.y * 100).toFixed(1) + ' cm');
  check('a 130 m cae más: hay que compensar', at130.y < -0.13, (at130.y * 100).toFixed(1) + ' cm');
  check('tiempo de vuelo a 100 m ≈ 0,167 s', Math.abs(at100.t - 100 / rc.speed) < 0.003, at100.t.toFixed(3) + ' s');
  console.log('        adelanto a 100 m para un blanco a 3,4 m/s: ' + (3.4 * at100.t).toFixed(2) + ' m');
  // FPS independence: bullets also run on the fixed tick, check sub-step consistency
  const b60 = W.createBullet(0, 0, 0, 0, Math.sin(lift), -Math.cos(lift), rc), b240 = W.createBullet(0, 0, 0, 0, Math.sin(lift), -Math.cos(lift), rc);
  for (let i = 0; i < 20; i++) W.stepBullet(b60, 1 / 60, rc); for (let i = 0; i < 80; i++) W.stepBullet(b240, 1 / 240, rc);
  check('trayectoria casi idéntica con pasos de 60 y 240 Hz', Math.abs(b60.y - b240.y) < 0.01, ((b60.y - b240.y) * 100).toFixed(2) + ' cm');
}

console.log('\nRETROCESO');
{ const r = W.createRecoil(), rr = rc.recoil; W.kickRecoil(r, rr.pitch, rr.yaw, rr);
  let peak = 0, t = 0, back = -1;
  for (let i = 0; i < 240; i++) { W.stepRecoil(r, DT, rr); t += DT; peak = Math.max(peak, r.p); if (back < 0 && t > 0.05 && Math.abs(r.p) < rr.pitch * 0.05) back = t; }
  check('pico del retroceso ≈ configurado', Math.abs(peak - rr.pitch) / rr.pitch < 0.12, (peak * 1000).toFixed(1) + ' vs ' + (rr.pitch * 1000).toFixed(1) + ' mrad');
  check('se recupera (<5%) antes del siguiente disparo', back > 0 && back < rc.bolt * 0.6, back.toFixed(3) + ' s');
  check('termina en reposo', Math.abs(r.p) < 1e-4 && Math.abs(r.y) < 1e-4);
}

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
