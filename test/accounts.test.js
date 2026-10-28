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
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); process.exit(1); });
