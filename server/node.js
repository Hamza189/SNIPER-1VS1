/* SNIPER DUEL — multiplayer server for Node (local tests, or any Node host).
   The game rules live in core/room.js; this file only does HTTP, WebSockets and timers.
     POST /create        → { code }            creates a private room
     GET  /health        → { ok, rooms }
     WS   /room/<CODE>   → the room protocol (docs/PROTOCOLO.md)
   Env: PORT (default 8787), ALLOWED_ORIGINS (comma list; default GitHub Pages + localhost),
        MAX_ROOMS (default 200).
   Needs the "ws" package. Run: node server/node.js */
'use strict';
const http = require('http'), crypto = require('crypto');
let WebSocketServer;
try { ({ WebSocketServer } = require('ws')); } catch (e) { ({ WebSocketServer } = require('/opt/npm-tools/node_modules/ws')); }
const SDRoom = require('../core/room.js'), PR = require('../core/protocol.js'), MAP = require('../core/mapdata.js'), G = require('../core/geom.js');

function startServer(opts) {
  opts = opts || {};
  const origins = (opts.origins || process.env.ALLOWED_ORIGINS || 'https://hamza189.github.io,http://localhost,http://127.0.0.1').split(',').map(s => s.trim()).filter(Boolean);
  const maxRooms = opts.maxRooms || +process.env.MAX_ROOMS || 200;
  const indexes = {}; for (const id in MAP.maps) indexes[id] = G.createMapIndex(MAP.maps[id]);   // built once, shared by every room
  const rooms = new Map();
  const clock = opts.clock || (() => Date.now());
  const sockets = new Map(); let nextConn = 1;
  const okOrigin = o => !o || origins.some(a => o === a || o.startsWith(a + ':'));
  const cors = (req, res) => { const o = req.headers.origin; if (o && okOrigin(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); } };
  const createLimit = new Map();   // ip → [timestamps]  (no more than 10 rooms a minute per address)

  function makeRoom() {
    let code; do { code = PR.codeFrom(crypto.randomBytes(6)); } while (rooms.has(code));
    const room = SDRoom.create({ code, maps: MAP.maps, indexes, defaultMap: 'arena', now: clock(), debug: !!opts.debug,
      send: (c, t) => { const ws = sockets.get(c); if (ws && ws.readyState === 1) ws.send(t); },
      close: (c, code2, why) => { const ws = sockets.get(c); if (ws) try { ws.close(code2, why); } catch (e) {} },
      randBytes: n => crypto.randomBytes(n) });
    rooms.set(code, room);
    return room;
  }
  const server = http.createServer((req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'POST, GET'); res.setHeader('Access-Control-Allow-Headers', 'content-type'); res.writeHead(204); return res.end(); }
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, rooms: rooms.size, v: PR.VERSION })); }
    if (req.url === '/create' && req.method === 'POST') {
      if (!okOrigin(req.headers.origin)) { res.writeHead(403); return res.end(); }
      const ip = req.socket.remoteAddress, t = clock(), list = (createLimit.get(ip) || []).filter(x => t - x < 60000);
      if (list.length >= 10 || rooms.size >= maxRooms) { res.writeHead(429, { 'content-type': 'application/json' }); return res.end('{"error":"busy"}'); }
      list.push(t); createLimit.set(ip, list);
      const room = makeRoom();
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ code: room.code }));
    }
    res.writeHead(404); res.end();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: PR.LIMITS.maxBytes });
  server.on('upgrade', (req, sock, head) => {
    const m = /^\/room\/([A-Z0-9]{6})$/.exec(req.url || '');
    if (!m || !okOrigin(req.headers.origin)) { sock.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return sock.destroy(); }
    const room = rooms.get(m[1]);
    wss.handleUpgrade(req, sock, head, ws => {
      if (!room || room.closed) { ws.send(JSON.stringify({ t: 'error', code: 'no_room' })); return ws.close(4004, 'no_room'); }
      const id = nextConn++; sockets.set(id, ws);
      room.connect(id, clock());
      ws.on('message', (data, isBin) => room.message(id, isBin ? null : data.toString(), clock()));
      ws.on('close', () => { sockets.delete(id); room.disconnect(id, clock()); });
      ws.on('error', () => {});
    });
  });
  const timer = setInterval(() => {
    const t = clock();
    for (const [code, r] of rooms) { r.tick(t); if (r.isIdle(t)) { r.closed = true; rooms.delete(code); } }
  }, 1000 / 60);
  return new Promise(res => server.listen(opts.port === undefined ? (+process.env.PORT || 8787) : opts.port, opts.host || '0.0.0.0', () => res({
    port: server.address().port, rooms, close: () => new Promise(r => { clearInterval(timer); for (const ws of sockets.values()) ws.terminate(); wss.close(); server.close(() => r()); }) })));
}
module.exports = { startServer };
if (require.main === module) startServer().then(s => console.log('Sniper Duel server on :' + s.port));
