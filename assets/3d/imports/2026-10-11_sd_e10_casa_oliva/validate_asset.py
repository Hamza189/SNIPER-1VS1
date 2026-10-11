"""Local checks before handing GLB to Claude's own validator (not a substitute)."""
import os,json,struct,numpy as np,trimesh
DIR=os.path.dirname(__file__);name='sd_e10_casa_oliva';path=os.path.join(DIR,name+'.glb')
b=open(path,'rb').read();magic,ver,length=struct.unpack_from('<4sII',b,0)
assert (magic,ver,length)==(b'glTF',2,len(b)),(magic,ver,length,len(b))
chunklength,chunktype=struct.unpack_from('<I4s',b,12);assert chunktype==b'JSON'
g=json.loads(b[20:20+chunklength]);assert g['asset']['version']=='2.0'
assert not g.get('extensionsRequired') and not g.get('extensionsUsed'), g.get('extensionsUsed')
assert len(g['textures'])>=5 and all('bufferView' in g['images'][i] for i in range(len(g['images'])))
scene=trimesh.load(path,force='scene')
assert len(scene.geometry)>3
for lod,limit,matlim in [(0,15000,8),(1,6000,6),(2,1500,3)]:
 tag=f'{name}_LOD{lod}';assert tag in scene.graph.nodes
 parts=[m for n,m in scene.geometry.items() if f'_LOD{lod}_' in n]
 tris=sum(len(m.faces) for m in parts)
 assert tris<=limit and len(parts)<=matlim,(lod,tris,len(parts))
 pts=np.vstack([m.vertices for m in parts]);assert np.isfinite(pts).all()
 assert pts[:,1].min()>=-1e-4 and pts[:,1].max()<=6.35+1e-4,(pts[:,1].min(),pts[:,1].max())
 body=pts[(pts[:,1]>=.12)&(pts[:,1]<=2)]
 assert max(abs(body[:,0]).max()-3,abs(body[:,2]).max()-5)<=.45+1e-4
 upper=pts[pts[:,1]>2]
 assert max(abs(upper[:,0]).max()-3,abs(upper[:,2]).max()-5)<=1.2+1e-4
 print('LOD',lod,'triangles',tris,'materials',len(parts),'bounds',pts.min(axis=0),pts.max(axis=0))
assert len(b)<=6_000_000
print('RESULTADO: verificaciones locales satisfactorias; validador Claude e iPhone aún pendientes.')
