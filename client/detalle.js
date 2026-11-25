/* SNIPER DUEL — MÁS DETALLE EN LA ESCENA (25-11-2026, docs/DETALLE.md). Bandera: ?detalle=1 (sin ella, nada cambia).
   Lo que hace que una calle parezca vivida, sobre el PUEBLO y el BARRIO, sin tocar ni una caja ni una bala:
     · CALCOMANÍAS (una malla, una llamada por mapa): suciedad al pie de las paredes, manchas de aceite y de humedad,
       grietas, hojas, papeles y colillas en el suelo; churretes bajo las ventanas, carteles, placas de calle, «prohibido
       fijar carteles» y pintadas en las paredes. Planas, pegadas a su superficie.
     · OBJETOS PEQUEÑOS (otra malla, otra llamada): latas, botellas, ladrillos y cascotes TUMBADOS en el suelo, junto a
       las paredes y en los rincones. Ninguno pasa de 12 cm de alto: no tapan a nadie (la regla de PUEBLO 3.0: lo que no
       es caja, a ras de suelo o pegado a la pared).
   Todo sale de una semilla fija (los dos jugadores ven lo mismo) y de las cajas del mapa (dónde hay pared y dónde no),
   así que también vale para mapas nuevos. Las texturas se dibujan aquí, en un lienzo (nada que descargar).
   plan() es puro (Node y navegador); atlas()/mesh()/props() necesitan el navegador y three.js. */
(function (root) {
'use strict';

const N = 4, TILE = 256;                 // atlas 4×4 of 256 px
const T_ = { grime: 0, oil: 1, crack: 2, leaves: 3, paper: 4, butts: 5, streak: 6, damp: 7, poster1: 8, poster2: 9, poster3: 10, plate: 11, stencil: 12, tag: 13, scuff: 14, wet: 15 };
const GROUND = ['grime', 'oil', 'crack', 'leaves', 'paper', 'butts', 'scuff', 'wet'];
const MAX_PROP_H = 0.12;                 // tallest small object (m)

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* plan(opt) → { decals: [{ t, c:[x,y,z], u:[x,y,z], v:[x,y,z], n:[x,y,z], col }], props: [{ k, x, y, z, ry, s }] }
   opt.boxes:  [{ a:[x0,y0,z0], b:[x1,y1,z1] }] the map's collision boxes (what is solid)
   opt.bounds: [x0, z0, x1, z1] where to put things · opt.seed · opt.groundY(x, z) → height of the ground there
   opt.skip(x, z) → true where nothing goes (inside the houses you walk into, the fountain…)
   opt.avoid:  [{ x, y, z, r }] what is on the walls already (windows, doors, signs…): no poster over them
   opt.windows: [{ x, y, z, ry, w }] window sills, for the streaks under them
   opt.posters / opt.tags: which wall decals this map gets · opt.density (1 = default) */
function plan(opt) {
  const R = rng(opt.seed || 20261125), D = opt.density || 1;
  const B = opt.boxes || [], gy = opt.groundY || (() => 0.02), skip = opt.skip || (() => false);
  const [bx0, bz0, bx1, bz1] = opt.bounds || [-50, -50, 50, 50];
  const solid = (x, y, z, m) => { m = m || 0; for (const b of B) if (x > b.a[0] - m && x < b.b[0] + m && z > b.a[2] - m && z < b.b[2] + m && y > b.a[1] - m && y < b.b[1] + m) return true; return false; };
  const inB = (x, z) => x > bx0 && x < bx1 && z > bz0 && z < bz1;
  const decals = [], props = [];
  const flat = (t, x, z, w, h, ry, col) => {           // a ground decal, w × h, turned ry about Y
    const c = Math.cos(ry), s = Math.sin(ry), y = gy(x, z) + 0.012;
    if (solid(x, y + 0.05, z, -0.01)) return;          // under a planter, a bench…: never seen
    decals.push({ t: T_[t], c: [x, y, z], u: [-c * w / 2, 0, s * w / 2], v: [s * h / 2, 0, c * h / 2], n: [0, 1, 0], col: col || 1 });   // u × v = up: faces the sky
  };
  const wall = (t, p, r, n, w, h, col) => {            // a wall decal centred at p, facing n (u = up × n: the viewer's right, text reads)
    if (solid(p[0] + n[0] * 0.07, p[1], p[2] + n[2] * 0.07, -0.01)) return;
    decals.push({ t: T_[t], c: [p[0] + n[0] * 0.02, p[1], p[2] + n[2] * 0.02], u: [n[2] * w / 2, 0, -n[0] * w / 2], v: [0, h / 2, 0], n, col: col || 1 });
  };
  // 1. the faces of every tall box that look onto open ground, in segments of ~3 m
  const faces = [];
  for (const b of B) {
    const h = b.b[1] - b.a[1]; if (h < 2.4 || b.a[1] > 0.5) continue;
    const sides = [
      { o: [b.a[0], b.a[2]], r: [1, 0, 0], n: [0, 0, -1], L: b.b[0] - b.a[0] }, { o: [b.b[0], b.b[2]], r: [-1, 0, 0], n: [0, 0, 1], L: b.b[0] - b.a[0] },
      { o: [b.b[0], b.a[2]], r: [0, 0, 1], n: [1, 0, 0], L: b.b[2] - b.a[2] }, { o: [b.a[0], b.b[2]], r: [0, 0, -1], n: [-1, 0, 0], L: b.b[2] - b.a[2] },
    ];
    for (const S of sides) {
      const k = Math.max(1, Math.round(S.L / 3)), seg = S.L / k;
      for (let i = 0; i < k; i++) {
        const u = (i + 0.5) * seg, x = S.o[0] + S.r[0] * u, z = S.o[1] + S.r[2] * u;
        const ox = x + S.n[0] * 0.7, oz = z + S.n[2] * 0.7;
        if (!inB(ox, oz) || skip(ox, oz) || solid(ox, 1.0, oz, 0.05) || solid(ox, 0.3, oz, 0.05)) continue;
        faces.push({ x, z, r: S.r, n: S.n, seg, top: b.b[1] });
      }
    }
  }
  const avoidAt = (x, y, z, w, h) => (opt.avoid || []).some(a => Math.abs(a.y - y) < h / 2 + a.r && Math.hypot(a.x - x, a.z - z) < w / 2 + a.r);
  for (const F of faces) {
    const along = (R() - 0.5) * F.seg * 0.6;
    const fx = F.x + F.r[0] * along, fz = F.z + F.r[2] * along, ry = Math.atan2(F.r[2], F.r[0]) * -1;
    // grime on the ground along the foot of the wall (dark, soft); sometimes leaves or papers caught in the corner
    if (R() < 0.6 * D) flat('grime', fx + F.n[0] * 0.28, fz + F.n[2] * 0.28, Math.min(F.seg, 1.6 + R() * 1.6), 0.55 + R() * 0.25, ry, 0.8 + R() * 0.2);
    if (R() < 0.25 * D) flat(R() < 0.5 ? 'leaves' : 'paper', fx + F.n[0] * 0.35, fz + F.n[2] * 0.35, 0.7 + R() * 0.5, 0.5 + R() * 0.3, ry + (R() - 0.5) * 0.6);
    if (R() < 0.18 * D) flat('butts', fx + F.n[0] * 0.5, fz + F.n[2] * 0.5, 0.5, 0.5, R() * 6.28);
    // damp rising from the ground on the wall (BARRIO and anything without the town's own dirt shader)
    if (opt.damp && R() < 0.35 * D) wall('damp', [fx, 0.45, fz], F.r, F.n, Math.min(F.seg, 1.4 + R() * 1.4), 0.9 + R() * 0.3, 0.8 + R() * 0.2);
    // posters and plates at eye height, never over what is already on the wall
    const py = 1.55 + R() * 0.5;
    if (opt.posters && F.top > 2.6 && R() < 0.22 * D) {
      const w = 0.62 + R() * 0.25, h = w * 1.35;
      if (!avoidAt(fx, py, fz, w + 0.3, h + 0.2)) { wall(['poster1', 'poster2', 'poster3'][Math.floor(R() * 3)], [fx, py, fz], F.r, F.n, w, h); continue; }
    }
    if (opt.posters && F.top > 3 && R() < 0.06 * D && !avoidAt(fx, 2.7, fz, 0.8, 0.5)) { wall('plate', [fx, 2.7, fz], F.r, F.n, 0.6, 0.3); continue; }
    if (opt.posters && R() < 0.05 * D && !avoidAt(fx, 1.25, fz, 1.1, 0.5)) { wall('stencil', [fx, 1.25, fz], F.r, F.n, 0.9, 0.3, 0.85); continue; }
    if (opt.tags && R() < 0.16 * D && !avoidAt(fx, 1.2, fz, 1.6, 1)) wall('tag', [fx, 1.0 + R() * 0.5, fz], F.r, F.n, 1.5 + R() * 0.7, 0.9 + R() * 0.3,
      [[0.62, 0.05, 0.26], [0.05, 0.27, 0.62], [0.8, 0.42, 0.02], [0.08, 0.45, 0.1], [0.75, 0.75, 0.72], [0.5, 0.05, 0.05]][Math.floor(R() * 6)]);
    // small objects lying by the wall
    const np = R() < 0.55 * D ? 1 + Math.floor(R() * 3) : 0;
    for (let i = 0; i < np; i++) {
      const a = (R() - 0.5) * F.seg * 0.8, d = 0.12 + R() * 0.45, x = F.x + F.r[0] * a + F.n[0] * d, z = F.z + F.r[2] * a + F.n[2] * d;
      if (skip(x, z) || solid(x, 0.05, z, 0.12)) continue;
      const k = R(); props.push({ k: k < 0.35 ? 'can' : k < 0.55 ? 'bottle' : k < 0.8 ? 'brick' : 'chunk', x, y: gy(x, z), z, ry: R() * 6.283, s: 0.85 + R() * 0.3 });
    }
  }
  // 2. streaks under the window sills (rain carries the dust of the sill down the wall)
  for (const w of opt.windows || []) {
    if (R() > 0.45 * D) continue;
    const r = [Math.cos(w.ry), 0, -Math.sin(w.ry)], n = [Math.sin(w.ry), 0, Math.cos(w.ry)], len = 0.7 + R() * 0.6;
    wall('streak', [w.x, w.y - len / 2 - 0.04, w.z], r, n, (w.w || 1) * (0.7 + R() * 0.3), len, 0.7 + R() * 0.3);
  }
  // 3. the open ground: oil and wet patches, cracks, scuffs, papers (not inside anything, not in the skipped places)
  const area = (bx1 - bx0) * (bz1 - bz0), n = Math.round(area / 55 * D);
  for (let i = 0; i < n; i++) {
    const x = bx0 + R() * (bx1 - bx0), z = bz0 + R() * (bz1 - bz0);
    if (skip(x, z) || solid(x, 0.3, z, 0.6)) continue;
    const t = GROUND[Math.floor(R() * GROUND.length)], s = t === 'oil' || t === 'wet' ? 0.9 + R() * 1.3 : t === 'crack' ? 1 + R() * 1.4 : 0.6 + R() * 0.7;
    flat(t, x, z, s, s * (0.6 + R() * 0.5), R() * 6.283, 0.75 + R() * 0.25);
    if (R() < 0.15) { const k = R(); props.push({ k: k < 0.5 ? 'can' : k < 0.75 ? 'chunk' : 'bottle', x: x + (R() - 0.5), y: gy(x, z), z: z + (R() - 0.5), ry: R() * 6.283, s: 0.85 + R() * 0.3 }); }
  }
  return { decals, props, faces: faces.length };
}

// the textures, drawn once on a canvas: one 256 px tile per kind (index = T_)
function atlas(doc, seed) {
  const c = doc.createElement('canvas'); c.width = c.height = N * TILE; const g = c.getContext('2d'); if (!g) return c;
  const R = rng(seed || 7), S = TILE;
  const at = i => [(i % N) * S, Math.floor(i / N) * S];
  const blob = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); };
  const tile = (i, f) => { const [x, y] = at(i); g.save(); g.beginPath(); g.rect(x, y, S, S); g.clip(); g.translate(x, y); f(); g.restore(); };
  // grime: long soft dark band, denser towards the wall side (top of the tile)
  tile(T_.grime, () => { for (let k = 0; k < 80; k++) blob(R() * S, R() * S * 0.6, 20 + R() * 45, 'rgba(38,30,22,A)', 0.13 + R() * 0.14); });
  // oil: a dark irregular stain with a rainbow-less sheen ring
  tile(T_.oil, () => { for (let k = 0; k < 14; k++) blob(S / 2 + (R() - 0.5) * 70, S / 2 + (R() - 0.5) * 70, 30 + R() * 50, 'rgba(14,12,10,A)', 0.25 + R() * 0.2); });
  // cracks: thin branching dark lines
  tile(T_.crack, () => { g.strokeStyle = 'rgba(28,24,20,0.8)'; g.lineCap = 'round';
    const br = (x, y, a, l, w, d) => { if (d > 4 || l < 6) return; const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      br(x2, y2, a + (R() - 0.5) * 0.9, l * 0.8, w * 0.8, d + 1); if (R() < 0.45) br(x2, y2, a + (R() < 0.5 ? 1 : -1) * (0.5 + R() * 0.6), l * 0.55, w * 0.6, d + 1); };
    br(10, S / 2, (R() - 0.5) * 0.4, 50, 3, 0); });
  // leaves: small olive and brown ovals
  tile(T_.leaves, () => { for (let k = 0; k < 60; k++) { g.save(); g.translate(S / 2 + (R() - 0.5) * 200, S / 2 + (R() - 0.5) * 140); g.rotate(R() * 6.28);
    g.fillStyle = ['#6b5a2e', '#7a4a22', '#5d6230', '#8a6a34', '#4e3a20'][Math.floor(R() * 5)]; g.globalAlpha = 0.9; g.beginPath(); g.ellipse(0, 0, 7 + R() * 5, 3 + R() * 2, 0, 0, 6.28); g.fill(); g.restore(); } });
  // paper: a few crumpled sheets and a flattened carton
  tile(T_.paper, () => { for (let k = 0; k < 6; k++) { g.save(); g.translate(40 + R() * 176, 40 + R() * 176); g.rotate(R() * 6.28);
    g.fillStyle = ['#e9e4d6', '#d8d2c2', '#c9b48a', '#efeae0'][Math.floor(R() * 4)]; g.globalAlpha = 0.95; const w = 20 + R() * 30, h = 14 + R() * 22; g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1; for (let j = 0; j < 3; j++) { g.beginPath(); g.moveTo(-w / 2 + R() * w, -h / 2); g.lineTo(-w / 2 + R() * w, h / 2); g.stroke(); } g.restore(); } });
  // butts and bottle caps
  tile(T_.butts, () => { for (let k = 0; k < 30; k++) { g.save(); g.translate(S / 2 + (R() - 0.5) * 180, S / 2 + (R() - 0.5) * 180); g.rotate(R() * 6.28);
    if (R() < 0.7) { g.fillStyle = '#e8e2d4'; g.fillRect(-5, -1.5, 7, 3); g.fillStyle = '#c98a4a'; g.fillRect(2, -1.5, 4, 3); } else { g.fillStyle = ['#b0302a', '#c8c4b8', '#2f6b4a'][Math.floor(R() * 3)]; g.beginPath(); g.arc(0, 0, 3.5, 0, 6.28); g.fill(); }
    g.restore(); } });
  // streak: vertical runs from the top, fading down
  tile(T_.streak, () => { for (let k = 0; k < 18; k++) { const x = 30 + R() * 196, w = 3 + R() * 10, l = 80 + R() * 170, gr = g.createLinearGradient(0, 0, 0, l);
    gr.addColorStop(0, 'rgba(50,40,30,0.38)'); gr.addColorStop(1, 'rgba(50,40,30,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, l); } });
  // damp: a wide dark tide mark from the bottom, wavy edge
  tile(T_.damp, () => { for (let k = 0; k < 40; k++) blob(R() * S, S - R() * S * 0.45, 25 + R() * 40, 'rgba(40,36,30,A)', 0.08 + R() * 0.08); });
  // posters: three kinds, with paper edges and a little tear
  const poster = (i, bg, fg, lines) => tile(i, () => {
    g.fillStyle = bg; g.fillRect(30, 8, 196, 240); g.fillStyle = fg; g.textAlign = 'center';
    lines.forEach((l, j) => { g.font = (l[1] || 700) + ' ' + l[0] + 'px Arial, sans-serif'; g.fillText(l[2], 128, 50 + j * (l[0] + 14)); });
    g.fillStyle = 'rgba(236,226,206,0.28)'; g.fillRect(30, 8, 196, 240);   // sun-faded (the style guide: nothing new and saturated)
    g.fillStyle = 'rgba(255,255,255,0.18)'; for (let k = 0; k < 40; k++) g.fillRect(30 + R() * 196, 8 + R() * 240, 2 + R() * 6, 1 + R() * 3);
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(226, 200); g.lineTo(196 + R() * 20, 248); g.lineTo(226, 248); g.fill(); g.globalCompositeOperation = 'source-over'; });
  poster(T_.poster1, '#c8352c', '#f4efe4', [[34, 900, 'SE'], [34, 900, 'ALQUILA'], [16, 400, 'LOCAL 80 m²'], [22, 700, '6XX 412 907']]);
  poster(T_.poster2, '#e8c64a', '#2a2218', [[22, 700, 'FIESTAS'], [40, 900, 'SAN ROQUE'], [16, 400, '14 · 15 · 16 AGOSTO'], [16, 400, 'VERBENA · ENCIERRO']]);
  poster(T_.poster3, '#efe9dc', '#2d4a6a', [[20, 700, 'CIRCO'], [36, 900, 'MUNDIAL'], [16, 400, 'PLAZA MAYOR'], [16, 700, 'SÓLO 3 DÍAS']]);
  // street plate: blue and white tile with a border
  tile(T_.plate, () => { g.fillStyle = '#f1ede2'; g.fillRect(8, 64, 240, 128); g.strokeStyle = '#2a4f86'; g.lineWidth = 10; g.strokeRect(16, 72, 224, 112);
    g.fillStyle = '#2a4f86'; g.textAlign = 'center'; g.font = '700 26px Georgia, serif'; g.fillText('CALLE DEL', 128, 118); g.font = '900 36px Georgia, serif'; g.fillText('SOL', 128, 162); });
  // stencil on the wall
  tile(T_.stencil, () => { g.fillStyle = 'rgba(30,26,22,0.85)'; g.textAlign = 'center'; g.font = '900 30px Impact, Arial Black, sans-serif'; g.fillText('PROHIBIDO', 128, 112); g.font = '900 22px Impact, Arial Black, sans-serif'; g.fillText('FIJAR CARTELES', 128, 146); });
  // tag: coloured scribbles with an outline
  // tag: thick letters with a black outline and drips, filled WHITE so each wall tints it its own colour (vertex colour)
  tile(T_.tag, () => { g.save(); g.translate(128, 132); g.rotate(-0.12); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.font = 'italic 900 92px Impact, "Arial Black", sans-serif';
    g.lineWidth = 16; g.strokeStyle = '#121212'; g.strokeText('SDX', 0, 0); g.fillStyle = '#ffffff'; g.fillText('SDX', 0, 0);
    g.lineWidth = 5; g.strokeStyle = '#ffffff'; for (let k = 0; k < 6; k++) { const x = -90 + R() * 180, y = 30 + R() * 10; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 18 + R() * 40); g.stroke(); }
    g.font = 'italic 700 26px "Arial Black", sans-serif'; g.fillStyle = '#121212'; g.fillText('R7', 70, -62); g.restore(); });
  // scuffs: tyre-like dark arcs
  tile(T_.scuff, () => { g.strokeStyle = 'rgba(20,18,16,0.35)'; for (let k = 0; k < 5; k++) { g.lineWidth = 6 + R() * 10; g.beginPath(); g.arc(S / 2 + (R() - 0.5) * 60, S + 40, 120 + R() * 60, 3.6, 5.8); g.stroke(); } });
  // wet: a darker, smooth patch
  tile(T_.wet, () => { for (let k = 0; k < 10; k++) blob(S / 2 + (R() - 0.5) * 80, S / 2 + (R() - 0.5) * 60, 40 + R() * 50, 'rgba(30,32,34,A)', 0.18 + R() * 0.1); });
  return c;
}

// one mesh for all decals (positions, normals, uvs into the atlas, a tint for variety)
function mesh(T, decals, tex) {
  const P = [], Nn = [], U = [], C = [], I = [];
  for (const d of decals) {
    const b = P.length / 3, col = d.col || 1, tx = d.t % N, ty = Math.floor(d.t / N), e = 2 / (N * TILE);
    const u0 = tx / N + e, u1 = (tx + 1) / N - e, v0 = 1 - (ty + 1) / N + e, v1 = 1 - ty / N - e;
    const corner = (su, sv) => P.push(d.c[0] + d.u[0] * su + d.v[0] * sv, d.c[1] + d.u[1] * su + d.v[1] * sv, d.c[2] + d.u[2] * su + d.v[2] * sv);
    corner(-1, -1); corner(1, -1); corner(1, 1); corner(-1, 1);
    const cc = Array.isArray(col) ? col : [col, col, col];
    for (let k = 0; k < 4; k++) { Nn.push(d.n[0], d.n[1], d.n[2]); C.push(cc[0], cc[1], cc[2]); }
    U.push(u0, v0, u1, v0, u1, v1, u0, v1);
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(Nn, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(U, 2)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
  g.setIndex(P.length / 3 > 65535 ? new T.Uint32BufferAttribute(I, 1) : new T.Uint16BufferAttribute(I, 1)); g.computeBoundingSphere();
  const m = new T.MeshStandardMaterial({ map: tex, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.92, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  m.userData.cs = 1; m.name = 'detalle_calcas';
  const o = new T.Mesh(g, m); o.name = 'detalle_calcas'; o.receiveShadow = true; o.castShadow = false; o.renderOrder = 1;
  return o;
}

// one mesh for all small objects: cans, bottles, bricks and chunks, lying down (sRGB vertex colours → linear here)
function props(T, list) {
  const P = [], Nn = [], C = [], I = [];
  const lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4), hx = h => [lin((h >> 16 & 255) / 255), lin((h >> 8 & 255) / 255), lin((h & 255) / 255)];
  const M = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), n = new T.Vector3(), N3 = new T.Matrix3();
  const put = (geo, col, p) => {
    e.set(0, p.ry, 0); q.setFromEuler(e); M.compose(v.set(p.x, p.y, p.z), q, new T.Vector3(p.s, p.s, p.s)); N3.getNormalMatrix(M);
    const g = geo.index ? geo.toNonIndexed() : geo, A = g.attributes.position, B = g.attributes.normal, b = P.length / 3, c = hx(col);
    for (let i = 0; i < A.count; i++) { v.fromBufferAttribute(A, i).applyMatrix4(M); P.push(v.x, v.y, v.z); n.fromBufferAttribute(B, i).applyMatrix3(N3).normalize(); Nn.push(n.x, n.y, n.z); C.push(c[0], c[1], c[2]); I.push(b + i); }
  };
  const R = rng(99);
  const can = new T.CylinderGeometry(0.033, 0.033, 0.12, 8).rotateZ(Math.PI / 2).translate(0, 0.033, 0);
  const bottle = new T.CylinderGeometry(0.034, 0.034, 0.2, 8).rotateZ(Math.PI / 2).translate(0, 0.034, 0);
  const neck = new T.CylinderGeometry(0.013, 0.02, 0.08, 6).rotateZ(Math.PI / 2).translate(0.14, 0.034, 0);
  const brick = new T.BoxGeometry(0.22, 0.065, 0.105).translate(0, 0.0325, 0);
  for (const p of list) {
    if (p.k === 'can') put(can, [0xb0302a, 0xc8c4b8, 0x2f6b4a, 0xd8b030, 0x2d5a8a][Math.floor(R() * 5)], p);
    else if (p.k === 'bottle') { const c = [0x2f4a2a, 0x4a3018, 0x33503c][Math.floor(R() * 3)]; put(bottle, c, p); put(neck, c, p); }
    else if (p.k === 'brick') put(brick, [0xa85a3a, 0x9a5236, 0xb8694a][Math.floor(R() * 3)], p);
    else { const ch = new T.DodecahedronGeometry(0.05 + R() * 0.03, 0); ch.scale(1, 0.7, 1); ch.translate(0, 0.035, 0); put(ch, [0x8a8478, 0x9c968a, 0x7a7468][Math.floor(R() * 3)], p); }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(Nn, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
  g.setIndex(P.length / 3 > 65535 ? new T.Uint32BufferAttribute(I, 1) : new T.Uint16BufferAttribute(I, 1)); g.computeBoundingSphere(); g.computeBoundingBox();
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 }); m.userData.cs = 1; m.name = 'detalle_objetos';
  const o = new T.Mesh(g, m); o.name = 'detalle_objetos'; o.receiveShadow = true; o.castShadow = false;
  return o;
}

const SDDetalle = { TILES: T_, MAX_PROP_H, plan, atlas, mesh, props };
if (typeof module !== 'undefined' && module.exports) module.exports = SDDetalle; else root.SDDetalle = SDDetalle;
})(typeof window !== 'undefined' ? window : globalThis);
