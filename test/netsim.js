/* Test helper: a headless multiplayer client that uses the REAL client logic
   (client/netcore.js + the shared player tick) over a REAL WebSocket to the Node server,
   with optional artificial latency, jitter and message loss on its link. */
'use strict';
const SDNet = require('../client/netcore.js'), SDP = require('../core/player.js'), SDW = require('../core/weapon.js');
const CFG = require('../core/config.js'), MAP = require('../core/mapdata.js'), G = require('../core/geom.js');
const IX = G.createMapIndex(MAP);
const DT = 1 / 120;
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Sim {
  constructor(base, name, link) {
    this.base = base; this.name = name; this.link = Object.assign({ lat: 0, jitter: 0, loss: 0, dup: 0 }, link || {});
    this.local = SDP.create(0, 0, 0);
    this.events = []; this.msgs = []; this.closed = null; this.input = {}; this.yaw = 0; this.pitch = 0;
    this.shotsLocal = 0; this.lastUp = 0; this.lastDown = 0; this.running = false;
    this.N = SDNet.create({ send: t => this._up(t), now: () => Date.now(), world: IX.world, local: this.local });
  }
  // ordered delayed delivery, like TCP with latency
  _delay(dirKey) {
    const L = this.link, t = Date.now() + L.lat + Math.random() * L.jitter;
    const d = Math.max(this[dirKey] || 0, t); this[dirKey] = d; return d - Date.now();
  }
  _up(text) {
    if (!this.ws || this.ws.readyState !== 1) return;
    if (this.link.loss && text.startsWith('{"t":"in"') && Math.random() < this.link.loss) return;
    const n = this.link.dup && Math.random() < this.link.dup ? 2 : 1;
    for (let i = 0; i < n; i++) setTimeout(() => { if (this.ws && this.ws.readyState === 1) this.ws.send(text); }, this._delay('lastUp'));
  }
  open(code, token) {
    return new Promise((res) => {
      this.ws = new WebSocket(this.base.replace('http', 'ws') + 'room/' + code);
      this.ws.onopen = () => { this.N.hello(this.name, token); res(true); };
      this.ws.onmessage = e => setTimeout(() => this._down(e.data), this._delay('lastDown'));
      this.ws.onclose = e => { this.closed = { code: e.code, reason: e.reason }; };
      this.ws.onerror = () => res(false);
    });
  }
  _down(text) {
    this.msgs.push(text);
    for (const e of this.N.onMessage(text)) this.events.push(e);
  }
  drop() { this.ws.close(); }
  async waitFor(pred, ms, what) {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 3000)) { if (pred()) return true; await sleep(10); }
    throw new Error('timeout: ' + (what || 'condition'));
  }
  has(k, f) { return this.events.some(e => e.k === k && (!f || f(e))); }
  count(k, f) { return this.events.filter(e => e.k === k && (!f || f(e))).length; }
  // one simulation tick, exactly as the page does it
  tick() {
    const N = this.N;
    if (N.phase !== 'playing' || !N.alive) { this.input.fire = false; return; }
    const i = this.input;
    const cmd = { mx: i.mx || 0, mz: i.mz || 0, yaw: this.yaw, pitch: this.pitch, sprint: !!i.sprint, crouch: !!i.crouch,
      crouchPressed: !!i.crouchPressed, jump: !!i.jump, fire: !!i.fire, adsHeld: !!i.ads, reload: !!i.reload, select: i.select || null, inspect: false };
    i.crouchPressed = false; i.jump = false; i.fire = false; i.reload = false; i.select = null;
    const r = SDP.step(this.local, cmd, DT, IX.world, CFG.move);
    for (const e of r.wev) if (e.type === 'fire') {
      const ms = this.local.ms, o = [ms.x, ms.y + ms.eye, ms.z];
      cmd.fo = o; cmd.fd = this.fireDir ? this.fireDir() : aimDir(this.yaw, this.pitch);
      this.shotsLocal++;
    }
    N.queueCmd(cmd);
  }
  // look at a world point, compensating the bullet drop like a calibrated scope would
  lookAt(x, y, z) {
    const ms = this.local.ms, ex = ms.x, ey = ms.y + ms.eye, ez = ms.z;
    const dx = x - ex, dy = y - ey, dz = z - ez, h = Math.hypot(dx, dz);
    const tFlight = h / CFG.rifles.halcon.speed, drop = 0.5 * CFG.rifles.halcon.gravity * tFlight * tFlight;
    this.yaw = Math.atan2(-dx, -dz); this.pitch = Math.atan2(dy + drop, h);
  }
}
function aimDir(yaw, pitch) { const c = Math.cos(pitch); return [-Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c]; }
// both clients tick at 120 Hz in real time for ms milliseconds, running fn each tick
async function run(sims, ms, fn) {
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < ms) {
    const due = Math.floor((Date.now() - t0) / (1000 / 120));
    while (n < due) { if (fn) fn(n); for (const s of sims) s.tick(); n++; }
    for (const s of sims) if (Date.now() - (s._lp || 0) > 500) { s._lp = Date.now(); s.N.ping(); }
    await sleep(2);
  }
  for (const s of sims) s.N.flush();
}
async function createRoom(base) {
  const r = await fetch(base + 'create', { method: 'POST' }); return (await r.json()).code;
}
module.exports = { Sim, run, sleep, createRoom, IX, MAP, aimDir };
