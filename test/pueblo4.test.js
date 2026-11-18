/* PUEBLO 4.0 (15-11-2026, client/pueblo4.js) sin navegador: lo nuevo es solo lo que se ve y respeta las reglas de
   cobertura de PUEBLO 3.0: piezas de fachada pegadas a la fachada; a la altura del cuerpo solo cosas planas o bajas;
   cables por encima de 5 m; el desgaste solo en materiales del pueblo y sin texturas nuevas.   node test/pueblo4.test.js */
'use strict';
const P4 = require('../client/pueblo4.js'), T3 = require('../client/town3.js'), C = require('../client/casas.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const B = [[-31,-31,14,12,7,0],[-31,-9,12,10,5,1],[-32,16,12,12,9,2],[-31,37,14,10,6,3],[31,-33,12,10,8,4],[33,-8,10,12,5,5],[30,17,14,10,7,1],[33,38,10,10,10,2],[-9,-31,8,8,4,3],[13,-25,6,10,6,4],[-12,27,10,6,5,0],[11,31,8,6,4,5],[-2,-43,10,5,3.5,2],[3,43,12,5,4,3]];
const fam = Object.assign({}, T3.SLICE_FAMILIES, T3.SOUTH_FAMILIES), q = B.filter(b => fam[b[0] + ',' + b[1]] && !C.byKey[b[0] + ',' + b[1]]);
const d = T3.build(q, { families: fam }), extra = P4.dress(d.place);
const cnt = {}; for (const p of extra) cnt[p.k] = (cnt[p.k] || 0) + 1;
check('piezas de vida en las fachadas: ' + JSON.stringify(cnt), extra.length > 25 && cnt.laundry > 5 && cnt.plaque > 5 && cnt.ac_unit > 0, extra.length);
// distance from a piece to the nearest building outline
const near = p => Math.min(...q.map(b => { const dx = Math.max(0, Math.abs(p.x - b[0]) - b[2] / 2), dz = Math.max(0, Math.abs(p.z - b[1]) - b[3] / 2); return Math.hypot(dx, dz); }));
const far = extra.filter(p => near(p) > 0.45);
check('todas pegadas a una fachada (≤ 0,45 m)', far.length === 0, far.map(p => p.k + '@' + p.x + ',' + p.z).slice(0, 4).join(' '));
const body = extra.filter(p => p.y > 0.12 && p.y < 2.0 && !/^(plaque|meter_box)$/.test(p.k));
check('a la altura del cuerpo solo placas y contadores (planos)', body.length === 0, body.map(p => p.k + '@' + p.y).join(' '));
const hi = extra.filter(p => /^(laundry|planter|ac_unit)$/.test(p.k));
check('ropa, jardineras y aparatos por encima de 2 m', hi.every(p => p.y > 2.0), Math.min(...hi.map(p => p.y)).toFixed(2));
check('el mismo resultado cada vez (sin azar suelto)', JSON.stringify(P4.dress(d.place)) === JSON.stringify(extra));
const cb = P4.cables(); let ymin = 1e9; for (let i = 1; i < cb.pos.length; i += 3) ymin = Math.min(ymin, cb.pos[i]);
check('cables: ' + cb.spans + ' tramos, todos por encima de 4,5 m', ymin > 4.5, ymin.toFixed(2));
check('cables: pocos triángulos (' + cb.idx.length / 3 + ')', cb.idx.length / 3 < 3000);
const m = { onBeforeCompile: null, constructor: { prototype: {} }, userData: {} };
check('desgaste: se aplica a estuco y adoquín, no al vidrio ni a la pintura de carteles', P4.weather(Object.assign({}, m, { userData: {} }), 'stucco') && P4.weather(Object.assign({}, m, { userData: {} }), 'setts') && !P4.weather(Object.assign({}, m, { userData: {} }), 'glass') && !P4.weather(Object.assign({}, m, { userData: {} }), 'sign'));
// vehículos (tools/blender/vehiculos.py): dentro de la caja de colisión del coche viejo (±2,1 × ±0,95 × 1,9 m) y ligeros
{ const fs = require('fs'), path = require('path');
  const st = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'blender', 'vehiculos-stats.json'), 'utf8'));
  const glb = path.join(__dirname, '..', 'assets', '3d', 'models', 'sd_p4_vehiculos.glb');
  check('vehículos: el GLB existe y pesa menos de 2 MB', fs.existsSync(glb) && fs.statSync(glb).size < 2e6);
  const ks = Object.keys(st);
  check('vehículos: las 3 pick-ups caben en la caja de colisión del coche viejo', ks.length === 3 && ks.every(k => { const b = st[k].bounds; return st[k].dentro_de_la_caja && b.x[0] >= -2.1 && b.x[1] <= 2.1 && b.z[0] >= -0.95 && b.z[1] <= 0.95 && b.y[1] <= 1.9 && b.y[0] >= -0.001; }), ks.map(k => JSON.stringify(st[k].bounds)).join(' '));
  check('vehículos: menos de 6000 triángulos cada una', ks.every(k => st[k].tris < 6000), ks.map(k => st[k].tris).join(', '));
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'page.html'), 'utf8');
  check('vehículos: el coche viejo sigue en la escena para las balas (solo se oculta cuando carga el modelo)', /P4VEH\.old\.push\(o\);continue;/.test(page) && /for\(const o of P4VEH\.old\)o\.traverse\(c=>\{if\(c\.isMesh\)hideOld\(c\);\}\)/.test(page));
  // F6b: cajas, bidones y depósito (tools/blender/utileria.py) dentro de las cajas de colisión / triángulos de bala viejos
  const su = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'blender', 'utileria-stats.json'), 'utf8'));
  const gu = path.join(__dirname, '..', 'assets', '3d', 'models', 'sd_p4_utileria.glb');
  check('utilería: el GLB existe y pesa menos de 1 MB', fs.existsSync(gu) && fs.statSync(gu).size < 1e6);
  const inBox = (b, h, top) => b.x[0] >= -h - 1e-3 && b.x[1] <= h + 1e-3 && b.z[0] >= -h - 1e-3 && b.z[1] <= h + 1e-3 && b.y[0] >= -1e-3 && b.y[1] <= top + 1e-3;
  const cr = ['crate_a', 'crate_b', 'crate_c'], dr = ['drum_a', 'drum_b', 'drum_c'];
  check('utilería: las 3 cajas caben en el cubo de 1,2 m', cr.every(k => su[k] && inBox(su[k].bounds, 0.6, 1.2)), cr.map(k => su[k] && JSON.stringify(su[k].bounds)).join(' '));
  check('utilería: los 3 bidones caben en el cilindro viejo (r 0,36, 1 m)', dr.every(k => su[k] && inBox(su[k].bounds, 0.36, 1.0)));
  check('utilería: el depósito cabe en el viejo (±2,4 m, hasta 11,4 m)', su.water_tower && inBox(su.water_tower.bounds, 2.4, 11.4));
  check('utilería: ligeros (caja < 400, bidón < 900, depósito < 5000 triángulos)', cr.every(k => su[k].tris < 400) && dr.every(k => su[k].tris < 900) && su.water_tower.tris < 5000, Object.keys(su).map(k => k + ' ' + su[k].tris).join(', '));
  check('utilería: los objetos viejos siguen para las balas (solo se ocultan si el modelo carga)', /P4VEH\.props\.push\(o\)/.test(page) && /if\(P4VEH\.propPieces\)\{Object\.assign\(kit\.pieces,P4VEH\.propPieces\);for\(const o of P4VEH\.props\)hideOld\(o\);\}/.test(page)); }
// 17-11-2026: PUEBLO 4.0 only behind ?pueblo=4, with its own server map 'pueblo4'; the classic 'pueblo' does not change
{ const MD = require('../core/mapdata.js').maps, src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'page.html'), 'utf8');
  check("servidor: 'pueblo' (el de siempre) y 'pueblo4' (con las 8 casas) son mapas distintos", !!MD.pueblo && !!MD.pueblo4 && MD.pueblo4.colliders.length > MD.pueblo.colliders.length + 300, MD.pueblo.colliders.length + ' / ' + (MD.pueblo4 ? MD.pueblo4.colliders.length : '-') + ' cajas');
  check('página: casas, mitad sur, fuente nueva y 4.0 solo con PU4 (?pueblo=4)', /const CASAS=\{on:PU4&&/.test(src) && /const P31=P3ON&&PU4&&/.test(src) && /const FUENTE=\{on:PU4&&/.test(src) && /const P4ON=PU4&&/.test(src));
  check("página: con PU4 la sala traduce 'pueblo' ↔ 'pueblo4'", /mapAlias:PU4\?\{pueblo:'pueblo4'\}:undefined/.test(src));
  const NC = require('../client/netcore.js'), sent = [], mk = alias => NC.create({ mapAlias: alias, send: t => sent.push(JSON.parse(t)), now: () => 0, world: null, local: null });
  const N = mk({ pueblo: 'pueblo4' }); N.onMessage(JSON.stringify({ t: 'lobby', phase: 'lobby', players: [], map: 'pueblo4', maps: ['arena', 'pueblo', 'pueblo4', 'casa'] })); N.chooseMap('pueblo');
  check("sala con ?pueblo=4: el servidor dice 'pueblo4' → la página ve 'pueblo'; el 'pueblo' clásico no se ofrece; elegir 'pueblo' manda 'pueblo4'", N.map === 'pueblo' && N.mapSrv === 'pueblo4' && JSON.stringify(N.maps) === '["arena","pueblo","casa"]' && sent.pop().id === 'pueblo4', JSON.stringify([N.map, N.mapSrv, N.maps]));
  const N0 = mk(undefined); N0.onMessage(JSON.stringify({ t: 'lobby', phase: 'lobby', players: [], map: 'pueblo', maps: ['arena', 'pueblo', 'pueblo4'] })); N0.chooseMap('pueblo');
  check('sala sin bandera: todo igual que antes', N0.map === 'pueblo' && N0.mapSrv === 'pueblo' && N0.maps.length === 3 && sent.pop().id === 'pueblo'); }
console.log('\n' + pass + ' ok, ' + fail + ' fallos');
process.exit(fail ? 1 : 0);
