/* HUD 2 (?hud=2, client/hud2.js): weapon bar, inventory, layout + migration, peek keys. Pure, no browser.
   Run: node test/hud2.test.js */
'use strict';
const H = require('../client/hud2.js');
const LY = require('../client/layout.js');
const ST = require('../client/settings.js');
const CFG = require('../core/config.js');
const Wp = require('../core/weapon.js');
const Me = require('../core/melee.js');
const IC = require('../client/hudicons.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const fakeStore = (init) => { const m = {}; for (const k in init || {}) m[k] = JSON.stringify(init[k]); return { get: (k, d) => (k in m ? JSON.parse(m[k]) : d), set: (k, v) => { m[k] = JSON.stringify(v); }, raw: m }; };
const gun = w => ({ ammo: w.ammo, mag: w.cfg.mag, state: w.state, t: w.t, reload: w.cfg.reload, shells: !!w.cfg.shells });

console.log('\nBARRA DE ARMAS');
{ const R = Wp.createState(CFG.rifles.halcon), S = Wp.createState(CFG.shotguns.furia), P = Wp.createState(CFG.pistols.vibora);
  R.state = 'ready'; P.state = 'ready'; S.state = 'ready';
  const L = Me.createLoadout(CFG.knives.tactica, CFG.loadout, CFG.pistols.vibora, CFG.shotguns.furia);
  const st = () => ({ primary: L.primary, nextPrimary: 'rifle', active: L.active, pending: L.pending, phase: L.phase, guns: { rifle: gun(R), shotgun: gun(S), pistol: gun(P) } });
  let m = H.barModel(st());
  check('tres ranuras: principal, pistola y navaja con sus teclas 1/2/3', m.length === 3 && m.map(o => o.weapon + o.key).join(',') === 'rifle1,pistol2,knife3');
  check('la principal activa muestra 5 en el cargador y reserva ∞', m[0].active && m[0].ammo === 5 && m[0].mag === 5 && m[0].reserve === '∞' && m[0].state === 'ready');
  check('la navaja no tiene munición', m[2].ammo === null && m[2].reserve === null);
  // switching: the same loadout logic as the game and the server
  Me.tickLoadout(L, { select: 'pistol' }, 1 / 120);
  m = H.barModel(st());
  check('al pedir la pistola: la principal se guarda y la pistola queda pendiente', m[0].state === 'holster' && m[1].pending && !m[1].active);
  for (let i = 0; i < 120; i++) Me.tickLoadout(L, {}, 1 / 120);
  m = H.barModel(st());
  check('tras los tiempos de guardar y sacar: la pistola es la activa (12/∞)', m[1].active && !m[1].pending && m[1].ammo === 12 && L.active === 'pistol');
  P.ammo = 0; m = H.barModel(st());
  check('sin balas: la ranura activa avisa (estado vacío)', m[1].empty && m[1].state === 'empty');
  Wp.startReload(P, []); P.t = CFG.pistols.vibora.reload / 2; m = H.barModel(st());
  check('recargando: progreso a mitad', m[1].state === 'reload' && Math.abs(m[1].reloadP - 0.5) < 1e-9);
  check('la clave de redibujo cambia con el progreso y no si nada cambia', H.slotKey(m[1]) === H.slotKey(H.barModel(st())[1]) && (P.t += 0.2, H.slotKey(m[1]) !== H.slotKey(H.barModel(st())[1])));
  // next-spawn primary: shown on slot 1, the gun in hand does not change
  const s2 = Object.assign(st(), { nextPrimary: 'shotgun' });
  m = H.barModel(s2);
  check('elegir FURIA 12 en partida: la ranura 1 dice «siguiente» y sigue siendo el HALCÓN', m[0].weapon === 'rifle' && m[0].next === 'FURIA 12');
  Me.setPrimary(L, 'shotgun'); Me.resetLoadout(L);
  m = H.barModel(Object.assign(st(), { nextPrimary: 'shotgun' }));
  check('al reaparecer: la ranura 1 es la FURIA 12 (6/∞) y ya no avisa', m[0].weapon === 'shotgun' && m[0].ammo === 6 && m[0].active && m[0].next === null);
  S.ammo = 2; Wp.startReload(S, []); m = H.barModel(st());
  check('escopeta recargando cartucho a cartucho: progreso = cartuchos/tubo', m[0].state === 'reload' && Math.abs(m[0].reloadP - 2 / 6) < 1e-9);
  check('ciclo de la rueda 1→2→3→1 y al revés', H.cycle(1, 1) === 2 && H.cycle(3, 1) === 1 && H.cycle(1, -1) === 3 && H.cycle(2, -1) === 1);
  check('ranura de cada arma', H.slotOfWeapon('shotgun') === 1 && H.slotOfWeapon('rifle') === 1 && H.slotOfWeapon('pistol') === 2 && H.slotOfWeapon('knife') === 3);
}

console.log('\nINVENTARIO');
{ const R = Wp.createState(CFG.rifles.halcon), S = Wp.createState(CFG.shotguns.furia), P = Wp.createState(CFG.pistols.vibora);
  const s = { primary: 'rifle', nextPrimary: 'shotgun', active: 'rifle', pending: 'pistol', phase: 'holster', guns: { rifle: gun(R), shotgun: gun(S), pistol: gun(P) },
    hp: 72.4, breath: 0.5, draw: { rifle: CFG.loadout.rifleDraw, pistol: CFG.loadout.pistolDraw, shotgun: CFG.loadout.shotgunDraw, knife: CFG.knives.tactica.draw } };
  const M = H.inventoryModel(s);
  check('solo las armas que existen (3) y las categorías fijas', M.weapons.length === 3 && M.categories.join(',') === 'armamento,municion,estado');
  check('munición en cargador y reserva', M.weapons[0].ammo === '5 / 5' && M.weapons[0].reserve === 'RESERVA ∞' && M.weapons[2].ammo === 'SIN MUNICIÓN');
  check('arma pendiente y principal para el próximo respawn', M.pending === 'VÍBORA 9' && M.nextDiffers && M.primaryNow === 'HALCÓN R7' && M.primaryNext === 'FURIA 12');
  check('estado: salud y aire', M.hp === 72 && M.breath === 50);
  check('tiempos de sacar del juego', M.weapons[1].draw === CFG.loadout.pistolDraw);
  check('lista de restricciones con la regla del respawn', M.rules.some(r => /próximo respawn/.test(r)) && M.rules.some(r => /ilimitada/.test(r)));
}

console.log('\nDISEÑO DEL HUD 2 Y MIGRACIÓN');
{ const W = 844, Hh = 390;
  const d = H.defaults(true);
  check('por defecto: todos los botones de siempre + asomarse izq./der. + barra compacta en móvil', Object.keys(LY.BUTTONS).every(k => d.buttons[k]) && d.buttons.peekL && d.buttons.peekR && d.bar.compact && d.bar.visible);
  check('en PC la barra es la expandida', !H.defaults(false).bar.compact);
  // migration: the player had moved FUEGO in the classic editor
  const classic = LY.defaults(); classic.buttons.fire.dx = 100; classic.buttons.fire.dy = 90; classic.opacity = 0.6;
  const st = fakeStore({ touchLayout: classic });
  const L = H.load(st, true);
  check('primera vez con ?hud=2: conserva los botones que ya movió (FUEGO) y su opacidad', L.buttons.fire.dx === 100 && L.buttons.fire.dy === 90 && L.opacity === 0.6);
  check('y no toca el diseño clásico guardado', JSON.parse(st.raw.touchLayout).buttons.fire.dx === 100 && !('hudLayout2' in st.raw));
  L.vis.peekL = false; L.op.jump = 0.5; L.bar.compact = false; L.bar.dx = -120; L.bar.scale = 1.2; L.buttons.peekR.dx = 140;
  H.save(st, L, true);
  const L2 = H.load(st, true);
  check('guardar y volver a cargar: visibilidad, opacidad, barra y posiciones', L2.vis.peekL === false && L2.op.jump === 0.5 && L2.bar.compact === false && L2.bar.dx === -120 && L2.bar.scale === 1.2 && L2.buttons.peekR.dx === 140);
  check('el diseño clásico sigue intacto tras guardar el HUD 2', JSON.parse(st.raw.touchLayout).buttons.fire.dx === 100 && !JSON.parse(st.raw.touchLayout).buttons.peekL);
  const bad = H.sanitize({ opacity: 9, buttons: { fire: { dx: -5, dy: 'x', size: 900 }, peekL: { size: 1 } }, vis: { pause: false, jump: 'no' }, op: { fire: 7 }, bar: { scale: 50, dy: -9, op: -1, compact: 'sí' } }, true);
  check('datos guardados rotos o trucados se limitan', bad.opacity === 1 && bad.buttons.fire.dx === 0 && bad.buttons.fire.size === 140 && bad.buttons.peekL.size === 36 && bad.op.fire === 1 && bad.bar.scale === 1.6 && bad.bar.dy === 0 && bad.bar.op === 0.2 && bad.bar.compact === true);
  check('PAUSA nunca se puede ocultar', bad.vis.pause === true && bad.vis.jump === true);
  check('basura total → valores por defecto', JSON.stringify(H.sanitize('basura', true)) === JSON.stringify(H.defaults(true)));
  // geometry
  const r = H.rect('peekL', d.buttons.peekL, W, Hh);
  check('asomarse izquierda queda a la izquierda y por encima del joystick', r.cx === 50 && r.cy === Hh - 168);
  const mv = H.moveTo('peekL', d.buttons.peekL, 200, 100, W, Hh);
  check('arrastrar un botón anclado a la izquierda', mv.dx === 200 && mv.dy === Hh - 100);
  const obs = Object.keys(d.buttons).filter(k => !/^(pause|breath|zoom|inspect|fire2)$/.test(k)).map(k => H.rect(k, d.buttons[k], 667, 375));
  const br = H.barRect(d.bar, 667, 375, 3 * 80 + 38 + 18, 42, obs);
  const hits = obs.filter(o => br.left < o.left + o.size && br.left + br.w > o.left && br.top < o.top + o.size && br.top + br.h > o.top);
  check('iPhone 8 apaisado (667×375): la barra no tapa ningún botón', hits.length === 0 && !br.overlap, 'escala ' + br.scale.toFixed(2) + ' x ' + br.left.toFixed(0));
  const br2 = H.barRect(d.bar, 932, 430, 3 * 80 + 38 + 18, 42, Object.keys(d.buttons).map(k => H.rect(k, d.buttons[k], 932, 430)));
  check('iPhone 15 Pro Max apaisado (932×430): barra a tamaño completo', br2.scale === 1 && !br2.overlap);
  const bm = H.barMoveTo(d.bar, 500, 300, W, Hh, 42);
  check('arrastrar la barra: desplazamiento desde el centro y desde abajo', bm.dx === 500 - W / 2 && bm.dy === Math.round(Hh - 300 - 21));
}

console.log('\nTECLAS DE ASOMARSE Y AJUSTES');
{ check('Q y E (las de siempre) se pueden usar', H.keyAllowed('KeyQ') && H.keyAllowed('KeyE') && H.keyAllowed('KeyZ'));
  check('no se pueden quitar teclas que ya usa el juego (W, R, espacio, 1, Esc, I)', ['KeyW', 'KeyR', 'Space', 'Digit1', 'Escape', 'KeyI', 'ShiftLeft', 'Tab'].every(k => !H.keyAllowed(k)));
  check('nombre corto de cada tecla', H.keyLabel('KeyQ') === 'Q' && H.keyLabel('Digit5') === '5' && H.keyLabel('Numpad4') === 'NUM 4');
  check('asomarse: izquierda, derecha, las dos = recto, tecla o botón táctil', H.leanTarget({ keyL: true }) === -1 && H.leanTarget({ touchR: true }) === 1 && H.leanTarget({ keyL: true, touchR: true }) === 0 && H.leanTarget({}) === 0);
  const s = ST.sanitize({});
  check('ajustes por defecto: Q/E, mantener en PC, pulsar en móvil, rueda desactivada', s.leanKeyL === 'KeyQ' && s.leanKeyR === 'KeyE' && s.leanMode === 'hold' && s.leanTouch === 'toggle' && s.wheelSwap === false);
  const s2 = ST.sanitize({ leanKeyL: 'KeyZ', leanKeyR: 'KeyX', leanMode: 'toggle', leanTouch: 'hold', wheelSwap: true });
  check('ajustes cambiados se guardan', s2.leanKeyL === 'KeyZ' && s2.leanKeyR === 'KeyX' && s2.leanMode === 'toggle' && s2.leanTouch === 'hold' && s2.wheelSwap);
  check('la misma tecla para los dos lados no se acepta', ST.sanitize({ leanKeyL: 'KeyZ', leanKeyR: 'KeyZ' }).leanKeyL === 'KeyQ');
  check('valores raros se ignoran', ST.sanitize({ leanKeyL: '<b>', leanMode: 'x', wheelSwap: 'sí' }).leanKeyL === 'KeyQ' && ST.sanitize({ leanMode: 'x' }).leanMode === 'hold');
  check('RESTAURAR de CONTROLES devuelve también las teclas de asomarse', ST.resetCategory(s2, 'controles').leanKeyL === 'KeyQ');
}

console.log('\nICONOS');
{ const need = ['peak_left', 'peak_right', 'aim_ads', 'fire_main', 'reload', 'crouch', 'jump', 'fire_left', 'weapon_swap', 'knife', 'pause', 'inspect', 'hold_breath', 'sprint', 'inventory'];
  check('los 15 iconos están en la página', need.every(n => /^<svg/.test(IC.glyphs[n] || '')));
  check('cada botón del HUD 2 tiene su icono', Object.values(H.ICONS).every(n => IC.glyphs[n]));
  check('siluetas de las 4 armas', ['rifle', 'shotgun', 'pistol', 'knife'].every(w => /^<svg/.test(IC.weapons[w] || '')));
  check('asomarse izquierda y derecha son distintos (espejo)', IC.glyphs.peak_left !== IC.glyphs.peak_right && /matrix\(-1/.test(IC.glyphs.peak_right));
  check('los iconos usan el color del botón (currentColor), sin colores fijos', Object.values(IC.glyphs).every(g => !/#[0-9a-f]{3,6}/i.test(g)));
}

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
