"""Prepare approved local CC0 sources. Run with system Python + Pillow/numpy.
All writes are relative to this delivery; no downloads or global installations.
"""
from pathlib import Path
import json, hashlib, random, math, urllib.request
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
IMPORTS = ROOT.parent
OUT = ROOT / 'textures'
OUT.mkdir(exist_ok=True)
SOURCES = IMPORTS / '2026-10-17_p1_polyhaven'
META = []

def save(im, name, size):
    im = im.resize((size,size), Image.Resampling.LANCZOS)
    path = OUT / name
    im.save(path, quality=93, subsampling=0) if path.suffix=='.jpg' else im.save(path)
    return name

for key, asset, repeat in [
    ('stucco','white_stucco_02',1.8),
    ('stone','sandstone_blocks_04',2.0),
    ('tile','clay_roof_tiles_02',1.5),
    ('paint','distressed_painted_planks',1.5),
    ('wood','rough_pine_door',2.0),
]:
    src = SOURCES / asset
    info = json.loads((src/'info.json').read_text(encoding='utf-8'))
    color=Image.open(src/'color.jpg').convert('RGB')
    save(color,key+'_color.jpg',1024 if key in ('stucco','wood') else 512)
    if key not in ('paint','tile'):save(Image.open(src/'normal.jpg').convert('RGB'),key+'_normal.jpg',512)
    rough=np.array(Image.open(src/'rugosidad.png').convert('L').resize((512,512),Image.Resampling.LANCZOS))
    orm=np.zeros((512,512,3),dtype=np.uint8);orm[:,:,0]=255;orm[:,:,1]=rough
    if key not in ('paint','tile'):save(Image.fromarray(orm),key+'_orm.jpg',512)
    META.append(dict(key=key,asset=asset,url=info['pagina'],license='CC0-1.0',authors=info.get('autores',[]),repeat_m=repeat,
        source_sha256=hashlib.sha256((src/'color.jpg').read_bytes()).hexdigest()))

# Cobblestone: approved photographic source already present in the repository.
src=IMPORTS/'2026-10-12_cobble_cc0_polyhaven'/'cobblestone_02_diff_4k.jpg'
save(Image.open(src).convert('RGB'),'cobble_color.jpg',1024)
META.append(dict(key='cobble',asset='cobblestone_02',url='https://polyhaven.com/a/cobblestone_02',license='CC0-1.0',repeat_m=2.0,
    source_sha256=hashlib.sha256(src.read_bytes()).hexdigest(),note='Albedo scan; constant roughness, no invented normal.'))

# Warm limewash and terracotta use the scanned relief, with documented color grading.
stu=np.array(Image.open(OUT/'stucco_color.jpg'),dtype=float)
save(Image.fromarray(np.uint8(np.clip(stu*np.array([1.0,.87,.72]),0,255))),'ochre_color.jpg',512)
stone=np.array(Image.open(OUT/'stone_color.jpg'),dtype=float)
save(Image.fromarray(np.uint8(np.clip(stone*np.array([1.03,.64,.40]),0,255))),'terracotta_color.jpg',512)

# Additional approved-provider CC0 scans. Cache source bytes in this delivery.
cache=ROOT/'sources';cache.mkdir(exist_ok=True)
def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'SNIPER-DUEL-asset-preparation/2.0'}),timeout=60).read()
for asset,key,channel in [('terracotta_floor_tiles','terracotta','Diffuse'),('dry_ground_01','soil','Diffuse'),('fabric_pattern_07','linen','col_1'),('bark_brown_02','bark','Diffuse')]:
    meta=cache/(asset+'_files.json');infofile=cache/(asset+'_info.json')
    if not meta.exists():meta.write_bytes(fetch('https://api.polyhaven.com/files/'+asset))
    if not infofile.exists():infofile.write_bytes(fetch('https://api.polyhaven.com/info/'+asset))
    files=json.loads(meta.read_bytes());info=json.loads(infofile.read_bytes());downloaded=[]
    channels=[(channel,'color',1024 if key=='terracotta' else 512)]
    if key=='terracotta':channels += [('nor_gl','normal',512),('Rough','orm',512)]
    for ch,role,size in channels:
        source=files[ch]['1k']['jpg'];dest=cache/(asset+'_'+ch+'.jpg')
        if not dest.exists():dest.write_bytes(fetch(source['url']))
        assert hashlib.md5(dest.read_bytes()).hexdigest()==source['md5']
        im=Image.open(dest).convert('RGB')
        if key=='linen':
            # Neutral sage upholstery derived from the CC0 woven scan, not a factor tint.
            lum=np.array(im.convert('L'),dtype=float)/255
            shaded=(.72+.28*lum)[:,:,None]*np.array([160,170,146])[None,None,:]
            im=Image.fromarray(np.uint8(shaded))
        if role=='orm':
            a=np.array(im.convert('L').resize((512,512),Image.Resampling.LANCZOS));out=np.zeros((512,512,3),dtype=np.uint8);out[:,:,0]=255;out[:,:,1]=a;im=Image.fromarray(out)
        save(im,key+'_'+role+'.jpg',size);downloaded.append({'url':source['url'],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
    META.append(dict(key=key,asset=asset,url='https://polyhaven.com/a/'+asset,license='CC0-1.0',authors=list(info.get('authors',{})),repeat_m=(info.get('dimensions') or [2000])[0]/1000,sources=downloaded,adaptation='Neutral sage color grading' if key=='linen' else 'Resize / JPEG / roughness packing'))

# Tiny palette: flat manufactured surfaces, no fake scanned provenance.
swatches=[(62,69,67),(220,210,184),(76,116,102),(142,160,145),(166,94,62),(101,81,56),(60,112,119),(245,209,134)]
palette=Image.new('RGB',(128,16));d=ImageDraw.Draw(palette)
for i,c in enumerate(swatches):d.rectangle((i*16,0,i*16+15,15),fill=c)
palette.save(OUT/'palette.jpg',quality=100,subsampling=0)
Image.new('RGBA',(16,16),(137,177,180,45)).save(OUT/'glass.png')

# Original botanical atlas with transparent background; not a Poly Haven scan.
# Upper half: thin olive leaves/branches. Lower half: vine and bougainvillea.
r=random.Random(11019);im=Image.new('RGBA',(512,512),(0,0,0,0));dr=ImageDraw.Draw(im)
for row in range(2):
    for k in range(15):
        x=r.randint(25,485); y=r.randint(25,225)+row*256
        dx=r.randint(-65,65);dy=r.randint(30,70)
        dr.line((x,y,x+dx,y+dy),fill=(104,92,58,255),width=2)
        for j in range(7):
            t=j/7;px=x+dx*t;py=y+dy*t
            for sign in [-1,1]:
                ang=math.atan2(dy,dx)+sign*.8
                length=r.uniform(13,24);width=3 if row==0 else 8
                ex=px+math.cos(ang)*length;ey=py+math.sin(ang)*length
                mx=(px+ex)/2;my=(py+ey)/2
                col=r.choice([(92,117,69,255),(120,139,90,255),(64,90,49,255),(149,158,112,255)])
                dr.polygon([(px,py),(mx-math.sin(ang)*width,my+math.cos(ang)*width),(ex,ey),(mx+math.sin(ang)*width,my-math.cos(ang)*width)],fill=col)
                if row and r.random()<.4:
                    for a in range(3):
                        ox=math.cos(a*2.1)*6;oy=math.sin(a*2.1)*6
                        dr.ellipse((ex+ox-5,ey+oy-4,ex+ox+5,ey+oy+4),fill=r.choice([(190,50,104,255),(222,77,143,255),(155,35,82,255)]))
# Reserve the lower-right quarter for cypress needle sprays, keeping one atlas.
dr.rectangle((256,256,511,511),fill=(0,0,0,0))
for k in range(26):
    x=r.randint(265,500);y=r.randint(265,480)
    dr.line((x,y,x+5,y+30),fill=(75,78,40,255),width=2)
    for j in range(7):
        yy=y+j*4;col=r.choice([(42,70,40,255),(71,96,51,255),(93,112,65,255)])
        dr.line((x-9,yy+8,x+2,yy,x+12,yy+7),fill=col,width=3)
im.save(OUT/'botanical.png')
# Remove only these superseded, generated files inside this delivery.
for name in ['paint_normal.jpg','paint_orm.jpg','tile_normal.jpg','tile_orm.jpg']:
    (OUT/name).unlink(missing_ok=True)
(ROOT/'texture_sources.json').write_text(json.dumps(META,indent=2,ensure_ascii=False),encoding='utf-8')
print('Prepared',len(list(OUT.iterdir())),'images')
