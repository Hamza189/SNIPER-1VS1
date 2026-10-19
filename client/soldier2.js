/* SNIPER DUEL — personaje 3D (revisión 03, 19-10-2026), solo con ?pj=2. Sustituye al soldado de cajas
   (makeSoldier/animateSoldier) en bots y rival online. Solo aspecto: las zonas de impacto siguen siendo las del
   servidor (core/hitbox.js) y el modelo está medido para caber en ellas (tools/check-character-hitbox.js).

   assets/personaje/personaje.glb (texturas 2048) o personaje_1k.glb (perfil BAJO): 26 huesos, LOD0/1/2 (14 600 /
   5 000 / 1 500 triángulos, un material), morph 'agachado'/'deslizar' (la altura de las cajas al agacharse o
   deslizarse: no hace falta escalar el modelo por fuera), nodo 'arma' (donde va el arma del juego) y 29 clips.

   Mezcla por capas con un AnimationMixer por soldado:
     · inferior (cadera, columna baja, piernas, traslaciones y morph): quieto / andar en 4 direcciones / agachado /
       agachado andando / salto; el paso va sincronizado con la velocidad real (sin patinar);
     · superior (torso, brazos, cabeza y 'arma'): rifle bajo o al hombro, pistola, navaja; recarga, cerrojo,
       bombeo y cuchillada siguen el estado que manda el juego;
     · aditiva: aim_up / aim_down según la inclinación de la mirada;
     · cuerpo entero: esprint, deslizamiento y muerte.                                                       */
const SDSoldier2 = (() => {
  const LOWER_BONES = ['Root', 'Hips', 'Spine', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
  // la empuñadura de cada arma del juego en el marco 'arma' (origen en la empuñadura, +z cañón): posición del grupo
  // de armas antiguo (R.aim, coordenadas de makeSoldier) para que su empuñadura caiga en el origen
  const AIM_OFFSET = { rifle: [-0.1, 0.1, -0.08], shotgun: [-0.1, 0.1, -0.14], pistol: [-0.03, 0.0715, -0.40], knife: [-0.2, 0.03, -0.29] };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

  /* ---------- puro: qué clips y con qué peso (probado sin WebGL en test/soldier2.test.js) ----------
     st: { vx, vz (m/s, locales: +z delante, +x izquierda), crouch 0..1, slide 0..1, air, sprint, aim 0..1,
           pitch (rad, + arriba), wpn, reload 0..1, relPh 0..1, bolt 0..1, stab 0..1, dead 0..1, flinch 0..1 } */
  function plan(st) {
    const sp = Math.hypot(st.vx || 0, st.vz || 0), air = !!st.air, dead = st.dead || 0;
    const slide = st.slide === true ? 1 : +st.slide || 0, crouch = slide > 0.05 ? 0 : clamp(st.crouch || 0, 0, 1);
    const move = air ? 0 : sstep((sp - 0.3) / 1.1);
    const dir = { fwd: 0, back: 0, left: 0, right: 0 };
    if (sp > 1e-3) { const fx = (st.vx || 0) / sp, fz = (st.vz || 0) / sp;
      dir.fwd = Math.max(0, fz); dir.back = Math.max(0, -fz); dir.left = Math.max(0, fx); dir.right = Math.max(0, -fx);
      const s = dir.fwd + dir.back + dir.left + dir.right; for (const k in dir) dir[k] /= s; } else dir.fwd = 1;
    const wpn = st.wpn || 'rifle';
    const sprint = st.sprint && !air && crouch < 0.5 && slide < 0.05 && sp > 3.5 && dir.fwd > 0.6 && wpn !== 'knife' ? 1 : 0;
    const lower = {}, add = (k, w) => { if (w > 1e-3) lower[k] = (lower[k] || 0) + w; };
    // cuerpo entero (sustituye a todo lo demás en proporción)
    const full = {};
    if (dead > 0) full.death_back = 1;
    else { if (slide > 0) full.slide = slide; if (sprint) full.sprint = (1 - slide) * sprint; }
    const fullW = Object.values(full).reduce((a, b) => a + b, 0), rest = Math.max(0, 1 - fullW);
    if (rest > 0) {
      if (air) add('jump_air', rest);
      else {
        const stand = rest * (1 - crouch), low = rest * crouch;
        add('idle_rifle', stand * (1 - move)); for (const k in dir) add('walk_' + k, stand * move * dir[k]);
        add('crouch_idle', low * (1 - move)); add('crouch_walk', low * move);
      }
    }
    // tren superior
    const upper = {};
    if (rest > 0) {
      const aim = clamp(st.aim == null ? 1 : st.aim, 0, 1);
      const base = wpn === 'pistol' ? ['idle_pistol', 'aim_pistol'] : wpn === 'knife' ? ['idle_knife', 'idle_knife'] : ['idle_rifle', 'aim_rifle'];
      let one = null, oneW = 0, oneT = 0;
      if ((st.reload || 0) > 0.02) { one = wpn === 'pistol' ? 'reload_pistol' : wpn === 'shotgun' ? 'reload_shell' : wpn === 'knife' ? null : 'reload_rifle'; oneW = st.reload; oneT = clamp(st.relPh || 0, 0, 1); }
      else if ((st.bolt || 0) > 0 && wpn === 'rifle') { one = 'fire_rifle'; oneW = sstep(st.bolt / 0.08) * (1 - sstep((st.bolt - 0.9) / 0.1)); oneT = 0.27 + 0.68 * st.bolt; }
      else if ((st.bolt || 0) > 0 && wpn === 'shotgun') { one = 'pump_shotgun'; oneW = 1; oneT = st.bolt; }
      else if ((st.stab || 0) > 0 && wpn === 'knife') { one = 'knife_slash'; oneW = 1; oneT = st.stab; }
      else if ((st.flinch || 0) > 0.05) { one = 'hit_react'; oneW = clamp(st.flinch * 1.5, 0, 1); oneT = 0.4; }
      const b = rest * (1 - (one ? oneW : 0));
      if (base[0] === base[1]) upper[base[0]] = b; else { upper[base[0]] = b * (1 - aim); upper[base[1]] = (upper[base[1]] || 0) + b * aim; }
      if (one) upper[one] = (upper[one] || 0) + rest * oneW;
      const p = clamp(st.pitch || 0, -Math.PI / 3, Math.PI / 3) / (Math.PI / 3);
      const pw = rest * (wpn === 'knife' ? 0.3 : 0.35 + 0.65 * aim);
      return { lower, upper, full, oneT, one, sp, dir, crouch, slide, add: { aim_up: Math.max(0, p) * pw, aim_down: Math.max(0, -p) * pw } };
    }
    return { lower, upper, full, oneT: 0, one: null, sp, dir, crouch, slide, add: { aim_up: 0, aim_down: 0 } };
  }

  /* ---------- plantilla (una vez): clips partidos en capas ---------- */
  function template(gltf, T) {
    const scene = gltf.scene, clips = {}, meta = (gltf.parser && gltf.parser.json.scenes[0].extras) || {};
    const lowerSet = new Set(LOWER_BONES);
    const node = n => n.split('.')[0], prop = n => n.split('.').slice(1).join('.');
    const isLower = tr => prop(tr.name) !== 'quaternion' ? !/^arma$/.test(node(tr.name)) : lowerSet.has(node(tr.name));
    for (const c of gltf.animations) {
      const lo = c.tracks.filter(isLower), up = c.tracks.filter(t => !isLower(t));
      clips[c.name] = { full: c, lower: new T.AnimationClip(c.name + '@lower', c.duration, lo), upper: new T.AnimationClip(c.name + '@upper', c.duration, up),
        info: (meta.clips || {})[c.name] || {} };
    }
    // aditivas de inclinación: diferencia respecto a aim_rifle (fotograma 0), solo tren superior
    for (const k of ['aim_up', 'aim_down']) {
      const a = clips[k].upper.clone(), ref = clips.aim_rifle.upper;
      a.name = k + '@add'; a.duration = ref.duration;
      // una sola clave: se extiende a la duración de la referencia para que makeClipAdditive la lea
      T.AnimationUtils.makeClipAdditive(a, 0, ref, 30);
      clips[k].add = a;
    }
    const meshes = [0, 1, 2].map(i => scene.getObjectByName('personaje_LOD' + i));
    for (const m of meshes) { m.frustumCulled = true; m.geometry.boundingSphere = new T.Sphere(new T.Vector3(0, 0.9, 0), 1.35); }
    return { scene, clips, meshes, material: meshes[0].material, materials: { B: meshes[0].material }, meta };
  }

  // clon con su propio esqueleto (Object3D.clone comparte el esqueleto del original)
  function cloneSkinned(src, T) {
    const dst = src.clone(true), byName = {};
    dst.traverse(o => { if (o.isBone) byName[o.name] = o; });
    let skel = null;
    dst.traverse(o => {
      if (!o.isSkinnedMesh) return;
      if (!skel) skel = new T.Skeleton(o.skeleton.bones.map(b => byName[b.name]), o.skeleton.boneInverses.map(m => m.clone()));
      o.bind(skel, o.bindMatrix);
    });
    return dst;
  }

  function create(tpl, T, material) {
    const root = cloneSkinned(tpl.scene, T);
    const meshes = [0, 1, 2].map(i => root.getObjectByName('personaje_LOD' + i));
    for (const m of meshes) { m.material = material; m.castShadow = true; m.receiveShadow = false; m.morphTargetInfluences && m.morphTargetInfluences.fill(0); }
    const I = { root, meshes, arma: root.getObjectByName('arma'), mixer: new T.AnimationMixer(root), actions: {}, phase: 0, lod: -1, dead: 0, T, tpl };
    setLod(I, 0);
    return I;
  }
  function setLod(I, n) { if (I.lod === n) return; I.lod = n; I.meshes.forEach((m, i) => m.visible = i === n); }

  function action(I, name, layer) {
    const key = name + '@' + layer;
    let a = I.actions[key];
    if (!a) {
      const c = I.tpl.clips[name]; if (!c) return null;
      const clip = layer === 'add' ? c.add : c[layer];
      a = I.mixer.clipAction(clip);
      if (layer === 'add') a.blendMode = I.T.AdditiveAnimationBlendMode;
      a.timeScale = 0; a.play(); a.setEffectiveWeight(0);
      I.actions[key] = a;
    }
    return a;
  }
  const TT = (a, t) => { a.time = clamp(t, 0, Math.max(0, a.getClip().duration - 1e-4)); };

  function update(I, st, dt) {
    const P = plan(st), clips = I.tpl.clips, used = new Set();
    // fase de la marcha: avanza con la velocidad real dividida por la del clip (pie apoyado sin patinar)
    const walkSpeed = ['fwd', 'back', 'left', 'right'].reduce((s, k) => s + P.dir[k] * ((clips['walk_' + k].info.speed) || 4.5), 0);
    const crouchT = P.crouch > 0.5, spr = P.full.sprint > 0.5;
    const speed = spr ? (clips.sprint.info.speed || 6.5) : crouchT ? (clips.crouch_walk.info.speed || 2.2) : walkSpeed;
    const period = (spr ? clips.sprint : crouchT ? clips.crouch_walk : clips.walk_fwd).full.duration;
    I.phase = (I.phase + dt * P.sp / Math.max(0.5, speed) / period) % 1;
    I.t = (I.t || 0) + dt;
    if ((st.dead || 0) > 0) I.dead += dt; else I.dead = 0;
    const set = (name, layer, w, t) => { if (w <= 1e-3) return; const a = action(I, name, layer); if (!a) return; a.enabled = true; a.setEffectiveWeight(w); TT(a, t); used.add(a); };
    for (const [k, w] of Object.entries(P.full)) {
      const d = clips[k].full.duration;
      set(k, 'full', w, k === 'sprint' ? I.phase * d : k.startsWith('death') ? I.dead : (I.t % d));
    }
    for (const [k, w] of Object.entries(P.lower)) {
      const d = clips[k].lower.duration;
      set(k, 'lower', w, k.startsWith('walk') || k === 'crouch_walk' ? I.phase * d : I.t % d);
    }
    for (const [k, w] of Object.entries(P.upper)) {
      const d = clips[k].upper.duration;
      set(k, 'upper', w, k === P.one ? P.oneT * d : I.t % d);
    }
    for (const [k, w] of Object.entries(P.add)) set(k, 'add', w, 0);
    for (const key in I.actions) { const a = I.actions[key]; if (!used.has(a)) { a.setEffectiveWeight(0); a.enabled = false; } }
    I.mixer.update(0);
    return P;
  }

  return { plan, template, create, update, setLod, cloneSkinned, AIM_OFFSET, LOWER_BONES };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SDSoldier2;
