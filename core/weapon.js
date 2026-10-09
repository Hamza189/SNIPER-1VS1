/* SNIPER DUEL — weapon logic, ballistics and recoil.
   Pure and deterministic, no Three.js. The client turns the events into sound and animation;
   the future server will run tick() + the ballistics to validate hits. */
(function (root) {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const ss = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (p, a, b) => ss((p - a) / (b - a));
const bump = (p, a, b) => { const t = clamp((p - a) / (b - a), 0, 1); return Math.sin(t * Math.PI); };

/* ---------------- weapon state machine ----------------
   states: raise → ready ⇄ bolt ; ready → reload → ready
   cmd = { fire (edge), ads (held/toggled), reload (edge) }
   ctx = { sprinting, alive, holstered }
   holstered (another weapon is out, or the rifle is being drawn):
     no ADS, no firing, reload progress pauses (never resets), the bolt keeps cycling,
     so switching weapons can never be used to fire sooner.
   tick() returns events: fire, dry, boltLift, boltBack, eject, boltFwd, boltLock, ready,
                          reloadStart, magOut, magIn, reloadEnd                          */
function createState(cfg) {
  return { cfg, ammo: cfg.mag, state: 'raise', t: 0, ads: 0, fireBuf: 0, sprintRecover: 0, fired: {}, magIn: false, shots: 0, bloom: 0 };
}
function setState(w, st) { w.state = st; w.t = 0; w.fired = {}; w.magIn = false; w.endAt = null; }
function once(w, key, cond, ev, e) { if (cond && !w.fired[key]) { w.fired[key] = true; ev.push(e); } }
function startReload(w, ev) {
  if (w.state === 'reload') return;
  setState(w, 'reload'); w.shellsIn = 0; w.stop = false; ev.push({ type: 'reloadStart' });
}
function resetForSpawn(w) { w.ammo = w.cfg.mag; setState(w, 'raise'); w.ads = 0; w.fireBuf = 0; w.sprintRecover = 0; w.bloom = 0; w.stop = false; w.shellsIn = 0; }

function tick(w, cmd, dt, ctx) {
  const c = w.cfg, ev = [];
  const hol = !!ctx.holstered;
  if (!(hol && w.state === 'reload')) w.t += dt;
  w.fireBuf = Math.max(0, w.fireBuf - dt);
  if (c.bloomDecay) w.bloom = Math.max(0, (w.bloom || 0) - c.bloomDecay * dt);   // rapid-fire spread calms down
  if (ctx.sprinting) w.sprintRecover = c.sprintOut; else w.sprintRecover = Math.max(0, w.sprintRecover - dt);
  if (cmd.fire) w.fireBuf = c.fireBuffer + (ctx.sprinting ? 0 : w.sprintRecover);

  // aim down sights: linear progress, the presentation layer eases it
  const canAds = cmd.ads && ctx.alive && !hol && !ctx.sprinting && w.state !== 'reload' && w.state !== 'raise';
  w.ads = clamp(w.ads + (canAds ? dt / c.adsTime : -dt / c.adsOutTime), 0, 1);

  if (cmd.reload && !hol && w.state === 'ready' && w.ammo < c.mag) startReload(w, ev);

  switch (w.state) {
    case 'raise': if (w.t >= c.raise) { setState(w, 'ready'); ev.push({ type: 'ready' }); } break;
    case 'bolt': {
      const p = w.t / c.bolt, k = c.boltKeys;
      once(w, 'lift', p >= k.lift[0], ev, { type: 'boltLift' });
      once(w, 'back', p >= k.back[0], ev, { type: 'boltBack' });
      once(w, 'eject', p >= k.eject, ev, { type: 'eject' });
      once(w, 'fwd', p >= k.fwd[0], ev, { type: 'boltFwd' });
      if (p >= 1) {
        ev.push({ type: 'boltLock' });
        setState(w, 'ready'); ev.push({ type: 'ready' });
        if (w.ammo <= 0) startReload(w, ev);
      }
      break;
    }
    case 'reload': {
      if (hol) break; // paused while holstered
      if (c.shells) {   // tube: hands to the port, one shell at a time, back to the pump
        const S = c.shells;
        if (cmd.fire && w.ammo > 0) w.stop = true;          // pressing the trigger stops the loading
        if (w.endAt === null || w.endAt === undefined) {
          const k = Math.floor((w.t - S.start) / S.each + 1e-9);   // shells fully pushed in by now
          if (w.t >= S.start && k > (w.shellsIn || 0) && w.ammo < c.mag) { w.shellsIn = (w.shellsIn || 0) + 1; w.ammo++; ev.push({ type: 'shellIn', n: w.ammo }); }
          if (w.ammo >= c.mag || (w.stop && w.ammo > 0)) { w.endAt = w.t; ev.push({ type: 'reloadEnding' }); }
        }
        if (w.endAt !== null && w.endAt !== undefined && w.t - w.endAt >= S.end - 1e-9) {
          const shoot = w.stop; setState(w, 'ready'); w.stop = false; ev.push({ type: 'reloadEnd' }, { type: 'ready' });
          if (shoot) w.fireBuf = Math.max(w.fireBuf, c.fireBuffer);   // the press that stopped it fires now
        }
        break;
      }
      const p = w.t / c.reload, k = c.reloadKeys, b = k.bolt;
      once(w, 'out', p >= k.magOut[0], ev, { type: 'magOut' });
      if (!w.magIn && p >= k.magIn[1]) { w.magIn = true; w.ammo = c.mag; ev.push({ type: 'magIn' }); }
      const bp = (p - b[0]) / (b[1] - b[0]);
      once(w, 'rlift', bp >= c.boltKeys.lift[0], ev, { type: 'boltLift' });
      once(w, 'rback', bp >= c.boltKeys.back[0], ev, { type: 'boltBack' });
      once(w, 'rfwd', bp >= c.boltKeys.fwd[0], ev, { type: 'boltFwd' });
      once(w, 'rlock', bp >= 1, ev, { type: 'boltLock' });
      if (p >= 1) { setState(w, 'ready'); ev.push({ type: 'reloadEnd' }, { type: 'ready' }); }
      break;
    }
  }

  // trigger: fires on the same tick the bolt locks if the press was buffered
  if (hol) w.fireBuf = 0;
  if (w.fireBuf > 0 && ctx.alive && w.state === 'ready' && w.sprintRecover <= 0) {
    if (w.ammo > 0) {
      w.ammo--; w.shots++; w.fireBuf = 0;
      if (c.bloomPerShot) w.bloom = Math.min(c.bloomMax, (w.bloom || 0) + c.bloomPerShot);
      ev.push({ type: 'fire', ads: w.ads, scoped: w.ads >= c.scopeAt, n: w.shots });
      setState(w, 'bolt');
    } else if (cmd.fire) { w.fireBuf = 0; ev.push({ type: 'dry' }); startReload(w, ev); }
  }
  return ev;
}

/* Accuracy rule (the same for everyone, no hidden randomness once scoped):
   - Once the scope picture is up (ads ≥ scopeAt) the bullet leaves exactly along the reticle.
     Movement and jumping only show up as visible sway, never as invisible spread.
   - Before that (hip fire / mid-transition) there is a random cone that shrinks with ADS progress
     and grows with speed and when airborne. The hip crosshair gap shows that cone.             */
function spread(w, m) {
  const c = w.cfg;
  if (w.ads >= c.scopeAt) return 0;
  // iron sights (scopeAt > 1): full ADS reaches adsSpreadMin; a scope reaches it right before the picture
  const t = c.scopeAt > 1 ? w.ads : w.ads / c.scopeAt;
  let s = c.hipSpread * (1 + (c.adsSpreadMin - 1) * t) + (w.bloom || 0);
  s += Math.min(m.speed / 7, 1.3) * c.moveSpread;
  if (m.airborne) s += c.airSpread;
  if (m.crouch && !m.sliding) s *= c.crouchSpreadMul;
  return s;
}

/* Animation poses derived from the same timeline as the events, so sound and motion line up
   and every pose returns exactly to rest when the gun becomes ready (no snap). */
function boltPose(p, k) {
  return { lift: seg(p, k.lift[0], k.lift[1]) - seg(p, k.down[0], k.down[1]),
           back: seg(p, k.back[0], k.back[1]) - seg(p, k.fwd[0], k.fwd[1]),
           tilt: bump(p, 0.04, 1.0) };
}
function reloadPose(p, c) {
  const k = c.reloadKeys, b = k.bolt;
  const out = seg(p, k.magOut[0], k.magOut[1]), inn = seg(p, k.magIn[0], k.magIn[1]);
  const bp = clamp((p - b[0]) / (b[1] - b[0]), 0, 1);
  const bolt = (p > b[0] && p < b[1]) ? boltPose(bp, c.boltKeys) : { lift: 0, back: 0 };
  return { tilt: bump(p, 0.02, 1.0), magDrop: p < (k.magOut[1] + k.magIn[0]) / 2 ? out : 1 - inn,
           magVisible: !(p > k.magOut[1] && p < k.magIn[0]), lift: bolt.lift, back: bolt.back };
}

/* ---------------- shotgun pattern ----------------
   Fixed, readable pattern (centre, inner ring, outer ring) turned by the golden angle on every
   shot: the client and the server compute exactly the same pellets from the same centre
   direction, so nobody can send their own pellets. Returns unit vectors [x, y, z].        */
function pelletOffsets(c, ads, seed) {
  const n = c.pellets || 1, r = c.pelletSpread * (1 + ((c.pelletAdsMul || 1) - 1) * clamp(ads, 0, 1));
  const rot = (seed || 0) * 2.399963, out = [[0, 0]];
  const inner = Math.max(0, Math.min(n - 1, Math.round((n - 1) / 3))), outer = n - 1 - inner;
  for (let i = 0; i < inner; i++) { const a = rot + i * 2 * Math.PI / inner; out.push([Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45]); }
  for (let i = 0; i < outer; i++) { const a = rot + 0.6 + i * 2 * Math.PI / outer; out.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return out;
}
function pelletDirs(d, c, ads, seed) {
  // basis around the centre direction (right is horizontal, up is perpendicular to both)
  let rx = -d[2], rz = d[0], rn = Math.hypot(rx, rz);
  if (rn < 1e-6) { rx = 1; rz = 0; rn = 1; }
  rx /= rn; rz /= rn;
  const ux = -rz * d[1], uy = rz * d[0] - rx * d[2], uz = rx * d[1];   // up = right × d … (sign fixed below)
  const s = uy < 0 ? -1 : 1;
  return pelletOffsets(c, ads, seed).map(([a, b]) => {
    const ta = Math.tan(a), tb = Math.tan(b) * s;
    const x = d[0] + rx * ta + ux * tb, y = d[1] + uy * tb, z = d[2] + rz * ta + uz * tb, n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
  });
}

/* ---------------- ballistics ---------------- */
// barrel tilt above the line of sight so the drop curve crosses the reticle at cfg.zero metres
function zeroLift(c) { return Math.atan(c.gravity * c.zero / (2 * c.speed * c.speed)); }
function createBullet(ox, oy, oz, dx, dy, dz, c) {
  return { x: ox, y: oy, z: oz, vx: dx * c.speed, vy: dy * c.speed, vz: dz * c.speed, dist: 0, age: 0, done: false };
}
// advance one fixed step; returns the segment travelled so the caller can ray-test it
function stepBullet(b, dt, c) {
  const x0 = b.x, y0 = b.y, z0 = b.z;
  // exact parabola over the step: the path is identical whatever the step size
  b.x += b.vx * dt; b.y += b.vy * dt - 0.5 * c.gravity * dt * dt; b.z += b.vz * dt;
  b.vy -= c.gravity * dt; b.age += dt;
  const sx = b.x - x0, sy = b.y - y0, sz = b.z - z0, len = Math.hypot(sx, sy, sz);
  return { x0, y0, z0, dx: sx / len, dy: sy / len, dz: sz / len, len };
}

/* ---------------- recoil spring (visual camera kick) ---------------- */
function createRecoil() { return { p: 0, v: 0, y: 0, vy: 0 }; }
function kickRecoil(r, peak, yawPeak, rc) {
  // impulse that makes an underdamped spring peak at `peak`
  const w = Math.sqrt(rc.stiffness), z = Math.min(rc.damping, 0.99), wd = w * Math.sqrt(1 - z * z);
  const tPeak = Math.atan2(Math.sqrt(1 - z * z), z) / wd;
  const v0 = peak * w * Math.exp(z * w * tPeak);
  r.v += v0; r.vy += v0 * (yawPeak / (peak || 1));
}
function stepRecoil(r, dt, rc) {
  const k = rc.stiffness, c = 2 * Math.min(rc.damping, 1.5) * Math.sqrt(k), n = 8, h = dt / n;
  for (let i = 0; i < n; i++) {
    r.v += (-k * r.p - c * r.v) * h; r.p += r.v * h;
    r.vy += (-k * r.y - c * r.vy) * h; r.y += r.vy * h;
  }
}

const SDWeapon = { createState, tick, spread, startReload, resetForSpawn, boltPose, reloadPose, pelletOffsets, pelletDirs,
  zeroLift, createBullet, stepBullet, createRecoil, kickRecoil, stepRecoil };
if (typeof module !== 'undefined' && module.exports) module.exports = SDWeapon; else root.SDWeapon = SDWeapon;
})(typeof window !== 'undefined' ? window : globalThis);
