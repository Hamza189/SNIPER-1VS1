/* Cajas y objetos en la página real (paso D): passkeys de verdad (autenticador virtual de Chromium) y el servidor local
   (server/node.js, mismas rutas que Cloudflare):
   - sin cuenta: CAJAS invita a crearla; con cuenta: caja de bienvenida y caja diaria; ABRIR CAJA → el objeto sale
   - equipar: camuflaje en el rifle de 1ª persona (material retocado), color del punto de la mira, título
   - lo bloqueado no se puede equipar; el título lo ve el rival en la sala (lo lee el servidor de la cuenta)
   - partida contra bots → puntos de caja en la pantalla final
   Run: node test/cajas.browser.test.js   (SHOTS=<carpeta> guarda capturas) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
const { startServer } = require('../server/node.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start(), gs = await startServer({ port: 0 });
  const web = srv.url.replace('127.0.0.1', 'localhost'), server = 'http://localhost:' + gs.port;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async (q) => {
    const ctx = await b.newContext({ viewport: { width: 900, height: 640 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await p.goto(web + '?pj=pro&perf=low&vm=1&server=' + encodeURIComponent(server) + (q || ''), { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.R, null, { timeout: 180000 });
    return { ctx, p, errs };
  };
  const shot = async (p, name) => { if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/' + name + '.png' }); };
  const grant = async (id, items) => { const st = gs.accStores.get(id), a = await st.get('acc'); for (const k of items) a.inv.items[k] = 1; await st.put('acc', a); };
  const camoOn = p => p.evaluate(() => { let n = 0; __SD.VMA.R.root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.customProgramCacheKey && m.customProgramCacheKey() === 'sdcamo') n++; }); return n; });
  try {
    console.log('\nCAJAS SIN CUENTA');
    const A = await open();
    check('el menú tiene el botón CAJAS', await A.p.evaluate(() => !document.getElementById('openInv').hidden && /CAJAS/.test(document.getElementById('openInv').textContent)));
    await A.p.click('#openInv');
    check('sin cuenta: invita a crearla y todo está bloqueado salvo «de serie»', await A.p.evaluate(() => !!document.querySelector('#invHead [data-inv="perfil"]')
      && [...document.querySelectorAll('#invGrid .invCard')].every((c, i) => i === 0 ? !c.disabled : c.disabled && c.classList.contains('lock'))));
    await shot(A.p, 'cajas-sin-cuenta');
    await A.p.click('#invHead [data-inv="perfil"]');
    await A.p.fill('#profName', 'Hamza'); await A.p.press('#profName', 'Tab');
    await A.p.evaluate(() => document.querySelector('#accBox [data-acc="crear"]').click());
    await A.p.waitForFunction(() => __SD.ACC.acc && __SD.ACC.acc.inv, null, { timeout: 20000 });
    const id = await A.p.evaluate(() => __SD.ACC.acc.id);

    console.log('\nCAJA DE BIENVENIDA, DIARIA Y ABRIR');
    check('cuenta nueva: CAJAS (2) = la de bienvenida + la diaria', await A.p.evaluate(() => document.getElementById('openInv').textContent === 'CAJAS (2)'));
    await A.p.evaluate(() => document.querySelector('#accBox [data-acc="cajas"]').click());
    await A.p.waitForSelector('#invHead [data-inv="abrir"]');
    await A.p.click('#invHead [data-inv="diaria"]');
    check('RECOGER CAJA DIARIA: 2 cajas y la próxima, mañana', await A.p.waitForFunction(() => __SD.ACC.acc.inv.boxes === 2 && !document.querySelector('#invHead [data-inv="diaria"]') && /próxima/.test(document.getElementById('invHead').textContent), null, { timeout: 10000 }).then(() => true, () => false));
    await A.p.click('#invHead [data-inv="abrir"]');
    check('ABRIR CAJA: la caja tiembla mientras el servidor sortea', await A.p.evaluate(() => !document.getElementById('boxOv').hidden && document.getElementById('crate').classList.contains('shake')));
    await A.p.waitForFunction(() => !document.getElementById('reveal').hidden, null, { timeout: 15000 });
    const got = await A.p.evaluate(() => ({ items: __SD.ACC.acc.inv.items, boxes: __SD.ACC.acc.inv.boxes, h: document.querySelector('#reveal h3').textContent, r: document.querySelector('#reveal .rvR').textContent }));
    const it1 = got.items[0];
    check('sale un objeto: es tuyo en el servidor, se enseña su nombre y su rareza, y queda 1 caja', got.items.length === 1 && got.boxes === 1 && await A.p.evaluate(([id, h]) => SDItems.byId(id).name === h, [it1, got.h]) && /COMÚN|RARA|ÉPICA|LEGENDARIA/.test(got.r), got.r + ' · ' + got.h);
    await A.p.waitForTimeout(500); await shot(A.p, 'cajas-abierta');
    await A.p.click('#reveal [data-inv="seguir"]');
    const stored = await (async () => { const a = await gs.accStores.get(id).get('acc'); return Object.keys(a.inv.items); })();
    check('el servidor lo guarda en la cuenta', stored.length === 1 && stored[0] === it1);

    console.log('\nEQUIPAR');
    await grant(id, ['camo_dragon', 'ret_verde', 'tit_leyenda']);
    await A.p.evaluate(() => __SD.accRefresh());
    await A.p.waitForFunction(() => __SD.ACC.acc.inv.items.includes('camo_dragon'), null, { timeout: 10000 });
    await A.p.evaluate(() => __SD.openInv());
    await A.p.click('#invTabs [data-tab="camo"]');
    await A.p.click('#invGrid .invCard[data-id="camo_dragon"]');
    check('camuflaje DRAGÓN: equipado en la cuenta y en el rifle de 1ª persona', await A.p.waitForFunction(() => __SD.ACC.acc.inv.equip.camo === 'camo_dragon', null, { timeout: 10000 }).then(() => true, () => false) && await camoOn(A.p) > 0, (await camoOn(A.p)) + ' materiales');
    await shot(A.p, 'cajas-inventario');
    if (process.env.SHOTS) { await A.p.setViewportSize({ width: 844, height: 390 }); await A.p.waitForTimeout(300); await shot(A.p, 'cajas-movil'); await A.p.setViewportSize({ width: 900, height: 640 }); }
    const locked = await A.p.evaluate(() => { const c = [...document.querySelectorAll('#invGrid .invCard.lock')][0]; return c ? { dis: c.disabled, id: c.dataset.id } : null; });
    check('lo que no tienes está bloqueado (no se puede pulsar)', locked && locked.dis);
    await A.p.click('#invTabs [data-tab="ret"]'); await A.p.click('#invGrid .invCard[data-id="ret_verde"]');
    check('punto de la mira VERDE', await A.p.waitForFunction(() => document.getElementById('retDot').getAttribute('fill') === '#3dff6a' && __SD.ACC.acc.inv.equip.ret === 'ret_verde', null, { timeout: 10000 }).then(() => true, () => false));
    await A.p.click('#invTabs [data-tab="titulo"]'); await A.p.click('#invGrid .invCard[data-id="tit_leyenda"]');
    await A.p.waitForFunction(() => __SD.ACC.acc.inv.title === 'LEYENDA', null, { timeout: 10000 });
    await A.p.click('#invTabs [data-tab="camo"]'); await A.p.click('#invGrid .invCard[data-id=""]');
    check('SIN CAMUFLAJE: el rifle vuelve a su material', await A.p.waitForFunction(() => !__SD.ACC.acc.inv.equip.camo, null, { timeout: 10000 }).then(() => true, () => false) && await camoOn(A.p) === 0);
    await A.p.click('#invGrid .invCard[data-id="camo_dragon"]'); await A.p.waitForFunction(() => __SD.ACC.acc.inv.equip.camo === 'camo_dragon');
    await A.p.reload(); await A.p.waitForFunction(() => window.__SD && __SD.VMA.R, null, { timeout: 180000 });
    check('al recargar: lo equipado sigue (camuflaje y mira)', await A.p.waitForFunction(() => __SD.ACC.acc && document.getElementById('retDot').getAttribute('fill') === '#3dff6a', null, { timeout: 20000 }).then(() => true, () => false) && await camoOn(A.p) > 0);

    console.log('\nPARTIDA CONTRA BOTS → PUNTOS');
    await A.p.evaluate(() => { __SD.setMode('duel'); __SD.setDuelLethal(true); __SD.startMatch(); });
    await A.p.waitForFunction(() => __SD.state === 'playing', null, { timeout: 120000 });
    await A.p.evaluate(() => { __SD.STATS.start -= 120; __SD.endMatch(true); });
    check('ganar contra bots: +25 PUNTOS DE CAJA en la pantalla final', await A.p.waitForFunction(() => !document.getElementById('overInv').hidden && /\+25 PUNTOS DE CAJA/.test(document.getElementById('overInv').textContent), null, { timeout: 10000 }).then(() => true, () => false), await A.p.textContent('#overInv'));
    await shot(A.p, 'cajas-final');
    await A.p.evaluate(() => __SD.toMenu());

    console.log('\nEL TÍTULO EN LA SALA ONLINE');
    await A.p.click('#mpBtn'); await A.p.fill('#mpName', 'Hamza'); await A.p.click('#mpCreate');
    await A.p.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent), null, { timeout: 15000 });
    const sala = await A.p.textContent('#mpCodeBig');
    const B = await open('&sala=' + sala);
    await B.p.fill('#mpName', 'Novia'); await B.p.click('#mpJoin');
    check('el rival ve «LEYENDA» junto a tu nombre (lo pone el servidor desde tu cuenta)', await B.p.waitForFunction(() => /Hamza «LEYENDA»/.test(document.getElementById('mpPlayers').textContent), null, { timeout: 15000 }).then(() => true, () => false), await B.p.textContent('#mpPlayers'));
    check('sin errores en las páginas', A.errs.length === 0 && B.errs.length === 0, A.errs.concat(B.errs).slice(0, 2).join(' | '));
    await A.ctx.close(); await B.ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close(); await gs.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
