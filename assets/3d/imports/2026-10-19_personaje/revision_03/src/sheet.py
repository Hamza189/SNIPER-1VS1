"""Hoja de contactos de capturas: python sheet.py carpeta salida.jpg [columnas] [ancho]"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

d = Path(sys.argv[1])
files = sorted(d.glob('*.png'), key=lambda f: f.stat().st_mtime)
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5
w = int(sys.argv[4]) if len(sys.argv) > 4 else 300
ims = []
for f in files:
    im = Image.open(f).convert('RGB')
    h = int(im.height * w / im.width)
    im = im.resize((w, h), Image.LANCZOS)
    ImageDraw.Draw(im).text((4, 4), f.stem[:40], fill=(255, 255, 0))
    ims.append(im)
h = max(i.height for i in ims)
rows = (len(ims) + cols - 1) // cols
out = Image.new('RGB', (cols * w, rows * h), (30, 30, 30))
for k, im in enumerate(ims):
    out.paste(im, ((k % cols) * w, (k // cols) * h))
out.save(sys.argv[2], quality=88)
