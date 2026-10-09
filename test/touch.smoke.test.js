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
{ SD.SETTINGS.releaseFire = true;
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
