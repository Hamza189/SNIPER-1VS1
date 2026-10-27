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
    console.log('\nSIN BANDERA');
    const off = await open(b, srv.url + '?vm=1', 'alto');
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
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
