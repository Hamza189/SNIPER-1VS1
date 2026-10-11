"""P0 ground pack → the game's textures (assets/tex/), one size per graphics profile.
   Source: the 1024² originals as delivered (assets/3d/imports/2026-10-12_p0_ground_pack_v1/textures/), never changed.
   ALTO  p0_<n>_c 512 · p0_<n>_n 512 (plaza, cobble) or 256 · p0_<n>_r 256
   MEDIO p0m_<n>_c 512 · p0m_<n>_n 256 · p0m_<n>_r 256 (plaza, cobble; the rest share the ALTO files)
   BAJO  p0b_<n>_c 256 (no normal / roughness in BAJO)
   decals: p0_decals.png 512² (BAJO p0b_decals.png 256²); sand→pavement strip: p0_transition.png 512×128
   python3 tools/p0/make_p0_textures.py"""
import os
from PIL import Image
SRC = 'assets/3d/imports/2026-10-12_p0_ground_pack_v1/textures'
OUT = 'assets/tex'
def save(img, name, size, q=88):
    im = img.resize(size, Image.LANCZOS)
    if name.endswith('.png'): im.save(os.path.join(OUT, name), optimize=True)
    else: im.convert('RGB').save(os.path.join(OUT, name), quality=q, optimize=True)
    return os.path.getsize(os.path.join(OUT, name))
tot = 0
for n in ['plaza', 'cobble', 'sidewalk', 'sand', 'patch']:
    c = Image.open(f'{SRC}/sd_ground_{n}_01_basecolor.png').convert('RGB')
    nm = Image.open(f'{SRC}/sd_ground_{n}_01_normal.png').convert('RGB')
    r = Image.open(f'{SRC}/sd_ground_{n}_01_roughness.png').convert('L').convert('RGB')   # three.js reads roughness from G
    big = n in ('plaza', 'cobble')
    tot += save(c, f'p0_{n}_c.jpg', (512, 512))
    tot += save(c, f'p0b_{n}_c.jpg', (256, 256))
    if n == 'sand': continue   # the ground plane carries no normal / roughness map (fill-rate)
    tot += save(nm, f'p0_{n}_n.jpg', (512, 512) if big else (256, 256), 92)
    tot += save(r, f'p0_{n}_r.jpg', (256, 256))
    if big:
        tot += save(c, f'p0m_{n}_c.jpg', (512, 512)); tot += save(nm, f'p0m_{n}_n.jpg', (256, 256), 92); tot += save(r, f'p0m_{n}_r.jpg', (256, 256))
a = Image.open(f'{SRC}/sd_ground_decal_atlas_01.png').convert('RGBA')
tot += save(a, 'p0_decals.png', (512, 512)); tot += save(a, 'p0b_decals.png', (256, 256))
t = Image.open(f'{SRC}/sd_ground_transition_sand_stone_01.png').convert('RGBA')
tot += save(t, 'p0_transition.png', (512, 128))
print('archivos P0: %.2f MB en disco' % (tot / 1048576))
