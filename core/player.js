/* SNIPER DUEL — one player's gameplay tick: loadout → movement → rifle → pistol → shotgun.
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

function create(x, y, z, rifle, knife, pistol, shotgun) {
  const rc = rifle || CFG.rifles.halcon, kc = knife || CFG.knives.tactica, pc = pistol || CFG.pistols.vibora, sc = shotgun || CFG.shotguns.furia;
  return { ms: M.createState(x, y, z), w: Wp.createState(rc), pw: Wp.createState(pc), sw: Wp.createState(sc), load: Me.createLoadout(kc, CFG.loadout, pc, sc) };
}
// the gun in hand (rifle, shotgun or pistol); with the knife out, the rifle (for ADS/reload flags: never set)
function activeGun(p) { const a = p.load.active; return a === 'pistol' ? p.pw : a === 'shotgun' && p.sw ? p.sw : p.w; }
// put a player back at a spawn point with fresh guns (multiplayer respawn / rematch);
// primary: 'rifle' | 'shotgun' for this life (omitted: keep the current one)
function respawn(p, x, y, z, primary) {
  Object.assign(p.ms, M.createState(x, y, z));
  if (primary) Me.setPrimary(p.load, primary);
  Wp.resetForSpawn(p.w); if (p.pw) Wp.resetForSpawn(p.pw); if (p.sw) Wp.resetForSpawn(p.sw); Me.resetLoadout(p.load);
}
function step(p, cmd, dt, world, moveCfg) {
  const L = p.load, w = p.w, pw = p.pw, sw = p.sw;
  const lev = Me.tickLoadout(L, { select: cmd.select || null, attack: !!cmd.fire && L.active === 'knife', inspect: !!cmd.inspect }, dt);
  const hol = Me.rifleHolstered(L), holP = Me.holstered(L, 'pistol'), holS = Me.holstered(L, 'shotgun');
  const g = activeGun(p);
  const mc = { mx: cmd.mx, mz: cmd.mz, yaw: cmd.yaw, sprint: !!cmd.sprint, crouch: !!cmd.crouch, crouchPressed: !!cmd.crouchPressed,
    jump: !!cmd.jump, ads: g.ads, reloading: g.state === 'reload', speedMul: Me.speedMul(L) };
  const mev = M.step(p.ms, mc, dt, world, moveCfg || CFG.move);
  const wev = Wp.tick(w, { fire: !!cmd.fire && L.active === 'rifle', ads: !!cmd.adsHeld, reload: !!cmd.reload }, dt,
    { sprinting: p.ms.sprinting, alive: true, holstered: hol });
  // the sidearm: same rules, its own magazine and slide; it only acts while it is the one drawn
  const pev = pw ? Wp.tick(pw, { fire: !!cmd.fire && L.active === 'pistol', ads: !!cmd.adsHeld, reload: !!cmd.reload }, dt,
    { sprinting: p.ms.sprinting, alive: true, holstered: holP }) : [];
  const sev = sw ? Wp.tick(sw, { fire: !!cmd.fire && L.active === 'shotgun', ads: !!cmd.adsHeld, reload: !!cmd.reload }, dt,
    { sprinting: p.ms.sprinting, alive: true, holstered: holS }) : [];
  return { mev, lev, wev, pev, sev, hol, holP, holS };
}
// full state as plain data (for the server snapshot) and back (client reconciliation)
function saveGun(g) { const w = Object.assign({}, g); delete w.cfg; w.fired = Object.assign({}, g.fired); return w; }
function restoreGun(g, s) { const cfg = g.cfg; Object.assign(g, s); g.cfg = cfg; g.fired = Object.assign({}, s.fired); }
function save(p) {
  const w = saveGun(p.w);
  const L = Object.assign({}, p.load); delete L.kc; delete L.lc; delete L.pc; delete L.sc; L.knife = Object.assign({}, p.load.knife);
  return { ms: Object.assign({}, p.ms), w, pw: p.pw ? saveGun(p.pw) : undefined, sw: p.sw ? saveGun(p.sw) : undefined, load: L };
}
function restore(p, s) {
  Object.assign(p.ms, s.ms);
  restoreGun(p.w, s.w); if (p.pw && s.pw) restoreGun(p.pw, s.pw); if (p.sw && s.sw) restoreGun(p.sw, s.sw);
  const kc = p.load.kc, lc = p.load.lc, pc = p.load.pc, sc = p.load.sc, knife = p.load.knife;
  Object.assign(p.load, s.load); p.load.kc = kc; p.load.lc = lc; p.load.pc = pc; p.load.sc = sc; p.load.knife = Object.assign(knife, s.load.knife);
}
const SDPlayer = { create, respawn, step, save, restore, activeGun };
if (isNode) module.exports = SDPlayer; else root.SDPlayer = SDPlayer;
})(typeof window !== 'undefined' ? window : globalThis);
