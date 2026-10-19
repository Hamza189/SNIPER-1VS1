"""Original cloth/nylon/rubber PBR atlas. No third-party bitmaps."""
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,ImageFont
R=Path(__file__).resolve().parent.parent;OUT=R/'textures';OUT.mkdir(exist_ok=True)
palettes={
'A':[(61,66,60),(105,89,64),(111,104,83),(32,34,34),(126,115,91),(31,49,51),(72,75,71),(141,130,100)],
'B':[(48,57,54),(70,78,58),(78,86,65),(28,32,31),(90,99,76),(31,49,50),(63,70,65),(122,133,108)],
'bots':[(42,46,49),(66,72,77),(74,78,82),(25,28,31),(86,91,96),(37,48,57),(66,73,80),(135,143,149)]}
rng=np.random.default_rng(22019);yy,xx=np.indices((512,256));grain=rng.normal(0,1.2,(512,256));weave=(np.sin(xx*np.pi)*0+np.cos(xx*np.pi/2)+np.cos(yy*np.pi/2))*.8
small=rng.normal(128,22,(32,16)).clip(0,255).astype('uint8');cloud=np.asarray(Image.fromarray(small).resize((256,512),Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(6))).astype(float)-128
height=np.zeros((1024,1024),dtype=float);orm=np.zeros((1024,1024,3),dtype=np.uint8);orm[:]=[255,220,0]
for variant,colors in palettes.items():
 canvas=Image.new('RGB',(1024,1024))
 for tile,col in enumerate(colors):
  dirt=cloud*.20;edge=np.minimum.reduce([xx,255-xx,yy,511-yy]);shade=grain+weave+dirt-9*np.exp(-edge/6)
  if tile==3:shade=grain*.6+weave*.5+cloud*.1
  a=np.clip(np.array(col)[None,None,:]+shade[:,:,None],0,255).astype('uint8');im=Image.fromarray(a);d=ImageDraw.Draw(im)
  if tile in [0,1,2,4]:
   for x in [9,246]:
    d.line((x,0,x,511),fill=tuple(max(0,c-14) for c in col),width=2)
    for y in range(0,512,7):d.line((x+3,y,x+3,y+3),fill=tuple(min(255,c+23) for c in col),width=1)
   for y in [12,499]:
    d.line((0,y,255,y),fill=tuple(max(0,c-13) for c in col))
    for x in range(0,256,7):d.line((x,y+3,x+3,y+3),fill=tuple(min(255,c+19) for c in col))
  if tile==5:
   for y in range(512):
    shade=10*max(0,1-abs(y-100)/80);d.line((0,y,255,y),fill=tuple(int(c+shade) for c in col))
  if tile==7:
   d.rectangle((5,12,250,499),fill=tuple(int(c*.52) for c in col),outline=tuple(col),width=4)
   label={'A':'A','B':'B','bots':'BOT'}[variant]
   fontpath=Path('C:/Windows/Fonts/arialbd.ttf');font=ImageFont.truetype(str(fontpath),92 if len(label)==1 else 65)
   d.text((128,240),label,font=font,anchor='mm',fill=tuple(colors[7]))
   for y in [150,330]:d.line((35,y,220,y),fill=tuple(colors[7]),width=6)
  canvas.paste(im,((tile%4)*256,(tile//4)*512))
 canvas.save(OUT/f'color_{variant}.jpg',quality=96,subsampling=0)
for tile in range(8):
 x=(tile%4)*256;y=(tile//4)*512
 h=.45*np.sin(xx*np.pi/2)+.45*np.cos(yy*np.pi/2)+grain*.25
 if tile in [0,1,2,4]:h-=3*np.exp(-((xx-9)/1.3)**2)+3*np.exp(-((xx-246)/1.3)**2)
 if tile==3:h*=.3
 height[y:y+512,x:x+256]=h
 orm[y:y+512,x:x+256,1]=[226,231,228,212,197,65,143,234][tile]
 orm[y:y+512,x:x+256,2]=[0,0,0,0,0,50,170,0][tile]
dx=np.gradient(height,axis=1)*.1;dy=np.gradient(height,axis=0)*.1
n=np.stack([-dx,dy,np.ones_like(dx)],axis=2);n/=np.linalg.norm(n,axis=2)[:,:,None]
Image.fromarray(((n*.5+.5)*255).clip(0,255).astype('uint8')).save(OUT/'normal.png')
Image.fromarray(orm).save(OUT/'orm.png')
print('Revision 02: original PBR fabric atlas prepared')
