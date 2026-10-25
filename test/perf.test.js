/* MEDIR RENDIMIENTO (client/perfprobe.js + the page): numbers from frame lists, the text report, and a quick run
   in the real page (?medir=rapido, Chromium with software WebGL: checks it works, NOT the phone's speed).
   Run: node test/perf.test.js */
'use strict';
const S = require('../client/perfprobe.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

console.log('\nCÁLCULOS');
{ const a = Array(100).fill(16.7); a[10] = 40; a[20] = 30;
  const s = S.stats(a, 16.7);
  check('60 FPS con dos tirones: media, p50, máx y % de tirones', s.n === 100 && s.p50 === 16.7 && s.max === 40 && s.jank === 2 && s.over33 === 1 && Math.abs(s.fps - 58.5) < 0.5, JSON.stringify(s));
  check('lista vacía o con basura no rompe nada', S.stats([], 16.7).n === 0 && S.stats([NaN, -1, 0], 16.7).n === 0);
  check('memoria de texturas: 2048² con mipmaps ≈ 21,3 MB; sin mipmaps 16 MB', S.textureMB([{ w: 2048, h: 2048 }]) === 21.3 && S.textureMB([{ w: 2048, h: 2048, mip: false }]) === 16);
  const t = 16.7;
  check('dónde está el límite: pantalla, CPU o GPU', S.bound({ n: 1, p50: 16.7 }, { p50: 4 }, t) === 'va a la frecuencia de la pantalla' && /CPU/.test(S.bound({ n: 1, p50: 30 }, { p50: 25 }, t)) && /GPU/.test(S.bound({ n: 1, p50: 30 }, { p50: 6 }, t)));
  check('nombre del dispositivo por la pantalla (el iPhone no dice el modelo)', /Pro Max/.test(S.deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 430, 932, 3)) && /SM-S918B/.test(S.deviceName('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit', 412, 915, 3.5)) && S.deviceName('Windows NT 10.0', 1920, 1080, 1) === 'Windows PC');
  const txt = S.format({ when: 'x', build: 'abc', device: { model: 'iPhone', screen: '932×430', dpr: 3, touch: true, gpu: 'Apple GPU', webgl: 2, maxTex: 16384 },
    settings: { quality: 'auto', profile: 'MEDIO', pixelRatio: '1.35', fpsCap: 60, hz: 60, pueblo: '3.0' }, load: { html: 300, dom: 900, load: 2500, firstFrame: 3100, mb: 13.4, big: [{ name: 'kit.glb', mb: 4.1, ms: 800 }] },
    maps: [{ name: 'PUEBLO', loadMs: 1200, frame: S.stats(a, t), cpu: S.stats([3, 4, 5], t), bound: 'x', scoped: S.stats([16.7, 16.7], t), calls: { avg: 150, max: 210 }, tris: { avg: 400000, max: 520000 }, textures: 60, texMB: 180, geometries: 300 }] });
  check('el informe trae dispositivo, ajustes, carga y cada mapa', /iPhone/.test(txt) && /MEDIO/.test(txt) && /kit\.glb 4\.1 MB/.test(txt) && /\[PUEBLO\]/.test(txt) && /150 llamadas/.test(txt) && /400 mil triángulos/.test(txt) && /180 MB/.test(txt) && /mira 8×/.test(txt));
}

(async () => {
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('\n(playwright no está: se omite la parte del navegador)'); return done(); }
  const ss = require('../tools/static-server.js');
  console.log('\nEN LA PÁGINA (?medir=rapido)');
  const srv = await ss.start(), b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const ctx = await b.newContext({ viewport: { width: 932, height: 430 }, hasTouch: true, isMobile: true });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(srv.url + '?perf=low&medir=rapido');
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
    const sawStatus = await p.waitForFunction(() => !document.getElementById('perfStat').hidden, null, { timeout: 30000 }).then(() => true, () => false);
    const ok = await p.waitForFunction(() => !document.getElementById('perfBox').hidden, null, { timeout: 300000 }).then(() => true, () => false);
    const r = await p.evaluate(() => ({ txt: document.getElementById('perfTxt').textContent, R: __SD.PERF.last, state: __SD.state, adapt: __SD.GFX.adapt && __SD.GFX.adapt.enabled, auto: __SD.renderer.info.autoReset, saved: localStorage.getItem('sniperduel_perfReport') }));
    check('se ve «MIDIENDO…» mientras juega solo y al final sale el informe', sawStatus && ok);
    check('mide los tres mapas con fotogramas, CPU, llamadas, triángulos y texturas', r.R && r.R.maps.length === 3 && r.R.maps.every(m => !m.failed && m.frame.n > 0 && m.cpu.n > 0 && m.calls.avg > 0 && m.tris.avg > 0 && m.textures > 0 && m.texMB > 0), r.R && r.R.maps.map(m => m.name + ' ' + (m.frame ? m.frame.n + ' fotogramas, ' + m.calls.avg + ' llamadas' : 'FALLÓ')).join(' · '));
    check('tiempos de carga y descarga de la página', r.R && r.R.load.firstFrame > 0 && r.R.load.mb > 0 && r.R.load.big.length > 0);
    check('vuelve al menú, la resolución automática vuelve a estar como estaba y el informe se guarda', r.state === 'menu' && r.auto === true && !!r.saved && JSON.parse(r.saved) === r.txt);
    check('sin errores de JavaScript', errs.length === 0, errs.slice(0, 2).join(' | '));
    console.log('\n' + r.txt.split('\n').map(l => '       ' + l).join('\n'));
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close && srv.close();
  done();
})();
function done() { console.log('\n' + pass + ' correctas, ' + fail + ' fallidas'); process.exit(fail ? 1 : 0); }
