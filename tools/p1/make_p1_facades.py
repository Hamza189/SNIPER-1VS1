"""P1 · facades from CC0 Poly Haven scans (downloaded by the owner with tools/polyhaven/descargar_p1.py, 17-10-2026;
   compact copies + info.json in assets/3d/imports/2026-10-17_p1_polyhaven/). Option ?pueblo=3&fachada=cc0 (docs/ASSETS-3D.md §14).
   Each scan is only resized and, in colour, brought to the brightness of the texture it replaces (the game tints walls and
   shutters per facade, so the facade colours stay the same; what changes is the detail). Shapes are never retouched.
   ALTO p1_<m>_c/_n 1024, _r 512 · MEDIO p1m_ c 1024, n/r 512 · BAJO p1b_ c 512"""
import os, numpy as np
from PIL import Image
SRC = 'assets/3d/imports/2026-10-17_p1_polyhaven'; OUT = 'assets/tex'
# material in the kit → (scan, desaturation 0..1, texture it replaces: its mean brightness is the target)
MATS = {
    'stucco': ('white_stucco_02', 1.0, 'stucco'),            # walls: neutral (the facade colour comes from the tint)
    'rooftiles': ('clay_roof_tiles_02', 0.0, 'rooftiles'),   # Spanish curved tiles
    'stone': ('sandstone_blocks_04', 0.0, 'stone'),          # jambs, plinths, corners
    'wood': ('distressed_painted_planks', 0.85, 'wood'),     # shutters (tinted): almost neutral, the peeling paint stays
    'door': ('rough_pine_door', 0.0, None),                  # bare wood doors: the scan's own colour at the brightness of today's
                                                             # door (wood_c × woodraw's 0x8a6a4c ≈ 88)
}
LUM = np.array([0.2126, 0.7152, 0.0722], np.float32)
def lum(a): return float((a.reshape(-1, 3) * LUM).sum(1).mean())
def save(img, name, size, q=88): img.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), quality=q, optimize=True)
for m, (scan, desat, ref) in MATS.items():
    c = np.asarray(Image.open(f'{SRC}/{scan}/color.jpg').convert('RGB'), dtype=np.float32)
    if desat: L = (c * LUM).sum(2, keepdims=True); c = L + (c - L) * (1 - desat)
    target = lum(np.asarray(Image.open(f'{OUT}/{ref}_c.jpg').convert('RGB'), dtype=np.float32)) if ref else 88.0
    c = np.clip(c * (target / lum(c)), 0, 255).astype(np.uint8)
    ci = Image.fromarray(c); ni = Image.open(f'{SRC}/{scan}/normal.jpg').convert('RGB'); ri = Image.open(f'{SRC}/{scan}/rugosidad.png').convert('RGB')
    save(ci, f'p1_{m}_c.jpg', 1024); save(ni, f'p1_{m}_n.jpg', 1024, 92); save(ri, f'p1_{m}_r.jpg', 512)
    save(ci, f'p1m_{m}_c.jpg', 1024); save(ni, f'p1m_{m}_n.jpg', 512, 92); save(ri, f'p1m_{m}_r.jpg', 512)
    save(ci, f'p1b_{m}_c.jpg', 512)
    print(f'{m:10s} ← {scan:26s} brillo {lum(c):.0f} (objetivo {target:.0f}) · color medio {c.reshape(-1, 3).mean(0).round(0)}')
