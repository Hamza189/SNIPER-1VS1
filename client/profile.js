/* SNIPER DUEL — perfil del jugador en este dispositivo (paso A de las cuentas, docs/CUENTAS-Y-MONETIZACION.md).
   Jugar nunca lo pide. Guarda un identificador, el apodo, el personaje, los objetos que tienes y tus estadísticas.
   Pasar el perfil a otro dispositivo: código de copia (exportCode / importCode) hasta que haya cuentas en la nube.
   Puro (sin DOM): load/save reciben el almacenamiento. Probado en test/profile.test.js. */
(function (root) {
'use strict';
const KEY = 'sniperduel_profile', V = 1;
const SKINS = ['swat', 'fsb', 'militar', 'clasico'];   // los cuatro son gratis (ver core/protocol.js SKINS)
const STATS = ['matches', 'wins', 'kills', 'deaths', 'hs', 'shots', 'hits', 'online', 'onlineWins'];
const ID_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin 0/O ni 1/I

function newId(rand) { rand = rand || Math.random; let s = 'SD-'; for (let i = 0; i < 8; i++) { if (i === 4) s += '-'; s += ID_ABC[Math.floor(rand() * ID_ABC.length) % ID_ABC.length]; } return s; }
function cleanName(n) { return typeof n === 'string' ? n.replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').trim().slice(0, 16) : ''; }
const int = (v, max) => { v = Math.floor(+v); return Number.isFinite(v) && v > 0 ? Math.min(v, max) : 0; };

function fresh(rand, now) {
  const stats = {}; for (const k of STATS) stats[k] = 0; stats.longest = 0;
  return { v: V, id: newId(rand), name: '', created: now || Date.now(), skin: 'swat', owned: SKINS.slice(), stats };
}
// whatever was stored (old version, edited by hand, half written): always a valid profile
function clean(p, rand) {
  const f = fresh(rand);
  if (!p || typeof p !== 'object') return f;
  const o = { v: V, id: typeof p.id === 'string' && /^SD-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(p.id) ? p.id : f.id, name: cleanName(p.name),
    created: int(p.created, 9e15) || f.created, stats: {} };
  // hoy los cuatro son gratis; los objetos de pago (paso D) los concederá y guardará el servidor, nunca este archivo
  o.owned = SKINS.slice();
  o.skin = o.owned.includes(p.skin) ? p.skin : 'swat';
  const st = p.stats || {};
  for (const k of STATS) o.stats[k] = int(st[k], 1e9);
  o.stats.longest = Math.min(2000, Math.max(0, Math.round(+st.longest || 0)));
  return o;
}
function load(storage, rand) {
  let p = null; try { p = JSON.parse(storage.getItem(KEY)); } catch (e) {}
  const o = clean(p, rand);
  if (!p) save(storage, o);
  return o;
}
function save(storage, p) { try { storage.setItem(KEY, JSON.stringify(p)); return true; } catch (e) { return false; } }

// una partida terminada (offline contra bots u online): r = { win, kills, deaths, hs, shots, hits, longest, online }
function addMatch(p, r) {
  const s = p.stats;
  s.matches++; if (r.win) s.wins++;
  if (r.online) { s.online++; if (r.win) s.onlineWins++; }
  for (const k of ['kills', 'deaths', 'hs', 'shots', 'hits']) s[k] = Math.min(1e9, s[k] + int(r[k], 1e6));
  s.longest = Math.max(s.longest, Math.min(2000, Math.round(+r.longest || 0)));
  return p;
}
const ratio = (a, b) => b ? Math.round(a / b * 100) / 100 : a;
function summary(p) {
  const s = p.stats;
  return { matches: s.matches, wins: s.wins, kd: ratio(s.kills, s.deaths), acc: s.shots ? Math.round(s.hits / s.shots * 100) : 0,
    hsPct: s.kills ? Math.round(s.hs / s.kills * 100) : 0, longest: s.longest };
}

// código de copia: el perfil en texto (base64url) con una suma de control para detectar un código mal copiado
function sum(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36).slice(0, 4); }
function b64e(t) { const b = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(t))) : Buffer.from(t, 'utf8').toString('base64'); return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64d(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; return typeof atob === 'function' ? decodeURIComponent(escape(atob(t))) : Buffer.from(t, 'base64').toString('utf8'); }
function exportCode(p) { const t = JSON.stringify(clean(p)); return 'SD1.' + b64e(t) + '.' + sum(t); }
function importCode(code) {
  try {
    const m = /^SD1\.([A-Za-z0-9_-]+)\.([a-z0-9]{1,4})$/.exec(String(code).trim()); if (!m) return null;
    const t = b64d(m[1]); if (sum(t) !== m[2]) return null;
    return clean(JSON.parse(t));
  } catch (e) { return null; }
}

const SDProfile = { KEY, SKINS, fresh, clean, load, save, addMatch, summary, exportCode, importCode, newId };
if (typeof module !== 'undefined' && module.exports) module.exports = SDProfile; else root.SDProfile = SDProfile;
})(typeof window !== 'undefined' ? window : globalThis);
