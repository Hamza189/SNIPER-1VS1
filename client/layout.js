/* SNIPER DUEL — on-screen touch button layout (position, size, transparency).
   Pure: no DOM. Positions are the distance in px from the button's CENTRE to the nearest
   screen edges it is anchored to (right/bottom for the action cluster, left/bottom for the
   optional left FIRE), so buttons stay under the thumbs on any phone size. */
(function (root) {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const BUTTONS = {
  fire:    { label: 'FUEGO',  anchor: 'br', dx: 65,  dy: 65,  size: 86 },
  scope:   { label: 'MIRA',   anchor: 'br', dx: 155, dy: 63,  size: 66 },
  crouch:  { label: 'AGACH',  anchor: 'br', dx: 229, dy: 49,  size: 54 },
  jump:    { label: 'SALTO',  anchor: 'br', dx: 64,  dy: 152, size: 56 },
  reload:  { label: 'R',      anchor: 'br', dx: 132, dy: 136, size: 48 },
  breath:  { label: 'AIRE',   anchor: 'br', dx: 200, dy: 124, size: 56 },
  zoom:    { label: '8×',     anchor: 'br', dx: 63,  dy: 219, size: 46 },
  swap:    { label: 'ARMA',   anchor: 'br', dx: 202, dy: 190, size: 48 },
  inspect: { label: 'INSP',   anchor: 'br', dx: 63,  dy: 219, size: 46 },   // same spot as the zoom: INSP hides while aiming, the zoom only shows then
  fire2:   { label: 'FUEGO',  anchor: 'bl', dx: 70,  dy: 232, size: 70 }
};
const SIZE = [36, 140], OPACITY = [0.3, 1];

function defaults() {
  const b = {};
  for (const k in BUTTONS) b[k] = { dx: BUTTONS[k].dx, dy: BUTTONS[k].dy, size: BUTTONS[k].size };
  return { opacity: 0.9, buttons: b };
}
function sanitize(o) {
  const d = defaults();
  if (!o || typeof o !== 'object') return d;
  const op = Number(o.opacity);
  if (isFinite(op)) d.opacity = clamp(op, OPACITY[0], OPACITY[1]);
  if (o.buttons && typeof o.buttons === 'object') for (const k in BUTTONS) {
    const s = o.buttons[k]; if (!s) continue;
    if (k === 'inspect' && s.dx === 262 && s.dy === 124) continue;   // the old default spot (knife only then): take the new one
    for (const f of ['dx', 'dy', 'size']) { const v = Number(s[f]); if (isFinite(v)) d.buttons[k][f] = v; }
    d.buttons[k].size = clamp(d.buttons[k].size, SIZE[0], SIZE[1]);
    d.buttons[k].dx = Math.max(0, d.buttons[k].dx); d.buttons[k].dy = Math.max(0, d.buttons[k].dy);
  }
  return d;
}
// keep a button fully on a W×H screen (4 px margin)
function clampToScreen(b, W, H) {
  const r = b.size / 2 + 4;
  return { dx: clamp(b.dx, r, Math.max(r, W - r)), dy: clamp(b.dy, r, Math.max(r, H - r)), size: b.size };
}
// screen rectangle (left, top, size) of a button for a W×H screen
function rect(name, b, W, H) {
  const c = clampToScreen(b, W, H), anchor = BUTTONS[name].anchor;
  const cx = anchor === 'bl' ? c.dx : W - c.dx, cy = H - c.dy;
  return { left: cx - c.size / 2, top: cy - c.size / 2, size: c.size, cx, cy };
}
// a drag to screen point (x, y) → new dx/dy for that button
function moveTo(name, b, x, y, W, H) {
  const anchor = BUTTONS[name].anchor;
  return clampToScreen({ dx: anchor === 'bl' ? x : W - x, dy: H - y, size: b.size }, W, H);
}
function load(store) { return sanitize(store.get('touchLayout', null)); }
function save(store, L) { store.set('touchLayout', sanitize(L)); }

const SDLayout = { BUTTONS, SIZE, OPACITY, defaults, sanitize, clampToScreen, rect, moveTo, load, save };
if (typeof module !== 'undefined' && module.exports) module.exports = SDLayout; else root.SDLayout = SDLayout;
})(typeof window !== 'undefined' ? window : globalThis);
