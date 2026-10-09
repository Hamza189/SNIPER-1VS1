/* In-memory 1v1 for tests: the real room (core/room.js) and two real client brains
   (client/netcore.js + the shared player tick), joined by a fake network with latency,
   jitter, loss, duplicates and reordering, on a simulated clock (fast and repeatable). */
'use strict';
const SDRoom = require('../core/room.js'), SDNet = require('../client/netcore.js'), SDP = require('../core/player.js');
const PR = require('../core/protocol.js'), MAP = require('../core/mapdata.js'), G = require('../core/geom.js'), CFG = require('../core/config.js');
const INDEX = G.createMapIndex(MAP);
const IXS = { pueblo: INDEX }; for (const id in MAP.maps) if (!IXS[id]) IXS[id] = G.createMapIndex(MAP.maps[id]);
const DT = 1 / 120;

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function createSim(o) {
  o = Object.assign({ latency: 20, jitter: 0, loss: 0, dup: 0, reorder: 0, seed: 7 }, o || {});
  const R = rng(o.seed);
  const S = { t: 0, q: [], clients: {}, log: [] };
  const delay = () => Math.max(0, o.latency + (R() * 2 - 1) * o.jitter);
  // a message on the fake wire; TCP keeps order, so by default later messages never overtake
  const lastAt = {};
  function wire(key, deliver, text) {
    if (o.drop && key[0] === 'c' && R() < o.drop) return;          // a lost command batch (only to test robustness)
    let at = S.t + delay();
    if (o.loss && R() < o.loss) at += 200 + R() * 200;            // TCP: a lost packet is resent → a delay spike
    if (!(o.reorder && R() < o.reorder)) at = Math.max(at, lastAt[key] || 0);
    lastAt[key] = Math.max(lastAt[key] || 0, at);
    S.q.push({ at, deliver, text });
    if (o.dup && R() < o.dup) S.q.push({ at: at + 1, deliver, text });
  }
  const room = SDRoom.create(Object.assign(o.maps ? { maps: MAP.maps, defaultMap: o.maps } : { map: MAP, index: INDEX }, { code: 'TESTAA', now: 0, debug: true, rand: rng(o.seed + 1),
    send: (conn, text) => { const c = S.byConn[conn]; if (c && c.open) wire('s' + conn, () => c.recv(text), text); },
    close: (conn) => { const c = S.byConn[conn]; if (c) c.open = false; } }));
  S.room = room; S.byConn = {};
  let nextConn = 1;
  S.addClient = (name, ai) => {
    const local = SDP.create(0, 0, 0);
    // the client's world follows the room's map (swapped when a match starts), like the page
    const c = { name, local, ai: ai || null, open: true, conn: nextConn++, events: [], fireLog: [], world: { colliders: INDEX.world.colliders, ramps: INDEX.world.ramps } };
    c.N = SDNet.create({ send: text => { if (c.open) wire('c' + c.conn, () => c.open && room.message(c.conn, text, S.t), text); }, now: () => S.t, world: c.world, local });
    c.recv = text => { for (const e of c.N.onMessage(text)) { if (e.k === 'start' && e.m.map) { const w = (IXS[e.m.map] || INDEX).world; c.world.colliders = w.colliders; c.world.ramps = w.ramps; } c.events.push(e); if (e.k === 'start' || e.k === 'respawn' && e.id === c.N.you) {} } };
    S.byConn[c.conn] = c; room.connect(c.conn, S.t);
    S.clients[name] = c;
    return c;
  };
  S.reconnect = c => { // same client, new socket (as after a network change), hello with token
    room.disconnect(c.conn, S.t); delete S.byConn[c.conn];
    c.conn = nextConn++; c.open = true; S.byConn[c.conn] = c; room.connect(c.conn, S.t);
    c.N.hello(c.name, c.N.token);
  };
  S.drop = c => { c.open = false; room.disconnect(c.conn, S.t); delete S.byConn[c.conn]; };
  // one simulated client tick: build the command (AI), predict, send — like the page does
  function clientTick(c) {
    const N = c.N;
    if (N.phase !== 'playing' || !N.alive || !c.ai) return;
    const cmd = PR.quantize(Object.assign({ mx: 0, mz: 0, yaw: 0, pitch: 0 }, c.ai(c, S)));
    const r = SDP.step(c.local, cmd, DT, c.world, CFG.move);
    for (const e of [...r.wev, ...(r.pev || []), ...(r.sev || [])]) if (e.type === 'fire') {
      const ms = c.local.ms, eye = [ms.x, ms.y + ms.eye, ms.z];
      const cp = Math.cos(cmd.pitch);
      cmd.fd = cmd.aimDir || [-Math.sin(cmd.yaw) * cp, Math.sin(cmd.pitch), -Math.cos(cmd.yaw) * cp]; cmd.fo = eye; cmd.ft = c.N.serverNow() - c.N.interpMs;   // the rival pose on screen (as the page sends it)
      c.fireLog.push({ t: S.t, eye, d: cmd.fd });
    }
    N.queueCmd(cmd);
  }
  S.run = ms => {
    const end = S.t + ms;
    while (S.t < end) {
      S.t += DT * 1000;
      S.q.sort((a, b) => a.at - b.at);
      while (S.q.length && S.q[0].at <= S.t) S.q.shift().deliver();
      for (const k in S.clients) clientTick(S.clients[k]);
      // the server ticks at ~60 Hz
      if (Math.floor(S.t / (1000 / 60)) !== Math.floor((S.t - DT * 1000) / (1000 / 60))) room.tick(S.t);
      for (const k in S.clients) { const c = S.clients[k]; if (S.t - c.N.lastPing > 1000) c.N.ping(); }
    }
  };
  S.until = (cond, maxMs) => { const end = S.t + (maxMs || 10000); while (S.t < end) { S.run(10); if (cond()) return true; } return false; };
  // two players in a started match
  S.setupMatch = (aiA, aiB) => {
    const A = S.addClient('Hamza', aiA), B = S.addClient('Novia', aiB);
    A.N.hello('Hamza'); S.run(Math.max(100, 3 * (o.latency + o.jitter))); B.N.hello('Novia'); S.run(200);
    A.N.ready(true); B.N.ready(true);
    S.until(() => A.N.phase === 'playing' && B.N.phase === 'playing', 6000);
    return { A, B };
  };
  return S;
}
// command that looks from c's eye straight at point p
function lookAt(c, p) {
  const ms = c.local.ms, dx = p[0] - ms.x, dy = p[1] - (ms.y + ms.eye), dz = p[2] - ms.z, d = Math.hypot(dx, dy, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / d), aimDir: [dx / d, dy / d, dz / d] };
}
module.exports = { createSim, lookAt, INDEX, MAP, rng };
