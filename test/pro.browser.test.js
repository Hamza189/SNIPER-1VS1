/* Personajes realistas (?pj=pro, tools/personaje-ext) en la página real:
   - ALTO: bots con op3 (FSB) y rival online (apariencia B) con op2 (S.W.A.T.), texturas 4K, sin 404 ni errores
   - MEDIO: op4 para todos, y no descarga op2/op3
   - BAJO: el soldado de cajas de siempre, sin descargar nada de pro/
   - las zonas de impacto de los bots son exactamente las mismas que sin la bandera; créditos CC BY en AJUSTES
   Run: node test/pro.browser.test.js   (WebGL por software: no se mide tiempo) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

async function open(b, url, q) {
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 3 })); } catch (e) {} }, q);
  const p = await ctx.newPage(), bad = [], files = [], errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (/pj2/.test(m.text())) errs.push(m.text()); });
  p.on('response', r => { const u = r.url(); if (/\/assets\//.test(u) && r.status() >= 400) bad.push(r.status() + ' ' + u.replace(/^.*\/assets\//, '')); if (/\/assets\/personaje\/pro\//.test(u)) files.push(u.replace(/^.*\/assets\/personaje\/pro\//, '').replace(/\?.*/, '')); });
  await p.goto(url);
  await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
  await p.evaluate(() => { __SD.setDuelLethal(false); __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); });
  await p.waitForTimeout(1500);
  return { ctx, p, bad, files, errs };
}
const zones = p => p.evaluate(() => __SD.BOTS.map(b => b.hit.map(m => [m.userData.part, m.position.x, m.position.y, m.position.z, m.geometry.type].join(':')).join('|')).join(';'));

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    console.log('\nCON ?pj=0 (sin bandera es ?pj=pro desde el 28-10)');
    const off = await open(b, srv.url + '?vm=1&pj=0', 'alto');
    const z0 = await zones(off.p);
    check('no descarga ningún personaje de pro/', off.files.length === 0);
    await off.ctx.close();

    console.log('\nALTO (?pj=pro)');
    const A = await open(b, srv.url + '?vm=1&pj=pro', 'alto');
    await A.p.evaluate(() => { const S = __SD; window.__R = S.makeSoldier(S.BOT_MAT, { variant: 'B' }); S.scene.add(__R.root); });
    const okA = await A.p.waitForFunction(() => __SD.BOTS.every(b => b.rig.v2) && __R.v2, null, { timeout: 180000 }).then(() => true, () => false);
    const ra = await A.p.evaluate(() => ({ roots: Object.keys(__SD.PJ2.tpls).sort(), botTpl: __SD.BOTS[0].rig.v2.meshes[0].geometry.index.count / 3, rivalTpl: __R.v2.meshes[0].geometry.index.count / 3,
      tex: __SD.BOTS[0].rig.v2.meshes[0].material.map && __SD.BOTS[0].rig.v2.meshes[0].material.map.image && __SD.BOTS[0].rig.v2.meshes[0].material.map.image.width,
      oldHidden: __SD.BOTS[0].rig.root.children.filter(c => c !== __SD.BOTS[0].rig.v2.root).every(c => !c.visible) }));
    check('los bots llevan op3 (FSB) y el rival online op2 (S.W.A.T.)', okA && ra.roots.join() === 'assets/personaje/pro/op2/,assets/personaje/pro/op3/' && ra.botTpl !== ra.rivalTpl, ra.roots.join(' '));
    check('texturas 4K en ALTO', ra.tex === 4096, ra.tex);
    check('el soldado de cajas queda oculto (sigue existiendo: es la vuelta atrás)', ra.oldHidden);
    check('sin 404 ni errores', A.bad.length === 0 && A.errs.length === 0, A.bad.concat(A.errs).slice(0, 3).join(' | ') || A.files.join(' '));
    check('las zonas de impacto de los bots son exactamente las mismas que sin la bandera', (await zones(A.p)) === z0);
    const r2 = await A.p.evaluate(() => { const S = __SD, bt = S.BOTS[0], R = bt.rig, I = R.v2; S.pause();
      const st = o => Object.assign({ wpn: 'rifle', vx: 0, vz: 0, pitch: 0, aim: 1 }, o);
      const head = () => { const h = I.root.getObjectByName('Head'); h.updateWorldMatrix(true, false); return h.getWorldPosition(new THREE.Vector3()).y - bt.g.position.y; };
      S.animateSoldier(R, st({}), 1 / 60); const stand = head();
      for (let i = 0; i < 20; i++) S.animateSoldier(R, st({ crouch: 1 }), 1 / 60); const crouch = head();
      return { stand, crouch, morph: I.meshes[0].morphTargetInfluences[I.meshes[0].morphTargetDictionary.agachado] }; });
    check('se anima con las animaciones del juego: agachado baja la cabeza con el morph', r2.morph > 0.99 && r2.crouch < r2.stand - 0.3, r2.stand.toFixed(2) + ' → ' + r2.crouch.toFixed(2) + ' m');
    check('créditos CC BY 4.0 en AJUSTES › GRÁFICOS', await A.p.evaluate(() => /Mateusz Woliński/.test(document.getElementById('credits').textContent) && /DanlyVostok/.test(document.getElementById('credits').textContent) && /CC BY 4\.0/.test(document.getElementById('credits').textContent)));
    await A.ctx.close();

    console.log('\nMEDIO (?pj=pro)');
    const M = await open(b, srv.url + '?vm=1&pj=pro', 'medio');
    const okM = await M.p.waitForFunction(() => __SD.BOTS.every(b => b.rig.v2), null, { timeout: 180000 }).then(() => true, () => false);
    const rm = await M.p.evaluate(() => Object.keys(__SD.PJ2.tpls));
    check('MEDIO: todos con op4 y no se descargan op2/op3', okM && rm.join() === 'assets/personaje/pro/op4/' && M.files.every(f => f.startsWith('op4/')), M.files.join(' '));
    check('MEDIO: sin 404 ni errores', M.bad.length === 0 && M.errs.length === 0, M.bad.concat(M.errs).slice(0, 3).join(' | '));
    await M.ctx.close();

    console.log('\nBAJO (?pj=pro)');
    const L = await open(b, srv.url + '?vm=1&pj=pro', 'bajo');
    await L.p.waitForTimeout(1500);
    const rl = await L.p.evaluate(() => ({ on: __SD.PJ2.on, v2: __SD.BOTS.some(b => !!b.rig.v2) }));
    check('BAJO: el soldado de siempre, sin descargar nada de pro/', !rl.on && !rl.v2 && L.files.length === 0 && L.errs.length === 0, L.files.join(' '));
    await L.ctx.close();

    // ?pj=mix: los 4 tipos a la vez contra bots (para comparar y medir en el iPhone y el PC)
    const zone1 = z0.split(';')[0];
    for (const [q, suf] of [['alto', ''], ['medio', '_2k'], ['bajo', '_1k']]) {
      console.log('\nMEZCLA ?pj=mix (' + q.toUpperCase() + ')');
      const X = await open(b, srv.url + '?vm=1&pj=mix', q);
      const ok = await X.p.waitForFunction(() => __SD.BOTS.length >= 4 && __SD.BOTS.slice(0, 3).every(b => b.rig.v2), null, { timeout: 240000 }).then(() => true, () => false);
      const r = await X.p.evaluate(() => __SD.BOTS.slice(0, 4).map(b => ({ pack: b.rig.mixPack, v2: !!b.rig.v2, box: b.rig.root.children.some(c => c.visible && (!b.rig.v2 || c !== b.rig.v2.root)), alive: b.alive })));
      check(q + ': 4 bots, cada uno con su personaje (S.W.A.T., FSB, Military suit y el soldado de cajas)', ok && r.length === 4 && r[0].pack === 'op2' && r[1].pack === 'op3' && r[2].pack === 'op4' && r[3].pack === null && r[0].v2 && r[1].v2 && r[2].v2 && !r[3].v2 && r[3].box && r.every(x => x.alive),
        r.map(x => (x.pack || 'cajas') + (x.v2 ? '·3D' : '')).join(' '));
      const want = ['op2/personaje' + suf + '.glb', 'op3/personaje' + suf + '.glb', 'op4/personaje' + (q === 'bajo' ? '_1k' : '') + '.glb'];
      check(q + ': texturas ' + (suf ? suf.slice(1).toUpperCase() : '4K/2K') + ' para el iPhone y el PC, sin 404 ni errores', want.every(f => X.files.includes(f)) && X.bad.length === 0 && X.errs.length === 0, X.files.filter(f => f.endsWith('.glb')).join(' ') + (X.bad.length ? ' · ' + X.bad[0] : '') + (X.errs.length ? ' · ' + X.errs[0] : ''));
      check(q + ': las zonas de impacto de los 4 bots son las de siempre', (await zones(X.p)).split(';').every(z => z === zone1));
      await X.ctx.close();
    }

    // elegir personaje (27-10-2026): cada uno elige el suyo antes de jugar y el rival online lo ve (servidor local real)
    console.log('\nELEGIR PERSONAJE · ONLINE (MEDIO)');
    const { startServer } = require('../server/node.js');
    const gs = await startServer({ port: 0 });
    const on = async (skin) => {
      const ctx = await b.newContext({ viewport: { width: 667, height: 375 } });
      await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      await ctx.addInitScript(sk => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); localStorage.setItem('sniperduel_skin', JSON.stringify(sk)); } catch (e) {} }, skin);
      const p = await ctx.newPage(), errs = [], files = [];
      p.on('pageerror', e => errs.push(e.message));
      p.on('response', r => { const u = r.url(); if (/\/assets\/personaje\//.test(u) && r.status() >= 400) errs.push(r.status() + ' ' + u); if (/\/assets\/personaje\/pro\/.*\.glb/.test(u)) files.push(u.replace(/^.*\/assets\/personaje\/pro\//, '').replace(/\?.*/, '')); });
      await p.goto(srv.url + '?pj=pro&server=' + encodeURIComponent('http://127.0.0.1:' + gs.port));
      await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
      return { ctx, p, errs, files };
    };
    const OA = await on('fsb'), OB = await on('militar');
    const ui = await OA.p.evaluate(() => ({ shown: !document.getElementById('skinBlock').hidden, name: document.querySelector('#skinBlock .skinPick b').textContent, cards: document.querySelectorAll('#skinGrid .skinCard').length }));
    check('el menú muestra «Tu personaje» con el elegido y la ventana tiene los 5 (con el SOLDADO de ?pj=2)', ui.shown && ui.name === 'FSB' && ui.cards === 5, JSON.stringify(ui));
    await OA.p.click('#mpBtn'); await OA.p.fill('#mpName', 'Hamza'); await OA.p.click('#mpCreate');
    await OA.p.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.getElementById('mpCodeBig').textContent), null, { timeout: 15000 });
    const code = await OA.p.textContent('#mpCodeBig');
    await OB.p.click('#mpBtn'); await OB.p.fill('#mpName', 'Novia'); await OB.p.fill('#mpCode', code); await OB.p.click('#mpJoin');
    const inLobby = await OA.p.waitForFunction(() => /MILITAR/.test(document.getElementById('mpPlayers').textContent) && /FSB/.test(document.getElementById('mpPlayers').textContent), null, { timeout: 15000 }).then(() => true, () => false);
    check('en la sala cada uno ve el personaje del otro', inLobby, await OA.p.textContent('#mpPlayers'));
    // B cambia de personaje en la sala: A lo ve al momento (el SOLDADO, nuevo el 28-10, lo acepta el servidor)
    await OB.p.evaluate(() => __SD.setSkin('soldado'));
    check('B cambia al SOLDADO en la sala y A lo ve', await OA.p.waitForFunction(() => /SOLDADO/.test(document.getElementById('mpPlayers').textContent), null, { timeout: 8000 }).then(() => true, () => false));
    await OB.p.evaluate(() => __SD.setSkin('swat'));
    check('B cambia a S.W.A.T. en la sala y A lo ve', await OA.p.waitForFunction(() => /S\.W\.A\.T\./.test(document.getElementById('mpPlayers').textContent), null, { timeout: 8000 }).then(() => true, () => false));
    await OA.p.click('#mpReady'); await OB.p.click('#mpReady');
    const vA = await OA.p.waitForFunction(() => __SD.REMOTE && __SD.REMOTE.rig.v2 && __SD.REMOTE.rig.skinPack === 'op2', null, { timeout: 180000 }).then(() => true, () => false);
    const vB = await OB.p.waitForFunction(() => __SD.REMOTE && __SD.REMOTE.rig.v2 && __SD.REMOTE.rig.skinPack === 'op3', null, { timeout: 180000 }).then(() => true, () => false);
    check('en la partida A ve a B como S.W.A.T. y B ve a A como FSB (texturas 2K en MEDIO)', vA && vB && OA.files.includes('op2/personaje_2k.glb') && OB.files.includes('op3/personaje_2k.glb'), OA.files.join(' ') + ' | ' + OB.files.join(' '));
    const hz = await OA.p.evaluate(() => __SD.REMOTE.hit.map(m => m.userData.part + ':' + m.position.y).join(' '));
    check('las zonas de impacto del rival son las del servidor (no dependen del personaje)', hz === 'head:1.63 torso:1.17 legs:0.43', hz);
    // cambiar el personaje dibujado vuelve a montar el modelo (CLÁSICO = el de cajas)
    const sw = await OA.p.evaluate(() => { const R = __SD.REMOTE.rig; __SD.pj2SetPack(R, null); const box = !R.v2 && R.root.children.some(c => c.visible); __SD.pj2SetPack(R, 'op2'); return { box, back: !!R.v2 }; });
    check('pasar al CLÁSICO vuelve a la figura de cajas y se puede volver', sw.box && sw.back, JSON.stringify(sw));
    await OA.p.evaluate(() => __SD.pj2SetPack(__SD.REMOTE.rig, 'v2'));
    const sol = await OA.p.waitForFunction(() => __SD.REMOTE.rig.v2 && __SD.PJ2.tpls['assets/personaje/'], null, { timeout: 180000 }).then(() => true, () => false);
    check('el SOLDADO se dibuja con el personaje de ?pj=2 (assets/personaje/)', sol);
    check('sin errores en las dos páginas', OA.errs.length === 0 && OB.errs.length === 0, OA.errs.concat(OB.errs).slice(0, 3).join(' | '));
    await OA.ctx.close(); await OB.ctx.close(); await gs.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
