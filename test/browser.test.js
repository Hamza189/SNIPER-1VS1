/* Real-browser test: opens index.html in headless Chromium (Playwright, WebGL by software)
   exactly as GitHub Pages serves it, and checks what the player actually sees.
   It is a real engine + real DOM + real CSS test, but NOT a test of Safari, Android or of
   real performance (software rendering on a server).
   Run: node test/browser.test.js   (needs the playwright package; skipped if missing) */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nNAVEGADOR REAL: playwright no está instalado, se omite'); process.exit(0); }

const root = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
// ids of the overlays that must only appear when the game asks for them
const OVERLAYS = ['lockHint', 'loadErr', 'rotate', 'settings', 'editPanel', 'pause', 'over', 'death', 'selfTestOut', 'dbg'];
const shown = page => page.evaluate(ids => ids.filter(id => { const e = document.getElementById(id); return e && e.checkVisibility && e.checkVisibility(); }), OVERLAYS);

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  const open = async (opts) => {
    const ctx = await browser.newContext(opts);
    // fonts come from Google; the test machine has no internet, the game must not depend on them
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1500);
    return { ctx, page };
  };
  try {
    console.log('\nPC (1280×720, ratón)');
    { const { ctx, page } = await open({ viewport: { width: 1280, height: 720 } });
      const st = await page.evaluate(() => ({ three: window.THREE && THREE.REVISION, sd: !!window.__SD, menu: document.querySelector('#menu, .menu, #start') ? 1 : 0, play: !!Array.from(document.querySelectorAll('button')).find(b => /JUGAR/.test(b.textContent) && b.checkVisibility()) }));
      check('Three.js r128 cargado desde el propio sitio (sin CDN)', st.three === '128');
      check('el juego arranca', st.sd);
      const ov = await shown(page);
      check('en el menú no se ve ninguna pantalla que debería estar oculta', ov.length === 0, ov.join(', ') || 'ninguna');
      check('el botón JUGAR se ve', st.play);
      await page.click('#openSettings');
      check('AJUSTES desde el menú se ve por encima del menú (no detrás)', await page.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return !!(e && e.closest('#settings')); }));
      check('con AJUSTES abierto el menú queda oculto (en iPhone se pintaba encima)', await page.evaluate(() => getComputedStyle(document.getElementById('menu')).visibility === 'hidden'));
      await page.click('#setClose');
      check('al cerrar AJUSTES vuelve el menú', await page.evaluate(() => getComputedStyle(document.getElementById('menu')).visibility === 'visible' && document.getElementById('settings').hidden));
      // the server's copy of the map (core/mapdata.js) is exactly the world the page builds
      const { dumpWorld } = require('../tools/export-map.js'), MAPF = require('../core/mapdata.js');
      const world0 = await page.evaluate(() => __SD.WORLD_ID);
      check('el menú enseña la ARENA DE PRUEBAS por defecto (mapa del duelo contra bots)', world0 === 'arena', world0);
      for (const id of ['pueblo', 'arena']) {
        const d = await dumpWorld(page, id), M = MAPF.maps[id];
        check('mapa ' + id + ': el del servidor coincide con el del juego (si cambias un mapa: node tools/export-map.js)', !!M && JSON.stringify(d.tris) === JSON.stringify(M.tris) && JSON.stringify(d.ds) === JSON.stringify(M.ds) && JSON.stringify(d.colliders) === JSON.stringify(M.colliders) && JSON.stringify(d.ramps) === JSON.stringify(M.ramps) && JSON.stringify(d.nav) === JSON.stringify(M.nav), (d.tris.length / 9) + ' triángulos');
      }
      check('después de comprobar los mapas la página sigue en el mismo mapa', await page.evaluate(w => __SD.WORLD_ID === w, world0));
      const dup = await page.evaluate(() => { const c = {}; document.querySelectorAll('[id]').forEach(e => c[e.id] = (c[e.id] || 0) + 1); return Object.keys(c).filter(k => c[k] > 1); });
      check('ningún id repetido en la página (si se repite, un dato se escribe en el sitio equivocado)', dup.length === 0, dup.join(', ') || 'ninguno');
      // real mouse click on JUGAR → the browser really captures the mouse (Pointer Lock)
      await page.evaluate(() => __SD.setMode('range'));
      await page.getByRole('button', { name: 'JUGAR', exact: true }).click();
      await page.waitForTimeout(1500);
      const locked = await page.evaluate(() => document.pointerLockElement === document.querySelector('canvas'));
      check('clic real en JUGAR: el navegador captura el ratón (Pointer Lock)', locked);
      // with the mouse captured, keep moving it the same way: the view must keep turning (no screen edge)
      const turn = await page.evaluate(async () => {
        const y0 = __SD.P.yaw;
        for (let i = 0; i < 40; i++) { window.dispatchEvent(new MouseEvent('mousemove', { movementX: 120, movementY: 0 })); await new Promise(r => requestAnimationFrame(r)); }
        return (y0 - __SD.P.yaw) * 180 / Math.PI;
      });
      check('ratón capturado: sigue girando sin tope (más de 360° hacia el mismo lado)', turn > 360, turn.toFixed(0) + '°');
      await page.waitForTimeout(1000);
      const res = await page.evaluate(() => __SD.aimSelfTest());
      const head = res[0] || '';
      check('autotest de puntería con el motor real: 0 fallidas', /✔ AUTOTEST/.test(head), head.replace(/^. /, ''));
      // VÍBORA 9 with the real keyboard and mouse (waits on the game state: without a GPU the frames are slow)
      const wf = (fn, ms) => page.waitForFunction(fn, null, { timeout: ms || 8000, polling: 50 }).then(() => true, () => false);
      await page.keyboard.press('Digit2');
      await wf(() => __SD.LOAD.active === 'pistol' && __SD.LOAD.phase === 'ready' && __SD.PCORE.state === 'ready');
      const pv = await page.evaluate(() => ({ a: __SD.LOAD.active, ph: __SD.LOAD.phase, name: document.getElementById('wname').textContent, ammo: document.getElementById('ammoNum').textContent }));
      check('tecla 2: sale la pistola VÍBORA 9 (HUD con su nombre y 12 balas)', pv.a === 'pistol' && pv.ph === 'ready' && /VÍBORA 9/.test(pv.name) && /^12/.test(pv.ammo), pv.name + ' · ' + pv.ammo);
      for (let i = 0; i < 3; i++) { await page.mouse.down(); await page.waitForFunction(n => __SD.PCORE.ammo === n, 11 - i, { timeout: 4000, polling: 30 }).catch(() => {}); await page.mouse.up(); await wf(() => __SD.PCORE.state === 'ready', 4000); }
      const pf = await page.evaluate(() => ({ ammo: __SD.PCORE.ammo, rifle: __SD.WCORE.ammo }));
      check('tres clics: tres disparos de pistola, el rifle conserva sus balas', pf.ammo === 9 && pf.rifle === 5, JSON.stringify(pf));
      await page.keyboard.press('KeyR');
      check('R recarga la pistola (12 otra vez)', await wf(() => __SD.PCORE.ammo === 12 && __SD.PCORE.state === 'ready', 30000));
      // the pistol animation, posed frame by frame (debug hook): magazine out and falling, the left hand
      // bringing the new one up the grip, slide racked, forearms always reaching to below the screen
      const an = await page.evaluate(() => {
        const S = __SD, PI = S.PIS, V = new THREE.Vector3(), r = {};
        const at = (u, f) => { PI.debug = { reload: u }; S.advance(16); const o = f(); PI.debug = null; return o; };
        const wy = o => { o.updateMatrixWorld(true); return V.setFromMatrixPosition(o.matrixWorld).y; };
        const glb = S.VMA.ready; r.glb = glb; r.all = !!(S.VMA.R && S.VMA.K);
        r.arms = glb ? S.VMA.rig.root.visible : PI.arms.visible;
        r.drop = at(0.12, () => [PI.oldMag.visible, wy(PI.oldMag)]); r.drop2 = at(0.3, () => [PI.oldMag.visible, wy(PI.oldMag)]);
        r.carry = at(0.45, () => { PI.lh.updateMatrixWorld(true); PI.mag.updateMatrixWorld(true);
          // modelled arms: the left wrist is behind the palm that holds the magazine's base plate
          const m = glb ? PI.mag.localToWorld(new THREE.Vector3(0, -0.1, 0)) : new THREE.Vector3().setFromMatrixPosition(PI.mag.matrixWorld);
          return [PI.mag.visible, new THREE.Vector3().setFromMatrixPosition(PI.lh.matrixWorld).distanceTo(m)]; });
        r.inserted = at(0.65, () => PI.mag.position.y);
        r.rack = at(0.79, () => PI.slide.position.z);
        r.rest = at(0, () => PI.slide.position.z);
        if (glb) { at(0, () => 0); const e = new THREE.Vector3().setFromMatrixPosition(S.VMA.rig.sides.R.bones.fore.matrixWorld); r.elbowBelow = e.y < -0.2 && e.z > -0.1; r.elbow = e.toArray().map(x => +x.toFixed(2)); }
        else { const elb = PI.armR.g.position.clone().add(new THREE.Vector3(0, 1, 0).applyQuaternion(PI.armR.g.quaternion).multiplyScalar(PI.armR.s.scale.y));
        r.elbowBelow = elb.y < -0.3; }
        return r;
      });
      check('pistola: los brazos se dibujan y los codos quedan por debajo y detrás (modelos ' + (an.glb ? 'GLB' : 'procedurales') + ')', an.arms && an.elbowBelow, JSON.stringify({ arms: an.arms, elbow: an.elbow }));
      check('se usan los modelos 3D (assets/viewmodels.glb) de la pistola, el rifle y la navaja', an.glb === true && an.all === true);
      check('recarga: el cargador vacío sale y cae', an.drop[0] && an.drop2[0] && an.drop2[1] < an.drop[1] - 0.03, an.drop.map(x => +(+x).toFixed(3)) + ' → ' + an.drop2.map(x => +(+x).toFixed(3)));
      check('recarga: la mano izquierda trae el cargador nuevo pegado a la mano', an.carry[0] && an.carry[1] < 0.12, (+an.carry[1]).toFixed(3) + ' m');
      check('recarga: el cargador queda metido y la corredera se acciona', an.inserted === 0 && an.rack > 0.025 && an.rest === 0, JSON.stringify({ inserted: an.inserted, rack: an.rack }));
      // E3: a hit on the ground leaves a dirt-type hole and particles; changing map clears the holes
      const fx = await page.evaluate(() => {
        const S = __SD, g = S.W.ray[0], before = S.PARTS.filter(q => q.s.visible).length;
        S.impactFX({ point: new THREE.Vector3(0, 0.01, 60), face: { normal: new THREE.Vector3(0, 1, 0) }, object: g }, 10);
        const d = S.DECALS.filter(m => m.visible), parts = S.PARTS.filter(q => q.s.visible).length - before;
        S.bodyFX(new THREE.Vector3(0, 1.2, 62), new THREE.Vector3(0, 0, 1), true, 40);
        const w0 = S.WORLD_ID; S.setWorld(w0 === 'pueblo' ? 'arena' : 'pueblo'); const after = S.DECALS.filter(m => m.visible).length; S.setWorld(w0);
        return { holes: d.length, tex: d.length ? !!d[d.length - 1].material.map : false, parts, after };
      });
      check('impacto: agujero con textura, polvo, trozos y fogonazo; al cambiar de mapa se borran los agujeros', fx.holes >= 1 && fx.tex && fx.parts >= 8 && fx.after === 0, JSON.stringify(fx));
      // E4: the rival's jointed body: hands on the rifle, head where the server's head is (standing and
      // crouched), the weapon dropped on death
      const sol = await page.evaluate(() => {
        const RP = new __SD.RemotePlayer(), V = () => new THREE.Vector3(), base = { x: 0, y: 0, z: 70, yaw: 0, pitch: 0, eye: 1.62, alive: true, g: true, vx: 0, vz: 0, wpn: 'rifle', ws: 'ready', mode: 'walk' };
        const run = (p, n) => { for (let i = 0; i < (n || 5); i++) RP.update(Object.assign({}, base, p), 1 / 30); RP.g.updateMatrixWorld(true); };
        const headY = () => { const v = V(); RP.rig.head.getWorldPosition(v); return v.y; };
        run({}); const r = RP.rig, hand = V(), grip = V();
        r.armR.hand.getWorldPosition(hand); const gr = r.w.rifle.userData.grips.r; grip.set(gr[0], gr[1], gr[2]).applyMatrix4(r.w.rifle.matrixWorld);
        const out = { handGap: +hand.distanceTo(grip).toFixed(3), headStand: +headY().toFixed(2) };
        run({ eye: 1.0, mode: 'agachado' }, 30); out.headCrouch = +headY().toFixed(2);
        run({ alive: false }, 40); out.gunDead = r.w.rifle.visible;
        RP.g.parent.remove(RP.g); return out;
      });
      check('rival: la mano en la empuñadura, la cabeza donde la del servidor (de pie 1,63 y agachado 1,01) y suelta el arma al morir',
        sol.handGap < 0.03 && Math.abs(sol.headStand - 1.63) < 0.06 && Math.abs(sol.headCrouch - 1.01) < 0.12 && sol.gunDead === false, JSON.stringify(sol));
      await page.keyboard.press('Digit1');
      check('tecla 1: vuelve el rifle', await wf(() => __SD.LOAD.active === 'rifle' && __SD.LOAD.phase === 'ready'));
      if (!/✔ AUTOTEST/.test(head)) res.filter(l => l.startsWith('✘')).forEach(l => console.log('       ' + l));
      const ov2 = await shown(page);
      check('jugando no tapa nada ninguna pantalla oculta', ov2.length === 0, ov2.join(', ') || 'ninguna');
      // pointer lock refused once (e.g. clicking too soon after Esc): the game must keep asking
      // on every click and tell the player, instead of falling back to a camera stuck at the screen edges
      const lk = await page.evaluate(async () => {
        const c = document.querySelector('canvas'); let calls = 0;
        c.requestPointerLock = () => { calls++; return Promise.reject(new Error('denied')); };
        __SD.pause(); await new Promise(r => setTimeout(r, 300)); __SD.resume(); await new Promise(r => setTimeout(r, 900));
        const hint = document.getElementById('lockHint').checkVisibility();
        const before = calls;
        c.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
        c.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
        return { hint, before, after: calls };
      });
      check('si el navegador no captura el ratón, sale el aviso HAZ CLIC', lk.hint);
      check('cada clic vuelve a pedir capturar el ratón (antes se rendía tras el primer fallo)', lk.after - lk.before === 2, lk.before + ' → ' + lk.after + ' peticiones');
      await page.evaluate(() => __SD.pause());
      check('en pausa el aviso desaparece', !(await page.evaluate(() => document.getElementById('lockHint').checkVisibility())));
      await ctx.close();
    }
    console.log('\nESCOPETA FURIA 12 (PC, ratón y teclado reales)');
    { const { ctx, page } = await open({ viewport: { width: 1280, height: 720 } });
      const wf = (fn, ms, arg) => page.waitForFunction(fn, arg, { timeout: ms || 8000, polling: 40 }).then(() => true, () => false);
      const snap = async n => { if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/' + n + '.png' }); };
      await page.evaluate(() => __SD.setMode('range'));
      await page.locator('#menu .kitSeg button[data-kit="shotgun"]').click();
      check('en el menú se elige FURIA 12 como arma principal (y se recuerda)', await page.evaluate(() => __SD.PRIMARY === 'shotgun' && localStorage.length >= 0 && document.querySelector('#menu .kitSeg button[data-kit="shotgun"]').getAttribute('aria-pressed') === 'true'));
      await page.getByRole('button', { name: 'JUGAR', exact: true }).click();
      await wf(() => __SD.LOAD.active === 'shotgun' && __SD.SCORE.state === 'ready', 8000);
      const sv = await page.evaluate(() => ({ a: __SD.LOAD.active, name: document.getElementById('wname').textContent, ammo: document.getElementById('ammoNum').textContent, vm: __SD.SROOT.visible }));
      check('JUGAR: la escopeta en la mano, HUD «FURIA 12 · BOMBEO» con 6 cartuchos, modelo visible', sv.a === 'shotgun' && /FURIA 12/.test(sv.name) && /^6/.test(sv.ammo) && sv.vm, sv.name + ' · ' + sv.ammo);
      await page.waitForTimeout(400); await snap('furia-cadera');
      const s0 = await page.evaluate(() => ({ shots: __SD.STATS.shots }));
      await page.mouse.down(); await wf(() => __SD.SCORE.ammo === 5, 4000); await page.mouse.up();
      const s1 = await page.evaluate(() => ({ shots: __SD.STATS.shots, pellets: __SD.LAST_PELLETS, st: __SD.SCORE.state }));
      check('un clic: un disparo de 9 perdigones y el bombeo en marcha', s1.shots - s0.shots === 1 && s1.pellets === 9 && s1.st === 'bolt', JSON.stringify(s1));
      await page.waitForTimeout(120); await snap('furia-bombeo');
      await wf(() => __SD.SCORE.state === 'ready', 4000);
      await page.mouse.down({ button: 'right' }); await wf(() => __SD.SCORE.ads >= 1, 3000); await page.waitForTimeout(200); await snap('furia-mira');
      const fov = await page.evaluate(() => __SD.SROOT.visible);
      check('apuntando se ve el arma por las miras (sin visor)', fov && await page.evaluate(() => document.getElementById('scope').hidden));
      await page.mouse.up({ button: 'right' });
      await page.keyboard.press('KeyR');
      check('R: carga cartucho a cartucho (5 → 6, uno cada ' + 0.4 + ' s)', await wf(() => __SD.SCORE.state === 'reload', 8000) && await wf(() => __SD.SCORE.ammo === 6 && __SD.SCORE.state === 'ready', 20000));
      // empty it, start a reload, shoot after two shells: it stops and fires
      await page.evaluate(() => { __SD.SCORE.ammo = 0; });
      await page.keyboard.press('KeyR'); await wf(() => __SD.SCORE.state === 'reload' && __SD.SCORE.ammo === 1, 4000); await snap('furia-recarga');
      await wf(() => __SD.SCORE.ammo === 2, 4000);
      const sh0 = await page.evaluate(() => __SD.STATS.shots);
      const dbg0 = await page.evaluate(() => ({ lock: !!document.pointerLockElement, st: __SD.SCORE.state, ammo: __SD.SCORE.ammo, state: __SD.state }));
      await page.mouse.down(); const dbg1 = await page.evaluate(() => ({ fp: __SD.input.firePressed, stop: __SD.SCORE.stop, ammo: __SD.SCORE.ammo })); await page.waitForTimeout(80); await page.mouse.up();
      const cut = await wf(n => __SD.STATS.shots === n + 1, 3000, sh0), left = await page.evaluate(() => ({ ammo: __SD.SCORE.ammo, st: __SD.SCORE.state }));
      check('a media recarga, un clic la corta y dispara (sin esperar al tubo lleno)', cut && left.ammo < 5 && left.st !== 'reload', JSON.stringify(left));
      if (!(cut && left.ammo < 5)) console.log('       diagnóstico: antes ' + JSON.stringify(dbg0) + ' · al pulsar ' + JSON.stringify(dbg1));
      await page.keyboard.press('Digit2'); await wf(() => __SD.LOAD.active === 'pistol' && __SD.LOAD.phase === 'ready');
      await page.keyboard.press('Digit1');
      check('tecla 1 con la escopeta elegida: vuelve la escopeta, nunca el rifle', await wf(() => __SD.LOAD.active === 'shotgun' && __SD.LOAD.phase === 'ready'));
      await page.evaluate(() => __SD.pause());
      check('en pausa también se puede cambiar el arma principal (para la próxima aparición)', await page.locator('#pause .kitSeg button[data-kit="rifle"]').isVisible());
      await page.locator('#pause .kitSeg button[data-kit="rifle"]').click();
      check('elegir el rifle en pausa no cambia el arma que llevas en la mano', await page.evaluate(() => __SD.PRIMARY === 'rifle' && __SD.LOAD.active === 'shotgun'));
      await ctx.close();
    }
    console.log('\nVERSIÓN NUEVA PUBLICADA');
    { const { ctx, page } = await open({ viewport: { width: 1280, height: 720 } });
      await page.waitForTimeout(5000);
      check('con la versión al día no sale ningún aviso', await page.evaluate(() => document.getElementById('updBanner').hidden));
      await ctx.route(/version\.json/, r => r.fulfill({ contentType: 'application/json', body: '{"hash":"0000000000"}' }));
      await page.waitForTimeout(61500);   // the page checks every 60 s
      check('si se publica otra versión, el menú ofrece ACTUALIZAR', await page.evaluate(() => !document.getElementById('updBanner').hidden));
      await ctx.close();
    }
    console.log('\nGRÁFICOS');
    { const { ctx, page } = await open({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
      const q = await page.evaluate(async () => {
        const S = __SD, r = {};
        const set = async (k, v) => { S.SETTINGS[k] = v; document.querySelector('#qSeg button[data-q="' + (k === 'quality' ? v : S.SETTINGS.quality) + '"]').click(); await new Promise(f => setTimeout(f, 50)); };
        await set('quality', 'bajo'); r.bajo = { pr: S.renderer.getPixelRatio(), sh: S.renderer.shadowMap.enabled };
        await set('quality', 'alto'); r.alto = { pr: S.renderer.getPixelRatio(), sh: S.renderer.shadowMap.enabled };
        document.getElementById('sShowFps').click(); await new Promise(f => setTimeout(f, 1800));
        r.fps = document.getElementById('fpsBox').checkVisibility() ? document.getElementById('fpsBox').textContent : null;
        document.getElementById('sShowFps').click();
        document.querySelector('#qSeg button[data-q="auto"]').click();
        return r; });
      check('BAJO: sin sombras y resolución 1×; ALTO: sombras y resolución 2× (pantalla 2×)', !q.bajo.sh && q.bajo.pr === 1 && q.alto.sh && q.alto.pr === 2, JSON.stringify(q.bajo) + ' ' + JSON.stringify(q.alto));
      check('el contador de FPS aparece al activarlo', !!q.fps && /FPS/.test(q.fps), q.fps);
      await ctx.close();
    }
    console.log('\nMÓVIL (emulación de pantalla táctil 844×390; NO es Safari ni Android reales)');
    { const { ctx, page } = await open({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
      const ov = await shown(page);
      check('horizontal: menú sin pantallas indebidas (sin aviso de girar)', ov.length === 0, ov.join(', ') || 'ninguna');
      await page.evaluate(() => { __SD.setMode('range'); __SD.startMatch(); }); await page.waitForTimeout(1200);
      const t = await page.evaluate(() => { const e = document.getElementById('touch'); return e && e.checkVisibility(); });
      check('al jugar aparecen los controles táctiles', t);
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
      const ov2 = await shown(page);
      check('en vertical sale el aviso GIRA EL MÓVIL', ov2.includes('rotate'), ov2.join(', '));
      await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(600);
      const ov3 = await shown(page);
      check('al volver a horizontal el aviso desaparece', !ov3.includes('rotate'), ov3.join(', ') || 'ninguna');
      await ctx.close();
    }
    { // narrow phones: the health block must not run into the score
      const bad = [];
      for (const [w, h] of [[568, 320], [667, 375]]) {
        const { ctx, page } = await open({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
        await page.evaluate(() => { __SD.setMode('duel'); __SD.startMatch(); }); await page.waitForTimeout(800);
        const o = await page.evaluate(() => { const v = document.getElementById('vitals').getBoundingClientRect(), t = document.getElementById('score').getBoundingClientRect(); return v.right > t.left && v.top < t.bottom; });
        if (o) bad.push(w + '×' + h); await ctx.close();
      }
      check('móviles estrechos (568 y 667 px): la vida no tapa el marcador', bad.length === 0, bad.join(', ') || 'sin solapes');
    }
    check('sin errores de JavaScript en la página', errors.length === 0, errors.slice(0, 3).join(' | ') || 'ninguno');
  } catch (e) { fail++; console.log('  FAIL ' + e.message); }
  await browser.close(); server.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
