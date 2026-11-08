/* MENÚ 2 en el juego (?menu=2, 02-11-2026): el menú nuevo, botón por botón, y el de siempre intacto.
   - el enlace normal abre el menú nuevo (por defecto desde el 03-11-2026); ?menu=1, el de antes, intacto
   - ?menu=2: la sala 3D con tu operador y tu rifle; las cinco secciones de la barra de abajo
   - INICIO: MULTIJUGADOR abre las salas, VS BOTS y CAMPO DE TIRO son los modos del juego, OPCIONES DE PARTIDA lleva
     los bloques del menú de siempre (dificultad, tiempo, bots de entrenamiento, arma principal, sensibilidad)
   - PERSONAJE: cada operador se elige, se guarda y lo lleva el de la sala
   - ARMAS: mira, skin y cuchillo se eligen con los del juego, se guardan y se ven en el arma de muestra y en sus manos
   - MAPAS: con vistas reales; el elegido es el de VS BOTS
   - AJUSTES: los de siempre, y al cerrarlos vuelves a donde estabas
   - JUGAR: empieza la partida, la sala se libera; al volver al menú, vuelve
   - móvil en horizontal: todo cabe, JUGAR y la barra a la vista
   - ?menu=1 devuelve el menú de siempre; sin errores
   Run: node test/menu2.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const wait = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 120000 });

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });

    console.log('\n?menu=1: EL MENÚ DE ANTES');
    await p.goto(srv.url + '?ktx2=0&menu=1', { timeout: 180000 });
    await wait(p, () => window.__SD && __SD.WORLDS && __SD.VMA.ready);
    const d0 = await p.evaluate(() => ({ m2: !document.getElementById('m2').hidden, cls: document.body.classList.contains('m2'), inner: getComputedStyle(document.querySelector('#menu .menuInner')).display, diff: !!document.querySelector('#menu .menuInner #diffBlock'), room: !!__SD.M2.room }));
    check('con ?menu=1 no hay nada del menú nuevo y los bloques siguen en su sitio', !d0.m2 && !d0.cls && d0.inner !== 'none' && d0.diff && !d0.room, JSON.stringify(d0));

    console.log('\nEL MENÚ NUEVO (?menu=2 lo vuelve a poner tras ?menu=1)');
    await p.goto(srv.url + '?ktx2=0&menu=2&arsenal=0', { timeout: 180000 });   // ARMAS of before (the ARSENAL: test/arsenal.browser.test.js)
    await wait(p, () => window.__SD && __SD.VMA.ready && __SD.M2.room && __SD.M2.held);
    const d1 = await p.evaluate(() => { const S = __SD; S.advance(16); const r = S.renderer.info.render;
      return { m2: !document.getElementById('m2').hidden, inner: getComputedStyle(document.querySelector('#menu .menuInner')).display, tabs: [...document.querySelectorAll('#m2 .m2Nav button')].map(x => x.textContent.trim()).join('|'),
        sel: document.querySelector('#m2 .m2Nav [aria-selected=true]').dataset.tab, calls: r.calls, tris: r.triangles, held: !!S.M2.held && !!S.M2.held.parent, op: !!S.M2.R && S.M2.R.root.parent === S.M2.pivot,
        stored: localStorage.getItem('sniperduel_menuOld') }; });
    check('se ve el menú nuevo y no el de siempre', d1.m2 && d1.inner === 'none', JSON.stringify(d1));
    check('barra de abajo: INICIO | PERSONAJE | ARMAS | MAPAS | AJUSTES, INICIO elegida', d1.tabs === 'INICIO|PERSONAJE|ARMAS|MAPAS|AJUSTES' && d1.sel === 'inicio', d1.tabs);
    check('la sala 3D: el operador del juego con tu rifle en las manos', d1.op && d1.held);
    check('ligera: menos de 150 llamadas de dibujo', d1.calls > 0 && d1.calls < 150, d1.calls + ' llamadas, ' + d1.tris + ' triángulos');
    check('?menu=2 deshace ?menu=1 (se recuerda)', d1.stored === 'false');

    console.log('\nINICIO');
    const mode = await p.evaluate(() => { const out = {}; const c = s => document.querySelector('#m2 .m2Mode[data-sel=' + s + ']').click();
      c('range'); out.range = __SD.mode; c('duel'); out.duel = __SD.mode; out.pressed = document.querySelector('#m2 .m2Mode[aria-pressed=true]').dataset.sel;
      c('online'); document.getElementById('m2Play').click(); out.mp = !document.getElementById('mp').hidden && document.getElementById('menu').hidden;
      document.getElementById('mpBack').click(); out.back = !document.getElementById('menu').hidden && !document.getElementById('m2').hidden; c('duel'); return out; });
    check('CAMPO DE TIRO y VS BOTS son los modos del juego', mode.range === 'range' && mode.duel === 'duel' && mode.pressed === 'duel', JSON.stringify(mode));
    check('MULTIJUGADOR + JUGAR abre las salas y VOLVER trae el menú nuevo', mode.mp && mode.back);
    const opt = await p.evaluate(() => { document.getElementById('m2Opts').click(); const sh = document.getElementById('m2Sheet'), body = document.getElementById('m2SheetBody');
      const out = { open: !sh.hidden, blocks: ['diffBlock', 'rangeBlock', 'modeSub'].every(id => body.contains(document.getElementById(id))) && !!body.querySelector('.kitSeg') && !!body.querySelector('#sens') };
      document.querySelector('#diffSeg [data-d="2"]').click(); out.diff = JSON.parse(localStorage.getItem('sniperduel_diff')); document.querySelector('#offTimeSeg [data-t="5"]').click();
      document.getElementById('m2SheetClose').click(); out.closed = sh.hidden; out.sub = document.getElementById('m2SubDuel').textContent; out.note = document.getElementById('m2PlayNote').textContent;
      document.querySelector('#diffSeg [data-d="1"]').click(); document.querySelector('#offTimeSeg [data-t="10"]').click(); return out; });
    check('OPCIONES DE PARTIDA: los bloques de siempre (dificultad, tiempo, bots de entrenamiento, arma principal, sensibilidad)', opt.open && opt.blocks, JSON.stringify(opt));
    check('lo elegido allí funciona y se ve en la tarjeta y bajo JUGAR', opt.diff === 2 && opt.closed && /ÉLITE/.test(opt.sub) && /ÉLITE · 5 MIN/.test(opt.note));
    const cards = await p.evaluate(() => { document.querySelector('#m2 .m2Card[data-go=armas]').click(); const a = __SD.M2.tab; document.querySelector('#m2 .m2Card[data-go=personaje]').click(); return a + ',' + __SD.M2.tab; });
    check('las tarjetas ARMAS y OPERADOR llevan a su sección', cards === 'armas,personaje', cards);

    console.log('\nPERSONAJE');
    const pj = await p.evaluate(async () => { const S = __SD, out = [], bad = []; let waitSeen = false, keptOld = false;
      for (const id of Object.keys(S.SKINS)) { const before = S.M2.R.skinPack; document.querySelector('#m2PjList [data-skin="' + id + '"]').click();
        const t = performance.now(); let first = true;
        while (performance.now() - t < 120000) { S.advance(16); const R = S.M2.R;
          // never the box figure in place of a realistic operator that is still on its way
          if (S.M2.pivot.visible && S.SKINS[id].pack !== null && R.skinPack !== null && !R.v2) bad.push(id);
          if (first && R.skinPack !== S.SKINS[id].pack && S.SKINS[id].pack) { if (R.skinPack === before) keptOld = true; if (!document.getElementById('m2Load').hidden && /CARGANDO/.test(document.getElementById('m2LoadTxt').textContent)) waitSeen = true; }
          first = false;
          if (R.skinPack === S.SKINS[id].pack && (S.SKINS[id].pack === null || R.v2)) break; await new Promise(r => setTimeout(r, 50)); }
        out.push(id + ':' + (S.SKIN === id) + ':' + (S.M2.R.skinPack === S.SKINS[id].pack) + ':' + (JSON.parse(localStorage.getItem('sniperduel_skin')) === id) + ':' + (document.getElementById('m2PjName').textContent === S.SKINS[id].name)); }
      let lin = true; S.M2.R.root.traverse(o => { if (o.isMesh && o.visible && o.material && o.material.isMeshStandardMaterial && !o.material.userData.cs) lin = false; });
      document.querySelector('#m2PjList [data-skin="fsb"]').click(); return { out, bad: [...new Set(bad)], waitSeen, keptOld, lin }; });
    check('cada operador: se elige, se guarda, lo lleva el de la sala y sale su nombre', pj.out.length === 5 && pj.out.every(x => !/false/.test(x)), pj.out.join(' '));
    check('nunca se ve el soldado de cajas mientras llega un operador realista; el anterior se queda y sale «CARGANDO…»', pj.bad.length === 0 && pj.keptOld && pj.waitSeen, JSON.stringify(pj));
    check('el CLÁSICO con los colores del juego (no blanco: corrección de color aplicada)', pj.lin);

    console.log('\nARMAS');
    await p.evaluate(() => document.querySelector('#m2 .m2Nav [data-tab=armas]').click());
    const arm = await p.evaluate(async () => { const S = __SD, out = {}; document.querySelector('#m2Miras [data-mira=x4]').click(); for (let i = 0; i < 3; i++) S.advance(16);
      const names = o => { const n = []; o.traverse(x => n.push(x.name)); return n; };
      out.mira = S.MIRA.id === 'x4' && JSON.parse(localStorage.getItem('sniperduel_mira')) === 'x4';
      out.show = !!S.M2.item && names(S.M2.item).includes('mira_x4'); out.hands = !!S.M2.held && names(S.M2.held).includes('mira_x4');
      document.querySelector('#m2Skins [data-ws=vector]').click(); S.advance(16);
      out.wait = !document.getElementById('m2SlotLoad').hidden && /CARGANDO VECTOR/.test(document.getElementById('m2SlotTxt').textContent) && !S.M2.item;
      out.first = S.KTX2.want('https://x/assets/armas/vector/ktx2/a.ktx2') && !S.KTX2.want('https://x/assets/armas/ratio/ktx2/a.ktx2');
      const t = performance.now(); while (!(S.WS_ST.rifle.cur === 'vector' && S.WS_ST.rifle.objs.length && !S.WS_ST.rifle.light) && performance.now() - t < 90000) { await new Promise(r => setTimeout(r, 100)); S.advance(16); }
      for (let i = 0; i < 3; i++) S.advance(16);
      out.skin = S.WSKIN.rifle === 'vector' && JSON.parse(localStorage.getItem('sniperduel_wsRifle')) === 'vector';
      const body = S.WS_ST.rifle.objs[0], same = o => { let ok = false; o.traverse(x => { if (x.isMesh && body) body.traverse(y => { if (y.isMesh && y.geometry === x.geometry) ok = true; }); }); return ok; };
      out.skinShow = same(S.M2.item); out.skinHands = same(S.M2.held); out.title = document.getElementById('m2ArmName').textContent;
      document.querySelector('#m2Cat [data-cat=knife]').click(); S.advance(16);
      out.knifePane = !document.querySelector('[data-catpane=knife]').hidden && document.querySelector('[data-catpane=rifle]').hidden && document.querySelectorAll('#m2Knives .m2W').length === 2;
      document.querySelector('#m2Knives [data-ws=tactica]').click();
      const t2 = performance.now(); while (!(S.WS_ST.knife.objs.length && !S.WS_ST.knife.light) && performance.now() - t2 < 90000) { await new Promise(r => setTimeout(r, 100)); S.advance(16); }
      S.advance(16); out.knife = S.WSKIN.knife === 'tactica' && !!S.M2.item && S.M2.item.userData.size.x < 0.6 && document.getElementById('m2ArmName').textContent === 'TÁCTICA';
      document.querySelector('#m2Knives [data-ws=navaja]').click(); document.querySelector('#m2Cat [data-cat=rifle]').click(); document.querySelector('#m2Skins [data-ws=halcon]').click(); document.querySelector('#m2Miras [data-mira=sniper]').click();
      S.advance(16); out.back = S.MIRA.id === 'sniper' && S.WSKIN.rifle === 'halcon'; return out; });
    check('mira: se elige y se guarda', arm.mira, JSON.stringify(arm));
    check('la mira elegida se ve en el arma de muestra y en las manos del operador', arm.show && arm.hands);
    check('skin del rifle: se elige, se guarda y se ve en la muestra y en sus manos', arm.skin && arm.skinShow && arm.skinHands && /VECTOR/.test(arm.title));
    check('mientras se descarga: «CARGANDO VECTOR…» en su sitio (no el HALCÓN) y sus texturas pasan delante en la cola', arm.wait && arm.first);
    check('ARMA DE MANO: los dos cuchillos; el elegido se ve en la muestra', arm.knifePane && arm.knife);
    check('y todo vuelve a lo de siempre', arm.back);

    console.log('\nMAPAS');
    const maps = await p.evaluate(async () => { document.querySelector('#m2 .m2Nav [data-tab=mapas]').click(); const cards = [...document.querySelectorAll('#m2Maps .m2Map')];
      const t = performance.now(); while (cards.some(c => !c.querySelector('img').complete) && performance.now() - t < 20000) await new Promise(r => setTimeout(r, 100));
      const out = { ids: cards.map(c => c.dataset.map).join(), imgs: cards.every(c => c.querySelector('img').naturalWidth >= 640) };
      document.querySelector('#m2Maps [data-map=pueblo]').click(); out.off = __SD.OFFMAP; out.world = __SD.WORLD_ID; out.pressed = document.querySelector('#m2Maps [aria-pressed=true]').dataset.map;
      out.sub = document.getElementById('m2SubDuel').textContent; document.querySelector('#m2Maps [data-map=arena]').click(); return out; });
    check('las tarjetas de los mapas del juego, con su vista real', maps.ids === 'arena,pueblo,casa,casa2' && maps.imgs, JSON.stringify(maps));
    check('elegir un mapa es el mapa de VS BOTS', maps.off === 'pueblo' && maps.world === 'pueblo' && maps.pressed === 'pueblo' && /PUEBLO/.test(maps.sub));

    console.log('\nAJUSTES');
    const aj = await p.evaluate(() => { document.querySelector('#m2 .m2Nav [data-tab=armas]').click(); document.querySelector('#m2 .m2Nav [data-tab=ajustes]').click();
      const out = { open: !document.getElementById('settings').hidden, tabs: document.querySelectorAll('#settings .setTabs button').length, sel: document.querySelector('#m2 .m2Nav [aria-selected=true]').dataset.tab };
      document.getElementById('setClose').click(); out.closed = document.getElementById('settings').hidden; out.back = __SD.M2.tab; out.vis = !document.getElementById('menu').classList.contains('under'); return out; });
    check('AJUSTES abre los ajustes de siempre (con todas sus secciones)', aj.open && aj.tabs >= 5 && aj.sel === 'ajustes', JSON.stringify(aj));
    check('LISTO vuelve a la sección de antes', aj.closed && aj.back === 'armas' && aj.vis);

    console.log('\nJUGAR');
    const play = await p.evaluate(async () => { const S = __SD; document.querySelector('#m2 .m2Nav [data-tab=inicio]').click(); document.querySelector('#m2 .m2Mode[data-sel=duel]').click(); S.setDuelLethal(false);
      document.getElementById('m2Play').click(); for (let i = 0; i < 3; i++) S.advance(16);
      const out = { state: S.state, menu: document.getElementById('menu').hidden, room: !!S.M2.room };
      S.advance(16); const r = S.renderer.info.render; out.calls = r.calls;
      S.toMenu(); for (let i = 0; i < 3; i++) S.advance(16); out.back = S.state === 'menu' && !!S.M2.room && !document.getElementById('m2').hidden && !document.getElementById('menu').hidden;
      out.held = !!S.M2.held && !!S.M2.held.parent; return out; });
    check('JUGAR empieza la partida contra bots y el menú se va', play.state === 'playing' && play.menu, JSON.stringify(play));
    check('mientras juegas la sala del menú se libera (no se dibuja ni ocupa memoria)', !play.room);
    check('al volver al menú vuelve la sala con el operador y su rifle', play.back && play.held);
    check('sin errores', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();

    console.log('\nMÓVIL EN HORIZONTAL (932 × 430)');
    const c2 = await b.newContext({ viewport: { width: 932, height: 430 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await c2.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const q = await c2.newPage(), e2 = [];
    q.on('pageerror', e => e2.push(e.message));
    await q.goto(srv.url + '?ktx2=0&arsenal=0', { timeout: 180000 });   // the plain link: the new menu (ARMAS of before: the ARSENAL has its own test)
    await wait(q, () => window.__SD && __SD.M2.room);
    const ph = await q.evaluate(() => { const out = {}; const inView = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; };
      for (const t of ['inicio', 'personaje', 'armas', 'mapas']) { document.querySelector('#m2 .m2Nav [data-tab=' + t + ']').click();
        const pane = document.querySelector('#m2 .m2Pane[data-pane=' + t + ']');
        out[t] = [...pane.querySelectorAll('button')].filter(x => x.offsetParent).every(x => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight - document.querySelector('#m2 .m2Nav').offsetHeight + 1 || x.closest('.m2Row,#m2PjList,.m2Maps'); }); }
      document.querySelector('#m2 .m2Nav [data-tab=armas]').click();
      const navTop = document.querySelector('#m2 .m2Nav').getBoundingClientRect().top;
      out.armasRows = ['rifle', 'knife'].map(c => { document.querySelector('#m2Cat [data-cat=' + c + ']').click(); return Math.round(document.querySelector('[data-catpane=' + c + ']').getBoundingClientRect().bottom - navTop); });
      out.slotH = Math.round(document.getElementById('m2Slot').getBoundingClientRect().height);
      document.querySelector('#m2Cat [data-cat=rifle]').click();
      document.querySelector('#m2 .m2Nav [data-tab=inicio]').click();
      out.play = inView(document.getElementById('m2Play')); out.nav = [...document.querySelectorAll('#m2 .m2Nav button')].every(inView);
      out.scrollW = document.documentElement.scrollWidth <= innerWidth; out.menuScroll = document.getElementById('menu').scrollTop === 0;
      out.playH = document.getElementById('m2Play').getBoundingClientRect().height; return out; });
    check('JUGAR y la barra de abajo a la vista, sin desplazar la pantalla', ph.play && ph.nav && ph.scrollW && ph.menuScroll, JSON.stringify(ph));
    check('JUGAR fácil de pulsar con el pulgar (44 px o más de alto)', ph.playH >= 44, ph.playH);
    check('en cada sección los botones caben entre la barra de arriba y la de abajo (las filas largas se deslizan)', ph.inicio && ph.personaje && ph.armas && ph.mapas);
    check('ARMAS: las filas de miras, skins y cuchillos acaban encima de la barra y queda sitio para ver el arma', ph.armasRows.every(d => d <= 1) && ph.slotH >= 40, JSON.stringify({ filas: ph.armasRows, arma: ph.slotH }));
    check('sin errores (móvil)', e2.length === 0, e2.slice(0, 3).join(' | '));
    await q.goto(srv.url + '?ktx2=0&menu=1', { timeout: 180000 });
    await wait(q, () => window.__SD && __SD.WORLDS);
    const back = await q.evaluate(() => ({ m2: !document.getElementById('m2').hidden, stored: localStorage.getItem('sniperduel_menuOld') }));
    check('?menu=1 devuelve el menú de antes (y se recuerda)', !back.m2 && back.stored === 'true', JSON.stringify(back));
    await c2.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
