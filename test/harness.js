/* Shared headless harness: runs the built index.html in Node with Three.js and the DOM replaced
   by permissive stand-ins. Not a browser: no rendering, no real raycasts, no real touch hardware. */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
function boot(opts) {
  opts = opts || {};
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  function U() {
    const store = Object.create(null); const fn = function () {};
    return new Proxy(fn, {
      get(t, k) { if (k === Symbol.toPrimitive) return h => (h === 'string' ? '' : 0); if (k === Symbol.iterator) return function* () {}; if (k === 'then') return undefined; if (k in store) return store[k]; return (store[k] = U()); },
      set(t, k, v) { store[k] = v; return true; }, apply() { return U(); }, construct() { return U(); }
    });
  }
  const listeners = {}, elements = {}, storage = opts.storage || {};
  const addL = target => (type, fn) => { (listeners[target + ':' + type] = listeners[target + ':' + type] || []).push(fn); };
  function el(sel) {
    if (!elements[sel]) {
      const e = U(); e.addEventListener = addL(sel); e.hidden = false; e.dataset = {};
      const cls = new Set(); e.classList = { add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); }, contains: c => cls.has(c) };
      e.querySelectorAll = () => []; e.querySelector = q => el(q); e.setPointerCapture = () => {};
      elements[sel] = e;
    }
    return elements[sel];
  }
  let rafCb = null; const clock = { now: 0 };
  const THREE = U();
  class Raycaster { constructor() { this.near = 0; this.far = Infinity; } set() {} intersectObjects() { return []; } }
  THREE.Raycaster = Raycaster;
  const document = { querySelector: el, querySelectorAll: () => [], getElementById: id => el('#' + id),
    createElement: () => { const e = U(); e.getContext = () => U(); return e; },
    addEventListener: addL('document'), body: el('body'), documentElement: el('html'), pointerLockElement: null, hidden: false, exitPointerLock() {} };
  const ctx = vm.createContext({
    THREE, innerWidth: opts.width || 1280, innerHeight: opts.height || 720, devicePixelRatio: 1, addEventListener: addL('window'),
    matchMedia: q => ({ matches: !!opts.touch && /coarse/.test(q) }), AudioContext: undefined, navigator: { maxTouchPoints: opts.touch ? 5 : 0 },
    document, localStorage: { getItem: k => storage[k] ?? null, setItem: (k, v) => { storage[k] = v; } },
    performance: { now: () => clock.now }, requestAnimationFrame: cb => { rafCb = cb; }, screen: {},
    URLSearchParams, location: { search: '', origin: 'http://test', pathname: '/' }, history: { replaceState() {} },
    setTimeout: (f) => 0, setInterval: () => 0, console, Math, JSON, Object, Array, Map, Set, Int32Array, Number, String, Symbol, Proxy, Error
  });
  if (opts.touch) ctx.ontouchstart = null;
  ctx.window = ctx; ctx.globalThis = ctx;
  const errors = [];
  try { for (const src of scripts) vm.runInContext(src, ctx, { filename: 'page.js' }); } catch (e) { errors.push(e); console.log(e.stack); }
  const H = {
    ctx, SD: ctx.__SD, listeners, el, storage, errors, clock,
    frames(n, ms, each) { for (let i = 0; i < n; i++) { clock.now += ms; if (each) each(i); try { rafCb(clock.now); } catch (e) { errors.push(e); if (errors.length < 3) console.log(e.stack); break; } } },
    key(code, down) { (listeners['window:' + (down ? 'keydown' : 'keyup')] || []).forEach(f => f({ code, preventDefault() {} })); },
    fire(sel, type, ev) { (listeners[sel + ':' + type] || []).forEach(f => f(Object.assign({ type, preventDefault() {} }, ev || {}))); },
    // pointer events on the touch layer; btn = button name under the finger (or null)
    pointer(type, id, x, y, btn) {
      const target = { closest: () => (btn ? { dataset: { btn } } : null) };
      H.fire('#touch', type, { pointerId: id, clientX: x, clientY: y, target });
    }
  };
  return H;
}
module.exports = { boot };
