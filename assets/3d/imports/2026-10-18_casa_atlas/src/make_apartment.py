#!/usr/bin/env python3
"""SNIPER DUEL: CASA ATLAS 1v1. Rebuildable authored geometry + PBR GLB.
License for generated geometry/materials: CC0. Supplied beige_wall_001: Poly Haven CC0.
"""
from __future__ import annotations
from collections import defaultdict
from pathlib import Path
import math, random, json, io
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT/'models'; MODELS.mkdir(exist_ok=True)
PREVIEW = ROOT/'preview'; PREVIEW.mkdir(exist_ok=True)
RNG=random.Random(20261017)

# World axes: +Y up, +Z toward south-facing balcony. All quantities in meters.
W=18.; D=14.; HEIGHT=3.12
BATCH=defaultdict(list)
COLLIDERS=[]; VISUALS=[]
COLORS={
 'floor_oak':(157,110,71), 'floor_concrete':(141,145,142),'floor_tile':(177,177,166),
 'wall_plaster':(219,211,196), 'wall_accent':(175,153,130), 'wall_tile':(196,196,183),
 'trim_white':(235,227,213),'wood_dark':(72,53,42),'wood_warm':(132,86,54),
 'metal_dark':(39,44,49),'steel':(112,120,125),'glass':(126,171,185),
 'counter_stone':(194,189,174),'sofa_fabric':(125,132,127),'sofa_light':(190,181,166),
 'soft_cloth':(198,178,149),'bed_linen':(220,219,209),'black':(27,29,33),
 'green_leaf':(64,99,64),'terracotta':(157,86,61),'gold':(197,146,73),
 'light_glow':(239,224,181),'screen':(55,84,100), 'bath_white':(225,224,213),
 'rug':(171,141,111), 'balcony_stone':(169,166,156)
}
TEXTURES={}

def _tile_texture(color, typ, n=512):
    np_rng=np.random.default_rng({'floor_oak':11,'floor_tile':21,'floor_concrete':32,'wall_plaster':43,'wall_accent':44,'wall_tile':45,'sofa_fabric':55,'soft_cloth':56,'rug':57,'wood_dark':61,'wood_warm':62,'counter_stone':63,'balcony_stone':64}.get(typ,73))
    xs=np.arange(n)[None,:].repeat(n,axis=0).astype(float)
    ys=np.arange(n)[:,None].repeat(n,axis=1).astype(float)
    fine=np_rng.normal(0, 2.8, (n,n))
    wave=np.sin(xs*0.07 + 0.9*np.sin(ys*0.017))*1.5
    base=np.zeros((n,n,3),dtype=float); base[:]=color
    shade= fine + wave
    if typ in ('floor_oak','wood_dark','wood_warm'):
        grain=np.sin(xs*.4+np.sin(ys*.042)*7)*3 + np.sin(xs*.12+ys*.005)*3
        shade+=grain+np_rng.normal(0,1,(n,n))
        d=ImageDraw.Draw(Image.fromarray(np.uint8(np.clip(base+shade[:,:,None],0,255))))
        img=Image.fromarray(np.uint8(np.clip(base+shade[:,:,None],0,255))); d=ImageDraw.Draw(img)
        for i in range(0,n,96):
            d.line((i,0,i,n),fill=tuple(int(max(0,c-21)) for c in color),width=2)
        for row in range(0,n,128):
            d.line((0,row,n,row),fill=tuple(int(max(0,c-18)) for c in color),width=2)
        return img
    elif typ in ('floor_tile','wall_tile','balcony_stone'):
        img=Image.fromarray(np.uint8(np.clip(base+shade[:,:,None],0,255))); d=ImageDraw.Draw(img)
        step=128 if typ != 'wall_tile' else 85
        for x in range(0,n,step):
            d.line((x,0,x,n),fill=tuple(int(max(0,c-25)) for c in color),width=3)
            d.line((x+4,0,x+4,n),fill=tuple(int(min(255,c+9)) for c in color),width=1)
        for y in range(0,n,step):
            d.line((0,y,n,y),fill=tuple(int(max(0,c-23)) for c in color),width=3)
        return img
    elif typ in ('floor_concrete','counter_stone'):
        shade += np_rng.normal(0,4,(n,n))
        shade += np.sin(xs*.02+ys*.007)*1.2
    elif typ in ('sofa_fabric','soft_cloth','rug'):
        shade += (np.sin(xs*.65)*np.sin(ys*.65))*4
        if typ=='rug': shade += np.sin(xs*.045+ys*.075)*2
    else:
        shade += np_rng.normal(0,2,(n,n))
        shade += np.sin(xs*.003+ys*.019)*1.1
    return Image.fromarray(np.uint8(np.clip(base+shade[:,:,None],0,255)))

# Use provided actual CC0 scan in wall material, never call it a bespoke material.
cc0 = ROOT/'assets'/'beige_wall_001_color.png'
for key,c in COLORS.items():
    if key in ('wall_plaster','wall_accent') and cc0.exists():
        im=Image.open(cc0).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
        arr=np.asarray(im).astype(np.float32)
        mean=np.maximum(arr.mean(axis=(0,1)),1)
        scale=np.array(c)/mean
        arr=np.clip(arr*scale[None,None,:],0,255).astype('uint8')
        TEXTURES[key]=Image.fromarray(arr)
    elif key in ('floor_oak','floor_tile','floor_concrete','wall_tile','wood_dark','wood_warm','sofa_fabric','soft_cloth','rug','counter_stone','balcony_stone'):
        TEXTURES[key]=_tile_texture(c,key,512)

MATERIAL={}
for key,c in COLORS.items():
    # Metallic/roughness natural-looking and materials shared for all objects of this type.
    rough = .34 if key in ('metal_dark','steel','gold') else (.17 if key=='glass' else .78)
    met = .85 if key in ('metal_dark','steel','gold') else 0.
    kw = {'name':'sd_apto_'+key, 'baseColorFactor':[255,255,255,255], 'metallicFactor':met, 'roughnessFactor':rough}
    if key in TEXTURES: kw['baseColorTexture']=TEXTURES[key]
    if key in ('wall_plaster','wall_accent') and (ROOT/'assets'/'beige_wall_001_normal_gl.png').exists():
        kw['normalTexture']=Image.open(ROOT/'assets'/'beige_wall_001_normal_gl.png').convert('RGB')
        kw['metallicRoughnessTexture']=Image.open(ROOT/'assets'/'beige_wall_001_metalrough.png').convert('RGB')
        kw['roughnessFactor']=1.0
    else: kw['baseColorFactor']=[*c, int(110 if key=='glass' else 255)]
    if key=='glass': kw['alphaMode']='BLEND'; kw['doubleSided']=True
    MATERIAL[key]=PBRMaterial(**kw)

# Build geometries with hard face normals, meter-based UV maps, so textures repeat
# instead of stretching even across long hallway surfaces.
def add_quad(key, pts, uv_scale=(1.,1.), part='architecture', uv_override=None):
    pts=np.array(pts,dtype=np.float64)
    if len(pts)!=4: raise ValueError('quad')
    v1=pts[1]-pts[0]; v2=pts[3]-pts[0]
    face=np.cross(v1,v2)
    if np.linalg.norm(face)<1e-8: return
    face/=np.linalg.norm(face)
    uv=uv_override if uv_override else [(0,0),(np.linalg.norm(v1)/uv_scale[0],0),(np.linalg.norm(v1)/uv_scale[0],np.linalg.norm(v2)/uv_scale[1]),(0,np.linalg.norm(v2)/uv_scale[1])]
    BATCH[(part,key)].append((pts,np.array([[0,1,2],[0,2,3]]),np.array(uv,dtype=float),np.tile(face,(4,1))))

def add_box(key,loc,dim, part='architecture', solid=False, note='', face_sides=True):
    x,y,z=loc; a,b,c=dim
    lo=np.array([x-a/2,y-b/2,z-c/2]); hi=np.array([x+a/2,y+b/2,z+c/2]);
    # Faces outward, coordinate direction winding.
    corners=[
      [(lo[0],lo[1],hi[2]),(hi[0],lo[1],hi[2]),(hi[0],hi[1],hi[2]),(lo[0],hi[1],hi[2])], # +z? cross x,y = +z yes
      [(hi[0],lo[1],lo[2]),(lo[0],lo[1],lo[2]),(lo[0],hi[1],lo[2]),(hi[0],hi[1],lo[2])],
      [(hi[0],lo[1],hi[2]),(hi[0],lo[1],lo[2]),(hi[0],hi[1],lo[2]),(hi[0],hi[1],hi[2])],
      [(lo[0],lo[1],lo[2]),(lo[0],lo[1],hi[2]),(lo[0],hi[1],hi[2]),(lo[0],hi[1],lo[2])],
      [(lo[0],hi[1],hi[2]),(hi[0],hi[1],hi[2]),(hi[0],hi[1],lo[2]),(lo[0],hi[1],lo[2])],
      [(lo[0],lo[1],lo[2]),(hi[0],lo[1],lo[2]),(hi[0],lo[1],hi[2]),(lo[0],lo[1],hi[2])]
    ]
    for p in corners:
        add_quad(key,p, uv_scale=(1.2,1.2) if 'floor' not in key else (1.75,1.75),part=part)
    if solid: COLLIDERS.append({'name':note or (part+'_'+key+'_'+str(len(COLLIDERS))), 'center':list(map(lambda u:round(float(u),3),loc)), 'size':list(map(lambda u:round(float(u),3),dim)),'type':'solid'})
    return (lo,hi)

def add_mesh(mesh,key,part='details'):
    verts=mesh.vertices.copy(); faces=mesh.faces.copy()
    # face normals with separate vertices
    pts=verts[faces].reshape(-1,3)
    f=np.arange(len(pts),dtype=np.int64).reshape(-1,3)
    norm=np.repeat(mesh.face_normals,3,axis=0)
    uv=np.zeros((len(pts),2)); uv[:,0]=pts[:,0]*0.35;uv[:,1]=pts[:,2]*0.35
    BATCH[(part,key)].append((pts,f,uv,norm))

def cylinder(key, position, radius, length, axis='y', part='details', sections=12):
    mesh=trimesh.creation.cylinder(radius=radius,height=length,sections=sections)
    if axis=='y': mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[1,0,0]))
    if axis=='x': mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[0,1,0]))
    mesh.apply_translation(position); add_mesh(mesh,key,part)

def ball(key,pos,r,part='details',sub=1):
    mesh=trimesh.creation.icosphere(subdivisions=sub,radius=r); mesh.apply_translation(pos); add_mesh(mesh,key,part)

def wall_x(x,z0,z1,openings=[],key='wall_plaster',thick=.18,height=HEIGHT):
    wall_with_openings('x',x,z0,z1,openings,key,thick,height)

def wall_z(z,x0,x1,openings=[],key='wall_plaster',thick=.18,height=HEIGHT):
    wall_with_openings('z',z,x0,x1,openings,key,thick,height)

def wall_with_openings(axis,where,a,b,openings,key,t,h):
    edges=sorted(set([a,b]+[float(op[0]) for op in openings]+[float(op[1]) for op in openings]))
    for u,v in zip(edges[:-1],edges[1:]):
        mid=(u+v)*.5
        op=next((op for op in openings if op[0]<=mid<=op[1]),None)
        if op is None: spans=[(0,h)]
        else:
            low=float(op[2]); high=float(op[3]); spans=([(0,low)] if low>0 else [])+([(high,h)] if high<h else [])
        for low,high in spans:
            loc=(where,(low+high)*.5,mid) if axis=='x' else (mid,(low+high)*.5,where)
            size=(t,high-low,v-u) if axis=='x' else (v-u,high-low,t)
            if high-low<.02:continue
            add_box(key,loc,size,solid=True,note='wall_'+axis+'_'+str(round(where,2))+'_'+str(round(mid,2))+'_'+str(round(low,1)))
    # Add inset real trim at door/window openings
    for u,v,low,high,*opts in openings:
        kind=opts[0] if opts else 'door'
        if kind=='door':
            if axis=='z':
                for xx in (u,v): add_box('wood_dark',(xx,high/2,where),(.085,high,.22),part='furniture')
                add_box('wood_dark',((u+v)/2,high+.04,where),(v-u+.18,.08,.24),part='furniture')
            else:
                for zz in (u,v): add_box('wood_dark',(where,high/2,zz),(.22,high,.085),part='furniture')
                add_box('wood_dark',(where,high+.04,(u+v)/2),(.24,.08,v-u+.18),part='furniture')
        elif kind=='window':
            if axis=='z':
                add_box('metal_dark',((u+v)/2,high-.025,where),(v-u,.055,.10),part='furniture')
                add_box('metal_dark',((u+v)/2,low+.025,where),(v-u,.055,.10),part='furniture')
                for xx in (u,v): add_box('metal_dark',(xx,(low+high)/2,where),(.06,high-low,.10),part='furniture')
                add_box('glass',((u+v)/2,(low+high)/2,where),(v-u-.09,high-low-.10,.018),part='glass')
            else:
                add_box('metal_dark',(where,high-.025,(u+v)/2),(.10,.055,v-u),part='furniture')
                add_box('metal_dark',(where,low+.025,(u+v)/2),(.10,.055,v-u),part='furniture')
                for zz in (u,v): add_box('metal_dark',(where,(low+high)/2,zz),(.10,high-low,.06),part='furniture')
                add_box('glass',(where,(low+high)/2,(u+v)/2),(.018,high-low-.10,v-u-.09),part='glass')

# ---------- Structural shell: the actual playable single-floor environment ----------
# Main room interior dimensions 17.4 x 11.9; balcony across south edge.
add_box('floor_concrete',(0,-.26,-.75),(18,.5,12.5),solid=False)
add_box('balcony_stone',(0,-.21,6.15),(18,.42,1.70),part='architecture')
# floor room finish placed 1.5 cm above slab (floor y=0)
add_box('floor_oak',(-2.4,-.012,1.4),(12.0,.025,7.35)) # main + office area
add_box('floor_tile',(6.1,-.006,-2.4),(5.35,.023,8.3))
add_box('floor_oak',(-6.1,-.006,-4.25),(5.3,.023,4.85))
add_box('floor_tile',(-1.45,-.005,-5.25),(4.7,.025,2.9))
add_box('floor_oak',(1.65,-.009,-2.85),(3.4,.025,1.95))
add_box('floor_tile',(6.1,-.006,3.15),(5.35,.023,4.1))
# outer perimeter w windows: glass solid visually, boundary collider wall segments only
wall_z(-6.7,-8.7,8.7,openings=[(-7.2,-5.2,1.25,2.35,'window'),(5.45,7.5,1.15,2.38,'window')])
wall_x(-8.7,-6.7,5.3,openings=[(-.4,1.9,1.1,2.45,'window')])
wall_x(8.7,-6.7,5.3,openings=[(-3.5,-1.1,1.1,2.4,'window'),(2.15,4.45,1.1,2.4,'window')])
# balcony wall with two glazed sections and a walkable doorway center
wall_z(5.3,-8.7,8.7,openings=[(-7.4,-5.45,1.15,2.47,'window'),(-3.85,-2.4,.0,2.45,'door'),(-1.7,1.3,0,2.68,'window'),(1.6,4.5,0,2.68,'window'),(5.45,6.85,0,2.45,'door')])
# balcony rail knee wall + dark metal posts & transparent upper rails
for xx in np.arange(-8.4,8.45,1.7):
    add_box('metal_dark',(float(xx),.58,7.0),(.055,1.12,.06),part='architecture')
add_box('metal_dark',(0,1.1,7.0),(17.3,.07,.075),part='architecture')
add_box('metal_dark',(0,.20,7.0),(17.3,.05,.08),part='architecture')
for edge in [-8.85,8.85]:add_box('metal_dark',(edge,.53,6.1),(.055,1.1,1.8),part='architecture')
# bedroom NW, bathroom N-center, corridor and kitchen NE
wall_z(-2.25,-8.7,-3.55,openings=[(-6.95,-5.45,0,2.25,'door')])
wall_x(-3.55,-6.7,-2.25,openings=[(-3.75,-2.45,0,2.25,'door')])
wall_z(-3.72,-3.55,.85,openings=[(-1.35,-.20,0,2.22,'door')])
wall_x(.85,-6.7,-3.72,openings=[])
wall_x(3.43,-6.7,5.3,openings=[(-3.45,-2.15,0,2.25,'door'),(-.65,.75,0,2.35,'door'),(2.30,3.75,0,2.30,'door')])
# short partition creating alcove office, leave accessible portal
wall_x(-4.8,-2.25,1.55,openings=[(.15,1.25,0,2.20,'door')])
# kitchen separated from right-side entry alcove with circulation gap
wall_z(1.15,3.43,8.7,openings=[(5.2,6.95,0,2.4,'door')])
# capping decorative baseboards (not collision) separate small strips along wall corridors
for z,a,b in [(-6.55,-8.4,8.4),(-2.1,-8.2,-7.1),(-2.1,-5.35,-3.8),(5.15,-8.3,-4.0),(5.15,-2.25,-1.86),(5.15,4.65,5.3)]:
    add_box('trim_white',((a+b)/2,.075,z),(b-a,.15,.042),part='details')
# floor direction chevrons (visual wood seams) - sparingly near living
for x in [-4.1,-2.5,-.9,.7,2.3]:
    add_box('wood_warm',(x,.005,1.0),(.009,.008,6.7),part='details')

# ---------- Furniture as real 3D geometry ----------
def furniture_box(key,pos,size, solid=False, name=None):
    return add_box(key,pos,size,part='furniture',solid=solid,note=name or '')

def table(x,z,w,d,height=.72,key='wood_warm',name='table',solid=True):
    furniture_box(key,(x,height,z),(w,.095,d),solid=solid,name=name+'_top')
    for ox in (-w/2+.09,w/2-.09):
        for oz in (-d/2+.09,d/2-.09):
            furniture_box('metal_dark',(x+ox,height/2,z+oz),(.07,height-.05,.07))

def sofa(x,z,length=2.5,rot=0):
    # axis length x by default; deep low modular sofa, includes cushion seams and angled back
    furniture_box('sofa_fabric',(x,.29,z),(length,.43,.95),solid=True,name='sofa_base')
    furniture_box('sofa_light',(x,.55,z+.39),(length,.63,.24),solid=True,name='sofa_back')
    for edge in (-length/2+.11,length/2-.11):
        furniture_box('sofa_fabric',(x+edge,.54,z),(.22,.59,1.02))
    for cx in np.linspace(-length/2+length/6,length/2-length/6,3):
        furniture_box('sofa_light',(x+float(cx),.54,z-.09),(length/3-.035,.115,.73))
        furniture_box('soft_cloth',(x+float(cx),.69,z+.19),(.50,.36,.18))
    for dx in (-length/2+.13,length/2-.13):
        furniture_box('metal_dark',(x+dx,.055,z-.33),(.065,.11,.064))

def plant(x,z,scale=1.):
    cylinder('terracotta',(x,.17*scale,z),.17*scale,.32*scale,sections=10)
    cylinder('wood_dark',(x,.38*scale,z),.035*scale,.45*scale,sections=7)
    for k in range(7):
        angle=k*2.4;rr=scale*(.12+.18*(k%3)/2)
        ball('green_leaf',(x+math.cos(angle)*rr,.58*scale+((k%4)-2)*.055*scale,z+math.sin(angle)*rr),.13*scale,sub=1)

def picture(x,y,z,w=1.3,h=.85,side='z'):
    # Picture hanging on a solid wall. Surface parallel to wall.
    if side=='z':
        furniture_box('wood_dark',(x,y,z),(w+.09,h+.09,.065))
        furniture_box('screen',(x,y,z+.040),(w,h,.014))
        furniture_box('gold',(x-.12,y+.05,z+.049),(.22,.16,.010))
        furniture_box('soft_cloth',(x+.22,y-.09,z+.049),(.40,.18,.011))
    else:
        furniture_box('wood_dark',(x,y,z),(.06,h+.09,w+.09))
        furniture_box('screen',(x-.042,y,z),(.013,h,w))

def lights(x,z,height=2.86):
    cylinder('metal_dark',(x,height-.08,z),.13,.13,sections=12)
    cylinder('light_glow',(x,height-.155,z),.095,.025,sections=12)

# living room x -4.8..3.43 z -2.25..5.3
sofa(-1.3,3.15,length=2.76)
furniture_box('rug',(-.65,.025,1.67),(4.0,.028,2.55))
table(-.65,1.70,1.35,.70,height=.39,key='wood_dark',name='coffee',solid=True)
furniture_box('wood_dark',(-1.20,.54,-1.86),(2.65,.53,.40),solid=True,name='media_console')
furniture_box('black',(-1.20,1.38,-2.11),(1.80,1.00,.07))
furniture_box('screen',(-1.20,1.38,-2.068),(1.69,.87,.019))
for dx in (-1.6,-.8): furniture_box('metal_dark',(dx,.76,-1.86),(.08,.09,.22))
plant(-4.05,4.25,1.3); plant(2.75,4.42,1.15)
for xx in (-3.3,1.95):
    furniture_box('wood_warm',(xx,.76,.2),(.43,.065,.4));
    cylinder('gold',(xx,.96,.2),.075,.32,sections=10)
for x,z in [(-2.5,-.1),(2.35,-.2),(-3.1,3.55)]: lights(x,z)
# book shelf right of bedroom entrance
furniture_box('wood_dark',(-4.46,1.01,-1.32),(.30,1.9,1.0),solid=True,name='bookshelf')
for h in (.51,1.02,1.56):
    furniture_box('wood_warm',(-4.28,h,-1.32),(.33,.05,.93))
    for dz in (-.30,.04,.29): furniture_box('soft_cloth',(-4.20,h+.12,-1.32+dz),(.22,.20,.08))

# bedroom NW
furniture_box('wood_dark',(-6.10,.20,-4.67),(1.93,.39,2.20),solid=True,name='bed_base')
furniture_box('bed_linen',(-6.10,.47,-4.64),(1.85,.21,2.15))
furniture_box('soft_cloth',(-6.10,.61,-5.10),(1.80,.08,1.21))
for x in (-6.54,-5.65): furniture_box('bed_linen',(x,.72,-5.65),(.72,.18,.42))
furniture_box('wood_warm',(-6.10,.80,-5.88),(2.0,1.3,.17))
for x in (-7.53,-4.60):
    furniture_box('wood_warm',(x,.42,-5.63),(.40,.67,.48),solid=True,name='bedside')
    cylinder('light_glow',(x,.98,-5.63),.12,.2,sections=12)
furniture_box('wood_warm',(-8.12,1.10,-4.05),(.5,2.10,1.90),solid=True,name='wardrobe')
for z in (-4.45,-3.66): furniture_box('metal_dark',(-7.82,1.18,z),(.03,.22,.025))
plant(-7.95,-2.73,.72);picture(-6,1.78,-6.55,1.05,.7)
lights(-6.1,-3.2)

# bathroom north-center
furniture_box('wall_tile',(-1.35,1.10,-6.51),(4.28,2.05,.12))
furniture_box('bath_white',(-2.60,.31,-5.65),(1.24,.55,1.22),solid=True,name='shower_tray')
add_box('glass',(-1.93,1.15,-5.65),(.03,1.75,1.25),part='glass')
furniture_box('bath_white',(-.55,.36,-5.85),(.48,.46,.60),solid=True,name='toilet')
furniture_box('bath_white',(-.55,.65,-5.58),(.70,.14,.62))
furniture_box('wood_warm',(.42,.51,-5.05),(.50,.72,1.04),solid=True,name='sink_vanity')
furniture_box('bath_white',(.42,.94,-5.05),(.58,.14,.67))
add_box('glass',(.66,1.78,-5.05),(.025,.70,.86),part='glass')
lights(-1.15,-4.97)

# corridor small secondary sightline
furniture_box('wood_warm',(1.6,.55,-2.91),(1.1,1.05,.29),solid=True,name='hall_console')
picture(.05,1.72,-3.55,1.15,.69)
plant(2.95,-3.05,.82)
lights(.5,-2.74)

# kitchen northeast
for z in (-5.9,-4.75,-3.6):
    furniture_box('wood_warm',(8.17,.41,z),(1.00,.8,1.06),solid=True,name='kitchen_counter_unit')
    furniture_box('counter_stone',(8.14,.865,z),(1.12,.105,1.09))
    furniture_box('metal_dark',(7.58,.4,z),(.022,.035,.23))
furniture_box('metal_dark',(7.88,.975,-4.77),(.60,.024,.50))
for x in (7.66,7.94):
    for zz in (-4.94,-4.69): cylinder('steel',(x,.991,zz),.085,.018,sections=14)
furniture_box('bath_white',(7.89,.968,-5.96),(.69,.07,.45))
furniture_box('steel',(7.91,1.12,-5.96),(.018,.31,.018))
furniture_box('steel',(7.93,1.27,-5.96),(.15,.018,.02))
furniture_box('steel',(7.88,1.14,-3.52),(.88,.58,.58),solid=True,name='oven')
furniture_box('wood_warm',(6.05,.44,-1.90),(1.20,.85,2.05),solid=True,name='kitchen_island')
furniture_box('counter_stone',(6.05,.91,-1.90),(1.40,.09,2.25))
for z in (-2.55,-1.43):
    cylinder('metal_dark',(5.03,.29,z),.045,.53,sections=10)
    cylinder('wood_warm',(5.03,.57,z),.27,.08,sections=16)
for xx,zz in [(6.11,-5.6),(5.45,-3.0)]: lights(xx,zz)
furniture_box('steel',(8.08,1.08,-1.18),(1.16,2.14,.7),solid=True,name='fridge')

# entry room east, lounge dining
furniture_box('wood_warm',(6.10,.75,3.18),(2.05,.13,1.10),solid=True,name='dining_table_top')
for x in (5.25,6.95):
    for zz in (2.79,3.57): furniture_box('metal_dark',(x,.37,zz),(.075,.74,.075))
for x,z in [(5.1,2.06),(7.1,2.06),(5.1,4.4),(7.1,4.4)]:
    furniture_box('sofa_fabric',(x,.43,z),(.50,.13,.45))
    furniture_box('wood_dark',(x,.39,z+.23),(.5,.55,.09))
    for dx in (-.2,.2):furniture_box('metal_dark',(x+dx,.19,z),(.035,.38,.035))
plant(7.93,4.66,1.)
lights(6.15,3.18)

# office west x[-8.7,-4.8] z[-2.2,1.55]
table(-7.10,-.80,1.38,.65,height=.72,name='desk')
furniture_box('black',(-7.12,1.05,-1.04),(.66,.48,.045))
furniture_box('screen',(-7.12,1.05,-1.009),(.60,.42,.014))
furniture_box('metal_dark',(-7.12,.83,-1.04),(.05,.12,.05))
furniture_box('sofa_fabric',(-6.80,.44,.18),(.65,.20,.65))
cylinder('metal_dark',(-6.80,.24,.18),.06,.44)
furniture_box('wood_dark',(-5.17,.94,-1.62),(.30,1.72,.92),solid=True,name='office_bookcase')
for y in (.48,1.01,1.52):furniture_box('wood_warm',(-5.02,y,-1.62),(.25,.055,.87))
plant(-8.15,1.14,.77);lights(-6.7,.6)

# balcony lightweight furnishings
for xx in (-6.8,6.6):
    furniture_box('wood_warm',(xx,.34,6.20),(.67,.09,.63))
    for dx in (-.25,.25):
        furniture_box('metal_dark',(xx+dx,.17,6.20),(.04,.33,.55))
    plant(xx+(.65 if xx<0 else -.65),6.33,.75)

# panel relief and wall handles / ventilation / outlets
for pos in [(-4.0,1.23,-1.87),(2.96,1.23,-1.87)]:
    furniture_box('trim_white',pos,(.14,.12,.03))
for x in (-2.4,1.5):
    furniture_box('steel',(x,2.83,-6.59),(.44,.065,.035))
# HVAC outdoor aesthetic (stays inside bounds)
furniture_box('steel',(-8.35,2.15,3.67),(.58,.36,.60))
for i in range(5):furniture_box('metal_dark',(-8.04,2.0+i*.075,3.67),(.018,.02,.54))
# mezzanine not present: gameplay deliberately single-story for predictable 1v1.

# Build exports: each of 3 parts is one GLB; combined GLB for ease of integration.
def to_mesh(part,key, chunks):
    V=[];F=[];UV=[];N=[];offset=0
    for pts,fs,uv,norm in chunks:
        V.append(pts);F.append(fs+offset);UV.append(uv);N.append(norm);offset+=len(pts)
    vertices=np.concatenate(V); faces=np.concatenate(F); uv=np.concatenate(UV); normals=np.concatenate(N)
    mesh=trimesh.Trimesh(vertices=vertices,faces=faces,vertex_normals=normals,process=False,validate=False)
    mesh.visual=TextureVisuals(uv=uv,material=MATERIAL[key])
    return mesh

full=trimesh.Scene(base_frame='world')
statistics={}; manifest=[]
for (part,key),chunks in sorted(BATCH.items()):
    mesh=to_mesh(part,key,chunks)
    full.add_geometry(mesh,geom_name=f'{part}__{key}',node_name=f'{part}__{key}')
    statistics[part]=statistics.get(part,0)+len(mesh.faces)
    manifest.append({'name':f'{part}__{key}','triangles':len(mesh.faces),'material':MATERIAL[key].name})

# Optional roof, separate GLB to allow top-down editor and different lighting handling
roof=trimesh.Scene()
add_box('floor_concrete',(0,3.18,-.72),(17.65,.20,12.1),part='roof')
for (part,key),chunks in BATCH.items():
    if part=='roof': roof.add_geometry(to_mesh(part,key,chunks),geom_name='roof_ceiling',node_name='roof_ceiling')
# do NOT include roof in main GLB, simple interior ambient direct sunlight until lighting authored
forbidden=['roof']
combined=trimesh.Scene(base_frame='world')
for name,geom in full.geometry.items():
    if not name.startswith('roof__'):combined.add_geometry(geom,geom_name=name,node_name=name)
roof.export(MODELS/'sd_casa_atlas_roof_optional.glb',include_normals=True)
combined.export(MODELS/'sd_casa_atlas_1v1.glb',include_normals=True)

# Floor and collision rules: client/server need same data.
# Spawn positions carefully chosen away from boxes/walls and offering 2 viable routes each.
mapdata={
 'id':'CASA_ATLAS_1V1','version':'1.0.0','author':'ChatGPT for Sniper Duel',
 'license':'CC0 geometry; beige_wall_001 Poly Haven CC0 (see LICENSE_ASSETS.md)',
 'units':'meters','axis':'+Y up, +Z balcony/south','dimensions':{'width':18,'depth':14,'height':3.12},
 'bounds':{'min':[-8.88,0,-6.82],'max':[8.88,3.32,7.06]},
 'playerEyeHeight':1.62, 'floorY':0,
 'spawns':[{'team':'A','position':[-7.45,0,0.57],'yaw':-1.5708}, {'team':'B','position':[7.15,0,.20],'yaw':1.5708}],
 'zones':[{'name':'SALON','bounds':[-4.8,-2.2,3.4,5.3]}, {'name':'COCINA','bounds':[3.4,-6.7,8.7,1.15]}, {'name':'DORMITORIO','bounds':[-8.7,-6.7,-3.55,-2.25]}, {'name':'BANO','bounds':[-3.55,-6.7,.85,-3.72]}, {'name':'ESTUDIO','bounds':[-8.7,-2.25,-4.8,1.55]}, {'name':'COMEDOR','bounds':[3.43,1.15,8.7,5.3]}, {'name':'BALCON','bounds':[-8.7,5.3,8.7,7.0]}],
 'colliders':COLLIDERS + [
    {'name':'balcony_front_player_boundary','center':[0,.58,7.02],'size':[17.6,1.16,.12],'type':'player_boundary'},
    {'name':'balcony_left_player_boundary','center':[-8.83,.58,6.15],'size':[.12,1.16,1.8],'type':'player_boundary'},
    {'name':'balcony_right_player_boundary','center':[8.83,.58,6.15],'size':[.12,1.16,1.8],'type':'player_boundary'}
 ],'renderMeshes':manifest,
 'notes':['Single-level apartment intentionally. No vertical exploit routes.','Doors are openings and windows are glazing; server collision must respect exactly the wall segments in this file.','Wall colliders should use obstacles that block bullets, furniture marked solid where defined.','Non-solid decor and glass require explicit team gameplay decision; do not treat glass as bulletproof if not in collision JSON.','Optional roof intended only if correct enclosed lighting is provided.']}
(ROOT/'collision_map.json').write_text(json.dumps(mapdata,ensure_ascii=False,indent=2))
(ROOT/'geometry_stats.json').write_text(json.dumps({'byPart':statistics,'triangles':sum(statistics.values()),'renderMeshes':len(manifest),'colliders':len(mapdata['colliders']),'glb_bytes':(MODELS/'sd_casa_atlas_1v1.glb').stat().st_size},indent=2))
print('Done', statistics, 'triangles',sum(statistics.values()), 'colliders',len(COLLIDERS),'glb_mb',round((MODELS/'sd_casa_atlas_1v1.glb').stat().st_size/1e6,2))
