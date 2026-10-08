/* SNIPER DUEL — player movement simulation.
   Pure and deterministic: (state, command, dt, world, cfg) → new state + events.
   No rendering, no input devices, no Three.js. The client runs it every fixed tick;
   a future authoritative server can run the exact same code on the same commands.

   command = { mx, mz,        // local move input, -1..1 (mz < 0 = forward)
               yaw,           // radians, facing
               sprint, crouch,// held states (crouch is "wants to be crouched")
               crouchPressed, // edge: crouch went down this tick (starts a slide)
               jump,          // edge: jump pressed this tick
               ads,           // 0..1 aim-down-sights progress (slows you down)
               reloading }
   world   = { colliders:[{minX,minY,minZ,maxX,maxY,maxZ}], ramps:[{minX,maxX,minZ,maxZ,axis,hLow,hHigh,highAtMin}] } */
(function (root) {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function createState(x, y, z) {
  return { x: x || 0, y: y || 0, z: z || 0, vx: 0, vy: 0, vz: 0,
    onGround: true, coyote: 0, jumpBuf: 0, airCap: 0,
    crouch: false, sliding: false, slideT: 0, slideCD: 0, sdx: 0, sdz: 0,
    sprinting: false, eye: 1.62, mode: 'idle' };
}

function rampH(r, x, z) {
  const t = clamp(r.axis === 'x' ? (x - r.minX) / (r.maxX - r.minX) : (z - r.minZ) / (r.maxZ - r.minZ), 0, 1);
  return r.highAtMin ? r.hHigh + (r.hLow - r.hHigh) * t : r.hLow + (r.hHigh - r.hLow) * t;
}

// circle (radius R) vs axis-aligned boxes in XZ; boxes you can step onto are ignored
function collideXZ(s, world, cfg, height) {
  const R = cfg.radius, feet = s.y;
  let px = 0, pz = 0;
  for (let pass = 0; pass < 2; pass++) for (const c of world.colliders) {
    if (c.maxY <= feet + cfg.step || c.minY >= feet + height) continue;
    const cx = clamp(s.x, c.minX, c.maxX), cz = clamp(s.z, c.minZ, c.maxZ);
    const dx = s.x - cx, dz = s.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    let ox = 0, oz = 0;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (R - d) / d; ox = dx * k; oz = dz * k; }
    else {
      const l = s.x - c.minX, r = c.maxX - s.x, b = s.z - c.minZ, f = c.maxZ - s.z, m = Math.min(l, r, b, f);
      if (m === l) ox = -(l + R); else if (m === r) ox = r + R; else if (m === b) oz = -(b + R); else oz = f + R;
    }
    s.x += ox; s.z += oz; px += ox; pz += oz;
  }
  const pl = Math.hypot(px, pz);
  if (pl > 1e-6) { // remove the velocity component pointing into the wall
    const nx = px / pl, nz = pz / pl, vn = s.vx * nx + s.vz * nz;
    if (vn < 0) { s.vx -= nx * vn; s.vz -= nz * vn; }
    return true;
  }
  return false;
}

function groundAt(s, world, cfg, feet) {
  let g = 0; const r = cfg.radius * 0.7;
  for (const c of world.colliders) {
    if (c.maxY > feet + cfg.step) continue;
    if (s.x + r < c.minX || s.x - r > c.maxX || s.z + r < c.minZ || s.z - r > c.maxZ) continue;
    if (c.maxY > g) g = c.maxY;
  }
  for (const rp of (world.ramps || [])) {
    if (s.x < rp.minX || s.x > rp.maxX || s.z < rp.minZ || s.z > rp.maxZ) continue;
    const h = rampH(rp, s.x, s.z);
    if (h <= feet + cfg.step && h > g) g = h;
  }
  return g;
}

function endSlide(s, cfg, ev) {
  if (!s.sliding) return;
  s.sliding = false; s.slideCD = cfg.slideCooldown; ev.push({ type: 'slideEnd' });
}

function step(s, cmd, dt, world, cfg) {
  const ev = [];
  let mx = cmd.mx || 0, mz = cmd.mz || 0;
  const il = Math.hypot(mx, mz); if (il > 1) { mx /= il; mz /= il; }
  const sy = Math.sin(cmd.yaw), cy = Math.cos(cmd.yaw);
  const fx = -sy, fz = -cy, rx = cy, rz = -sy;               // forward / right on the ground
  const wx = rx * mx - fx * mz, wz = rz * mx - fz * mz;       // wish vector (length ≤ 1)
  const wl = Math.hypot(wx, wz);

  s.slideCD = Math.max(0, s.slideCD - dt);
  s.jumpBuf = Math.max(0, s.jumpBuf - dt);
  if (cmd.jump) s.jumpBuf = cfg.jumpBuffer;
  s.coyote = s.onGround ? cfg.coyote : Math.max(0, s.coyote - dt);

  let hs = Math.hypot(s.vx, s.vz);

  // ---- slide start / end
  if (cmd.crouchPressed && !s.sliding && s.onGround && s.slideCD <= 0 && hs >= cfg.slideMinSpeed) {
    s.sliding = true; s.slideT = 0;
    const sp = Math.min(hs + cfg.slideBoost, cfg.slideMax);
    s.sdx = s.vx / hs; s.sdz = s.vz / hs; s.vx = s.sdx * sp; s.vz = s.sdz * sp;
    ev.push({ type: 'slideStart', speed: sp });
  }
  if (s.sliding && !cmd.crouch) endSlide(s, cfg, ev); // releasing crouch cancels the slide

  s.sprinting = !!cmd.sprint && mz < -0.3 && !s.sliding && !cmd.crouch && s.onGround && !(cmd.ads > 0.3);
  s.crouch = !!cmd.crouch || s.sliding;

  // ---- horizontal velocity
  if (s.sliding) {
    s.slideT += dt;
    if (Math.abs(mx) > 0.05) { // steer: rotate slide direction toward the right/left
      const a = mx * cfg.slideSteer * dt, ca = Math.cos(a), sa = Math.sin(a);
      const nx = s.sdx * ca - s.sdz * sa, nz = s.sdx * sa + s.sdz * ca; s.sdx = nx; s.sdz = nz;
    }
    let sp = Math.hypot(s.vx, s.vz);
    sp = Math.max(0, sp - (cfg.slideFriction + sp * cfg.slideDrag) * dt);
    s.vx = s.sdx * sp; s.vz = s.sdz * sp;
    if (sp <= cfg.slideMinEnd || s.slideT >= cfg.slideMaxTime) endSlide(s, cfg, ev);
  } else if (s.onGround) {
    let speed = s.sprinting ? cfg.sprint : s.crouch ? cfg.crouch : cfg.walk;
    if (!s.sprinting && mz > 0.3) speed *= cfg.backMul;
    if (cmd.ads > 0.5) speed = Math.min(speed, (s.crouch ? cfg.crouch : cfg.walk) * cfg.adsMul);
    if (cmd.reloading) speed *= cfg.reloadMul;
    if (wl < 0.01) {
      // no input: brake to a stop
      const d = cfg.groundDecel * dt;
      if (hs <= d) { s.vx = 0; s.vz = 0; } else { s.vx -= s.vx / hs * d; s.vz -= s.vz / hs * d; }
    } else {
      // move toward the wish velocity. If we are faster than allowed (after a sprint or slide)
      // the target keeps our current speed minus a gentle bleed, so momentum fades instead of snapping.
      const dx = wx / wl, dz = wz / wl, base = speed * Math.min(1, wl);
      const target = hs > base ? Math.max(base, hs - cfg.overspeedDecel * dt) : base;
      const tx = dx * target, tz = dz * target;
      const dvx = tx - s.vx, dvz = tz - s.vz, dl = Math.hypot(dvx, dvz), md = cfg.groundAccel * dt;
      if (dl <= md) { s.vx = tx; s.vz = tz; } else { s.vx += dvx / dl * md; s.vz += dvz / dl * md; }
    }
  } else {
    // air: steer toward the wish direction, but never faster than the take-off speed
    if (wl > 0.01) {
      const cap = Math.max(s.airCap, cfg.walk * 0.6), m = Math.min(1, wl);
      const tx = wx / wl * cap * m, tz = wz / wl * cap * m;
      const dvx = tx - s.vx, dvz = tz - s.vz, dl = Math.hypot(dvx, dvz), md = cfg.airAccel * dt;
      if (dl <= md) { s.vx = tx; s.vz = tz; } else { s.vx += dvx / dl * md; s.vz += dvz / dl * md; }
    }
    const k = Math.max(0, 1 - cfg.airDrag * dt); s.vx *= k; s.vz *= k;
  }

  // ---- jump (buffered, with coyote time; slide-jump keeps capped momentum)
  if (s.jumpBuf > 0 && (s.onGround || s.coyote > 0) && s.vy <= 0.01) {
    if (s.sliding) {
      const sp = Math.hypot(s.vx, s.vz), cap = Math.min(sp, cfg.slideJumpCap);
      if (sp > 0) { s.vx *= cap / sp; s.vz *= cap / sp; }
      endSlide(s, cfg, ev);
    }
    s.vy = cfg.jumpV; s.onGround = false; s.coyote = 0; s.jumpBuf = 0;
    s.airCap = Math.max(Math.hypot(s.vx, s.vz), cfg.walk);
    ev.push({ type: 'jump' });
  }

  // ---- integrate + collide
  const prevY = s.y, vyPrev = s.vy;
  s.x += s.vx * dt; s.z += s.vz * dt;
  const height = s.crouch ? cfg.heightCrouch : cfg.heightStand;
  if (collideXZ(s, world, cfg, height)) ev.push({ type: 'bump' });
  const g = cfg.gravity * (s.vy < 0 ? cfg.fallMul : 1);
  s.vy = Math.max(-cfg.maxFall, s.vy - g * dt);
  s.y += s.vy * dt;
  const ground = groundAt(s, world, cfg, Math.max(prevY, s.y));
  const wasGround = s.onGround;
  if (s.y <= ground) {
    s.y = ground;
    if (!wasGround) {
      const impact = -vyPrev;
      if (impact > cfg.landSlowFrom) { s.vx *= cfg.landSlowMul; s.vz *= cfg.landSlowMul; }
      ev.push({ type: 'land', impact });
    }
    s.vy = 0; s.onGround = true;
  } else if (wasGround && s.vy <= 0 && s.y - ground < cfg.step) {
    s.y = ground; s.vy = 0; s.onGround = true;        // walk down steps / ramps
  } else {
    if (wasGround) { s.airCap = Math.max(Math.hypot(s.vx, s.vz), cfg.walk); if (s.sliding) endSlide(s, cfg, ev); }
    s.onGround = false;
  }

  // ---- eye height (linear rate, the camera smooths it further)
  const eyeT = s.sliding ? cfg.eyeSlide : s.crouch ? cfg.eyeCrouch : cfg.eyeStand;
  const de = cfg.eyeSpeed * dt;
  s.eye = Math.abs(eyeT - s.eye) <= de ? eyeT : s.eye + Math.sign(eyeT - s.eye) * de;

  hs = Math.hypot(s.vx, s.vz);
  s.mode = !s.onGround ? 'aire' : s.sliding ? 'slide' : s.sprinting ? 'sprint' : s.crouch ? (hs > 0.2 ? 'agachado' : 'agachado quieto') : hs > 0.2 ? 'andando' : 'quieto';
  return ev;
}

const SDMovement = { createState, step, groundAt, collideXZ, rampH };
if (typeof module !== 'undefined' && module.exports) module.exports = SDMovement; else root.SDMovement = SDMovement;
})(typeof window !== 'undefined' ? window : globalThis);
