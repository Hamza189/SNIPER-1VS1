/* Entrar con Google (04-11-2026, server/accounts.js, docs/CUENTAS-Y-MONETIZACION.md) en la página real contra el servidor
   local. Google se simula: su script (accounts.google.com/gsi/client) se sustituye por uno que guarda lo que la página le
   pide (ID de cliente, nonce) y dibuja un botón; el token lo firma aquí una llave RSA de prueba que hace de Google.
   - sin ID de cliente en el servidor: ni botón ni script de Google
   - con él: el botón sale en PERFIL, con nuestro ID y un reto como nonce
   - la primera vez crea la cuenta (el perfil toma su código y su nombre); al salir y volver, la MISMA cuenta
   - ya dentro con Google: no ofrece vincular otra vez; un token falso no entra
   Run: node test/google.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
const { startServer } = require('../server/node.js');
const C = globalThis.crypto;
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const b64u = u8 => Buffer.from(u8).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const FAKE_GSI = `window.google={accounts:{id:{initialize(o){window.__gsi={id:o.client_id,nonce:o.nonce,cb:o.callback,n:(window.__gsi&&window.__gsi.n||0)+1};},
  renderButton(el,o){const b=document.createElement('button');b.type='button';b.className='fakeGsi';b.textContent='Google · '+o.text;el.appendChild(b);}}}};`;

(async () => {
  const CID = 'prueba.apps.googleusercontent.com';
  const gk = await C.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = Object.assign(await C.subtle.exportKey('jwk', gk.publicKey), { kid: 'k1' });
  const jwt = async (claims, key) => { const te = new TextEncoder(), h = b64u(te.encode(JSON.stringify({ alg: 'RS256', kid: 'k1' }))), c = b64u(te.encode(JSON.stringify(claims)));
    return h + '.' + c + '.' + b64u(new Uint8Array(await C.subtle.sign('RSASSA-PKCS1-v1_5', (key || gk).privateKey, te.encode(h + '.' + c)))); };
  const srv = await ss.start(), on = await startServer({ port: 0, googleClientId: CID, googleKeys: async () => [jwk] }), off = await startServer({ port: 0 });
  const web = srv.url.replace('127.0.0.1', 'localhost');
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async (port) => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 600 } }), asked = [];
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.route('https://accounts.google.com/gsi/client', r => { asked.push(1); r.fulfill({ status: 200, contentType: 'text/javascript', body: FAKE_GSI }); });
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(web + '?perf=low&server=' + encodeURIComponent('http://localhost:' + port));
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
    await p.evaluate(() => __SD.openProfile());
    return { ctx, p, errs, asked };
  };
  const sign = async (p, sub, more) => { const g = await p.evaluate(() => ({ nonce: __gsi.nonce, id: __gsi.id }));
    const t = Math.floor(Date.now() / 1000); return jwt(Object.assign({ iss: 'https://accounts.google.com', aud: g.id, sub, iat: t, exp: t + 600, nonce: g.nonce, given_name: 'Lucía' }, more || {})); };
  try {
    console.log('\nSIN ID DE CLIENTE');
    { const X = await open(off.port); await new Promise(r => setTimeout(r, 2500));
      const st = await X.p.evaluate(() => ({ box: !!document.querySelector('#accGoogle'), hidden: document.querySelector('#accGoogle') && document.querySelector('#accGoogle').hidden, passkey: !!document.querySelector('#accBox [data-acc="crear"]') }));
      check('el botón de Google no sale y su script no se carga; los de la llave, sí', st.hidden && X.asked.length === 0 && st.passkey, JSON.stringify(st) + ' · script ' + X.asked.length);
      await X.ctx.close(); }

    console.log('\nCON ID DE CLIENTE');
    const A = await open(on.port);
    const shown = await A.p.waitForFunction(() => { const g = document.querySelector('#accGoogle'); return g && !g.hidden && !!g.querySelector('.fakeGsi') && window.__gsi; }, null, { timeout: 15000 }).then(() => true, () => false);
    const g0 = await A.p.evaluate(() => ({ id: __gsi.id, nonce: __gsi.nonce, text: document.querySelector('.fakeGsi').textContent }));
    check('PERFIL muestra el botón de Google, con nuestro ID de cliente y un reto del servidor como nonce', shown && g0.id === CID && g0.nonce.length > 20 && A.asked.length === 1, JSON.stringify(g0).slice(0, 120));
    await A.p.evaluate(async c => __gsi.cb({ credential: c }), await sign(A.p, 'g-web-1'));
    const in1 = await A.p.waitForFunction(() => __SD.ACC.acc && __SD.ACC.acc.google, null, { timeout: 10000 }).then(() => true, () => false);
    const a1 = await A.p.evaluate(() => ({ id: __SD.ACC.acc.id, name: __SD.ACC.acc.name, prof: __SD.PROFILE.id, link: !!document.querySelector('#accGoogle'), tok: !!__SD.ACC.token }));
    check('la primera vez crea la cuenta y entra: el perfil toma su código', in1 && /^SD-/.test(a1.id) && a1.prof === a1.id && a1.tok, JSON.stringify(a1));
    check('ya dentro con Google: no ofrece vincular otra vez', !a1.link);
    await A.p.evaluate(() => document.querySelector('#accBox [data-acc="salir"]').click());
    await A.p.waitForFunction(() => !__SD.ACC.token && document.querySelector('#accGoogle .fakeGsi'), null, { timeout: 10000 });
    const n2 = await A.p.evaluate(() => __gsi.nonce);
    check('al salir vuelve el botón, con un reto nuevo (el usado no sirve)', n2 && n2 !== g0.nonce);
    await A.p.evaluate(async c => __gsi.cb({ credential: c }), await sign(A.p, 'g-web-1'));
    const back = await A.p.waitForFunction(id => __SD.ACC.acc && __SD.ACC.acc.id === id, a1.id, { timeout: 10000 }).then(() => true, () => false);
    check('volver con el mismo Google: la MISMA cuenta', back);
    await A.p.evaluate(() => document.querySelector('#accBox [data-acc="salir"]').click());
    await A.p.waitForFunction(() => !__SD.ACC.token && document.querySelector('#accGoogle .fakeGsi'), null, { timeout: 10000 });
    const evil = await C.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    const g = await A.p.evaluate(() => ({ nonce: __gsi.nonce })), t = Math.floor(Date.now() / 1000);
    await A.p.evaluate(async c => __gsi.cb({ credential: c }), await jwt({ iss: 'https://accounts.google.com', aud: CID, sub: 'g-web-1', iat: t, exp: t + 600, nonce: g.nonce }, evil));
    const msg = await A.p.waitForFunction(() => /no ha confirmado|No se pudo/.test(document.getElementById('accMsg').textContent), null, { timeout: 10000 }).then(() => A.p.evaluate(() => document.getElementById('accMsg').textContent), () => '');
    check('un token falso (firmado por otro) no entra y lo dice', !(await A.p.evaluate(() => __SD.ACC.token)) && !!msg, msg);
    check('sin errores en la página', A.errs.length === 0, A.errs.slice(0, 2).join(' | ') || 'ninguno');
    await A.ctx.close();
  } catch (e) { check('sin excepciones', false, e.message); }
  await b.close(); srv.close(); on.close(); off.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
