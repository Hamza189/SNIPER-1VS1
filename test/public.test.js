/* Stage D: checks a PUBLIC server (the Cloudflare deployment) with two real clients.
   Run: node test/public.test.js https://sniper-duel.<subdomain>.workers.dev
   Writes a short report to stdout and, with --json <file>, a machine-readable result. */
'use strict';
const SDNet = require('../client/netcore.js'), SDP = require('../core/player.js'), PR = require('../core/protocol.js');
const G = require('../core/geom.js'), MAP = require('../core/mapdata.js'), CFG = require('../core/config.js');
const INDEX = G.createMapIndex(MAP);
const base = (process.argv[2] || '').replace(/\/$/, '');
const jsonOut = process.argv.indexOf('--json') > 0 ? process.argv[process.argv.indexOf('--json') + 1] : null;
const results = []; let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); results.push({ n, ok: !!c, i: i === undefined ? null : String(i) }); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(cond, ms) { const end = Date.now() + (ms || 5000); while (Date.now() < end) { if (cond()) return true; await sleep(25); } return false; }
function client(code) {
  const local = SDP.create(0, 0, 0), c = { local, events: [], closed: null, ai: null };
  c.N = SDNet.create({ send: t => c.ws && c.ws.readyState === 1 && c.ws.send(t), now: () => Date.now(), world: INDEX.world, local });
  c.open = () => new Promise((res, rej) => { const ws = new WebSocket(base.replace(/^http/, 'ws') + '/room/' + code); c.ws = ws;
    ws.onopen = res; ws.onerror = rej; ws.onclose = e => { c.closed = e.code; }; ws.onmessage = e => { for (const v of c.N.onMessage(e.data)) c.events.push(v); }; });
  c.timer = setInterval(() => { const N = c.N; if (N.phase !== 'playing' || !N.alive || !c.ai) return;
    const cmd = PR.quantize(Object.assign({ mx: 0, mz: 0, yaw: 0, pitch: 0 }, c.ai(c))); SDP.step(c.local, cmd, 1 / 120, INDEX.world, CFG.move); N.queueCmd(cmd); }, 1000 / 120);
  c.ping = setInterval(() => c.N.ping(), 1000);
  c.stop = () => { clearInterval(c.timer); clearInterval(c.ping); try { c.ws.close(); } catch (e) {} };
  return c;
}
(async () => {
  console.log('\nSERVIDOR PÚBLICO ' + base);
  let A, B;
  try {
    const h = await (await fetch(base + '/health')).json();
    check('responde por HTTPS', h.ok === true, JSON.stringify(h));
    const r = await fetch(base + '/create', { method: 'POST', headers: { Origin: 'https://hamza189.github.io' } });
    const { code } = await r.json();
    check('crea una sala desde el origen del juego', PR.isCode(code) && r.headers.get('access-control-allow-origin') === 'https://hamza189.github.io', code);
    const evil = await fetch(base + '/create', { method: 'POST', headers: { Origin: 'https://evil.example' } });
    check('rechaza crear salas desde otra web', evil.status === 403);
    A = client(code); B = client(code);
    await A.open(); await B.open();
    check('dos conexiones WSS abiertas', A.ws.readyState === 1 && B.ws.readyState === 1);
    A.N.hello('Prueba A'); await waitFor(() => A.N.you); B.N.hello('Prueba B'); await waitFor(() => B.N.you);
    check('A y B en la sala', A.N.you === 'A' && B.N.you === 'B');
    A.N.ready(true); B.N.ready(true);
    check('la partida empieza (cuenta atrás de 3 s)', await waitFor(() => A.N.phase === 'playing' && B.N.phase === 'playing', 8000));
    A.ai = () => ({ mz: -1, yaw: 0.5 }); B.ai = () => ({ mx: 1, yaw: 2 });
    await sleep(3000);
    check('instantáneas del servidor a ~20 por segundo', A.N.snapRate >= 15, A.N.snapRate + '/s');
    check('B ve moverse a A', (() => { const p = B.N.remotePose(); return p && Math.abs(p.yaw - 0.5) < 0.01; })());
    check('predicción de A sin saltos grandes', A.N.corrMax < 0.05, A.N.corrMax.toFixed(4) + ' m');
    check('ping medido', A.N.rtt > 0 && A.N.rtt < 1000, Math.round(A.N.rtt) + ' ms');
    const tok = B.N.token; B.ws.close();
    await waitFor(() => A.N.phase === 'paused', 3000);
    check('si B se cae, pausa', A.N.phase === 'paused');
    await B.open(); B.N.hello('Prueba B', tok);
    check('B vuelve con su token y sigue la partida', await waitFor(() => A.N.phase === 'playing' && B.N.you === 'B', 5000));
    A.N.leave(); await sleep(300);
  } catch (e) { check('sin errores', false, e && (e.message || e)); }
  if (A) A.stop(); if (B) B.stop();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  if (jsonOut) require('fs').writeFileSync(jsonOut, JSON.stringify({ url: base, when: new Date().toISOString(), pass, fail, results }, null, 1) + '\n');
  process.exit(fail ? 1 : 0);
})();
