/* PRECISION AUDIT of the HALCÓN R7 with the real game engine (Playwright, software WebGL).
   Measures — it does not assume:
     A. the centre of the scope picture = the direction of the shot (camera, DOM overlay, canvas)
     B. real shots through the game's own input at static targets (20 / 50 / 100 m), reticle exactly on
        the head / torso / legs, sway switched off for the measurement: which part is hit, and how far from
        the aiming point the bullet arrives (the 50 m zero and the drop)
     C. the scope's marks: what angle each mark really is on this screen, compared with the drop and the
        lead the bullet needs
     D. sway: how far the reticle wanders (mrad, and cm at 50 / 100 m) still, holding the breath, tired,
        crouched, walking
     E. spread: the cone of a shot fired N ms after pressing MIRA (before / after the scope picture)
     F. a moving target at 50 m: the same perfect aim with no lead vs with the lead the speed needs
     G. touch sensitivity: how far the picture moves for 1 px of finger, scoped and unscoped
     H. hit zones vs the visible soldier (head / chest) in the poses the bots use
   node tools/aim-audit.js [out.json]                                                           */
'use strict';
const { chromium } = require('playwright');
const ss = require('./static-server.js');
const OUT = process.argv[2];
(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });   // iPhone landscape size (CSS px)
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'bajo', v: 2 })); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(srv.url + '?vm=1');
  await p.waitForFunction(() => window.__SD && __SD.W);
  const R = await p.evaluate(async () => {
    const S = __SD, T = THREE, G = S.WCORE.cfg, out = {};
    S.setTrain('off'); S.TRAIN.infAmmo = true; S.setMode('range'); S.startMatch(); S.MANUAL.on = true;
    const step = (n, ms) => { for (let i = 0; i < (n || 1); i++) S.advance(ms || 16); };
    step(60);                                     // the rifle comes up
    const eyeOf = () => new T.Vector3(S.PM.x, S.PM.y + S.PM.eye, S.PM.z);
    const lookAt = pt => { const o = eyeOf(), d = pt.clone().sub(o); S.P.yaw = Math.atan2(-d.x, -d.z); S.P.pitch = Math.asin(d.y / d.length()); };
    const scopeIn = () => { S.input.scopeHeld = true; step(20); };
    const scopeOut = () => { S.input.scopeHeld = false; step(15); };
    const sway0 = G.sway;

    /* A. centre of the picture = the shot */
    {
      scopeIn();
      const cam = new T.Vector3(); S.camera.getWorldDirection(cam);
      const e = new T.Euler(S.AIM.pitch, S.AIM.yaw, 0, 'YXZ'), aim = new T.Vector3(0, 0, -1).applyQuaternion(new T.Quaternion().setFromEuler(e));
      const rc = document.querySelector('#c').getBoundingClientRect(), rr = document.querySelector('#scope .ret').getBoundingClientRect();
      out.A = { camVsShotMrad: cam.angleTo(aim) * 1000 - Math.abs(S.camera.rotation.x - S.AIM.pitch) * 0,   // recoil at rest: 0
        recoilP: S.camera.rotation.x - S.AIM.pitch, reticleVsCanvasPx: [rr.left + rr.width / 2 - (rc.left + rc.width / 2), rr.top + rr.height / 2 - (rc.top + rc.height / 2)],
        canvasPx: [rc.width, rc.height], drawPx: [S.renderer.domElement.width, S.renderer.domElement.height] };
      scopeOut();
    }

    /* B. real shots at the static targets, reticle exactly on each part (sway off) */
    G.sway = 0;
    const statics = S.DUMMIES.filter(d => !d.slot.move && !d.slot.note);
    out.B = [];
    for (const d of statics) {
      d.spawn(); d.g.updateMatrixWorld(true);
      const parts = {}; for (const m of d.hit) if (!parts[m.userData.part]) parts[m.userData.part] = m;
      for (const part of ['head', 'torso', 'legs']) {
        d.spawn(); d.g.updateMatrixWorld(true);
        const tp = parts[part].getWorldPosition(new T.Vector3());
        lookAt(tp); scopeIn(); lookAt(tp); step(2);
        let got = null; const keep = d.damage; d.damage = function (dmg, pt) { got = pt; this.hp = 100; return false; };
        // where the bullet really passes at the target's distance (same maths as the game's bullet)
        const o = eyeOf(), dist = Math.hypot(tp.x - o.x, tp.z - o.z);
        const dropCm = (G.gravity * dist * (G.zero - dist) / (2 * G.speed * G.speed)) * 100 * (dist / Math.hypot(tp.x - o.x, tp.y - o.y, tp.z - o.z));
        S.input.firePressed = true; step(30);
        d.damage = keep;
        out.B.push({ dist: Math.round(dist), aimed: part, hit: got || 'nada', bulletVsReticleCm: Math.round(dropCm * 10) / 10 });
        scopeOut(); step(70);   // bolt cycle
      }
    }
    G.sway = sway0;

    /* C. the reticle marks on this screen vs the ballistics */
    {
      scopeIn();
      const fov = S.camera.fov, H = innerHeight, pxPerMrad = (H / 2) / Math.tan(fov * Math.PI / 360) / 1000;
      const rr = document.querySelector('#scope .ret').getBoundingClientRect(), unitPx = rr.width / 200;   // SVG viewBox 200 wide
      const markMrad = u => u * unitPx / pxPerMrad;
      const dropMrad = d => G.gravity * (d - G.zero) / (2 * G.speed * G.speed) * 1000;
      const leadMrad = v => v / G.speed * 1000;
      out.C = { zoom: S.WS.zoom, fovDeg: Math.round(fov * 100) / 100, pxPerMrad: Math.round(pxPerMrad * 100) / 100,
        // the marks as drawn now: read them back from the SVG path (units → mrad on this screen)
        ...(() => { const d = document.querySelector('#retMarks').getAttribute('d') || '', v = [], h = [];
          for (const m of d.matchAll(/M(-?[\d.]+) (-?[\d.]+)([HV])(-?[\d.]+)/g)) { if (m[3] === 'H') v.push(+(markMrad(+m[2])).toFixed(2)); else if (+m[1] > 0) h.push(+(markMrad(+m[1])).toFixed(2)); }
          return { verticalMarksMrad: v, horizontalMarksMrad: h }; })(),
        dropMrad: { 100: dropMrad(100), 150: dropMrad(150), 200: dropMrad(200) }, leadMrad: { 'agachado 2.4': leadMrad(2.4), 'bot duelo 3.4': leadMrad(3.4), 'andar 4.6': leadMrad(4.6), 'correr 7': leadMrad(7) },
        firstMarkMeansDistance: null };
      out.C.firstMarkMeansDistance = out.C.verticalMarksMrad.length ? Math.round(G.zero + out.C.verticalMarksMrad[0] / 1000 * 2 * G.speed * G.speed / G.gravity) : null;
      scopeOut();
    }

    /* D. sway */
    {
      const sample = (secs, setup) => {
        scopeIn(); if (setup) setup();
        let maxR = 0, sum = 0, n = 0;
        for (let i = 0; i < secs * 30; i++) { step(1, 33); const dy = S.AIM.yaw - S.P.yaw, dp = S.AIM.pitch - S.P.pitch, r = Math.hypot(dy, dp) * 1000; maxR = Math.max(maxR, r); sum += r * r; n++; }
        S.input.breath = false; S.input.keys = {}; S.input.crouchHeld = false; S.input.joyX = S.input.joyY = 0;
        scopeOut(); step(30);
        return { maxMrad: Math.round(maxR * 100) / 100, rmsMrad: Math.round(Math.sqrt(sum / n) * 100) / 100, cm50: Math.round(maxR * 5), cm100: Math.round(maxR * 10) };
      };
      S.P.breath = 1; S.P.exhausted = 0;
      out.D = { quieto: sample(8) };
      S.P.breath = 1; S.P.exhausted = 0;
      out.D.aguantandoAire = sample(3, () => { S.input.breath = true; });
      S.P.breath = 1; S.P.exhausted = 0;
      out.D.cansado = sample(2.5, () => { S.P.exhausted = 2.6; });
      S.P.breath = 1; S.P.exhausted = 0;
      out.D.agachado = sample(6, () => { S.input.keys.KeyC = true; });
      S.P.breath = 1; S.P.exhausted = 0;
      out.D.andandoApuntando = sample(6, () => { S.input.keys.KeyD = true; });
    }

    /* E. spread of a shot fired N ms after pressing MIRA */
    {
      out.E = [];
      for (const ms of [0, 50, 100, 150, 170, 200, 250]) {
        step(70); S.input.scopeHeld = true;
        let fired = null; const k = S.STATS.shots;
        const t0 = performance.now();
        for (let t = 0; t < ms; t += 16) step(1, 16);
        const ads = S.WCORE.ads, spread = S.SDWeapon ? null : null;
        out.E.push({ ms, ads: Math.round(ads * 100) / 100, scopePicture: ads >= G.scopeAt, spreadMrad: Math.round(window.SDWeapon.spread(S.WCORE, { speed: 0, airborne: false, crouch: false, sliding: false }) * 10000) / 10,
          at50cm: Math.round(window.SDWeapon.spread(S.WCORE, { speed: 0, airborne: false, crouch: false, sliding: false }) * 5000) });
        S.input.scopeHeld = false; step(20);
      }
    }

    /* F. moving target at 50 m: perfect aim on the head with no lead vs with lead */
    {
      G.sway = 0;
      const mv = S.DUMMIES.find(d => d.slot.move && d.slot.move.amp === 9);
      out.F = { speedMax: mv.slot.move.speed, tries: [] };
      for (const lead of [false, true]) {
        let hits = 0, n = 0;
        for (let k = 0; k < 6; k++) {
          scopeIn(); mv.spawn(); mv.phase = -0.08 + k * 0.03; step(1);    // near the middle of its track = full speed
          mv.g.updateMatrixWorld(true);
          const head = mv.hit.find(m => m.userData.part === 'head').getWorldPosition(new T.Vector3());
          const v = Math.cos(mv.phase) * mv.slot.move.speed;                 // x velocity now
          const o = eyeOf(), dist = head.distanceTo(o), t = dist / G.speed;
          const pt = head.clone(); if (lead) pt.x += v * (t + 0.024);       // + the frames before the bullet leaves
          lookAt(pt); step(1);
          let got = null; const keep = mv.damage; mv.damage = function (dmg, part) { got = part; this.hp = 100; return false; };
          S.input.firePressed = true; step(30); mv.damage = keep;
          n++; if (got) hits++;
          out.F.tries.push({ lead, speed: Math.round(v * 10) / 10, dist: Math.round(dist), hit: got || 'fallo' });
          scopeOut(); step(70);
        }
      }
      G.sway = sway0;
    }

    /* G. touch sensitivity on this screen (defaults for a phone) */
    {
      const st = window.SDSettings.sanitize({}, true), TG = window.SDTouch.CFG.lookGain, H = innerHeight;
      const res = {};
      for (const [name, fov, scoped] of [['sin mira', 70, false], ['mira 4×', 70 / 4, true], ['mira 8×', 70 / 8, true]]) {
        const fr = Math.tan(fov * Math.PI / 360) / Math.tan(70 * Math.PI / 360);
        const ld = window.SDSettings.lookDelta(1, 0, st, { scoped, ads: scoped ? 1 : 0, fovRatio: fr, touch: true });
        const radPerFingerPx = Math.abs(ld.yaw) * TG, pxPerRad = (H / 2) / Math.tan(fov * Math.PI / 360);
        res[name] = { mradPorPxDeDedo: Math.round(radPerFingerPx * 1e5) / 100, imagenSeMuevePxPorPxDeDedo: Math.round(radPerFingerPx * pxPerRad * 100) / 100,
          cmA50mPorPxDeDedo: Math.round(radPerFingerPx * 5000 * 10) / 10 };
      }
      out.G = { defaults: { touchLook: st.touchLook, adsSens: st.adsSens, lookGain: TG, touchDead: st.touchDead, releaseFire: st.releaseFire, adsMode: st.adsMode }, res,
        headPx: { '50 m (8×)': Math.round(0.3 / 50 * (H / 2) / Math.tan(70 / 8 * Math.PI / 360)), '100 m (8×)': Math.round(0.3 / 100 * (H / 2) / Math.tan(70 / 8 * Math.PI / 360)) } };
    }

    /* H. hit zones vs the visible soldier */
    {
      out.H = [];
      const d = S.DUMMIES.find(x => !x.slot.move);
      const meas = (bot, label) => {
        bot.g.updateMatrixWorld(true);
        const hz = bot.hit.find(m => m.userData.part === 'head').getWorldPosition(new T.Vector3());
        const vh = bot.rig.head.getWorldPosition(new T.Vector3());
        const tz = bot.hit.find(m => m.userData.part === 'torso').getWorldPosition(new T.Vector3());
        const vc = bot.rig.chest.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 0.26, 0).applyQuaternion(bot.rig.chest.getWorldQuaternion(new T.Quaternion())));
        out.H.push({ pose: label, cabezaCm: Math.round(hz.distanceTo(vh) * 100), pechoCm: Math.round(tz.distanceTo(vc) * 100) });
      };
      d.spawn(); step(5); meas(d, 'diana quieta');
      const mv = S.DUMMIES.find(x => x.slot.move); mv.spawn(); step(20); meas(mv, 'diana andando');
      // a training bot, sprinting and crouching (same animation code as the match bots)
      S.setTrain('hard'); S.startMatch(); step(40);
      const tb = S.TRAINERS.find(t => t.alive);
      if (tb) {
        const worst = {};
        for (let i = 0; i < 450; i++) { step(1, 33); tb.g.updateMatrixWorld(true);
          const hz = tb.hit.find(m => m.userData.part === 'head').getWorldPosition(new T.Vector3()), vh = tb.rig.head.getWorldPosition(new T.Vector3());
          const pose = tb.ms.sliding ? 'deslizando' : !tb.ms.onGround ? 'saltando' : tb.ms.sprinting ? 'corriendo' : tb.ms.crouch ? 'agachado' : Math.hypot(tb.ms.vx, tb.ms.vz) > 0.5 ? 'andando' : 'quieto';
          const dd = hz.distanceTo(vh) * 100; if (!worst[pose] || dd > worst[pose]) worst[pose] = dd; }
        for (const [k, v] of Object.entries(worst)) out.H.push({ pose: 'bot de entrenamiento ' + k + ' (peor momento)', cabezaCm: Math.round(v), pechoCm: null });
      }
      S.setTrain('off');
      // the rival online (RemotePlayer): hit zones = the server's, scaled with the eye height
      const rp = new S.RemotePlayer();
      for (const [label, pose] of [['rival de pie', { eye: 1.62, mode: 'idle' }], ['rival agachado', { eye: 1.0, mode: 'agachado' }], ['rival deslizando', { eye: 0.85, mode: 'slide', vx: 0, vz: -8 }], ['rival corriendo', { eye: 1.62, mode: 'sprint', vx: 0, vz: -7 }], ['rival apuntando arriba', { eye: 1.62, mode: 'idle', pitch: 0.5 }]]) {
        const full = Object.assign({ x: 0, y: 0, z: 140, yaw: 0, pitch: 0, alive: true, g: true, wpn: 'rifle', ws: 'ready', vx: 0, vz: 0 }, pose);
        for (let i = 0; i < 40; i++) rp.update(full, 1 / 30);
        rp.g.updateMatrixWorld(true);
        const hz = rp.hit.find(m => m.userData.part === 'head').getWorldPosition(new T.Vector3()), vh = rp.rig.head.getWorldPosition(new T.Vector3());
        out.H.push({ pose: label, cabezaCm: Math.round(hz.distanceTo(vh) * 100), pechoCm: null, dy: Math.round((vh.y - hz.y) * 100) });
      }
      rp.g.visible = false;
    }
    return out;
  });
  const T = (s) => console.log(s);
  T('\nA. CENTRO DE LA MIRA = DISPARO'); T('   cámara vs disparo: ' + R.A.camVsShotMrad.toFixed(4) + ' mrad · retícula vs centro de la imagen: ' + R.A.reticleVsCanvasPx.map(v => v.toFixed(1)).join(', ') + ' px');
  T('\nB. DISPAROS REALES, retícula exactamente en la parte (balanceo quitado para medir)');
  for (const r of R.B) T('   ' + String(r.dist).padStart(3) + ' m · apunto ' + r.aimed.padEnd(5) + ' → ' + String(r.hit).padEnd(5) + ' · la bala pasa ' + (r.bulletVsReticleCm >= 0 ? '+' : '') + r.bulletVsReticleCm + ' cm respecto a la retícula');
  T('\nC. MARCAS DEL VISOR en esta pantalla (zoom ' + R.C.zoom + '×, ' + R.C.pxPerMrad + ' px/mrad)');
  T('   marcas bajo el centro: ' + R.C.verticalMarksMrad.join(' / ') + ' mrad · caída real de la bala: 100 m ' + R.C.dropMrad[100].toFixed(2) + ', 150 m ' + R.C.dropMrad[150].toFixed(2) + ', 200 m ' + R.C.dropMrad[200].toFixed(2) + ' mrad');
  T('   → la primera marca equivale a ~' + R.C.firstMarkMeansDistance + ' m' + (Math.abs(R.C.firstMarkMeansDistance - 100) > 5 ? ' (debería ser 100 m)' : ' (correcto)'));
  T('   marcas laterales: ' + R.C.horizontalMarksMrad.join(' / ') + ' mrad · adelanto real: ' + Object.entries(R.C.leadMrad).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', ') + ' mrad (el mismo a cualquier distancia)');
  T('\nD. BALANCEO DE LA MIRA (máximo · rms · cm a 50 / 100 m)');
  for (const [k, v] of Object.entries(R.D)) T('   ' + k.padEnd(18) + v.maxMrad.toFixed(2).padStart(6) + ' mrad · ' + v.rmsMrad.toFixed(2) + ' · ±' + v.cm50 + ' / ±' + v.cm100 + ' cm');
  T('\nE. DISPERSIÓN según cuándo disparas tras pulsar MIRA');
  for (const r of R.E) T('   ' + String(r.ms).padStart(3) + ' ms · ADS ' + r.ads.toFixed(2) + (r.scopePicture ? ' (visor visible)' : ' (sin visor)  ') + ' · cono ' + r.spreadMrad + ' mrad = ±' + r.at50cm + ' cm a 50 m');
  T('\nF. DIANA MÓVIL a ~50 m (velocidad máx ' + R.F.speedMax + ' m/s), puntería perfecta a la cabeza');
  for (const lead of [false, true]) { const t = R.F.tries.filter(x => x.lead === lead); T('   ' + (lead ? 'con adelanto ' : 'sin adelanto ') + t.filter(x => x.hit !== 'fallo').length + '/' + t.length + ' impactos  (' + t.map(x => x.speed + ' m/s→' + x.hit).join(', ') + ')'); }
  T('\nG. SENSIBILIDAD TÁCTIL (valores por defecto ' + JSON.stringify(R.G.defaults) + ')');
  for (const [k, v] of Object.entries(R.G.res)) T('   ' + k.padEnd(9) + ' 1 px de dedo = ' + v.mradPorPxDeDedo + ' mrad = ' + v.cmA50mPorPxDeDedo + ' cm a 50 m · la imagen se mueve ' + v.imagenSeMuevePxPorPxDeDedo + ' px');
  T('   una cabeza mide en pantalla (8×): ' + Object.entries(R.G.headPx).map(([k, v]) => k + ' ' + v + ' px').join(', '));
  T('\nH. ZONAS DE IMPACTO vs SOLDADO VISIBLE (distancia entre centros)');
  for (const r of R.H) T('   ' + r.pose.padEnd(58) + ' cabeza ' + r.cabezaCm + ' cm' + (r.pechoCm != null ? ' · pecho ' + r.pechoCm + ' cm' : ''));
  if (errs.length) T('\nERRORES: ' + errs.join(' | '));
  if (OUT) require('fs').writeFileSync(OUT, JSON.stringify(R, null, 1));
  await b.close(); srv.close(); process.exit(0);
})();
