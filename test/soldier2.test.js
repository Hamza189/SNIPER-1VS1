/* Personaje 3D (?pj=2): reglas de mezcla de client/soldier2.js (sin WebGL) y el modelo publicado:
   - pesos de cada capa que suman 1, esprint/deslizamiento/muerte de cuerpo entero, agachado, inclinación aditiva
   - GF-2 (31-10-2026): lo que llega de golpe (esprint, salto, muerte, apuntar, arma) entra y sale con mezcla; retroceso,
     impacto, aterrizaje y caída hacia delante
   - assets/personaje/*.glb pasan tools/validate-glb.js y caben en las zonas de impacto de core/hitbox.js (±4 cm) en
     sus tres LOD (tools/check-character-hitbox.js)
   Run: node test/soldier2.test.js */
'use strict';
const path = require('path'), { execFileSync } = require('child_process');
const S = require('../client/soldier2.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const near = (a, b) => Math.abs(a - b) < 1e-6;

console.log('\nMEZCLA (plan)');
const idle = S.plan({ wpn: 'rifle', aim: 0 });
check('quieto: idle_rifle abajo y arriba, pesos 1', near(idle.lower.idle_rifle, 1) && near(idle.upper.idle_rifle, 1), JSON.stringify(idle.lower));
const walk = S.plan({ vz: 4.6, wpn: 'rifle', aim: 1 });
check('andar hacia delante: walk_fwd y rifle al hombro', near(walk.lower.walk_fwd, 1) && near(walk.upper.aim_rifle, 1));
const diag = S.plan({ vz: 3, vx: 3, wpn: 'rifle' });
check('en diagonal: delante + izquierda, suma 1', near(sum(diag.lower), 1) && diag.lower.walk_fwd > 0.4 && diag.lower.walk_left > 0.4, JSON.stringify(diag.lower));
const sp = S.plan({ vz: 7, sprint: true, wpn: 'rifle' });
check('esprint: cuerpo entero (rifle cruzado)', near(sp.full.sprint, 1) && sum(sp.lower) === 0 && sum(sp.upper) === 0);
const cr = S.plan({ crouch: 1, wpn: 'rifle', aim: 1 });
check('agachado: crouch_idle (el morph baja el cuerpo a la caja de agachado)', near(cr.lower.crouch_idle, 1) && near(cr.upper.aim_rifle, 1));
const half = S.plan({ crouch: 0.5, wpn: 'rifle' });
check('a medio agachar: mezcla 50/50 (la altura sigue a la del servidor)', near(half.lower.idle_rifle, 0.5) && near(half.lower.crouch_idle, 0.5));
const sl = S.plan({ slide: 1, vz: 8, wpn: 'rifle' });
check('deslizamiento: cuerpo entero', near(sl.full.slide, 1) && sum(sl.lower) === 0);
const dead = S.plan({ dead: 0.5, vz: 3, wpn: 'rifle' });
check('muerte: death_back y nada más', near(dead.full.death_back, 1) && sum(dead.lower) === 0 && sum(dead.upper) === 0);
const up = S.plan({ wpn: 'rifle', aim: 1, pitch: Math.PI / 6 });
check('mirar 30° arriba: aim_up aditiva a la mitad', near(up.add.aim_up, 0.5) && up.add.aim_down === 0, up.add.aim_up);
const rel = S.plan({ wpn: 'pistol', reload: 1, relPh: 0.4 });
check('recarga de pistola: reload_pistol en su fase', near(rel.upper.reload_pistol, 1) && near(rel.oneT, 0.4));
const bolt = S.plan({ wpn: 'rifle', aim: 1, bolt: 0.5 });
check('cerrojo del rifle: fire_rifle en la parte del cerrojo', bolt.upper.fire_rifle > 0.9 && bolt.oneT > 0.5 && bolt.oneT < 0.7, bolt.oneT);
const kn = S.plan({ wpn: 'knife', stab: 0.3 });
check('navaja: knife_slash', near(kn.upper.knife_slash, 1));
let ok = true;
for (const st of [{}, { vz: 2 }, { vx: -4, crouch: 0.3 }, { air: true }, { slide: 0.4, vz: 6 }, { sprint: true, vz: 6.5, aim: 0.3 }, { wpn: 'shotgun', bolt: 0.2 }, { flinch: 0.5 }]) {
  const p = S.plan(Object.assign({ wpn: 'rifle' }, st)), f = sum(p.full);
  if (!near(sum(p.lower) + f, 1) || !near(sum(p.upper) + f, 1)) ok = false;
}
check('en todos los estados: inferior + cuerpo entero = 1 y superior + cuerpo entero = 1', ok);

console.log('\nTRANSICIONES Y GESTOS (GF-2, 31-10-2026, tools/anim-sheet.js)');
{
  const run = (B, st, secs) => { for (let t = 0; t < secs - 1e-9; t += 1 / 60) S.blend(B, st, 1 / 60); return B; };
  const walkSt = { vz: 4.05, wpn: 'rifle', aim: 0 }, sprSt = { vz: 7, sprint: true, wpn: 'rifle', aim: 0 };
  const B = run({}, walkSt, 0.5);
  check('el primer fotograma se coloca sin mezcla (aparecer no es una transición)', B.spr === 0 && S.blend({}, sprSt, 1 / 60).spr === 1);
  run(B, sprSt, 0.11); const half = B.spr; run(B, sprSt, 0.13);
  check('esprint: entra en ~0,22 s (a mitad a los 0,11 s), no de golpe', half > 0.4 && half < 0.6 && B.spr === 1, half.toFixed(2));
  run(B, walkSt, 0.11); const out = B.spr; run(B, walkSt, 0.13);
  check('y sale en ~0,22 s', out > 0.4 && out < 0.6 && B.spr === 0, out.toFixed(2));
  const J = run({}, walkSt, 0.2); run(J, Object.assign({ air: true }, walkSt), 0.5); run(J, walkSt, 1 / 60);
  const blip = run({}, walkSt, 0.2); run(blip, Object.assign({ air: true }, walkSt), 0.05); run(blip, walkSt, 1 / 60);
  check('aterrizaje tras 0,5 s en el aire: jump_land a toda fuerza; un salto de 0,05 s (escalón, red) no cuenta', J.landK > 0.99 && J.landT < 0.02 && blip.landK === 0, J.landK.toFixed(2) + ' / ' + blip.landK);
  const D = run({}, walkSt, 0.3); run(D, { dead: 0.1, wpn: 'rifle' }, 0.125);
  const q = S.blended(D, { dead: 0.1, wpn: 'rifle' });
  check('muerte: entra en 0,25 s y, mientras, las piernas siguen con su paso (no se cortan de golpe)', D.dead > 0.4 && D.dead < 0.6 && q.vz === 4.05, D.dead.toFixed(2));
  run(D, walkSt, 1 / 60);
  check('al reaparecer, de pie al instante (sin mezclar desde la caída)', D.dead === 0);
  const A = run({}, { wpn: 'rifle', aim: 0 }, 0.2); run(A, { wpn: 'rifle', aim: 1 }, 0.075);
  check('apuntar de los bots (0 → 1 de golpe): rampa de 0,15 s', A.aim > 0.4 && A.aim < 0.6, A.aim.toFixed(2));
  const sw = S.plan({ wpn: 'pistol', aim: 1, wpnFrom: 'rifle', wpnK: 0.5 });
  check('cambio de arma: la postura de la anterior se va mezclando (rifle 50 %, pistola 50 %)', near(sw.upper.aim_rifle, 0.5) && near(sw.upper.aim_pistol, 0.5));
  const sh = S.plan({ vz: 6, sprintW: 0.5, wpn: 'rifle', aim: 1 }), dd = S.plan({ deadW: 0.5, deathFront: true, wpn: 'rifle' });
  check('pesos ya mezclados: esprint a medias y caída hacia delante a medias, y todo suma 1', near(sh.full.sprint, 0.5) && near(sum(sh.lower) + 0.5, 1) && near(dd.full.death_front, 0.5) && near(sum(dd.upper) + 0.5, 1));
  const f0 = S.plan({ wpn: 'rifle', aim: 1, fire: 0.02 }), f1 = S.plan({ wpn: 'rifle', aim: 1, fire: 0.5 }), fp = S.plan({ wpn: 'pistol', aim: 1, fire: 0.05 }), fs = S.plan({ wpn: 'shotgun', aim: 1, fire: 0.05 }), fk = S.plan({ wpn: 'knife', fire: 0.05 });
  check('disparo: retroceso aditivo del clip de cada arma (rifle, pistola, escopeta) y nada con la navaja', near(f0.add.fire_rifle, 1) && !f1.add.fire_rifle && near(fp.add.fire_pistol, 1) && near(fs.add.fire_shotgun, 1) && Object.keys(fk.add).length === 2);
  const h0 = S.plan({ wpn: 'rifle', aim: 1, hit: 0, flinch: 0.7 }), h1 = S.plan({ wpn: 'rifle', aim: 1, hit: 0.06 }), h2 = S.plan({ wpn: 'rifle', aim: 1, hit: 0.5, flinch: 0.3 });
  check('impacto: hit_react entra en 0,05 s (antes, a peso 1 de golpe) y se va; con «hit», el «flinch» antiguo no cuenta', !h0.one && h1.one === 'hit_react' && h1.upper.hit_react > 0.8 && !h2.one, (h1.upper.hit_react || 0).toFixed(2));
  check('recarga de la escopeta: la mano va a la ventana y vuelve en cada cartucho (sin salto entre cartuchos)', S.shellT(0) === 0 && S.shellT(0.999) < 0.01 && near(S.shellT(0.55), 0.6), [0, 0.3, 0.55, 0.8, 0.999].map(u => S.shellT(u).toFixed(2)).join(' '));
  const kr = S.recoil({ wpn: 'rifle', fire: 0.03 }), kl = S.recoil({ wpn: 'rifle', hit: 0.04, hitX: 1, hitZ: 0 }), kd = S.recoil({ wpn: 'rifle', fire: 0.03, dead: 1 }), kh = S.recoil({ wpn: 'rifle', hit: 0.04, hitPart: 'head' });
  check('empujón del pecho: atrás al disparar, gira hacia donde empuja un tiro de lado, la cabeza atrás en un tiro a la cabeza; muerto, nada', kr.pitch > 0.06 && S.recoil({ wpn: 'rifle', fire: 0.6 }).pitch < 0.003 && kl.yaw > 0.1 && kh.head > 0.2 && kd.pitch === 0, JSON.stringify({ kr: +kr.pitch.toFixed(3), kl: +kl.yaw.toFixed(3) }));
  let ok2 = true;
  for (const st of [{ airW: 0.5, startW: 0.4, vz: 3 }, { landW: 0.7, vz: 2 }, { deadW: 0.3, sprintW: 0.6, vz: 6 }, { wpnFrom: 'pistol', wpnK: 0.3, aim: 0.6 }, { hit: 0.08, reload: 0.5, relPh: 0.3, wpn: 'shotgun' }, { fire: 0.03, bolt: 0.04, aim: 1 }]) {
    const p = S.plan(Object.assign({ wpn: 'rifle' }, st)), f = sum(p.full);
    if (!near(sum(p.lower) + f, 1) || !near(sum(p.upper) + f, 1)) { ok2 = false; console.log('     ', JSON.stringify(st), sum(p.lower) + f, sum(p.upper) + f); }
  }
  check('con los pesos mezclados también: inferior + cuerpo entero = 1 y superior + cuerpo entero = 1', ok2);
}

console.log('\nPASO SEGÚN LA VELOCIDAD Y PIERNAS HACIA LA MARCHA (27-10-2026, tools/gait-sheet.js)');
const g23 = S.gait(2.3, 4.49), g46 = S.gait(4.6, 4.04), g7 = S.gait(7, 4.04);
check('apuntando a 2,3 m/s: zancada más corta y cadencia ~130 pasos/min (no correr a cámara lenta) sin patinar', near(g23.stride * g23.rate, 2.3 / 4.49) && Math.round(182 * g23.rate) === 130, JSON.stringify(g23));
check('más rápido que el clip: zancada entera y la cadencia sube como mucho un 15 %', g46.stride === 1 && near(g46.rate, 4.6 / 4.04) && g7.rate === 1.15);
const deg = d => d * Math.PI / 180, L = d => S.legPlan(Math.sin(deg(d)), Math.cos(deg(d)));
check('W+A (45°): clip de frente con las piernas giradas 45° (el pecho contragira)', L(45).mode === 'fwd' && near(L(45).yaw, deg(45)));
check('de lado (90°): clip lateral sin giro; S+A (135°): hacia atrás girado −45°', L(90).mode === 'side' && L(90).w.left === 1 && near(L(90).yaw, 0) && L(135).mode === 'back' && near(L(135).yaw, deg(-45)) && L(-90).w.right === 1);
check('8° de margen en el límite: a 72° sigue de frente si venía de frente, y lateral si venía de lado', S.legPlan(Math.sin(deg(72)), Math.cos(deg(72)), 'fwd').mode === 'fwd' && S.legPlan(Math.sin(deg(72)), Math.cos(deg(72)), 'side').mode === 'side');

console.log('\nMODELO');
const root = path.join(__dirname, '..');
for (const assetRoot of ['assets/personaje/', 'assets/personaje/v4/']) {
console.log(assetRoot);
for (const f of ['personaje.glb', 'personaje_1k.glb']) {
  let o = '', code = 0;
  try { o = execFileSync('node', ['tools/validate-glb.js', assetRoot + f, '--lod0', '15000', '--lod1', '5000', '--lod2', '1500'], { cwd: root, encoding: 'utf8' }); } catch (e) { code = 1; o = String(e.stdout); }
  check(f + ': cumple el contrato de GLB (LOD0 ≤ 15 000, LOD1 ≤ 5 000, LOD2 ≤ 1 500, 1 material)', code === 0, (o.match(/nodos: (.*)/) || [])[1]);
}
for (const lod of [0, 1, 2]) {
  let o = '', code = 0;
  try { o = execFileSync('node', ['tools/check-character-hitbox.js', assetRoot + 'personaje.glb', '--lod', String(lod)], { cwd: root, encoding: 'utf8' }); } catch (e) { code = 1; o = String(e.stdout); }
  check('LOD' + lod + ': cabe en las zonas de impacto (±4 cm; cabeza en reposo sin tolerancia)', code === 0, (o.match(/reposo: (.*)/) || [])[1] || o.split('\n').filter(l => /✘/.test(l)).slice(0, 2).join(' | '));
}
}
// personajes realistas de ?pj=pro (tools/personaje-ext): límites de triángulos de su ficha (packs.json), 1 material,
// 29 animaciones del juego y las mismas zonas de impacto
const fs = require('fs');
const PACKS = JSON.parse(fs.readFileSync(path.join(root, 'tools/personaje-ext/packs.json'), 'utf8'));
for (const k of ['op2', 'op3', 'op4']) {
  const f = 'assets/personaje/pro/' + k + '/personaje.glb', lod = PACKS[k].cfg.lod;
  console.log(f + ' (' + PACKS[k].use + ')');
  let o = '', code = 0;
  try { o = execFileSync('node', ['tools/validate-glb.js', f, '--lod0', String(Math.round(lod[0] * 1.02)), '--lod1', String(Math.round(lod[1] * 1.02)), '--lod2', String(Math.round(lod[2] * 1.05))], { cwd: root, encoding: 'utf8' }); } catch (e) { code = 1; o = String(e.stdout); }
  check(k + ': contrato de GLB (LOD0 ≤ ' + lod[0] + ', LOD1 ≤ ' + lod[1] + ', LOD2 ≤ ' + lod[2] + ', 1 material) y 29 animaciones', code === 0 && /29 animaciones/.test(o), (o.match(/nodos: (.*)/) || [])[1]);
  for (const L of [0, 1, 2]) {
    let h = '', c2 = 0;
    try { h = execFileSync('node', ['tools/check-character-hitbox.js', f, '--lod', String(L)], { cwd: root, encoding: 'utf8' }); } catch (e) { c2 = 1; h = String(e.stdout); }
    check(k + ' LOD' + L + ': cabe en las zonas de impacto (±4 cm; cabeza en reposo sin tolerancia)', c2 === 0, (h.match(/reposo: (.*)/) || [])[1] || h.split('\n').filter(l => /✘/.test(l)).slice(0, 2).join(' | '));
  }
  check(k + ': lleva los créditos de la licencia CC BY 4.0', /CC BY 4\.0/.test(fs.readFileSync(path.join(root, 'assets/personaje/pro', k, 'CREDITOS.md'), 'utf8')));
}
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
