/* SNIPER DUEL — server bots for custom rooms (docs/SALAS-PERSONALIZADAS.md). They play by the same rules as people:
   the room runs their commands through the same player tick (movement, rifle, scope, bolt, reload, quickscope rule)
   and their bullets through the same ballistics and hit zones. Only the decisions are theirs:
   - where to walk: paths over the map's nav points (A* on a graph built once per map; an edge needs a clear line at
     knee and chest height);
   - whom to look at: the nearest enemy in line of sight (checked ~8 times a second, like a person scanning);
   - when to shoot: after a reaction time, with an aim error that settles while they hold the aim (by difficulty).
   Bots aim where the enemy IS (no lead), so moving makes them miss more, like it should. Pure: no sockets, no clocks. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const G = isNode ? require('./geom.js') : root.SDGeom;
const HB = isNode ? require('./hitbox.js') : root.SDHitbox;
const SDP = isNode ? require('./player.js') : root.SDPlayer;

// RECLUTA, VETERANO, ÉLITE: reaction (s), aim error at the start and once settled (mrad), settle time (s), turn speed
// (rad/s), seconds between shots on top of the bolt, chance to aim at the head, chance of a side step while aiming and
// chance to change position after a shot (a sniper that never moves is an easy target)
const DIFF = [
  { name: 'RECLUTA', react: [0.9, 1.4], err0: 60, err: 14, settle: 1.3, turn: 2.6, gap: 1.0, head: 0.05, step: 0.35, reloc: 0.3 },
  { name: 'VETERANO', react: [0.6, 1.0], err0: 45, err: 8, settle: 1.0, turn: 3.6, gap: 0.6, head: 0.15, step: 0.5, reloc: 0.4 },
  { name: 'ÉLITE', react: [0.35, 0.7], err0: 30, err: 4.5, settle: 0.7, turn: 5.0, gap: 0.3, head: 0.3, step: 0.6, reloc: 0.5 }
];
const SIGHT = 170;   // metres: further than this they do not engage

// ---- the nav graph of a map (cached on its index): neighbours that can walk to each other in a straight line
function navGraph(map, ix) {
  if (ix.__botNav) return ix.__botNav;
  const pts = map.nav, n = pts.length;
  let sp = 1e9; for (let i = 0; i < Math.min(n, 60); i++) for (let j = 0; j < n; j++) { if (i === j) continue; const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d > 1e-3 && d < sp) sp = d; }
  const reach = sp * 1.5, cell = reach, grid = new Map(), key = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
  pts.forEach((p, i) => { const k = key(p[0], p[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  const nbr = pts.map(() => []);
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[i], cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of grid.get((cx + a) + ',' + (cz + b)) || []) {
      if (j <= i) continue; const d = Math.hypot(pts[j][0] - x, pts[j][1] - z); if (d > reach) continue;
      if (G.losClear(ix, x, 0.5, z, pts[j][0], 0.5, pts[j][1]) && G.losClear(ix, x, 1.2, z, pts[j][0], 1.2, pts[j][1])) { nbr[i].push(j); nbr[j].push(i); }
    }
  }
  return (ix.__botNav = { pts, nbr, sp, grid, cell, key });
}
function nearest(g, x, z) {
  const cx = Math.floor(x / g.cell), cz = Math.floor(z / g.cell); let best = -1, bd = 1e9;
  for (let r = 0; r < 6 && best < 0; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (const i of g.grid.get((cx + a) + ',' + (cz + b)) || []) {
    const d = Math.hypot(g.pts[i][0] - x, g.pts[i][1] - z); if (d < bd) { bd = d; best = i; } }
  if (best < 0) for (let i = 0; i < g.pts.length; i++) { const d = Math.hypot(g.pts[i][0] - x, g.pts[i][1] - z); if (d < bd) { bd = d; best = i; } }
  return best;
}
function astar(g, s, t) {
  if (s < 0 || t < 0) return [];
  const P = g.pts, h = i => Math.hypot(P[i][0] - P[t][0], P[i][1] - P[t][1]), gs = new Map([[s, 0]]), from = new Map(), open = [[h(s), s]], done = new Set();
  let it = 0;
  while (open.length && it++ < 6000) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const cur = open.splice(bi, 1)[0][1]; if (cur === t) break; if (done.has(cur)) continue; done.add(cur);
    for (const nb of g.nbr[cur]) {
      const c = gs.get(cur) + Math.hypot(P[nb][0] - P[cur][0], P[nb][1] - P[cur][1]);
      if (c < (gs.has(nb) ? gs.get(nb) : 1e18)) { gs.set(nb, c); from.set(nb, cur); open.push([c + h(nb), nb]); }
    }
  }
  if (!from.has(t) && s !== t) return [];
  const path = [t]; let c = t; while (c !== s) { c = from.get(c); path.push(c); } return path.reverse();
}

// ---- one bot's mind
function createBrain(diff, rand) {
  return { D: DIFF[Math.max(0, Math.min(2, diff | 0))], rand: rand || Math.random, path: [], pathAt: -1e9, decideAt: 0, target: null,
    seenAt: 0, lastSeen: -1e9, lastPos: null, aimAt: 0, err: [0, 0], err0: [0, 0], errAt: 0, head: false, nextShot: 0,
    moveRef: null, moveRefAt: 0, strafe: 0, strafeAt: 0, heard: null, relocUntil: 0 };
}
const gauss = r => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const angd = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function newAim(B, t) {
  const r = B.rand, D = B.D;
  B.err0 = [gauss(r) * D.err0 / 1000, gauss(r) * D.err0 / 1000]; B.err = [gauss(r) * D.err / 1000, gauss(r) * D.err / 1000];
  B.errAt = t; B.head = r() < D.head;
}
// a shot was heard / a hit was taken: go and look there (the room calls it)
function alert(B, x, z, t) { B.heard = { x, z, t }; if (!B.target) B.path = []; }

// me: the bot's seat ({ p, yaw, pitch }); foes: [{ id, x, y, z, eye, alive }]; X: { ix, map, now (ms) }
// → the command for this 1/120 s step (same shape as a player's)
function think(B, me, foes, X) {
  const ms = me.p.ms, t = X.now / 1000, D = B.D, r = B.rand, g = navGraph(X.map, X.ix);
  const eye = [ms.x, ms.y + ms.eye, ms.z];
  if (t >= B.decideAt) {   // look around (~8 Hz)
    B.decideAt = t + 0.12 + r() * 0.04;
    let best = null, bd = 1e9;
    for (const f of foes) {
      if (!f.alive) continue; const d = Math.hypot(f.x - ms.x, f.z - ms.z); if (d > SIGHT || d >= bd) continue;
      const k = HB.scaleOf(f.eye);
      if (G.losClear(X.ix, eye[0], eye[1], eye[2], f.x, f.y + 1.25 * k, f.z) || G.losClear(X.ix, eye[0], eye[1], eye[2], f.x, f.y + 1.6 * k, f.z)) { best = f; bd = d; }
    }
    if (best && t < B.relocUntil && B.path.length) best = null;   // changing position: keep walking for a moment
    if (best) {
      if (B.target !== best.id) { B.target = best.id; B.seenAt = t; B.aimAt = t + D.react[0] + r() * (D.react[1] - D.react[0]); newAim(B, t); }
      B.lastSeen = t; B.lastPos = { x: best.x, z: best.z }; B.path = []; B.relocUntil = 0;
    } else if (B.target && t - B.lastSeen > 1.5) {   // lost them: go to where they were last seen
      B.target = null; const lp = B.lastPos; B.lastPos = null;
      if (lp) { B.path = astar(g, nearest(g, ms.x, ms.z), nearest(g, lp.x, lp.z)); B.pathAt = t; }
    }
    if (!B.target && (!B.path.length || t - B.pathAt > 14)) {
      let goal;
      if (B.heard && t - B.heard.t < 8) { goal = nearest(g, B.heard.x, B.heard.z); B.heard = null; }
      else goal = (r() * g.pts.length) | 0;
      B.path = astar(g, nearest(g, ms.x, ms.z), goal); B.pathAt = t;
    }
  }
  const cmd = { mx: 0, mz: 0, yaw: me.yaw, pitch: me.pitch, sprint: false, crouch: false, fire: false, adsHeld: false, ft: X.now };
  const turnTo = (yaw, pitch, dt) => {
    const mx = D.turn * dt, dy = angd(yaw, me.yaw), dp = pitch - me.pitch;
    cmd.yaw = me.yaw + Math.max(-mx, Math.min(mx, dy)); cmd.pitch = me.pitch + Math.max(-mx, Math.min(mx, dp));
    return Math.abs(dy) + Math.abs(dp);
  };
  const tgt = B.target && foes.find(f => f.id === B.target && f.alive);
  if (tgt) {
    const k = HB.scaleOf(tgt.eye), ty = tgt.y + (B.head ? 1.62 : 1.2) * k;
    const dx = tgt.x - eye[0], dy = ty - eye[1], dz = tgt.z - eye[2], d = Math.hypot(dx, dy, dz);
    const s = Math.max(0, 1 - (t - B.errAt) / D.settle), ey = B.err[0] + B.err0[0] * s, ep = B.err[1] + B.err0[1] * s;
    const left = turnTo(Math.atan2(-dx, -dz) + ey, Math.asin(Math.max(-1, Math.min(1, dy / d))) + ep, 1 / 120);
    cmd.adsHeld = t - B.seenAt > 0.15;
    // a little side step while aiming (veterans and elites), never while the shot is going off
    if (t >= B.strafeAt) { B.strafe = r() < D.step ? (r() < 0.5 ? -1 : 1) : 0; B.strafeAt = t + 0.6 + r() * 1.2; }
    cmd.mx = t < B.aimAt - 0.2 ? B.strafe * 0.6 : 0;
    const gun = SDP.activeGun(me.p);
    if (t >= B.aimAt && t >= B.nextShot && left < 0.004 && gun.state === 'ready' && gun.ads >= (gun.cfg.scopeAt || 0.8)) {
      cmd.fire = true; B.nextShot = t + D.gap + r() * 0.4; B.aimAt = t + 0.2; newAim(B, t);   // the next shot settles again
      if (r() < D.reloc) {   // change position: a nav point 6–14 m away, then look again
        const here = nearest(g, ms.x, ms.z); let goal = -1;
        for (let k = 0; k < 20 && goal < 0; k++) { const j = (r() * g.pts.length) | 0, d = Math.hypot(g.pts[j][0] - ms.x, g.pts[j][1] - ms.z); if (d > 6 && d < 14) goal = j; }
        if (goal >= 0) { B.path = astar(g, here, goal); B.pathAt = t; B.relocUntil = t + 2.5; B.target = null; }
      }
    }
  } else if (B.path.length) {
    let wp = g.pts[B.path[0]];
    while (B.path.length && Math.hypot(wp[0] - ms.x, wp[1] - ms.z) < Math.max(0.35, g.sp * 0.45)) { B.path.shift(); if (B.path.length) wp = g.pts[B.path[0]]; }
    if (B.path.length) {
      const dx = wp[0] - ms.x, dz = wp[1] - ms.z, look = Math.atan2(-dx, -dz);
      turnTo(look, 0, 1 / 120);
      const off = Math.abs(angd(look, me.yaw));
      cmd.mz = off < 0.7 ? -1 : off < 1.4 ? -0.4 : 0;
      cmd.sprint = B.path.length > 6 && off < 0.3 && !(B.heard);
    }
    // stuck (a door frame, another player): try another way
    if (!B.moveRef || t - B.moveRefAt > 1.6) {
      if (B.moveRef && Math.hypot(ms.x - B.moveRef.x, ms.z - B.moveRef.z) < 0.4) { B.path = []; B.pathAt = -1e9; }
      B.moveRef = { x: ms.x, z: ms.z }; B.moveRefAt = t;
    }
  } else turnTo(me.yaw + 0.6, 0, 1 / 120);   // nothing to do: look around
  return cmd;
}
const SDBots = { DIFF, navGraph, nearest, astar, createBrain, think, alert };
if (isNode) module.exports = SDBots; else root.SDBots = SDBots;
})(typeof window !== 'undefined' ? window : globalThis);
