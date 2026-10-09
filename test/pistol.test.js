/* Stage E1: VÍBORA 9 sidearm — core rules (no browser). Run: node test/pistol.test.js */
'use strict';
const CFG = require('../core/config.js'), SDP = require('../core/player.js'), Wp = require('../core/weapon.js'), Me = require('../core/melee.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const DT = 1 / 120, world = { colliders: [], ramps: [] }, PC = CFG.pistols.vibora;
const run = (p, secs, cmdFn, sink) => { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { const r = SDP.step(p, Object.assign({ mx: 0, mz: 0, yaw: 0 }, cmdFn ? cmdFn(i) : {}), DT, world); if (sink) sink(r); } };

console.log('\nVÍBORA 9');
{ const p = SDP.create(0, 0, 0); run(p, 1);                 // rifle raised
  let t = 0, ready = null;
  run(p, 1, i => ({ select: i === 0 ? 'pistol' : null }), r => { t += DT; for (const e of r.lev) if (e.type === 'drawn' && e.weapon === 'pistol' && ready === null) ready = t; });
  const want = CFG.loadout.rifleHolster + CFG.loadout.pistolDraw;
  check('rifle → pistola en ' + want.toFixed(2) + ' s (guardar rifle + sacar pistola)', ready !== null && Math.abs(ready - want) < 0.02, ready && ready.toFixed(3) + ' s');
  check('cambiar a la pistola es más rápido que recargar el rifle', want < CFG.rifles.halcon.reload);
  // cadence: one shot per press, never faster than the slide cycle
  let shots = 0; run(p, 1, () => ({ fire: true }), r => { for (const e of r.pev) if (e.type === 'fire') shots++; });
  check('con el gatillo pulsado sin parar, como mucho ' + Math.floor(1 / PC.bolt + 1) + ' disparos por segundo', shots >= 5 && shots <= Math.floor(1 / PC.bolt) + 1, shots + ' disparos');
  check('el rifle no dispara mientras está guardado', p.w.shots === 0);
  run(p, 0.5);
  // magazine: 12, then dry → automatic reload
  p.pw.ammo = 12; let fired = 0, reloads = 0;
  run(p, 4, i => ({ fire: i % 30 === 0 }), r => { for (const e of r.pev) { if (e.type === 'fire') fired++; if (e.type === 'reloadStart') reloads++; } });
  check('12 balas por cargador; al vaciarlo recarga sola', reloads >= 1, fired + ' disparos, ' + reloads + ' recarga(s)');
  let rt = 0, done = null; p.pw.ammo = 3; p.pw.state = 'ready';
  run(p, 2.5, i => ({ reload: i === 0 }), r => { rt += DT; for (const e of r.pev) if (e.type === 'reloadEnd' && done === null) done = rt; });
  check('recarga en ' + PC.reload + ' s y deja 12', done !== null && Math.abs(done - PC.reload) < 0.03 && p.pw.ammo === 12, done && done.toFixed(2) + ' s');
}
{ // accuracy: ADS tightens the cone, rapid fire blooms it, calm brings it back
  const p = SDP.create(0, 0, 0); run(p, 1, i => ({ select: i === 0 ? 'pistol' : null })); run(p, 0.5);
  const still = { speed: 0, airborne: false, crouch: false, sliding: false };
  const hip = Wp.spread(p.pw, still);
  run(p, 0.3, () => ({ adsHeld: true }));
  const ads = Wp.spread(p.pw, still);
  check('apuntando con los alzas la dispersión baja al 30 %', Math.abs(ads / hip - PC.adsSpreadMin) < 0.01, (ads * 1000).toFixed(1) + ' vs ' + (hip * 1000).toFixed(1) + ' mrad');
  check('la pistola nunca "entra en mira" de francotirador (sin visor)', p.pw.ads < PC.scopeAt);
  run(p, 0.9, i => ({ adsHeld: true, fire: i % 22 === 0 }));   // 5 shots as fast as you can tap
  const bloomed = Wp.spread(p.pw, still);
  check('disparar rápido abre la dispersión (retroceso que se acumula)', bloomed > ads + 0.01, (bloomed * 1000).toFixed(1) + ' mrad');
  check('nunca pasa del máximo', p.pw.bloom <= PC.bloomMax + 1e-9);
  run(p, 1.5, () => ({ adsHeld: true }));
  check('si esperas (1,5 s), vuelve a ser precisa', Math.abs(Wp.spread(p.pw, still) - ads) < 1e-6);
}
{ // speed with the pistol out, knife and rifle unchanged
  const L = Me.createLoadout(CFG.knives.tactica, CFG.loadout, PC);
  L.active = 'pistol'; L.phase = 'ready';
  check('con la pistola corres un 4 % más que con el rifle', Me.speedMul(L) === PC.moveMul);
  L.active = 'rifle'; check('con el rifle, velocidad normal', Me.speedMul(L) === 1);
  L.active = 'knife'; check('con la navaja, como antes', Me.speedMul(L) === CFG.knives.tactica.moveMul);
}
{ // state survives a server snapshot (reconciliation)
  const a = SDP.create(1, 0, 2), b = SDP.create(0, 0, 0);
  run(a, 1, i => ({ select: i === 0 ? 'pistol' : null })); run(a, 0.5, i => ({ fire: i === 3 }));
  SDP.restore(b, JSON.parse(JSON.stringify(SDP.save(a))));
  check('el estado de la pistola viaja en la instantánea del servidor', b.pw.ammo === a.pw.ammo && b.pw.state === a.pw.state && b.load.active === 'pistol' && b.pw.cfg === PC && b.pw.bloom === a.pw.bloom);
}
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
