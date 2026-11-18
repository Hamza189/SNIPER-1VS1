/* LÍNEAS DE TIRO de PUEBLO, medidas sobre el mapa del servidor (core/mapdata.js: los mismos triángulos con los que el
   servidor decide los impactos). Sin navegador. Para la auditoría de PUEBLO 4.0 (docs/PUEBLO-4.md).
   - Puestos de suelo: la cuadrícula de navegación (ojos a 1,62 m; agachado 1,0 m).
   - Puestos altos: ventanas y balcones de la planta alta de las casas habitables (client/casas.js) y la azotea
     alcanzable por la rampa; ventanas de la planta baja.
   Para cada pareja a menos de 80 m: ¿hay línea de tiro de ojos a pecho (1,3 m)? Se cuentan por distancias (corta 5–10,
   media 10–25, larga 25–50, muy larga 50+), y para cada puesto alto: cuántos puestos domina, desde cuántos le pueden
   contestar (contraángulos) y si tiene más de una salida. Un puesto «invencible» = domina mucho y casi nadie le contesta.
   Salida: resumen en consola + JSON (y un mapa de exposición en PNG si se pide y hay Python con Pillow).
   Uso: node tools/lineas-de-tiro.js [salida.json] */
'use strict';
const path = require('path'), fs = require('fs');
const M = require('../core/mapdata.js').maps[process.env.MAPA || 'pueblo4'],   // MAPA=pueblo: el PUEBLO de siempre (17-11-2026)
      G = require('../core/geom.js'), C = require('../client/casas.js');
const ix = G.createMapIndex(M), EYE = 1.62, CHEST = 1.3;
const out = process.argv[2] || path.join(__dirname, '..', '.work', 'lineas-de-tiro.json');
const bands = [[5, 10, 'corta'], [10, 25, 'media'], [25, 50, 'larga'], [50, 200, 'muy larga']];
const band = d => (bands.find(b => d >= b[0] && d < b[1]) || [0, 0, 'menos de 5'])[2];
// ground posts: the server's nav grid
const ground = M.nav.map(([x, z]) => ({ x, z, y: 0, kind: 'suelo' }));
// high posts: upper-floor windows and balconies of the houses (1 m inside the window, or on the balcony), the reachable roof
const high = [];
for (const H of C.HOUSES) {
  const O = C.openings(H);
  for (const f of ['n', 's', 'w', 'e']) for (const o of O[f]) {
    if (o.kind !== 'win2' && o.kind !== 'balcony' && o.kind !== 'win') continue;
    const F = C.faceFrame(H, f), u = (o.u0 + o.u1) / 2, k = o.kind === 'balcony' ? 0.55 : -0.8, y = o.kind === 'win' ? 0 : C.upY(H);
    const p = F.axis === 'x' ? [F.c + u, F.plane + F.out * k] : [F.plane + F.out * k, F.c + u];
    high.push({ x: p[0], z: p[1], y, kind: o.kind === 'win' ? 'ventana baja' : o.kind === 'balcony' ? 'balcón' : 'ventana alta', house: H.id, face: f, doors: H.doors.length, stair: !!H.stair, out: F.N });
  }
}
high.push({ x: -9, z: -31, y: 4.35, kind: 'azotea', house: 'azotea-rampa', doors: 1, stair: true });
const los = (a, b, ea, eb) => G.losClear(ix, a.x, a.y + (ea || EYE), a.z, b.x, b.y + (eb || CHEST), b.z);
// a window post only looks outwards (it is inside the house): the target must be in front of the facade
const facing = (a, b) => !a.out || (b.x - a.x) * a.out[0] + (b.z - a.z) * a.out[2] > 0.5;

const hist = {}; let pairs = 0;
for (let i = 0; i < ground.length; i++) for (let j = i + 1; j < ground.length; j++) {
  const a = ground[i], b = ground[j], d = Math.hypot(a.x - b.x, a.z - b.z); if (d < 5 || d > 80) continue;
  pairs++; if (los(a, b)) { const k = band(d); hist[k] = (hist[k] || 0) + 1; (a.seen = (a.seen || 0) + 1); (b.seen = (b.seen || 0) + 1); }
}
const posts = high.map(h => {
  let dom = 0, ret = 0, far = 0, dmax = 0;
  for (const g of ground) { const d = Math.hypot(g.x - h.x, g.z - h.z); if (d < 5 || d > 80 || !facing(h, g)) continue;
    if (los(h, g)) { dom++; if (d >= 25) far++; dmax = Math.max(dmax, d); }
    if (los(g, h, EYE, (h.y ? 1.3 : 1.3))) ret++; }
  let hi = 0; for (const o of high) if (o !== h && o.house !== h.house && Math.hypot(o.x - h.x, o.z - h.z) > 5 && facing(h, o) && facing(o, h) && los(o, h)) hi++;
  return Object.assign(h, { domina: dom, lejos: far, alcance: Math.round(dmax), contestan: ret, altosQueContestan: hi });
});
const tot = Object.values(hist).reduce((s, v) => s + v, 0);
console.log('PUEBLO — líneas de tiro (mapa del servidor, ojos 1,62 → pecho 1,3)');
console.log('  puestos de suelo:', ground.length, '· parejas a 5–80 m:', pairs, '· con línea de tiro:', tot, '(' + (100 * tot / pairs).toFixed(1) + ' %)');
for (const [, , k] of bands) console.log('   ' + k.padEnd(10), String(hist[k] || 0).padStart(6), (100 * (hist[k] || 0) / tot).toFixed(1).padStart(5) + ' %');
const exp = ground.map(g => g.seen || 0).sort((a, b) => a - b), q = p => exp[Math.floor(p * (exp.length - 1))];
console.log('  exposición de un punto de suelo (cuántos puntos le ven): mediana', q(0.5), '· 10 %', q(0.1), '· 90 %', q(0.9), '· máx', exp[exp.length - 1]);
console.log('\nPuestos altos (domina = puntos de suelo que ve; contestan = puntos de suelo que le ven; altos = otros puestos altos que le ven)');
const byHouse = {};
for (const p of posts) { const k = p.house + ' · ' + p.kind; const b = byHouse[k] || (byHouse[k] = { n: 0, dom: 0, ret: 0, far: 0, hi: 0, alc: 0, doors: p.doors, stair: p.stair }); b.n++; b.dom = Math.max(b.dom, p.domina); b.ret = Math.max(b.ret, p.contestan); b.far = Math.max(b.far, p.lejos); b.hi = Math.max(b.hi, p.altosQueContestan); b.alc = Math.max(b.alc, p.alcance); }
for (const [k, b] of Object.entries(byHouse).sort((a, b) => b[1].dom - a[1].dom)) {
  const ratio = b.ret ? b.dom / b.ret : Infinity, flag = ratio > 1.6 || b.hi === 0 ? '  ← revisar' : '';
  console.log('  ' + k.padEnd(28) + ' ×' + b.n + '  domina ' + String(b.dom).padStart(3) + ' (lejos ' + String(b.far).padStart(3) + ', hasta ' + b.alc + ' m)  contestan ' + String(b.ret).padStart(3) + '  altos ' + b.hi + '  salidas ' + b.doors + flag);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ hist, pairs, ground: ground.map(g => [g.x, g.z, g.seen || 0]), posts }, null, 0));
console.log('\n→ ' + out);
