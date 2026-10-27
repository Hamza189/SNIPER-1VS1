"""SNIPER DUEL — personaje externo → formato del juego (parte 2, Python con numpy y Pillow).

Junta las texturas de todos los materiales en un único atlas (el juego usa un material por personaje):
cada material recibe un cuadro (potencia de dos) proporcional a su superficie real, con más peso para la cara y
las manos; sus UV se escalan y desplazan a ese cuadro (sin girar: el espacio tangente del normal map no cambia).
Salida en <out>: color_B.jpg (colores originales), color_A.jpg y color_bots.jpg (variantes: solo se tiñe la ropa),
normal.jpg y orm.jpg (R oclusión, G rugosidad, B metal), cada uno a <size> y a 1024 (sufijo _1k); y escribe las UV
nuevas en <work>/model.npz.

Uso: python atlas.py <work> <out> <size> [cfg.json]
cfg: { "weight": {"regex material": factor}, "tint": "regex de materiales de ropa",
       "variants": {"A": [tono°, saturación×, brillo×], "bots": [...]}, "bright": 1.0 }
"""
import sys, json, re, math
from pathlib import Path
import numpy as np
from PIL import Image

WORK, OUT, S = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
CFG = json.loads(Path(sys.argv[4]).read_text()) if len(sys.argv) > 4 else {}
OUT.mkdir(parents=True, exist_ok=True)
M = dict(np.load(WORK / 'model.npz'))
MATS = json.loads((WORK / 'materials.json').read_text())
TEX = WORK / 'tex'
n = len(MATS)

# ------------------------------------------------------------------ cuánto sitio para cada material
P, I, MI = M['lod0_pos'], M['lod0_idx'], M['lod0_mat']
A = np.linalg.norm(np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]]), axis=1) / 2
area = np.bincount(MI, weights=A, minlength=n)
W = dict({'Head|Face|Skin_Head': 2.5, 'Arm|Hand|Glove': 1.6, 'Nail': 0.3}, **CFG.get('weight', {}))
w = area.copy()
for i, m in enumerate(MATS):
    for pat, f in W.items():
        if re.search(pat, m['name'], re.I):
            w[i] *= f
used = w > 0
share = w / w[used].sum()


def pack(scale):
    """cuadros potencia de dos en un quadtree de lado S; devuelve {material: (x, y, lado)} o None si no cabe"""
    side = {}
    for i in np.where(used)[0]:
        s = S * math.sqrt(share[i]) * scale
        side[i] = max(64, 2 ** int(math.floor(math.log2(max(s, 1)))))
    free = [(0, 0, S)]
    pos = {}
    for i in sorted(side, key=lambda k: -side[k]):
        s = side[i]
        free.sort(key=lambda f: (f[2], f[1], f[0]))
        k = next((j for j, f in enumerate(free) if f[2] >= s), None)
        if k is None:
            return None
        x, y, fs = free.pop(k)
        while fs > s:                      # partir el cuadro libre en 4 hasta el tamaño pedido
            h = fs // 2
            free += [(x + h, y, h), (x, y + h, h), (x + h, y + h, h)]
            fs = h
        pos[i] = (x, y, s)
    return pos


scale, best = 1.0, pack(1.0)
while best is None:
    scale *= 0.9
    best = pack(scale)
for _ in range(20):                       # crecer mientras quepa (aprovechar el espacio libre)
    t = pack(scale * 1.08)
    if t is None:
        break
    scale *= 1.08
    best = t
print('atlas', S, {MATS[i]['name']: best[i][2] for i in best})

# ------------------------------------------------------------------ UV nuevas
PAD = 2.0 / S
for L in range(3):
    uv, idx, mat = M['lod%d_uv' % L].astype(np.float64), M['lod%d_idx' % L], M['lod%d_mat' % L]
    vm = np.full(len(uv), -1)
    vm[idx.reshape(-1)] = np.repeat(mat, 3)
    new = uv.copy()
    for i, (x, y, s) in best.items():
        sel = vm == i
        u = uv[sel]
        if len(u):                         # baldosas UDIM (Character Creator): cada material vuelve a su baldosa 0..1
            u = u - np.floor(np.median(u, axis=0))
        if len(u) and (u.min() < -0.01 or u.max() > 1.01):
            print('  aviso: UV de', MATS[i]['name'], 'fuera de 0..1 (', u.min(0), u.max(0), '): se recortan')
        u = np.clip(u, 0, 1)
        # Blender: v hacia arriba; la imagen: fila 0 arriba. Cuadro (x, y) en píxeles de imagen desde arriba
        uu = x / S + PAD + u[:, 0] * (s / S - 2 * PAD)
        vv = 1 - (y / S + PAD + (1 - u[:, 1]) * (s / S - 2 * PAD))
        new[sel] = np.stack([uu, vv], 1)
    M['lod%d_uv' % L] = new.astype(np.float32)
np.savez_compressed(WORK / 'model.npz', **M)


# ------------------------------------------------------------------ texturas
def load(fn, mode, size, fill):
    if fn and (TEX / fn).exists():
        im = Image.open(TEX / fn)
        if mode == 'L' and im.mode not in ('L', 'I', 'F'):
            im = im.convert('RGB')
        im = im.convert(mode if mode != 'L' else im.mode if im.mode == 'L' else 'RGB')
        return im.resize((size, size), Image.LANCZOS)
    return Image.new(mode if mode != 'L' else 'L', (size, size), fill)


def chan(im, ch):
    if im.mode == 'L':
        return np.asarray(im, np.float32) / 255
    return np.asarray(im, np.float32)[..., 'RGB'.index(ch or 'R')] / 255


def hsv_shift(rgb, dh, ks, kv):
    """rgb 0..1 → tono +dh grados, saturación ×ks, brillo ×kv"""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn + 1e-9
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    sat = np.where(mx > 0, d / (mx + 1e-9), 0)
    v = mx
    h = (h + dh) % 360
    sat = np.clip(sat * ks, 0, 1)
    v = np.clip(v * kv, 0, 1)
    c = v * sat
    x = c * (1 - np.abs((h / 60) % 2 - 1))
    m = v - c
    k = (h // 60).astype(int) % 6
    out = np.zeros_like(rgb)
    for i, (a, b2, c2) in enumerate(((c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x))):
        sel = k == i
        for j, comp in enumerate((a, b2, c2)):
            out[..., j] = np.where(sel, (comp if np.ndim(comp) else comp) + m, out[..., j])
    return out


tint = re.compile(CFG.get('tint', 'Shirt|Pant|Jacket|Vest|Hat|Helmet|Cloth|Uniform|Suit'), re.I)
variants = dict({'B': None, 'A': [12, 0.75, 1.12], 'bots': [0, 0.25, 0.92]}, **CFG.get('variants', {}))
bright = CFG.get('bright', 1.0)
color = {v: np.zeros((S, S, 3), np.float32) for v in variants}
normal = np.zeros((S, S, 3), np.float32); normal[..., 0] = normal[..., 1] = 0.5; normal[..., 2] = 1
orm = np.zeros((S, S, 3), np.float32); orm[..., 0] = 1; orm[..., 1] = 0.6
for i, (x, y, s) in best.items():
    m = MATS[i]
    fac = np.array(m.get('colorFactor') or [1, 1, 1], np.float32)
    c = np.asarray(load(m.get('color'), 'RGB', s, tuple(int(255 * f) for f in fac)), np.float32) / 255
    if m.get('color'):
        c = c * fac
    c = np.clip(c * bright, 0, 1)
    for v, sh in variants.items():
        cv = c if sh is None or not tint.search(m['name']) else hsv_shift(c, *sh)
        color[v][y:y + s, x:x + s] = cv
    normal[y:y + s, x:x + s] = np.asarray(load(m.get('normal'), 'RGB', s, (128, 128, 255)), np.float32) / 255
    ao = chan(load(m.get('ao'), 'L', s, 255), 'R')
    ro = chan(load(m.get('rough'), 'RGB', s, (int(255 * m.get('roughness', 0.6)),) * 3), m.get('roughCh') or 'G') if m.get('rough') else np.full((s, s), m.get('roughness', 0.6), np.float32)
    me = chan(load(m.get('metal'), 'RGB', s, (0, 0, 0)), m.get('metalCh') or 'B') if m.get('metal') else np.full((s, s), m.get('metallic', 0.0), np.float32)
    if m.get('rough') and m.get('roughMul') is not None:
        ro = ro * m['roughMul']
    if m.get('metal') and m.get('metalMul') is not None:
        me = me * m['metalMul']
    orm[y:y + s, x:x + s] = np.stack([ao, ro, me], -1)


def save(arr, name):
    im = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8))
    im.save(OUT / (name + '.jpg'), quality=90, optimize=True)
    if S > 1024:
        im.resize((1024, 1024), Image.LANCZOS).save(OUT / (name + '_1k.jpg'), quality=88, optimize=True)
    if S > 2048:
        im.resize((2048, 2048), Image.LANCZOS).save(OUT / (name + '_2k.jpg'), quality=89, optimize=True)


for v, a in color.items():
    save(a, 'color_' + v)
save(normal, 'normal')
save(orm, 'orm')
print('texturas en', OUT)
