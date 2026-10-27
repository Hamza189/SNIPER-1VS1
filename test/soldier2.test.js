/* Personaje 3D (?pj=2): reglas de mezcla de client/soldier2.js (sin WebGL) y el modelo publicado:
   - pesos de cada capa que suman 1, esprint/deslizamiento/muerte de cuerpo entero, agachado, inclinación aditiva
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
