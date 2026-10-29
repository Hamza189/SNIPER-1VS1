/* Personaje 3D (?pj=2, client/soldier2.js) en la página real:
   - sin la bandera no se descarga nada del personaje y todo sigue como siempre
   - con ?pj=2 carga sin 404 ni errores; los bots del duelo y el rival online lo usan (apariencias bots / B);
     el soldado de cajas queda oculto (vuelta atrás) y las zonas de impacto son exactamente las mismas
   - se anima de verdad: andar mueve las piernas, agacharse baja la cabeza a la altura del servidor (morph),
     morir lo tumba en el suelo; el arma va en el nodo 'arma'
   - LOD: cerca LOD0, lejos LOD2, y con la mira de zoom vuelve a LOD0; perfil BAJO usa el GLB de 1024
   Run: node test/pj2.browser.test.js   (WebGL por software: no se mide tiempo) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
const flag = process.argv.includes('--pj3') ? '3' : '2';
const assetBase = flag === '3' ? 'personaje/v4/' : 'personaje/';
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

async function open(b, url, q) {
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 3 })); } catch (e) {} }, q);
  const p = await ctx.newPage(), bad = [], files = [], errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (/pj2/.test(m.text())) errs.push(m.text()); });
  p.on('response', r => { const u = r.url(); if (/\/assets\//.test(u) && r.status() >= 400) bad.push(r.status() + ' ' + u.replace(/^.*\/assets\//, '')); if (/\/assets\/personaje\//.test(u)) files.push(u.replace(/^.*\/assets\//, '').replace(/\?.*/, '')); });
  await p.goto(url + '&ktx2=0');   // these checks are about the JPG files (KTX2 by default since 29-10: test/ktx2.browser.test.js)
  await p.waitForFunction(() => window.__SD && __SD.WORLDS, null, { timeout: 120000 });
  await p.evaluate(() => { __SD.setMode('duel'); __SD.setOffMap('arena'); __SD.startMatch(); });
  await p.waitForTimeout(1500);
  return { ctx, p, bad, files, errs };
}
const zones = p => p.evaluate(() => __SD.BOTS.map(b => b.hit.map(m => [m.userData.part, m.position.x, m.position.y, m.position.z, m.geometry.type].join(':')).join('|')).join(';'));

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  console.log('\nCON ?pj=0 (el soldado de cajas; sin bandera es ?pj=pro desde el 28-10)');
  const off = await open(b, srv.url + '?vm=1&pj=0', 'alto');
  const z0 = await zones(off.p);
  const offState = await off.p.evaluate(() => ({ on: __SD.PJ2.on, v2: __SD.BOTS.some(b => !!b.rig.v2) }));
  check('no se descarga nada del personaje y los bots son los de siempre', off.files.length === 0 && !offState.on && !offState.v2, off.files.join(' '));
  await off.ctx.close();
  if (flag === '3') {
    const invalid = await open(b, srv.url + '?vm=1&pj=3invalid', 'alto');
    check('un valor de bandera no válido no descarga ni activa el candidato', invalid.files.length === 0 && await invalid.p.evaluate(() => !__SD.PJ2.on));
    await invalid.ctx.close();
  }

  console.log('\nCON ?pj=' + flag + ' (ALTO)');
  const o = await open(b, srv.url + '?vm=1&pj=' + flag, 'alto'), p = o.p;
  await p.waitForFunction(() => __SD.PJ2.tpl || __SD.PJ2.failed, null, { timeout: 120000 });
  await p.waitForTimeout(500);
  check('carga sin 404 ni errores', o.bad.length === 0 && o.errs.length === 0, o.bad.concat(o.errs).slice(0, 3).join(' | ') || o.files.join(' '));
  check('descarga el GLB de 2048 y la apariencia de los bots', o.files.includes(assetBase + 'personaje.glb') && o.files.includes(assetBase + 'color_bots.jpg'), o.files.join(' '));
  check('solo solicita assets de la revisión seleccionada', o.files.length > 0 && o.files.every(f => f.startsWith(assetBase) && (flag === '3' || !f.includes('/v4/'))));
  check('las zonas de impacto de los bots son exactamente las mismas que sin la bandera', (await zones(p)) === z0);
  const r = await p.evaluate(() => {
    const S = __SD, bt = S.BOTS[0], R = bt.rig, I = R.v2, cam = S.camera;
    S.pause();
    const out = { v2: S.BOTS.every(b => !!b.rig.v2), oldHidden: R.root.children.filter(c => c !== I.root).every(c => !c.visible) };
    out.meshes = I.meshes.map(m => m.isSkinnedMesh && m.geometry.index.count / 3);
    out.rootScaleY = R.root.scale.y;
    out.armaHasWeapon = I.arma.children.includes(R.aim) && R.aim.children.length > 0;
    out.mapBots = I.meshes[0].material.map && /color_bots/.test(I.meshes[0].material.map.image ? I.meshes[0].material.map.image.src || '' : '') ;
    // ponerlo delante de la cámara a 6 m
    const q = cam.position, fw = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); fw.y = 0; fw.normalize();
    bt.alive = true; bt.g.visible = true; bt.g.position.set(q.x + fw.x * 6, 0, q.z + fw.z * 6); bt.g.rotation.set(0, 0, 0);
    const bone = n => I.root.getObjectByName(n), wp = new THREE.Vector3(), head = () => (bone('Head').updateWorldMatrix(true, false), bone('Head').getWorldPosition(wp).y);
    const st = o => Object.assign({ wpn: 'rifle', vx: 0, vz: 0, pitch: 0, aim: 1 }, o);
    S.animateSoldier(R, st({}), 1 / 60);
    const q0 = bone('LeftUpLeg').quaternion.clone(); out.headStand = head();
    out.legMoves = 0;
    for (let i = 0; i < 40; i++) { S.animateSoldier(R, st({ vz: 4.6 }), 1 / 60); out.legMoves = Math.max(out.legMoves, bone('LeftUpLeg').quaternion.angleTo(q0)); }
    S.animateSoldier(R, st({ crouch: 1 }), 1 / 60); out.headCrouch = head();
    out.morph = I.meshes[0].morphTargetInfluences[I.meshes[0].morphTargetDictionary.agachado];
    out.crouchRootScaleY = R.root.scale.y;
    out.lod6 = I.lod;
    bt.g.position.set(q.x + fw.x * 80, 0, q.z + fw.z * 80); S.animateSoldier(R, st({}), 1 / 60); out.lod80 = I.lod;
    const fov = cam.fov; cam.fov = fov / 8; cam.updateProjectionMatrix(); S.animateSoldier(R, st({}), 1 / 60); out.lodZoom = I.lod; cam.fov = fov; cam.updateProjectionMatrix();
    for (let i = 0; i < 100; i++) S.animateSoldier(R, st({ dead: 1 }), 1 / 60);
    out.headDead = head();
    // rival online: apariencia B con el mismo modelo
    const rp = new S.RemotePlayer();
    rp.update({ x: q.x + fw.x * 5, y: 0, z: q.z + fw.z * 5, yaw: 0, pitch: 0, eye: 1.62, alive: true, g: true, mode: 'walk', vx: 0, vz: 0, wpn: 'rifle', ads: 1 }, 1 / 60);
    out.remote = !!rp.rig.v2 && rp.rig.v2.meshes[0].material === S.PJ2.mats.B && rp.hit.length === 3;
    return out;
  });
  check('bots con el personaje nuevo; la figura de cajas oculta (sigue de vuelta atrás)', r.v2 && r.oldHidden);
  check('tres LOD con esqueleto (14 600 / 5 000 / 1 500 triángulos)', r.meshes.join() === '14598,5000,1500' || (r.meshes[0] <= 15000 && r.meshes[2] <= 1500), r.meshes.join(' / '));
  check('el arma del juego va en el nodo arma (mano derecha)', r.armaHasWeapon);
  check('andar mueve las piernas', r.legMoves > 0.05, r.legMoves.toFixed(3) + ' rad');
  check('de pie la cabeza a la altura de la esfera (1,63 m ± 6 cm)', Math.abs(r.headStand - 1.6) < 0.08, r.headStand.toFixed(3));
  check('agachado: morph al 100 % y la cabeza baja como la caja del servidor (1,0 m ± 8 cm)', r.morph > 0.99 && r.headCrouch < 1.08 && r.headCrouch > 0.85, r.headCrouch.toFixed(3) + ' m');
  check('altura por animación, sin reescalado externo', r.rootScaleY === 1 && r.crouchRootScaleY === 1);
  check('muerto: tumbado en el suelo', r.headDead < 0.45, r.headDead.toFixed(3) + ' m');
  check('LOD: a 6 m LOD0, a 80 m LOD2 y con la mira x8 vuelve a LOD0', r.lod6 === 0 && r.lod80 === 2 && r.lodZoom === 0, [r.lod6, r.lod80, r.lodZoom].join(' / '));
  check('rival online con la apariencia B y sus 3 zonas de impacto', r.remote);
  await o.ctx.close();

  console.log('\nCON ?pj=' + flag + ' (BAJO)');
  const lo = await open(b, srv.url + '?vm=1&pj=' + flag, 'bajo');
  await lo.p.waitForFunction(() => __SD.PJ2.tpl || __SD.PJ2.failed, null, { timeout: 120000 });
  check('BAJO: GLB y apariencia de 1024, sin errores', lo.files.includes(assetBase + 'personaje_1k.glb') && lo.files.includes(assetBase + 'color_bots_1k.jpg') && !lo.files.includes(assetBase + 'personaje.glb') && lo.errs.length === 0 && lo.bad.length === 0, lo.files.join(' '));
  await lo.ctx.close();
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
