/* Perfil local (client/profile.js): siempre válido aunque lo guardado esté roto, estadísticas, código de copia.
   Run: node test/profile.test.js */
'use strict';
const P = require('../client/profile.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };

console.log('\nPERFIL LOCAL');
const st = mem(), p = P.load(st);
check('la primera vez crea un perfil con identificador SD-XXXX-XXXX y lo guarda', /^SD-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(p.id) && JSON.parse(st.m[P.KEY]).id === p.id, p.id);
check('los cuatro personajes son tuyos y el elegido es el S.W.A.T.', p.owned.join() === 'swat,fsb,militar,clasico' && p.skin === 'swat');
check('al volver a cargar es el mismo perfil', P.load(st).id === p.id);
const broken = mem(); broken.setItem(P.KEY, '{"id":"<script>","name":"<b>Hamza</b>","skin":"robot","stats":{"kills":-5,"wins":"x","longest":1e9}}');
const b = P.load(broken);
check('lo guardado roto o editado a mano se limpia: id nuevo, nombre sin etiquetas, personaje válido, números sanos', /^SD-/.test(b.id) && b.name === 'bHamza/b' && b.skin === 'swat' && b.stats.kills === 0 && b.stats.wins === 0 && b.stats.longest === 2000, JSON.stringify(b).slice(0, 120));
const bad = mem(); bad.setItem(P.KEY, 'no es json');
check('texto que no es JSON: perfil nuevo', /^SD-/.test(P.load(bad).id));
P.addMatch(p, { win: true, kills: 10, deaths: 4, hs: 3, shots: 20, hits: 12, longest: 187.6, online: true });
P.addMatch(p, { win: false, kills: 2, deaths: 10, hs: 1, shots: 10, hits: 3, longest: 90 });
const s = P.summary(p);
check('dos partidas: victorias, bajas/muertes, precisión, % a la cabeza y tiro más largo', s.matches === 2 && s.wins === 1 && p.stats.online === 1 && p.stats.onlineWins === 1 && s.kd === 0.86 && s.acc === 50 && s.hsPct === 33 && s.longest === 188, JSON.stringify(s));
p.name = 'Hamza'; p.skin = 'fsb';
const code = P.exportCode(p), back = P.importCode(code);
check('código de copia: vuelve el mismo perfil (id, nombre, personaje, estadísticas)', back && back.id === p.id && back.name === 'Hamza' && back.skin === 'fsb' && back.stats.kills === 12, code.slice(0, 24) + '…');
check('un código mal copiado (una letra cambiada) se rechaza', P.importCode(code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11)) === null && P.importCode('hola') === null);
console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
process.exit(fail ? 1 : 0);
