/* PENETRACIÓN (core/pen.js, 09-11-2026): qué atraviesa la bala y con cuánto daño.
   Run: node test/pen.test.js */
'use strict';
const P = require('../core/pen.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };

console.log('\nQUÉ ES CADA CAJA');
check('cajas de madera: finas, sea cual sea su tamaño', P.classify('crate', 1.2) === 'thin');
check('madera de 9 cm y chapa de 8 cm: finas', P.classify('wood', 0.09) === 'thin' && P.classify('metal', 0.08) === 'thin');
check('madera de 85 cm (un mueble macizo) y chapa de 70 cm: no', P.classify('wood', 0.85) === null && P.classify('metal', 0.7) === null);
check('tabique de yeso de 18 cm: medio (solo BALA DURA)', P.classify('plaster', 0.18) === 'medium');
check('hasta 50 cm, del material que sea (yeso, hormigón, madera gruesa, chapa gruesa): medio', P.classify('plaster', 0.4) === 'medium' && P.classify('concrete', 0.46) === 'medium' && P.classify('wood', 0.3) === 'medium' && P.classify('metal', 0.5) === 'medium');
check('la columna de 1 m de ARENA, un muro de 60 cm, tierra, sacos: nunca', P.classify('concrete', 1) === null && P.classify('concrete', 0.6) === null && P.classify('dirt', 0.3) === null && P.classify('sand', 0.2) === null);
check('sin superficie (sacos, límites del mapa): nunca', P.classify(undefined, 0.1) === null && P.classify('', 0.05) === null);

console.log('\nENTRADA Y SALIDA');
const wall = { cx: 0, cy: 1.5, cz: 5, hx: 2, hy: 1.5, hz: 0.09, yaw: 0 };
const s = P.through(wall, 0, 1.5, 0, 0, 0, 1);
check('de frente: entra a 4,91 m y sale a 5,09 m (18 cm dentro)', s && Math.abs(s.t0 - 4.91) < 1e-6 && Math.abs(s.t1 - 5.09) < 1e-6 && Math.abs(s.along - 0.18) < 1e-6, JSON.stringify(s));
const a = 70 * Math.PI / 180, g = P.through(Object.assign({}, wall, { hx: 30 }), 0, 1.5, 0, Math.sin(a), 0, Math.cos(a));
check('rasante (70°): recorre más dentro (0,18 / cos 70° = 0,53 m)', g && Math.abs(g.along - 0.18 / Math.cos(a)) < 1e-6, g && g.along.toFixed(3));
check('una caja girada (yaw): la salida respeta el giro', (() => { const c = { cx: 0, cy: 0.6, cz: 3, hx: 0.6, hy: 0.6, hz: 0.6, yaw: Math.PI / 4 }; const r = P.through(c, 0, 0.6, 0, 0, 0, 1); return r && Math.abs(r.along - 1.2 * Math.SQRT2) < 1e-6; })());
check('si no la cruza: null', P.through(wall, 5, 1.5, 0, 0, 0, 1) === null);

console.log('\nCUÁNTAS Y CON CUÁNTO DAÑO');
let st = P.createState();
check('una caja: sigue con el 75 % del daño', P.pass(st, 'thin', 1.2, false) && st.mul === 0.75);
check('una segunda superficie fina: sigue (56 %)', P.pass(st, 'thin', 0.1, false) && Math.abs(st.mul - 0.5625) < 1e-9);
check('una tercera: no (como mucho 2)', !P.pass(st, 'thin', 0.1, false));
st = P.createState();
check('un tabique sin BALA DURA: se queda', !P.pass(st, 'medium', 0.18, false) && st.mul === 1);
check('con BALA DURA: lo atraviesa; 18 cm dejan el 65 % del daño', P.pass(st, 'medium', 0.18, true) && Math.abs(st.mul - 0.652) < 1e-9, st.mul);
check('cuanto más gruesa, menos daño: 50 cm, el 40 %; nunca menos del 35 %', Math.abs(P.mulMedium(0.5) - 0.396) < 1e-9 && P.mulMedium(0.75) === 0.35 && P.mulMedium(0.1) === 0.7);
check('un segundo tabique, ni con BALA DURA', !P.pass(st, 'medium', 0.18, true));
st = P.createState();
check('una pared cruzada muy rasante (más de 75 cm dentro): se queda', !P.pass(st, 'medium', 0.8, true));
check('hormigón: nunca, ni con BALA DURA', !P.pass(P.createState(), null, 0.1, true));

console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
