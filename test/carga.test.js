/* PANTALLA DE CARGA (client/carga.js, ?carga=2): the bar's arithmetic, without a browser.
   Run: node test/carga.test.js */
'use strict';
const C = require('../client/carga.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

const pieces = [
  { id: 'motor', cat: 'motor', name: 'Motor', min: true },
  { id: 'tex', cat: 'tex', name: 'Texturas' },
  { id: 'kit', cat: 'mapa', name: 'Pueblo' },
  { id: 'op1k', cat: 'pj', name: 'Tu operador 1K', min: true },
  { id: 'pjA', cat: 'pj', name: 'SOLDADO', start: true },
  { id: 'pjB', cat: 'pj', name: 'FSB', start: true, w: 2 },
  { id: 'vm', cat: 'armas', name: 'Armas', min: true },
  { id: 'warm', cat: 'prep', name: 'Preparar', noStall: true },
  { id: 'dl1', cat: 'desc', name: 'S.W.A.T. ligero', mode: 'cache', start: true },
  { id: 'dl2', cat: 'desc', name: 'MILITAR ligero', mode: 'cache', start: true }
];
const P = C.plan(pieces), st = {};
const sum = P.reduce((s, p) => s + p.wt, 0);
check('el reparto de pesos suma lo de todas las categorías presentes', Math.abs(sum - C.CATS.reduce((s, c) => s + c.w, 0)) < 1e-9, sum);
check('una pieza puede pesar más dentro de su categoría', Math.abs(P.find(p => p.id === 'pjB').wt - 2 * P.find(p => p.id === 'pjA').wt) < 1e-9);
check('el orden sigue las categorías: motor, texturas, mapa, personajes, armas, preparar, descargas', P.map(p => p.cat).join() === 'motor,tex,mapa,pj,pj,pj,armas,prep,desc,desc');
check('una categoría sin piezas no cuenta (sin pantalla en blanco por ella)', C.plan([{ id: 'a', cat: 'motor', name: 'x' }]).length === 1 && C.progress(C.plan([{ id: 'a', cat: 'motor', name: 'x' }]), { a: { s: 'ok' } }) === 100);

check('al principio 0 %', C.progress(P, st) === 0);
for (const p of P) C.set(st, p.id, p.start ? 'wait' : 'run', 0, 0);
C.set(st, 'motor', 'ok', 1, 10);
const p1 = C.progress(P, st);
check('el motor listo mueve la barra lo que pesa', p1 === Math.floor(8 / 100 * 100), p1);
C.set(st, 'tex', 'run', 0.5, 20);
const p2 = C.progress(P, st);
check('los bytes que van llegando cuentan (parcial)', p2 > p1, p1 + ' → ' + p2);
C.set(st, 'tex', 'run', 1, 30);
check('una pieza a medias nunca pasa del 95 % de lo suyo', C.progress(P, st) < p1 + 10);
check('la etiqueta dice la categoría, cuántas van y qué carga', C.label(P, st).text === 'TEXTURAS 0/1' && C.label(P, st).item === 'Texturas', JSON.stringify(C.label(P, st)));

// phones: in order and one at a time; a passive piece the game loads by itself makes the next ones wait
check('móvil: nada empieza mientras lo anterior (pasivo) no ha llegado', C.next(P, st, { one: true }).length === 0);
for (const id of ['tex', 'kit', 'op1k']) C.set(st, id, 'ok', 1, 40);
check('móvil: empieza la primera pieza con arranque, solo una', JSON.stringify(C.next(P, st, { one: true })) === '["pjA"]');
C.set(st, 'pjA', 'run', 0, 50);
check('móvil: con una en marcha no empieza otra', C.next(P, st, { one: true }).length === 0);
check('PC: hasta tres en memoria a la vez; las descargas, después de lo de memoria', JSON.stringify(C.next(P, st, { gpu: 3, cache: 2, cacheAfter: true })) === '["pjB"]');
check('PC sin esperar: las descargas pueden ir a la vez', C.next(P, st, { gpu: 3, cache: 2 }).includes('dl1') && C.next(P, st, { gpu: 3, cache: 2 }).includes('dl2'));
check('la etiqueta de personajes cuenta 1/3 y nombra la que está cargando', C.label(P, st).text === 'PERSONAJES 1/3' && C.label(P, st).item === 'SOLDADO', JSON.stringify(C.label(P, st)));

// a failure never blocks; stuck pieces are found
C.set(st, 'pjA', 'fail', 1, 60);
check('una pieza que falla cuenta como hecha (no bloquea)', C.isDone(st.pjA) && JSON.stringify(C.next(P, st, { one: true })) === '["pjB"]');
C.set(st, 'pjB', 'run', 0.3, 70);
check('lo que no se mueve durante el límite se detecta', JSON.stringify(C.stalled(P, st, 70 + 45001, 45000)) === '["pjB"]' && C.stalled(P, st, 70 + 1000, 45000).length === 0);
check('preparar (espera a lo demás a propósito) nunca se da por atascado', !C.stalled(P, st, 1e9, 45000).includes('warm'));
check('lo hecho no vuelve atrás', C.set(st, 'pjA', 'run', 0.1, 80) === false && st.pjA.s === 'fail');
check('un valor igual no cuenta como movimiento', C.set(st, 'pjB', 'run', 0.3, 90) === false && st.pjB.t === 70);

// ENTRAR YA
check('ENTRAR YA: no antes del mínimo', !C.canSkip({ min: false, elapsed: 5000 }));
check('ENTRAR YA: con el mínimo, cuando la espera se nota', C.canSkip({ min: true, elapsed: 3000 }) && !C.canSkip({ min: true, elapsed: 1000 }));
check('ENTRAR YA: tras mucho rato, aunque falte el mínimo', C.canSkip({ min: false, elapsed: 16000 }));
check('ENTRAR YA: no cuando ya ha terminado', !C.canSkip({ done: true, min: true, elapsed: 9000 }));
check('el mínimo: motor, tu operador (1K) y las armas', C.minReady(P, st) === false);
C.set(st, 'vm', 'ok', 1, 100);
check('…con los tres listos, el mínimo está', C.minReady(P, st) === true);

// the end
for (const p of P) C.set(st, p.id, 'ok', 1, 200);
check('memoria lista antes que las descargas', C.gpuDone(P, st));
check('100 % solo con todo hecho', C.progress(P, st) === 100 && C.label(P, st).text === 'LISTO');
const st2 = {}; for (const p of P) C.set(st2, p.id, 'run', 0.9999, 0);
check('casi todo a medias se queda por debajo de 100', C.progress(P, st2) < 100);
check('las categorías marcan hecho / en marcha / pendiente', C.cats(P, st).every(c => c.state === 'done') && C.cats(P, {}).every(c => c.state === 'wait'));
check('megas con coma', C.mb(5 * 1048576) === '5,0 MB' && C.mb(42 * 1048576) === '42 MB');

console.log('\n' + pass + ' correctas, ' + fail + ' fallos');
process.exit(fail ? 1 : 0);
