/* El sonido generado al empezar en C++/WebAssembly (wasm/audio.cpp, client/audiowasm.js) frente a la versión JavaScript
   de audioInit(): la potencia (1 − t)^3,4 como Math.pow, ruido de verdad (entre −1 y 1, media 0, sin repetirse) y la
   reverberación con la misma forma (la misma energía por tramos), y cuánto tarda cada una. Run: node test/audiowasm.test.js */
'use strict';
const AW = require('../client/audiowasm.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
console.log('\nSONIDO GENERADO: C++/WebAssembly frente a JavaScript');
check('el módulo se carga (assets/wasm/audio.wasm)', AW.ready);
let worst = 0; for (let k = 0; k <= 20000; k++) { const b = k / 20000; worst = Math.max(worst, Math.abs(AW.exp.au_pow(b, 3.4) - Math.pow(b, 3.4))); }
check('su potencia es la de Math.pow (error < 1e-6; una muestra de audio se guarda con ~6e-8)', worst < 1e-6, worst.toExponential(1));
const sr = 48000, n = sr * 2, rl = Math.floor(sr * 2.4);
const js = () => { const d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const L = [0, 1].map(() => { const dd = new Float32Array(rl); for (let i = 0; i < rl; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 3.4) * (i < sr * 0.01 ? i / (sr * 0.01) : 1); return dd; }); return { noise: d, l: L[0], r: L[1] }; };
const time = f => { let best = 1e9, out; for (let k = 0; k < 5; k++) { const t = process.hrtime.bigint(); out = f(); best = Math.min(best, Number(process.hrtime.bigint() - t) / 1e6); } return [out, best]; };
const [J, tJ] = time(js), [W, tW] = time(() => { const o = AW.make(n, rl, sr); return { noise: o.noise.slice(), l: o.l.slice(), r: o.r.slice() }; });
let lo = 1, hi = -1, sum = 0; for (const v of W.noise) { lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; }
check('ruido entre −1 y 1, con media 0', lo >= -1 && hi <= 1 && Math.abs(sum / n) < 0.01 && hi > 0.99 && lo < -0.99, 'mín ' + lo.toFixed(3) + ' · máx ' + hi.toFixed(3) + ' · media ' + (sum / n).toFixed(4));
check('los dos canales de la reverberación son distintos', W.l.some((v, i) => v !== W.r[i]));
const rms = (a, i0, i1) => { let s = 0; for (let i = i0; i < i1; i++) s += a[i] * a[i]; return Math.sqrt(s / (i1 - i0)); };
let maxRel = 0; const seg = Math.floor(rl / 12);
for (let k = 0; k < 10; k++) { const a = rms(W.l, k * seg, (k + 1) * seg), b = rms(J.l, k * seg, (k + 1) * seg); maxRel = Math.max(maxRel, Math.abs(a - b) / b); }
check('la reverberación se apaga igual (energía por tramos a ±5 %)', maxRel < 0.05, (maxRel * 100).toFixed(1) + ' %');
check('más rápido que JavaScript', tW < tJ, 'JS ' + tJ.toFixed(1) + ' ms · C++ ' + tW.toFixed(1) + ' ms (×' + (tJ / tW).toFixed(1) + ')');
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
