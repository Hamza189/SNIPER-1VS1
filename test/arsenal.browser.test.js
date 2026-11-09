/* ARMAS · GUNSMITH (08-11-2026, docs/GUNSMITH.md) en la página real:
   - el ARSENAL sustituye a ARMAS (sin el operador: el arma, grande, en el centro); ?arsenal=0 devuelve el de antes
   - elegir es un borrador que se ve al momento y no se guarda; GUARDAR lo guarda (el modelo y, por modelo, su mira);
     RESTABLECER vuelve a lo guardado; salir de ARMAS sin guardar lo deshace; todo sobrevive a recargar la página
   - el selector de mira enseña la mira montada en el MODELO elegido (fotos reales, sin 404); los accesorios sin
     alternativas lo dicen; el camuflaje necesita la cuenta
   - las cifras de ESTADÍSTICAS y DAÑO son las de core/gunstats.js; el cuchillo, las suyas
   - girar (arrastrar) y acercar (rueda); en el móvil en horizontal todo cabe entre las dos barras
   Run: node test/arsenal.browser.test.js      env GPU=0: WebGL por software */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nARSENAL: playwright no está instalado, se omite'); process.exit(0); }
const ss = require('../tools/static-server.js');
const GS = require('../core/gunstats.js'), CFG = require('../core/config.js');
const ARGS = process.env.GPU === '0' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'];
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
(async () => {
  const srv = await ss.start(), b = await chromium.launch({ args: ARGS });
  try {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = [], bad = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (/\/assets\//.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    const open = async () => { await p.waitForFunction(() => window.__SD && __SD.M2 && __SD.M2.room && __SD.VMA.ready, null, { timeout: 180000 });
      await p.evaluate(() => document.querySelector('#m2 .m2Nav [data-tab=armas]').click()); await p.waitForFunction(() => __SD.M2.item, null, { timeout: 60000 }); };
    const full = id => p.waitForFunction(id => { const S = __SD.WS_ST.rifle; return S.cur === id && (id === 'halcon' || (S.objs.length && !S.light)) && __SD.M2.item; }, id, { timeout: 300000 }).then(() => true, () => false);
    const st = () => p.evaluate(() => ({ ws: __SD.WSKIN.rifle, mira: __SD.MIRA.id, sWs: JSON.parse(localStorage.getItem('sniperduel_wsRifle')), sMira: JSON.parse(localStorage.getItem('sniperduel_mira')),
      cfg: JSON.parse(localStorage.getItem('sniperduel_gsCfg')), dirty: document.getElementById('gsDirty').textContent, save: !document.getElementById('gsSave').disabled,
      eq: [...document.querySelectorAll('#gsRifles .gsIt')].filter(x => !x.querySelector('em').hidden).map(x => x.dataset.ws).join(),
      pressed: [...document.querySelectorAll('#gsRifles .gsIt[aria-pressed=true]')].map(x => x.dataset.ws).join() }));
    await p.goto(srv.url, { timeout: 180000 }); await open();

    console.log('\nEL ARSENAL');
    const lay = await p.evaluate(() => { const pane = document.querySelector('#m2 .m2Pane[data-pane=armas]'), slot = document.getElementById('gsSlot').getBoundingClientRect();
      return { gs: pane && pane.classList.contains('gsPane') && !pane.hidden, old: document.querySelector('[data-pane=armasOld]').hidden, op: __SD.M2.pivot.visible, slotH: slot.height / innerHeight, slotW: slot.width / innerWidth,
        rifles: document.querySelectorAll('#gsRifles .gsIt').length, knives: document.querySelectorAll('#gsKnives .gsIt').length, acc: [...document.querySelectorAll('#gsAcc .gsAccB')].map(x => x.dataset.acc).join(),
        camoB: !document.getElementById('gsCamoB').hidden && !!document.getElementById('gsCamoB').closest('.gsTitle') }; });
    check('ARMAS es el ARSENAL: el arma sola y grande en el centro (sin el operador)', lay.gs && lay.old && !lay.op && lay.slotH > 0.4 && lay.slotW > 0.4, JSON.stringify(lay));
    check('5 modelos de rifle y 2 cuchillos; las 5 ranuras de accesorios, y el CAMUFLAJE aparte, junto al nombre del arma', lay.rifles === 5 && lay.knives === 2 && lay.acc === 'mira,mag,bipod,muzzle,grip' && lay.camoB, lay.acc + ' · ' + lay.camoB);
    let s = await st();
    check('al entrar: lo que llevas, marcado como EQUIPADO, y nada sin guardar', s.ws === 'halcon' && s.eq === 'halcon' && s.pressed === 'halcon' && !s.save && s.dirty === '', JSON.stringify(s));

    console.log('\nBORRADOR, GUARDAR, RESTABLECER');
    await p.evaluate(() => document.querySelector('#gsRifles [data-ws=ultima]').click());
    s = await st();
    check('elegir la ÚLTIMA: se pone en el arma al momento, pero no se guarda', s.ws === 'ultima' && s.sWs !== 'ultima' && s.dirty === 'CAMBIOS SIN GUARDAR' && s.save && s.eq === 'halcon', JSON.stringify(s));
    check('y se ve en el arma de muestra (su modelo, no el HALCÓN)', await full('ultima') && await p.evaluate(() => { const body = __SD.WS_ST.rifle.objs[0]; let ok = false; __SD.M2.item.traverse(x => { if (x.isMesh && body) body.traverse(y => { if (y.isMesh && y.geometry === x.geometry) ok = true; }); }); return ok; }));
    const mp = await p.evaluate(async () => { document.querySelector('#gsAcc [data-acc=mira]').click();
      const imgs = [...document.querySelectorAll('#gsPickL img')]; await Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
      return { n: document.querySelectorAll('#gsPickL .gsOpt').length, src: imgs.every(i => /assets\/miras\/ultima\//.test(i.src)), ok: imgs.every(i => i.naturalWidth > 0), open: !document.getElementById('gsPick').hidden }; });
    check('MIRA abre un selector con las 8 miras, en fotos de la ÚLTIMA (no del HALCÓN), todas cargadas', mp.open && mp.n === 8 && mp.src && mp.ok, JSON.stringify(mp));
    await p.evaluate(() => document.querySelector('#gsPick [data-opt=x4]').click()); await p.evaluate(() => { for (let i = 0; i < 3; i++) __SD.advance(16); });
    s = await st();
    const x4 = await p.evaluate(() => { const n = []; __SD.M2.item.traverse(x => n.push(x.name)); return n.includes('mira_x4'); });
    check('elegir el VISOR 4×: en el arma al momento, sin guardarse', s.mira === 'x4' && s.sMira !== 'x4' && x4, JSON.stringify({ mira: s.mira, guardada: s.sMira, enArma: x4 }));
    const one = await p.evaluate(() => { document.querySelector('#gsAcc [data-acc=mag]').click(); const o = [...document.querySelectorAll('#gsPickL .gsOpt')];
      return { n: o.length, txt: o.map(x => x.textContent).join(), note: document.getElementById('gsPickN').textContent }; });
    check('CARGADOR: solo el que existe (ESTÁNDAR, 5 balas) y lo dice', one.n === 1 && /ESTÁNDAR/.test(one.txt) && /5 balas/.test(one.txt) && /única opción/.test(one.note), JSON.stringify(one));
    const cam = await p.evaluate(() => { document.getElementById('gsCamoB').click(); return { n: document.querySelectorAll('#gsPickL .gsOpt').length, note: document.getElementById('gsPickN').textContent }; });
    check('CAMUFLAJE sin cuenta: solo «sin camuflaje» y cómo conseguirlos', cam.n === 1 && /cuenta/.test(cam.note), JSON.stringify(cam));
    await p.evaluate(() => document.getElementById('gsReset').click());
    s = await st();
    check('RESTABLECER: vuelve el HALCÓN con su mira de siempre, sin cambios', s.ws === 'halcon' && s.mira === 'sniper' && !s.save && s.pressed === 'halcon', JSON.stringify(s));
    await p.evaluate(() => { document.querySelector('#gsRifles [data-ws=ultima]').click(); document.querySelector('#gsAcc [data-acc=mira]').click(); document.querySelector('#gsPick [data-opt=x4]').click(); document.getElementById('gsSave').click(); });
    await p.waitForTimeout(300); s = await st();
    check('GUARDAR: la ÚLTIMA con su VISOR 4× queda guardada y EQUIPADA', s.sWs === 'ultima' && s.sMira === 'x4' && s.cfg && s.cfg.models.ultima.mira === 'x4' && s.eq === 'ultima' && !s.save && /GUARDADA/.test(s.dirty), JSON.stringify(s));
    await p.evaluate(() => { document.querySelector('#gsRifles [data-ws=halcon]').click(); });
    s = await st();
    check('cada modelo recuerda su mira: el HALCÓN vuelve con la suya (FRANCOTIRADOR)', s.ws === 'halcon' && s.mira === 'sniper', JSON.stringify(s));
    await p.evaluate(() => { document.querySelector('#gsRifles [data-ws=vector]').click(); document.querySelector('#m2 .m2Nav [data-tab=inicio]').click(); });
    s = await st();
    check('salir de ARMAS sin guardar: vuelve lo guardado (la ÚLTIMA con el 4×)', s.ws === 'ultima' && s.mira === 'x4' && s.sWs === 'ultima', JSON.stringify({ ws: s.ws, mira: s.mira }));
    await p.evaluate(() => document.querySelector('#m2 .m2Nav [data-tab=armas]').click());
    s = await st();
    check('y al volver lo dice', /NO GUARDASTE/.test(s.dirty) && s.pressed === 'ultima', s.dirty);

    console.log('\nCIFRAS');
    const stats = await p.evaluate(() => { const o = {}; o.stats = document.getElementById('gsStats').textContent; document.querySelector('#gsTabs [data-gt=dmg]').click();
      o.rows = [...document.querySelectorAll('#gsStats .gsTbl tr')].slice(1).map(tr => [...tr.children].map(td => td.textContent)); document.querySelector('#gsTabs [data-gt=stats]').click(); return o; });
    const T = GS.table(CFG.rifles.ultima), r0 = stats.rows[0] || [], rl = stats.rows[stats.rows.length - 1] || [];
    check('ESTADÍSTICAS de la ÚLTIMA (sus cifras contra bots, con la diferencia con el HALCÓN): 95 / 70, 52/min, 680 m/s, 450 m; y que en línea va el HALCÓN', /95\+10 \/ 70\+15/.test(stats.stats) && /52\/min−11/.test(stats.stats) && /680 m\/s\+80/.test(stats.stats) && /450 m/.test(stats.stats) && /EN LÍNEA: HALCÓN R7/.test(stats.stats), stats.stats.slice(0, 160));
    check('DAÑO: la tabla es la de core/gunstats.js (daño, disparos para eliminar, caída y vuelo)', stats.rows.length === T.length && r0[0] === T[0].d + ' m' && r0[2] === T[0].torso + ' (' + T[0].torsoShots + ')' && rl[4] === T[T.length - 1].dropCm + ' cm' && rl[5] === T[T.length - 1].ms + ' ms', JSON.stringify([r0, rl]));
    const kn = await p.evaluate(async () => { document.querySelector('#gsKnives [data-ws=tactica]').click(); await new Promise(r => setTimeout(r, 200));
      return { acc: document.getElementById('gsAcc').hidden, stats: document.getElementById('gsStats').textContent, name: document.getElementById('gsName').textContent }; });
    check('ARMA DE MANO: el cuchillo sin accesorios y con sus cifras (50 de frente, 100 por la espalda)', kn.acc && /50 · 100/.test(kn.stats) && kn.name === 'TÁCTICA', JSON.stringify(kn));
    await p.evaluate(() => { document.getElementById('gsReset').click(); document.querySelector('#gsRifles [data-ws=ultima]').click(); });

    console.log('\nCAMUFLAJE EN VIVO (con una cuenta que los tiene todos)');
    await p.evaluate(() => { document.getElementById('gsReset').click(); __SD.ACC.acc = { name: 'prueba', inv: { items: SDItems.ITEMS.filter(i => i.type === 'camo').map(i => i.id), equip: {}, boxes: 0, pts: 0, daily: false, dailyIn: 0, botsLeft: 0 } }; });
    const painted = () => p.evaluate(() => { const n = new Set(); __SD.M2.item && __SD.M2.item.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => { if (m.customProgramCacheKey && m.customProgramCacheKey() === 'sdcamo') n.add(m.name); }); }); return n.size; });
    const lv = await p.evaluate(async () => { const fr = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      document.getElementById('gsCamoB').click(); await fr(); await fr();
      const box = document.getElementById('gsPick'), pr = box.getBoundingClientRect(), slot = document.getElementById('gsSlot').getBoundingClientRect();
      // where the weapon is drawn: its centre, projected with the menu camera
      const c = new THREE.Vector3(); new THREE.Box3().setFromObject(__SD.M2.item).getCenter(c); c.project(__SD.M2.cam);
      const y = (1 - c.y) / 2 * innerHeight;
      return { strip: box.classList.contains('strip') && !box.hidden, n: document.querySelectorAll('#gsPickL .gsOpt').length, oneRow: new Set([...document.querySelectorAll('#gsPickL .gsOpt')].map(o => Math.round(o.getBoundingClientRect().top))).size === 1,
        above: y < pr.top - 20 && y > slot.top, stripH: Math.round(pr.height) }; });
    check('CAMUFLAJE abre una tira abajo (una fila, los 23) y el arma sube por encima: se ve entera', lv.strip && lv.n === 23 && lv.oneRow && lv.above, JSON.stringify(lv));
    await p.evaluate(() => document.querySelector('#gsPick [data-opt=camo_oro_rejilla]').click()); await p.waitForTimeout(300);
    const c1 = await p.evaluate(() => ({ open: !document.getElementById('gsPick').hidden, val: document.getElementById('gsCamoV').textContent, dirty: document.getElementById('gsDirty').textContent }));
    const n1 = await painted();
    check('tocar uno lo pinta al momento y la tira sigue abierta (sin guardar)', c1.open && c1.val === 'REJILLA DE ORO' && n1 > 0 && c1.dirty === 'CAMBIOS SIN GUARDAR', JSON.stringify(c1) + ' · materiales ' + n1);
    const sl = await p.evaluate(() => document.getElementById('gsPickL').scrollLeft);
    const sb = await p.evaluate(() => { const r = document.getElementById('gsSlot').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40 }; });
    await p.mouse.move(sb.x, sb.y); await p.mouse.down(); await p.mouse.move(sb.x + 80, sb.y, { steps: 4 }); await p.mouse.up();
    await p.evaluate(() => document.querySelector('#gsPick [data-opt=camo_tigre]').click()); await p.waitForTimeout(300);
    const cB = await p.evaluate(() => ({ open: !document.getElementById('gsPick').hidden, val: document.getElementById('gsCamoV').textContent, sl: document.getElementById('gsPickL').scrollLeft }));
    check('girar el arma no la cierra; y otro camuflaje lo cambia al momento, sin perder el sitio de la tira', cB.open && cB.val === 'TIGRE' && cB.sl === sl && await painted() > 0, JSON.stringify(cB));
    await p.evaluate(() => document.querySelector('#gsPick [data-opt=""]').click()); await p.waitForTimeout(200);
    check('«SIN CAMUFLAJE» devuelve el acabado del modelo', await painted() === 0 && await p.evaluate(() => document.getElementById('gsCamoV').textContent) === 'SIN CAMUFLAJE');
    const kc = await p.evaluate(async () => { document.querySelector('#gsKnives [data-ws=tactica]').click();
      const t = performance.now(); while (!(__SD.WS_ST.knife.cur === 'tactica' && __SD.WS_ST.knife.objs.length) && performance.now() - t < 60000) await new Promise(r => setTimeout(r, 100));
      const o = { open: !document.getElementById('gsPick').hidden, btn: !document.getElementById('gsCamoB').hidden };
      document.querySelector('#gsPick [data-opt=camo_dragon]').click(); await new Promise(r => setTimeout(r, 300));
      let n = 0; __SD.WS_ST.knife.objs.forEach(r => r.traverse(m => { if (m.isMesh && [].concat(m.material).some(x => x.customProgramCacheKey && x.customProgramCacheKey() === 'sdcamo')) n++; }));
      o.painted = n; o.val = document.getElementById('gsCamoV').textContent;
      document.getElementById('gsSave').click(); await new Promise(r => setTimeout(r, 300));
      o.saved = JSON.parse(localStorage.getItem('sniperduel_gsCfg')).knives;
      document.querySelector('#gsKnives [data-ws=navaja]').click(); await new Promise(r => setTimeout(r, 200));
      o.navBtn = document.getElementById('gsCamoB').hidden; o.navPick = document.getElementById('gsPick').hidden; return o; });
    check('ARMA DE MANO: la TÁCTICA también se pinta (hoja y mango) y se guarda; la NAVAJA no lleva camuflaje', kc.open && kc.btn && kc.painted === 2 && kc.val === 'DRAGÓN' && kc.saved && kc.saved.tactica && kc.saved.tactica.camo === 'camo_dragon' && kc.navBtn && kc.navPick, JSON.stringify(kc));
    await p.evaluate(() => { document.querySelector('#gsKnives [data-ws=tactica]').click(); document.getElementById('gsSave').click(); document.querySelector('#gsRifles [data-ws=ultima]').click(); });
    await p.waitForTimeout(300);

    console.log('\nGIRAR Y ACERCAR');
    const box = await p.evaluate(() => { const r = document.getElementById('gsSlot').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const y0 = await p.evaluate(() => [__SD.M2.wYaw, __SD.M2.wPitch || 0, __SD.M2.wZoom || 1]);
    await p.mouse.move(box.x, box.y); await p.mouse.down(); await p.mouse.move(box.x + 120, box.y + 40, { steps: 6 }); await p.mouse.up();
    await p.mouse.wheel(0, -400); await p.waitForTimeout(200);
    const y1 = await p.evaluate(() => [__SD.M2.wYaw, __SD.M2.wPitch || 0, __SD.M2.wZoom || 1]);
    check('arrastrar gira el arma (de lado y arriba/abajo) y la rueda la acerca', y1[0] - y0[0] > 0.5 && y1[1] > y0[1] && y1[2] > y0[2] * 1.3, JSON.stringify({ antes: y0.map(v => +v.toFixed(2)), despues: y1.map(v => +v.toFixed(2)) }));

    console.log('\nRECARGAR');
    await p.reload(); await open();
    s = await st();
    check('tras recargar la página: la ÚLTIMA con su 4×, guardada y equipada', s.ws === 'ultima' && s.mira === 'x4' && s.eq === 'ultima' && !s.save, JSON.stringify({ ws: s.ws, mira: s.mira, eq: s.eq }));
    const kr = await p.evaluate(async () => { const t = performance.now(); while (!(__SD.WS_ST.knife.cur === 'tactica' && __SD.WS_ST.knife.objs.length && !__SD.WS_ST.knife.light) && performance.now() - t < 60000) await new Promise(r => setTimeout(r, 100));
      let n = 0; __SD.WS_ST.knife.objs.forEach(r => r.traverse(m => { if (m.isMesh && [].concat(m.material).some(x => x.customProgramCacheKey && x.customProgramCacheKey() === 'sdcamo')) n++; })); return n; });
    check('y la TÁCTICA de la mano (la de la partida) sigue con su DRAGÓN', kr === 2, kr + ' piezas pintadas');
    check('sin errores ni archivos que falten', errs.length === 0 && bad.length === 0, errs.concat(bad).slice(0, 3).join(' | ') || 'ninguno');
    // back to the defaults for the next tests on this browser
    await p.evaluate(() => { localStorage.removeItem('sniperduel_gsCfg'); localStorage.setItem('sniperduel_wsRifle', '"halcon"'); localStorage.setItem('sniperduel_mira', '"sniper"'); });
    await p.goto(srv.url + '?arsenal=0'); await p.waitForFunction(() => window.__SD && __SD.M2 && __SD.M2.room, null, { timeout: 180000 });
    const old = await p.evaluate(() => { document.querySelector('#m2 .m2Nav [data-tab=armas]').click(); const pane = document.querySelector('#m2 .m2Pane[data-pane=armas]');
      return { oldPane: pane && !pane.classList.contains('gsPane') && !pane.hidden, rows: document.querySelectorAll('#m2Miras .m2W').length, stored: localStorage.getItem('sniperduel_arsenalOld') }; });
    check('?arsenal=0 devuelve el ARMAS de antes (y se recuerda)', old.oldPane && old.rows === 8 && old.stored === 'true', JSON.stringify(old));
    await p.goto(srv.url + '?arsenal=1'); await ctx.close();

    console.log('\nMÓVIL EN HORIZONTAL (844 × 390)');
    const c2 = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await c2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const q = await c2.newPage(), e2 = []; q.on('pageerror', e => e2.push(e.message));
    await q.goto(srv.url, { timeout: 180000 }); await q.waitForFunction(() => window.__SD && __SD.M2 && __SD.M2.room && __SD.VMA.ready, null, { timeout: 180000 });
    const ph = await q.evaluate(() => { document.querySelector('#m2 .m2Nav [data-tab=armas]').click();
      const navTop = document.querySelector('#m2 .m2Nav').getBoundingClientRect().top, inside = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= navTop + 1; };
      const must = [...document.querySelectorAll('#gsAcc .gsAccB, #gsCamoB, #gsSave, #gsReset, #gsTabs button')];
      const cut = [...document.querySelectorAll('#gsSave, #gsReset')].filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.id);
      return { fit: must.every(inside), cut, slotH: Math.round(document.getElementById('gsSlot').getBoundingClientRect().height), noScroll: document.documentElement.scrollWidth <= innerWidth,
        saveH: document.getElementById('gsSave').getBoundingClientRect().height }; });
    check('accesorios, pestañas y botones caben entre las dos barras, sin texto cortado ni desplazar la pantalla', ph.fit && ph.cut.length === 0 && ph.noScroll, JSON.stringify(ph));
    check('y queda sitio para ver el arma (más de 120 px de alto)', ph.slotH > 120, ph.slotH + ' px');
    const pc = await q.evaluate(async () => { document.getElementById('gsCamoB').click(); await new Promise(r => setTimeout(r, 300));
      const L = document.getElementById('gsPickL'), pr = document.getElementById('gsPick').getBoundingClientRect(), slot = document.getElementById('gsSlot').getBoundingClientRect();
      return { open: !document.getElementById('gsPick').hidden, h: Math.round(pr.height), free: Math.round(pr.top - slot.top), scrolls: L.scrollWidth >= L.clientWidth, inside: pr.bottom <= document.querySelector('#m2 .m2Nav').getBoundingClientRect().top + 1 }; });
    check('la tira de camuflajes cabe y deja el arma a la vista (más de 90 px por encima)', pc.open && pc.inside && pc.free > 90, JSON.stringify(pc));
    check('sin errores (móvil)', e2.length === 0, e2.slice(0, 3).join(' | '));
    await c2.close();
  } catch (e) { check('sin excepciones', false, e.message); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
