/* SNIPER DUEL — multiplayer protocol v1 (JSON over WebSocket). Shared by browser and server.
   Full description: docs/PROTOCOLO.md. Every message received is checked here before use.

   Client → server
     hello   { t, v, name, token? }          first message; token = reconnect to my seat
     ready   { t, on }                       lobby: I am ready / not ready
     in      { t, m, s, c:[cmd...] }         commands of match m, first sequence number s
     rematch { t }                           after the end: play again
     ping    { t, c }                        c = client clock (ms)
     leave   { t }
   Server → client
     welcome { t, you, token, code, ... }    lobby { t, phase, players }
     start   { t, m, at, spawn, rules }      snap  { t, m, k, ack, me, op, sc }
     ev      { t, m, e:[...] }               pong  { t, c, s }        error { t, code } */
(function (root) {
'use strict';
const VERSION = 1;
const LIMITS = {
  maxBytes: 4096,          // a bigger message is dropped
  maxMsgPerSec: 90,        // per connection; more is dropped, far more closes the socket
  maxCmdsPerMsg: 24,
  nameLen: 16,
  cmdBurst: 60,            // commands the server accepts ahead of real time (0.5 s at 120 Hz)
  tickHz: 120              // one command = one simulation tick of 1/120 s (same as the client)
};
// command bits
const B = { sprint: 1, crouch: 2, crouchPressed: 4, jump: 8, fire: 16, adsHeld: 32, reload: 64, inspect: 128, selKnife: 256, selRifle: 512, breath: 1024 };

// the values the server will see: the client must simulate with exactly these (prediction = server)
function quantize(c) {
  const r = (x, n) => Math.round((x || 0) * n) / n;
  c.mx = r(Math.max(-1, Math.min(1, c.mx || 0)), 1000); c.mz = r(Math.max(-1, Math.min(1, c.mz || 0)), 1000);
  c.yaw = r(c.yaw, 1e5); c.pitch = r(Math.max(-1.45, Math.min(1.45, c.pitch || 0)), 1e5);
  return c;
}
// game command (as the client tick uses it) → compact array
function packCmd(c) {
  let b = 0;
  for (const k of ['sprint', 'crouch', 'crouchPressed', 'jump', 'fire', 'adsHeld', 'reload', 'inspect', 'breath']) if (c[k]) b |= B[k];
  if (c.select === 'knife') b |= B.selKnife; else if (c.select === 'rifle') b |= B.selRifle;
  const r = (x, n) => Math.round(x * n) / n;
  const a = [r(c.mx || 0, 1000), r(c.mz || 0, 1000), r(c.yaw || 0, 1e5), r(c.pitch || 0, 1e5), b];
  if (c.fd && c.fo) a.push(r(c.fd[0], 1e5), r(c.fd[1], 1e5), r(c.fd[2], 1e5), r(c.fo[0], 1000), r(c.fo[1], 1000), r(c.fo[2], 1000));
  return a;
}
const num = (x, lo, hi) => typeof x === 'number' && isFinite(x) && x >= lo && x <= hi;
// compact array → command, or null if malformed
function unpackCmd(a) {
  if (!Array.isArray(a) || (a.length !== 5 && a.length !== 11)) return null;
  if (!num(a[0], -1.5, 1.5) || !num(a[1], -1.5, 1.5) || !num(a[2], -1e6, 1e6) || !num(a[3], -1.6, 1.6) || !num(a[4], 0, 4095) || (a[4] | 0) !== a[4]) return null;
  const b = a[4];
  const c = { mx: Math.max(-1, Math.min(1, a[0])), mz: Math.max(-1, Math.min(1, a[1])), yaw: a[2], pitch: a[3],
    sprint: !!(b & B.sprint), crouch: !!(b & B.crouch), crouchPressed: !!(b & B.crouchPressed), jump: !!(b & B.jump),
    fire: !!(b & B.fire), adsHeld: !!(b & B.adsHeld), reload: !!(b & B.reload), inspect: !!(b & B.inspect), breath: !!(b & B.breath),
    select: b & B.selKnife ? 'knife' : b & B.selRifle ? 'rifle' : null };
  if (a.length === 11) {
    for (let i = 5; i < 8; i++) if (!num(a[i], -1.01, 1.01)) return null;
    for (let i = 8; i < 11; i++) if (!num(a[i], -1e4, 1e4)) return null;
    c.fd = [a[5], a[6], a[7]]; c.fo = [a[8], a[9], a[10]];
  }
  return c;
}
function cleanName(n) {
  if (typeof n !== 'string') return '';
  return n.replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').trim().slice(0, LIMITS.nameLen);
}
// text → message object, or { error } (never throws)
function parse(text) {
  if (typeof text !== 'string') return { error: 'binary' };
  if (text.length > LIMITS.maxBytes) return { error: 'too_big' };
  let m; try { m = JSON.parse(text); } catch (e) { return { error: 'json' }; }
  if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'string') return { error: 'shape' };
  switch (m.t) {
    case 'hello':
      if (m.v !== VERSION) return { error: 'version' };
      if (m.token !== undefined && (typeof m.token !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(m.token))) return { error: 'token' };
      return { msg: { t: 'hello', name: cleanName(m.name), token: m.token || null } };
    case 'ready': return { msg: { t: 'ready', on: !!m.on } };
    case 'in': {
      if (!Number.isInteger(m.m) || m.m < 0 || !Number.isInteger(m.s) || m.s < 0 || m.s > 1e12 || !Array.isArray(m.c)) return { error: 'shape' };
      if (m.c.length === 0 || m.c.length > LIMITS.maxCmdsPerMsg) return { error: 'count' };
      const c = []; for (const a of m.c) { const x = unpackCmd(a); if (!x) return { error: 'cmd' }; c.push(x); }
      return { msg: { t: 'in', m: m.m, s: m.s, c } };
    }
    case 'rematch': return { msg: { t: 'rematch' } };
    case 'ping': return num(m.c, 0, 1e15) ? { msg: { t: 'ping', c: m.c } } : { error: 'shape' };
    case 'leave': return { msg: { t: 'leave' } };
    default: return { error: 'type' };
  }
}
// room codes: 6 characters without look-alikes (no 0/O, 1/I/L)
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function isCode(s) { return typeof s === 'string' && s.length === 6 && [...s].every(ch => CODE_ALPHABET.includes(ch)); }
// bytes (from crypto.getRandomValues) → code / token
function codeFrom(bytes) { let s = ''; for (let i = 0; i < 6; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]; return s; }
function tokenFrom(bytes) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let s = ''; for (const b of bytes) s += A[b & 63]; return s; }

const SDProto = { VERSION, LIMITS, B, quantize, packCmd, unpackCmd, parse, cleanName, CODE_ALPHABET, isCode, codeFrom, tokenFrom };
if (typeof module !== 'undefined' && module.exports) module.exports = SDProto; else root.SDProto = SDProto;
})(typeof window !== 'undefined' ? window : globalThis);
