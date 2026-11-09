/* La caja de impacto del DESLIZAMIENTO nuevo (core/hitbox.js SLIDE, 09-11-2026): baja y alargada, piernas por delante.
   Solo la usa quien pasa pl.slide = true; sin él, todo sigue como siempre (lo que usa el servidor hoy).
   Run: node test/slidebox.test.js */
'use strict';
const H = require('../core/hitbox.js'), G = require('../core/geom.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
// a player sliding at the origin, looking toward +z (view yaw π: the body faces +z, see bodyYaw)
const pl = { x: 0, y: 0, z: 0, eye: 0.85, yaw: Math.PI, slide: true }, old = Object.assign({}, pl, { slide: false });
const shot = (P, x, y, z) => H.segPlayer(G, P, x, y, -20, 0, 0, 1, 40);   // from behind the camera… along +z at height y
const side = (P, y, z) => H.segPlayer(G, P, -20, y, z, 1, 0, 0, 40);     // from the left, along +x
console.log('\nDESLIZAMIENTO: CAJA NUEVA');
check('las piernas por delante: un tiro de lado a 80 cm por delante, a 20 cm del suelo, da en las piernas', (side(pl, 0.2, 0.8) || {}).part === 'legs');
check('con la caja de siempre ahí no hay nadie', side(old, 0.2, 0.8) === null);
check('la cabeza, baja y atrás: a 90 cm de alto y 30 cm por detrás', (side(pl, 0.9, -0.3) || {}).part === 'head');
check('a 1,2 m de alto ya no hay nada (se ha tirado al suelo)', side(pl, 1.2, 0) === null && side(pl, 1.2, -0.3) === null);
check('sin pl.slide: exactamente lo de antes (la caja aplastada)', (shot(old, 0, 0.3, 0) || {}).part === 'legs' && (shot(old, 0, 0.62, 0) || {}).part === 'torso');
check('el giro del cuerpo cuenta: mirando hacia +x, las piernas van hacia +x', (H.segPlayer(G, Object.assign({}, pl, { yaw: -Math.PI / 2 }), 0.8, 0.2, -20, 0, 0, 1, 40) || {}).part === 'legs');
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
