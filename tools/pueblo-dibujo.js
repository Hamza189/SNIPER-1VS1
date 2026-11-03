/* PUEBLO: what is drawn, and by whom (03-11-2026: the iPhone drew 249 calls / 401 k triangles in PUEBLO, against 202 /
   355 k on 30-10, and dropped to 55 FPS). A match in PUEBLO, quality ALTO, at the iPhone's size (932×430 at 2×), the
   camera turning a full circle at eye height in the plaza like MEDIR RENDIMIENTO; every draw call is counted by the
   object that makes it (the main pass and the sun's shadow pass apart), with its triangles.
   node tools/pueblo-dibujo.js [url-extra] [salida.json]     e.g.  node tools/pueblo-dibujo.js "&aa=0" antes.json
   env: BASE=http://127.0.0.1:8123/ to measure another server (an old commit in a worktree), FRAMES=16
   Software WebGL: calls and triangles are exact; times are not the phone's. */
'use strict';
const fs = require('fs');
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const EXTRA = process.argv[2] || '', OUT = process.argv[3] || '';
const FRAMES = +(process.env.FRAMES || 16);
(async () => {
  const srv = process.env.BASE ? null : await ss.start();
  const base = process.env.BASE || srv.url;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 932, height: 430 }, deviceScaleFactor: 2 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); localStorage.setItem('sniperduel_menuOld', 'true'); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(base + '?vm=1' + EXTRA, { timeout: 180000 });
  await p.waitForFunction(() => window.__SD && __SD.VMA && __SD.VMA.ready && __SD.P3W && (__SD.P3W.kit || !__SD.P3ON) && (!__SD.E10.on || __SD.E10.ready || __SD.E10.failed) && (!__SD.FLORA || !__SD.FLORA.on || __SD.FLORA.ready || __SD.FLORA.failed), null, { timeout: 240000 });
  await p.evaluate(() => { const S = __SD; S.setTrain('off'); S.setMode('duel'); if (S.setDuelLethal) S.setDuelLethal(false); if (S.setOffMap) S.setOffMap('pueblo'); S.startMatch(); });
  await p.waitForFunction(() => __SD.state === 'playing' && (!__SD.LOAD || __SD.LOAD.phase === 'ready' || !__SD.LOAD.phase), null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const r = await p.evaluate(n => {
    const S = __SD, R = S.renderer, tally = {};
    // the first named ancestor below the scene says what an object is (p3_…, kit_…, e10_…, flora_…, town…)
    const what = o => { let x = o, best = o.name || ''; while (x && x.parent && x.parent !== S.scene) { x = x.parent; if (x.name) best = x.name; }
      const k = (best || (o.isSkinnedMesh ? 'personaje' : o.isSprite ? 'sprite' : o.isInstancedMesh ? 'instanced' : 'sin nombre'));
      return k.replace(/[@:].*$/, '').replace(/_?\d+$/, '').replace(/^(p3|kit|e10|flora|town|casa2|streets|p0|rat)_([a-z]+).*$/i, '$1_$2'); };
    const orig = R.renderBufferDirect;
    let pass = 'principal';
    R.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
      const k = (camera.isOrthographicCamera ? 'sombra · ' : '') + what(object), t = tally[k] || (tally[k] = { calls: 0, tris: 0 });
      t.calls++; const g = geometry, c = g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0;
      t.tris += (object.isInstancedMesh ? object.count : 1) * (group ? Math.min(group.count, c) : (g.drawRange.count === Infinity ? c : Math.min(g.drawRange.count, c))) / 3;
      return orig.apply(this, arguments); };
    S.freeze(true); S.SHOT.noVM = false; S.MANUAL.on = true;
    for (const b of (S.BOTS || [])) { b.g.visible = false; if (b.glint) b.glint.visible = false; }
    Object.assign(S.PM, { x: 2, y: 0, z: 10, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x: 2, y: 0, z: 10 });
    let calls = 0, tris = 0; R.info.autoReset = false;
    for (let i = 0; i < n; i++) { S.P.yaw = i / n * Math.PI * 2; S.P.pitch = -0.04; R.info.reset(); S.advance(16); calls += R.info.render.calls; tris += R.info.render.triangles; }
    R.info.autoReset = true; R.renderBufferDirect = orig;
    for (const k in tally) { tally[k].calls = +(tally[k].calls / n).toFixed(1); tally[k].tris = Math.round(tally[k].tris / n); }
    return { calls: +(calls / n).toFixed(1), tris: Math.round(tris / n), p3: !!S.P3ON, aa: R.getContext().getContextAttributes().antialias, tally };
  }, FRAMES);
  const rows = Object.entries(r.tally).sort((a, b) => b[1].calls - a[1].calls);
  console.log('media por fotograma: ' + r.calls + ' llamadas · ' + r.tris + ' triángulos · pueblo 3.0 ' + r.p3);
  for (const [k, v] of rows.slice(0, 40)) console.log('  ' + String(v.calls).padStart(6) + ' llamadas  ' + String(v.tris).padStart(8) + ' tri  ' + k);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(r, null, 1));
  await b.close(); if (srv) srv.close();
})().catch(e => { console.error(e); process.exit(1); });
