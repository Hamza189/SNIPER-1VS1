/* SNIPER DUEL — personaje 3D (revisión 03, 19-10-2026), solo con ?pj=2. Sustituye al soldado de cajas
   (makeSoldier/animateSoldier) en bots y rival online. Solo aspecto: las zonas de impacto siguen siendo las del
   servidor (core/hitbox.js) y el modelo está medido para caber en ellas (tools/check-character-hitbox.js).

   assets/personaje/personaje.glb (texturas 2048) o personaje_1k.glb (perfil BAJO): 26 huesos, LOD0/1/2 (14 600 /
   5 000 / 1 500 triángulos, un material), morph 'agachado'/'deslizar' (la altura de las cajas al agacharse o
   deslizarse: no hace falta escalar el modelo por fuera), nodo 'arma' (donde va el arma del juego) y 29 clips.

   Mezcla por capas con un AnimationMixer por soldado:
     · inferior (cadera, columna baja, piernas, traslaciones y morph): quieto / andar en 4 direcciones / agachado /
       agachado andando / despegue / salto / aterrizaje; el paso va sincronizado con la velocidad real (sin patinar);
     · superior (torso, brazos, cabeza y 'arma'): rifle bajo o al hombro, pistola, navaja; recarga, cerrojo,
       cuchillada e impacto siguen el estado que manda el juego;
     · aditiva: aim_up / aim_down según la inclinación de la mirada y el retroceso de los clips de disparo;
     · cuerpo entero: esprint, deslizamiento y muerte (hacia atrás o hacia delante).

   GF-2 (31-10-2026, medido con tools/anim-sheet.js): lo que el juego manda de golpe ya no salta de una postura a otra.
   Antes, al soltar el esprint, al aterrizar o al morir, un hueso giraba hasta 99°, 71° y 130° en un solo fotograma:
     · esprint, salto, muerte, apuntar (los bots pasan de 0 a 1 de golpe) y cambio de arma entran y salen con una mezcla
       corta (BLEND);
     · despegue con el final de jump_start y aterrizaje con jump_land, más fuerte cuanto más tiempo en el aire;
     · disparo: el retroceso de fire_rifle (su primera parte), fire_pistol y fire_shotgun como capa aditiva (se suma a la
       postura que haya sin cambiarla) y un empujón del pecho hacia atrás (KICK);
     · impacto: hit_react en su tiempo, con entrada y salida (antes, una postura fija a peso 1 de golpe), y un tirón del
       pecho hacia donde empuja el tiro (y de la cabeza si fue en la cabeza);
     · recarga de la escopeta: la mano va a la ventana y vuelve en cada cartucho (antes saltaba al empezar cada uno).
   Nada de esto mueve las zonas de impacto: son cajas del servidor, aparte del dibujo.                                */
const SDSoldier2 = (() => {
  const LOWER_BONES = ['Root', 'Hips', 'Spine', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
  // la empuñadura de cada arma del juego en el marco 'arma' (origen en la empuñadura, +z cañón): posición del grupo
  // de armas antiguo (R.aim, coordenadas de makeSoldier) para que su empuñadura caiga en el origen
  const AIM_OFFSET = { rifle: [-0.1, 0.1, -0.08], shotgun: [-0.1, 0.1, -0.14], pistol: [-0.03, 0.0715, -0.40], knife: [-0.2, 0.03, -0.29] };
  // GF-2: segundos de cada mezcla (entrar / salir); la mirada, en rad/s como mucho
  const BLEND = { sprIn: 0.22, sprOut: 0.22, airIn: 0.08, airOut: 0.1, dead: 0.25, aimIn: 0.15, aimOut: 0.18, wpn: 0.22, pitch: 4 };
  // retroceso de cada arma: empujón del pecho (rad), velocidad del clip de disparo, de qué clip sale la capa aditiva
  const KICK = { rifle: [0.07, 1.6, 'fire_rifle'], shotgun: [0.1, 1, 'fire_shotgun'], pistol: [0.05, 1, 'fire_pistol'] };
  // duración (s) de cada capa de retroceso: el inicio de fire_rifle (antes de ir al cerrojo) y los otros dos enteros
  const KICK_DUR = { fire_rifle: 0.3, fire_pistol: 0.22, fire_shotgun: 0.25 };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  // golpe que sube en `rise` s y se apaga con constante `decay` s (retroceso, impacto)
  const env = (t, rise, decay) => t < 0 ? 0 : t < rise ? sstep(t / rise) : Math.exp(-(t - rise) / decay);
  const live = t => t != null && t >= 0;

  // ¿puede esprintar con este estado? (con el arma cruzada: de frente, deprisa, de pie y sin navaja)
  function sprintOk(st) {
    const vx = st.vx || 0, vz = st.vz || 0, sp = Math.hypot(vx, vz);
    const slide = st.slide === true ? 1 : +st.slide || 0, crouch = slide > 0.05 ? 0 : clamp(st.crouch || 0, 0, 1);
    const fwd = sp > 1e-3 ? Math.max(0, vz) / (Math.abs(vx) + Math.abs(vz)) : 1;
    return !!st.sprint && !st.air && crouch < 0.5 && slide < 0.05 && sp > 3.5 && fwd > 0.6 && (st.wpn || 'rifle') !== 'knife';
  }
  // recarga de la escopeta, fase de un cartucho 0..1 → tiempo de reload_shell: la mano va a la ventana y vuelve
  const shellT = u => { u = ((u % 1) + 1) % 1; return 0.6 * (u < 0.55 ? sstep(u / 0.55) : 1 - sstep((u - 0.55) / 0.45)); };

  /* ---------- puro: qué clips y con qué peso (probado sin WebGL en test/soldier2.test.js) ----------
     st: { vx, vz (m/s, locales: +z delante, +x izquierda), crouch 0..1, slide 0..1, air, sprint, aim 0..1,
           pitch (rad, + arriba), wpn, reload 0..1, relPh 0..1, bolt 0..1, stab 0..1, dead 0..1, flinch 0..1,
           fire (s desde el disparo), hit (s desde el impacto), deathFront }
     y, ya suavizados por blend(): sprintW, airW, deadW, wpnFrom + wpnK, startW + startT, landW + landT (0..1) */
  function plan(st) {
    const sp = Math.hypot(st.vx || 0, st.vz || 0);
    const airW = st.airW != null ? clamp(st.airW, 0, 1) : st.air ? 1 : 0;
    const deadW = st.deadW != null ? clamp(st.deadW, 0, 1) : (st.dead || 0) > 0 ? 1 : 0;
    const slide = st.slide === true ? 1 : +st.slide || 0, crouch = slide > 0.05 ? 0 : clamp(st.crouch || 0, 0, 1);
    const move = sstep((sp - 0.3) / 1.1);
    const dir = { fwd: 0, back: 0, left: 0, right: 0 };
    if (sp > 1e-3) { const fx = (st.vx || 0) / sp, fz = (st.vz || 0) / sp;
      dir.fwd = Math.max(0, fz); dir.back = Math.max(0, -fz); dir.left = Math.max(0, fx); dir.right = Math.max(0, -fx);
      const s = dir.fwd + dir.back + dir.left + dir.right; for (const k in dir) dir[k] /= s; } else dir.fwd = 1;
    const wpn = st.wpn || 'rifle';
    const sprint = st.sprintW != null ? clamp(st.sprintW, 0, 1) : sprintOk(st) ? 1 : 0;
    const lower = {}, lowerT = {}, add = (k, w) => { if (w > 1e-3) lower[k] = (lower[k] || 0) + w; };
    // cuerpo entero (sustituye a todo lo demás en proporción)
    const full = {};
    if (deadW > 0) full[st.deathFront ? 'death_front' : 'death_back'] = deadW;
    const alive = 1 - deadW;
    if (slide > 0 && alive > 0) full.slide = slide * alive;
    if (sprint > 0 && alive > 0) full.sprint = (1 - slide) * sprint * alive;
    const fullW = Object.values(full).reduce((a, b) => a + b, 0), rest = Math.max(0, 1 - fullW);
    if (rest > 0) {
      const air = rest * airW, ground = rest - air;
      if (air > 1e-3) {   // despegue (final de jump_start) y luego en el aire
        const sw = clamp(st.startW || 0, 0, 1);
        add('jump_start', air * sw); add('jump_air', air * (1 - sw)); lowerT.jump_start = clamp(st.startT || 0, 0, 1);
      }
      if (ground > 1e-3) {
        // aterrizaje: andando se nota menos (las piernas siguen el paso)
        const lw = clamp(st.landW || 0, 0, 1) * (1 - 0.6 * move);
        add('jump_land', ground * lw); lowerT.jump_land = clamp(st.landT || 0, 0, 1);
        const g = ground * (1 - lw), stand = g * (1 - crouch), low = g * crouch;
        add('idle_rifle', stand * (1 - move)); for (const k in dir) add('walk_' + k, stand * move * dir[k]);
        add('crouch_idle', low * (1 - move)); add('crouch_walk', low * move);
      }
    }
    // tren superior
    const upper = {};
    if (rest > 0) {
      const aim = clamp(st.aim == null ? 1 : st.aim, 0, 1);
      const bases = w => w === 'pistol' ? ['idle_pistol', 'aim_pistol'] : w === 'knife' ? ['idle_knife', 'idle_knife'] : ['idle_rifle', 'aim_rifle'];
      let one = null, oneW = 0, oneT = 0;
      if ((st.reload || 0) > 0.02) { one = wpn === 'pistol' ? 'reload_pistol' : wpn === 'shotgun' ? 'reload_shell' : wpn === 'knife' ? null : 'reload_rifle'; oneW = st.reload; oneT = wpn === 'shotgun' ? shellT(st.relPh || 0) : clamp(st.relPh || 0, 0, 1); }
      else if ((st.bolt || 0) > 0 && wpn === 'rifle') { one = 'fire_rifle'; oneW = sstep(st.bolt / 0.08) * (1 - sstep((st.bolt - 0.9) / 0.1)); oneT = 0.27 + 0.68 * st.bolt; }
      else if ((st.stab || 0) > 0 && wpn === 'knife') { one = 'knife_slash'; oneW = 1; oneT = st.stab; }
      else if (st.hit != null) { if (live(st.hit) && st.hit < 0.4) { one = 'hit_react'; oneW = 0.85 * sstep(st.hit / 0.05) * (1 - sstep((st.hit - 0.1) / 0.25)); oneT = clamp(st.hit / 0.26, 0, 1); } }
      else if ((st.flinch || 0) > 0.05) { one = 'hit_react'; oneW = clamp(st.flinch * 1.5, 0, 1); oneT = 0.4; }
      if (one && oneW <= 1e-3) one = null;
      const b = rest * (1 - (one ? oneW : 0));
      const put = (w, k) => { const s = bases(w); if (s[0] === s[1]) upper[s[0]] = (upper[s[0]] || 0) + b * k;
        else { upper[s[0]] = (upper[s[0]] || 0) + b * k * (1 - aim); upper[s[1]] = (upper[s[1]] || 0) + b * k * aim; } };
      // cambio de arma: la postura de la de antes se va en BLEND.wpn s (el arma ya es la nueva y va con la mano)
      const wk = st.wpnFrom && st.wpnFrom !== wpn ? clamp(st.wpnK == null ? 1 : st.wpnK, 0, 1) : 1;
      put(wpn, wk); if (wk < 1) put(st.wpnFrom, 1 - wk);
      if (one) upper[one] = (upper[one] || 0) + rest * oneW;
      const p = clamp(st.pitch || 0, -Math.PI / 3, Math.PI / 3) / (Math.PI / 3);
      const pw = rest * (wpn === 'knife' ? 0.3 : 0.35 + 0.65 * aim);
      const addW = { aim_up: Math.max(0, p) * pw, aim_down: Math.max(0, -p) * pw }, addT = {};
      // retroceso del disparo: la capa aditiva del clip de disparo, en su tiempo (a KICK[1] veces su velocidad)
      const K = KICK[wpn];
      if (K && live(st.fire)) { const t = st.fire * K[1], d = KICK_DUR[K[2]];
        if (t < d) { addW[K[2]] = rest * (1 - sstep((t - 0.75 * d) / (0.25 * d))); addT[K[2]] = t; } }
      return { lower, lowerT, upper, full, oneT, one, sp, dir, crouch, slide, add: addW, addT };
    }
    return { lower, lowerT, upper, full, oneT: 0, one: null, sp, dir, crouch, slide, add: { aim_up: 0, aim_down: 0 }, addT: {} };
  }

  /* ---------- puro: lo que el juego manda de golpe, mezclado (B guarda el estado entre fotogramas) ----------
     esprint, salto, muerte, apuntar y cambio de arma avanzan hacia su valor a ritmo fijo (BLEND): si lo que llega ya
     cambia despacio (el apuntado del rival online sigue a su ADS), no añade retraso; si salta, lo convierte en rampa.
     Al reaparecer (o el primer fotograma) se coloca sin mezcla. */
  function blend(B, st, dt) {
    const sprT = sprintOk(st) ? 1 : 0, airT = st.air ? 1 : 0, aimT = clamp(st.aim == null ? 1 : st.aim, 0, 1);
    const dead = (st.dead || 0) > 0, wpn = st.wpn || 'rifle';
    const go = (v, t, up, down) => v < t ? Math.min(t, v + dt / up) : Math.max(t, v - dt / down);
    if (B.spr == null || (B.dead > 0 && !dead)) Object.assign(B, { spr: sprT, air: airT, aim: aimT, dead: 0, pitch: st.pitch || 0, wpn, wpnFrom: null, wpnK: 1, wasAir: !!airT, airTime: 0, landT: 9, landK: 0 });
    // al morir, lo que se va mezclando hacia la caída sigue con su paso de antes (si no, las piernas se cortaban de golpe)
    if (!dead) { B.vx = st.vx || 0; B.vz = st.vz || 0; }
    B.spr = go(B.spr, sprT, BLEND.sprIn, BLEND.sprOut);
    B.aim = go(B.aim, aimT, BLEND.aimIn, BLEND.aimOut);
    B.dead = dead ? go(B.dead, 1, BLEND.dead, BLEND.dead) : 0;
    const pt = st.pitch || 0, mx = BLEND.pitch * dt; B.pitch += clamp(pt - B.pitch, -mx, mx);
    if (wpn !== B.wpn) { B.wpnFrom = B.wpn; B.wpn = wpn; B.wpnK = 0; }
    B.wpnK = Math.min(1, B.wpnK + dt / BLEND.wpn);
    // despegue y aterrizaje (un salto de menos de 0,08 s, como un escalón o un paquete de red, no cuenta)
    if (airT && !B.wasAir) B.airTime = 0;
    if (!airT && B.wasAir) { B.landT = 0; B.landK = B.airTime < 0.08 ? 0 : clamp(B.airTime / 0.5, 0.3, 1); }
    B.wasAir = !!airT;
    if (airT) B.airTime += dt; else B.landT += dt;
    B.air = go(B.air, airT, BLEND.airIn, BLEND.airOut);
    return B;
  }
  // lo que plan() recibe además del estado: los pesos ya mezclados
  function blended(B, st) {
    const lt = B.landT, dead = (st.dead || 0) > 0;
    return Object.assign({}, st, dead ? { vx: B.vx, vz: B.vz } : null, { sprintW: sstep(B.spr), airW: sstep(B.air), deadW: sstep(B.dead), aim: B.aim, pitch: B.pitch,
      wpnFrom: B.wpnK < 1 ? B.wpnFrom : null, wpnK: sstep(B.wpnK),
      startW: 1 - sstep(B.airTime / 0.16), startT: 0.62 + 0.38 * Math.min(1, B.airTime / 0.16),
      landW: B.landK * sstep(lt / 0.04) * (1 - sstep((lt - 0.1) / 0.22)), landT: Math.min(1, lt / 0.32) });
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
    // GF-2: retroceso de cada arma como diferencia respecto a su propio primer fotograma (se suma a cualquier postura:
    // los clips de la escopeta parten de otra colocación de brazos y, mezclados tal cual, la hacían saltar 45–70°)
    for (const k in KICK_DUR) {
      if (!clips[k]) continue;
      const src = clips[k].upper, a = k === 'fire_rifle' ? T.AnimationUtils.subclip(src, k + '@add', 0, Math.round(KICK_DUR[k] * 30) + 1, 30) : src.clone();
      a.name = k + '@add'; T.AnimationUtils.makeClipAdditive(a, 0, a, 30);
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
    const I = { root, meshes, arma: root.getObjectByName('arma'), mixer: new T.AnimationMixer(root), actions: {}, phase: 0, lod: -1, dead: 0, T, tpl,
      hips: root.getObjectByName('Hips'), spine1: root.getObjectByName('Spine1'), spine2: root.getObjectByName('Spine2'), head: root.getObjectByName('Head'),
      legYaw: 0, legW: { fwd: 1, back: 0, left: 0, right: 0 }, legMode: 'fwd', bl: {} };
    setLod(I, 0);
    return I;
  }
  function setLod(I, n) { if (I.lod === n) return; I.lod = n; I.meshes.forEach((m, i) => m.visible = i === n); }

  function action(I, name, layer) {
    const key = name + '@' + layer;
    let a = I.actions[key];
    if (!a) {
      const c = I.tpl.clips[name]; if (!c) return null;
      const clip = layer === 'add' ? c.add : c[layer]; if (!clip) return null;
      a = I.mixer.clipAction(clip);
      if (layer === 'add') a.blendMode = I.T.AdditiveAnimationBlendMode;
      a.timeScale = 0; a.play(); a.setEffectiveWeight(0);
      I.actions[key] = a;
    }
    return a;
  }
  const TT = (a, t) => { a.time = clamp(t, 0, Math.max(0, a.getClip().duration - 1e-4)); };

  /* paso según la velocidad (27-10-2026, medido con tools/gait-sheet.js): más despacio que el clip, la zancada se acorta
     y la cadencia baja con la raíz de la velocidad, como al andar de verdad (antes: correr a cámara lenta, 93 pasos/min
     a 2,3 m/s); más deprisa, la cadencia sube como mucho un 15 % (antes: 304 pasos/min de lado). stride 1 = zancada del
     clip; rate = fracción de la cadencia del clip. Sin patinar: stride · rate · velocidad del clip = velocidad real. */
  const GAIT_MAX = 1.15;
  function gait(sp, speed) {
    const r = sp / Math.max(0.5, speed);
    if (r >= 1) return { stride: 1, rate: Math.min(r, GAIT_MAX) };
    const k = Math.sqrt(r);
    return { stride: k, rate: k };
  }

  /* piernas hacia donde va (27-10-2026): mezclar el clip de frente y el lateral al 50 % en diagonal hacía que cada pie
     recorriese la mitad (patinaba 1,9 m/s). Como en los juegos grandes, las piernas giran hacia la marcha y el pecho
     contragira lo mismo (sigue mirando y apuntando al frente). De frente hasta 67,5°, de lado hasta 112,5°, hacia atrás
     el resto; 8° de margen para no saltar de uno a otro en el límite. Las zonas de impacto no cambian. */
  const LEG_B1 = 67.5 * Math.PI / 180, LEG_B2 = 112.5 * Math.PI / 180, LEG_HYS = 8 * Math.PI / 180;
  function legPlan(vx, vz, prev) {
    const a = Math.atan2(vx, vz), s = a < 0 ? -1 : 1, A = Math.abs(a);
    let mode = A <= LEG_B1 ? 'fwd' : A >= LEG_B2 ? 'back' : 'side';
    if (prev === 'fwd' && A <= LEG_B1 + LEG_HYS) mode = 'fwd';
    else if (prev === 'back' && A >= LEG_B2 - LEG_HYS) mode = 'back';
    else if (prev === 'side' && A > LEG_B1 - LEG_HYS && A < LEG_B2 + LEG_HYS) mode = 'side';
    if (mode === 'fwd') return { mode, w: { fwd: 1 }, yaw: a };
    if (mode === 'back') return { mode, w: { back: 1 }, yaw: a - s * Math.PI };
    return { mode, w: { [s > 0 ? 'left' : 'right']: 1 }, yaw: a - s * Math.PI / 2 };
  }
  // gira un hueso alrededor de un eje del personaje (no del hueso): la vertical (piernas) o el lateral (retroceso)
  let _qa, _qb, _qc, _Y, _X;
  function turnBone(I, b, axis, ang) {
    _qa.set(0, 0, 0, 1);
    for (let o = b.parent; o && o !== I.root; o = o.parent) _qa.premultiply(o.quaternion);
    _qb.setFromAxisAngle(axis, ang).premultiply(_qc.copy(_qa).invert()).multiply(_qa);
    b.quaternion.premultiply(_qb);
  }
  function initAxes(T) { if (!_qa) { _qa = new T.Quaternion(); _qb = new T.Quaternion(); _qc = new T.Quaternion(); _Y = new T.Vector3(0, 1, 0); _X = new T.Vector3(1, 0, 0); } }
  function yawBone(I, b, ang) { initAxes(I.T); turnBone(I, b, _Y, ang); }

  /* empujón del disparo y tirón del impacto (rad): el pecho gira sobre sí mismo (con él, brazos, cabeza y arma).
     pitch > 0 = hacia atrás; yaw > 0 = el hombro izquierdo hacia atrás. hitX/hitZ: hacia dónde está el tirador, en
     coordenadas del personaje (+z delante, +x izquierda); sin dato, de frente. */
  function recoil(st) {
    let pitch = 0, yaw = 0, head = 0;
    const K = KICK[st.wpn || 'rifle'];
    if (K && live(st.fire) && st.fire < 0.6) pitch += K[0] * env(st.fire, 0.03, 0.09);
    if (live(st.hit) && st.hit < 0.8) {
      const e = env(st.hit, 0.04, 0.12), k = st.hitPart === 'head' ? 1.3 : st.hitPart === 'legs' ? 0.5 : 1;
      const hx = st.hitX != null ? st.hitX : 0, hz = st.hitZ != null ? st.hitZ : 1;
      pitch += 0.1 * k * e * hz; yaw += 0.14 * k * e * hx;
      if (st.hitPart === 'head') head += 0.22 * e;
    }
    const a = 1 - (st.deadW != null ? st.deadW : (st.dead || 0) > 0 ? 1 : 0);
    return { pitch: pitch * a, yaw: yaw * a, head: head * a };
  }

  function update(I, st, dt) {
    const B = blend(I.bl || (I.bl = {}), st, dt), q = blended(B, st);
    const P = plan(q), clips = I.tpl.clips, used = new Set();
    const crouchT = P.crouch > 0.5, spr = (P.full.sprint || 0) > 0.5;
    // piernas: qué clip de marcha y cuánto giran (suavizado: ~0,1 s al cambiar de dirección)
    const DIRS = ['fwd', 'back', 'left', 'right'];
    const walkW = DIRS.reduce((a, k) => a + (P.lower['walk_' + k] || 0), 0), moveW = walkW + (P.lower.crouch_walk || 0);
    const k10 = Math.min(1, dt * 10);
    let back = false;
    if (P.sp > 0.3) {
      const L = legPlan(st.vx || 0, st.vz || 0, I.legMode); I.legMode = L.mode;
      let yaw = L.yaw;
      if (crouchT) {   // agachado solo hay clip de frente: hacia atrás se reproduce al revés; giro máximo 60°
        const a = Math.atan2(st.vx || 0, st.vz || 0); back = Math.abs(a) > Math.PI / 2;
        yaw = clamp(back ? a - (a < 0 ? -1 : 1) * Math.PI : a, -1.05, 1.05);
      }
      for (const d of DIRS) I.legW[d] += ((L.w[d] || 0) - I.legW[d]) * k10;
      I.legYaw += (yaw - I.legYaw) * k10;
    } else I.legYaw += (0 - I.legYaw) * k10;
    const wsum = DIRS.reduce((a, d) => a + I.legW[d], 0) || 1;
    if (walkW > 0) for (const d of DIRS) { const w = walkW * I.legW[d] / wsum; if (w > 1e-3) P.lower['walk_' + d] = w; else delete P.lower['walk_' + d]; }
    // fase de la marcha: avanza con la velocidad real dividida por la del clip (pie apoyado sin patinar)
    const nat = DIRS.reduce((v, d) => { const sp = (clips['walk_' + d].info.speed) || 4.5, w = I.legW[d] / wsum;
      v[0] += w * sp * (d === 'left' ? 1 : d === 'right' ? -1 : 0); v[1] += w * sp * (d === 'fwd' ? 1 : d === 'back' ? -1 : 0); return v; }, [0, 0]);
    const walkSpeed = Math.hypot(nat[0], nat[1]);
    const speed = spr ? (clips.sprint.info.speed || 6.5) : crouchT ? (clips.crouch_walk.info.speed || 2.2) : walkSpeed;
    const period = (spr ? clips.sprint : crouchT ? clips.crouch_walk : clips.walk_fwd).full.duration;
    const G = spr ? { stride: 1, rate: P.sp / Math.max(0.5, speed) } : gait(P.sp, speed);
    I.phase = ((I.phase + (back ? -1 : 1) * dt * G.rate / period) % 1 + 1) % 1;
    // zancada corta: parte del peso de la marcha pasa a la postura quieta (el pie recorre menos y sigue sin patinar)
    if (G.stride < 1) for (const k of Object.keys(P.lower)) {
      const rest = k.startsWith('walk_') ? 'idle_rifle' : k === 'crouch_walk' ? 'crouch_idle' : null;
      if (rest) { const w = P.lower[k] * (1 - G.stride); P.lower[k] -= w; P.lower[rest] = (P.lower[rest] || 0) + w; }
    }
    I.t = (I.t || 0) + dt;
    if ((st.dead || 0) > 0) I.dead += dt; else I.dead = 0;
    const set = (name, layer, w, t) => { if (w <= 1e-3) return; const a = action(I, name, layer); if (!a) return; a.enabled = true; a.setEffectiveWeight(w); TT(a, t); used.add(a); };
    for (const [k, w] of Object.entries(P.full)) {
      const d = clips[k].full.duration;
      set(k, 'full', w, k === 'sprint' ? I.phase * d : k.startsWith('death') ? I.dead : (I.t % d));
    }
    for (const [k, w] of Object.entries(P.lower)) {
      const d = clips[k].lower.duration;
      set(k, 'lower', w, P.lowerT[k] != null ? P.lowerT[k] * d : k.startsWith('walk') || k === 'crouch_walk' ? I.phase * d : I.t % d);
    }
    for (const [k, w] of Object.entries(P.upper)) {
      const d = clips[k].upper.duration;
      set(k, 'upper', w, k === P.one ? P.oneT * d : I.t % d);
    }
    for (const [k, w] of Object.entries(P.add)) set(k, 'add', w, P.addT[k] || 0);
    for (const key in I.actions) { const a = I.actions[key]; if (!used.has(a)) { a.setEffectiveWeight(0); a.enabled = false; } }
    I.mixer.update(0);
    initAxes(I.T);
    const yaw = I.legYaw * Math.min(1, moveW);
    if (Math.abs(yaw) > 1e-3 && I.hips && I.spine1) { turnBone(I, I.hips, _Y, yaw); turnBone(I, I.spine1, _Y, -yaw); }
    const K = recoil(q);
    if (I.spine2) { if (Math.abs(K.pitch) > 1e-4) turnBone(I, I.spine2, _X, -K.pitch); if (Math.abs(K.yaw) > 1e-4) turnBone(I, I.spine2, _Y, K.yaw); }
    if (I.head && K.head > 1e-4) turnBone(I, I.head, _X, -K.head);
    P.blend = B; P.recoil = K;
    return P;
  }

  return { plan, blend, blended, recoil, sprintOk, shellT, gait, legPlan, template, create, update, setLod, cloneSkinned, yawBone, AIM_OFFSET, LOWER_BONES, BLEND, KICK };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SDSoldier2;
