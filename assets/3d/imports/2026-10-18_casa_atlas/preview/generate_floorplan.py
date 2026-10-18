from PIL import Image,ImageDraw,ImageFont
import json, pathlib
R=pathlib.Path(__file__).resolve().parents[1];mapdata=json.loads((R/'collision_map.json').read_text())
img=Image.new('RGB',(1440,1200),'#edf0ed');d=ImageDraw.Draw(img)
F='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';fb=ImageFont.truetype(F,29);fm=ImageFont.truetype(F,21);fs=ImageFont.truetype(F,17)
scale=54; cx=720; cz=595
P=lambda x,z:(round(cx+x*scale),round(cz+z*scale))
color=['#d1b693','#d8cec0','#bda68e','#c8c6b8','#bcc6c3','#d0c1af','#c2d8d2']
for i,z in enumerate(mapdata['zones']):
 x0,z0,x1,z1=z['bounds'];d.rectangle((*P(x0,z0),*P(x1,z1)),fill=color[i],outline='#97a19e',width=3)
for c in mapdata['colliders']:
 x,y,z=c['center'];a,b,t=c['size'];box=(*P(x-a/2,z-t/2),*P(x+a/2,z+t/2))
 if c['name'].startswith('wall'):d.rectangle(box,fill='#253940')
 elif c['type']=='player_boundary':d.rectangle(box,outline='#b97755',width=2)
 elif c['type']=='solid':d.rectangle(box,fill='#836c5d',outline='#5c4d3f',width=2)
for z in mapdata['zones']:
 x0,z0,x1,z1=z['bounds'];midx=(x0+x1)/2;midz=(z0+z1)/2
 d.text(P(midx,midz),z['name'],anchor='mm',font=fs,fill='#273b42',stroke_width=2,stroke_fill='#ecf0ed')
for s in mapdata['spawns']:
 x,_,z=s['position']; px,py=P(x,z);cc='#0084e3' if s['team']=='A' else '#e9792e';d.ellipse((px-23,py-23,px+23,py+23),fill=cc,outline='white',width=4);d.text((px,py),s['team'],fill='white',font=fm,anchor='mm')
d.text((90,45),'SNIPER DUEL · CASA ATLAS 1V1',font=fb,fill='#22333a')
d.text((90,91),'Plano generado a partir de las colisiones reales del mapa · 18 × 14 m',font=fm,fill='#526a70')
d.line((P(-8,6)[0], P(-8,6)[1]+80,P(-3,6)[0],P(-3,6)[1]+80),fill='#314f5a',width=8)
d.text((P(-8,6)[0],P(-8,6)[1]+90),'5 METROS',font=fs,fill='#314f5a')
img.save(R/'preview'/'plano_colisiones.png',optimize=True)
