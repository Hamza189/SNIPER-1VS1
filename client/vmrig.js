/* First-person models from assets/viewmodels.glb: materials, the gloved arms rig (two-bone IK
   from a fixed shoulder to a hand pose on the weapon, plus finger curls), and the pose tables.
   Pure functions over THREE objects; the page decides when to call them. If the file cannot be
   loaded, the page keeps its procedural models (nothing here is required to play).

   Conventions (game frame, camera space of the viewmodel scene: x right, y up, -z forward):
   - a HAND POSE is {p:[x,y,z], r:[rx,ry,rz]} in the weapon's local space. Rotation r (Euler XYZ,
     radians) turns the rest hand (fingers to -z, back of the hand up, right thumb to -x) onto
     the weapon. The pose's origin is the wrist.
   - a FINGER SET is {index:[a1,a2,a3], middle, ring, pinky, thumb:[a1,a2,a3], spread:[i,m,r,p],
     thumbYaw}: curls in radians (positive = closing towards the palm). */
(function (G) {
  'use strict';
  let T = null;
  const FINGERS = ['index', 'middle', 'ring', 'pinky'];

  // ------------------------------------------------------------------ materials
  // The file carries plain colours; here each material gets its final look (tuned for the game's
  // lighting, which renders without sRGB output), plus small canvas detail maps.
  const LOOK = {
    // VÍBORA 9
    P_slide: { c: 0x2b2e33, m: 0.72, r: 0.38, env: 1.0, detail: 'brushed', ns: 0.1 },
    P_frame: { c: 0x1b1b1b, m: 0.0, r: 0.55, env: 0.5 },
    P_grip: { c: 0x1c1c1b, m: 0.0, r: 0.9, env: 0.35, detail: 'stipple', ns: 1.0 },
    P_steel: { c: 0x8e9298, m: 0.95, r: 0.28, env: 1.25 },
    P_barrel: { c: 0x9a7a48, m: 1.0, r: 0.32, env: 1.2 },
    P_accent: { c: 0xe0702a, m: 0.0, r: 0.5, env: 0.4, e: 0x2a0d00 },
    P_dotG: { basic: 0x9dff6a },
    P_dotY: { basic: 0xffe066 },
    P_brass: { c: 0xd9a650, m: 1.0, r: 0.26, env: 1.3 },
    P_black: { c: 0x101113, m: 0.2, r: 0.65, env: 0.4 },
    // arms
    A_glove: { c: 0x1c1c1b, m: 0.0, r: 0.9, env: 0.35, detail: 'weave', ns: 0.45 },
    A_pad: { c: 0x2e2d2a, m: 0.0, r: 0.55, env: 0.5 },
    A_cuff: { c: 0x232220, m: 0.0, r: 0.9, env: 0.3, detail: 'weave', ns: 0.5 },
    A_sleeve: { c: 0x3b3e2e, m: 0.0, r: 0.97, env: 0.25, detail: 'twill', ns: 0.25 },
  };
  const DETAIL = {};
  function detailTex(kind) {
    if (DETAIL[kind]) return DETAIL[kind];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    if (!g) return null;
    // a height field drawn in grey, turned into a normal map
    const H = new Float32Array(128 * 128);
    const rnd = (() => { let s = 1234567; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    if (kind === 'stipple') { for (let i = 0; i < 1400; i++) { const x = rnd() * 128, y = rnd() * 128, r = 1.2 + rnd() * 1.6; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const d = Math.hypot(dx, dy) / r; if (d < 1) { const X = (Math.floor(x) + dx + 128) & 127, Y = (Math.floor(y) + dy + 128) & 127; H[Y * 128 + X] = Math.max(H[Y * 128 + X], Math.sqrt(1 - d * d)); } } } }
    else if (kind === 'weave') { for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const a = Math.sin(x * Math.PI / 4) * Math.sin(y * Math.PI / 4); H[y * 128 + x] = 0.5 + 0.5 * (((x >> 2) + (y >> 2)) & 1 ? a : -a) + rnd() * 0.15; } }
    else if (kind === 'twill') { for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) H[y * 128 + x] = 0.5 + 0.5 * Math.sin((x + y) * Math.PI / 3) + rnd() * 0.2; }
    else if (kind === 'brushed') { let v = 0.5; for (let y = 0; y < 128; y++) { v = 0.5; for (let x = 0; x < 128; x++) { v += (rnd() - 0.5) * 0.1; H[y * 128 + x] = v + (rnd() - 0.5) * 0.3; } } }
    const img = g.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const h = (X, Y) => H[((Y + 128) & 127) * 128 + ((X + 128) & 127)];
      const nx = h(x - 1, y) - h(x + 1, y), ny = h(x, y - 1) - h(x, y + 1), nz = 0.5;
      const l = Math.hypot(nx, ny, nz), i = (y * 128 + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    return (DETAIL[kind] = t);
  }
  function refine(root, THREE_, envMap, opts) {
    T = THREE_; opts = opts || {};
    const made = {};
    root.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map(m => {
        const L = LOOK[m.name];
        if (!L) return m;
        if (made[m.name]) return made[m.name];
        let n;
        if (L.basic != null) n = new T.MeshBasicMaterial({ color: L.basic });
        else {
          n = new T.MeshStandardMaterial({ color: L.c, metalness: L.m, roughness: L.r, envMap: envMap || null, envMapIntensity: L.env == null ? 1 : L.env, emissive: L.e || 0 });
          if (L.detail && !opts.low) { const t = detailTex(L.detail); if (t) { n.normalMap = t; n.normalScale = new T.Vector2(L.ns, L.ns); } }
        }
        if (o.isSkinnedMesh) n.skinning = true;
        n.name = m.name;
        return (made[m.name] = n);
      });
      o.material = Array.isArray(o.material) ? out : out[0];
      o.frustumCulled = false;
    });
    return made;
  }

  // ------------------------------------------------------------------ arms rig
  const _v = () => new T.Vector3(), _q = () => new T.Quaternion();
  function createArms(gltfRoot, THREE_) {
    T = THREE_;
    const rig = { sides: {} };
    for (const S of ['R', 'L']) {
      const arm = gltfRoot.getObjectByName('ARM_' + S);
      if (!arm) return null;
      const bones = {};
      arm.traverse(o => { if (o.isBone && o.name.startsWith(S + '_')) bones[o.name.slice(2)] = o; });
      arm.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(arm.matrixWorld).invert();
      const rest = {};
      for (const k in bones) {
        const b = bones[k], m = new T.Matrix4().multiplyMatrices(inv, b.matrixWorld);
        const p = _v(), q = _q(), s = _v(); m.decompose(p, q, s);
        rest[k] = { p, q, lq: b.quaternion.clone(), lp: b.position.clone() };
      }
      const len = (a, b) => rest[a].p.distanceTo(rest[b].p);
      const side = { S, arm, bones, rest, L1: len('upper', 'fore'), L2: len('fore', 'hand'), mesh: null };
      arm.traverse(o => { if (o.isSkinnedMesh) side.mesh = o; });
      // rest axes of the arm (camera space before posing): forward and the back of the hand
      side.f0 = rest.hand.p.clone().sub(rest.fore.p).normalize();
      side.u0 = new T.Vector3(0, 1, 0);
      rig.sides[S] = side;
    }
    rig.root = new T.Group();
    for (const S of ['R', 'L']) rig.root.add(rig.sides[S].arm);
    return rig;
  }
  // rotation taking (f0, u0) onto (f, u)
  const _m1 = () => new T.Matrix4(), TMP = {};
  function basisQ(f, u, out) {
    const z = TMP.z || (TMP.z = _v()), x = TMP.x || (TMP.x = _v()), y = TMP.y || (TMP.y = _v()), m = TMP.m || (TMP.m = _m1());
    z.copy(f).negate().normalize(); x.crossVectors(u, z); if (x.lengthSq() < 1e-8) x.set(1, 0, 0); x.normalize(); y.crossVectors(z, x);
    m.makeBasis(x, y, z); return out.setFromRotationMatrix(m);
  }
  function setWorld(bone, parentWorld, pos, q) {
    const M = TMP.M || (TMP.M = _m1()), P = TMP.P || (TMP.P = _m1()), s = TMP.s || (TMP.s = new T.Vector3(1, 1, 1));
    M.compose(pos, q, s);
    P.copy(parentWorld).invert();
    bone.matrix.multiplyMatrices(P, M);
    bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
    bone.matrixWorld.copy(M);
  }
  /* Poses one arm. shoulder, wrist: Vector3 in the arm root's space; handQ: Quaternion (rest → pose);
     pole: direction the elbow should bend towards; fingers: finger set; armRootWorld: Matrix4. */
  function poseArm(side, shoulder, wrist, handQ, pole, fingers) {
    const r = side.rest, b = side.bones;
    // the forearm follows the hand (a natural wrist): the elbow sits behind the wrist along the
    // hand's long axis, leaning towards the shoulder by `lean`; the upper arm (off screen) just
    // points from the shoulder to that elbow
    const S = shoulder, Wr = TMP.Wr || (TMP.Wr = _v());
    Wr.copy(wrist);
    const L1 = side.L1, L2 = side.L2, lean = side.lean == null ? 0.35 : side.lean;
    const back = TMP.back || (TMP.back = _v()); back.set(0, 0, 1).applyQuaternion(handQ);
    const toS = TMP.toS || (TMP.toS = _v()); toS.subVectors(S, Wr).normalize();
    back.lerp(toS, lean);
    // keep the elbow on the pole side (below the screen) when the hand points up
    back.addScaledVector(pole, 0.25).normalize();
    const E = TMP.E || (TMP.E = _v()); E.copy(Wr).addScaledVector(back, L2);
    const Sx = TMP.Sx || (TMP.Sx = _v()); Sx.subVectors(E, S).normalize();
    const S2 = TMP.S2 || (TMP.S2 = _v()); S2.copy(E).addScaledVector(Sx, -L1);
    const d = S.distanceTo(Wr), maxR = L1 + L2;
    // the hand's own frame decides the forearm's roll (sleeve and cuff follow the wrist)
    const hu = TMP.hu || (TMP.hu = _v()); hu.set(0, 1, 0).applyQuaternion(handQ);
    const q0 = TMP.q0 || (TMP.q0 = _q()), q1 = TMP.q1 || (TMP.q1 = _q()), qr = TMP.qr || (TMP.qr = _q()), qq = TMP.qq || (TMP.qq = _q());
    basisQ(side.f0, side.u0, q0); q0.invert();
    const fu = TMP.fu || (TMP.fu = _v()), fd = TMP.fd || (TMP.fd = _v());
    const root = side.arm; root.updateMatrixWorld(true);
    // upper arm
    fd.subVectors(E, S2).normalize(); fu.copy(hu).addScaledVector(fd, -hu.dot(fd)); if (fu.lengthSq() < 1e-6) fu.set(0, 1, 0);
    basisQ(fd, fu.normalize(), q1); qr.multiplyQuaternions(q1, q0); qq.multiplyQuaternions(qr, r.upper.q);
    setWorld(b.upper, b.upper.parent.matrixWorld, S2, qq);
    // forearm
    fd.subVectors(Wr, E).normalize(); fu.copy(hu).addScaledVector(fd, -hu.dot(fd)); if (fu.lengthSq() < 1e-6) fu.set(0, 1, 0);
    basisQ(fd, fu.normalize(), q1); qr.multiplyQuaternions(q1, q0); qq.multiplyQuaternions(qr, r.fore.q);
    setWorld(b.fore, b.upper.matrixWorld, E, qq);
    // hand: exactly the requested orientation, at the (reachable) wrist
    qq.multiplyQuaternions(handQ, r.hand.q);
    setWorld(b.hand, b.fore.matrixWorld, Wr, qq);
    curl(side, fingers);
    return d <= maxR;
  }
  // finger curls are rotations about rest-space axes, applied in each bone's own frame
  const AX = {};
  function restAxis(side, bone, axis) {
    const k = side.S + bone + axis.join(',');
    if (AX[k]) return AX[k];
    const q = side.rest[bone].q.clone().invert();
    return (AX[k] = new T.Vector3(...axis).normalize().applyQuaternion(q));
  }
  const _qa = () => TMP.qa || (TMP.qa = _q());
  function curl(side, F) {
    if (!F) return;
    const s = side.S === 'R' ? 1 : -1, b = side.bones, r = side.rest, qa = _qa();
    for (let fi = 0; fi < 4; fi++) {
      const name = FINGERS[fi], c = F[name] || [0, 0, 0], sp = F.spread ? F.spread[fi] : 0;
      for (let j = 0; j < 3; j++) {
        const bn = name + (j + 1), bone = b[bn];
        bone.quaternion.copy(r[bn].lq);
        qa.setFromAxisAngle(restAxis(side, bn, [1, 0, 0]), -c[j]); bone.quaternion.multiply(qa);
        if (j === 0 && sp) { qa.setFromAxisAngle(restAxis(side, bn, [0, 1, 0]), -sp * s); bone.quaternion.multiply(qa); }
      }
    }
    // thumb: opposition (towards the palm, around the hand's long axis) on the first bone, then flexion
    const t = F.thumb || [0, 0, 0];
    for (let j = 0; j < 3; j++) {
      const bn = 'thumb' + (j + 1), bone = b[bn];
      bone.quaternion.copy(r[bn].lq);
      if (j === 0) {
        if (F.thumbYaw) { qa.setFromAxisAngle(restAxis(side, bn, [0, 0, 1]), F.thumbYaw * s); bone.quaternion.multiply(qa); }
        if (F.thumbRoll) { qa.setFromAxisAngle(restAxis(side, bn, [0, 1, 0]), F.thumbRoll * s); bone.quaternion.multiply(qa); }
      }
      qa.setFromAxisAngle(restAxis(side, bn, [0.55 * s, 0.25, 1]), t[j] * s); bone.quaternion.multiply(qa);
    }
  }
  // mixes two finger sets (w: 0 → a, 1 → b)
  function mixFingers(a, b, w, out) {
    out = out || {};
    for (const k of FINGERS.concat(['thumb'])) { const A = a[k] || [0, 0, 0], B = b[k] || [0, 0, 0]; out[k] = [A[0] + (B[0] - A[0]) * w, A[1] + (B[1] - A[1]) * w, A[2] + (B[2] - A[2]) * w]; }
    const sa = a.spread || [0, 0, 0, 0], sb = b.spread || [0, 0, 0, 0];
    out.spread = sa.map((x, i) => x + (sb[i] - x) * w);
    out.thumbYaw = (a.thumbYaw || 0) + ((b.thumbYaw || 0) - (a.thumbYaw || 0)) * w;
    out.thumbRoll = (a.thumbRoll || 0) + ((b.thumbRoll || 0) - (a.thumbRoll || 0)) * w;
    return out;
  }
  // hand pose (weapon space) → wrist position and rotation in the arm root's space
  function handTarget(pose, weaponWorld, rootInv, outP, outQ) {
    const m = TMP.hm || (TMP.hm = _m1()), e = TMP.he || (TMP.he = new T.Euler()), s = TMP.hs || (TMP.hs = new T.Vector3(1, 1, 1));
    const p = TMP.hp || (TMP.hp = _v()), q = TMP.hq || (TMP.hq = _q());
    if (pose.p) p.fromArray(pose.p); else p.set(0, 0, 0);
    if (pose.b) { // basis form: where the hand's x (index → pinky on the right hand) and y (back of the hand) point
      const x = TMP.bx || (TMP.bx = _v()), y = TMP.by || (TMP.by = _v()), z = TMP.bz || (TMP.bz = _v()), mm = TMP.bm || (TMP.bm = _m1());
      x.fromArray(pose.b[0]).normalize(); y.fromArray(pose.b[1]); y.addScaledVector(x, -y.dot(x)).normalize(); z.crossVectors(x, y);
      mm.makeBasis(x, y, z); q.setFromRotationMatrix(mm);
      if (pose.r) { e.set(pose.r[0], pose.r[1], pose.r[2], 'XYZ'); q.multiply((TMP.hq2 || (TMP.hq2 = _q())).setFromEuler(e)); }
    } else { e.set(pose.r[0], pose.r[1], pose.r[2], 'XYZ'); q.setFromEuler(e); }
    if (pose.at) { // place by an anchor on the hand (default: the middle knuckle) instead of the wrist
      const an = TMP.ha || (TMP.ha = _v());
      an.fromArray(pose.anchor || [pose.left ? 0.0085 : -0.0085, 0, -0.089]).applyQuaternion(q);
      p.fromArray(pose.at).sub(an);
    }
    m.compose(p, q, s); m.premultiply(weaponWorld); if (rootInv) m.premultiply(rootInv);
    m.decompose(outP, outQ, s);
  }

  // ------------------------------------------------------------------ pose tables
  const HANDSETS = {
    relaxed: { index: [0.25, 0.3, 0.2], middle: [0.3, 0.35, 0.2], ring: [0.35, 0.4, 0.2], pinky: [0.4, 0.45, 0.2], thumb: [0.1, 0.1, 0.1] },
    // VÍBORA 9: strong hand round the grip, trigger finger on the trigger
    pistolR: { index: [0.25, 0.75, 0.35], middle: [1.45, 1.55, 0.55], ring: [1.5, 1.55, 0.55], pinky: [1.5, 1.5, 0.55], thumb: [0.35, 0.15, 0.1], spread: [0.05, 0, -0.04, -0.1], thumbYaw: 0.5, thumbRoll: 0 },
    pistolL: { index: [1.25, 1.3, 0.5], middle: [1.3, 1.35, 0.55], ring: [1.35, 1.35, 0.55], pinky: [1.35, 1.35, 0.55], thumb: [0.1, 0.05, 0.05], spread: [0.04, 0, -0.03, -0.08], thumbYaw: 0.15 },
    magHold: { index: [0.55, 0.6, 0.3], middle: [0.9, 0.95, 0.4], ring: [1.0, 1.0, 0.45], pinky: [1.05, 1.05, 0.45], thumb: [0.55, 0.35, 0.2], thumbYaw: 0.6 },
    slap: { index: [0.15, 0.15, 0.1], middle: [0.15, 0.15, 0.1], ring: [0.2, 0.2, 0.1], pinky: [0.25, 0.25, 0.1], thumb: [0.05, 0.05, 0.05] },
    rack: { index: [1.1, 1.2, 0.5], middle: [1.2, 1.25, 0.5], ring: [1.25, 1.25, 0.5], pinky: [1.25, 1.25, 0.5], thumb: [0.5, 0.4, 0.2], thumbYaw: 0.5 },
  };

  // where each hand holds each weapon (weapon space), the shoulders and elbow directions (camera space)
  const D19 = [0, -0.946, 0.326], F19 = [0, -0.326, -0.946];
  const ARMPOSE = {
    pistol: {
      shoulder: { R: [0.22, -0.45, 0.1], L: [-0.22, -0.47, 0.1] },
      pole: { R: [0.8, -1, 0.2], L: [-0.8, -1, 0.2] },
      R: { f: 'pistolR', at: [0.028, -0.078, 0.0], b: [D19, [1, 0, 0]], r: [0, 0.77, 0] },
      L: { f: 'pistolL', left: true, at: [-0.042, -0.08, -0.012], b: [[0, 0.946, -0.326], [-1, 0, 0]], r: [0, -0.77, 0] },
    },
  };

  G.SDVM = { ARMPOSE, refine, createArms, poseArm, curl, mixFingers, handTarget, HANDSETS, LOOK };
})(typeof window !== 'undefined' ? window : globalThis);
