/* Stage B tests: touch logic, settings and button layout (pure modules, no browser).
   Run: node test/mobile.test.js */
'use strict';
const CFG = require('../core/config.js');
const M = require('../core/movement.js');
const TS = require('../client/touch.js');
const ST = require('../client/settings.js');
const LY = require('../client/layout.js');

let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const W = 844, H = 390, R = TS.CFG.radius;
const fakeStore = () => { const m = {}; return { get: (k, d) => (k in m ? JSON.parse(m[k]) : d), set: (k, v) => { m[k] = JSON.stringify(v); }, raw: m }; };

console.log('\nJOYSTICK');
{ const c = TS.create();
  const r = TS.down(c, { id: 1, x: 150, y: 250, button: null, W });
  check('un dedo en la parte izquierda crea el joystick donde toca', !!r.stickStart && c.stickId === 1);
  TS.move(c, { id: 1, x: 150 + R * 0.08, y: 250 });
  check('zona muerta: un movimiento mínimo no mueve al jugador', c.jx === 0 && c.jy === 0);
  TS.move(c, { id: 1, x: 150, y: 250 - R * 0.5 });
  check('a media carrera hacia delante: avanza a media velocidad sin esprintar', c.jy < -0.35 && c.jy > -0.55 && !c.sprint, c.jy.toFixed(2));
  TS.move(c, { id: 1, x: 150, y: 250 - R * 1.5 });
  check('al fondo hacia delante: esprinta (y no pasa de 1)', c.sprint && Math.abs(c.jy + 1) < 1e-9, 'jy ' + c.jy.toFixed(2));
  TS.move(c, { id: 1, x: 150 + R * 2, y: 250 });
  check('al fondo hacia un lado: no esprinta', !c.sprint && Math.abs(c.jx - 1) < 1e-9);
  TS.move(c, { id: 1, x: 150 + R * 0.7071 * 2, y: 250 - R * 0.7071 * 2 });
  const mag = Math.hypot(c.jx, c.jy);
  check('diagonal: dirección correcta y nunca más rápido que recto', Math.abs(mag - 1) < 1e-6 && c.jx > 0 && c.jy < 0 && Math.abs(c.jx + c.jy) < 1e-6, mag.toFixed(3));
  const u = TS.up(c, 1);
  check('al levantar el dedo el joystick vuelve a cero', u.stickEnd && c.jx === 0 && c.jy === 0 && !c.sprint && c.stickId === null);
}
{ // joystick output fed to the real movement module
  const c = TS.create(); TS.down(c, { id: 1, x: 100, y: 250, button: null, W });
  const run = (x, y) => { TS.move(c, { id: 1, x, y }); const s = M.createState(); for (let i = 0; i < 240; i++) M.step(s, { mx: c.jx, mz: c.jy, yaw: 0, sprint: c.sprint }, 1 / 120, { colliders: [], ramps: [] }, CFG.move); return Math.hypot(s.vx, s.vz); };
  const vMax = run(100, 250 - R * 2), vSide = run(100 + R * 2, 250), vDiag = run(100 + R * 2, 250 - R * 2 + 1);
  check('joystick al fondo hacia delante = velocidad de sprint', Math.abs(vMax - CFG.move.sprint) < 0.01, vMax.toFixed(2) + ' m/s');
  check('joystick al fondo de lado = velocidad normal', Math.abs(vSide - CFG.move.walk) < 0.01, vSide.toFixed(2) + ' m/s');
  check('diagonal adelante al fondo = sprint, nunca más rápido que recto (como W+D+Shift en PC)', Math.abs(vDiag - CFG.move.sprint) < 0.01, vDiag.toFixed(2) + ' m/s');
}

console.log('\nVARIOS DEDOS');
{ const c = TS.create();
  TS.down(c, { id: 10, x: 120, y: 260, button: null, W });            // joystick
  TS.down(c, { id: 11, x: 600, y: 150, button: null, W });            // look
  TS.down(c, { id: 12, x: 780, y: 330, button: 'fire', W });          // fire
  TS.move(c, { id: 10, x: 120, y: 260 - R });
  TS.move(c, { id: 11, x: 640, y: 150 });
  TS.move(c, { id: 12, x: 790, y: 320 });
  const d = TS.drain(c);
  check('joystick + cámara + fuego a la vez', c.jy < -0.9 && Math.abs(d.dx - (40 + 10) * TS.CFG.lookGain) < 1e-9 && Math.abs(d.dy + 10 * TS.CFG.lookGain) < 1e-9, 'dx ' + d.dx.toFixed(1) + ' dy ' + d.dy.toFixed(1));
  check('arrastrar el dedo de FUEGO también apunta', TS.isHeld(c, 'fire'));
  check('drain deja el movimiento de cámara a cero', TS.drain(c).dx === 0);
  TS.down(c, { id: 13, x: 90, y: 120, button: null, W });             // second finger in the left zone
  TS.move(c, { id: 13, x: 100, y: 120 });
  check('un segundo dedo en la izquierda no roba el joystick: gira la cámara', c.stickId === 10 && TS.drain(c).dx > 0);
  const r = TS.up(c, 12);
  check('soltar FUEGO lo libera sin tocar el joystick', r.release === 'fire' && !TS.isHeld(c, 'fire') && c.stickId === 10);
  TS.up(c, 99);
  check('un dedo desconocido al levantarse no rompe nada', c.stickId === 10);
  TS.down(c, { id: 20, x: 700, y: 200, button: 'scope', W }); TS.down(c, { id: 21, x: 760, y: 300, button: 'fire', W });
  check('MIRA y FUEGO pulsados a la vez', TS.isHeld(c, 'scope') && TS.isHeld(c, 'fire'));
  TS.down(c, { id: 22, x: 500, y: 300, button: 'breath', W });
  check('AIRE se mantiene mientras el dedo está encima', TS.isHeld(c, 'breath'));
  TS.up(c, 22); check('al levantar el dedo se suelta AIRE', !TS.isHeld(c, 'breath'));
  TS.reset(c); check('reset (pausa) suelta todos los dedos', c.stickId === null && c.held.size === 0 && c.look.size === 0);
}

console.log('\nAJUSTES');
{ const d = ST.sanitize(null);
  check('valores por defecto', d.sensH === 1 && d.sensV === 1 && d.adsSens === 1 && !d.invertY && !d.leftFire);
  const s = ST.sanitize({ sensH: 99, sensV: -3, adsSens: 'abc', touchLook: 1.5, invertY: true, hack: 1 });
  check('valores fuera de rango se recortan, inválidos vuelven al defecto, claves raras se ignoran', s.sensH === 3 && s.sensV === 0.2 && s.adsSens === 1 && s.touchLook === 1.5 && s.invertY && !('hack' in s));
  const st = fakeStore(); ST.save(st, { sensH: 1.7, sensV: 0.8, invertY: true }); const back = ST.load(st);
  check('guardar y cargar conserva los ajustes', back.sensH === 1.7 && back.sensV === 0.8 && back.invertY);
  const old = fakeStore(); old.set('sens', 1.4); const mig = ST.load(old);
  check('la sensibilidad antigua del menú se conserva al actualizar', mig.sensH === 1.4 && mig.sensV === 1.4);
  const base = ST.lookDelta(10, 10, ST.sanitize({}), { scoped: false, fovRatio: 1, touch: false });
  const h2 = ST.lookDelta(10, 10, ST.sanitize({ sensH: 2 }), { scoped: false, fovRatio: 1, touch: false });
  check('sensibilidad horizontal y vertical independientes', Math.abs(h2.yaw - 2 * base.yaw) < 1e-12 && h2.pitch === base.pitch);
  const inv = ST.lookDelta(10, 10, ST.sanitize({ invertY: true }), { scoped: false, fovRatio: 1, touch: false });
  check('invertir eje vertical', inv.pitch === -base.pitch && inv.yaw === base.yaw);
  const sc = ST.lookDelta(10, 0, ST.sanitize({ adsSens: 0.5 }), { scoped: true, fovRatio: 0.125, touch: false });
  const hip = ST.lookDelta(10, 0, ST.sanitize({ adsSens: 0.5 }), { scoped: false, fovRatio: 1, touch: false });
  check('sensibilidad con mira solo se aplica con la mira puesta', Math.abs(sc.yaw - hip.yaw * 0.125 * 0.5) < 1e-12);
  const dPc = ST.load(fakeStore(), false), dMob = ST.load(fakeStore(), true);
  check('PC sin cambios: dedo 1, mira 1, horizontal/vertical 1', dPc.touchLook === 1 && dPc.adsSens === 1 && dPc.sensH === 1 && dPc.sensV === 1);
  check('móvil nuevo: dedo 1,6, mira 1,3, horizontal/vertical 1', dMob.touchLook === 1.6 && dMob.adsSens === 1.3 && dMob.sensH === 1 && dMob.sensV === 1);
  check('máximo del dedo 4,0', ST.RANGES.touchLook[1] === 4 && ST.sanitize({ touchLook: 9 }, true).touchLook === 4);
  const own = fakeStore(); ST.save(own, { touchLook: 2.2, adsSens: 0.9 }, true);
  check('un móvil con ajustes ya guardados conserva los suyos', ST.load(own, true).touchLook === 2.2 && ST.load(own, true).adsSens === 0.9);
  check('disparo al soltar se guarda', (() => { const st = fakeStore(); ST.save(st, { releaseFire: false }, true); return ST.load(st, true).releaseFire === false; })());
  const tch = ST.lookDelta(10, 0, ST.sanitize({ touchLook: 2 }), { scoped: false, fovRatio: 1, touch: true });
  check('sensibilidad táctil propia', Math.abs(tch.yaw - (-10 * 0.0042 * 2)) < 1e-12);
}

console.log('\nDISPOSICIÓN DE BOTONES');
{ const L = LY.defaults();
  for (const [w, h, name] of [[844, 390, 'iPhone 14 horizontal'], [667, 375, 'iPhone 8 horizontal'], [568, 320, 'iPhone SE horizontal'], [915, 412, 'Android grande']]) {
    let off = 0; for (const k in L.buttons) { const r = LY.rect(k, L.buttons[k], w, h); if (r.left < 0 || r.top < 0 || r.left + r.size > w || r.top + r.size > h) off++; }
    check('por defecto todos los botones caben en ' + name + ' (' + w + '×' + h + ')', off === 0, off + ' fuera');
  }
  // the buttons visible at the same time must not overlap on a typical phone
  const groups = [['fire', 'scope', 'crouch', 'jump', 'reload', 'swap'], ['fire', 'crouch', 'jump', 'reload', 'swap', 'inspect'], ['fire', 'scope', 'crouch', 'jump', 'reload', 'swap', 'breath', 'zoom']];
  let overl = [];
  for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const a = LY.rect(g[i], L.buttons[g[i]], 844, 390), b = LY.rect(g[j], L.buttons[g[j]], 844, 390);
    if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < (a.size + b.size) / 2) overl.push(g[i] + '/' + g[j]);
  }
  check('los botones que se ven a la vez no se solapan', overl.length === 0, overl.join(', ') || 'ninguno');
  const moved = LY.moveTo('fire', L.buttons.fire, 2000, -50, 844, 390);
  check('arrastrar un botón fuera de la pantalla lo deja en el borde', moved.dx === 47 && moved.dy === 390 - 47, 'dx ' + moved.dx + ' dy ' + moved.dy);
  const m2 = LY.moveTo('fire2', L.buttons.fire2, 100, 200, 844, 390);
  check('el FUEGO izquierdo se ancla a la izquierda', m2.dx === 100 && m2.dy === 190);
  const bad = LY.sanitize({ opacity: 5, buttons: { fire: { dx: 'x', dy: 30, size: 999 }, nope: {} } });
  check('datos guardados corruptos se reparan', bad.opacity === 1 && bad.buttons.fire.size === 140 && bad.buttons.fire.dx === 65 && !bad.buttons.nope);
  const st = fakeStore(); const L2 = LY.defaults(); L2.buttons.jump.size = 70; L2.opacity = 0.5; LY.save(st, L2);
  const back = LY.load(st);
  check('guardar y cargar la disposición', back.buttons.jump.size === 70 && back.opacity === 0.5);
  check('restaurar = disposición por defecto', JSON.stringify(LY.defaults()) === JSON.stringify(LY.sanitize(null)));
}

console.log('\nGRÁFICOS (etapa C)');
{ const Q = require('../client/quality.js');
  check('AUTO = MEDIO en móvil y ALTO en PC', Q.resolve('auto', true) === 'medio' && Q.resolve('auto', false) === 'alto' && Q.resolve('bajo', false) === 'bajo');
  check('resolución interna: el móvil (pantalla 3×) no pasa de 1,35× en MEDIO ni de 1,0× en BAJO', Q.pixelRatio('medio', 3, 1) === 1.35 && Q.pixelRatio('bajo', 3, 1) === 1 && Q.pixelRatio('alto', 1, 1) === 1);
  check('BAJO sin sombras; MEDIO y ALTO con sombras', !Q.PROFILES.bajo.shadows && Q.PROFILES.medio.shadows && Q.PROFILES.alto.shadows);
  const a = Q.createAdaptive(60, true);
  for (let i = 0; i < 2 * 1.6 * 38; i++) Q.feed(a, 1 / 38);           // 38 FPS for ~3 s
  check('a 38 FPS (objetivo 60) la resolución baja sola', a.scale < 1, 'escala ' + a.scale);
  const low = a.scale; for (let i = 0; i < 60 * 60; i++) Q.feed(a, 1 / 60);   // then a minute at 60
  check('si luego va a 60 FPS, vuelve a subir poco a poco hasta 1', a.scale > low && a.scale <= 1, 'escala ' + a.scale);
  for (let i = 0; i < 60 * 40; i++) Q.feed(a, 1 / 12);
  check('nunca baja de 0,55 aunque vaya fatal', a.scale >= Q.ADAPT.minScale, 'escala ' + a.scale);
  const m = Q.createAdaptive(60, false); for (let i = 0; i < 300; i++) Q.feed(m, 1 / 30);
  check('con calidad fija (no AUTO) la resolución no cambia sola', m.scale === 1);
  check('un salto grande (pausa, segundo plano) no cuenta como FPS bajos', (() => { const b = Q.createAdaptive(60, true); Q.feed(b, 3); return b.frames === 0; })());
  const drawn = (cap, hz, n) => { let d = 0; for (let i = 0; i < n; i++) if (Q.shouldDraw(cap, i, hz)) d++; return d; };
  check('límite 30 FPS: pantalla de 60 Hz dibuja 30 por segundo, de 120 Hz también 30', drawn(30, 60, 60) === 30 && drawn(30, 120, 120) === 30);
  check('sin límite (60): dibuja todos los fotogramas de la pantalla (144 Hz sigue a 144)', drawn(60, 144, 144) === 144 && drawn(60, 60, 60) === 60);
  const st = ST.sanitize({ quality: 'ultra', fpsCap: 45, showFps: 'si' });
  check('ajustes de gráficos: valores raros vuelven al defecto (AUTO, 60, sin contador)', st.quality === 'auto' && st.fpsCap === 60 && st.showFps === false);
}

console.log('\nMIRA MANTENIDA: EL MISMO DEDO APUNTA');
{ const c = TS.create();
  TS.down(c, { id: 5, x: 700, y: 300, button: 'scope', W: 844 }); TS.move(c, { id: 5, x: 720, y: 290 });
  let d = TS.drain(c);
  check('el dedo que mantiene MIRA gira la cámara al arrastrarlo', d.dx > 0 && d.dy < 0, d.dx.toFixed(1) + ',' + d.dy.toFixed(1));
  TS.down(c, { id: 6, x: 780, y: 320, button: 'fire', W: 844 }); TS.move(c, { id: 5, x: 740, y: 290 }); TS.up(c, 6);
  d = TS.drain(c);
  check('un segundo dedo en FUEGO no le roba el apuntado', Math.abs(d.dx - 20 * c.cfg.lookGain) < 1e-9, d.dx.toFixed(2));
  const r = TS.up(c, 5); TS.move(c, { id: 5, x: 800, y: 290 });
  check('al soltar MIRA se libera el botón y ese dedo deja de girar', r.release === 'scope' && TS.drain(c).dx === 0);
  const c2 = TS.create(); c2.dragScope = false;
  TS.down(c2, { id: 1, x: 700, y: 300, button: 'scope', W: 844 }); TS.move(c2, { id: 1, x: 740, y: 300 });
  check('modo MANTENER: el dedo de MIRA no gira', TS.drain(c2).dx === 0);
  const c3 = TS.create({ dead: 4 });
  TS.down(c3, { id: 1, x: 600, y: 200, button: null, W: 844 }); TS.move(c3, { id: 1, x: 602, y: 201 });
  check('zona muerta: un temblor al apoyar el dedo no gira', TS.drain(c3).dx === 0);
  TS.move(c3, { id: 1, x: 610, y: 200 }); d = TS.drain(c3);
  check('pasada la zona muerta solo cuenta lo recorrido de más (sin salto)', Math.abs(d.dx - 6 * c3.cfg.lookGain) < 1e-9, d.dx.toFixed(2));
  const SS = require('../client/settings.js');
  const st = SS.sanitize({ adsMode: 'raro', adsH: 9, smooth: -1, touchDead: 99 }, true);
  check('ajustes de mira: valores raros se corrigen', st.adsMode === 'holdDrag' && st.adsH === 2 && st.smooth === 0 && st.touchDead === 12);
  const base = SS.lookDelta(10, 0, SS.defaults(true), { fovRatio: 1, touch: true, ads: 0 }).yaw;
  const aim = SS.lookDelta(10, 0, Object.assign(SS.defaults(true), { adsH: 1.5 }), { fovRatio: 1, touch: true, ads: 1 }).yaw;
  check('MIRA HORIZONTAL solo cuenta al apuntar', Math.abs(aim / base - 1.5) < 1e-9);
}

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
