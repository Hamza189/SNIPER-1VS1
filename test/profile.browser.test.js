/* Perfil local en la página real (client/profile.js cableado en src/page.html):
   - el botón PERFIL sale con ?pj=pro (y ?perfil=1) y no sin bandera
   - el apodo del perfil es el nombre del online; cada partida terminada suma en las estadísticas y se guarda
   - el código de copia pasa el perfil a otro «dispositivo» (otro contexto del navegador); un código roto se rechaza
   Run: node test/profile.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async q => {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + '?perf=low' + q);
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
    return { ctx, p, errs };
  };
  try {
    console.log('\nPERFIL EN LA PÁGINA');
    const off = await open('');
    check('sin bandera no hay botón PERFIL (el juego de siempre), pero el perfil existe', await off.p.evaluate(() => document.getElementById('openProfile').hidden && /^SD-/.test(__SD.PROFILE.id)));
    await off.ctx.close();
    const A = await open('&pj=pro');
    check('con ?pj=pro sale PERFIL junto a AJUSTES y se ve entero', await A.p.evaluate(() => { const r = document.getElementById('openProfile').getBoundingClientRect(); return !document.getElementById('openProfile').hidden && r.bottom <= innerHeight && r.right <= innerWidth; }));
    await A.p.click('#openProfile');
    await A.p.fill('#profName', 'Hamza'); await A.p.press('#profName', 'Tab');
    check('el apodo del perfil es el nombre del online', await A.p.evaluate(() => __SD.PROFILE.name === 'Hamza' && document.getElementById('mpName').value === 'Hamza' && JSON.parse(localStorage.getItem('sniperduel_mpName')) === 'Hamza'));
    await A.p.click('#profOv .skinPick');
    await A.p.click('.skinCard[data-skin="militar"]');
    check('el personaje se cambia desde el perfil (y queda en el perfil)', await A.p.evaluate(() => __SD.SKIN === 'militar' && __SD.PROFILE.skin === 'militar' && document.getElementById('skinOv').hidden && !document.getElementById('profOv').hidden));
    await A.p.click('#profClose');
    await A.p.evaluate(() => { __SD.setDuelLethal(false); __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); Object.assign(__SD.STATS, { kills: 10, deaths: 3, hs: 4, shots: 25, hits: 14, longest: 142.4 }); __SD.endMatch(true); });
    const st = await A.p.evaluate(() => JSON.parse(localStorage.getItem('sniperduel_profile')).stats);
    check('al terminar una partida se suma y se guarda: 1 partida, 1 victoria, 10 bajas, tiro de 142 m', st.matches === 1 && st.wins === 1 && st.kills === 10 && st.longest === 142, JSON.stringify(st));
    await A.p.evaluate(() => { __SD.toMenu(); __SD.openProfile(); });
    check('el perfil enseña las cifras', /Partidas1/.test(await A.p.textContent('#profStats')) && /3\.33/.test(await A.p.textContent('#profStats')), await A.p.textContent('#profStats'));
    await A.p.click('#profCopy');
    const code = await A.p.textContent('#profCode');
    check('COPIAR CÓDIGO enseña el código (SD1.…)', /^SD1\./.test(code), code.slice(0, 20) + '…');
    const B = await open('&pj=pro');
    await B.p.click('#openProfile'); await B.p.click('#profPaste');
    await B.p.fill('#profIn', code.slice(0, -1) + (code.slice(-1) === 'a' ? 'b' : 'a')); await B.p.click('#profPaste');
    check('un código mal copiado se rechaza', /no es válido/.test(await B.p.textContent('#profMsg')));
    await B.p.fill('#profIn', code); await B.p.click('#profPaste');
    const rb = await B.p.evaluate(() => ({ id: __SD.PROFILE.id, name: __SD.PROFILE.name, skin: __SD.SKIN, m: __SD.PROFILE.stats.matches, mp: document.getElementById('mpName').value, msg: document.getElementById('profMsg').textContent }));
    const ida = await A.p.evaluate(() => __SD.PROFILE.id);
    check('en el otro dispositivo RESTAURAR trae el mismo perfil (id, apodo, personaje, partidas)', rb.id === ida && rb.name === 'Hamza' && rb.skin === 'militar' && rb.m === 1 && rb.mp === 'Hamza' && /RESTAURADO/.test(rb.msg), JSON.stringify(rb));
    check('sin errores', A.errs.length === 0 && B.errs.length === 0, A.errs.concat(B.errs).slice(0, 2).join(' | '));
    await A.ctx.close(); await B.ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
