/* La imagen sigue al tamaño real de la pantalla (29-10-2026). En Safari del iPhone la barra de direcciones aparece y
   desaparece sin avisar siempre a la página (sin 'resize', o tarde), y el juego se veía estirado:
   - si la zona visible cambia SIN evento 'resize', la cámara y el lienzo se ajustan igual (ResizeObserver)
   - el dibujo usa el tamaño real del lienzo en pantalla
   - en el iPhone, fuera de la app de pantalla de inicio, se explica cómo jugar sin la barra de Safari; en PC, no
   - la página se puede instalar: manifiesto con iconos y pantalla completa, icono de iPhone
   Run: node test/pantalla.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async (phone, q) => {
    const ctx = await b.newContext(phone ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, userAgent: IPHONE } : { viewport: { width: 960, height: 540 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    // like Safari when the bar moves: the browser's own 'resize' never reaches the game
    await ctx.addInitScript(() => { window.addEventListener('resize', e => { if (e.isTrusted && window.__noResize) e.stopImmediatePropagation(); }, true); });
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + (q || '?pj=0'), { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 180000 });
    return { ctx, p, errs };
  };
  const view = p => p.evaluate(() => { const c = document.getElementById('c'), r = c.getBoundingClientRect(), s = __SD.renderer.getSize(new THREE.Vector2());
    return { css: [Math.round(r.width), Math.round(r.height)], draw: [s.x, s.y], aspect: +__SD.camera.aspect.toFixed(4), want: +(r.width / r.height).toFixed(4) }; });
  try {
    console.log('\nSAFARI EN EL IPHONE: LA BARRA CAMBIA LA ZONA VISIBLE');
    const A = await open(true);
    await A.p.evaluate(() => { __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); });
    await A.p.waitForTimeout(1500);
    const v0 = await view(A.p);
    check('al empezar, la cámara tiene la forma de la pantalla', v0.aspect === v0.want && v0.draw[0] === v0.css[0] && v0.draw[1] === v0.css[1], JSON.stringify(v0));
    await A.p.evaluate(() => { window.__noResize = true; });
    await A.p.setViewportSize({ width: 844, height: 330 });   // the bar appears: 60 px less
    await A.p.waitForTimeout(600);
    const v1 = await view(A.p);
    check('aparece la barra sin evento resize: la cámara y el dibujo se ajustan solos', v1.css[1] === 330 && v1.aspect === v1.want && v1.draw[1] === 330, JSON.stringify(v1));
    await A.p.setViewportSize({ width: 844, height: 390 });   // and goes away again
    await A.p.waitForTimeout(600);
    const v2 = await view(A.p);
    check('y al quitarse, vuelve a la forma de antes (sin estirar)', v2.css[1] === 390 && v2.aspect === v2.want && v2.draw[1] === 390, JSON.stringify(v2));
    check('el aviso de pantalla completa sale en el iPhone (Safari)', await A.p.evaluate(() => { const h = document.getElementById('appHint'); return !!h && !h.hidden && /pantalla de inicio/.test(h.textContent); }));
    check('sin errores (iPhone)', A.errs.length === 0, A.errs.slice(0, 2).join(' | '));
    await A.ctx.close();

    console.log('\nPC');
    const B = await open(false);
    check('en PC no sale el aviso del iPhone', await B.p.evaluate(() => document.getElementById('appHint').hidden));
    const m = await B.p.evaluate(async () => {
      const man = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
      const icon = document.querySelector('link[rel=apple-touch-icon]');
      const ok = async u => { const r = await fetch(u); return r.ok && /image\/png/.test(r.headers.get('content-type') || ''); };
      return { display: man.display, orient: man.orientation, icons: man.icons.map(i => i.sizes), iconsOk: (await Promise.all(man.icons.map(i => ok(i.src)))).every(Boolean), apple: !!icon && await ok(icon.href) };
    });
    check('se puede instalar: pantalla completa en horizontal, con iconos que existen', m.display === 'fullscreen' && /landscape/.test(m.orient) && m.icons.includes('512x512') && m.iconsOk, JSON.stringify(m));
    check('y con icono para la pantalla de inicio del iPhone', m.apple);
    check('sin errores (PC)', B.errs.length === 0, B.errs.slice(0, 2).join(' | '));
    await B.ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
