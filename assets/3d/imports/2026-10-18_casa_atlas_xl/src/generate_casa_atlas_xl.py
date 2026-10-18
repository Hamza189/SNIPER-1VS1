#!/usr/bin/env python3
"""SNIPER DUEL CASA ATLAS XL: original procedural modular villa map.
Rebuild: python src/generate_casa_atlas_xl.py (from package root)
Requires: numpy, pillow, scipy, trimesh, matplotlib, networkx, vtk (previews).
No executable external Blender files / no imported untrusted project assets.
"""
from __future__ import annotations
import math, json, random, os
from pathlib import Path
from collections import defaultdict, deque
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parents[1]
for d in ['models','preview','assets']: (ROOT/d).mkdir(exist_ok=True)
RNG=np.random.default_rng(20261018)
random.seed(20261018)
BOX=[]; VIS=[]; ROOF=[]; POLY={}; MATERIALS={}
COLL=[]; OBJECTS=[]; MAT_META={}
COLORS={
 'sd_estuco':(195,177,142), 'sd_estuco_ocre':(196,150,111), 'sd_piedra':(167,145,115),
 'sd_suelo_caliza':(171,157,133), 'sd_adoquin':(122,113,100), 'sd_tierra':(132,115,85),
 'sd_madera':(115,78,53), 'sd_madera_pintada':(61,83,79), 'sd_hierro':(55,60,61),
 'sd_teja':(159,94,65), 'sd_vidrio':(113,164,172), 'sd_agua':(54,127,139),
 'sd_vegetacion':(82,111,67), 'sd_tela':(113,128,125), 'sd_hormigon':(154,146,135),
 'sd_pavimento':(138,132,119), 'sd_grava':(130,120,97), 'sd_roble':(141,105,74),
}
TILE={
 'sd_estuco':2.8,'sd_estuco_ocre':2.8,'sd_piedra':1.7,'sd_suelo_caliza':2.2,
 'sd_adoquin':2.1,'sd_tierra':3.0,'sd_madera':1.4,'sd_madera_pintada':1.4,
 'sd_hierro':1.2,'sd_teja':1.2,'sd_vidrio':1.5,'sd_agua':2.0,'sd_vegetacion':1.4,
 'sd_tela':1.4,'sd_hormigon':2.0,'sd_pavimento':2.4,'sd_grava':2.6,'sd_roble':1.5,
}
SURF={k:{'vertices':[],'faces':[],'uv':[]} for k in COLORS}
ROOF_SURF={k:{'vertices':[],'faces':[],'uv':[]} for k in COLORS}
TRI={k:0 for k in COLORS}; RT={k:0 for k in COLORS}

# Build tileable original photographic-inspired textures. Subtle albedo: physically lit by game.
def make_textures():
    for mat,color in COLORS.items():
        N=512 if mat not in ('sd_vidrio','sd_hierro','sd_agua') else 256
        y,x=np.mgrid[:N,:N].astype(np.float32)
        coarse=gaussian_filter(RNG.standard_normal((N,N)).astype(np.float32),N/30,mode='wrap'); coarse/=max(1e-6,coarse.std())
        fine=gaussian_filter(RNG.standard_normal((N,N)).astype(np.float32),.9,mode='wrap'); fine/=max(1e-6,fine.std())
        medium=gaussian_filter(RNG.standard_normal((N,N)).astype(np.float32),N/120,mode='wrap');medium/=max(1e-6,medium.std())
        height=.5*coarse+.3*medium+.1*fine
        bands=np.zeros((N,N),np.float32)
        if mat in ('sd_piedra','sd_suelo_caliza','sd_adoquin','sd_teja','sd_pavimento'):
            if mat=='sd_teja':
                bands=np.sin(2*np.pi*x*7/N)*.16
            elif mat=='sd_adoquin':
                lx=(x/N*9)%1.; ly=(y/N*9)%1.
                bands=-.18*((lx<.035)|(ly<.035))
            else:
                lx=(x/N*4)%1.;ly=(y/N*4)%1.
                bands=-.13*((lx<.018)|(ly<.018))
            height+=bands
        if mat.startswith('sd_madera') or mat=='sd_roble':
            height+= .15*np.sin(2*np.pi*y*8/N + .15*coarse)
        scale=2.5 if mat in ('sd_hierro','sd_vidrio','sd_agua') else 6
        albedo=np.clip(np.array(color,dtype=np.float32)[None,None,:]+height[:,:,None]*scale+fine[:,:,None]*1.7,0,255).astype(np.uint8)
        # roughness packed in G, metallic in B
        rough = (.92 if mat in ('sd_estuco','sd_estuco_ocre','sd_piedra','sd_tierra','sd_suelo_caliza') else .8)
        metal = (0.72 if mat=='sd_hierro' else 0.02)
        if mat=='sd_vidrio':rough=.17;metal=0.03
        if mat=='sd_agua':rough=.21; metal=0
        if mat in ('sd_madera','sd_madera_pintada','sd_roble'):rough=.73
        orm=np.zeros((N,N,3),dtype=np.uint8);orm[:,:,0]=255
        orm[:,:,1]=np.clip(255*(rough+.02*medium),0,255).astype(np.uint8)
        orm[:,:,2]=round(255*metal)
        fy,fx=np.gradient(gaussian_filter(height,1.6,mode='wrap'))
        strength=10.0 if mat in ('sd_suelo_caliza','sd_piedra','sd_adoquin') else 5.5
        norm=np.dstack((-fx*strength,-fy*strength,np.ones_like(fx)))
        norm/=np.linalg.norm(norm,axis=2,keepdims=True)
        normal=np.clip((norm*.5+.5)*255,0,255).astype(np.uint8)
        src=ROOT/'assets'
        base_img=Image.fromarray(albedo)
        if mat=='sd_vegetacion':
            # Repeating cluster of olive-leaf silhouettes; source texture has real alpha cutouts.
            from PIL import ImageDraw
            al=Image.new('L',(N,N),0);dr=ImageDraw.Draw(al)
            rr=random.Random(12188)
            for ii in range(190):
                xx=rr.randint(0,N-1);yy=rr.randint(0,N-1);rx=rr.randint(5,19);ry=rr.randint(10,26)
                dr.ellipse((xx-rx,yy-ry,xx+rx,yy+ry),fill=255)
                # wrap foliage near borders without reflective symmetry
                for ox in (-N,0,N):
                    for oy in (-N,0,N):
                        if ox or oy:dr.ellipse((xx-rx+ox,yy-ry+oy,xx+rx+ox,yy+ry+oy),fill=255)
            base_img=base_img.convert('RGBA');base_img.putalpha(al)
            base_img.save(src/f'{mat}_basecolor.png',compress_level=5)
        else:
            base_img.save(src/f'{mat}_basecolor.jpg',quality=87,subsampling=0)
        Image.fromarray(orm).save(src/f'{mat}_orm.jpg',quality=85,subsampling=0)
        Image.fromarray(normal).save(src/f'{mat}_normal.png',compress_level=5)
        MATERIALS[mat]=PBRMaterial(name=mat,baseColorFactor=[255,255,255,94 if mat=='sd_vidrio' else 255],metallicFactor=1,roughnessFactor=1,
             baseColorTexture=base_img,normalTexture=Image.fromarray(normal),
             metallicRoughnessTexture=Image.fromarray(orm),doubleSided=(mat=='sd_vegetacion'),
             alphaMode=('MASK' if mat=='sd_vegetacion' else ('BLEND' if mat=='sd_vidrio' else 'OPAQUE')),alphaCutoff=.5)
        MAT_META[mat]={'name':mat,'color_size':[N,N],'normal_size':[N,N],'orm_size':[N,N],
                       'texture_repeat_m':TILE[mat],'license':'Original — generated for CASA ATLAS XL'}

# 6 faces, independent hard-edge vertices, axis-aligned UV projected in meters.
def emit_box(name,x0,y0,z0,x1,y1,z1,mat,collider=None,store=None):
    assert x1>x0 and y1>y0 and z1>z0,(name,x0,y0,z0,x1,y1,z1)
    if store is None:store=SURF
    s=store[mat];first=len(s['vertices']);d=TILE[mat]
    # quads around cube with CCW winding viewed from outside
    quads=[
      [(x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0)], # -X
      [(x1,y0,z1),(x1,y0,z0),(x1,y1,z0),(x1,y1,z1)], # +X
      [(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)], # +Z
      [(x1,y0,z0),(x0,y0,z0),(x0,y1,z0),(x1,y1,z0)], # -Z
      [(x0,y1,z1),(x1,y1,z1),(x1,y1,z0),(x0,y1,z0)], # +Y
      [(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1)], # -Y
    ]
    for qi,q in enumerate(quads):
        v0=len(s['vertices']);s['vertices'].extend(q)
        if qi in (0,1):coords=[(a[2],a[1]) for a in q]
        elif qi in (2,3):coords=[(a[0],a[1]) for a in q]
        else:coords=[(a[0],a[2]) for a in q]
        s['uv'].extend([(u/d,v/d) for u,v in coords]);s['faces'].append((v0,v0+1,v0+2));s['faces'].append((v0,v0+2,v0+3))
    (RT if store is ROOF_SURF else TRI)[mat]+=12
    if collider:
        COLL.append({'name':name,'center':[round((x0+x1)/2,4),round((y0+y1)/2,4),round((z0+z1)/2,4)],
                'size':[round(x1-x0,4),round(y1-y0,4),round(z1-z0,4)],'type':collider})
    OBJECTS.append({'name':name,'material':mat,'collision':collider,'center':[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],
        'size':[x1-x0,y1-y0,z1-z0],'roof':store is ROOF_SURF})

def bx(n,c,s,mat,collision=None,store=None):
    x,y,z=c;dx,dy,dz=s
    emit_box(n,x-dx/2,y-dy/2,z-dz/2,x+dx/2,y+dy/2,z+dz/2,mat,collision,store)

def w_x(name,z,x0,x1,h=3.4,t=.22,mat='sd_estuco',openings=None):
    """Wall extends along X with windows and open doorways."""
    op=sorted(openings or [],key=lambda a:a['a']); cursor=x0
    for i,o in enumerate(op):
        a,b=o['a'],o['b'];assert a>=cursor-1e-4 and b<=x1+1e-4 and b-a>=1.0
        if a-cursor>.01:emit_box(f'{name}_wall_{i}',cursor,0,z-t/2,a,h,z+t/2,mat,'solid')
        if o['kind']=='door':
            emit_box(f'{name}_door_header_{i}',a,2.42,z-t/2,b,h,z+t/2,mat,'solid')
            # overhead slim wood lintel, matches header collision bounds
        else:
            sill=o.get('sill',1.08);top=o.get('top',2.28)
            emit_box(f'{name}_sill_{i}',a,0,z-t/2,b,sill,z+t/2,mat,'solid')
            emit_box(f'{name}_header_{i}',a,top,z-t/2,b,h,z+t/2,mat,'solid')
            # panel close to outer wall; move collider blocks jump but bullets pass glass
            emit_box(f'{name}_glass_{i}',a,sill,z-.015,b,top,z+.015,'sd_vidrio',None)
            # Non-monumental Mediterranean jambs/shutters, entirely within facade wall collider slab (t=.22).
            for edge_x in (a+.035,b-.035):
                bx(f'{name}_fine_jamb_{i}_{edge_x:.2f}',(edge_x,(sill+top)/2,z),(.070,top-sill,.10),'sd_piedra')
            bx(f'{name}_fine_sill_{i}',((a+b)/2,sill+.035,z), (b-a,.07,.13),'sd_piedra')
            for shade_x in (a-.17,b+.17):
                bx(f'{name}_shutter_{i}_{shade_x:.2f}',(shade_x,(sill+top)/2,z),(.28,top-sill-.04,.04),'sd_madera_pintada')
            COLL.append({'name':f'{name}_window_move_{i}','center':[(a+b)/2,1.5,z],
                'size':[b-a,3.0,t],'type':'move'})
        cursor=b
    if x1-cursor>.01:emit_box(f'{name}_wall_end',cursor,0,z-t/2,x1,h,z+t/2,mat,'solid')

def w_z(name,x,z0,z1,h=3.4,t=.22,mat='sd_estuco',openings=None):
    op=sorted(openings or [],key=lambda a:a['a']);cursor=z0
    for i,o in enumerate(op):
        a,b=o['a'],o['b'];assert a>=cursor-1e-4 and b<=z1+1e-4 and b-a>=1.0,(name,o,cursor)
        if a-cursor>.01:emit_box(f'{name}_wall_{i}',x-t/2,0,cursor,x+t/2,h,a,mat,'solid')
        if o['kind']=='door':
            emit_box(f'{name}_door_header_{i}',x-t/2,2.42,a,x+t/2,h,b,mat,'solid')
        else:
            sill=o.get('sill',1.08);top=o.get('top',2.28)
            emit_box(f'{name}_sill_{i}',x-t/2,0,a,x+t/2,sill,b,mat,'solid')
            emit_box(f'{name}_header_{i}',x-t/2,top,a,x+t/2,h,b,mat,'solid')
            emit_box(f'{name}_glass_{i}',x-.015,sill,a,x+.015,top,b,'sd_vidrio')
            for edge_z in (a+.035,b-.035):
                bx(f'{name}_fine_jamb_{i}_{edge_z:.2f}',(x,(sill+top)/2,edge_z),(.10,top-sill,.07),'sd_piedra')
            bx(f'{name}_fine_sill_{i}',(x,sill+.035,(a+b)/2),(.13,.07,b-a),'sd_piedra')
            for shade_z in (a-.17,b+.17):
                bx(f'{name}_shutter_{i}_{shade_z:.2f}',(x,(sill+top)/2,shade_z),(.04,top-sill-.04,.28),'sd_madera_pintada')
            COLL.append({'name':f'{name}_window_move_{i}','center':[x,1.5,(a+b)/2],
                 'size':[t,3.0,b-a],'type':'move'})
        cursor=b
    if z1-cursor>.01:emit_box(f'{name}_wall_end',x-t/2,0,cursor,x+t/2,h,z1,mat,'solid')

def bench(name,x,z,w=1.65,d=.65):
    # sofa back and base grouped in a single physical bounding box (covers exact extents)
    bx(name,(x,.46,z),(w,.92,d),'sd_tela','solid')
    bx(name+'_seat',(x,.58,z+.03),(w-.1,.12,d-.14),'sd_roble')

def planter(name,x,z,w=1.65,d=.65,h=.58):
    bx(name,(x,h/2,z),(w,h,d),'sd_piedra','solid')
    bx(name+'_soil',(x,h-.02,z),(w-.14,.035,d-.14),'sd_tierra')
    for k in range(max(2,int(w*3))):
        px=x+(k-(max(2,int(w*3))-1)/2)*(w-.25)/max(2,int(w*3))
        # foliage alpha cards; foliage is not bulletproof cover
        bx(f'{name}_shrub_{k}',(px,h+.24,z),(.12,.48,.015),'sd_vegetacion')
        bx(f'{name}_shrub2_{k}',(px,h+.25,z),(.015,.46,.16),'sd_vegetacion')

def tree(name,x,z,r=0.16):
    # identical silhouette collider for trunk
    bx(name+'_trunk',(x,1.1,z),(2*r,2.2,2*r),'sd_madera','solid')
    # low-cost foliage cards higher than player head; canopy does not block body-level motion or bullets
    bx(name+'_crownA',(x,3.05,z),(2.4,2.0,.04),'sd_vegetacion')
    bx(name+'_crownB',(x,3.05,z),(.04,2.0,2.4),'sd_vegetacion')
    bx(name+'_crownC',(x,3.08,z),(1.8,1.55,.04),'sd_vegetacion')

def house():
    # building footprints: (-14.7..1.3, -4.1..9.1). Main west-east axis through indoor hall.
    w_x('villa_norte',-4.1,-14.7,1.3,h=3.45,openings=[
       {'a':-11.6,'b':-9.55,'kind':'door'},
       {'a':-5.5,'b':-3.7,'kind':'window'},
       {'a':-1.8,'b':-.4,'kind':'window'}]);
    w_x('villa_sur',9.1,-14.7,1.3,h=3.45,mat='sd_estuco_ocre',openings=[
       {'a':-12.0,'b':-10.2,'kind':'window'},
       {'a':-7.4,'b':-5.6,'kind':'door'},
       {'a':-2.7,'b':-.9,'kind':'window'}]);
    w_z('villa_oeste',-14.7,-4.1,9.1,h=3.45,openings=[
       {'a':.65,'b':2.45,'kind':'door'},
       {'a':5.45,'b':7.2,'kind':'window'}]);
    w_z('villa_este',1.3,-4.1,9.1,h=3.45,openings=[
       {'a':-2.6,'b':-.6,'kind':'window'},
       {'a':2.65,'b':4.75,'kind':'door'},
       {'a':6.0,'b':7.6,'kind':'window'}]);
    # floor visual only, no floor collider (floorY=0 physical plane)
    bx('villa_suelo',(-6.7,-.055,2.5),(15.72,.11,12.96),'sd_suelo_caliza')
    # internal dividers intentionally low cover or high walls with wide openings
    w_x('villa_divisor_norte',.10,-14.5,-8.0,h=2.92,t=.12,openings=[{'a':-11.2,'b':-9.5,'kind':'door'}])
    # Dining/kitchen east x(-5.5 ..1), lounge central, north bedroom west
    w_z('villa_divisor_salon',-7.2,-3.9,.1,h=2.92,t=.12,openings=[{'a':-2.3,'b':-.65,'kind':'door'}])
    # dining partition in south half narrow section, no closed corridors
    bx('isla_cocina',(-1.4,.47,6.85),(2.1,.94,.85),'sd_roble','solid')
    bx('aparador',(-13.35,.51,7.8),(.65,1.02,1.55),'sd_madera','solid')
    bx('mesa_comedor',(-4.0,.38,7.25),(1.8,.76,1.05),'sd_roble','solid')
    # chairs must be >=0.45m from table footprint, and remain clear of doors
    bx('silla_comedor_1',(-4.0,.43,5.96),(.50,.86,.50),'sd_madera','solid')
    bench('sofa_1',-11.35,4.9,1.75,.70)
    bx('mesa_salon',(-9.65,.32,5.25),(1.25,.64,.78),'sd_roble','solid')
    bx('cama_dormitorio',(-13.0,.27,-2.0),(1.45,.54,1.7),'sd_tela','solid')
    bx('armario_dormitorio',(-8.8,1.05,-2.4),(.55,2.1,1.25),'sd_madera','solid')
    # sink + low cabinet kitchen (east)
    bx('modulo_cocina',(-.15,.48,7.6),(.75,.96,.62),'sd_madera','solid')
    # facade stone bands minimal, NO heavy monumental profiles; raised above body-height
    bx('villa_cornisa_norte',(-6.7,3.39,-4.1),(15.9,.10,.22),'sd_piedra')
    bx('villa_cornisa_sur',(-6.7,3.39,9.1),(15.9,.10,.22),'sd_piedra')
    # optional roof (separate file) with realistic flat azotea + parapet, no roof path
    bx('villa_techo',(-6.7,3.53,2.5),(16.0,.16,13.2),'sd_teja',store=ROOF_SURF)
    bx('villa_pretil_n',(-6.7,3.78,-4.0),(16.0,.42,.24),'sd_estuco',store=ROOF_SURF)
    bx('villa_pretil_s',(-6.7,3.78,9.0),(16.0,.42,.24),'sd_estuco',store=ROOF_SURF)
    bx('villa_pretil_o',(-14.6,3.78,2.5),(.24,.42,12.9),'sd_estuco',store=ROOF_SURF)
    bx('villa_pretil_e',(1.2,3.78,2.5),(.24,.42,12.9),'sd_estuco',store=ROOF_SURF)
    bx('villa_roof_collision',(-6.7,3.53,2.5),(16,.16,13.2),'sd_teja',None) if False else None
    COLL.append({'name':'villa_roof_solid','center':[-6.7,3.53,2.5],'size':[16,.16,13.2],'type':'solid'})

def garage():
    # detached garage/guest workshop occupying east / north side
    x0,x1=10.1,17.4;z0,z1=-9.15,-1.2
    w_x('garaje_norte',z0,x0,x1,h=3.25,mat='sd_estuco_ocre',openings=[
        {'a':12.0,'b':13.4,'kind':'window','sill':1.25,'top':2.15}])
    w_x('garaje_sur',z1,x0,x1,h=3.25,mat='sd_estuco_ocre',openings=[
        {'a':11.0,'b':14.1,'kind':'door'}])
    w_z('garaje_oeste',x0,z0,z1,h=3.25,mat='sd_estuco_ocre',openings=[
        {'a':-6.15,'b':-4.2,'kind':'door'}])
    w_z('garaje_este',x1,z0,z1,h=3.25,mat='sd_estuco_ocre',openings=[
        {'a':-4.75,'b':-2.9,'kind':'door'}])
    bx('garaje_suelo',(13.75,-.055,-5.18),(7.05,.11,7.78),'sd_hormigon')
    bx('garaje_cajon_herramientas',(15.65,.56,-8.15),(1.55,1.12,.62),'sd_hierro','solid')
    bx('garaje_almacen',(16.72,.70,-6.15),(.68,1.40,1.05),'sd_madera','solid')
    bx('garaje_techo',(13.75,3.33,-5.18),(7.3,.16,7.95),'sd_teja',store=ROOF_SURF)
    bx('garaje_pretil_n',(13.75,3.56,-9.0),(7.3,.4,.25),'sd_estuco_ocre',store=ROOF_SURF)
    bx('garaje_pretil_s',(13.75,3.56,-1.35),(7.3,.4,.25),'sd_estuco_ocre',store=ROOF_SURF)
    COLL.append({'name':'garaje_techo_solid','center':[13.75,3.33,-5.18],'size':[7.3,.16,7.95],'type':'solid'})

def outdoors():
    bx('parcela_suelo',(0,-.105,0),(39.5,.21,31.5),'sd_tierra')
    bx('calle_frontal',(0,-.016,12.55),(39.5,.032,6.1),'sd_adoquin')
    bx('calle_cuneta',(0,.008,10.16),(39.4,.016,.35),'sd_piedra')
    bx('patio_central',(6.8,-.012,4.8),(12.1,.024,9.5),'sd_suelo_caliza')
    bx('sendero_jardin',(0,-.010,-12.3),(35.5,.021,1.4),'sd_grava')
    bx('sendero_este',(18.4,-.011,0),(1.6,.022,26.6),'sd_grava')
    bx('sendero_oeste',(-17.4,-.011,0),(1.7,.022,26.6),'sd_grava')
    # perimeter encloses sight lines — no void; front gate closed, solid.
    bx('perimetro_n',(0,1.85,-15.80),(39.8,3.70,.25),'sd_piedra','solid')
    bx('perimetro_o',(-19.8,1.85,0),(.25,3.70,31.6),'sd_estuco','solid')
    bx('perimetro_e',(19.8,1.85,0),(.25,3.70,31.6),'sd_estuco','solid')
    bx('perimetro_sur_izq',(-11.8,1.85,15.8),(16.0,3.70,.25),'sd_estuco','solid')
    bx('perimetro_porton',(0,1.85,15.8),(7.6,3.70,.25),'sd_madera_pintada','solid')
    bx('perimetro_sur_der',(11.8,1.85,15.8),(16,3.70,.25),'sd_estuco','solid')
    # detailed panel gate in front wall without geometry protrusion, within wall colliders
    for x in np.linspace(-3.35,3.35,11):bx(f'porton_tabla_{x:.1f}',(float(x),1.55,15.72),(.04,2.85,.025),'sd_madera')
    # main landscaped courtyard water pool, SOLID low basin, unwalkable flat concrete (not swimmable).
    bx('estanque_cubeta',(7.55,.28,3.15),(5.55,.56,3.65),'sd_piedra','solid')
    bx('estanque_agua',(7.55,.565,3.15),(5.17,.025,3.28),'sd_agua')
    # low courtyard planters without blocking through-house path x 2.0-4.0
    planter('macetero_patio_01',4.6,8.6,1.45,.60,.50)
    planter('macetero_patio_02',12.6,7.8,1.65,.70,.58)
    planter('macetero_patio_03',-2.4,10.25,1.35,.55,.51)
    planter('macetero_patio_04',8.6,10.25,1.5,.55,.50)
    planter('macetero_jardin_01',-5.2,-10.6,1.35,.62,.56)
    planter('macetero_jardin_02',4.0,-10.5,1.3,.58,.54)
    # central courtyard alternate cover at 6-10m without closing corridors
    bx('banco_patio',(4.15,.40,-.1),(1.7,.8,.48),'sd_madera','solid')
    bx('caja_patio',(6.2,.43,-7.7),(1.0,.86,1.0),'sd_madera','solid')
    bx('caja_calle_01',(-10.3,.40,10.80),(1.25,.80,.75),'sd_madera','solid')
    bx('caja_calle_02',(5.4,.40,10.8),(1.1,.80,.70),'sd_madera','solid')
    # do not place solid in street central Z13.4, clear >35m LOS
    # Pergola on north patio with solid posts; top slats and no accessible roof.
    for i,x in enumerate([2.4,8.6]):
      for j,z in enumerate([-8.6,-3.35]):
        bx(f'pergola_post_{i}_{j}',(x,1.47,z),(.16,2.94,.16),'sd_madera','solid')
    for i,z in enumerate([-8.6,-7.5,-6.4,-5.3,-4.2,-3.35]):
      bx(f'pergola_lama_{i}',(5.5,3.03,z),(6.35,.12,.17),'sd_madera')
    # terraces wooden decking patches, not solid cover
    bx('terraza_madera',(5.4,-.010,-5.5),(6.8,.021,5.5),'sd_madera')
    # tree trunks count as physical cover, canopies above head
    tree('olivo_01',-12.0,-12.15)
    tree('olivo_02',-1.8,-12.5)
    tree('olivo_03',17.6,7.9)
    tree('olivo_04',-17.6,8.65)
    # scattered ground foliage cards below eye; never a solid-looking cover
    for i in range(54):
        x=float(RNG.uniform(-18.6,18.6));z=float(RNG.uniform(-14.7,14.7))
        if -15.1<x<1.65 and -4.5<z<9.5:continue
        if 9.65<x<17.65 and -9.4<z<-1.0:continue
        if 4.5<x<10.8 and 1.0<z<5.5:continue
        if 11.0<z<15.5:continue
        if abs(x-17.2)<1.1 and abs(z-12.2)<1.1:continue
        if abs(x+17.1)<1.1 and abs(z+12.3)<1.1:continue
        bx(f'hierba_{i}',(x,.25,z),(.36,.5,.015),'sd_vegetacion')


def build_scene(store):
    sc=trimesh.Scene()
    for mat,s in store.items():
        if not s['vertices']:continue
        mesh=trimesh.Trimesh(vertices=np.asarray(s['vertices'],dtype=np.float32),faces=np.asarray(s['faces'],dtype=np.int32),process=False,validate=False)
        mesh.visual=trimesh.visual.TextureVisuals(uv=np.asarray(s['uv'],dtype=np.float32),material=MATERIALS[mat])
        # don't weld vertices: hard edges needed and UV seams must survive
        sc.add_geometry(mesh,geom_name=mat,node_name='root_'+mat)
    return sc

# LOS and navigation verification at player shoulder height + centerline.
def blocked_2d(x,z,margin=.0):
    if not(-19.35<=x<=19.35 and -15.35<=z<=15.35):return True
    for o in COLL:
        if o['type'] not in ('solid','move'):continue
        cy=o['center'][1];sy=o['size'][1]
        if cy+sy/2<.14 or cy-sy/2>1.72:continue
        cx,_,cz=o['center'];sx,_,sz=o['size']
        if abs(x-cx)<sx/2+margin and abs(z-cz)<sz/2+margin:return True
    return False

def line_visible(p,q,eye=1.62,include_move=False):
    a=np.array(p,dtype=float);b=np.array(q,dtype=float);dr=b-a
    n=max(5,int(np.linalg.norm(dr)*12))
    for t in np.linspace(.018,.982,n):
        x,z=a+dr*t
        for o in COLL:
            if o['type']=='move' and not include_move:continue
            cx,cy,cz=o['center'];sx,sy,sz=o['size']
            if not(cy-sy/2<=eye<=cy+sy/2):continue
            if abs(x-cx)<=sx/2 and abs(z-cz)<=sz/2:return False
    return True

def clearance(pt):
    x,z=pt
    best=min([((max(abs(x-c['center'][0])-c['size'][0]/2,0))**2+(max(abs(z-c['center'][2])-c['size'][2]/2,0))**2)**.5
         for c in COLL if c['type'] in ('solid','move') and c['center'][1]-c['size'][1]/2<1.8 and c['center'][1]+c['size'][1]/2>.12]+[99])
    return best

def navigation():
    step=.33;xarr=np.arange(-19.1,19.11,step);zarr=np.arange(-15.1,15.11,step)
    walk=np.ones((len(zarr),len(xarr)),dtype=bool)
    # AABB dilation equivalent to 0.35m radius using 2D distance; conservative.
    for iz,z in enumerate(zarr):
        for ix,x in enumerate(xarr):walk[iz,ix]=not blocked_2d(x,z,.355)
    def gridp(p):return (int(np.argmin(abs(zarr-p[1]))),int(np.argmin(abs(xarr-p[0]))))
    starts=[(-17.25,-12.3),(17.25,12.4)]
    for s in starts:
        iz,ix=gridp(s);assert walk[iz,ix],('spawn blocked',s,clearance(s))
        assert clearance(s)>=.8,('spawn <.8m clearance',s,clearance(s))
    assert np.linalg.norm(np.array(starts[1])-starts[0])>30
    assert not line_visible(*starts), 'Spawn A has unobstructed line of sight to Spawn B'
    st=gridp(starts[0]);dest=gridp(starts[1]);parent={st:None};q=deque([st])
    while q:
        u=q.popleft()
        if u==dest:break
        for d in ((1,0),(-1,0),(0,1),(0,-1)):
            v=(u[0]+d[0],u[1]+d[1]);
            if v not in parent and 0<=v[0]<walk.shape[0] and 0<=v[1]<walk.shape[1] and walk[v]:parent[v]=u;q.append(v)
    assert dest in parent,'No path A -> B'
    from scipy.ndimage import label
    lab,num=label(walk,structure=np.array([[0,1,0],[1,1,1],[0,1,0]]))
    # outside boundary is blocked; some inaccessible disconnected tiny niches may exist. Need whole navigable area connected.
    nmain=np.sum(lab==lab[st]);others=[int((lab==k).sum()) for k in range(1,num+1) if k!=lab[st]]
    assert not others,('Disconnected walkable islands',num,sorted(others,reverse=True)[:12])
    path=[];u=dest
    while u is not None:path.append((round(float(xarr[u[1]]),2),round(float(zarr[u[0]]),2)));u=parent[u]
    return walk,xarr,zarr,path[::-1]

def calc_los(walk,xarr,zarr):
    # Sample long sightlines from street / north path / mid courtyard.
    presets=[((-18,13.25),(18,13.25)),((-17.75,-13.65),(17.75,-13.65)),
       ((-17.2,11.8),(17.1,11.8)),((17.8,13.5),(-17.8,13.5)),
       ((-17.5,-11.2),(9.2,-11.2)),((17.85,-13.4),(-16.6,-13.4)),
       ((-18,9.9),(16,9.9)),((-17.4,7.85),(17.4,7.85)),
       ((4.2,8.2),(17.7,-10.7))]
    candidates=[]
    for a,b in presets:
        if not blocked_2d(*a, .35) and not blocked_2d(*b,.35) and line_visible(a,b):
            candidates.append({'from':[round(a[0],2),1.62,round(a[1],2)],'to':[round(b[0],2),1.62,round(b[1],2)],
            'length_m':round(float(np.linalg.norm(np.array(b)-a)),2)})
    # Randomly sample free positions with priority for long lines.
    free=np.argwhere(walk)
    rng=np.random.default_rng(314159)
    pairs=[];seen=set()
    for _ in range(10500):
        ai,bi=rng.integers(0,len(free),2);aa=free[ai];bb=free[bi]
        a=(float(xarr[aa[1]]),float(zarr[aa[0]]));b=(float(xarr[bb[1]]),float(zarr[bb[0]]))
        D=float(np.linalg.norm(np.array(b)-a))
        if D<8:continue
        if D>24 and line_visible(a,b):
            key=tuple(round(v) for v in (*a,*b));
            if key in seen:continue
            seen.add(key)
            pairs.append({'from':[round(a[0],2),1.62,round(a[1],2)],'to':[round(b[0],2),1.62,round(b[1],2)],'length_m':round(D,2)})
        if len(pairs)>700:break
    merged=sorted(candidates+pairs,key=lambda v:v['length_m'],reverse=True)
    top=[]
    for r in merged:
        # choose diverse spatial regions
        midpoint=np.array([(r['from'][0]+r['to'][0])/2,(r['from'][2]+r['to'][2])/2])
        if not top or all(np.linalg.norm(midpoint-np.array([(t['from'][0]+t['to'][0])/2,(t['from'][2]+t['to'][2])/2]))>2.0 or abs(r['length_m']-t['length_m'])>3 for t in top):top.append(r)
        if len(top)>=5:break
    assert len(top)==5
    # representative sample: random 1000 pairs, avoid highly biased scan
    lengths=[]
    for _ in range(2700):
        ai,bi=rng.integers(0,len(free),2)
        aa=free[ai];bb=free[bi]
        a=(float(xarr[aa[1]]),float(zarr[aa[0]]));b=(float(xarr[bb[1]]),float(zarr[bb[0]]))
        d=float(np.linalg.norm(np.array(b)-a))
        if d>=.25 and line_visible(a,b):lengths.append(d)
    metrics={'sampling':'Random walkable-position pairs, collision AABB raycasts at player eye Y=1.62 m; NOT an exhaustive continuous visibility solution.',
      'visible_pairs':len(lengths),'mean_m':round(float(np.mean(lengths)),2) if lengths else None,
      'maximum_sample_m':round(float(max(lengths)),2) if lengths else None,
      'fraction_over_25m_pct':round(100*sum(v>25 for v in lengths)/len(lengths),2) if lengths else None,
      'preset_long_los':sum(r['length_m']>=25 for r in candidates)}
    return top,metrics


def make_previews(walk,xarr,zarr,path,los):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import Rectangle,Circle
    fig,ax=plt.subplots(figsize=(12,10),dpi=135)
    ax.set_facecolor('#c5b18c')
    ax.add_patch(Rectangle((-20,-16),40,32,fc='#ccb993',ec='#524637',lw=3))
    ax.add_patch(Rectangle((-19.75,10),39.5,5.65,fc='#aaa093',ec='none'))
    ax.add_patch(Rectangle((-14.7,-4.1),16,13.2,fc='#eed8b7',ec='#876e55',lw=2))
    ax.add_patch(Rectangle((10.1,-9.15),7.3,7.95,fc='#dfc29b',ec='#876e55',lw=2))
    ax.add_patch(Rectangle((4.775,1.325),5.55,3.65,fc='#55a9bb',ec='#b9aca1',lw=2))
    ax.add_patch(Rectangle((2.4,-8.6),6.2,5.25,fc='none',ec='#866647',ls=':',lw=2))
    for c in COLL:
        if c['type'] not in ('solid','move'):continue
        if c['center'][1]-c['size'][1]/2>2.0 or c['center'][1]+c['size'][1]/2<.1:continue
        cx,cy,cz=c['center'];dx,dy,dz=c['size'];color='#7d5e4c' if c['type']=='solid' else '#438faa'
        ax.add_patch(Rectangle((cx-dx/2,cz-dz/2),dx,dz,fc=color,ec='none',alpha=.50))
    a=(-17.25,-12.3);b=(17.25,12.4)
    ax.scatter([a[0],b[0]],[a[1],b[1]],s=175,c=['#2789ec','#ed8734'],zorder=7,edgecolor='white',linewidth=1.7)
    ax.annotate('SPAWN A',a,xytext=(-13,-13.85),color='#1259a4',weight='bold',fontsize=11,arrowprops={'arrowstyle':'->','color':'#1259a4'})
    ax.annotate('SPAWN B',b,xytext=(10.2,14.2),color='#b1530c',weight='bold',fontsize=11,arrowprops={'arrowstyle':'->','color':'#b1530c'})
    # mark illustrative long sightline across street (only if unobstructed)
    for j,r in enumerate(los[:3]):
        xa,_,za=r['from'];xb,_,zb=r['to'];
        ax.plot([xa,xb],[za,zb],linestyle='--',linewidth=2,alpha=.72,label=f'LOS {j+1}: {r["length_m"]:.1f} m',zorder=4)
    ax.text(-7.5,3.7,'CASA / INTERIOR',weight='bold',fontsize=12,color='#5d4636',ha='center')
    ax.text(13.75,-5.1,'GARAJE',weight='bold',fontsize=11,color='#5d4636',ha='center')
    ax.text(6.8,7,'PATIO',weight='bold',fontsize=12,color='#5d4636',ha='center')
    ax.text(0,13.1,'CALLE +Z',weight='bold',fontsize=12,color='#3c3833',ha='center')
    ax.text(0,-14.5,'JARDÍN TRASERO / LÍNEA LARGA',fontsize=9,ha='center',color='#41362c')
    ax.legend(loc='lower right',fontsize=9)
    ax.set_xlim(-20.5,20.5);ax.set_ylim(-16.5,16.5);ax.set_aspect('equal')
    ax.set_xlabel('X (metros)');ax.set_ylabel('Z (metros)');ax.set_title('CASA ATLAS XL · planta, colisiones y 3 líneas de visión',fontsize=14,weight='bold')
    fig.tight_layout();fig.savefig(ROOT/'preview'/'01_cenital_colisiones.png');plt.close(fig)
    # navigation overview with traversable grid (for debug)
    fig,ax=plt.subplots(figsize=(11,9),dpi=120)
    ax.imshow(walk,origin='lower',extent=[xarr[0]-.165,xarr[-1]+.165,zarr[0]-.165,zarr[-1]+.165],cmap='Greens',interpolation='nearest')
    pp=np.asarray(path);ax.plot(pp[:,0],pp[:,1],color='orange',lw=2,label='ruta encontrada A → B')
    ax.scatter([a[0],b[0]],[a[1],b[1]],c=['blue','red'],s=70)
    ax.set_xlim(-20,20);ax.set_ylim(-16,16);ax.set_aspect('equal');ax.legend();ax.set_title('QA · navegación conectada · radio jugador 0,35 m')
    fig.tight_layout();fig.savefig(ROOT/'preview'/'02_qa_navegacion.png');plt.close(fig)


def preview_vtk(sc, filename, cam, focus, up=(0,1,0), size=(1100,680), roof=None):
    # Offscreen render from SAME exported geometry (no image hallucination).
    import vtk
    from vtk.util.numpy_support import numpy_to_vtk
    ren=vtk.vtkRenderer();ren.SetBackground(.66,.79,.92);win=vtk.vtkRenderWindow();win.OffScreenRenderingOn();win.AddRenderer(ren);win.SetSize(*size)
    geometries=list(sc.geometry.items()) + (list(roof.geometry.items()) if roof is not None else [])
    for material,mesh in geometries:
        verts=np.asarray(mesh.vertices,dtype=np.float32);faces=np.asarray(mesh.faces,dtype=np.int64)
        pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(verts,deep=True))
        cells=vtk.vtkCellArray()
        for fa in faces:
            tr=vtk.vtkTriangle();
            for k in range(3):tr.GetPointIds().SetId(k,int(fa[k]))
            cells.InsertNextCell(tr)
        poly=vtk.vtkPolyData();poly.SetPoints(pts);poly.SetPolys(cells)
        uvs=np.asarray(mesh.visual.uv,dtype=np.float32)
        tc=numpy_to_vtk(uvs,deep=True);tc.SetNumberOfComponents(2);tc.SetName('TextureCoordinates')
        poly.GetPointData().SetTCoords(tc)
        mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
        actor=vtk.vtkActor();actor.SetMapper(mapper)
        col=COLORS[material];actor.GetProperty().SetColor(*[q/255 for q in col]);actor.GetProperty().SetInterpolationToPBR()
        actor.GetProperty().SetMetallic(.4 if material=='sd_hierro' else 0)
        actor.GetProperty().SetRoughness(.72)
        if material=='sd_vidrio':actor.GetProperty().SetOpacity(.45)
        img=mesh.visual.material.baseColorTexture
        if False and img is not None:
            # Diagnostic preview uses material colors; GLB embeds actual full textures.
            # Texture sampling from actual generated albedo, including transparency MASK.
            data=np.ascontiguousarray(np.flipud(np.asarray(img.convert('RGBA' if material=='sd_vegetacion' else 'RGB'))))
            vimage=vtk.vtkImageData();vimage.SetDimensions(img.width,img.height,1)
            rgba=numpy_to_vtk(data.reshape((-1,data.shape[-1])),deep=True,array_type=vtk.VTK_UNSIGNED_CHAR)
            rgba.SetNumberOfComponents(data.shape[-1]);vimage.GetPointData().SetScalars(rgba)
            texture=vtk.vtkTexture();texture.SetInputData(vimage);texture.RepeatOn();texture.InterpolateOn()
            actor.SetTexture(texture)
            actor.GetProperty().SetColor(1,1,1)
        ren.AddActor(actor)
    # Add directional lighting
    light=vtk.vtkLight();light.SetLightTypeToSceneLight();light.SetPosition(-15,30,25);light.SetFocalPoint(0,0,0);light.SetIntensity(1.2);ren.AddLight(light)
    amb=vtk.vtkLight();amb.SetLightTypeToSceneLight();amb.SetPosition(15,20,-10);amb.SetFocalPoint(0,0,0);amb.SetIntensity(.45);ren.AddLight(amb)
    camera=ren.GetActiveCamera();camera.SetPosition(*cam);camera.SetFocalPoint(*focus);camera.SetViewUp(*up)
    camera.SetViewAngle(71 if abs(cam[1]-1.62)<.4 else 45);ren.SetActiveCamera(camera);ren.ResetCameraClippingRange()
    try:
        win.Render();w2i=vtk.vtkWindowToImageFilter();w2i.SetInput(win);w2i.Update();writer=vtk.vtkPNGWriter();writer.SetInputConnection(w2i.GetOutputPort());writer.SetFileName(str(filename));writer.Write()
        return True
    except Exception as e:
        print('vtk screenshot FAILED:',e);return False
    finally:
        win.Finalize()


def main():
    make_textures();outdoors();house();garage()
    total=sum(TRI.values());roof_total=sum(RT.values());print('Triangles main',total,'roof',roof_total,'materials',sum(bool(v['faces']) for v in SURF.values()))
    assert total+roof_total<=60000,(total,roof_total)
    assert sum(bool(v['faces']) for v in SURF.values())+sum(bool(ROOF_SURF[m]['faces']) and not SURF[m]['faces'] for m in COLORS)<=40
    scene=build_scene(SURF);rs=build_scene(ROOF_SURF)
    mainpath=ROOT/'models'/'sd_casa_atlas_xl.glb';roofpath=ROOT/'models'/'sd_casa_atlas_xl_techo.glb'
    mainpath.write_bytes(scene.export(file_type='glb',include_normals=True))
    roofpath.write_bytes(rs.export(file_type='glb',include_normals=True))
    walk,xarr,zarr,path=navigation();los,metrics=calc_los(walk,xarr,zarr)
    assert los[0]['length_m']>=30,('No long LOS measured',los)
    make_previews(walk,xarr,zarr,path,los)
    spawns=[{'team':'A','position':[-17.25,0,-12.3],'yaw':-0.45}, {'team':'B','position':[17.25,0,12.4],'yaw':2.55}]
    zones=[
      {'name':'CALLE FRONTAL','bounds':[-19.45,10.15,19.45,15.55]},
      {'name':'VILLA INTERIOR','bounds':[-14.7,-4.1,1.3,9.1]},
      {'name':'PATIO Y ESTANQUE','bounds':[1.35,-1.2,16.9,10.0]},
      {'name':'PERGOLA','bounds':[2.2,-8.8,8.8,-3.1]},
      {'name':'GARAJE','bounds':[10.1,-9.15,17.4,-1.2]},
      {'name':'JARDIN TRASERO','bounds':[-19.1,-15.45,19.1,-9.55]},
      {'name':'CALLEJON OESTE','bounds':[-19.5,-10.2,-14.85,10.15]},
      {'name':'CALLEJON ESTE','bounds':[17.55,-10.2,19.5,10.15]},
    ]
    notes=[
        'One playable level at y=0. Roof is visual-only and impassable, provided as separate GLB; roof colliders in JSON must remain enabled if roof rendered.',
        'Local coordinates: +Y up, +Z front street, center of 40x32 parcel = (0,0,0).',
        'Spawns are separated by >30 m, each >=0.8m from body-height colliders, with no clear eye-height LOS.',
        'Three intended routes: west alley→street; north gravel garden→east alley; west door→villa interior→east door→patio→street.',
        'Glass windows are unbreakable movement blockers type move occupying the full opening from y=0..3 m; bullets pass through panes; opaque sill/header remain solid.',
        'Doors are always OPEN, no animated doors; widths from 1.7 to 3.1m. No doors as decorative physical leaves.',
        'Pool is a shallow raised reflecting basin represented by full solid collision; not swimmable; no fake cover.',
        'Garden foliage cards are cosmetic non-cover: bullet traces and player movement ignore leaf cards; tree trunks use matching solid boxes.',
        'Ground floor collisions use implicit floorY=0. Rendered slabs are y<=0 except pond rim and other explicit obstacles.',
        'No accessible rooftops or elevations. Max jump should not gain access to roof; server must cap y and validate navigation.',
        'Roof materials include proper opaque surfaces. Add suitable indoor ambient lighting when roof model is enabled.',
        'Bench/planter crates are solid rectangular cover. Objects thinner than 6cm are cosmetic decal/edge parts that must not read as combat cover.',
        'The frontal gate is shut and solid; there is no route outside the outer perimeter.',
        'These line-of-sight measurements are sample-based offline geometry checks; Claude must recompute with the real engine and camera.',
    ]
    j={'id':'CASA_ATLAS_XL','version':'1.0.0','author':'ChatGPT — original geometry/textures','license':'Original / CC0-equivalent grant',
      'units':'meters','axis':'+Y up; +Z front street','dimensions':{'width':40,'depth':32,'height':4.2},
      'bounds':{'min':[-20,0,-16],'max':[20,4.2,16]},'playerEyeHeight':1.62,'floorY':0,
      'spawns':spawns,'zones':zones,'colliders':COLL,'renderMeshes':[{'name':m,'triangles':TRI[m], 'material':m} for m in COLORS if TRI[m]],
      'roofMeshes':[{'name':m,'triangles':RT[m], 'material':m} for m in COLORS if RT[m]],
      'measuredSightlines':los,'losSamplingMetrics':metrics,'notes':notes}
    (ROOT/'collision_map.json').write_text(json.dumps(j,ensure_ascii=False,indent=2),encoding='utf8')
    (ROOT/'src'/'scene_objects.json').write_text(json.dumps(OBJECTS,ensure_ascii=False,indent=2),encoding='utf8')
    (ROOT/'src'/'material_manifest.json').write_text(json.dumps(MAT_META,ensure_ascii=False,indent=2),encoding='utf8')
    cams=[
       ('03_calle_fps.png',(-15.8,1.62,13.1),(8.0,1.55,13.1)),
       ('04_patio_fps.png',(3.4,1.62,7.2),(12.8,1.55,1.2)),
       ('05_villa_fps.png',(-12.3,1.62,4.1),(-2.0,1.62,4.6)),
       ('06_jardin_fps.png',(-11.6,1.62,-12.5),(14.0,1.62,-12.7)),
       ('07_garaje_fps.png',(11.75,1.62,-2.8),(16.3,1.62,-8.3)),
       ('08_vista_isometrica.png',(34,39,43),(0,0,0)),
    ]
    for fname,cam,focus in cams:
        print('render',fname,flush=True);preview_vtk(scene,ROOT/'preview'/fname,cam,focus)
    preview_vtk(scene,ROOT/'preview'/'09_vista_con_techos.png',(34,39,43),(0,0,0),roof=rs)
    print('Wrote',mainpath,mainpath.stat().st_size,'roof',roofpath.stat().st_size,'colliders',len(COLL),'los',los[:2],'metric',metrics)

if __name__=='__main__':main()
