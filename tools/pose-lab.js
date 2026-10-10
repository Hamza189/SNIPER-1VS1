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
  const H = (q.get('hip') || '0.074,-0.088,-0.29').split(',').map(Number);
  gun.position.set(lerp(H[0], 0, ads), lerp(H[1], -0.0262, ads), lerp(H[2], -0.335, ads));
  const R = (q.get('rot') || '0.04,0.1,-0.06').split(',').map(Number);
  gun.rotation.set(R[0] * (1 - ads), R[1] * (1 - ads), R[2] * (1 - ads));
  if (q.has('gx')) gun.position.x = +q.get('gx');
  gun.updateMatrixWorld(true);
  const P = SDVM.ARMPOSE[lab];
  const p = new T.Vector3(), qq = new T.Quaternion();
  for (const S of ['R', 'L']) {
    const H = P[S];
    SDVM.handTarget(H, gun.matrixWorld, null, p, qq);
    SDVM.poseArm(rig.sides[S], new T.Vector3(...P.shoulder[S]), p, qq, new T.Vector3(...P.pole[S]).normalize(), SDVM.HANDSETS[H.f]);
  }
  if (q.has('hide')) rig.sides[q.get('hide')].arm.visible = false;
  rig.root.updateMatrixWorld(true);
  window.LAB = { rig, gun };
  if (q.has('fp')) { cam.fov = +(q.get('vfov') || 50); cam.updateProjectionMatrix(); return true; }
  return false;
};
