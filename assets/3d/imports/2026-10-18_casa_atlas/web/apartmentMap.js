/**
 * Sniper Duel: CASA ATLAS 1v1 -- graphics/physics adapter for Three.js r128.
 * Does not patch networking or authoritative map rules. Inject your project's
 * THREE and GLTFLoader to avoid shipping two Three.js versions.
 * Bundled assets: models/sd_casa_atlas_1v1.glb, collision_map.json.
 */
export async function loadCasaAtlas({THREE, GLTFLoader, scene, assetBase = '../', withRoof = false, debugCollisions = false}) {
  if (!THREE || !GLTFLoader || !scene) throw new Error('THREE, GLTFLoader and scene are required');
  const root = assetBase.endsWith('/') ? assetBase : `${assetBase}/`;
  const loader = new GLTFLoader();
  const [mapData, gltf] = await Promise.all([
    fetch(`${root}collision_map.json`).then(r => {if(!r.ok) throw new Error(`collision JSON HTTP ${r.status}`);return r.json()}),
    new Promise((resolve, reject) => loader.load(`${root}models/sd_casa_atlas_1v1.glb`,resolve,undefined,reject))
  ]);
  const group = gltf.scene;
  group.name='CASA_ATLAS_1V1_VISUALS';
  scene.add(group);
  group.traverse(obj => {
    if (!obj.isMesh) return;
    obj.frustumCulled = true;
    // Materials are baked in GLB. Do not multiply/override color blindly.
    obj.castShadow = false; // floor/wall performance budget; enable measured shadow casters if worthwhile.
    obj.receiveShadow = true;
    if (obj.material?.name?.includes('glass')) {obj.material.depthWrite = false;obj.material.transparent = true;}
  });
  let roof=null;
  if(withRoof) {
    const rg=await new Promise((resolve,reject)=>loader.load(`${root}models/sd_casa_atlas_roof_optional.glb`,resolve,undefined,reject));
    roof=rg.scene;roof.name='CASA_ATLAS_CEILING';scene.add(roof);
  }
  // Authoritative server colliders must be populated from exactly this JSON.
  const playerColliders=mapData.colliders.filter(c => c.type === 'solid'||c.type === 'player_boundary');
  const bulletColliders=mapData.colliders.filter(c => c.type === 'solid');
  let debug=null;
  if(debugCollisions) {
    debug=new THREE.Group();debug.name='CASA_ATLAS_COLLISION_DEBUG';
    const geo=new THREE.BoxGeometry(1,1,1);const mat=new THREE.MeshBasicMaterial({color:0xff5722,wireframe:true,transparent:true,opacity:0.3,depthTest:false});
    for(const c of playerColliders){const m=new THREE.Mesh(geo,mat);m.position.set(...c.center);m.scale.set(...c.size);debug.add(m)}
    scene.add(debug);
  }
  return {
    id:mapData.id,
    data:mapData,
    group,roof,debug,
    playerColliders,bulletColliders,
    spawnA:mapData.spawns[0],spawnB:mapData.spawns[1],
    dispose(){
      for(const g of [group,roof,debug])if(g){g.parent?.remove(g);g.traverse(o=>{if(o.geometry) o.geometry.dispose();if(o.material){for(const m of [].concat(o.material)){for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap'])m[k]?.dispose?.();m.dispose?.()}}})}
    }
  };
}
/** Tiny reference-only collision test for WALKABLE POINT; replace with game's capsule/character controller. */
export function canStandAt(x,z,colliders,radius=0.29){
  for(const c of colliders){
    const [cx,cy,cz]=c.center,[w,h,d]=c.size;
    if(cy-h/2>1.62 || cy+h/2<.27)continue;
    if(x>cx-w/2-radius && x<cx+w/2+radius && z>cz-d/2-radius && z<cz+d/2+radius)return false;
  }
  return x>=-8.55 && x<=8.55 && z>=-6.48 && z<=6.89;
}
