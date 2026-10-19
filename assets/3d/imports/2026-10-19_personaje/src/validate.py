"""Independent GLB reader, sampled skeletal envelope test (all LODs, 60 Hz).
Does not import the authoring code. Failure is retained in validation.json.
"""
import json,struct,hashlib,math
from pathlib import Path
import numpy as np
from PIL import Image
R=Path(__file__).resolve().parent.parent
raw=(R/'personaje.glb').read_bytes();jl=struct.unpack_from('<I',raw,12)[0];J=json.loads(raw[20:20+jl]);B=raw[28+jl:]
def acc(i):
 a=J['accessors'][i];v=J['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
 return np.frombuffer(B,dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']],count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n).astype(float)
parents={c:i for i,n in enumerate(J['nodes']) for c in n.get('children',[])}
jointids=J['skins'][0]['joints'];ibm=acc(J['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
def matrix(t,q,s):
 x,y,z,w=q;m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(s);m[:3,3]=t;return m
def sample(anim,t):
 trs=[[n.get('translation',[0,0,0]),n.get('rotation',[0,0,0,1]),n.get('scale',[1,1,1])] for n in J['nodes']]
 for node,prop,times,values,interpolation in anim:
  if len(times)==1:v=values[0]
  else:
   hi=min(len(times)-1,max(1,np.searchsorted(times,t)));lo=hi-1;dt=times[hi]-times[lo];u=np.clip((t-times[lo])/dt,0,1);a,b=values[lo],values[hi]
   if interpolation=='CUBICSPLINE':
    a,b=values[3*lo+1],values[3*hi+1];v=(2*u**3-3*u*u+1)*a+(u**3-2*u*u+u)*dt*values[3*lo+2]+(-2*u**3+3*u*u)*b+(u**3-u*u)*dt*values[3*hi]
    if prop==1:v=v/np.linalg.norm(v)
   elif prop==1:
    dot=np.dot(a,b)
    if dot<0:b=-b;dot=-dot
    if dot<.9995:
     theta=math.acos(np.clip(dot,-1,1));v=(math.sin((1-u)*theta)*a+math.sin(u*theta)*b)/math.sin(theta)
    else:v=(1-u)*a+u*b;v=v/np.linalg.norm(v)
   else:v=(1-u)*a+u*b
  trs[node][prop]=v
 world=[]
 for i,tr in enumerate(trs):
  m=matrix(*tr);world.append(world[parents[i]]@m if i in parents else m)
 return np.array([world[i] for i in jointids])@ibm,world
meshes=[]
for m in J['meshes']:
 a=m['primitives'][0]['attributes'];p=acc(a['POSITION']);meshes.append((np.c_[p,np.ones(len(p))],acc(a['JOINTS_0']).astype(int),acc(a['WEIGHTS_0']),acc(a['_ZONE']).reshape(-1)))
errors=[];report={'sha256':hashlib.sha256(raw).hexdigest(),'sampleRate':60,'clips':{},'errors':errors,'textures':{}}
for path in (R/'textures').iterdir():
 im=Image.open(path);report['textures'][path.name]=list(im.size)
 if im.size!=(1024,1024):errors.append('Texture size '+path.name)
for i,(p,j,w,z) in enumerate(meshes):
 if not np.allclose(w.sum(axis=1),1,atol=1e-6):errors.append('Weights not normalized')
 if j.max()>=len(jointids):errors.append('Joint index out of range')
 if not np.isfinite(p).all():errors.append('Non-finite vertex')
for clip in J['animations']:
 name=clip['name'];anim=[]
 for c in clip['channels']:
  s=clip['samplers'][c['sampler']];anim.append((c['target']['node'],{'translation':0,'rotation':1,'scale':2}[c['target']['path']],acc(s['input']).reshape(-1),acc(s['output']),s['interpolation']))
 duration=max(a[2][-1] for a in anim);k=1/1.62 if name.startswith('crouch') else .85/1.62 if name=='slide' else 1
 out={'head':0,'torso':[0,0,0],'legs':[0,0,0],'minY':1e9,'maxY':-1e9,'duration':duration,'loop':clip['extras']['loop'],'lods':3,'samples':0}
 for t in np.linspace(0,duration,max(1,math.ceil(duration*60))+1):
  mats,world=sample(anim,t);out['samples']+=1
  for p,j,w,z in meshes:
   deformed=np.sum(np.einsum('nvij,nj->nvi',mats[j],p)*w[:,:,None],axis=1)[:,:3]
   out['minY']=min(out['minY'],float(deformed[:,1].min()));out['maxY']=max(out['maxY'],float(deformed[:,1].max()))
   hd=deformed[z==0]-[0,1.63*k,0];out['head']=max(out['head'],float(np.max(np.linalg.norm(hd,axis=1)-.15)))
   for zone,key,center,half in [(1,'torso',[0,1.17*k,0],[.245,.31*k,.16]),(2,'legs',[0,.43*k,0],[.19,.43*k,.11])]:
    v=np.maximum(0,np.max(np.abs(deformed[z==zone]-center)-half,axis=0));out[key]=np.maximum(out[key],v).tolist()
 if name.startswith('walk') or name=='sprint':
  speed=7 if name=='sprint' else 4.6;stance=.20 if name=='sprint' else .28;axis=0 if name in ['walk_left','walk_right'] else 2;sign=-1 if name in ['walk_back','walk_right'] else 1
  drift=0
  for side,offset in [('Left',0),('Right',.28)]:
   node=next(i for i,n in enumerate(J['nodes']) if n.get('name')==side+'Foot');contacts=[]
   # Exclude the two 30 Hz segments straddling contact transitions: those are
   # quantified separately by the sampled envelope, not asserted as locked.
   for t in np.arange(0,duration,1/240):
    phase=((t+offset)/.56)%1
    if 1/30/.56<phase<stance-1/30/.56:
     _,world=sample(anim,t);contacts.append((math.floor((t+offset)/.56),world[node][axis,3]+sign*speed*t))
   for cycle in set(c[0] for c in contacts):
    values=[c[1] for c in contacts if c[0]==cycle];drift=max(drift,max(values)-min(values))
  out['interior_stance_ankle_drift_m']=drift
  if drift>.001:errors.append(name+': planted ankle drift '+str(drift))
 strict=name.startswith(('idle','aim','walk','crouch')) or name in ['sprint','slide']
 if strict:
  limits=np.array([.04,.04,.04]);axis=0 if name in ['walk_left','walk_right'] else 2
  if name.startswith('walk') or name=='sprint':limits[axis]=.45
  if out['head']>1e-5:errors.append(name+': head '+str(out['head']))
  if max(out['torso'])>.04001:errors.append(name+': torso '+str(out['torso']))
  if np.any(np.array(out['legs'])>limits+1e-5):errors.append(name+': legs '+str(out['legs']))
 report['clips'][name]=out
print(json.dumps({'clips':report['clips'],'errors':errors},indent=2))
report['passed']=not errors;(R/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
raise SystemExit(0 if not errors else 1)
