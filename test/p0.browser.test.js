/* P0 ground pack (assets/tex/p0*, tools/p0/make_p0_textures.py) in the game, per graphics profile:
   - ?pueblo=3 loads the v3 limestone plaza by default; ?pueblo=3&suelo=0 and the default game do not load a single P0 file
   - every texture the page asks for exists (a missing roughness map reads as 0 = a mirror: this happened in MEDIO)
   - the materials get their maps where the profile says (ALTO/MEDIO: colour, normal, roughness · BAJO: colour)
   - decals and sand drifts stay flat on the ground (≤ 5 cm) and the collision boxes are the same as without P0
   Run: node test/p0.browser.test.js   (software WebGL is fine: nothing is timed) */
'use strict';
const { chromium } = require('playwright');
const ss = require('../tools/static-server.js');
let pass = 0, fail = 0;
function check(name, cond, info) { if (cond) { pass++; console.log('  ok   ' + name + (info !== undefined ? '  (' + info + ')' : '')); } else { fail++; console.log('  FAIL ' + name + (info !== undefined ? '  (' + info + ')' : '')); } }

async function load(b, url, q, p3mem) {
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  if (p3mem) await ctx.addInitScript(() => { try { localStorage.setItem('sniperduel_p3', 'true'); } catch (e) {} });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.addInitScript(q => { try { localStorage.setItem('sniperduel_settings', JSON.stringify({ quality: q, v: 2 })); } catch (e) {} }, q);
  const p = await ctx.newPage(), bad = [], p0files = [], errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('response', r => { const u = r.url(); if (/\/assets\//.test(u) && r.status() >= 400) bad.push(r.status() + ' ' + u.replace(/^.*\/assets\//, 'assets/').replace(/\?.*/, '')); if (/assets\/tex\/p1/.test(u)) (p0files.p1 || (p0files.p1 = [])).push(u.replace(/^.*\/tex\//, '').replace(/\?.*/, '') + (r.status() >= 400 ? '(' + r.status() + ')' : '')); if (/assets\/tex\/p0/.test(u)) p0files.push(u.replace(/^.*\/tex\//, '').replace(/\?.*/, '')); });
  p.on('requestfailed', r => { if (/\/assets\//.test(r.url())) bad.push('fallo ' + r.url().replace(/^.*\/assets\//, 'assets/')); });
  await p.goto(url);
  await p.waitForFunction(() => window.__SD && __SD.W && (!__SD.P3ON || (__SD.P3W && __SD.P3W.kit)), null, { timeout: 120000 });
  await p.waitForTimeout(2500);   // the textures arrive after the kit
  const r = await p.evaluate(() => {
    const S = __SD; S.setWorld('pueblo');
    const mats = {}; let maxY = -1;
    S.scene.traverse(o => { if (!o.material || Array.isArray(o.material)) return; const m = o.material;
      if (/^kit_p0/.test(m.name)) mats[m.name] = { map: !!(m.map && m.map.image && m.map.image.width), normal: !!(m.normalMap && m.normalMap.image && m.normalMap.image.width), rough: !!(m.roughnessMap && m.roughnessMap.image && m.roughnessMap.image.width), r: m.roughness };
      if (/^p0_/.test(o.name)) { o.geometry.computeBoundingBox(); maxY = Math.max(maxY, o.geometry.boundingBox.max.y); } });
    const col = S.W.colliders.map(c => [c.minX, c.minY, c.minZ, c.maxX, c.maxY, c.maxZ].map(v => +v.toFixed(3)).join(',')).join(';');
    // the town outside stands on the plane of the old concrete perimeter wall: its materials must carry the depth offset
    // (19-10-2026, the owner's distant stripes) and must not be the kit's shared ones (that would offset every building)
    const kitMats = new Set(); S.scene.traverse(o => { if (o.isMesh && /^kit_/.test(o.name)) kitMats.add(o.material); });
    const bd = S.scene.children.filter(o => /^p3_backdrop/.test(o.name)).map(o => ({ off: !!o.material.polygonOffset, shared: kitMats.has(o.material) }));
    return { on: S.P0.on, use: S.P0.use, decals: S.P0.decals, strips: S.P0.strips, meshes: S.P0.meshes.map(m => m.name), mats, maxY, colliders: col, bd };
  });
  await ctx.close();
  return Object.assign(r, { bad, p0files, errs });
}

(async () => {
  const srv = await ss.start();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const base = await load(b, srv.url + '?vm=1&pueblo=3&suelo=0', 'alto');
  console.log('\nSIN EL PACK');
  check('?pueblo=3&suelo=0: suelo anterior y ningún archivo P0 descargado', !base.on && base.p0files.length === 0, base.p0files.join(' '));
  check('pueblo exterior: materiales propios con desplazamiento de profundidad (sin rayas contra el muro perimetral)', base.bd.length > 0 && base.bd.every(x => x.off && !x.shared), JSON.stringify(base.bd));
  const dflt = await load(b, srv.url + '?vm=1&pueblo=3', 'alto');
  check('?pueblo=3 por defecto: caliza v3b en la plaza y adoquín de Poly Haven (aprobados el 12 y el 17-10-2026)', dflt.on && dflt.p0files.some(f => /^p0v3_plaza_c/.test(f)) && dflt.p0files.some(f => /^p0cc_cobble_c/.test(f)), dflt.p0files.join(' '));
  const noCob = await load(b, srv.url + '?vm=1&pueblo=3&adoquin=0', 'alto');
  check('&adoquin=0: vuelve el adoquín anterior (ningún archivo del escaneo)', noCob.on && !noCob.use.cobble && !noCob.p0files.some(f => /cobble/.test(f)), noCob.p0files.join(' '));
  const fa = await load(b, srv.url + '?vm=1&pueblo=3&fachada=cc0', 'alto');
  const p1 = fa.p0files.p1 || [];
  check('&fachada=cc0 (P1): paredes, tejas, persianas y puertas de Poly Haven, sin 404, mismas colisiones', ['stucco', 'rooftiles', 'wood', 'door'].every(m => p1.some(f => f.startsWith('p1_' + m + '_c'))) && !p1.some(f => /\(/.test(f)) && !p1.some(f => /stone/.test(f)) && fa.colliders === base.colliders && fa.bad.length === 0, p1.join(' '));
  check('sin &fachada=cc0 no se descarga ninguna textura P1', !(dflt.p0files.p1 || []).length);
  const mem = await load(b, srv.url + '?vm=1', 'alto', true);
  check('PUEBLO 3.0 elegido en AJUSTES (guardado en el dispositivo) sin nada en el enlace: suelo nuevo', mem.on && mem.p0files.some(f => /^p0cc_cobble_c/.test(f)), mem.p0files.join(' '));
  check('?pueblo=3 por defecto: mismas cajas de colisión', dflt.colliders === base.colliders);
  const def = await load(b, srv.url + '?vm=1', 'alto');
  check('el juego normal: P0 apagado y ningún archivo P0 descargado', !def.on && def.p0files.length === 0);
  for (const [q, set] of [['alto', 'p0'], ['medio', 'p0'], ['bajo', 'p0'], ['alto', 'v3'], ['bajo', 'v3'], ['alto', 'cc0'], ['medio', 'cc0'], ['bajo', 'cc0']]) {
    console.log('\nP0 ' + (set === 'cc0' ? 'plaza v3b + adoquín Poly Haven CC0 (&adoquin=cc0)' : set === 'v3' ? 'prototipo v3' : 'v2') + ' · ' + q.toUpperCase());
    const r = await load(b, srv.url + '?vm=1&pueblo=3' + (set === 'cc0' ? '&adoquin=cc0' : '&suelo=' + set), q);
    if (set === 'cc0') {
      const pre = q === 'bajo' ? 'p0ccb_' : q === 'medio' ? 'p0ccm_' : 'p0cc_';
      check('el adoquín es el escaneo de Poly Haven (' + pre + 'cobble_*) y la plaza la caliza v3b', r.use.cobble && r.p0files.some(f => f.startsWith(pre + 'cobble_c')) && r.p0files.some(f => /^p0v3.?_plaza_c/.test(f)) && !r.p0files.some(f => /^p0(v3.?|m|b)?_cobble/.test(f)), r.p0files.join(' '));
    }
    check('todas las texturas que pide la página existen (ningún 404)', r.bad.length === 0, r.bad.slice(0, 4).join(' | ') || r.p0files.length + ' archivos P0');
    const names = [['plaza', 'kit_p0plaza'], ['cobble', 'kit_p0cobble'], ['sidewalk', 'kit_p0side'], ['patch', 'kit_p0patch']].filter(([k]) => r.use[k]).map(([, n]) => n);
    const unused = ['kit_p0plaza', 'kit_p0cobble', 'kit_p0side', 'kit_p0patch'].filter(n => !names.includes(n));
    const full = q !== 'bajo';
    check('solo se usan los materiales del pack elegidos (' + names.join(', ') + ')', names.length > 0 && unused.every(n => !r.mats[n]), Object.keys(r.mats).join(', '));
    check('materiales del pack: color' + (full ? ', normal y rugosidad' : ' (BAJO sin normal ni rugosidad)'),
      names.every(n => r.mats[n] && r.mats[n].map && r.mats[n].normal === full && r.mats[n].rough === full), JSON.stringify(r.mats));
    check('ninguna rugosidad a 0 (espejo)', names.every(n => r.mats[n] && (r.mats[n].rough || r.mats[n].r >= 0.6)));
    check('calcas colocadas según lo elegido (' + (r.use.decals ? 'todas' : 'solo tapas y rejillas') + (r.use.drifts && q !== 'bajo' ? ', con arena acumulada' : ', sin arena acumulada') + ')', r.decals > 0 && (r.use.drifts && q !== 'bajo' ? r.strips > 0 : r.strips === 0) && (r.use.decals && q !== 'bajo' || !r.meshes.includes('p0_decals_soft')), r.decals + ' calcas · ' + r.strips + ' tiras · ' + r.meshes.join(', '));
    check('calcas y tiras planas sobre el suelo (≤ 5 cm)', r.maxY >= 0 && r.maxY <= 0.05, r.maxY.toFixed(3) + ' m');
    check('las cajas de colisión son las mismas que sin el pack', r.colliders === base.colliders);
    check('sin errores en la página', r.errs.length === 0, r.errs.slice(0, 2).join(' | '));
  }
  await b.close(); srv.close();
  console.log('\n' + pass + ' correctas, ' + fail + ' fallidas');
  process.exit(fail ? 1 : 0);
})();
