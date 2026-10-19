"""CASA ATLAS XL v2. Blender background, no third-party Python dependencies.
Run via run.ps1 so config, temporary files and caches remain in the project.
Coordinates in this source and GLB are metres, +Y up, +Z street.
Blender conversion only occurs in the preview stage. No lights/cameras exported.
"""
from pathlib import Path
from collections import defaultdict
import ast, math, json, struct, hashlib, random, shutil, sys
import numpy as np
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
V1=ROOT.parent/'2026-10-18_casa_atlas_xl'
TEX=ROOT/'textures'
RNG=random.Random(20261019)
GROUPS={}; RECORDS=[]; MATERIALS={}; IMAGES={}; UVS={}
COLLISION=json.loads((V1/'collision_map.json').read_text(encoding='utf-8'))
BOXES=COLLISION['boxes'] if 'boxes' in COLLISION else COLLISION.get('colliders',[])
if not BOXES:
    for val in COLLISION.values():
        if isinstance(val,list) and val and isinstance(val[0],dict) and 'center' in val[0] and 'size' in val[0]:BOXES=val;break
assert len(BOXES)==98, len(BOXES)

def material(name,tex=None,normal=None,orm=None,rough=.85,metal=0,palette=None,alpha=None,emission=0,tile=1.8):
    m={'name':name,'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':metal,'roughnessFactor':rough}}
    if tex:m['pbrMetallicRoughness']['baseColorTexture']={'index':image(tex)}
    if palette is not None:
        m['pbrMetallicRoughness']['baseColorTexture']={'index':image('palette.jpg')}
        UVS[name]=((palette+.5)/8,.5)
    if normal:m['normalTexture']={'index':image(normal),'scale':.55}
    if orm:
        m['pbrMetallicRoughness']['metallicRoughnessTexture']={'index':image(orm)}
        m['pbrMetallicRoughness']['metallicFactor']=1
        m['pbrMetallicRoughness']['roughnessFactor']=1
    if alpha:
        m['alphaMode']=alpha;m['doubleSided']=True
        if alpha=='MASK':m['alphaCutoff']=.5
    if emission:
        m['emissiveFactor']=[emission,emission*.91,emission*.75]
        if tex:m['emissiveTexture']={'index':image(tex)}
    MATERIALS[name]=m
    UVS.setdefault(name,tile)

def image(filename):
    if filename not in IMAGES:IMAGES[filename]=len(IMAGES)
    return IMAGES[filename]

for key,repeat in [('stucco',1.8),('stone',2),('wood',2)]:
    material(key,key+'_color.jpg',key+'_normal.jpg',key+'_orm.jpg',tile=repeat)
material('paint','paint_color.jpg',rough=.83,tile=1.5)
material('tile','tile_color.jpg',rough=.88,tile=1.5)
material('bark','bark_color.jpg',rough=.98,tile=1)
material('ochre','ochre_color.jpg','stucco_normal.jpg','stucco_orm.jpg')
material('cobble','cobble_color.jpg',tile=2)
material('terracotta','terracotta_color.jpg','terracotta_normal.jpg','terracotta_orm.jpg',tile=2.08)
material('soil','soil_color.jpg',rough=1,tile=2)
material('linen','linen_color.jpg',rough=.98,tile=.5)
for name,slot,rough,metal in [('iron',0,.7,.25),('cream',1,.8,0),('clay',4,.9,0),('water',6,.25,0),('lamp',7,.4,0)]:
    material(name,palette=slot,rough=rough,metal=metal,emission=.5 if name=='lamp' else 0)
material('glass','glass.png',rough=.23,alpha='BLEND')
material('olive','botanical.png',alpha='MASK')
material('vine','botanical.png',alpha='MASK')
material('cypress','botanical.png',alpha='MASK')
# The same scanned colors are reused for interior material fill. AO/lighting is
# baked into COLOR_0 below. Small emissive fill retains legibility under a roof.
material('interior_stucco','stucco_color.jpg','stucco_normal.jpg','stucco_orm.jpg',emission=.075)
material('interior_floor','terracotta_color.jpg','terracotta_normal.jpg','terracotta_orm.jpg',emission=.045,tile=2.08)
material('interior_wood','wood_color.jpg','wood_normal.jpg','wood_orm.jpg',emission=.04,tile=2)

def inside(p):
    x,y,z=p
    return (-14.59<x<1.19 and -3.99<z<8.99 and -.01<y<3.46) or (10.22<x<17.28 and -9.03<z<-1.32 and -.01<y<3.25)

def group(mat,roof):
    return GROUPS.setdefault((roof,mat),{'v':[],'n':[],'uv':[],'c':[],'f':[]})

def face(name,points,mat,roof=False,uv=None):
    p=np.array(points,dtype=float)
    n=np.cross(p[1]-p[0],p[2]-p[0]);ln=np.linalg.norm(n)
    if ln<1e-9:return
    n/=ln
    if roof and n[1]<-.9 and mat=='tile':mat='stucco'  # Opaque plaster ceiling, never underside roof tiles.
    # Offset face center toward exposed side to distinguish the interior face.
    test=p.mean(axis=0)+n*.03
    if inside(test):mat={'stucco':'interior_stucco','ochre':'interior_stucco','wood':'interior_wood','terracotta':'interior_floor'}.get(mat,mat)
    g=group(mat,roof);start=len(g['v'])
    g['v'].extend(p.tolist());g['n'].extend([n.tolist()]*len(p));g['c'].extend([[1,1,1,1]]*len(p))
    if uv is None:
        scale=UVS[mat]
        if isinstance(scale,tuple):uv=[scale]*len(p)
        else:
            axis=int(np.argmax(abs(n)));uv=[(a[2]/scale,a[1]/scale) if axis==0 else ((a[0]/scale,a[2]/scale) if axis==1 else (a[0]/scale,a[1]/scale)) for a in p]
    # glTF's image origin is at the top; preserve consistent projected texture.
    g['uv'].extend(uv)
    for i in range(1,len(p)-1):g['f'].append((start,start+i,start+i+1))
    return mat,len(p)-2

def record(name,mat,points,tri,roof,rule):
    p=np.array(points)
    RECORDS.append(dict(name=name,material=mat,triangles=tri,roof=roof,min=p.min(axis=0).tolist(),max=p.max(axis=0).tolist(),rule=rule))

def box(name,c,s,mat,roof=False,rule='existing',subdivide=False):
    c=np.array(c);s=np.array(s);lo=c-s/2;hi=c+s/2
    x0,y0,z0=lo;x1,y1,z1=hi
    quads=[[(x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0)],[(x1,y0,z1),(x1,y0,z0),(x1,y1,z0),(x1,y1,z1)],
           [(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],[(x1,y0,z0),(x0,y0,z0),(x0,y1,z0),(x1,y1,z0)],
           [(x0,y1,z1),(x1,y1,z1),(x1,y1,z0),(x0,y1,z0)],[(x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1)]]
    tri=0
    for q in quads:
        q=np.array(q);u=q[1]-q[0];v=q[3]-q[0]
        nu=max(1,math.ceil(np.linalg.norm(u)/.8)) if subdivide else 1
        nv=max(1,math.ceil(np.linalg.norm(v)/.8)) if subdivide else 1
        for a in range(nu):
            for b in range(nv):
                pts=[q[0]+u*a/nu+v*b/nv,q[0]+u*(a+1)/nu+v*b/nv,q[0]+u*(a+1)/nu+v*(b+1)/nv,q[0]+u*a/nu+v*(b+1)/nv]
                face(name,pts,mat,roof);tri+=2
    record(name,mat,[lo,hi],tri,roof,rule)

def tube(name,points,radii,mat,sides=7,roof=False,rule='detail'):
    rings=[]
    for i,p in enumerate(points):
        p=np.array(p);d=np.array(points[min(i+1,len(points)-1)])-np.array(points[max(i-1,0)])
        d=d/np.linalg.norm(d);a=np.cross(d,[0,1,0] if abs(d[1])<.9 else [1,0,0]);a/=np.linalg.norm(a);b=np.cross(d,a)
        rings.append([p+radii[i]*(math.cos(k*2*math.pi/sides)*a+math.sin(k*2*math.pi/sides)*b) for k in range(sides)])
    tri=0
    for i in range(len(rings)-1):
        for j in range(sides):
            j1=(j+1)%sides
            face(name,[rings[i][j],rings[i][j1],rings[i+1][j1],rings[i+1][j]],mat,roof);tri+=2
    face(name,list(reversed(rings[0])),mat,roof);face(name,rings[-1],mat,roof);tri+=2*(sides-2)
    record(name,mat,np.array(rings).reshape(-1,3),tri,roof,rule)

def foliage(name,c,w,h,angle,mat='olive'):
    a=np.array([math.cos(angle)*w/2,0,math.sin(angle)*w/2]);b=np.array([0,h/2,0]);c=np.array(c)
    points=[c-a-b,c+a-b,c+a+b,c-a+b]
    # Both materials share a single alpha atlas; halves are isolated by UVs.
    v0,v1=(0,.5) if mat=='olive' else (.5,1)
    u0,u1=(0,1) if mat=='olive' else ((0,.5) if mat=='vine' else (.5,1))
    face(name,points,mat,uv=[(u0,v1),(u1,v1),(u1,v0),(u0,v0)])
    record(name,mat,points,2,False,'foliage_noncover')

def lathe(name,x,z,profile,mat='clay',segments=14,rule='low_wall_detail'):
    rings=[[(x+r*math.cos(i*2*math.pi/segments),y,z+r*math.sin(i*2*math.pi/segments)) for i in range(segments)] for r,y in profile]
    for k in range(len(rings)-1):
        for i in range(segments):
            j=(i+1)%segments
            face(name,[rings[k][i],rings[k+1][i],rings[k+1][j],rings[k][j]],mat)
    record(name,mat,np.array(rings).reshape(-1,3),(len(rings)-1)*segments*2,False,rule)

def recipe():
    """Read original source without importing it or executing its writes/imports."""
    source=ast.parse((V1/'src/generate_casa_atlas_xl.py').read_text(encoding='utf-8'))
    names={'bx','w_x','w_z','bench','planter','tree','house','garage','outdoors'}
    ns={'np':np,'RNG':np.random.default_rng(20261018),'COLL':[],'ROOF_SURF':object()};objects=[]
    def emit(name,x0,y0,z0,x1,y1,z1,mat,collider=None,store=None):
        objects.append(dict(name=name,c=[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],s=[x1-x0,y1-y0,z1-z0],mat=mat,collision=collider,roof=store is ns['ROOF_SURF']))
    ns['emit_box']=emit
    code=ast.Module(body=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[])
    exec(compile(code,'v1_geometry_readonly','exec'),ns)
    for name in ['outdoors','house','garage']:ns[name]()
    return objects

MAP={'sd_estuco':'stucco','sd_estuco_ocre':'ochre','sd_piedra':'stone','sd_suelo_caliza':'terracotta','sd_adoquin':'cobble','sd_tierra':'soil','sd_madera':'wood','sd_madera_pintada':'paint','sd_hierro':'iron','sd_teja':'tile','sd_vidrio':'glass','sd_agua':'water','sd_vegetacion':'olive','sd_tela':'linen','sd_hormigon':'stone','sd_grava':'cobble','sd_roble':'wood'}

def base_geometry():
    for o in recipe():
        n=o['name'];c=o['c'];s=o['s'];mat=MAP[o['mat']]
        if any(t in n for t in ['fine_jamb','fine_sill','shutter','crown','shrub','hierba','porton_tabla']):continue
        if n.endswith('_trunk'):continue
        if n=='sofa_1':
            x,y,z=c;w,h,d=s
            box(n+'_base',(x,.24,z),(w,.48,d),'linen')
            box(n+'_respaldo',(x,.69,z-d/2+.09),(w,.46,.18),'linen')
            for xx in [x-w/2+.09,x+w/2-.09]:box(n+'_brazo',(xx,.63,z),(.18,.58,d),'linen')
            for xx in [x-.36,x+.36]:box(n+'_asiento',(xx,.53,z+.06),(.68,.10,d-.23),'linen')
            continue
        if n=='sofa_1_seat':continue
        if n in ['mesa_comedor','mesa_salon']:
            x,y,z=c;w,h,d=s
            box(n+'_tablero',(x,h-.055,z),(w,.11,d),'wood')
            for xx in [-w/2+.075,w/2-.075]:
                for zz in [-d/2+.075,d/2-.075]:box(n+'_pata',(x+xx,(h-.11)/2,z+zz),(.12,h-.11,.12),'wood')
            continue
        # The formerly coplanar ground slabs get disjoint visible top surfaces.
        if n in ['parcela_suelo','patio_central','calle_frontal','sendero_jardin','sendero_este','sendero_oeste','terraza_madera','villa_suelo','garaje_suelo','calle_cuneta']:continue
        if '_glass_' in n:
            # Keep movement window box; visible glass occupies the rear opening face.
            # Non-transparent lightly colored glazing, bullets still use original map.
            mat='glass'
        # Existing furniture keeps solid silhouettes and exact bounding extents.
        box(n,c,s,mat,o['roof'],subdivide=('wall' in n or '_sill_' in n or '_header_' in n))
    # Single tessellated ground at y=0; category selection yields no overlapping slabs.
    xs=sorted(set([-19.75,19.75,-14.59,1.19,10.21,17.29,.75,12.85,-17.75,17.75,-18.25,-16.55,17.6,19.2,2,8.8]))
    zs=sorted(set([-15.75,15.75,-3.99,8.99,-9.04,-1.29,.05,9.55,-13,-11.6,-13.3,13.3,-8.25,-2.75]))
    for a,b in zip(xs,xs[1:]):
        for d,e in zip(zs,zs[1:]):
            x=(a+b)/2;z=(d+e)/2
            mat='soil'
            if z>=9.55:mat='cobble'
            if .75<x<12.85 and .05<z<9.55:mat='terracotta'
            if (-17.75<x<17.75 and -13<z<-11.6) or (-18.25<x<-16.55 and -13.3<z<13.3) or (17.6<x<19.2 and -13.3<z<13.3):mat='cobble'
            if 2<x<8.8 and -8.25<z<-2.75:mat='wood'
            if -14.59<x<1.19 and -3.99<z<8.99:mat='terracotta'
            if 10.21<x<17.29 and -9.04<z<-1.29:mat='stone'
            # Ground grids keep light bake gradients visible across rooms.
            nu=max(1,math.ceil((b-a)/.8));nv=max(1,math.ceil((e-d)/.8))
            for i in range(nu):
                for j in range(nv):
                    u0=a+(b-a)*i/nu;u1=a+(b-a)*(i+1)/nu;v0=d+(e-d)*j/nv;v1=d+(e-d)*(j+1)/nv
                    face('suelo',[(u0,0,v1),(u1,0,v1),(u1,0,v0),(u0,0,v0)],mat)
            record('suelo_'+mat,mat,[(a,0,d),(b,0,e)],nu*nv*2,False,'ground')

def architecture():
    # Face-normal and along-wall basis, derived from original collision slabs.
    def basis(o):
        c=np.array(o['center']);s=np.array(o['size']);along=np.array([1,0,0]) if s[0]>s[2] else np.array([0,0,1]);normal=np.array([0,0,1]) if s[0]>s[2] else np.array([1,0,0])
        return c,s,along,normal,max(s[0],s[2]),min(s[0],s[2])
    def detail(n,c,w,h,depth,along,normal,mat,rule='wall_detail_<=6cm'):
        size=abs(along)*w+np.array([0,h,0])+abs(normal)*depth;box(n,c,size,mat,rule=rule)
    for o in BOXES:
        n=o['name'];c,s,a,d,width,thick=basis(o)
        if n.startswith(('villa_','garaje_')) and any(k in n for k in ['_wall_','_sill_']):
            # Plinths on both exposed sides, 25 mm from the wall face.
            for sign in [-1,1]:
                p=c+d*sign*(thick/2+.0125);p[1]=.16
                detail(n+'_rodapie_'+str(sign),p,width,.32,.025,a,d,'clay')
        if 'window_move' in n:
            sill=1.25 if n.startswith('garaje') else 1.08;top=2.15 if n.startswith('garaje') else 2.28
            for sign in [-1,1]:
                front=d*sign*(thick/2+.025)
                for edge in [-1,1]:
                    p=c+a*edge*(width/2+.055)+front;p[1]=(sill+top)/2
                    detail(n+'_marco_'+str(sign)+str(edge),p,.11,top-sill+.16,.05,a,d,'cream')
                p=c+front;p[1]=top+.055
                detail(n+'_dintel_'+str(sign),p,width+.22,.11,.05,a,d,'cream')
                p=c+d*sign*(thick/2+.005);p[1]=sill-.035
                detail(n+'_alf eizar_'+str(sign),p,width+.24,.07,.10,a,d,'cream')
            # Exterior orientation: north=-Z, south=+Z, east=+X, west=-X.
            sign=-1 if any(t in n for t in ['norte','oeste']) else 1
            front=d*sign*(thick/2+.020)
            for edge in [-1,1]:
                p=c+a*edge*(width/2+.39)+front;p[1]=(sill+top)/2
                detail(n+'_contraventana_'+str(edge),p,.60,top-sill,.045,a,d,'paint')
                for k in range(8):
                    q=p.copy();q[1]=sill+.08+k*(top-sill-.16)/7;q+=d*sign*.024
                    detail(n+'_lama_'+str(edge)+'_'+str(k),q,.55,.035,.022,a,d,'wood')
                for yy in [sill+.13,top-.13]:
                    q=p.copy();q[1]=yy;q+=d*sign*.03
                    detail(n+'_bisagra',q,.46,.035,.018,a,d,'iron')
            # Slender iron bars are cosmetic (same projectile semantics as v1).
            for offset in np.arange(-width/2+.12,width/2,.24):
                p=c+a*offset+d*sign*(thick/2+.045)
                tube(n+'_reja',[[p[0],sill+.07,p[2]],[p[0],top-.06,p[2]]],[.012,.012],'iron',6,rule='window_cosmetic')
            for yy in [sill+.14,top-.14]:
                p=c+d*sign*(thick/2+.045);p[1]=yy
                detail(n+'_travesano_reja',p,width-.1,.025,.025,a,d,'iron','window_cosmetic')
        if '_door_header_' in n:
            for sign in [-1,1]:
                front=d*sign*(thick/2+.025)
                for edge in [-1,1]:
                    p=c+a*edge*(width/2+.045)+front;p[1]=1.21
                    detail(n+'_jamba_'+str(sign)+str(edge),p,.09,2.42,.05,a,d,'cream')
                p=c+front;p[1]=2.47
                detail(n+'_marco_superior_'+str(sign),p,width+.18,.10,.05,a,d,'cream')
            p=c.copy();p[1]=.009
            detail(n+'_umbral',p,width,.018,thick+.08,a,d,'stone','ground')
            # Open leaves placed on existing wall, never across the passage.
            if n.startswith('garaje_sur'):
                p=c.copy();p[1]=2.68;p[2]-=.42
                box(n+'_porton_abierto',p,(width,.09,.8),'paint',rule='overhead_<=1.2m')
                for x in [-width/2,width/2]:
                    q=p.copy();q[0]+=x;box(n+'_rail',q,(.025,.06,1.0),'iron',rule='overhead_<=1.2m')
            else:
                sign=-1 if any(t in n for t in ['norte','oeste']) else 1
                p=c+a*(width/2+(.40 if 'divisor_salon' in n else .43))+d*sign*(thick/2+.024);p[1]=1.16
                detail(n+'_hoja_abierta',p,.70 if 'divisor_salon' in n else .78,2.24,.045,a,d,'wood')
                for yy in [.24,1.14,2.08]:
                    q=p.copy();q[1]=yy;q+=d*sign*.026
                    detail(n+'_refuerzo_hoja',q,.70,.06,.018,a,d,'paint')
                q=p+a*.23+d*sign*.020;q[1]=1.05
                detail(n+'_tirador',q,.04,.17,.025,a,d,'iron')
        if n.startswith('perimetro'):
            p=c.copy();p[1]=3.74
            detail(n+'_albardilla',p,width+.05,.12,thick+.10,a,d,'clay','overhead_<=1.2m')
            if 'porton' not in n:
                for off in np.arange(-width/2+.2,width/2,.0+3.6):
                    p=c+a*off
                    detail(n+'_pilastra',p,.30,s[1],thick+.09,a,d,'stucco')
                    p[1]=3.83;detail(n+'_capitel',p,.40,.10,thick+.15,a,d,'cream','overhead_<=1.2m')
            else:
                for off in np.arange(-width/2+.08,width/2,.22):
                    p=c+a*off-d*(thick/2+.015)
                    detail('porton_liston',p,.045,3.45,.03,a,d,'wood')
                for yy in [.35,1.8,3.25]:
                    p=c-d*(thick/2+.025);p[1]=yy
                    detail('porton_herrajes',p,width-.1,.07,.035,a,d,'iron')
    # Continuous roofline with generous but domestic profiles; all above 3 m.
    for x0,x1,z0,z1,y in [(-14.7,1.3,-4.1,9.1,3.45),(10.1,17.4,-9.15,-1.2,3.25)]:
        for z in [z0,z1]:
            box('cornisa_horizontal',((x0+x1)/2,y-.08,z),(x1-x0+.30,.16,.40),'cream',rule='overhead_<=1.2m')
            box('cornisa_sombra',((x0+x1)/2,y-.19,z),(x1-x0+.18,.05,.31),'clay',rule='overhead_<=1.2m')
        for x in [x0,x1]:
            box('cornisa_lateral',(x,y-.08,(z0+z1)/2),(.40,.16,z1-z0+.3),'cream',rule='overhead_<=1.2m')
    # Flat villa roof, existing opaque slab retained; parapet cap separate.
    for z in [-4,9]:box('villa_albardilla',(-6.7,4.02,z),(16.15,.10,.34),'clay',True,rule='overhead_<=1.2m')
    for x in [-14.6,1.2]:box('villa_albardilla',(x,4.02,2.5),(.34,.10,13.15),'clay',True,rule='overhead_<=1.2m')
    # Garage low gable: curved Arab tiles, drain channels, overlapping rows.
    # Each tile is an actual curved surface; ~12k triangles including ridge.
    for side in [-1,1]:
        for ix in range(26):
            x=9.94+ix*.295
            for iz in range(9):
                z=-5.175+side*(iz*.47)
                points=[]
                for end in [0,.52]:
                    zz=z+side*end;y=4.27-abs(zz+5.175)*.155
                    points.append([(x+.145*math.cos(t*math.pi/5),y+.07*math.sin(t*math.pi/5),zz) for t in range(6)])
                for k in range(5):
                    q=[points[0][k],points[1][k],points[1][k+1],points[0][k+1]]
                    if side<0:q.reverse()
                    face('garaje_teja_curva',q,'tile',True)
                record('garaje_teja_curva','tile',np.array(points).reshape(-1,3),10,True,'overhead_<=1.2m')
    tube('garaje_cumbrera',[[9.8,4.31,-5.175],[17.65,4.31,-5.175]],[.12,.12],'clay',10,True,rule='overhead_<=1.2m')
    for z in [-9.46,-.9]:
        tube('garaje_canalon',[[9.9,3.48,z],[17.7,3.48,z]],[.065,.065],'iron',8,rule='overhead_<=1.2m')
    tube('garaje_bajante',[[17.54,.1,-8.8],[17.54,3.1,-8.8],[17.54,3.48,-9.36]],[.035]*3,'iron',8,rule='wall_detail_<=45cm')

def vegetation_and_details():
    # Keep tree-body silhouettes within 6 cm of original .32 m collider.
    for i,(x,z) in enumerate([(-12,-12.15),(-1.8,-12.5),(17.6,7.9),(-17.6,8.65)]):
        pts=[[x,0,z],[x+.025,.5,z-.018],[x-.025,1.1,z+.025],[x+.02,1.65,z],[x,2.2,z]]
        tube('arbol_tronco_'+str(i),pts,[.16,.155,.16,.15,.145],'bark',9,rule='trunk_existing')
        if i==3:
            tube('cipres_eje',[[x,2.14,z],[x+.025,3.1,z],[x,4.65,z]],[.12,.06,.008],'bark',7,rule='tree_overhead')
            for j in range(100):
                y=2.42+RNG.random()*1.9;width=.78*(1-(y-2.42)/2.7)
                foliage('cipres_copa',(x+RNG.uniform(-.13,.13),y,z+RNG.uniform(-.13,.13)),width,.70,RNG.random()*math.tau,'cypress')
            continue
        for k in range(6):
            angle=k*math.tau/6+.2
            bx=x+math.cos(angle)*.73;bz=z+math.sin(angle)*.73
            tube('olivo_rama',[[x,2.13,z],[bx,2.65,bz],[bx+math.cos(angle)*.3,3.4,bz+math.sin(angle)*.3]],[.11,.06,.012],'bark',6,rule='tree_overhead')
            for j in range(30):
                q=(bx+RNG.uniform(-.53,.53),2.75+RNG.random()*1.0,bz+RNG.uniform(-.53,.53))
                foliage('olivo_hojas',q,.90,.90,RNG.random()*math.tau)
    # Low visible planting, sparse, entirely below 66 cm.
    for o in BOXES:
        if not o['name'].startswith('macetero'):continue
        x,y,z=o['center'];sx,sy,sz=o['size']
        for k in range(5):
            foliage('plantacion_baja',(x+(k-2)*sx/6,min(.60,sy+.025),z),.25,.12,RNG.random()*math.tau,'vine')
        for sign in [-1,1]:box('borde_macetero',(x,sy-.035,z+sign*(sz/2-.035)),(sx,.07,.07),'clay',rule='existing')
    # Pergola full longitudinal girders, transverse rafters and sparse climbing vine.
    for x in [2.4,8.6]:box('pergola_viga',(x,2.95,-5.975),(.20,.25,5.75),'wood',rule='overhead_<=1.2m')
    for z in np.arange(-8.75,-3,.38):box('pergola_travesano',(5.5,3.14,float(z)),(6.65,.12,.09),'wood',rule='overhead_<=1.2m')
    for k in range(52):
        x=RNG.uniform(2.45,8.55);z=RNG.uniform(-8.6,-3.35)
        foliage('pergola_parra',(x,3.07+RNG.uniform(-.08,.14),z),.72,.55,RNG.random()*math.tau,'vine')
    # Pots touch existing walls and stay below knee height. No new blocking props.
    for x,z in [(-8.1,9.46),(-5.0,9.46),(1.65,5.35),(9.77,-7.2),(17.73,-2.0),(-14.99,-3.3)]:
        lathe('maceta_barro',x,z,[(.12,.02),(.17,.05),(.23,.43),(.25,.46),(.25,.51),(.19,.51),(.18,.44)],rule='low_wall_detail')
        for j in range(4):foliage('maceta_flor',(x,.55,z),.32,.20,j*math.pi/4,'vine')
    # Climbing bougainvillea, thin cards against solid exterior wall only.
    for k in range(20):foliage('buganvilla_fachada',(-3.25+RNG.uniform(-.35,.35),2.35+RNG.random()*.8,9.27),.6,.65,0,'vine')
    # Lamps mounted above 2 metres; black frame with warm glass.
    for x,z in [(-8,9.27),(-5.1,9.27),(1.46,2.25),(10.0,-6.6),(14.6,-1.03)]:
        box('farol_soporte',(x,2.65,z),(.08,.09,.25),'iron',rule='overhead_<=1.2m')
        box('farol_vidrio',(x,2.48,z+.08),(.16,.25,.16),'lamp',rule='overhead_<=1.2m')
        for xx in [-.1,.1]:
            for zz in [-.1,.1]:box('farol_barra',(x+xx,2.48,z+.08+zz),(.02,.30,.02),'iron',rule='overhead_<=1.2m')
        box('farol_tapa',(x,2.65,z+.08),(.26,.05,.26),'iron',rule='overhead_<=1.2m')
    # AC above head, cabinet and louvers close to the eastern facade.
    box('aire_acondicionado',(1.62,2.79,7.95),(.4,.45,.95),'cream',rule='overhead_<=1.2m')
    for k in range(7):box('aire_rejilla',(1.83,2.64+k*.045,7.95),(.018,.014,.77),'iron',rule='overhead_<=1.2m')
    tube('cable_fachada',[[1.46,3.10,5.15],[1.46,3.01,6.2],[1.46,3.1,8.4]],[.012]*3,'iron',6,rule='overhead_<=1.2m')
    # Fixed textile awning over the south door, entirely above 2.3 m.
    awning=[(-7.85,2.78,9.24),(-5.15,2.78,9.24),(-5.15,2.50,10.26),(-7.85,2.50,10.26)]
    face('toldo',list(reversed(awning)),'linen');face('toldo_inferior',awning,'linen')
    record('toldo','linen',awning,4,False,'overhead_<=1.2m')
    for x in [-7.85,-5.15]:tube('toldo_brazo',[[x,2.4,9.25],[x,2.49,10.25]],[.018,.018],'iron',6,rule='overhead_<=1.2m')
    box('toldo_faldon',(-6.5,2.45,10.26),(2.70,.10,.018),'linen',rule='overhead_<=1.2m')
    # Furniture facade joinery remains within original bounding boxes (+0.025 m).
    for o in BOXES:
        if o['name'] not in ['isla_cocina','aparador','armario_dormitorio','garaje_almacen','garaje_cajon_herramientas','caja_patio','caja_calle_01','caja_calle_02']:continue
        x,y,z=o['center'];sx,sy,sz=o['size']
        for yy in np.arange(.14,sy,.23):
            box(o['name']+'_junta',(x,float(yy),z+sz/2+.012),(sx*.88,.018,.024),'iron',rule='existing_detail_<=6cm')
        for xx in [-sx*.25,sx*.25]:
            box(o['name']+'_pomo',(x+xx,sy*.64,z+sz/2+.018),(.06,.025,.035),'iron',rule='existing_detail_<=6cm')
    # Cushions and bedding fit the old solid volumes, avoiding false gaps.
    for x in [-11.71,-10.99]:box('sofa_cojin',(x,.73,4.78),(.62,.28,.13),'linen',rule='existing')
    box('cama_almohada',(-13,.55,-2.52),(1.17,.09,.43),'linen',rule='existing_detail_<=6cm')
    for x,z in [(-10.7,3.4),(-3.5,5),(-12,-1.8),(13.5,-4.4)]:
        tube('lampara_cable',[[x,3.38,z],[x,2.8,z]],[.012,.012],'iron',6,rule='indoor_overhead')
        box('lampara_pantalla',(x,2.75,z),(.38,.12,.38),'cream',rule='indoor_overhead')
        box('lampara_difusor',(x,2.68,z),(.31,.025,.31),'lamp',rule='indoor_overhead')

def bake_vertex_light():
    """Deterministic visibility-based AO + fixed-lamp irradiance into vertex color.
    No runtime light or camera dependency. Not a claim of Cycles lightmap baking.
    """
    verts=[];faces=[]
    for (roof,mat),g in GROUPS.items():
        if mat in ['olive','vine','cypress','glass']:continue
        start=len(verts);verts.extend(g['v']);faces.extend(tuple(start+i for i in f) for f in g['f'])
    tree=BVHTree.FromPolygons(verts,faces,all_triangles=True)
    lamps=[Vector((x,2.65,z)) for x,z in [(-10.7,3.4),(-3.5,5),(-12,-1.8),(13.5,-4.4)]]
    count=0;cache={}
    for (roof,mat),g in GROUPS.items():
        for i,(p,n) in enumerate(zip(g['v'],g['n'])):
            if not inside(np.array(p)+np.array(n)*.04):continue
            key=tuple(round(v,4) for v in p+n)
            if key in cache:g['c'][i]=cache[key];continue
            pos=Vector(p)+Vector(n)*.012;normal=Vector(n);t=normal.cross(Vector((0,1,0)) if abs(normal.y)<.9 else Vector((1,0,0))).normalized();b=normal.cross(t)
            occ=0
            for j in range(12):
                r=math.sqrt((j+.5)/12);theta=j*2.399963
                d=(t*(r*math.cos(theta))+b*(r*math.sin(theta))+normal*math.sqrt(1-r*r)).normalized()
                hit=tree.ray_cast(pos,d,1.5)
                if hit[0] is not None:occ+=1-hit[3]/1.5
            light=0
            for lamp in lamps:
                d=lamp-pos;dist=d.length
                if dist>7:continue
                d.normalize()
                if tree.ray_cast(pos,d,max(0,dist-.05))[0] is None:light+=max(0,normal.dot(d))*1.5/(1+dist*dist*.35)
            value=min(1,.81-.24*occ/12+.19*light)
            col=[value,min(1,value*.985),min(1,value*.96),1]
            cache[key]=col;g['c'][i]=col;count+=1
    print('BAKED unique interior vertices:',count,flush=True)
    return count

def export_glb(roof,path):
    data=bytearray();views=[];access=[]
    def blob(b):
        while len(data)%4:data.append(0)
        start=len(data);data.extend(b);views.append({'buffer':0,'byteOffset':start,'byteLength':len(b)})
        return len(views)-1
    def accessor(values,dtype,typ,component,bounds=False):
        arr=np.array(values,dtype=dtype);v=blob(arr.tobytes());a={'bufferView':v,'componentType':component,'count':len(arr),'type':typ}
        if bounds:a.update(min=arr.min(axis=0).tolist(),max=arr.max(axis=0).tolist())
        access.append(a);return len(access)-1
    meshes=[];nodes=[];mats=[];used_images=set()
    for (r,mat),g in GROUPS.items():
        if r!=roof or not g['f']:continue
        m=json.loads(json.dumps(MATERIALS[mat]))
        # Match existing loader classification without enabling its optional v1 retexture table.
        m['name']={'glass':'v2_vidrio','water':'v2_agua','olive':'v2_vegetacion_olivo','vine':'v2_vegetacion_parra','cypress':'v2_vegetacion_cipres','soil':'v2_tierra','cobble':'v2_adoquin','interior_floor':'v2_suelo_interior'}.get(mat,mat)
        if roof:
            # Geometric roof tiles need no additional normal/roughness images.
            # Prevent duplicated companion images across the two independent GLBs.
            m.pop('normalTexture',None)
            m['pbrMetallicRoughness'].pop('metallicRoughnessTexture',None)
            m['pbrMetallicRoughness'].update(metallicFactor=0,roughnessFactor=.86)
        mats.append(m)
        for prop in [m.get('normalTexture'),m.get('emissiveTexture'),m['pbrMetallicRoughness'].get('baseColorTexture'),m['pbrMetallicRoughness'].get('metallicRoughnessTexture')]:
            if prop:used_images.add(prop['index'])
        attrs={key:accessor(g[k],'<f4',typ,5126,key=='POSITION') for key,k,typ in [('POSITION','v','VEC3'),('NORMAL','n','VEC3'),('TEXCOORD_0','uv','VEC2'),('COLOR_0','c','VEC4')]}
        indices=accessor(np.array(g['f']).reshape(-1),'<u4','SCALAR',5125)
        meshes.append({'name':('techo_' if roof else 'mapa_')+mat,'primitives':[{'attributes':attrs,'indices':indices,'material':len(mats)-1,'mode':4}]})
        nodes.append({'name':meshes[-1]['name'],'mesh':len(meshes)-1})
    remap={old:i for i,old in enumerate(sorted(used_images))};images=[];textures=[]
    filenames=list(IMAGES)
    for old in sorted(used_images):
        name=filenames[old];images.append({'name':name,'bufferView':blob((TEX/name).read_bytes()),'mimeType':'image/png' if name.endswith('.png') else 'image/jpeg'})
        textures.append({'sampler':0,'source':remap[old]})
    for m in mats:
        for prop in [m.get('normalTexture'),m.get('emissiveTexture'),m['pbrMetallicRoughness'].get('baseColorTexture'),m['pbrMetallicRoughness'].get('metallicRoughnessTexture')]:
            if prop:prop['index']=remap[prop['index']]
    doc={'asset':{'version':'2.0','generator':'CASA ATLAS XL v2 / Blender source / explicit glTF writer'},'scene':0,'scenes':[{'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':mats,'textures':textures,'images':images,'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'bufferViews':views,'accessors':access,'buffers':[{'byteLength':len(data)}]}
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);data+=b'\0'*((-len(data))%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(data))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(data),0x004e4942)+data)
    return {'file':path.name,'triangles':sum(len(g['f']) for (r,m),g in GROUPS.items() if r==roof),'materials':len(mats),'draw_calls':len(meshes),'textures':len(images),'bytes':path.stat().st_size}

def main():
    print('BUILD architecture',flush=True);base_geometry();architecture();vegetation_and_details()
    tris=sum(len(g['f']) for g in GROUPS.values());print('TRIANGLES',tris,flush=True)
    assert tris<=40000, 'Above 40k requires LOD; reduce tessellation or provide LOD.'
    assert len(MATERIALS)<=30 and len(IMAGES)<=25
    baked=bake_vertex_light()
    result=[export_glb(False,ROOT/'models/sd_casa_atlas_xl_v2.glb'),export_glb(True,ROOT/'models/sd_casa_atlas_xl_v2_techo.glb')]
    shutil.copyfile(V1/'collision_map.json',ROOT/'collision_map.json')
    (ROOT/'geometry_audit.json').write_text(json.dumps(RECORDS,indent=2),encoding='utf-8')
    stats={'models':result,'total_triangles':tris,'unique_materials':len(MATERIALS),'unique_textures':len(IMAGES),'baked_vertices':baked,'collision_sha256':hashlib.sha256((ROOT/'collision_map.json').read_bytes()).hexdigest(),'collision_boxes':len(BOXES),'blender':bpy.app.version_string,'status':'GENERATED; visual and browser QA pending'}
    (ROOT/'stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
    print(json.dumps(stats),flush=True)

if __name__=='__main__':main()
