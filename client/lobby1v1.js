/* SNIPER DUEL — SALA 1V1 (?lobby=2, 10-11-2026, docs/SALA-1V1.md): the waiting room of a private 1 v 1, like the lobbies of
   the big shooters but our own: a dark tactical hangar where your operator stands on the left pad and your rival appears on
   the right one the moment he joins, each with his weapon and the game's idle animation. Owner: «una sala de espera
   MULTIJUGADOR 1V1 … diseño original … negro grafito, paneles translúcidos, blanco y naranja».

   Nothing here decides anything: the room (core/room.js) is the authority for seats, host, map, LISTO and the start. This
   file only turns what the server says into what the screen shows (view, mapCards), frames the two operators in the free
   part of the screen (fitCamera) and builds the hangar (buildHangar, the only part that needs THREE, passed in).

   Hangar space: metres, the pads at x = ∓PAD_X (you on the left, the rival on the right), z = 0, both looking at +z (the
   camera); the hangar door is the back wall at z -13. */
(function (root) {
'use strict';
const PAD_X = 0.95;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* what the screen shows, from the room's last lobby message (players, host, hs) and who I am. Rules are the server's
   (core/room.js); this only says them in words so the page and the tests agree:
   - the host (the one longest in the room) chooses the map and, when the room has hs (his page has the button), starts
   - start: 2 people, both connected and LISTO
   - with hs 0 (a host with the page of before) the match starts by itself when both are LISTO */
function view(N) {
  const P = (N && N.players || []).filter(p => p && !p.bot);
  const me = P.find(p => p.id === N.you) || null, rival = P.find(p => p.id !== N.you) || null;
  const hostId = N && N.host != null ? N.host : (P[0] ? P[0].id : null);
  const isHost = !!me && me.id === hostId, hs = !!(N && N.hs);
  const both = !!me && !!rival && rival.connected !== false && me.connected !== false;
  const allReady = both && me.ready && rival.ready;
  const why = !rival ? 'players' : !both ? 'rival_off' : !allReady ? 'ready' : null;
  let status;
  if (!rival) status = 'ESPERANDO AL RIVAL · INVÍTALO CON EL CÓDIGO';
  else if (rival.connected === false) status = 'TU RIVAL SE HA DESCONECTADO · LE GUARDAMOS LA PLAZA';
  else if (!me.ready && !rival.ready) status = 'PULSAD LISTO LOS DOS';
  else if (!me.ready) status = 'TU RIVAL ESTÁ LISTO · PULSA LISTO';
  else if (!rival.ready) status = 'ESPERANDO A QUE TU RIVAL ESTÉ LISTO';
  else status = hs ? (isHost ? 'TODO LISTO · INICIA LA PARTIDA' : 'TODO LISTO · ESPERANDO AL ANFITRIÓN') : 'TODO LISTO · EMPIEZA YA';
  // after a match (phase over): REVANCHA, both (the server starts it when both have asked)
  const over = !!N && N.phase === 'over', rm = (N && N.rematchOf) || {}, again = !!(me && rm[me.id]);
  if (over) status = !rival ? 'TU RIVAL HA SALIDO · PULSA NUEVO RIVAL PARA ESPERAR A OTRO' : again ? 'ESPERANDO LA REVANCHA DE TU RIVAL' : rm[rival.id] ? 'TU RIVAL QUIERE LA REVANCHA' : 'FIN DE LA PARTIDA · PULSAD REVANCHA LOS DOS';
  return { me, rival, hostId, isHost, hs, count: P.length, canStart: isHost && hs && !why && (N.phase === 'lobby'), why, status, ready: !!(me && me.ready), over, again };
}
/* the map cards: the maps this page offers online (MENÚ 2 › MAPAS: they have a real picture in assets/menu/), only those the
   room's server really has; the room's current map always has its card (a host with another page may have chosen one this
   page does not offer: it is shown, never changed by us). offered: [{id,name,sub}], server: ids, current: id. */
function mapCards(offered, server, current, nameOf) {
  const sv = Array.isArray(server) && server.length ? server : null;
  const L = offered.filter(m => !sv || sv.includes(m.id)).map(m => ({ id: m.id, name: m.name, sub: m.sub || '' }));
  if (current && !L.some(m => m.id === current) && (!sv || sv.includes(current))) L.push({ id: current, name: nameOf ? nameOf(current) : String(current).toUpperCase(), sub: '' });
  return L;
}
/* the camera: both operators (3.3 m wide with their rifles, 2.25 m tall) fill the free part of the screen (rect, CSS px:
   between the panels, above the map strip) and their centre lands in its centre. fov: vertical, degrees.
   Returns {dist, ox, oy} like SDMenu2.stageFrame (ox, oy: how far the camera's picture moves, for setViewOffset). */
function fitCamera(rect, vw, vh, fov) {
  const r = rect && rect.width > 40 && rect.height > 40 ? rect : { left: 0, top: 0, width: vw, height: vh };
  const t = Math.tan(fov * Math.PI / 360);
  const fh = clamp(r.height / vh, 0.3, 1) * 0.9, fw = clamp(r.width / vw, 0.3, 1) * 0.94;
  const dh = 2.25 / (fh * 2 * t), dw = 3.3 / (fw * 2 * t * vw / vh);
  return { dist: Math.max(dh, dw), ox: r.left + r.width / 2 - vw / 2, oy: r.top + r.height / 2 - vh / 2 };
}
// a gentle breathing and weight shift, different for each pad (k = 0 / 1) so the two never move as one
function sway(t, k) {
  const p = k ? 1.7 : 0;
  return { yaw: Math.sin(t * 0.33 + p) * 0.03, lean: Math.sin(t * 0.27 + 1.1 + p) * 0.012, bob: Math.sin(t * 1.5 + p) * 0.004 };
}
// the rival stepping onto his pad (0 → 1 in 0.7 s): rises from the floor and his pad's light flashes
function appear(a) { const e = 1 - Math.pow(1 - clamp(a, 0, 1), 3); return { y: -0.35 * (1 - e), s: 0.92 + 0.08 * e, flash: Math.max(0, 1 - Math.abs(a - 0.45) * 2.2) }; }

function buildHangar(T, opt) {
  opt = opt || {};
  const tex = opt.tex || (() => null), low = !!opt.low;
  const scene = new T.Scene();
  scene.background = new T.Color(0x07080a);
  scene.fog = new T.Fog(0x07080a, 9, 30);
  const add = (geo, mat, x, y, z, ry, par) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.matrixAutoUpdate = false; m.updateMatrix(); (par || scene).add(m); return m; };
  const rep = (t, u, v) => { if (t) t.repeat.set(u, v); return t; };
  const canvas = (w, h, draw) => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (!g) return null;
    draw(g, w, h); const t = new T.CanvasTexture(c); return t;
  };
  // materials: the game's concrete (floor, almost black, a little glossy like a sealed hangar floor) and metal
  const floorMat = new T.MeshStandardMaterial({ color: 0x24262a, roughness: 0.42, metalness: 0.18, map: rep(tex('concrete'), 8, 8), normalMap: low ? null : rep(tex('concrete', true), 8, 8) });
  if (floorMat.normalMap) floorMat.normalScale.set(0.5, 0.5);
  const wallMat = new T.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9, map: rep(tex('concrete'), 6, 2) });
  const steel = new T.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, metalness: 0.6, map: rep(tex('metal'), 1, 4) });
  const doorMat = new T.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.6, metalness: 0.5, map: rep(tex('metal'), 3, 1) });
  const crateMat = new T.MeshStandardMaterial({ color: 0x272a26, roughness: 0.6, metalness: 0.4, map: rep(tex('metal'), 1, 1) });
  const crateDark = new T.MeshStandardMaterial({ color: 0x17181b, roughness: 0.55, metalness: 0.5, map: rep(tex('metal'), 1, 1) });
  const trim = new T.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.4, metalness: 0.7 });
  const lampMat = new T.MeshBasicMaterial({ color: 0xe8f0ff });
  const orange = new T.MeshBasicMaterial({ color: 0xff8a2b });
  const winMat = new T.MeshBasicMaterial({ color: 0x5d7598, fog: true });
  // floor, back wall with the big hangar door, side walls
  add(new T.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), floorMat, 0, 0, -6);
  add(new T.BoxGeometry(30, 10, 0.4), wallMat, 0, 5, -13.2);
  add(new T.BoxGeometry(0.4, 10, 24), wallMat, -10.5, 5, -2);
  add(new T.BoxGeometry(0.4, 10, 24), wallMat, 10.5, 5, -2);
  // the door: a frame and horizontal slats; its upper windows let a cold light in (the only light from outside)
  add(new T.BoxGeometry(11, 0.5, 0.5), steel, 0, 7.4, -12.8);
  for (const x of [-5.5, 5.5]) add(new T.BoxGeometry(0.5, 7.6, 0.5), steel, x, 3.8, -12.8);
  const slat = new T.BoxGeometry(10.6, 0.36, 0.12);
  for (let y = 0.25; y < 5.2; y += 0.42) add(slat, doorMat, 0, y, -12.95);
  const win = new T.PlaneGeometry(1.7, 1.1);
  for (let i = 0; i < 5; i++) add(win, winMat, -4.2 + i * 2.1, 6.1, -12.88);
  // columns and roof trusses (I-beams every 4 m) — the depth of a hangar with a few boxes
  const col = new T.BoxGeometry(0.35, 9, 0.35), beam = new T.BoxGeometry(21, 0.3, 0.3), tie = new T.BoxGeometry(0.12, 0.12, 24);
  for (const z of [-11, -7, -3, 1]) { for (const x of [-9.8, 9.8]) add(col, steel, x, 4.5, z); add(beam, steel, 0, 8.6, z); }
  for (const x of [-6, -2, 2, 6]) add(tie, steel, x, 8.45, -5);
  // ceiling lamps: rows of panels with a soft glow (what lights the hangar from above)
  const glowTex = canvas(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const glowMat = new T.MeshBasicMaterial({ color: 0xbccbe6, map: glowTex, transparent: true, opacity: 0.32, depthWrite: false, blending: T.AdditiveBlending, fog: false });
  const lamps = new T.Group(); scene.add(lamps);
  const panel = new T.BoxGeometry(1.5, 0.06, 0.5), panelGlow = new T.PlaneGeometry(2.6, 1.3).rotateX(Math.PI / 2);
  for (const z of [-10, -6.5, -3, 0.5]) for (const x of [-6, -2, 2, 6]) {
    add(panel, lampMat, x, 7.8, z, 0, lamps); const gl = add(panelGlow, glowMat, x, 7.74, z, 0, lamps); gl.renderOrder = 2;
  }
  // haze under the two lamps over the pads (light through dust)
  const haze = new T.MeshBasicMaterial({ color: 0x7f93b4, transparent: true, opacity: low ? 0.01 : 0.016, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
  for (const x of [-2, 2]) add(new T.CylinderGeometry(0.5, 2.4, 7.8, 20, 1, true), haze, x * 0.7, 3.9, 0.5);
  // crates and gun cases on both sides (mid-ground), a pallet of ammo boxes behind
  const crate = (w, h, d, x, z, y0, ry, mat) => {
    const g = new T.Group(); g.position.set(x, (y0 || 0) + h / 2, z); g.rotation.y = ry || 0; scene.add(g);
    g.add(new T.Mesh(new T.BoxGeometry(w, h, d), mat || crateMat));
    const lid = new T.Mesh(new T.BoxGeometry(w + 0.04, 0.06, d + 0.04), trim); lid.position.y = h / 2 - 0.12; g.add(lid);
    for (const sx of [-1, 1]) { const e = new T.Mesh(new T.BoxGeometry(0.05, h + 0.01, 0.05), trim); e.position.set(sx * (w / 2), 0, d / 2); g.add(e); }
    return g;
  };
  crate(1.6, 1.0, 1.1, -4.6, -3.2, 0, 0.3, crateMat); crate(1.2, 0.7, 0.9, -4.5, -3.3, 1.0, 0.15, crateDark); crate(1.3, 1.1, 1.1, -6.2, -5.8, 0, -0.2, crateDark);
  crate(1.7, 1.0, 1.1, 4.8, -3.6, 0, -0.35, crateDark); crate(1.1, 0.75, 0.9, 4.9, -3.7, 1.0, -0.2, crateMat); crate(2.6, 0.55, 0.7, 6.0, -6.4, 0, 0.1, crateMat);
  crate(2.8, 0.5, 0.65, 0.6, -8.2, 0, 0, crateDark); crate(1.2, 0.9, 1.0, -1.8, -9.5, 0, 0.2, crateMat);
  // two screens on stands at the left (dark blue, a few lines of a map and a list) and one at the right
  const screenTex = canvas(256, 160, (g, w, h) => {
    g.fillStyle = '#081324'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,170,230,.55)'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(14, 26 + i * 20); g.lineTo(14 + 60 + (i * 37) % 90, 26 + i * 20); g.stroke(); }
    g.strokeRect(150, 18, 92, 120); g.fillStyle = 'rgba(255,138,43,.85)'; g.fillRect(186, 66, 10, 10); g.strokeStyle = 'rgba(120,170,230,.35)';
    for (let x = 150; x < 242; x += 18) { g.beginPath(); g.moveTo(x, 18); g.lineTo(x, 138); g.stroke(); }
  });
  const scrMat = new T.MeshBasicMaterial({ color: 0x9fb8dc, map: screenTex });
  const screen = (x, z, ry, s) => { const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const st = new T.Mesh(new T.BoxGeometry(0.08, 1.2 * s, 0.08), trim); st.position.y = 0.6 * s; g.add(st);
    const fr = new T.Mesh(new T.BoxGeometry(1.25 * s, 0.8 * s, 0.06), trim); fr.position.y = 1.55 * s; g.add(fr);
    const sc = new T.Mesh(new T.PlaneGeometry(1.15 * s, 0.7 * s), scrMat); sc.position.set(0, 1.55 * s, 0.035); g.add(sc); };
  screen(-3.4, -1.6, 0.55, 1); screen(-3.9, -2.7, 0.45, 0.9); screen(3.7, -2.2, -0.5, 1);
  // the banner on the left wall: the game's own sign (scope and SNIPER DUEL), in dark cloth
  const bannerTex = canvas(256, 512, (g, w, h) => {
    g.fillStyle = '#16171a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9d2c4'; g.lineWidth = 9; g.beginPath(); g.arc(128, 150, 66, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(128, 50); g.lineTo(128, 110); g.moveTo(128, 190); g.lineTo(128, 250); g.moveTo(28, 150); g.lineTo(88, 150); g.moveTo(168, 150); g.lineTo(228, 150); g.stroke();
    g.fillStyle = '#ff8a2b'; g.beginPath(); g.arc(128, 150, 13, 0, Math.PI * 2); g.fill();
    g.textAlign = 'center'; g.font = 'bold 64px Impact, Arial Narrow, sans-serif'; g.fillStyle = '#d9d2c4'; g.fillText('SNIPER', 128, 340); g.fillStyle = '#ff8a2b'; g.fillText('DUEL', 128, 410);
  });
  const banner = new T.Mesh(new T.PlaneGeometry(2.4, 4.8), new T.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.95, map: bannerTex }));
  banner.position.set(-10.25, 4.6, -6.5); banner.rotation.y = Math.PI / 2; scene.add(banner);
  // an orange LED line low on the back wall and along the floor in front of the door (the only colour, like MENÚ 2)
  add(new T.BoxGeometry(10.6, 0.03, 0.03), orange, 0, 0.06, -12.4);
  add(new T.BoxGeometry(0.03, 0.03, 6), orange, -9.9, 0.06, -6); add(new T.BoxGeometry(0.03, 0.03, 6), orange, 9.9, 0.06, -6);

  // the two pads: a dark steel hexagon with an orange ring of light; an empty pad shows a faint beam (waiting)
  const shadowTex = canvas(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const padGeo = new T.CylinderGeometry(0.78, 0.84, 0.07, 6), ringGeo = new T.RingGeometry(0.8, 0.86, 6).rotateX(-Math.PI / 2);
  const beamGeo = new T.CylinderGeometry(0.62, 0.7, 2.3, 24, 1, true);
  const pads = [-PAD_X, PAD_X].map((x, k) => {
    const g = new T.Group(); g.position.set(x, 0, 0); scene.add(g);
    const base = new T.Mesh(padGeo, steel); base.position.y = 0.035; base.rotation.y = Math.PI / 6; g.add(base);
    const ringMat = new T.MeshBasicMaterial({ color: 0xff8a2b, transparent: true, opacity: 0.9, fog: false });
    const ring = new T.Mesh(ringGeo, ringMat); ring.position.y = 0.075; ring.rotation.y = Math.PI / 6; g.add(ring);
    const beamMat = new T.MeshBasicMaterial({ color: 0xff8a2b, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
    const beam = new T.Mesh(beamGeo, beamMat); beam.position.y = 1.2; beam.visible = false; g.add(beam);
    if (shadowTex) { const sh = new T.Mesh(new T.PlaneGeometry(1.3, 1.0).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); sh.position.y = 0.072; g.add(sh); }
    const stand = new T.Group(); stand.position.y = 0.07; g.add(stand);   // the operator goes here
    const light = new T.PointLight(0xff8a2b, 0.0, 2.6, 1.6); light.position.set(0, 0.25, 0.6); g.add(light);
    return { g, stand, ring, ringMat, beam, beamMat, light, x, k };
  });
  // lights: a warm key from the front on each pad, cold rims from behind, a faint fill and the door's cold glow
  const lights = {};
  lights.hemi = new T.HemisphereLight(0x8d98aa, 0x0c0b0a, 0.16); scene.add(lights.hemi);
  for (const p of pads) {
    const key = new T.SpotLight(0xffefdc, 2.8, 14, 0.36, 0.75, 1.1); key.position.set(p.x * 1.8 - 0.6, 4.6, 4.2); key.target.position.set(p.x, 1.0, 0); scene.add(key, key.target);
    const rim = new T.SpotLight(0xb8cdf2, 3.2, 12, 0.34, 0.6, 1.2); rim.position.set(p.x * 2.6, 3.8, -3.4); rim.target.position.set(p.x, 1.3, 0); scene.add(rim, rim.target);
  }
  lights.fill = new T.DirectionalLight(0xdde4ee, 0.12); lights.fill.position.set(0, 2, 6); scene.add(lights.fill);
  lights.door = new T.PointLight(0x6d86ad, 1.4, 16, 1.5); lights.door.position.set(0, 5, -10.5); scene.add(lights.door);
  // dust in the light
  const N = low ? 120 : 300, pos = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) { const s = [Math.random() * 9 - 4.5, Math.random() * 5, Math.random() * 8 - 6, Math.random() * Math.PI * 2]; seed.push(s); pos.set(s.slice(0, 3), i * 3); }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  const dust = new T.Points(pg, new T.PointsMaterial({ color: 0xc9d4e6, size: 0.014, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending, map: glowTex }));
  dust.frustumCulled = false; scene.add(dust);
  /* every frame: t in s; st = [{on, ready, flash}] for the two pads (on: someone stands there; ready: LISTO) */
  function frame(t, st) {
    const a = pg.attributes.position.array;
    for (let i = 0; i < N; i++) { const s = seed[i]; a[i * 3] = s[0] + Math.sin(t * 0.07 + s[3]) * 0.35; a[i * 3 + 1] = (s[1] + t * 0.025 * (0.5 + (i % 7) / 7)) % 5; a[i * 3 + 2] = s[2] + Math.cos(t * 0.05 + s[3]) * 0.3; }
    pg.attributes.position.needsUpdate = true;
    for (const p of pads) {
      const q = (st && st[p.k]) || {}, pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + p.k);
      // ring: steady and bright when LISTO, breathing when someone is there, faint and pulsing when the pad is empty
      p.ringMat.opacity = q.on ? (q.ready ? 1 : 0.55 + 0.25 * pulse) : 0.18 + 0.3 * pulse;
      p.ringMat.color.setHex(q.on && !q.ready ? 0xffb27a : 0xff8a2b);
      p.beam.visible = !q.on || (q.flash || 0) > 0.01;
      p.beamMat.opacity = q.on ? 0.22 * (q.flash || 0) : 0.035 + 0.03 * pulse;
      p.light.intensity = (q.on && q.ready ? 0.9 : 0.35) + 2.2 * (q.flash || 0);
    }
  }
  // everything this hangar made, for when it is no longer needed (freed while you play)
  function dispose() {
    const seen = new Set();
    scene.traverse(o => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      for (const m of [].concat(o.material || [])) { if (!m || seen.has(m)) continue; seen.add(m); for (const k of ['map', 'normalMap']) if (m[k] && !seen.has(m[k])) { seen.add(m[k]); m[k].dispose(); } m.dispose(); }
    });
  }
  return { scene, pads, lights, lamps, frame, dispose, exposure: 0.85 };
}

const SDLobby = { PAD_X, view, mapCards, fitCamera, sway, appear, buildHangar };
if (typeof module !== 'undefined' && module.exports) module.exports = SDLobby; else root.SDLobby = SDLobby;
})(typeof window !== 'undefined' ? window : globalThis);
