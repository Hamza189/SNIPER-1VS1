"""P0 v3 prototype (ChatGPT, 12-10-2026: crops of an illustration upscaled to 2048², edges blended): plaza and cobbles only,
   to see the photographic direction in the game (?pueblo=3&suelo=v3). Not a production delivery.
   ALTO p0v3_<n>_c/_n 1024, _r 512 · MEDIO p0v3m_<n>_c 1024, _n/_r 512 · BAJO p0v3b_<n>_c 512"""
import os
from PIL import Image
SRC = 'assets/3d/imports/2026-10-12_p0_v3_prototipo'; OUT = 'assets/tex'
def save(img, name, size, q=88):
    img.resize(size, Image.LANCZOS).convert('RGB').save(os.path.join(OUT, name), quality=q, optimize=True)
for n in ['plaza', 'cobble']:
    c = Image.open(f'{SRC}/sd_ground_{n}_02_basecolor.png').convert('RGB')
    nm = Image.open(f'{SRC}/sd_ground_{n}_02_normal.png').convert('RGB')
    r = Image.open(f'{SRC}/sd_ground_{n}_02_roughness.png').convert('L').convert('RGB')
    save(c, f'p0v3_{n}_c.jpg', (1024, 1024)); save(nm, f'p0v3_{n}_n.jpg', (1024, 1024), 92); save(r, f'p0v3_{n}_r.jpg', (512, 512))
    save(c, f'p0v3m_{n}_c.jpg', (1024, 1024)); save(nm, f'p0v3m_{n}_n.jpg', (512, 512), 92); save(r, f'p0v3m_{n}_r.jpg', (512, 512))
    save(c, f'p0v3b_{n}_c.jpg', (512, 512))
print('ok')
