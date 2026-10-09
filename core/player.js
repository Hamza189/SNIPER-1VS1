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

function create(x, y, z, rifle, knife, pistol) {
  const rc = rifle || CFG.rifles.halcon, kc = knife || CFG.knives.tactica, pc = pistol || CFG.pistols.vibora;
  return { ms: M.createState(x, y, z), w: Wp.createState(rc), pw: Wp.createState(pc), load: Me.createLoadout(kc, CFG.loadout, pc) };
}
// the gun in hand (rifle or pistol); with the knife out, the rifle (for ADS/reload flags: never set)
function activeGun(p) { return p.load.active === 'pistol' ? p.pw : p.w; }
// put a player back at a spawn point with a fresh rifle (multiplayer respawn / rematch)
function respawn(p, x, y, z) {
  Object.assign(p.ms, M.createState(x, y, z));
  Wp.resetForSpawn(p.w); if (p.pw) Wp.resetForSpawn(p.pw); Me.resetLoadout(p.load);
}
function step(p, cmd, dt, world, moveCfg) {
  const L = p.load, w = p.w, pw = p.pw;
  const lev = Me.tickLoadout(L, { select: cmd.select || null, attack: !!cmd.fire && L.active === 'knife', inspect: !!cmd.inspect }, dt);
  const hol = Me.rifleHolstered(L), holP = Me.holstered(L, 'pistol');
  const g = L.active === 'pistol' ? pw : w;
  const mc = { mx: cmd.mx, mz: cmd.mz, yaw: cmd.yaw, sprint: !!cmd.sprint, crouch: !!cmd.crouch, crouchPressed: !!cmd.crouchPressed,
    jump: !!cmd.jump, ads: g.ads, reloading: g.state === 'reload', speedMul: Me.speedMul(L) };
  const mev = M.step(p.ms, mc, dt, world, moveCfg || CFG.move);
  const wev = Wp.tick(w, { fire: !!cmd.fire && L.active === 'rifle', ads: !!cmd.adsHeld, reload: !!cmd.reload }, dt,
    { sprinting: p.ms.sprinting, alive: true, holstered: hol });
  // the sidearm: same rules, its own magazine and slide; it only acts while it is the one drawn
  const pev = pw ? Wp.tick(pw, { fire: !!cmd.fire && L.active === 'pistol', ads: !!cmd.adsHeld, reload: !!cmd.reload }, dt,
    { sprinting: p.ms.sprinting, alive: true, holstered: holP }) : [];
  return { mev, lev, wev, pev, hol, holP };
}
// full state as plain data (for the server snapshot) and back (client reconciliation)
function saveGun(g) { const w = Object.assign({}, g); delete w.cfg; w.fired = Object.assign({}, g.fired); return w; }
function restoreGun(g, s) { const cfg = g.cfg; Object.assign(g, s); g.cfg = cfg; g.fired = Object.assign({}, s.fired); }
function save(p) {
  const w = saveGun(p.w);
  const L = Object.assign({}, p.load); delete L.kc; delete L.lc; delete L.pc; L.knife = Object.assign({}, p.load.knife);
  return { ms: Object.assign({}, p.ms), w, pw: p.pw ? saveGun(p.pw) : undefined, load: L };
}
function restore(p, s) {
  Object.assign(p.ms, s.ms);
  restoreGun(p.w, s.w); if (p.pw && s.pw) restoreGun(p.pw, s.pw);
  const kc = p.load.kc, lc = p.load.lc, pc = p.load.pc, knife = p.load.knife;
  Object.assign(p.load, s.load); p.load.kc = kc; p.load.lc = lc; p.load.pc = pc; p.load.knife = Object.assign(knife, s.load.knife);
}
const SDPlayer = { create, respawn, step, save, restore, activeGun };
if (isNode) module.exports = SDPlayer; else root.SDPlayer = SDPlayer;
})(typeof window !== 'undefined' ? window : globalThis);
