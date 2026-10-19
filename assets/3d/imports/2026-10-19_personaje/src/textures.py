"""Original deterministic woven-fabric atlas; no downloaded or third-party art."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'textures'; OUT.mkdir(exist_ok=True)
rng=np.random.default_rng(1989)
# 4x2 tiles: uniform, carrier, straps, rubber, helmet, goggles, metal, accents.
palettes={
 'A':[(139,116,77),(99,80,49),(68,60,46),(36,35,30),(123,109,78),(29,46,49),(72,73,65),(179,151,96)],
 'B':[(69,81,62),(49,61,45),(37,43,36),(28,30,28),(75,85,65),(27,43,49),(64,70,65),(133,140,107)],
 'bots':[(75,78,80),(48,51,54),(35,37,39),(24,26,28),(64,68,71),(34,46,50),(73,78,81),(139,146,150)]}
noise=rng.normal(0,2,(512,256))
for name,colors in palettes.items():
 canvas=Image.new('RGB',(1024,1024))
 for tile,col in enumerate(colors):
  yy,xx=np.indices((512,256)); weave=((xx%4==0)*1.7-(yy%4==0)*1.3)
  a=np.clip(np.array(col)[None,None,:]+(noise+weave)[...,None],0,255).astype('uint8')
  im=Image.fromarray(a); d=ImageDraw.Draw(im)
  if tile in [0,4]:
   rr=np.random.default_rng(41+tile)
   for i in range(72):
    x=int(rr.integers(-20,256));y=int(rr.integers(-20,512));w=int(rr.integers(9,39));h=int(rr.integers(6,27))
    shade=(-15,11,-8)[i%3];c=tuple(max(0,min(255,v+shade)) for v in col)
    d.polygon([(x,y),(x+w,y+4),(x+w-6,y+h),(x+5,y+h+6)],fill=c)
  if tile in [0,1,2,4]:
   for x in (6,249):
    d.line((x,0,x,511),fill=tuple(max(0,c-18) for c in col),width=2)
    for y in range(0,512,6): d.line((x+2,y,x+2,y+2),fill=tuple(min(255,c+16) for c in col))
  if tile==3:
   for y in range(0,512,24):d.line((0,y,255,y+10),fill=(18,20,20),width=5)
  if tile==5:
   d.rectangle((4,14,251,27),fill=(75,97,98));d.line((6,35,245,35),fill=(105,121,119),width=2)
  canvas.paste(im,((tile%4)*256,(tile//4)*512))
 canvas.save(OUT/f'color_{name}.jpg',quality=94,subsampling=0)
# glTF UV v=0 at bottom of the bitmap as used by this authoring script.
normal=np.zeros((1024,1024,3),dtype=np.uint8); normal[:]=[128,128,255]
orm=np.zeros_like(normal);orm[:]=[255,218,0]
for tile in range(8):
 x=(tile%4)*256;y=(tile//4)*512
 yy,xx=np.indices((512,256))
 normal[y:y+512,x:x+256,0]=128+np.round(3*np.sin(xx*np.pi/2)).astype('int16')
 normal[y:y+512,x:x+256,1]=128+np.round(3*np.cos(yy*np.pi/2)).astype('int16')
 orm[y:y+512,x:x+256,1]=[224,229,231,218,205,72,154,216][tile]
 orm[y:y+512,x:x+256,2]=[0,0,0,0,0,70,180,0][tile]
Image.fromarray(normal).save(OUT/'normal.png')
Image.fromarray(orm).save(OUT/'orm.png')
print('Five original 1024x1024 textures created.')
