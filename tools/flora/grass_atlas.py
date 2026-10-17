"""Grass card atlas (from tools/flora/grass_cards.py renders): 4 clumps (b–e) in columns, green (top row) / dry (bottom row),
   colour dilated under the transparent texels (no dark fringes in the small mipmaps). 1024×512 (ALTO) and 512×256.
   Also writes the base of each clump (lowest opaque row, as a fraction of the card) into assets/3d/flora/grass_cards.json."""
import sys, os, json, numpy as np
from PIL import Image, ImageFilter
SRC, TEX, J = sys.argv[1], 'assets/tex', 'assets/3d/flora/grass_cards.json'
info = json.load(open(os.path.join(SRC, 'cards.json')))
def dilate(rgba):
    c = rgba[..., :3].astype(np.float32); a = rgba[..., 3:4].astype(np.float32) / 255; m = (a > 0.02).astype(np.float32)
    for r in (2, 6, 18, 48):
        acc = np.asarray(Image.fromarray((c * m).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32)
        ww = np.asarray(Image.fromarray((m[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32)[..., None] / 255
        fill = acc / np.maximum(ww, 1e-3); c = c * m + fill * (1 - m); m = np.maximum(m, (ww > 0.01).astype(np.float32))
    return np.dstack([np.clip(c, 0, 255).astype(np.uint8), rgba[..., 3]])
atlas = np.zeros((1024, 2048, 4), np.uint8); out = {}
for i, v in enumerate('bcde'):
    for row, k in enumerate(['verde', 'seca']):
        im = np.asarray(Image.open(os.path.join(SRC, f'{v}_{k}.png')).convert('RGBA').resize((512, 512), Image.LANCZOS))
        atlas[row * 512:(row + 1) * 512, i * 512:(i + 1) * 512] = dilate(im)
    a = np.asarray(Image.open(os.path.join(SRC, f'{v}_seca.png')).convert('RGBA'))[..., 3]
    rows = np.nonzero(a.max(1) > 40)[0]
    out[v] = {'size': info[v]['w'], 'base': round(1 - (rows.max() + 1) / a.shape[0], 4), 'col': i}
for size, name in ((1024, 'flora_grasscards_1024.png'), (512, 'flora_grasscards_512.png')):
    Image.fromarray(atlas).resize((size, size // 2), Image.LANCZOS).save(os.path.join(TEX, name), optimize=True)
    print(name, os.path.getsize(os.path.join(TEX, name)) // 1024, 'KB')
json.dump(out, open(J, 'w'), indent=1); print(json.dumps(out))
