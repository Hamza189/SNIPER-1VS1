/* SNIPER DUEL — multiplayer client logic without DOM or sockets (the page and the tests
   both use it, so the tests exercise the real thing).
   - commands: every simulation tick the game hands its command; it gets a sequence number,
     is kept until the server confirms it, and goes out in small batches.
   - prediction + reconciliation: the local player moves at once; when a snapshot arrives the
     state confirmed by the server is restored and the commands it has not seen yet are
     replayed (same shared tick as the server), so normally nothing visible changes.
   - rival: snapshots are buffered and drawn ~100 ms in the past, interpolated.
   - clock: ping/pong gives the round trip and the server clock offset. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const PR = isNode ? require('../core/protocol.js') : root.SDProto;
const SDP = isNode ? require('../core/player.js') : root.SDPlayer;
const CFG = isNode ? require('../core/config.js') : root.SD_CONFIG;
const DT = 1 / PR.LIMITS.tickHz;

function create(opts) {
  const N = {
    send: opts.send, now: opts.now, world: opts.world, local: opts.local,   // local = { ms, w, load } of the game
    you: null, token: null, code: null, phase: 'none', match: 0, names: {}, players: [],
    seq: 0, pending: [], outBuf: [], sendEvery: opts.sendEvery || 3, ticksSinceSend: 0,
    remote: [], interpMs: opts.interpMs || PR.LIMITS.interpMs, offset: 0, rtt: 0, rtts: [], lastPing: -1e9,
    snapCount: 0, snapRate: 0, snapWin: 0, lastAck: -1, corr: 0, corrMax: 0, lastSnapAt: 0,
    lastEvQ: 0, hp: 100, alive: true, score: { A: 0, B: 0 }, startIn: 0, startedAt: 0, events: [], lastShot: null, lastReject: null, seenShots: new Set()
  };
  function out(obj) { N.send(JSON.stringify(obj)); }
  N.hello = (name, token) => out({ t: 'hello', v: PR.VERSION, name, token: token || undefined });
  N.ready = on => out({ t: 'ready', on: !!on });
  N.rematch = () => out({ t: 'rematch' });
  N.chooseMap = id => out({ t: 'map', id });
  N.leave = () => out({ t: 'leave' });
  N.ping = () => { N.lastPing = N.now(); out({ t: 'ping', c: N.now(), r: N.rtts.length ? Math.round(N.rtt) : undefined }); };
  N.serverNow = () => N.now() + N.offset;

  // the game ran one tick with this command (call it before/after stepping, same tick)
  N.queueCmd = cmd => {
    const seq = N.seq++;
    N.pending.push({ seq, cmd });
    if (N.pending.length > 600) N.pending.shift();               // never grows without bound
    N.outBuf.push(PR.packCmd(cmd));
    if (++N.ticksSinceSend >= N.sendEvery || cmd.fire) N.flush();
    return seq;
  };
  N.flush = () => {
    if (!N.outBuf.length) return;
    let s = N.seq - N.outBuf.length;
    while (N.outBuf.length) { const c = N.outBuf.splice(0, PR.LIMITS.maxCmdsPerMsg); out({ t: 'in', m: N.match, s, c }); s += c.length; }
    N.ticksSinceSend = 0;
  };

  function reconcile(snap) {
    if (snap.ack < N.lastAck) return;                             // older than what we have: ignore
    N.lastAck = snap.ack;
    // where we predicted ourselves to be after the acknowledged command
    const before = { x: N.local.ms.x, y: N.local.ms.y, z: N.local.ms.z };
    SDP.restore(N.local, snap.me);
    N.pending = N.pending.filter(p => p.seq > snap.ack);
    for (const p of N.pending) SDP.step(N.local, p.cmd, DT, N.world, CFG.move);  // silent replay
    const e = Math.hypot(N.local.ms.x - before.x, N.local.ms.y - before.y, N.local.ms.z - before.z);
    N.corr = e; if (e > N.corrMax) N.corrMax = e;
    return e;
  }

  // rival snapshot buffer (server time in ms)
  function pushRemote(op, t) {
    if (!op) return;
    if (N.remote.length && t <= N.remote[N.remote.length - 1].t) return;   // out of order: dropped
    N.remote.push({ t, op });
    while (N.remote.length > 40) N.remote.shift();
  }
  const lerpAng = (a, b, f) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; };
  // rival pose to draw now
  N.remotePose = () => {
    const B = N.remote; if (!B.length) return null;
    const t = N.serverNow() - N.interpMs;
    if (t <= B[0].t) return Object.assign({}, B[0].op);
    for (let i = B.length - 1; i > 0; i--) {
      const a = B[i - 1], b = B[i];
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / Math.max(1, b.t - a.t), A = a.op, Bo = b.op;
        // a respawn (big jump) is not interpolated: it snaps
        if (Math.hypot(Bo.x - A.x, Bo.z - A.z) > 6) return Object.assign({}, f < 0.5 ? A : Bo);
        return Object.assign({}, Bo, { x: A.x + (Bo.x - A.x) * f, y: A.y + (Bo.y - A.y) * f, z: A.z + (Bo.z - A.z) * f,
          eye: A.eye + (Bo.eye - A.eye) * f, yaw: lerpAng(A.yaw, Bo.yaw, f), pitch: A.pitch + (Bo.pitch - A.pitch) * f, ads: A.ads + (Bo.ads - A.ads) * f });
      }
    }
    // newer than the last snapshot: hold the last one (no guessing for more than a moment)
    const L = B[B.length - 1];
    const ex = Math.min(0.1, (t - L.t) / 1000);
    return Object.assign({}, L.op, { x: L.op.x + L.op.vx * ex, z: L.op.z + L.op.vz * ex });
  };

  // a text frame from the server → list of game events for the page
  N.onMessage = text => {
    let m; try { m = JSON.parse(text); } catch (e) { return [{ k: 'error', code: 'json' }]; }
    const ev = [];
    switch (m.t) {
      case 'welcome': N.you = m.you; N.token = m.token; N.code = m.code; N.phase = m.phase; N.players = m.players; N.match = m.match; ev.push({ k: 'welcome', m }); break;
      case 'lobby': N.phase = m.phase; N.players = m.players; if (m.map) N.map = m.map; if (m.maps) N.maps = m.maps; ev.push({ k: 'lobby', m }); break;
      case 'start':
        N.match = m.m; if (m.map) N.map = m.map; N.names = m.names || {}; N.phase = 'countdown'; N.startIn = m.in; N.startedAt = N.now();
        if (!m.resume) { N.pending = []; N.outBuf = []; N.lastAck = -1; N.remote = []; N.score = { A: 0, B: 0 }; N.seenShots.clear(); N.corrMax = 0;
          SDP.respawn(N.local, m.spawn.x, 0, m.spawn.z); }   // same spawn as the server: no correction on the first snapshot
        else { N.lastAck = m.lastSeq; N.pending = N.pending.filter(p => p.seq > m.lastSeq); }
        N.alive = true; N.hp = 100;
        ev.push({ k: 'start', m }); break;
      case 'snap': {
        if (m.m !== N.match) break;
        N.snapCount++; const now = N.now(); if (now - N.snapWin >= 1000) { N.snapRate = N.snapCount; N.snapCount = 0; N.snapWin = now; }
        N.lastSnapAt = now;
        if (m.ph === 'playing' && N.phase === 'countdown') N.phase = 'playing';
        if (m.ph === 'paused') N.phase = 'paused'; else if (m.ph === 'playing') N.phase = 'playing';
        const wasAlive = N.alive;
        N.hp = m.hp; N.alive = !!m.alive; N.score = m.sc;
        reconcile(m);
        pushRemote(m.op, m.now);
        if (wasAlive !== N.alive) ev.push({ k: N.alive ? 'alive' : 'dead' });
        ev.push({ k: 'snap', m }); break;
      }
      case 'ev':
        if (m.m !== N.match) break;
        if (typeof m.q === 'number') { if (m.q <= N.lastEvQ) break; N.lastEvQ = m.q; }   // a repeated event is never applied twice
        for (const e of m.e) {
          if (e.k === 'shot') { if (N.seenShots.has(e.id)) continue; N.seenShots.add(e.id); if (N.seenShots.size > 500) N.seenShots.clear(); N.lastShot = e; }
          if (e.k === 'go') N.phase = 'playing';
          if (e.k === 'pause') N.phase = 'paused';
          if (e.k === 'resume') N.phase = 'playing';
          if (e.k === 'rejected') N.lastReject = e;
          if (e.k === 'kill' || e.k === 'over') N.score = e.sc || N.score;
          if (e.k === 'over') N.phase = 'over';
          if (e.k === 'hit' && e.to === N.you) N.hp = e.hp;
          if (e.k === 'kill' && e.to === N.you) N.alive = false;
          if (e.k === 'respawn' && e.id === N.you) { N.alive = true; N.hp = 100; N.pending = []; SDP.respawn(N.local, e.x, 0, e.z); }
          ev.push(e);
        }
        break;
      case 'pong': {
        const now = N.now(), rtt = now - m.c;
        N.rtts.push(rtt); if (N.rtts.length > 8) N.rtts.shift();
        N.rtt = N.rtts.slice().sort((a, b) => a - b)[N.rtts.length >> 1];
        const off = m.s + rtt / 2 - now;
        N.offset = N.rtts.length === 1 ? off : N.offset + (off - N.offset) * 0.25;
        ev.push({ k: 'pong', rtt: N.rtt }); break;
      }
      case 'error': ev.push({ k: 'error', code: m.code, why: m.why }); break;
    }
    return ev;
  };
  N.reconcile = reconcile;
  return N;
}
const SDNet = { create };
if (isNode) module.exports = SDNet; else root.SDNet = SDNet;
})(typeof window !== 'undefined' ? window : globalThis);
