/* Pose lab for tools/viewer.html: ?lab=pistol&fp=1 puts the weapon and the arms where the game
   puts them (camera space) so hand poses can be judged from the player's eye or from outside. */
window.POSE = function (g, scene, cam, obj, q) {
  const T = THREE, lab = q.get('lab');
  const rig = SDVM.createArms(g.scene, T);
  if (!rig) { console.log('no arms'); return false; }
  SDVM.refine(rig.root, T, null);
  scene.add(rig.root);
  if (lab === 'hand') {
    obj.visible = false;
    const p = new T.Vector3(0, 0, -0.3), qq = new T.Quaternion();
    SDVM.poseArm(rig.sides.R, new T.Vector3(0.0, -0.05, 0.25), p, qq, new T.Vector3(0, -1, 0), SDVM.HANDSETS[q.get('f') || 'pistolR']);
    rig.sides.L.arm.visible = false; rig.root.updateMatrixWorld(true); return false;
  }
  const gun = obj;
  const ads = +(q.get('ads') || 0);
  const lerp = (a, b, t) => a + (b - a) * t;
  // the game's hip and ADS poses of the VÍBORA 9 (src/page.html, updatePistolVM)
  if (lab === 'knife') { obj.position.set(0.16, -0.15, -0.33); obj.rotation.set(0.28, 0.2, -0.4); obj.updateMatrixWorld(true);
    const p = new T.Vector3(), qq = new T.Quaternion(), A = SDVM.ARMPOSE.knife; SDVM.handTarget(A.R, obj.matrixWorld, null, p, qq); rig.sides.R.lean = A.lean;
    SDVM.poseArm(rig.sides.R, new T.Vector3(...A.shoulder.R), p, qq, new T.Vector3(...A.pole.R).normalize(), SDVM.HANDSETS[A.R.f]); rig.sides.L.arm.visible = false; window.LAB = { rig, gun: obj }; rig.root.updateMatrixWorld(true);
    if (q.has('fp')) { cam.fov = 50; cam.updateProjectionMatrix(); return true; } return false; }
  const defHip = lab === 'rifle' ? '0.15,-0.143,-0.395' : '0.102,-0.053,-0.266', defRot = lab === 'rifle' ? '0,0,0' : '0.12,0.35,-0.15';
  const H = (q.get('hip') || defHip).split(',').map(Number);
  gun.position.set(lerp(H[0], 0, ads), lerp(H[1], -0.0262, ads), lerp(H[2], -0.335, ads));
  const R = (q.get('rot') || defRot).split(',').map(Number);
  gun.rotation.set(R[0] * (1 - ads), R[1] * (1 - ads), R[2] * (1 - ads));
  if (q.has('gx')) gun.position.x = +q.get('gx');
  gun.updateMatrixWorld(true);
  const P = SDVM.ARMPOSE[lab];
  const p = new T.Vector3(), qq = new T.Quaternion();
  for (const S of ['R', 'L']) {
    const H = q.get('hand' + S) ? P[q.get('hand' + S)] : P[S];
    let W = gun.matrixWorld;
    if (H === P.bolt) { const b = gun.getObjectByName('r_bolt'); b.updateMatrixWorld(true); W = b.matrixWorld; }
    if (H === P.mag) { const b = gun.getObjectByName(lab === 'rifle' ? 'r_mag' : 'mag'); b.updateMatrixWorld(true); W = b.matrixWorld; }
    SDVM.handTarget(H, W, null, p, qq);
    SDVM.poseArm(rig.sides[S], new T.Vector3(...P.shoulder[S]), p, qq, new T.Vector3(...P.pole[S]).normalize(), SDVM.HANDSETS[H.f]);
  }
  if (q.has('hide')) rig.sides[q.get('hide')].arm.visible = false;
  rig.root.updateMatrixWorld(true);
  window.LAB = { rig, gun };
  if (q.has('fp')) { cam.fov = +(q.get('vfov') || 50); cam.updateProjectionMatrix(); return true; }
  return false;
};
