/* SNIPER DUEL — brain for the unarmed training bots.
   It does not move anything itself: it produces the same command a player would send,
   and the bot is moved by SDMovement.step, so it obeys exactly the same physics as you
   (acceleration, sprint, slide, jump, walls).

   think(brain, me, player, area, covers, diff, dt, rnd) → movement command
     me     = SDMovement state of the bot
     player = { x, z }
     area   = { minX, maxX, minZ, maxZ } where the bot may roam
     covers = [{ x, z }] centres of objects worth hiding behind
     diff   = SD_CONFIG.training.easy | normal | hard
     rnd    = function returning [0,1) (injected so tests are reproducible)            */
(function (root) {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function createBrain(rnd) {
  return { tx: 0, tz: 0, hasTarget: false, strafe: rnd() < 0.5 ? -1 : 1, strafeT: 0, mode: 'strafe', modeT: 0,
    stuckT: 0, hideT: 0, coverT: 0, slideCD: 0, jumpCD: 0, crouchT: 0, hurt: false };
}
function pickTarget(b, area, player, rnd) {
  // anywhere in the area, but not hugging the player
  for (let i = 0; i < 8; i++) {
    const x = area.minX + 1 + rnd() * (area.maxX - area.minX - 2), z = area.minZ + 1 + rnd() * (area.maxZ - area.minZ - 2);
    if (Math.hypot(x - player.x, z - player.z) > 6) { b.tx = x; b.tz = z; b.hasTarget = true; return; }
  }
  b.tx = (area.minX + area.maxX) / 2; b.tz = (area.minZ + area.maxZ) / 2; b.hasTarget = true;
}
function pickCover(b, covers, me, player) {
  let best = null, bd = 1e9;
  for (const c of covers) {
    const d = Math.hypot(c.x - me.x, c.z - me.z);
    if (d < bd && d < 28) { bd = d; best = c; }
  }
  if (!best) return false;
  // the spot on the far side of the cover, seen from the player
  const vx = best.x - player.x, vz = best.z - player.z, vl = Math.hypot(vx, vz) || 1;
  b.tx = best.x + vx / vl * 1.4; b.tz = best.z + vz / vl * 1.4; b.hasTarget = true;
  return true;
}
// convert a world direction into the local (mx, mz) input for a given yaw
function toLocal(wx, wz, yaw) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const rx = cy, rz = -sy, fx = -sy, fz = -cy;
  return { mx: wx * rx + wz * rz, mz: -(wx * fx + wz * fz) };
}

function think(b, me, player, area, covers, diff, dt, rnd) {
  const cmd = { mx: 0, mz: 0, yaw: 0, sprint: false, crouch: false, crouchPressed: false, jump: false, ads: 0, reloading: false, speedMul: diff.speedMul };
  b.slideCD -= dt; b.jumpCD -= dt; b.strafeT -= dt; b.modeT -= dt;
  if (!b.hasTarget) pickTarget(b, area, player, rnd);

  // stuck: wants to move but barely moves → new plan
  const hs = Math.hypot(me.vx, me.vz);
  if (hs < 0.6 && b.mode !== 'hide') b.stuckT += dt; else b.stuckT = 0;
  if (b.stuckT > 0.5) { pickTarget(b, area, player, rnd); b.strafe = -b.strafe; b.mode = 'strafe'; b.stuckT = 0; }

  // choose a behaviour now and then
  if (b.modeT <= 0 || (b.hurt && diff.cover > 0)) {
    const r = rnd();
    if ((b.hurt && rnd() < 0.7 && diff.cover > 0) || r < diff.cover * 0.5) { b.mode = pickCover(b, covers, me, player) ? 'cover' : 'strafe'; }
    else if (r < diff.cover * 0.5 + diff.run) { b.mode = 'run'; pickTarget(b, area, player, rnd); }
    else b.mode = 'strafe';
    b.modeT = 2 + rnd() * 3; b.hurt = false;
  }
  if (b.strafeT <= 0) { b.strafe = -b.strafe; b.strafeT = diff.changeMin + rnd() * (diff.changeMax - diff.changeMin); }

  const toTx = b.tx - me.x, toTz = b.tz - me.z, dT = Math.hypot(toTx, toTz);
  const px = player.x - me.x, pz = player.z - me.z, pl = Math.hypot(px, pz) || 1;
  let wx = 0, wz = 0;

  if (b.mode === 'run') {
    // face where it runs, sprint, maybe slide or hop
    if (dT < 1.2) { b.mode = 'strafe'; pickTarget(b, area, player, rnd); }
    wx = toTx / (dT || 1); wz = toTz / (dT || 1);
    cmd.yaw = Math.atan2(-wx, -wz); cmd.mz = -1; cmd.sprint = true;
    if (hs > 6.2 && b.slideCD <= 0 && rnd() < diff.slide * dt * 3) { cmd.crouch = true; cmd.crouchPressed = true; b.slideCD = 2.5; b.crouchT = 0.5; }
    if (b.crouchT > 0) { b.crouchT -= dt; cmd.crouch = true; }
    if (b.jumpCD <= 0 && rnd() < diff.jump * dt * 3) { cmd.jump = true; b.jumpCD = 1.5; }
    return cmd;
  }
  // strafe / cover: face the player and move sideways, drifting toward the target
  cmd.yaw = Math.atan2(-px / pl, -pz / pl);
  if (b.mode === 'cover') {
    if (dT < 0.8) { b.mode = 'hide'; b.hideT = 1.5 + rnd() * 1.5; }
    wx = toTx / (dT || 1); wz = toTz / (dT || 1);
  } else if (b.mode === 'hide') {
    b.hideT -= dt; cmd.crouch = true;
    if (b.hideT <= 0) { b.mode = 'strafe'; b.modeT = 0.5; pickTarget(b, area, player, rnd); }
    return cmd;
  } else {
    const sx = -pz / pl * b.strafe, sz = px / pl * b.strafe;          // perpendicular to the player
    const tw = dT > 2 ? 0.6 : 0;
    wx = sx + (toTx / (dT || 1)) * tw; wz = sz + (toTz / (dT || 1)) * tw;
    if (dT < 2) pickTarget(b, area, player, rnd);
    if (rnd() < diff.crouch * dt) b.crouchT = 0.6 + rnd() * 0.6;
    if (b.crouchT > 0) { b.crouchT -= dt; cmd.crouch = true; }
  }
  // keep inside the area: push back toward the middle near the edges
  const m = 2;
  if (me.x < area.minX + m) wx += 1.5; if (me.x > area.maxX - m) wx -= 1.5;
  if (me.z < area.minZ + m) wz += 1.5; if (me.z > area.maxZ - m) wz -= 1.5;
  const wl = Math.hypot(wx, wz) || 1;
  const loc = toLocal(wx / wl, wz / wl, cmd.yaw);
  cmd.mx = clamp(loc.mx, -1, 1); cmd.mz = clamp(loc.mz, -1, 1);
  return cmd;
}

const SDTrainer = { createBrain, think, toLocal };
if (typeof module !== 'undefined' && module.exports) module.exports = SDTrainer; else root.SDTrainer = SDTrainer;
})(typeof window !== 'undefined' ? window : globalThis);
