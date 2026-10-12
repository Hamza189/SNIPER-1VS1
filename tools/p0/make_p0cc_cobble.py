"""North-street cobbles from the Poly Haven scan cobblestone_02 (CC0, Amal Kumar; originals in
   assets/3d/imports/2026-10-12_cobble_cc0_polyhaven/, 4096², 1.8 m wide). Option ?pueblo=3&adoquin=cc0 (docs/ASSETS-3D.md §13).
   The scan tiles by itself (no mirroring, no blending): it is only resized and, in colour, half desaturated (SAT 0.5).
   ALTO p0cc_cobble_c/_n 2048, _r 1024 · MEDIO p0ccm_ c/n 1024, r 512 · BAJO p0ccb_ c 512
   Also writes the 50 % offset test and the 3×3 mosaic next to the originals.
   Needs: pip install OpenEXR numpy pillow"""
import os, numpy as np, OpenEXR
from PIL import Image
SRC = 'assets/3d/imports/2026-10-12_cobble_cc0_polyhaven'; OUT = 'assets/tex'
def exr(f):
    with OpenEXR.File(os.path.join(SRC, f)) as e:
        ch = e.channels(); k = 'RGB' if 'RGB' in ch else list(ch)[0]
        return np.asarray(ch[k].pixels, dtype=np.float32)
# colour from Poly Haven's lossless 2K PNG (the owner's run of ChatGPT's preparador, 12-10-2026): the 4K JPEG drifts (+7 in green)
c = Image.open(os.path.join(SRC, 'cobblestone_02_diff_2k.png')).convert('RGB')
# SAT: colour only (the shapes are untouched). As it is (1) the earth is orange and, under the game's sun and ACES, the street
# read as a dirt road; 0.5 (chosen in the comparison of 12-10-2026) gives warm grey stone like the rest of the town
SAT = float(os.environ.get('SAT', '0.5'))
if SAT != 1:
    a0 = np.asarray(c, dtype=np.float32); lum = (a0 * [0.2126, 0.7152, 0.0722]).sum(2, keepdims=True)
    c = Image.fromarray(np.clip(lum + (a0 - lum) * SAT, 0, 255).astype(np.uint8))
n = Image.fromarray((np.clip(exr('cobblestone_02_nor_gl_4k.exr'), 0, 1) * 255 + 0.5).astype(np.uint8))      # normal: data, already (v+1)/2
r = Image.fromarray((np.clip(exr('cobblestone_02_rough_4k.exr'), 0, 1) * 255 + 0.5).astype(np.uint8)).convert('RGB')
def save(img, name, size, q=88):
    img.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), quality=q, optimize=True)
save(c, 'p0cc_cobble_c.jpg', 2048); save(n, 'p0cc_cobble_n.jpg', 2048, 92); save(r, 'p0cc_cobble_r.jpg', 1024)
save(c, 'p0ccm_cobble_c.jpg', 1024); save(n, 'p0ccm_cobble_n.jpg', 1024, 92); save(r, 'p0ccm_cobble_r.jpg', 512)
save(c, 'p0ccb_cobble_c.jpg', 512)
small = c.resize((1024, 1024), Image.LANCZOS)
Image.fromarray(np.roll(np.asarray(small), (512, 512), (0, 1))).save(os.path.join(SRC, 'prueba_desplazamiento_50.jpg'), quality=88)
m = Image.new('RGB', (1536, 1536)); t = c.resize((512, 512), Image.LANCZOS)
for y in range(3):
    for x in range(3): m.paste(t, (x * 512, y * 512))
m.save(os.path.join(SRC, 'prueba_mosaico_3x3.jpg'), quality=88)
a = np.asarray(c, dtype=np.float32); nz = np.asarray(n, dtype=np.float32)[:, :, 2] / 127.5 - 1
print('color medio sRGB', a.reshape(-1, 3).mean(0).round(1), '· >220: %.2f %%' % ((a.max(2) > 220).mean() * 100),
      '· z normal %.3f' % nz.mean(), '· rugosidad %.2f' % (np.asarray(r, dtype=np.float32)[:, :, 0].mean() / 255))
