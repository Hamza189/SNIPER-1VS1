/* Ajustes ampliados en el juego (30-10-2026, «los ajustes de los grandes shooters de móvil»):
   - AJUSTES › MIRA: la cruceta cambia de estilo, color, largo y grosor (y la vista previa con ella); el punto del visor
     y el marcador de impacto toman su color; la separación extra se suma a la dispersión real
   - GRÁFICOS: el brillo cambia la exposición al momento; el estilo de imagen y el modo daltónico se cargan dentro del
     tone mapping (sin errores de shader) y piden recargar al cambiarlos
   - móvil: MIRA en modo MIXTO (toque = fija, mantener = mientras mantienes), FUEGO izquierdo solo al apuntar y el
     giroscopio gira la cámara solo si está activado
   Run: node test/ajustes.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async (phone, settings) => {
    const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : { viewport: { width: 960, height: 540 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(s => { if (s) try { localStorage.setItem('sniperduel_settings', JSON.stringify(s)); } catch (e) {} }, settings || null);
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && /shader|WebGLProgram|GLSL/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await p.goto(srv.url + '?pj=0', { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 180000 });
    return { ctx, p, errs };
  };
  const play = p => p.evaluate(async () => { __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.setOffMap('arena'); __SD.startMatch();
    const t = performance.now(); while (!(__SD.state === 'playing' && __SD.LOAD.phase === 'ready') && performance.now() - t < 90000) await new Promise(r => setTimeout(r, 100)); });
  try {
    console.log('\nPC · MIRA Y EFECTOS');
    const A = await open(false);
    await A.p.evaluate(() => document.getElementById('openSettings').click());
    await A.p.click('.setTabs button[data-tab="mira"]');
    check('la pestaña MIRA existe y muestra los 9 colores en cada paleta', await A.p.evaluate(() => !document.querySelector('[data-pane="mira"]').hidden && [...document.querySelectorAll('.swatches')].every(s => s.children.length === 9)));
    await A.p.click('#xStyleSeg button[data-x="circle"]');
    await A.p.click('#xColSw button[data-c="#4dff6a"]');
    await A.p.evaluate(() => { const r = document.getElementById('sXT'); r.value = 4; r.dispatchEvent(new Event('input')); });
    const x = await A.p.evaluate(() => { const c = document.getElementById('cross'), v = document.getElementById('xPrev'), st = JSON.parse(localStorage.getItem('sniperduel_settings'));
      return { cls: c.className, xc: c.style.getPropertyValue('--xc'), xt: c.style.getPropertyValue('--xt'), prev: v.className, ring: getComputedStyle(v.querySelector('u')).display, saved: st.xStyle + ' ' + st.xColor + ' ' + st.xThick }; });
    check('cruceta en CÍRCULO, verde y grosor 4 (en el juego y en la vista previa), y se guarda', /x-circle/.test(x.cls) && x.xc === '#4dff6a' && x.xt === '4px' && /x-circle/.test(x.prev) && x.ring === 'block' && x.saved === 'circle #4dff6a 4', JSON.stringify(x));
    await A.p.click('#retColSw button[data-c="#3de0ff"]');
    await A.p.evaluate(() => document.getElementById('sRetL').click());
    await A.p.click('#hitColSw button[data-c="#ffe14d"]');
    const r = await A.p.evaluate(() => ({ dot: document.getElementById('retDot').getAttribute('fill'), lines: document.querySelector('#scope .ret svg g[stroke]').getAttribute('stroke'), hm: getComputedStyle(document.querySelector('#hitmark i')).backgroundColor }));
    check('visor: punto cian y retícula iluminada; marcador de impacto amarillo', r.dot === '#3de0ff' && r.lines === '#3de0ff' && r.hm === 'rgb(255, 225, 77)', JSON.stringify(r));
    await A.p.click('#bloodSeg button[data-b="green"]');
    check('impacto en el cuerpo: verde', await A.p.evaluate(() => __SD.SETTINGS.blood === 'green'));
    console.log('\nPC · GRÁFICOS');
    await A.p.click('.setTabs button[data-tab="graficos"]');
    const e0 = await A.p.evaluate(() => __SD.renderer.toneMappingExposure);
    await A.p.evaluate(() => { const r = document.getElementById('sBr'); r.value = 1.2; r.dispatchEvent(new Event('input')); });
    const e1 = await A.p.evaluate(() => __SD.renderer.toneMappingExposure);
    check('el brillo cambia la exposición al momento (×1,2)', Math.abs(e1 / e0 - 1.2) < 1e-6, e0.toFixed(3) + ' → ' + e1.toFixed(3));
    check('estilo CLÁSICO por defecto: el tone mapping sin tocar', await A.p.evaluate(() => !__SD.PIC.on && !THREE.ShaderChunk.tonemapping_pars_fragment.includes('sdACES0')));
    await A.p.click('#lookSeg button[data-l="cine"]');
    check('al elegir otro estilo pide recargar', await A.p.evaluate(() => !document.getElementById('lookReloadRow').hidden));
    await A.p.evaluate(() => document.getElementById('setClose').click());
    await play(A.p);
    const gap = await A.p.evaluate(async () => { __SD.SETTINGS.xGap = 20; await new Promise(r => setTimeout(r, 400)); const a = parseFloat(document.getElementById('cross').style.getPropertyValue('--gap'));
      __SD.SETTINGS.xGap = 0; await new Promise(r => setTimeout(r, 400)); return [a, parseFloat(document.getElementById('cross').style.getPropertyValue('--gap'))]; });
    check('la separación extra se suma a la de la dispersión (20 px más)', Math.abs(gap[0] - gap[1] - 20) <= 1, gap.join(' / '));
    check('sin errores (PC)', A.errs.length === 0, A.errs.slice(0, 2).join(' | '));
    await A.ctx.close();

    console.log('\nESTILOS DE IMAGEN Y MODO DALTÓNICO (al cargar)');
    for (const [look, cvd] of [['vivo', 'off'], ['cine', 'deut'], ['clasico', 'prot']]) {
      const L = await open(false, { look, cvd });
      await play(L.p);
      await L.p.waitForTimeout(1500);
      const s = await L.p.evaluate(() => ({ pic: __SD.PIC, patched: THREE.ShaderChunk.tonemapping_pars_fragment.includes('sdACES0'), progs: __SD.renderer.info.programs.length }));
      check(look + ' + ' + cvd + ': cargado dentro del tone mapping, la partida se dibuja sin errores de shader', s.pic.on && s.patched && s.pic.look === look && s.pic.cvd === cvd && s.progs > 3 && L.errs.length === 0, JSON.stringify(s.pic) + ' · ' + s.progs + ' programas' + (L.errs.length ? ' · ' + L.errs[0] : ''));
      await L.ctx.close();
    }

    console.log('\nMÓVIL');
    const M = await open(true, { adsMode: 'mixed', leftFire: true, leftFireAds: true, gyro: 'on' });
    await play(M.p);
    const mix = await M.p.evaluate(async () => { const i = __SD.input, w = ms => new Promise(r => setTimeout(r, ms)), o = {};
      __SD.btnPress('scope', true); await w(60); __SD.btnPress('scope', false); o.tap = i.scopeToggle;
      __SD.btnPress('scope', true); await w(60); __SD.btnPress('scope', false); o.tap2 = i.scopeToggle;
      __SD.btnPress('scope', true); o.held = i.scopeHeld; await w(450); __SD.btnPress('scope', false); o.long = i.scopeToggle || i.scopeHeld; return o; });
    check('MIRA MIXTO: un toque la fija, otro la quita, y mantener apunta solo mientras mantienes', mix.tap === true && mix.tap2 === false && mix.held === true && mix.long === false, JSON.stringify(mix));
    await M.p.waitForTimeout(400);
    const lf0 = await M.p.evaluate(() => document.getElementById('tbFire2').hidden);
    await M.p.evaluate(() => { __SD.input.scopeToggle = true; });
    await M.p.waitForTimeout(900);
    const lf1 = await M.p.evaluate(() => document.getElementById('tbFire2').hidden);
    await M.p.evaluate(() => { __SD.input.scopeToggle = false; });
    check('FUEGO izquierdo solo al apuntar: oculto sin mira, visible con ella', lf0 === true && lf1 === false, lf0 + ' / ' + lf1);
    // the sight fully down and the zoom back before the gyroscope check (with the software WebGL a frame can take
    // longer than 0.1 s, and then the simulation runs slower than the clock: a fixed wait was not always enough)
    await M.p.waitForFunction(() => __SD.WCORE.ads === 0 && Math.abs(__SD.camera.fov - 70) < 0.2, null, { timeout: 20000 });
    await M.p.waitForTimeout(200);
    const gy = await M.p.evaluate(async () => { Object.defineProperty(screen.orientation, 'angle', { configurable: true, get: () => 90 });
      const P = __SD.P, y0 = P.yaw, p0 = P.pitch, ev = (b, g, t) => __SD.gyroEv({ rotationRate: { alpha: 0, beta: b, gamma: g }, timeStamp: t });
      const t0 = performance.now(); ev(0, 0, t0); ev(30, -20, t0 + 100);   // 0.1 s turning left 30°/s and tilting up 20°/s
      await new Promise(r => setTimeout(r, 300)); const on = { dy: P.yaw - y0, dp: P.pitch - p0 };
      __SD.SETTINGS.gyro = 'off'; const y1 = P.yaw; ev(30, 0, t0 + 200); ev(30, 0, t0 + 300); await new Promise(r => setTimeout(r, 300));
      return { on, off: P.yaw - y1, want: 3 * Math.PI / 180 }; });
    check('giroscopio: girar el móvil 3° a la izquierda gira la cámara 3° (y hacia arriba al inclinarlo)', Math.abs(gy.on.dy - gy.want) < 0.004 && gy.on.dp > 0.02, JSON.stringify(gy));
    check('giroscopio apagado: no gira nada', Math.abs(gy.off) < 1e-6, gy.off);
    check('suavizado de bordes en el móvil (AUTO → MEDIO): MSAA 4×', await M.p.evaluate(() => { const g = __SD.renderer.getContext(); return g.getParameter(g.SAMPLES) === 4 && __SD.GFX.aa === true; }));
    check('sin errores (móvil)', M.errs.length === 0, M.errs.slice(0, 2).join(' | '));
    await M.ctx.close();

    console.log('\nMÓVIL EN HORIZONTAL · MENÚ DE AJUSTES (31-10-2026: «es muy grande en Safari»)');
    const A2 = await open(true, { quality: 'alto', aa: false });
    const lay = await A2.p.evaluate(() => {
      // Safari enlarges long texts in landscape unless the page says text-size-adjust: 100 %
      let tsa = false; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (r.selectorText === 'html' && /100%/.test(r.style.getPropertyValue('-webkit-text-size-adjust') + r.style.getPropertyValue('text-size-adjust') + r.cssText)) tsa = true; } catch (e) {} }
      document.getElementById('openSettings').click();
      const tabs = [...document.querySelectorAll('.setTabs button')], help = document.querySelector('[data-pane="controles"] .setHelp');
      const ov = document.getElementById('settings'), g = __SD.renderer.getContext();
      return { tsa, rows: new Set(tabs.map(t => Math.round(t.getBoundingClientRect().top))).size, help: getComputedStyle(help).fontSize, tab: getComputedStyle(tabs[0]).fontSize,
        cols: getComputedStyle(document.querySelector('[data-pane="controles"] .setGrid')).gridTemplateColumns.split(' ').length, h: ov.scrollHeight, vh: innerHeight, samples: g.getParameter(g.SAMPLES), aa: __SD.GFX.aa };
    });
    check('la página no deja que Safari agrande los textos (text-size-adjust 100 %)', lay.tsa);
    check('las 7 pestañas en una fila, textos de ayuda a 10,5 px y casillas en dos columnas', lay.rows === 1 && lay.help === '10.5px' && lay.tab === '10px' && lay.cols === 2, JSON.stringify(lay));
    check('CONTROLES cabe en menos de 2,6 pantallas', lay.h < lay.vh * 2.6, lay.h + ' px / ' + lay.vh);
    check('«Suavizado de bordes» apagado en AJUSTES: sin MSAA', lay.samples === 0 && lay.aa === false, JSON.stringify({ s: lay.samples, aa: lay.aa }));
    await A2.ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
