/* Personajes con texturas comprimidas para la GPU (docs/KTX2.md): por defecto en PC (?ktx2=0 = los JPG); en el móvil los
   JPG de 2K por defecto y KTX2 con ?ktx2=1 (Safari cerraba la partida por el pico de memoria al cargar):
   - PC, MEDIO: MILITAR llega en KTX2 (modelo y color), la GPU recibe un formato comprimido (1 byte por píxel)
   - móvil, ALTO: por defecto JPG 2K; con ?ktx2=1, FSB a 4K comprimido, un solo transcodificador, y la medición de
     rendimiento cuenta la memoria real de lo comprimido
   - si el KTX2 no llega, el personaje se carga como siempre (JPG) y no pasa nada
   - con ?ktx2=0 no se descarga nada de KTX2; en BAJO, los JPG de 1K
   Run: node test/ktx2.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async (q, quality, phone, block) => {
    const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : { viewport: { width: 960, height: 540 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    if (block) await ctx.route(block, r => r.abort());
    await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q })); } catch (e) {} }, quality);
    const p = await ctx.newPage(), errs = [], files = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('response', r => { const u = r.url(); if (/ktx2|basis|KTX2Loader|personaje.*\.glb|color_/.test(u)) files.push(u.replace(/^.*\/(assets|vendor)\//, '').replace(/\?.*$/, '')); });
    await p.goto(srv.url + q, { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 180000 });
    await p.evaluate(() => { __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.setOffMap('arena'); __SD.startMatch(); });
    await p.waitForFunction(() => __SD.state === 'playing' && __SD.BOTS.length && __SD.BOTS.every(b => b.rig.v2), null, { timeout: 240000 }).catch(() => {});
    await p.waitForTimeout(3000);
    return { ctx, p, errs, files };
  };
  const tex = p => p.evaluate(() => { const m = __SD.BOTS[0].rig.v2.meshes[0].material, t = (x) => x ? { c: !!x.isCompressedTexture, w: x.isCompressedTexture ? x.mipmaps[0].width : x.image && x.image.width, f: x.format } : null;
    return { roots: Object.keys(__SD.PJ2.tpls), ktx2: Object.keys(__SD.PJ2.ktx2 || {}), map: t(m.map), normal: t(m.normalMap), rough: t(m.roughnessMap) }; });
  try {
    console.log('\nKTX2 EN PC (MEDIO)');
    const A = await open('', 'medio');
    const a = await tex(A.p);
    check('MILITAR llega en KTX2: modelo y color', a.ktx2.includes('assets/personaje/pro/op4/') && A.files.some(f => /op4\/personaje_ktx2\.glb/.test(f)) && A.files.some(f => /op4\/color_bots_ktx2\.ktx2/.test(f)), A.files.join(' · '));
    check('la GPU recibe las 4 texturas comprimidas (color, normales, rugosidad) a 2K', a.map.c && a.normal.c && a.rough.c && a.map.w === 2048, JSON.stringify(a));
    check('sin errores', A.errs.length === 0, A.errs.slice(0, 2).join(' | '));
    await A.ctx.close();

    console.log('\nEL MÓVIL (ALTO)');
    // 29-10: Safari closed the match with KTX2 by default (memory peak while loading): phones keep the 2K JPG by default
    const D = await open('', 'alto', true);
    const dd = await tex(D.p);
    check('por defecto en el móvil: los JPG de 2K (sin descargar nada de KTX2)', !D.files.some(f => /ktx2|basis|KTX2Loader/.test(f)) && !dd.map.c && dd.map.w === 2048, JSON.stringify(dd));
    await D.ctx.close();
    const M = await open('?ktx2=1', 'alto', true);
    const m = await tex(M.p);
    check('con ?ktx2=1 en el móvil: FSB en los bots con sus texturas de 4K, comprimidas', m.ktx2.includes('assets/personaje/pro/op3/') && m.map.c && m.map.w === 4096 && m.normal.w === 4096, JSON.stringify(m));
    check('y carga más ligera: un solo transcodificador', await M.p.evaluate(() => __SD.KTX2.loader.basisLoader.workerLimit === 1));
    const mem = await M.p.evaluate(() => __SD.perfTexMB());
    check('MEDIR RENDIMIENTO cuenta las texturas comprimidas por lo que ocupan de verdad', mem.real < mem.asRGBA * 0.6, JSON.stringify(mem));
    check('sin errores (móvil)', M.errs.length === 0, M.errs.slice(0, 2).join(' | '));
    await M.ctx.close();

    console.log('\nSIN KTX2');
    const F = await open('', 'medio', false, /personaje_ktx2\.glb/);
    const f = await tex(F.p);
    check('si el modelo KTX2 no llega, el personaje sale como siempre (JPG)', f.roots.includes('assets/personaje/pro/op4/') && !f.ktx2.length && !f.map.c, JSON.stringify(f));
    check('y sin errores', F.errs.length === 0, F.errs.slice(0, 2).join(' | '));
    await F.ctx.close();
    const N = await open('?ktx2=0', 'medio');
    check('con ?ktx2=0 no se descarga nada de KTX2 (los JPG de antes)', !N.files.some(f => /ktx2|basis|KTX2Loader/.test(f)) && !(await tex(N.p)).map.c, N.files.join(' · '));
    await N.ctx.close();
    const L = await open('?pj=2', 'bajo');
    check('en BAJO siguen los JPG de 1K (más ligeros de descargar)', !L.files.some(f => /ktx2/.test(f)) && L.files.some(f => /personaje_1k\.glb/.test(f)), L.files.join(' · '));
    await L.ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
