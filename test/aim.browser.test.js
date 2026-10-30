/* Precision of the HALCÓN R7 with the real engine (CAMPO DE TIRO), after the precision audit
   (tools/aim-audit.js has the full measurements). Physics, damage and hit zones are NOT touched here:
   the test checks that what you see is what the bullet does.
   - the centre of the scope = the shot; the scope overlay is centred on the picture
   - reticle exactly on head / torso / legs of static targets (26 and 56 m, sway off) → that part
   - the scope marks are the real drop (100 / 150 / 200 m) and the real lead (crouching / walking / running speeds of SD_CONFIG.move)
   - with the scope up the shot has no random cone; before it, it has (documented, not a bug)
   - the hit zones follow the visible soldier (training bots and the online rival) in every pose
   - the shot diagnostic explains a hit, a moving target, an off aim and a hip shot correctly,
     and is off outside the shooting range
   - duel bots turn and stop with a limited acceleration and never walk into the scenery
   Run: node test/aim.browser.test.js                                                            */
'use strict';
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('\nPRECISIÓN: playwright no está instalado, se omite'); process.exit(0); }
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: 'bajo', v: 2 })); } catch (e) {} });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(srv.url + '?vm=1');
  await p.waitForFunction(() => window.__SD && __SD.W);
  const R = await p.evaluate(() => {
    const S = __SD, T = THREE, G = S.WCORE.cfg, out = {};
    S.TRAIN.infAmmo = true; S.setTrain('off'); S.setTrainMove('free'); S.setMode('range'); S.startMatch(); S.MANUAL.on = true;
    const step = n => { for (let i = 0; i < (n || 1); i++) S.advance(16); };
    step(50);
    const eye = () => new T.Vector3(S.PM.x, S.PM.y + S.PM.eye, S.PM.z);
    const look = pt => { const o = eye(), d = pt.clone().sub(o); S.P.yaw = Math.atan2(-d.x, -d.z); S.P.pitch = Math.asin(d.y / d.length()); };
    const sway0 = G.sway; G.sway = 0;
    // centre
    S.input.scopeHeld = true; step(20);
    { const cam = new T.Vector3(); S.camera.getWorldDirection(cam); const aim = new T.Vector3(0, 0, -1).applyQuaternion(new T.Quaternion().setFromEuler(new T.Euler(S.AIM.pitch, S.AIM.yaw, 0, 'YXZ')));
      const rc = document.querySelector('#c').getBoundingClientRect(), rr = document.querySelector('#scope .ret').getBoundingClientRect();
      out.centre = { mrad: cam.angleTo(aim) * 1000, dx: rr.left + rr.width / 2 - (rc.left + rc.width / 2), dy: rr.top + rr.height / 2 - (rc.top + rc.height / 2) }; }
    // marks
    { const fov = S.camera.fov, H = innerHeight, pxPerMrad = (H / 2) / Math.tan(fov * Math.PI / 360) / 1000, rr = document.querySelector('#scope .ret').getBoundingClientRect(), u = rr.width / 200;
      const v = [], h = []; for (const m of (document.querySelector('#retMarks').getAttribute('d') || '').matchAll(/M(-?[\d.]+) (-?[\d.]+)([HV])/g)) { if (m[3] === 'H') v.push(+m[2] * u / pxPerMrad); else if (+m[1] > 0) h.push(+m[1] * u / pxPerMrad); }
      out.marks = { v, h, drop: [100, 150, 200].map(d => G.gravity * (d - G.zero) / (2 * G.speed * G.speed) * 1000), lead: [SD_CONFIG.move.crouch, SD_CONFIG.move.walk, SD_CONFIG.move.sprint].map(s => s / G.speed * 1000) }; }
    S.input.scopeHeld = false; step(20);
    // parts
    out.parts = [];
    for (const d of S.DUMMIES.filter(x => !x.slot.move && !x.slot.note && x.slot.z < 130)) {
      for (const part of ['head', 'torso', 'legs']) {
        d.spawn(); S.input.scopeHeld = true; step(20);
        const tp = d.hit.find(m => m.userData.part === part).getWorldPosition(new T.Vector3()); look(tp); step(1);
        let got = null; const keep = d.damage; d.damage = function (dmg, pt) { got = pt; this.hp = 100; return false; };
        out.scopedSpread = window.SDWeapon.spread(S.WCORE, { speed: 0, airborne: false, crouch: false, sliding: false });
        S.input.firePressed = true; step(30); d.damage = keep;
        out.parts.push([Math.round(eye().distanceTo(tp)), part, got]);
        S.input.scopeHeld = false; step(70);
      }
    }
    out.hipSpread = window.SDWeapon.spread(S.WCORE, { speed: 0, airborne: false, crouch: false, sliding: false });
    // diagnostic
    S.DIAG.want = true; out.diag = [];
    const head = d => d.hit.find(m => m.userData.part === 'head').getWorldPosition(new T.Vector3());
    const shoot = (fn, scoped) => { if (scoped) { S.input.scopeHeld = true; step(20); } look(fn()); step(1); S.input.firePressed = true; step(30); out.diag.push(S.DIAG.last && S.DIAG.last.why); S.input.scopeHeld = false; step(70); };
    const st = S.DUMMIES.find(d => !d.slot.move && d.slot.z < 90), mv = S.DUMMIES.find(d => d.slot.move && d.slot.move.amp === 9);
    st.spawn(); shoot(() => head(st), true);
    shoot(() => { mv.phase = 0; mv.g.position.x = mv.slot.x; return head(mv); }, true);
    shoot(() => head(st).add(new T.Vector3(0.6, 0, 0)), true);
    shoot(() => head(st).add(new T.Vector3(0, 0, 0)), false);
    out.diagRangeActive = S.DIAG.active();
    G.sway = sway0;
    // hit zones vs the visible soldier
    out.zones = [];
    S.setTrain('hard'); S.setTrainMove('free'); S.startMatch(); step(30);
    const tb = S.TRAINERS.find(t => t.alive); let worst = 0, wp = '';
    for (let i = 0; i < 300; i++) { step(1); tb.g.updateMatrixWorld(true);
      const d = tb.hit.find(m => m.userData.part === 'head').getWorldPosition(new T.Vector3()).distanceTo(tb.rig.head.getWorldPosition(new T.Vector3()));
      if (d > worst) { worst = d; wp = tb.ms.sliding ? 'deslizando' : tb.ms.sprinting ? 'corriendo' : tb.ms.crouch ? 'agachado' : 'andando'; } }
    out.zones.push(['bot de entrenamiento (' + wp + ')', worst]);
    const rp = new S.RemotePlayer();
    for (const [label, pose] of [['rival de pie', { eye: 1.62 }], ['rival agachado', { eye: 1.0, mode: 'agachado' }], ['rival deslizando', { eye: 0.85, mode: 'slide', vz: -8 }], ['rival corriendo', { eye: 1.62, mode: 'sprint', vz: -7 }]]) {
      const full = Object.assign({ x: 0, y: 0, z: 140, yaw: 0, pitch: 0, alive: true, g: true, wpn: 'rifle', ws: 'ready', vx: 0, vz: 0, mode: 'idle' }, pose);
      for (let i = 0; i < 40; i++) rp.update(full, 1 / 30); rp.g.updateMatrixWorld(true);
      out.zones.push([label, rp.hit.find(m => m.userData.part === 'head').getWorldPosition(new T.Vector3()).distanceTo(rp.rig.head.getWorldPosition(new T.Vector3()))]);
    }
    rp.g.visible = false;
    // the movement patterns of the range
    out.patterns = {};
    for (const m of ['still', 'walk', 'strafe']) { S.setTrainMove(m); S.startMatch(); step(60); const t = S.TRAINERS.find(x => x.alive); let mx = 0; for (let i = 0; i < 60; i++) { step(1); mx = Math.max(mx, Math.hypot(t.ms.vx, t.ms.vz)); } out.patterns[m] = mx; }
    S.setTrainMove('free'); S.setTrain('off');
    // duel bots: acceleration and scenery
    S.setMode('duel'); S.startMatch(); S.P.alive = false;
    out.diagDuelActive = S.DIAG.active();
    let maxAcc = 0, inside = 0; const pv = S.BOTS.map(b2 => [b2.vx || 0, b2.vz || 0]);
    for (let i = 0; i < 120 * 40; i++) { S.simTick(1 / 120);
      S.BOTS.forEach((b2, k) => { if (b2.state === 'move' || b2.state === 'watch' || b2.state === 'aim') { const a = Math.hypot((b2.vx || 0) - pv[k][0], (b2.vz || 0) - pv[k][1]) * 120; maxAcc = Math.max(maxAcc, a); }
        pv[k] = [b2.vx || 0, b2.vz || 0]; const x = b2.g.position.x, z = b2.g.position.z;
        const c = b2.alive && S.W.colliders.find(c => x > c.minX + 0.05 && x < c.maxX - 0.05 && z > c.minZ + 0.05 && z < c.maxZ - 0.05 && c.maxY > 0.5);
        if (c) { inside++; if (!out.inEx) out.inEx = [b2.name, b2.state, b2.alive, x.toFixed(2), z.toFixed(2), S.WORLD_ID, [c.minX, c.maxX, c.minZ, c.maxZ].map(v => v.toFixed(1)).join(',')].join(' '); } }); }
    out.duel = { maxAcc, inside };
    return out;
  });
  console.log('\nPRECISIÓN DEL HALCÓN R7 (motor real, campo de tiro)');
  check('el centro del visor es la dirección del disparo', R.centre.mrad < 0.01, R.centre.mrad.toFixed(4) + ' mrad');
  check('la retícula está en el centro de la imagen', Math.abs(R.centre.dx) < 0.6 && Math.abs(R.centre.dy) < 0.6, R.centre.dx.toFixed(1) + ', ' + R.centre.dy.toFixed(1) + ' px');
  check('con la retícula en cada parte de una diana quieta (26 y 56 m), la bala da en esa parte', R.parts.every(([, part, got]) => got === part), R.parts.map(([d, p, g]) => d + 'm ' + p + '→' + g).join(', '));
  const near = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) / b[i] < 0.03);
  check('marcas bajo el centro = caída real a 100 / 150 / 200 m', near(R.marks.v, R.marks.drop), R.marks.v.map(x => x.toFixed(2)).join(' / ') + ' mrad');
  check('marcas laterales = adelanto real a las velocidades de agachado / andar / correr', near(R.marks.h, R.marks.lead), R.marks.h.map(x => x.toFixed(2)).join(' / ') + ' mrad');
  check('con el visor puesto no hay dispersión aleatoria', R.scopedSpread === 0);
  check('sin visor sí la hay (disparo desde la cadera: intencionado)', R.hipSpread > 0.01, (R.hipSpread * 1000).toFixed(0) + ' mrad');
  check('diagnóstico: impacto, objetivo en movimiento, mal apuntado y disparo sin visor', JSON.stringify(R.diag) === JSON.stringify(['IMPACTO', 'MOVIMIENTO DEL OBJETIVO', 'APUNTADO', 'DISPERSIÓN']), R.diag.join(' · '));
  check('el diagnóstico solo funciona en el campo de tiro (no en partidas)', R.diagRangeActive && !R.diagDuelActive);
  check('las zonas de impacto siguen al soldado visible (centro de la cabeza a ≤ 15 cm = su radio)', R.zones.every(([, d]) => d <= 0.15), R.zones.map(([k, d]) => k + ' ' + Math.round(d * 100) + ' cm').join(', '));
  check('movimiento de entrenamiento: QUIETOS no se mueven, ANDAN a paso, LATERAL a velocidad de andar', R.patterns.still < 0.05 && R.patterns.walk > 1.5 && R.patterns.walk < 2.5 && R.patterns.strafe > 3.5 && R.patterns.strafe < 4.8, Object.entries(R.patterns).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', '));
  check('bots de duelo: giran y frenan con aceleración limitada (sin cambios instantáneos)', R.duel.maxAcc < 10, R.duel.maxAcc.toFixed(1) + ' m/s²');
  check('bots de duelo: nunca dentro del escenario', R.duel.inside === 0, R.inEx);
  check('sin errores en la página', errs.length === 0, errs.slice(0, 2).join(' | '));
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
