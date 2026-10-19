"""Anatomical CC0 MakeHuman base with original combat clothing and equipment.
No MakeHuman application code is imported: only the pinned CC0 OBJ is read.
"""
from pathlib import Path
import math
import numpy as np
import bpy
from mathutils import Vector
R=Path(__file__).resolve().parent.parent
def load_base():
 verts=[];groups={};name=''
 for line in (R/'sources/base.obj').read_text().splitlines():
  if line.startswith('v '):verts.append([float(x) for x in line.split()[1:4]])
  elif line.startswith('g '):name=line[2:]
  elif line.startswith('f '):groups.setdefault(name,[]).append([int(x.split('/')[0])-1 for x in line.split()[1:]])
 return np.array(verts),groups
BASE,GROUPS=load_base()
def center(name):return BASE[list(set(i for f in GROUPS[name] for i in f))].mean(0)
def lerp_y(y):return np.interp(y,[-8.168,-7.448,-3.695,.486,.727,2.3,4.0,5.25,5.90,7.284,8.491],[0,.085,.43,.82,.85,1.04,1.24,1.405,1.49,1.62,1.755])
def base_surface(lod):
 indices=sorted(set(i for f in GROUPS['body'] for i in f));lookup={v:i for i,v in enumerate(indices)}
 mesh=bpy.data.meshes.new('anatomical_base');mesh.from_pydata(BASE[indices].tolist(),[],[[lookup[i] for i in f] for f in GROUPS['body']]);mesh.update()
 ob=bpy.data.objects.new('anatomical_base',mesh);bpy.context.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 mod=ob.modifiers.new('Budgeted_anatomy','DECIMATE');mod.ratio=[.175,.063,.020][lod]
 bpy.ops.object.modifier_apply(modifier=mod.name);ob.data.calc_loop_triangles()
 p=np.array([v.co[:] for v in ob.data.vertices]);faces=[tuple(t.vertices) for t in ob.data.loop_triangles]
 bpy.data.objects.remove(ob,do_unlink=True)
 return p,faces
def make_character(lod,Geometry,rest,bi):
 g=Geometry(lod);P,F=base_surface(lod);mapped=[];weights=[];zones=[];tiles=[]
 shoulder=center('joint-l-shoulder');elbow=center('joint-l-elbow');wrist=center('joint-l-hand')
 arm_source=[shoulder,elbow,wrist]
 for src in P:
  x,y,z=src;s=1 if x>=0 else -1;side='Left' if s>0 else 'Right';ay=lerp_y(y)
  # Anatomical torso/legs use the real mesh contours rather than ring primitives.
  if y>5.90:
   pos=np.array([x*.105,ay,(z-.20)*.105]);d=pos-[0,1.63,0];length=np.linalg.norm(d)
   if length>.137:pos=np.array([0,1.63,0])+d*.137/length
   w={'Head':1};zone=0;tile=3
  elif abs(x)>1.42 and y>1.6:
   a=np.array([abs(x),y,z]);candidates=[]
   targets=[rest[bi[side+n]] for n in ['Arm','ForeArm','Hand']]
   for j in [0,1]:
    u=arm_source[j];v=arm_source[j+1];t=np.clip(np.dot(a-u,v-u)/np.dot(v-u,v-u),0,1);near=u+t*(v-u);candidates.append((np.linalg.norm(a-near),j,t))
   _,j,t=min(candidates);u=arm_source[j].copy();v=arm_source[j+1].copy();u[0]*=s;v[0]*=s
   q=Vector(v-u).rotation_difference(Vector(targets[j+1]-targets[j]));scale=np.linalg.norm(targets[j+1]-targets[j])/np.linalg.norm(v-u)
   pos=targets[j]+np.array(q@Vector(src-u))*scale
   hand=abs(x)>4.1 or (j==1 and t>.96)
   if hand:
    # Keep actual hand topology; tuck the finger tips into a rifle grip.
    d=pos-targets[2];length=np.linalg.norm(d)
    if length>.115:d*=.115/length
    pos=targets[2]+d;pos[1]-=.018;w={side+'Hand':1};tile=3
   else:
    w={side+('Arm' if j==0 else 'ForeArm'):1};tile=0
    radial=pos-(targets[j]+t*(targets[j+1]-targets[j]));pos+=radial*.10
   zone=3
   # Seamless shoulder transition at the clavicle.
   blend=np.clip((abs(x)-1.42)/.28,0,1)
   if blend<1:
    body=np.array([x*.13,ay,(z-.05)*.115]);pos=pos*blend+body*(1-blend)
  else:
   if ay>=.85:
    pos=np.array([x*.13,ay,(z-.05)*.115]);zone=1;tile=0
    # Cloth, not bare skin: soften chest contours and build loose shirt volume.
    pos[0]*=1.045;pos[2]*=1.06
    pos[0]=np.clip(pos[0],-.235,.235);pos[2]=np.clip(pos[2],-.145,.145)
    if ay>1.42:w={'Neck':1}
    elif ay>1.30:w={'Spine2':1}
    elif ay>1.12:w={'Spine1':1}
    elif ay>.95:w={'Spine':1}
    else:w={'Hips':1}
   else:
    source_center=np.interp(y,[-8.168,-7.448,-3.695,.486],[2.196,2.196,1.581,1.104]);pos=np.array([s*.095+(x-s*source_center)*.105,ay,(z-.05)*.10]);zone=2;tile=2
    if ay>.73:
     blend=np.clip((ay-.73)/.10,0,1);pos[0]=(1-blend)*pos[0]+blend*x*.115;w={'Hips':1} if ay>.805 else {side+'UpLeg':1}
    elif ay>.43:w={side+'UpLeg':1}
    elif ay>.14:w={side+'Leg':1}
    else:w={side+'Foot':1};tile=3
    # Loosen trouser fabric over thigh/calf; compress folds near knee and boot.
    if ay>.15:
     dx=pos[0]-s*.095;dz=pos[2];fold=.0035*math.sin(ay*125+x*2)*math.exp(-((ay-.40)/.16)**2)+.003*math.sin(ay*170+x)*math.exp(-((ay-.19)/.07)**2)
     radial=np.array([dx,0,dz]);n=np.linalg.norm(radial)
     if n:pos+=radial/n*(.008+fold)
    pos[0]=np.clip(pos[0],-.210,.210);pos[2]=np.clip(pos[2],-.115,.125)
  mapped.append(pos);weights.append(w);zones.append(zone);tiles.append(tile)
 mapped=np.array(mapped)
 # Keep smooth surface vertices shared within each garment/zone. Projected UVs
 # are atlas-local, so no generated model needs an external texture extension.
 cache={};start=len(g.p)
 for face in F:
  # Face classification avoids a texture smear across a clothing boundary.
  tile=max(set(tiles[i] for i in face),key=lambda t:sum(tiles[i]==t for i in face));zone=max(set(zones[i] for i in face),key=lambda z:sum(zones[i]==z for i in face));out=[]
  for i in face:
   key=(i,tile,zone)
   if key not in cache:
    x,y,z=mapped[i];u=(math.atan2(z,x)+math.pi)/(2*math.pi);v=(y*2.2)%1
    cache[key]=g.vertex(mapped[i],[(tile%4+.025+.95*u)/4,(tile//4+.025+.95*v)/2],weights[i],zone)
   out.append(cache[key])
  g.faces.append(tuple(out))
 g.parts.append({'name':'anatomical_clothed_body','zone':'per_vertex','first':start,'count':len(g.p)-start,'triangles':len(F)})
 # Equipment is built in shaped panels and individual seams, not a solid box.
 def panel(name,outline,z,depth,joint,tile,zone=1):
  first=len(g.p);n=len(outline);tx=tile%4;ty=tile//4
  xs=[p[0] for p in outline];ys=[p[1] for p in outline];cx=sum(xs)/n;cy=sum(ys)/n
  for layer in range(3):
   scale=[.96,1,.92][layer];zz=z+[-depth/2,depth*.28,depth/2][layer]
   for x,y in outline:
    xx=cx+(x-cx)*scale;yy=cy+(y-cy)*scale;curve=-.14*xx*xx if z>0 else .14*xx*xx
    g.vertex((xx,yy,zz+curve),[(tx+.08+.84*(x-min(xs))/max(.001,max(xs)-min(xs)))/4,(ty+.08+.84*(y-min(ys))/max(.001,max(ys)-min(ys)))/2],{joint:1},zone)
  for k in range(2):
   for i in range(n):a=first+k*n+i;b=first+k*n+(i+1)%n;g.faces.extend([(a,b,b+n),(a,b+n,a+n)])
  for k in [0,2]:
   j=g.vertex((cx,cy,z+(-depth/2 if k==0 else depth/2)),[(tx+.5)/4,(ty+.5)/2],{joint:1},zone)
   for i in range(n):
    a=first+k*n+i;b=first+k*n+(i+1)%n;g.faces.append((j,b,a) if k==0 else (j,a,b))
  g.parts.append({'name':name,'zone':zone,'first':first,'count':len(g.p)-first,'triangles':n*6})
 def cord(name,points,width,joint,tile=2,zone=1):
  # Round-edged narrow fabric/rubber strip with a curve-following center line.
  rows=[(tuple(p),width,width*.4,{joint:1}) for p in points]
  g.loft(name,rows,[6,4,4][lod],tile,zone)
 outline=[(-.165,1.065),(.165,1.065),(.180,1.27),(.115,1.405),(-.115,1.405),(-.180,1.27)]
 panel('carrier_front',outline,.135,.045,'Spine1',1)
 panel('carrier_back',outline,-.132,.045,'Spine1',1)
 g.loft('cummerbund',[((0,1.04,0),.185,.131,{'Spine':1}),((0,1.13,0),.190,.134,{'Spine':1})],[20,12,6][lod],1,1,power=3)
 g.loft('duty_belt',[((0,.855,0),.182,.117,{'Hips':1}),((0,.887,0),.183,.118,{'Hips':1})],[20,12,6][lod],3,1,power=3)
 if lod<2:
  for x in [-.133,.133]:cord('carrier_shoulder_strap',[(x,1.30,.13),(x,1.40,.086),(x,1.43,.02),(x,1.40,-.086),(x,1.30,-.13)],.024,'Spine2',1)
  for x in [-.102,0,.102]:
   po=[(x-.043,1.07),(x+.043,1.07),(x+.044,1.195),(x+.035,1.225),(x-.036,1.225),(x-.044,1.195)]
   panel('magazine_pouch',po,.172,.034,'Spine1',1)
   panel('pouch_flap',[(x-.042,1.175),(x+.042,1.175),(x+.040,1.222),(x-.040,1.222)],.193,.006,'Spine1',2)
  panel('identity_patch',[(-.06,1.31),(.06,1.31),(.06,1.35),(-.06,1.35)],.165,.008,'Spine2',7)
  for y in [1.255,1.282]:
   for x in [-.105,-.035,.035,.105]:panel('molle_loop',[(x-.028,y),(x+.028,y),(x+.028,y+.012),(x-.028,y+.012)],.164,.007,'Spine1',1)
  panel('back_hydration',[(-.095,1.10),(.095,1.10),(.105,1.30),(.065,1.37),(-.065,1.37),(-.105,1.30)],-.164,.025,'Spine1',1)
  cord('back_pull_handle',[(-.055,1.365,-.155),(-.05,1.395,-.17),(.05,1.395,-.17),(.055,1.365,-.155)],.009,'Spine2',3)
  panel('radio',[(.125,1.23),(.17,1.23),(.17,1.31),(.125,1.31)],.163,.025,'Spine1',3)
  cord('radio_antenna',[(.156,1.30,.161),(.156,1.43,.161)],.003,'Spine2',3)
  panel('belt_buckle',[(-.024,.858),(.024,.858),(.024,.885),(-.024,.885)],.126,.009,'Hips',6)
 # Anatomically contoured FAST-style shell: high-cut sides, lower occipital rim.
 first=len(g.p);N=[28,16,8][lod];K=[8,5,3][lod]
 for k in range(K):
  t=k/(K-1)
  for i in range(N+1):
   a=math.tau*i/N;front=math.sin(a);side=abs(math.cos(a));end=1.48+.32*max(0,-front)-.18*side
   theta=.025+t*end;rad=.148
   x=rad*.94*math.sin(theta)*math.cos(a);y=1.63+rad*math.cos(theta);z=rad*math.sin(theta)*math.sin(a)
   g.vertex((x,y,z),[(.025+.95*i/N)/4,(1+.025+.95*t)/2],{'Head':1},0)
 for k in range(K-1):
  for i in range(N):a=first+k*(N+1)+i;b=a+N+1;g.faces.extend([(a,a+1,b),(a+1,b+1,b)])
 g.parts.append({'name':'high_cut_helmet','zone':0,'first':first,'count':len(g.p)-first,'triangles':2*(K-1)*N})
 # Two small goggle lenses / moulded frames instead of a full horizontal visor.
 for side,s in [('Left',1),('Right',-1)]:
  x=s*.038
  for size,z,tile in [((.080,.049,.015),.121,3),((.066,.035,.008),.134,5)]:g.lump(side+'goggle',(x,1.620,z),size,'Eyes',tile,0,[12,8,4][lod],power=3)
  if lod<2:
   g.lump(side+'helmet_rail',(s*.126,1.671,0),(.016,.025,.085),'Head',3,0,8)
   g.lump(side+'earcup',(s*.109,1.603,-.015),(.025,.069,.043),'Head',3,0,12,power=2.6)
   cord(side+'chinstrap',[(s*.105,1.65,.015),(s*.092,1.57,.048),(s*.047,1.515,.040)],.006,'Head',3,0)
  # Hard caps conform to the knee; trouser fabric remains visible around them.
  po=[(s*.095-.044,.383),(s*.095+.044,.383),(s*.095+.052,.444),(s*.095+.033,.486),(s*.095-.033,.486),(s*.095-.052,.444)]
  panel(side+'kneecap',po,.084,.022,side+'Leg',3,2)
  if lod<2:
   g.lump(side+'cargo',(s*.165,.653,.015),(.042,.145,.116),side+'UpLeg',2,2,12,power=3)
   g.lump(side+'cargo_flap',(s*.185,.697,.014),(.012,.043,.123),side+'UpLeg',2,2,8)
  # Shaped footwear: ankle shaft, sloping tongue, rounded toe and thin sole.
  g.loft(side+'boot_ankle',[((s*.095,.065,0),.052,.065,{side+'Foot':1}),((s*.095,.15,-.008),.047,.048,{side+'Foot':1}),((s*.095,.195,-.008),.042,.043,{side+'Foot':1})],[12,8,4][lod],3,2,power=2.6)
  g.lump(side+'boot_toe',(s*.095,.049,.058),(.115,.085,.162),side+'Foot',3,2,16,power=2.6)
  g.lump(side+'outsole',(s*.095,.013,.025),(.116,.025,.220),side+'Foot',3,2,16,power=3.1)
  if lod==0:
   for y in [.085,.108,.131,.154]:
    cord(side+'laces',[(s*.095-.023,y,.05),(s*.095+.023,y+.010,.05)],.0025,side+'Foot',2,2)
 # Clamp only head accessories against the exact sphere; garments are validated
 # independently after skinning. This is not a change to server collision data.
 for i,z in enumerate(g.z):
  if z==0:
   d=np.array(g.p[i])-[0,1.63,0];length=np.linalg.norm(d)
   if length>.148:g.p[i]=(np.array([0,1.63,0])+d*.148/length).tolist()
 return g
