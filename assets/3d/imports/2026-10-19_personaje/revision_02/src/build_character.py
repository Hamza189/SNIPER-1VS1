"""Original tactical character. Run in Blender 5.x; outputs self-contained glTF 2.
Coordinates are deliberately authored Y-up/+Z forward, also in the GLB.
The custom writer makes hierarchy, skin weights, LODs and sample times explicit.
"""
import math, json, struct, hashlib
from pathlib import Path
import numpy as np
from mathutils import Vector, Quaternion
R=Path(__file__).resolve().parent.parent
TAU=math.tau
def V(v): return np.asarray(v,dtype=float)
def norm(v): return v/max(np.linalg.norm(v),1e-12)
bones=[]; bi={}; rest=[]; parents=[]
def bone(name,p,pos):
 bi[name]=len(bones);bones.append(name);parents.append(bi[p] if p else -1);rest.append(V(pos))
bone('Root',None,(0,0,0));bone('Hips','Root',(0,.85,0))
for name,p,y in [('Spine','Hips',1.00),('Spine1','Spine',1.17),('Spine2','Spine1',1.37),('Neck','Spine2',1.48),('Head','Neck',1.63)]:bone(name,p,(0,y,0))
bone('Eyes','Head',(0,1.62,.13))
for side,s in [('Left',1),('Right',-1)]:
 bone(side+'Shoulder','Spine2',(s*.19,1.40,0))
 bone(side+'Arm',side+'Shoulder',(s*.245,1.395,0))
 bone(side+'ForeArm',side+'Arm',(s*.30,1.16,.12))
 bone(side+'Hand',side+'ForeArm',(s*(.12 if s>0 else .08),1.14,.42 if s>0 else .25))
 bone(side+'Thumb',side+'Hand',(s*(.12 if s>0 else .08)-s*.038,1.17,.42 if s>0 else .25))
 bone(side+'UpLeg','Hips',(s*.095,.82,0))
 bone(side+'Leg',side+'UpLeg',(s*.095,.43,.012))
 bone(side+'Foot',side+'Leg',(s*.095,.085,0))
 bone(side+'ToeBase',side+'Foot',(s*.095,.035,.09))
rest=np.array(rest)
class Geometry:
 def __init__(self,lod):self.p=[];self.uv=[];self.j=[];self.w=[];self.faces=[];self.z=[];self.parts=[];self.lod=lod
 def vertex(self,p,uv,weights,zone):
  self.p.append(list(p));self.uv.append(uv);ww=list(weights.items());self.j.append([bi[k] for k,v in ww]+[0]*(4-len(ww)));self.w.append([v for k,v in ww]+[0]*(4-len(ww)));self.z.append(zone);return len(self.p)-1
 def loft(self,name,rows,n,tile,zone,axis=(0,1,0),power=2):
  start=len(self.p);fs=len(self.faces);axis=norm(V(axis));u=norm(np.cross(axis,V((0,0,1))))
  if np.linalg.norm(u)<.1:u=V((1,0,0))
  v=norm(np.cross(u,axis)); tx=tile%4;ty=tile//4
  for k,(center,rx,rz,weights) in enumerate(rows):
   for i in range(n+1):
    a=TAU*i/n;c=math.cos(a);s=math.sin(a);c=math.copysign(abs(c)**(2/power),c);s=math.copysign(abs(s)**(2/power),s)
    self.vertex(V(center)+u*c*rx+v*s*rz,[(tx+.04+.92*i/n)/4,(ty+.03+.94*k/max(1,len(rows)-1))/2],weights,zone)
  for k in range(len(rows)-1):
   for i in range(n):
    a=start+k*(n+1)+i;b=a+n+1
    self.faces.extend([(a,b,a+1),(a+1,b,b+1)])
  for k,reverse in [(0,True),(len(rows)-1,False)]:
   a=start+k*(n+1);center,rx,rz,weights=rows[k]
   j=self.vertex(center,[(tx+.5)/4,(ty+.5)/2],weights,zone)
   for i in range(n):self.faces.append((j,a+i,a+i+1) if reverse else (j,a+i+1,a+i))
  self.parts.append({'name':name,'zone':zone,'first':start,'count':len(self.p)-start,'triangles':len(self.faces)-fs})
 def lump(self,name,c,size,joint,tile,zone,n=12,power=3.5):
  x,y,z=c;rx,hy,rz=V(size)/2
  rows=[((x,y-hy,z),rx*.78,rz*.78,{joint:1}),((x,y-hy*.65,z),rx,rz,{joint:1}),((x,y+hy*.65,z),rx,rz,{joint:1}),((x,y+hy,z),rx*.78,rz*.78,{joint:1})]
  if self.lod==2:rows=[rows[0],rows[-1]]
  self.loft(name,rows,max(4,n//(1 if self.lod==0 else 2 if self.lod==1 else 3)),tile,zone,power=power)
 def limb(self,name,a,b,radii,joint,child,tile,zone):
  n=[14,8,6][self.lod];a=V(a);b=V(b);rows=[]
  for t,r in radii:
   w={joint:1}
   if child and t>.88:w={joint:.8,child:.2}
   rows.append((a+(b-a)*t,r,r*.87,w))
  if self.lod==2:rows=[rows[0],rows[len(rows)//2],rows[-1]]
  self.loft(name,rows,n,tile,zone,axis=b-a)
 def finish(self):
  p=np.array(self.p);f=np.array(self.faces);ns=np.zeros_like(p)
  cross=np.cross(p[f[:,1]]-p[f[:,0]],p[f[:,2]]-p[f[:,0]])
  for k in range(3):np.add.at(ns,f[:,k],cross)
  ns/=np.maximum(np.linalg.norm(ns,axis=1)[:,None],1e-12)
  return p,ns,f
def create(lod):
 import sys
 sys.path.insert(0,str(Path(__file__).resolve().parent))
 from design import make_character
 return make_character(lod,Geometry,rest,bi)

clips=[('idle_rifle',2,True),('aim_rifle',2,True),('aim_up',0,False),('aim_down',0,False),('walk_fwd',.42,True),('walk_back',.42,True),('walk_left',.42,True),('walk_right',.42,True),('sprint',.31,True),('crouch_idle',2,True),('crouch_walk',.5,True),('slide',1,True),('jump_start',.3,False),('jump_air',.6,True),('jump_land',.3,False),('fire_rifle',.95,False),('reload_rifle',2.35,False),('idle_pistol',2,True),('aim_pistol',2,True),('fire_pistol',.22,False),('reload_pistol',1.45,False),('fire_shotgun',.25,False),('pump_shotgun',.32,False),('reload_shell',.32,False),('knife_slash',.45,False),('hit_react',.26,False),('death_front',1.25,False),('death_back',1.25,False)]
clips=[(name,.56 if name.startswith('walk') or name=='sprint' else duration,loop) for name,duration,loop in clips]
def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
def rot_x(a):return np.array([[1,0,0],[0,math.cos(a),-math.sin(a)],[0,math.sin(a),math.cos(a)]])
def gait(t,T,speed,stance):
 phase=(t/T)%1;travel=speed*T*stance
 if phase<stance:return travel*(.5-phase/stance),0
 elapsed=(phase-stance)*T;sw=(1-stance)*T;ramp=.012;extra=speed*ramp/2
 # Bounded swing with 12 ms acceleration ramps. Contact moves at -speed;
 # unlike an unconstrained cubic, overshoot is bounded by speed*ramp/2.
 if elapsed<ramp:z=-travel/2-speed*elapsed+speed*elapsed*elapsed/(2*ramp)
 elif elapsed>sw-ramp:
  e=elapsed-(sw-ramp);z=travel/2+extra-speed*e*e/(2*ramp)
 else:
  u=(elapsed-ramp)/(sw-2*ramp);z=(-travel/2-extra)+(travel+2*extra)*smooth(u)
 return z,.15*math.sin(math.pi*elapsed/sw)**2
def pose(name,t,duration):
 p=rest.copy();q=[Quaternion((1,0,0,0)) for _ in bones];k=1
 if name.startswith('crouch'):k=1/1.62
 if name=='slide':k=.85/1.62
 if k!=1:
  p[:,1]*=k
  # Bone scale below preserves the original head size and compresses clothing.
 if name.startswith('walk') or name=='sprint':
  T=.56;speed=7 if name=='sprint' else 4.6;stance=.20 if name=='sprint' else .28
  direction=V({'walk_back':(0,0,-1),'walk_left':(1,0,0),'walk_right':(-1,0,0)}.get(name,(0,0,1)))
  for side,offset in [('Left',0),('Right',T/2)]:
   z,h=gait(t+offset,T,speed,stance)
   for j in ['Foot','ToeBase']:p[bi[side+j]]+=direction*z+V((0,h,0))
   p[bi[side+'Leg']]+=direction*(z*.48+.03*math.sin(TAU*(t+offset)/T))+V((0,h*.6,0))
 if name=='crouch_walk':
  for side,sg in [('Left',1),('Right',-1)]:
   ph=TAU*t/.5+(0 if sg==1 else math.pi);z=.009*math.sin(ph);h=.008*max(0,math.cos(ph))
   for j in ['Leg','Foot','ToeBase']:p[bi[side+j]]+=V((0,h,z))
 if name=='slide':
  for side,sg in [('Left',1),('Right',-1)]:
   for j in ['Leg','Foot','ToeBase']:p[bi[side+j]]+=V((0,0,.009*sg))
 aiming=name.startswith('aim') or name.startswith('fire') or name in ['pump_shotgun','reload_shell']
 if aiming:
  p[bi['RightHand']]=(-.075,1.405,.25);p[bi['LeftHand']]=(-.045,1.405,.49)
  p[bi['RightForeArm']]=(-.32,1.30,.05);p[bi['LeftForeArm']]=(.24,1.19,.16)
 if 'pistol' in name:
  for side,s in [('Right',-1),('Left',1)]:p[bi[side+'Hand']]=(s*.038,1.35 if aiming else 1.14,.47)
 if name=='sprint':
  p[bi['RightHand']]=(-.10,1.10,.22);p[bi['LeftHand']]=(.12,1.25,.33)
 if name.startswith('reload'):
  u=t/max(duration,1e-6);f=math.sin(math.pi*u)**2
  p[bi['LeftHand']]+=V((-.07,-.30*f,-.24*f));p[bi['RightHand']]+=V((0,.06*f,-.02*f))
 if name.startswith('fire'):
  recoil=math.sin(math.pi*min(1,t/.15))*.035 if t<.15 else 0
  for side in ['Left','Right']:p[bi[side+'Hand']]+=V((0,recoil*.3,-recoil))
  if name=='fire_rifle':
   bolt=math.sin(math.pi*max(0,min(1,(t-.25)/.6)))**2
   p[bi['RightHand']]+=V((-.05*bolt,.055*bolt,-.12*bolt))
 if name=='pump_shotgun':p[bi['LeftHand']][2]-=.12*math.sin(math.pi*t/.32)**2
 if name=='knife_slash':
  u=t/.45;f=math.sin(math.pi*u);p[bi['RightHand']]+=V((.45*f,.26*f,.25*f));p[bi['RightForeArm']]+=V((.15*f,.10*f,.1*f))
 if name=='hit_react':
  f=math.sin(math.pi*t/.26);p[bi['Spine2']][2]-=.025*f
 if name in ['jump_start','jump_land']:
  f=math.sin(math.pi*t/.3);p[1:,1]-=.055*f
  for side in ['Left','Right']:
   for j in ['Foot','ToeBase']:p[bi[side+j]]=rest[bi[side+j]]
 if name=='jump_air':
  for side in ['Left','Right']:
   p[bi[side+'Leg']]+=V((0,.05,.06));p[bi[side+'Foot']]+=V((0,.11,-.03));p[bi[side+'ToeBase']]+=V((0,.11,-.03))
 if name.startswith('death'):
  f=smooth(min(1,t/.65))
  for side,s in [('Left',1),('Right',-1)]:
   p[bi[side+'Hand']]=(1-f)*p[bi[side+'Hand']]+f*V((s*.29,1.17,.055))
   p[bi[side+'ForeArm']]=(1-f)*p[bi[side+'ForeArm']]+f*V((s*.34,1.31,.015))
 if name in ['idle_rifle','aim_rifle','idle_pistol','aim_pistol','crouch_idle']:
  breath=.0025*math.sin(TAU*t/2)
  for side in ['Left','Right']:
   for j in ['ForeArm','Hand']:p[bi[side+j]][1]+=breath
 # Thumb follows hand; orientation is handled below.
 for side in ['Left','Right']:
  p[bi[side+'Thumb']]=p[bi[side+'Hand']]+(rest[bi[side+'Thumb']]-rest[bi[side+'Hand']])
 angle=0
 if name in ['aim_up','aim_down']:
  angle=math.radians(-60 if name=='aim_up' else 60);M=rot_x(angle);pivot=V((-.075,1.405,.05))
  for side in ['Left','Right']:
   for j in ['ForeArm','Hand','Thumb']:p[bi[side+j]]=pivot+M@(p[bi[side+j]]-pivot)
  q[bi['Head']]=Quaternion((1,0,0),angle)
  p[bi['Eyes']]=p[bi['Head']]+M@(rest[bi['Eyes']]-rest[bi['Head']])
  q[bi['Eyes']]=q[bi['Head']].copy()
 # Preserve bind length scale only for final-height poses; head stays full size.
 scales=np.ones((len(bones),3));scales[1:,1]=k;scales[bi['Head']]=1;scales[bi['Eyes']]=1
 for side in ['Left','Right']:
  for a,b in [('Arm','ForeArm'),('ForeArm','Hand'),('UpLeg','Leg'),('Leg','Foot')]:
   i=bi[side+a];j=bi[side+b];orig=rest[j]-rest[i];target=p[j]-p[i]
   # General affine alignment: length may change for compact final-height poses.
   base=orig.copy();base[1]*=k
   q[i]=Vector(base).rotation_difference(Vector(target))
  q[bi[side+'Hand']]=Quaternion((1,0,0),angle)
  q[bi[side+'Thumb']]=q[bi[side+'Hand']].copy()
 if name.startswith('death'):
  f=smooth(min(1,t/.95));angle=(1 if name=='death_front' else -1)*math.pi/2*f;M=rot_x(angle)
  pivot=V((0,.85,0));shift=V((0,-.65*f,0))
  for i in range(1,len(bones)):
   p[i]=pivot+shift+M@(p[i]-pivot);q[i]=Quaternion((1,0,0),angle)@q[i]
  # Exact ground support from all authored vertices, rather than a guessed hip
  # offset. Root remains fixed; only the pelvis and descendant pose is lifted.
  minimum=0
  for gp,gj,gw in ground_meshes:
   mats=np.array([np.array(qi.to_matrix()) for qi in q]);offsets=gp[:,None,:]-rest[gj]
   points=np.sum((np.einsum('nvij,nvj->nvi',mats[gj],offsets*scales[gj])+p[gj])*gw[:,:,None],axis=1)
   minimum=min(minimum,float(points[:,1].min()))
  p[1:,1]+=-minimum+.001
 return p,q,scales

doc={'asset':{'version':'2.0','generator':'Original SNIPER DUEL character / Blender authoring script'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'personaje','children':[]}],'buffers':[{}],'bufferViews':[],'accessors':[],'meshes':[],'skins':[],'animations':[],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}]}
data=bytearray()
def view(raw):
 while len(data)%4:data.append(0)
 offset=len(data);data.extend(raw);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)});return len(doc['bufferViews'])-1
def acc(a,typ,component=5126,bounds=False):
 dt={5126:'<f4',5123:'<u2',5121:'u1',5125:'<u4'}[component];a=np.asarray(a,dtype=dt)
 item={'bufferView':view(a.tobytes()),'componentType':component,'count':len(a),'type':typ}
 if bounds:item.update(min=np.min(a,axis=0).reshape(-1).tolist(),max=np.max(a,axis=0).reshape(-1).tolist())
 doc['accessors'].append(item);return len(doc['accessors'])-1
for name in ['color_A.jpg','normal.png','orm.png']:
 doc['images'].append({'name':name,'bufferView':view((R/'textures'/name).read_bytes()),'mimeType':'image/jpeg' if name.endswith('jpg') else 'image/png'})
 doc['textures'].append({'sampler':0,'source':len(doc['images'])-1})
doc['materials']=[{'name':'uniform_shared_atlas','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicRoughnessTexture':{'index':2},'metallicFactor':1,'roughnessFactor':1},'normalTexture':{'index':1,'scale':.55},'occlusionTexture':{'index':2,'strength':1}}]
nodeids=[]
for i,name in enumerate(bones):
 ni=len(doc['nodes']);nodeids.append(ni);p=parents[i]
 doc['nodes'].append({'name':name,'translation':(rest[i]-(rest[p] if p>=0 else 0)).tolist(),'children':[]})
 if p<0:doc['nodes'][0]['children'].append(ni)
 else:doc['nodes'][nodeids[p]]['children'].append(ni)
for side,short in [('Right','R'),('Left','L')]:
 ni=len(doc['nodes']);doc['nodes'].append({'name':'socket_arma_'+short,'translation':[0,0,0],'extras':{'forward':'+Z','up':'+Y','purpose':'grip' if short=='R' else 'support'}});doc['nodes'][nodeids[bi[side+'Hand']]]['children'].append(ni)
ibm=[]
for p in rest:m=np.eye(4);m[:3,3]=-p;ibm.append(m.T.reshape(-1))
doc['skins'].append({'name':'soldier_shared_skeleton','inverseBindMatrices':acc(ibm,'MAT4'),'joints':nodeids,'skeleton':nodeids[0]})
metadata={'bones':bones,'parts':{},'clips':[],'source':'original procedural artwork','constraints':'ENCARGO.md'}
ground_meshes=[]
for lod in range(3):
 g=create(lod);p,n,f=g.finish();name='personaje_LOD'+str(lod)
 ground_meshes.append((p,np.array(g.j,dtype=int),np.array(g.w)))
 attrs={'POSITION':acc(p,'VEC3',bounds=True),'NORMAL':acc(n,'VEC3'),'TEXCOORD_0':acc(g.uv,'VEC2'),'JOINTS_0':acc(g.j,'VEC4',5123),'WEIGHTS_0':acc(g.w,'VEC4'),'_ZONE':acc(g.z,'SCALAR',5121)}
 doc['meshes'].append({'name':name,'primitives':[{'attributes':attrs,'indices':acc(f.reshape(-1),'SCALAR',5123),'material':0}]})
 ni=len(doc['nodes']);doc['nodes'].append({'name':name,'mesh':lod,'skin':0,'extras':{'lod':lod,'defaultVisible':lod==0}});doc['nodes'][0]['children'].append(ni)
 metadata['parts'][name]={'triangles':len(f),'vertices':len(p),'bounds':[p.min(axis=0).tolist(),p.max(axis=0).tolist()],'parts':g.parts}
 print(name,len(f),'triangles')
 assert len(f)<=[10000,4000,1500][lod],(name,len(f))
def local_frame(name,t,duration):
 from mathutils import Matrix
 p,q,s=pose(name,t,duration);world=[]
 for i in range(len(bones)):
  m=np.eye(4);m[:3,:3]=np.array(q[i].to_matrix())@np.diag(s[i]);m[:3,3]=p[i];world.append(m)
 out=[]
 for i in range(len(bones)):
  m=np.linalg.inv(world[parents[i]])@world[i] if parents[i]>=0 else world[i]
  tr,qr,sc=Matrix(m.tolist()).decompose();out.append([*tr,qr.x,qr.y,qr.z,qr.w,*sc])
 return np.array(out)
for name,duration,loop in clips:
 times=list(np.arange(0,duration,1/30)) if duration else [0]
 if duration and (not times or abs(times[-1]-duration)>1e-6):times.append(duration)
 tr=np.array([local_frame(name,t,duration) for t in times]);ti=acc(times,'SCALAR',bounds=True)
 deriv=[]
 for ti0,t in enumerate(times):
  low=local_frame(name,t-.001,duration);high=local_frame(name,t+.001,duration)
  for i in range(len(bones)):
   if np.dot(low[i,3:7],tr[ti0,i,3:7])<0:low[i,3:7]*=-1
   if np.dot(high[i,3:7],tr[ti0,i,3:7])<0:high[i,3:7]*=-1
  deriv.append((high-low)/.002)
 deriv=np.array(deriv)
 anim={'name':name,'samplers':[],'channels':[],'extras':{'loop':loop,'fps':30,'rootMotion':False,'duration':duration}}
 for i in range(1,len(bones)):
  for prop,a,b,typ in [('translation',0,3,'VEC3'),('rotation',3,7,'VEC4'),('scale',7,10,'VEC3')]:
   values=tr[:,i,a:b].copy();tangent=deriv[:,i,a:b].copy()
   if prop=='rotation':
    for k in range(1,len(values)):
     if np.dot(values[k-1],values[k])<0:values[k]*=-1;tangent[k]*=-1
   interpolation='LINEAR'
   if len(values)>=3:
    # glTF cubic Hermite derivatives, in value units per second. At 30 Hz this
    # reduces the planted foot's world-space error caused by chained rotations.
    values=np.stack([tangent,values,tangent],axis=1).reshape(-1,b-a);interpolation='CUBICSPLINE'
   sam=len(anim['samplers']);anim['samplers'].append({'input':ti,'output':acc(values,typ),'interpolation':interpolation});anim['channels'].append({'sampler':sam,'target':{'node':nodeids[i],'path':prop}})
 doc['animations'].append(anim);metadata['clips'].append({'name':name,'duration':duration,'loop':loop,'samples':len(times)})
doc['buffers'][0]['byteLength']=len(data)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);data+=b'\0'*((-len(data))%4)
blob=struct.pack('<III',0x46546C67,2,12+8+len(j)+8+len(data))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(data),0x004E4942)+data
(R/'personaje.glb').write_bytes(blob);metadata['sha256']=hashlib.sha256(blob).hexdigest();(R/'build.json').write_text(json.dumps(metadata,indent=2),encoding='utf8')
print('GLB',len(blob),'bytes;',len(bones),'bones;',len(clips),'clips')
