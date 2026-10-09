/* Stage E2: FURIA 12 shotgun — core rules (no browser). Run: node test/shotgun.test.js */
'use strict';
const CFG = require('../core/config.js'), SDP = require('../core/player.js'), Wp = require('../core/weapon.js'), Me = require('../core/melee.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const DT = 1 / 120, world = { colliders: [], ramps: [] }, SC = CFG.shotguns.furia;
const run = (p, secs, cmdFn, sink) => { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { const r = SDP.step(p, Object.assign({ mx: 0, mz: 0, yaw: 0 }, cmdFn ? cmdFn(i) : {}), DT, world); if (sink) sink(r); } };
const shotgunPlayer = () => { const p = SDP.create(0, 0, 0); SDP.respawn(p, 0, 0, 0, 'shotgun'); run(p, 1); return p; };

console.log('\nFURIA 12 · ARMA PRINCIPAL');
{ const p = shotgunPlayer();
  check('elegida como principal: aparece en la mano al reaparecer', p.load.primary === 'shotgun' && p.load.active === 'shotgun' && p.sw.state === 'ready');
  let rifleShots = 0, shots = 0;
  run(p, 2.5, () => ({ fire: true }), r => { for (const e of r.wev) if (e.type === 'fire') rifleShots++; for (const e of r.sev) if (e.type === 'fire') shots++; });
  check('con el gatillo pulsado: un disparo por bombeo (' + SC.bolt + ' s)', shots === Math.floor(2.5 / SC.bolt) + 1 || shots === Math.floor(2.5 / SC.bolt), shots + ' disparos en 2,5 s');
  check('el rifle no existe en esta vida: nunca dispara', rifleShots === 0 && p.w.shots === 0);
  // key 1 ("primary") never brings the rifle out
  run(p, 1, i => ({ select: i === 0 ? 'pistol' : i === 60 ? 'rifle' : null }));
  check('tecla 1 vuelve a la escopeta, no al rifle', p.load.active === 'shotgun');
  // and the rifle player can never draw the shotgun
  const q = SDP.create(0, 0, 0); run(q, 1, i => ({ select: i === 0 ? 'shotgun' : null }));
  check('con el rifle elegido, pedir la escopeta no hace nada', q.load.active === 'rifle');
  // the choice only changes at a respawn
  Me.setPrimary(q.load, 'bazooka'); check('una principal desconocida se ignora', q.load.primary === 'rifle');
}
console.log('\nCARGA DE CARTUCHOS UNO A UNO');
{ const p = shotgunPlayer(); p.sw.ammo = 0; p.sw.state = 'ready';
  let t = 0, done = null, shells = 0;
  run(p, 4, i => ({ reload: i === 0 }), r => { t += DT; for (const e of r.sev) { if (e.type === 'shellIn') shells++; if (e.type === 'reloadEnd' && done === null) done = t; } });
  const want = SC.shells.start + SC.mag * SC.shells.each + SC.shells.end;
  check('de vacía a llena: ' + SC.mag + ' cartuchos en ' + want.toFixed(2) + ' s', shells === SC.mag && p.sw.ammo === SC.mag && done !== null && Math.abs(done - want) < 0.03, shells + ' cartuchos, ' + (done && done.toFixed(2)) + ' s');
  check('el tiempo de recarga del HUD coincide', Math.abs(SC.reload - want) < 1e-9);
  // interrupt: with 2 shells in, pressing the trigger stops loading and fires after the hands return
  p.sw.ammo = 0; Wp.startReload(p.sw, []);
  let fired = null; t = 0;
  const pressAt = SC.shells.start + 2 * SC.shells.each + 0.05;
  run(p, 1.6, i => ({ fire: Math.abs(i * DT - pressAt) < DT / 2 }), r => { t += DT; for (const e of r.sev) if (e.type === 'fire' && fired === null) fired = t; });
  check('al disparar a mitad de la carga, para y dispara (sin esperar al tubo lleno)', fired !== null && fired < pressAt + SC.shells.end + 0.05 && p.sw.ammo === 1, fired && (fired - pressAt).toFixed(2) + ' s después de pulsar, quedan ' + p.sw.ammo);
  // trigger with an empty tube does not stop the reload
  p.sw.ammo = 0; Wp.startReload(p.sw, []);
  let early = 0; run(p, 0.2, () => ({ fire: true }), r => { for (const e of r.sev) if (e.type === 'fire') early++; });
  check('con el tubo vacío, el gatillo no corta la carga', early === 0 && p.sw.state === 'reload');
  // switching to the pistol pauses it, coming back resumes where it was
  run(p, 0.5); const mid = p.sw.ammo;
  run(p, 1.5, i => ({ select: i === 0 ? 'pistol' : null }));
  check('guardar la escopeta pausa la carga (no se pierden cartuchos)', p.sw.state === 'reload' && p.sw.ammo === mid, p.sw.ammo + ' de ' + SC.mag);
}
console.log('\nPATRÓN DE PERDIGONES');
{ const d = [0, 0, -1];
  const a = Wp.pelletDirs(d, SC, 0, 1), b = Wp.pelletDirs(d, SC, 0, 1), c = Wp.pelletDirs(d, SC, 0, 2), z = Wp.pelletDirs(d, SC, 1, 1);
  const ang = v => Math.acos(Math.max(-1, Math.min(1, -v[2])));
  check(SC.pellets + ' perdigones, todos de longitud 1', a.length === SC.pellets && a.every(v => Math.abs(Math.hypot(...v) - 1) < 1e-9));
  check('mismo disparo = mismo patrón (cliente y servidor calculan igual)', JSON.stringify(a) === JSON.stringify(b));
  check('cada disparo gira el patrón', JSON.stringify(a) !== JSON.stringify(c));
  const maxHip = Math.max(...a.map(ang)), maxAds = Math.max(...z.map(ang));
  check('desde la cadera el anillo exterior abre ' + (SC.pelletSpread * 1000).toFixed(0) + ' mrad', Math.abs(maxHip - SC.pelletSpread) < 0.002, (maxHip * 1000).toFixed(1) + ' mrad');
  check('apuntando se cierra al ' + Math.round(SC.pelletAdsMul * 100) + ' %', Math.abs(maxAds / maxHip - SC.pelletAdsMul) < 0.02);
  check('el perdigón central sigue la mira', ang(a[0]) < 1e-9);
  // any direction (looking up and sideways) keeps the same opening
  const e = [0.6, 0.5, -0.6], en = Math.hypot(...e), de = e.map(v => v / en), pe = Wp.pelletDirs(de, SC, 0, 3);
  const angE = v => Math.acos(Math.max(-1, Math.min(1, v[0] * de[0] + v[1] * de[1] + v[2] * de[2])));
  check('mirando arriba y de lado el patrón mide lo mismo', Math.abs(Math.max(...pe.map(angE)) - SC.pelletSpread) < 0.002);
  // damage of one shot at the centre of a standing chest, with the real hit zones
  const G = require('../core/geom.js'), HB = require('../core/hitbox.js');
  const shot = (dist, ads) => { let tot = 0; for (let s = 0; s < 40; s++) for (const v of Wp.pelletDirs(d, SC, ads, s)) {
    const h = HB.segPlayer(G, { x: 0, y: 0, z: -dist, eye: 1.62, yaw: 0 }, 0, 1.17, 0, v[0], v[1], v[2], 60);
    if (h) { const f = SC.falloff, k = h.t <= f.from ? 1 : h.t >= f.to ? f.min : 1 - (1 - f.min) * (h.t - f.from) / (f.to - f.from); tot += Math.round(SC.dmg[h.part] * k); } }
    return Math.round(tot / 40); };
  check('desde la cadera a 4 m: baja de un tiro', shot(4, 0) >= 100, shot(4, 0));
  check('apuntando a 6 m: baja de un tiro', shot(6, 1) >= 100, shot(6, 1));
  check('a 9 m ya no mata de un tiro (ni apuntando)', shot(9, 1) < 100 && shot(9, 0) < 100, shot(9, 0) + ' / ' + shot(9, 1));
  check('apuntando a 12 m: dos tiros', shot(12, 1) >= 50 && shot(12, 1) < 100, shot(12, 1));
  check('a 20 m apenas hace daño (menos que una bala de pistola)', shot(20, 1) < CFG.pistols.vibora.dmg.torso, shot(20, 1));
}
console.log('\nINSTANTÁNEA Y VELOCIDAD');
{ const a = shotgunPlayer(), b = SDP.create(0, 0, 0);
  run(a, 0.5, i => ({ fire: i === 3 }));
  SDP.restore(b, JSON.parse(JSON.stringify(SDP.save(a))));
  check('la escopeta viaja en la instantánea del servidor', b.load.primary === 'shotgun' && b.load.active === 'shotgun' && b.sw.ammo === a.sw.ammo && b.sw.state === a.sw.state && b.sw.cfg === SC && b.load.sc === SC);
  const L = Me.createLoadout(CFG.knives.tactica, CFG.loadout, CFG.pistols.vibora, SC); L.active = 'shotgun';
  check('con la escopeta corres un 2 % menos', Me.speedMul(L) === SC.moveMul);
}
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
