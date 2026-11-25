/* ILUMINACIÓN HORNEADA (client/lightmap.js, docs/ILUMINACION-HORNEADA.md) sin navegador: los archivos que carga el juego
   (assets/lightmaps/) son coherentes entre sí y el módulo los lee bien. La comprobación de que coinciden con las mallas
   del juego la hace el navegador: node tools/lightmap/check.js (ninguna malla «no coincide»).   node test/lightmap.test.js */
'use strict';
const fs = require('fs'), path = require('path');
const LM = require('../client/lightmap.js');
let pass = 0, fail = 0;
const check = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? '  ok   ' : '  FAIL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };
const D = path.join(__dirname, '..', 'assets', 'lightmaps');
const ix = JSON.parse(fs.readFileSync(path.join(D, 'pueblo.json'), 'utf8')), bin = fs.readFileSync(path.join(D, 'pueblo_uv2.bin'));
const jpg = fs.readFileSync(path.join(D, 'pueblo_lm.jpg'));
const verts = ix.meshes.reduce((s, m) => s + m.verts, 0);
check('índice: ' + ix.meshes.length + ' mallas, atlas ' + ix.w + '×' + ix.h, ix.meshes.length > 0 && ix.w >= 512 && ix.h >= 512 && (ix.w & (ix.w - 1)) === 0);
check('uv2: 4 bytes por vértice (' + verts + ' vértices)', bin.length === verts * 4, bin.length);
check('uv2: las mallas van seguidas, sin huecos', ix.meshes.every((m, i) => m.off === (i ? ix.meshes[i - 1].off + ix.meshes[i - 1].verts * 4 : 0)));
check('nombres únicos (nombre + vértices)', new Set(ix.meshes.map(m => m.name + '#' + m.verts)).size === ix.meshes.length);
check('solo reciben las mallas generadas del pueblo (p3_ y casas_)', ix.meshes.every(m => /^(p3_|casas_)/.test(m.name)));
check('imagen JPG', jpg[0] === 0xff && jpg[1] === 0xd8, (jpg.length / 1024).toFixed(0) + ' KB');
const ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.length), data = LM.decode(ix, ab);
const all = Object.values(data);
let lo = 1, hi = 0; for (const d of all) for (const v of d.uv2) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
check('decode: todas las mallas', all.length === ix.meshes.length);
check('decode: uv2 dentro del atlas', lo >= 0 && hi <= 1, lo.toFixed(4) + '…' + hi.toFixed(4));
// firma: misma entrada → misma firma; otra posición → no coincide
const pos = new Float32Array([0, 0, 0, 1, 2, 3, 4.5, 0.25, -7]), s = LM.sig(pos);
check('firma determinista', s === LM.sig(Float32Array.from(pos)), s);
const fake = { 'x#3': { sig: s, uv2: new Float32Array(6) } };
check('match: la misma malla coincide', !!LM.match(fake, 'x', pos));
const moved = Float32Array.from(pos); moved[4] += 1;
check('match: una malla cambiada no coincide (se queda sin horneado)', !LM.match(fake, 'x', moved));
check('match: otro nº de vértices no coincide', !LM.match(fake, 'x', pos.subarray(0, 6)));
console.log(`\n${pass} ok, ${fail} fallos`);
process.exit(fail ? 1 : 0);
