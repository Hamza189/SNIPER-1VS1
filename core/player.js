/* SNIPER DUEL — one player's gameplay tick: loadout → movement → rifle, in that order.
   Pure (no Three.js). The browser runs it for the local player every 1/120 s, and the
   multiplayer server runs the very same function with the same commands, so the player's
   predicted position, ammo and bolt match the server's.

   cmd = { mx, mz, yaw, sprint, crouch, crouchPressed, jump, fire, adsHeld, reload,
           select ('rifle'|'knife'|null), inspect } */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const CFG = isNode ? require('./config.js') : root.SD_CONFIG;
const M = isNode ? require('./movement.js') : root.SDMovement;
const Wp = isNode ? require('./weapon.js') : root.SDWeapon;
const Me = isNode ? require('./melee.js') : root.SDMelee;

function create(x, y, z, rifle, knife) {
  const rc = rifle || CFG.rifles.halcon, kc = knife || CFG.knives.tactica;
  return { ms: M.createState(x, y, z), w: Wp.createState(rc), load: Me.createLoadout(kc, CFG.loadout) };
}
// put a player back at a spawn point with a fresh rifle (multiplayer respawn / rematch)
function respawn(p, x, y, z) {
  Object.assign(p.ms, M.createState(x, y, z));
  Wp.resetForSpawn(p.w); Me.resetLoadout(p.load);
}
function step(p, cmd, dt, world, moveCfg) {
  const L = p.load, w = p.w;
  const lev = Me.tickLoadout(L, { select: cmd.select || null, attack: !!cmd.fire && L.active === 'knife', inspect: !!cmd.inspect }, dt);
  const hol = Me.rifleHolstered(L);
  const mc = { mx: cmd.mx, mz: cmd.mz, yaw: cmd.yaw, sprint: !!cmd.sprint, crouch: !!cmd.crouch, crouchPressed: !!cmd.crouchPressed,
    jump: !!cmd.jump, ads: w.ads, reloading: w.state === 'reload', speedMul: Me.speedMul(L) };
  const mev = M.step(p.ms, mc, dt, world, moveCfg || CFG.move);
  const wev = Wp.tick(w, { fire: !!cmd.fire && L.active === 'rifle', ads: !!cmd.adsHeld, reload: !!cmd.reload }, dt,
    { sprinting: p.ms.sprinting, alive: true, holstered: hol });
  return { mev, lev, wev, hol };
}
// full state as plain data (for the server snapshot) and back (client reconciliation)
function save(p) {
  const w = Object.assign({}, p.w); delete w.cfg; w.fired = Object.assign({}, p.w.fired);
  const L = Object.assign({}, p.load); delete L.kc; delete L.lc; L.knife = Object.assign({}, p.load.knife);
  return { ms: Object.assign({}, p.ms), w, load: L };
}
function restore(p, s) {
  Object.assign(p.ms, s.ms);
  const cfg = p.w.cfg; Object.assign(p.w, s.w); p.w.cfg = cfg; p.w.fired = Object.assign({}, s.w.fired);
  const kc = p.load.kc, lc = p.load.lc, knife = p.load.knife;
  Object.assign(p.load, s.load); p.load.kc = kc; p.load.lc = lc; p.load.knife = Object.assign(knife, s.load.knife);
}
const SDPlayer = { create, respawn, step, save, restore };
if (isNode) module.exports = SDPlayer; else root.SDPlayer = SDPlayer;
})(typeof window !== 'undefined' ? window : globalThis);
