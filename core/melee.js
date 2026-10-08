/* SNIPER DUEL — loadout (weapon switching), knife logic, melee hit resolution and knife poses.
   Pure and deterministic, no Three.js. Shared by the client, the Node tests and the future server.

   The loadout decides which weapon is out. Switching = holster the current one, then draw the other.
   While the rifle is not fully drawn, SDWeapon.tick must receive ctx.holstered = true
   (see rifleHolstered): it cannot aim or fire, its reload pauses and its bolt keeps cycling. */
(function (root) {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ss = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (p, a, b) => ss((p - a) / (b - a));

/* ---------------- loadout + knife state ----------------
   cmd = { select: 'rifle' | 'knife' | null, attack (edge), inspect (edge) }
   events: holster, draw, drawn, swing, knifeHit, inspect */
function createLoadout(knifeCfg, loadCfg) {
  return { kc: knifeCfg, lc: loadCfg, active: 'rifle', phase: 'ready', t: 0, pending: null,
    knife: { state: 'idle', t: 0, side: 1, hitDone: false, buf: 0, swings: 0 } };
}
function holsterTime(L) { return L.active === 'rifle' ? L.lc.rifleHolster : L.kc.holster; }
function drawTime(L) { return L.active === 'rifle' ? L.lc.rifleDraw : L.kc.draw; }
function resetLoadout(L) { L.active = 'rifle'; L.phase = 'ready'; L.t = 0; L.pending = null; Object.assign(L.knife, { state: 'idle', t: 0, hitDone: false, buf: 0 }); }

function tickLoadout(L, cmd, dt) {
  const ev = [], k = L.knife, kc = L.kc;
  L.t += dt;
  // weapon selection
  if (cmd.select && cmd.select !== (L.pending || L.active)) {
    if (L.phase === 'holster') L.pending = cmd.select;                    // change of mind mid-holster
    else if (L.phase === 'draw' && cmd.select !== L.active) { L.phase = 'holster'; L.t = 0; L.pending = cmd.select; ev.push({ type: 'holster', weapon: L.active }); }
    else if (cmd.select !== L.active) { L.phase = 'holster'; L.t = 0; L.pending = cmd.select; ev.push({ type: 'holster', weapon: L.active }); }
  }
  // putting the knife away cancels a swing in progress: no hit can land after you start switching
  if (L.phase === 'holster' && L.active === 'knife' && k.state !== 'idle') { k.state = 'idle'; k.t = 0; k.hitDone = true; }
  if (L.phase === 'holster' && L.t >= holsterTime(L) - 1e-9) {
    L.active = L.pending; L.pending = null; L.phase = 'draw'; L.t = 0;
    if (L.active === 'knife') Object.assign(k, { state: 'idle', t: 0, hitDone: false, buf: 0 });
    ev.push({ type: 'draw', weapon: L.active });
  }
  if (L.phase === 'draw' && L.t >= drawTime(L) - 1e-9) { L.phase = 'ready'; L.t = 0; ev.push({ type: 'drawn', weapon: L.active }); }

  // knife
  k.buf = Math.max(0, k.buf - dt);
  if (L.active === 'knife' && L.phase !== 'holster') {
    if (cmd.attack) k.buf = kc.attackBuffer;
    k.t += dt;
    if (k.state === 'attack') {
      if (!k.hitDone && k.t >= kc.hitAt - 1e-9) { k.hitDone = true; ev.push({ type: 'knifeHit', side: k.side }); }
      if (k.t >= kc.interval - 1e-9) { k.state = 'idle'; k.t = 0; }
    } else if (k.state === 'inspect') {
      if (k.t >= kc.inspect - 1e-9) { k.state = 'idle'; k.t = 0; }
    }
    if (L.phase === 'ready') {
      if (k.buf > 0 && (k.state === 'idle' || k.state === 'inspect')) {
        k.state = 'attack'; k.t = 0; k.hitDone = false; k.buf = 0; k.side = -k.side; k.swings++;
        ev.push({ type: 'swing', side: k.side });
      } else if (cmd.inspect && k.state === 'idle') { k.state = 'inspect'; k.t = 0; ev.push({ type: 'inspect' }); }
    }
  } else if (k.state !== 'idle') { k.state = 'idle'; k.t = 0; }
  return ev;
}
function rifleHolstered(L) { return !(L.active === 'rifle' && L.phase === 'ready'); }
function speedMul(L) { return L.active === 'knife' && L.phase !== 'holster' ? L.kc.moveMul : 1; }

/* ---------------- melee hit resolution ----------------
   attacker = { x, z, eyeY, fx, fz }           (fx,fz = horizontal facing, unit length)
   targets  = [{ ref, x, z, y0, y1, radius, fx, fz }]  (y0..y1 body height, fx,fz = where the target faces)
   losFn(target) → true if nothing solid is between attacker and target
   returns { target, dist, back, damage } or null                                    */
function resolve(att, targets, kc, losFn) {
  let best = null;
  for (const t of targets) {
    const dx = t.x - att.x, dz = t.z - att.z, d = Math.hypot(dx, dz);
    const gap = d - t.radius;
    if (gap > kc.range) continue;
    if (att.eyeY < t.y0 - 0.3 || att.eyeY > t.y1 + 0.9) continue;          // vertical reach
    const cone = d < kc.closeDist ? kc.closeCone : kc.cone;
    if (d > 1e-6) {
      const cosA = (dx * att.fx + dz * att.fz) / d;
      if (cosA < Math.cos(cone)) continue;
    }
    if (losFn && !losFn(t)) continue;                                        // walls block the blade
    if (!best || d < best.dist) best = { target: t, dist: d };
  }
  if (!best) return null;
  const t = best.target;
  // backstab from the TARGET's orientation: is the attacker behind the way it faces?
  const ax = att.x - t.x, az = att.z - t.z, al = Math.hypot(ax, az) || 1;
  const facing = (ax * t.fx + az * t.fz) / al;            // 1 = attacker in front, -1 = right behind
  best.back = facing <= -Math.cos(kc.backArc);
  best.damage = best.back ? kc.dmgBack : kc.dmgFront;
  return best;
}

/* ---------------- knife poses (offsets from the idle pose) ----------------
   Every pose starts and ends at rest so switching between them never snaps. */
const ZERO = () => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 });
function mix(a, b, t) { const o = {}; for (const k in a) o[k] = a[k] + (b[k] - a[k]) * t; return o; }
function slashPose(p, side) {
  const W = { x: 0.05 * side, y: 0.045, z: 0.03, rx: 0.25, ry: -0.35 * side, rz: 0.55 * side };
  const S = { x: -0.13 * side, y: -0.05, z: -0.13, rx: -0.25, ry: 0.55 * side, rz: -0.65 * side };
  if (p < 0.18) return mix(ZERO(), W, seg(p, 0, 0.18));
  if (p < 0.42) return mix(W, S, seg(p, 0.18, 0.42));
  return mix(S, ZERO(), seg(p, 0.42, 1));
}
function drawPose(p) { const q = 1 - ss(p); return { x: 0.02 * q, y: -0.26 * q, z: 0.05 * q, rx: -0.9 * q, ry: 0, rz: 0.4 * q }; }
function inspectPose(p) {
  const show = { x: -0.11, y: 0.05, z: 0.04, rx: -0.2, ry: 1.25, rz: 0.35 };
  const flip = { x: -0.09, y: 0.04, z: 0.03, rx: 0.15, ry: -1.0, rz: -0.3 };
  let o;
  if (p < 0.2) o = mix(ZERO(), show, seg(p, 0, 0.2));
  else if (p < 0.6) o = Object.assign({}, show);
  else if (p < 0.78) o = mix(show, flip, seg(p, 0.6, 0.78));
  else o = mix(flip, ZERO(), seg(p, 0.78, 1));
  o.twirl = (Math.PI * 2 * seg(p, 0.25, 0.55)) % (Math.PI * 2);  // spin around the blade, visually continuous
  return o;
}

const SDMelee = { createLoadout, resetLoadout, tickLoadout, rifleHolstered, speedMul, resolve, slashPose, drawPose, inspectPose };
if (typeof module !== 'undefined' && module.exports) module.exports = SDMelee; else root.SDMelee = SDMelee;
})(typeof window !== 'undefined' ? window : globalThis);
