"""P0 v3 prototype (ChatGPT, 12-10-2026: crops of an illustration upscaled to 2048², edges blended): plaza and cobbles only,
   to see the photographic direction in the game (?pueblo=3&suelo=v3). Not a production delivery.
   ALTO p0v3_<n>_c/_n 1024, _r 512 · MEDIO p0v3m_<n>_c 1024, _n/_r 512 · BAJO p0v3b_<n>_c 512"""
import os
from PIL import Image
SRC = 'assets/3d/imports/2026-10-12_p0_v3_prototipo'; OUT = 'assets/tex'
# v3b (provisional pack, 12-10-2026, edges blended without mirror): the limestone passes the 50 % offset test and replaces the
# plaza; its cobbles still show a mirror axis, so the v3 cobble files stay as they were
V3B = 'assets/3d/imports/2026-10-12_p0_v3b_provisional'
SRCS = {'plaza': (V3B + '/caliza_color_2048.png', V3B + '/caliza_normal_2048.png', V3B + '/caliza_roughness_2048.png'),
        'cobble': (SRC + '/sd_ground_cobble_02_basecolor.png', SRC + '/sd_ground_cobble_02_normal.png', SRC + '/sd_ground_cobble_02_roughness.png')}
def save(img, name, size, q=88):
    img.resize(size, Image.LANCZOS).convert('RGB').save(os.path.join(OUT, name), quality=q, optimize=True)
for n in ['plaza', 'cobble']:
    c = Image.open(SRCS[n][0]).convert('RGB')
    nm = Image.open(SRCS[n][1]).convert('RGB')
    r = Image.open(SRCS[n][2]).convert('L').convert('RGB')
    save(c, f'p0v3_{n}_c.jpg', (1024, 1024)); save(nm, f'p0v3_{n}_n.jpg', (1024, 1024), 92); save(r, f'p0v3_{n}_r.jpg', (512, 512))
    save(c, f'p0v3m_{n}_c.jpg', (1024, 1024)); save(nm, f'p0v3m_{n}_n.jpg', (512, 512), 92); save(r, f'p0v3m_{n}_r.jpg', (512, 512))
    save(c, f'p0v3b_{n}_c.jpg', (512, 512))
print('ok')
