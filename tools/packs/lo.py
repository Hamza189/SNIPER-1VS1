"""PAQUETES DE TEXTURAS (tools/packs/make.js): la versión pequeña de cada textura (lado ≤ 256 px, JPG calidad 82) en
assets/tex/lo/, y su imagen volteada en vertical en PNG (fuente para el KTX2, que se carga sin voltear).
  python3 tools/packs/lo.py <lista.json> <work>"""
import sys, json, pathlib
from PIL import Image
root = pathlib.Path(__file__).resolve().parents[2]
names = json.load(open(sys.argv[1]))
work = pathlib.Path(sys.argv[2])
lo = root / 'assets' / 'tex' / 'lo'; lo.mkdir(parents=True, exist_ok=True)
dims = {}
for k in names:
    im = Image.open(root / 'assets' / 'tex' / (k + '.jpg')).convert('RGB')
    dims[k] = im.size
    w, h = im.size; s = min(1.0, 256 / max(w, h))
    small = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS) if s < 1 else im
    small.save(lo / (k + '.jpg'), quality=82, optimize=True)
    im.transpose(Image.FLIP_TOP_BOTTOM).save(work / (k + '_flip.png'))
json.dump(dims, open(work / 'dims.json', 'w'))
print('pequeñas:', len(names), '→', lo)
