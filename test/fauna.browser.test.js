/* PUEBLO 3.0 fauna and flora in the real page (client/rats.js, client/flora.js), per graphics profile:
   - everything loads (no 404, no errors), ALTO 3 rats, MEDIO 2, BAJO none; plants ALTO > MEDIO > BAJO
   - the plants stay within budget (grass as 4-triangle cards; dandelions in their light LOD) and cast no shadow
   - the rats move (not statues), never stand inside a wall or a low box, flee from the player and hide in the drain
   - &ratas=0&flora=0 → nothing of it is downloaded; collision boxes are the same as without them
   Run: node test/fauna.browser.test.js   (software WebGL is fine: nothing is timed) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

async function open(b, url, q) {
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 3 })); } catch (e) {} }, q);
  const p = await ctx.newPage(), bad = [], files = [], errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (/rata|flora/.test(m.text())) errs.push(m.text()); });
  p.on('response', r => { const u = r.url(); if (/\/assets\//.test(u) && r.status() >= 400) bad.push(r.status() + ' ' + u.replace(/^.*\/assets\//, '')); if (/\/assets\/.*(fauna|flora|rat_)/.test(u)) files.push(u.replace(/^.*\/assets\//, '').replace(/\?.*/, '')); });
  await p.goto(url);
  await p.waitForFunction(() => window.__SD && __SD.P3W && __SD.P3W.kit && (!__SD.FLORA.on || __SD.FLORA.ready || __SD.FLORA.failed) && (!__SD.RATS.on || __SD.RATS.ready || __SD.RATS.failed), null, { timeout: 180000 });
  await p.waitForTimeout(1500);
  return { ctx, p, bad, files, errs };
}
const colliders = p => p.evaluate(() => __SD.W.colliders.map(c => [c.minX, c.minY, c.minZ, c.maxX, c.maxY, c.maxZ].map(v => +v.toFixed(3)).join(',')).join(';'));

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const off = await open(b, srv.url + '?vm=1&pueblo=3&ratas=0&flora=0', 'alto');
  const baseCol = await colliders(off.p);
  console.log('\nSIN FAUNA NI FLORA');
  check('&ratas=0&flora=0: no se descarga nada de ratas ni plantas', off.files.length === 0, off.files.join(' '));
  await off.ctx.close();
  const counts = {};
  for (const q of ['alto', 'medio', 'bajo']) {
    console.log('\n' + q.toUpperCase());
    const o = await open(b, srv.url + '?vm=1&pueblo=3', q), p = o.p;
    const r = await p.evaluate(() => { const S = __SD, F = S.FLORA, R = S.RATS;
      const shadow = F.meshes.some(m => m.castShadow);
      const grassTris = F.meshes.filter(m => /grass/.test(m.name)).reduce((n, m) => n + m.count * (m.geometry.index.count / 3), 0) / Math.max(1, F.meshes.filter(m => /grass/.test(m.name)).reduce((n, m) => n + m.count, 0));
      return { rats: R.list.length, ratsOn: R.on, plants: F.plants, tris: F.tris, calls: F.meshes.length, shadow, grassTris, ready: F.ready }; });
    counts[q] = r.plants;
    check('todo carga sin 404 ni errores', o.bad.length === 0 && o.errs.length === 0, o.bad.concat(o.errs).slice(0, 3).join(' | ') || o.files.length + ' archivos');
    check('ratas: ' + (q === 'alto' ? '3' : q === 'medio' ? '2' : 'ninguna (BAJO)'), r.rats === (q === 'alto' ? 3 : q === 'medio' ? 2 : 0), r.rats);
    check('plantas listas, con un presupuesto razonable (≤ 70 000 triángulos, ≤ 16 llamadas de dibujo)', r.ready && r.plants > 0 && r.tris <= 70000 && r.calls <= 16, r.plants + ' plantas · ' + Math.round(r.tris) + ' triángulos · ' + r.calls + ' llamadas');
    check('la hierba son tarjetas de 4 triángulos y ninguna planta proyecta sombra', Math.abs(r.grassTris - 4) < 1e-9 && !r.shadow, r.grassTris);
    check('las colisiones son las mismas que sin fauna ni flora', (await colliders(p)) === baseCol);
    if (q === 'alto') {
      // 40 s of simulated life with the player far away, then the player walks up to a rat
      const life = await p.evaluate(() => { const S = __SD, R = S.RATS, W = S.RAT_WORLD; S.setWorld('pueblo');
        for (const q of R.list) Object.assign(q.brain, { state: 'idle', t: 1, visible: true, sink: 0, x: q.brain.home.x + 0.7, z: q.brain.home.z + 0.5 });
        S.camera.position.set(0, 1.6, -40); S.camera.updateMatrixWorld(); R.shot.at = 0;
        const start = R.list.map(q => [q.brain.x, q.brain.z]); let inWall = 0, moved = 0; const states = new Set();
        for (let i = 0; i < 400; i++) { S.ratsFrame(0.1); for (const q of R.list) { states.add(q.brain.state); if (q.brain.visible && W.blocked(q.brain.x, q.brain.z) && Math.hypot(q.brain.x - q.brain.home.x, q.brain.z - q.brain.home.z) > 0.5) inWall++; } }
        R.list.forEach((q, i) => { moved = Math.max(moved, Math.hypot(q.brain.x - start[i][0], q.brain.z - start[i][1])); });
        // a bone that moves: the body is animated, not a sliding statue
        const q = R.list[0]; let bone = null; q.root.traverse(o => { if (!bone && o.isBone && /leg|pata|thigh|shin|foot/i.test(o.name)) bone = o; });
        const r0 = bone ? bone.quaternion.clone() : null; for (let i = 0; i < 3; i++) S.ratsFrame(0.1); const legMoves = bone ? bone.quaternion.angleTo(r0) > 0.01 || q.brain.state === 'idle' || q.brain.state === 'sniff' : false;
        // the player comes within 2 m of the first visible rat
        const v = R.list.find(q => q.brain.visible) || R.list[0]; S.camera.position.set(v.brain.x + 1.6, 1.6, v.brain.z + 1.2); S.camera.updateMatrixWorld(); S.ratsFrame(0.05);
        const fled = v.brain.state; for (let i = 0; i < 60; i++) S.ratsFrame(0.1);
        return { inWall, moved, states: [...states], fled, hidden: !v.brain.visible || v.brain.state === 'hidden', bone: bone && bone.name, legMoves }; });
      check('en 40 s pasan por varios estados y se mueven de verdad', life.states.length >= 3 && life.moved > 0.5, life.states.join(', ') + ' · ' + life.moved.toFixed(2) + ' m');
      check('ninguna rata dentro de una pared o caja', life.inWall === 0, life.inWall + ' fotogramas');
      check('el cuerpo está animado (huesos de las patas), no es una estatua que se desliza', !!life.bone && life.legMoves, life.bone);
      check('el jugador a 2 m: huye y acaba escondida en la alcantarilla', life.fled === 'flee' && life.hidden, life.fled);
    }
    await o.ctx.close();
  }
  check('densidad: ALTO > MEDIO > BAJO, BAJO mínima', counts.alto > counts.medio && counts.medio > counts.bajo && counts.bajo <= counts.alto * 0.3, counts.alto + ' / ' + counts.medio + ' / ' + counts.bajo);
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
