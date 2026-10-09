/* Stage D: the real Node server over real WebSockets, two independent clients.
   Run: node test/net.test.js */
'use strict';
const { startServer } = require('../server/node.js');
const SDNet = require('../client/netcore.js'), SDP = require('../core/player.js'), PR = require('../core/protocol.js');
const G = require('../core/geom.js'), MAP = require('../core/mapdata.js'), CFG = require('../core/config.js');
const INDEX = G.createMapIndex(MAP);
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function client(base, code, name) {
  const local = SDP.create(0, 0, 0);
  const c = { name, local, events: [], ai: null, closed: null };
  const open = () => new Promise((res, rej) => {
    const ws = new WebSocket(base.replace('http', 'ws') + '/room/' + code);
    c.ws = ws;
    ws.onopen = () => res();
    ws.onerror = e => rej(e);
    ws.onclose = e => { c.closed = e.code; };
    ws.onmessage = e => { for (const ev of c.N.onMessage(e.data)) c.events.push(ev); };
  });
  c.N = SDNet.create({ send: t => { if (c.ws && c.ws.readyState === 1) c.ws.send(t); }, now: () => Date.now(), world: INDEX.world, local });
  c.open = open;
  c.timer = setInterval(() => {   // the game loop: 120 Hz
    const N = c.N;
    if (N.phase !== 'playing' || !N.alive || !c.ai) return;
    const cmd = PR.quantize(Object.assign({ mx: 0, mz: 0, yaw: 0, pitch: 0 }, c.ai(c)));
    const r = SDP.step(c.local, cmd, 1 / 120, INDEX.world, CFG.move);
    for (const e of r.wev) if (e.type === 'fire') { const m = c.local.ms; cmd.fo = [m.x, m.y + m.eye, m.z]; cmd.fd = cmd.aimDir; }
    N.queueCmd(cmd);
  }, 1000 / 120);
  c.stop = () => { clearInterval(c.timer); try { c.ws.close(); } catch (e) {} };
  return c;
}
const evs = (c, k) => c.events.filter(e => e.k === k);
async function waitFor(cond, ms) { const end = Date.now() + (ms || 5000); while (Date.now() < end) { if (cond()) return true; await sleep(20); } return false; }

(async () => {
  const srv = await startServer({ port: 0, debug: true });
  const base = 'http://127.0.0.1:' + srv.port;
  try {
    console.log('\nSERVIDOR NODE REAL (WebSocket)');
    const h = await (await fetch(base + '/health')).json();
    check('el servidor responde /health', h.ok && h.v === 1);
    const { code } = await (await fetch(base + '/create', { method: 'POST' })).json();
    check('crear sala devuelve un código de 6', PR.isCode(code), code);
    const bad = await (await fetch(base + '/create', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status;
    check('otra web no puede crear salas (origen)', bad === 403);
    const A = client(base, code, 'Hamza'), B = client(base, code, 'Novia');
    await A.open(); await B.open();
    A.N.hello('Hamza'); await waitFor(() => A.N.you); B.N.hello('Novia'); await waitFor(() => B.N.you);
    check('dos clientes independientes en la misma sala', A.N.you === 'A' && B.N.you === 'B');
    const C = client(base, code, 'Tercero'); await C.open(); C.N.hello('Tercero');
    await waitFor(() => C.closed !== null);
    check('el tercero recibe "sala llena" y se cierra su conexión', evs(C, 'error').some(e => e.code === 'full') && C.closed === 4003, C.closed);
    const D = client(base, 'ZZZZZZ', 'X'); await D.open().catch(() => {});
    await waitFor(() => D.closed !== null);
    check('código inexistente: aviso y cierre', evs(D, 'error').some(e => e.code === 'no_room') && D.closed === 4004);
    A.N.ready(true); B.N.ready(true);
    check('empieza la partida en los dos', await waitFor(() => A.N.phase === 'playing' && B.N.phase === 'playing', 6000));
    // put them face to face on an open street and let A shoot B in the head
    const room = srv.rooms.get(code);
    room.debug.place('A', -46, -46, -Math.PI / 2); room.debug.place('B', -10, -46, Math.PI / 2);
    await sleep(500);
    let shoot = false;
    A.ai = c => { const s = room.seats.B.p.ms; const ms = c.local.ms, dx = s.x - ms.x, dy = s.y + 1.63 - (ms.y + ms.eye), dz = s.z - ms.z, d = Math.hypot(dx, dy, dz);
      return { yaw: Math.atan2(-dx, -dz), pitch: Math.asin(dy / d), aimDir: [dx / d, dy / d, dz / d], fire: shoot, adsHeld: true }; };
    B.ai = () => ({ yaw: Math.PI / 2 });
    await sleep(800); shoot = true; await sleep(30); shoot = false;
    check('A dispara a B por WebSocket real: headshot confirmado por el servidor', await waitFor(() => evs(A, 'kill').length === 1 && evs(B, 'kill').length === 1, 3000), evs(A, 'hit').map(e => e.part).join());
    check('marcador 1-0 en los dos', A.N.score.A === 1 && B.N.score.A === 1);
    check('ping medido', A.N.rtt >= 0 && A.N.rtt < 200, Math.round(A.N.rtt) + ' ms');
    // B's connection drops and comes back with its token
    const tok = B.N.token; B.ws.close(); await waitFor(() => A.N.phase === 'paused', 2000);
    check('B se desconecta: la partida se pausa', A.N.phase === 'paused');
    await B.open(); B.N.hello('Novia', tok);
    check('B reconecta con su token y la partida sigue', await waitFor(() => A.N.phase === 'playing' && B.N.you === 'B', 3000));
    check('al volver, B sigue con el marcador correcto', await waitFor(() => B.N.score.A === 1, 2000));
    A.stop(); B.stop(); C.stop(); D.stop();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
