import os,json,math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from scipy.ndimage import gaussian_filter
import trimesh
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));T=ROOT+'/textures';M=ROOT+'/models';P=ROOT+'/previews'
os.makedirs(T,exist_ok=True);os.makedirs(M,exist_ok=True);os.makedirs(P,exist_ok=True)
rng=np.random.default_rng(24671012);N=1024
Y,X=np.mgrid[:N,:N].astype(np.float32);x=X/N;y=Y/N

def periodic_noise(sig,amp=1):
 a=rng.normal(0,1,(N,N)).astype(np.float32)
 a=gaussian_filter(a,sig,mode='wrap');a/=max(float(a.std()),1e-6)
 return a*amp
fine=periodic_noise(2,1); medium=periodic_noise(12,1); broad=periodic_noise(55,1)
# Coordinates are continuous on a torus, with periodic jitter in both axes
warp_x=0.021*np.sin(2*np.pi*3*y+0.65*np.sin(2*np.pi*2*x))+0.008*np.sin(2*np.pi*7*y+2*np.pi*3*x)
warp_y=0.020*np.sin(2*np.pi*2*x+0.7*np.sin(2*np.pi*3*y))+0.008*np.sin(2*np.pi*9*x+2*np.pi*4*y)
materials={'plaza':dict(cols=4,rows=4,base=(171,158,137),repeat=2.0,joint=.013,bevel=.019,depth=.010,warp=.03),
'cobble':dict(cols=9,rows=10,base=(146,144,137),repeat=2.0,joint=.035,bevel=.035,depth=.013,warp=1.0),
'sidewalk':dict(cols=4,rows=4,base=(173,167,151),repeat=1.5,joint=.015,bevel=.025,depth=.007,warp=.08),
'sand':dict(cols=0,rows=0,base=(169,149,117),repeat=3.0,joint=0,bevel=0,depth=.005,warp=0),
'patch':dict(cols=5,rows=6,base=(152,144,128),repeat=2.0,joint=.025,bevel=.027,depth=.012,warp=.38)}
metrics={}
for name,p in materials.items():
 if all(os.path.exists(f'{T}/sd_ground_{name}_01_{suffix}.png') and os.path.getsize(f'{T}/sd_ground_{name}_01_{suffix}.png')>10000 for suffix in ['basecolor','normal','roughness']):
  metrics[name]={'repeat_m':p['repeat'],'cached':True,'stone_count_xy':[p['cols'],p['rows']]};print('cached',name,flush=True);continue
 C,R=p['cols'],p['rows'];base=np.array(p['base'],dtype=np.float32)
 if C:
  # stagger only for cobble and patch; even number of rows ensures tilability
  yy=y*R+warp_y*p['warp'];row=np.floor(yy).astype(np.int32);shift=(row%2)*(.5 if name in ('cobble','patch') else 0)
  xx=x*C+shift+warp_x*p['warp'];col=np.floor(xx).astype(np.int32)
  fx=xx-np.floor(xx);fy=yy-np.floor(yy)
  edge=np.minimum(np.minimum(fx,1-fx),np.minimum(fy,1-fy))
  # mortar width measured as fractions of one tile; bevel stones after seam
  profile=np.clip((edge-p['joint'])/max(p['bevel'],.001),0,1)
  profile=profile*profile*(3-2*profile)
  m=1-profile
  ids=np.mod(row,R)*C+np.mod(col,C)
  tile_rng=np.random.default_rng(1000+len(name));colors=tile_rng.uniform(-13,13,(C*R,3)).astype(np.float32)
  color_variation=colors[ids]
  # Real height variation: raised stone centers; recessed mortar, pitted stone surfaces
  height=p['depth']*profile + .0018*fine+.0011*medium+.0008*broad
  height -= m*(p['depth']*.28)
  roughness=.85+.038*medium+.025*fine+.045*m
  color=base+color_variation+5*fine[...,None]+3.5*medium[...,None]+4*broad[...,None]-m[...,None]*np.array([28,27,23])
 else:
  height=.0025*fine+.0013*medium+.001*broad
  roughness=.94+.023*medium+.010*fine
  color=base+7*fine[...,None]+6*medium[...,None]+7*broad[...,None]
 # OpenGL +Y tangent space: green positive on upward slopes. z starts +1.
 pixel_m=p['repeat']/N
 dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))/(2*pixel_m)
 dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))/(2*pixel_m)
 vx=-dx;vy=-dy;vz=np.ones_like(vx)
 norm=np.sqrt(vx*vx+vy*vy+vz*vz);normals=np.stack([vx/norm,vy/norm,vz/norm],axis=2)
 # For sand normal moderately calmer, don't make false rock bumps
 color=np.clip(color,45,218).astype('uint8')
 nimage=np.clip((normals*.5+.5)*255,0,255).astype('uint8')
 rimage=np.clip(roughness*255,0,255).astype('uint8')
 for suffix,arr in [('basecolor',color),('normal',nimage),('roughness',rimage)]:
  Image.fromarray(arr).save(f'{T}/sd_ground_{name}_01_{suffix}.png',compress_level=1)
 metrics[name]={'repeat_m':p['repeat'],'mean_base_srgb':round(float(color.mean()),1),'mean_normal_z':round(float(normals[:,:,2].mean()),4),'seam_x_mean_abs_px':round(float(np.abs(color[:,0].astype(float)-color[:,-1]).mean()),2),'seam_y_mean_abs_px':round(float(np.abs(color[0].astype(float)-color[-1]).mean()),2),'stone_count_xy':[C,R]}
 print(name,metrics[name],flush=True)
# Atlas with 16px guard band, richer jagged terrain-style outlines using multiscale irregular strokes
at=Image.new('RGBA',(1024,1024),(0,0,0,0)); ad=ImageDraw.Draw(at,'RGBA')
names=['crack_thin','crack_medium','dirt_patch','wet_mark','sand_scatter','wheel_mark','edge_grime','pavement_chips','manhole_round','drain_grate','service_cover','stone_break','dust_specks','crack_branch','stain_spots','grit_cluster']
for i,name in enumerate(names):
 ox=(i%4)*256;oy=(i//4)*256; left=ox+18;top=oy+18;right=ox+237;bottom=oy+237
 def point(px,py):return (ox+int(px),oy+int(py))
 if name.startswith('crack'):
  pts=[]; xx=24; yy=int(rng.integers(96,151))
  while xx<227:
   pts.append(point(xx,yy));xx+=int(rng.integers(5,12));yy=int(np.clip(yy+rng.integers(-13,14),26,226))
  ad.line(pts,fill=(37,34,31,232),width=3 if name=='crack_thin' else 6,joint='curve')
  ad.line([(p[0],p[1]-2) for p in pts],fill=(178,161,137,100),width=2)
  for j in ([5,12,17] if name!='crack_thin' else [9]):
   if j<len(pts):
    a=pts[j]; bx=int(np.clip(a[0]+rng.integers(-22,25),left,right));by=int(np.clip(a[1]+rng.integers(-45,46),top,bottom))
    ad.line((a,(bx,by)),fill=(35,31,27,175),width=2)
 elif name in ('manhole_round','service_cover','drain_grate'):
  if name=='manhole_round':
   ad.ellipse((ox+39,oy+39,ox+216,oy+216),fill=(78,78,75,255),outline=(23,25,24,255),width=8)
   ad.ellipse((ox+56,oy+56,ox+200,oy+200),outline=(151,150,141,255),width=3)
   for k in range(0,360,20):
    theta=np.deg2rad(k);cx=128+76*np.cos(theta);cy=128+76*np.sin(theta)
    ad.ellipse((ox+cx-3,oy+cy-3,ox+cx+3,oy+cy+3),fill=(31,34,34,255))
   for k in range(6):
    yy=ox+75+k*15;ad.line((ox+75,oy+78+k*15,ox+181,oy+78+k*15),fill=(37,39,39,255),width=4)
  else:
   ad.rounded_rectangle((ox+31,oy+62,ox+225,oy+192),radius=9,fill=(88,90,89,255),outline=(31,34,35,255),width=7)
   if name=='drain_grate':
    for k in range(40,225,17):ad.rounded_rectangle((ox+k,oy+74,ox+k+8,oy+181),radius=3,fill=(15,21,23,255))
   else:
    ad.rectangle((ox+56,oy+79,ox+200,oy+179),outline=(26,28,27,255),width=5)
    for k in range(4):ad.line((ox+77,oy+96+k*20,ox+181,oy+96+k*20),fill=(38,41,42,255),width=5)
 elif name=='wheel_mark':
  for band in (90,159):
   for t in range(25,230,11):
    xx=band+6*np.sin(t/65);ad.line((point(xx,t),point(xx+8,t+6)),fill=(49,47,43,115),width=6)
 else:
  hues={'dirt_patch':(72,65,52),'wet_mark':(65,70,65),'sand_scatter':(150,129,93),'edge_grime':(79,71,57),'pavement_chips':(97,90,80),'stone_break':(79,76,68),'dust_specks':(143,120,87),'stain_spots':(70,68,64),'grit_cluster':(116,98,71)}
  hue=hues.get(name,(83,74,61));count=500 if 'sand' in name or 'grit' in name or 'dust' in name else 250
  for k in range(count):
   u=float(rng.normal(128,52));v=float(rng.normal(128,48));r=float(rng.uniform(1,2.5 if count>400 else 5.0))
   if 18+r<u<238-r and 18+r<v<238-r:
    ad.ellipse((ox+u-r,oy+v-r,ox+u+r,oy+v+r),fill=(*hue,int(rng.integers(22,112))))
at.save(T+'/sd_ground_decal_atlas_01.png',optimize=True)
# transition alpha: periodic x coordinate; 1m strip through y. No uniform flat color.
w,h=1024,256;tx=np.arange(w,dtype=np.float32)/w;ty=np.arange(h,dtype=np.float32)/h
variation=(.035*np.sin(2*np.pi*3*tx+0.25)+.020*np.sin(2*np.pi*7*tx+1)+.013*np.sin(2*np.pi*19*tx+.2))
bound=.48+variation;alpha=np.clip((ty[:,None]-bound[None,:])*115+0.5,0,1)
alpha=(alpha*255).astype('uint8')
colors=np.zeros((h,w,3),dtype=np.float32);val=(4*np.sin(2*np.pi*7*tx)+3*np.sin(2*np.pi*13*tx+1.8)+2*np.sin(2*np.pi*31*tx))
for k,ch in enumerate([163,144,113]):colors[:,:,k]=ch+val[None,:]+3*np.sin(2*np.pi*ty[:,None]*4+k)
Image.fromarray(np.dstack([np.clip(colors,0,255).astype('uint8'),alpha]),'RGBA').save(T+'/sd_ground_transition_sand_stone_01.png')
# GLB curb kit - unique vertices normals and UV with a shared texture material. Geometry +Y, street +Z, -Z behind.
scene=trimesh.Scene();model_names=[]
matimg=Image.new('RGB',(64,64),(156,149,138));md=ImageDraw.Draw(matimg)
for j in range(140):
 px=int(rng.integers(0,64));py=int(rng.integers(0,64));c=int(rng.integers(130,180));md.point((px,py),fill=(c,c-6,c-15))
matimg.save(T+'/sd_ground_curb_01_basecolor.png')
def add(name,meshes):
 mesh=trimesh.util.concatenate(meshes) if len(meshes)>1 else meshes[0]
 mesh.unmerge_vertices()
 # planar simple UV for material, every triangle independent
 uv=(mesh.vertices[:,[0,2]]*1.5)%1
 mesh.visual=trimesh.visual.TextureVisuals(uv=uv,material=trimesh.visual.material.PBRMaterial(name='sd_ground_curb_01',baseColorTexture=matimg,roughnessFactor=.88,metallicFactor=0))
 _=mesh.vertex_normals
 scene.add_geometry(mesh,geom_name=name,node_name=name);model_names.append(name)
def box(ext,pos):
 m=trimesh.creation.box(extents=ext);m.apply_translation(pos);return m
# always origin at beginning of street-facing edge, segment runs +X, width towards -Z
for lod in (0,1):
 add(f'sd_curb_straight_1m_LOD{lod}',[box((1,.09,.2),(.5,.045,-.1))]+([] if lod else [box((1,.008,.04),(.5,.094,-.18))]))
 add(f'sd_curb_straight_2m_LOD{lod}',[box((2,.09,.2),(1,.045,-.1))]+([] if lod else [box((2,.008,.04),(1,.094,-.18))]))
 # corners: distinct inner vs outer L footprints, not mirrored duplicates
 add(f'sd_curb_corner_outer_90_LOD{lod}',[box((1,.09,.2),(.5,.045,-.1)),box((.2,.09,.8),(.1,.045,-.6))])
 add(f'sd_curb_corner_inner_90_LOD{lod}',[box((1,.09,.2),(.5,.045,-.1)),box((.2,.09,.8),(.9,.045,-.6))])
 add(f'sd_curb_endcap_LOD{lod}',[box((.24,.09,.2),(.12,.045,-.1))])
 add(f'sd_curb_drain_insert_LOD{lod}',[box((1,.09,.2),(.5,.045,-.1))]+([] if lod else [box((.35,.006,.1),(.5,.095,-.08))]))
 add(f'sd_curb_threshold_low_LOD{lod}',[box((1,.065,.24),(.5,.0325,-.12))])
 v=np.array([[0,0,-.2],[0,0,0],[0,.09,-.2],[0,.09,0],[1,0,-.2],[1,0,0]],float)
 f=np.array([[0,1,3],[0,3,2],[0,4,5],[0,5,1],[2,3,5],[2,5,4],[0,2,4],[1,5,3]])
 ramp=trimesh.Trimesh(vertices=v,faces=f,process=False)
 add(f'sd_curb_ramp_1m_LOD{lod}',[ramp])
file=M+'/sd_ground_curb_kit_01.glb';open(file,'wb').write(scene.export(file_type='glb'))
# visual contact sheet
sheet=Image.new('RGB',(1500,470),(32,33,33));dd=ImageDraw.Draw(sheet)
for i,name in enumerate(materials):
 im=Image.open(f'{T}/sd_ground_{name}_01_basecolor.png').resize((294,294));sheet.paste(im,(i*300,0))
 dd.text((i*300+8,314),name.upper(),fill='white')
 nn=Image.open(f'{T}/sd_ground_{name}_01_normal.png').resize((145,145));sheet.paste(nn,(i*300,333))
sheet.save(P+'/p0_v2_materials.jpg',quality=90)
manifest={'pack':'Sniper Duel P0 Ground v2','version':'2.0','textures_resolution':1024,'surfaces':metrics,'atlas_cells':{n:[i%4,i//4] for i,n in enumerate(names)},'decal_margin':16,'transition_repeat_m_longitudinal':2.0,'transition_width_m':1.0,'curb_nodes':model_names,'author':'ChatGPT original procedural assets','note':'Test in Claude validator before deployment. Original 1024 maps; downsample at integration.'}
open(ROOT+'/manifest.json','w').write(json.dumps(manifest,indent=2,ensure_ascii=False))
print('finished',os.path.getsize(file),flush=True)
