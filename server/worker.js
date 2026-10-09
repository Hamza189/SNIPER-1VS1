/* SNIPER DUEL — multiplayer server on Cloudflare (Worker + one Durable Object per room).
   The rules are core/room.js, the same code the Node server and the tests run.
     POST /create → { code }    GET /health    WS /room/<CODE>
   Deployed by .github/workflows/deploy-server.yml (wrangler) with the repository secrets
   CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Config: wrangler.toml. */
import SDRoom from '../core/room.js';
import MAP from '../core/mapdata.js';
import G from '../core/geom.js';
import PR from '../core/protocol.js';

const json = (obj, status, extra) => new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json' }, extra || {}) });
function originOk(env, o) {
  if (!o) return true;
  const list = (env.ALLOWED_ORIGINS || 'https://hamza189.github.io').split(',').map(s => s.trim());
  return list.some(a => o === a || o.startsWith(a + ':'));
}
function cors(env, req) {
  const o = req.headers.get('Origin');
  return o && originOk(env, o) ? { 'Access-Control-Allow-Origin': o, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, GET', 'Access-Control-Allow-Headers': 'content-type' } : {};
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/health') return json({ ok: true, v: PR.VERSION, server: 'cloudflare' }, 200, h);
    if (url.pathname === '/create' && req.method === 'POST') {
      if (!originOk(env, req.headers.get('Origin'))) return json({ error: 'origin' }, 403, h);
      // no more than 10 rooms a minute from one address (Workers rate limiting binding)
      if (env.CREATE_LIMITER) { try { const ip = req.headers.get('CF-Connecting-IP') || 'x'; const { success } = await env.CREATE_LIMITER.limit({ key: ip }); if (!success) return json({ error: 'busy' }, 429, h); } catch (e) {} }
      for (let i = 0; i < 5; i++) {
        const code = PR.codeFrom(crypto.getRandomValues(new Uint8Array(6)));
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch('https://room/init?code=' + code, { method: 'POST' });
        if (r.status === 200) return json({ code }, 200, h);
      }
      return json({ error: 'busy' }, 503, h);
    }
    const m = /^\/room\/([A-Z0-9]{6})$/.exec(url.pathname);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'upgrade' }, 426, h);
      if (!originOk(env, req.headers.get('Origin'))) return json({ error: 'origin' }, 403, h);
      if (!PR.isCode(m[1])) return json({ error: 'no_room' }, 404, h);
      return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    }
    return json({ error: 'not_found' }, 404, h);
  }
};

let INDEX = null; // map index, built once per isolate
export class RoomDO {
  constructor(state, env) {
    this.state = state; this.env = env; this.room = null; this.socks = new Map(); this.next = 1; this.timer = null;
    this.state.blockConcurrencyWhile(async () => {
      this.created = !!(await this.state.storage.get('created'));
      this.code = (await this.state.storage.get('code')) || null;
      if (this.created) { this.makeRoom(); const saved = await this.state.storage.get('room'); if (saved) this.room.restore(saved); }
    });
  }
  makeRoom() {
    if (!INDEX) { INDEX = {}; for (const id in MAP.maps) INDEX[id] = G.createMapIndex(MAP.maps[id]); }
    this.room = SDRoom.create({ code: this.code, maps: MAP.maps, indexes: INDEX, defaultMap: 'arena', now: Date.now(),
      send: (c, t) => { const ws = this.socks.get(c); if (ws) try { ws.send(t); } catch (e) {} },
      close: (c, code, why) => { const ws = this.socks.get(c); if (ws) try { ws.close(code, why); } catch (e) {} },
      randBytes: n => crypto.getRandomValues(new Uint8Array(n)),
      persist: d => { this.state.storage.put('room', d); } });
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/init') {
      if (this.created) return json({ error: 'taken' }, 409);
      this.created = true; this.code = url.searchParams.get('code');
      await this.state.storage.put({ created: true, code: this.code, createdAt: Date.now() });
      this.makeRoom();
      await this.state.storage.setAlarm(Date.now() + 30 * 60000);   // forgotten rooms are cleaned up
      return json({ ok: true });
    }
    if (!this.created || !this.room) {
      const pair = new WebSocketPair(); pair[1].accept();
      pair[1].send(JSON.stringify({ t: 'error', code: 'no_room' })); pair[1].close(4004, 'no_room');
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    const pair = new WebSocketPair(), ws = pair[1], id = this.next++;
    ws.accept(); this.socks.set(id, ws);
    this.room.connect(id, Date.now());
    ws.addEventListener('message', e => this.room.message(id, typeof e.data === 'string' ? e.data : null, Date.now()));
    const gone = () => { if (!this.socks.has(id)) return; this.socks.delete(id); this.room.disconnect(id, Date.now()); };
    ws.addEventListener('close', gone); ws.addEventListener('error', gone);
    if (!this.timer) this.timer = setInterval(() => this.loop(), 1000 / 60);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  loop() {
    const t = Date.now(); this.room.tick(t);
    if (this.socks.size === 0 && this.room.phase !== 'playing') { clearInterval(this.timer); this.timer = null; }
  }
  async alarm() {
    // no one connected for a long time: forget the room (frees the code)
    if (this.socks.size === 0 && this.room && this.room.isIdle(Date.now())) { await this.state.storage.deleteAll(); this.created = false; this.room = null; return; }
    await this.state.storage.setAlarm(Date.now() + 30 * 60000);
  }
}
