/* MIRAS en el juego (31-10-2026): cada mira con su aumento, su retícula y su cuadro, montada en el rifle, y la de
   siempre sin cambios.
   - por defecto: FRANCOTIRADOR 4×/8× y nada cambia (la mira de siempre del HALCÓN entera, el apuntado de siempre)
   - cada mira: el campo de visión es el de su aumento; el cuadro (tubo, prisma o ventana); el rifle oculto con el visor y
     a la vista con el punto rojo y la holográfica; el botón de zoom gira sus aumentos; el modelo en el riel; la mira de
     siempre quitada del HALCÓN y devuelta al volver a FRANCOTIRADOR
   - con la mira puesta, el centro de la pantalla sigue siendo donde va la bala (autotest de puntería) y la retícula se
     dibuja con el color del punto
   - aspectos de rifle (TITÁN, ÚLTIMA, VECTOR, SAHARA): su mira se quita y vuelve
   - se guarda en el dispositivo; sin errores
   Run: node test/miras.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && /shader|WebGLProgram|GLSL|mira/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await p.goto(srv.url + (process.env.PAGE || '') + '?ktx2=0', { timeout: 180000 });   // env PAGE=otra.html: another build
    await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 180000 });
    await p.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });

    console.log('\nPOR DEFECTO');
    const d0 = await p.evaluate(() => { const S = __SD, out = { id: S.MIRA.id, model: !!S.MIRA.model, ads: -S.WS.zoom };
      let full = 0, cut = 0; S.VMA.R.root.traverse(o => { if (o.isMesh && /^r_body/.test(o.name + (o.parent ? o.parent.name : ''))) { if (o.geometry.userData.miraKept) cut++; else full++; } });
      return Object.assign(out, { full, cut, zoom: S.WS.zoom, cls: document.getElementById('scope').className, pick: document.querySelector('.miraPick b').textContent }); });
    check('FRANCOTIRADOR por defecto: la mira del HALCÓN entera, sin modelo nuevo, 8× fijo y el cuadro de siempre', d0.id === 'sniper' && !d0.model && d0.full > 0 && d0.cut === 0 && d0.zoom === 8 && /k-tube/.test(d0.cls) && /FRANCOTIRADOR/.test(d0.pick), JSON.stringify(d0));

    await p.evaluate(async () => { __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.setOffMap('arena'); __SD.startMatch();
      const t = performance.now(); while (!(__SD.state === 'playing' && __SD.LOAD.phase === 'ready') && performance.now() - t < 90000) await new Promise(r => setTimeout(r, 100)); });

    const aim = id => p.evaluate(async id => {
      const S = __SD, w = ms => new Promise(r => setTimeout(r, ms));
      S.setMira(id); S.input.scopeToggle = true;
      const t = performance.now(); while (S.WCORE.ads < 0.999 && performance.now() - t < 6000) await w(50);
      // the zoom settles (damped; with the software WebGL a frame can take longer than 0.1 s and the game's clock slows down)
      const base = window.__BASEFOV, t1 = performance.now(); while (Math.abs(S.camera.fov * S.WS.zoom / base - 1) > 0.01 && performance.now() - t1 < 10000) await w(50);
      await w(200);
      const sc = document.getElementById('scope'), cls = sc.className, hidden = sc.hidden, fov = S.camera.fov, vm = S.WROOT.visible;
      const st = S.aimSelfTest ? S.aimSelfTest() : null;
      const R = { fov, zoom: S.WS.zoom, cls, hidden, vm, model: !!S.MIRA.model && S.MIRA.model.visible && S.MIRA.model.parent === S.WROOT.children[0],
        axis: S.MIRA.place.axisY, lit: document.getElementById('retLit').getAttribute('d').length, ring: document.getElementById('retRing').getAttribute('d').length,
        dot: +document.getElementById('retDot').getAttribute('r'), dotCol: document.getElementById('retDot').getAttribute('fill'), litCol: document.getElementById('retLit').getAttribute('fill'),
        self: Array.isArray(st) ? st[0] : '' };
      R.zooms = [S.WS.zoom]; R.cssR = sc.style.getPropertyValue('--r'); R.cssRs = sc.style.getPropertyValue('--rs');
      let full = 0, cut = 0, kept = 0, from = 0; S.VMA.R.root.traverse(o => { if (o.isMesh && /^r_body/.test(o.name + (o.parent ? o.parent.name : ''))) { const u = o.geometry.userData; if (u.miraKept) { cut++; kept += u.miraKept; from += u.miraFrom; } else full++; } });
      R.cut = cut; R.full = full; R.keptPct = from ? Math.round(kept / from * 1000) / 10 : 100;
      // every triangle that is not the scope is still there (centre at or under the cut, or outside its stretch of the rifle),
      // and none of the scope's is: counted again on the original geometry of each recut mesh
      const box = SDMiras.RIFLES.halcon.strip.box, inv = new THREE.Matrix4().copy(S.WROOT.children[0].matrixWorld).invert(), m4 = new THREE.Matrix4(), v = new THREE.Vector3();
      let should = 0, have = 0;
      for (const e of S.MIRA.strip) { if (!e.geo) continue; const g = e.geo, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
        m4.multiplyMatrices(inv, e.mesh.matrixWorld);
        for (let i = 0; i + 2 < n; i += 3) { const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
          v.set((pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3).applyMatrix4(m4);
          if (!(v.y > box[2] && v.z > box[0] && v.z < box[1])) should++; }
        have += e.mesh.geometry.index.count / 3; }
      R.should = should; R.have = have;
      S.input.scopeToggle = false; await w(600);
      return R;
    }, id);

    console.log('\nCADA MIRA, APUNTANDO');
    const ids = await p.evaluate(() => SDMiras.ORDER);
    const BASE = await p.evaluate(() => { const c = __SD.camera; return window.__BASEFOV = c.fov; });
    for (const id of ids) {
      const O = await p.evaluate(id => SDMiras.get(id), id), R = await aim(id);
      const z0 = O.zooms[O.zooms.length - 1], fovOk = Math.abs(R.fov * z0 - BASE) / BASE < 0.04;
      const kindOk = new RegExp('k-' + O.kind).test(R.cls) && !R.hidden, vmOk = O.kind === 'reflex' ? R.vm : !R.vm;
      const cyc = O.zooms.length > 1 ? R.zooms.join() === [z0, ...O.zooms, O.zooms[0]].slice(0, 4).join() || new Set(R.zooms).size === O.zooms.length : R.zooms.every(z => z === z0);
      const modelOk = O.builtin ? !R.model && R.cut === 0 : R.model && R.cut > 0 && R.should === R.have && R.have > 0 && R.keptPct < 99.5;
      check(O.name + ': campo de visión de ' + z0 + '× y cuadro ' + O.kind + (O.kind === 'reflex' ? ' con el rifle a la vista' : ' con el rifle oculto'), fovOk && kindOk && vmOk, 'fov ' + R.fov.toFixed(2) + ' · ' + R.cls + ' · rifle ' + R.vm);
      check(O.name + ': un solo aumento (' + O.zooms.join() + '×)', cyc, R.zooms.join(' → '));
      if (O.kind === 'reflex') { const want = await p.evaluate(() => (SDMiras.windowFrac(__SD.MIRA.id, __SD.MIRA.place) * 50).toFixed(2) + 'vh');
        check(O.name + ': la retícula ocupa la ventana de la mira, medida desde el ojo', R.cssR === want, R.cssR + ' · ' + want); }
      if (O.kind === 'tube') check(O.name + ': su círculo de ' + O.ring + ' vmin y su borde', R.cssR === 'min(' + O.ring + 'vmin,' + O.ring + 'vh)' && +R.cssRs === O.rs, R.cssR + ' · ' + R.cssRs);
      check(O.name + (O.builtin ? ': la mira de siempre entera, ningún modelo nuevo' : ': su modelo en el riel; de la mira de siempre no queda nada y del resto del HALCÓN no falta nada'), modelOk, JSON.stringify({ model: R.model, cut: R.cut, kept: R.keptPct + ' %', should: R.should, have: R.have, axis: +R.axis.toFixed(4) }));
      check(O.name + ': el centro de la pantalla = dirección del disparo (autotest)', /✔/.test(R.self), R.self.slice(0, 90));
      if (O.reticle === 'chevron') check(O.name + ': chevrón dibujado con el color del punto', R.lit > 10 && R.litCol === R.dotCol);
      if (O.reticle === 'holo') check(O.name + ': anillo y punto central', R.ring > 10 && R.dot > 0.5, JSON.stringify({ ring: R.ring, dot: R.dot }));
      if (O.reticle === 'dot') check(O.name + ': solo el punto (sin cruz) y con halo', R.dot > 0.5 && R.lit === 0 && R.ring === 0, JSON.stringify({ dot: R.dot, lit: R.lit, ring: R.ring }));
    }

    console.log('\nBOTÓN DE MIRA (02-11-2026: un toque, la siguiente)');
    const bt = await p.evaluate(async () => { const S = __SD, w = ms => new Promise(r => setTimeout(r, ms)), seq = [];
      S.setMira('tactica'); for (let i = 0; i < 6; i++) { S.btnPress('zoom', true); S.btnPress('zoom', false); seq.push(S.MIRA.id); }
      S.input.scopeToggle = true; const t = performance.now(); while (S.WCORE.ads < 0.999 && performance.now() - t < 6000) await w(50);
      S.btnPress('zoom', true); S.btnPress('zoom', false); const aimed = { id: S.MIRA.id, zoom: S.WS.zoom, ads: S.WCORE.ads };
      S.input.scopeToggle = false; await w(600); return { seq, aimed }; });
    check('cada toque pone la siguiente mira, de la 12× vuelve al punto rojo', bt.seq.join() === 'x4,x6,sniper,largo,punto,holo', bt.seq.join(' → '));
    check('también apuntando: cambia al momento, con su aumento, sin dejar de apuntar', bt.aimed.id === 'x2' && bt.aimed.zoom === 2 && bt.aimed.ads > 0.99, JSON.stringify(bt.aimed));

    console.log('\nVOLVER A LA DE SIEMPRE Y GUARDAR');
    const back = await p.evaluate(() => { const S = __SD; S.setMira('sniper'); let cut = 0; S.VMA.R.root.traverse(o => { if (o.isMesh && o.geometry.userData.miraKept) cut++; });
      return { cut, model: !!S.MIRA.model, ads: S.MIRA.place.axisY, saved: localStorage.getItem('sniperduel_mira') }; });
    check('FRANCOTIRADOR otra vez: la mira del HALCÓN vuelve entera y el apuntado de siempre', back.cut === 0 && !back.model && Math.abs(back.ads - 0.068) < 1e-9, JSON.stringify(back));
    await p.evaluate(() => __SD.setMira('holo'));
    check('la elección se guarda en el dispositivo', await p.evaluate(() => JSON.parse(localStorage.getItem('sniperduel_mira')) === 'holo'));

    console.log('\nMENÚ DE MIRAS');
    const ui = await p.evaluate(() => { __SD.openMiras(); const cards = [...document.querySelectorAll('#miraGrid .skinCard')];
      const r = { n: cards.length, on: cards.filter(c => c.getAttribute('aria-pressed') === 'true').map(c => c.dataset.mira), desc: document.getElementById('miraDesc').textContent };
      cards.find(c => c.dataset.mira === 'x2').click(); r.after = __SD.MIRA.id; __SD.closeMiras(); r.closed = document.getElementById('miraOv').hidden; return r; });
    check('8 fichas, la elegida marcada, tocar una la pone al momento', ui.n === 8 && ui.on.join() === 'holo' && /HOLOGRÁFICA/.test(ui.desc) && ui.after === 'x2' && ui.closed, JSON.stringify(ui));
    check('sin errores', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();

    console.log('\nASPECTOS DE RIFLE (?pj=pro)');
    const c2 = await b.newContext({ viewport: { width: 960, height: 540 } });
    await c2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await c2.addInitScript(() => { try { localStorage.setItem('sniperduel_mira', JSON.stringify('punto')); } catch (e) {} });
    const q = await c2.newPage(), e2 = [];
    q.on('pageerror', e => e2.push(e.message));
    await q.goto(srv.url + (process.env.PAGE || '') + '?pj=pro&ktx2=0', { timeout: 180000 });
    await q.waitForFunction(() => window.__SD && __SD.VMA.ready, null, { timeout: 180000 });
    for (const [skin, dir] of [['titan', 'titan'], ['ultima', 'ratio'], ['vector', 'vector'], ['sahara', 'lince']]) {
      const r = await q.evaluate(async ([skin, dir]) => { const S = __SD; S.setWskin('rifle', skin);
        const t = performance.now(); while (!(S.WS_ST.rifle.objs.length && !S.WS_ST.rifle.light && S.miraRifle() === dir) && performance.now() - t < 60000) await new Promise(r => setTimeout(r, 100));
        let hid = 0, cut = 0; const body = S.WS_ST.rifle.objs[0]; if (body) body.traverse(o => { if (!o.isMesh) return; if (!o.visible) hid++; if (o.geometry.userData.miraKept) cut++; });
        const on = { rifle: S.miraRifle(), hid, cut, model: !!S.MIRA.model && S.MIRA.model.visible, axis: +S.MIRA.place.axisY.toFixed(4) };
        S.setMira('sniper'); let hid2 = 0, cut2 = 0; if (body) body.traverse(o => { if (!o.isMesh) return; if (!o.visible) hid2++; if (o.geometry.userData.miraKept) cut2++; });
        on.back = hid2 + cut2; S.setMira('punto'); return on; }, [skin, dir]);
      check(skin.toUpperCase() + ': su mira quitada (piezas ocultas o recortadas) y el punto rojo montado; vuelve con FRANCOTIRADOR', r.rifle === dir && (r.hid + r.cut) > 0 && r.model && r.back === 0, JSON.stringify(r));
    }
    check('sin errores (aspectos)', e2.length === 0, e2.slice(0, 3).join(' | '));
    await c2.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
