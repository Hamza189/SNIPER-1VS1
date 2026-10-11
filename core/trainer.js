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
function pickTarget(b, area, player, rnd, me, side) {
  // anywhere in the area, but not hugging the player; with side (±1, and me) on the side the bot is
  // already moving towards, so a new plan does not snap it the other way
  for (let i = 0; i < 12; i++) {
    const x = area.minX + 1 + rnd() * (area.maxX - area.minX - 2), z = area.minZ + 1 + rnd() * (area.maxZ - area.minZ - 2);
    if (Math.hypot(x - player.x, z - player.z) <= 6) continue;
    if (side && me && i < 10) { const px = player.x - me.x, pz = player.z - me.z, pl = Math.hypot(px, pz) || 1;
      if (Math.sign(((x - me.x) * -pz + (z - me.z) * px) / pl) !== side) continue; }
    b.tx = x; b.tz = z; b.hasTarget = true; return;
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

  // which way it is moving across the player's view right now (+1 / -1, 0 when barely moving)
  const lpx = player.x - me.x, lpz = player.z - me.z, lpl = Math.hypot(lpx, lpz) || 1;
  const latV = (me.vx * -lpz + me.vz * lpx) / lpl, latSide = Math.abs(latV) > 0.3 ? Math.sign(latV) : 0;
  // choose a behaviour now and then; a new behaviour keeps the current sideways direction
  if (b.modeT <= 0 || (b.hurt && diff.cover > 0)) {
    const r = rnd();
    if ((b.hurt && rnd() < 0.7 && diff.cover > 0) || r < diff.cover * 0.5) { b.mode = pickCover(b, covers, me, player) ? 'cover' : 'strafe'; }
    else if (r < diff.cover * 0.5 + diff.run && (b.sinceFlip || 0) >= diff.changeMin) { b.mode = 'run'; pickTarget(b, area, player, rnd, me, latSide); }
    else b.mode = 'strafe';
    if (b.mode === 'strafe' && latSide && latSide !== b.strafe) { b.strafe = latSide; b.strafeT = Math.max(b.strafeT, diff.changeMin); }
    if (b.mode === 'run') b.sinceFlip = 0;
    b.modeT = 2 + rnd() * 3; b.hurt = false;
  }
  // sideways direction: changes on its timer, never sooner than changeMin after the last change (readable)
  b.sinceFlip = (b.sinceFlip || 0) + dt;
  const flip = () => { b.strafe = -b.strafe; b.strafeT = diff.changeMin + rnd() * (diff.changeMax - diff.changeMin); b.sinceFlip = 0; };
  if (b.strafeT <= 0) flip();

  const toTx = b.tx - me.x, toTz = b.tz - me.z, dT = Math.hypot(toTx, toTz);
  const px = player.x - me.x, pz = player.z - me.z, pl = Math.hypot(px, pz) || 1;
  let wx = 0, wz = 0;

  if (b.mode === 'run') {
    // face where it runs, sprint, maybe slide or hop
    if (dT < 1.2) { b.mode = 'strafe'; if (latSide) b.strafe = latSide; pickTarget(b, area, player, rnd, me, latSide); }
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
    // near the edge of the area and still heading out: turn back now (the only early change allowed)
    const ex = -pz / pl * b.strafe, ez = px / pl * b.strafe, m0 = 2.5;
    if ((me.x < area.minX + m0 && ex < 0) || (me.x > area.maxX - m0 && ex > 0) || (me.z < area.minZ + m0 && ez < 0) || (me.z > area.maxZ - m0 && ez > 0)) flip();
    const sx = -pz / pl * b.strafe, sz = px / pl * b.strafe;          // perpendicular to the player
    // drift toward the target only closer / further (along the line to the player): the sideways motion
    // stays the strafe's alone, so it never reverses because a new target was picked
    const tw = dT > 2 ? 0.6 : 0, rx = px / pl, rz = pz / pl, along = ((toTx * rx + toTz * rz) / (dT || 1)) * tw;
    wx = sx + rx * along; wz = sz + rz * along;
    if (dT < 2) pickTarget(b, area, player, rnd);
    if (rnd() < diff.crouch * dt) b.crouchT = 0.6 + rnd() * 0.6;
    if (b.crouchT > 0) { b.crouchT -= dt; cmd.crouch = true; }
  }
  // keep inside the area: push back toward the middle near the edges (rarely needed now: the strafe turns back first)
  const m = 1.2;
  if (me.x < area.minX + m) wx += 1.5; if (me.x > area.maxX - m) wx -= 1.5;
  if (me.z < area.minZ + m) wz += 1.5; if (me.z > area.maxZ - m) wz -= 1.5;
  const wl = Math.hypot(wx, wz) || 1;
  const loc = toLocal(wx / wl, wz / wl, cmd.yaw);
  cmd.mx = clamp(loc.mx, -1, 1); cmd.mz = clamp(loc.mz, -1, 1);
  return cmd;
}

/* Fixed movement patterns for practice (CAMPO DE TIRO → movimiento de los bots), readable on purpose:
   always across your line of sight, with a short stop before turning back (no instant reversals).
     still  : stands and faces you
     walk   : walks (2.3 m/s) 3–4.5 s one way, stops ~0.6 s, walks back
     run    : sprints (7 m/s) 2–3 s one way, stops ~0.8 s, runs back
     strafe : side steps at full walking speed (4.6 m/s), 0.9–1.6 s each way, no stop (the hardest)
   Same physics as the player (SDMovement.step does the moving).                                    */
const PATTERNS = {
  still:  null,
  walk:   { speedMul: 0.5, legMin: 3, legMax: 4.5, pause: 0.6, sprint: false },
  run:    { speedMul: 1, legMin: 2, legMax: 3, pause: 0.8, sprint: true },
  strafe: { speedMul: 1, legMin: 0.9, legMax: 1.6, pause: 0, sprint: false }
};
function pattern(b, me, player, area, kind, dt, rnd) {
  const cmd = { mx: 0, mz: 0, yaw: 0, sprint: false, crouch: false, crouchPressed: false, jump: false, ads: 0, reloading: false, speedMul: 1 };
  const px = player.x - me.x, pz = player.z - me.z, pl = Math.hypot(px, pz) || 1;
  cmd.yaw = Math.atan2(-px / pl, -pz / pl);                       // facing the player
  const P = PATTERNS[kind];
  if (!P) return cmd;
  if (b.patKind !== kind) { b.patKind = kind; b.patDir = rnd() < 0.5 ? -1 : 1; b.patT = P.legMin + rnd() * (P.legMax - P.legMin); b.patPause = 0; }
  if (b.patPause > 0) { b.patPause -= dt; return cmd; }
  b.patT -= dt;
  // across the line of sight; turn back early near the edge of the area
  let sx = -pz / pl * b.patDir, sz = px / pl * b.patDir;
  const m = 3, nearEdge = (me.x < area.minX + m && sx < 0) || (me.x > area.maxX - m && sx > 0) || (me.z < area.minZ + m && sz < 0) || (me.z > area.maxZ - m && sz > 0);
  if (b.patT <= 0 || nearEdge) {
    b.patDir = -b.patDir; b.patT = P.legMin + rnd() * (P.legMax - P.legMin); b.patPause = P.pause;
    return cmd;
  }
  cmd.speedMul = P.speedMul;
  if (P.sprint) {   // sprinting only works forward: face the way it runs
    cmd.yaw = Math.atan2(-sx, -sz); cmd.mz = -1; cmd.sprint = true;
  } else {
    const loc = toLocal(sx, sz, cmd.yaw);
    cmd.mx = clamp(loc.mx, -1, 1); cmd.mz = clamp(loc.mz, -1, 1);
  }
  return cmd;
}

const SDTrainer = { createBrain, think, toLocal, pattern, PATTERNS };
if (typeof module !== 'undefined' && module.exports) module.exports = SDTrainer; else root.SDTrainer = SDTrainer;
})(typeof window !== 'undefined' ? window : globalThis);
