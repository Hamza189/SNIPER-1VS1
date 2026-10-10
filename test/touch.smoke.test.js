/* Stage B integration test: the whole game booted as a TOUCH device (844×390 landscape),
   driven by pointer events on the touch layer. Not a real phone: no Safari/Chrome, no real
   fingers, no rendering. Run: node test/touch.smoke.test.js */
'use strict';
const { boot } = require('./harness.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

const H = boot({ touch: true, width: 844, height: 390 });
const { SD } = H;
check('el juego arranca como dispositivo táctil', H.errors.length === 0 && !!SD);
const hs = () => Math.hypot(SD.PM.vx, SD.PM.vz);

console.log('\nMOVIMIENTO TÁCTIL');
SD.setMode('range'); SD.setTrain('off'); SD.startMatch(); H.frames(60, 16);
check('al empezar se muestran los controles táctiles', H.el('#touch').hidden === false);
Object.assign(SD.PM, { x: 2, z: 75, vx: 0, vz: 0 }); SD.P.yaw = Math.PI;      // open ground in the range
H.pointer('pointerdown', 1, 150, 260, null);
H.pointer('pointermove', 1, 150, 260 - 30, null); H.frames(40, 16);
check('joystick a media carrera: anda sin esprintar', hs() > 1.5 && hs() < 4.7 && !SD.PM.sprinting, hs().toFixed(2) + ' m/s');
H.pointer('pointermove', 1, 150, 260 - 90, null); H.frames(60, 16);
check('joystick al fondo hacia delante: sprint automático', SD.PM.sprinting && Math.abs(hs() - 7) < 0.05, hs().toFixed(2) + ' m/s');
H.pointer('pointerdown', 5, 615, 341, 'crouch'); H.pointer('pointerup', 5, 615, 341, 'crouch'); H.frames(3, 16);
check('AGACH esprintando = slide', SD.PM.sliding, SD.PM.mode);
H.frames(60, 16);
H.pointer('pointerdown', 5, 615, 341, 'crouch'); H.pointer('pointerup', 5, 615, 341, 'crouch'); H.frames(30, 16);
check('AGACH otra vez: te levantas', !SD.PM.crouch);
H.pointer('pointerdown', 6, 780, 238, 'jump'); H.pointer('pointerup', 6, 780, 238, 'jump'); H.frames(4, 16);
check('SALTO salta', !SD.PM.onGround && SD.PM.vy > 0);
H.frames(60, 16);
H.pointer('pointerup', 1, 150, 170, null); H.frames(30, 16);
check('soltar el joystick: el jugador frena', hs() < 0.1, hs().toFixed(2) + ' m/s');

console.log('\nCÁMARA Y DISPARO');
{ const y0 = SD.P.yaw;
  H.pointer('pointerdown', 2, 600, 150, null); H.pointer('pointermove', 2, 650, 150, null); H.frames(2, 16);
  const dYaw = SD.P.yaw - y0;
  check('arrastrar a la derecha gira la cámara a la derecha', dYaw < 0, (dYaw * 1000).toFixed(1) + ' mrad');
  H.pointer('pointerup', 2, 650, 150, null);
  // sensitivity: double horizontal sensitivity → double turn for the same drag
  SD.SETTINGS.sensH = 2; const y1 = SD.P.yaw;
  H.pointer('pointerdown', 2, 600, 150, null); H.pointer('pointermove', 2, 650, 150, null); H.frames(2, 16); H.pointer('pointerup', 2, 650, 150, null);
  check('doble sensibilidad horizontal = doble giro', Math.abs((SD.P.yaw - y1) / dYaw - 2) < 0.02, ((SD.P.yaw - y1) / dYaw).toFixed(3) + '×');
  SD.SETTINGS.sensH = 1;
}
{ SD.SETTINGS.releaseFire = false; // classic mode: FIRE shoots on press
  SD.SETTINGS.adsMode = 'toggle';   // MIRA as a switch (one of the three modes in Ajustes)
  H.frames(30, 16); const s0 = SD.STATS.shots;
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(2, 16); H.pointer('pointerup', 3, 779, 325, 'fire'); H.frames(5, 16);
  check('tocar FUEGO dispara una vez', SD.STATS.shots - s0 === 1);
  H.frames(70, 16);
  H.pointer('pointerdown', 4, 689, 327, 'scope'); H.pointer('pointerup', 4, 689, 327, 'scope'); H.frames(20, 16);
  check('MIRA activa el telescopio (y se queda puesto)', SD.WCORE.ads === 1);
  const y0 = SD.P.yaw, s1 = SD.STATS.shots;
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.pointer('pointermove', 3, 789, 325, 'fire'); H.frames(3, 16);
  check('disparar con la mira y arrastrar el dedo de FUEGO a la vez', SD.STATS.shots - s1 === 1 && SD.P.yaw !== y0);
  H.pointer('pointerup', 3, 789, 325, 'fire');
  H.pointer('pointerdown', 7, 644, 266, 'breath'); H.frames(5, 16);
  check('AIRE mantenido: aguanta la respiración', SD.P.holding);
  H.pointer('pointerup', 7, 644, 266, 'breath'); H.frames(3, 16);
  check('soltar AIRE: respira', !SD.P.holding);
  H.pointer('pointerdown', 4, 689, 327, 'scope'); H.pointer('pointerup', 4, 689, 327, 'scope'); H.frames(20, 16);
  check('MIRA otra vez: quita el telescopio', SD.WCORE.ads === 0);
}

console.log('\nMANTENER FUEGO = MIRA, SOLTAR = DISPARO (opción por defecto)');
{ SD.SETTINGS.releaseFire = true; SD.SETTINGS.adsMode = 'toggle';
  check('la opción viene activada por defecto', require('../client/settings.js').DEFAULTS.releaseFire === true);
  H.frames(90, 16);
  const s0 = SD.STATS.shots, y0 = SD.P.yaw;
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(30, 16);
  check('mantener FUEGO sube la mira sin disparar', SD.WCORE.ads === 1 && SD.STATS.shots === s0, 'ads ' + SD.WCORE.ads.toFixed(2));
  H.pointer('pointermove', 3, 795, 320, 'fire'); H.frames(3, 16);
  check('con el dedo en FUEGO se apunta arrastrando', SD.P.yaw !== y0 && SD.STATS.shots === s0);
  H.pointer('pointerup', 3, 795, 320, 'fire'); H.frames(1, 16);
  check('soltar FUEGO dispara una vez, con la mira', SD.STATS.shots - s0 === 1);
  H.frames(40, 16);
  check('después del disparo la mira baja sola', SD.WCORE.ads === 0 && SD.STATS.shots - s0 === 1);
  // a hold that is interrupted by the pause does not shoot later
  H.frames(90, 16); const s1 = SD.STATS.shots;
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(10, 16);
  SD.pause(); H.pointer('pointerup', 3, 779, 325, 'fire'); SD.resume(); H.frames(20, 16);
  check('pausar con FUEGO pulsado no dispara al volver', SD.STATS.shots === s1);
  // with the scope already toggled on, the scope stays after the shot
  H.frames(90, 16);
  H.pointer('pointerdown', 4, 689, 327, 'scope'); H.pointer('pointerup', 4, 689, 327, 'scope'); H.frames(20, 16);
  const s2 = SD.STATS.shots;
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(3, 16); H.pointer('pointerup', 3, 779, 325, 'fire'); H.frames(30, 16);
  check('con MIRA ya puesta: soltar dispara y la mira se queda', SD.STATS.shots - s2 === 1 && SD.WCORE.ads === 1);
  H.pointer('pointerdown', 4, 689, 327, 'scope'); H.pointer('pointerup', 4, 689, 327, 'scope'); H.frames(20, 16);
  // released while the bolt is still far from ready: no late shot, and the scope does not stay stuck
  H.frames(90, 16); const s3 = SD.STATS.shots;
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(3, 16); H.pointer('pointerup', 3, 779, 325, 'fire'); H.frames(2, 16);
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(3, 16); H.pointer('pointerup', 3, 779, 325, 'fire'); H.frames(120, 16);
  check('soltar otra vez con el cerrojo a medias: ni disparo tardío ni mira atascada', SD.STATS.shots - s3 === 1 && SD.WCORE.ads === 0, (SD.STATS.shots - s3) + ' disparo(s)');
  // the system cancels the finger (incoming call, notification, edge swipe): no shot
  H.frames(120, 16); const s4 = SD.STATS.shots;
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(20, 16); H.pointer('pointercancel', 3, 779, 325, 'fire'); H.frames(30, 16);
  check('toque cancelado por el sistema: no dispara y la mira baja', SD.STATS.shots === s4 && SD.WCORE.ads === 0);
  // change weapon while holding FIRE, then come back to the rifle and lift: no shot
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(10, 16);
  for (let k = 0; k < 3; k++) { H.pointer('pointerdown', 8, 642, 200, 'swap'); H.pointer('pointerup', 8, 642, 200, 'swap'); H.frames(40, 16); }   // rifle → pistol → knife → rifle
  H.frames(20, 16);
  const sw0 = SD.STATS.meleeSwings || 0;
  H.pointer('pointerup', 3, 779, 325, 'fire'); H.frames(30, 16);
  check('cambiar de arma con FUEGO pulsado: al soltar no dispara ni ataca', SD.LOAD.active === 'rifle' && SD.STATS.shots === s4 && (SD.STATS.meleeSwings || 0) === sw0);
  // reload: hold FIRE, start the reload, lift during it → no shot, the reload finishes
  H.frames(60, 16); SD.WCORE.ammo = 2;
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(5, 16);
  H.pointer('pointerdown', 6, 711, 254, 'reload'); H.pointer('pointerup', 6, 711, 254, 'reload'); H.frames(30, 16);
  const inReload = SD.WCORE.state === 'reload';
  H.pointer('pointerup', 3, 779, 325, 'fire'); H.frames(200, 16);
  check('soltar FUEGO durante la recarga: no dispara y la recarga termina', inReload && SD.STATS.shots === s4 && SD.WCORE.ammo === 5, 'balas ' + SD.WCORE.ammo);
  // rotating the phone to portrait while holding FIRE pauses the game: no shot on return
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(10, 16);
  const s5 = SD.STATS.shots;
  H.ctx.innerWidth = 390; H.ctx.innerHeight = 844; H.fire('window', 'resize'); H.frames(5, 16);
  H.pointer('pointerup', 3, 779, 325, 'fire');
  H.ctx.innerWidth = 844; H.ctx.innerHeight = 390; H.fire('window', 'resize'); H.frames(5, 16);
  if (SD.state === 'paused') SD.resume();
  H.frames(30, 16);
  check('girar el móvil con FUEGO pulsado: no dispara al volver', SD.STATS.shots === s5 && SD.state === 'playing', SD.state);
  H.frames(60, 16); const s6 = SD.STATS.shots;
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(10, 16);
  H.fire('window', 'blur'); H.pointer('pointerup', 3, 779, 325, 'fire'); const pausedOnBlur = SD.state === 'paused';
  SD.resume(); H.frames(30, 16);
  check('el navegador pierde el foco con FUEGO pulsado: pausa y no dispara', pausedOnBlur && SD.STATS.shots === s6);
}

console.log('\nMIRA MANTENIDA Y ARRASTRAR (modo por defecto)');
{ check('el modo por defecto del botón MIRA es mantener y arrastrar', require('../client/settings.js').DEFAULTS.adsMode === 'holdDrag');
  SD.SETTINGS.adsMode = 'holdDrag'; SD.SETTINGS.releaseFire = false;
  H.frames(90, 16);
  // finger 4 holds MIRA: the scope comes up and stays while the finger is down
  H.pointer('pointerdown', 4, 689, 327, 'scope'); H.frames(25, 16);
  check('mantener MIRA: entra el visor', SD.WCORE.ads === 1, 'ads ' + SD.WCORE.ads.toFixed(2));
  // the same finger, without lifting: drag right and up → the view turns right and up
  const y0 = SD.P.yaw, p0 = SD.P.pitch;
  H.pointer('pointermove', 4, 709, 317, 'scope'); H.frames(2, 16);
  check('sin soltar MIRA, arrastrar a la derecha gira a la derecha', SD.P.yaw < y0, ((SD.P.yaw - y0) * 1000).toFixed(2) + ' mrad');
  check('y arrastrar hacia arriba sube la mira', SD.P.pitch > p0, ((SD.P.pitch - p0) * 1000).toFixed(2) + ' mrad');
  // the turn while scoped is fine (scaled by the zoom), linear and frame-rate independent
  const y1 = SD.P.yaw; H.pointer('pointermove', 4, 719, 317, 'scope'); H.frames(1, 16); const a = SD.P.yaw - y1;
  const y2 = SD.P.yaw; H.pointer('pointermove', 4, 729, 317, 'scope'); H.frames(4, 33); const b = SD.P.yaw - y2;
  check('la misma distancia de dedo gira lo mismo (sin aceleración, sin depender de los FPS)', Math.abs(a - b) < 1e-9 && a < 0, (a * 1000).toFixed(3) + ' / ' + (b * 1000).toFixed(3) + ' mrad');
  // a second finger fires while the first keeps aiming; the joystick works at the same time
  const s0 = SD.STATS.shots;
  H.pointer('pointerdown', 1, 150, 250, null); H.pointer('pointermove', 1, 150, 210, null);
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(2, 16); H.pointer('pointerup', 3, 779, 325, 'fire');
  const y3 = SD.P.yaw; H.pointer('pointermove', 4, 739, 317, 'scope'); H.frames(2, 16);
  check('disparar con otro dedo mientras se mantiene MIRA', SD.STATS.shots - s0 === 1 && SD.WCORE.ads === 1);
  check('después del disparo el dedo de MIRA sigue apuntando', SD.P.yaw < y3);
  H.frames(20, 16);
  check('el joystick sigue moviendo a la vez', hs() > 0.5, hs().toFixed(2) + ' m/s');
  H.pointer('pointerup', 1, 150, 210, null);
  // lifting MIRA leaves the scope; a system cancel too
  H.pointer('pointerup', 4, 739, 317, 'scope'); H.frames(25, 16);
  check('soltar MIRA: sale del visor', SD.WCORE.ads === 0);
  H.frames(80, 16);
  H.pointer('pointerdown', 4, 689, 327, 'scope'); H.frames(20, 16); H.pointer('pointercancel', 4, 689, 327, 'scope'); H.frames(25, 16);
  const y4 = SD.P.yaw; H.frames(10, 16);
  check('toque de MIRA cancelado por el sistema: sale del visor y la cámara no sigue girando', SD.WCORE.ads === 0 && SD.P.yaw === y4);
  // MANTENER mode: the scope comes up but that finger does not turn the camera
  SD.SETTINGS.adsMode = 'hold';
  H.pointer('pointerdown', 4, 689, 327, 'scope'); H.frames(25, 16); const y5 = SD.P.yaw;
  H.pointer('pointermove', 4, 729, 327, 'scope'); H.frames(2, 16);
  check('modo MANTENER: visor sí, pero ese dedo no gira la cámara', SD.WCORE.ads === 1 && SD.P.yaw === y5);
  H.pointer('pointerup', 4, 729, 327, 'scope'); H.frames(25, 16);
  check('modo MANTENER: soltar sale del visor', SD.WCORE.ads === 0);
  SD.SETTINGS.adsMode = 'holdDrag';
  // sensitivity while aiming: double horizontal aim multiplier → double turn
  H.frames(60, 16);
  H.pointer('pointerdown', 4, 689, 327, 'scope'); H.frames(25, 16);
  H.pointer('pointermove', 4, 699, 327, 'scope'); H.frames(1, 16);
  const y6 = SD.P.yaw; H.pointer('pointermove', 4, 709, 327, 'scope'); H.frames(1, 16); const c1 = SD.P.yaw - y6;
  SD.SETTINGS.adsH = 2; const y7 = SD.P.yaw; H.pointer('pointermove', 4, 719, 327, 'scope'); H.frames(1, 16); const c2 = SD.P.yaw - y7;
  check('MIRA HORIZONTAL ×2 = el doble de giro al apuntar', Math.abs(c2 / c1 - 2) < 0.02, (c2 / c1).toFixed(3) + '×');
  SD.SETTINGS.adsH = 1;
  H.pointer('pointerup', 4, 719, 327, 'scope'); H.frames(25, 16);
  // smoothing: the full turn still arrives (nothing lost), just spread over a few frames
  SD.SETTINGS.smooth = 0.5;
  const y8 = SD.P.yaw; H.pointer('pointerdown', 2, 600, 150, null); H.pointer('pointermove', 2, 650, 150, null); H.frames(1, 16); const part = SD.P.yaw - y8;
  H.frames(40, 16); H.pointer('pointerup', 2, 650, 150, null); const full = SD.P.yaw - y8;
  SD.SETTINGS.smooth = 0;
  const y9 = SD.P.yaw; H.pointer('pointerdown', 2, 600, 150, null); H.pointer('pointermove', 2, 650, 150, null); H.frames(2, 16); H.pointer('pointerup', 2, 650, 150, null); const direct = SD.P.yaw - y9;
  check('suavizado: el giro completo llega igual, repartido en unos fotogramas', Math.abs(full / direct - 1) < 0.01 && Math.abs(part) < Math.abs(full) * 0.9, (part / full).toFixed(2) + ' en el primer fotograma');
}

console.log('\nRIFLE, PISTOLA Y NAVAJA EN MÓVIL');
{ H.frames(80, 16);
  H.pointer('pointerdown', 8, 642, 200, 'swap'); H.pointer('pointerup', 8, 642, 200, 'swap'); H.frames(30, 16);
  check('ARMA saca la pistola', SD.LOAD.active === 'pistol' && SD.LOAD.phase === 'ready');
  check('con pistola: MIRA sigue (alzas) y el botón dice FUEGO', H.el('#tbScope').hidden === false && H.el('#tbFire').textContent === 'FUEGO');
  { const s0 = SD.STATS.shots;
    H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(1, 16); H.pointer('pointerup', 3, 779, 325, 'fire'); H.frames(15, 16);
    H.pointer('pointerdown', 3, 779, 325, 'fire'); H.frames(1, 16); H.pointer('pointerup', 3, 779, 325, 'fire'); H.frames(15, 16);
    check('con pistola, FUEGO dispara al tocar (semiautomática): dos toques, dos disparos', SD.STATS.shots - s0 === 2 && SD.PCORE.ammo === 10, (SD.STATS.shots - s0) + ' disparos, quedan ' + SD.PCORE.ammo); }
  H.pointer('pointerdown', 8, 642, 200, 'swap'); H.pointer('pointerup', 8, 642, 200, 'swap'); H.frames(30, 16);
  check('ARMA otra vez saca la navaja', SD.LOAD.active === 'knife' && SD.LOAD.phase === 'ready');
  check('con navaja: MIRA se oculta e INSP aparece', H.el('#tbScope').hidden === true && H.el('#tbInspect').hidden === false);
  const sw = SD.STATS.meleeSwings || 0;
  H.pointer('pointerdown', 3, 779, 325, 'fire'); H.pointer('pointerup', 3, 779, 325, 'fire'); H.frames(30, 16);
  check('FUEGO con navaja = ataque', (SD.STATS.meleeSwings || 0) - sw === 1);
  H.pointer('pointerdown', 9, 582, 266, 'inspect'); H.pointer('pointerup', 9, 582, 266, 'inspect'); H.frames(3, 16);
  check('INSP inspecciona la navaja', SD.LOAD.knife.state === 'inspect');
  H.frames(120, 16);
  H.pointer('pointerdown', 8, 642, 200, 'swap'); H.pointer('pointerup', 8, 642, 200, 'swap'); H.frames(35, 16);
  check('ARMA otra vez: vuelve el rifle', SD.LOAD.active === 'rifle' && SD.LOAD.phase === 'ready' && H.el('#tbScope').hidden === false);
}

console.log('\nPAUSA, ORIENTACIÓN Y GUARDADO');
{ H.pointer('pointerdown', 1, 150, 260, null); H.pointer('pointermove', 1, 150, 180, null); H.frames(5, 16);
  H.pointer('pointerdown', 'p', 30, 30, 'pause');
  check('pausa con el joystick pulsado: se sueltan todos los dedos', SD.state === 'paused' && SD.TOUCH.stickId === null && SD.TOUCH.held.size === 0 && SD.input.joyY === 0);
  SD.resume(); H.frames(30, 16);
  check('al reanudar el jugador no sigue andando solo', hs() < 0.1, hs().toFixed(2) + ' m/s');
  // portrait while playing → warning + pause
  H.ctx.innerWidth = 390; H.ctx.innerHeight = 844; H.fire('window', 'resize');
  check('en vertical: aviso de girar el móvil y el juego se pausa', H.el('#rotate').hidden === false && SD.state === 'paused');
  H.ctx.innerWidth = 844; H.ctx.innerHeight = 390; H.fire('window', 'resize');
  check('al volver a horizontal desaparece el aviso', H.el('#rotate').hidden === true);
  SD.resume(); H.frames(5, 16);
  // settings persistence
  H.el('#sH').value = '1.6'; H.fire('#sH', 'input');
  const saved = JSON.parse(H.storage['sniperduel_settings'] || 'null');
  check('cambiar la sensibilidad se guarda en el móvil', saved && saved.sensH === 1.6, saved && saved.sensH);
  H.el('#sInv').checked = true; H.fire('#sInv', 'change');
  check('invertir eje vertical se guarda', JSON.parse(H.storage['sniperduel_settings']).invertY === true);
}

console.log('\nMIRA CON TOUCH EVENTS (el camino que usa Safari en iPhone)');
{ // iOS Safari: every finger arrives as a Touch with its own identifier and keeps reporting to the element it started on
  const T = (id, x, y, btn) => ({ identifier: id, clientX: x, clientY: y, target: { closest: () => (btn ? { dataset: { btn } } : null) } });
  const live = new Map();
  const send = (type, touch) => {
    if (type === 'touchstart' || type === 'touchmove') live.set(touch.identifier, touch); else live.delete(touch.identifier);
    H.fire('#touch', type, { changedTouches: [touch], touches: [...live.values()] });
  };
  check('en un dispositivo con touch events el juego los usa', SD.TOUCH_EVENTS === true);
  SD.SETTINGS.adsMode = 'holdDrag'; SD.SETTINGS.releaseFire = false; SD.SETTINGS.invertY = false; H.frames(60, 16);   // (an earlier section left the Y axis inverted)
  // a pointer event of type 'touch' for the same finger must be ignored (iOS sends both)
  send('touchstart', T(7, 689, 327, 'scope'));
  H.fire('#touch', 'pointerdown', { pointerId: 99, pointerType: 'touch', clientX: 689, clientY: 327, target: { closest: () => ({ dataset: { btn: 'scope' } }) } });
  H.frames(25, 16);
  check('touch: mantener MIRA entra el visor (el dedo cuenta una sola vez)', SD.WCORE.ads === 1 && SD.TOUCH.held.size === 1, 'ads ' + SD.WCORE.ads + ' · botones ' + SD.TOUCH.held.size);
  const y0 = SD.P.yaw, p0 = SD.P.pitch;
  send('touchmove', T(7, 712, 316, 'scope')); H.frames(2, 16);
  check('touch: arrastrar ese mismo dedo gira y sube la mira', SD.P.yaw < y0 && SD.P.pitch > p0, ((SD.P.yaw - y0) * 1000).toFixed(2) + ' / ' + ((SD.P.pitch - p0) * 1000).toFixed(2) + ' mrad');
  // second finger fires, third finger walks, MIRA keeps aiming
  const s0 = SD.STATS.shots;
  send('touchstart', T(8, 150, 250, null)); send('touchmove', T(8, 150, 205, null));
  send('touchstart', T(9, 779, 325, 'fire')); H.frames(2, 16); send('touchend', T(9, 779, 325, 'fire'));
  const y1 = SD.P.yaw; send('touchmove', T(7, 730, 316, 'scope')); H.frames(20, 16);
  check('touch: disparo con otro dedo, joystick a la vez y MIRA sigue apuntando', SD.STATS.shots - s0 === 1 && SD.P.yaw < y1 && SD.WCORE.ads === 1 && hs() > 0.5, (SD.STATS.shots - s0) + ' disparo · ' + hs().toFixed(2) + ' m/s');
  send('touchend', T(8, 150, 205, null));
  send('touchend', T(7, 730, 316, 'scope')); H.frames(25, 16);
  check('touch: soltar MIRA sale del visor', SD.WCORE.ads === 0 && SD.TOUCH.held.size === 0 && SD.TOUCH.look.size === 0);
  // the system swallows a touchend (edge swipe…): the next touch event closes the lost finger
  send('touchstart', T(10, 689, 327, 'scope')); H.frames(25, 16);
  live.delete(10);                                                  // finger gone, no touchend delivered
  send('touchstart', T(11, 600, 200, null)); H.frames(25, 16);
  check('touch: un dedo perdido sin touchend no deja MIRA pegada', SD.WCORE.ads === 0 && !SD.TOUCH.held.size, 'ads ' + SD.WCORE.ads);
  send('touchend', T(11, 600, 200, null));
  send('touchstart', T(12, 689, 327, 'scope')); H.frames(20, 16); send('touchcancel', T(12, 689, 327, 'scope')); H.frames(25, 16);
  check('touch: touchcancel sale del visor', SD.WCORE.ads === 0);
  // diagnostics panel shows the fingers
  SD.TDIAG.set(true); SD.TDIAG.reset();
  send('touchstart', T(13, 689, 327, 'scope')); send('touchmove', T(13, 700, 327, 'scope')); H.frames(12, 16);
  const txt = H.el('#tdiag').textContent || '';
  check('diagnóstico táctil: muestra el dedo de MIRA, sus movimientos y el giro', /MIRA/.test(txt) && /#t13/.test(txt) && /mov/.test(txt) && /giro/.test(txt), txt.split('\n').slice(0, 3).join(' | '));
  send('touchend', T(13, 700, 327, 'scope')); SD.TDIAG.set(false); H.frames(25, 16);
}

console.log('\nMIRA PULSAR (TOGGLE, opcional en AJUSTES): toca para entrar, mueve la cámara con cualquier dedo libre');
{ const T = (id, x, y, btn) => ({ identifier: id, clientX: x, clientY: y, target: { closest: () => (btn ? { dataset: { btn } } : null) } });
  const live = new Map();
  const send = (type, t) => { if (type === 'touchstart' || type === 'touchmove') live.set(t.identifier, t); else live.delete(t.identifier); H.fire('#touch', type, { changedTouches: [t], touches: [...live.values()] }); };
  const tap = (id, x, y, btn) => { send('touchstart', T(id, x, y, btn)); H.frames(2, 16); send('touchend', T(id, x, y, btn)); };
  SD.SETTINGS.adsMode = 'toggle'; SD.SETTINGS.invertY = false; SD.SETTINGS.releaseFire = true; H.frames(60, 16);
  if (SD.LOAD.active !== 'rifle') { SD.input.select = 'rifle'; H.frames(60, 16); }
  tap(20, 689, 327, 'scope'); H.frames(25, 16);
  check('toggle: un toque en MIRA entra en el visor y sigue dentro al levantar el dedo', SD.WCORE.ads === 1 && SD.TOUCH.held.size === 0, 'ads ' + SD.WCORE.ads);
  const y0 = SD.P.yaw, p0 = SD.P.pitch;
  send('touchstart', T(21, 560, 200, null)); send('touchmove', T(21, 585, 188, null)); H.frames(2, 16);
  check('toggle: un dedo en la zona libre derecha mueve la cámara con el visor puesto', SD.P.yaw < y0 && SD.P.pitch > p0 && SD.WCORE.ads === 1, ((SD.P.yaw - y0) * 1000).toFixed(2) + ' mrad');
  const s0 = SD.STATS.shots;
  tap(22, 779, 325, 'fire'); H.frames(4, 16);
  check('toggle: FUEGO dispara al momento (también con «mantener FUEGO apunta») y no saca del visor', SD.STATS.shots === s0 + 1 && SD.WCORE.ads === 1, (SD.STATS.shots - s0) + ' disparo · ads ' + SD.WCORE.ads);
  const y1 = SD.P.yaw; send('touchmove', T(21, 600, 188, null)); H.frames(2, 16);
  check('toggle: después del disparo se sigue corrigiendo la mira', SD.P.yaw < y1);
  send('touchend', T(21, 600, 188, null));
  tap(23, 689, 327, 'scope'); H.frames(25, 16);
  check('toggle: otro toque en MIRA sale del visor', SD.WCORE.ads === 0);
  tap(24, 689, 327, 'scope'); H.frames(25, 16);
  SD.input.select = 'pistol'; H.frames(60, 16);
  check('toggle: cambiar de arma quita el visor', SD.input.scopeToggle === false && SD.PCORE.ads === 0);
  SD.input.select = 'rifle'; H.frames(60, 16);
  tap(25, 689, 327, 'scope'); H.frames(10, 16); SD.pause(); SD.resume(); H.frames(25, 16);
  check('toggle: al pausar y volver no se queda apuntando', SD.input.scopeToggle === false && SD.WCORE.ads === 0);
  SD.SETTINGS.releaseFire = false;
}

console.log('\nEDITOR DE BOTONES');
{ SD.pause(); SD.openEditor();
  check('el editor se abre y muestra los botones', SD.EDIT.on && H.el('#touch').hidden === false);
  const before = Object.assign({}, SD.LAYOUT.buttons.jump);
  H.pointer('pointerdown', 30, 844 - before.dx, 390 - before.dy, 'jump');
  H.pointer('pointermove', 30, 844 - before.dx - 120, 390 - before.dy - 40, 'jump');
  H.pointer('pointerup', 30, 844 - before.dx - 120, 390 - before.dy - 40, 'jump');
  const after = SD.LAYOUT.buttons.jump;
  check('arrastrar SALTO lo mueve', Math.abs(after.dx - before.dx - 120) < 1e-6 && Math.abs(after.dy - before.dy - 40) < 1e-6, 'dx ' + before.dx + '→' + after.dx);
  H.el('#edSize').value = '90'; H.fire('#edSize', 'input');
  check('cambiar el tamaño del botón elegido', SD.LAYOUT.buttons.jump.size === 90);
  const shotsBefore = SD.STATS.shots;
  H.pointer('pointerdown', 31, 779, 325, 'fire'); H.pointer('pointerup', 31, 779, 325, 'fire');
  check('en el editor los botones no disparan', SD.STATS.shots === shotsBefore && SD.input.firePressed === false);
  H.fire('#edSave', 'click');
  const L = JSON.parse(H.storage['sniperduel_touchLayout'] || 'null');
  check('GUARDAR conserva la disposición en el móvil', L && L.buttons.jump.size === 90 && !SD.EDIT.on);
  SD.openEditor(); H.fire('#edReset', 'click'); H.fire('#edCancel', 'click');
  check('RESTAURAR + CANCELAR deja la disposición guardada intacta', SD.LAYOUT.buttons.jump.size === 90);
  SD.openEditor(); H.fire('#edReset', 'click'); H.fire('#edSave', 'click');
  check('RESTAURAR + GUARDAR vuelve a la disposición por defecto', SD.LAYOUT.buttons.jump.size === 56 && JSON.parse(H.storage['sniperduel_touchLayout']).buttons.jump.size === 56);
}
{ // a second boot reads the saved settings and layout
  const H2 = boot({ touch: true, width: 844, height: 390, storage: H.storage });
  check('al volver a abrir el juego se recuperan ajustes y botones', H2.errors.length === 0 && H2.SD.SETTINGS.sensH === 1.6 && H2.SD.SETTINGS.invertY === true);
}

console.log('\nRESISTENCIA');
{ SD.resume(); H.frames(5, 16);
  let maxHeld = 0, maxLook = 0;
  const btns = ['fire', 'scope', 'jump', 'reload', 'swap', 'crouch', 'breath'];
  for (let k = 0; k < 400; k++) {
    const id = 100 + (k % 7), b = btns[k % btns.length];
    H.pointer('pointerdown', id, 400 + (k % 5) * 60, 200, k % 3 === 0 ? b : null);
    H.pointer('pointermove', id, 420 + (k % 5) * 60, 210, null);
    maxHeld = Math.max(maxHeld, SD.TOUCH.held.size); maxLook = Math.max(maxLook, SD.TOUCH.look.size);
    H.frames(2, 16);
    if (k % 2 === 0) H.pointer('pointerup', id, 420, 210, null); else H.pointer('pointercancel', id, 420, 210, null);
  }
  check('400 toques aleatorios con varios dedos: sin errores', H.errors.length === 0, H.errors[0] && H.errors[0].message);
  check('ningún dedo queda «pegado» al levantarlo', SD.TOUCH.held.size === 0 && SD.TOUCH.look.size === 0 && SD.TOUCH.stickId === null, 'máx ' + maxHeld + ' botones, ' + maxLook + ' cámara a la vez');
}

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
