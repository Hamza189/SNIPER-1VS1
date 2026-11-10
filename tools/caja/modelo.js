/* ATLAS DROP — la caja de CAJAS Y OBJETOS (10-11-2026). Diseño original encargado por Hamza (entrega CAJA_ATLAS_DROP,
   hecha por código: docs/img/caja/original_*.png); esta es la versión del juego, hecha por Claude a partir de ella:
   - fuera lo de dentro (el cristal violeta, sus collarines, el anillo y el cono de luz, y su animación Premio_flotando):
     el premio de verdad lo enseña la tarjeta del juego;
   - el interior ya no es un hueco gris: forro oscuro en las cuatro paredes y una placa de luz en el fondo
     (material «Luz_rareza», el juego le pone el color de la rareza al abrir), igual que las tiras de dentro y los
     difusores de la tapa;
   - cantos con dos segmentos de bisel (antes uno): los brillos de los bordes se ven redondeados, no en escalón.
   Metros, Y arriba, origen en el centro de la base. Lo exporta tools/caja/exportar.js → assets/caja/atlas_drop.glb.
   Se ejecuta en el navegador con THREE (r128) cargado; deja el resultado en window.ASSET. */
(function () {
const T = THREE;
const root = new T.Group(); root.name = 'ATLAS_DROP';
const mat = (name, color, metalness, roughness, emission, ei) => new T.MeshStandardMaterial({ name, color, metalness, roughness, emissive: emission || 0, emissiveIntensity: ei || 1.4 });
const graphite = mat('Ceramica_grafito', 0x17242d, .65, .32), armor = mat('Titanio_azulado', 0x425b69, .8, .3),
  dark = mat('Goma_y_juntas', 0x080f14, .05, .8), silver = mat('Aluminio', 0xa9c1cc, .9, .24),
  orange = mat('Cobre_seguridad', 0xf88d32, .5, .32), cyan = mat('Luz_ionica', 0x62e9ff, .2, .2, 0x16b9e6),
  lining = mat('Forro_interior', 0x0d161c, .1, .9),
  rare = mat('Luz_rareza', 0x8fdfff, .1, .4, 0x2a9fd0, 1.0);   // the game tints it with the rarity's colour
const body = new T.Group(); body.name = 'Chasis'; root.add(body);
function box(parent, name, w, h, d, x, y, z, material, bevel = .025) {
  let g;
  if (bevel) {
    const shape = new T.Shape(); const a = w / 2, b = h / 2, c = Math.min(bevel, w / 5, h / 5);
    shape.moveTo(-a + c, -b); shape.lineTo(a - c, -b); shape.lineTo(a, -b + c); shape.lineTo(a, b - c); shape.lineTo(a - c, b); shape.lineTo(-a + c, b); shape.lineTo(-a, b - c); shape.lineTo(-a, -b + c); shape.closePath();
    const segs = bevel >= .02 ? 2 : 1;   // the big edges get two bevel steps (softer highlight)
    g = new T.ExtrudeGeometry(shape, { depth: d - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: c / 2, bevelSegments: segs, steps: 1, curveSegments: 1 }); g.translate(0, 0, -d / 2 + c);
  } else g = new T.BoxGeometry(w, h, d);
  const m = new T.Mesh(g, material); m.name = name; m.position.set(x, y, z); parent.add(m); return m;
}
function cylinder(parent, name, r, h, x, y, z, material, segments = 12) { const m = new T.Mesh(new T.CylinderGeometry(r, r, h, segments), material); m.name = name; m.position.set(x, y, z); parent.add(m); return m; }
box(body, 'Fondo', 1.6, .14, 1.12, 0, .16, 0, graphite);
box(body, 'Interior_negro', 1.35, .04, .87, 0, .25, 0, dark, .01);
// inside: dark lining on the four walls and a light plate on the floor (rarity colour when it opens)
box(body, 'Placa_luz', 1.18, .012, .7, 0, .276, 0, rare, 0);
for (const s of [-1, 1]) {
  box(body, 'Forro_frontal_' + s, 1.34, .6, .02, 0, .58, s * .432, lining, 0);
  box(body, 'Forro_lateral_' + s, .02, .6, .85, s * .668, .58, 0, lining, 0);
}
for (const s of [-1, 1]) {
  box(body, 'Pared_frontal_' + s, 1.6, .69, .12, 0, .565, s * .5, graphite);
  box(body, 'Pared_lateral_' + s, .12, .69, .93, s * .74, .565, 0, graphite);
  box(body, 'Marco_lateral_' + s, .05, .08, 1.04, s * .82, .92, 0, silver, .012);
  box(body, 'Canto_frontal_' + s, 1.57, .07, .05, 0, .92, s * .575, silver, .012);
  box(body, 'Panel_blindado_' + s, 1.24, .39, .045, 0, .56, s * .58, armor, .035);
  box(body, 'Luz_horizontal_' + s, 1.16, .024, .025, 0, .785, s * .609, cyan, .004);
  box(body, 'Zocalo_cobre_' + s, 1.27, .034, .04, 0, .275, s * .601, orange, .006);
  for (const t of [-1, 1]) {
    box(body, 'Protector_esquina_' + s + '_' + t, .19, .83, .2, s * .73, .51, t * .48, armor, .03);
    box(body, 'Pata_' + s + '_' + t, .28, .13, .3, s * .68, .065, t * .43, dark, .025);
    box(body, 'Linea_esquina_' + s + '_' + t, .03, .46, .025, s * .735, .54, t * .595, orange, .004);
    cylinder(body, 'Tornillo_' + s + '_' + t, .025, .018, s * .59, .86, t * .54, silver, 8);
  }
  box(body, 'Panel_costado_' + s, .045, .4, .68, s * .827, .55, 0, dark, .02);
  for (let i = 0; i < 5; i++) box(body, 'Aleta_' + s + '_' + i, .035, .22, .036, s * .856, .55, -.24 + i * .12, armor, .005);
  box(body, 'Asa_soporte_' + s, .065, .08, .51, s * .86, .78, 0, armor, .01);
  box(body, 'Asa_' + s, .065, .07, .36, s * .94, .75, 0, silver, .01);
  box(body, 'Luz_interior_' + s, .025, .035, .75, s * .63, .29, 0, rare, .004);
}
// emblem: hexagonal reticle on a central plate
const badge = cylinder(body, 'Sello_reticula', .142, .035, 0, .57, .624, orange, 6); badge.rotation.x = Math.PI / 2;
const disk = cylinder(body, 'Sello_fondo', .112, .043, 0, .57, .628, dark, 6); disk.rotation.x = Math.PI / 2;
const ring = new T.Mesh(new T.TorusGeometry(.067, .009, 5, 24), cyan); ring.position.set(0, .57, .657); body.add(ring);
box(body, 'Reticula_vertical', .012, .19, .012, 0, .57, .664, silver, 0);
box(body, 'Reticula_horizontal', .19, .012, .012, 0, .57, .664, silver, 0);
function label(text, w, h) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const cx = c.getContext('2d');
  cx.fillStyle = '#16232b'; cx.fillRect(0, 0, 1024, 128); cx.fillStyle = '#d1e8ee'; cx.font = 'bold 64px Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 512, 68);
  const texture = new T.CanvasTexture(c); texture.encoding = T.sRGBEncoding;
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ name: 'Marca_original', map: texture, roughness: .6, metalness: .2 }));
}
const brand = label('SNIPER DUEL', .69, .087); brand.position.set(0, .84, .615); body.add(brand);
const serial = label('ATLAS  /  DROP - 01', .47, .058); serial.position.set(.39, .40, .613); body.add(serial);
const lid = new T.Group(); lid.name = 'Tapa_bisagra'; lid.position.set(0, .96, -.54); root.add(lid);
box(lid, 'Tapa', 1.69, .16, 1.17, 0, .045, .54, graphite, .035);
box(lid, 'Armadura_tapa', 1.42, .065, .91, 0, .153, .54, armor, .04);
box(lid, 'Interior_tapa', 1.38, .026, .85, 0, -.05, .54, dark, .014);
for (const s of [-1, 1]) {
  box(lid, 'Banda_tapa_' + s, .13, .042, 1.04, s * .51, .195, .54, orange, .014);
  box(lid, 'Luz_tapa_' + s, .026, .023, .75, s * .65, .2, .54, cyan, .004);
  box(lid, 'Difusor_interior_' + s, .04, .018, .7, s * .55, -.073, .54, rare, .004);
  const hinge = cylinder(body, 'Bisagra_' + s, .07, .24, s * .5, .95, -.56, silver); hinge.rotation.z = Math.PI / 2;
}
cylinder(lid, 'Hexagono_tapa', .205, .027, 0, .205, .54, dark, 6);
const topRing = new T.Mesh(new T.TorusGeometry(.116, .014, 6, 32), cyan); topRing.rotation.x = -Math.PI / 2; topRing.position.set(0, .23, .54); lid.add(topRing);
box(lid, 'Mira_tapa_X', .32, .02, .018, 0, .233, .54, silver, 0); box(lid, 'Mira_tapa_Z', .018, .02, .32, 0, .233, .54, silver, 0);
const latches = [];
for (const s of [-1, 1]) {
  const latch = new T.Group(); latch.name = s < 0 ? 'Cierre_izquierdo' : 'Cierre_derecho'; latch.position.set(s * .51, .94, .6); root.add(latch);
  box(latch, 'Cierre_blindado', .18, .23, .09, 0, -.07, .03, silver, .018); box(latch, 'Cierre_nucleo', .09, .12, .026, 0, -.07, .09, dark, .008); box(latch, 'Indicador', .065, .024, .012, 0, -.05, .109, cyan, .003);
  latches.push(latch);
}
// static geometry merged by material inside each moving part (few draw calls)
function merge(group) {
  group.updateMatrixWorld(true); const bins = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh) continue; child.updateMatrix();
    const g = (child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()).applyMatrix4(child.matrix);
    if (!bins.has(child.material)) bins.set(child.material, []); bins.get(child.material).push(g); group.remove(child);
  }
  for (const [material, geos] of bins) {
    const g = new T.BufferGeometry();
    for (const key of ['position', 'normal', 'uv']) {
      const chunks = geos.map(x => x.attributes[key]); const array = new Float32Array(chunks.reduce((s, x) => s + x.array.length, 0)); let offset = 0;
      for (const chunk of chunks) { array.set(chunk.array, offset); offset += chunk.array.length; }
      g.setAttribute(key, new T.BufferAttribute(array, chunks[0].itemSize));
    }
    g.computeBoundingSphere(); const m = new T.Mesh(g, material); m.name = group.name + '_' + material.name; group.add(m);
  }
}
for (const g of [body, lid, ...latches]) merge(g);
function rotationTrack(name, times, angles, axis = 'x') { const values = []; for (const a of angles) { const e = new T.Euler(); e[axis] = a; values.push(...new T.Quaternion().setFromEuler(e).toArray()); } return new T.QuaternionKeyframeTrack(name + '.quaternion', times, values); }
const times = [0, .25, .5, 1, 1.8, 2.6, 3];
const opening = new T.AnimationClip('Abrir', 3, [rotationTrack(lid.name, times, [0, 0, 0, -.25, -1.45, -1.78, -1.78]), ...latches.map(l => rotationTrack(l.name, times, [0, -.2, -1.4, -1.4, -1.4, -1.4, -1.4]))]);
const closing = opening.clone(); closing.name = 'Cerrar';
for (const track of closing.tracks) { const size = track.getValueSize(), values = []; for (let i = track.times.length - 1; i >= 0; i--) values.push(...track.values.slice(i * size, (i + 1) * size)); track.values = new Float32Array(values); track.times = new Float32Array(Array.from(track.times).reverse().map(t => 3 - t)); }
window.ASSET = { root, animations: [opening, closing], lid, latches };
})();
