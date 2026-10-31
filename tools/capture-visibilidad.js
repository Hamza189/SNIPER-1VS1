/* Visibilidad de enemigos (GF-4, docs/GAMEFEEL.md): el mismo enemigo, quieto y de frente, a 10, 20, 30 y 40 m en la
   calle de (−4, −16) de PUEBLO 3.0 mirando al oeste (46 m libres, fachada al fondo), y a 60 y 90 m desde la esquina
   (−46, −46) mirando al norte (96 m libres), con NORMAL, SILUETA MEJORADA, CONTORNO (rojo) y CONTORNO de un compañero
   (azul, 'amigo'); además, el enemigo detrás de una fachada (no debe verse nada) y a 40 m con el visor 8× (no debe
   aparecer nada: con el zoom parece estar a 5 m).
     node tools/capture-visibilidad.js OUT_DIR           (WebGL por software: vale para comparar aspecto, no para FPS)
   Escribe OUT_DIR/<caso>-<modo>.png y OUT_DIR/casos.json (dónde queda el enemigo en la pantalla, para recortar). */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ss = require('./static-server.js');
const OUT = process.argv[2] || '.';
fs.mkdirSync(OUT, { recursive: true });
const MODES = ['normal', 'silueta', 'contorno', 'amigo'];
// [case, camera x, z, yaw, enemy distance along the view, scope]
const Y = Math.PI / 2;
const CASES = [['d10', -4, -16, Y, 10], ['d20', -4, -16, Y, 20], ['d30', -4, -16, Y, 30], ['d40', -4, -16, Y, 40],
  ['d60', -46, -46, Math.PI, 60], ['d90', -46, -46, Math.PI, 90], ['pared', -9, 17, 2.76, 26], ['visor8x', -4, -16, Y, 40, true]];

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'alto', v: 3 })); } catch (e) {} });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(srv.url + '?pueblo=3', { timeout: 180000 });
  await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 180000 });
  await p.addStyleTag({ content: '#lockHint{display:none!important}' });
  await p.evaluate(async () => { __SD.setMode('duel'); __SD.setDuelLethal(false); __SD.setOffMap('pueblo'); __SD.startMatch();
    const t = performance.now(); while (!(__SD.state === 'playing' && __SD.LOAD.phase === 'ready' && __SD.BOTS.length && __SD.BOTS[0].rig.v2) && performance.now() - t < 180000) await new Promise(r => setTimeout(r, 200)); });
  await p.waitForFunction(() => __SD.P3W && __SD.P3W.kit, null, { timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const where = {};
  for (const [name, x, z, yaw, d, scope] of CASES) {
    for (const mode of MODES) {
      if ((name === 'visor8x' || name === 'pared') && (mode === 'silueta' || mode === 'amigo')) continue;
      const r = await p.evaluate(([x, z, yaw, d, scope, mode]) => {
        const S = __SD, B = S.BOTS[0];
        S.SETTINGS.enemyVis = mode === 'amigo' ? 'contorno' : mode; S.VIS.botKind = mode === 'amigo' ? 'mate' : 'foe'; S.MANUAL.on = true; S.SHOT.noVM = !scope;
        document.getElementById('hud').hidden = true;
        B.update0 = () => {};   // the enemy stands still (its AI off), its body still animates (idle)
        Object.assign(S.PM, { x, y: 0, z, vx: 0, vy: 0, vz: 0 }); Object.assign(S.PMprev, { x, y: 0, z }); S.P.yaw = yaw; S.P.pitch = 0;
        S.FLORA.ready = false; S.P.swayT = 0; S.P.bob = 0;   // still grass and no sway: two captures differ only by the effect
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // yaw 0 looks towards -z
        B.g.position.set(x + fx * d, 0, z + fz * d); B.g.rotation.y = Math.atan2(-fx, -fz); B.g.visible = true;
        S.input.scope = !!scope; if (scope) S.WS.zoom = 8;
        for (let i = 0; i < (scope ? 36 : 4); i++) S.advance(16);
        const v = B.g.position.clone(); v.y += 1.1; v.project(S.camera);
        return { sx: (v.x + 1) / 2, sy: (1 - v.y) / 2, fov: +S.camera.fov.toFixed(2), vis: S.VIS.rim.value + '/' + S.VIS.out.value };
      }, [x, z, yaw, d, !!scope, mode]);
      await p.waitForTimeout(150);
      await p.screenshot({ path: OUT + '/' + name + '-' + mode + '.png', timeout: 240000 });
      where[name] = r; console.log(name, mode, JSON.stringify(r));
    }
    await p.evaluate(() => { __SD.input.scope = false; for (let i = 0; i < 24; i++) __SD.advance(16); });
  }
  fs.writeFileSync(OUT + '/casos.json', JSON.stringify(where, null, 1));
  await b.close(); srv.close();
})();
