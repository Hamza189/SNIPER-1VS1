/* MENÚ 2 (?menu=2, 02-11-2026): la sala del menú nuevo y sus cuentas (client/menu2.js). Sin navegador.
   - cinco secciones en la barra de abajo, en el orden que pidió el propietario
   - los mapas del juego, cuáles van online (el servidor los tiene) y cuáles son experimentales
   - encuadre: el operador cabe en el hueco libre de cada sección y su centro cae en el centro del hueco
   - el arma de muestra: el centro y la escala de su hueco
   - la sala es ligera (pocas mallas y triángulos, luces sin sombras) y se puede liberar entera
   Run: node test/menu2.test.js */
'use strict';
const M = require('../client/menu2.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

console.log('\nSECCIONES Y MAPAS');
check('INICIO | PERSONAJE | ARMAS | MAPAS | AJUSTES', M.TABS.join('|') === 'inicio|personaje|armas|mapas|ajustes');
check('los 4 mapas del juego, con nombre y descripción', M.MAPS.map(m => m.id).join() === 'arena,pueblo,casa,casaxl' && M.MAPS.every(m => m.name && m.sub));
check('online: ARENA, PUEBLO y CASA ATLAS (los que tiene el servidor); CASA XL solo contra bots', M.MAPS.filter(m => m.online).map(m => m.id).join() === 'arena,pueblo,casa');
check('CASA ATLAS y CASA XL marcadas como experimentales', M.MAPS.filter(m => m.exp).map(m => m.id).join() === 'casa,casaxl');

console.log('\nENCUADRE');
// a vertical fov of 30°: a 2.05 m operator filling 94 % of a hole as tall as the screen
const f = M.stageFrame({ left: 400, top: 60, width: 800, height: 700 }, 1600, 900, 30, 2.05);
const seen = 2 * f.dist * Math.tan(15 * Math.PI / 180);   // metres the picture shows from top to bottom at that distance
check('el operador ocupa el 94 % del alto del hueco', near(2.05 / seen, 700 / 900 * 0.94, 1e-9), (2.05 / seen).toFixed(3));
check('su centro va al centro del hueco (desplazamiento de la imagen)', f.ox === 0 && f.oy === 410 - 450, f.ox + ',' + f.oy);
const g = M.stageFrame({ left: 0, top: 0, width: 300, height: 400 }, 1600, 900, 30);
check('un hueco a la izquierda lleva la imagen a la izquierda', g.ox === 150 - 800 && g.oy === 200 - 450);
const h = M.stageFrame(null, 1600, 900, 30);
check('sin hueco (MAPAS): en el centro de la pantalla', h.ox === 0 && h.oy === 0 && h.dist > 0);
check('un hueco diminuto no lo acerca sin límite (mínimo un 25 % del alto)', M.stageFrame({ left: 0, top: 0, width: 50, height: 30 }, 1600, 900, 30).dist > 0 && M.stageFrame({ left: 0, top: 0, width: 400, height: 40 }, 1600, 900, 30).dist <= M.frameDist(2.05, 0.25 * 0.94, 30) + 1e-9);
const s = M.slotPlace({ left: 800, top: 100, width: 600, height: 200 }, 1600, 900, 30, 1.3);
check('el arma de muestra: centro del hueco en coordenadas de la imagen', near(s.ndcX, 0.375) && near(s.ndcY, 1 - 400 / 900));
check('y los metros que mide el hueco a esa distancia', near(s.perPx * 900, 2 * 1.3 * Math.tan(15 * Math.PI / 180)) && near(s.width, 600 * s.perPx));

console.log('\nMOVIMIENTO');
check('damp: llega al destino y no se pasa', near(M.damp(0, 1, 7, 10), 1, 1e-9) && M.damp(0, 1, 7, 0.016) > 0 && M.damp(0, 1, 7, 0.016) < 1);
check('dampAngle: gira por el lado corto y sin saltos', M.dampAngle(3.1, -3.1, 7, 0.05) > 3.1 && M.dampAngle(3.1, -3.1, 7, 0.05) < 3.2 && near(M.dampAngle(0.5, 0, 7, 50), 0, 1e-9));
const sw = M.idleSway(12.3);
check('balanceo de reposo pequeño (menos de 4° y 5 mm)', Math.abs(sw.yaw) < 0.07 && Math.abs(sw.lean) < 0.02 && Math.abs(sw.bob) < 0.005);

console.log('\nLA SALA');
const T = require('../vendor/three.min.js');
const R = M.buildRoom(T, { tex: () => null });
let meshes = 0, tris = 0, lights = 0, shadow = 0;
R.scene.traverse(o => {
  if (o.isMesh) { meshes++; const gg = o.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; }
  if (o.isLight) { lights++; if (o.castShadow) shadow++; }
});
check('ligera: menos de 70 mallas y 3000 triángulos', meshes < 70 && tris < 3000, meshes + ' mallas, ' + tris + ' triángulos');
check('cinco o seis luces y ninguna con sombras', lights >= 5 && lights <= 6 && shadow === 0, lights + ' luces');
check('fondo oscuro con niebla, y un sitio para el operador en el centro', R.scene.background.getHex() < 0x202020 && R.scene.fog && R.stand.position.length() === 0);
check('exposición propia (más oscura que la del juego)', R.exposure > 0.5 && R.exposure < 0.82);
let disposed = 0; R.scene.traverse(o => { if (o.geometry) o.geometry.addEventListener('dispose', () => disposed++); });
R.dispose();
check('se libera entera al empezar a jugar', disposed > 10, disposed + ' geometrías');
R.frame(5);
check('el polvo se mueve sin salirse de la sala', (() => { const a = R.scene.children.find(o => o.isPoints).geometry.attributes.position.array; for (let i = 1; i < a.length; i += 3) if (a[i] < 0 || a[i] > 3.4) return false; return true; })());

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
