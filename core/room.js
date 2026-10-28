/* SNIPER DUEL — one private room. The authority for everything that decides the match:
   seats, lobby, start, movement (it runs each player's own commands with the shared player
   tick), ammo/bolt/reload, bullets (exact parabola against the real map triangles and the
   body hit zones), damage, deaths, respawns, score, winner, rematch and reconnection.

   It does not know about sockets or clocks: an adapter (Node server, Cloudflare Durable
   Object, or a test) calls connect / message / disconnect / tick with the time in ms and
   gives it a send(connId, text) and close(connId) function.

   Modes (the room's creator chooses them in the lobby, docs/SALAS-PERSONALIZADAS.md)
   - 'duelo' (the default, as it always was): 2 players, no bots. A player that drops out during
     the match pauses it for both (RECONECTANDO) up to 60 s; after that the one still connected wins.
   - 'todos' (free for all): up to 6 seats between people and server bots (core/bots.js), each on
     their own. 'equipos': 2 v 2 or 3 v 3, ROJO against AZUL; people pick a team, bots fill the
     gaps; no friendly fire; the team's kills add up. In these two a player that drops out just
     leaves the field until it comes back (the others keep playing); with nobody left the match pauses.
   Rules of every mode
   - First to 10 kills or 10 minutes of play (5/10/20/30 kills, 5/10/15/20 min or no limit). When the
     time runs out, more kills wins; equal is a draw. 100 HP, regeneration like offline (after 5 s
     without damage, +22 HP/s). Respawn 3 s after dying, full HP, full magazine.
   - Bullets already flying when their shooter dies keep flying and can still hit.
   - Two kills in the same server tick that both reach the goal: a draw (winner null).
   Bots play by the same rules: the room runs their commands through the same player tick and their
   bullets through the same ballistics; only their decisions come from core/bots.js.
   Cloud accounts (optional, server/accounts.js): a player may send its account session ('acct'); the adapter checks it
   (opts.account → { id, title }), the lobby then shows the title read from the account, and at the end of the match
   opts.onOver gets the verified account ids and the time actually played (box points: matchReward). Nothing of this
   touches the rules of the match.                                                           */
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
const Bots = isNode ? require('./bots.js') : root.SDBots;

const RULES = { killsToWin: 10, hp: 100, respawnMs: 3000, countdownMs: 3000, regenDelayMs: 5000, regenPerSec: 22,
  reconnectMs: 60000, lobbySeatMs: 60000, silentMs: 6000, idleRoomMs: 15 * 60000, snapHz: 20, maxShotDev: 0.3, maxOriginDist: 0.9,
  // lag compensation: a bullet is tested against the rival where the shooter SAW them
  // (half the round trip + the client's interpolation delay), never more than maxRewindMs back
  maxRewindMs: 250, timeMin: 10, maxSeats: 6 };
const SEATS = ['A', 'B', 'C', 'D', 'E', 'F'], TEAMS = ['rojo', 'azul'];
// what the room's creator may choose (lobby 'cfg'): kills to win, minutes (0 = no time limit), mode, bots, their
// difficulty (0 RECLUTA, 1 VETERANO, 2 ÉLITE) and the team size (2 = 2 v 2, 3 = 3 v 3)
const CFG_KILLS = [5, 10, 20, 30], CFG_TIME = [0, 5, 10, 15, 20], CFG_MODE = ['duelo', 'todos', 'equipos'], CFG_BOTS = [0, 1, 2, 3, 4, 5], CFG_DIFF = [0, 1, 2], CFG_SIZE = [2, 3];
const capacity = c => c.mode === 'duelo' ? 2 : c.mode === 'equipos' ? 2 * c.size : RULES.maxSeats;   // people in the room
function cleanCfg(c) {
  return CFG_KILLS.includes(c.kills) && CFG_TIME.includes(c.time) && CFG_MODE.includes(c.mode) && CFG_BOTS.includes(c.bots) && CFG_DIFF.includes(c.diff) && CFG_SIZE.includes(c.size)
    ? { kills: c.kills, time: c.time, mode: c.mode, bots: c.bots, diff: c.diff, size: c.size } : null;
}
const DT = 1 / PR.LIMITS.tickHz;
const GUN = CFG.rifles.halcon, PISTOL = CFG.pistols.vibora, SHOTGUN = CFG.shotguns.furia, KNIFE = CFG.knives.tactica;

function create(opts) {
  // maps: opts.maps = { id: map data } (opts.map alone = one map called 'pueblo'); the creator
  // picks one in the lobby; indexes are built once and can be shared between rooms
  const MAPS = opts.maps || { pueblo: opts.map };
  const IXS = Object.assign({}, opts.indexes || {}); if (opts.index && !opts.indexes) IXS[Object.keys(MAPS)[0]] = opts.index;
  const indexOf = id => IXS[id] || (IXS[id] = G.createMapIndex(MAPS[id]));
  let mapId = opts.defaultMap && MAPS[opts.defaultMap] ? opts.defaultMap : Object.keys(MAPS)[0];
  let ix = indexOf(mapId), MAP = MAPS[mapId];
  const rand = opts.rand || Math.random;
  const R = {
    code: opts.code, phase: 'lobby', match: 0, startAt: 0, tickN: 0, now: opts.now || 0,
    seats: { A: null, B: null, C: null, D: null, E: null, F: null }, conns: new Map(), evSeq: 0, bullets: [], bulletId: 0, shotId: 0, winner: undefined,
    pausedAt: 0, lastSnap: 0, lastActive: opts.now || 0, lastPlay: opts.now || 0, closed: false, rematch: {}, log: [],
    send: opts.send || (() => {}), close: opts.close || (() => {}), randBytes: opts.randBytes, persist: opts.persist || null,
    account: opts.account || null, onOver: opts.onOver || null, accOf: {}, playMs: 0, bulletMs: 0, teamSc: { rojo: 0, azul: 0 },
    cfg: { kills: RULES.killsToWin, time: RULES.timeMin, mode: 'duelo', bots: 0, diff: 1, size: 2 }
  };

  /* ---------- helpers ---------- */
  const all = () => SEATS.map(id => R.seats[id]).filter(Boolean);
  const humans = () => all().filter(s => !s.bot);
  const host = () => humans()[0] || null;                       // who chooses: the first person in the room (A when it is there)
  const teamMode = () => R.cfg.mode === 'equipos';
  const isMate = (a, b) => teamMode() && !!a.team && a.team === b.team;
  const enemiesOf = s => all().filter(o => o !== s && !isMate(o, s));
  const rival = s => all().find(o => o !== s) || null;          // duelo: the other one
  const sendTo = (seat, obj) => { if (obj.t === 'ev') obj.q = ++R.evSeq; if (seat && seat.conn != null) R.send(seat.conn, JSON.stringify(obj)); };
  const evq = obj => { if (obj.t === 'ev') obj.q = ++R.evSeq; return obj; };
  const sendAll = obj => { evq(obj); const s = JSON.stringify(obj); for (const st of all()) if (st.conn != null) R.send(st.conn, s); };
  const log = (msg) => { R.log.push(Math.round(R.now) + ' ' + msg); if (R.log.length > 200) R.log.shift(); };
  const shownIds = () => R.cfg.mode === 'duelo' ? ['A', 'B'] : SEATS;
  const pubPlayers = () => shownIds().map(id => { const s = R.seats[id]; return s ? { id, name: s.name, connected: !!s.bot || s.conn != null, ready: s.ready, kills: s.kills, kit: s.kit, skin: s.skin,
    acc: s.acc ? 1 : 0, title: s.acc && s.acc.title || undefined, bot: s.bot ? 1 : undefined, team: s.team || undefined } : null; });
  const cleanTitle = t => typeof t === 'string' ? t.replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').trim().slice(0, 24) : '';
  const lobbyMsg = () => ({ t: 'lobby', phase: R.phase, players: pubPlayers(), match: R.match, map: mapId, maps: Object.keys(MAPS), winner: R.winner === undefined ? undefined : R.winner,
    rematch: R.rematch, cfg: R.cfg, host: host() ? host().id : null, tsc: teamMode() ? R.teamSc : undefined });
  const timeMs = () => R.cfg.time * 60000;
  const rulesMsg = () => ({ kills: R.cfg.kills, hp: RULES.hp, respawnMs: RULES.respawnMs, timeMs: timeMs(), mode: R.cfg.mode });
  const namesMsg = () => { const o = {}; for (const s of all()) o[s.id] = s.name; return o; };
  const teamsMsg = () => { if (!teamMode()) return undefined; const o = {}; for (const s of all()) o[s.id] = s.team; return o; };
  function save() {
    if (!R.persist) return;
    R.persist({ code: R.code, map: mapId, cfg: R.cfg, phase: R.phase === 'playing' || R.phase === 'countdown' || R.phase === 'paused' ? 'interrupted' : R.phase, match: R.match,
      seats: humans().map(s => ({ id: s.id, name: s.name, token: s.token, kills: s.kills, deaths: s.deaths, kit: s.kit, skin: s.skin, team: s.team || undefined })) });
  }
  function newSeat(id, name, token) {
    return { id, name: name || ('JUGADOR ' + (SEATS.indexOf(id) + 1)), token, conn: null, ready: false, leftAt: 0, kit: 'rifle', skin: null, team: null, bot: null, away: false,
      p: SDP.create(0, 0, 0), hp: RULES.hp, alive: false, diedAt: 0, lastHit: -1e9, kills: 0, deaths: 0,
      lastSeq: -1, budget: PR.LIMITS.cmdBurst, budgetAt: R.now, yaw: 0, pitch: 0, shots: 0, hits: 0, hs: 0 };
  }
  function token() {
    const b = R.randBytes ? R.randBytes(24) : Array.from({ length: 24 }, () => (rand() * 256) | 0);
    return PR.tokenFrom(b);
  }
  // equipos: a person without a team (or in a full one) goes to the one with fewer people
  function pickTeam(s) {
    const n = t => humans().filter(o => o !== s && o.team === t).length;
    if (!(TEAMS.includes(s.team) && n(s.team) < R.cfg.size)) s.team = n('rojo') <= n('azul') ? 'rojo' : 'azul';
  }

  /* ---------- spawns ---------- */
  function spawnPoint(id, avoid) {
    // duelo: far from the rival, out of their sight when possible; first spawns on opposite sides
    let best = null, bs = -1e9;
    const nav = MAP.nav;
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
  // todos / equipos: far from every enemy and out of their sight; at the start, each team on its side
  function spawnFor(s, others, first) {
    const foes = others.filter(o => !isMate(o, s)).map(o => o.p.ms), mates = others.filter(o => isMate(o, s)).map(o => o.p.ms);
    let best = null, bs = -1e9;
    const nav = MAP.nav;
    for (let k = 0; k < 70; k++) {
      const n = nav[(rand() * nav.length) | 0], x = n[0], z = n[1];
      let sc = rand() * 4, md = 1e9;
      for (const f of foes) { const d = Math.hypot(x - f.x, z - f.z); md = Math.min(md, d); if (G.losClear(ix, f.x, f.y + 1.5, f.z, x, 1.5, z)) sc -= 40; }
      sc += foes.length ? Math.min(md, 55) - (md < 14 ? 200 : 0) : 0;
      if (first && teamMode()) sc += (s.team === 'rojo' ? -x : x) * 1.2 - (mates.length ? Math.min(...mates.map(m => Math.hypot(x - m.x, z - m.z))) * 0.3 : 0);
      if (sc > bs) { bs = sc; best = { x, z }; }
    }
    return { x: best.x, z: best.z, yaw: Math.atan2(best.x, best.z) };
  }
  function placeSeat(s, sp) {
    SDP.respawn(s.p, sp.x, 0, sp.z, s.kit); s.hist = [];   // the chosen primary takes effect at every spawn
    s.yaw = sp.yaw; s.pitch = 0; s.hp = RULES.hp; s.alive = true; s.lastHit = -1e9;
  }

  /* ---------- lobby / match flow ---------- */
  function botsWanted() { const H = humans().length; return R.cfg.mode === 'duelo' ? 0 : R.cfg.mode === 'equipos' ? Math.max(0, 2 * R.cfg.size - H) : Math.min(R.cfg.bots, RULES.maxSeats - H); }
  function maybeStart() {
    if (R.phase !== 'lobby') return;
    const H = humans(); if (!H.length || H.some(s => !s.ready || s.conn == null)) return;
    if (R.cfg.mode === 'duelo' ? H.length !== 2 : H.length + botsWanted() < 2) return;
    startMatch();
  }
  // bots of the last match leave; new ones take the free seats (todos: as many as chosen; equipos: to fill both teams)
  function setupBots() {
    for (const id of SEATS) if (R.seats[id] && R.seats[id].bot) R.seats[id] = null;
    let n = botsWanted(), k = 1;
    for (const id of SEATS) {
      if (n <= 0) break; if (R.seats[id]) continue;
      const s = newSeat(id, 'BOT ' + k++, null); s.bot = Bots.createBrain(R.cfg.diff, rand); s.ready = true; s.skin = PR.SKINS[(rand() * PR.SKINS.length) | 0];
      R.seats[id] = s; n--;
    }
    if (teamMode()) {
      for (const s of humans()) pickTeam(s);
      const cnt = t => all().filter(o => o.team === t).length;
      for (const s of all()) if (s.bot) s.team = cnt('rojo') <= cnt('azul') ? 'rojo' : 'azul';
    } else for (const s of all()) s.team = null;
  }
  function startMatch() {
    ix = indexOf(mapId); MAP = MAPS[mapId];
    R.match++; R.phase = 'countdown'; R.startAt = R.now + RULES.countdownMs; R.bullets.length = 0; R.winner = undefined; R.playMs = 0; R.bulletMs = 0;
    R.rematch = {}; R.teamSc = { rojo: 0, azul: 0 };
    setupBots();
    const seats = all();
    for (const s of seats) { s.kills = s.deaths = 0; s.shots = s.hits = s.hs = 0; s.away = false; }
    if (R.cfg.mode === 'duelo') {
      const [a, b] = seats;
      // maps with fixed first spawns (CASA ATLAS: A in the study, B in the kitchen); the others pick them from the nav points
      const fixed = id => { const f = MAP.spawns && MAP.spawns.find(q => q.team === id); return f ? { x: f.x, z: f.z, yaw: f.yaw } : null; };
      const sa = fixed('A') || spawnPoint('A', null); placeSeat(a, sa);
      const sb = fixed('B') || spawnPoint('B', { x: sa.x, y: 0, z: sa.z }); placeSeat(b, sb);
    } else { const placed = []; for (const s of seats) { placeSeat(s, spawnFor(s, placed, true)); placed.push(s); } }
    for (const s of seats) { s.lastSeq = -1; s.budget = PR.LIMITS.cmdBurst; s.budgetAt = R.startAt; }
    const names = namesMsg(), teams = teamsMsg();
    for (const s of seats) if (!s.bot) sendTo(s, { t: 'start', m: R.match, map: mapId, in: RULES.countdownMs, you: s.id,
      spawn: { x: s.p.ms.x, z: s.p.ms.z, yaw: s.yaw }, rules: rulesMsg(), names, teams });
    log('start match ' + R.match + ' ' + R.cfg.mode + ' ' + seats.length); save();
  }
  function endMatch(winner, why) {
    R.phase = 'over'; R.winner = winner; R.bullets.length = 0;
    for (const s of humans()) s.ready = false;
    sendAll({ t: 'ev', m: R.match, e: [{ k: 'over', winner, why, sc: score(), stats: statsOf(), tsc: teamMode() ? R.teamSc : undefined }] });
    sendAll(lobbyMsg());
    log('over ' + winner + ' ' + why); save();
    if (R.onOver) {
      const acc = {}; for (const id in R.accOf) if (R.accOf[id] && (!R.seats[id] || !R.seats[id].bot)) acc[id] = R.accOf[id];
      try { const p = R.onOver({ code: R.code, match: R.match, winner, why, ms: Math.round(R.playMs), mode: R.cfg.mode, acc, teams: teamsMsg(), bots: all().filter(s => s.bot).length }); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    }
  }
  const score = () => { const o = {}; if (R.cfg.mode === 'duelo') { o.A = R.seats.A ? R.seats.A.kills : 0; o.B = R.seats.B ? R.seats.B.kills : 0; } for (const s of all()) o[s.id] = s.kills; return o; };
  const statsOf = () => { const o = {}; for (const s of all()) o[s.id] = { kills: s.kills, deaths: s.deaths, shots: s.shots, hits: s.hits, hs: s.hs }; return o; };
  // who leads: the team or the player with more kills; equal at the top is a draw
  function leader() {
    if (teamMode()) { const a = R.teamSc.rojo, b = R.teamSc.azul; return a > b ? 'rojo' : b > a ? 'azul' : null; }
    let best = null, bk = -1, tie = false;
    for (const s of all()) { if (s.kills > bk) { best = s; bk = s.kills; tie = false; } else if (s.kills === bk) tie = true; }
    return best && !tie ? best.id : null;
  }

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
    if (R.phase === 'playing' || R.phase === 'countdown') {
      if (R.cfg.mode === 'duelo' || !humans().some(h => h.conn != null)) { R.pausedFrom = R.phase; R.phase = 'paused'; R.pausedAt = now; sendAll({ t: 'ev', m: R.match, e: [{ k: 'pause', who: s.id }] }); }
      else { s.away = true; s.alive = false; sendAll({ t: 'ev', m: R.match, e: [{ k: 'away', who: s.id }] }); }   // off the field until it comes back
    }
    if (R.phase === 'lobby') s.ready = false;
    sendAll(lobbyMsg());
  }
  function hello(conn, c, m) {
    // reconnect with a token
    if (m.token) {
      for (const s of humans()) {
        if (s.token === m.token) {
          const id = s.id;
          if (s.conn != null && s.conn !== conn) { R.close(s.conn, 4001, 'replaced'); const oc = R.conns.get(s.conn); if (oc) oc.seat = null; }
          s.conn = conn; c.seat = id; if (m.name) s.name = m.name;
          if (s.away) { s.away = false; s.diedAt = R.now - RULES.respawnMs + 500; }   // back on the field in half a second
          log('back ' + id);
          welcome(s);
          if (R.phase === 'paused' && (R.cfg.mode === 'duelo' ? humans().every(h => h.conn != null) : true)) resume();
          sendAll(lobbyMsg());
          return;
        }
      }
      // a token that is not ours: fall through as a new player only if there is room
    }
    const open = R.phase === 'lobby' || (R.cfg.mode !== 'duelo' && R.phase === 'over');
    let id = null;
    if (humans().length < capacity(R.cfg)) id = shownIds().find(k => !R.seats[k] || R.seats[k].bot) || null;
    if (!id || !open) { R.send(conn, JSON.stringify({ t: 'error', code: id ? 'in_progress' : 'full' })); R.close(conn, 4003, 'full'); return; }
    const s = newSeat(id, m.name, token()); R.seats[id] = s; s.conn = conn; c.seat = id; R.accOf[id] = null;
    if (teamMode()) pickTeam(s);
    log('join ' + id); welcome(s); sendAll(lobbyMsg()); save();
  }
  function welcome(s) {
    const msg = { t: 'welcome', you: s.id, token: s.token, code: R.code, phase: R.phase, match: R.match, players: pubPlayers(),
      rules: { kills: R.cfg.kills, hp: RULES.hp, timeMs: timeMs(), mode: R.cfg.mode }, cfg: R.cfg, host: host() ? host().id : null };
    sendTo(s, msg);
    // back in the middle of a match: what it needs to continue
    if (R.phase === 'playing' || R.phase === 'paused' || R.phase === 'countdown') {
      sendTo(s, { t: 'start', m: R.match, map: mapId, in: Math.max(0, R.startAt - R.now), you: s.id, resume: true,
        spawn: { x: s.p.ms.x, z: s.p.ms.z, yaw: s.yaw }, rules: rulesMsg(), names: namesMsg(), teams: teamsMsg(), lastSeq: s.lastSeq });
      sendSnap(s);
    }
  }
  function resume() {
    R.phase = R.pausedFrom === 'countdown' ? 'countdown' : 'playing';
    const lost = R.now - R.pausedAt;
    if (R.phase === 'countdown') R.startAt += lost;
    for (const s of all()) { s.budgetAt = R.now; s.budget = PR.LIMITS.cmdBurst; if (!s.alive) s.diedAt += lost; s.lastHit += lost; }
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
    const between = R.phase === 'lobby' || R.phase === 'over';
    switch (m.t) {
      case 'cfg': {  // the room's creator, between matches: kills, time, mode, bots, difficulty, team size
        const nc = s === host() && between && cleanCfg(Object.assign({}, R.cfg, m.mode === undefined ? {} : { mode: m.mode }, { kills: m.kills, time: m.time },
          m.bots === undefined ? {} : { bots: m.bots }, m.diff === undefined ? {} : { diff: m.diff }, m.size === undefined ? {} : { size: m.size }));
        if (nc && humans().length <= capacity(nc)) {
          const was = R.cfg.mode; R.cfg = nc;
          if (nc.mode === 'equipos') for (const h of humans()) pickTeam(h); else if (was === 'equipos') for (const h of humans()) h.team = null;
          sendAll(lobbyMsg()); save();
        }
        break;
      }
      case 'team':  // equipos: my team (if it has room for one more person)
        if (teamMode() && between && s.team !== m.id && humans().filter(o => o.team === m.id).length < R.cfg.size) { s.team = m.id; sendAll(lobbyMsg()); save(); }
        break;
      case 'map':   // only the room's creator chooses, and only between matches
        if (s === host() && MAPS[m.id] && between) { mapId = m.id; sendAll(lobbyMsg()); save(); }
        break;
      case 'kit':   // my primary for my next spawn (any time: the rival sees it in the lobby)
        if (s.kit !== m.id) { s.kit = m.id; if (between) sendAll(lobbyMsg()); save(); }
        break;
      case 'skin':  // my character: looks only (the rival draws it; nothing in the rules changes)
        if (s.skin !== m.id) { s.skin = m.id; if (between) sendAll(lobbyMsg()); save(); }
        break;
      case 'acct':  // my cloud account: the adapter checks the session; a wrong one is just ignored
        if (R.account && s.accTok !== m.tok) {
          s.accTok = m.tok; const seat = s;
          Promise.resolve().then(() => R.account(m.tok)).then(info => {
            if (R.seats[seat.id] !== seat || seat.accTok !== m.tok) return;
            seat.acc = info && typeof info.id === 'string' ? { id: info.id, title: cleanTitle(info.title) } : null;
            R.accOf[seat.id] = seat.acc ? seat.acc.id : null; sendAll(lobbyMsg());
          }, () => {});
        }
        break;
      case 'ready': R.lastPlay = now; if (R.phase === 'lobby') { s.ready = m.on; sendAll(lobbyMsg()); maybeStart(); } break;
      case 'rematch': {
        if (R.phase !== 'over') break;
        const H = humans();
        if (R.cfg.mode === 'duelo' ? H.length < 2 : H.length + botsWanted() < 2) {   // nobody to play against: back to the lobby to wait for someone
          R.phase = 'lobby'; R.winner = undefined; R.rematch = {}; for (const id of SEATS) if (R.seats[id] && R.seats[id].bot) R.seats[id] = null;
          s.ready = false; s.kills = s.deaths = 0;
          sendAll(lobbyMsg()); save(); break;
        }
        R.rematch[s.id] = true; sendAll(lobbyMsg());
        if (H.every(h => R.rematch[h.id] && h.conn != null)) startMatch();
        break;
      }
      case 'leave': {
        R.seats[s.id] = null; c.seat = null; R.close(conn, 4000, 'leave'); log('leave ' + s.id);
        const playing = R.phase !== 'lobby' && R.phase !== 'over';
        if (playing) {
          if (R.cfg.mode === 'duelo') endMatch(rival(s) ? rival(s).id : null, 'abandono');   // the other one wins and keeps seeing the result screen
          else if (!humans().length) { R.phase = 'lobby'; R.winner = undefined; for (const id of SEATS) R.seats[id] = null; }
          else if (all().length < 2 || (teamMode() && TEAMS.some(t => !all().some(o => o.team === t)))) endMatch(leader(), 'abandono');
          else sendAll({ t: 'ev', m: R.match, e: [{ k: 'left', who: s.id }] });
        }
        for (const o of humans()) if (R.cfg.mode === 'duelo' || !playing) o.ready = false;
        if (!humans().length) { R.phase = 'lobby'; R.winner = undefined; for (const id of SEATS) R.seats[id] = null; }
        sendAll(lobbyMsg()); save(); break;
      }
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
    for (const e of r.wev) if (e.type === 'fire') fire(s, cmd, GUN, 'rifle');
    for (const e of r.pev || []) if (e.type === 'fire') fire(s, cmd, PISTOL, 'pistol');
    for (const e of r.sev || []) if (e.type === 'fire') fire(s, cmd, SHOTGUN, 'shotgun', e);
    for (const e of r.lev) if (e.type === 'knifeHit') knife(s);
  }
  // one 1/120 s step of a bot: its brain looks at the enemies alive and decides the command; the rest is the same as a person
  function botStep(s, t) {
    const foes = enemiesOf(s).filter(o => o.alive).map(o => ({ id: o.id, x: o.p.ms.x, y: o.p.ms.y, z: o.p.ms.z, eye: o.p.ms.eye, alive: true }));
    simulate(s, Bots.think(s.bot, s, foes, { ix, map: MAP, now: t }));
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
  function fire(s, cmd, gun, kind, fe) {
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
    const rewind = typeof cmd.ft === 'number' ? Math.max(0, Math.min(RULES.maxRewindMs, R.now - cmd.ft)) : rewindOf(s);
    // shotgun: the server spreads the pellets itself from the (checked) centre direction, with the
    // same fixed pattern as the client (Wp.pelletDirs): the client never sends pellets
    const pel = gun.pellets > 1, ads = fe ? fe.ads : 0, seed = fe ? fe.n : 0;
    const dirs = pel ? Wp.pelletDirs(d, gun, ads, seed) : [d], shot = ++R.shotId;
    let first = 0;
    for (const v of dirs) {
      const b = Wp.createBullet(o[0], o[1], o[2], v[0], v[1], v[2], gun);
      b.cfg = gun; b.kind = kind; if (pel) b.shot = shot;
      b.id = ++R.bulletId; b.by = s.id; b.team = s.team; b.ox = o[0]; b.oy = o[1]; b.oz = o[2]; b.rewind = rewind;
      if (!first) first = b.id;
      R.bullets.push(b);
    }
    const ev = { k: 'shot', id: first, by: s.id, w: kind, o: o.map(v => Math.round(v * 1000) / 1000), d: d.map(v => Math.round(v * 1e5) / 1e5), corrected: !!why };
    if (pel) { ev.ads = ads; ev.n = seed; }
    sendAll({ t: 'ev', m: R.match, e: [ev] });
    for (const bt of all()) if (bt.bot && bt !== s && !isMate(bt, s) && Math.hypot(bt.p.ms.x - ms.x, bt.p.ms.z - ms.z) < 90) Bots.alert(bt.bot, ms.x, ms.z, R.now / 1000);   // bots hear it
  }
  function stepBullets(dt, at) {
    const pend = new Map();   // pellets of one shot that hit one player in this step: one hit, damage summed
    for (const b of R.bullets) {
      if (b.done) continue;
      const gun = b.cfg || GUN;
      const sg = Wp.stepBullet(b, dt, gun);
      const mh = G.segMap(ix, sg.x0, sg.y0, sg.z0, sg.dx, sg.dy, sg.dz, sg.len);
      let lim = mh ? mh.t : sg.len, hitP = null, tgt = null;
      // the nearest body on this piece of the flight (never the shooter, never a team-mate)
      for (const o of all()) {
        if (o.id === b.by || !o.alive || (teamMode() && b.team && o.team === b.team)) continue;
        const pose = poseAt(o, (at === undefined ? R.now : at) - (b.rewind || 0));
        const h = HB.segPlayer(G, pose, sg.x0, sg.y0, sg.z0, sg.dx, sg.dy, sg.dz, lim);
        if (h) { hitP = h; tgt = o; lim = h.t; }
      }
      if (hitP && b.shot) {
        b.done = true;
        const dm = dmgAt(gun, hitP.part, b.dist + hitP.t), pt = [sg.x0 + sg.dx * hitP.t, sg.y0 + sg.dy * hitP.t, sg.z0 + sg.dz * hitP.t];
        const key = b.shot + ':' + tgt.id, q = pend.get(key);
        if (!q) pend.set(key, { b, tgt, dmg: dm, part: hitP.part, pt, n: 1 });
        else { q.dmg += dm; q.n++; if (rank[hitP.part] > rank[q.part]) { q.part = hitP.part; q.pt = pt; } }
      }
      else if (hitP) { b.done = true; damage(R.seats[b.by], tgt, hitP.part, dmgAt(gun, hitP.part, b.dist + hitP.t), b, [sg.x0 + sg.dx * hitP.t, sg.y0 + sg.dy * hitP.t, sg.z0 + sg.dz * hitP.t]); }
      else if (mh) { b.done = true; }
      else { b.dist += sg.len; if (b.dist > gun.maxRange || b.y < -5) b.done = true; }
      if (R.phase !== 'playing') return;
    }
    for (const q of pend.values()) { damage(R.seats[q.b.by], q.tgt, q.part, q.dmg, q.b, q.pt, q.n); if (R.phase !== 'playing') return; }
    R.bullets = R.bullets.filter(b => !b.done);
  }
  const rank = { legs: 0, torso: 1, head: 2 };
  // damage of a gun at a distance (the pistol loses punch with range; the rifle does not)
  function dmgAt(gun, part, dist) {
    const f = gun.falloff; let k = 1;
    if (f) k = dist <= f.from ? 1 : dist >= f.to ? f.min : 1 - (1 - f.min) * (dist - f.from) / (f.to - f.from);
    return Math.round(gun.dmg[part] * k);
  }
  function damage(att, vic, part, dmg, b, pt, pellets) {
    if (!vic.alive) return;
    vic.hp -= dmg; vic.lastHit = R.now;
    if (att) { att.hits++; if (part === 'head') att.hs++; }
    if (vic.bot && att) Bots.alert(vic.bot, att.p.ms.x, att.p.ms.z, R.now / 1000);
    const dist = b ? Math.hypot(pt[0] - b.ox, pt[2] - b.oz) : 0;
    const e = [{ k: 'hit', by: att ? att.id : null, to: vic.id, part, dmg, hp: Math.max(0, Math.round(vic.hp)), pt: pt.map(v => Math.round(v * 100) / 100), dist: Math.round(dist), weapon: b ? (b.kind || 'rifle') : 'knife' }];
    if (pellets) e[0].pellets = pellets;
    if (vic.hp <= 0) {
      vic.hp = 0; vic.alive = false; vic.diedAt = R.now; vic.deaths++;
      if (att) { att.kills++; if (teamMode() && att.team) R.teamSc[att.team]++; }
      e.push({ k: 'kill', by: att ? att.id : null, to: vic.id, part, dist: Math.round(dist), weapon: b ? (b.kind || 'rifle') : 'knife', sc: score(), tsc: teamMode() ? R.teamSc : undefined });
      R.pendingWin = R.pendingWin || [];
      if (att && teamMode() ? att.team && R.teamSc[att.team] >= R.cfg.kills : att && att.kills >= R.cfg.kills) R.pendingWin.push(teamMode() ? att.team : att.id);
    }
    sendAll({ t: 'ev', m: R.match, e });
  }

  /* ---------- knife ---------- */
  function knife(s) {
    const ms = s.p.ms, eyeY = ms.y + ms.eye;
    const att = { x: ms.x, z: ms.z, eyeY, fx: -Math.sin(s.yaw), fz: -Math.cos(s.yaw) };
    const list = enemiesOf(s).filter(o => o.alive).map(tgt => { const t = tgt.p.ms, k = HB.scaleOf(t.eye);
      return { ref: tgt, x: t.x, z: t.z, y0: t.y, y1: t.y + 1.8 * k, radius: 0.3, fx: -Math.sin(tgt.yaw), fz: -Math.cos(tgt.yaw) }; });
    if (!list.length) return;
    const res = Me.resolve(att, list, KNIFE, q => G.losClear(ix, ms.x, eyeY, ms.z, q.x, q.y0 + (q.y1 - q.y0) * 0.62, q.z));
    if (res) { const tgt = res.target.ref, t = tgt.p.ms, k = HB.scaleOf(t.eye); damage(s, tgt, 'torso', res.damage, null, [t.x, t.y + 1.1 * k, t.z]); }
  }

  /* ---------- time ---------- */
  function tick(now) {
    R.now = now;
    const tickMs = R.lastTick ? Math.min(250, Math.max(0, now - R.lastTick)) : 0; R.lastTick = now;   // between ticks (messages move R.now too)
    if (R.closed) return;
    R.tickN++;
    if (R.phase === 'countdown' && now >= R.startAt) { R.phase = 'playing'; sendAll({ t: 'ev', m: R.match, e: [{ k: 'go' }] }); }
    if (R.phase === 'playing') {
      R.playMs += tickMs;   // time actually played (pauses do not count): box points need a real match
      // bullets fly in steps of 1/120 s of real server time: the time since the last tick, with its remainder kept for
      // the next one (28-10-2026: it used the time since the last message, and with the normal traffic of a match the
      // server bullets flew at 280–380 m/s instead of 600, so a rival on the move was missed where the shooter hit)
      R.bulletMs += tickMs; let n = Math.floor(R.bulletMs / (DT * 1000));
      if (n > 30) { n = 30; R.bulletMs = 0; } else R.bulletMs -= n * DT * 1000;
      const stepEnd = now - R.bulletMs, bots = all().filter(s => s.bot);
      for (let i = 0; i < n && R.phase === 'playing'; i++) {
        const at = stepEnd - (n - 1 - i) * DT * 1000;
        for (const s of bots) if (s.alive && R.phase === 'playing') botStep(s, at);   // bots act on the same 1/120 s steps
        if (R.phase === 'playing') { stepBullets(DT, at); checkWin(); }
      }
      for (const s of all()) if (s.alive) record(s);
      for (const s of all()) {
        if (!s.alive && !s.away && now - s.diedAt >= RULES.respawnMs && R.phase === 'playing') {
          if (R.cfg.mode === 'duelo') { const o = rival(s), om = o.p.ms; placeSeat(s, spawnPoint(s.id, { x: om.x, y: om.y, z: om.z })); }
          else placeSeat(s, spawnFor(s, enemiesOf(s).filter(o => o.alive), false));
          sendAll({ t: 'ev', m: R.match, e: [{ k: 'respawn', id: s.id, x: s.p.ms.x, z: s.p.ms.z, yaw: s.yaw }] });
        }
        // regeneration by the time between ticks (28-10-2026: by the time since the last message it healed 6–11 HP/s)
        if (s.alive && s.hp < RULES.hp && now - s.lastHit > RULES.regenDelayMs) s.hp = Math.min(RULES.hp, s.hp + RULES.regenPerSec * tickMs / 1000);
      }
      // the time is up: more kills wins, equal is a draw
      if (R.phase === 'playing' && R.cfg.time && R.playMs >= timeMs()) endMatch(leader(), 'tiempo');
    }
    if (R.phase === 'paused') {
      const H = humans(), gone = H.filter(s => s.conn == null);
      if (gone.length && now - R.pausedAt > RULES.reconnectMs) {
        if (R.cfg.mode !== 'duelo') endMatch(leader(), 'abandono');
        else if (gone.length === 2) { R.phase = 'over'; R.winner = null; save(); }
        else endMatch(rival(gone[0]).id, 'abandono');
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
      for (const s of humans()) if (s.conn == null && now - s.leftAt > RULES.lobbySeatMs) { R.seats[s.id] = null; sendAll(lobbyMsg()); save(); }
    }
    if ((R.phase === 'playing' || R.phase === 'countdown' || R.phase === 'paused') && now - R.lastSnap >= 1000 / RULES.snapHz) {
      R.lastSnap = now; for (const s of humans()) sendSnap(s);
    }
  }
  function checkWin() {
    if (!R.pendingWin || !R.pendingWin.length) return;
    const w = [...new Set(R.pendingWin)]; R.pendingWin = [];
    endMatch(w.length > 1 ? null : w[0], 'bajas');
  }
  function pubOpp(s) {
    if (!s) return null;
    const ms = s.p.ms, L = s.p.load;
    return { x: r3(ms.x), y: r3(ms.y), z: r3(ms.z), vx: r3(ms.vx), vz: r3(ms.vz), yaw: r4(s.yaw), pitch: r4(s.pitch), eye: r3(ms.eye),
      mode: ms.mode, g: ms.onGround ? 1 : 0, alive: s.alive ? 1 : 0, wpn: L.active, ks: L.knife.state, ads: r3(SDP.activeGun(s.p).ads), ws: SDP.activeGun(s.p).state, hp: Math.round(s.hp),
      name: s.name, on: s.bot || s.conn != null ? 1 : 0 };
  }
  function sendSnap(s) {
    if (s.conn == null) return;
    const others = all().filter(o => o !== s);
    // op: the rival (duelo; older pages read only this); ops: everyone else, with seat id, team and bot mark
    sendTo(s, { t: 'snap', m: R.match, k: R.tickN, ph: R.phase, ack: s.lastSeq, me: SDP.save(s.p), hp: Math.round(s.hp), alive: s.alive ? 1 : 0,
      op: pubOpp(others[0]), ops: others.map(o => Object.assign(pubOpp(o), { id: o.id, team: o.team || undefined, bot: o.bot ? 1 : undefined, away: o.away ? 1 : undefined })),
      sc: score(), tsc: teamMode() ? R.teamSc : undefined, now: R.now, tl: R.cfg.time ? Math.max(0, Math.round(timeMs() - R.playMs)) : undefined });
  }
  const r3 = v => Math.round(v * 1000) / 1000, r4 = v => Math.round(v * 1e4) / 1e4;

  // restore seats after the server object was evicted (names, tokens, score)
  function restore(d) {
    if (!d || !d.seats) return;
    for (const x of d.seats) if (x && SEATS.includes(x.id)) { const s = newSeat(x.id, x.name, x.token); s.kills = x.kills || 0; s.deaths = x.deaths || 0; if (x.kit === 'shotgun') s.kit = 'shotgun'; if (PR.SKINS.includes(x.skin)) s.skin = x.skin; if (TEAMS.includes(x.team)) s.team = x.team; s.leftAt = R.now; R.seats[x.id] = s; }
    R.match = d.match || 0;
    if (d.map && MAPS[d.map]) mapId = d.map;
    const c = d.cfg && cleanCfg(Object.assign({}, R.cfg, d.cfg)); if (c) R.cfg = c;
    R.phase = d.phase === 'over' ? 'over' : 'lobby'; // a match cut by a restart goes back to the lobby
  }
  function isIdle(now) { return R.conns.size === 0 && now - R.lastActive > 5 * 60000; }

  // test-only hooks (the real servers never pass debug: true)
  const debug = opts.debug ? {
    place(id, x, z, yaw) { const st = R.seats[id]; SDP.respawn(st.p, x, 0, st.p.ms ? z : z); st.p.ms.x = x; st.p.ms.z = z; st.yaw = yaw || 0; st.alive = true; st.hp = RULES.hp; },
    set(id, k, v) { R.seats[id][k] = v; },
    seat: id => R.seats[id], get index() { return ix; }, get mapId() { return mapId; }
  } : null;
  return Object.assign(R, { connect, disconnect, message, tick, restore, isIdle, RULES, debug });
}
const SDRoom = { create, RULES, SEATS, TEAMS, CFG_KILLS, CFG_TIME, CFG_MODE, CFG_BOTS, CFG_DIFF, CFG_SIZE };
if (isNode) module.exports = SDRoom; else root.SDRoom = SDRoom;
})(typeof window !== 'undefined' ? window : globalThis);
