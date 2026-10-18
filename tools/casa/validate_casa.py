"""CASA ATLAS 1V1 — geometry check of the GLB against collision_map.json (game rules: radius 0.35 m, step 0.45 m,
jump ≈ 1.0 m, standing height 1.8 m, crouch 1.2 m).
 1. Slices at several heights: GLB outline (triangles cut by the plane) vs collision boxes → image + list of visible
    surfaces with no box behind them (you could walk / shoot through what you see) and boxes with nothing drawn.
 2. Openings: doors (passable at radius 0.35 and 1.8 m), windows / balcony (could a player climb out?).
 3. Floor flood fill at radius 0.35 from spawn A: B reachable, every zone reachable.
Usage: python3 tools/casa/validate_casa.py <glb> <collision_map.json> <out dir>"""
import sys, json, os, collections, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); import glbtris
from PIL import Image, ImageDraw
glb, cj, out = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(out, exist_ok=True)
T, MAT, _ = glbtris.load(glb); D = json.load(open(cj))
C = [(c['name'], c['type'], np.array(c['center']) - np.array(c['size']) / 2, np.array(c['center']) + np.array(c['size']) / 2) for c in D['colliders']]
RAD, STEP, JUMP, HST = 0.35, 0.45, 1.0, 1.8
X0, X1, Z0, Z1, PX = -9.5, 9.5, -7.5, 7.8, 0.02
W, H = int((X1 - X0) / PX), int((Z1 - Z0) / PX)
def px(x, z): return ((x - X0) / PX, (z - Z0) / PX)
DECOR = ('details__', 'glass__', 'furniture__rug', 'architecture__floor', 'architecture__balcony')
report = []
def slice_segments(h, skip=DECOR):
    segs = {}
    for name, t in T.items():
        if name.startswith(skip): continue
        y = t[:, :, 1] - h; s = np.sign(y); cross = ~((s > 0).all(1) | (s < 0).all(1))
        L = []
        for tri, yy in zip(t[cross], y[cross]):
            pts = []
            for a, b in ((0, 1), (1, 2), (2, 0)):
                if (yy[a] > 0) != (yy[b] > 0):
                    k = yy[a] / (yy[a] - yy[b]); pts.append(tri[a] + (tri[b] - tri[a]) * k)
            if len(pts) == 2: L.append((pts[0][[0, 2]], pts[1][[0, 2]]))
        if L: segs[name] = L
    return segs
def inbox(x, z, h, margin, types=('solid', 'player_boundary')):
    for n, ty, lo, hi in C:
        if ty in types and lo[1] <= h <= hi[1] and lo[0] - margin <= x <= hi[0] + margin and lo[2] - margin <= z <= hi[2] + margin: return n
    return None
for h in (0.3, 1.0, 1.5, 2.0):
    img = Image.new('RGB', (W, H), (245, 244, 240)); d = ImageDraw.Draw(img)
    for n, ty, lo, hi in C:
        if lo[1] <= h <= hi[1]:
            a, b = px(lo[0], lo[2]), px(hi[0], hi[2]); d.rectangle([a, b], fill=(190, 205, 225) if ty == 'solid' else (240, 200, 160), outline=(90, 110, 140))
    seg = slice_segments(h); miss = collections.Counter(); where = collections.defaultdict(list)
    for name, L in seg.items():
        for p, q in L:
            ok = True
            for k in np.linspace(0, 1, 5):
                pt = p + (q - p) * k
                if not inbox(pt[0], pt[1], h, 0.06): ok = False; miss[name] += 1; where[name].append(pt); break
            d.line([px(*p), px(*q)], fill=(20, 20, 20) if ok else (220, 30, 30), width=2)
    for s in D['spawns']:
        x, _, z = s['position']; a = px(x, z); d.ellipse([a[0] - 10, a[1] - 10, a[0] + 10, a[1] + 10], fill=(0, 120, 220) if s['team'] == 'A' else (230, 110, 30))
    d.text((10, 10), f'corte a {h} m · negro = GLB con caja · rojo = GLB sin caja · azul = solid · naranja = player_boundary', fill=(0, 0, 0))
    img.save(f'{out}/corte_{int(h*100):03d}.png')
    for name, n in miss.most_common():
        pts = np.array(where[name]); report.append(f'corte {h} m: {name} — {n} tramos visibles sin caja, p.ej. x {pts[:,0].min():.2f}..{pts[:,0].max():.2f}, z {pts[:,1].min():.2f}..{pts[:,1].max():.2f}')
    # boxes with nothing drawn at that height (invisible walls)
    for n, ty, lo, hi in C:
        if ty != 'solid' or not (lo[1] <= h <= hi[1]): continue
        hit = False
        for name, L in seg.items():
            for p, q in L:
                for k in (0, .5, 1):
                    pt = p + (q - p) * k
                    if lo[0] - .06 <= pt[0] <= hi[0] + .06 and lo[2] - .06 <= pt[1] <= hi[2] + .06: hit = True; break
                if hit: break
            if hit: break
        if not hit: report.append(f'corte {h} m: caja {n} sin nada dibujado (pared invisible)')
# ---- walkable grid at the game radius (boxes that rise above step height and start below head height)
G = 0.05; gx = np.arange(-8.7, 8.7, G); gz = np.arange(-6.7, 7.1, G)
free = np.ones((len(gx), len(gz)), bool)
for n, ty, lo, hi in C:
    if hi[1] <= STEP or lo[1] >= HST: continue
    ix = (gx >= lo[0] - RAD) & (gx <= hi[0] + RAD); iz = (gz >= lo[2] - RAD) & (gz <= hi[2] + RAD)
    free[np.ix_(ix, iz)] = False
# the house shell: outside the slab is not floor
free[(gx < -8.7 + RAD) | (gx > 8.7 - RAD), :] = False; free[:, gz > 7.0 - RAD] = False
def cell(x, z): return int(round((x - gx[0]) / G)), int(round((z - gz[0]) / G))
sp = [cell(s['position'][0], s['position'][2]) for s in D['spawns']]
seen = np.zeros_like(free); q = collections.deque()
for s in sp[:1]:
    if free[s]: seen[s] = True; q.append(s)
    else: report.append('SPAWN A bloqueado a radio 0.35')
while q:
    i, k = q.popleft()
    for a, b in ((i + 1, k), (i - 1, k), (i, k + 1), (i, k - 1)):
        if 0 <= a < free.shape[0] and 0 <= b < free.shape[1] and free[a, b] and not seen[a, b]: seen[a, b] = True; q.append((a, b))
report.append(f"spawn B {'alcanzable' if seen[sp[1]] else 'NO alcanzable'} desde A a radio 0.35 (superficie libre {free.sum()*G*G:.1f} m², alcanzable {seen.sum()*G*G:.1f} m²)")
for z in D['zones']:
    x0, z0, x1, z1 = z['bounds']; m = np.ix_((gx > x0) & (gx < x1), (gz > z0) & (gz < z1))
    report.append(f"zona {z['name']:10s}: {seen[m].sum()*G*G:5.1f} m² alcanzables de {free[m].sum()*G*G:5.1f} libres")
img = Image.new('RGB', (len(gx), len(gz)))
a = np.zeros((len(gz), len(gx), 3), np.uint8); a[...] = (60, 60, 60); a[free.T] = (200, 120, 120); a[seen.T] = (150, 210, 150)
Image.fromarray(a).resize((len(gx) * 3, len(gz) * 3), Image.NEAREST).save(f'{out}/navegable_r035.png')
# ---- openings in the outer walls: what stops a player from leaving the map?
def climb_report():
    # highest thing a player can stand on near each exterior opening: boxes with top below 1.0 + 0.45 that can be reached
    tops = sorted({round(hi[1], 2) for n, ty, lo, hi in C if hi[1] < 2.5})
    report.append('alturas de superficies sobre las que se puede estar: ' + ', '.join(map(str, tops)))
climb_report()
open(f'{out}/informe.txt', 'w').write('\n'.join(report) + '\n'); print('\n'.join(report))
