/* SNIPER DUEL — HUD 2 (?hud=2): weapon bar, tactical inventory, layout and key rules.
   Pure: no DOM. The page feeds it the real game state and draws what comes back.
   It never decides anything about the rules: switching weapons still goes through the normal
   'select' command (core/melee.js, the same on the server), and the next-spawn primary is
   still the existing choice. Only what exists in the game is listed (no invented items).

   Layout: the same shape as client/layout.js ({ opacity, buttons: { name: { dx, dy, size } } })
   plus, per element, visibility (vis) and an opacity multiplier (op), the two peek buttons
   and the weapon bar (bar). Stored as 'hudLayout2'; the first time it starts from the player's
   classic layout ('touchLayout'), so buttons they already moved stay where they put them. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const SDLayout = isNode ? require('./layout.js') : root.SDLayout;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ---------------- weapon bar ---------------- */
// the three slots of the loadout; slot 1 is "my primary" (HALCÓN R7 or FURIA 12, fixed for this life)
const SLOTS = [
  { slot: 1, select: 'rifle', key: '1' },
  { slot: 2, select: 'pistol', key: '2' },
  { slot: 3, select: 'knife', key: '3' }
];
const SHORT = { rifle: 'HALCÓN R7', shotgun: 'FURIA 12', pistol: 'VÍBORA 9', knife: 'NAVAJA' };
const slotOfWeapon = w => w === 'pistol' ? 2 : w === 'knife' ? 3 : 1;
const weaponOfSlot = (slot, primary) => slot === 2 ? 'pistol' : slot === 3 ? 'knife' : (primary === 'shotgun' ? 'shotgun' : 'rifle');
// next slot for a "cycle" (wheel / ARMA button): 1 → 2 → 3 → 1 (dir -1 goes back)
function cycle(slot, dir) { return ((slot - 1 + (dir < 0 ? 2 : 1)) % 3) + 1; }

/* s = { primary, nextPrimary, active, pending, phase ('ready'|'holster'|'draw'),
         guns: { rifle|shotgun|pistol: { ammo, mag, state, t, reload, shells } } }
   → [{ slot, weapon, name, key, ammo, mag, reserve, active, pending, state, reloadP, empty, next }] */
function barModel(s) {
  const out = [];
  for (const S of SLOTS) {
    const weapon = weaponOfSlot(S.slot, s.primary), g = s.guns && s.guns[weapon];
    const cur = s.active === weapon, want = (s.pending || s.active) === weapon;
    let state = 'stowed', reloadP = 0;
    if (cur && s.phase === 'draw') state = 'draw';
    else if (cur && s.phase === 'holster') state = 'holster';
    else if (g && g.state === 'reload') {
      state = 'reload';
      reloadP = g.shells ? clamp(g.ammo / g.mag, 0, 1) : clamp(g.t / (g.reload || 1), 0, 1);
    } else if (cur && g && g.ammo <= 0) state = 'empty';
    else if (cur && g && g.state === 'bolt') state = 'cycle';
    else if (cur) state = 'ready';
    const o = { slot: S.slot, weapon, name: SHORT[weapon], key: S.key, ammo: g ? g.ammo : null, mag: g ? g.mag : null,
      reserve: g ? '∞' : null, active: cur, pending: want && !cur || (cur && s.phase === 'draw'), state, reloadP, empty: !!g && g.ammo <= 0, next: null };
    if (S.slot === 1 && s.nextPrimary && s.nextPrimary !== s.primary) o.next = SHORT[s.nextPrimary];
    out.push(o);
  }
  return out;
}
// one short string that changes only when something visible changes (the page redraws only then)
function slotKey(o) { return [o.weapon, o.ammo, o.mag, o.active ? 1 : 0, o.pending ? 1 : 0, o.state, Math.round(o.reloadP * 20), o.next || ''].join('|'); }

/* ---------------- tactical inventory ----------------
   Categories are fixed; only real things go in them. A future item (a grenade, a medkit…) would be a
   new entry with its own rules on the server first; nothing here creates gameplay. */
const CATEGORIES = ['armamento', 'municion', 'estado'];
const STATE_TXT = { ready: 'LISTA', cycle: 'CERROJO', reload: 'RECARGANDO', empty: 'SIN BALAS', draw: 'SACANDO', holster: 'GUARDANDO', stowed: 'GUARDADA' };
/* s = barModel input + { hp, breath (0..1 or null), draw: { rifle, shotgun, pistol, knife } (s) } */
function inventoryModel(s) {
  const bar = barModel(s);
  const weapons = bar.map(o => ({ slot: o.slot, key: o.key, weapon: o.weapon, name: o.name, active: o.active, pending: o.pending,
    ammo: o.ammo === null ? 'SIN MUNICIÓN' : o.ammo + ' / ' + o.mag, reserve: o.reserve === null ? '' : 'RESERVA ' + o.reserve,
    state: STATE_TXT[o.state] + (o.state === 'reload' ? ' ' + Math.round(o.reloadP * 100) + '%' : ''),
    draw: s.draw && s.draw[o.weapon] != null ? s.draw[o.weapon] : null }));
  const pend = s.pending && s.pending !== s.active ? SHORT[s.pending] : null;
  return {
    categories: CATEGORIES,
    weapons,
    primaryNow: SHORT[s.primary === 'shotgun' ? 'shotgun' : 'rifle'],
    primaryNext: SHORT[s.nextPrimary === 'shotgun' ? 'shotgun' : 'rifle'],
    nextDiffers: !!s.nextPrimary && s.nextPrimary !== s.primary,
    pending: pend,
    hp: s.hp == null ? null : Math.max(0, Math.round(s.hp)),
    breath: s.breath == null ? null : Math.round(clamp(s.breath, 0, 1) * 100),
    rules: [
      'La otra arma principal solo se puede elegir para el próximo respawn.',
      'Munición de reserva ilimitada: solo cuenta el cargador.',
      'Cambiar de arma = guardar la actual y sacar la otra; nunca dispara antes.',
      'Si guardas un arma a media recarga, la recarga se pausa y sigue al volver.',
      'La navaja no usa munición.'
    ]
  };
}

/* ---------------- layout ---------------- */
const BUTTONS = Object.assign({}, SDLayout.BUTTONS, {
  peekL: { label: 'ASOMAR IZQ.', anchor: 'bl', dx: 50, dy: 168, size: 50 },
  peekR: { label: 'ASOMAR DER.', anchor: 'bl', dx: 112, dy: 168, size: 50 }
});
const ICONS = { fire: 'fire_main', fire2: 'fire_left', scope: 'aim_ads', crouch: 'crouch', jump: 'jump', reload: 'reload', breath: 'hold_breath',
  swap: 'weapon_swap', inspect: 'inspect', pause: 'pause', peekL: 'peak_left', peekR: 'peak_right' };   // zoom keeps its text (4× / 8×)
const BAR = { label: 'BARRA DE ARMAS', scale: [0.6, 1.6], op: [0.2, 1] };
const OP_MUL = [0.2, 1];
const VERSION = 1;
function barDefaults(touch) { return { dx: touch ? -60 : 0, dy: touch ? 10 : 14, scale: 1, compact: !!touch, visible: true, op: 1 }; }
function defaults(touch) {
  const b = {}, vis = {}, op = {};
  for (const k in BUTTONS) { b[k] = { dx: BUTTONS[k].dx, dy: BUTTONS[k].dy, size: BUTTONS[k].size }; vis[k] = true; op[k] = 1; }
  return { v: VERSION, opacity: 0.9, buttons: b, vis, op, bar: barDefaults(touch) };
}
function sanitize(o, touch) {
  const d = defaults(touch);
  if (!o || typeof o !== 'object') return d;
  // positions/sizes/global opacity: the classic rules (clamped sizes, never off the anchored edges)
  const base = SDLayout.sanitize({ opacity: o.opacity, buttons: o.buttons });
  d.opacity = base.opacity;
  for (const k in BUTTONS) {
    if (base.buttons[k]) d.buttons[k] = base.buttons[k];
    else if (o.buttons && o.buttons[k]) {   // the HUD 2 buttons (not in the classic layout)
      const s = o.buttons[k];
      for (const f of ['dx', 'dy', 'size']) { const v = Number(s[f]); if (isFinite(v)) d.buttons[k][f] = v; }
      d.buttons[k].size = clamp(d.buttons[k].size, SDLayout.SIZE[0], SDLayout.SIZE[1]);
      d.buttons[k].dx = Math.max(0, d.buttons[k].dx); d.buttons[k].dy = Math.max(0, d.buttons[k].dy);
    }
    if (o.vis && typeof o.vis[k] === 'boolean') d.vis[k] = o.vis[k];
    if (o.op && isFinite(Number(o.op[k]))) d.op[k] = clamp(Number(o.op[k]), OP_MUL[0], OP_MUL[1]);
  }
  d.vis.pause = true;   // PAUSA can never be hidden (it is the way out)
  if (o.bar && typeof o.bar === 'object') {
    const B = o.bar;
    for (const f of ['dx', 'dy']) { const v = Number(B[f]); if (isFinite(v)) d.bar[f] = v; }
    d.bar.dy = Math.max(0, d.bar.dy);
    if (isFinite(Number(B.scale))) d.bar.scale = clamp(Number(B.scale), BAR.scale[0], BAR.scale[1]);
    if (isFinite(Number(B.op))) d.bar.op = clamp(Number(B.op), BAR.op[0], BAR.op[1]);
    if (typeof B.compact === 'boolean') d.bar.compact = B.compact;
    if (typeof B.visible === 'boolean') d.bar.visible = B.visible;
  }
  d.v = VERSION;
  return d;
}
// first time: the classic layout (the buttons the player already moved) + HUD 2 defaults for the rest
function load(store, touch) {
  const saved = store.get('hudLayout2', null);
  if (saved && typeof saved === 'object') return sanitize(saved, touch);
  const classic = store.get('touchLayout', null);
  return sanitize(classic ? { opacity: classic.opacity, buttons: classic.buttons } : null, touch);
}
function save(store, L, touch) { store.set('hudLayout2', sanitize(L, touch)); }

// the classic geometry helpers, extended to the HUD 2 buttons
function anchorOf(name) { return (BUTTONS[name] || {}).anchor || 'br'; }
function clampToScreen(b, W, H) { return SDLayout.clampToScreen(b, W, H); }
function rect(name, b, W, H) {
  const c = clampToScreen(b, W, H), cx = anchorOf(name) === 'bl' ? c.dx : W - c.dx, cy = H - c.dy;
  return { left: cx - c.size / 2, top: cy - c.size / 2, size: c.size, cx, cy };
}
function moveTo(name, b, x, y, W, H) { return clampToScreen({ dx: anchorOf(name) === 'bl' ? x : W - x, dy: H - y, size: b.size }, W, H); }
/* weapon bar rectangle: anchored to the bottom centre (dx from the centre, dy from the bottom), w×h at scale 1.
   obstacles = button rectangles; if the bar would cover one, it shrinks (never below 0.7 of its scale),
   then slides sideways, so the default bar never sits on a button on a small phone. */
function barRect(bar, W, H, w, h, obstacles) {
  const hit = r => (obstacles || []).some(o => r.left < o.left + o.size && r.left + r.w > o.left && r.top < o.top + o.size && r.top + r.h > o.top);
  const make = (sc, dx) => {
    const ww = w * sc, hh = h * sc;
    const left = clamp(W / 2 + dx - ww / 2, 4, Math.max(4, W - ww - 4)), top = clamp(H - bar.dy - hh, 4, Math.max(4, H - hh - 4));
    return { left, top, w: ww, h: hh, scale: sc };
  };
  let r = make(bar.scale, bar.dx);
  if (!hit(r)) return r;
  for (let k = 0.95; k >= 0.7 - 1e-9; k -= 0.05) { r = make(bar.scale * k, bar.dx); if (!hit(r)) return r; }
  for (let s = 10; s <= 200; s += 10) { const t = make(bar.scale * 0.7, bar.dx - s); if (!hit(t)) return t; }
  r.overlap = true; return r;
}
// a drag of the bar's centre to (x, y)
function barMoveTo(bar, x, y, W, H, h) { return { dx: Math.round(x - W / 2), dy: Math.max(0, Math.round(H - y - (h * bar.scale) / 2)) }; }

/* ---------------- keys (PC) ----------------
   Peek keys are configurable; keys the game already uses cannot be taken. */
const RESERVED = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'ControlLeft', 'ControlRight',
  'ShiftLeft', 'ShiftRight', 'KeyR', 'KeyF', 'KeyP', 'KeyI', 'Tab', 'Escape', 'Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight'];
function keyAllowed(code) { return typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Backquote|Minus|Equal|BracketLeft|BracketRight|Semicolon|Quote|Backslash|Comma|Period|Slash|IntlBackslash|CapsLock)$/.test(code) && !RESERVED.includes(code); }
function keyLabel(code) {
  if (typeof code !== 'string') return '?';
  const m = /^Key([A-Z])$/.exec(code) || /^Digit([0-9])$/.exec(code); if (m) return m[1];
  const n = /^Numpad([0-9])$/.exec(code); if (n) return 'NUM ' + n[1];
  return ({ Backquote: 'º', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: 'Ñ', Quote: '´', Backslash: 'Ç', Comma: ',', Period: '.', Slash: '-', IntlBackslash: '<', CapsLock: 'BLOQ MAYÚS' })[code] || code;
}
/* lean target from the inputs: keys held (hold mode) or toggled, plus the touch buttons; −1 left … 1 right */
function leanTarget(i) {
  const l = !!(i.keyL || i.touchL), r = !!(i.keyR || i.touchR);
  return (r ? 1 : 0) - (l ? 1 : 0);
}

const SDHud2 = { SLOTS, SHORT, slotOfWeapon, weaponOfSlot, cycle, barModel, slotKey, CATEGORIES, inventoryModel,
  BUTTONS, ICONS, BAR, VERSION, SIZE: SDLayout.SIZE, OPACITY: SDLayout.OPACITY, defaults, sanitize, load, save, clampToScreen, rect, moveTo, barRect, barMoveTo,
  RESERVED, keyAllowed, keyLabel, leanTarget };
if (isNode) module.exports = SDHud2; else root.SDHud2 = SDHud2;
})(typeof window !== 'undefined' ? window : globalThis);
