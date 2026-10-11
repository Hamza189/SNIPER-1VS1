import numpy as np, math, os, json, zipfile
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter
import trimesh
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T=os.path.join(ROOT,'textures'); M=os.path.join(ROOT,'models'); P=os.path.join(ROOT,'previews')
for x in [T,M,P]:os.makedirs(x,exist_ok=True)
rng=np.random.default_rng(26012); N=1024
Y,X=np.mgrid[:N,:N]; xx=X/N; yy=Y/N

def tile_noise(n=1024, rough=1.0):
    a=np.zeros((n,n),dtype=np.float32); wsum=0
    for size,weight in [(8,1.0),(16,.7),(32,.48),(64,.34),(128,.23),(256,.15),(512,.09),(1024,.045)]:
        coarse=rng.normal(size=(size,size)).astype(np.float32)
        # seamless through wrap filtering and periodic spline
        from scipy.ndimage import zoom
        # upsample using periodic Fourier interpolation: smooth noise at scale n/size
        expanded=np.tile(coarse,(math.ceil(n/size),math.ceil(n/size)))[:n,:n]
        f=gaussian_filter(expanded,sigma=max(0.4,n/size/2.7),mode='wrap')
        sd=f.std() or 1
        a+=f/sd*weight;wsum+=weight
    return np.clip(a/wsum,-2.5,2.5)
# more efficient periodic noise through gaussian-filter on sampled full resolution

def noise():
    # periodic multi-frequency noise via fast cyclic bilinear interpolation
    a=np.zeros((N,N),np.float32);norm=0
    for size,weight in [(5,1.0),(12,.67),(27,.4),(64,.21),(200,.11)]:
        coarse=rng.standard_normal((size,size)).astype(np.float32)
        ix=np.arange(N)*size/N
        base=np.floor(ix).astype(int); frac=(ix-base).astype(np.float32)
        v0=coarse[base%size,:];v1=coarse[(base+1)%size,:]
        v=v0*(1-frac[:,None])+v1*frac[:,None]
        v0=v[:,base%size];v1=v[:,(base+1)%size]
        layer=v0*(1-frac[None,:])+v1*frac[None,:]
        layer/=max(layer.std(),1e-6)
        a+=layer*weight;norm+=weight
    return a/norm

def mask_mortar(type):
    # produce periodic stone grout masks, pattern repeat exact at edges
    if type=='plaza':
        cols,rows=7,7
        u=(xx*cols + .05*np.sin(yy*19))%1; v=(yy*rows+.04*np.sin(xx*14))%1
        m=np.minimum.reduce([u,1-u,v,1-v]); return np.clip((m-.027)/.018,0,1)
    if type=='sidewalk':
        cols,rows=5,5; u=(xx*cols)%1;v=(yy*rows+.005*np.sin(xx*27))%1
        m=np.minimum.reduce([u,1-u,v,1-v]);return np.clip((m-.018)/.02,0,1)
    if type=='cobble':
        rows=16; row=np.floor(yy*rows).astype(int); shift=(row%2)*.5
        # 16 full stones across; stagger row; jitter edges
        u=((xx*16+shift+.05*np.sin(yy*72+xx*21)))%1
        v=((yy*rows+.028*np.sin(xx*95+yy*27)))%1
        m=np.minimum.reduce([u,1-u,v,1-v]);return np.clip((m-.075)/.055,0,1)
    if type=='patch':
        cols,rows=5,8;row=np.floor(yy*rows).astype(int);u=(xx*cols+(row%2)*.4+.04*np.sin(yy*23))%1
        v=(yy*rows+.05*np.sin(xx*35))%1
        m=np.minimum.reduce([u,1-u,v,1-v]);return np.clip((m-.025)/.026,0,1)
    return np.ones((N,N),np.float32)

n1=noise(); n2=noise();n3=noise();
# Normalize brightness carefully in sRGB; each px color tonality
params={
 'plaza': {'base':(177,164,143),'tiles':True,'repeat':2.0,'rough':.83,'normal':2.2,'m':.48},
 'cobble': {'base':(156,153,143),'tiles':True,'repeat':2.0,'rough':.87,'normal':3.1,'m':.6},
 'sidewalk':{'base':(181,174,160),'tiles':True,'repeat':1.5,'rough':.77,'normal':1.8,'m':.30},
 'sand': {'base':(172,153,121),'tiles':False,'repeat':3.0,'rough':.94,'normal':1.4,'m':.58},
 'patch':{'base':(158,150,138),'tiles':True,'repeat':2.0,'rough':.89,'normal':2.3,'m':.62},
}
outputs=[];metrics={}
for name,q in params.items():
    mask=mask_mortar(name)
    # smooth stepped stone profile and micro pitting
    h=(n1*.5+n2*.21+n3*.1 + (mask-.5)*q['m'])*.18
    if name=='sand': h=(n1*.25+n2*.18+n3*.06)*.23
    # subtle color variation with periodic large shading avoiding single unique landmark
    base=np.array(q['base'],np.float32)
    color=np.stack([base[i] + n1*8.5+n2*5.5+n3*2.6 + ((mask-1)*11 if name!='sand' else 0) + ((i-1)*n1*1.8) for i in range(3)],axis=-1)
    if name=='sand': color+= np.clip(n3[...,None]*3,-7,7)
    color=np.clip(color,45,226).astype('uint8')
    rough=np.clip((q['rough'] + n1*.035+n2*.025+(1-mask)*.027)*255,0,255).astype('uint8')
    # OpenGL +Y normals: gradient in world plane normal tangent convention
    gx=(np.roll(h,-1,axis=1)-np.roll(h,1,axis=1))*0.5*q['normal']
    gy=(np.roll(h,-1,axis=0)-np.roll(h,1,axis=0))*0.5*q['normal']
    normal=np.stack([-gx,-gy,np.ones_like(h)],axis=-1)
    normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    nrgb=np.clip(normal*127.5+127.5,0,255).astype('uint8')
    # normals on glTF use convention +Y green. Images use channels RGB here.
    for suffix,image in [('basecolor',color),('normal',nrgb),('roughness',rough)]:
        filename=f'sd_ground_{name}_01_{suffix}.png'
        Image.fromarray(image).save(os.path.join(T,filename),optimize=True)
        outputs.append(filename)
    metrics[name]={'repeat_m':q['repeat'],'mean_srgb':color.mean(axis=(0,1)).round(1).tolist(),'max_channel_gt_220_percent':float((color>220).mean()*100)}
# Decal atlas RGBA 4x4; 16px transparency per cell (visual border alpha=0)
A=Image.new('RGBA',(1024,1024),(0,0,0,0));d=ImageDraw.Draw(A,'RGBA')
labels=['crack_thin','crack_medium','dirt_patch','wet_mark','sand_scatter','wheel_mark','edge_grime','pavement_chips','manhole_round','drain_grate','service_cover','stone_break','dust_specks','crack_branch','stain_spots','grit_cluster']
for idx,label in enumerate(labels):
    col=idx%4;row=idx//4; ox=col*256; oy=row*256
    def pos(x,y):return (int(ox+x),int(oy+y))
    if 'crack' in label:
        x,y=25+rng.integers(0,30),80+rng.integers(0,80); points=[]
        for j in range(12):
            x+=rng.integers(12,18);y+=rng.integers(-23,24);y=max(24,min(229,y));points.append(pos(x,y))
        d.line(points,fill=(53,47,39,205),width=2 if idx==0 else 4,joint='curve')
        if idx==13:
            d.line([points[4],pos(150,50),pos(192,45)],fill=(64,51,40,170),width=2)
    elif label in ['manhole_round','service_cover']:
        cx,cy=128,128;rad=78 if label=='manhole_round' else 71
        if label=='manhole_round':
            d.ellipse((ox+cx-rad,oy+cy-rad,ox+cx+rad,oy+cy+rad),fill=(72,73,70,250),outline=(28,31,31,255),width=5)
            for t in range(0,360,30):
                a=math.radians(t);x=cx+math.cos(a)*53;y=cy+math.sin(a)*53
                d.ellipse((ox+x-3,oy+y-3,ox+x+3,oy+y+3),fill=(150,145,132,235))
            for j in range(5):d.arc((ox+65+j*9,oy+76,ox+175-j*9,oy+179),10,170,fill=(35,39,38,210),width=2)
        else:
            d.rounded_rectangle((ox+49,oy+57,ox+206,oy+198),radius=8,fill=(86,90,87,240),outline=(31,34,33,255),width=5)
            d.rectangle((ox+65,oy+73,ox+190,oy+181),outline=(37,40,40,220),width=3)
    elif label=='drain_grate':
        d.rounded_rectangle((ox+30,oy+60,ox+225,oy+189),radius=6,fill=(65,72,74,245),outline=(24,27,30,255),width=5)
        for x in range(47,219,21):d.rounded_rectangle((ox+x,oy+72,ox+x+8,oy+177),radius=3,fill=(18,24,25,252))
    elif label=='wheel_mark':
        for k in [87,151]:
            for j in range(35,222,7):
                off=5*math.sin(j/40);d.line([pos(k+off,j),pos(k+off+5,j+4)],fill=(71,60,50,100),width=6)
    else:
        hues={'dirt_patch':(88,76,60),'wet_mark':(64,62,57),'sand_scatter':(154,130,92),'edge_grime':(83,75,60),'pavement_chips':(122,112,97),'stone_break':(83,77,69),'dust_specks':(149,130,105),'stain_spots':(75,70,64),'grit_cluster':(124,113,89)}
        rgb=hues.get(label,(105,93,76))
        count=180 if label in ['dust_specks','sand_scatter','grit_cluster'] else 75
        for i in range(count):
            x=float(rng.normal(128,42));y=float(rng.normal(128,40))
            r=float(rng.uniform(1,6 if count>100 else 13))
            if 17+r <x<239-r and 17+r<y<239-r:
                alpha=int(rng.integers(30,130 if 'wet' not in label else 100))
                d.ellipse((ox+x-r,oy+y-r,ox+x+r,oy+y+r),fill=(*rgb,alpha))
A.save(os.path.join(T,'sd_ground_decal_atlas_01.png'),optimize=True)
# transition 1024x256, wrap on +X and -X: periodic noise, one-meter across Y.
w,h=1024,256
nr=np.tile(gaussian_filter(rng.standard_normal((w,)).astype(np.float32),sigma=13,mode='wrap'),(h,1));nr/=max(nr.std(),.001)
ys=np.arange(h)[:,None]/(h-1)
threshold=.58+.055*nr[0][None,:]+.014*np.sin(np.arange(w)[None,:]*2*np.pi*8/w)
coverage=np.clip((ys-threshold)*90+0.5,0,1)
# sharp-ish alpha transition anti-aliased a few pixels
alpha=(coverage*255).astype(np.uint8)
base=np.ones((h,w,3),np.uint8)*np.array([166,145,110],np.uint8)
base+=(np.clip(nr[:,:,None]*4,-10,10)).astype(np.int16).astype(np.uint8) if False else np.zeros_like(base)
rgba=np.dstack([base,alpha]);Image.fromarray(rgba).save(os.path.join(T,'sd_ground_transition_sand_stone_01.png'))
# Curb meshes. Named GLB nodes shared each piece dimensions and placement at origin for instancing.
scene=trimesh.Scene()
def add_mesh(name, boxes, color=(148,142,132,255)):
    parts=[]
    for extents,center in boxes:
        b=trimesh.creation.box(extents=extents);b.apply_translation(center);parts.append(b)
    mesh=trimesh.util.concatenate(parts)
    mesh.visual.vertex_colors=np.tile(np.array(color,dtype=np.uint8),(len(mesh.vertices),1))
    scene.add_geometry(mesh,geom_name=name,node_name=name)
    return int(len(mesh.faces))
# Street towards +Z. curb back -Z. 0.09 m height; pivot ground at left end.
shapes={}
def add(name,bs,color=(155,151,142,255)):shapes[name]=add_mesh(name,bs,color)
add('sd_curb_straight_1m_LOD0',[((1,.09,.2),(.5,.045,-.1)),((1,.012,.045),(.5,.092,-.175))])
add('sd_curb_straight_2m_LOD0',[((2,.09,.2),(1,.045,-.1)),((2,.012,.045),(1,.092,-.175))])
add('sd_curb_corner_outer_90_LOD0',[((1,.09,.2),(.5,.045,-.1)),((.2,.09,1),(.1,.045,-.5))])
add('sd_curb_corner_inner_90_LOD0',[((1,.09,.2),(.5,.045,-.1)),((.2,.09,1),(.9,.045,-.5))])
add('sd_curb_endcap_LOD0',[((.24,.09,.2),(.12,.045,-.1))])
add('sd_curb_drain_insert_LOD0',[((1,.09,.20),(.5,.045,-.1)),((.48,.009,.11),(.5,.095,-.09))],(114,118,114,255))
add('sd_curb_threshold_low_LOD0',[((1,.07,.3),(.5,.035,-.15))])
# ramp wedge is true taper along +X (verts x=0 high and x=1 low), flat underside
verts=np.array([[0,0,-.2],[0,0,0],[0,.09,-.2],[0,.09,0],[1,0,-.2],[1,0,0]],float)
faces=np.array([[0,1,3],[0,3,2],[0,4,5],[0,5,1],[2,3,5],[2,5,4],[0,2,4],[1,5,3]])
mesh=trimesh.Trimesh(vertices=verts,faces=faces,process=True);mesh.visual.vertex_colors=np.tile([155,151,142,255],(len(mesh.vertices),1));scene.add_geometry(mesh,geom_name='sd_curb_ramp_1m_LOD0',node_name='sd_curb_ramp_1m_LOD0');shapes['sd_curb_ramp_1m_LOD0']=len(mesh.faces)
# LOD1: fewer features
for name,length in [('sd_curb_straight_1m',1),('sd_curb_straight_2m',2)]:add(name+'_LOD1',[((length,.09,.2),(length/2,.045,-.1))])
for name in ['sd_curb_corner_outer_90','sd_curb_corner_inner_90','sd_curb_endcap','sd_curb_drain_insert','sd_curb_threshold_low']:
    b={'sd_curb_corner_outer_90':[((1,.09,.2),(.5,.045,-.1)),((.2,.09,1),(.1,.045,-.5))], 'sd_curb_corner_inner_90':[((1,.09,.2),(.5,.045,-.1)),((.2,.09,1),(.9,.045,-.5))],'sd_curb_endcap':[((.24,.09,.2),(.12,.045,-.1))],'sd_curb_drain_insert':[((1,.09,.2),(.5,.045,-.1))],'sd_curb_threshold_low':[((1,.07,.3),(.5,.035,-.15))]}[name]
    add(name+'_LOD1',b)
mesh2=mesh.copy();scene.add_geometry(mesh2,geom_name='sd_curb_ramp_1m_LOD1',node_name='sd_curb_ramp_1m_LOD1');shapes['sd_curb_ramp_1m_LOD1']=len(mesh2.faces)
glb=scene.export(file_type='glb');open(os.path.join(M,'sd_ground_curb_kit_01.glb'),'wb').write(glb)
# contact sheet previews
sizes=(420,420);sheet=Image.new('RGB',(420*5,525),'#24282c');dr=ImageDraw.Draw(sheet)
for i,nm in enumerate(params):
    im=Image.open(os.path.join(T,f'sd_ground_{nm}_01_basecolor.png')).convert('RGB').resize((420,420))
    sheet.paste(im,(i*420,0));dr.text((i*420+15,443),f'{nm.upper()} | repeticion {params[nm]["repeat"]} m',fill='white')
sheet.save(os.path.join(P,'p0_ground_materials_preview.jpg'),quality=91)
# per-tile seamless border test color at opposite edges, heights period math approx
stats={n:{'repeat_m':p['repeat'], **metrics[n]} for n,p in params.items()}
manifest={'pack':'SNIPER DUEL P0 Ground Pack','version':'1.0-alpha','texture_resolution':[1024,1024],'surfaces':stats,'glb_nodes':shapes,'decal_atlas_cells':{lab:[idx%4,idx//4] for idx,lab in enumerate(labels)},'decal_alpha_margin_px':16,'transition_strip_m':1,'curb_height_m':.09,'notes':['Uncompressed PNG originals: Claude will downsample per quality profile.','No scene ground replacement without Claude approval.','Each curb mesh is a separate named scene node.','Texture UV mapping and scene placement are Claude responsibilities.']}
with open(os.path.join(ROOT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2,ensure_ascii=False)
print('done',os.path.getsize(os.path.join(M,'sd_ground_curb_kit_01.glb')),'bytes GLB')
