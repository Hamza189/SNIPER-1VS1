/* PUEBLO 3.0 fauna: street rats (Poly Haven "street_rat", CC0, Sean Buckley).
   The Blender file kept the weights of its original Rigify rig; tools/fauna/rat_rig.py rebuilt a light skeleton on them
   (19 bones: hips, chest, neck, head, ears, four tail bones, two segments per leg), simplified the mesh 14 286 → 3 568 triangles
   (17-10-2026: identical at 2 m, ~32 000 triangles less for three rats) and exported assets/3d/fauna/rat.glb.
   Here: a small ambient brain and a procedural animation of those bones (legs in a diagonal trot, spine, head, ears and tail),
   with no physics, no server and no effect on bullets, collisions or gameplay.
   States: idle (breathes, looks around) · sniff (head down, quick nose nods) · explore (walks along walls inside its patch) ·
   flee (runs to its drain when the player comes close or a shot is heard) · hidden (down the drain; comes back out later). */
const SDRats = (() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const CFG = {
    scale: 2.43,            // the scan measures 14.8 cm nose to tail tip; a street rat is ~36 cm
    walk: 0.32, run: 2.6,   // m/s
    turnWalk: 3.2, turnRun: 9,
    fear: 4.5,              // m: the player closer than this → flee
    hearShot: 30,           // m: a shot within this distance → flee
    safe: 9,                // m: comes back out of the drain only when the player is farther than this
    patch: 3.2,             // m: how far from its drain a rat wanders
    wall: 0.7,              // m: rats keep close to walls (thigmotaxis): targets near a wall are preferred
  };
  // a deterministic random per rat (same rats on every device for the same seed)
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  // ---------- brain (pure: testable without WebGL) ----------
  function brain(home, seed, world) {
    const R = rng(seed);
    const b = { x: home.x + 0.6, z: home.z + 0.4, yaw: R() * TAU, speed: 0, state: 'idle', t: 1 + R() * 2, tx: 0, tz: 0, home, R,
      sink: 0, visible: true, stuck: 0, lastShot: 0, events: [] };
    const set = (s, t) => { b.state = s; b.t = t; b.events.push(s); if (b.events.length > 40) b.events.shift(); };
    function pickTarget() {
      let best = null, bs = -1e9;
      for (let i = 0; i < 10; i++) {
        const a = R() * TAU, r = 0.6 + R() * CFG.patch, x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r;
        if (world.blocked(x, z) || !world.clear(b.x, b.z, x, z)) continue;
        const w = world.wallDist(x, z), score = (w < CFG.wall ? 2 : 0) - w * 0.4 + R() * 0.8;
        if (score > bs) { bs = score; best = [x, z]; }
      }
      return best;
    }
    b.update = (dt, P) => {
      const dp = Math.hypot(P.x - b.x, P.z - b.z);
      const shot = P.shotAt && P.shotAt !== b.lastShot && Math.hypot(P.shotX - b.x, P.shotZ - b.z) < CFG.hearShot;
      if (P.shotAt) b.lastShot = P.shotAt;
      if (b.state !== 'flee' && b.state !== 'hidden' && (dp < CFG.fear || shot)) { set('flee', 12); b.tx = home.x; b.tz = home.z; }
      b.t -= dt;
      let want = 0;
      if (b.state === 'idle' || b.state === 'sniff') {
        if (b.t <= 0) { const r = R();
          if (r < 0.55) { const tg = pickTarget(); if (tg) { b.tx = tg[0]; b.tz = tg[1]; set('explore', 8); } else set('sniff', 1.5 + R() * 2); }
          else if (r < 0.8 && b.state !== 'sniff') set('sniff', 1.5 + R() * 2); else set('idle', 1.5 + R() * 3); }
      } else if (b.state === 'explore' || b.state === 'flee') {
        const run = b.state === 'flee', dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
        if (d < (run ? 0.18 : 0.12)) {
          if (run) { set('hidden', 5 + R() * 7); b.x = b.tx; b.z = b.tz; }
          else set(R() < 0.6 ? 'sniff' : 'idle', 1 + R() * 2.5);
        } else if (b.t <= 0 && !run) set('idle', 1);
        else {
          // steer: the straight way, or the nearest free heading (rats slip round obstacles)
          let head = Math.atan2(dx, dz);
          const step = 0.25;
          if (world.blocked(b.x + Math.sin(head) * step, b.z + Math.cos(head) * step)) {
            let ok = null;
            for (const off of [0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) { const h = head + off; if (!world.blocked(b.x + Math.sin(h) * step, b.z + Math.cos(h) * step)) { ok = h; break; } }
            if (ok === null) { b.stuck += dt; if (b.stuck > 1.5) { b.stuck = 0; if (run) { b.x = b.tx; b.z = b.tz; } else set('idle', 1); } }
            else head = ok;
          } else b.stuck = 0;
          const turn = (run ? CFG.turnRun : CFG.turnWalk) * dt;
          b.yaw += clamp(angDiff(b.yaw, head), -turn, turn);
          // slow down to turn on the spot when facing away
          want = (run ? CFG.run : CFG.walk) * clamp(1 - Math.abs(angDiff(b.yaw, head)) / 1.6, 0.15, 1);
        }
      } else if (b.state === 'hidden') {
        if (b.t <= 0 && dp > CFG.safe) set('idle', 1 + R() * 2);
      }
      // speed eases in/out (no instant starts); move only to free ground
      b.speed += (want - b.speed) * Math.min(1, dt * (want > b.speed ? 6 : 9));
      if (b.speed > 0.01) {
        const nx = b.x + Math.sin(b.yaw) * b.speed * dt, nz = b.z + Math.cos(b.yaw) * b.speed * dt;
        if (!world.blocked(nx, nz)) { b.x = nx; b.z = nz; } else b.speed *= 0.3;
      }
      // down the drain and back up
      b.sink += ((b.state === 'hidden' ? 1 : 0) - b.sink) * Math.min(1, dt * 5);
      b.visible = b.sink < 0.97;
    };
    return b;
  }

  // ---------- body: procedural animation of the rebuilt skeleton ----------
  function body(T, root, seed) {
    const R = rng(seed ^ 0x9e3779b9), bones = {};
    root.traverse(o => { if (o.isBone) bones[o.name] = o; });
    root.updateMatrixWorld(true);
    // each bone's rest frame relative to the rat (identity orientation at load): rotations are written in the rat's frame
    // (X = its left, Y = up, Z = forward) and converted to the bone's local frame — independent of how the exporter rolled them
    const inv = new T.Quaternion(), rq = new T.Quaternion(), rootInv = new T.Quaternion(); root.getWorldQuaternion(rootInv); rootInv.invert();
    const B = {};
    for (const n in bones) { const bn = bones[n], w = new T.Quaternion(); bn.getWorldQuaternion(w); w.premultiply(rootInv);
      B[n] = { bone: bn, rest: bn.quaternion.clone(), restS: bn.scale.clone(), w, wi: w.clone().invert() }; }
    const e = new T.Euler(), q = new T.Quaternion();
    // three's glTF loader strips dots from node names ('arm.L' → 'armL'): look the bones up the same way
    const rot = (n, x, y, z) => { const b = B[n.replace(/\./g, '')]; if (!b) return; e.set(x, y, z, 'YXZ'); q.setFromEuler(e);
      rq.copy(b.wi).multiply(q).multiply(b.w); b.bone.quaternion.copy(b.rest).multiply(rq); };
    const a = { phase: 0, look: 0, lookT: 0, lookTo: 0, ear: [0, 0], earT: 1, tailT: R() * 10, breath: R() * 6, sniffT: 0, crouch: 0 };
    const missing = ['hips', 'chest', 'neck', 'head', 'ear.L', 'ear.R', 't1', 't2', 't3', 't4', 'hip.L', 'hip.R', 'rfoot.L', 'rfoot.R', 'arm.L', 'arm.R', 'ffoot.L', 'ffoot.R']
      .filter(n => !B[n.replace(/\./g, '')]);
    return {
      bones: B, missing,
      update(dt, st) {
        const sp = st.speed, run = clamp((sp - 0.6) / 1.6, 0, 1), moving = clamp(sp / 0.25, 0, 1);
        // gait: stride frequency grows with speed (walk ~3 Hz, run ~9 Hz)
        a.phase += dt * TAU * (sp < 0.02 ? 0 : 2.4 + sp * 2.6);
        const ph = a.phase, s = Math.sin(ph), c = Math.cos(ph), amp = moving * (0.32 + run * 0.28);
        const lift = k => Math.max(0, Math.sin(ph + k)) * moving * (0.35 + run * 0.35);
        // diagonal trot: left hind + right fore together
        rot('hip.L', -amp * s, 0, 0); rot('arm.R', -amp * s * 0.9, 0, 0);
        rot('hip.R', amp * s, 0, 0); rot('arm.L', amp * s * 0.9, 0, 0);
        rot('rfoot.L', lift(Math.PI / 2), 0, 0); rot('ffoot.R', -lift(Math.PI / 2) * 0.8, 0, 0);
        rot('rfoot.R', lift(-Math.PI / 2), 0, 0); rot('ffoot.L', -lift(-Math.PI / 2) * 0.8, 0, 0);
        // spine: a little sideways wave while walking, a gallop arch while running; breathing at rest
        a.breath += dt * TAU * (st.state === 'flee' || st.state === 'hidden' ? 2.4 : 1.1);
        const br = Math.sin(a.breath) * (1 - moving);
        rot('hips', -run * 0.12 * Math.sin(ph * 2), s * 0.07 * moving, 0); rot('chest', run * 0.1 * Math.sin(ph * 2), -s * 0.08 * moving, 0);
        B.chest && B.chest.bone.scale.set(1 + br * 0.03, 1, 1 + br * 0.03);
        // head: looks around at rest, follows the way when walking, nose down when sniffing (quick nods)
        a.lookT -= dt; if (a.lookT <= 0) { a.lookTo = (R() * 2 - 1) * 0.6; a.lookT = 0.6 + R() * 1.8; }
        a.look += (a.lookTo * (1 - moving * 0.7) - a.look) * Math.min(1, dt * 5);
        const sniff = st.state === 'sniff' ? 1 : 0; a.sniffT += dt;
        a.crouch += ((st.state === 'flee' ? 0.6 : sniff * 0.8) - a.crouch) * Math.min(1, dt * 4);
        const nod = sniff * (Math.sin(a.sniffT * TAU * 6.5) * 0.06 + Math.sin(a.sniffT * TAU * 1.3) * 0.08);
        rot('neck', a.crouch * 0.28 + nod * 0.5, a.look * 0.5, 0); rot('head', a.crouch * 0.22 + nod - run * 0.1, a.look * 0.5, 0);
        // ears: an occasional twitch, flat back when fleeing
        a.earT -= dt; if (a.earT <= 0) { a.ear[R() < 0.5 ? 0 : 1] = 0.5; a.earT = 0.8 + R() * 3; }
        a.ear[0] *= Math.exp(-dt * 8); a.ear[1] *= Math.exp(-dt * 8);
        const back = st.state === 'flee' ? -0.6 : 0;
        rot('ear.L', back - a.ear[0], 0, a.ear[0] * 0.6); rot('ear.R', back - a.ear[1], 0, -a.ear[1] * 0.6);
        // tail: a travelling wave, wider and faster with speed, lifted a little when running
        a.tailT += dt * (1.6 + sp * 3);
        for (let i = 1; i <= 4; i++) rot('t' + i, -run * 0.12 + (i === 1 ? -0.05 : 0.04), Math.sin(a.tailT * TAU * 0.5 - i * 0.9) * (0.06 + i * 0.05) * (0.6 + moving), 0);
        // the whole body bobs a little with the stride
        return Math.abs(Math.sin(ph)) * moving * (0.004 + run * 0.01);
      }
    };
  }
  return { CFG, brain, body, angDiff, rng };
})();
if (typeof module !== 'undefined') module.exports = SDRats;
