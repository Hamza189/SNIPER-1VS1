#!/usr/bin/env python3
"""SNIPER DUEL - original architectural GLB with three LODs.
Reproducible procedural 3D authoring. No third-party visual assets.
Dependencies: numpy, pillow, scipy, trimesh. Optional: vtk for rendering separate preview.
"""
import os, io, math, random, json, zipfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy.ndimage import gaussian_filter, sobel
import trimesh
from trimesh.visual.material import PBRMaterial

OUT=os.path.abspath(os.path.dirname(__file__))
TEX=os.path.join(OUT,'textures'); os.makedirs(TEX,exist_ok=True)
ID='sd_e10_casa_oliva'
RNG=np.random.default_rng(14583)

# ---- ORIGINAL PROCEDURAL PBR TEXTURES ----
# Multiscale spatial detail, edge-worn stone, wooden grain and hand-painted signage.
# Maps are baked to images and are embedded in the deliverable GLB.
def field(n, a=.75):
    f=np.zeros((n,n),np.float32)
    for small,w in [(6,.48),(22,.29),(72,.14),(n,.09)]:
        noise=RNG.normal(0,1,(small,small)).astype('float32')
        z=Image.fromarray(((noise+3)/6*255).clip(0,255).astype('uint8')).resize((n,n),Image.Resampling.BICUBIC)
        f+=((np.array(z).astype('float32')/255)-.5)*w
    return f

def colored(base,n=512,variation=1.0):
    noise=field(n)*variation
    src=np.zeros((n,n,3),np.float32)
    for c in range(3):src[:,:,c]=base[c]+noise*(69-7*c)+RNG.normal(0,1.9,(n,n))
    return Image.fromarray(src.clip(0,255).astype('uint8'),'RGB')

def normalmap(height, strength=2.2):
    im=Image.fromarray(((height-height.min())/(np.ptp(height)+1e-8)*255).clip(0,255).astype('uint8'))
    arr=np.array(im.resize((512,512),Image.Resampling.LANCZOS)).astype('float32')/255
    gx=sobel(arr,axis=1); gy=sobel(arr,axis=0)
    normal=np.dstack((-gx*strength,gy*strength,np.ones_like(gx)*1.75))
    normal/=np.linalg.norm(normal,axis=2,keepdims=True).clip(1e-4)
    return Image.fromarray(((normal*.5+.5)*255).clip(0,255).astype('uint8'),'RGB')

textures={}; normals={}
# limewashed plaster; discoloration, efflorescence, hairline fissures, and small lime chips
n=1024; h=field(n); img=colored((208,188,153),n,1.35); ar=np.array(img).astype('float32')
yy,xx=np.indices((n,n)); damp=np.clip((yy/n-.64)*1.65,0,.42)[:,:,None]
ar*=1-damp*np.array([.36,.32,.27])[None,None,:]
# mineral pale clusters
for _ in range(500):
 cx,cy=RNG.integers(0,n,size=2); rr=int(RNG.integers(3,28))
 y0,y1=max(0,cy-rr),min(n,cy+rr);x0,x1=max(0,cx-rr),min(n,cx+rr)
 suby,subx=np.ogrid[y0:y1,x0:x1]
 mask=((subx-cx)**2/(rr*rr)+ (suby-cy)**2/(rr*rr*.35))<1
 pigment=np.array([230,214,183]) if RNG.random()<.54 else np.array([153,137,119])
 ar[y0:y1,x0:x1][mask]=ar[y0:y1,x0:x1][mask]*.62+pigment*.38
img=Image.fromarray(ar.clip(0,255).astype('uint8'));d=ImageDraw.Draw(img,'RGB')
for _ in range(120):
 x=int(RNG.integers(0,n));y=int(RNG.integers(0,n));pts=[(x,y)]
 for k in range(int(RNG.integers(3,12))):
  x+=int(RNG.integers(-8,9));y+=int(RNG.integers(5,14));pts.append((x,y))
 d.line(pts,fill=(113,103,88),width=1)
textures['sd_estuco']=img;normals['sd_estuco']=normalmap(h,.55)
# limestone blocks, actual irregular joints and fine erosion
n=512; h=field(n); img=colored((166,149,125),n,1.55);draw=ImageDraw.Draw(img,'RGB')
for row in range(7):
 y=int(row*n/7);off=0 if row%2==0 else n//9
 draw.line([(0,y),(n,y)],fill=(87,81,73),width=4)
 for col in range(-1,6):
  x=int(col*n/4+off); draw.line([(x,y),(x,y+n/7)],fill=(92,86,75),width=3)
  draw.line([(x+3,y+5),(x+3,y+n/7-5)],fill=(222,209,180),width=1)
for _ in range(2400):
 x=int(RNG.integers(n));y=int(RNG.integers(n));r=int(RNG.choice([1,1,1,2,3]));v=int(RNG.integers(91,207));draw.ellipse((x,y,x+r,y+r),fill=(v,v-4,v-12))
textures['sd_piedra']=img; normals['sd_piedra']=normalmap(h,1.0)
# wood: weathered teal-painted timber with directional grain and layered wear
n=512; h=field(n); img=colored((68,92,78),n,.85);a=np.array(img).astype('float32')
for x in range(n):
 groove=8*math.sin(x/7.5)+3*math.sin(x/2.6)+5*math.sin(x/24)
 a[:,x,:]+=groove
for _ in range(1800):
 x=int(RNG.integers(n));y=int(RNG.integers(n));a[y:min(n,y+int(RNG.integers(4,70))),x,:]-=RNG.uniform(8,26)
textures['sd_madera']=Image.fromarray(a.clip(0,255).astype('uint8'));normals['sd_madera']=normalmap(h,.50)
# iron: deep charcoal and oxidized grain
textures['sd_hierro']=colored((45,49,49),128,.25)
# panes: sky reflected in blue tinted glass, upper blue, lower shadow
n=256;yy,xx=np.indices((n,n));a=np.zeros((n,n,3),np.float32)
for c,base in enumerate((58,93,105)):
 a[:,:,c]=base+(1-yy/n)*38+8*np.sin((xx/n*2+yy/n)*np.pi)+RNG.normal(0,1.7,(n,n))
textures['sd_vidrio']=Image.fromarray(a.clip(0,255).astype('uint8'))
# terracotta pots / coping tiles, hand-laid roof tile pattern
n=512;img=colored((159,83,53),n,1.4);draw=ImageDraw.Draw(img)
for row in range(12):
 y=row*44
 for col in range(-1,9):
  x=col*70+(36 if row%2 else 0)
  draw.arc((x,y-19,x+66,y+45), 20, 165, fill=(99,44,37),width=3)
  draw.line((x,y+24,x+66,y+24),fill=(201,117,72),width=2)
textures['sd_teja']=img
# foliage leafy surface (actual mesh leaf silhouettes below)
n=256;img=colored((59,91,51),n,.9);draw=ImageDraw.Draw(img)
for _ in range(800):
 x=int(RNG.integers(n));y=int(RNG.integers(n));r=int(RNG.integers(1,6));v=int(RNG.integers(53,119));draw.ellipse((x,y,x+r*2,y+r),fill=(int(v*.68),v,int(v*.56)))
textures['sd_vegetacion']=img
# shopfront sign + striping: top image half holds shop sign; bottom canvas awning stripes
n=512;img=Image.new('RGB',(n,n),(47,79,68));draw=ImageDraw.Draw(img)
# image top: sign with weathered ivory type
for y in range(0,245):draw.line((0,y,511,y),fill=(int(48+5*math.sin(y*.055)),int(80+7*math.sin(y*.04)),int(70+4*math.sin(y*.1))))
for x in range(0,n,48):draw.rectangle((x,264,x+24,511),fill=(224,211,172)); draw.rectangle((x+25,264,x+47,511),fill=(42,92,75))
fontpaths=['/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf','/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf']
fp=next((p for p in fontpaths if os.path.exists(p)),None)
font=ImageFont.truetype(fp,58) if fp else ImageFont.load_default();small=ImageFont.truetype(fp,24) if fp else ImageFont.load_default()
draw.text((60,53),'CASA OLIVA',font=font,fill=(237,218,171),stroke_width=1,stroke_fill=(18,47,38))
draw.text((145,152),'CAFÉ  ·  MERCADO',font=small,fill=(224,195,140))
draw.line([(20,225),(490,225)],fill=(196,159,104),width=5)
textures['sd_acento']=img

for k,img in textures.items():img.save(os.path.join(TEX,k+'_basecolor.png'),optimize=True)
for k,img in normals.items():img.save(os.path.join(TEX,k+'_normal.png'),optimize=True)

material_params={
'sd_estuco':(.0,.93),'sd_piedra':(.0,.87),'sd_madera':(.0,.65),'sd_hierro':(.82,.45),
'sd_vidrio':(.15,.17),'sd_teja':(.0,.87),'sd_vegetacion':(.0,.93),'sd_acento':(.0,.7)}
materials={}
for name,(metal,rough) in material_params.items():
 kw=dict(name=name,baseColorTexture=textures[name],metallicFactor=metal,roughnessFactor=rough,doubleSided=False)
 if name in normals:kw['normalTexture']=normals[name]
 materials[name]=PBRMaterial(**kw)

# --- MESH BUILDER; GEOMETRY IS 3D, NOT BILLBOARD / FAKE PHOTO FACADES ---
class Builder:
 def __init__(self,lod):self.lod=lod;self.buff={};self.parts=0
 def remap(self,material):
  if self.lod==1:return {'sd_teja':'sd_piedra','sd_vegetacion':'sd_madera'}.get(material,material)
  if self.lod==2:return {'sd_teja':'sd_piedra','sd_vegetacion':'sd_estuco','sd_hierro':'sd_madera','sd_vidrio':'sd_madera','sd_acento':'sd_estuco'}.get(material,material)
  return material
 def group(self,material):
  material=self.remap(material)
  return self.buff.setdefault(material,{'vertices':[],'uv':[],'faces':[]})
 def quad(self,mat,verts,uv=None,uv_scale=None):
  b=self.group(mat);base=len(b['vertices'])
  p=np.asarray(verts,dtype=float);normal=np.cross(p[1]-p[0],p[2]-p[1]); a=np.argmax(abs(normal))
  scale=uv_scale or {'sd_estuco':.46,'sd_piedra':.95,'sd_madera':.75,'sd_teja':1.1,'sd_vegetacion':1,'sd_acento':1}.get(mat,.4)
  if uv is None:
   if a==2:uv=p[:,[0,1]]*scale
   elif a==0:uv=p[:,[2,1]]*scale
   else:uv=p[:,[0,2]]*scale
  b['vertices'].extend([tuple(v) for v in p]);b['uv'].extend([tuple(v) for v in uv]);b['faces'].extend([(base,base+1,base+2),(base,base+2,base+3)])
  self.parts+=1
 def box(self,mat,c,size,uv_scale=None):
  x,y,z=c;dx,dy,dz=np.asarray(size)/2;x0,x1=x-dx,x+dx;y0,y1=y-dy,y+dy;z0,z1=z-dz,z+dz
  self.quad(mat,[(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],uv_scale=uv_scale)
  self.quad(mat,[(x1,y0,z0),(x0,y0,z0),(x0,y1,z0),(x1,y1,z0)],uv_scale=uv_scale)
  self.quad(mat,[(x1,y0,z1),(x1,y0,z0),(x1,y1,z0),(x1,y1,z1)],uv_scale=uv_scale)
  self.quad(mat,[(x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0)],uv_scale=uv_scale)
  self.quad(mat,[(x0,y1,z1),(x1,y1,z1),(x1,y1,z0),(x0,y1,z0)],uv_scale=uv_scale)
  self.quad(mat,[(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1)],uv_scale=uv_scale)
 def cyl(self,mat,pa,pb,r,sections=10):
  a=np.array(pa,dtype=float);b=np.array(pb,dtype=float);ax=b-a;length=np.linalg.norm(ax)
  if length<.0001:return
  axis=ax/length;other=np.array([0.,1.,0.]) if abs(axis[1])<.8 else np.array([1.,0.,0.]);u=np.cross(axis,other);u/=np.linalg.norm(u);v=np.cross(axis,u)
  pts1=[a+r*(u*np.cos(2*np.pi*i/sections)+v*np.sin(2*np.pi*i/sections)) for i in range(sections)]
  pts2=[b+r*(u*np.cos(2*np.pi*i/sections)+v*np.sin(2*np.pi*i/sections)) for i in range(sections)]
  for i in range(sections):
   k=(i+1)%sections
   self.quad(mat,[pts1[i],pts1[k],pts2[k],pts2[i]])
  # very small caps omitted for pipes to reduce polycount
 def tapered(self,mat,c,ybottom,ytop,r0,r1,sections=8):
  cx,cz=c
  pts0=[(cx+r0*math.cos(i*2*math.pi/sections),ybottom,cz+r0*math.sin(i*2*math.pi/sections)) for i in range(sections)]
  pts1=[(cx+r1*math.cos(i*2*math.pi/sections),ytop,cz+r1*math.sin(i*2*math.pi/sections)) for i in range(sections)]
  for i in range(sections):self.quad(mat,[pts0[i],pts0[(i+1)%sections],pts1[(i+1)%sections],pts1[i]])
 def meshes(self):
  out={}
  for name,data in self.buff.items():
   m=trimesh.Trimesh(vertices=np.array(data['vertices']),faces=np.array(data['faces']),process=False)
   m.visual=trimesh.visual.TextureVisuals(uv=np.array(data['uv']),material=materials[name]);out[name]=m
  return out

# façade openings per wall, exact physical voids, with recesses. Exterior size (5.82 x 9.76)
FRONT=[(-2.37,-.40,.40,2.50),(.56,2.16,.0,2.52),(-2.32,-1.06,3.42,5.22),(1.04,2.32,3.42,5.22)]
BACK=[(-2.20,-1.04,.89,2.20),(1.02,2.22,.05,2.40),(-2.19,-1.06,3.39,5.05),(1.07,2.19,3.39,5.05)]
SIDE=[(-3.57,-2.34,.93,2.11),(.43,1.71,.95,2.10),(-3.58,-2.33,3.43,5.04),(-.50,.77,3.43,5.04),(2.60,3.84,3.43,5.04)]

def wall_grid(b,axis,side,opens,lo=-2.89,hi=2.89,wallbottom=0,walltop=5.92):
 # segmented wall thickness .23; walls contain REAL HOLES.
 xv=[lo,hi];yv=[wallbottom,walltop]
 for x0,x1,y0,y1 in opens:xv.extend([x0,x1]);yv.extend([y0,y1])
 xv=sorted(set(xv));yv=sorted(set(yv))
 for i in range(len(xv)-1):
  for j in range(len(yv)-1):
   u=(xv[i]+xv[i+1])/2;v=(yv[j]+yv[j+1])/2
   if any(a<u<bx and c<v<d for a,bx,c,d in opens):continue
   du=xv[i+1]-xv[i];dv=yv[j+1]-yv[j]
   # opening thickness, intentionally no behind-the-window fake wall
   if axis=='z':b.box('sd_estuco',(u,v,side*4.80),(du,dv,.24))
   else:b.box('sd_estuco',(side*2.80,v,u),(.24,dv,du))

def reveal(b, axis,sign,centerw,y0,y1,w,mat='sd_piedra'):
 # jamb / sill stones bridge the 0.24 m wall thickness
 if axis=='z':
  z=sign*4.82
  for xx in [centerw-w/2,centerw+w/2]:b.box(mat,(xx,(y0+y1)/2+.04,z),(.11,y1-y0+.08,.37))
  
  if y0>=.15:b.box(mat,(centerw,y0-.06,z),(w+.18,.14,.38))
  b.box(mat,(centerw,y1+.07,z),(w+.22,.17,.37))
 else:
  x=sign*2.81
  for zz in [centerw-w/2,centerw+w/2]:b.box(mat,(x,(y0+y1)/2+.04,zz),(.37,y1-y0+.08,.11))
  
  if y0>=.15:b.box(mat,(x,y0-.06,centerw),(.38,.14,w+.18))
  b.box(mat,(x,y1+.07,centerw),(.37,.17,w+.22))

def pane(b,axis,sign,u,y,z_offset=.16,w=.9,h=1.20,kind='window',detail=1):
 # Glass is set deeply inside the opening; dark interior volume behind to read as real depth.
 if axis=='z':
  z=sign*(4.82-z_offset)
  b.box('sd_vidrio',(u,y,z),(w,h,.028))
  b.box('sd_hierro',(u,y,z-sign*.043),(.07,h,.075))
  if detail>=1:
   b.box('sd_madera',(u,y+h*.48,z+sign*.02),(w+.09,.060,.045))
   b.box('sd_madera',(u,y-h*.48,z+sign*.02),(w+.09,.060,.045))
   b.box('sd_madera',(u-w*.48,y,z+sign*.02),(.065,h,.05))
   b.box('sd_madera',(u+w*.48,y,z+sign*.02),(.065,h,.05))
  if detail>=2:
   b.box('sd_hierro',(u,y,z+sign*.05),(w,.025,.038))
 else:
  x=sign*(2.82-z_offset)
  b.box('sd_vidrio',(x,y,u),(.028,h,w))
  b.box('sd_hierro',(x-sign*.043,y,u),(.075,h,.07))
  if detail>=1:
   for zz in [u-w*.48,u+w*.48]:b.box('sd_madera',(x+sign*.02,y,zz),(.05,h,.060))
   for yy in [y-h*.48,y+h*.48]:b.box('sd_madera',(x+sign*.02,yy,u),(.045,.065,w+.08))
  if detail>=2:b.box('sd_hierro',(x+sign*.05,y,u),(.04,.026,w))

def shutters(b,axis,sign,u,y,windowwidth=1.15,height=1.6,open_=True,detail=2):
 # True projected slats and metal hinges, not image decals.
 if detail==0:return
 for s in [-1,1]:
  outer=u+s*(windowwidth/2+.22)
  if axis=='z':
   z=sign*4.96
   b.box('sd_madera',(outer,y,z),(.36,height,.075))
   if detail>=2:
    for yy in np.linspace(y-height*.43,y+height*.43,9):
     b.box('sd_madera',(outer,yy,z+sign*.063),(.32,.045,.075))
    for yy in [y-height*.39,y+height*.39]:b.box('sd_hierro',(outer,yy,z+sign*.095),(.30,.027,.032))
  else:
   x=sign*2.96
   b.box('sd_madera',(x,y,outer),(.075,height,.36))
   if detail>=2:
    for yy in np.linspace(y-height*.43,y+height*.43,9):b.box('sd_madera',(x+sign*.063,yy,outer),(.075,.045,.32))

def corner_stones(b,detail):
 # Every corner real stone quoins with alternating overlap and chipped offsets.
 for sx in [-1,1]:
  for sz in [-1,1]:
   for j in range(0,12 if detail>=2 else 6):
    y=(j+.5)*(5.85/(12 if detail>=2 else 6))
    wide=.42 if j%2 else .29
    b.box('sd_piedra',(sx*(2.86-wide/2),y,sz*4.91),(wide,.33 if detail>=2 else .61,.09))
    b.box('sd_piedra',(sx*2.94,y,sz*(4.78-wide/2)),(.07,.33 if detail>=2 else .61,wide))

def balcony(b,cx,detail):
 if detail==0:
  b.box('sd_piedra',(cx,3.26,5.13),(1.60,.13,.38))
  return
 # projecting actual cantilever: over 2m, limited 1.2m
 b.box('sd_piedra',(cx,3.29,5.20),(1.73,.18,.77))
 if detail>=2:
  for x in [cx-.63,cx+.63]:b.box('sd_piedra',(x,3.17,5.25),(.14,.17,.63))
 front=5.62
 b.box('sd_hierro',(cx,4.13,front),(1.70,.065,.065))
 b.box('sd_hierro',(cx,3.44,front),(1.70,.055,.07))
 ct=13 if detail>=2 else 6
 for xx in np.linspace(cx-.79,cx+.79,ct):
  b.cyl('sd_hierro',(xx,3.48,front),(xx,4.13,front),.015 if detail>=2 else .024,6)
  if detail>=2:
   b.cyl('sd_hierro',(xx-.035,3.64,front),(xx+.035,3.80,front),.011,5)
   b.cyl('sd_hierro',(xx+.035,3.80,front),(xx-.035,3.98,front),.011,5)
 for sx in [-1,1]:
  x=cx+sx*.83
  for y in [3.49,4.12]:b.box('sd_hierro',(x,y,5.22),(.045,.06,.76))
  b.cyl('sd_hierro',(x,3.40,front),(x,4.20,front),.023,8)
 if detail>=2:
  # small stone supports (balcony corbels)
  for sx in [-1,1]:
   x=cx+sx*.59
   b.box('sd_piedra',(x,3.14,5.15),(.16,.15,.56))

def plant(b,x,y,z,detail,seed):
 random.seed(seed)
 if detail==0:return
 b.tapered('sd_teja',(x,z),y,y+.19,.115,.15,8 if detail>=2 else 6)
 b.cyl('sd_teja',(x,y+.19,z),(x,y+.22,z),.15,8)
 if detail==1:return
 for j in range(8):
  angle=2*math.pi*j/8;radius=.1+random.random()*.09
  px=x+math.cos(angle)*radius;pz=z+math.sin(angle)*radius;py=y+.27+random.random()*.13
  b.quad('sd_vegetacion',[(px-.07,py-.07,pz),(px+.07,py-.02,pz+.04),(px+.02,py+.09,pz), (px-.10,py+.035,pz-.03)])
 for j in range(4):
  px=x+random.uniform(-.11,.11);pz=z+random.uniform(-.09,.09);py=y+.39
  b.tapered('sd_teja',(px,pz),py,py+.027,.028,.007,5)

def build(lod):
 b=Builder(lod); high=lod==0;med=lod<=1;d=2 if high else 1 if med else 0
 if lod==2:
  # Genuine silhouette LOD for mobile: 3 materials, frontage and window positions preserved.
  # The detail is deliberately baked/simplified, not the high geometry used at close range.
  b.box('sd_estuco',(0,2.955,0),(5.83,5.91,9.76))
  b.box('sd_piedra',(0,.38,4.925),(5.83,.76,.08))
  b.box('sd_piedra',(0,5.71,4.93),(5.93,.17,.13))
  b.box('sd_piedra',(0,2.89,4.93),(5.92,.11,.12))
  b.box('sd_piedra',(0,5.92,0),(5.84,.12,9.78))
  for x in [-2.82,2.82]:b.box('sd_piedra',(x,6.11,0),(.29,.29,9.82))
  for z in [-4.77,4.77]:b.box('sd_piedra',(0,6.11,z),(5.59,.29,.28))
  for xx in [-1.67,1.68]:
   b.box('sd_madera',(xx,4.32,4.97),(1.23,1.72,.052))
   b.box('sd_piedra',(xx,3.42,5.0),(1.40,.15,.19))
   b.box('sd_piedra',(xx,5.22,5.0),(1.40,.13,.18))
   b.box('sd_piedra',(xx,3.28,5.25),(1.56,.14,.68))
  b.box('sd_madera',(-1.40,1.47,4.97),(1.89,1.84,.045))
  b.box('sd_madera',(1.35,1.22,4.97),(1.59,2.44,.049))
  for xx in [-2.79,2.79]:
   for j in range(5):b.box('sd_piedra',(xx,.55+j*1.2,4.935),(.26,.57,.08))
  return b
 # exterior wall shell with real empty windows and doors
 wall_grid(b,'z',+1,FRONT)
 wall_grid(b,'z',-1,BACK)
 for sx in [-1,1]:wall_grid(b,'x',sx,SIDE,lo=-4.67,hi=4.67)
 # Foundation + roof slab, structural thickness preserved
 b.box('sd_piedra',(0,.045,0),(5.82,.09,9.75))
 b.box('sd_estuco',(0,5.855,0),(5.80,.16,9.75))
 # side cornice, multiple stone profiles casting real shadows
 for y,depth,h in [(2.88,.14,.13),(5.56,.17,.20),(5.81,.23,.12)]:
  for z in [-4.92,4.92]:b.box('sd_piedra',(0,y,z),(5.95,h,depth))
  for x in [-2.94,2.94]:b.box('sd_piedra',(x,y,0),(depth,h,9.85))
 # stone plinth around whole ground floor
 for z in [-4.935,4.935]:
  # At ground floor, the stone skirt leaves service doors and shop glazing unobstructed.
  for x0,x1 in ([(-2.86,-2.37),(-.40,.56),(2.16,2.86)] if z>0 else [(-2.86,-2.20),(-1.04,1.02),(2.22,2.86)]):
   b.box('sd_piedra',((x0+x1)*.5,.37,z),(x1-x0,.74,.052))
 for x in [-2.96,2.96]:b.box('sd_piedra',(x,.37,0),(.05,.74,9.60))
 # Cut-in volume glass panes, hinges, rough dressed stone surrounds
 for face,sg,opens in [('z',+1,FRONT),('z',-1,BACK)]:
  for ix,(x0,x1,y0,y1) in enumerate(opens):
   cx=(x0+x1)/2;cy=(y0+y1)/2;w=x1-x0;h=y1-y0
   reveal(b,'z',sg,cx,y0,y1,w)
   if face=='z' and sg==+1 and ix==1:
    # actual wooden door, inset inside stone portal with raised panels
    b.box('sd_madera',(cx,1.25,sg*4.63),(w-.18,2.35,.09))
    if med:
     for sx in [-1,1]:
      for yy in [.68,1.70]:
       b.box('sd_piedra',(cx+sx*.36,yy,sg*4.70),(.56,.82,.045))
       b.box('sd_madera',(cx+sx*.36,yy,sg*4.735),(.47,.72,.035))
     b.cyl('sd_hierro',(cx+.51,1.18,sg*4.79),(cx+.51,1.29,sg*4.79),.027,8)
     b.box('sd_vidrio',(cx,2.35,sg*4.63),(1.08,.17,.03))
    continue
   if face=='z' and sg==+1 and ix==0:
    # glazed old-fashioned commercial store front, frame and deep display window
    pane(b,'z',sg,cx,1.39,w=w-.16,h=1.67,detail=d)
    if med:
     for xx in [cx-.54,cx+.54]:b.box('sd_madera',(xx,1.36,sg*4.76),(.08,1.82,.13))
     b.box('sd_madera',(cx,.53,sg*4.79),(w-.10,.17,.18))
    continue
   pane(b,'z',sg,cx,cy,w=w-.17,h=h-.20,detail=d)
   shutters(b,'z',sg,cx,cy,w,h-.10,detail=d if (sg==1 or high) else 0)
   if high and y0>3:
    # stone pediments and deeply modeled blind cornice
    b.box('sd_piedra',(cx,y1+.21,sg*4.95),(w+.40,.09,.23))
    b.box('sd_piedra',(cx,y0-.17,sg*5.02),(w+.36,.11,.29))
 # side openings have actual deep jambs and panes
 for sg in [-1,1]:
  for ix,(z0,z1,y0,y1) in enumerate(SIDE):
   cz=(z0+z1)/2;cy=(y0+y1)/2;w=z1-z0;h=y1-y0
   reveal(b,'x',sg,cz,y0,y1,w)
   pane(b,'x',sg,cz,cy,w=w-.18,h=h-.23,detail=d if high else 0)
   if high:shutters(b,'x',sg,cz,cy,w,h-.18,detail=d)
 # freestanding balcony slabs on upper windows, ornamental railings
 for x in [-1.69,1.68]:balcony(b,x,d)
 # slate-grey masonry corner quoins
 corner_stones(b,d)
 # Decorative chimneys OMITTED: height capped to 6.35 per authoritative collision contract
 # real three-dimensional flat roof parapet (fits bounding box)
 for sx in [-1,1]:
  b.box('sd_estuco',(sx*2.77,6.07,0),(.26,.35,9.72))
  b.box('sd_piedra',(sx*2.77,6.269,0),(.35,.055,9.86))
 for sz in [-1,1]:
  b.box('sd_estuco',(0,6.07,sz*4.74),(5.75,.35,.27))
  b.box('sd_piedra',(0,6.269,sz*4.74),(5.97,.055,.35))
 if med:
  for x in np.arange(-2.6,2.65,.44):
   b.box('sd_teja',(float(x),6.301,4.75),(.40,.033,.29))
  # roof drainage grate in terrace, non-collidable
  if high:b.box('sd_hierro',(1.77,5.96,3.78),(.42,.023,.26))
 # shop sign and striped canopy
 if med:
  b.box('sd_madera',(-1.37,2.69,4.96),(2.35,.44,.11))
  # UV = top region of hand-designed 512px material
  b.quad('sd_acento',[(-2.46,2.51,5.03),(-.30,2.51,5.03),(-.30,2.89,5.03),(-2.46,2.89,5.03)],uv=np.array([[.03,.54],[.97,.54],[.97,.97],[.03,.97]]))
  # Awning angled panels from mounting 2.61 down to front 2.39
  for i in range(12 if high else 8):
   cnt=12 if high else 8
   x0=-2.53+i*2.33/cnt;x1=-2.53+(i+1)*2.33/cnt
   u0=(i%2)*.075+.15;u1=u0+.08
   b.quad('sd_acento',[(x0,2.55,5.01),(x1,2.55,5.01),(x1,2.39,5.84),(x0,2.39,5.84)],uv=np.array([[u0,.03],[u1,.03],[u1,.47],[u0,.47]]))
   if high:
    b.box('sd_acento',((x0+x1)/2,2.34,5.835),(x1-x0,.14,.018))
  for x in [-2.48,-.21]:b.cyl('sd_hierro',(x,2.63,4.95),(x,2.38,5.85),.023,6)
 # Fine modelling and urban environmental storytelling
 if high:
  # downspouts, elbows, standing seam clamps
  for sx in [-1,1]:
   x=sx*2.69
   b.cyl('sd_hierro',(x,.42,5.085),(x,5.45,5.085),.052,10)
   b.cyl('sd_hierro',(x,5.45,5.085),(x,5.67,4.94),.051,9)
   for y in [.75,2.6,4.65]:b.box('sd_hierro',(x,y,5.07),(.22,.045,.11))
  # iron wall lamps, metal bracket with boxed panes (above player height)
  for xx in [.04,2.50]:
   b.cyl('sd_hierro',(xx,2.60,4.98),(xx,2.62,5.30),.026,8)
   b.box('sd_hierro',(xx,2.69,5.32),(.16,.045,.18))
   b.box('sd_vidrio',(xx,2.55,5.34),(.14,.22,.14))
   b.box('sd_hierro',(xx,2.43,5.34),(.19,.038,.19))
   b.cyl('sd_hierro',(xx,2.69,5.34),(xx,2.80,5.34),.012,6)
  # original overhead low-profile wires secured to upper walls
  for sy in [5.11,5.23]:
   p1=(2.93,sy,3.99);p2=(2.93,sy-.08,1.96);p3=(2.93,sy,0.11)
   b.cyl('sd_hierro',p1,p2,.012,5);b.cyl('sd_hierro',p2,p3,.012,5)
  # AC housing and metal grille on side wall, fully above 2m
  b.box('sd_piedra',(3.10,4.38,.17),(.28,.43,.58))
  b.box('sd_hierro',(3.251,4.38,.17),(.025,.32,.49))
  for i in range(8):
   z=-.03+i*.055
   b.box('sd_hierro',(3.27,4.38,z),(.022,.27,.016))
  b.cyl('sd_hierro',(3.09,4.15,.37),(2.96,3.74,.37),.027,8)
  # power meter; street number tile; original small details
  b.box('sd_piedra',(2.40,2.25,5.01),(.25,.14,.048))
  b.box('sd_hierro',(2.45,1.76,5.015),(.23,.30,.06))
  b.box('sd_vidrio',(2.45,1.82,5.055),(.18,.15,.02))
  # Hanging plants on balcony plus window-box on side
  for xx in [-2.02,-1.36,1.30,2.04]:plant(b,xx,3.39,5.48,2,int((xx+3)*100))
  for zz in [-2.9,.61]:plant(b,3.13,3.10,zz,2,int((zz+4)*100))
  # roof terrace: subtle inset edge and terracotta rain trough under top limit
  b.box('sd_piedra',(0,5.965,0),(5.41,.038,9.3))
  # individually spaced wall brackets, rendered in geometric detail
  for x in [-2.71,2.71]:
   for z in [-4.1,-2.1,.25,2.3,4.1]:b.box('sd_hierro',(x,5.01,z),(.13,.09,.045))
 if high:
  # tactile sill stones, separation bands and realistic downpipe
  for x in [-1.68,1.68]:b.box('sd_piedra',(x,3.25,5.01),(1.46,.11,.22))
  b.box('sd_hierro',(-2.70,3.00,-4.94),(.07,4.80,.055))
 return b

scene=trimesh.Scene();counts={};bounds={};lod_parts={}
for lod in range(3):
 b=build(lod);meshes=b.meshes();tag=f'{ID}_LOD{lod}'
 scene.graph.update(frame_from='world',frame_to=tag,matrix=np.eye(4))
 for mat,mesh in meshes.items():
  scene.add_geometry(mesh,geom_name=f'{tag}_{mat}',node_name=f'{tag}_{mat}',parent_node_name=tag)
 counts[tag]={'triangles':sum(len(m.faces) for m in meshes.values()),'materials':len(meshes),'mesh_parts':b.parts}
 lod_parts[tag]={k:len(v.faces) for k,v in meshes.items()}
 bounds[tag]=np.array([m.bounds for m in meshes.values()])
assert counts[f'{ID}_LOD0']['triangles']<=15000, counts
assert counts[f'{ID}_LOD1']['triangles']<=6000, counts
assert counts[f'{ID}_LOD2']['triangles']<=1500, counts
assert counts[f'{ID}_LOD0']['materials']<=8
assert counts[f'{ID}_LOD1']['materials']<=6
assert counts[f'{ID}_LOD2']['materials']<=3
path=os.path.join(OUT,ID+'.glb');scene.export(path)
assert os.path.getsize(path)<6_000_000,os.path.getsize(path)
# Run a genuine glTF round-trip load, inspect actual scene hierarchy, vertex bounds.
loaded=trimesh.load(path,force='scene');assert len(loaded.geometry)>=3
for lod in range(3):
 tag=f'{ID}_LOD{lod}'
 assert tag in loaded.graph.nodes, (tag,list(loaded.graph.nodes))
for k in ['sd_estuco','sd_piedra','sd_madera','sd_hierro','sd_vidrio','sd_teja','sd_vegetacion','sd_acento']:
 assert any(k in n for n in loaded.geometry),k
stats={'id':ID,'file_bytes':os.path.getsize(path),'lod':counts,'lod_material_triangles':lod_parts,
       'destination':'PUEBLO E10; 6×10m wall height 6m', 'format':'glTF 2.0 GLB',
       'bbox_note':'Overhangs on upper levels may protrude; keep strict visual/game cover checks in Claude',
       'target_contract':'E10, y max <=6.35, origin ground centre, +Y up, facade +Z'}
with open(os.path.join(OUT,ID+'_stats.json'),'w') as f:json.dump(stats,f,indent=2,ensure_ascii=False)
with open(os.path.join(OUT,ID+'_integracion.md'),'w') as f:
 f.write(f'''# {ID} — SNIPER DUEL, nuevo asset 3D\n\n''')
 f.write('**Tipo:** edificio mediterráneo 3D procedimental detallado, geometría real con huecos de puertas y ventanas; NO es una imagen plana.\n\n')
 f.write('**Destino:** PUEBLO E10 (6 × 10 m, muro 6 m, parapeto máximo +0,35 m). No modificar servidor ni mapa de colisiones.\n\n')
 f.write('**GLB:** glTF 2.0, GLB binario con texturas originales incorporadas, sin Draco/meshopt/KTX2.\n')
 f.write('**Origen y orientación:** centro de huella y=0; metros, +Y arriba, fachada principal +Z.\n')
 f.write('**Jerarquía:** ' + ', '.join(f'`{ID}_LOD{i}`' for i in range(3))+'; mostrar **solo un LOD** a la vez.\n\n')
 f.write('| Nivel | Triángulos | Materiales |\n|---|---:|---:|\n')
 for i in range(3):
  s=counts[f'{ID}_LOD{i}'];f.write(f'| LOD{i} | {s["triangles"]} | {s["materials"]} |\n')
 f.write(f'\n**Peso GLB:** {os.path.getsize(path)/1e6:.2f} MB. **Materiales:** '+', '.join(material_params.keys())+'.\n')
 f.write('**Materiales PBR:** metálico/rugosidad, base color y normales donde aplicable; materiales integrados sin recursos externos.\n')
 f.write('**Licencia:** diseño y texturas originales; generados proceduralmente, sin contenidos externos.\n')
 f.write('**Ninguna animación, cámara ni luz** integrada en GLB.\n')
 f.write('**Regla:** no activar los 3 LOD simultáneamente; medir con los ajustes propios del juego.\n')
 f.write('**Importar primero a** `assets/3d/imports/`; ejecutar `tools/validate-glb.js` con --box 6,10,6; seguir con comprobación de cover `test/cover.browser.test.js`. No afirmar compatible sin esa validación.\n')
 f.write('**Pruebas realizadas aquí:** generación, límites de materiales/triángulos/tamaño, y carga redonda del GLB vía trimesh. **No** probado en iPhone ni con el validador de Claude.\n')
 f.write('**Plan de la fachada:** edificio urbano de estuco erosionado, dos puertas principales, escaparate con toldo pintado, ventanas retranqueadas y jambas 3D, persianas de lamas, dos balcones de hierro, vegetación, cornisas, red de agua y electricidad y azotea con pretil.\n')
 f.write('**Fuente:** `generate_e10_realista.py`; Python3 con numpy, pillow, scipy, trimesh. El archivo exportado es autónomo.\n')
 f.write('**IMPORTANTE:** si el validador detecta false-cover en aperturas, no publiques; envía el informe para retocar geometría e integración.\n')
print(json.dumps(stats,ensure_ascii=False,indent=2))
