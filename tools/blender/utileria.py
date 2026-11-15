"""PUEBLO 4.0 F6b — cajas de madera, bidones y el depósito de agua (Blender, bpy). Sustituyen a los de PUEBLO 2.0 SOLO en
lo que se ve: cada pieza cabe en la caja de colisión / los triángulos de bala del objeto viejo (src/page.html), que no
cambian (ni el servidor ni core/mapdata.js).

  crate_a, crate_b, crate_c   caja de 1,2 m (vieja: cubo 1,2 m; colisión 1,2 × 1,2 × 1,2)
  drum_a, drum_b, drum_c      bidón de 200 l (viejo: cilindro r 0,36 × 1,0 m; colisión 0,72 × 1,0 × 0,72)
  water_tower                 depósito sobre 4 patas (viejo: patas 0,3 × 7 × 0,3 en ±1,4; tanque r 2,2 de 7,0 a 10,2;
                              tejado cónico r 2,4 hasta 11,4)

Todo hecho aquí por código (obra propia). Sin texto ni marcas.
Uso, desde la raíz del repositorio:   python3 tools/blender/utileria.py
Coordenadas del JUEGO (metros): y arriba; origen en el suelo, en el centro de la pieza.
"""
import sys, math, pathlib, json
import bpy, bmesh

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kit                                       # noqa: E402
import vehiculos as V                            # noqa: E402  (material con color de vértice, ruido, primitivas)

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / '3d' / 'models' / 'sd_p4_utileria.glb'
# límites que no se pueden pasar (radio en planta o media caja, altura)
LIM = {'crate': ('box', 0.6, 1.2), 'drum': ('round', 0.36, 1.0), 'water_tower': ('box', 2.4, 11.4)}


# ------------------------------------------------------------------ cajas de madera
def crate(name, v):
    p = V.CarPiece(name)
    H, S, T = 0.6, 0.575, 0.025                 # media caja, plano de las tablas, grosor de los listones
    R = V.noise
    p.box(-S + 0.005, 0.012, -S + 0.005, S - 0.005, 1.188, S - 0.005, 'dark', (0.30, 0.24, 0.18), skip='-y')   # lo que se ve por las rendijas
    n = 7; ph = (1.2 - 0.04) / n
    for face in range(4):                      # 0:+x 1:-x 2:+z 3:-z
        for k in range(n):
            if v.get('rota') == (face, k):
                continue                        # una tabla que falta: se ve el interior oscuro
            y0 = 0.02 + k * ph + 0.004; y1 = y0 + ph - 0.008
            t = 0.78 + 0.22 * R(k * 3.1 + face * 7.7 + v['seed'], 0.5, 1.3)          # cada tabla con su tono
            c = V.mix(tuple(t * q for q in v['pino']), (0.56, 0.54, 0.50), v['gris'])
            a0, a1 = -0.52, 0.52
            if face == 0: pts = [(S, y0, a1), (S, y0, a0), (S, y1, a0), (S, y1, a1)]
            elif face == 1: pts = [(-S, y0, a0), (-S, y0, a1), (-S, y1, a1), (-S, y1, a0)]
            elif face == 2: pts = [(a0, y0, S), (a1, y0, S), (a1, y1, S), (a0, y1, S)]
            else: pts = [(a1, y0, -S), (a0, y0, -S), (a0, y1, -S), (a1, y1, -S)]
            # la veta de la textura va a lo largo de la tabla: u = a lo ancho de la tabla, v = a lo largo
            uvs = [(q[1] * 1.0, (q[2] if face < 2 else q[0])) for q in pts]
            p.face(pts, 'wood', c, uvs)
    # tapa: tablas a lo largo de x
    for k in range(n):
        if v.get('tapa_rota') == k:
            continue
        z0 = -0.52 + k * (1.04 / n) + 0.004; z1 = z0 + 1.04 / n - 0.008
        t = 0.78 + 0.22 * R(k * 5.3 + v['seed'], 2.0, 0.4)
        c = V.mix(tuple(t * q for q in v['pino']), (0.60, 0.58, 0.54), min(1.0, v['gris'] + 0.3))
        pts = [(-0.52, 1.185, z0), (-0.52, 1.185, z1), (0.52, 1.185, z1), (0.52, 1.185, z0)]
        p.face(pts, 'wood', c, [(q[2], q[0]) for q in pts])
    lc = V.mix(v['liston'], (0.52, 0.50, 0.46), v['gris'] * 0.6)
    # postes de las esquinas
    for sx in (-1, 1):
        for sz in (-1, 1):
            x0, x1 = sorted((sx * (H - 0.1), sx * H)); z0, z1 = sorted((sz * (H - 0.1), sz * H))
            p.box(x0, 0.0, z0, x1, 1.2, z1, 'wood', lc, skip='-y')
    # listones arriba y abajo en cada cara, y el del medio (o una diagonal)
    for face in range(4):
        ax, sg = ('x', 1) if face == 0 else ('x', -1) if face == 1 else ('z', 1) if face == 2 else ('z', -1)
        for (y0, y1) in ((0.0, 0.11), (1.09, 1.2)) + (((0.545, 0.655),) if not v['diagonal'] else ()):
            if ax == 'x': p.box(sg * S, y0, -H + 0.1, sg * H, y1, H - 0.1, 'wood', lc, skip=('-x' if sg > 0 else '+x') + '-y')
            else: p.box(-H + 0.1, y0, sg * S, H - 0.1, y1, sg * H, 'wood', lc, skip=('-z' if sg > 0 else '+z') + '-y')
        if v['diagonal']:
            d = H - 0.028
            a, b = (-0.47, 0.13), (0.47, 1.07)
            if ax == 'x': V.strip(p, [(sg * d, a[1], a[0] * sg), (sg * d, b[1], b[0] * sg)], 0.027, 'wood', lc)
            else: V.strip(p, [(a[0] * sg, a[1], sg * d), (b[0] * sg, b[1], sg * d)], 0.027, 'wood', lc)
    # listones de la tapa
    for z in (-0.3, 0.3):
        p.box(-0.5, 1.185, z - 0.045, 0.5, 1.2, z + 0.045, 'wood', lc, skip='-y')
    return p


def crate_colour(co, n, v, base):
    """Suciedad abajo (salpicaduras y humedad) y manchas oscuras sobre el tono de cada tabla."""
    x, y, z = co
    sd = v['seed']
    n1 = V.fbm(x * 3 + sd, y * 3, z * 3)
    c = V.mix(base, (base[0] * 0.55, base[1] * 0.52, base[2] * 0.48), 0.75 * V.sstep(0.45, 0.0, y) * (0.6 + 0.6 * n1))
    c = V.mix(c, (base[0] * 0.7, base[1] * 0.68, base[2] * 0.66), 0.5 * V.sstep(0.6, 0.85, n1))
    return c


CRATES = {
    'crate_a': {'seed': 2, 'gris': 0.2, 'pino': (0.74, 0.58, 0.40), 'liston': (0.60, 0.46, 0.31), 'diagonal': False},
    'crate_b': {'seed': 9, 'gris': 0.4, 'pino': (0.66, 0.52, 0.37), 'liston': (0.50, 0.39, 0.28), 'diagonal': True},
    'crate_c': {'seed': 17, 'gris': 0.65, 'pino': (0.70, 0.57, 0.42), 'liston': (0.55, 0.45, 0.34), 'diagonal': False, 'rota': (2, 4), 'tapa_rota': 2},
}


# ------------------------------------------------------------------ bidones
def drum(name, v):
    p = V.CarPiece(name)
    R0, RH = 0.345, 0.358
    prof = [(0.33, 0.0), (RH, 0.006), (RH, 0.03), (R0, 0.042)]
    def span(ya, yb):
        k = max(1, round((yb - ya) / 0.14))
        return [(R0, ya + (yb - ya) * i / k) for i in range(1, k + 1)]
    prof += span(0.042, 0.31) + [(0.36, 0.322), (0.36, 0.342), (R0, 0.354)]
    prof += span(0.354, 0.636) + [(0.36, 0.648), (0.36, 0.668), (R0, 0.68)]
    prof += span(0.68, 0.94) + [(RH, 0.952), (RH, 0.98), (0.335, 0.98), (0.332, 0.962)]
    dent = v.get('abollado')
    segs = 16
    rings = []
    for (r, y) in prof:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            rr = r
            if dent and 0.05 < y < 0.93:        # una abolladura
                d = math.cos(a - dent[0]); rr -= dent[1] * max(0.0, d - 0.55) / 0.45 * math.sin(math.pi * (y - 0.05) / 0.88)
            ring.append((rr * math.cos(a), y, rr * math.sin(a)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        dr, dy = prof[k + 1][0] - prof[k][0], prof[k + 1][1] - prof[k][1]
        nr, ny = dy, -dr                         # normal del perfil (hacia fuera si el perfil sube)
        for i in range(segs):
            j = (i + 1) % segs
            q = [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]]
            am = 2 * math.pi * (i + 0.5) / segs
            cen = [sum(t[a] for t in q) / 4 for a in range(3)]
            ins = (cen[0] - 0.1 * nr * math.cos(am), cen[1] - 0.1 * ny, cen[2] - 0.1 * nr * math.sin(am))
            V.F(p, q, 'paint', (1, 1, 1), ins)
    V.F(p, rings[-1], 'paint', (1, 1, 1), (0, 0.0, 0))          # la tapa (hacia arriba)
    V.F(p, rings[0], 'dark', (0.4, 0.35, 0.3), (0, 1.0, 0))    # el fondo
    for (bx, bz, br) in ((0.2, 0.0, 0.035), (-0.21, 0.05, 0.026)):   # tapones
        p.lathe([(br, 0.0), (br, 0.014), (br * 0.75, 0.018)], bx, bz, 8, 'zinc', v['tapon'], y0=0.962, close_top=True)
    return p


def drum_colour(co, n, v):
    x, y, z = co
    sd = v['seed']
    r = math.hypot(x, z)
    base = v['pintura']
    n1 = V.fbm(x * 4 + sd, y * 4, z * 4); n2 = V.fbm(x * 11, y * 11 + sd, z * 11); n3 = V.fbm(x * 16 + sd, y * 1.1, z * 16)
    edge = 1.0 if r > 0.352 else 0.0                       # aros y bordes: la pintura saltada
    k = (0.4 - y) * 1.3 + edge * 0.9 + (n1 - 0.5) * 2.2 + (n2 - 0.5) * 0.8
    if n[1] > 0.6:                                         # la tapa: agua estancada, óxido por manchas grandes
        base = V.mix(base, (0.30, 0.25, 0.20), 0.3); k += 0.25 + (n1 - 0.4) * 1.6
    rust = V.sstep(0.25, 0.7, k * v['oxido'])
    c = V.mix(base, V.mix((0.44, 0.23, 0.10), (0.22, 0.12, 0.06), n2), rust)
    c = V.mix(c, (0.34, 0.20, 0.11), 0.65 * V.sstep(0.55, 0.75, n3) * (1 - rust))   # churretes
    c = V.mix(c, (0.62, 0.57, 0.48), 0.22 + 0.16 * n2)                               # polvo y sol: la pintura desteñida
    c = V.mix(c, (0.34, 0.28, 0.21), 0.65 * V.sstep(0.25, 0.0, y))                  # barro abajo
    return c


DRUMS = {
    'drum_a': {'seed': 4, 'pintura': (0.46, 0.20, 0.13), 'oxido': 1.35, 'tapon': (0.55, 0.5, 0.45)},
    'drum_b': {'seed': 13, 'pintura': (0.27, 0.35, 0.42), 'oxido': 1.2, 'tapon': (0.5, 0.48, 0.45), 'abollado': (0.8, 0.06)},
    'drum_c': {'seed': 21, 'pintura': (0.36, 0.38, 0.27), 'oxido': 1.5, 'tapon': (0.45, 0.42, 0.38)},
}


# ------------------------------------------------------------------ depósito de agua
L, LEG = 1.4, 0.15
TANK_Y0, TANK_Y1, TANK_R = 7.0, 10.2, 2.2


def water_tower(name):
    p = V.CarPiece(name)
    W = (1, 1, 1)
    # patas: perfil en H dentro de la caja de colisión de 0,3 × 0,3; una placa abajo
    for sx in (-1, 1):
        for sz in (-1, 1):
            cx, cz = sx * L, sz * L
            p.box(cx - 0.14, 0.0, cz - 0.14, cx + 0.14, 0.04, cz + 0.14, 'paint', W, skip='-y')
            for dz in (-0.125, 0.105):
                p.box(cx - 0.13, 0.04, cz + dz, cx + 0.13, TANK_Y0, cz + dz + 0.02, 'paint', W, skip='-y')
            p.box(cx - 0.012, 0.04, cz - 0.105, cx + 0.012, TANK_Y0, cz + 0.105, 'paint', W, skip='-y')
    # vigas bajo el tanque (de pata a pata) y en cruz
    for s in (-1, 1):
        p.box(-L, TANK_Y0 - 0.22, s * L - 0.07, L, TANK_Y0, s * L + 0.07, 'paint', W)
        p.box(s * L - 0.07, TANK_Y0 - 0.22, -L, s * L + 0.07, TANK_Y0, L, 'paint', W)
    p.box(-L, TANK_Y0 - 0.2, -0.06, L, TANK_Y0, 0.06, 'paint', W)
    p.box(-0.06, TANK_Y0 - 0.2, -L, 0.06, TANK_Y0, L, 'paint', W)
    # arriostramiento: cruces de redondo en dos tramos y riostras horizontales
    C = [(-L, -L), (L, -L), (L, L), (-L, L)]
    for i in range(4):
        a, b = C[i], C[(i + 1) % 4]
        for (y0, y1) in ((0.6, 3.7), (3.7, 6.75)):
            V.strip(p, [(a[0], y0, a[1]), (b[0], y1, b[1])], 0.022, 'paint', W, sides=4)
            V.strip(p, [(b[0], y0, b[1]), (a[0], y1, a[1])], 0.022, 'paint', W, sides=4)
        V.strip(p, [(a[0], 3.7, a[1]), (b[0], 3.7, b[1])], 0.045, 'paint', W, sides=4)
    # tanque: chapa con dos costuras remachadas, fondo plano, tejado cónico con alero
    segs = 28
    tank = []
    for y in [TANK_Y0 + i * 0.4 for i in range(9)]:          # cada 0,4 m, y las dos costuras remachadas
        for sy in (8.07, 9.13):
            if tank and tank[-1][1] < sy - 0.03 < y:
                tank += [(2.18, sy - 0.03), (2.2, sy - 0.02), (2.2, sy + 0.02), (2.18, sy + 0.03)]
        if not tank or y > tank[-1][1] + 0.05:
            tank.append((2.18, y))
    p.lathe([(r, y) for r, y in tank], 0, 0, segs, 'paint', W)
    # (el fondo lo cierra lathe; el tejado también cierra su alero por debajo)
    roof = [(2.4, TANK_Y1), (2.4, TANK_Y1 + 0.05), (1.8, 10.5), (1.2, 10.8), (0.6, 11.1), (0.2, 11.3)]
    p.lathe(roof, 0, 0, segs, 'paint', W)
    # respiradero arriba
    p.lathe([(0.2, 0), (0.12, 0.0), (0.12, 0.06), (0.2, 0.06), (0.05, 0.1)], 0, 0, 10, 'dark', (0.5, 0.45, 0.4), y0=11.3)
    # escalera junto a la pata (+x, +z): empieza a 2,6 m (sin el tramo de abajo, como en los de verdad) y sube por el tanque
    zl = 2.1
    for x in (0.73, 1.17):
        V.strip(p, [(x, 2.6, zl), (x, TANK_Y1 + 0.25, zl)], 0.022, 'paint', W, sides=4)
        for y in (3.0, 5.0):                    # soportes hasta la pata
            V.strip(p, [(x, y, zl), (L, y, L + 0.14)], 0.015, 'paint', W, sides=4)
    y = 2.75
    while y < TANK_Y1 + 0.1:
        V.strip(p, [(0.73, y, zl), (1.17, y, zl)], 0.014, 'paint', W, sides=4)
        y += 0.3
    return p


def tower_sub(e):
    """El tanque, el tejado y las vigas (por encima de 6,7 m) y las patas (dentro de su caja); NO los redondos de 2,2 cm
    ni la escalera, que quedan como en 2.0: finos, de pata a pata."""
    a, b = e.verts[0].co, e.verts[1].co                   # Blender: (x, -z, y)
    if a.z > 6.7 and b.z > 6.7:
        return True
    return abs(a.x - b.x) < 0.3 and abs(a.y - b.y) < 0.3 and abs(abs(a.x) - L) <= LEG and abs(abs(a.y) - L) <= LEG


def tower_colour(co, n, v=None):
    x, y, z = co
    r = math.hypot(x, z)
    n1 = V.fbm(x * 0.9 + 3, y * 0.9, z * 0.9); n2 = V.fbm(x * 3.5, y * 3.5 + 5, z * 3.5)
    n3 = V.fbm(x * 6.0 + 1, y * 0.35, z * 6.0)            # alargado en vertical: churretes
    if y >= TANK_Y0 - 0.001 and r > 2.0 or y > TANK_Y1:  # tanque y tejado: pintura verde gris desteñida
        base = (0.56, 0.60, 0.55) if y <= TANK_Y1 + 0.001 or r > 2.39 else (0.50, 0.52, 0.48)
        if n[1] > 0.5: base = V.mix(base, (0.62, 0.58, 0.52), 0.4)
        k = (n1 - 0.5) * 1.8 + (n2 - 0.5) * 0.7 + (0.4 if (abs(y - 8.07) < 0.06 or abs(y - 9.13) < 0.06) else 0)
        if n[1] < -0.5: k += 0.5
        rust = V.sstep(0.35, 0.8, k)
        c = V.mix(base, V.mix((0.46, 0.25, 0.12), (0.26, 0.14, 0.08), n2), rust)
        # churretes de óxido que bajan de las costuras y del alero
        st = V.sstep(0.58, 0.78, n3)
        c = V.mix(c, (0.40, 0.23, 0.12), 0.6 * st * (1 - rust))
        return c
    # acero de patas, vigas y escalera: oxidado, con restos de pintura
    k = (n2 - 0.5) * 1.6 + (n1 - 0.5) * 0.8 + 0.25
    c = V.mix((0.36, 0.33, 0.29), V.mix((0.42, 0.23, 0.11), (0.25, 0.14, 0.08), n1), V.sstep(0.2, 0.7, k))
    c = V.mix(c, (0.40, 0.34, 0.27), 0.5 * V.sstep(0.6, 0.0, y))     # polvo abajo
    return c


# ------------------------------------------------------------------ acabado: color por vértice (como en los vehículos)
def finish(o, fn, max_edge, mats=('paint', 'wood'), sub_ok=None):
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    idx = {i for i, m in enumerate(me.materials) if m.name.split('.')[0] in mats}
    if max_edge:
        for _ in range(6):
            long = [e for e in bm.edges if e.calc_length() > max_edge and any(f.material_index in idx for f in e.link_faces) and (not sub_ok or sub_ok(e))]
            if not long:
                break
            bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=False)
            bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4 and f.material_index in idx], quad_method='BEAUTY', ngon_method='BEAUTY')
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], quad_method='BEAUTY', ngon_method='BEAUTY')
    col = bm.loops.layers.color.get('Col')
    for f in bm.faces:
        if f.material_index not in idx:
            continue
        nb = f.normal; n = (nb.x, nb.z, -nb.y)
        for loop in f.loops:
            c = loop.vert.co
            loop[col] = (*fn((c.x, c.z, -c.y), n, tuple(loop[col][:3])), 1.0)
    bm.to_mesh(me); bm.free()


def check(o, kind):
    xs = [v.co.x for v in o.data.vertices]; zs = [-v.co.y for v in o.data.vertices]; ys = [v.co.z for v in o.data.vertices]
    shape, lim, top = LIM[kind]
    if shape == 'round':
        ok = max(math.hypot(x, z) for x, z in zip(xs, zs)) <= lim + 1e-4
    else:
        ok = max(max(map(abs, xs)), max(map(abs, zs))) <= lim + 1e-4
    ok = ok and max(ys) <= top + 1e-4 and min(ys) >= -1e-4
    if kind == 'water_tower':   # a la altura de los pies, solo las patas (y la tubería fina del centro): los redondos de 2,2 cm empiezan a 0,6 m, como en 2.0
        low = [(x, z) for x, z, y in zip(xs, zs, ys) if y < 0.55]
        ok = ok and all((abs(abs(x) - L) <= LEG + 1e-4 and abs(abs(z) - L) <= LEG + 1e-4) or math.hypot(x, z) < 0.1 for x, z in low)
    b = {'x': [round(min(xs), 3), round(max(xs), 3)], 'z': [round(min(zs), 3), round(max(zs), 3)], 'y': [round(min(ys), 3), round(max(ys), 3)]}
    if not ok:
        raise SystemExit('FUERA DE LA CAJA DE COLISIÓN: %s %s' % (o.name, b))
    return b


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit._MATS.clear()
    stats = {}
    todo = [(k, 'crate', lambda k=k, v=v: crate(k, v), lambda co, n, b, v=v: crate_colour(co, n, v, b), 0) for k, v in CRATES.items()]
    todo += [(k, 'drum', lambda k=k, v=v: drum(k, v), lambda co, n, b, v=v: drum_colour(co, n, v), 0) for k, v in DRUMS.items()]
    todo += [('water_tower', 'water_tower', lambda: water_tower('water_tower'), lambda co, n, b: tower_colour(co, n), 1.2)]
    for name, kind, make, colour, me in todo:
        o = make().build(smooth_angle=35)
        o.name = name; o.data.name = name
        finish(o, colour, me, sub_ok=tower_sub if kind == 'water_tower' else None)
        b = check(o, kind)
        stats[name] = {'tris': kit.tri_count(o), 'mats': [m.name for m in o.data.materials], 'bounds': b}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_apply=True, export_yup=True,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                              export_extras=False, export_cameras=False, export_lights=False, export_animations=False)
    (ROOT / 'tools' / 'blender' / 'utileria-stats.json').write_text(json.dumps(stats, indent=1))
    print('UTILERÍA', OUT, round(OUT.stat().st_size / 1024), 'KB')
    for k, s in stats.items():
        print('  %-12s %6d tri  %s  %s' % (k, s['tris'], ','.join(s['mats']), s['bounds']))


if __name__ == '__main__':
    main()
