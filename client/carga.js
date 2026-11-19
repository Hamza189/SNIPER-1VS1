/* SNIPER DUEL — PANTALLA DE CARGA (?carga=2, 18-11-2026, docs/CARGA.md).
   Owner: «la típica barrita que va del 0% al 100%, lo digo para que en ese momento cargue todas las armas, texturas,
   personajes, mapas, etc...».
   Pure: no DOM, no three.js. The page gives a list of pieces (each one something real: a file downloaded, a character
   on the GPU, the shaders compiled…) and asks this module, every tick, what the bar says and what to start next.

   A piece: { id, cat, name, mode:'gpu'|'cache', min?:bool, w?:number, start?:bool }
     gpu   = it ends in memory / on the GPU (what the next match uses)
     cache = it is only downloaded to the device (service worker), nothing is decoded: «para después»
     min   = needed before ENTRAR YA may show (the menu works without the rest)
   A status: st[id] = { s:'wait'|'run'|'ok'|'fail'|'skip', f:0..1 (partial, from bytes), t:ms of the last change }
   ok / fail / skip all count as done: a file that fails never blocks the bar (the game has its own fallback). */
(function (root) {
'use strict';
const CATS = [
  { k: 'motor', name: 'MOTOR 3D', w: 8 },
  { k: 'tex', name: 'TEXTURAS', w: 10 },
  { k: 'mapa', name: 'MAPA', w: 16 },
  { k: 'pj', name: 'PERSONAJES', w: 24 },
  { k: 'armas', name: 'ARMAS', w: 18 },
  { k: 'prep', name: 'PREPARANDO', w: 10 },
  { k: 'desc', name: 'PARA DESPUÉS', w: 14 }
];
const CAT = Object.fromEntries(CATS.map(c => [c.k, c]));
const DONE = { ok: 1, fail: 1, skip: 1 };
const isDone = s => !!(s && DONE[s.s]);

// each category's weight split among its pieces (a piece may weigh more with w); empty categories drop out
function plan(pieces) {
  const by = {};
  for (const p of pieces) (by[p.cat] || (by[p.cat] = [])).push(p);
  const out = [];
  for (const c of CATS) {
    const L = by[c.k]; if (!L) continue;
    const tot = L.reduce((s, p) => s + (p.w || 1), 0);
    for (const p of L) { p.wt = c.w * (p.w || 1) / tot; out.push(p); }   // the page's own objects (they keep their bytes)
  }
  return out;
}
const frac = s => !s ? 0 : DONE[s.s] ? 1 : s.s === 'run' ? Math.max(0, Math.min(0.95, s.f || 0)) : 0;
// 0–100. 100 only when every piece is done (a 99.6 shows as 99)
function progress(P, st) {
  let a = 0, w = 0;
  for (const p of P) { w += p.wt; a += p.wt * frac(st[p.id]); }
  if (!w) return 100;
  const all = P.every(p => isDone(st[p.id]));
  return all ? 100 : Math.min(99, Math.floor(a / w * 100));
}
// what the line under the bar says: the first category not finished, «PERSONAJES 2/4 · S.W.A.T.»
function label(P, st) {
  for (const c of CATS) {
    const L = P.filter(p => p.cat === c.k); if (!L.length) continue;
    const n = L.filter(p => isDone(st[p.id])).length; if (n === L.length) continue;
    const cur = L.find(p => st[p.id] && st[p.id].s === 'run') || L.find(p => !isDone(st[p.id]));
    return { cat: c.k, text: c.name + ' ' + n + '/' + L.length, item: cur ? cur.name : '' };
  }
  return { cat: '', text: 'LISTO', item: '' };
}
// per category: 'done' | 'run' | 'wait' (the row of little marks)
function cats(P, st) {
  const out = [];
  for (const c of CATS) {
    const L = P.filter(p => p.cat === c.k); if (!L.length) continue;
    const n = L.filter(p => isDone(st[p.id])).length;
    out.push({ k: c.k, name: c.name, n, of: L.length, state: n === L.length ? 'done' : L.some(p => st[p.id] && st[p.id].s === 'run') || n ? 'run' : 'wait' });
  }
  return out;
}
/* What to start now. Phones (one:true): strictly in order and one at a time — a piece is started only when every piece
   before it is done (Safari closes the page if several characters / maps are unpacked at once: 29-10 and 17/18-11).
   Computers: up to `gpu` pieces in memory at once and `cache` downloads; downloads always after the memory pieces on a
   phone (they would compete for the network with what you need now). */
function next(P, st, pol) {
  pol = pol || {};
  const want = [];
  if (pol.one) {
    for (const p of P) {
      const s = st[p.id];
      if (isDone(s)) continue;
      if (s && s.s === 'run') break;           // the current one first
      if (p.start) want.push(p.id);
      break;                                    // a passive piece not done yet (the game loads it): wait for it
    }
    return want;
  }
  let g = P.filter(p => p.mode !== 'cache' && st[p.id] && st[p.id].s === 'run' && p.start).length;
  let c = P.filter(p => p.mode === 'cache' && st[p.id] && st[p.id].s === 'run').length;
  const gpuLeft = P.some(p => p.mode !== 'cache' && !isDone(st[p.id]));
  for (const p of P) {
    const s = st[p.id];
    if (!p.start || (s && s.s !== 'wait')) continue;
    if (p.mode === 'cache') { if (c < (pol.cache || 2) && !(pol.cacheAfter && gpuLeft)) { want.push(p.id); c++; } }
    else if (p.cat === 'prep') { if (P.every(q => q.mode === 'cache' || q.cat === 'prep' || isDone(st[q.id]))) want.push(p.id); }   // the warm-up goes last
    else if (g < (pol.gpu || 3)) { want.push(p.id); g++; }
  }
  return want;
}
const minReady = (P, st) => P.filter(p => p.min).every(p => isDone(st[p.id]));
const gpuDone = (P, st) => P.filter(p => p.mode !== 'cache').every(p => isDone(st[p.id]));
// running pieces that have not moved for `ms` (a slow or stuck network): skipped, the game keeps loading them by itself
function stalled(P, st, now, ms) {
  return P.filter(p => { const s = st[p.id]; return s && s.s === 'run' && !p.noStall && s.t && now - s.t > ms; }).map(p => p.id);
}
/* ENTRAR YA: when what the menu needs is there and the wait has been noticeable (or, with nothing at all after a long
   while, anyway: a page that never lets you in is worse than a menu still loading) */
function canSkip(o) { return !o.done && ((o.min && o.elapsed > (o.after || 2500)) || o.elapsed > (o.force || 15000)); }
// a status change: only the time of a real change counts as «moving» (stalled)
function set(st, id, s, f, now) {
  const o = st[id] || (st[id] = { s: 'wait', f: 0, t: now });
  if (o.s === s && Math.abs((o.f || 0) - (f || 0)) < 0.002) return false;
  if (DONE[o.s]) return false;             // done stays done
  o.s = s; o.f = f || 0; o.t = now; return true;
}
const mb = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace('.', ',') + ' MB';

const SDCarga = { CATS, CAT, plan, progress, label, cats, next, minReady, gpuDone, stalled, canSkip, set, isDone, mb };
if (typeof module !== 'undefined' && module.exports) module.exports = SDCarga; else root.SDCarga = SDCarga;
})(typeof window !== 'undefined' ? window : globalThis);
