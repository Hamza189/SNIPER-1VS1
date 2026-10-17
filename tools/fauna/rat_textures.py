"""street_rat textures for the game from Poly Haven's 4K originals (not kept in the repo: https://polyhaven.com/a/street_rat, CC0).
   python3 tools/fauna/rat_textures.py <folder with street_rat_diff_4k.jpg, street_rat_nor_gl_4k.exr, street_rat_rough_4k.exr>
   → assets/tex/rat_c.jpg (1024, sRGB) · rat_n.jpg (512, OpenGL normal, data) · rat_r.jpg (512, roughness, data). Needs OpenEXR."""
import sys, os, numpy as np, OpenEXR
from PIL import Image
D = sys.argv[1]; OUT = 'assets/tex'
def exr(f):
    with OpenEXR.File(os.path.join(D, f)) as e:
        ch = e.channels(); k = 'RGB' if 'RGB' in ch else list(ch)[0]; return np.asarray(ch[k].pixels, dtype=np.float32)
Image.open(os.path.join(D, 'street_rat_diff_4k.jpg')).convert('RGB').resize((1024, 1024), Image.LANCZOS).save(f'{OUT}/rat_c.jpg', quality=90)
n = exr('street_rat_nor_gl_4k.exr'); n = n[:, :, :3] if n.ndim == 3 else np.dstack([n] * 3)
Image.fromarray((np.clip(n, 0, 1) * 255 + 0.5).astype(np.uint8)).resize((512, 512), Image.LANCZOS).save(f'{OUT}/rat_n.jpg', quality=92)
r = exr('street_rat_rough_4k.exr'); r = r if r.ndim == 2 else r[:, :, 0]
Image.fromarray((np.clip(r, 0, 1) * 255 + 0.5).astype(np.uint8)).convert('RGB').resize((512, 512), Image.LANCZOS).save(f'{OUT}/rat_r.jpg', quality=90)
print('ok · rugosidad media', round(float(r.mean()), 2), '· normal z media', round(float(n[:, :, 2].mean() * 2 - 1), 2))
