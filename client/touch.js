/* SNIPER DUEL — multi-finger touch logic (joystick, look, buttons). Pure: no DOM.
   The page feeds it pointer events (id, x, y, which button was touched) and reads back
   the joystick, the held buttons and the accumulated look movement.

   Rules
   - A finger that lands on a button presses that button (one finger per button).
   - A finger in the left part of the screen (not on a button) becomes the joystick,
     centred where it landed (floating stick). Only one joystick finger at a time.
   - Any other finger, and the finger holding FIRE, turns the camera when it moves. */
(function (root) {
'use strict';
const CFG = { stickZone: 0.42, radius: 56, deadzone: 0.12, sprintAt: 0.95, sprintForward: -0.5, lookGain: 1.35 };

function create(cfg) {
  return { cfg: Object.assign({}, CFG, cfg || {}), stickId: null, ox: 0, oy: 0, jx: 0, jy: 0, sprint: false, knobX: 0, knobY: 0,
    look: new Map(), held: new Map(), dx: 0, dy: 0 };
}
function down(c, p) {
  // p = { id, x, y, button (name or null), W }
  if (p.button) {
    c.held.set(p.id, p.button);
    if (p.button === 'fire' || p.button === 'fire2') c.look.set(p.id, { x: p.x, y: p.y });
    return { press: p.button };
  }
  if (p.x < p.W * c.cfg.stickZone && c.stickId === null) {
    c.stickId = p.id; c.ox = p.x; c.oy = p.y; c.jx = c.jy = 0; c.sprint = false; c.knobX = c.knobY = 0;
    return { stickStart: { x: p.x, y: p.y } };
  }
  c.look.set(p.id, { x: p.x, y: p.y });
  return {};
}
function move(c, p) {
  if (p.id === c.stickId) {
    let dx = p.x - c.ox, dy = p.y - c.oy; const d = Math.hypot(dx, dy), R = c.cfg.radius;
    if (d > R) { dx *= R / d; dy *= R / d; }
    c.knobX = dx; c.knobY = dy;
    const raw = Math.min(1, d / R);
    // dead zone in the middle, then rescale so the edge of the dead zone is 0 and the rim is 1
    const m = raw <= c.cfg.deadzone ? 0 : (raw - c.cfg.deadzone) / (1 - c.cfg.deadzone);
    const nx = d > 0 ? dx / Math.min(d, R) : 0, ny = d > 0 ? dy / Math.min(d, R) : 0;
    c.jx = nx * m; c.jy = ny * m;
    c.sprint = raw >= c.cfg.sprintAt && ny < c.cfg.sprintForward;   // stick pushed to the rim, forward
    return;
  }
  const l = c.look.get(p.id);
  if (l) { c.dx += (p.x - l.x) * c.cfg.lookGain; c.dy += (p.y - l.y) * c.cfg.lookGain; l.x = p.x; l.y = p.y; }
}
function up(c, id) {
  const out = {};
  if (id === c.stickId) { c.stickId = null; c.jx = c.jy = 0; c.sprint = false; c.knobX = c.knobY = 0; out.stickEnd = true; }
  if (c.held.has(id)) { out.release = c.held.get(id); c.held.delete(id); }
  c.look.delete(id);
  return out;
}
function drain(c) { const o = { dx: c.dx, dy: c.dy }; c.dx = 0; c.dy = 0; return o; }
function isHeld(c, name) { for (const v of c.held.values()) if (v === name) return true; return false; }
function reset(c) { c.stickId = null; c.jx = c.jy = 0; c.sprint = false; c.look.clear(); c.held.clear(); c.dx = c.dy = 0; c.knobX = c.knobY = 0; }

const SDTouch = { CFG, create, down, move, up, drain, isHeld, reset };
if (typeof module !== 'undefined' && module.exports) module.exports = SDTouch; else root.SDTouch = SDTouch;
})(typeof window !== 'undefined' ? window : globalThis);
