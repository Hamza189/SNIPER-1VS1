/* Headless smoke test of the WHOLE built page.
   Three.js and the DOM are replaced by permissive stand-ins, so this does NOT test rendering,
   raycast hits or visuals. It does run every game loop path (menu, duel, range, death, respawn,
   pause, debug panel) for thousands of frames and catches runtime errors, leaks and broken flow. */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

// ---- universal stand-in: any property, call or construction works and remembers assignments
function U() {
  const store = Object.create(null);
  const fn = function () {};
  return new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return h => (h === 'string' ? '' : 0);
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined;
      if (k in store) return store[k];
      return (store[k] = U());
    },
    set(t, k, v) { store[k] = v; return true; },
    apply() { return U(); },
    construct() { return U(); }
  });
}
const listeners = {};
const addL = (target) => (type, fn) => { (listeners[target + ':' + type] = listeners[target + ':' + type] || []).push(fn); };
const elements = {};
function el(sel) { if (!elements[sel]) { const e = U(); e.addEventListener = addL(sel); e.hidden = false; e.classList = { add() {}, remove() {}, toggle() {}, contains: () => false }; e.dataset = {}; elements[sel] = e; } return elements[sel]; }
let rafCb = null, now = 0;
const storage = {};
const THREE = U();
class Raycaster { constructor() { this.near = 0; this.far = Infinity; } set() {} intersectObjects() { return []; } }
THREE.Raycaster = Raycaster;
const document = {
  querySelector: el, querySelectorAll: () => [], getElementById: id => el('#' + id),
  createElement: () => { const e = U(); e.getContext = () => U(); return e; },
  addEventListener: addL('document'), body: el('body'), documentElement: el('html'),
  pointerLockElement: null, hidden: false, exitPointerLock() {}
};
const ctx = vm.createContext({
  THREE, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener: addL('window'),
  matchMedia: () => ({ matches: false }), AudioContext: undefined,
  document, navigator: {}, localStorage: { getItem: k => storage[k] ?? null, setItem: (k, v) => { storage[k] = v; } },
  performance: { now: () => now }, requestAnimationFrame: cb => { rafCb = cb; },
  setTimeout: () => 0, console, Math, JSON, Object, Array, Map, Set, Int32Array, Number, String, Symbol, Proxy, Error
});
ctx.window = ctx; ctx.globalThis = ctx;
const window = ctx;
// core scripts attach to window
let errors = [];
try { for (const src of scripts) vm.runInContext(src, ctx, { filename: 'page.js' }); }
catch (e) { errors.push(e); console.log(e.stack); }
check('la página arranca sin errores', errors.length === 0);
const SD = window.__SD;
check('módulos core cargados (config, movimiento, arma)', !!(window.SD_CONFIG && window.SDMovement && window.SDWeapon));
if (!SD) { console.log('sin __SD, abortando'); process.exit(1); }

function frames(n, ms, each) {
  for (let i = 0; i < n; i++) {
    now += ms; if (each) each(i);
    try { rafCb(now); } catch (e) { errors.push(e); if (errors.length < 3) console.log(e.stack); break; }
  }
}
const key = (code, down) => (listeners['window:' + (down ? 'keydown' : 'keyup')] || []).forEach(f => f({ code, preventDefault() {} }));

console.log('\nMENÚ');
frames(60, 16);
check('el menú se renderiza 60 fotogramas sin errores', errors.length === 0 && SD.state === 'menu');

console.log('\nDUELO');
SD.setMode('duel'); SD.startMatch();
check('empieza la partida', SD.state === 'playing' && SD.BOTS.filter(b => b.alive).length === 3, SD.BOTS.filter(b => b.alive).length + ' bots');
SD.P.hp = 1e9; // stand-in raycasts give bots perfect sight: keep the player alive for the scripted part
Object.assign(SD.PM, { x: 2.5, y: 0, z: 40, vx: 0, vz: 0 }); SD.P.yaw = 0; // open street, facing north
key('KeyW', true); key('ShiftLeft', true);
frames(120, 16);
check('esprintar hacia delante mueve al jugador', Math.hypot(SD.PM.vx, SD.PM.vz) > 6.5 && SD.PM.sprinting, Math.hypot(SD.PM.vx, SD.PM.vz).toFixed(2) + ' m/s');
key('KeyC', true); frames(10, 16);
check('C esprintando inicia slide', SD.PM.sliding || SD.PM.mode === 'slide', SD.PM.mode);
key('KeyC', false); key('ShiftLeft', false); key('KeyW', false); frames(60, 16);
SD.input.scope = true; frames(30, 16);
check('ADS con clic derecho llega a 100 %', SD.WCORE.ads === 1);
const shots0 = SD.STATS.shots;
for (let k = 0; k < 6; k++) { SD.input.firePressed = true; frames(80, 16); }
SD.P.hp = 100;
check('disparos con mira (5 + recarga automática)', SD.STATS.shots - shots0 >= 5, (SD.STATS.shots - shots0) + ' disparos');
check('tras vaciar el cargador recarga', SD.WCORE.state === 'reload' || SD.WCORE.ammo === 5, SD.WCORE.state + ' ' + SD.WCORE.ammo);
SD.input.scope = false;
// long run: bots shoot (stand-in LOS is always clear), player dies and respawns
let maxBullets = 0, maxEvents = 0, sawDead = false, sawRespawn = false;
frames(60 * 90, 16, () => {
  if (Math.random() < 0.02) SD.input.firePressed = true;
  SD.input.lookDX = 3;
  maxBullets = Math.max(maxBullets, SD.BULLETS.length); maxEvents = Math.max(maxEvents, SD.EVENTS.length);
  if (SD.state === 'dead') sawDead = true; if (sawDead && SD.state === 'playing' && SD.P.alive) sawRespawn = true;
});
check('90 s de duelo sin errores', errors.length === 0, errors[0] && errors[0].message);
check('el jugador muere y reaparece', sawDead && (sawRespawn || SD.state === 'over'), SD.state);
check('proyectiles activos acotados (sin fugas)', maxBullets <= 4, 'máx ' + maxBullets);
check('cola de eventos acotada', maxEvents < 40, 'máx ' + maxEvents);
let parts = SD.PARTS.filter(p => p.s.visible).length;
check('partículas dentro del pool fijo', parts <= SD.PARTS.length, parts + '/' + SD.PARTS.length);

console.log('\nPAUSA Y PANEL');
if (SD.state !== 'over') {
  SD.pause(); const g0 = SD.PM.x; frames(30, 16);
  check('en pausa la simulación se detiene', SD.state === 'paused' && SD.PM.x === g0);
  SD.resume(); frames(10, 16);
  check('reanudar vuelve a jugar', SD.state === 'playing' || SD.state === 'dead');
}
key('F3', true); key('F3', false); frames(40, 16);
check('panel F3 se actualiza sin errores', errors.length === 0);

console.log('\nCAMPO DE TIRO');
SD.toMenu(); frames(5, 16);
SD.setMode('range'); SD.startMatch();
check('campo de tiro: 8 dianas vivas', SD.DUMMIES.filter(b => b.alive).length === 8 && SD.BOTS.every(b => !b.alive));
SD.input.scope = true; const s0 = SD.STATS.shots;
let presses = 0;
for (let k = 0; k < 600; k++) { if (SD.WCORE.state === 'ready' && presses < 12) { SD.input.firePressed = true; presses++; } frames(1, 16); }
check('campo de tiro: cada pulsación con el arma lista dispara', SD.STATS.shots - s0 === presses, (SD.STATS.shots - s0) + '/' + presses);
check('campo de tiro: el jugador no recibe daño', SD.P.hp === 100);
// kill a dummy directly, it must come back after ~3 s
const d = SD.DUMMIES[0]; d.damage(250, 'head', 20, { x: 0, z: 1 });
frames(Math.round(2.0 / 0.016), 16);
const deadAt2 = !d.alive;
frames(Math.round(1.3 / 0.016), 16);
check('diana derribada vuelve a los 3 s', deadAt2 && d.alive);
key('F3', true); frames(20, 16);
check('campo de tiro sin errores', errors.length === 0, errors[0] && errors[0].message);

console.log('\nINDEPENDENCIA DE FPS (juego completo)');
function runAt(ms, seconds) {
  SD.toMenu(); frames(2, 16); SD.setMode('range'); SD.startMatch();
  const st = SD.PM; st.x = 0; st.z = 57.5; st.vx = st.vz = 0; SD.P.yaw = Math.PI;
  const start = now; let pressed = false;
  key('KeyW', true); key('ShiftLeft', true);
  frames(Math.round(seconds * 1000 / ms), ms, () => { if (!pressed && now - start > 600) { key('KeyC', true); pressed = true; } });
  key('KeyW', false); key('ShiftLeft', false); key('KeyC', false);
  return { x: st.x, z: st.z };
}
const a = runAt(1000 / 30, 1.5), b = runAt(1000 / 144, 1.5);
const dz = Math.abs(a.z - b.z);
check('30 FPS y 144 FPS recorren lo mismo (sprint + slide)', dz < 0.12, 'Δ ' + (dz * 100).toFixed(1) + ' cm (el tiempo de pulsar la tecla se redondea a un fotograma)');

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
