"""PUEBLO 4.0 — vehículos abandonados (Blender, bpy). Sustituyen a los coches de PUEBLO 2.0 SOLO en lo que se ve.

Salida: assets/3d/models/sd_p4_vehiculos.glb con tres piezas (car_wreck_a, car_wreck_b, car_wreck_c) que el juego
coloca con el kit (client/kit3d.js, mismas reglas de materiales por nombre) cuando PUEBLO 4.0 está activo.

Por qué una pick-up 4x4 vieja con lona y no un turismo: la caja de colisión y los triángulos de bala de los coches viejos
(lo que usa el servidor) son una carrocería de 4,2 × 1,9 m hasta 1,2 m de alto y una cabina de 2,2 m hasta 1,9 m.
Un turismo de verdad mide 1,4 m: por encima del techo quedaría medio metro de pared invisible (cobertura falsa).
Una pick-up de campo con la caja tapada por una lona llena exactamente esa forma. Todo queda dentro de la caja.

Todo hecho aquí por código (obra propia, sin modelos ni texturas de terceros). Sin marcas ni texto en la matrícula.
Uso, desde la raíz del repositorio:   python3 tools/blender/vehiculos.py
Marco de la pieza (coordenadas del JUEGO, metros): x a lo largo (morro en +x), y arriba, z a lo ancho; origen en el
suelo, en el centro (como el grupo del coche viejo en src/page.html, que gira con la misma ry).
"""
import sys, math, pathlib, json
import bpy, bmesh
from mathutils import Vector

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kit                                   # noqa: E402  (Piece, materiales con color de vértice)
from kit import Piece                        # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / '3d' / 'models' / 'sd_p4_vehiculos.glb'

# límites que no se pueden pasar: la caja de colisión del coche viejo (src/page.html, car())
LIM = {'x': 2.1, 'z': 0.95, 'y': 1.9}

kit.MAT_BASE.update({'paint': (1, 1, 1), 'clothv': (1, 1, 1)})
_VC = {'paint', 'clothv', 'metal', 'dark', 'ceramic', 'iron', 'zinc'}
_orig_material = kit.material


def material(name):
    """Como kit.material, pero con el color de vértice también en la pintura, la goma y los cromados."""
    if name in kit._MATS:
        return kit._MATS[name]
    m = _orig_material(name)
    if name in _VC and not any(n.type == 'VERTEX_COLOR' for n in m.node_tree.nodes):
        b = m.node_tree.nodes.get('Principled BSDF')
        vc = m.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
        m.node_tree.links.new(vc.outputs['Color'], b.inputs['Base Color'])
    return m


kit.material = material


# ------------------------------------------------------------------ ruido (manchas de óxido, polvo, desgaste)
def _h(ix, iy, iz):
    n = (ix * 374761393 + iy * 668265263 + iz * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0


def noise(x, y, z):
    ix, iy, iz = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    s = lambda t: t * t * (3 - 2 * t)
    ux, uy, uz = s(fx), s(fy), s(fz)
    def L(a, b, t): return a + (b - a) * t
    c = [[[_h(ix + i, iy + j, iz + k) for k in (0, 1)] for j in (0, 1)] for i in (0, 1)]
    return L(L(L(c[0][0][0], c[0][0][1], uz), L(c[0][1][0], c[0][1][1], uz), uy),
             L(L(c[1][0][0], c[1][0][1], uz), L(c[1][1][0], c[1][1][1], uz), uy), ux)


def fbm(x, y, z):
    return 0.6 * noise(x, y, z) + 0.3 * noise(x * 2.3 + 7, y * 2.3, z * 2.3) + 0.1 * noise(x * 5.1, y * 5.1 + 3, z * 5.1)


def sstep(a, b, t):
    t = max(0.0, min(1.0, (t - a) / (b - a)))
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


# ------------------------------------------------------------------ primitivas orientadas (normal hacia fuera)
def F(p, pts, mat, col, inside):
    """Una cara con la normal apuntando lejos del punto interior `inside`."""
    a, b, c = Vector(pts[0]), Vector(pts[1]), Vector(pts[2])
    n = (b - a).cross(c - a)
    if n.length < 1e-12 and len(pts) > 3:
        c = Vector(pts[3]); n = (b - a).cross(c - a)
    cen = sum((Vector(q) for q in pts), Vector()) / len(pts)
    if n.dot(cen - Vector(inside)) < 0:
        pts = list(reversed(pts))
    p.face(pts, mat, col)


def prism_z(p, prof, z0, z1, mat, col=(1, 1, 1), inside=None, caps=True):
    """Perfil [(x, y)…] (cerrado) extruido a lo ancho, de z0 a z1."""
    cx = sum(q[0] for q in prof) / len(prof); cy = sum(q[1] for q in prof) / len(prof)
    ins = inside or (cx, cy, (z0 + z1) / 2)
    n = len(prof)
    for i in range(n):
        (xa, ya), (xb, yb) = prof[i], prof[(i + 1) % n]
        if abs(xa - xb) + abs(ya - yb) < 1e-6:
            continue
        # la normal de un lado del perfil: hacia fuera del perfil (no hacia su centro, que falla en los arcos)
        d = Vector((xb - xa, yb - ya, 0)); out = Vector((d.y, -d.x, 0))
        mid = Vector(((xa + xb) / 2, (ya + yb) / 2, (z0 + z1) / 2))
        pts = [(xa, ya, z0), (xb, yb, z0), (xb, yb, z1), (xa, ya, z1)]
        F(p, pts, mat, col, tuple(mid - out * (1 if _ccw(prof) else -1)))
    if caps:
        F(p, [(x, y, z1) for (x, y) in prof], mat, col, (cx, cy, z0 - 1))
        F(p, [(x, y, z0) for (x, y) in prof], mat, col, (cx, cy, z1 + 1))


def _ccw(prof):
    return sum(prof[i][0] * prof[(i + 1) % len(prof)][1] - prof[(i + 1) % len(prof)][0] * prof[i][1] for i in range(len(prof))) > 0


def revolve(p, prof, c, axis, segs, mat, col=(1, 1, 1), squash=None):
    """Perfil [(r, t)…] girado alrededor de un eje ('x' o 'z') que pasa por c; t = posición a lo largo del eje.
    Las normales miran lejos del centro de la pieza (el eje, en la t media del perfil)."""
    def P(r, t, a):
        u, v = r * math.cos(a), r * math.sin(a)
        q = [c[0] + u, c[1] + v, c[2] + t] if axis == 'z' else [c[0] + t, c[1] + v, c[2] + u]
        if squash and q[1] < squash[0]:          # rueda pinchada: aplastada abajo y abombada hacia los lados
            k = squash[0] - q[1]; q[1] = squash[0] - k * 0.25
            ax = 2 if axis == 'z' else 0
            q[ax] += (q[ax] - c[ax]) * min(0.35, k * 2.2)
        return tuple(q)
    tm = sum(t for _, t in prof) / len(prof)
    ins = (c[0], c[1], c[2] + tm) if axis == 'z' else (c[0] + tm, c[1], c[2])
    rings = [[P(r, t, 2 * math.pi * i / segs) for i in range(segs)] for (r, t) in prof]
    for k in range(len(prof) - 1):
        r0, r1 = prof[k][0], prof[k + 1][0]
        for i in range(segs):
            j = (i + 1) % segs
            pts = [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]]
            if r0 < 1e-6: pts = [rings[k][i], rings[k + 1][j], rings[k + 1][i]]
            elif r1 < 1e-6: pts = [rings[k][i], rings[k][j], rings[k + 1][i]]
            F(p, pts, mat, col, ins)


def disc(p, c, axis, r, segs, mat, col, out):
    """Un disco plano (tapa) perpendicular al eje, mirando a `out` (+1/-1)."""
    pts = []
    for i in range(segs):
        a = 2 * math.pi * i / segs; u, v = r * math.cos(a), r * math.sin(a)
        pts.append((c[0] + u, c[1] + v, c[2]) if axis == 'z' else (c[0], c[1] + v, c[2] + u))
    ins = (c[0], c[1], c[2] - out) if axis == 'z' else (c[0] - out, c[1], c[2])
    F(p, pts, mat, col, ins)


class CarPiece(Piece):
    def box(self, x0, y0, z0, x1, y1, z1, mat, col=(1, 1, 1), skip=''):
        x0, x1 = min(x0, x1), max(x0, x1); y0, y1 = min(y0, y1), max(y0, y1); z0, z1 = min(z0, z1), max(z0, z1)
        Piece.box(self, x0, y0, z0, x1, y1, z1, mat, col, skip)


def strip(p, pts3, r, mat, col=(1, 1, 1), sides=4):
    p.tube(pts3, r, mat, col, sides=sides, caps=True)


# ------------------------------------------------------------------ el vehículo
WHEELS = [(1.35, 1), (1.35, -1), (-1.35, 1), (-1.35, -1)]
WR, WY, WZ, WHW = 0.37, 0.37, 0.80, 0.12          # radio, altura del eje, centro de la rueda a lo ancho, media anchura
BODY_Y0, BELT, ROOF = 0.42, 1.13, 1.885
ZB, ZC = 0.925, 0.875                              # media anchura de la carrocería y de la cabina
CAB_X0, CAB_X1, WS_TOP = -1.30, 0.88, 0.80         # cabina: trasera, base del parabrisas, arriba del parabrisas


def arch(cx, steps=12):
    R = 0.5; dy = BODY_Y0 - WY
    a0, a1 = math.atan2(dy, -math.sqrt(R * R - dy * dy)), math.atan2(dy, math.sqrt(R * R - dy * dy))
    return [(cx + R * math.cos(a0 + (a1 - a0) * i / steps), WY + R * math.sin(a0 + (a1 - a0) * i / steps)) for i in range(steps + 1)]


def side_profile():
    """Perfil lateral de la carrocería baja (CCW visto desde +z): con los pasos de rueda."""
    pr = [(-1.975, BODY_Y0)] + arch(-1.35) + arch(1.35) + [(1.975, BODY_Y0), (2.0, 0.5), (2.0, 1.09), (1.975, BELT),
                                                         (-1.975, BELT), (-2.0, 1.09), (-2.0, 0.5)]
    return pr


def build_car(name, v):
    p = CarPiece(name)
    W = (1, 1, 1)
    # carrocería baja: aletas, puertas y caja de carga en una pieza (los paneles se separan con juntas)
    prism_z(p, side_profile(), -ZB, ZB, 'paint', W)
    # capó un poco abombado y rejilla de ventilación
    p.box(0.92, BELT, -0.84, 1.96, BELT + 0.035, 0.84, 'paint', W, skip='-y')
    for k in range(5):
        x = 1.05 + k * 0.05; p.box(x, BELT + 0.035, -0.55, x + 0.02, BELT + 0.045, -0.25, 'dark', (0.6, 0.6, 0.6), skip='-y')
    # bajos: largueros, ejes, depósito y escape (lo que se ve por debajo; la caja de bala empieza a 0,3 m)
    p.box(-1.9, 0.3, -0.5, 1.9, BODY_Y0, -0.38, 'dark', (0.55, 0.5, 0.45))
    p.box(-1.9, 0.3, 0.38, 1.9, BODY_Y0, 0.5, 'dark', (0.55, 0.5, 0.45))
    p.box(-0.9, 0.3, -0.3, -0.2, BODY_Y0, 0.25, 'dark', (0.7, 0.62, 0.52))
    for x, s in WHEELS[::2]:
        strip(p, [(x, WY, -WZ + 0.12), (x, WY, WZ - 0.12)], 0.05, 'dark', (0.5, 0.45, 0.4))
    strip(p, [(-1.0, 0.33, 0.6), (-1.6, 0.33, 0.62), (-2.02, 0.31, 0.62)], 0.03, 'zinc', (0.6, 0.45, 0.32), sides=5)
    # cabina: techo, pilares, trasera con luneta
    p.box(CAB_X0, ROOF - 0.05, -ZC, WS_TOP - 0.02, ROOF, ZC, 'paint', W)
    for s in (-1, 1):
        z = s * (ZC - 0.03)
        strip(p, [(CAB_X1 - 0.01, BELT, z), (WS_TOP, ROOF - 0.04, z)], 0.035, 'paint', W)                 # pilar A
        p.box(-0.32, BELT, z - 0.03, -0.25, ROOF - 0.04, z + 0.03, 'paint', W)                          # pilar B
        p.box(CAB_X0, BELT, z - 0.03, CAB_X0 + 0.07, ROOF - 0.04, z + 0.03, 'paint', W)                 # pilar C
        p.box(CAB_X0, ROOF - 0.06, s * ZC - 0.012, WS_TOP - 0.02, ROOF - 0.035, s * ZC + 0.012, 'dark', (0.5, 0.5, 0.5))  # canalón
    # trasera de la cabina: marco y luneta
    p.box(CAB_X0, BELT, -ZC, CAB_X0 + 0.04, BELT + 0.24, ZC, 'paint', W)
    p.box(CAB_X0, ROOF - 0.14, -ZC, CAB_X0 + 0.04, ROOF - 0.04, ZC, 'paint', W)
    for s in (-1, 1):
        p.box(CAB_X0, BELT + 0.24, s * 0.56 - (0 if s > 0 else 0.32), CAB_X0 + 0.04, ROOF - 0.14, s * 0.56 + (0.32 if s > 0 else 0), 'paint', W)
    if v['luneta']:
        F(p, [(CAB_X0 - 0.005, BELT + 0.24, -0.56), (CAB_X0 - 0.005, BELT + 0.24, 0.56), (CAB_X0 - 0.005, ROOF - 0.14, 0.56), (CAB_X0 - 0.005, ROOF - 0.14, -0.56)], 'glass', W, (0, 1.5, 0))
    # parabrisas (con marco), lunas laterales; una rota en algunas
    F(p, [(CAB_X1 - 0.02, BELT + 0.04, -ZC + 0.07), (CAB_X1 - 0.02, BELT + 0.04, ZC - 0.07), (WS_TOP + 0.01, ROOF - 0.07, ZC - 0.07), (WS_TOP + 0.01, ROOF - 0.07, -ZC + 0.07)], 'glass', W, (0, 1.5, 0))
    p.box(CAB_X1 - 0.06, BELT, -ZC, CAB_X1 + 0.02, BELT + 0.05, ZC, 'paint', W)
    for s in (-1, 1):
        z = s * (ZC - 0.012)
        broken = v['rota'] == s
        fr = [(-0.25, BELT + 0.03), (CAB_X1 - 0.06, BELT + 0.03), (WS_TOP + 0.03, ROOF - 0.08), (-0.25, ROOF - 0.08)]
        if not broken:
            F(p, [(x, y, z) for x, y in fr], 'glass', W, (0, 1.5, 0))
        else:   # cristales rotos: solo quedan picos abajo
            xs = [-0.25, -0.1, 0.05, 0.22, 0.38, 0.55, 0.7, CAB_X1 - 0.06]
            hs = [0.08, 0.2, 0.06, 0.14, 0.03, 0.17, 0.07, 0.05]
            for i in range(len(xs) - 1):
                F(p, [(xs[i], BELT + 0.03, z), (xs[i + 1], BELT + 0.03, z), ((xs[i] + xs[i + 1]) / 2, BELT + 0.03 + hs[i], z)], 'glass', W, (0, 1.5, 0))
        F(p, [(CAB_X0 + 0.07, BELT + 0.03, z), (-0.32, BELT + 0.03, z), (-0.32, ROOF - 0.08, z), (CAB_X0 + 0.07, ROOF - 0.08, z)], 'glass', W, (0, 1.5, 0))
    # interior: banco, respaldo, salpicadero y volante (se ve por las lunas)
    p.box(-1.2, BELT, -0.78, -0.5, BELT + 0.14, 0.78, 'dark', (0.85, 0.72, 0.6))
    p.box(-1.24, BELT + 0.1, -0.78, -1.1, 1.72, 0.78, 'dark', (0.85, 0.72, 0.6))
    p.box(0.6, BELT, -0.84, CAB_X1 - 0.06, BELT + 0.2, 0.84, 'dark', W)
    ring = []
    U = Vector((0.45, 0.89, 0)).normalized()
    for i in range(13):
        a = 2 * math.pi * i / 12
        q = Vector((0.42, BELT + 0.33, 0.4)) + Vector((0, 0, 0.19 * math.cos(a))) + U * 0.19 * math.sin(a)
        ring.append(tuple(q))
    strip(p, ring, 0.016, 'dark', W)
    strip(p, [(0.42, BELT + 0.33, 0.4), (0.62, BELT + 0.14, 0.4)], 0.025, 'dark', W)
    # juntas de puertas y paneles, moldura lateral, manetas y retrovisores
    for s in (-1, 1):
        z = s * (ZB + 0.004)
        for x in (CAB_X1 - 0.03, -0.27, CAB_X0 + 0.02):
            p.box(x - 0.006, BODY_Y0 + 0.04, z - 0.002 * s, x + 0.006, BELT - 0.01, z, 'dark', (0.4, 0.4, 0.4), skip='')
        p.box(-1.96, 0.83, s * ZB, 1.96, 0.87, s * (ZB + 0.015), 'dark', (0.7, 0.7, 0.7))
        p.box(-0.42, 1.0, s * ZB, -0.33, 1.03, s * (ZB + 0.02), 'zinc', W)
        p.box(CAB_X1 - 0.08, BELT + 0.1, s * (ZC + 0.0), CAB_X1 - 0.03, BELT + 0.13, s * 0.94, 'dark', W)
        p.box(CAB_X1 - 0.1, BELT + 0.13, s * 0.905, CAB_X1 - 0.02, BELT + 0.29, s * 0.945, 'dark', W)
        for x, _ in WHEELS[::2]:   # cejas de los pasos de rueda
            pts = [(cx, cy, s * (ZB + 0.006)) for cx, cy in arch(x, 10)]
            strip(p, pts, 0.018, 'dark', (0.6, 0.6, 0.6), sides=4)
    # morro: rejilla, faros redondos, intermitentes, paragolpes de hierro, matrícula sin texto
    p.box(1.985, 0.64, -0.56, 2.015, 1.06, 0.56, 'dark', W)
    for k in range(13):
        z = -0.5 + k * (1.0 / 12)
        p.box(2.012, 0.67, z - 0.012, 2.03, 1.03, z + 0.012, 'zinc', (0.75, 0.72, 0.66))
    for s in (-1, 1):
        zc = s * 0.73
        revolve(p, [(0.0, -0.03), (0.125, -0.03), (0.125, 0.025), (0.1, 0.03)], (1.995, 0.89, zc), 'x', 14, 'zinc', (0.8, 0.78, 0.72))
        lens = (0.12, 0.11, 0.1) if v['faro'] == s else (0.93, 0.9, 0.78)
        disc(p, (2.026, 0.89, zc), 'x', 0.1, 14, 'ceramic', lens, 1)
        p.box(1.99, 0.69, zc - 0.07, 2.025, 0.75, zc + 0.07, 'ceramic', (0.9, 0.5, 0.12))
        p.box(-2.025, 0.86, s * 0.71, -1.99, 1.03, s * 0.87, 'ceramic', (0.55, 0.07, 0.05))
        p.box(-2.025, 0.79, s * 0.71, -1.99, 0.86, s * 0.87, 'ceramic', (0.88, 0.48, 0.12))
    for s in (-1, 1):
        x0, x1 = (2.0, 2.075) if s > 0 else (-2.075, -2.0)
        p.box(x0, 0.44, -0.93, x1, 0.6, 0.93, 'zinc', (0.55, 0.45, 0.38))
        xp = x1 + 0.006 if s > 0 else x0 - 0.006
        F(p, [(xp, 0.47, -0.26), (xp, 0.47, 0.26), (xp, 0.575, 0.26), (xp, 0.575, -0.26)], 'ceramic', (0.86, 0.85, 0.8), (xp - s, 0.5, 0))
    # portón trasero: junta y bisagras
    p.box(-2.004, 0.5, -0.86, -2.0, 1.1, -0.85, 'dark', W)
    p.box(-2.004, 0.5, 0.85, -2.0, 1.1, 0.86, 'dark', W)
    # lona sobre la caja de carga (hasta 1,2 m, la altura de la caja de bala)
    nx, nz = 7, 9
    xs = [-1.985 + (CAB_X0 - 0.01 + 1.985) * i / nx for i in range(nx + 1)]
    zs = [-(ZB + 0.008) + 2 * (ZB + 0.008) * j / nz for j in range(nz + 1)]
    def ty(x, z):
        bow = 0.5 + 0.5 * math.cos((x + 1.985) / (CAB_X0 + 1.985) * math.pi * 2 * 1.5) ** 2
        return BELT + 0.012 + 0.055 * (1 - (abs(z) / (ZB + 0.01)) ** 3) * (0.75 + 0.25 * bow)
    for i in range(nx):
        for j in range(nz):
            q = [(xs[i], ty(xs[i], zs[j]), zs[j]), (xs[i + 1], ty(xs[i + 1], zs[j]), zs[j]), (xs[i + 1], ty(xs[i + 1], zs[j + 1]), zs[j + 1]), (xs[i], ty(xs[i], zs[j + 1]), zs[j + 1])]
            k = fbm(xs[i] * 3, 0, zs[j] * 3)
            F(p, q, 'clothv', mix(v['lona'], (0.62, 0.6, 0.5), 0.35 * k), (xs[i], 0, zs[j]))
    for s in (-1, 1):   # la lona cae por los lados y por detrás, atada
        z = s * (ZB + 0.008)
        for i in range(nx):
            F(p, [(xs[i], BELT - 0.07, z), (xs[i + 1], BELT - 0.07, z), (xs[i + 1], ty(xs[i + 1], z), z), (xs[i], ty(xs[i], z), z)], 'clothv', mix(v['lona'], (0.2, 0.2, 0.15), 0.25), (xs[i], 1.0, 0))
    F(p, [(-1.993, BELT - 0.07, -ZB), (-1.993, BELT - 0.07, ZB), (-1.993, ty(-1.985, ZB), ZB), (-1.993, ty(-1.985, 0), 0), (-1.993, ty(-1.985, -ZB), -ZB)], 'clothv', mix(v['lona'], (0.2, 0.2, 0.15), 0.25), (-1.5, 1.0, 0))
    # sombra de contacto en el suelo, debajo (oscura y algo más pequeña que la huella)
    F(p, [(-1.95, 0.008, -0.86), (1.95, 0.008, -0.86), (1.95, 0.008, 0.86), (-1.95, 0.008, 0.86)], 'dark', (0.25, 0.25, 0.25), (0, -1, 0))
    # ruedas: cubierta, llanta de acero, buje; una pinchada en algunas
    for x, s in WHEELS:
        zc = s * WZ; flat = v['pinchada'] == (x, s)
        prof = [(0.22, -WHW), (0.31, -WHW), (WR - 0.012, -WHW + 0.035), (WR, -WHW + 0.07), (WR, WHW - 0.07), (WR - 0.012, WHW - 0.035), (0.31, WHW), (0.22, WHW)]
        revolve(p, prof, (x, WY, zc), 'z', 16, 'dark', (0.9, 0.86, 0.8), squash=(0.06, 0) if flat else None)
        rim_out = s * (WHW - 0.025)
        revolve(p, [(0.22, -WHW + 0.02), (0.22, WHW - 0.02)], (x, WY, zc), 'z', 18, 'zinc', v['llanta'])
        disc(p, (x, WY, zc + rim_out), 'z', 0.22, 18, 'zinc', v['llanta'], s)
        disc(p, (x, WY, zc - rim_out), 'z', 0.22, 18, 'zinc', v['llanta'], -s)
        revolve(p, [(0.08, 0), (0.08, 0.03 * s), (0.0, 0.035 * s)], (x, WY, zc + rim_out), 'z', 10, 'zinc', mix(v['llanta'], (0.3, 0.2, 0.12), 0.5))
    return p


VARIANTS = {
    # pintura (sRGB), óxido (0..1), lona, llanta, luna rota (lado), faro roto (lado), rueda pinchada, luneta
    'car_wreck_a': {'pintura': (0.44, 0.46, 0.37), 'techo': (0.74, 0.72, 0.64), 'oxido': 1.0, 'lona': (0.40, 0.39, 0.29), 'llanta': (0.46, 0.44, 0.40), 'rota': 1, 'faro': -1, 'pinchada': (1.35, 1), 'luneta': True, 'seed': 3},
    'car_wreck_b': {'pintura': (0.66, 0.60, 0.49), 'techo': None, 'oxido': 0.85, 'lona': (0.31, 0.32, 0.28), 'llanta': (0.30, 0.29, 0.27), 'rota': 0, 'faro': 0, 'pinchada': (-1.35, -1), 'luneta': True, 'seed': 11},
    'car_wreck_c': {'pintura': (0.43, 0.48, 0.51), 'techo': (0.72, 0.71, 0.66), 'oxido': 1.15, 'lona': (0.47, 0.41, 0.31), 'llanta': (0.48, 0.46, 0.42), 'rota': -1, 'faro': 1, 'pinchada': None, 'luneta': False, 'seed': 29},
}


def paint_colour(co, n, v):
    """El color de la pintura en un punto: desteñida arriba, óxido abajo y en los pasos de rueda, polvo y barro."""
    x, y, z = co
    sd = v['seed']
    base = v['pintura']
    if v['techo'] and y > ROOF - 0.07:
        base = v['techo']
    if n[1] > 0.6:                                    # arriba: el sol la destiñe
        base = mix(base, (0.86, 0.83, 0.75), 0.3)
    n1 = fbm(x * 2.2 + sd, y * 2.2, z * 2.2)
    n2 = fbm(x * 7.0, y * 7.0 + sd, z * 7.0)
    n3 = fbm(x * 11.0 + sd, y * 0.9, z * 11.0)          # alargado en vertical: churretes
    near = min(math.hypot(x - wx, y - WY) for wx, _ in WHEELS)
    r = (0.85 - y) * 1.1 + sstep(0.8, 0.5, near) * 0.7 + (n1 - 0.5) * 1.9 + (n2 - 0.5) * 0.7
    if n[1] > 0.6:
        r += (n1 - 0.4) * 1.5                          # óxido también en el techo y el capó, por manchas
    rust = sstep(0.3, 0.75, r * v['oxido'])
    rc = mix((0.40, 0.21, 0.10), (0.22, 0.12, 0.07), n2)
    c = mix(base, rc, rust)
    if abs(n[1]) < 0.5 and 0.5 < y < BELT:            # churretes de óxido bajo la línea de cintura y las juntas
        c = mix(c, (0.33, 0.2, 0.12), 0.45 * sstep(0.62, 0.8, n3) * sstep(0.5, 0.9, y))
    c = mix(c, (0.70, 0.64, 0.53), 0.08 + 0.1 * n2)                                # una capa de polvo en todo
    if n[1] > 0.6:                                                                   # mucho más encima
        c = mix(c, (0.76, 0.69, 0.56), 0.5 * sstep(0.25, 0.75, n2 + 0.15))
    c = mix(c, (0.36, 0.31, 0.25), 0.6 * sstep(0.9, 0.42, y))                       # barro abajo
    return c


def finish(o, v, max_edge=0.55):
    """Subdivide los paneles de pintura y pinta cada vértice (óxido y polvo en manchas, no por caras)."""
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    paint = [i for i, m in enumerate(me.materials) if m.name.split('.')[0] == 'paint']
    pi = paint[0] if paint else -1
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if f.material_index == pi], quad_method='BEAUTY', ngon_method='BEAUTY')
    for _ in range(7):
        long = [e for e in bm.edges if e.calc_length() > max_edge and any(f.material_index == pi for f in e.link_faces)]
        if not long:
            break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3 and f.material_index == pi], quad_method='BEAUTY', ngon_method='BEAUTY')
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], quad_method='BEAUTY', ngon_method='BEAUTY')
    col = bm.loops.layers.color.get('Col') or bm.loops.layers.color.new('Col')
    for f in bm.faces:
        if f.material_index != pi:
            continue
        nb = f.normal
        n = (nb.x, nb.z, -nb.y)                          # Blender → juego
        for loop in f.loops:
            c = loop.vert.co
            loop[col] = (*paint_colour((c.x, c.z, -c.y), n, v), 1.0)
    bm.to_mesh(me); bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
        except Exception:
            pass


def bounds(o):
    xs = [v.co.x for v in o.data.vertices]; ys = [-v.co.y for v in o.data.vertices]; zs = [v.co.z for v in o.data.vertices]
    return {'x': (min(xs), max(xs)), 'z': (min(ys), max(ys)), 'y': (min(zs), max(zs))}   # juego: z = -Blender y, y = Blender z


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    kit._MATS.clear()
    stats = {}
    for name, v in VARIANTS.items():
        o = build_car(name, v).build(smooth_angle=35)
        o.name = name; o.data.name = name
        finish(o, v)
        b = bounds(o)
        ok = abs(b['x'][0]) <= LIM['x'] and b['x'][1] <= LIM['x'] and abs(b['z'][0]) <= LIM['z'] and b['z'][1] <= LIM['z'] and b['y'][1] <= LIM['y'] and b['y'][0] >= -0.001
        stats[name] = {'tris': kit.tri_count(o), 'mats': [m.name for m in o.data.materials], 'bounds': {k: [round(a, 3), round(c, 3)] for k, (a, c) in b.items()}, 'dentro_de_la_caja': ok}
        if not ok:
            raise SystemExit('FUERA DE LA CAJA DE COLISIÓN: %s %s' % (name, b))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_apply=True, export_yup=True,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                              export_extras=False, export_cameras=False, export_lights=False, export_animations=False)
    (ROOT / 'tools' / 'blender' / 'vehiculos-stats.json').write_text(json.dumps(stats, indent=1))
    print('VEHÍCULOS', OUT, round(OUT.stat().st_size / 1024), 'KB')
    for k, s in stats.items():
        print('  %-12s %6d tri  %s  %s' % (k, s['tris'], ','.join(s['mats']), s['bounds']))


if __name__ == '__main__':
    main()
