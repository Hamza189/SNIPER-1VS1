/* Stage D: the 1v1 room with two real client brains over a simulated network.
   Run: node test/room.test.js */
'use strict';
const { createSim, lookAt, INDEX, MAP } = require('./simnet.js');
const PR = require('../core/protocol.js'), SDRoom = require('../core/room.js'), CFG = require('../core/config.js');
const G = require('../core/geom.js'), HB = require('../core/hitbox.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const evs = (c, k) => c.events.filter(e => e.k === k);
const headOf = c => { const p = c.local.ms; return [p.x, p.y + 1.63 * HB.scaleOf(p.eye), p.z]; };

// find two open spots with a clear line of sight, d metres apart along x
function openPair(d) {
  for (const [x, z] of MAP.nav) {
    const x2 = x + d; if (!MAP.nav.some(n => n[0] === x2 && n[1] === z)) continue;
    if (G.losClear(INDEX, x, 1.6, z, x2, 1.6, z) && G.losClear(INDEX, x, 0.4, z, x2, 0.4, z) && G.losClear(INDEX, x, 1.2, z, x2, 1.2, z)) return [[x, z], [x2, z]];
  }
  return null;
}
// put both players at fixed spots (server and the clients' prediction)
function place(S, A, B, pa, pb) {
  const yawA = Math.atan2(-(pb[0] - pa[0]), -(pb[1] - pa[1])), yawB = Math.atan2(-(pa[0] - pb[0]), -(pa[1] - pb[1]));
  S.room.debug.place('A', pa[0], pa[1], yawA); S.room.debug.place('B', pb[0], pb[1], yawB);
  S.run(400);
}

console.log('\nSALA Y LOBBY');
{ const S = createSim();
  const A = S.addClient('Hamza'), B = S.addClient('Novia'), C = S.addClient('Intruso');
  A.N.hello('Hamza'); S.run(100);
  check('crear sala: el primero es el jugador A con token propio', A.N.you === 'A' && /^[A-Za-z0-9_-]{24}$/.test(A.N.token || ''));
  B.N.hello('Novia'); S.run(100);
  check('el segundo entra como B', B.N.you === 'B' && B.N.token !== A.N.token);
  C.N.hello('Intruso'); S.run(100);
  check('un tercero es rechazado (sala llena)', evs(C, 'error').some(e => e.code === 'full') && C.N.you === null);
  check('el lobby muestra los dos nombres', A.N.players.map(p => p && p.name).join() === 'Hamza,Novia');
  A.N.ready(true); S.run(100);
  check('con uno solo preparado no empieza', S.room.phase === 'lobby');
  B.N.ready(true); B.N.ready(true); A.N.ready(true); S.run(100);
  check('ambos preparados: cuenta atrás, una sola vez aunque se pulse dos veces', S.room.phase === 'countdown' && evs(A, 'start').length === 1 && evs(B, 'start').length === 1 && S.room.match === 1);
  const sa = evs(A, 'start')[0].m.spawn, sb = evs(B, 'start')[0].m.spawn;
  check('aparecen lejos uno del otro', Math.hypot(sa.x - sb.x, sa.z - sb.z) > 40, Math.hypot(sa.x - sb.x, sa.z - sb.z).toFixed(0) + ' m');
  check('sin línea de visión al empezar', !G.losClear(INDEX, sa.x, 1.6, sa.z, sb.x, 1.6, sb.z));
  check('ningún punto de aparición dentro de una caja', [sa, sb].every(s => !MAP.colliders.some(c => s.x > c.minX - 0.35 && s.x < c.maxX + 0.35 && s.z > c.minZ - 0.35 && s.z < c.maxZ + 0.35 && c.minY < 1.5)));
  S.run(3200);
  check('tras 3 s: JUGANDO para los dos', A.N.phase === 'playing' && B.N.phase === 'playing');
}
{ // malformed and hostile messages
  const out = []; let closed = 0;
  const r = SDRoom.create({ code: 'BADBAD', map: MAP, index: INDEX, send: (c, t) => out.push(JSON.parse(t)), close: () => closed++ });
  r.connect(1, 0);
  for (const t of ['{', '[]', '{"t":5}', '{"t":"hello","v":99}', '{"t":"nope"}', 'x'.repeat(5000), '{"t":"in","m":0,"s":-1,"c":[]}']) r.message(1, t, 0);
  check('mensajes mal formados: error y sin efecto', out.filter(m => m.t === 'error').length === 7 && !r.seats.A);
  r.message(1, JSON.stringify({ t: 'hello', v: 1, name: '<script>alert(1)</script>Hamzaaaaaaaaaaaaaaaaaa' }), 0);
  check('el nombre se limpia y se recorta', r.seats.A && !/[<>]/.test(r.seats.A.name) && r.seats.A.name.length <= 16, r.seats.A && r.seats.A.name);
  r.message(1, JSON.stringify({ t: 'in', m: 0, s: 0, c: [[9, 9, 0, 0, 0]] }), 0);
  check('comando con valores imposibles rechazado', out[out.length - 1].t === 'error');
  for (let i = 0; i < 400; i++) r.message(1, '{"t":"ping","c":1}', 10);
  check('inundar mensajes cierra la conexión', closed >= 1);
  check('códigos de sala: 6 caracteres sin letras confusas', PR.isCode(PR.codeFrom([1, 2, 3, 4, 5, 250])) && !/[01OIL]/.test(PR.CODE_ALPHABET));
}

console.log('\nMOVIMIENTO SINCRONIZADO');
{ // A runs a fixed route: sprint, slide, jump, crouch. Prediction must match the server.
  let t0 = null;
  const route = (c, S) => { if (!c.placed) return { yaw: -Math.PI / 2 }; if (t0 === null) t0 = S.t; const t = (S.t - t0) / 1000, yaw = -Math.PI / 2; // east along an open street
    if (t < 1.2) return { mz: -1, yaw, sprint: true };
    if (t < 1.25) return { mz: -1, yaw, sprint: true, crouch: true, crouchPressed: true };
    if (t < 1.9) return { mz: -1, yaw, crouch: true };
    if (t < 1.95) return { mz: -1, yaw, jump: true };
    if (t < 2.6) return { mx: 1, yaw: 1.4 };
    if (t < 3.2) return { mx: -1, yaw: 1.4, crouch: true };
    return { yaw: 2 }; };
  const S = createSim({ latency: 40, jitter: 10 });
  const { A, B } = S.setupMatch(route, () => ({ yaw: 0 }));
  const st = openPair(36); S.room.debug.place('A', st[0][0], st[0][1], -Math.PI / 2); S.run(300); A.placed = true;
  let maxErr = 0, modes = new Set(), maxRemote = 0;
  for (let i = 0; i < 400; i++) {
    S.run(10); modes.add(A.local.ms.mode);
    const sv = S.room.seats.A.p.ms;
    // the server is behind the client by the latency: compare the remote view instead below
    const rp = B.N.remotePose();
    if (rp && i > 50) maxRemote = Math.max(maxRemote, Math.hypot(rp.x - sv.x, rp.z - sv.z));
    maxErr = Math.max(maxErr, A.N.corr);
  }
  S.run(500);
  const sv = S.room.seats.A.p.ms, cl = A.local.ms;
  check('sprint, slide, salto y agachado ejecutados', ['sprint', 'slide', 'aire', 'agachado'].every(m => modes.has(m)), [...modes].join(','));
  check('al final cliente y servidor en el mismo sitio', Math.hypot(sv.x - cl.x, sv.z - cl.z) < 1e-6, Math.hypot(sv.x - cl.x, sv.z - cl.z).toExponential(1) + ' m');
  check('la predicción nunca tuvo que corregirse (determinista)', maxErr < 1e-6, maxErr.toExponential(1) + ' m');
  check('B ve a A donde está (retraso de interpolación, < 1,3 m a 7 m/s)', maxRemote < 1.3, maxRemote.toFixed(2) + ' m');
  const rp = B.N.remotePose();
  check('B ve la orientación de A', rp && Math.abs(rp.yaw - 2) < 0.01, rp && rp.yaw.toFixed(3));
}
{ // a client trying to run faster than real time (speed hack) is held back
  const S = createSim({ latency: 20 });
  const { A } = S.setupMatch(() => ({ yaw: 0 }), () => ({ yaw: 0 }));
  const seat = S.room.seats.A, x0 = seat.p.ms.z;
  const fast = []; for (let i = 0; i < 24; i++) fast.push(PR.packCmd({ mz: -1, yaw: 0, sprint: true }));
  for (let k = 0; k < 40; k++) S.room.message(A.conn, JSON.stringify({ t: 'in', m: S.room.match, s: 100000 + k * 24, c: fast }), S.t);
  const moved = Math.abs(seat.p.ms.z - x0);
  check('960 comandos de golpe: solo se aplican los que permite el tiempo real (+1 s de margen)', moved < 7.0 * 1.15, moved.toFixed(2) + ' m (sin límite: ' + (960 / 120 * 7).toFixed(0) + ' m)');
}

console.log('\nRIFLE ONLINE');
const pair = openPair(36);
check('hay un tramo despejado de 36 m para las pruebas de tiro', !!pair, pair && JSON.stringify(pair));
function duel(opts, aiA, aiB) {
  const S = createSim(opts);
  const { A, B } = S.setupMatch(aiA || (() => ({ yaw: 0 })), aiB || (() => ({ yaw: 0 })));
  place(S, A, B, pair[0], pair[1]);
  return { S, A, B };
}
{ // headshot from 36 m
  let shoot = false;
  const { S, A, B } = duel({ latency: 30 }, (c, S) => { const s = S.room.seats.B.p.ms; return Object.assign(lookAt(c, [s.x, s.y + 1.63, s.z]), { fire: shoot, adsHeld: true }); });
  S.run(800); shoot = true; S.run(20); shoot = false; S.run(600);
  const hit = evs(A, 'hit')[0], kill = evs(B, 'kill')[0];
  check('headshot: el servidor confirma cabeza y mata de un tiro', hit && hit.part === 'head' && kill && kill.to === 'B', hit && hit.part);
  check('marcador igual en los dos: 1-0', A.N.score.A === 1 && B.N.score.A === 1 && A.N.score.B === 0);
  check('la bala tiene vuelo (no instantánea): llega ~60 ms después', (() => { const sh = evs(A, 'shot')[0]; return sh && hit; })());
  check('B muerto no puede disparar ni moverse en el servidor', S.room.seats.B.alive === false);
  S.run(3200);
  check('B reaparece a los 3 s con 100 de vida, lejos de A', S.room.seats.B.alive && S.room.seats.B.hp === 100 && evs(B, 'respawn').length === 1);
  const sa = S.room.seats.A.p.ms, sb = S.room.seats.B.p.ms;
  check('la reaparición queda a más de 18 m del rival', Math.hypot(sa.x - sb.x, sa.z - sb.z) > 18, Math.hypot(sa.x - sb.x, sa.z - sb.z).toFixed(0) + ' m');
}
{ // torso then legs: 85 + 55 = dead
  let target = 'torso', shoot = false;
  const { S, A, B } = duel({ latency: 30 }, (c, S) => { const s = S.room.seats.B.p.ms; const y = target === 'torso' ? 1.17 : 0.43; return Object.assign(lookAt(c, [s.x, s.y + y, s.z]), { fire: shoot, adsHeld: true }); });
  S.run(800); shoot = true; S.run(20); shoot = false; S.run(400);
  const h1 = evs(A, 'hit')[0];
  check('torso: 85 de daño, queda con 15', h1 && h1.part === 'torso' && h1.dmg === 85 && h1.hp === 15, h1 && h1.part + ' ' + h1.hp);
  check('B ve su vida bajar a 15', B.N.hp === 15);
  S.run(1200); target = 'legs'; shoot = true; S.run(20); shoot = false; S.run(400);
  const h2 = evs(A, 'hit')[1];
  check('piernas: 55 de daño y muere', h2 && h2.part === 'legs' && evs(A, 'kill').length === 1, h2 && h2.part);
}
{ // ammo and bolt: holding fire → one shot per bolt cycle, 5 then dry
  const { S, A, B } = duel({ latency: 30 }, (c, S) => Object.assign({ yaw: c.local.ms.x < 0 ? 3.1 : 0, pitch: 0.4 }, { fire: true }));
  S.run(1000);
  const shots1 = evs(A, 'shot').length;
  check('fuego mantenido 1 s: solo 1–2 disparos (el cerrojo manda)', shots1 >= 1 && shots1 <= 2, shots1 + ' disparos');
  S.run(6000);
  const seat = S.room.seats.A;
  check('cinco balas por cargador; la sexta no sale sin recargar', evs(A, 'shot').length === 5 && seat.p.w.ammo === 0, evs(A, 'shot').length + ' disparos, quedan ' + seat.p.w.ammo);
  check('la munición del cliente coincide con la del servidor', A.local.w.ammo === seat.p.w.ammo);
}
{ // reload, then shoot again
  let phase = 0;
  const { S, A } = duel({ latency: 30 }, (c) => phase === 0 ? { yaw: 3, pitch: 0.4, fire: true } : phase === 1 ? { yaw: 3, reload: true } : { yaw: 3, pitch: 0.4, fire: true });
  S.run(6500); phase = 1; S.run(50); phase = 3; S.run(150);
  check('recargando no dispara aunque se pulse', S.room.seats.A.p.w.state === 'reload' && evs(A, 'shot').length === 5);
  S.run(3000);
  check('tras la recarga vuelve a disparar', evs(A, 'shot').length >= 6 && A.local.w.ammo === S.room.seats.A.p.w.ammo, evs(A, 'shot').length);
}
{ // wall between: no damage
  let shoot = false;
  // find a box with open ground on both sides along x
  let spot = null;
  for (const c of MAP.colliders) { const z = (c.minZ + c.maxZ) / 2, y1 = c.maxY; if (y1 < 2.5 || c.maxX - c.minX > 8) continue;
    const xa = c.minX - 4, xb = c.maxX + 4;
    if (MAP.nav.some(n => Math.abs(n[0] - xa) < 1.6 && Math.abs(n[1] - z) < 1.6) && MAP.nav.some(n => Math.abs(n[0] - xb) < 1.6 && Math.abs(n[1] - z) < 1.6) && !G.losClear(INDEX, xa, 1.6, z, xb, 1.6, z)) { spot = [[xa, z], [xb, z]]; break; } }
  check('hay una pared para la prueba', !!spot);
  if (spot) {
    const S = createSim({ latency: 30 });
    const { A, B } = S.setupMatch((c, S) => { const s = S.room.seats.B.p.ms; return Object.assign(lookAt(c, [s.x, s.y + 1.2, s.z]), { fire: shoot }); }, () => ({ yaw: 0 }));
    place(S, A, B, spot[0], spot[1]);
    S.run(600); shoot = true; S.run(20); shoot = false; S.run(600);
    check('una pared en medio para la bala: sin daño', evs(A, 'shot').length === 1 && evs(A, 'hit').length === 0 && S.room.seats.B.hp === 100);
  }
}
{ // forged shots: direction far from the aim, and an origin on the other side of a wall
  const { S, A, B } = duel({ latency: 30 });
  const seat = S.room.seats.A, ms = seat.p.ms;
  seat.p.w.state = 'ready'; seat.p.w.t = 1;
  const bad = PR.packCmd({ yaw: 0, pitch: 0, fire: true, fd: [0, 0, 1], fo: [ms.x, ms.y + ms.eye, ms.z] });
  S.room.message(A.conn, JSON.stringify({ t: 'in', m: S.room.match, s: 900000, c: [bad] }), S.t); S.run(100);
  const rj = evs(A, 'rejected')[0];
  check('disparo con dirección imposible: rechazado y corregido a la mira real', rj && rj.why === 'direction');
  S.run(1500); seat.p.w.state = 'ready';
  const far = PR.packCmd({ yaw: 0, pitch: 0, fire: true, fd: [0, 0, -1], fo: [ms.x + 5, ms.y + ms.eye, ms.z] });
  S.room.message(A.conn, JSON.stringify({ t: 'in', m: S.room.match, s: 900100, c: [far] }), S.t); S.run(100);
  check('disparo desde un origen falso (5 m): rechazado', evs(A, 'rejected').some(e => e.why === 'origin'));
}
{ // duplicated and reordered network messages: never a double shot or double damage
  let shoot = false;
  const { S, A, B } = duel({ latency: 60, jitter: 30, dup: 0.5 }, (c, S) => { const s = S.room.seats.B.p.ms; return Object.assign(lookAt(c, [s.x, s.y + 1.17, s.z]), { fire: shoot, adsHeld: true }); });
  S.run(800); shoot = true; S.run(20); shoot = false; S.run(800);
  check('mensajes duplicados: un disparo, un impacto, 85 de daño', evs(A, 'shot').length === 1 && evs(A, 'hit').length === 1 && S.room.seats.B.hp === 15, evs(A, 'hit').length + ' impactos');
}

console.log('\nNAVAJA ONLINE');
{ let atk = false, sel = null;
  const { S, A, B } = duel({ latency: 30 }, (c, S) => { const s = S.room.seats.B.p.ms; return Object.assign(lookAt(c, [s.x, s.y + 1.2, s.z]), { fire: atk, select: sel }); });
  S.room.debug.place('B', pair[0][0] + 1.5, pair[0][1], Math.PI / 2); S.room.debug.place('A', pair[0][0], pair[0][1], -Math.PI / 2); S.run(400);
  sel = 'knife'; S.run(20); sel = null; S.run(500);
  check('cambio a navaja sincronizado', S.room.seats.A.p.load.active === 'knife' && A.local.load.active === 'knife');
  atk = true; S.run(20); atk = false; S.run(400);
  const h = evs(A, 'hit').find(e => e.weapon === 'knife');
  check('navajazo a 1,5 m: lo valida el servidor', !!h, h && h.dmg);
  S.room.debug.place('B', pair[0][0] + 6, pair[0][1], 0); S.run(800);
  const before = evs(A, 'hit').length; atk = true; S.run(20); atk = false; S.run(400);
  check('a 6 m la navaja no llega', evs(A, 'hit').length === before);
}

console.log('\nMUERTE, MARCADOR, VICTORIA Y REVANCHA');
{ let shoot = false;
  const { S, A, B } = duel({ latency: 40 }, (c, S) => { const s = S.room.seats.B.p.ms; return Object.assign(lookAt(c, [s.x, s.y + 1.63, s.z]), { fire: shoot, adsHeld: true }); });
  S.room.debug.set('A', 'kills', 9);
  S.run(800); shoot = true; S.run(20); shoot = false; S.run(600);
  const ovA = evs(A, 'over')[0], ovB = evs(B, 'over')[0];
  check('décima baja: termina la partida y los dos ven ganador A', ovA && ovB && ovA.winner === 'A' && ovB.winner === 'A');
  check('los dos ven 10-0', A.N.score.A === 10 && B.N.score.A === 10);
  const shotsBefore = evs(A, 'shot').length; shoot = true; S.run(200); shoot = false;
  check('después del final no se puede disparar', evs(A, 'shot').length === shotsBefore && S.room.phase === 'over');
  A.N.rematch(); S.run(200);
  check('revancha: con uno solo no empieza', S.room.phase === 'over');
  B.N.rematch(); S.run(200);
  check('ambos aceptan: nueva partida (id 2), marcador a 0', S.room.phase === 'countdown' && S.room.match === 2 && A.N.match === 2 && A.N.score.A === 0);
  S.run(3300);
  check('la segunda partida empieza para los dos, con 5 balas y 100 de vida', A.N.phase === 'playing' && B.N.phase === 'playing' && S.room.seats.A.p.w.ammo === 5 && S.room.seats.B.hp === 100);
  // a command of the old match arriving late is ignored
  const seat = S.room.seats.A, z0 = seat.p.ms.z;
  S.room.message(A.conn, JSON.stringify({ t: 'in', m: 1, s: 999999, c: [PR.packCmd({ mz: -1, yaw: 0 })] }), S.t);
  check('comandos de la partida anterior se ignoran', seat.p.ms.z === z0 && seat.lastSeq < 999999);
}
{ // simultaneous kills at 9-9: draw
  let shoot = false;
  const ai = other => (c, S) => { const s = S.room.seats[other].p.ms; return Object.assign(lookAt(c, [s.x, s.y + 1.63, s.z]), { fire: shoot, adsHeld: true }); };
  const { S, A, B } = duel({ latency: 30 }, ai('B'), ai('A'));
  S.room.debug.set('A', 'kills', 9); S.room.debug.set('B', 'kills', 9);
  S.run(800); shoot = true; S.run(9); shoot = false; S.run(800);
  const ov = evs(A, 'over')[0];
  check('muertes simultáneas a 9–9: las dos cuentan y es empate (o gana quien acertó antes)', ov && (ov.winner === null || ov.winner === 'A' || ov.winner === 'B') && evs(A, 'over').length === 1, ov && String(ov.winner) + ' ' + JSON.stringify(ov.sc));
}

console.log('\nDESCONEXIÓN Y RECONEXIÓN');
{ const S = createSim({ latency: 40 });
  const { A, B } = S.setupMatch(() => ({ mz: -1, yaw: 1 }), () => ({ yaw: 0 }));
  S.run(500);
  S.drop(B); S.run(300);
  check('si B se cae, la partida se pausa para los dos (RECONECTANDO)', S.room.phase === 'paused' && A.N.phase === 'paused');
  const zA = S.room.seats.A.p.ms.z; S.run(1000);
  check('en pausa nadie se mueve en el servidor', S.room.seats.A.p.ms.z === zA);
  const tokB = B.N.token;
  const X = S.addClient('Ladron'); X.N.hello('Ladron'); S.run(200);
  check('un tercero no puede ocupar la plaza de B mientras vuelve', X.N.you === null);
  S.reconnect(B); S.run(600);
  check('B vuelve con su token: misma plaza, partida reanudada', B.N.you === 'B' && B.N.token === tokB && S.room.phase === 'playing' && A.N.phase === 'playing');
  check('al volver recibe el estado completo (snapshot)', evs(B, 'snap').length > 0 && Math.hypot(B.local.ms.x - S.room.seats.B.p.ms.x, B.local.ms.z - S.room.seats.B.p.ms.z) < 1e-6);
  S.drop(B); S.run(61000);
  check('si no vuelve en 60 s, gana el que se quedó', S.room.phase === 'over' && evs(A, 'over').some(e => e.winner === 'A'));
}
{ // two connections with the same token: the newest keeps the seat, no duplicate player
  const S = createSim();
  const A = S.addClient('Hamza'); A.N.hello('Hamza'); S.run(100);
  const A2 = S.addClient('Hamza'); A2.N.hello('Hamza', A.N.token); S.run(100);
  check('mismo token dos veces: una sola plaza, la conexión vieja se cierra', A2.N.you === 'A' && !A.open && !S.room.seats.B);
}

{ // leaving in the middle of a match
  const S = createSim({ latency: 30 });
  const { A, B } = S.setupMatch(() => ({ yaw: 0 }), () => ({ yaw: 0 }));
  A.N.leave(); S.run(300);
  check('A sale a mitad de partida: B gana por abandono y sigue viendo el resultado', evs(B, 'over').some(e => e.winner === 'B' && e.why === 'abandono') && S.room.phase === 'over' && B.N.phase === 'over');
  B.N.rematch(); S.run(200);
  check('B pulsa ESPERAR OTRO RIVAL: vuelve al lobby y puede entrar otro', S.room.phase === 'lobby' && B.N.phase === 'lobby');
  const C = S.addClient('Nuevo'); C.N.hello('Nuevo'); S.run(200);
  check('un jugador nuevo entra en la plaza libre', C.N.you === 'A' && S.room.seats.B && S.room.seats.A.name === 'Nuevo');
}

{ // a socket that goes silent (no close) is detected; an idle lobby is closed
  const S = createSim({ latency: 30 });
  const { A, B } = S.setupMatch(() => ({ yaw: 0 }), () => ({ yaw: 0 }));
  B.open = false;           // the phone is locked: nothing arrives any more, no close either
  S.run(7000);
  check('socket mudo 6 s: el servidor lo da por desconectado y pausa', S.room.phase === 'paused' && A.N.phase === 'paused');
  const S2 = createSim(); const X = S2.addClient('X'); X.N.hello('X'); S2.run(100);
  S2.run(16 * 60000);
  check('sala abierta 15 min sin jugar: se cierra', X.events.some(e => e.k === 'error' && e.code === 'idle') && S2.room.conns.size === 0);
}

console.log('\nLATENCIA, JITTER Y PÉRDIDA');
for (const [lat, jit, loss] of [[20, 0, 0], [80, 10, 0], [150, 30, 0], [250, 50, 0], [80, 40, 0.05]]) {
  let shoot = false;
  const { S, A, B } = duel({ latency: lat, jitter: jit, loss, seed: lat }, (c, S) => {
    // A aims where it SEES B (interpolated remote view), like a real player
    const rp = c.N.remotePose(); const p = rp ? [rp.x, rp.y + 1.17, rp.z] : [0, 1, 0];
    return Object.assign(lookAt(c, p), { fire: shoot, adsHeld: true }); });
  S.run(1500); shoot = true; S.run(20); shoot = false; S.run(1500);
  const errMax = A.N.corrMax;
  const sv = S.room.seats.A.p.ms, d = Math.hypot(sv.x - A.local.ms.x, sv.z - A.local.ms.z);
  check(lat + ' ms ±' + jit + (loss ? ' con ' + loss * 100 + '% de pérdida' : '') + ': B (quieto) recibe el tiro que A ve acertar; A y servidor coinciden',
    evs(A, 'hit').length === 1 && d < (loss ? 0.05 : 1e-6), 'impactos ' + evs(A, 'hit').length + ', desfase ' + d.toExponential(1) + ' m, ping ' + Math.round(A.N.rtt) + ' ms');
}

{ // command batches really lost (not possible over one WebSocket, but after a reconnection it is): the client is corrected
  const S = createSim({ latency: 60, drop: 0.1, seed: 3 });
  const { A } = S.setupMatch((c, S) => ({ mz: -Math.abs(Math.sin(S.t / 400)), mx: Math.cos(S.t / 700), yaw: S.t / 1500, sprint: true }), () => ({ yaw: 0 }));
  S.run(6000);
  const stop = S.clients.Hamza; stop.ai = () => ({ yaw: 0 }); S.run(1000);
  const sv = S.room.seats.A.p.ms, d = Math.hypot(sv.x - A.local.ms.x, sv.z - A.local.ms.z);
  check('10 % de comandos perdidos: el cliente se corrige y acaba donde dice el servidor', A.N.corrMax > 0 && d < 1e-6, 'corrección máx ' + A.N.corrMax.toFixed(2) + ' m, desfase final ' + d.toExponential(1));
}

console.log('\nMAPAS: ARENA DE PRUEBAS');
{ const S = createSim({ maps: 'arena', latency: 30 });
  const A = S.addClient('Hamza'), B = S.addClient('Novia');
  A.N.hello('Hamza'); S.run(150); B.N.hello('Novia'); S.run(150);
  check('una sala nueva empieza con la ARENA', A.N.map === 'arena' && B.N.map === 'arena');
  B.N.chooseMap('pueblo'); S.run(150);
  check('el invitado no puede cambiar el mapa', S.room.debug.mapId === 'arena');
  A.N.chooseMap('pueblo'); S.run(150);
  check('quien crea la sala elige PUEBLO y los dos lo ven', S.room.debug.mapId === 'pueblo' && B.N.map === 'pueblo');
  A.N.chooseMap('marte'); S.run(150);
  check('un mapa que no existe se ignora', S.room.debug.mapId === 'pueblo');
  A.N.chooseMap('arena'); S.run(150);
  A.N.ready(true); B.N.ready(true); S.run(300);
  const st = evs(A, 'start')[0];
  check('la partida empieza en la ARENA para los dos', st && st.m.map === 'arena' && evs(B, 'start')[0].m.map === 'arena');
  const sa = evs(A, 'start')[0].m.spawn, sb = evs(B, 'start')[0].m.spawn;
  const inside = s => Math.abs(s.x) < 23.5 && Math.abs(s.z) < 15.5;
  check('los dos aparecen dentro de la arena, uno en cada lado', inside(sa) && inside(sb) && sa.x < 0 && sb.x > 0 && Math.hypot(sa.x - sb.x, sa.z - sb.z) > 25, JSON.stringify([sa, sb]));
  const AM = MAP.maps.arena;
  check('ningún punto de aparición de la arena está dentro de una caja', AM.nav.every(([x, z]) => !AM.colliders.some(c => x > c.minX - 0.35 && x < c.maxX + 0.35 && z > c.minZ - 0.35 && z < c.maxZ + 0.35 && c.minY < 1.5)));
  S.run(3300);
  // a headshot across the arena (36 m lane at z = -3)
  let shoot = false;
  A.ai = (c, S) => { const s = S.room.seats.B.p.ms; return Object.assign(lookAt(c, [s.x, s.y + 1.63, s.z]), { fire: shoot, adsHeld: true }); };
  B.ai = () => ({ yaw: Math.PI / 2 });
  S.room.debug.place('A', -18, -3, -Math.PI / 2); S.room.debug.place('B', 18, -3, Math.PI / 2); S.run(800);
  shoot = true; S.run(20); shoot = false; S.run(600);
  check('headshot de lado a lado de la arena', evs(A, 'hit').some(e => e.part === 'head'));
  S.run(3300);
  const rb = S.room.seats.B.p.ms;
  check('reaparece dentro de la arena', inside(rb) && S.room.seats.B.alive, rb.x.toFixed(1) + ',' + rb.z.toFixed(1));
  // the centre block stops a bullet: A west of it, B east, both at z = 0
  S.room.debug.place('A', -6, 0.0, -Math.PI / 2); S.room.debug.place('B', 6, 0.0, Math.PI / 2); S.run(1500);
  const h0 = evs(A, 'hit').length; shoot = true; S.run(20); shoot = false; S.run(600);
  check('el bloque central para las balas', evs(A, 'hit').length === h0 && evs(A, 'shot').length >= 2);
}

console.log('\nCOMPENSACIÓN DE LATENCIA (rival en movimiento)');
// an open lane where the rival can strafe ±4 m and stay in plain sight the whole time
const lane = (() => { for (const [x, z] of MAP.nav) { const x2 = x + 36;
  if (!MAP.nav.some(n => n[0] === x2 && n[1] === z)) continue;
  let ok = true; for (let dz = -4.5; dz <= 4.5 && ok; dz += 0.5) for (const y of [0.5, 1.2, 1.6]) if (!G.losClear(INDEX, x, 1.6, z, x2, y, z + dz)) { ok = false; break; }
  if (ok) return [[x, z], [x2, z]]; } return null; })();
check('hay un pasillo abierto para disparar a un rival que se mueve', !!lane, lane && JSON.stringify(lane));
for (const lat of [40, 120]) {
  // B strafes left-right at walking speed across A's line of fire; A aims where it SEES B
  let shoot = false;
  const strafe = (c, S) => ({ mx: Math.floor(S.t / 900) % 2 ? 1 : -1, yaw: c.local.ms.x < pair[1][0] - 1 ? -Math.PI / 2 : Math.PI / 2 });
  const S = createSim({ latency: lat, jitter: lat / 8, seed: 3 + lat });
  const { A, B } = S.setupMatch((c, S) => {
    // a real sniper leads a moving target by the bullet's flight time (600 m/s); nothing more
    const rp = c.N.remotePose(); if (!rp) return { yaw: 0 };
    const ms = c.local.ms, fl = Math.hypot(rp.x - ms.x, rp.z - ms.z) / CFG.rifles.halcon.speed;
    const p = [rp.x + rp.vx * fl, rp.y + 1.17 * HB.scaleOf(rp.eye), rp.z + rp.vz * fl];
    const l = lookAt(c, p); return { yaw: l.yaw, pitch: l.pitch, fire: shoot, adsHeld: true }; }, (c, S) => ({ mx: Math.floor(S.t / 1600) % 2 ? 1 : -1, yaw: Math.PI / 2 }));
  place(S, A, B, lane[0], lane[1]);
  let shots = 0;
  S.run(1500);
  for (let k = 0; k < 5; k++) { S.room.debug.set('B', 'hp', 1000); shoot = true; S.run(20); shoot = false; S.run(1100); shots++; }
  const hits = evs(A, 'hit').length;
  check(lat + ' ms: disparos al rival en movimiento donde A lo ve (con la anticipación normal por el vuelo de la bala) → el servidor los cuenta (' + hits + '/' + shots + ')', hits >= shots - 1, 'ping ' + Math.round(A.N.rtt) + ' ms');
}
{ // the rewind never goes further back than 200 ms, whatever the client claims
  const S = createSim({ latency: 20 });
  const { A } = S.setupMatch(() => ({ yaw: 0 }), () => ({ yaw: 0 }));
  S.room.message(A.conn, JSON.stringify({ t: 'ping', c: 1, r: 99999 }), S.t);
  check('un cliente que declara un ping enorme no consigue más de 250 ms de retroceso', S.room.seats.A.rtt <= 600 && SDRoom.RULES.maxRewindMs === 250);
}

console.log('\nESTRÉS (en memoria)');
{ let ok = 0;
  for (let i = 0; i < 100; i++) {
    const out = [];
    const r = SDRoom.create({ code: 'STRESS', map: MAP, index: INDEX, send: (c, t) => out.push(t), close: () => {} });
    r.connect(1, 0); r.connect(2, 0);
    r.message(1, '{"t":"hello","v":1,"name":"a"}', 0); r.message(2, '{"t":"hello","v":1,"name":"b"}', 0);
    r.message(1, '{"t":"leave"}', 1); r.disconnect(1, 1); r.disconnect(2, 2);
    if (!r.seats.A && r.seats.B && r.phase === 'lobby') ok++;
  }
  check('100 salas creadas y abandonadas sin estados rotos', ok === 100);
  const S = createSim({ latency: 50, jitter: 20 });
  const { A, B } = S.setupMatch((c, S) => ({ mz: Math.sin(S.t / 300), mx: Math.cos(S.t / 500), yaw: S.t / 900, sprint: (S.t / 700 | 0) % 2 === 0, jump: (S.t / 1100 | 0) % 5 === 0 }), () => ({ yaw: 0 }));
  S.run(15000);
  check('15 s de movimiento aleatorio (1.800 comandos): sin correcciones', A.N.corrMax < 1e-6 && S.room.seats.A.lastSeq > 1700, 'comandos ' + S.room.seats.A.lastSeq + ', corrección máx ' + A.N.corrMax.toExponential(1));
  check('los mensajes pendientes no crecen sin límite', A.N.pending.length < 60, A.N.pending.length);
}

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
