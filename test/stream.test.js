/* TEXTURAS POR DISTANCIA (client/stream.js, client/packs.js) sin navegador: cuándo se carga la buena y cuándo se suelta,
   y que los paquetes de cada mapa están completos.   node test/stream.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const S0 = require('../client/stream.js'), P = require('../client/packs.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const S = S0.create();
let r = S0.decide(S, { a: 10, b: 200, c: 30 }, 0.5);
check('cerca (< 40 m): a cargar, la más cercana primero', JSON.stringify(r.up) === '["a","c"]', r.up.join(','));
check('lejos: se queda la pequeña', !r.up.includes('b'));
S0.set(S, 'a', 'hi');
r = S0.decide(S, { a: 55 }, 0.5); check('entre 40 y 70 m: la buena se queda (sin ir y venir)', !r.down.length && !r.up.length);
for (let i = 0; i < 39; i++) r = S0.decide(S, { a: 90 }, 0.5);
check('lejos menos de 20 s: todavía no se suelta', !r.down.length);
r = S0.decide(S, { a: 90 }, 0.5); check('lejos 20 s: vuelve a la pequeña', r.down.includes('a'));
S0.set(S, 'c', 'hi'); for (let i = 0; i < 30; i++) r = S0.decide(S, { c: 90 }, 0.5); r = S0.decide(S, { c: 5 }, 0.5);
for (let i = 0; i < 20; i++) r = S0.decide(S, { c: 90 }, 0.5);
check('volver a acercarse pone la cuenta a cero', !r.down.includes('c'));
const S2 = S0.create({ evict: false }); S0.set(S2, 'x', 'hi'); for (let i = 0; i < 100; i++) r = S0.decide(S2, { x: Infinity }, 0.5);
check('sin «soltar»: nunca baja', !r.down.length);
check('distancia a una esfera (0 dentro)', S0.toSphere(0, 0, 0, 10, 0, 0, 4) === 6 && S0.toSphere(1, 0, 0, 0, 0, 0, 3) === 0);
// the packs
const R = path.join(__dirname, '..');
for (const id of ['pueblo', 'barrio']) {
  const L = P.PACKS[id] || [];
  check(id + ': paquete con texturas (' + L.length + ')', L.length > 0);
  const miss = L.filter(e => !fs.existsSync(path.join(R, 'assets/tex/lo', e.k + '.jpg')) || !fs.existsSync(path.join(R, 'assets/tex', e.k + '.jpg')));
  check(id + ': cada una con su versión pequeña y su JPG', miss.length === 0, miss.map(e => e.k).join(' '));
  check(id + ': las pequeñas pesan mucho menos (< 15 %)', L.reduce((s, e) => s + e.lo, 0) < 0.15 * L.reduce((s, e) => s + e.jpg, 0));
  check(id + ': todas tienen KTX2 (para R2)', L.every(e => e.ktx2 > 0));
}
const both = P.PACKS.pueblo.filter(e => P.keys('barrio').has(e.k));
check('ninguna textura en dos paquetes', both.length === 0);
console.log(`\n${pass} ok, ${fail} fallos`);
process.exit(fail ? 1 : 0);
