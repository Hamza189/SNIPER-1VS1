"""ILUMINACIÓN HORNEADA: junta lo horneado por Blender en la imagen que carga el juego.
  python3 tools/lightmap/finish.py [work] [calidad]
R = oclusión ambiental (ao.png), G = sombra del sol (sol.png), B = oclusión a 8 m (ao_lejos.png: cuánto cielo ve; el
interior de las casas). → assets/lightmaps/pueblo_lm.jpg
  · Qué texeles horneó Blender: los que caen dentro de algún triángulo (se rasterizan aquí los uv2) y no tienen el color
    de borrado (oclusión 0 y sol 1 a la vez).
  · Suavizado de 3×3 solo entre texeles horneados (quita el grano de las muestras sin mezclar con lo vacío).
  · Relleno de bordes (8 pasos): cada texel vacío junto a uno horneado toma la media de sus vecinos horneados. El
    margen de Blender no se aplicaba, y el filtrado y los mipmaps leían el vacío: líneas oscuras/verdes en los bordes.
  · Lo que sigue vacío, blanco (sin efecto); la esquina (0,0) de 4×4, blanca: ahí apuntan los vértices que no reciben."""
import sys, json, pathlib
import numpy as np
from PIL import Image, ImageDraw

here = pathlib.Path(__file__).parent
work = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / '.work'
q = int(sys.argv[2]) if len(sys.argv) > 2 else 90
cfg = json.load(open(work / 'bake.json'))
W, H = cfg['w'], cfg['h']
def load(n):
    a = np.asarray(Image.open(work / n)).astype(np.float32)
    if a.ndim == 3: a = a[:, :, 0]
    return a / (65535.0 if a.max() > 255 else 255.0)
ao, sun = load('ao.png'), load('sol.png')
far = load('ao_lejos.png') if (work / 'ao_lejos.png').exists() else ao.copy()

# coverage: rasterise every receiving triangle in uv2 space
raw = open(work / 'pueblo.bin', 'rb').read()
uvall = np.fromfile(work / 'uv2.f32', dtype=np.float32)
cov = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(cov)
for m in cfg['meshes']:
    if m['uv'] < 0: continue
    idx = np.frombuffer(raw, dtype=np.uint32, count=m['idx'], offset=m['ix'])
    uv = uvall[m['uv'] // 4: m['uv'] // 4 + m['verts'] * 2].reshape(-1, 2)
    px = np.stack([uv[:, 0] * W - 0.5, (1 - uv[:, 1]) * H - 0.5], axis=1)
    for t in range(0, len(idx), 3):
        dr.polygon([tuple(px[idx[t]]), tuple(px[idx[t + 1]]), tuple(px[idx[t + 2]])], fill=255)
valid = (np.asarray(cov) > 0) & ~((ao <= 0.0) & (sun >= 1.0) & (far <= 0.0))

def nb_sum(a):   # sum of the 3×3 neighbourhood
    p = np.pad(a, 1)
    return sum(p[1 + dy:1 + dy + a.shape[0], 1 + dx:1 + dx + a.shape[1]] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
vm = valid.astype(np.float32)
chans = []
for a in (ao, sun, far):
    a = np.where(valid, a, 0.0)
    s, n = nb_sum(a * vm), nb_sum(vm)
    a = np.where(valid, s / np.maximum(n, 1), 0.0)          # soft, only among baked texels
    m = vm.copy()
    for _ in range(8):                                      # edge fill
        s, n = nb_sum(a * m), nb_sum(m)
        grow = (m == 0) & (n > 0)
        a = np.where(grow, s / np.maximum(n, 1), a); m = np.where(grow, 1.0, m)
    chans.append(np.where(m > 0, a, 1.0))
rgb = np.stack(chans, axis=2)
w = cfg['white']
rgb[-w:, :w, :] = 1.0          # image rows run top-down: the bottom-left corner is uv (0,0)
out = pathlib.Path(here / '..' / '..' / 'assets' / 'lightmaps' / 'pueblo_lm.jpg').resolve()
Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').save(out, quality=q, optimize=True, subsampling=0)
print('->', out, round(out.stat().st_size / 1024), 'KB · horneados', int(valid.sum()), 'texeles (' + str(round(100 * valid.mean())) + ' %)',
      '· oclusión media', round(float(chans[0][valid].mean()), 3), '· sol medio', round(float(chans[1][valid].mean()), 3), '· cielo medio', round(float(chans[2][valid].mean()), 3))
