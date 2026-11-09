/* PENETRACIÓN y BALA DURA contra bots (09-11-2026, core/pen.js, docs/GUNSMITH.md) en la página real:
   - las cajas de los mapas reales son lo que dice core/pen.js (cajas de madera finas, tabiques de yeso medios, hormigón nunca)
   - una bala de rifle del motor del juego (spawnBullet + updateBullets) contra un bot escondido:
       detrás de una caja del PUEBLO: le llega con el 75 % del daño y sin marcador de impacto;
       detrás de un tabique de CASA ATLAS: sin BALA DURA se para; con ella, la mitad del daño;
       un muro de hormigón o un mueble macizo: nunca
   - el ARSENAL enciende y apaga BALA DURA (se recuerda); ?pen=0 lo apaga todo
   Run: node test/pen.browser.test.js      env GPU=0: WebGL por software */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nPENETRACIÓN: playwright no está instalado, se omite'); process.exit(0); }
const ss = require('../tools/static-server.js');
const ARGS = process.env.GPU === '0' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'];
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
(async () => {
  const srv = await ss.start(), b = await chromium.launch({ args: ARGS });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    const boot = async q => { await p.goto(srv.url + (q || ''), { timeout: 180000 }); await p.waitForFunction(() => window.__SD && __SD.M2 && __SD.M2.room && __SD.VMA.ready, null, { timeout: 180000 }); };
    await boot();
    // a match against bots on that map, and a helper: one rifle bullet at a bot hidden right behind box m
    const setup = map => p.evaluate(async map => {
      const S = __SD; document.querySelector('canvas').requestPointerLock = () => Promise.reject(new Error('sin captura'));
      S.setDuelLethal(false); S.setMode('duel'); S.setOffMap(map); S.startMatch(); S.freeze(true);
      const t = performance.now(); while (!(S.state === 'playing' && S.WORLD_ID === map) && performance.now() - t < 60000) await new Promise(r => setTimeout(r, 100));
      const V = THREE.Vector3;
      window.penShot = (m, hard) => {
        const I = S.penBox(m), B = I ? I.box : null; if (!B) return null;
        S.BOTS.forEach((x, i) => { if (i) { x.alive = false; x.g.visible = false; } });
        const bot = S.BOTS[0]; bot.alive = true; bot.g.visible = true; bot.hp = 100;
        const thinX = B.hx <= B.hz, c = Math.cos(B.yaw), s = Math.sin(B.yaw), n = thinX ? new V(c, 0, -s) : new V(s, 0, c), half = thinX ? B.hx : B.hz;
        bot.g.position.set(B.cx + n.x * (half + 1.2), 0, B.cz + n.z * (half + 1.2)); bot.g.updateMatrixWorld(true);
        const tor = bot.hit.find(h => h.userData.part === 'torso'), T = new V(); new THREE.Box3().setFromObject(tor).getCenter(T);
        bot.g.position.y += B.cy - T.y; bot.g.updateMatrixWorld(true); new THREE.Box3().setFromObject(tor).getCenter(T);
        const O = T.clone().addScaledVector(n, -(half + 7.2)), d = T.clone().sub(O).normalize();
        S.PEN.hard = !!hard; S.STATS.lastPen = null; S.STATS.lastPenHit = null; S.BULLETS.length = 0;
        const hm = document.getElementById('hitmark'), cm = document.getElementById('calloutMain'); hm.className = ''; cm.textContent = '';
        const bl = S.spawnBullet(O, d, O.clone(), S.GUNCFG); let k = 0; while (S.BULLETS.length && k < 240) { S.updateBullets(1 / 120); k++; }
        return { surf: I.surf, cls: I.cls, thick: +(2 * half).toFixed(2), dmg: 100 - bot.hp, n: bl.pen ? bl.pen.n : -1, torso: S.GUNCFG.dmg.torso, hit: S.STATS.lastPenHit, marker: hm.className, callout: cm.textContent };
      };
      return S.GUNCFG.dmg.torso;
    }, map);

    console.log('\nQUÉ ATRAVIESA LA BALA EN LOS MAPAS');
    const kinds = await p.evaluate(() => { const S = __SD, out = {};
      for (const w of ['pueblo', 'arena', 'casa']) { S.setWorld(w); const c = {}; for (const m of S.W.ray) { const I = S.penBox(m); if (I) c[I.cls + ':' + I.surf] = (c[I.cls + ':' + I.surf] || 0) + 1; }
        c.concrete = S.W.ray.filter(m => m.userData.surf === 'concrete').map(m => !!S.penBox(m)).filter(Boolean).length; out[w] = c; }
      S.setWorld('pueblo'); return out; });
    check('PUEBLO y ARENA: las cajas de madera son finas; nada más', kinds.pueblo['thin:crate'] > 20 && Object.keys(kinds.pueblo).length === 2 && kinds.arena['thin:crate'] > 5, JSON.stringify([kinds.pueblo, kinds.arena]));
    check('CASA ATLAS: tabiques de yeso (medios), madera y chapa finas; el hormigón nunca', kinds.casa['medium:plaster'] > 40 && kinds.casa['thin:wood'] > 0 && kinds.casa['thin:metal'] > 0 && kinds.casa.concrete === 0, JSON.stringify(kinds.casa));

    console.log('\nUNA CAJA DEL PUEBLO');
    const torso = await setup('pueblo');
    const cr = await p.evaluate(() => { const S = __SD, out = []; for (const m of S.W.ray) { const I = S.penBox(m); if (I && I.surf === 'crate') { const r = penShot(m, false); if (r.n === 1) return r; out.push(r); } } return out[0]; });
    check('la bala atraviesa la caja y llega al bot con el 75 % del daño', cr && cr.n === 1 && cr.dmg === Math.round(torso * 0.75), JSON.stringify(cr));
    check('y ese impacto no da marcador ni aviso (no delata a nadie)', cr && cr.hit && cr.hit.mul === 0.75 && !/on/.test(cr.marker) && cr.callout === '', JSON.stringify(cr && { marker: cr.marker, callout: cr.callout }));

    console.log('\nUN TABIQUE DE CASA ATLAS');
    await p.evaluate(() => { __SD.freeze(false); __SD.toMenu(); });
    await setup('casa');
    const wl = await p.evaluate(() => { const S = __SD; for (const m of S.W.ray) { const I = S.penBox(m); if (!I || I.surf !== 'plaster') continue; const a = penShot(m, false), b = penShot(m, true); if (b.n === 1 && b.dmg > 0) return { a, b }; } return null; });
    check('sin BALA DURA el tabique para la bala', wl && wl.a.dmg === 0 && wl.a.n === 0, JSON.stringify(wl && wl.a));
    check('con BALA DURA lo atraviesa con la mitad del daño', wl && wl.b.dmg === Math.round(wl.b.torso * 0.5), JSON.stringify(wl && wl.b));
    const never = await p.evaluate(() => { const S = __SD, wood = S.W.ray.find(m => m.userData.surf === 'wood' && !S.penBox(m)), con = S.W.ray.filter(m => m.userData.surf === 'concrete');
      return { wood: !!wood, woodPen: wood ? !!S.penBox(wood) : null, concrete: con.length, concretePen: con.some(m => !!S.penBox(m)) }; });
    check('un mueble macizo (madera de más de 12 cm) y el hormigón: nunca, ni con BALA DURA', never.wood && never.woodPen === false && never.concrete > 0 && !never.concretePen, JSON.stringify(never));
    await p.evaluate(() => { __SD.freeze(false); __SD.toMenu(); });

    console.log('\nEL ARSENAL');
    const ar = await p.evaluate(async () => { localStorage.removeItem('sniperduel_balaDura'); __SD.PEN.hard = false; document.querySelector('#m2 .m2Nav [data-tab=armas]').click();
      await new Promise(r => setTimeout(r, 300)); const t0 = document.getElementById('gsPas').textContent;
      document.querySelector('#gsPas [data-pas=dura]').click(); await new Promise(r => setTimeout(r, 200));
      return { off: /CONTRA BOTS/.test(t0) && /ACTIVAR/.test(t0), on: __SD.PEN.hard, saved: localStorage.getItem('sniperduel_balaDura'), txt: document.getElementById('gsPas').textContent }; });
    check('BALA DURA se activa en el ARSENAL (contra bots) y se recuerda', ar.off && ar.on && ar.saved === 'true' && /ACTIVA · CONTRA BOTS/.test(ar.txt) && /QUITAR/.test(ar.txt), JSON.stringify(ar));
    await boot();
    check('tras recargar sigue activa', await p.evaluate(() => __SD.PEN.hard === true));
    await p.evaluate(() => { document.querySelector('#m2 .m2Nav [data-tab=armas]').click(); document.querySelector('#gsPas [data-pas=dura]').click(); });
    check('y se quita igual', await p.evaluate(() => __SD.PEN.hard === false && localStorage.getItem('sniperduel_balaDura') === 'false'));

    console.log('\n?pen=0');
    await boot('?pen=0');
    const off = await p.evaluate(() => { const S = __SD, o = new THREE.Vector3(0, 1, 0), b = S.spawnBullet(o, new THREE.Vector3(1, 0, 0), o.clone(), S.GUNCFG); S.BULLETS.length = 0; return { on: S.PEN.on, pen: b.pen }; });
    check('?pen=0 lo apaga: la bala no lleva penetración', off.on === false && off.pen === null, JSON.stringify(off));
    await boot('?pen=1');
    check('?pen=1 lo vuelve a poner', await p.evaluate(() => __SD.PEN.on === true));
    check('sin errores en la página', errs.length === 0, errs.slice(0, 3).join(' | ') || 'ninguno');
  } catch (e) { check('sin excepciones', false, e.message); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
