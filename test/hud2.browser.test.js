/* HUD 2 (?hud=2) in the real page (Chromium, software WebGL):
   - without the flag nothing changes (no bar, no peek buttons, Q/E lean as always)
   - PC: weapon bar (1/2/3, wheel), active weapon and ammo right when firing and reloading, empty magazine, the
     next-spawn primary, inventory open/close, peek with Q/E held and toggled, aiming and firing while peeking,
     configurable peek keys (refuses keys the game uses), cost of the per-frame update
   - touch (real multi-touch through CDP): slot taps, a slide from the bar becomes the joystick, inventory taps,
     joystick + peek + MIRA + FIRE at once in the shooting range, HUD editor (drag the bar, hide a button,
     compact/expanded) saved and restored after a reload, migration from the classic layout
   - online (local server): the slot/keys switch the weapon on the server, a shot fired while leaning and aiming is
     accepted and hits
   Run: node test/hud2.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
const { startServer } = require('../server/node.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(p, fn, arg, ms) { try { await p.waitForFunction(fn, arg, { timeout: ms || 8000, polling: 50 }); return true; } catch (e) { return false; } }
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function page(b, url, opts) {
  opts = opts || {};
  const ctx = opts.ctx || await b.newContext({ viewport: opts.vp || { width: 1280, height: 720 }, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (opts.storage) await ctx.addInitScript(s => { for (const k in s) localStorage.setItem(k, JSON.stringify(s[k])); }, opts.storage);
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
  await p.evaluate(() => { document.querySelector('canvas').requestPointerLock = () => Promise.reject(new Error('test')); });   // never grab the real mouse
  return { ctx, p, errs };
}
async function start(p, m) { await p.evaluate(m => { __SD.setDuelLethal(false); __SD.setLethal(false); __SD.setMode(m); __SD.setOffMap('arena'); __SD.startMatch(); }, m || 'duel'); await until(p, () => __SD.state === 'playing' && __SD.LOAD.phase === 'ready', null, 20000); }
const slot = (p, n) => p.evaluate(n => { const e = document.querySelector('#wbar [data-wslot="' + n + '"]'); return e ? { cls: e.className, ammo: e.querySelector('.wa') ? e.querySelector('.wa').textContent : '', label: e.getAttribute('aria-label'), wx: e.querySelector('.wx') ? (e.querySelector('.wx').hidden ? '' : e.querySelector('.wx').textContent) : '' } : null; }, n);
const center = (p, sel) => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
// lateral offset of the aim origin (camera) from the body, along the player's right
const leanOff = p => p.evaluate(() => { const S = __SD, P = S.P; return (S.AIM.ox - P.pos.x) * Math.cos(P.yaw) - (S.AIM.oz - P.pos.z) * Math.sin(P.yaw); });
// several fingers at once through the browser's own touch input (CDP): each call sends the full set of live fingers
function fingers(cdp) {
  const live = new Map();
  const pts = () => [...live].map(([id, q]) => ({ x: q.x, y: q.y, id, radiusX: 4, radiusY: 4, force: 1 }));
  return {
    async down(id, q) { live.set(id, q); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts() }); },
    async move(id, q) { live.set(id, q); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts() }); },
    async up(id) { live.delete(id); if (live.size) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: pts() }); else await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); },
    async tap(id, q) { await this.down(id, q); await sleep(60); await this.up(id); }
  };
}

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ARGS });
  const base = srv.url + '?perf=low';
  try {
    console.log('\nCON ?hud=1 (el HUD anterior; sin bandera es el HUD 2 desde el 28-10)');
    { const { ctx, p } = await page(b, base);
      check('sin bandera el HUD es el HUD 2', await p.evaluate(() => __SD.HUD2 && document.body.classList.contains('hud2')));
      await ctx.close(); }
    { const { ctx, p, errs } = await page(b, base + '&hud=1');
      await start(p);
      const r = await p.evaluate(() => ({ bar: !!document.getElementById('wbar'), peek: !!document.getElementById('tbPeekL'), inv: !!document.getElementById('inv2'), cls: document.body.classList.contains('hud2'), ammo: getComputedStyle(document.getElementById('ammo')).display !== 'none', h2: __SD.HUD2 }));
      check('sin barra, sin botones de asomarse, sin inventario y con la munición de siempre', !r.bar && !r.peek && !r.inv && !r.cls && r.ammo && !r.h2);
      await p.keyboard.down('KeyQ'); const okQ = await until(p, () => __SD.P.lean < -0.9, null, 4000); await p.keyboard.up('KeyQ');
      check('Q mantenida sigue inclinando a la izquierda como siempre', okQ);
      await p.keyboard.press('KeyI'); await sleep(200);
      check('I no hace nada sin la bandera', await p.evaluate(() => !document.getElementById('inv2')));
      check('sin errores de JavaScript', errs.length === 0, errs.slice(0, 2).join(' | '));
      await ctx.close(); }

    console.log('\nPC CON ?hud=2 (contra bots)');
    { const { ctx, p, errs } = await page(b, base + '&hud=2');
      await start(p);
      const r = await p.evaluate(() => ({ cls: document.body.classList.contains('hud2'), ammo: getComputedStyle(document.getElementById('ammo')).display, n: document.querySelectorAll('#wbar .ws').length, inv: !!document.querySelector('#wbar .wsInv'), keys: document.getElementById('wbar').classList.contains('keys'), inHud: document.getElementById('wbar').parentNode.id }));
      check('barra de armas abajo con 3 ranuras + inventario, teclas visibles, munición antigua oculta', r.cls && r.ammo === 'none' && r.n === 3 && r.inv && r.keys && r.inHud === 'hud');
      let s1 = await slot(p, 1);
      check('ranura 1 activa: HALCÓN R7 con 5/∞', /\bon\b/.test(s1.cls) && s1.ammo === '5/∞' && s1.label === 'HALCÓN R7', s1.ammo);
      await p.keyboard.press('Digit2');
      const pend = await until(p, () => __SD.LOAD.pending === 'pistol' || __SD.LOAD.active === 'pistol', null, 3000) && await until(p, () => /pend|\bon\b/.test(document.querySelector('#wbar [data-wslot="2"]').className), null, 2000);
      check('tecla 2: la pistola queda pendiente mientras se guarda el rifle', pend);
      check('… y pasa a ser la activa tras los tiempos de guardar y sacar', await until(p, () => __SD.LOAD.active === 'pistol' && __SD.LOAD.phase === 'ready', null, 4000) && await until(p, () => /\bon\b/.test(document.querySelector('#wbar [data-wslot="2"]').className) && !/\bon\b/.test(document.querySelector('#wbar [data-wslot="1"]').className), null, 2000));
      await p.evaluate(() => { __SD.input.firePressed = true; });
      check('disparo de pistola: el cargador baja a 11 en el juego y en la barra', await until(p, () => __SD.PCORE.ammo === 11, null, 3000) && await until(p, () => document.querySelector('#wbar [data-wslot="2"] .wa').textContent === '11/∞', null, 2000));
      await sleep(300); await p.keyboard.press('KeyR');
      check('R: recarga con barra de progreso en la ranura', await until(p, () => __SD.PCORE.state === 'reload', null, 3000) && await until(p, () => /\brel\b/.test(document.querySelector('#wbar [data-wslot="2"]').className), null, 2000));
      check('… y vuelve a 12/∞ al terminar', await until(p, () => __SD.PCORE.ammo === 12 && __SD.PCORE.state === 'ready', null, 6000) && await until(p, () => document.querySelector('#wbar [data-wslot="2"] .wa').textContent === '12/∞', null, 2000));
      await p.keyboard.press('Digit3');
      check('tecla 3: navaja activa, sin munición en su ranura', await until(p, () => __SD.LOAD.active === 'knife' && __SD.LOAD.phase === 'ready', null, 4000) && await until(p, () => /\bon\b/.test(document.querySelector('#wbar [data-wslot="3"]').className), null, 2000) && (await slot(p, 3)).ammo === '');
      await p.keyboard.press('Digit1');
      check('tecla 1: vuelve el rifle', await until(p, () => __SD.LOAD.active === 'rifle' && __SD.LOAD.phase === 'ready', null, 4000));
      await p.evaluate(() => { __SD.input.firePressed = true; });
      check('disparo de rifle: 4/∞ en la barra', await until(p, () => __SD.WCORE.ammo === 4, null, 3000) && await until(p, () => document.querySelector('#wbar [data-wslot="1"] .wa').textContent === '4/∞', null, 2000));
      await until(p, () => __SD.WCORE.state === 'ready', null, 3000);
      await p.evaluate(() => { __SD.WCORE.ammo = 0; });
      check('cargador vacío: la ranura activa se pone en alerta', await until(p, () => /\bempty\b/.test(document.querySelector('#wbar [data-wslot="1"]').className), null, 2000));
      await p.evaluate(() => { __SD.WCORE.ammo = 5; });
      // next-spawn primary
      await p.evaluate(() => __SD.setPrimaryChoice('shotgun')); await sleep(300);
      s1 = await slot(p, 1);
      check('elegir FURIA 12 en partida: la ranura 1 avisa «siguiente» y sigues con el HALCÓN', /FURIA 12/.test(s1.wx) && s1.label === 'HALCÓN R7' && await p.evaluate(() => __SD.LOAD.active === 'rifle'), s1.wx);
      await p.keyboard.press('KeyI');
      check('inventario (I): se abre con armas, munición, reserva y el aviso del próximo respawn', await until(p, () => !document.getElementById('inv2').hidden, null, 2000) &&
        await p.evaluate(() => { const t = document.getElementById('inv2').textContent; return /HALCÓN R7/.test(t) && /VÍBORA 9/.test(t) && /NAVAJA/.test(t) && /RESERVA ∞/.test(t) && /SE APLICARÁ EN EL PRÓXIMO RESPAWN/.test(t) && /SALUD/.test(t); }));
      await p.keyboard.press('KeyI');
      check('I otra vez: se cierra', await until(p, () => document.getElementById('inv2').hidden, null, 2000));
      await p.keyboard.press('Tab'); const tabOpen = await until(p, () => !document.getElementById('inv2').hidden, null, 2000); await p.keyboard.press('Tab');
      check('Tab también lo abre y lo cierra', tabOpen && await until(p, () => document.getElementById('inv2').hidden, null, 2000));
      await p.evaluate(() => { __SD.setDuelLethal(true); __SD.damagePlayer(500, __SD.BOTS[0], false); });
      check('al reaparecer: ranura 1 = FURIA 12 con 6/∞ y sin aviso', await until(p, () => !__SD.P.alive, null, 3000) && await until(p, () => __SD.P.alive && __SD.LOAD.active === 'shotgun', null, 8000) &&
        await until(p, () => { const e = document.querySelector('#wbar [data-wslot="1"]'); return e.getAttribute('aria-label') === 'FURIA 12' && e.querySelector('.wa').textContent === '6/∞' && e.querySelector('.wx').hidden; }, null, 3000));
      await p.evaluate(() => { __SD.setDuelLethal(false); __SD.setPrimaryChoice('rifle'); });
      // wheel (optional)
      await p.mouse.move(640, 360); await p.mouse.wheel(0, 120); await sleep(400);
      check('rueda del ratón desactivada por defecto: no cambia de arma', await p.evaluate(() => __SD.LOAD.active === 'shotgun' && !__SD.LOAD.pending));
      await p.evaluate(() => { __SD.SETTINGS.wheelSwap = true; });
      await p.mouse.wheel(0, 120);
      check('rueda activada en AJUSTES: siguiente arma (principal → pistola)', await until(p, () => __SD.LOAD.active === 'pistol' && __SD.LOAD.phase === 'ready', null, 4000));
      await p.keyboard.press('Digit1'); await until(p, () => __SD.LOAD.active === 'shotgun' && __SD.LOAD.phase === 'ready', null, 4000);
      // peek: Q/E held (default)
      await p.keyboard.down('KeyE');
      const right = await until(p, () => __SD.P.lean > 0.95, null, 4000), offR = await leanOff(p);
      await p.keyboard.up('KeyE');
      check('E mantenida: se asoma a la derecha (la cámara sale a un lado, ≤ 0,45 m)', right && offR > 0.2 && offR <= 0.451, offR.toFixed(2) + ' m');
      check('al soltar vuelve al centro', await until(p, () => Math.abs(__SD.P.lean) < 0.05, null, 3000));
      // aim + peek left + fire
      await p.evaluate(() => { __SD.input.scope = true; }); await until(p, () => __SD.SCORE.ads >= 1, null, 4000);
      await p.keyboard.down('KeyQ'); await until(p, () => __SD.P.lean < -0.95, null, 4000);
      const offL = await leanOff(p), a0 = await p.evaluate(() => __SD.SCORE.ammo);
      await p.evaluate(() => { __SD.input.firePressed = true; });
      const shot = await until(p, a => __SD.SCORE.ammo === a - 1, a0, 3000), stillL = await p.evaluate(() => __SD.P.lean < -0.9 && __SD.SCORE.ads > 0.9);
      await p.keyboard.up('KeyQ'); await p.evaluate(() => { __SD.input.scope = false; });
      check('apuntando y asomado a la izquierda se puede disparar (sale desde la cámara asomada)', shot && stillL && offL < -0.2, offL.toFixed(2) + ' m');
      // toggle mode + a new key from AJUSTES (the real capture)
      await p.evaluate(() => { document.querySelector('#h2LeanMode button[data-lm="toggle"]').click(); document.querySelector('#h2Set .keyCap[data-lean="R"]').click(); });
      await p.keyboard.press('KeyX'); await sleep(100);
      await p.evaluate(() => document.querySelector('#h2Set .keyCap[data-lean="L"]').click());
      await p.keyboard.press('KeyW'); await sleep(100);
      const ks = await p.evaluate(() => ({ L: __SD.SETTINGS.leanKeyL, R: __SD.SETTINGS.leanKeyR, mode: __SD.SETTINGS.leanMode, msg: document.getElementById('h2KeyMsg').textContent, saved: JSON.parse(localStorage.getItem('sniperduel_settings')), label: document.querySelector('#h2Set .keyCap[data-lean="R"]').textContent }));
      check('AJUSTES: la tecla de asomarse a la derecha pasa a X y se guarda', ks.R === 'KeyX' && ks.saved.leanKeyR === 'KeyX' && ks.label === 'X' && ks.mode === 'toggle');
      check('W no se acepta (la usa el juego): la izquierda sigue en Q', ks.L === 'KeyQ' && /NO/.test(ks.msg), ks.msg);
      await p.keyboard.press('KeyX');
      const tog = await until(p, () => __SD.P.lean > 0.95, null, 4000);
      await sleep(300);
      check('modo PULSAR: X una vez se queda asomado sin mantener la tecla', tog && await p.evaluate(() => __SD.P.lean > 0.95));
      await p.keyboard.press('KeyX');
      check('X otra vez: vuelve al centro', await until(p, () => Math.abs(__SD.P.lean) < 0.05, null, 3000));
      await p.keyboard.down('KeyE'); await sleep(500); const eNow = await p.evaluate(() => __SD.P.lean); await p.keyboard.up('KeyE');
      check('E ya no se asoma (la tecla ahora es X)', Math.abs(eNow) < 0.05);
      // bar background from AJUSTES: fully transparent, saved with the HUD layout
      await p.evaluate(() => { const e = document.getElementById('h2BarBg'); e.value = '0'; e.dispatchEvent(new Event('input')); });
      const bg = await p.evaluate(() => ({ v: document.getElementById('wbar').style.getPropertyValue('--wbBg'), clear: document.getElementById('wbar').classList.contains('clear'), saved: JSON.parse(localStorage.getItem('sniperduel_hudLayout2')).bar.bg, back: getComputedStyle(document.querySelector('#wbar .ws')).backgroundColor }));
      check('AJUSTES: fondo de la barra a 0 = transparente (solo armas y números) y se guarda', bg.v === '0' && bg.clear && bg.saved === 0 && /rgba\(12, 11, 9, 0\)|transparent/.test(bg.back), bg.back);
      // crouch on PC: C toggles with PULSAR · TE LEVANTAS AL DESLIZAR (MANTENER stays the PC default)
      check('PC: agacharse por defecto sigue siendo MANTENER', await p.evaluate(() => __SD.SETTINGS.crouchMode === 'hold'));
      await p.evaluate(() => document.querySelector('#crouchSeg button[data-c="slide"]').click());
      await p.keyboard.press('KeyC'); const cr = await until(p, () => __SD.PM.crouch, null, 2000); await sleep(300);
      const stays = await p.evaluate(() => __SD.PM.crouch); await p.keyboard.press('KeyC');
      check('PC en modo PULSAR: C una vez agacha sin mantener, otra vez levanta', cr && stays && await until(p, () => !__SD.PM.crouch, null, 2000));
      // cost of the per-frame HUD update
      const ms = await p.evaluate(() => { const n = 3000, t = performance.now(); for (let i = 0; i < n; i++) __SD.h2Frame(false); return (performance.now() - t) / n; });
      check('la actualización por fotograma del HUD 2 cuesta poco (< 0,05 ms)', ms < 0.05, (ms * 1000).toFixed(1) + ' µs');
      check('sin errores de JavaScript', errs.length === 0, errs.slice(0, 2).join(' | '));
      if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/hud2-pc.png' });
      await ctx.close(); }

    console.log('\nMÓVIL CON ?hud=2 (campo de tiro, multitáctil real)');
    { const vp = { width: 844, height: 390 };
      let { ctx, p, errs } = await page(b, base + '&hud=2', { vp, touch: true });
      await start(p, 'range');
      const r = await p.evaluate(() => ({ icons: ['tbFire', 'tbScope', 'tbCrouch', 'tbJump', 'tbReload', 'tbSwap', 'tbPeekL', 'tbPeekR', 'tbPause'].every(id => document.getElementById(id) && document.getElementById(id).querySelector('svg')), inTouch: document.getElementById('wbar').parentNode.id, compact: document.getElementById('wbar').classList.contains('compact') }));
      check('botones con iconos (y los dos de asomarse); barra compacta dentro de la capa táctil', r.icons && r.inTouch === 'touch' && r.compact);
      const cdp = await ctx.newCDPSession(p), F = fingers(cdp);
      await F.tap(1, await center(p, '#wbar [data-wslot="2"]'));
      check('tocar la ranura 2: saca la pistola', await until(p, () => __SD.LOAD.active === 'pistol' && __SD.LOAD.phase === 'ready', null, 5000));
      { const c = await center(p, '#wbar [data-wslot="1"]');
        await F.down(2, c); await F.move(2, { x: c.x, y: c.y - 20 }); await F.move(2, { x: c.x, y: c.y - 45 }); await sleep(150);
        const st = await p.evaluate(() => ({ stick: __SD.TOUCH.stickId !== null, jy: __SD.TOUCH.jy, pend: __SD.LOAD.pending, act: __SD.LOAD.active }));
        await F.up(2); await sleep(150);
        check('deslizar desde la barra no cambia de arma: se convierte en joystick', st.stick && st.jy < -0.2 && !st.pend && st.act === 'pistol', 'jy ' + st.jy.toFixed(2)); }
      await F.tap(3, await center(p, '#wbar [data-wslot="inv"]'));
      check('tocar el inventario lo abre', await until(p, () => !document.getElementById('inv2').hidden, null, 2000));
      await F.tap(4, await center(p, '#inv2 [data-isel="3"]'));
      check('tocar la navaja en el inventario la equipa', await until(p, () => __SD.LOAD.active === 'knife' && __SD.LOAD.phase === 'ready', null, 5000));
      check('con la navaja el botón de fuego muestra la navaja', await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = SDHudIcons.glyphs.knife; return document.getElementById('tbFire').innerHTML === d.innerHTML; }));
      await F.tap(5, await center(p, '#inv2 [data-iclose]'));
      check('la ✕ lo cierra', await until(p, () => document.getElementById('inv2').hidden, null, 2000));
      await F.tap(6, await center(p, '#wbar [data-wslot="1"]'));
      await until(p, () => __SD.LOAD.active === 'rifle' && __SD.LOAD.phase === 'ready', null, 5000);
      // joystick + peek right (tap: toggle) + MIRA held + FIRE, all at once
      const s0 = await p.evaluate(() => __SD.STATS.shots);
      await F.down(10, { x: 140, y: 300 }); await F.move(10, { x: 140, y: 270 }); await F.move(10, { x: 140, y: 255 });
      await F.tap(11, await center(p, '#tbPeekR'));
      await F.down(12, await center(p, '#tbScope'));
      const ready = await until(p, () => __SD.WCORE.ads >= 1 && __SD.P.lean > 0.9, null, 5000);
      const mid = await p.evaluate(() => ({ stick: __SD.TOUCH.stickId !== null, peekOn: document.getElementById('tbPeekR').classList.contains('on'), scope: __SD.input.scopeHeld }));
      await F.down(13, await center(p, '#tbFire'));
      const fired = await until(p, s => __SD.STATS.shots > s, s0, 3000), off = await leanOff(p);
      await F.up(13); await F.up(12); await F.up(10);
      check('joystick + asomarse a la derecha + MIRA + FUEGO a la vez: dispara asomado y apuntando', ready && mid.stick && mid.peekOn && mid.scope && fired && off > 0.2, 'desplazamiento ' + off.toFixed(2) + ' m');
      check('asomarse sigue puesto al soltar los demás dedos (modo PULSAR)', await p.evaluate(() => __SD.leanIn.touchR && __SD.P.lean > 0.9));
      await F.tap(14, await center(p, '#tbPeekL'));
      check('tocar asomarse a la izquierda cambia de lado', await until(p, () => __SD.P.lean < -0.9 && !__SD.leanIn.touchR, null, 3000));
      await F.tap(15, await center(p, '#tbPeekL'));
      check('y otro toque vuelve al centro', await until(p, () => Math.abs(__SD.P.lean) < 0.05, null, 3000));
      check('ningún dedo se queda pegado', await p.evaluate(() => __SD.TOUCH.held.size === 0 && __SD.TOUCH.look.size === 0 && __SD.TOUCH.stickId === null && !__SD.H2.tap));
      if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/hud2-movil.png' });
      // HUD editor, from the menu
      await p.evaluate(() => { __SD.toMenu(); __SD.openEditor(); }); await sleep(300);
      const bar0 = await p.evaluate(() => Object.assign({}, __SD.LAYOUT.bar));
      { const c = await center(p, '#wbar [data-wslot="2"]');
        await F.down(20, c); await F.move(20, { x: c.x + 30, y: c.y - 15 }); await F.move(20, { x: c.x + 60, y: c.y - 30 }); await F.up(20); }
      const bar1 = await p.evaluate(() => Object.assign({ sel: __SD.EDIT.sel }, __SD.LAYOUT.bar));
      check('editor: arrastrar la barra de armas la mueve', bar1.sel === 'wbar' && Math.abs(bar1.dx - bar0.dx - 60) <= 2 && Math.abs(bar1.dy - bar0.dy - 30) <= 2, 'dx ' + bar0.dx + '→' + bar1.dx + ' dy ' + bar0.dy + '→' + bar1.dy);
      await F.tap(21, await center(p, '#tbPeekL'));
      await p.evaluate(() => { document.getElementById('edVis').click(); document.querySelector('#edBarSeg button[data-bm="full"]').click(); });
      await p.evaluate(() => { const e = document.getElementById('edOpOne'); e.value = '0.5'; e.dispatchEvent(new Event('input')); });
      const ed = await p.evaluate(() => ({ sel: __SD.EDIT.sel, vis: __SD.LAYOUT.vis.peekL, off: document.getElementById('tbPeekL').classList.contains('off'), compact: __SD.LAYOUT.bar.compact, op: __SD.LAYOUT.op.peekL }));
      check('editor: elegir ASOMAR IZQ., ocultarlo, opacidad 0,5 y barra expandida', ed.sel === 'peekL' && ed.vis === false && ed.off && ed.compact === false && ed.op === 0.5);
      await p.evaluate(() => document.getElementById('edSave').click()); await sleep(200);
      const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('sniperduel_hudLayout2')));
      check('GUARDAR lo deja en el almacenamiento del navegador', saved && saved.vis.peekL === false && saved.bar.compact === false && saved.op.peekL === 0.5 && saved.bar.dx === bar1.dx);
      await p.reload(); await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
      const back = await p.evaluate(() => ({ vis: __SD.LAYOUT.vis.peekL, off: document.getElementById('tbPeekL').classList.contains('off'), compact: document.getElementById('wbar').classList.contains('compact'), dx: __SD.LAYOUT.bar.dx }));
      check('al recargar la página: se mantiene todo', back.vis === false && back.off && !back.compact && back.dx === bar1.dx);
      check('sin errores de JavaScript', errs.length === 0, errs.slice(0, 2).join(' | '));
      await ctx.close(); }

    console.log('\nMIGRACIÓN DESDE LOS BOTONES CLÁSICOS');
    { const storage = { sniperduel_touchLayout: { opacity: 0.6, buttons: { fire: { dx: 100, dy: 90, size: 86 } } } };
      const { ctx, p, errs } = await page(b, base + '&hud=2', { vp: { width: 844, height: 390 }, touch: true, storage });
      const m = await p.evaluate(() => ({ fire: __SD.LAYOUT.buttons.fire, op: __SD.LAYOUT.opacity, peek: __SD.LAYOUT.buttons.peekL, saved: localStorage.getItem('sniperduel_hudLayout2') }));
      check('con ?hud=2 por primera vez: FUEGO sigue donde lo puso el jugador y aparecen los botones nuevos', m.fire.dx === 100 && m.fire.dy === 90 && m.op === 0.6 && m.peek && m.peek.dx === 50 && m.saved === null);
      await ctx.close();
      const q = await page(b, base + '&hud=1', { vp: { width: 844, height: 390 }, touch: true, storage });
      check('y con ?hud=1 (HUD anterior) el diseño clásico sigue igual', await q.p.evaluate(() => __SD.LAYOUT.buttons.fire.dx === 100 && !__SD.LAYOUT.buttons.peekL));
      check('sin errores de JavaScript', errs.length === 0 && q.errs.length === 0);
      await q.ctx.close(); }

    console.log('\nONLINE CON ?hud=2 (servidor local)');
    { const gs = await startServer({ port: 0, debug: true }), server = 'http://127.0.0.1:' + gs.port;
      const A = (await page(b, base + '&hud=2&server=' + encodeURIComponent(server), { vp: { width: 667, height: 375 } })).p;
      await A.click('#mpBtn'); await A.fill('#mpName', 'Hamza'); await A.click('#mpCreate');
      await until(A, () => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent));
      const code = await A.textContent('#mpCodeBig');
      const B = (await page(b, base + '&server=' + encodeURIComponent(server) + '&sala=' + code, { vp: { width: 667, height: 375 } })).p;
      await B.fill('#mpName', 'Rival'); await B.click('#mpJoin');
      await until(A, () => document.querySelectorAll('#mpPlayers li').length === 2);
      await A.click('#mpReady'); await B.click('#mpReady');
      const playing = await until(A, () => __SD.NET.N.phase === 'playing' && __SD.state === 'playing', null, 15000) && await until(B, () => __SD.NET.N.phase === 'playing', null, 15000);
      check('partida online en marcha con el HUD 2 en un lado', playing);
      const room = gs.rooms.get(code);
      room.debug.place('A', -10, -3, -Math.PI / 2); room.debug.place('B', 10, -3, Math.PI / 2); await sleep(1500);
      await A.keyboard.press('Digit2');
      check('tecla 2 online: el servidor saca la pistola y la barra lo muestra', await until(A, () => __SD.LOAD.active === 'pistol' && __SD.LOAD.phase === 'ready', null, 6000) && room.seats.A.p.load.active === 'pistol' && /\bon\b/.test((await slot(A, 2)).cls));
      await A.keyboard.press('Digit1');
      check('tecla 1 online: vuelve el rifle (servidor y barra)', await until(A, () => __SD.LOAD.active === 'rifle' && __SD.LOAD.phase === 'ready', null, 6000) && room.seats.A.p.load.active === 'rifle' && /\bon\b/.test((await slot(A, 1)).cls));
      room.debug.set('B', 'lastHit', 1e15);
      await until(A, () => { const R = __SD.REMOTE; return R && R.g.visible; }, null, 6000);
      await A.evaluate(() => { __SD.input.scope = true; }); await until(A, () => __SD.WCORE.ads >= 1, null, 5000);
      await A.keyboard.down('KeyE'); await until(A, () => __SD.P.lean > 0.95, null, 5000); await sleep(300);
      // aim from the leaned camera at B's chest (the bullet leaves from there)
      await A.evaluate(() => { const S = __SD, R = S.REMOTE, P = S.P, o = S.AIM; const dx = R.g.position.x - o.ox, dy = R.g.position.y + 1.17 - o.oy, dz = R.g.position.z - o.oz; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); });
      await sleep(500);
      const offA = await leanOff(A), s0 = room.seats.A.shots, h0 = room.seats.A.hits, rej0 = room.log.filter(l => /rejected/.test(l)).length;
      await A.evaluate(() => { __SD.input.firePressed = true; });
      const hit = await until(B, () => __SD.P.hp < 100, null, 5000);
      await A.keyboard.up('KeyE'); await A.evaluate(() => { __SD.input.scope = false; });
      const rej = room.log.filter(l => /rejected/.test(l)).length - rej0;
      check('apuntando y asomado: el servidor acepta el disparo (sin rechazo) y B recibe el impacto', offA > 0.2 && room.seats.A.shots === s0 + 1 && room.seats.A.hits === h0 + 1 && rej === 0 && hit, 'desplazamiento ' + offA.toFixed(2) + ' m · rechazos ' + rej);
      await gs.close(); }
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close && srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
