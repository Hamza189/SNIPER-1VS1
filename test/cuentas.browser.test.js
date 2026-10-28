/* Cuentas en la página real con passkeys de verdad (el autenticador virtual de Chromium, por CDP) y el servidor local
   (server/node.js, mismas rutas que Cloudflare):
   - CREAR CUENTA en PERFIL → la llave se crea en el «móvil», la cuenta en el servidor; el perfil toma su código
   - SALIR y ENTRAR con la misma llave (sin contraseñas); la sesión sobrevive a recargar la página
   - dos jugadores: pedir amistad con el código, aceptar, invitar a la sala y UNIRSE desde la invitación
   WebAuthn exige un dominio: la página se abre en http://localhost.   Run: node test/cuentas.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
const { startServer } = require('../server/node.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  // CUENTAS_SERVER=http://localhost:8787 runs it against another server (wrangler dev: the real Cloudflare runtime)
  const ext = process.env.CUENTAS_SERVER, srv = await ss.start(), gs = ext ? null : await startServer({ port: 0 });
  const web = srv.url.replace('127.0.0.1', 'localhost'), server = ext || 'http://localhost:' + gs.port;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async (q) => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 600 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    // a passkey authenticator for this «phone»: resident keys, user verification (Face ID) always OK
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await p.goto(web + '?pj=pro&perf=low&server=' + encodeURIComponent(server) + (q || ''));
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
    return { ctx, p, errs, cdp, authenticatorId };
  };
  const btn = (pg, act) => pg.evaluate(a => { const e = document.querySelector('#accBox [data-acc="' + a + '"]'); if (!e) return false; e.click(); return true; }, act);
  const btnFor = (pg, act, id) => pg.evaluate(([a, id]) => { const e = document.querySelector('#accBox [data-acc="' + a + '"][data-id="' + id + '"]'); if (!e) return false; e.click(); return true; }, [act, id]);
  try {
    console.log('\nCUENTA CON PASSKEY EN LA PÁGINA');
    const A = await open();
    await A.p.evaluate(() => { __SD.openProfile(); });
    await A.p.fill('#profName', 'Hamza'); await A.p.press('#profName', 'Tab');
    check('sin cuenta: botones CREAR CUENTA y ENTRAR', await A.p.evaluate(() => !!document.querySelector('#accBox [data-acc="crear"]') && !!document.querySelector('#accBox [data-acc="entrar"]')));
    await btn(A.p, 'crear');
    const made = await A.p.waitForFunction(() => __SD.ACC.acc && __SD.ACC.token, null, { timeout: 20000 }).then(() => true, () => false);
    const ra = await A.p.evaluate(() => ({ id: __SD.ACC.acc.id, name: __SD.ACC.acc.name, prof: __SD.PROFILE.id, msg: document.getElementById('accMsg').textContent, tok: JSON.parse(localStorage.getItem('sniperduel_accToken')) }));
    const creds = (await A.cdp.send('WebAuthn.getCredentials', { authenticatorId: A.authenticatorId })).credentials;
    check('CREAR CUENTA: la llave queda en el «móvil» y la cuenta en el servidor, con el nombre y el código del perfil', made && /^SD-/.test(ra.id) && ra.name === 'Hamza' && ra.prof === ra.id && creds.length === 1 && creds[0].isResidentCredential, ra.id + ' · ' + ra.msg);
    if (gs) check('el servidor no guarda contraseñas: solo la llave pública', await (async () => { const st = gs.accStores.get(ra.id); const a = st && await st.get('acc'); return !!a && a.creds[0].jwk.kty === 'EC' && !a.creds[0].jwk.d; })());
    await A.p.reload(); await A.p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
    await A.p.evaluate(() => __SD.openProfile());
    check('al recargar sigue dentro (sesión guardada en el dispositivo)', await A.p.waitForFunction(id => __SD.ACC.acc && __SD.ACC.acc.id === id, ra.id, { timeout: 15000 }).then(() => true, () => false));
    await btn(A.p, 'salir');
    await A.p.waitForFunction(() => !__SD.ACC.token, null, { timeout: 10000 });
    await btn(A.p, 'entrar');
    check('SALIR y ENTRAR con la llave (sin contraseña)', await A.p.waitForFunction(id => __SD.ACC.acc && __SD.ACC.acc.id === id, ra.id, { timeout: 20000 }).then(() => true, () => false));

    console.log('\nAMIGOS E INVITACIÓN');
    const B = await open();
    await B.p.evaluate(() => __SD.openProfile());
    await B.p.fill('#profName', 'Novia'); await B.p.press('#profName', 'Tab');
    await btn(B.p, 'crear');
    await B.p.waitForFunction(() => __SD.ACC.acc, null, { timeout: 20000 });
    const idB = await B.p.evaluate(() => __SD.ACC.acc.id);
    await B.p.fill('#accFriend', ra.id); await btn(B.p, 'pedir');
    check('B pide amistad con el código de A', await B.p.waitForFunction(() => /ENVIADA/.test(document.getElementById('accMsg').textContent), null, { timeout: 10000 }).then(() => true, () => false));
    await A.p.evaluate(() => __SD.accRefresh());
    const hasReq = await A.p.waitForFunction(id => !!document.querySelector('#accBox [data-acc="aceptar"][data-id="' + id + '"]'), idB, { timeout: 10000 }).then(() => true, () => false);
    await btnFor(A.p, 'aceptar', idB);
    check('A ve la solicitud de «Novia» y la acepta: amigos', hasReq && await A.p.waitForFunction(id => __SD.ACC.acc.friends.some(f => f.id === id && f.name === 'Novia'), idB, { timeout: 10000 }).then(() => true, () => false));
    if (process.env.SHOTS) { await A.p.evaluate(() => document.getElementById('accBox').scrollIntoView({ block: 'center' })); await A.p.waitForTimeout(300); await A.p.screenshot({ path: process.env.SHOTS + '/cuenta.png' }); }
    // A creates a room and invites B
    await A.p.evaluate(() => { document.getElementById('profClose').click(); });
    await A.p.click('#mpBtn'); await A.p.fill('#mpName', 'Hamza'); await A.p.click('#mpCreate');
    await A.p.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent), null, { timeout: 15000 });
    const sala = await A.p.textContent('#mpCodeBig');
    await A.p.evaluate(() => { __SD.openProfile(); });
    await A.p.waitForFunction(id => !!document.querySelector('#accBox [data-acc="invitar"][data-id="' + id + '"]'), idB, { timeout: 10000 });
    await btnFor(A.p, 'invitar', idB);
    check('A invita a su amiga a la sala ' + sala, await A.p.waitForFunction(() => /INVITACIÓN ENVIADA/.test(document.getElementById('accMsg').textContent), null, { timeout: 10000 }).then(() => true, () => false));
    await B.p.evaluate(() => __SD.accRefresh());
    const inv = await B.p.waitForFunction(s => !!document.querySelector('#accBox [data-acc="unirse"][data-id="' + s + '"]'), sala, { timeout: 10000 }).then(() => true, () => false);
    await btnFor(B.p, 'unirse', sala);
    await B.p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
    check('B ve la invitación y UNIRSE abre la sala de A', inv && await B.p.waitForFunction(s => new URLSearchParams(location.search).get('sala') === s && document.getElementById('mpCode').value === s, sala, { timeout: 15000 }).then(() => true, () => false), sala);
    check('sin errores en las dos páginas', A.errs.length === 0 && B.errs.length === 0, A.errs.concat(B.errs).slice(0, 2).join(' | '));
    await A.ctx.close(); await B.ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close(); if (gs) await gs.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
