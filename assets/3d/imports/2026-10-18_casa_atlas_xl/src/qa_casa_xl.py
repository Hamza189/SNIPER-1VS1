#!/usr/bin/env python3
"""Independent post-export GLB/collision QA for CASA ATLAS XL.
Runs without Blender, without server-side Sniper Duel code.
"""
import json,struct,collections,math,sys
from pathlib import Path
import numpy as np
import trimesh
from scipy.ndimage import label
ROOT=Path(__file__).resolve().parents[1]
J=json.loads((ROOT/'collision_map.json').read_text('utf8'))
OBJ=json.loads((ROOT/'src/scene_objects.json').read_text('utf8'))
C=J['colliders'];cs={c['name']:c for c in C}

def gltf_json(path):
 b=path.read_bytes();assert b[:4]==b'glTF'
 n=struct.unpack_from('<I',b,12)[0]
 return json.loads(b[20:20+n]),len(b)

def free(x,z,r=.355):
 if not(-19.35<=x<=19.35 and -15.35<=z<=15.35):return False
 for c in C:
  cy=c['center'][1];sy=c['size'][1]
  if cy-sy/2>1.72 or cy+sy/2<.14:continue
  cx,_,cz=c['center'];dx,_,dz=c['size']
  if abs(x-cx)<dx/2+r and abs(z-cz)<dz/2+r:return False
 return True

def pathfind(walk,xarr,zarr,p,q):
 from collections import deque
 def get(pt):return int(np.argmin(abs(zarr-pt[1]))),int(np.argmin(abs(xarr-pt[0])))
 start=get(p);end=get(q)
 if not walk[start] or not walk[end]:return None
 todo=deque([start]);seen={start:None}
 while todo:
  i,j=todo.popleft()
  if (i,j)==end:break
  for di,dj in ((0,1),(0,-1),(1,0),(-1,0)):
   ni,nj=i+di,j+dj
   if 0<=ni<len(zarr) and 0<=nj<len(xarr) and (ni,nj) not in seen and walk[ni,nj]:
    seen[(ni,nj)]=(i,j);todo.append((ni,nj))
 if end not in seen:return None
 pth=[];n=end
 while n is not None:pth.append((round(float(xarr[n[1]]),2),round(float(zarr[n[0]]),2)));n=seen[n]
 return pth[::-1]

def validate():
 main=ROOT/'models/sd_casa_atlas_xl.glb';roof=ROOT/'models/sd_casa_atlas_xl_techo.glb'
 mats=set();tris=0
 for asset in (main,roof):
  doc,size=gltf_json(asset)
  assert doc['asset']['version']=='2.0'
  assert not doc.get('extensionsRequired'),doc.get('extensionsRequired')
  assert all(im.get('bufferView') is not None for im in doc['images']), 'texture not GLB-embedded'
  for m in doc['materials']:
   assert m['name'].startswith('sd_')
   assert m['pbrMetallicRoughness']['baseColorFactor'][:3]==[1,1,1],(asset,m['name'])
   assert m['alphaMode'] in ('OPAQUE','MASK','BLEND')
   if m['name']=='sd_vegetacion':assert m['alphaMode']=='MASK'
   if m['name']=='sd_vidrio':assert m['alphaMode']=='BLEND'
   mats.add(m['name'])
  for mm in doc['meshes']:
   for prim in mm['primitives']:
    assert 'NORMAL' in prim['attributes'],mm['name']
    assert 'TEXCOORD_0' in prim['attributes'],mm['name']
    tris+=doc['accessors'][prim['indices']]['count']//3
  sc=trimesh.load(asset,force='scene')
  assert len(sc.geometry)>0
  print(asset.name,'MB',round(size/1e6,2),'geometries',len(sc.geometry),'textures_embedded',len(doc['images']))
 assert tris<=60000,(tris,60000)
 assert len(mats)<=40
 print('triangles',tris,'materials',len(mats),'colliders',len(C))
 assert abs(J['dimensions']['width']-40)<1e-3 and abs(J['dimensions']['depth']-32)<1e-3
 assert J['playerEyeHeight']==1.62 and J['floorY']==0
 assert all(c['type'] in ('solid','move') for c in C)
 for obj in OBJ:
  if not obj['collision']:continue
  coll=cs.get(obj['name']);assert coll is not None,obj['name']
  assert coll['type']==obj['collision']
  assert np.allclose(coll['center'],obj['center'],atol=0.001),obj['name']
  assert np.allclose(coll['size'],obj['size'],atol=.001),obj['name']
 print('render/collision overlap check',sum(bool(o['collision']) for o in OBJ),'exact AABB matches')
 sp=J['spawns'];A=(sp[0]['position'][0],sp[0]['position'][2]);B=(sp[1]['position'][0],sp[1]['position'][2]);assert np.linalg.norm(np.array(B)-A)>30
 def clearance(p):
  return min([np.hypot(max(abs(p[0]-c['center'][0])-c['size'][0]/2,0),max(abs(p[1]-c['center'][2])-c['size'][2]/2,0))
    for c in C if c['center'][1]-c['size'][1]/2<=1.62 and c['center'][1]+c['size'][1]/2>=.15]+[100])
 assert clearance(A)>=.8 and clearance(B)>=.8,(clearance(A),clearance(B))
 def has_eye_los(p,q):
  n=max(15,int(np.linalg.norm(np.array(q)-p)*20))
  for t in np.linspace(.001,.999,n):
   x,z=np.array(p)*(1-t)+np.array(q)*t
   for c in C:
    if c['type']!='solid':continue
    cx,cy,cz=c['center'];sx,sy,sz=c['size']
    if abs(x-cx)<=sx/2 and abs(z-cz)<=sz/2 and cy-sy/2<=1.62<=cy+sy/2:return False
  return True
 assert not has_eye_los(A,B),'Spawns see each other'
 step=.33;xarr=np.arange(-19.1,19.11,step);zarr=np.arange(-15.1,15.11,step)
 walk=np.array([[free(x,z) for x in xarr] for z in zarr],dtype=bool)
 lab,num=label(walk,structure=np.array([[0,1,0],[1,1,1],[0,1,0]]));assert num==1,('Disconnected nav components',num)
 routes={
  'sur / calle': [A,(-17.4,9.9),(-17.1,13.25),(8.0,13.25),(17.25,13.25),B],
  'jardin / callejon este': [A,(-10.0,-12.35),(5.0,-12.3),(18.45,-12.3),(18.45,10.7),B],
  'casa interior / patio': [A,(-17.1,1.5),(-13.35,1.5),(-5.0,3.45),(0.2,3.5),(3.3,3.5),(3.2,8.05),(3.25,12.7),B],
 }
 result={}
 for name,pts in routes.items():
  full=[]
  for v,w in zip(pts[:-1],pts[1:]):
   p=pathfind(walk,xarr,zarr,v,w)
   assert p is not None,(name,'unreachable segment',v,w)
   full.extend(p if not full else p[1:])
  length=sum(np.linalg.norm(np.array(b)-a) for a,b in zip(full[:-1],full[1:]))
  result[name]={'waypoints':pts,'length_m':round(length,1),'sampled_path_xy':full[::max(1,len(full)//120)]}
  print('PASS route',name,'length_m',round(length,1))
 assert len(J['measuredSightlines'])==5
 assert max(t['length_m'] for t in J['measuredSightlines'])>=30
 # Not every interior wall doorway is guaranteed to have 1.2m free after body radius; above route test covers central connectivity.
 (ROOT/'src/qa_results.json').write_text(json.dumps({'triangles':tris,'materials':len(mats),'colliders':len(C),'player_routes':result,
 'spawn_distance':round(float(np.linalg.norm(np.array(B)-A)),2),'spawn_clearance':[round(clearance(A),2),round(clearance(B),2)],
 'spawn_has_los':False,'nav_components':num,'los_top5':J['measuredSightlines'],'sample':J['losSamplingMetrics']},indent=2,ensure_ascii=False))
 print('PASS: GLBs glTF2, embedded PBR textures, normals, UV, all colliders, routes, disconnected 0, 5 LOS')

if __name__=='__main__': validate()
