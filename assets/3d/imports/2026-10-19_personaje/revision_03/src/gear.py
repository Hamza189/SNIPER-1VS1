"""Paso 3: equipo y piezas de ropa con volumen propio, pegadas a la superficie del cuerpo vestido
(rayos contra el cuerpo): bolsillos con solapa, cuello de la chaqueta, tirantes, bajo y puños, cinturón con
hebilla, bolsillos cargo, rodilleras con correa, casco con cubierta, cascos de comunicación, gafas.

Cada pieza lleva un 'part' (entero) que el texturizado usa para su material y desgaste.
"""
import math
import numpy as np
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from common import *

PARTS = {   # id: (nombre, zona para la validación de cajas)
    0: ('cuerpo', None), 1: ('bolsillo_pecho', 'torso'), 2: ('solapa', 'torso'), 3: ('bolsillo_bajo', 'torso'),
    4: ('cinturon', 'torso'), 5: ('hebilla', 'torso'), 6: ('bolsillo_cargo', 'legs'), 7: ('rodillera', 'legs'),
    8: ('correa', 'legs'), 9: ('casco', 'head'), 10: ('plastico_casco', 'head'), 11: ('cristal', 'head'),
    12: ('goma_gafas', 'head'), 13: ('cuello_chaqueta', 'torso'), 14: ('tirante', 'torso'), 15: ('bajo_chaqueta', 'torso'),
    16: ('puno', 'arm'), 17: ('parche', 'arm'), 18: ('bota', 'legs'), 19: ('funda_cuchillo', 'legs'), 20: ('suela', 'legs'), 21: ('placa', 'torso'), 22: ('portacargador', 'torso'),
    23: ('faja', 'torso'), 24: ('hombrera', 'torso'), 25: ('solapa_chaleco', 'torso'),
}


class Surface:
    def __init__(self, ob, vmask=None):
        """vmask: solo las caras cuyos vértices están todos en la máscara (p. ej. el torso sin los brazos)."""
        self.ob = ob
        V = [tuple(v.co) for v in ob.data.vertices]
        polys = [tuple(p.vertices) for p in ob.data.polygons if vmask is None or all(vmask[i] for i in p.vertices)]
        self.bvh = BVHTree.FromPolygons(V, polys)

    def hit(self, origin_g, dir_g, maxd=2.0):
        """rayo en coordenadas del juego; devuelve (punto, normal) del juego o None"""
        o = Vector(game_to_blender(origin_g))
        d = Vector(game_to_blender(dir_g)).normalized()
        loc, nor, idx, dist = self.bvh.ray_cast(o, d, maxd)
        if loc is None:
            return None
        return game_from_blender(np.array(loc)), game_from_blender(np.array(nor))

    def nearest(self, p_g):
        loc, nor, idx, dist = self.bvh.find_nearest(Vector(game_to_blender(p_g)))
        return game_from_blender(np.array(loc)), game_from_blender(np.array(nor))


class Builder:
    def __init__(self):
        self.P, self.F, self.part = [], [], []

    def add(self, P, F, part):
        base = len(self.P)
        self.P.extend([list(p) for p in P])
        self.F.extend([[base + i for i in f] for f in F])
        self.part.extend([part] * len(F))

    def object(self, name='equipo'):
        ob = mesh_object(name, game_to_blender(np.array(self.P)), self.F)
        a = ob.data.attributes.new('part', 'INT', 'FACE')
        a.data.foreach_set('value', np.array(self.part, dtype=np.int32))
        for p in ob.data.polygons:
            p.use_smooth = True
        return ob


def grid_faces(nu, nv, closed_u=False):
    F = []
    cols = nu if closed_u else nu - 1
    for j in range(nv - 1):
        for i in range(cols):
            a = j * nu + i
            b = j * nu + (i + 1) % nu
            F.append([a, b, b + nu, a + nu])
    return F


def solid(P_top, N, nu, nv, thick, closed_u=False, rim_inset=0.0):
    """placa con espesor: capa exterior P_top, capa interior hacia dentro (-N*thick), y bordes."""
    P_top = np.asarray(P_top)
    P_bot = P_top - N * thick
    n = len(P_top)
    P = np.vstack([P_top, P_bot])
    F = grid_faces(nu, nv, closed_u)
    F += [[n + f[3], n + f[2], n + f[1], n + f[0]] for f in grid_faces(nu, nv, closed_u)]
    def edge(ids):
        out = []
        for a, b in zip(ids[:-1], ids[1:]):
            out.append([a, b, b + n, a + n])
        return out
    bottom = list(range(nu)) + ([0] if closed_u else [])
    top = [(nv - 1) * nu + i for i in range(nu)] + ([(nv - 1) * nu] if closed_u else [])
    F += [list(reversed(f)) for f in edge(bottom)]
    F += edge(top)
    if not closed_u:
        left = [j * nu for j in range(nv)]
        right = [j * nu + nu - 1 for j in range(nv)]
        F += edge(left)
        F += [list(reversed(f)) for f in edge(right)]
    return P, F


def patch(S, center, right, up, w, h, nu, nv, offset, bulge=0.0, round_=0.25, normal=None):
    """rejilla proyectada sobre la superficie (desde fuera, a lo largo de -normal)."""
    center = np.asarray(center, float)
    right = np.asarray(right, float) / np.linalg.norm(right)
    up = np.asarray(up, float) / np.linalg.norm(up)
    nrm = np.cross(right, up) if normal is None else np.asarray(normal, float)
    nrm /= np.linalg.norm(nrm)
    P, N = [], []
    for j in range(nv):
        for i in range(nu):
            u = i / (nu - 1) - 0.5
            v = j / (nv - 1) - 0.5
            # esquinas redondeadas: se recogen hacia dentro
            cu, cv = abs(u) * 2, abs(v) * 2
            k = max(0, (cu - (1 - round_)) / round_) * max(0, (cv - (1 - round_)) / round_)
            sc = 1 - 0.18 * k
            q = center + right * u * w * sc + up * v * h * sc
            r = S.hit(q + nrm * 0.35, -nrm)
            if r is None:
                p, n = S.nearest(q)
            else:
                p, n = r
            n = n / np.linalg.norm(n)
            dome = bulge * (1 - (2 * u) ** 2) * (1 - (2 * v) ** 2)
            P.append(p + n * (offset + dome))
            N.append(n)
    return np.array(P), np.array(N)


def ring(S, center_fn, y0, y1, nv, nu, offset, flare=None, axis=(0, 1, 0)):
    """anillo pegado alrededor de un eje (cuello, cintura, pierna, puño). center_fn(t) -> centro del juego."""
    P, N = [], []
    for j in range(nv):
        t = j / max(1, nv - 1)
        c = np.asarray(center_fn(t), float)
        ax = np.asarray(axis(t) if callable(axis) else axis, float)
        ax /= np.linalg.norm(ax)
        a1 = np.cross(ax, [0, 0, 1]) if abs(ax[2]) < 0.9 else np.cross(ax, [1, 0, 0])
        a1 /= np.linalg.norm(a1)
        a2 = np.cross(a1, ax)
        for i in range(nu):
            th = math.tau * i / nu
            d = a1 * math.cos(th) + a2 * math.sin(th)
            r = S.hit(c + d * 0.6, -d, maxd=0.6)
            if r is None:
                p, n = S.nearest(c + d * 0.05)
            else:
                p, n = r
            n = d   # radial: un anillo de tela no sigue cada hueco de la superficie
            off = offset + (flare(t) if flare else 0)
            P.append(p + n * off)
            N.append(n)
    return np.array(P), np.array(N)


def tube(path, radius, nu, cap=True):
    path = np.asarray(path, float)
    P = []
    for k, c in enumerate(path):
        d = path[min(k + 1, len(path) - 1)] - path[max(k - 1, 0)]
        d /= np.linalg.norm(d)
        a1 = np.cross(d, [0, 1, 0]) if abs(d[1]) < 0.9 else np.cross(d, [1, 0, 0])
        a1 /= np.linalg.norm(a1)
        a2 = np.cross(d, a1)
        r = radius[k] if hasattr(radius, '__len__') else radius
        for i in range(nu):
            th = math.tau * i / nu
            P.append(c + (a1 * math.cos(th) + a2 * math.sin(th)) * r)
    F = grid_faces(nu, len(path), closed_u=True)
    if cap:
        n = len(P)
        P.append(path[0]); P.append(path[-1])
        F += [[n, (i + 1) % nu, i] for i in range(nu)]
        last = (len(path) - 1) * nu
        F += [[n + 1, last + i, last + (i + 1) % nu] for i in range(nu)]
    return np.array(P), F


def box(c, size, rot=None):
    c = np.asarray(c, float)
    hx, hy, hz = np.asarray(size) / 2
    P = np.array([[x, y, z] for z in (-hz, hz) for y in (-hy, hy) for x in (-hx, hx)])
    if rot is not None:
        P = P @ np.asarray(rot).T
    P += c
    F = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]
    return P, F


def build_gear(body, C, J):
    Pm = C['P']; ym = Pm[:, 1]
    S = Surface(body, (C['arm'] < 0.25) & (C['head'] < 0.5) & ((C['leg'] < 0.6) | (ym > 0.86)))
    S_head = Surface(body, (C['head'] > 0.2) | ((ym > 1.45) & (C['arm'] < 0.25)))
    S_leg = {s: Surface(body, (C['leg'] > 0.5) & (Pm[:, 0] * s > 0)) for s in (1, -1)}
    S_arm = {s: Surface(body, (C['arm'] > 0.5) & (Pm[:, 0] * s > 0)) for s in (1, -1)}
    B = Builder()
    G = {k: game_from_blender(v) for k, v in J.items()}
    X, Y, Z = np.eye(3)

    # --- chaleco porta-placas (rev. 03b, estilo PUBG): placas delante y detrás, faja, hombreras, portacargadores,
    #     bolsillo de pecho y radio. Sustituye a los bolsillos del pecho y a los tirantes de la primera versión.
    P, N = patch(S, np.array([0, 1.225, 0.1]), X, Y, 0.30, 0.33, 9, 10, 0.022, bulge=0.008, round_=0.3)
    P, F = solid(P, N, 9, 10, 0.03)
    B.add(P, F, 21)
    P, N = patch(S, np.array([0, 1.195, -0.1]), -X, Y, 0.25, 0.26, 9, 10, 0.006, bulge=0.002, round_=0.35)
    P, F = solid(P, N, 9, 10, 0.03)
    B.add(P, F, 21)
    P, N = ring(S, lambda t: [0, 1.035 + t * 0.125, -0.01], 0, 1, 3, 44, 0.017)
    P, F = solid(P, N, 44, 3, 0.016, closed_u=True)
    B.add(P, F, 23)
    for s in (1, -1):
        x = s * 0.105
        pts, nor = [], []
        for k in range(21):
            a_ = math.radians(-40 + 260 * k / 20)
            d = np.array([0, math.sin(a_), math.cos(a_)])
            r = S.hit(np.array([x, 1.30, 0.0]) + d * 0.5, -d, maxd=0.6)
            if r is None:
                continue
            p, n = r
            if p[1] < 1.36 or (p[2] < -0.04 and p[1] < 1.41):
                continue
            pts.append(p); nor.append(n / np.linalg.norm(n))
        pts = np.array(pts); nor = np.array(nor)
        side = np.cross(np.gradient(pts, axis=0), nor)
        side /= np.linalg.norm(side, axis=1)[:, None]
        Pt = np.vstack([pts - side * 0.03 + nor * 0.012, pts + side * 0.03 + nor * 0.012])
        Pt = Pt.reshape(2, -1, 3).transpose(1, 0, 2).reshape(-1, 3)
        P, F = solid(Pt, np.repeat(nor, 2, axis=0), 2, len(pts), 0.012)
        B.add(P, F, 24)
    for x in (-0.077, 0.0, 0.077):
        P, N = patch(S, np.array([x, 1.125, 0.1]), X, Y, 0.068, 0.13, 5, 7, 0.054, bulge=0.006, round_=0.25)
        P, F = solid(P, N, 5, 7, 0.028)
        B.add(P, F, 22)
        P, N = patch(S, np.array([x, 1.178, 0.1]), X, Y, 0.072, 0.036, 5, 3, 0.061, bulge=0.004, round_=0.2)
        P, F = solid(P, N, 5, 3, 0.007)
        B.add(P, F, 25)
    P, N = patch(S, np.array([0, 1.312, 0.1]), X, Y, 0.17, 0.07, 7, 4, 0.050, bulge=0.006, round_=0.3)
    P, F = solid(P, N, 7, 4, 0.022)
    B.add(P, F, 22)
    outv = np.array([1, 0, 0.15]); outv /= np.linalg.norm(outv)
    P, N = patch(S, np.array([0.16, 1.10, -0.02]), np.array([0, 0, -1.0]), Y, 0.06, 0.11, 4, 6, 0.032, bulge=0.004, round_=0.3, normal=outv)
    P, F = solid(P, N, 4, 6, 0.028)
    B.add(P, F, 22)
    P, F = box(np.array([0.165, 1.205, -0.025]), (0.008, 0.11, 0.008))
    B.add(P, F, 10)
    top = None   # asa trasera retirada: salía de la caja del torso
    if top:
        q = top[0]
        Pt_, Ft_ = tube([q + [-0.04, 0.0, -0.045], q + [-0.03, 0.025, -0.05], q + [0.03, 0.025, -0.05], q + [0.04, 0.0, -0.045]], 0.008, 8)
        B.add(Pt_, Ft_, 24)

    # --- cuello de la chaqueta (subido, un poco abierto delante) ---
    neck = G['neck']
    P, N = ring(S, lambda t: [0, 1.445 + t * 0.075, neck[2] - 0.01], 0, 1, 4, 28, 0.010, flare=lambda t: 0.008 * t)
    P, F = solid(P, N, 28, 4, 0.006, closed_u=True)
    B.add(P, F, 13)
    # --- bajo de la chaqueta y cinturón ---
    zc = 0.0
    P, N = ring(S, lambda t: [0, 0.968 + t * 0.03, -0.01], 0, 1, 2, 40, 0.006)
    P, F = solid(P, N, 40, 2, 0.006, closed_u=True)
    B.add(P, F, 15)
    P, N = ring(S, lambda t: [0, 0.928 + t * 0.036, -0.01], 0, 1, 2, 40, 0.005)
    P, F = solid(P, N, 40, 2, 0.005, closed_u=True)
    B.add(P, F, 4)
    front = S.hit(np.array([0, 0.946, 0.4]), np.array([0, 0, -1]))[0]
    P, F = box(front + [0, 0, 0.012], (0.052, 0.040, 0.010))
    B.add(P, F, 5)
    # funda de cuchillo en el costado izquierdo del cinturón (equipo fino, pegado)
    side_p = S.hit(np.array([0.5, 0.88, -0.02]), np.array([-1, 0, 0]))[0]
    P, F = box(side_p + [0.014, -0.02, 0], (0.022, 0.16, 0.045))
    B.add(P, F, 19)

    # --- puños de la chaqueta ---
    for s in ('l', 'r'):
        e, h = G[s + '-elbow'], G[s + '-hand']
        P, N = ring(S_arm[1 if s == 'l' else -1], lambda t, e=e, h=h: e + (h - e) * (0.80 + 0.07 * t), 0, 1, 3, 16, 0.004, axis=h - e)
        P, F = solid(P, N, 16, 3, 0.005, closed_u=True)
        B.add(P, F, 16)
        # parche del hombro (brazo izquierdo del modelo, como la referencia)
        if s == 'l':
            sh = G['l-shoulder']
            c = sh + (e - sh) * 0.28
            out = np.array([1, 0, 0.15])
            r = S_arm[1].hit(c + out * 0.3, -out)
            if r:
                p, n = r
                upv = np.cross(n, e - sh); upv = np.cross(upv, n)
                P, N = patch(S_arm[1], p, np.cross(upv, n), -(e - sh), 0.055, 0.065, 4, 4, 0.002, normal=n)
                P, F = solid(P, N, 4, 4, 0.003)
                B.add(P, F, 17)

    # --- pantalón: bolsillos cargo laterales con solapa, rodilleras con correa, caña de bota ---
    for s, sd in ((1, 'l'), (-1, 'r')):
        hip, knee, ank = G[sd + '-upper-leg'], G[sd + '-knee'], G[sd + '-ankle']
        c = hip + (knee - hip) * 0.62
        outv = np.array([s, 0, 0.45]); outv /= np.linalg.norm(outv)
        P, N = patch(S_leg[s], c + outv * 0.05, np.cross(Y, outv) * -s, Y, 0.12, 0.15, 6, 7, 0.003, bulge=0.010, normal=outv)
        P, F = solid(P, N, 6, 7, 0.008)
        B.add(P, F, 6)
        P, N = patch(S_leg[s], c + outv * 0.05 + [0, 0.058, 0], np.cross(Y, outv) * -s, Y, 0.126, 0.045, 6, 3, 0.012, bulge=0.009, round_=0.15, normal=outv)
        P, F = solid(P, N, 6, 3, 0.005)
        B.add(P, F, 2)
        kc = knee + np.array([0, 0.015, 0.05])
        P, N = patch(S_leg[s], kc, X, Y, 0.105, 0.125, 7, 7, 0.004, bulge=0.022, round_=0.45, normal=Z)
        P, F = solid(P, N, 7, 7, 0.010)
        B.add(P, F, 7)
        for dy, part in ((0.045, 8), (-0.045, 8)):
            P, N = ring(S_leg[s], lambda t, kc=kc, dy=dy: [kc[0], kc[1] + dy + 0.018 * t, knee[2] - 0.01], 0, 1, 2, 18, 0.0025)
            P, F = solid(P, N, 18, 2, 0.003, closed_u=True)
            B.add(P, F, part)
    build_boots(C, G, B)

    # --- casco (alto, recortado sobre las orejas), cubierta de tela, carriles, montura delantera ---
    head_c = np.array([0, 1.63, 0])
    nu, nv = 36, 11
    P, N = [], []
    for j in range(nv):
        for i in range(nu):
            az = math.tau * i / nu                     # 0 = delante
            # línea de corte: delante sobre las cejas, en los lados por encima de la oreja, detrás más bajo
            fr = math.cos(az)
            bottom = 8 * max(0, fr) ** 2 + 16 * (1 - abs(fr)) - 14 * max(0, -fr) ** 2
            el = math.radians(87 - (87 - bottom) * (j / (nv - 1)) ** 0.9)
            d = np.array([math.sin(az) * math.cos(el), math.sin(el), math.cos(az) * math.cos(el)])
            o = head_c + np.array([0, 0.015, 0]) + d * 0.4
            r = S_head.hit(o, -d, maxd=0.5)
            p = r[0] if r else head_c + d * 0.1
            p = p + d * 0.022
            P.append(p); N.append(d)
    P = np.array(P); N = np.array(N)
    # dentro de la esfera de la cabeza (sin tolerancia)
    v = P - head_c; L = np.linalg.norm(v, axis=1); P = np.where((L > 0.147)[:, None], head_c + v / L[:, None] * 0.147, P)
    P, F = solid(P, N, nu, nv, 0.010, closed_u=True)
    # cerrar la coronilla
    B.add(P, F, 9)
    for s in (1, -1):
        # carriles laterales y cascos de comunicación
        p = head_c + np.array([s * 0.112, 0.045, -0.005])
        Pb, Fb = box(p, (0.012, 0.022, 0.085))
        B.add(Pb, Fb, 10)
        path = [head_c + np.array([s * (0.085 + 0.008 * k), -0.03, -0.01]) for k in range(4)]
        Pt, Ft = tube(path, [0.034, 0.038, 0.038, 0.033], 14)
        B.add(Pt, Ft, 10)
    Pb, Fb = box(head_c + np.array([0, 0.085, 0.112]), (0.05, 0.035, 0.022), rot=np.array([[1, 0, 0], [0, math.cos(0.5), -math.sin(0.5)], [0, math.sin(0.5), math.cos(0.5)]]))
    B.add(Pb, Fb, 10)

    # --- gafas: montura de goma y cristal ahumado, cinta alrededor del casco ---
    eye_y = 1.622
    P, N = patch(S_head, np.array([0, eye_y, 0.1]), X, Y, 0.150, 0.048, 11, 4, 0.010, bulge=0.004, round_=0.4, normal=Z)
    v = P - head_c; L = np.linalg.norm(v, axis=1); P = np.where((L > 0.148)[:, None], head_c + v / L[:, None] * 0.148, P)
    Pg, Fg = solid(P, N, 11, 4, 0.012)
    B.add(Pg, Fg, 12)
    P2 = P + N * 0.0015
    v = P2 - head_c; L = np.linalg.norm(v, axis=1); P2 = np.where((L > 0.1495)[:, None], head_c + v / L[:, None] * 0.1495, P2)
    sel = []
    Pl, Fl = solid(P2[[i for i in range(len(P2))]], N, 11, 4, 0.002)
    # el cristal ocupa el centro de la montura
    Pc = P2.reshape(4, 11, 3)[1:3, 1:10].reshape(-1, 3)
    Nc = N.reshape(4, 11, 3)[1:3, 1:10].reshape(-1, 3)
    Pl, Fl = solid(Pc + Nc * 0.002, Nc, 9, 2, 0.002)
    B.add(Pl, Fl, 11)
    P, N = ring(S_head, lambda t: [0, 1.64 + 0.03 * t, -0.005], 0, 1, 2, 36, 0.024)
    v = P - head_c; L = np.linalg.norm(v, axis=1); P = np.where((L > 0.149)[:, None], head_c + v / L[:, None] * 0.149, P)
    sel = np.array([abs(math.cos(math.tau * i / 36)) < 0.93 or math.cos(math.tau * i / 36) < 0 for i in range(36)] * 2)
    P, F = solid(P, N, 36, 2, 0.003, closed_u=True)
    B.add(P, F, 12)

    # todo lo de la cabeza dentro de su esfera de impacto (sin tolerancia)
    Pv = np.array(B.P)
    hp = np.zeros(len(Pv), bool)
    for f, p in zip(B.F, B.part):
        if PARTS[p][1] == 'head':
            hp[f] = True
    v = Pv - head_c
    L = np.linalg.norm(v, axis=1)
    out = hp & (L > 0.1485)
    Pv[out] = head_c + v[out] / L[out][:, None] * 0.1485
    B.P = Pv.tolist()
    return B.object('equipo')


def build_boots(C, G, B, R=16, NS=18):
    """botas de caña media: horma alrededor del pie (que luego se borra), suela de goma y caña hasta BOOT_TOP."""
    from clothing import BOOT_TOP
    P = C['P']
    for s, sd in ((1, 'l'), (-1, 'r')):
        ank, ball = G[sd + '-ankle'], G[sd + '-foot-2']
        a = np.array([ball[0] - ank[0], 0, ball[2] - ank[2]]); a /= np.linalg.norm(a)
        lat = np.array([a[2], 0, -a[0]])
        F = P[(C['leg'] > 0.5) & (P[:, 0] * s > 0) & (P[:, 1] < 0.16)]
        u = (F - ank) @ a
        l = (F - ank) @ lat
        u0, u1 = u.min() + 0.002, u.max() - 0.008
        rows = []
        for k in range(R):
            t = k / (R - 1)
            uk = u0 + (u1 - u0) * t
            m = np.abs(u - uk) < 0.02
            if m.sum() < 3:
                m = np.abs(u - uk) < 0.04
            lo, hi = l[m].min() - 0.012, l[m].max() + 0.012
            top = F[m, 1].max() + 0.014
            end = min(t, 1 - t) / 0.12
            sh = math.sqrt(max(0.0, 1 - (1 - min(1, end)) ** 2)) if end < 1 else 1
            sh = 0.45 + 0.55 * sh
            mid, hw = (lo + hi) / 2, (hi - lo) / 2 * sh
            top = max(0.045, top) * (0.75 + 0.25 * sh)
            rows.append((uk, mid, hw, top))
        rows = np.array(rows)
        # la bota se centra delante/detrás sobre z = 0 (la caja de piernas mide 22 cm de fondo): el pie
        # se borra, así que mover la horma 1–2 cm respecto al tobillo no se nota
        zs = [(ank + a * uk)[2] for uk in (rows[0, 0], rows[-1, 0])]
        shift = np.array([0, 0, -(min(zs) + max(zs)) / 2])
        ank = ank + shift
        for j in (1, 2, 3):   # suavizar el perfil a lo largo del pie
            rows[1:-1, 1:] = (rows[:-2, 1:] + 2 * rows[1:-1, 1:] + rows[2:, 1:]) / 4
        Pf = []
        for uk, mid, hw, top in rows:
            for i in range(NS):
                ph = math.tau * i / NS
                cx, sy = math.cos(ph), math.sin(ph)
                lx = mid + hw * math.copysign(abs(cx) ** 0.7, cx)
                yy = top / 2 * (1 + math.copysign(abs(sy) ** 0.6, sy))
                Pf.append(ank + a * uk + lat * lx + np.array([0, yy - ank[1], 0]))
        Fq = grid_faces(NS, R, closed_u=True)
        n = len(Pf)
        Pf += [ank + a * rows[0, 0] + lat * rows[0, 1] + np.array([0, rows[0, 3] / 2 - ank[1], 0]),
               ank + a * rows[-1, 0] + lat * rows[-1, 1] + np.array([0, rows[-1, 3] / 2 - ank[1], 0])]
        Fq += [[n, (i + 1) % NS, i] for i in range(NS)]
        last = (R - 1) * NS
        Fq += [[n + 1, last + i, last + (i + 1) % NS] for i in range(NS)]
        B.add(np.array(Pf), Fq, 18)
        # suela: huella algo más ancha, 2,2 cm de alto
        top_pts, nrm = [], []
        for uk, mid, hw, top in rows:
            for side in (-1, 1):
                top_pts.append(ank + a * uk + lat * (mid + side * (hw + 0.005)) + np.array([0, 0.022 - ank[1], 0]))
        top_pts = np.array(top_pts)
        Ps, Fs = solid(top_pts, np.tile([0, 1, 0], (len(top_pts), 1)), 2, R, 0.022)
        B.add(Ps, Fs, 20)
        # caña: anillos alrededor del tobillo hasta BOOT_TOP
        knee = G[sd + '-knee']
        LG = P[(C['leg'] > 0.5) & (P[:, 0] * s > 0)]
        rowsP = []
        NV = 7
        for j in range(NV):
            yy = 0.05 + (BOOT_TOP - 0.05) * j / (NV - 1)
            c = ank + (knee - ank) * max(0.0, (yy - ank[1]) / (knee[1] - ank[1]))
            c = np.array([c[0], yy, c[2]])
            band = LG[np.abs(LG[:, 1] - yy) < 0.02]
            for i in range(NS):
                th = math.tau * i / NS
                d = np.array([math.cos(th), 0, math.sin(th)])
                if len(band):
                    q = band - c
                    proj = q @ d
                    perp = np.linalg.norm(q - np.outer(proj, d), axis=1)
                    ok = perp < 0.02
                    r = proj[ok].max() if ok.any() else 0.05
                else:
                    r = 0.05
                r = max(r + 0.008, 0.052)
                rowsP.append(c + d * r)
        Pc = np.array(rowsP)
        Nc = Pc - np.repeat(np.array([[ank[0], 0, ank[2]]]), len(Pc), 0); Nc[:, 1] = 0
        Nc /= np.linalg.norm(Nc, axis=1)[:, None]
        Pc, Fc = solid(Pc, Nc, NS, NV, 0.006, closed_u=True)
        B.add(Pc, Fc, 18)
