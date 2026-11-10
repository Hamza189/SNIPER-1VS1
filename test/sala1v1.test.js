/* SALA 1V1 (?lobby=2, 10-11-2026): lo que enseña la sala y su hangar 3D (client/lobby1v1.js). Sin navegador.
   - los estados en palabras (quién es el anfitrión, cuándo se puede INICIAR, qué dice la barra) a partir del mensaje del servidor
   - las tarjetas de mapa: solo mapas que existen y que el servidor tiene; el mapa de la sala siempre tiene la suya
   - el encuadre: los dos operadores caben en el hueco libre y su centro cae en el centro del hueco
   - el hangar es ligero (pocas mallas y triángulos, sin sombras) y se puede liberar entero
   Run: node test/sala1v1.test.js */
'use strict';
const L = require('../client/lobby1v1.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const pl = (id, name, ready, connected) => ({ id, name, ready: !!ready, connected: connected !== false, kit: 'rifle', skin: 'soldado' });

console.log('\nESTADOS DE LA SALA');
{ const N = { you: 'A', host: 'A', hs: 1, phase: 'lobby', players: [pl('A', 'Hamza'), null] };
  let V = L.view(N);
  check('solo: 1/2, sin rival, no se puede iniciar y la barra pide invitar', V.count === 1 && !V.rival && !V.canStart && V.why === 'players' && /INVÍTALO/.test(V.status));
  N.players[1] = pl('B', 'Faisal'); V = L.view(N);
  check('entra el rival: 2/2, aún sin LISTO', V.count === 2 && V.rival.name === 'Faisal' && !V.canStart && V.why === 'ready' && /LISTO LOS DOS/.test(V.status));
  N.players[1].ready = true; V = L.view(N);
  check('el rival LISTO: me lo dice a mí', /TU RIVAL ESTÁ LISTO/.test(V.status) && !V.canStart);
  N.players[0].ready = true; V = L.view(N);
  check('los dos LISTOS: el anfitrión puede INICIAR', V.canStart && V.isHost && /INICIA LA PARTIDA/.test(V.status));
  const G = L.view(Object.assign({}, N, { you: 'B' }));
  check('el invitado no puede iniciar y espera al anfitrión', !G.canStart && !G.isHost && G.me.id === 'B' && G.rival.id === 'A' && /ESPERANDO AL ANFITRIÓN/.test(G.status));
  const O = L.view(Object.assign({}, N, { hs: 0 }));
  check('anfitrión con la página de antes (hs 0): no hay INICIAR, empieza sola', !O.canStart && /EMPIEZA YA/.test(O.status));
  N.players[1].connected = false; V = L.view(N);
  check('rival desconectado: no se puede iniciar y se dice', !V.canStart && V.why === 'rival_off' && /DESCONECTADO/.test(V.status));
  const C = L.view(Object.assign({}, N, { phase: 'countdown', players: [pl('A', 'Hamza', 1), pl('B', 'Faisal', 1)] }));
  check('con la partida ya en marcha no se puede iniciar otra', !C.canStart);
  const E = L.view({ you: 'B', host: 'B', hs: 1, phase: 'lobby', players: [null, pl('B', 'Faisal')] });
  check('si el anfitrión se va, el que se queda pasa a ser el anfitrión', E.isHost && E.hostId === 'B' && !E.rival);
  const R = L.view({ you: 'A', host: 'A', hs: 1, phase: 'over', players: [pl('A', 'Hamza'), pl('B', 'Faisal')], rematchOf: { B: true } });
  check('tras la partida: REVANCHA (el rival ya la ha pedido)', R.over && !R.again && /QUIERE LA REVANCHA/.test(R.status));
  const R2 = L.view({ you: 'A', host: 'A', hs: 1, phase: 'over', players: [pl('A', 'Hamza'), null], rematchOf: {} });
  check('tras la partida y sin rival: esperar a otro', R2.over && /NUEVO RIVAL/.test(R2.status));
}

console.log('\nMAPAS');
{ const offered = [{ id: 'arena', name: 'ARENA' }, { id: 'pueblo', name: 'PUEBLO' }, { id: 'casa', name: 'CASA ATLAS' }, { id: 'casa2', name: 'CASA ATLAS 2.0' }];
  const c = L.mapCards(offered, ['pueblo', 'arena', 'casa', 'casa2', 'casa2b', 'casa2c', 'barrio'], 'arena');
  check('las tarjetas son las que la página ofrece y el servidor tiene', c.map(x => x.id).join() === 'arena,pueblo,casa,casa2');
  check('un mapa que el servidor no tiene no sale', L.mapCards(offered, ['arena', 'pueblo'], 'arena').map(x => x.id).join() === 'arena,pueblo');
  const d = L.mapCards(offered, ['arena', 'pueblo', 'barrio'], 'barrio', id => id.toUpperCase());
  check('el mapa de la sala (elegido con otra página) tiene su tarjeta', d.map(x => x.id).join() === 'arena,pueblo,barrio' && d[2].name === 'BARRIO');
  check('nunca una tarjeta de un mapa que el servidor no tiene, aunque la sala lo diga', !L.mapCards(offered, ['arena'], 'montana').some(x => x.id === 'montana'));
}

console.log('\nENCUADRE');
{ const vw = 1600, vh = 900, fov = 32, r = { left: 330, top: 120, width: 900, height: 520 };
  const f = L.fitCamera(r, vw, vh, fov), t = Math.tan(fov * Math.PI / 360);
  const seenH = 2 * f.dist * t, seenW = seenH * vw / vh;
  check('los dos operadores caben de alto en el hueco', 2.25 / seenH <= r.height / vh * 0.9 + 1e-9, (2.25 / seenH * vh).toFixed(0) + ' px de ' + r.height);
  check('y de ancho', 3.3 / seenW <= r.width / vw * 0.94 + 1e-9, (3.3 / seenW * vw).toFixed(0) + ' px de ' + r.width);
  check('su centro va al centro del hueco', f.ox === 330 + 450 - 800 && f.oy === 120 + 260 - 450);
  const m = L.fitCamera({ left: 0, top: 80, width: 700, height: 220 }, 932, 430, fov);
  check('en el móvil apaisado también caben', 2.25 / (2 * m.dist * t) <= 220 / 430 * 0.9 + 1e-9 && 3.3 / (2 * m.dist * t * 932 / 430) <= 700 / 932 * 0.94 + 1e-9);
  const a0 = L.appear(0), a1 = L.appear(1);
  check('el rival aparece subiendo a su sitio y termina quieto', a0.y < -0.3 && a1.y === 0 && a1.s === 1 && a1.flash === 0 && L.appear(0.45).flash > 0.9);
  const s0 = L.sway(3, 0), s1 = L.sway(3, 1);
  check('los dos respiran, pero no a la vez', Math.abs(s0.yaw) < 0.06 && Math.abs(s0.bob) < 0.01 && s0.yaw !== s1.yaw);
}

console.log('\nHANGAR');
{ const T = require('../vendor/three.min.js');
  const H = L.buildHangar(T, { tex: () => null });
  let meshes = 0, tris = 0, shadows = 0;
  H.scene.traverse(o => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; if (o.castShadow) shadows++; } if (o.isLight && o.castShadow) shadows++; });
  check('dos plataformas, una a cada lado', H.pads.length === 2 && H.pads[0].g.position.x < 0 && H.pads[1].g.position.x > 0 && H.pads[0].stand && H.pads[1].stand);
  check('ligero: pocas mallas y triángulos, sin sombras', meshes < 260 && tris < 20000 && shadows === 0, meshes + ' mallas · ' + Math.round(tris) + ' triángulos');
  H.frame(1.2, [{ on: true, ready: true }, { on: false }]);
  check('plataforma con alguien LISTO: aro a tope; vacía: aro tenue y haz de espera', H.pads[0].ringMat.opacity === 1 && H.pads[1].ringMat.opacity < 0.5 && H.pads[1].beam.visible && !H.pads[0].beam.visible);
  H.frame(1.3, [{ on: true }, { on: true, ready: false, flash: 1 }]);
  check('al aparecer el rival su plataforma destella', H.pads[1].light.intensity > 2 && H.pads[1].beam.visible);
  let n = 0; const orig = T.BufferGeometry.prototype.dispose; T.BufferGeometry.prototype.dispose = function () { n++; return orig.call(this); };
  H.dispose(); T.BufferGeometry.prototype.dispose = orig;
  check('se libera entero al jugar', n > 20, n + ' geometrías');
}

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
