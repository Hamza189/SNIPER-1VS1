/* GAME FEEL 3.0, primera entrega (30-10-2026, docs/GAMEFEEL.md):
   - GF-1 movimiento TÁCTICO, el del juego (y del servidor) desde el 30-10-2026: andar a 4,05 m/s en vez de 4,6 y arrancar
     con algo de inercia (95 % en ~0,12 s en vez de ~0,075 s); el de antes sigue con ?mov=clasico (sin conexión)
   - GF-5 los bots se animan una vez por fotograma dibujado (antes, en cada paso de 120 Hz: 2 veces por fotograma)
   - GF-4 visibilidad de enemigos: apagada por defecto; igual online; con CONTORNO, el enemigo DETRÁS de una pared deja la
     imagen igual que sin él (píxeles leídos de la GPU), y uno a la vista sí cambia
   Run: node test/gamefeel.browser.test.js */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const open = async (q, settings) => {
    const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(s => { try { localStorage.setItem('sniperduel_settings', JSON.stringify(s)); } catch (e) {} }, settings || { v: 3 });
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && /shader|WebGLProgram|GLSL/i.test(m.text())) errs.push(m.text().slice(0, 200)); });
    await p.goto(srv.url + q, { timeout: 180000 });
    await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 180000 });
    await p.evaluate(() => { HTMLCanvasElement.prototype.requestPointerLock = function () {}; });
    return { ctx, p, errs };
  };
  const play = (p, map) => p.evaluate(async map => { __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.setOffMap(map); __SD.startMatch();
    const t = performance.now(); while (!(__SD.state === 'playing' && __SD.LOAD.phase === 'ready') && performance.now() - t < 120000) await new Promise(r => setTimeout(r, 100)); }, map);
  // walk forward from standing still, one simulated 60 FPS frame at a time: top speed and time to 95 % of it
  const walk = p => p.evaluate(() => { const S = __SD; S.MANUAL.on = true;
    // always from the same spot, towards its most open direction (the spawn is random: it may face a wall)
    const o = window.__walk0 || (window.__walk0 = (() => { const ray = new THREE.Raycaster(); let best = { free: -1 };
      for (let k = 0; k < 16; k++) { const yaw = k * Math.PI / 8; ray.set(new THREE.Vector3(S.PM.x, 1.0, S.PM.z), new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)));
        ray.near = 0; ray.far = 50; const h = ray.intersectObjects(S.W.ray, false), free = h.length ? h[0].distance : 50; if (free > best.free) best = { free, yaw }; }
      return { x: S.PM.x, z: S.PM.z, yaw: best.yaw, free: best.free }; })());
    Object.assign(S.PM, { x: o.x, z: o.z, vx: 0, vz: 0 }); Object.assign(S.PMprev, { x: o.x, z: o.z }); S.P.yaw = o.yaw;
    for (let i = 0; i < 6; i++) S.advance(1000 / 60);
    S.input.keys.KeyW = true; const v = []; for (let i = 0; i < 40; i++) { S.advance(1000 / 60); v.push(Math.hypot(S.PM.vx, S.PM.vz)); }
    S.input.keys.KeyW = false; const top = v[v.length - 1], t95 = (v.findIndex(x => x >= 0.95 * top) + 1) / 60;
    for (let i = 0; i < 20; i++) S.advance(1000 / 60); return { top: +top.toFixed(3), t95: +t95.toFixed(3) }; });
  try {
    console.log('\nGF-1 · MOVIMIENTO');
    const C = await open('?pj=0&mov=clasico');
    await play(C.p, 'arena');
    const act = await walk(C.p);
    check('?mov=clasico (comparar, sin conexión): el movimiento de antes (4,6 m/s, arranque en ~0,08 s)', Math.abs(act.top - 4.6) < 0.02 && act.t95 <= 0.1, JSON.stringify(act));
    await C.ctx.close();
    const A = await open('?pj=0');
    await play(A.p, 'arena');
    const tac = await walk(A.p);
    check('TÁCTICO, el del juego: 4,05 m/s (−12 %) y arranque con algo de peso (0,11–0,15 s)', Math.abs(tac.top - 4.05) < 0.02 && tac.t95 >= 0.11 && tac.t95 <= 0.15, JSON.stringify(tac));
    check('es el reglamento del servidor (SD_CONFIG.move), el mismo para todos', await A.p.evaluate(() => SD_CONFIG.move.walk === 4.05 && SD_CONFIG.move.groundAccel === 32 && !__SD.MOV_CLASSIC && __SD.MOVE_CLASSIC.walk === 4.6));

    console.log('\nGF-5 · BOTS ANIMADOS UNA VEZ POR FOTOGRAMA');
    // simulated 60 FPS frames: 2 simulation steps each (120 Hz)
    const an = await A.p.evaluate(() => { const S = __SD; S.PROF.on = true; S.PROF.reset(); for (let i = 0; i < 60; i++) S.advance(1000 / 60); const a = S.PROF.avg(); S.PROF.on = false;
      const vis = S.BOTS.filter(b => b.g.visible).length; return { animN: a.animN, ticksN: a.ticksN, vis }; });
    check('cada personaje se anima como mucho una vez por fotograma (aunque haya varios pasos de simulación)', an.animN <= an.vis + 1.05, JSON.stringify(an));
    check('sin errores', A.errs.length === 0, A.errs.slice(0, 2).join(' | '));
    await A.ctx.close();

    console.log('\nGF-4 · VISIBILIDAD DE ENEMIGOS');
    const V = await open('?pueblo=3&pj=0');
    await play(V.p, 'pueblo');
    check('por defecto NORMAL: sin efecto', await V.p.evaluate(() => __SD.SETTINGS.enemyVis === 'normal' && __SD.VIS.rim.value === 0 && __SD.VIS.out.value === 0));
    check('la misma regla online y sin conexión (solo si el jugador la elige)', await V.p.evaluate(() => __SD.visOn('online', 'contorno', 'playing') && __SD.visOn('duel', 'contorno', 'playing') && !__SD.visOn('online', 'normal', 'playing') && !__SD.visOn('duel', 'contorno', 'menu')));
    // the enemy 26 m away BEHIND a façade, then in plain view 30 m down a street; GPU pixels around where it stands
    const px = await V.p.evaluate(() => {
      const S = __SD, B = S.BOTS[0], g = S.renderer.getContext(); S.MANUAL.on = true; S.SHOT.noVM = true; B.update0 = () => {}; S.FLORA.ready = false;
      for (const o of S.BOTS) if (o !== B) { o.update0 = () => {}; o.g.visible = false; }   // only the measured enemy: no other bot walking through
      const shot = (x, z, yaw, d, mode) => { S.SETTINGS.enemyVis = mode; Object.assign(S.PM, { x, y: 0, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y: 0, z });
        S.P.yaw = yaw; S.P.pitch = 0; S.P.swayT = 0; S.P.bob = 0; const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        B.g.position.set(x + fx * d, 0, z + fz * d); B.g.rotation.y = Math.atan2(-fx, -fz); B.g.visible = true;
        for (let i = 0; i < 3; i++) S.advance(16);
        const v = B.g.position.clone(); v.y += 0.9; v.project(S.camera); const w = g.drawingBufferWidth, h = g.drawingBufferHeight;
        const cx = Math.round((v.x + 1) / 2 * w), cy = Math.round((v.y + 1) / 2 * h), R = 24, buf = new Uint8Array(4 * (2 * R) * (2 * R));
        S.advance(16); g.readPixels(cx - R, cy - R, 2 * R, 2 * R, g.RGBA, g.UNSIGNED_BYTE, buf); return buf; };
      // the pair is drawn with the body frozen in the same pose: only the effect can differ
      const pair = (x, z, yaw, d) => { const keep = B.animFrame; const a = shot(x, z, yaw, d, 'normal'); B.animFrame = () => {}; const c = shot(x, z, yaw, d, 'contorno'); B.animFrame = keep; return [a, c]; };
      const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return +(s / (a.length / 4) / 3).toFixed(3); };
      const r = { pared: diff(...pair(-9, 17, 2.76, 26)), vista: diff(...pair(-4, -16, Math.PI / 2, 30)), cerca: diff(...pair(-4, -16, Math.PI / 2, 8)) };
      S.SETTINGS.enemyVis = 'normal'; S.MANUAL.on = false; return r; });
    check('enemigo DETRÁS de una pared: con CONTORNO la imagen no cambia (no se ve a través)', px.pared < 0.05, JSON.stringify(px));
    check('enemigo a la vista a 30 m: el CONTORNO sí se ve', px.vista > 0.5, px.vista);
    check('a 8 m no cambia nada (cerca, la silueta natural)', px.cerca < 0.05, px.cerca);
    check('sin errores de shader', V.errs.length === 0, V.errs.slice(0, 2).join(' | '));
    await V.ctx.close();
  } catch (e) { fail++; console.log('  FAIL ' + (e && e.stack || e)); }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
