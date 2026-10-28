/* 3ª persona (AJUSTES › CONTROLES › Vista, tecla V) en la página real:
   - la cámara va detrás del hombro y se ve tu personaje; el arma de 1ª persona no se dibuja
   - la bala sigue saliendo de los ojos (AIM no se mueve) y la cruceta marca el punto real
   - con la mira, vuelta a 1ª persona exacta; la tecla V cambia de vista y se guarda
   - con ?pj=pro tu cuerpo es el personaje elegido
   Run: node test/tp.browser.test.js   (SHOTS=carpeta para guardar capturas) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    console.log('\n3ª PERSONA');
    const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); localStorage.setItem('sniperduel_skin', '"militar"'); } catch (e) {} });
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + '?vm=1&pj=pro');
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
    await p.evaluate(() => { document.querySelector('canvas').requestPointerLock = () => Promise.reject(new Error('sin captura')); __SD.setDuelLethal(false); __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); });
    await p.waitForTimeout(800);
    await p.keyboard.press('KeyV');
    const ok = await p.waitForFunction(() => __SD.TPV.on && __SD.SELF.g && __SD.SELF.g.visible && __SD.SELF.rig.v2, null, { timeout: 180000 }).then(() => true, () => false);
    const r = await p.evaluate(() => { const S = __SD, c = S.camera.position, d = Math.hypot(c.x - S.AIM.ox, c.y - S.AIM.oy, c.z - S.AIM.oz);
      return { d, view: S.SETTINGS.view, saved: JSON.parse(localStorage.getItem('sniperduel_settings')).view, pack: S.SELF.rig.skinPack, eyeY: S.AIM.oy - S.P.pos.y, cross: document.getElementById('cross').style.transform }; });
    check('la tecla V pasa a 3ª persona y se guarda', ok && r.view === 'tp' && r.saved === 'tp');
    check('la cámara va detrás del hombro (o más cerca si hay pared) y la bala sale de los ojos', r.d > 0.5 && r.d < 2.6 && r.eyeY > 1.4 && r.eyeY < 1.8, 'cámara a ' + r.d.toFixed(2) + ' m de los ojos');
    check('tu cuerpo es el personaje elegido (MILITAR) y la cruceta marca el punto real', r.pack === 'op4' && /translate/.test(r.cross), r.cross);
    if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/tp-quieto.png' });
    // walk forward a moment (the body animates)
    await p.keyboard.down('KeyW'); await p.waitForTimeout(700);
    if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/tp-andando.png' });
    await p.keyboard.up('KeyW');
    // scope: back to exactly the eyes
    await p.evaluate(() => { __SD.input.scope = true; });
    const scoped = await p.waitForFunction(() => __SD.WCORE.ads >= 1 && !__SD.TPV.on, null, { timeout: 8000 }).then(() => true, () => false);
    const r2 = await p.evaluate(() => { const S = __SD, c = S.camera.position; return { d: Math.hypot(c.x - S.AIM.ox, c.y - S.AIM.oy, c.z - S.AIM.oz), body: S.SELF.g.visible }; });
    check('con la mira vuelve a 1ª persona exacta (cámara en los ojos, sin tu cuerpo delante)', scoped && r2.d < 0.02 && !r2.body, r2.d.toFixed(3) + ' m');
    if (process.env.SHOTS) await p.screenshot({ path: process.env.SHOTS + '/tp-mira.png' });
    await p.evaluate(() => { __SD.input.scope = false; });
    await p.waitForTimeout(500);
    await p.keyboard.press('KeyV');
    const fp = await p.waitForFunction(() => !__SD.TPV.on && __SD.TPV.k < 0.05, null, { timeout: 5000 }).then(() => true, () => false);
    check('V otra vez: 1ª persona como siempre', fp && await p.evaluate(() => __SD.SETTINGS.view === 'fp' && document.getElementById('cross').style.transform === ''));
    check('sin errores', errs.length === 0, errs.slice(0, 2).join(' | '));
    await ctx.close();

    console.log('\n3ª PERSONA EN EL MÓVIL (botón en pantalla)');
    const mc = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    await mc.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await mc.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); } catch (e) {} });
    const m = await mc.newPage(), merrs = [];
    m.on('pageerror', e => merrs.push(e.message));
    await m.goto(srv.url + '?vm=1&pj=pro');
    await m.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
    await m.evaluate(() => { __SD.setDuelLethal(false); __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); });
    await m.waitForTimeout(800);
    const vb = await m.evaluate(() => { const e = document.getElementById('tbView'), r = e.getBoundingClientRect(); return { shown: !e.hidden && r.width > 0 && r.top >= 0 && r.left >= 0, label: e.textContent }; });
    await m.tap('#tbView');
    const on = await m.waitForFunction(() => __SD.SETTINGS.view === 'tp' && __SD.TPV.on, null, { timeout: 60000 }).then(() => true, () => false);
    const lbl = await m.textContent('#tbView');
    check('el botón «3ª» se ve en la pantalla y al tocarlo pasa a 3ª persona (y pasa a decir «1ª»)', vb.shown && vb.label === '3ª' && on && lbl === '1ª', JSON.stringify(vb) + ' → ' + lbl);
    if (process.env.SHOTS) { await m.waitForTimeout(1500); await m.screenshot({ path: process.env.SHOTS + '/tp-movil.png' }); }
    await m.tap('#tbView');
    check('otro toque: vuelve a 1ª persona', await m.waitForFunction(() => __SD.SETTINGS.view === 'fp', null, { timeout: 5000 }).then(() => true, () => false) && await m.textContent('#tbView') === '3ª');
    check('móvil sin errores', merrs.length === 0, merrs.slice(0, 2).join(' | '));
    await mc.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
