/* SNIPER DUEL — objetos de las cajas (docs/INVENTARIO-Y-CAJAS.md). Solo aspecto: nada de aquí cambia daño, cadencia,
   munición, velocidad, retroceso ni zonas de impacto. Las cajas son gratuitas: se ganan jugando, nunca se compran.
   Lo usan el servidor (server/accounts.js: qué existe, su rareza, qué sale de una caja y cuántos puntos da cada partida)
   y la página (cómo se ve cada objeto y qué se explica al jugador). Lo que ya era de todos (los 4 personajes y los
   aspectos de arma) sigue siendo de todos: las cajas solo dan objetos nuevos.
     camo   — camuflaje de tu rifle en 1ª persona   pat: dibujo; c: colores; metal/rough: acabado; glow: brillo animado
     ret    — color del punto central de la mira (mismo tamaño y posición: no ayuda a apuntar)
     titulo — texto bajo tu nombre (perfil y sala online; el servidor lo lee de tu cuenta, no del navegador) */
(function (root) {
'use strict';
// probabilidades de una caja (se enseñan en el juego); nunca sale algo que ya tienes
const RARITY = {
  comun: { name: 'COMÚN', p: 0.55, color: '#b9c2cb', frag: 5 },
  rara: { name: 'RARA', p: 0.30, color: '#4da3ff', frag: 10 },
  epica: { name: 'ÉPICA', p: 0.12, color: '#b56cff', frag: 25 },
  legendaria: { name: 'LEGENDARIA', p: 0.03, color: '#ffb02e', frag: 50 }
};
const ORDER = ['comun', 'rara', 'epica', 'legendaria'];
const SLOTS = { camo: 'CAMUFLAJE', ret: 'PUNTO DE LA MIRA', titulo: 'TÍTULO' };
const ITEMS = [
  { id: 'camo_arena', type: 'camo', r: 'comun', name: 'ARENA', pat: 'liso', c: ['#b49a6c', '#9f875b'] },
  { id: 'camo_oliva', type: 'camo', r: 'comun', name: 'OLIVA', pat: 'liso', c: ['#5e6542', '#4f5537'] },
  { id: 'camo_gris', type: 'camo', r: 'comun', name: 'GRIS PLOMO', pat: 'liso', c: ['#6f7275', '#5d6063'] },
  { id: 'camo_nieve', type: 'camo', r: 'comun', name: 'NIEVE', pat: 'liso', c: ['#d6dade', '#c2c8cd'] },
  { id: 'camo_bosque', type: 'camo', r: 'rara', name: 'BOSQUE', pat: 'manchas', c: ['#545b37', '#2f3322', '#6e5c3b', '#1b1d15'] },
  { id: 'camo_desierto', type: 'camo', r: 'rara', name: 'DESIERTO DIGITAL', pat: 'pixel', c: ['#c4ab7c', '#a68b5c', '#7b6644', '#d9caa3'] },
  { id: 'camo_urbano', type: 'camo', r: 'rara', name: 'URBANO DIGITAL', pat: 'pixel', c: ['#8c8f92', '#5c5f63', '#393b3e', '#b5b8bb'] },
  { id: 'camo_artico', type: 'camo', r: 'rara', name: 'ÁRTICO', pat: 'manchas', c: ['#e3e8ec', '#a9b3bb', '#6e7983', '#f7f9fa'] },
  { id: 'camo_tigre', type: 'camo', r: 'rara', name: 'TIGRE', pat: 'rayas', c: ['#646a40', '#262819', '#86814e'] },
  { id: 'camo_carbono', type: 'camo', r: 'epica', name: 'CARBONO', pat: 'carbono', c: ['#1b1d20', '#4d525a'], metal: 0.35, rough: 0.26 },
  { id: 'camo_cobalto', type: 'camo', r: 'epica', name: 'COBALTO', pat: 'liso', c: ['#2257b8', '#173f88'], metal: 0.85, rough: 0.3 },
  { id: 'camo_carmesi', type: 'camo', r: 'epica', name: 'CARMESÍ', pat: 'manchas', c: ['#8e1621', '#2b0a0d', '#5e1017', '#c4202e'] },
  { id: 'camo_hielo', type: 'camo', r: 'epica', name: 'HIELO', pat: 'cristal', c: ['#8ccaf0', '#4f9fd6', '#eef9ff'], metal: 0.2, rough: 0.14 },
  { id: 'camo_oro', type: 'camo', r: 'legendaria', name: 'ORO', pat: 'liso', c: ['#d8a93a', '#b98b25'], metal: 1, rough: 0.2 },
  { id: 'camo_dragon', type: 'camo', r: 'legendaria', name: 'DRAGÓN', pat: 'escamas', c: ['#6e1007', '#2a0603', '#ff5a1a'], glow: 1, rough: 0.4 },
  { id: 'camo_neon', type: 'camo', r: 'legendaria', name: 'NEÓN', pat: 'circuito', c: ['#0c1116', '#1a2129', '#18e0ff'], glow: 1, metal: 0.4, rough: 0.3 },
  { id: 'ret_verde', type: 'ret', r: 'comun', name: 'VERDE', c: ['#3dff6a'] },
  { id: 'ret_cian', type: 'ret', r: 'comun', name: 'CIAN', c: ['#2ee6ff'] },
  { id: 'ret_amarillo', type: 'ret', r: 'comun', name: 'AMARILLO', c: ['#ffe02e'] },
  { id: 'ret_blanco', type: 'ret', r: 'comun', name: 'BLANCO', c: ['#ffffff'] },
  { id: 'ret_magenta', type: 'ret', r: 'rara', name: 'MAGENTA', c: ['#ff3bd6'] },
  { id: 'ret_naranja', type: 'ret', r: 'rara', name: 'NARANJA', c: ['#ff8a1f'] },
  { id: 'ret_violeta', type: 'ret', r: 'epica', name: 'VIOLETA', c: ['#a35bff'] },
  { id: 'tit_recluta', type: 'titulo', r: 'comun', name: 'RECLUTA' },
  { id: 'tit_tirador', type: 'titulo', r: 'comun', name: 'TIRADOR' },
  { id: 'tit_vigia', type: 'titulo', r: 'comun', name: 'VIGÍA' },
  { id: 'tit_fantasma', type: 'titulo', r: 'rara', name: 'FANTASMA' },
  { id: 'tit_cazador', type: 'titulo', r: 'rara', name: 'CAZADOR' },
  { id: 'tit_halcon', type: 'titulo', r: 'rara', name: 'OJO DE HALCÓN' },
  { id: 'tit_sinpiedad', type: 'titulo', r: 'epica', name: 'SIN PIEDAD' },
  { id: 'tit_undisparo', type: 'titulo', r: 'epica', name: 'UN DISPARO, UNA BAJA' },
  { id: 'tit_leyenda', type: 'titulo', r: 'legendaria', name: 'LEYENDA' },
  { id: 'tit_ultimo', type: 'titulo', r: 'legendaria', name: 'EL ÚLTIMO EN PIE' }
];
const BY = {}; for (const it of ITEMS) BY[it.id] = it;
// puntos de caja: 100 = una caja. Lo de los bots lo cuenta el navegador (el servidor no ve esas partidas): por eso tiene
// tope diario y un minuto entre partidas. Lo online lo cuenta el servidor de la sala al terminar la partida.
const PTS = { box: 100, onlineWin: 100, onlineLoss: 50, onlineDraw: 75, abandonWin: 50, minOnlineMs: 60000, onlineDay: 1000,
  botWin: 25, botLoss: 10, botsDay: 100, botGapMs: 60000, minBotSecs: 45, welcome: 1, daily: 1, maxBoxes: 99 };

const byId = id => BY[id] || null;
// u1, u2 en [0, 1): el servidor los saca de crypto.getRandomValues. owned: { id: true }
// → { item } o, si ya lo tienes todo, { frag } (fragmentos para los objetos que lleguen)
function roll(u1, u2, owned) {
  owned = owned || {};
  let acc = 0, r = ORDER[ORDER.length - 1];
  for (const k of ORDER) { acc += RARITY[k].p; if (u1 < acc) { r = k; break; } }
  // si ya tienes todo lo de esa rareza: la de abajo, y si no queda nada abajo, la de arriba
  const i0 = ORDER.indexOf(r), tries = [];
  for (let i = i0; i >= 0; i--) tries.push(ORDER[i]);
  for (let i = i0 + 1; i < ORDER.length; i++) tries.push(ORDER[i]);
  for (const k of tries) {
    const free = ITEMS.filter(it => it.r === k && !owned[it.id]);
    if (free.length) return { item: free[Math.min(free.length - 1, Math.floor(u2 * free.length))], rolled: r };
  }
  return { frag: RARITY[r].frag, rolled: r };
}
const SDItems = { RARITY, ORDER, SLOTS, ITEMS, PTS, byId, roll };
if (typeof module !== 'undefined' && module.exports) module.exports = SDItems; else root.SDItems = SDItems;
})(typeof window !== 'undefined' ? window : globalThis);
