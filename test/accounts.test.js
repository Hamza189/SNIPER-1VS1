/* Cuentas (server/accounts.js) con passkeys sintéticas: una llave P-256 de WebCrypto hace de autenticador.
   Crear, entrar, rechazos (firma falsa, otra web, reto repetido o caducado, contador hacia atrás, sesión cerrada),
   amigos (pedir, aceptar, quitar) e invitación a sala.   Run: node test/accounts.test.js */
'use strict';
const A = require('../server/accounts.js');
const C = globalThis.crypto;
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const ORIGIN = 'http://localhost:8123', RP = 'localhost';
let T = 1e12; const now = () => T;
function memStore() { const m = new Map(); return { get: async k => (m.has(k) ? JSON.parse(m.get(k)) : undefined), put: async (k, v) => { m.set(k, JSON.stringify(v)); }, delete: async k => { m.delete(k); } }; }
const stores = new Map(), dir = memStore(), opts = { origins: [ORIGIN], now };
const deps = { acc: id => { if (!stores.has(id)) stores.set(id, memStore()); return A.account(stores.get(id), opts); }, dir: A.directory(dir, opts) };
const api = (p, b, tok) => A.api(p, b, tok ? 'Bearer ' + tok : '', deps);
// ---- a tiny CBOR encoder and an authenticator
function enc(v) {
  const head = (mt, n) => n < 24 ? [mt << 5 | n] : n < 256 ? [mt << 5 | 24, n] : [mt << 5 | 25, n >> 8, n & 255];
  if (typeof v === 'number') return Uint8Array.from(v >= 0 ? head(0, v) : head(1, -1 - v));
  if (typeof v === 'string') { const b = new TextEncoder().encode(v); return Uint8Array.from([...head(3, b.length), ...b]); }
  if (v instanceof Uint8Array) return Uint8Array.from([...head(2, v.length), ...v]);
  if (v instanceof Map) { const out = [...head(5, v.size)]; for (const [k, x] of v) out.push(...enc(k), ...enc(x)); return Uint8Array.from(out); }
  throw new Error('enc');
}
const sha = async u => new Uint8Array(await C.subtle.digest('SHA-256', u));
const te = s => new TextEncoder().encode(s);
function rawToDer(raw) { const int = b => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.slice(i); if (b[0] & 0x80) b = Uint8Array.from([0, ...b]); return [2, b.length, ...b]; };
  const r = int(raw.slice(0, 32)), s = int(raw.slice(32)); return Uint8Array.from([0x30, r.length + s.length, ...r, ...s]); }
async function makeKey() {
  const kp = await C.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await C.subtle.exportKey('jwk', kp.publicKey);
  return { kp, credId: C.getRandomValues(new Uint8Array(16)), x: A.unb64u(jwk.x), y: A.unb64u(jwk.y), counter: 0 };
}
async function create(key, id, challenge, origin) {
  const cd = te(JSON.stringify({ type: 'webauthn.create', challenge, origin: origin || ORIGIN }));
  const cose = enc(new Map([[1, 2], [3, -7], [-1, 1], [-2, key.x], [-3, key.y]]));
  const ad = Uint8Array.from([...await sha(te(RP)), 0x45, 0, 0, 0, 0, ...new Uint8Array(16), 0, key.credId.length, ...key.credId, ...cose]);
  return { id: A.b64u(key.credId), clientDataJSON: A.b64u(cd), attestationObject: A.b64u(enc(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', ad]]))) };
}
async function get(key, id, challenge, o) {
  o = o || {};
  const cd = te(JSON.stringify({ type: 'webauthn.get', challenge, origin: o.origin || ORIGIN }));
  key.counter += o.counterStep === undefined ? 1 : o.counterStep;
  const c = key.counter, ad = Uint8Array.from([...await sha(te(RP)), 0x05, c >>> 24, (c >> 16) & 255, (c >> 8) & 255, c & 255]);
  const signer = o.otherKey || key;
  const sig = new Uint8Array(await C.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer.kp.privateKey, Uint8Array.from([...ad, ...await sha(cd)])));
  return { id: A.b64u(key.credId), clientDataJSON: A.b64u(cd), authenticatorData: A.b64u(ad), signature: A.b64u(rawToDer(sig)), userHandle: A.b64u(te(id)) };
}
async function newAccount(name) {
  const key = await makeKey(), r = await api('/cuenta/nueva', { name });
  const r2 = await api('/cuenta/registrar', { id: r.body.id, cred: await create(key, r.body.id, r.body.challenge) });
  return { key, id: r.body.id, token: r2.body.token, r2 };
}
async function login(acc, o) {
  const ch = (await api('/cuenta/entrar/reto')).body.challenge;
  return api('/cuenta/entrar', { cred: await get(acc.key, acc.id, ch, o) });
}

(async () => {
  console.log('\nCUENTAS CON PASSKEY');
  const H = await newAccount('Hamza');
  check('crear cuenta: identificador SD-XXXX-XXXX, sesión y nombre', H.r2.status === 200 && A.isId(H.id) && /^SD-.{9}\..{40,}$/.test(H.token) && H.r2.body.account.name === 'Hamza', H.id);
  const st = await stores.get(H.id).get('acc');
  check('el servidor guarda solo la llave pública y el resumen de la sesión (nunca la ficha)', st.creds[0].jwk.kty === 'EC' && !st.creds[0].jwk.d && !JSON.stringify(st).includes(H.token.split('.')[1]));
  const yo = await api('/cuenta/yo', {}, H.token);
  check('con la sesión: /cuenta/yo', yo.status === 200 && yo.body.account.id === H.id);
  check('sin sesión o con una inventada: 401', (await api('/cuenta/yo', {})).status === 401 && (await api('/cuenta/yo', {}, H.id + '.' + 'x'.repeat(43))).status === 401);
  const l = await login(H);
  check('entrar con la passkey (firma ECDSA del reto)', l.status === 200 && l.body.account.id === H.id && l.body.token !== H.token, l.status + ' ' + JSON.stringify(l.body).slice(0, 80));
  // rejections
  const other = await makeKey();
  check('firma de otra llave: rechazada', (await login(H, { otherKey: other })).status === 401);
  check('desde otra web (origen falso): rechazada', (await login(H, { origin: 'https://phishing.example' })).status === 400);
  const ch = (await api('/cuenta/entrar/reto')).body.challenge, cred = await get(H.key, H.id, ch);
  const first = await api('/cuenta/entrar', { cred }), again = await api('/cuenta/entrar', { cred });
  check('el mismo reto no sirve dos veces', first.status === 200 && again.status === 400);
  check('contador hacia atrás (llave clonada): rechazada', (await login(H, { counterStep: -3 })).status === 401);
  const ch2 = (await api('/cuenta/entrar/reto')).body.challenge; T += 6 * 60000;
  check('reto caducado (5 min): rechazado', (await api('/cuenta/entrar', { cred: await get(H.key, H.id, ch2) })).status === 400);
  const r0 = await api('/cuenta/nueva', { name: 'x' }); T += 6 * 60000;
  check('crear con un reto caducado: rechazado', (await api('/cuenta/registrar', { id: r0.body.id, cred: await create(await makeKey(), r0.body.id, r0.body.challenge) })).status === 400);
  const r1 = await api('/cuenta/nueva', { name: 'y' });
  check('crear desde otra web: rechazado', (await api('/cuenta/registrar', { id: r1.body.id, cred: await create(await makeKey(), r1.body.id, r1.body.challenge, 'https://phishing.example') })).status === 400);
  check('el nombre se limpia (sin etiquetas, 16 letras como mucho)', (await api('/cuenta/nombre', { name: '<b>Hamza el francotirador</b>' }, H.token)).body.account.name === 'bHamza el franco');
  // friends
  console.log('\nAMIGOS');
  const N = await newAccount('Novia');
  check('pedir amistad con el código', (await api('/cuenta/amigos/pedir', { id: N.id }, H.token)).body.sent === true);
  const nyo = (await api('/cuenta/yo', {}, N.token)).body.account;
  check('a la otra cuenta le llega la solicitud con el nombre', nyo.requests.length === 1 && nyo.requests[0].id === H.id && nyo.requests[0].name === 'bHamza el franco');
  const acc = await api('/cuenta/amigos/aceptar', { id: H.id }, N.token);
  const hyo = (await api('/cuenta/yo', {}, H.token)).body.account;
  check('aceptar: amigos los dos', acc.status === 200 && acc.body.account.friends.some(f => f.id === H.id) && hyo.friends.some(f => f.id === N.id && f.name === 'Novia'));
  check('no se puede pedir a uno mismo ni a un código raro', (await api('/cuenta/amigos/pedir', { id: H.id }, H.token)).status === 400 && (await api('/cuenta/amigos/pedir', { id: 'hola' }, H.token)).status === 400);
  check('invitar a una sala a un amigo', (await api('/cuenta/amigos/invitar', { id: N.id, sala: 'ABC123' }, H.token)).status === 200 && (await api('/cuenta/yo', {}, N.token)).body.account.invites[0].sala === 'ABC123');
  const X = await newAccount('Desconocido');
  check('invitar a quien no es tu amigo: no', (await api('/cuenta/amigos/invitar', { id: X.id, sala: 'ABC123' }, H.token)).status === 403);
  T += 16 * 60000;
  check('la invitación caduca a los 15 min', (await api('/cuenta/yo', {}, N.token)).body.account.invites.length === 0);
  await api('/cuenta/amigos/quitar', { id: N.id }, H.token);
  check('quitar amigo: desaparece en los dos', (await api('/cuenta/yo', {}, H.token)).body.account.friends.length === 0 && (await api('/cuenta/yo', {}, N.token)).body.account.friends.length === 0);
  await api('/cuenta/salir', {}, H.token);
  check('salir: esa sesión ya no vale (las otras sí)', (await api('/cuenta/yo', {}, H.token)).status === 401 && (await api('/cuenta/yo', {}, l.body.token)).status === 200);
  check('basura en las rutas: 400 sin romperse', (await api('/cuenta/entrar', { cred: { userHandle: '!!', clientDataJSON: 5 } })).status === 400 && (await api('/cuenta/registrar', { id: 'x' })).status === 400);

  console.log('\nINVENTARIO Y CAJAS');
  const IT = require('../core/items.js'), P = IT.PTS;
  const invOf = async acc => (await api('/cuenta/yo', {}, acc.token)).body.account.inv;
  const K = await newAccount('Cajas');
  let iv = await invOf(K);
  check('cuenta nueva: una caja de bienvenida, sin objetos, caja diaria disponible', iv.boxes === 1 && iv.items.length === 0 && iv.daily === true && iv.pts === 0, JSON.stringify(iv).slice(0, 90));
  { const old = await stores.get(N.id).get('acc'); delete old.inv; await stores.get(N.id).put('acc', old); }   // an account made before the boxes
  check('una cuenta de antes de las cajas recibe también su caja de bienvenida', (await invOf(N)).boxes === 1);
  check('caja diaria: una al día', (await api('/cuenta/caja/diaria', {}, K.token)).body.account.inv.boxes === 2 && (await api('/cuenta/caja/diaria', {}, K.token)).status === 409);
  const o1 = await api('/cuenta/caja/abrir', {}, K.token), o2 = await api('/cuenta/caja/abrir', {}, K.token), o3 = await api('/cuenta/caja/abrir', {}, K.token);
  iv = await invOf(K);
  check('abrir: cada caja da un objeto que existe, distinto, y la caja se gasta; sin cajas, 409', o1.status === 200 && o2.status === 200 && IT.byId(o1.body.item) && IT.byId(o2.body.item) && o1.body.item !== o2.body.item && iv.boxes === 0 && iv.items.length === 2 && o3.status === 409, o1.body.item + ', ' + o2.body.item);
  // the draw itself (core/items.js): rarity by the first number, never something you own, everything owned → fragments
  const all = {}; for (const it of IT.ITEMS) all[it.id] = true;
  const legOwned = {}; for (const it of IT.ITEMS) if (it.r === 'legendaria') legOwned[it.id] = true;
  check('sorteo: 0,10 → común, 0,70 → rara, 0,90 → épica, 0,99 → legendaria', IT.roll(0.1, 0, {}).item.r === 'comun' && IT.roll(0.7, 0, {}).item.r === 'rara' && IT.roll(0.9, 0, {}).item.r === 'epica' && IT.roll(0.99, 0, {}).item.r === 'legendaria');
  check('sorteo: con todas las legendarias, una legendaria se cambia por una épica; con todo, fragmentos', IT.roll(0.99, 0.5, legOwned).item.r === 'epica' && IT.roll(0.99, 0.5, all).frag === 50 && !IT.roll(0.5, 0.3, all).item);
  { const r = () => Math.random(), n = 20000, c = { comun: 0, rara: 0, epica: 0, legendaria: 0 }; for (let i = 0; i < n; i++) c[IT.roll(r(), r(), {}).item.r]++;
    check('sorteo: las probabilidades anunciadas (20 000 cajas, ±1,5 %)', Object.keys(c).every(k => Math.abs(c[k] / n - IT.RARITY[k].p) < 0.015), Object.keys(c).map(k => k + ' ' + (c[k] / n * 100).toFixed(1) + '%').join(' · ')); }
  check('probabilidades: suman 100 %', Math.abs(IT.ORDER.reduce((s, k) => s + IT.RARITY[k].p, 0) - 1) < 1e-9);
  // equip: only what you own, only in its slot
  const ks = await stores.get(K.id).get('acc'); ks.inv.items.camo_oro = 1; ks.inv.items.tit_leyenda = 1; await stores.get(K.id).put('acc', ks);
  const e1 = await api('/cuenta/equipar', { slot: 'camo', id: 'camo_oro' }, K.token);
  const notOwned = IT.ITEMS.find(it => it.type === 'camo' && !(e1.body.account.inv.items.includes(it.id)));
  check('equipar: lo tuyo sí; lo que no tienes, 403; en otro hueco o inventado, 400', e1.status === 200 && e1.body.account.inv.equip.camo === 'camo_oro'
    && (await api('/cuenta/equipar', { slot: 'camo', id: notOwned.id }, K.token)).status === 403
    && (await api('/cuenta/equipar', { slot: 'ret', id: 'camo_oro' }, K.token)).status === 400 && (await api('/cuenta/equipar', { slot: 'x', id: 'camo_oro' }, K.token)).status === 400);
  await api('/cuenta/equipar', { slot: 'titulo', id: 'tit_leyenda' }, K.token);
  check('el título equipado: en la cuenta y para la sala (roomAccount)', (await invOf(K)).title === 'LEYENDA' && JSON.stringify(await A.roomAccount(K.token, deps.acc)) === JSON.stringify({ id: K.id, title: 'LEYENDA' }));
  check('roomAccount: una ficha falsa o inventada no vale', await A.roomAccount(K.id + '.' + 'x'.repeat(43), deps.acc) === null && await A.roomAccount('hola', deps.acc) === null);
  check('quitar lo equipado (id null)', (await api('/cuenta/equipar', { slot: 'camo', id: null }, K.token)).body.account.inv.equip.camo === undefined);
  // games against bots: counted by the browser → capped
  check('contra bots: partida de menos de 45 s no suma', (await api('/cuenta/partida', { won: true, secs: 20 }, K.token)).status === 400);
  const g1 = await api('/cuenta/partida', { won: true, secs: 300 }, K.token);
  check('contra bots: ganar +25; otra antes de un minuto, 429', g1.status === 200 && g1.body.pts === P.botWin && g1.body.account.inv.pts === 25 && (await api('/cuenta/partida', { won: true, secs: 300 }, K.token)).status === 429);
  let gotBots = 25; for (let i = 0; i < 6; i++) { T += 61000; gotBots += (await api('/cuenta/partida', { won: true, secs: 300 }, K.token)).body.pts; }
  iv = await invOf(K);
  check('contra bots: como mucho 100 puntos al día (una caja)', gotBots === P.botsDay && iv.boxes === 1 && iv.pts === 0 && iv.botsLeft === 0, gotBots + ' puntos, ' + iv.boxes + ' caja');
  T += 86400000;
  check('al día siguiente vuelve a sumar', (await api('/cuenta/partida', { won: false, secs: 300 }, K.token)).body.pts === P.botLoss);
  // online: the room server gives the points at the end of the match (matchReward)
  const L = await newAccount('Rival');
  const before = { k: await invOf(K), l: await invOf(L) }, info = (o) => Object.assign({ code: 'ABC234', match: 1, winner: 'A', why: 'bajas', ms: 90000, acc: { A: K.id, B: L.id } }, o);
  const rw1 = await A.matchReward(info(), deps.acc);
  const after = { k: await invOf(K), l: await invOf(L) }, ptsOf = i => i.boxes * 100 + i.pts;
  check('online: gana +100 y pierde +50', rw1.A === 100 && rw1.B === 50 && ptsOf(after.k) - ptsOf(before.k) === 100 && ptsOf(after.l) - ptsOf(before.l) === 50, JSON.stringify(rw1));
  check('online: la misma partida no cuenta dos veces', JSON.stringify(await A.matchReward(info(), deps.acc)) === '{"A":0,"B":0}' && ptsOf(await invOf(K)) === ptsOf(after.k));
  check('online: menos de 1 min jugado, una sola cuenta en los dos sitios o un invitado sin cuenta: nada',
    JSON.stringify(await A.matchReward(info({ match: 2, ms: 59000 }), deps.acc)) === '{}' && JSON.stringify(await A.matchReward(info({ match: 3, acc: { A: K.id, B: K.id } }), deps.acc)) === '{}'
    && JSON.stringify(await A.matchReward(info({ match: 4, acc: { A: K.id, B: null } }), deps.acc)) === '{}');
  check('online: empate +75 a los dos; abandono: +50 al que se queda y nada al que se va',
    JSON.stringify(await A.matchReward(info({ match: 5, winner: null }), deps.acc)) === '{"A":75,"B":75}' && JSON.stringify(await A.matchReward(info({ match: 6, winner: 'B', why: 'abandono' }), deps.acc)) === '{"B":50}');
  let online = 0; for (let m = 10; m < 25; m++) { const r = await A.matchReward(info({ match: m }), deps.acc); online += r.A; }
  check('online: tope de 1000 puntos al día (10 cajas)', (await invOf(K)).onlineLeft === 0 && online < 15 * 100, online + ' puntos más');
  const full = await stores.get(K.id).get('acc'); full.inv.boxes = P.maxBoxes; full.inv.pts = 0; await stores.get(K.id).put('acc', full); T += 86400000;
  await A.matchReward(info({ match: 40 }), deps.acc);
  check('con 99 cajas guardadas no se pasa de 99 (los puntos esperan)', (await invOf(K)).boxes === P.maxBoxes && (await invOf(K)).pts === 99);
  // custom rooms: teams, the time running out, one account against server bots
  T += 86400000;
  const M = await newAccount('Primo'), Q = await newAccount('Cuarto');
  const before2 = { l: await invOf(L), m: await invOf(M), q: await invOf(Q) };
  const t1 = await A.matchReward({ code: 'EQP234', match: 1, winner: 'rojo', why: 'bajas', ms: 120000, mode: 'equipos', acc: { A: L.id, B: M.id, C: Q.id }, teams: { A: 'rojo', B: 'azul', C: 'rojo', D: 'azul' }, bots: 1 }, deps.acc);
  check('equipos: los del equipo ganador +100, los otros +50', t1.A === 100 && t1.C === 100 && t1.B === 50 && ptsOf(await invOf(L)) - ptsOf(before2.l) === 100 && ptsOf(await invOf(M)) - ptsOf(before2.m) === 50, JSON.stringify(t1));
  check('se acaba el tiempo: también da puntos', JSON.stringify(await A.matchReward({ code: 'EQP234', match: 2, winner: 'A', why: 'tiempo', ms: 600000, mode: 'todos', acc: { A: L.id, B: M.id } }, deps.acc)) === '{"A":100,"B":50}');
  const sb = await A.matchReward({ code: 'BOT234', match: 1, winner: 'A', why: 'bajas', ms: 200000, mode: 'todos', acc: { A: Q.id }, bots: 3 }, deps.acc);
  const sb2 = await A.matchReward({ code: 'BOT234', match: 2, winner: 'C', why: 'bajas', ms: 200000, mode: 'todos', acc: { A: Q.id }, bots: 3 }, deps.acc);
  check('una cuenta sola contra bots del servidor: puntos de bots (+25 ganar, +10 perder)', sb.A === P.botWin && sb2.A === P.botLoss, JSON.stringify([sb, sb2]));
  for (let m = 3; m < 12; m++) await A.matchReward({ code: 'BOT234', match: m, winner: 'A', why: 'bajas', ms: 200000, mode: 'todos', acc: { A: Q.id }, bots: 3 }, deps.acc);
  check('y con el tope diario de los bots (100 puntos)', (await invOf(Q)).botsLeft === 0);
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); process.exit(1); });
