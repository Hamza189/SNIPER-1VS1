from PIL import Image,ImageEnhance
import numpy as np,os,json
p=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));t=p+'/textures'
report={}
for nm in ['plaza','cobble','sidewalk','sand','patch']:
 f=f'{t}/sd_ground_{nm}_01_basecolor.png';img=Image.open(f).convert('RGB');img=ImageEnhance.Color(img).enhance(0.42);img.save(f,compress_level=1)
 nf=f'{t}/sd_ground_{nm}_01_normal.png';n=np.asarray(Image.open(nf).convert('RGB'),dtype=np.float32)/127.5-1
 n[:,:,:2]*=.75
 n[:,:,2]=1
 n/=np.linalg.norm(n,axis=2,keepdims=True)
 Image.fromarray(np.clip((n+1)*127.5,0,255).astype('uint8')).save(nf,compress_level=1)
 a=np.asarray(img,dtype=np.int16)
 report[nm]={'mean_srgb':round(float(a.mean()),1),'mean_normal_z':round(float(n[:,:,2].mean()),4),'border_x_difference':round(float(np.abs(a[:,0]-a[:,-1]).mean()),2),'border_y_difference':round(float(np.abs(a[0]-a[-1]).mean()),2)}
open(p+'/QA_report.json','w').write(json.dumps(report,indent=2))
# refresh preview
sheet=Image.new('RGB',(1500,470),(32,33,33))
from PIL import ImageDraw
d=ImageDraw.Draw(sheet)
for i,nm in enumerate(report):
 im=Image.open(f'{t}/sd_ground_{nm}_01_basecolor.png').resize((294,294));sheet.paste(im,(i*300,0));d.text((i*300+8,310),nm.upper(),fill='white')
 im2=Image.open(f'{t}/sd_ground_{nm}_01_normal.png').resize((145,145));sheet.paste(im2,(i*300,329))
sheet.save(p+'/previews/p0_v2_materials.jpg',quality=90)
print(report)
