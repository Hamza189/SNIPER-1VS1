/* SNIPER DUEL — cuentas en la nube (docs/CUENTAS-Y-MONETIZACION.md, paso B y C). Las usan igual server/worker.js
   (Cloudflare: un Durable Object por cuenta y uno de «directorio») y server/node.js (pruebas, todo en memoria).
   Jugar nunca las pide.

   Sin contraseñas: passkeys (WebAuthn). El móvil o el PC guardan la llave privada (Face ID, huella o PIN) y aquí solo
   se guarda la pública; para entrar el servidor manda un reto y comprueba la firma. Las sesiones son fichas aleatorias
   de las que solo se guarda el resumen (SHA-256). El identificador de la cuenta (SD-XXXX-XXXX) es también el código de
   amigo: no es secreto.

   Rutas (POST con JSON; las marcadas con * piden «Authorization: Bearer <id>.<ficha>»):
     /cuenta/nueva {name, id?}            → {id, challenge}           crear: 1) pedir reto
     /cuenta/registrar {id, cred}         → {token, account}          crear: 2) la passkey nueva firmada
     /cuenta/entrar/reto                  → {challenge}               entrar: 1) pedir reto
     /cuenta/entrar {cred}                → {token, account}          entrar: 2) la firma (la cuenta sale de userHandle)
     /cuenta/yo *                         → {account}                 nombre, amigos, solicitudes, invitaciones
     /cuenta/nombre * {name}   /cuenta/salir *
     /cuenta/amigos/pedir * {id}   aceptar * {id}   rechazar * {id}   quitar * {id}   invitar * {id, sala}
     /cuenta/caja/abrir *  /cuenta/caja/diaria *  /cuenta/equipar * {slot, id}  /cuenta/partida * {won, secs}  (paso D)
   Inventario y cajas (paso D, docs/INVENTARIO-Y-CAJAS.md): lo que tienes lo guarda y lo concede el servidor. Las cajas
   son gratuitas (bienvenida, una al día y puntos por partidas); qué objetos hay y qué da cada partida: core/items.js.
   Las partidas online las premia el servidor de la sala (matchReward, al terminar); las de bots las cuenta el navegador
   (/cuenta/partida), con tope diario.
   Puro salvo WebCrypto (crypto.subtle, en Workers y en Node 18+). */
(function (root) {
'use strict';
const C = globalThis.crypto;   // WebCrypto: Workers y Node 19+ (sin módulos de Node: el Worker se empaqueta sin ellos)
const IT = typeof module !== 'undefined' && module.exports ? require('../core/items.js') : root.SDItems, PTS = IT.PTS;
const ID_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LIM = { name: 16, friends: 100, requests: 50, tokens: 8, tokenDays: 60, challengeMs: 5 * 60000, inviteMs: 15 * 60000, dirChallenges: 2000 };
const isId = s => typeof s === 'string' && /^SD-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(s);
const isSala = s => typeof s === 'string' && /^[A-Z0-9]{6}$/.test(s);
const cleanName = n => typeof n === 'string' ? n.replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').trim().slice(0, LIM.name) : '';
function rand(n) { return C.getRandomValues(new Uint8Array(n)); }
function newId() { const b = rand(8); let s = 'SD-'; for (let i = 0; i < 8; i++) { if (i === 4) s += '-'; s += ID_ABC[b[i] % 32]; } return s; }

// ---- base64url y bytes (sin Buffer: los Workers no lo tienen)
function b64u(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]*$/.test(str) || str.length > 8192) throw new Error('b64');
  let s = str.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u;
}
const utf8 = u8 => new TextDecoder().decode(u8);
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const cat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
async function sha256(u8) { return new Uint8Array(await C.subtle.digest('SHA-256', u8)); }
const hex = u8 => Array.from(u8, x => x.toString(16).padStart(2, '0')).join('');

// ---- CBOR (lo que usa WebAuthn: enteros, bytes, texto, listas y mapas)
function cbor(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let p = 0;
  function item(depth) {
    if (depth > 8 || p >= u8.length) throw new Error('cbor');
    const ib = u8[p++], mt = ib >> 5, ai = ib & 31; let n = ai;
    if (ai === 24) n = u8[p++]; else if (ai === 25) { n = dv.getUint16(p); p += 2; } else if (ai === 26) { n = dv.getUint32(p); p += 4; }
    else if (ai > 26) { if (mt === 7 && ai < 24) n = ai; else throw new Error('cbor'); }
    switch (mt) {
      case 0: return n;
      case 1: return -1 - n;
      case 2: { if (p + n > u8.length) throw new Error('cbor'); const b = u8.slice(p, p + n); p += n; return b; }
      case 3: { if (p + n > u8.length) throw new Error('cbor'); const s = utf8(u8.slice(p, p + n)); p += n; return s; }
      case 4: { if (n > 64) throw new Error('cbor'); const a = []; for (let i = 0; i < n; i++) a.push(item(depth + 1)); return a; }
      case 5: { if (n > 64) throw new Error('cbor'); const m = new Map(); for (let i = 0; i < n; i++) { const k = item(depth + 1); m.set(k, item(depth + 1)); } return m; }
      case 7: return ai === 20 ? false : ai === 21 ? true : null;
      default: throw new Error('cbor');
    }
  }
  const value = item(0); return { value, end: p };
}
// datos del autenticador: resumen del dominio, banderas, contador y (al crear) la llave nueva
function authData(u8) {
  if (!(u8 instanceof Uint8Array) || u8.length < 37) throw new Error('authData');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const o = { rpIdHash: u8.slice(0, 32), flags: u8[32], counter: dv.getUint32(33) };
  if (o.flags & 0x40) {
    const len = dv.getUint16(53); o.credId = u8.slice(55, 55 + len);
    o.cose = cbor(u8.slice(55 + len)).value;
  }
  return o;
}
function coseKey(m) {
  if (!(m instanceof Map)) throw new Error('cose');
  const kty = m.get(1), alg = m.get(3);
  if (kty === 2 && alg === -7 && m.get(-1) === 1) return { alg: -7, jwk: { kty: 'EC', crv: 'P-256', x: b64u(m.get(-2)), y: b64u(m.get(-3)) } };
  if (kty === 3 && alg === -257) return { alg: -257, jwk: { kty: 'RSA', n: b64u(m.get(-1)), e: b64u(m.get(-2)) } };
  throw new Error('alg');
}
// las firmas ECDSA de WebAuthn vienen en DER; WebCrypto quiere r‖s (32 + 32 bytes)
function derToRaw(sig) {
  let p = 0; if (sig[p++] !== 0x30) throw new Error('der'); p++; if (sig[p - 1] & 0x80) p += sig[p - 1] & 0x7f;
  const int = () => { if (sig[p++] !== 0x02) throw new Error('der'); const n = sig[p++]; let v = sig.slice(p, p + n); p += n; while (v.length > 32 && v[0] === 0) v = v.slice(1); if (v.length > 32) throw new Error('der'); const o = new Uint8Array(32); o.set(v, 32 - v.length); return o; };
  return cat(int(), int());
}
async function verifySig(cred, data, sig) {
  const ec = cred.alg === -7;
  const key = await C.subtle.importKey('jwk', cred.jwk, ec ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  return C.subtle.verify(ec ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5', key, ec ? derToRaw(sig) : sig, data);
}
// lo que firma el navegador: tipo, reto y página (que tiene que ser la del juego)
function clientData(b64, type, origins) {
  const raw = unb64u(b64), cd = JSON.parse(utf8(raw));
  if (cd.type !== type) throw new Error('type');
  if (!originOk(origins, cd.origin)) throw new Error('origin');
  return { raw, cd, rpId: new URL(cd.origin).hostname };
}
function originOk(origins, o) { return typeof o === 'string' && origins.some(a => o === a || o.startsWith(a + ':')); }
const err = (status, error) => ({ status, body: { error } });
// ---- inventario (dentro de la ficha de la cuenta; las cuentas de antes lo reciben la primera vez, con su caja de bienvenida)
const DAY = 86400000, dayOf = t => Math.floor(t / DAY);   // el día cambia a las 00:00 UTC (la 1:00 o las 2:00 en España)
function inv(a) {
  if (!a.inv) a.inv = { boxes: PTS.welcome, pts: 0, frag: 0, items: {}, equip: {}, daily: -1, day: { d: -1, bots: 0, online: 0 }, lastBots: 0, keys: [] };
  return a.inv;
}
function today(I, t) { const d = dayOf(t); if (I.day.d !== d) I.day = { d, bots: 0, online: 0 }; return I.day; }
// puntos → cajas (100 = una); con el máximo de cajas guardadas, los puntos esperan
function addPts(I, n) {
  I.pts += n; const nb = Math.min(Math.floor(I.pts / PTS.box), PTS.maxBoxes - I.boxes);
  if (nb > 0) { I.boxes += nb; I.pts -= nb * PTS.box; }
  if (I.boxes >= PTS.maxBoxes) I.pts = Math.min(I.pts, PTS.box - 1);
}
const titleOf = I => { const it = I.equip.titulo && IT.byId(I.equip.titulo); return it ? it.name : ''; };
const u01 = () => { const b = rand(4); return ((b[0] << 24 >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3]) / 4294967296; };
const ok = body => ({ status: 200, body });

// ---- una cuenta (su almacenamiento: {get, put, delete} asíncronos, como el de un Durable Object)
function account(store, opts) {
  const now = () => (opts.now ? opts.now() : Date.now()), origins = opts.origins;
  const pub = a => { const t = now(); return { id: a.id, name: a.name, created: a.created,
    friends: Object.entries(a.friends).map(([id, f]) => ({ id, name: f.name })),
    requests: Object.entries(a.requests).map(([id, r]) => ({ id, name: r.name })),
    invites: Object.entries(a.invites).filter(([, v]) => v.exp > t).map(([id, v]) => ({ id, name: v.name, sala: v.sala })),
    inv: pubInv(a, t) }; };
  const pubInv = (a, t) => { const I = inv(a), D = today(I, t);
    return { boxes: I.boxes, pts: I.pts, frag: I.frag, items: Object.keys(I.items), equip: Object.assign({}, I.equip), title: titleOf(I),
      daily: I.daily < dayOf(t), dailyIn: (dayOf(t) + 1) * DAY - t, botsLeft: Math.max(0, PTS.botsDay - D.bots), onlineLeft: Math.max(0, PTS.onlineDay - D.online) }; };
  async function issue(a) {
    const tok = b64u(rand(32)), h = hex(await sha256(new TextEncoder().encode(tok))), t = now();
    for (const k in a.tokens) if (a.tokens[k] < t) delete a.tokens[k];
    const keys = Object.keys(a.tokens).sort((x, y) => a.tokens[x] - a.tokens[y]);
    while (keys.length >= LIM.tokens) delete a.tokens[keys.shift()];
    a.tokens[h] = t + LIM.tokenDays * 86400000;
    return a.id + '.' + tok;
  }
  async function auth(token) {
    const a = await store.get('acc'); if (!a || typeof token !== 'string') return null;
    const tok = token.split('.')[1] || '', h = hex(await sha256(new TextEncoder().encode(tok)));
    return a.tokens[h] && a.tokens[h] > now() ? { a, h } : null;
  }
  return async function handle(action, body, token) {
    body = body || {};
    try {
      switch (action) {
        case 'nueva': {
          if (await store.get('acc')) return err(409, 'taken');
          const pending = { ch: b64u(rand(32)), name: cleanName(body.name) || 'JUGADOR', exp: now() + LIM.challengeMs, id: body.id };
          await store.put('pending', pending);
          return ok({ challenge: pending.ch });
        }
        case 'registrar': {
          const pending = await store.get('pending'), c = body.cred || {};
          if (!pending || pending.exp < now() || await store.get('acc')) return err(400, 'expired');
          const { cd, rpId } = clientData(c.clientDataJSON, 'webauthn.create', origins);
          if (cd.challenge !== pending.ch) return err(400, 'challenge');
          const att = cbor(unb64u(c.attestationObject)).value, ad = authData(att.get('authData'));
          if (!eq(ad.rpIdHash, await sha256(new TextEncoder().encode(rpId)))) return err(400, 'rp');
          if (!(ad.flags & 0x01) || !ad.credId) return err(400, 'flags');
          if (b64u(ad.credId) !== c.id) return err(400, 'cred');
          const k = coseKey(ad.cose);
          const a = { id: pending.id, name: pending.name, created: now(), creds: [{ id: c.id, alg: k.alg, jwk: k.jwk, counter: ad.counter }],
            friends: {}, requests: {}, invites: {}, tokens: {} };
          inv(a);   // con la caja de bienvenida
          const tokenOut = await issue(a);
          await store.put('acc', a); await store.delete('pending');
          return ok({ token: tokenOut, account: pub(a) });
        }
        case 'entrar': {
          const a = await store.get('acc'), c = body.cred || {};
          if (!a) return err(404, 'no_account');
          const cred = a.creds.find(x => x.id === c.id); if (!cred) return err(401, 'cred');
          const { raw, rpId } = clientData(c.clientDataJSON, 'webauthn.get', origins);
          const adRaw = unb64u(c.authenticatorData), ad = authData(adRaw);
          if (!eq(ad.rpIdHash, await sha256(new TextEncoder().encode(rpId)))) return err(401, 'rp');
          if (!(ad.flags & 0x01)) return err(401, 'flags');
          if (!await verifySig(cred, cat(adRaw, await sha256(raw)), unb64u(c.signature))) return err(401, 'signature');
          // contador: si la llave lo usa, tiene que subir (una copia clonada se delataría); las de iCloud/Google van en 0
          if ((ad.counter || cred.counter) && ad.counter <= cred.counter) return err(401, 'counter');
          cred.counter = ad.counter;
          const tokenOut = await issue(a); await store.put('acc', a);
          return ok({ token: tokenOut, account: pub(a) });
        }
        // llamadas internas (solo desde el Worker / el servidor, nunca expuestas tal cual)
        case 'peticion': {
          const a = await store.get('acc'); if (!a) return err(404, 'no_account');
          if (a.friends[body.from]) return ok({ already: true });
          if (Object.keys(a.requests).length >= LIM.requests && !a.requests[body.from]) return err(429, 'full');
          a.requests[body.from] = { name: cleanName(body.name), at: now() }; await store.put('acc', a); return ok({});
        }
        case 'amigo': {
          const a = await store.get('acc'); if (!a) return err(404, 'no_account');
          a.friends[body.from] = { name: cleanName(body.name), since: now() }; delete a.requests[body.from]; await store.put('acc', a); return ok({});
        }
        case 'quitado': {
          const a = await store.get('acc'); if (!a) return ok({});
          delete a.friends[body.from]; delete a.invites[body.from]; await store.put('acc', a); return ok({});
        }
        case 'invitacion': {
          const a = await store.get('acc'); if (!a || !a.friends[body.from]) return err(403, 'not_friends');
          a.invites[body.from] = { name: cleanName(body.name), sala: body.sala, exp: now() + LIM.inviteMs }; await store.put('acc', a); return ok({});
        }
        case 'existe': { const a = await store.get('acc'); return a ? ok({ id: a.id, name: a.name }) : err(404, 'no_account'); }
        case 'premio': {   // puntos de una partida online (matchReward); cada partida cuenta una sola vez
          const a = await store.get('acc'); if (!a) return err(404, 'no_account');
          const I = inv(a), D = today(I, now()), pts = Number.isInteger(body.pts) && body.pts > 0 && body.pts <= PTS.box ? body.pts : 0;
          if (typeof body.key !== 'string' || body.key.length > 40 || I.keys.includes(body.key)) return ok({ dup: true, pts: 0 });
          I.keys.push(body.key); if (I.keys.length > 40) I.keys.shift();
          // contra bots del servidor (una sola cuenta en la sala): el tope de los bots; si no, el online
          const bots = body.src === 'bots', give = Math.max(0, Math.min(pts, bots ? PTS.botsDay - D.bots : PTS.onlineDay - D.online));
          if (bots) D.bots += give; else D.online += give; addPts(I, give);
          await store.put('acc', a); return ok({ pts: give });
        }
      }
      // con sesión
      const s = await auth(token); if (!s) return err(401, 'session');
      const a = s.a;
      switch (action) {
        case 'yo': return ok({ account: pub(a) });
        case 'nombre': a.name = cleanName(body.name) || a.name; await store.put('acc', a); return ok({ account: pub(a) });
        case 'salir': delete a.tokens[s.h]; await store.put('acc', a); return ok({});
        case 'aceptar': if (!a.requests[body.id]) return err(404, 'no_request');
          if (Object.keys(a.friends).length >= LIM.friends) return err(429, 'full');
          a.friends[body.id] = { name: a.requests[body.id].name, since: now() }; delete a.requests[body.id]; await store.put('acc', a); return ok({ me: { id: a.id, name: a.name }, account: pub(a) });
        case 'rechazar': delete a.requests[body.id]; await store.put('acc', a); return ok({ account: pub(a) });
        case 'quitar': delete a.friends[body.id]; delete a.invites[body.id]; await store.put('acc', a); return ok({ me: { id: a.id }, account: pub(a) });
        case 'yo-interno': return ok({ me: { id: a.id, name: a.name, title: titleOf(inv(a)) }, friends: a.friends });
        case 'abrir': {
          const I = inv(a); if (I.boxes < 1) return err(409, 'no_boxes');
          const r = IT.roll(u01(), u01(), I.items); I.boxes--;
          if (r.item) I.items[r.item.id] = now(); else I.frag += r.frag;
          await store.put('acc', a); return ok({ item: r.item ? r.item.id : null, frag: r.frag || 0, account: pub(a) });
        }
        case 'diaria': {
          const I = inv(a), d = dayOf(now()); if (I.daily >= d) return err(409, 'daily_done');
          I.daily = d; I.boxes = Math.min(PTS.maxBoxes, I.boxes + PTS.daily); await store.put('acc', a); return ok({ account: pub(a) });
        }
        case 'equipar': {
          const I = inv(a); if (!IT.SLOTS[body.slot]) return err(400, 'slot');
          if (body.id == null || body.id === '') delete I.equip[body.slot];
          else { const it = IT.byId(body.id); if (!it || it.type !== body.slot) return err(400, 'item'); if (!I.items[it.id]) return err(403, 'not_owned'); I.equip[body.slot] = it.id; }
          await store.put('acc', a); return ok({ account: pub(a) });
        }
        case 'partida': {   // una partida contra bots, contada por el navegador: tope diario y un minuto entre partidas
          const I = inv(a), t = now(), D = today(I, t), secs = +body.secs;
          if (!(secs >= PTS.minBotSecs && secs < 4 * 3600)) return err(400, 'short');
          if (t - I.lastBots < PTS.botGapMs) return err(429, 'wait');
          const give = Math.max(0, Math.min(body.won ? PTS.botWin : PTS.botLoss, PTS.botsDay - D.bots)), b0 = I.boxes;
          I.lastBots = t; D.bots += give; addPts(I, give);
          await store.put('acc', a); return ok({ pts: give, boxes: I.boxes - b0, account: pub(a) });
        }
      }
      return err(404, 'action');
    } catch (e) { return err(400, 'bad'); }
  };
}

// ---- directorio: retos para entrar (aún no se sabe qué cuenta es)
function directory(store, opts) {
  const now = () => (opts.now ? opts.now() : Date.now());
  return async function handle(action, body) {
    const t = now(), list = (await store.get('ch')) || {};
    for (const k in list) if (list[k] < t) delete list[k];
    if (action === 'reto') {
      if (Object.keys(list).length >= LIM.dirChallenges) return err(429, 'busy');
      const ch = b64u(rand(32)); list[ch] = t + LIM.challengeMs; await store.put('ch', list); return ok({ challenge: ch });
    }
    if (action === 'consumir') {
      const ok_ = typeof body.ch === 'string' && list[body.ch] > t; delete list[body.ch]; await store.put('ch', list);
      return ok_ ? ok({}) : err(400, 'challenge');
    }
    return err(404, 'action');
  };
}

// ---- las rutas: igual en Cloudflare y en Node. deps.acc(id) → handler de esa cuenta; deps.dir → del directorio
async function api(path, body, authHeader, deps) {
  body = body && typeof body === 'object' ? body : {};
  const token = /^Bearer (SD-[A-Z2-9]{4}-[A-Z2-9]{4}\.[A-Za-z0-9_-]{20,64})$/.exec(authHeader || '');
  const meId = token ? token[1].split('.')[0] : null, tok = token ? token[1] : null;
  switch (path) {
    case '/cuenta/nueva': {
      for (let i = 0; i < 5; i++) {
        const id = i === 0 && isId(body.id) ? body.id : newId();
        const r = await deps.acc(id)('nueva', { name: body.name, id });
        if (r.status === 200) return ok({ id, challenge: r.body.challenge });
      }
      return err(503, 'busy');
    }
    case '/cuenta/registrar': return isId(body.id) ? deps.acc(body.id)('registrar', { cred: body.cred }) : err(400, 'id');
    case '/cuenta/entrar/reto': return deps.dir('reto', {});
    case '/cuenta/entrar': {
      const c = body.cred || {};
      let id, ch;
      try { id = utf8(unb64u(c.userHandle)); ch = JSON.parse(utf8(unb64u(c.clientDataJSON))).challenge; } catch (e) { return err(400, 'bad'); }
      if (!isId(id)) return err(400, 'id');
      const d = await deps.dir('consumir', { ch }); if (d.status !== 200) return d;
      return deps.acc(id)('entrar', { cred: c });
    }
  }
  if (!meId) return err(401, 'session');
  const me = deps.acc(meId);
  switch (path) {
    case '/cuenta/yo': return me('yo', {}, tok);
    case '/cuenta/nombre': return me('nombre', body, tok);
    case '/cuenta/salir': return me('salir', {}, tok);
    case '/cuenta/amigos/pedir': {
      if (!isId(body.id) || body.id === meId) return err(400, 'id');
      const s = await me('yo-interno', {}, tok); if (s.status !== 200) return s;
      if (s.body.friends[body.id]) return ok({ already: true });
      const r = await deps.acc(body.id)('peticion', { from: meId, name: s.body.me.name });
      return r.status === 200 ? ok({ sent: true }) : r;
    }
    case '/cuenta/amigos/aceptar': {
      if (!isId(body.id)) return err(400, 'id');
      const r = await me('aceptar', { id: body.id }, tok); if (r.status !== 200) return r;
      await deps.acc(body.id)('amigo', { from: meId, name: r.body.me.name });
      return ok({ account: r.body.account });
    }
    case '/cuenta/amigos/rechazar': return isId(body.id) ? me('rechazar', { id: body.id }, tok) : err(400, 'id');
    case '/cuenta/caja/abrir': return me('abrir', {}, tok);
    case '/cuenta/caja/diaria': return me('diaria', {}, tok);
    case '/cuenta/equipar': return me('equipar', { slot: body.slot, id: body.id }, tok);
    case '/cuenta/partida': return me('partida', { won: !!body.won, secs: body.secs }, tok);
    case '/cuenta/amigos/quitar': {
      if (!isId(body.id)) return err(400, 'id');
      const r = await me('quitar', { id: body.id }, tok); if (r.status !== 200) return r;
      await deps.acc(body.id)('quitado', { from: meId });
      return ok({ account: r.body.account });
    }
    case '/cuenta/amigos/invitar': {
      if (!isId(body.id) || !isSala(body.sala)) return err(400, 'id');
      const s = await me('yo-interno', {}, tok); if (s.status !== 200) return s;
      if (!s.body.friends[body.id]) return err(403, 'not_friends');
      return deps.acc(body.id)('invitacion', { from: meId, name: s.body.me.name, sala: body.sala });
    }
  }
  return err(404, 'not_found');
}

// ---- para el servidor de la sala (core/room.js: opts.account y opts.onOver), igual en Cloudflare y en Node
// la ficha que manda el jugador al entrar en la sala → su cuenta comprobada { id, title } o null
const TOKEN_RE = /^SD-[A-Z2-9]{4}-[A-Z2-9]{4}\.[A-Za-z0-9_-]{20,64}$/;
async function roomAccount(tok, acc) {
  if (typeof tok !== 'string' || !TOKEN_RE.test(tok)) return null;
  const r = await acc(tok.split('.')[0])('yo-interno', {}, tok);
  return r.status === 200 ? { id: r.body.me.id, title: r.body.me.title || '' } : null;
}
// fin de una partida online: puntos para cada cuenta, al menos un minuto jugado (sin contar pausas).
// - dos cuentas distintas o más: los puntos del online (ganar, empatar, perder; quien abandona no recibe nada);
// - una sola cuenta contra bots del servidor: los puntos de los bots, con su tope diario (lo cuenta el servidor);
// - una sola cuenta contra invitados sin cuenta: nada (dos pestañas de la misma persona no suman).
// info: { code, match, winner (plaza, equipo o null), why, ms, acc: { plaza: cuenta }, teams?: { plaza: equipo }, bots? }
async function matchReward(info, acc) {
  const ids = (info && info.acc) || {}, out = {};
  const seats = Object.keys(ids).filter(k => isId(ids[k])), distinct = new Set(seats.map(k => ids[k])).size;
  if (!(info.ms >= PTS.minOnlineMs) || !seats.length || (distinct < 2 && !(info.bots > 0))) return out;
  const online = distinct >= 2, won = seat => info.winner === seat || !!(info.teams && info.teams[seat] && info.winner === info.teams[seat]), seen = new Set();
  for (const seat of seats) {
    if (seen.has(ids[seat])) continue; seen.add(ids[seat]);
    let pts = 0;
    if (info.why === 'bajas' || info.why === 'tiempo') pts = info.winner == null ? (online ? PTS.onlineDraw : PTS.botLoss) : won(seat) ? (online ? PTS.onlineWin : PTS.botWin) : (online ? PTS.onlineLoss : PTS.botLoss);
    else if (info.why === 'abandono' && won(seat) && online) pts = PTS.abandonWin;
    if (!pts) continue;
    const r = await acc(ids[seat])('premio', { key: info.code + ':' + info.match + ':' + seat, pts, src: online ? 'online' : 'bots' });
    out[seat] = r.status === 200 ? r.body.pts : 0;
  }
  return out;
}

const SDAccounts = { account, directory, api, roomAccount, matchReward, isId, newId, cbor, authData, coseKey, derToRaw, b64u, unb64u, LIM, PTS };
if (typeof module !== 'undefined' && module.exports) module.exports = SDAccounts; else root.SDAccounts = SDAccounts;
})(typeof window !== 'undefined' ? window : globalThis);
