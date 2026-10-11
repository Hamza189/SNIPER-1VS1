"""PUEBLO 3.0 textures (colour 512 px, normal / roughness 256 px): more materials and less repetition than the PUEBLO 2.0 set (make_textures.py).
All original, generated from code (no third-party assets). Same conventions: assets/tex/<name>_c.jpg
(colour, sRGB), <name>_n.jpg (OpenGL normal), and <name>_r.jpg (roughness, in the green channel) where
the roughness really changes across the surface (glazed tiles, polished cobbles, patched asphalt).

Run:  python3 tools/textures/make_textures_p3.py      (needs numpy, scipy, Pillow)
Everything tiles: periodic noise and periodic Voronoi cells (the seed points are repeated 3 x 3).
"""
import pathlib, sys
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from make_textures import noise, normal_from_height, rgb, tint, rng, OUT, N  # noqa: E402


def save(name, col, h, strength, rough=None, q=86):
    OUT.mkdir(parents=True, exist_ok=True)
    c = (np.clip(col, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(c, 'RGB').save(OUT / (name + '_c.jpg'), quality=q, optimize=True)
    # normal and roughness at half resolution (256): a quarter of the memory on the phone, the relief
    # still reads; the colour keeps 512
    Image.fromarray(normal_from_height(h, strength), 'RGB').resize((N // 2, N // 2), Image.LANCZOS).save(OUT / (name + '_n.jpg'), quality=82, optimize=True)
    if rough is not None:
        r = (np.clip(rough, 0, 1) * 255).astype(np.uint8)
        Image.fromarray(np.stack([r, r, r], -1), 'RGB').resize((N // 2, N // 2), Image.LANCZOS).save(OUT / (name + '_r.jpg'), quality=80, optimize=True)


def stretch(a, sx, sy):
    """Anisotropic version of a tileable field: repeat it sx × sy times along x / y (stays tileable)."""
    n = a.shape[0]
    yy, xx = np.mgrid[0:n, 0:n]
    return a[(yy * sy) % n, (xx * sx) % n]


def voronoi(seed, count, n=N, sx=1.0, sy=1.0, jitter=1.0):
    """Periodic Voronoi: cell id, distance to the nearest border (F2 - F1, px), cell centre offsets.
    sx/sy squash the metric (sx > 1 → cells wider than tall)."""
    r = rng(seed)
    g = int(np.ceil(np.sqrt(count)))
    # jittered grid → even sizes, no clumps
    pts = []
    for j in range(g):
        for i in range(g):
            pts.append(((i + 0.5 + (r.random() - 0.5) * jitter) / g * n, (j + 0.5 + (r.random() - 0.5) * jitter) / g * n))
    pts = np.array(pts)
    rep = np.concatenate([pts + [dx * n, dy * n] for dy in (-1, 0, 1) for dx in (-1, 0, 1)])
    ids = np.tile(np.arange(len(pts)), 9)
    tree = cKDTree(rep * [1 / sx, 1 / sy])
    yy, xx = np.mgrid[0:n, 0:n]
    q = np.stack([xx.ravel() + 0.5, yy.ravel() + 0.5], -1) * [1 / sx, 1 / sy]
    d, k = tree.query(q, 2)
    cell = ids[k[:, 0]].reshape(n, n)
    edge = ((d[:, 1] - d[:, 0]) * 0.5).reshape(n, n)
    return cell, edge.astype(np.float32), len(pts)


def stucco():
    # lime render: trowel strokes, soft vertical rain streaks, a few patches where it flaked off
    trowel = stretch(noise(301, 1.4, lo=6, hi=90), 1, 3)
    fine = noise(302, 0.5, lo=80)
    big = noise(303, 2.6, lo=1, hi=10)
    streak = stretch(noise(304, 2.0, lo=2, hi=40), 6, 1)            # stretched along y: rain marks
    flake = noise(305, 2.8, lo=1, hi=9)
    hole = np.clip((flake - 0.8) * 7, 0, 1) * np.clip(fine * 1.6, 0, 1)   # a few soft, rough-edged bare patches
    g = 0.86 + (trowel - 0.5) * 0.06 + (fine - 0.5) * 0.05 + (big - 0.5) * 0.06 - np.clip(streak - 0.55, 0, 1) * 0.22
    col = np.stack([g, g * 0.985, g * 0.955], -1)
    under = rgb(198, 180, 154) * (0.85 + fine[..., None] * 0.2)          # the rougher, older coat underneath
    col = col * (1 - hole[..., None]) + under * hole[..., None]
    h = trowel * 0.45 + fine * 0.35 - hole * 0.5
    save('stucco', col, h, 3.2)


def rubble():
    # rough stone masonry: irregular, flattish stones in thick lime mortar
    cell, edge, n = voronoi(311, 140, sx=1.7, sy=1.0, jitter=0.9)
    r = rng(312)
    tone = r.uniform(0, 1, n)[cell]
    hue = r.integers(0, 3, n)[cell]
    surf = noise(313, 1.0, lo=14)
    pal = [(rgb(150, 132, 104), rgb(196, 176, 140)), (rgb(132, 124, 112), rgb(178, 170, 156)), (rgb(158, 120, 88), rgb(198, 160, 120))]
    col = np.zeros((N, N, 3), np.float32)
    for i, (a, b) in enumerate(pal):
        m = (hue == i)[..., None]
        col += m * tint(np.clip(tone * 0.6 + surf * 0.4, 0, 1), a, b)
    mortar = np.clip(1 - (edge - 2.0) / 3.5, 0, 1)
    col = col * (1 - mortar[..., None]) + (rgb(200, 190, 170) * (0.9 + surf[..., None] * 0.15)) * mortar[..., None]
    dome = np.clip(edge / 14.0, 0, 1) ** 0.5
    h = dome * 0.75 + surf * 0.25 - mortar * 0.3
    save('rubble', col, h, 10.0)


def setts():
    # irregular cobbles (adoquín irregular): rounded tops, sandy joints, tops a bit polished by feet
    cell, edge, n = voronoi(321, 260, sx=1.25, sy=1.0, jitter=0.8)
    r = rng(322)
    tone = r.uniform(0, 1, n)[cell]
    warm = r.uniform(0, 1, n)[cell]
    surf = noise(323, 1.0, lo=20)
    dirt = noise(324, 2.6, lo=1, hi=8)
    a, b = rgb(110, 104, 96), rgb(170, 162, 148)
    col = tint(np.clip(tone * 0.6 + surf * 0.4, 0, 1), a, b)
    col = col * (1 - warm[..., None] * 0.25) + col * rgb(1.15 * 255, 1.0 * 255, 0.82 * 255) * (warm[..., None] * 0.25)
    joint = np.clip(1 - (edge - 1.0) / 2.6, 0, 1)
    col = col * (1 - joint[..., None] * 0.75) + rgb(122, 106, 84) * (joint[..., None] * 0.75)
    col *= (0.88 + dirt * 0.16)[..., None]
    dome = np.clip(edge / 9.0, 0, 1) ** 0.55
    h = dome * 0.85 + surf * 0.15
    rough = 0.62 + (1 - dome) * 0.3 + (surf - 0.5) * 0.08
    save('setts', col, h, 11.0, rough)


def slabs():
    # plaza: big limestone slabs of a few lengths in rows, worn and stained
    n = N
    r = rng(331)
    rows = 6
    rh = n // rows
    ids = np.zeros((n, n), np.int32)
    edge = np.zeros((n, n), np.float32)
    cid = 0
    for row in range(rows):
        widths = []
        while sum(widths) < n:
            widths.append(int(r.choice([rh, rh * 1.5, rh * 2]) * r.uniform(0.95, 1.05)))
        widths[-1] -= sum(widths) - n
        if widths[-1] < rh * 0.5:
            widths[-2] += widths[-1]; widths.pop()
        x = int(r.uniform(0, rh))
        for w in widths:
            xs = np.arange(x, x + w) % n
            dxs = np.minimum(np.arange(w), np.arange(w)[::-1])
            for yi in range(row * rh, (row + 1) * rh):
                dy = min(yi - row * rh, (row + 1) * rh - 1 - yi)
                ids[yi, xs] = cid
                edge[yi, xs] = np.minimum(dxs, dy)
            x += w; cid += 1
    per = r.uniform(0, 1, cid)[ids]
    surf = noise(332, 1.1, lo=16)
    fossil = (noise(333, 0.3, lo=120) > 0.8).astype(np.float32)
    stain = noise(334, 2.6, lo=1, hi=8)
    a, b = rgb(176, 164, 142), rgb(214, 202, 180)
    col = tint(np.clip(per * 0.45 + surf * 0.55, 0, 1), a, b)
    col -= fossil[..., None] * 0.04
    joint = 1 - np.clip(edge / 2.2, 0, 1)
    col = col * (1 - joint[..., None] * 0.55) + rgb(110, 100, 86) * (joint[..., None] * 0.55)
    col *= (0.86 + stain * 0.18)[..., None]
    h = np.clip(edge / 4.0, 0, 1) * 0.55 + surf * 0.45
    rough = 0.72 + (surf - 0.5) * 0.1 + joint * 0.2
    save('slabs', col, h, 5.0, rough)


def asphalt():
    # old asphalt, repaired: aggregate, darker newer patches, sealed cracks
    agg = noise(341, 0.2, lo=140)
    big = noise(342, 2.4, lo=1, hi=10)
    g = 0.36 + (agg - 0.5) * 0.18 + (big - 0.5) * 0.08
    r = rng(343)
    patch = np.zeros((N, N), np.float32)
    for _ in range(5):
        x0, y0 = r.integers(0, N, 2)
        w, h = r.integers(60, 200, 2)
        ys, xs = (np.arange(y0, y0 + h) % N), (np.arange(x0, x0 + w) % N)
        patch[np.ix_(ys, xs)] = r.uniform(-1, 1)
    g += patch * 0.07
    crack = np.zeros((N, N), np.float32)
    for _ in range(9):     # a few long, wandering cracks (sealed with dark tar)
        x, y = r.uniform(0, N, 2)
        a = r.uniform(0, np.pi * 2)
        for _ in range(int(r.uniform(80, 260))):
            a += r.normal(0, 0.25)
            x, y = (x + np.cos(a) * 1.5) % N, (y + np.sin(a) * 1.5) % N
            crack[int(y), int(x)] = 1
            crack[int(y), int(x + 1) % N] = 1
    g -= crack * 0.14
    col = np.stack([g, g * 0.99, g * 0.97], -1)
    h = agg * 0.7 + big * 0.1 - crack * 0.6 + np.abs(patch) * 0.2
    rough = 0.82 + (agg - 0.5) * 0.12 - (patch > 0) * 0.08
    save('asphalt', col, h, 6.0, rough)


def earth():
    # compacted earth with gravel, small cracks and dry grass in the corners
    fine = noise(351, 0.5, lo=80)
    mid = noise(352, 1.6, lo=6, hi=60)
    big = noise(353, 2.8, lo=1, hi=6)
    r = rng(354)
    peb = np.zeros((N, N), np.float32)
    for _ in range(1400):
        x, y, s = r.integers(0, N), r.integers(0, N), r.uniform(1.0, 3.5)
        yy, xx = np.ogrid[-4:5, -4:5]
        k = np.clip(1 - (xx * xx + yy * yy) / (s * s), 0, 1)
        peb[np.ix_((np.arange(y - 4, y + 5)) % N, (np.arange(x - 4, x + 5)) % N)] += k * r.uniform(0.5, 1)
    peb = np.clip(peb, 0, 1)
    cell, edge, _ = voronoi(355, 60, jitter=1.0)
    dry = np.clip(1 - edge / 1.6, 0, 1) * np.clip((big - 0.45) * 4, 0, 1)        # cracks only in the dry parts
    grass = np.clip((noise(356, 2.2, lo=2, hi=20) - 0.66) * 5, 0, 1) * (fine > 0.45)
    g = 0.5 + (mid - 0.5) * 0.3 + (fine - 0.5) * 0.2 + (big - 0.5) * 0.25
    col = tint(np.clip(g, 0, 1), rgb(138, 122, 100), rgb(190, 172, 146))
    col = col * (1 - peb[..., None] * 0.45) + rgb(208, 196, 176) * (peb[..., None] * 0.45)
    col = col * (1 - dry[..., None] * 0.35) + rgb(96, 76, 56) * (dry[..., None] * 0.35)
    col = col * (1 - grass[..., None] * 0.7) + rgb(150, 142, 82) * (grass[..., None] * 0.7)
    h = fine * 0.3 + mid * 0.2 + peb * 0.7 - dry * 0.4 + grass * 0.2
    save('earth', col, h, 6.0)


def rooftiles():
    # Arab tiles (teja árabe) seen from above: alternating channels and covers, overlapping rows
    n = N
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    cols, rows = 8, 6
    u = (xx / n * cols) % 1.0
    v = (yy / n * rows) % 1.0
    ci = (xx / n * cols).astype(int)
    ri = (yy / n * rows).astype(int)
    cover = (ci % 2 == 0)
    prof = np.sin(np.pi * u)
    h = np.where(cover, 0.55 + prof * 0.45, 0.4 - prof * 0.25)
    lap = np.clip((v - 0.86) / 0.14, 0, 1)                     # the lower end of the tile above casts a lip
    h = h - lap * 0.25
    r = rng(361)
    tone = r.uniform(0, 1, (rows, cols))[ri, ci]
    a, b = rgb(150, 74, 46), rgb(200, 120, 78)
    col = tint(np.clip(tone * 0.7 + noise(362, 1.2, lo=10) * 0.3, 0, 1), a, b)
    lichen = np.clip((noise(363, 1.8, lo=4, hi=60) - 0.7) * 5, 0, 1)
    col = col * (1 - lichen[..., None] * 0.5) + rgb(170, 160, 120) * (lichen[..., None] * 0.5)
    col *= (0.65 + h * 0.4)[..., None]
    save('rooftiles', col, h, 12.0)


def azulejo():
    # glazed wall tiles with an original geometric motif (4 × 4 tiles per repeat), for shop plinths / benches
    n = N
    t = n // 4
    yy, xx = np.mgrid[0:n, 0:n]
    lu, lv = (xx % t) / t - 0.5, (yy % t) / t - 0.5
    ex = np.minimum(xx % t, t - 1 - xx % t)
    ey = np.minimum(yy % t, t - 1 - yy % t)
    edge = np.minimum(ex, ey).astype(np.float32)
    r2 = lu * lu + lv * lv
    ang = np.arctan2(lv, lu)
    petal = (np.abs(np.cos(ang * 4)) * 0.22 + 0.08 > np.sqrt(r2)).astype(np.float32)
    ring = (np.abs(np.sqrt(r2) - 0.36) < 0.035).astype(np.float32)
    corner = ((np.abs(lu) > 0.4) & (np.abs(lv) > 0.4)).astype(np.float32)
    white = rgb(236, 230, 214)
    blue, ochre = rgb(38, 78, 140), rgb(200, 146, 50)
    col = white[None, None, :] * np.ones((n, n, 1))
    col = col * (1 - petal[..., None]) + blue * petal[..., None]
    col = col * (1 - ring[..., None]) + ochre * ring[..., None]
    col = col * (1 - corner[..., None]) + blue * corner[..., None]
    craze = noise(371, 0.3, lo=120)
    col *= (0.96 + craze * 0.06)[..., None]
    grout = 1 - np.clip(edge / 2.0, 0, 1)
    col = col * (1 - grout[..., None] * 0.6) + rgb(160, 150, 136) * (grout[..., None] * 0.6)
    h = np.clip(edge / 3.0, 0, 1) * 0.8 + craze * 0.05
    rough = 0.18 + grout * 0.7
    save('azulejo', col, h, 4.0, rough)


def brick():
    # old handmade bricks (workshop walls, where the render fell off)
    n = N
    rows = 16
    rh = n // rows
    yy, xx = np.mgrid[0:n, 0:n]
    row = yy // rh
    bw = rh * 3
    off = (row % 2) * (bw // 2)
    bx = (xx + off) % bw
    ex = np.minimum(bx, bw - 1 - bx)
    ey = np.minimum(yy % rh, rh - 1 - yy % rh)
    edge = np.minimum(ex, ey).astype(np.float32)
    ids = row * 100 + (xx + off) // bw
    r = rng(381)
    per = r.uniform(0, 1, ids.max() + 1)[ids]
    surf = noise(382, 0.8, lo=30)
    col = tint(np.clip(per * 0.6 + surf * 0.4, 0, 1), rgb(140, 70, 46), rgb(196, 112, 74))
    mortar = 1 - np.clip(edge / 2.5, 0, 1)
    col = col * (1 - mortar[..., None] * 0.8) + rgb(196, 184, 160) * (mortar[..., None] * 0.8)
    h = np.clip(edge / 4.0, 0, 1) * 0.7 + surf * 0.3
    save('brick', col, h, 7.0)


def herring():
    # terracotta bricks (1 × 2) laid in herringbone: L-shaped steps along the diagonal; period 8 units
    n = N
    U = n // 8
    ids = np.full((n, n), -1, np.int32)
    edge = np.zeros((n, n), np.float32)
    cid = 0

    def put(x0, y0, w, h):
        nonlocal cid
        xs = np.arange(x0 * U, (x0 + w) * U) % n
        ys = np.arange(y0 * U, (y0 + h) * U) % n
        ex = np.minimum(np.arange(w * U), np.arange(w * U)[::-1])
        ey = np.minimum(np.arange(h * U), np.arange(h * U)[::-1])
        ids[np.ix_(ys, xs)] = cid
        edge[np.ix_(ys, xs)] = np.minimum(ey[:, None], ex[None, :])
        cid += 1
    for t in range(-8, 9):
        for k in range(-4, 5):
            put(t + 2 * k, t - 2 * k, 2, 1)
            put(t + 2 * k, t - 2 * k + 1, 1, 2)
    r = rng(391)
    tone = r.uniform(0, 1, cid + 1)[ids]
    surf = noise(392, 0.8, lo=30)
    col = tint(np.clip(tone * 0.65 + surf * 0.35, 0, 1), rgb(150, 78, 52), rgb(204, 120, 84))
    joint = 1 - np.clip(edge / 2.2, 0, 1)
    col = col * (1 - joint[..., None] * 0.7) + rgb(170, 150, 126) * (joint[..., None] * 0.7)
    col *= (0.9 + noise(393, 2.4, lo=1, hi=8) * 0.15)[..., None]
    h = np.clip(edge / 4.0, 0, 1) * 0.7 + surf * 0.3
    save('herring', col, h, 6.0)


def pebbles():
    # pebble mosaic (empedrado) with a rosette: one design per texture (mapped once over a forecourt)
    n = N
    cell, edge, cnt = voronoi(401, 5200, jitter=0.9)
    r = rng(402)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    cx = (xx - n / 2) / (n / 2); cy = (yy - n / 2) / (n / 2)
    rad = np.sqrt(cx * cx + cy * cy); ang = np.arctan2(cy, cx)
    star = (np.abs(np.cos(ang * 4)) ** 3 * 0.55 + 0.15 > rad).astype(np.float32)
    ring = (np.abs(rad - 0.78) < 0.05).astype(np.float32) + (np.abs(rad - 0.62) < 0.025).astype(np.float32)
    border = ((np.maximum(np.abs(cx), np.abs(cy)) > 0.92)).astype(np.float32)
    dark = np.clip(star + ring + border, 0, 1)
    # per pebble: take the pattern at its centre so pebbles are one colour
    ids = cell
    m = np.bincount(ids.ravel(), weights=dark.ravel(), minlength=cnt) / np.maximum(1, np.bincount(ids.ravel(), minlength=cnt))
    dk = (m[ids] > 0.5).astype(np.float32)
    tone = r.uniform(0, 1, cnt)[ids]
    light = tint(tone, rgb(196, 188, 170), rgb(232, 226, 210))
    darkc = tint(tone, rgb(46, 44, 42), rgb(86, 82, 76))
    col = light * (1 - dk[..., None]) + darkc * dk[..., None]
    joint = 1 - np.clip(edge / 1.4, 0, 1)
    col = col * (1 - joint[..., None] * 0.6) + rgb(150, 136, 112) * (joint[..., None] * 0.6)
    h = np.clip(edge / 3.0, 0, 1) ** 0.6
    save('pebbles', col, h, 7.0)


if __name__ == '__main__':
    only = set(sys.argv[1:])
    for f in (stucco, rubble, setts, slabs, asphalt, earth, rooftiles, azulejo, brick, herring, pebbles):
        if not only or f.__name__ in only:
            f(); print('ok', f.__name__)
    tot = sum(p.stat().st_size for p in OUT.glob('*.jpg'))
    print('TEXTURES', OUT, round(tot / 1024), 'KB')
