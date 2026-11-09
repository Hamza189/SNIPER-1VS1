/* RIFLES DISTINTOS (GUNSMITH, 08-11-2026, docs/GUNSMITH.md) en la página real:
   - el ARSENAL enseña las cifras de cada modelo (core/config.js por core/gunstats.js) y su diferencia con el HALCÓN R7
   - contra bots, lo que dice el ARSENAL es lo que pasa en el juego: cargador, cerrojo, recarga, apuntar y velocidad al
     andar, medidos con el reloj del propio juego
   - ?balance=0 vuelve a las cifras de antes (las del HALCÓN para todos los modelos) y ?balance=1 lo deshace
   - el SILENCIADOR: se monta y se guarda por modelo; sin fogonazo, sonido bajo, los bots solo lo oyen cerca, bala −8 %
   - en línea siempre el HALCÓN R7 sin silenciador: lo comprueba test/online.browser.test.js con el servidor de verdad
   Run: node test/rifles.browser.test.js      env GPU=0: WebGL por software */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nRIFLES: playwright no está instalado, se omite'); process.exit(0); }
const ss = require('../tools/static-server.js');
const GS = require('../core/gunstats.js'), CFG = require('../core/config.js');
const ARGS = process.env.GPU === '0' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'];
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const num = (v, dp) => (+v).toFixed(dp || 0).replace('.', ',');
const H = GS.sheet(CFG.rifles.halcon);
// what each row of ESTADÍSTICAS must say for a rifle (the value, without the difference)
const want = S => ({ 'DAÑO · CABEZA': String(S.dmg.head), 'DAÑO · TORSO / PIERNAS': S.dmg.torso + ' / ' + S.dmg.legs, 'CADENCIA': S.rpm + '/min',
  'CARGADOR': String(S.mag), 'RECARGA': num(S.reload, 2) + ' s', 'APUNTAR': num(S.ads, 2) + ' s', 'VELOCIDAD DE LA BALA': S.speed + ' m/s',
  'ALCANCE': S.maxRange + ' m', 'MOVILIDAD': num(S.walk, 2) + ' m/s', 'BALANCEO DE LA MIRA': num(S.sway * 1000, 1) + ' mrad', 'RETROCESO': Math.round(S.recoil / H.recoil * 100) + ' %' });
// the personality the owner asked for (08-11): ▲ better than the HALCÓN R7, ▼ worse
const FEEL = {
  titan: { 'VELOCIDAD DE LA BALA': '▲', 'CARGADOR': '▲', 'APUNTAR': '▼', 'MOVILIDAD': '▼', 'CADENCIA': '▼' },
  ultima: { 'DAÑO · TORSO / PIERNAS': '▲▲', 'CADENCIA': '▼', 'MOVILIDAD': '▼', 'APUNTAR': '▼', 'RETROCESO': '▼' },
  vector: { 'CADENCIA': '▲', 'APUNTAR': '▲', 'RECARGA': '▲', 'MOVILIDAD': '▲', 'DAÑO · CABEZA': '▼', 'BALANCEO DE LA MIRA': '▼' },
  sahara: { 'MOVILIDAD': '▲', 'APUNTAR': '▲', 'RECARGA': '▲', 'DAÑO · TORSO / PIERNAS': '▼' }
};

(async () => {
  const srv = await ss.start(), b = await chromium.launch({ args: ARGS });
  try {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    const boot = async q => { await p.goto(srv.url + (q || ''), { timeout: 180000 });
      await p.waitForFunction(() => window.__SD && __SD.M2 && __SD.M2.room && __SD.VMA.ready, null, { timeout: 180000 }); };
    const arsenal = async () => { await p.evaluate(() => document.querySelector('#m2 .m2Nav [data-tab=armas]').click()); await p.waitForFunction(() => __SD.M2.item, null, { timeout: 60000 }); };
    const pick = id => p.evaluate(id => { document.querySelector('#gsRifles [data-ws=' + id + ']').click(); document.querySelector('#gsTabs [data-gt=stats]').click();
      const rows = {};
      document.querySelectorAll('#gsStats .gsRow').forEach(r => { const v = r.querySelector('b').cloneNode(true), d = [...v.querySelectorAll('em')].map(e => e.classList.contains('up') ? '▲' : '▼');
        v.querySelectorAll('em').forEach(e => e.remove()); rows[r.querySelector('span').textContent] = { v: v.textContent, d: d.join('') }; });
      return { name: document.getElementById('gsName').textContent, role: (document.querySelector('#gsStats .gsRole') || {}).textContent || '', rows }; }, id);
    // the game's own clock: what the weapon does after a shot, a reload, aiming and walking (bots switched off)
    const play = () => p.evaluate(() => { document.querySelector('canvas').requestPointerLock = () => Promise.reject(new Error('sin captura'));
      __SD.setDuelLethal(false); __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); __SD.BOTS.forEach(b => { b.alive = false; b.g.visible = false; }); });
    // sampled every frame; the weapon's own clock (WCORE.t: time in the current state, in game ticks) dates the start and
    // the end of the bolt and the reload exactly, and the aim time is the slope of the ADS progress (it is linear)
    const measure = () => p.evaluate(async () => {
      const S = __SD, fr = () => new Promise(r => requestAnimationFrame(() => r())), o = {};
      const until = async (f, ms) => { const t = performance.now(); while (!f()) { if (performance.now() - t > (ms || 20000)) return false; await fr(); } return true; };
      await until(() => S.state === 'playing' && S.WCORE.state === 'ready');
      o.gun = S.GUNCFG.name; o.mag = S.WCORE.cfg.mag; o.ammo = S.WCORE.ammo; o.pips = document.querySelectorAll('#ammoPips i').length; o.wname = document.getElementById('wname').textContent;
      const span = async st => { await until(() => S.WCORE.state === st); const t0 = S.gameTime - S.WCORE.t; await until(() => S.WCORE.state !== st); return S.gameTime - S.WCORE.t - t0; };
      S.input.firePressed = true; o.bolt = await span('bolt');
      await until(() => S.WCORE.state === 'ready'); S.input.reloadPressed = true; o.reload = await span('reload'); o.ammoAfter = S.WCORE.ammo;
      await until(() => S.WCORE.state === 'ready'); S.input.scope = true;
      await until(() => S.WCORE.ads > 0 && S.WCORE.ads < 1); let a0 = S.WCORE.ads, g0 = S.gameTime, a1 = a0, g1 = g0;
      while (S.WCORE.ads < 1) { a1 = S.WCORE.ads; g1 = S.gameTime; await fr(); }
      o.ads = a1 > a0 ? (g1 - g0) / (a1 - a0) : NaN; S.input.scope = false;
      await until(() => S.WCORE.ads <= 0);
      S.input.keys.KeyW = true; const t0 = S.gameTime; let v = 0;
      while (S.gameTime - t0 < 0.6) { v = Math.max(v, Math.hypot(S.PM.vx, S.PM.vz)); await fr(); }
      S.input.keys.KeyW = false; o.walk = v; o.speedMul = SDMelee.speedMul(S.LOAD, S.WCORE.cfg);
      return o; });
    const near = (a, b, tol) => Math.abs(a - b) <= tol;
    const feel = (m, S, tag) => {
      check(tag + ': cargador ' + S.mag + ' (en el HUD también) y el nombre en el HUD', m.mag === S.mag && m.ammo === S.mag && m.pips === S.mag && m.wname.startsWith(S.name + ' ·'), JSON.stringify({ mag: m.mag, ammo: m.ammo, pips: m.pips, wname: m.wname }));
      check(tag + ': cerrojo ' + num(S.bolt, 2) + ' s', near(m.bolt, S.bolt, 0.01), num(m.bolt, 3) + ' s medidos');
      check(tag + ': recarga ' + num(S.reload, 2) + ' s (y llena el cargador)', near(m.reload, S.reload, 0.01) && m.ammoAfter === S.mag, num(m.reload, 3) + ' s medidos · ' + m.ammoAfter + ' balas');
      check(tag + ': de la cadera a la mira ' + num(S.ads, 2) + ' s', near(m.ads, S.ads, 0.01), num(m.ads, 3) + ' s medidos');
      check(tag + ': andando con el rifle ' + num(S.walk, 2) + ' m/s', near(m.walk, S.walk, 0.08) && near(m.speedMul, S.moveMul, 1e-9), num(m.walk, 2) + ' m/s medidos · ×' + m.speedMul);
    };
    await boot(); await arsenal();

    console.log('\nEL ARSENAL: LAS CIFRAS DE CADA MODELO');
    for (const id of ['halcon', 'titan', 'ultima', 'vector', 'sahara']) {
      const r = await pick(id), S = GS.sheet(CFG.rifles[id]), W = want(S);
      const bad = Object.keys(W).filter(k => !r.rows[k] || r.rows[k].v !== W[k]).map(k => k + ': ' + (r.rows[k] ? r.rows[k].v : '—') + ' ≠ ' + W[k]);
      check(id + ': ' + S.name + ', con sus cifras de core/config.js (' + Object.keys(W).length + ' filas)', r.name === S.name && bad.length === 0, bad.join(' | ') || r.role);
      if (id === 'halcon') check('el HALCÓN R7 no cambia (las cifras de antes) y no lleva diferencias', S.dmg.head === 250 && S.dmg.torso === 85 && S.dmg.legs === 55 && S.bolt === 0.95 && S.mag === 5 && S.reload === 2.35 && S.ads === 0.2 && S.speed === 600 && S.moveMul === 1
        && Object.values(r.rows).every(x => x.d === ''), r.role);
      else { const F = FEEL[id], off = Object.keys(F).filter(k => !r.rows[k] || r.rows[k].d !== F[k]).map(k => k + ' ' + (r.rows[k] ? r.rows[k].d || '=' : '—') + ' ≠ ' + F[k]);
        check(id + ': su personalidad frente al HALCÓN (' + Object.keys(F).map(k => k.toLowerCase() + ' ' + F[k]).join(', ') + ') y que en línea va el HALCÓN', off.length === 0 && /EN LÍNEA: HALCÓN R7/.test(r.role), off.join(' | ') || r.role); }
    }
    const dmg = await p.evaluate(() => { document.querySelector('#gsTabs [data-gt=dmg]').click();
      const o = { rows: [...document.querySelectorAll('#gsStats .gsTbl tr')].slice(1).map(tr => [...tr.children].map(td => td.textContent)), note: document.querySelector('#gsStats .gsNote').textContent };
      document.querySelector('#gsTabs [data-gt=stats]').click(); return o; });
    const T = GS.table(CFG.rifles.sahara);
    check('DAÑO del SAHARA: la tabla de core/gunstats.js con sus cifras, y dice que en línea van las del HALCÓN', dmg.rows.length === T.length && dmg.rows.every((r, i) => r[1] === T[i].head + ' (' + T[i].headShots + ')' && r[2] === T[i].torso + ' (' + T[i].torsoShots + ')' && r[3] === T[i].legs + ' (' + T[i].legsShots + ')' && r[5] === T[i].ms + ' ms')
      && /en línea, las del HALCÓN R7/.test(dmg.note), JSON.stringify(dmg.rows[2]));
    const mag = await p.evaluate(() => { document.querySelector('#gsAcc [data-acc=mag]').click(); return document.getElementById('gsPickL').textContent; });
    check('el CARGADOR del accesorio también es el del modelo (SAHARA: 5 balas, recarga 2,20 s)', /5 balas · recarga 2,20 s/.test(mag), mag);

    console.log('\nCONTRA BOTS: EL VECTOR SE NOTA RÁPIDO');
    await p.evaluate(() => { document.querySelector('#gsPickX').click(); document.querySelector('#gsRifles [data-ws=vector]').click(); document.getElementById('gsSave').click(); });
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('sniperduel_wsRifle')) === 'vector', null, { timeout: 10000 });
    await p.evaluate(() => document.querySelector('#m2 .m2Nav [data-tab=inicio]').click());
    await play();
    const V = GS.sheet(CFG.rifles.vector), mv = await measure();
    feel(mv, V, 'VECTOR');
    check('los bots siguen con el HALCÓN R7 (sus balas y su cerrojo)', await p.evaluate(() => __SD.HALCON === SD_CONFIG.rifles.halcon && __SD.GUNCFG !== __SD.HALCON));

    console.log('\n?balance=0: LAS CIFRAS DE ANTES (EL HALCÓN PARA TODOS), PARA COMPARAR');
    await boot('?balance=0'); await arsenal();
    const old = await pick('vector');
    check('el ARSENAL dice «HALCÓN R7 · VECTOR» con las cifras del HALCÓN, sin diferencias', old.name === 'HALCÓN R7 · VECTOR' && Object.keys(want(H)).every(k => old.rows[k] && old.rows[k].v === want(H)[k] && old.rows[k].d === ''), JSON.stringify(old.rows['CADENCIA']));
    await p.evaluate(() => document.querySelector('#m2 .m2Nav [data-tab=inicio]').click());
    await play();
    const mh = await measure();
    feel(mh, H, 'VECTOR con ?balance=0 = HALCÓN');
    check('se recuerda (sniperduel_balanceOld)', await p.evaluate(() => localStorage.getItem('sniperduel_balanceOld') === 'true' && !__SD.BAL.on));
    await boot('?balance=1');
    check('?balance=1 vuelve a las cifras de cada modelo', await p.evaluate(() => localStorage.getItem('sniperduel_balanceOld') === 'false' && __SD.BAL.on && __SD.rifleCfgFor('vector', false) === SD_CONFIG.rifles.vector && __SD.rifleCfgFor('vector', true) === __SD.HALCON));

    console.log('\nEL SILENCIADOR (contra bots)');
    await arsenal();
    const sv = await p.evaluate(() => { document.querySelector('#gsRifles [data-ws=halcon]').click(); document.querySelector('#gsAcc [data-acc=muzzle]').click();
      const opts = [...document.querySelectorAll('#gsPickL .gsOpt')].map(b => b.dataset.opt).join(); document.querySelector('#gsPick [data-opt=sil]').click(); return opts; });
    await p.waitForTimeout(300);
    const sm = await p.evaluate(() => { let inMenu = false; __SD.M2.item && __SD.M2.item.traverse(o => { if (o.name === 'silenciador' && o.visible) inMenu = true; });
      const v = [...document.querySelectorAll('#gsStats .gsRow')].find(r => r.querySelector('span').textContent === 'VELOCIDAD DE LA BALA');
      return { inMenu, inHands: !!(__SD.SIL.mesh && __SD.SIL.mesh.visible && __SD.SIL.mesh.parent === __SD.GUN), speed: v && v.querySelector('b').textContent, role: (document.querySelector('#gsStats .gsRole') || {}).textContent,
        slot: document.querySelector('#gsAcc [data-acc=muzzle] b').textContent, dirty: !document.getElementById('gsSave').disabled }; });
    check('SILENCIADOR: dos opciones (NINGUNO y SILENCIADOR); se monta en el arma al momento, sin guardarse', sv === 'none,sil' && sm.inMenu && sm.inHands && sm.slot === 'PUESTO' && sm.dirty, JSON.stringify(sm));
    check('y el ARSENAL dice su precio: la bala del HALCÓN a 552 m/s (−48, un 8 % menos)', sm.speed === '552 m/s−48' && /SILENCIADOR/.test(sm.role), sm.speed + ' · ' + sm.role);
    await p.evaluate(() => { document.querySelector('#gsPickX').click(); document.getElementById('gsSave').click(); });
    await p.waitForTimeout(300);
    check('GUARDAR lo guarda en ese modelo', await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('sniperduel_gsCfg')); return c.models.halcon.muzzle === 'sil'; }));
    await boot(); await arsenal();
    check('tras recargar la página sigue montado', await p.evaluate(() => { let n = false; __SD.M2.item && __SD.M2.item.traverse(o => { if (o.name === 'silenciador' && o.visible) n = true; }); return n && __SD.SIL.want; }));
    await p.evaluate(() => document.querySelector('#m2 .m2Nav [data-tab=inicio]').click());
    await play();
    // one bot alive 40 m away: it hears the shot without the silencer (85 m) and not with it (20 m)
    const shoot = () => p.evaluate(async () => {
      const S = __SD, fr = () => new Promise(r => requestAnimationFrame(() => r())), o = {};
      const until = async f => { const t = performance.now(); while (!f()) { if (performance.now() - t > 20000) return false; await fr(); } return true; };
      await until(() => S.state === 'playing' && S.WCORE.state === 'ready');
      const b = S.BOTS[0]; b.alive = true; b.g.visible = true; b.g.position.set(S.PM.x + 40, S.PM.y, S.PM.z); b.alertT = 0; b.spot = 0;
      let sup = 0, open = 0; const s1 = S.SFX.shotSup, s2 = S.SFX.shot; S.SFX.shotSup = () => { sup++; }; S.SFX.shot = () => { open++; };
      const n0 = S.STATS.shots; S.input.firePressed = true; await until(() => S.STATS.shots > n0);
      o.flash = S.STATS.lastFlash; o.light = S.STATS.lastLight; o.alert = b.alertT; o.hear = S.STATS.lastHear; o.sup = sup; o.open = open;
      o.speed = S.GUNCFG.speed; o.sil = !!S.GUNCFG.silenced; o.mesh = !!(S.SIL.mesh && S.SIL.mesh.visible);
      S.SFX.shotSup = s1; S.SFX.shot = s2; b.alive = false; b.g.visible = false; return o; });
    const a = await shoot();
    check('con SILENCIADOR: sin fogonazo ni destello de luz, el sonido bajo, y la bala a 552 m/s', a.sil && a.mesh && a.flash === 0 && a.light === 0 && a.sup === 1 && a.open === 0 && a.speed === 552, JSON.stringify(a));
    check('un bot a 40 m no lo oye (solo a menos de 20 m)', a.hear === 20 && a.alert <= 0, 'alerta ' + a.alert.toFixed(2));
    await p.evaluate(() => { const c = JSON.parse(localStorage.getItem('sniperduel_gsCfg')); c.models.halcon.muzzle = 'none'; localStorage.setItem('sniperduel_gsCfg', JSON.stringify(c)); __SD.applyRifleCfg(); });
    const z = await shoot();
    check('sin él: fogonazo, el tiro de siempre, 600 m/s y el bot a 40 m lo oye (hasta 85 m)', !z.sil && !z.mesh && z.flash > 0 && z.light > 0 && z.open === 1 && z.sup === 0 && z.speed === 600 && z.hear === 85 && z.alert > 0, JSON.stringify(z));
    check('sin errores en la página', errs.length === 0, errs.slice(0, 3).join(' | ') || 'ninguno');
    // back to the defaults for the next tests on this browser
    await p.evaluate(() => { localStorage.removeItem('sniperduel_gsCfg'); localStorage.removeItem('sniperduel_balanceOld'); localStorage.setItem('sniperduel_wsRifle', '"halcon"'); });
    await ctx.close();
  } catch (e) { check('sin excepciones', false, e.message); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
