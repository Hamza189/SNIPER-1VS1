"""Foliage texture (Poly Haven dandelion_01, CC0): colour + alpha in one PNG, 1024 (ALTO) and 512. (The grass uses the card
   atlas of grass_atlas.py.)
   The colour under transparent texels is dilated so mipmaps do not bleed black edges into the leaves."""
import sys, os, numpy as np
from PIL import Image, ImageFilter
S, OUT = sys.argv[1], sys.argv[2]
def rgba(col, alpha, name):
    c = Image.open(col).convert('RGB'); a = Image.open(alpha).convert('L').resize(c.size, Image.LANCZOS)
    for size in (1024, 512):
        cc = c.resize((size, size), Image.LANCZOS); aa = a.resize((size, size), Image.LANCZOS)
        # dilate: blur the colour of opaque texels outwards (3 passes) and keep the original where opaque
        ca = np.asarray(cc, np.float32); m = (np.asarray(aa, np.float32) / 255)[..., None]; acc, w = ca * m, m.copy()
        for r in (4, 12, 32):
            acc = np.asarray(Image.fromarray((ca * m).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32) + acc * 0
            ww = np.asarray(Image.fromarray((m[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32)[..., None] / 255
            fill = acc / np.maximum(ww, 1e-3); ca = ca * m + fill * (1 - m); m = np.maximum(m, (ww > 0.02).astype(np.float32))
        out = np.dstack([np.clip(ca, 0, 255).astype(np.uint8), np.asarray(aa)])
        Image.fromarray(out, 'RGBA').save(os.path.join(OUT, f'{name}_{size}.png'), optimize=True)
        print(name, size, os.path.getsize(os.path.join(OUT, f'{name}_{size}.png')) // 1024, 'KB')
D = os.path.join(S, 'dandelion_01/textures/'); G = os.path.join(S, 'grass_medium_02/textures/')
rgba(D + 'dandelion_01_diff_4k.jpg', D + 'dandelion_01_alpha_4k.png', 'flora_dandelion')
