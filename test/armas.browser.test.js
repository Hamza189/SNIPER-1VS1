/* Aspectos de arma (?pj=pro, tools/arma-ext): rifles y cuchillo CC BY en la 1ª persona.
   - al elegir uno, el modelo del HALCÓN / NAVAJA se oculta y el nuevo ocupa su sitio; el cerrojo y el cargador del
     aspecto cuelgan de los del HALCÓN (se mueven con sus animaciones) y el fogonazo sale de su boca
   - disparar y recargar funcionan igual (solo cambia el aspecto); volver al HALCÓN lo deja como siempre
   - (29-10-2026) cada aspecto llega en KTX2 con sus texturas a la resolución de su original (4K en ÚLTIMA y VECTOR),
     comprimidas; si el KTX2 no llega, el arma.glb de siempre (JPG 2K). Mientras carga, el HALCÓN sigue en las manos.
     Volver a elegir un aspecto ya usado lo pone otra vez (antes dejaba las manos vacías). El camuflaje mide el brillo
     de un color comprimido con extras.lum. Las texturas van en archivos aparte (ktx2/): en el móvil, de una en una
   - (29-10, noche) memoria: la copia en JavaScript de cada textura comprimida se suelta en cuanto está en la GPU, y el
     aspecto que se deja deja también la GPU (Safari cerraba la partida con 5 bots y ÚLTIMA)
   Run: node test/armas.browser.test.js   (SHOTS=carpeta para capturas) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    console.log('\nASPECTOS DE ARMA');
    const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'medio', v: 3 })); } catch (e) {} });
    // VECTOR: its KTX2 model never arrives (the game must fall back to arma.glb); TITÁN: slow, to see the HALCÓN meanwhile
    await ctx.route(/vector\/arma_ktx2\.glb/, r => r.abort());
    await ctx.route(/titan\/arma_ktx2\.glb/, async r => { await new Promise(f => setTimeout(f, 2500)); r.continue(); });
    const p = await ctx.newPage(), errs = [], bad = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('response', r => { if (/\/assets\/armas\//.test(r.url()) && r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    const tex = () => p.evaluate(() => { const out = []; for (const o of __SD.WS_ST.rifle.objs) o.traverse(x => { if (x.isMesh) for (const k of ['map', 'normalMap', 'roughnessMap']) { const t = x.material[k]; if (t) out.push({ c: !!t.isCompressedTexture, w: t.isCompressedTexture ? t.mipmaps[0].width : t.image && t.image.width }); } });
      return { n: out.length, comp: out.filter(t => t.c).length, max: Math.max(0, ...out.map(t => t.w)) }; });
    await p.goto(srv.url + '?vm=1&pj=pro');
    await p.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 120000 });
    check('la ventana de personaje trae «Tu rifle» (5) y «Tu cuchillo» (2)', await p.evaluate(() => document.querySelectorAll('#wsRifleGrid .skinCard').length === 5 && document.querySelectorAll('#wsKnifeGrid .skinCard').length === 2));
    await p.evaluate(() => { document.querySelector('canvas').requestPointerLock = () => Promise.reject(new Error('sin captura')); __SD.setDuelLethal(false); __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); __SD.BOTS.forEach(b => { b.alive = false; b.g.visible = false; }); });
    await p.waitForTimeout(1500);
    const MAX = { titan: 4096, ultima: 4096, vector: 2048, sahara: 2048 };   // vector: JPG 2K (its KTX2 is blocked above)
    for (const id of ['titan', 'ultima', 'vector', 'sahara']) {
      await p.evaluate(id => __SD.setWskin('rifle', id), id);
      if (id === 'titan') check('mientras llega el aspecto, el HALCÓN sigue en las manos', await p.evaluate(() => __SD.WS_ST.rifle.objs.length === 0 && __SD.WS_ST.rifle.base.meshes.every(m => m.visible)));
      const ok = await p.waitForFunction(() => __SD.WS_ST.rifle.objs.length > 0, null, { timeout: 60000 }).then(() => true, () => false);
      const r = await p.evaluate(() => { const S = __SD.WS_ST.rifle, R = __SD.RIF; return { hid: S.base.meshes.every(m => !m.visible), n: S.objs.length, boltZ: R.boltZ, bolt: R.bolt.children.some(c => S.objs.includes(c)), mag: R.mag.children.some(c => S.objs.includes(c)) }; });
      check(id + ': el HALCÓN se oculta y el aspecto ocupa su sitio (cuerpo' + (r.bolt ? ', cerrojo' : '') + (r.mag ? ', cargador' : '') + ')', ok && r.hid && r.n >= 1, JSON.stringify(r));
      const t = await tex(), k2 = await p.evaluate(id => !!__SD.WS_ST.ktx2['rifle' + id], id);
      if (id === 'vector') check('vector: sin su KTX2, llega el arma.glb de siempre (JPG 2K)', !k2 && t.n > 0 && t.comp === 0 && t.max === 2048, JSON.stringify(t));
      else check(id + ': texturas comprimidas para la GPU a la resolución de su original (' + MAX[id] + ')', k2 && t.n > 0 && t.comp === t.n && t.max === MAX[id], JSON.stringify(t));
      if (process.env.SHOTS) { await p.waitForTimeout(600); await p.screenshot({ path: process.env.SHOTS + '/arma-' + id + '.png' }); }
      // fire: the bolt cycles with the skin's bolt
      const shots0 = await p.evaluate(() => __SD.STATS.shots);
      await p.evaluate(() => { __SD.input.firePressed = true; });
      // (waits for the events, not a fixed time: software WebGL under load runs the game slower than the clock)
      const cyc = await p.waitForFunction(() => __SD.WCORE.state === 'bolt', null, { timeout: 15000 }).then(() => true, () => false);
      if (process.env.SHOTS) { await p.waitForTimeout(300); await p.screenshot({ path: process.env.SHOTS + '/arma-' + id + '-cerrojo.png' }); }
      const done = await p.waitForFunction(s0 => __SD.STATS.shots === s0 + 1 && __SD.WCORE.state === 'ready', shots0, { timeout: 20000 }).then(() => true, () => false);
      check(id + ': dispara y acciona el cerrojo igual que siempre', cyc && done, await p.evaluate(s0 => (__SD.STATS.shots - s0) + ' disparo · ' + __SD.WCORE.state, shots0));
    }
    const dl = await p.evaluate(() => { const m = []; __SD.WS_ST.rifle.objs[0].traverse(x => { if (x.isMesh && x.material.map) m.push(x.material); }); return m.map(x => SDCamo.detail(x)); });
    check('el camuflaje sabe el brillo de un color comprimido (KTX2)', dl.length > 0 && dl.every(v => v > 0), dl.map(v => v.toFixed(2)).join(' '));
    check('las texturas comprimidas ya no guardan su copia en JavaScript (están en la GPU) y se siguen contando', await p.evaluate(() => { const ts = []; __SD.WS_ST.rifle.objs[0].traverse(x => { if (x.isMesh && x.material.map && x.material.map.isCompressedTexture) ts.push(x.material.map); });
      return ts.length > 0 && ts.every(t => t.mipmaps.every(m => m.data === null) && t.userData.gpuBytes > 0); }));
    check('el aspecto que se deja sale de la memoria (solo queda el que llevas)', await p.evaluate(() => Object.keys(__SD.WS_ST.cache).filter(k => /^rifle/.test(k)).join(',') === 'riflesahara'), await p.evaluate(() => Object.keys(__SD.WS_ST.cache).join(',')));
    // choosing a skin used before: it comes back (from the browser's cache)
    await p.evaluate(() => __SD.setWskin('rifle', 'ultima'));
    await p.waitForFunction(() => __SD.WS_ST.rifle.objs.length === 3, null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(300);
    const back = await p.evaluate(() => { const S = __SD.WS_ST.rifle; return { n: S.objs.length, hid: S.base.meshes.every(m => !m.visible), boltZ: +__SD.RIF.boltZ.toFixed(3), inHands: S.objs.every(o => !!o.parent) }; });
    check('volver a elegir ÚLTIMA después de otra: vuelve a las manos con su cerrojo', back.n === 3 && back.hid && back.inHands && back.boltZ === 0.059, JSON.stringify(back));
    await p.evaluate(() => __SD.setWskin('rifle', 'halcon'));
    check('volver al HALCÓN: su modelo vuelve y el cerrojo a su sitio', await p.evaluate(() => { const S = __SD.WS_ST.rifle; return S.base.meshes.every(m => m.visible) && S.objs.length === 0 && Math.abs(__SD.RIF.boltZ - 0.08) < 1e-6; }));
    // knife
    await p.evaluate(() => { __SD.setWskin('knife', 'tactica'); __SD.input.select = 'knife'; });
    const kn = await p.waitForFunction(() => __SD.WS_ST.knife.objs.length > 0 && __SD.LOAD.active === 'knife', null, { timeout: 60000 }).then(() => true, () => false);
    check('cuchillo TÁCTICA en la mano en lugar de la NAVAJA', kn && await p.evaluate(() => __SD.WS_ST.knife.base.meshes.every(m => !m.visible)));
    check('y en KTX2, a 2K (el arma.glb lo lleva a 1K)', await p.evaluate(() => { let w = 0; __SD.WS_ST.knife.objs[0].traverse(x => { if (x.isMesh && x.material.map && x.material.map.isCompressedTexture) w = Math.max(w, x.material.map.mipmaps[0].width); }); return w === 2048 && !!__SD.WS_ST.ktx2.knifetactica; }));
    if (process.env.SHOTS) { await p.waitForTimeout(800); await p.screenshot({ path: process.env.SHOTS + '/arma-tactica.png' }); }
    check('créditos CC BY de las armas en AJUSTES › GRÁFICOS', await p.evaluate(() => ['Aleksandr', 'drepi.3d', 'Vlasov Daniil', 'awakov_dawid', 'lunea'].every(n => document.getElementById('credits').textContent.includes(n))));
    check('se guarda lo elegido', await p.evaluate(() => JSON.parse(localStorage.getItem('sniperduel_wsKnife')) === 'tactica' && JSON.parse(localStorage.getItem('sniperduel_wsRifle')) === 'halcon'));
    check('sin 404 ni errores', bad.length === 0 && errs.length === 0, bad.concat(errs).slice(0, 3).join(' | '));
    check('la memoria gráfica cuenta las texturas comprimidas por lo que ocupan', await p.evaluate(() => { const m = __SD.perfTexMB(); return m.real < m.asRGBA; }));
    await ctx.close();

    console.log('\nEN EL MÓVIL (ALTO)');
    const mc = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    await mc.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await mc.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
    const mp = await mc.newPage(), merrs = [];
    let now = 0, most = 0, files = 0;
    mp.on('pageerror', e => merrs.push(e.message));
    const isTex = r => /\/armas\/ratio\/ktx2\/.+\.ktx2/.test(r.url());
    mp.on('request', r => { if (isTex(r)) { now++; files++; most = Math.max(most, now); } });
    mp.on('requestfinished', r => { if (isTex(r)) now--; });
    mp.on('requestfailed', r => { if (isTex(r)) now--; });
    await mp.goto(srv.url + '?vm=1');
    await mp.waitForFunction(() => window.__SD && __SD.WORLDS && __SD.VMA.ready, null, { timeout: 180000 });
    await mp.evaluate(() => { __SD.setDuelLethal(false); __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); __SD.setWskin('rifle', 'ultima'); });
    const mok = await mp.waitForFunction(() => __SD.WS_ST.rifle.objs.length > 0, null, { timeout: 300000 }).then(() => true, () => false);
    const mt = await mp.evaluate(() => { let n = 0, c = 0, w = 0; for (const o of __SD.WS_ST.rifle.objs) o.traverse(x => { if (x.isMesh && x.material.map) { n++; if (x.material.map.isCompressedTexture) { c++; w = Math.max(w, x.material.map.mipmaps[0].width); } } }); return { n, c, w }; });
    check('ÚLTIMA en el móvil: a 4K y comprimida para la GPU', mok && mt.n > 0 && mt.c === mt.n && mt.w === 4096, JSON.stringify(mt));
    check('sus texturas llegan como archivos aparte, de una en una (poca memoria a la vez)', files >= 15 && most === 1, files + ' archivos · ' + most + ' a la vez como mucho');
    check('sin errores (móvil)', merrs.length === 0, merrs.slice(0, 2).join(' | '));
    await mc.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
