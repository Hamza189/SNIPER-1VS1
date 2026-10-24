/* SNIPER DUEL — HUD icon pack (original designs, drawn by code).
   One 64×64 grid, glyphs inside 14..50, constant 3.5 stroke with round caps and joins.
   A button icon = circular base + glyph; the state only changes the colours:
     normal  light glyph on a dark translucent base
     pressed inverted (light base, dark glyph): the finger is on it
     active  amber ring and glyph (a toggle that is on)
     alert   red ring (only for alerts: e.g. RELOAD with an empty magazine)
   Weapon silhouettes for the weapon bar are filled shapes on a 120×40 grid.
   Used by tools/hud-icons/make.js (files) and, through client/hudicons.js, by the game. */
'use strict';
const SW = 3.5;
const r1 = v => Math.round(v * 100) / 100;
// arc from angle a0 to a1 (degrees, 0 = right, clockwise on screen) around (cx, cy)
function arc(cx, cy, r, a0, a1) {
  const p = a => [r1(cx + r * Math.cos(a * Math.PI / 180)), r1(cy + r * Math.sin(a * Math.PI / 180))];
  const [x0, y0] = p(a0), [x1, y1] = p(a1), large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 1 : 0;
  return 'M' + x0 + ' ' + y0 + 'A' + r + ' ' + r + ' 0 ' + large + ' ' + sweep + ' ' + x1 + ' ' + y1;
}
// arrowhead (open chevron) at (x, y) pointing along angle a (degrees)
function head(x, y, a, s) {
  s = s || 6; const k = Math.PI / 180, b1 = (a + 145) * k, b2 = (a - 145) * k;
  return 'M' + r1(x + s * Math.cos(b1)) + ' ' + r1(y + s * Math.sin(b1)) + 'L' + r1(x) + ' ' + r1(y) + 'L' + r1(x + s * Math.cos(b2)) + ' ' + r1(y + s * Math.sin(b2));
}
const P = d => '<path d="' + d + '"/>';
const C = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
const DOT = (x, y, r) => '<circle class="f" cx="' + x + '" cy="' + y + '" r="' + r + '"/>';   // filled dot

// glyph markup (stroke = currentColor; class "f" = filled with currentColor)
const BULLET = P('M32 14c4.6 4.2 6 9.2 6 14v16H26V28c0-4.8 1.4-9.8 6-14z') + P('M26 33h12') + P('M23 50h18');
// a figure leaning out, used by the peek icons (drawn for the LEFT side; the right one is mirrored)
const PEEK_A = P('M43 15v34') + C(29, 22, 5.5) + P('M37 37H17') + P(head(17, 37, 180, 8));
const PEEK_B = P('M42 16v32') + P('M30 24H16') + P(head(16, 24, 180, 7)) + P('M30 40H16') + P(head(16, 40, 180, 7));
const PEEK_C = P('M44 15v34') + P('M37 32H19') + P(head(19, 32, 180, 9));
const GLYPHS = {
  fire_main: { action: 'Disparar', g: BULLET },
  fire_left: { action: 'Disparar (botón izquierdo)', g: BULLET + P('M16 22v20'), note: 'misma bala que FUEGO (misma acción) y una barra a la izquierda para distinguir el botón' },
  aim_ads: { action: 'Apuntar con la mira', g: C(32, 32, 12) + P('M32 13v9M32 42v9M13 32h9M42 32h9') + DOT(32, 32, 2.2) },
  reload: { action: 'Recargar', g: P(arc(32, 32, 13, -60, 225)) + P(head(r1(32 + 13 * Math.cos(225 * Math.PI / 180)), r1(32 + 13 * Math.sin(225 * Math.PI / 180)), 225 + 90, 6)) + P('M29 27h6v10h-6z') },
  crouch: { action: 'Agacharse / deslizarse', g: C(30, 17, 4.5) + P('M31 23l3 13') + P('M34 36h9l1 12') + P('M34 36l-7 12h-8') + P('M32 27l10 4') + P('M15 52h34') },
  jump: { action: 'Saltar', g: P('M20 31l12-12 12 12') + P('M20 43l12-12 12 12') + P('M18 51h28') },
  peak_left: { action: 'Asomarse a la izquierda', g: PEEK_A, variants: { a: PEEK_A, b: PEEK_B, c: PEEK_C } },
  peak_right: { action: 'Asomarse a la derecha', mirror: true, g: PEEK_A, variants: { a: PEEK_A, b: PEEK_B, c: PEEK_C } },
  weapon_swap: { action: 'Cambiar de arma', g: P('M18 25h26') + P(head(44, 25, 0, 6)) + P('M46 39H20') + P(head(20, 39, 180, 6)) },
  knife: { action: 'Navaja', g: P('M17 47l8-8') + P('M21 35l8 8') + P('M27 37l18-19c2-2 3-2 3 0-1 7-5 14-14 25z') },
  pause: { action: 'Pausa', g: '<rect x="22" y="20" width="7" height="24" rx="1.5"/><rect x="35" y="20" width="7" height="24" rx="1.5"/>' },
  inspect: { action: 'Inspeccionar el arma', g: P('M13 32c5-9 12-13 19-13s14 4 19 13c-5 9-12 13-19 13s-14-4-19-13z') + C(32, 32, 5.5) + DOT(32, 32, 1.8),
    variants: { a: P('M13 32c5-9 12-13 19-13s14 4 19 13c-5 9-12 13-19 13s-14-4-19-13z') + C(32, 32, 5.5) + DOT(32, 32, 1.8),
                b: C(29, 29, 10) + P('M36.5 36.5L47 47') } },
  hold_breath: { action: 'Aguantar la respiración', g: P('M32 15v14') + P('M32 29l-4 4M32 29l4 4') + P('M27 22c-6 0-10 9-10 18 0 5 3 7 7 6 3-1 4-4 4-8V26') + P('M37 22c6 0 10 9 10 18 0 5-3 7-7 6-3-1-4-4-4-8V26'),
    variants: { a: P('M32 15v14') + P('M32 29l-4 4M32 29l4 4') + P('M27 22c-6 0-10 9-10 18 0 5 3 7 7 6 3-1 4-4 4-8V26') + P('M37 22c6 0 10 9 10 18 0 5-3 7-7 6-3-1-4-4-4-8V26'),
                b: P('M15 25c4-4 8-4 12 0s8 4 12 0') + P('M15 34c4-4 8-4 12 0s8 4 12 0') + P('M44 20v20M50 20v20'), } },
  sprint: { action: 'Esprintar', g: C(39, 17, 4.5) + P('M36 24l-6 11') + P('M35 26l7 4 3-4') + P('M34 26l-7 1-3 4') + P('M30 35l7 5-1 9') + P('M30 35l-5 7h-7') + P('M12 26h8M14 33h6') },
  inventory: { action: 'Inventario', g: P('M27 22v-3a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3') + '<rect x="20" y="22" width="24" height="27" rx="6"/>' + P('M20 31h24') + '<rect x="26" y="36" width="12" height="7" rx="2"/>' }
};
// which icons are toggles, and the states each one has
const TOGGLE = { peak_left: 'en móvil: un toque inclina y otro vuelve (o mantener, según AJUSTES)', peak_right: 'igual que peak_left', aim_ads: 'solo con MIRA en modo PULSAR',
  crouch: 'en móvil: un toque agacha, otro levanta', hold_breath: 'activo mientras se mantiene (aguantando)', sprint: 'activo mientras se esprinta (indicador)', inventory: 'activo con el inventario abierto' };
const ALERT = { reload: 'cargador vacío' };
function states(name) { return ['normal', 'pressed'].concat(TOGGLE[name] ? ['active'] : []).concat(ALERT[name] ? ['alert'] : []); }

// weapon silhouettes for the bar (filled), 120×40
const WEAPONS = {
  rifle: { name: 'HALCÓN R7', d: 'M4 20h8l14 3h15v7H27l-12 4H4z M40 21h32v8H40z M72 23h44v3H72z M44 13h22v5H44z M64 11h8v8h-8z M49 18h4v3h-4z M59 18h4v3h-4z M55 29h8v6h-8z M42 29l-4 8h6l3-8z M64 26l5 6h3l-4-6z' },
  shotgun: { name: 'FURIA 12', d: 'M4 20h8l14 3h15v7H27l-12 4H4z M40 20h24v9H40z M64 20h52v3.5H64z M64 25h40v3H64z M70 24h22v7H70z M42 29l-4 8h6l3-8z M110 18h3v2h-3z' },
  pistol: { name: 'VÍBORA 9', d: 'M30 11h58v9H30z M86 9h2v2h-2z M42 20h30v4H42z M33 20h13l-4 17H30z M46 24h8v2c0 4-6 5-8 2z' },
  knife: { name: 'NAVAJA', d: 'M14 22h28l3-2h6v10h-6l-3-2H14a3 3 0 0 1 0-6z M51 21h20c16 0 30 2 40 5-12 3-24 4-40 4H51z' }
};

const COL = {
  normal: { base: 'rgba(14,13,11,.55)', ring: 'rgba(240,236,228,.6)', glyph: '#f2efe8' },
  pressed: { base: 'rgba(242,239,232,.92)', ring: '#f2efe8', glyph: '#14120f' },
  active: { base: 'rgba(255,176,32,.2)', ring: '#ffb020', glyph: '#ffc247' },
  alert: { base: 'rgba(14,13,11,.55)', ring: '#ff4b3e', glyph: '#f2efe8' }
};
const STYLE = '.g{fill:none;stroke:currentColor;stroke-width:' + SW + ';stroke-linecap:round;stroke-linejoin:round}.g .f{fill:currentColor;stroke:none}';
function glyphOf(name, variant) {
  const G = GLYPHS[name]; let g = variant && G.variants ? G.variants[variant] : G.g;
  if (G.mirror) g = '<g transform="matrix(-1 0 0 1 64 0)">' + g + '</g>';
  return g;
}
// standalone SVG file for one icon state
function iconSVG(name, state, variant) {
  const c = COL[state || 'normal'];
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><style>' + STYLE + '</style>' +
    '<circle cx="32" cy="32" r="30" fill="' + c.base + '" stroke="' + c.ring + '" stroke-width="' + (state === 'active' || state === 'alert' ? 2.5 : 2) + '"/>' +
    '<g class="g" color="' + c.glyph + '">' + glyphOf(name, variant) + '</g></svg>';
}
// glyph only (no base), coloured by currentColor: what the game puts inside its buttons
function glyphSVG(name, variant) {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="' + SW + '" stroke-linecap="round" stroke-linejoin="round">' +
    glyphOf(name, variant).replace(/class="f"/g, 'fill="currentColor" stroke="none"') + '</g></svg>';
}
function weaponSVG(id, color) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"' + (color ? ' width="120" height="40"' : ' aria-hidden="true"') + '><path fill="' + (color || 'currentColor') + '" d="' + WEAPONS[id].d + '"/></svg>';
}
module.exports = { GLYPHS, TOGGLE, ALERT, WEAPONS, COL, states, iconSVG, glyphSVG, weaponSVG };
