/* POSPROCESADO POR CALIDAD (client/post.js, docs/POSPROCESADO.md) sin navegador: qué lleva cada calidad. El aspecto y el
   coste se miden con tools/capture-scenes.js (URLX=post=1) y tools/gpu-coste.js.   node test/post.test.js */
'use strict';
const P = require('../client/post.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
check('BAJO: nada (se dibuja como siempre)', P.level('bajo') === null);
check('MEDIO y ALTO tienen nivel', P.level('medio') === 'medio' && P.level('alto') === 'alto');
check('ALTO: SSAO, bloom en dos tamaños y FXAA', P.LEVELS.alto.ssao && P.LEVELS.alto.bloom2 && P.LEVELS.alto.fxaa);
check('MEDIO: sin SSAO, un bloom, MSAA', !P.LEVELS.medio.ssao && !P.LEVELS.medio.bloom2 && P.LEVELS.medio.msaa);
check('bloom solo en lo muy brillante (umbral ≥ 0,85)', P.LEVELS.alto.thr >= 0.85 && P.LEVELS.medio.thr >= 0.85);
check('corrección suave: contraste ≤ 0,25, saturación 0,9–1,1, viñeta ≤ 0,3', ['alto', 'medio'].every(k => P.LEVELS[k].con <= 0.25 && P.LEVELS[k].sat >= 0.9 && P.LEVELS[k].sat <= 1.1 && P.LEVELS[k].vig <= 0.3));
check('calidad desconocida: nada', P.level('ultra') === null && P.level(undefined) === null);
console.log(`\n${pass} ok, ${fail} fallos`);
process.exit(fail ? 1 : 0);
