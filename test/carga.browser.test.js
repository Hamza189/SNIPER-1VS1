/* PANTALLA DE CARGA (?carga=2, docs/CARGA.md) en la página real:
   - sin la bandera no aparece ni cambia nada
   - con ?carga=2 sale antes que nada, la barra solo sube y llega al 100 %; cada pieza que dice «hecha» está de verdad
     (personajes en memoria, armas, texturas, ningún archivo a medias, sombreadores preparados, bots de la partida) y
     después la partida empieza y se juega
   - el móvil: en memoria solo tu operador y los bots (los demás personajes, solo descargados) y de uno en uno
   - un archivo que falla no bloquea: la barra llega igual al 100 % y el juego sigue con su versión sencilla
   - ENTRAR YA deja pasar al menú y lo demás sigue cargando detrás; el aparato recuerda la bandera (?carga=1 la quita)
   Run: node test/carga.browser.test.js   (WebGL por software: cuenta, no mide tiempos) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

async function open(b, url, o) {
  o = o || {};
  const ctx = o.ctx || await b.newContext(o.phone ? { viewport: { width: 932, height: 320 }, hasTouch: true, isMobile: true } : { viewport: { width: 800, height: 450 } });
  if (!o.ctx) {
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    if (o.block) await ctx.route(o.block, r => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
  }
  const p = await ctx.newPage(), errs = [], seen = [];
  p.on('pageerror', e => errs.push(e.message));
  // the bar, sampled from the very start (before the game's code has even run)
  await p.exposeFunction('__cgSeen', v => seen.push(v));
  await p.addInitScript(() => { const t = setInterval(() => { const e = document.getElementById('carga'); if (!e) return;
    window.__cgSeen([e.hidden ? -1 : +e.getAttribute('aria-valuenow'), document.readyState]); if (window.__SD && window.__SD.CARGA && window.__SD.CARGA.done) clearInterval(t); }, 150); });
  await p.goto(url);
  await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
  return { ctx, p, errs, seen };
}
const report = p => p.evaluate(() => { const C = __SD.CARGA; return { on: C.on, done: C.done, skipped: C.skipped, cover: C.cover, hidden: document.getElementById('carga').hidden,
  pct: +document.getElementById('carga').getAttribute('aria-valuenow'), pieces: C.P.map(x => ({ id: x.id, cat: x.cat, mode: x.mode, s: C.st[x.id] && C.st[x.id].s, bytes: x.bytes || 0, urls: x.urls ? x.urls.length : 0 })), log: C.log }; });
// every piece marked done is really there (the bar never says more than what is loaded)
const truth = p => p.evaluate(() => {
  const S = __SD, C = S.CARGA, out = {};
  for (const x of C.P) { const s = C.st[x.id] && C.st[x.id].s; if (s !== 'ok') continue; let ok = true;
    if (x.id.startsWith('pj:')) ok = !!S.PJ2.tpls[x.id.slice(3)];
    else if (x.id === 'vm') ok = S.VMA.ready;
    else if (x.id === 'tex') ok = (S.TEX.ok || 0) + (S.TEX.fail || 0) >= (S.TEX.asked || 0);
    else if (x.id === 'kit') ok = !!S.P3W.kit;
    else if (x.id === 'flora') ok = S.FLORA.ready;
    else if (x.id === 'warm') ok = C.warm >= 5;
    else if (x.mode === 'cache') ok = x.bytes > 0;
    out[x.id] = ok; }
  return out; });

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  console.log('\nSIN LA BANDERA');
  {
    const o = await open(b, srv.url + '?vm=1');
    await o.p.waitForTimeout(1500);
    const r = await report(o.p);
    check('no sale la pantalla ni hay piezas', !r.on && r.hidden && r.pieces.length === 0 && o.seen.every(v => v[0] === -1), JSON.stringify(o.seen.slice(0, 3)));
    check('sin errores', o.errs.length === 0, o.errs[0]);
    await o.ctx.close();
  }

  console.log('\nCON ?carga=2 (PC, ALTO)');
  let pcCtx;
  {
    const o = await open(b, srv.url + '?vm=1&carga=2'), p = o.p; pcCtx = o.ctx;
    const early = o.seen.find(v => v[0] >= 0);
    check('sale lo primero, antes de que acabe de cargar la página', !!early && o.seen.some(v => v[0] >= 0 && v[1] !== 'complete'), JSON.stringify(o.seen.slice(0, 4)));
    await p.waitForFunction(() => __SD.CARGA.done, null, { timeout: 240000, polling: 200 });
    await p.waitForTimeout(1000);   // (the fade: 0,25 + 0,38 s)
    const r = await report(p), t = await truth(p);
    const vals = o.seen.map(v => v[0]).filter(v => v >= 0);
    check('la barra solo sube y llega al 100 %', vals.every((v, i) => !i || v >= vals[i - 1]) && r.pct === 100, vals.filter((v, i) => !i || v !== vals[i - 1]).join(' '));
    check('después se quita y deja el menú', r.hidden && !r.cover);
    check('todas las piezas terminadas', r.pieces.every(x => ['ok', 'fail', 'skip'].includes(x.s)), r.pieces.filter(x => !['ok', 'fail', 'skip'].includes(x.s)).map(x => x.id).join());
    const cats = new Set(r.pieces.map(x => x.cat));
    check('carga motor, texturas, personajes, armas, preparar y lo de después', ['motor', 'tex', 'pj', 'armas', 'prep', 'desc'].every(c => cats.has(c)), [...cats].join());
    check('lo que dice que ha cargado está de verdad', Object.values(t).length > 5 && Object.values(t).every(Boolean), JSON.stringify(t));
    const pj = r.pieces.filter(x => x.id.startsWith('pj:'));
    check('PC: los cuatro personajes a memoria (el rival online puede llevar cualquiera)', pj.length === 4 && pj.every(x => x.s === 'ok'), pj.map(x => x.id + ':' + x.s).join(' '));
    const st = await p.evaluate(() => ({ bots: __SD.BOTS.length, want: 0, warm: __SD.CARGA.warm, tpls: Object.keys(__SD.PJ2.tpls).length, prev: Object.keys(__SD.PJ2.prev) }));
    check('preparados los bots de la primera partida y los sombreadores', st.warm >= 5 && st.bots >= 2, JSON.stringify(st));
    check('las versiones 1K que nadie lleva ya no están en memoria', st.prev.length === 0, st.prev.join());
    const dl = r.pieces.filter(x => x.mode === 'cache');
    check('lo de después solo se descarga (sin decodificar) y llega', dl.length > 0 && dl.every(x => x.s === 'ok' && x.bytes > 0), dl.map(x => x.id + ':' + x.bytes).join(' '));
    const game = await p.evaluate(async () => { const S = __SD; S.setMode('duel'); S.setOffMap('arena'); S.startMatch(); await new Promise(r => setTimeout(r, 1500));
      return { state: S.state, bots: S.BOTS.filter(b => b.alive).length, v2: S.BOTS.filter(b => b.alive).every(b => b.rig.v2 && !b.rig.v2prev) }; });
    check('la partida empieza y se juega, con los bots ya con su personaje completo', game.state === 'playing' && game.bots > 0 && game.v2, JSON.stringify(game));
    check('sin errores', o.errs.length === 0, o.errs[0]);
    await p.close();
    // the device remembers the flag; ?carga=1 forgets it
    const o2 = await open(b, srv.url + '?vm=1', { ctx: pcCtx });
    check('el aparato la recuerda (sin la bandera en la dirección sale igual)', await o2.p.evaluate(() => __SD.CARGA.on));
    await o2.p.close();
    const o3 = await open(b, srv.url + '?vm=1&carga=1', { ctx: pcCtx });
    check('?carga=1 vuelve a la entrada de siempre', await o3.p.evaluate(() => !__SD.CARGA.on && document.getElementById('carga').hidden));
    await o3.p.close();
    await pcCtx.close();
  }

  console.log('\nCON ?carga=2 (MÓVIL en horizontal, 932 × 320)');
  {
    const o = await open(b, srv.url + '?vm=1&carga=2', { phone: true }), p = o.p;
    await p.waitForFunction(() => __SD.CARGA.done, null, { timeout: 240000, polling: 200 });
    await p.waitForTimeout(1000);
    const r = await report(p);
    const gpuPj = r.pieces.filter(x => x.id.startsWith('pj:')), dlPj = r.pieces.filter(x => x.id.startsWith('dl:assets/personaje'));
    const tp = await p.evaluate(() => Object.keys(__SD.PJ2.tpls));
    check('en memoria solo tu operador y los bots', gpuPj.length <= 2 && tp.length <= 2, tp.join(' '));
    check('los demás personajes, solo descargados (su versión ligera)', dlPj.length >= 2 && dlPj.every(x => x.s === 'ok' && x.bytes > 0), dlPj.map(x => x.id + ':' + x.bytes).join(' '));
    // one at a time: each piece the screen starts begins after the one before it has finished
    const starts = r.log.filter(x => x[1] === 'start'), ends = {};
    for (const x of r.log) if (['ok', 'fail', 'skip'].includes(x[1])) ends[x[0]] = x[2];
    const order = r.pieces.map(x => x.id);
    const seq = starts.every((s, i) => { const k = order.indexOf(s[0]); return order.slice(0, k).every(id => ends[id] !== undefined && ends[id] <= s[2]); });
    check('de uno en uno y en orden', starts.length > 2 && seq, starts.map(s => s[0]).join(' → '));
    check('llega al 100 % y se quita', r.pct === 100 && r.hidden);
    await p.screenshot({ path: require('path').join(__dirname, '..', '.work', 'carga-test-movil.png') }).catch(() => {});
    const game = await p.evaluate(async () => { const S = __SD; S.setMode('duel'); S.startMatch(); await new Promise(r => setTimeout(r, 1200)); return S.state; });
    check('la partida empieza', game === 'playing', game);
    check('sin errores', o.errs.length === 0, o.errs[0]);
    await o.ctx.close();
  }

  console.log('\nUN ARCHIVO QUE FALLA (los bots: FSB, bloqueado)');
  {
    const o = await open(b, srv.url + '?vm=1&carga=2', { block: /pro\/op3\/personaje/ }), p = o.p;
    await p.waitForFunction(() => __SD.CARGA.done, null, { timeout: 240000, polling: 200 });
    const r = await report(p), x = r.pieces.find(x => x.id === 'pj:assets/personaje/pro/op3/');
    check('la pieza queda como fallida y la barra llega igual al 100 %', x && x.s === 'fail' && r.pct === 100, x && x.s);
    const game = await p.evaluate(async () => { const S = __SD; S.setMode('duel'); S.setOffMap('arena'); S.startMatch(); await new Promise(r => setTimeout(r, 1200));
      return { state: S.state, bots: S.BOTS.filter(b => b.alive).length }; });
    check('el juego sigue (los bots con su figura sencilla)', game.state === 'playing' && game.bots > 0, JSON.stringify(game));
    await o.ctx.close();
  }

  console.log('\nENTRAR YA');
  {
    // the characters arrive slowly: ENTRAR YA lets you in, the rest goes on behind the menu
    const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.route(/personaje\/pro\/op2\/personaje(_2k)?\.glb/, async r => { await new Promise(res => setTimeout(res, 9000)); r.continue(); });
    await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
    const o = await open(b, srv.url + '?vm=1&carga=2', { ctx }), p = o.p;
    await p.waitForSelector('#cgSkip:not([hidden])', { timeout: 120000 });
    const before = await p.evaluate(() => __SD.CARGA.done);
    await p.click('#cgSkip');
    await p.waitForTimeout(600);
    const r = await report(p);
    check('aparece cuando el mínimo está y deja pasar al menú antes de terminar', !before && r.skipped && r.hidden, JSON.stringify({ before, skipped: r.skipped }));
    await p.waitForFunction(() => __SD.CARGA.done, null, { timeout: 240000, polling: 300 });
    check('lo que faltaba termina detrás del menú', await p.evaluate(() => !!__SD.PJ2.tpls['assets/personaje/pro/op2/'] && __SD.state === 'menu'));
    await ctx.close();
  }

  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallos');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
