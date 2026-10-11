"""Procedural, tileable PBR textures for PUEBLO 2.0 (all original, generated from code: no third-party
assets, no licence questions). Writes assets/tex/<name>_c.jpg (colour, sRGB) and <name>_n.jpg (normal,
OpenGL convention: +Y up) for each material.

Run:  python3 tools/textures/make_textures.py      (needs numpy + Pillow)
Every texture tiles seamlessly: the noise is built in the frequency domain (periodic by construction)
and the patterns (stones, tiles, planks) wrap at the borders. Fixed seeds: the output is reproducible.
"""
import os, pathlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'tex'
N = 512


def rng(seed):
    return np.random.default_rng(seed)


def noise(seed, beta=2.0, n=N, lo=1, hi=None):
    """Tileable fractal noise, 0..1. beta = spectral slope (bigger = smoother); lo/hi = frequency band."""
    r = rng(seed)
    f = np.fft.fftfreq(n)[:, None] ** 2 + np.fft.fftfreq(n)[None, :] ** 2
    f = np.sqrt(f) * n
    amp = np.where(f > 0, 1.0 / np.maximum(f, 1e-6) ** (beta / 2), 0)
    amp[f < lo] = 0
    if hi:
        amp[f > hi] = 0
    ph = np.exp(2j * np.pi * r.random((n, n)))
    a = np.real(np.fft.ifft2(amp * ph))
    a -= a.min(); a /= max(a.max(), 1e-9)
    return a


def normal_from_height(h, strength):
    """Height (0..1, tileable) → OpenGL normal map (wraps at the borders)."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nx, ny, nz = -dx, dy, np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / l, ny / l, nz / l], -1)
    return ((n * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)


def save(name, col, h, strength, q=88):
    OUT.mkdir(parents=True, exist_ok=True)
    c = (np.clip(col, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(c, 'RGB').save(OUT / (name + '_c.jpg'), quality=q, optimize=True)
    Image.fromarray(normal_from_height(h, strength), 'RGB').save(OUT / (name + '_n.jpg'), quality=80, optimize=True)


def rgb(*v):
    return np.array(v, dtype=np.float32) / 255.0


def tint(gray, c0, c1):
    g = gray[..., None]
    return c0 * (1 - g) + c1 * g


def blocks(seed, rows, mean_w, jitter, n=N, offset_rows=True):
    """Running-bond pattern: per pixel (cell id, distance to the cell edge in px). Wraps on both axes."""
    r = rng(seed)
    rh = n / rows
    ids = np.zeros((n, n), np.int32)
    edge = np.zeros((n, n), np.float32)
    yy = np.arange(n)
    cid = 0
    for row in range(rows):
        y0, y1 = int(round(row * rh)), int(round((row + 1) * rh))
        # widths that add up exactly to n (so the row wraps)
        ws = []
        while sum(ws) < n:
            ws.append(max(8, int(mean_w * (1 + r.uniform(-jitter, jitter)))))
        ws[-1] -= sum(ws) - n
        if ws[-1] < mean_w * 0.4 and len(ws) > 1:
            ws[-2] += ws[-1]; ws.pop()
        shift = int(r.uniform(0, mean_w)) if offset_rows else 0
        x = shift
        for w in ws:
            xs = (np.arange(x, x + w)) % n
            for yi in range(y0, y1):
                ids[yi, xs] = cid
                dy = min(yi - y0, y1 - 1 - yi)
                dxs = np.minimum(np.arange(w), np.arange(w)[::-1])
                edge[yi, xs] = np.minimum(dxs, dy)
            x += w; cid += 1
    return ids, edge, cid


def plaster():
    big = noise(11, 2.6, lo=1, hi=24)
    mid = noise(12, 1.6, lo=8, hi=120)
    fine = noise(13, 0.6, lo=60)
    stain = noise(14, 3.0, lo=1, hi=8)
    g = 0.83 + (big - 0.5) * 0.09 + (mid - 0.5) * 0.05 + (fine - 0.5) * 0.05 - np.clip(stain - 0.62, 0, 1) * 0.35
    col = np.stack([g * 1.0, g * 0.975, g * 0.94], -1)          # warm off-white; the building colour comes from the vertex colour
    h = mid * 0.5 + fine * 0.5
    save('plaster', col, h, 3.0)


def stone():
    ids, edge, n = blocks(21, 4, 150, 0.45)
    r = rng(22)
    per = r.uniform(0.0, 1.0, n + 1)
    tone = per[ids]
    surf = noise(23, 1.2, lo=10)
    mortar = np.clip(1 - edge / 5.0, 0, 1)
    c0, c1 = rgb(148, 132, 108), rgb(196, 178, 146)
    col = tint(np.clip(tone * 0.7 + surf * 0.3, 0, 1), c0, c1)
    col = col * (1 - mortar[..., None] * 0.45) + rgb(120, 110, 96) * (mortar[..., None] * 0.45)
    bevel = np.clip(edge / 9.0, 0, 1)
    h = bevel * 0.7 + surf * 0.3
    save('stone', col, h, 7.0)


def cobble():
    # rounded setts in rows (classic Mediterranean street)
    ids, edge, n = blocks(31, 10, 56, 0.35)
    r = rng(32)
    per = r.uniform(0, 1, n + 1)
    surf = noise(33, 1.0, lo=20)
    dirt = noise(34, 2.8, lo=1, hi=10)
    dome = np.clip(edge / 10.0, 0, 1) ** 0.6
    grout = 1 - np.clip(edge / 3.0, 0, 1)
    c0, c1 = rgb(104, 96, 86), rgb(160, 150, 134)
    col = tint(np.clip(per[ids] * 0.6 + surf * 0.4, 0, 1), c0, c1)
    col = col * (1 - grout[..., None] * 0.6) + rgb(86, 76, 62) * (grout[..., None] * 0.6)
    col *= (0.88 + dirt * 0.18)[..., None]
    h = dome * 0.8 + surf * 0.2
    save('cobble', col, h, 9.0)


def paving():
    # square slabs for pavements and the plaza
    n = N
    t = 128
    yy, xx = np.mgrid[0:n, 0:n]
    ex = np.minimum(xx % t, t - 1 - xx % t)
    ey = np.minimum(yy % t, t - 1 - yy % t)
    edge = np.minimum(ex, ey).astype(np.float32)
    ids = (yy // t) * 8 + (xx // t)
    r = rng(41)
    per = r.uniform(0, 1, 64)[ids]
    surf = noise(42, 1.1, lo=16)
    stain = noise(43, 2.6, lo=1, hi=8)
    grout = 1 - np.clip(edge / 2.5, 0, 1)
    c0, c1 = rgb(172, 160, 140), rgb(206, 194, 172)
    col = tint(np.clip(per * 0.35 + surf * 0.65, 0, 1), c0, c1)
    col = col * (1 - grout[..., None] * 0.5) + rgb(120, 110, 96) * (grout[..., None] * 0.5)
    col *= (0.9 + stain * 0.14)[..., None]
    h = np.clip(edge / 5.0, 0, 1) * 0.6 + surf * 0.4
    save('paving', col, h, 5.0)


def wood():
    # vertical planks (shutters, doors): grey base, painted colour comes from the vertex colour
    n = N
    planks = 6
    pw = n // planks
    xx = np.arange(n)[None, :].repeat(n, 0)
    edge = np.minimum(xx % pw, pw - 1 - xx % pw).astype(np.float32)
    grain = noise(51, 1.0, lo=4)
    grain = np.roll(grain, 0, 0)
    streak = np.sin((xx / n) * np.pi * 2 * 38 + grain * 9) * 0.5 + 0.5
    wear = noise(52, 2.4, lo=1, hi=12)
    g = 0.78 + streak * 0.08 + (grain - 0.5) * 0.1
    g -= (1 - np.clip(edge / 3.0, 0, 1)) * 0.35
    paint_off = np.clip(wear - 0.7, 0, 1) * 2.0      # worn patches show the grey wood
    col = np.stack([g, g * 0.98, g * 0.94], -1)
    col = col * (1 - paint_off[..., None]) + rgb(120, 104, 84) * paint_off[..., None]
    h = np.clip(edge / 4.0, 0, 1) * 0.6 + streak * 0.2 + grain * 0.2
    save('wood', col, h, 4.0)


def roof():
    # flat roofs: weathered membrane with gravel
    g1 = noise(61, 0.4, lo=90)
    g2 = noise(62, 1.8, lo=2, hi=40)
    g = 0.42 + (g1 - 0.5) * 0.18 + (g2 - 0.5) * 0.12
    col = np.stack([g * 1.0, g * 0.95, g * 0.88], -1)
    save('roof', col, g1 * 0.8 + g2 * 0.2, 4.0)


def sand():
    # ground: fine sand with pebbles and wind ripples, darker damp patches
    fine = noise(71, 0.5, lo=80)
    mid = noise(72, 1.6, lo=6, hi=60)
    big = noise(73, 2.8, lo=1, hi=6)
    rip = np.sin(np.linspace(0, np.pi * 2 * 14, N)[None, :] + noise(74, 2.5, lo=1, hi=8) * 6) * 0.5 + 0.5
    r = rng(75)
    peb = np.zeros((N, N), np.float32)
    for _ in range(900):
        x, y, s = r.integers(0, N), r.integers(0, N), r.uniform(1.0, 3.2)
        yy, xx = np.ogrid[-4:5, -4:5]
        k = np.clip(1 - (xx * xx + yy * yy) / (s * s), 0, 1)
        peb[np.ix_((np.arange(y - 4, y + 5)) % N, (np.arange(x - 4, x + 5)) % N)] += k
    peb = np.clip(peb, 0, 1)
    g = 0.5 + (mid - 0.5) * 0.35 + (fine - 0.5) * 0.25 + (big - 0.5) * 0.3 + (rip - 0.5) * 0.06
    c0, c1 = rgb(170, 138, 98), rgb(214, 182, 136)
    col = tint(np.clip(g, 0, 1), c0, c1)
    col = col * (1 - peb[..., None] * 0.35) + rgb(120, 104, 84) * (peb[..., None] * 0.35)
    h = fine * 0.35 + mid * 0.25 + rip * 0.15 + peb * 0.6
    save('sand', col, h, 5.0)


def concrete():
    big = noise(81, 2.4, lo=1, hi=16)
    fine = noise(82, 0.6, lo=60)
    pores = (noise(83, 0.2, lo=150) > 0.82).astype(np.float32)
    g = 0.62 + (big - 0.5) * 0.12 + (fine - 0.5) * 0.06 - pores * 0.08
    col = np.stack([g, g * 0.985, g * 0.96], -1)
    # formwork seams every quarter
    yy = np.arange(N)[:, None]
    seam = (np.minimum(yy % 128, 127 - yy % 128) < 1.5).astype(np.float32) * np.ones((1, N))
    col *= (1 - seam * 0.12)[..., None]
    save('concrete', col, fine * 0.7 + big * 0.3 - seam * 0.3, 3.0)


def metal():
    # painted, chipped steel (containers, doors, rails); colour from the vertex colour
    big = noise(91, 2.5, lo=1, hi=12)
    chip = noise(92, 1.2, lo=20)
    rust = np.clip(big * chip - 0.42, 0, 1) * 3
    g = 0.78 + (chip - 0.5) * 0.05
    col = np.stack([g, g, g], -1)
    col = col * (1 - rust[..., None]) + rgb(110, 62, 36) * rust[..., None]
    # corrugation (vertical ribs)
    xx = np.arange(N)[None, :]
    rib = (np.sin(xx / N * np.pi * 2 * 16) * 0.5 + 0.5) * np.ones((N, 1))
    save('metal', col, rib * 0.8 + chip * 0.2, 6.0)


def sandbag():
    # one bag per texture repeat: the bulge along the bag, pinched ends with a dark gap between bags,
    # a seam along the middle and the weave; the wall is drawn as long rolls, the texture makes the bags
    n = N
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    u, v = xx / n, yy / n
    along = np.sin(np.pi * u) ** 0.35                      # flat middle, pinched at both ends
    across = np.sin(np.pi * v) ** 0.5
    bulge = along * across
    gap = np.clip(1 - np.minimum(u, 1 - u) * 40, 0, 1)    # the dark joint between two bags
    seam = np.exp(-((v - 0.5) / 0.02) ** 2) * 0.25
    wx = np.sin(xx / n * np.pi * 2 * 96) * 0.5 + 0.5
    wy = np.sin(yy / n * np.pi * 2 * 60) * 0.5 + 0.5
    over = ((xx // 6 + yy // 6) % 2)
    weave = wx * over + wy * (1 - over)
    dirt = noise(111, 2.4, lo=1, hi=8)
    tie = np.clip(1 - np.abs(u - 0.06) * 30, 0, 1) * np.clip(1 - np.abs(v - 0.5) * 2.2, 0, 1)   # the tied end
    g = 0.62 + bulge * 0.26 + (weave - 0.5) * 0.08 - gap * 0.45 - seam * 0.3 - np.clip(dirt - 0.6, 0, 1) * 0.4 - tie * 0.12
    col = np.stack([g, g * 0.95, g * 0.85], -1)
    h = bulge * 0.85 + weave * 0.05 - seam * 0.3 - gap * 0.4 + tie * 0.15
    save('sandbag', col, h, 14.0)


if __name__ == '__main__':
    for f in (plaster, stone, cobble, paving, wood, roof, sand, concrete, metal, sandbag):
        f(); print('ok', f.__name__)
    tot = sum(p.stat().st_size for p in OUT.glob('*.jpg'))
    print('TEXTURES', OUT, round(tot / 1024), 'KB')
