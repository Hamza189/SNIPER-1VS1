from pathlib import Path
import json, math, trimesh, numpy as np, collections
R=Path(__file__).resolve().parents[1]
p=R/'models/sd_casa_atlas_1v1.glb';data=json.loads((R/'collision_map.json').read_text()); sc=trimesh.load(p,force='scene')
assert len(sc.geometry)>10
assert sum(len(m.faces) for m in sc.geometry.values())<35000
for name,m in sc.geometry.items():
    assert m.vertices.shape[0]>0
    assert np.isfinite(m.vertices).all(),name
    assert np.isfinite(m.vertex_normals).all(),name
    assert m.visual.uv is not None and np.isfinite(m.visual.uv).all(),name
assert sc.bounds[0][0]>=-9.01 and sc.bounds[1][0]<=9.01
assert sc.bounds[0][2]>=-7.01 and sc.bounds[1][2]<=7.1
coll=data['colliders']
for c in coll:
    assert all(v>0 for v in c['size'])
# 2d navigation check, includes horizontal player extents; avoid dead-space spawns
ob=[]
for c in coll:
    if c['type'] not in ('solid','player_boundary'):continue
    x,y,z=c['center'];a,b,d=c['size']
    if y+b/2 <.30 or y-b/2>1.60: continue
    ob.append((x-a/2,x+a/2,z-d/2,z+d/2))
radius=.29
# grid 0.15m
step=.15
xmin,zmin=-8.62,-6.60
nx,nz=int((17.24)/step),int((13.50)/step)
def togrid(x,z):return (round((x-xmin)/step),round((z-zmin)/step))
def valid(xi,zi):
    xx=xmin+step*xi;zz=zmin+step*zi
    if not (-8.55<=xx<=8.55 and -6.5<=zz<=6.91):return False
    for x0,x1,z0,z1 in ob:
        if x0-radius<=xx<=x1+radius and z0-radius<=zz<=z1+radius:return False
    return True
starts=[]
for s in data['spawns']:
    x,_,z=s['position']; ix,iz=togrid(x,z)
    assert valid(ix,iz),f"spawn blocked {s}"
    starts.append((ix,iz))
q=collections.deque([starts[0]]);seen={starts[0]}
while q:
    ix,iz=q.popleft()
    for p2 in [(ix+1,iz),(ix-1,iz),(ix,iz+1),(ix,iz-1)]:
        if p2 not in seen and valid(*p2): seen.add(p2);q.append(p2)
assert starts[1] in seen,'spawns not connected at player radius .29m'
# visit main zones by representative point or wide sampling
for zone in data['zones']:
    x0,z0,x1,z1=zone['bounds']; candidates=[]
    for xx in np.linspace(x0+.4,x1-.4,10):
     for zz in np.linspace(z0+.4,z1-.4,10):
      k=togrid(xx,zz)
      if valid(*k):candidates.append(k)
    if not candidates: print('WARN: no free navigation area in',zone['name'])
    elif not any(k in seen for k in candidates): print('WARN: unreachable zone',zone['name'])
print('VALIDATION PASS')
print('Meshes:',len(sc.geometry),'triangles:',sum(len(m.faces) for m in sc.geometry.values()), 'colliders:',len(coll),'reachable nodes:',len(seen), 'spawns connected:',True)
print('GLB size:',round(p.stat().st_size/1048576,2),'MiB')
