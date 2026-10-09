/* SNIPER DUEL — one private 1v1 room. The authority for everything that decides the match:
   seats, lobby, start, movement (it runs each player's own commands with the shared player
   tick), ammo/bolt/reload, bullets (exact parabola against the real map triangles and the
   body hit zones), damage, deaths, respawns, score, winner, rematch and reconnection.

   It does not know about sockets or clocks: an adapter (Node server, Cloudflare Durable
   Object, or a test) calls connect / message / disconnect / tick with the time in ms and
   gives it a send(connId, text) and close(connId) function.

   Rules of the first version
   - 2 players, no bots, first to 10 kills. 100 HP, regeneration like offline
     (after 5 s without damage, +22 HP/s). Respawn 3 s after dying, full HP, full magazine.
   - Bullets already flying when their shooter dies keep flying and can still hit.
   - Two kills in the same server tick: both count. If both reach 10 in the same tick, the
     match is a draw (winner null).
   - A player that drops out during the match pauses it for both (RECONECTANDO) up to 60 s;
     after that the one still connected wins.                                             */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const CFG = isNode ? require('./config.js') : root.SD_CONFIG;
const SDP = isNode ? require('./player.js') : root.SDPlayer;
const Wp = isNode ? require('./weapon.js') : root.SDWeapon;
const Me = isNode ? require('./melee.js') : root.SDMelee;
const G = isNode ? require('./geom.js') : root.SDGeom;
const HB = isNode ? require('./hitbox.js') : root.SDHitbox;
const PR = isNode ? require('./protocol.js') : root.SDProto;

const RULES = { killsToWin: 10, hp: 100, respawnMs: 3000, countdownMs: 3000, regenDelayMs: 5000, regenPerSec: 22,
  reconnectMs: 60000, lobbySeatMs: 60000, silentMs: 6000, idleRoomMs: 15 * 60000, snapHz: 20, maxShotDev: 0.3, maxOriginDist: 0.9,
  // lag compensation: a bullet is tested against the rival where the shooter SAW them
  // (half the round trip + the client's interpolation delay), never more than maxRewindMs back
  maxRewindMs: 250 };
const DT = 1 / PR.LIMITS.tickHz;
const GUN = CFG.rifles.halcon, KNIFE = CFG.knives.tactica;

function create(opts) {
  const ix = opts.index || G.createMapIndex(opts.map);
  const rand = opts.rand || Math.random;
  const R = {
    code: opts.code, phase: 'lobby', match: 0, startAt: 0, tickN: 0, now: opts.now || 0,
    seats: { A: null, B: null }, conns: new Map(), evSeq: 0, bullets: [], bulletId: 0, winner: undefined,
    pausedAt: 0, lastSnap: 0, lastActive: opts.now || 0, lastPlay: opts.now || 0, closed: false, rematch: { A: false, B: false }, log: [],
    send: opts.send || (() => {}), close: opts.close || (() => {}), randBytes: opts.randBytes, persist: opts.persist || null
  };

  /* ---------- helpers ---------- */
  const other = id => (id === 'A' ? 'B' : 'A');
  const sendTo = (seat, obj) => { if (obj.t === 'ev') obj.q = ++R.evSeq; if (seat && seat.conn != null) R.send(seat.conn, JSON.stringify(obj)); };
  const evq = obj => { if (obj.t === 'ev') obj.q = ++R.evSeq; return obj; };
  const sendAll = obj => { evq(obj); const s = JSON.stringify(obj); for (const id of ['A', 'B']) { const st = R.seats[id]; if (st && st.conn != null) R.send(st.conn, s); } };
  const log = (msg) => { R.log.push(Math.round(R.now) + ' ' + msg); if (R.log.length > 200) R.log.shift(); };
  const pubPlayers = () => ['A', 'B'].map(id => { const s = R.seats[id]; return s ? { id, name: s.name, connected: s.conn != null, ready: s.ready, kills: s.kills } : null; });
  const lobbyMsg = () => ({ t: 'lobby', phase: R.phase, players: pubPlayers(), match: R.match, winner: R.winner === undefined ? undefined : R.winner, rematch: R.rematch });
  function save() {
    if (!R.persist) return;
    R.persist({ code: R.code, phase: R.phase === 'playing' || R.phase === 'countdown' || R.phase === 'paused' ? 'interrupted' : R.phase, match: R.match,
      seats: ['A', 'B'].map(id => { const s = R.seats[id]; return s ? { id, name: s.name, token: s.token, kills: s.kills, deaths: s.deaths } : null; }) });
  }
  function newSeat(id, name, token) {
    return { id, name: name || (id === 'A' ? 'JUGADOR 1' : 'JUGADOR 2'), token, conn: null, ready: false, leftAt: 0,
      p: SDP.create(0, 0, 0), hp: RULES.hp, alive: false, diedAt: 0, lastHit: -1e9, kills: 0, deaths: 0,
      lastSeq: -1, budget: PR.LIMITS.cmdBurst, budgetAt: R.now, yaw: 0, pitch: 0, shots: 0, hits: 0, hs: 0 };
  }
  function token() {
    const b = R.randBytes ? R.randBytes(24) : Array.from({ length: 24 }, () => (rand() * 256) | 0);
    return PR.tokenFrom(b);
  }

  /* ---------- spawns ---------- */
  function spawnPoint(id, avoid) {
    // far from the rival, out of their sight when possible; first spawns on opposite sides
    let best = null, bs = -1e9;
    const nav = opts.map.nav;
    for (let k = 0; k < 60; k++) {
      const n = nav[(rand() * nav.length) | 0], x = n[0], z = n[1];
      let s = rand() * 4;
      if (avoid) {
        const d = Math.hypot(x - avoid.x, z - avoid.z);
        s += Math.min(d, 55);
        if (d < 18) s -= 200;
        if (G.losClear(ix, avoid.x, avoid.y + 1.5, avoid.z, x, 1.5, z)) s -= 40;
      } else s += (id === 'A' ? -x : x) * 1.5; // first spawns: A west, B east
      if (s > bs) { bs = s; best = { x, z }; }
    }
    // face the middle of the town
    return { x: best.x, z: best.z, yaw: Math.atan2(best.x, best.z) };
  }
  function placeSeat(s, sp) {
    SDP.respawn(s.p, sp.x, 0, sp.z); s.hist = [];
    s.yaw = sp.yaw; s.pitch = 0; s.hp = RULES.hp; s.alive = true; s.lastHit = -1e9;
  }

  /* ---------- lobby / match flow ---------- */
  function maybeStart() {
    const a = R.seats.A, b = R.seats.B;
    if (R.phase !== 'lobby' || !a || !b || !a.ready || !b.ready || a.conn == null || b.conn == null) return;
    startMatch();
  }
  function startMatch() {
    R.match++; R.phase = 'countdown'; R.startAt = R.now + RULES.countdownMs; R.bullets.length = 0; R.winner = undefined;
    R.rematch = { A: false, B: false };
    const a = R.seats.A, b = R.seats.B;
    a.kills = b.kills = a.deaths = b.deaths = 0; a.shots = b.shots = a.hits = b.hits = a.hs = b.hs = 0;
    const sa = spawnPoint('A', null); placeSeat(a, sa);
    const sb = spawnPoint('B', { x: sa.x, y: 0, z: sa.z }); placeSeat(b, sb);
    for (const s of [a, b]) { s.lastSeq = -1; s.budget = PR.LIMITS.cmdBurst; s.budgetAt = R.startAt; }
    for (const s of [a, b]) sendTo(s, { t: 'start', m: R.match, in: RULES.countdownMs, you: s.id,
      spawn: { x: s.p.ms.x, z: s.p.ms.z, yaw: s.yaw }, rules: { kills: RULES.killsToWin, hp: RULES.hp, respawnMs: RULES.respawnMs },
      names: { A: a.name, B: b.name } });
    log('start match ' + R.match); save();
  }
  function endMatch(winner, why) {
    R.phase = 'over'; R.winner = winner; R.bullets.length = 0;
    for (const id of ['A', 'B']) { const s = R.seats[id]; if (s) s.ready = false; }
    sendAll({ t: 'ev', m: R.match, e: [{ k: 'over', winner, why, sc: score(), stats: statsOf() }] });
    sendAll(lobbyMsg());
    log('over ' + winner + ' ' + why); save();
  }
  const score = () => ({ A: R.seats.A ? R.seats.A.kills : 0, B: R.seats.B ? R.seats.B.kills : 0 });
  const statsOf = () => { const o = {}; for (const id of ['A', 'B']) { const s = R.seats[id]; if (s) o[id] = { kills: s.kills, deaths: s.deaths, shots: s.shots, hits: s.hits, hs: s.hs }; } return o; };

  /* ---------- connections ---------- */
  function connect(conn, now) {
    R.now = now; R.lastActive = now;
    R.conns.set(conn, { seat: null, msgs: 0, winStart: now, strikes: 0, lastMsg: now });
  }
  function disconnect(conn, now) {
    R.now = now; R.lastActive = now;
    const c = R.conns.get(conn); R.conns.delete(conn);
    if (!c || !c.seat) return;
    const s = R.seats[c.seat]; if (!s || s.conn !== conn) return;
    s.conn = null; s.leftAt = now;
    log('drop ' + s.id);
    if (R.phase === 'playing' || R.phase === 'countdown') { R.pausedFrom = R.phase; R.phase = 'paused'; R.pausedAt = now; sendAll({ t: 'ev', m: R.match, e: [{ k: 'pause', who: s.id }] }); }
    if (R.phase === 'lobby') s.ready = false;
    sendAll(lobbyMsg());
  }
  function hello(conn, c, m) {
    // reconnect with a token
    if (m.token) {
      for (const id of ['A', 'B']) {
        const s = R.seats[id];
        if (s && s.token === m.token) {
          if (s.conn != null && s.conn !== conn) { R.close(s.conn, 4001, 'replaced'); const oc = R.conns.get(s.conn); if (oc) oc.seat = null; }
          s.conn = conn; c.seat = id; if (m.name) s.name = m.name;
          log('back ' + id);
          welcome(s);
          if (R.phase === 'paused' && R.seats.A && R.seats.B && R.seats.A.conn != null && R.seats.B.conn != null) resume();
          sendAll(lobbyMsg());
          return;
        }
      }
      // a token that is not ours: fall through as a new player only if there is room
    }
    let id = !R.seats.A ? 'A' : !R.seats.B ? 'B' : null;
    if (!id || R.phase !== 'lobby') { R.send(conn, JSON.stringify({ t: 'error', code: id ? 'in_progress' : 'full' })); R.close(conn, 4003, 'full'); return; }
    const s = newSeat(id, m.name, token()); R.seats[id] = s; s.conn = conn; c.seat = id;
    log('join ' + id); welcome(s); sendAll(lobbyMsg()); save();
  }
  function welcome(s) {
    const msg = { t: 'welcome', you: s.id, token: s.token, code: R.code, phase: R.phase, match: R.match, players: pubPlayers(),
      rules: { kills: RULES.killsToWin, hp: RULES.hp } };
    sendTo(s, msg);
    // back in the middle of a match: what it needs to continue
    if (R.phase === 'playing' || R.phase === 'paused' || R.phase === 'countdown') {
      sendTo(s, { t: 'start', m: R.match, in: Math.max(0, R.startAt - R.now), you: s.id, resume: true,
        spawn: { x: s.p.ms.x, z: s.p.ms.z, yaw: s.yaw }, rules: { kills: RULES.killsToWin, hp: RULES.hp, respawnMs: RULES.respawnMs },
        names: { A: R.seats.A && R.seats.A.name, B: R.seats.B && R.seats.B.name }, lastSeq: s.lastSeq });
      sendSnap(s);
    }
  }
  function resume() {
    R.phase = R.pausedFrom === 'countdown' ? 'countdown' : 'playing';
    const lost = R.now - R.pausedAt;
    if (R.phase === 'countdown') R.startAt += lost;
    for (const id of ['A', 'B']) { const s = R.seats[id]; s.budgetAt = R.now; s.budget = PR.LIMITS.cmdBurst; if (!s.alive) s.diedAt += lost; s.lastHit += lost; }
    sendAll({ t: 'ev', m: R.match, e: [{ k: 'resume' }] });
    log('resume');
  }

  /* ---------- messages ---------- */
  function message(conn, text, now) {
    R.now = now; R.lastActive = now;
    const c = R.conns.get(conn); if (!c) return;
    c.lastMsg = now;
    // rate limit per connection
    if (now - c.winStart >= 1000) { c.winStart = now; c.msgs = 0; }
    if (++c.msgs > PR.LIMITS.maxMsgPerSec) { if (c.msgs > PR.LIMITS.maxMsgPerSec * 3) R.close(conn, 4008, 'flood'); return; }
    const r = PR.parse(text);
    if (r.error) { if (++c.strikes > 20) R.close(conn, 4002, 'bad'); R.send(conn, JSON.stringify({ t: 'error', code: 'bad_msg', why: r.error })); return; }
    const m = r.msg;
    if (m.t === 'ping') { if (c.seat && R.seats[c.seat] && R.seats[c.seat].conn === conn && m.r !== undefined) R.seats[c.seat].rtt = m.r; R.send(conn, JSON.stringify({ t: 'pong', c: m.c, s: now })); return; }
    if (m.t === 'hello') { if (!c.seat) hello(conn, c, m); return; }
    const s = c.seat && R.seats[c.seat]; if (!s || s.conn !== conn) return;
    switch (m.t) {
      case 'ready': R.lastPlay = now; if (R.phase === 'lobby') { s.ready = m.on; sendAll(lobbyMsg()); maybeStart(); } break;
      case 'rematch':
        if (R.phase === 'over' && !R.seats[other(s.id)]) {   // the rival is gone: back to the lobby to wait for someone
          R.phase = 'lobby'; R.winner = undefined; R.rematch = { A: false, B: false }; s.ready = false; s.kills = s.deaths = 0;
          // the remaining player becomes A if needed (a new player always joins the free seat)
          sendAll(lobbyMsg()); save(); break;
        }
        if (R.phase === 'over') { R.rematch[s.id] = true; sendAll(lobbyMsg());
          if (R.rematch.A && R.rematch.B && R.seats.A.conn != null && R.seats.B.conn != null) startMatch(); }
        break;
      case 'leave':
        R.seats[s.id] = null; c.seat = null; R.close(conn, 4000, 'leave'); log('leave ' + s.id);
        // leaving a running match: the other one wins and keeps seeing the result screen
        if (R.phase !== 'lobby' && R.phase !== 'over') endMatch(other(s.id), 'abandono');
        { const o = R.seats[other(s.id)]; if (o) o.ready = false; }
        if (!R.seats.A && !R.seats.B) { R.phase = 'lobby'; R.winner = undefined; }
        sendAll(lobbyMsg()); save(); break;
      case 'in': R.lastPlay = now; commands(s, m); break;
    }
  }
  function commands(s, m) {
    if (m.m !== R.match) return;                              // from an older match: ignore
    if (R.phase !== 'playing' && R.phase !== 'countdown') return;
    // budget: no more commands than real time allows (+ a burst for network bunching)
    const el = Math.max(0, R.now - s.budgetAt) / 1000; s.budgetAt = R.now;
    s.budget = Math.min(PR.LIMITS.cmdBurst, s.budget + el * PR.LIMITS.tickHz);
    for (let i = 0; i < m.c.length; i++) {
      const seq = m.s + i;
      if (seq <= s.lastSeq) continue;                         // duplicate or old: never applied twice
      if (s.budget < 1) { s.dropped = (s.dropped || 0) + (m.c.length - i); if (!s.dropLogged) { log('cmds dropped ' + s.id); s.dropLogged = true; } break; } // too fast: the rest is dropped
      s.budget -= 1; s.lastSeq = seq;
      const cmd = m.c[i];
      if (R.phase !== 'playing' || !s.alive) continue;        // acknowledged but not simulated
      simulate(s, cmd);
      if (R.phase !== 'playing') break;
    }
  }
  function simulate(s, cmd) {
    s.yaw = cmd.yaw; s.pitch = Math.max(-1.45, Math.min(1.45, cmd.pitch));
    const r = SDP.step(s.p, cmd, DT, ix.world, CFG.move);
    for (const e of r.wev) if (e.type === 'fire') fire(s, cmd);
    for (const e of r.lev) if (e.type === 'knifeHit') knife(s);
  }

  /* ---------- pose history (lag compensation) ---------- */
  function record(s) {
    const ms = s.p.ms, h = s.hist || (s.hist = []);
    h.push({ t: R.now, x: ms.x, y: ms.y, z: ms.z, eye: ms.eye, yaw: s.yaw });
    while (h.length > 2 && h[1].t < R.now - 1000) h.shift();
  }
  // the seat's body as it was at server time t (interpolated); now if no history
  function poseAt(s, t) {
    const ms = s.p.ms, h = s.hist;
    const cur = { x: ms.x, y: ms.y, z: ms.z, eye: ms.eye, yaw: s.yaw };
    if (!h || !h.length || t >= R.now) return cur;
    if (t <= h[0].t) return h[0];
    for (let i = h.length - 1; i > 0; i--) {
      const a = h[i - 1], b = h[i];
      if (t >= a.t && t <= b.t) { const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, eye: a.eye + (b.eye - a.eye) * f, yaw: f < 0.5 ? a.yaw : b.yaw }; }
    }
    return h[h.length - 1].t <= t ? cur : h[h.length - 1];
  }
  const rewindOf = s => Math.max(0, Math.min(RULES.maxRewindMs, (s.rtt || 0) / 2 + PR.LIMITS.interpMs));

  /* ---------- rifle ---------- */
  function aimDir(yaw, pitch) {
    const cp = Math.cos(pitch);
    return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
  }
  function fire(s, cmd) {
    const ms = s.p.ms, eye = [ms.x, ms.y + ms.eye, ms.z];
    const a = aimDir(s.yaw, s.pitch);
    let d = a, o = eye, why = null;
    if (cmd.fd && cmd.fo) {
      const n = Math.hypot(cmd.fd[0], cmd.fd[1], cmd.fd[2]);
      const fd = n > 0.5 ? [cmd.fd[0] / n, cmd.fd[1] / n, cmd.fd[2] / n] : null;
      const dev = fd ? Math.acos(Math.max(-1, Math.min(1, fd[0] * a[0] + fd[1] * a[1] + fd[2] * a[2]))) : 9;
      const od = Math.hypot(cmd.fo[0] - eye[0], cmd.fo[1] - eye[1], cmd.fo[2] - eye[2]);
      if (!fd || dev > RULES.maxShotDev) why = 'direction';
      else if (od > RULES.maxOriginDist) why = 'origin';
      else if (!G.losClear(ix, eye[0], eye[1], eye[2], cmd.fo[0], cmd.fo[1], cmd.fo[2])) why = 'origin_wall';
      else { d = fd; o = cmd.fo.slice(); }
    }
    if (why) { sendTo(s, { t: 'ev', m: R.match, e: [{ k: 'rejected', what: 'shot', why }] }); log('shot rejected ' + s.id + ' ' + why); }
    s.shots++;
    const b = Wp.createBullet(o[0], o[1], o[2], d[0], d[1], d[2], GUN);
    b.id = ++R.bulletId; b.by = s.id; b.ox = o[0]; b.oy = o[1]; b.oz = o[2]; b.rewind = typeof cmd.ft === 'number' ? Math.max(0, Math.min(RULES.maxRewindMs, R.now - cmd.ft)) : rewindOf(s);
    R.bullets.push(b);
    sendAll({ t: 'ev', m: R.match, e: [{ k: 'shot', id: b.id, by: s.id, o: o.map(v => Math.round(v * 1000) / 1000), d: d.map(v => Math.round(v * 1e5) / 1e5), corrected: !!why }] });
  }
  function stepBullets(dt, at) {
    for (const b of R.bullets) {
      if (b.done) continue;
      const sg = Wp.stepBullet(b, dt, GUN);
      const mh = G.segMap(ix, sg.x0, sg.y0, sg.z0, sg.dx, sg.dy, sg.dz, sg.len);
      let lim = mh ? mh.t : sg.len, hitP = null;
      const tgt = R.seats[other(b.by)];
      if (tgt && tgt.alive) {
        const pose = poseAt(tgt, (at === undefined ? R.now : at) - (b.rewind || 0));
        const h = HB.segPlayer(G, pose, sg.x0, sg.y0, sg.z0, sg.dx, sg.dy, sg.dz, lim);
        if (h) hitP = h;
      }
      if (hitP) { b.done = true; damage(R.seats[b.by], tgt, hitP.part, GUN.dmg[hitP.part], b, [sg.x0 + sg.dx * hitP.t, sg.y0 + sg.dy * hitP.t, sg.z0 + sg.dz * hitP.t]); }
      else if (mh) { b.done = true; }
      else { b.dist += sg.len; if (b.dist > GUN.maxRange || b.y < -5) b.done = true; }
      if (R.phase !== 'playing') return;
    }
    R.bullets = R.bullets.filter(b => !b.done);
  }
  function damage(att, vic, part, dmg, b, pt) {
    if (!vic.alive) return;
    vic.hp -= dmg; vic.lastHit = R.now;
    if (att) { att.hits++; if (part === 'head') att.hs++; }
    const dist = b ? Math.hypot(pt[0] - b.ox, pt[2] - b.oz) : 0;
    const e = [{ k: 'hit', by: att ? att.id : null, to: vic.id, part, dmg, hp: Math.max(0, Math.round(vic.hp)), pt: pt.map(v => Math.round(v * 100) / 100), dist: Math.round(dist), weapon: b ? 'rifle' : 'knife' }];
    if (vic.hp <= 0) {
      vic.hp = 0; vic.alive = false; vic.diedAt = R.now; vic.deaths++;
      if (att) att.kills++;
      e.push({ k: 'kill', by: att ? att.id : null, to: vic.id, part, dist: Math.round(dist), weapon: b ? 'rifle' : 'knife', sc: score() });
      R.pendingWin = R.pendingWin || [];
      if (att && att.kills >= RULES.killsToWin) R.pendingWin.push(att.id);
    }
    sendAll({ t: 'ev', m: R.match, e });
  }

  /* ---------- knife ---------- */
  function knife(s) {
    const tgt = R.seats[other(s.id)]; if (!tgt || !tgt.alive) return;
    const ms = s.p.ms, eyeY = ms.y + ms.eye;
    const att = { x: ms.x, z: ms.z, eyeY, fx: -Math.sin(s.yaw), fz: -Math.cos(s.yaw) };
    const t = tgt.p.ms, k = HB.scaleOf(t.eye);
    const list = [{ ref: tgt, x: t.x, z: t.z, y0: t.y, y1: t.y + 1.8 * k, radius: 0.3, fx: -Math.sin(tgt.yaw), fz: -Math.cos(tgt.yaw) }];
    const res = Me.resolve(att, list, KNIFE, q => G.losClear(ix, ms.x, eyeY, ms.z, q.x, q.y0 + (q.y1 - q.y0) * 0.62, q.z));
    if (res) damage(s, tgt, 'torso', res.damage, null, [t.x, t.y + 1.1 * k, t.z]);
  }

  /* ---------- time ---------- */
  function tick(now) {
    const dtMs = Math.min(250, Math.max(0, now - R.now)); R.now = now;
    if (R.closed) return;
    R.tickN++;
    if (R.phase === 'countdown' && now >= R.startAt) { R.phase = 'playing'; sendAll({ t: 'ev', m: R.match, e: [{ k: 'go' }] }); }
    if (R.phase === 'playing') {
      // bullets fly in steps of 1/120 s whatever the server tick
      let n = Math.round(dtMs / (DT * 1000)); n = Math.max(1, Math.min(30, n));
      for (let i = 0; i < n && R.phase === 'playing'; i++) { stepBullets(DT, now - (n - 1 - i) * DT * 1000); checkWin(); }
      for (const id of ['A', 'B']) { const s = R.seats[id]; if (s && s.alive) record(s); }
      for (const id of ['A', 'B']) {
        const s = R.seats[id]; if (!s) continue;
        if (!s.alive && now - s.diedAt >= RULES.respawnMs && R.phase === 'playing') {
          const o = R.seats[other(id)], om = o.p.ms;
          placeSeat(s, spawnPoint(id, { x: om.x, y: om.y, z: om.z }));
          sendAll({ t: 'ev', m: R.match, e: [{ k: 'respawn', id, x: s.p.ms.x, z: s.p.ms.z, yaw: s.yaw }] });
        }
        if (s.alive && s.hp < RULES.hp && now - s.lastHit > RULES.regenDelayMs) s.hp = Math.min(RULES.hp, s.hp + RULES.regenPerSec * dtMs / 1000);
      }
    }
    if (R.phase === 'paused') {
      const gone = ['A', 'B'].filter(id => R.seats[id] && R.seats[id].conn == null);
      if (gone.length && now - R.pausedAt > RULES.reconnectMs) {
        if (gone.length === 2) { R.phase = 'over'; R.winner = null; save(); }
        else endMatch(other(gone[0]), 'abandono');
      }
    }
    // a socket that went silent (phone locked, network gone without a goodbye): treat it as
    // disconnected now, so the match pauses for the rival instead of leaving a sitting target
    for (const [conn, c] of R.conns) if (now - c.lastMsg > RULES.silentMs) { R.close(conn, 4006, 'silent'); disconnect(conn, now); log('silent'); }
    // a room left open with nobody playing for a long time is closed (frees the server)
    if ((R.phase === 'lobby' || R.phase === 'over') && R.conns.size && now - R.lastPlay > RULES.idleRoomMs) {
      for (const conn of [...R.conns.keys()]) { R.send(conn, JSON.stringify({ t: 'error', code: 'idle' })); R.close(conn, 4005, 'idle'); disconnect(conn, now); }
      log('idle close');
    }
    if (R.phase === 'lobby') {
      for (const id of ['A', 'B']) { const s = R.seats[id]; if (s && s.conn == null && now - s.leftAt > RULES.lobbySeatMs) { R.seats[id] = null; sendAll(lobbyMsg()); save(); } }
    }
    if ((R.phase === 'playing' || R.phase === 'countdown' || R.phase === 'paused') && now - R.lastSnap >= 1000 / RULES.snapHz) {
      R.lastSnap = now; for (const id of ['A', 'B']) if (R.seats[id]) sendSnap(R.seats[id]);
    }
  }
  function checkWin() {
    if (!R.pendingWin || !R.pendingWin.length) return;
    const w = R.pendingWin; R.pendingWin = [];
    endMatch(w.length > 1 ? null : w[0], 'bajas');
  }
  function pubOpp(s) {
    if (!s) return null;
    const ms = s.p.ms, L = s.p.load;
    return { x: r3(ms.x), y: r3(ms.y), z: r3(ms.z), vx: r3(ms.vx), vz: r3(ms.vz), yaw: r4(s.yaw), pitch: r4(s.pitch), eye: r3(ms.eye),
      mode: ms.mode, g: ms.onGround ? 1 : 0, alive: s.alive ? 1 : 0, wpn: L.active, ads: r3(s.p.w.ads), ws: s.p.w.state, hp: Math.round(s.hp),
      name: s.name, on: s.conn != null ? 1 : 0 };
  }
  function sendSnap(s) {
    if (s.conn == null) return;
    const o = R.seats[other(s.id)];
    sendTo(s, { t: 'snap', m: R.match, k: R.tickN, ph: R.phase, ack: s.lastSeq, me: SDP.save(s.p), hp: Math.round(s.hp), alive: s.alive ? 1 : 0,
      op: pubOpp(o), sc: score(), now: R.now });
  }
  const r3 = v => Math.round(v * 1000) / 1000, r4 = v => Math.round(v * 1e4) / 1e4;

  // restore seats after the server object was evicted (names, tokens, score)
  function restore(d) {
    if (!d || !d.seats) return;
    for (const x of d.seats) if (x) { const s = newSeat(x.id, x.name, x.token); s.kills = x.kills || 0; s.deaths = x.deaths || 0; s.leftAt = R.now; R.seats[x.id] = s; }
    R.match = d.match || 0;
    R.phase = d.phase === 'over' ? 'over' : 'lobby'; // a match cut by a restart goes back to the lobby
  }
  function isIdle(now) { return R.conns.size === 0 && now - R.lastActive > 5 * 60000; }

  // test-only hooks (the real servers never pass debug: true)
  const debug = opts.debug ? {
    place(id, x, z, yaw) { const st = R.seats[id]; SDP.respawn(st.p, x, 0, st.p.ms ? z : z); st.p.ms.x = x; st.p.ms.z = z; st.yaw = yaw || 0; st.alive = true; st.hp = RULES.hp; },
    set(id, k, v) { R.seats[id][k] = v; },
    seat: id => R.seats[id], index: ix
  } : null;
  return Object.assign(R, { connect, disconnect, message, tick, restore, isIdle, RULES, debug });
}
const SDRoom = { create, RULES };
if (isNode) module.exports = SDRoom; else root.SDRoom = SDRoom;
})(typeof window !== 'undefined' ? window : globalThis);
