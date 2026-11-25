/* GUÍA DE ESTILO (docs/GUIA-DE-ESTILO.md): comprueba colores base, metal y rugosidad contra los márgenes de la guía.
     node tools/estilo-check.js                 → los materiales del pueblo (KIT3D.LOOK), sin y con ?estilo=1
     node tools/estilo-check.js modelo.glb …    → los materiales de un GLB (factores PBR; las texturas no se leen)
   Solo avisa: no cambia nada. Sale con 1 si algo está fuera de la guía (con ?estilo=1 o en un GLB). */
'use strict';
const fs = require('fs'), path = require('path');
const KIT = require('../client/kit3d.js');

// ranges of the guide (§3 albedo, §4 PBR) per kind of material; the kind comes from the name
const KINDS = [
  { re: /stucco|yeso|plaster|estuco|revoco|encal/i, lum: [150, 240], r: [0.85, 0.96], m: 0 },
  { re: /stone|piedra|rubble|concrete|hormig|slabs|setts|asphalt|earth|pebbles|herring|cobble|plaza|side|patch/i, lum: [110, 220], r: [0.7, 0.96], m: 0 },
  { re: /tile|teja|terracotta|barro|brick|ladrillo|roof/i, lum: [100, 200], r: [0.7, 0.9], m: 0 },
  { re: /woodraw/i, lum: [70, 150], r: [0.75, 0.9], m: 0 },
  { re: /wood|madera|frame|marco/i, lum: [50, 240], r: [0.5, 0.9], m: 0 },
  { re: /iron|hierro|reja|metal|paint/i, lum: [25, 240], r: [0.4, 0.7], m: 0 },
  { re: /zinc|galv|chapa_galv/i, lum: [80, 200], r: [0.35, 0.6], m: 1, env: true },
  { re: /glass|vidrio|water|agua/i, lum: [25, 240], r: [0, 0.12], m: 0 },
  { re: /azulejo|ceramic|ceram/i, lum: [60, 240], r: [0.1, 0.4], m: 0 },
  { re: /cloth|tela|toldo/i, lum: [60, 240], r: [0.8, 0.96], m: 0 },
  { re: /leaf|hoja|vegeta|flora/i, lum: [25, 200], r: [0.6, 0.95], m: 0 },
];
const lum = h => { const r = h >> 16 & 255, g = h >> 8 & 255, b = h & 255; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const sat = h => { const r = (h >> 16 & 255) / 255, g = (h >> 8 & 255) / 255, b = (h & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
// one material: { name, col (sRGB hex, or null when a texture gives the colour), r, m, env }
function check(x) {
  const out = [], K = KINDS.find(k => k.re.test(x.name));
  if (x.col != null && x.col !== 0xffffff) {
    const l = lum(x.col);
    if (l < 25) out.push('color base demasiado oscuro (' + l.toFixed(0) + ' < 25)');
    if (l > 240) out.push('color base demasiado claro (' + l.toFixed(0) + ' > 240)');
    if (K && (l < K.lum[0] - 1e-6 || l > K.lum[1] + 1e-6)) out.push('luminancia ' + l.toFixed(0) + ' fuera de ' + K.lum.join('–'));
  }
  const m = x.m || 0;
  if (m > 0.05 && m < 0.95) out.push('metal a medias (' + m + '): 0 o 1');
  if (K) {
    if (x.r < K.r[0] - 1e-6 || x.r > K.r[1] + 1e-6) out.push('rugosidad ' + x.r + ' fuera de ' + K.r.join('–'));
    if (m >= 0.95 && !x.env) out.push('metal sin reflejo del entorno (env): se verá negro');
  }
  return out;
}
function look(styled) {
  const L = JSON.parse(JSON.stringify(KIT.LOOK));
  if (styled && KIT.STYLE) for (const k in KIT.STYLE) Object.assign(L[k], KIT.STYLE[k]);
  return Object.keys(L).map(k => ({ name: k, col: L[k].col, r: L[k].r, m: L[k].m, env: !!L[k].env, emissive: !!L[k].emissive }));
}
function glbMaterials(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('no es un GLB: ' + file);
  const len = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + len).toString('utf8'));
  return (json.materials || []).map((m, i) => {
    const p = m.pbrMetallicRoughness || {}, f = p.baseColorFactor || [1, 1, 1, 1];
    const s = c => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));   // factors are linear
    const col = p.baseColorTexture ? null : (s(f[0]) << 16) | (s(f[1]) << 8) | s(f[2]);
    return { name: m.name || 'material_' + i, col, r: p.roughnessFactor != null ? p.roughnessFactor : 1, m: p.metallicFactor != null ? p.metallicFactor : 1, env: true,
      tex: !!p.metallicRoughnessTexture };
  });
}
let bad = 0;
const report = (title, list, counts) => {
  console.log('\n' + title);
  for (const x of list) {
    const w = x.emissive ? [] : check(x).filter(s => !(x.tex && /rugosidad|metal a medias/.test(s)));
    if (w.length) { console.log('  ' + x.name.padEnd(14) + ' ' + w.join(' · ')); if (counts) bad++; }
  }
  console.log('  ' + list.length + ' materiales');
};
const files = process.argv.slice(2);
if (!files.length) {
  report('KIT3D.LOOK tal cual (sin ?estilo=1): lo que aún no sigue la guía', look(false), false);
  report('KIT3D.LOOK con ?estilo=1', look(true), true);
} else for (const f of files) report(path.basename(f), glbMaterials(f), true);
console.log(bad ? '\n' + bad + ' materiales fuera de la guía' : '\ntodo dentro de la guía');
process.exit(bad ? 1 : 0);
