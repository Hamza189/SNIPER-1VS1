"""Revisión 03 — animaciones del soldado (numpy puro, coordenadas del juego: x izquierda del personaje,
y arriba, z delante; el personaje mira a +z y su derecha es -x).

Cómo se construye cada fotograma:
  * tren inferior: cadera (altura, giro, balanceo), columna baja y piernas con IK de dos huesos hacia
    pisadas que no patinan (el pie apoyado retrocede justo a la velocidad del clip), con talón→punta;
  * tren superior: torso perfilado al apuntar, el arma en un nodo 'arma' (hijo de la clavícula derecha)
    y las dos manos llevadas a sus empuñaduras con IK (codos con polo, giro repartido entre antebrazo y
    muñeca); la cabeza mira al frente y se queda centrada en su esfera de impacto;
  * agachado y deslizamiento: el esqueleto toma la altura final con un 'morph' (cuerpo comprimido hacia
    sus articulaciones como las cajas del servidor) y los huesos se doblan encima — sin escalar huesos,
    así brazos y cabeza no se deforman.
El escritor del GLB (build_glb.py) guarda rotaciones locales, traslaciones locales y pesos del morph.
"""
import math, json
from pathlib import Path
import numpy as np

TAU = math.tau
# ------------------------------------------------------------------ álgebra


def unit(v):
    v = np.asarray(v, float)
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v


def rot(axis, ang):
    a = unit(axis)
    x, y, z = a
    c, s, C = math.cos(ang), math.sin(ang), 1 - math.cos(ang)
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


def rx(a): return rot((1, 0, 0), a)
def ry(a): return rot((0, 1, 0), a)
def rz(a): return rot((0, 0, 1), a)
def up(a): return rx(-a)            # mirar/levantar hacia arriba (rota +z hacia +y)
def yaw(a): return ry(a)            # + gira hacia la izquierda del personaje (+x)
def roll(a): return rz(a)           # + inclina la parte de arriba hacia la derecha (-x)


def frame(d, p):
    x = unit(d)
    z = unit(np.asarray(p, float) - np.dot(p, x) * x)
    y = np.cross(z, x)
    return np.stack([x, y, z], 1)


def align(d0, p0, d1, p1):
    return frame(d1, p1) @ frame(d0, p0).T


def quat(R):
    """matriz 3x3 -> (x, y, z, w)"""
    m = R
    t = m[0, 0] + m[1, 1] + m[2, 2]
    if t > 0:
        s = math.sqrt(t + 1) * 2
        w, x, y, z = 0.25 * s, (m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        w, x, y, z = (m[2, 1] - m[1, 2]) / s, 0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        w, x, y, z = (m[0, 2] - m[2, 0]) / s, (m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s
    else:
        s = math.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        w, x, y, z = (m[1, 0] - m[0, 1]) / s, (m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s
    q = np.array([x, y, z, w])
    return q / np.linalg.norm(q)


def twist_angle(R, axis):
    """ángulo de giro de R alrededor de 'axis' (descomposición giro-balanceo)"""
    q = quat(R)
    a = unit(axis)
    p = np.dot(q[:3], a)
    return 2 * math.atan2(p, q[3])


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def smoother(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


def bump(t, a, b):
    """0 fuera de [a, b], 1 en el centro, suave"""
    if t <= a or t >= b:
        return 0.0
    return math.sin(math.pi * (t - a) / (b - a)) ** 2


def lerp(a, b, t):
    return a + (b - a) * t


# ------------------------------------------------------------------ esqueleto
class Skel:
    def __init__(self, npz, joints):
        self.names = [str(n) for n in npz['bones']]
        self.i = {n: k for k, n in enumerate(self.names)}
        self.parents = [int(p) for p in npz['parents']]
        self.rest = np.array(npz['rest'], float)
        self.tails = np.array(npz['tails'], float)
        self.J = {k: np.array(v) for k, v in joints.items()}
        self.n = len(self.names)
        self.off0 = np.array([self.rest[b] - (self.rest[p] if p >= 0 else 0) for b, p in enumerate(self.parents)])
        R = self.rest
        I = self.i
        # mano: puño y ejes de los sockets (en el marco de reposo de la mano = mundo, rotación identidad)
        self.sock = {}
        for side, s, sx in (('Right', 'r', -1), ('Left', 'l', 1)):
            w = R[I[side + 'Hand']]
            k2, k3, k5 = self.J[s + '-finger-2-1'], self.J[s + '-finger-3-1'], self.J[s + '-finger-5-1']
            n = unit(np.cross(k2 - w, k5 - w))
            if n[0] * sx > 0:
                n = -n                                   # normal de la palma
            fist = self.J[s + '-fist'] + n * 0.004
            a = unit(k2 - k5)                            # meñique -> índice
            f = unit(k3 - w)
            if side == 'Right':
                Y = a                                    # empuñadura de pistola: el índice arriba
                Z = unit(f - np.dot(f, Y) * Y)           # el cañón sigue a la mano
                X = np.cross(Y, Z)
                Rs = np.stack([X, Y, Z], 1) @ rx(math.radians(-16))   # inclinación de la empuñadura
            else:
                Z = a                                    # guardamanos a lo largo de los nudillos
                Y = unit(n - np.dot(n, Z) * Z)           # el arma queda del lado de la palma
                X = np.cross(Y, Z)
                Rs = np.stack([X, Y, Z], 1)
            self.sock[side] = (fist - w, Rs)            # posición relativa a la muñeca y rotación en reposo
        self.limb = {}
        for side in ('Left', 'Right'):
            for a_, b_, c_ in (('Arm', 'ForeArm', 'Hand'), ('UpLeg', 'Leg', 'Foot')):
                A, B, Cc = R[I[side + a_]], R[I[side + b_]], R[I[side + c_]]
                l1, l2 = np.linalg.norm(B - A), np.linalg.norm(Cc - B)
                d = unit(Cc - A)
                mid = A + d * np.dot(B - A, d)
                pole = B - mid
                if np.linalg.norm(pole) < 0.01:
                    pole = np.array([0, 0, 1.0]) if a_ == 'UpLeg' else np.array([0, 0, -1.0])
                self.limb[side + a_] = dict(l1=l1, l2=l2, pole=unit(pole), d1=unit(B - A), d2=unit(Cc - B))
        self.heel = {}
        for side in ('Left', 'Right'):
            ank, ball = R[I[side + 'Foot']], R[I[side + 'ToeBase']]
            self.heel[side] = np.array([ank[0], 0.0, ank[2] - 0.075])
        self.ankle_h = float(R[I['LeftFoot']][1])


# categorías para el morph de altura (agachado / deslizamiento)
SCALED = ['Root', 'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder',
          'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
HEAD_CENTER = 1.63
K_CROUCH = 1.0 / 1.62
K_SLIDE = 0.85 / 1.62


def squash_positions(sk, k):
    """posición de cada articulación con la altura comprimida (k = ojos / 1,62)"""
    g = sk.rest.copy()
    for b, n in enumerate(sk.names):
        p = sk.rest[b]
        if n in SCALED:
            g[b] = [p[0], p[1] * k, p[2]]
    for side in ('Left', 'Right'):
        dy = (k - 1) * sk.rest[sk.i[side + 'Shoulder']][1]
        for n in ('Arm', 'ForeArm', 'Hand', 'Thumb'):
            b = sk.i[side + n]
            g[b] = sk.rest[b] + [0, dy, 0]
    for n in ('Head', 'Eyes'):
        b = sk.i[n]
        g[b] = sk.rest[b] + [0, (k - 1) * HEAD_CENTER, 0]
    return g


def morph_delta(sk, pos, joints, weights, k):
    """desplazamiento del morph por vértice: cada vértice se comprime hacia la articulación de los huesos
    'escalados' que lo mueven; los rígidos (brazos, cabeza) no se deforman, solo los traslada el hueso."""
    D = np.zeros_like(pos)
    for c in range(joints.shape[1]):
        for b, n in enumerate(sk.names):
            if n not in SCALED:
                continue
            m = joints[:, c] == b
            if not m.any():
                continue
            D[m, 1] += weights[m, c] * (k - 1) * (pos[m, 1] - sk.rest[b][1])
    return D


# ------------------------------------------------------------------ pose
class Pose:
    def __init__(self, sk):
        self.sk = sk
        self.L = [np.eye(3) for _ in range(sk.n)]
        self.off = sk.off0.copy()
        self.hips = np.zeros(3)
        self.morph = {'agachado': 0.0, 'deslizar': 0.0}
        self.arma = None            # (R, p) en el marco de la clavícula derecha
        self._fk = None

    # cinemática directa
    def fk(self):
        sk = self.sk
        Rw = [None] * sk.n
        Pw = [None] * sk.n
        for b in range(sk.n):
            p = sk.parents[b]
            o = self.off[b] + (self.hips if sk.names[b] == 'Hips' else 0)
            if p < 0:
                Rw[b] = self.L[b]
                Pw[b] = o
            else:
                Rw[b] = Rw[p] @ self.L[b]
                Pw[b] = Pw[p] + Rw[p] @ o
        return Rw, Pw

    def world(self, name):
        Rw, Pw = self.fk()
        b = self.sk.i[name]
        return Rw[b], Pw[b]

    def set_world_rot(self, name, R):
        sk = self.sk
        b = sk.i[name]
        p = sk.parents[b]
        Rw, _ = self.fk()
        self.L[b] = Rw[p].T @ R

    def local(self, name, R):
        self.L[self.sk.i[name]] = R

    def apply_squash(self, k, w, which):
        if w <= 0:
            return
        sk = self.sk
        keff = 1 - w * (1 - k)
        g = squash_positions(sk, keff)
        self.off = np.array([g[b] - (g[p] if p >= 0 else 0) for b, p in enumerate(sk.parents)])
        self.morph[which] = w

    # IK de dos huesos (brazo o pierna) con polo; 'end_R' rotación en el mundo del extremo (mano/pie)
    def ik(self, side, upper, target, pole, end_R=None, twist_share=0.55):
        sk = self.sk
        names = {'Arm': ('Arm', 'ForeArm', 'Hand'), 'UpLeg': ('UpLeg', 'Leg', 'Foot')}[upper]
        a, b, c = (side + n for n in names)
        info = sk.limb[side + upper]
        # longitudes y direcciones con las traslaciones actuales (en agachado los huesos están comprimidos)
        ob, oc = self.off[sk.i[b]], self.off[sk.i[c]]
        l1, l2 = np.linalg.norm(ob), np.linalg.norm(oc)
        d1r, d2r = unit(ob), unit(oc)
        Rw, Pw = self.fk()
        A = Pw[sk.i[a]]
        T = np.asarray(target, float)
        d = T - A
        dist = np.linalg.norm(d)
        dist = min(max(dist, abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4)
        dn = unit(d)
        pole = unit(np.asarray(pole, float) - np.dot(pole, dn) * dn)
        ca = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)
        ang = math.acos(max(-1, min(1, ca)))
        B = A + dn * (l1 * math.cos(ang)) + pole * (l1 * math.sin(ang))
        Cc = A + dn * dist
        Ru = align(d1r, info['pole'], unit(B - A), pole)
        self.set_world_rot(a, Ru)
        Rl = align(d2r, info['pole'], unit(Cc - B), pole)
        if end_R is not None and twist_share > 0:
            rel = Rl.T @ end_R
            th = twist_angle(rel, d2r)
            Rl = Rl @ rot(d2r, th * twist_share)
        self.set_world_rot(b, Rl)
        if end_R is not None:
            self.set_world_rot(c, end_R)
        return B, Cc


# ------------------------------------------------------------------ armas (marco 'arma': origen en la empuñadura, +z cañón, +y arriba, -x derecha)
WEAPONS = {
    'rifle': dict(left=(0.0, 0.058, 0.215), butt=(0, 0.075, -0.337), scope=0.161, muzzle=(0, 0.09, 0.94), bolt=(-0.045, 0.085, 0.10)),
    'shotgun': dict(left=(0.0, 0.055, 0.33), butt=(0, 0.06, -0.227), scope=0.12, muzzle=(0, 0.1, 0.76), pump=0.09),
    'pistol': dict(left=(0.032, -0.012, -0.005), muzzle=(0, 0.07, 0.20)),
    'knife': dict(left=None, muzzle=(0, 0.0, 0.25)),
}


class Builder:
    """construye poses completas a partir de un esqueleto"""

    def __init__(self, sk):
        self.sk = sk
        R = sk.rest
        I = sk.i
        self.R = R
        self.I = I

    # ---- tren inferior
    def stand(self, P, t, sway=1.0, stance=0.0, knee=0.0, hips_back=0.0):
        """de pie: respiración y un leve vaivén del peso; stance > 0 adelanta el pie izquierdo"""
        sk = self.sk
        ph = TAU * t / 2.0
        P.hips = np.array([0.006 * math.sin(ph * 0.5) * sway, -0.004 * knee - 0.002 * (1 - math.cos(ph)) * sway, -hips_back])
        P.local('Hips', yaw(math.radians(1.2) * math.sin(ph * 0.5) * sway) @ roll(math.radians(-1.0) * math.sin(ph * 0.5) * sway))
        P.local('Spine', roll(math.radians(0.8) * math.sin(ph * 0.5) * sway))
        feet = {}
        for side, sx in (('Left', 1), ('Right', -1)):
            ank = self.R[self.I[side + 'Foot']].copy()
            ank[2] += stance * (0.02 if side == 'Left' else -0.03)
            feet[side] = (ank, yaw(sx * math.radians(1)))
        self.legs_to(P, feet)

    def legs_to(self, P, feet, knee_out=0.12):
        for side, sx in (('Left', 1), ('Right', -1)):
            ank, Rf = feet[side]
            pole = Rf @ np.array([sx * knee_out, 0, 1.0])
            P.ik(side, 'UpLeg', ank, pole, end_R=Rf, twist_share=0.0)

    def foot_pose(self, side, contact, pitch, height, heading):
        """tobillo y rotación del pie: 'contact' = punto bajo el tobillo en el suelo (si pitch > 0 el talón se
        levanta pivotando en la bola del pie; si pitch < 0 la punta sube pivotando en el talón)"""
        sk = self.sk
        ank_r = self.R[self.I[side + 'Foot']]
        ball_r = self.R[self.I[side + 'ToeBase']]
        H = heading
        Rp = rx(pitch)
        base = np.array([contact[0], 0.0, contact[2]])
        rel_ank = np.array([0, ank_r[1], 0])
        if pitch > 0:                              # talón arriba: pivote en la bola
            piv = base + H @ np.array([0, 0, ball_r[2] - ank_r[2]])
            ank = piv + H @ Rp @ (np.array([0, ank_r[1], -(ball_r[2] - ank_r[2])]))
        else:                                      # punta arriba: pivote en el talón
            hz = -0.075
            piv = base + H @ np.array([0, 0, hz])
            ank = piv + H @ Rp @ np.array([0, ank_r[1], -hz])
        ank = ank + np.array([0, height, 0])
        return ank, H @ Rp

    def gait(self, P, t, T, D, direction, H=0.2, stance=0.32, bob=0.022, lean=0.0, sway_deg=7.0, cross=0.015, lateral=False):
        sk = self.sk
        u = (t / T) % 1.0
        dirv = unit(direction)
        feet = {}
        for side, sx, off in (('Left', 1, 0.0), ('Right', -1, 0.5)):
            ph = (u + off) % 1.0
            ank0 = self.R[self.I[side + 'Foot']].copy()
            if lateral:
                ank0[0] = sx * (0.30 if np.dot(dirv, [sx, 0, 0]) > 0 else 0.13)
            ank0[0] -= sx * cross
            heading = yaw(sx * math.radians(1))
            if ph < stance:                        # apoyo: retrocede a velocidad constante
                s = ph / stance
                along = D / 2 - D * s
                pitch = -math.radians(14) * (1 - smooth(s / 0.22)) + math.radians(38) * smooth((s - 0.62) / 0.38) ** 1.4
                h = 0.0
                lift_toe = smooth((s - 0.75) / 0.25)
            else:                                  # vuelo de la pierna: talón al glúteo, rodilla arriba, pie delante
                s = (ph - stance) / (1 - stance)
                e = smoother(s) ** 1.12
                along = -D / 2 + D * e
                h = H * math.sin(math.pi * min(1, s / 0.92)) ** 1.6 * (1 - 0.35 * s)
                pitch = math.radians(38) * (1 - smooth(s / 0.45)) - math.radians(14) * smooth((s - 0.55) / 0.45)
                lift_toe = 1 - smooth(s / 0.3)
            contact = ank0 + dirv * along
            if lateral and ph >= stance:           # el pie que vuela pasa por delante del otro
                contact = contact + np.array([0, 0.0, 0.0])
            if lateral:
                pitch *= 0.25
            ank, Rf = self.foot_pose(side, contact, pitch, h, heading)
            feet[side] = (ank, Rf, lift_toe)
        # cadera: baja en el apoyo medio, sube en el vuelo; gira con la pierna que avanza
        hb = -bob * math.cos(TAU * 2 * (u - stance / 2))
        P.hips = np.array([0.0, hb + (0.008 if lateral else -0.012), (-0.035 * lean / math.radians(6) if lean else 0.0) + (0.008 if lateral else 0.0)])
        sw = math.sin(TAU * (u - 0.25))
        hyaw = math.radians(sway_deg) * sw
        if lateral:
            hyaw *= 0.35
        P.local('Hips', yaw(hyaw) @ up(-lean) @ roll(math.radians(0.8) * math.sin(TAU * 2 * (u - stance / 2) + 0.6) * (0.5 if lateral else 1)))
        P.local('Spine', yaw(-hyaw * 1.25) @ up(lean * 0.3))
        self.legs_to(P, {k: (v[0], v[1]) for k, v in feet.items()}, knee_out=0.9 if lateral else 0.12)
        for side in ('Left', 'Right'):
            P.local(side + 'ToeBase', rx(-math.radians(30) * feet[side][2]))

    # ---- tren superior
    def chest(self, P, twist=0.0, lean=0.0, breath_t=None, side_bend=0.0):
        """reparte giro/inclinación del torso entre Spine1 y Spine2 (+ respiración)"""
        b = 0.0
        if breath_t is not None:
            b = math.radians(0.9) * math.sin(TAU * breath_t / 3.6)
        P.local('Spine1', yaw(twist * 0.45) @ up(-lean * 0.45 - b * 0.5) @ roll(side_bend * 0.5))
        P.local('Spine2', yaw(twist * 0.55) @ up(-lean * 0.55 + b) @ roll(side_bend * 0.5))

    def head_look(self, P, pitch=0.0, rol=0.0, yaw_=0.0, center_pull=1.0):
        """la cabeza mira al frente del cuerpo (contra-gira lo que gira el torso) y se queda en su esfera"""
        Rh = yaw(yaw_) @ up(pitch) @ roll(rol)
        Rn_w, _ = P.world('Neck')
        Rs_w, _ = P.world('Spine2')
        # cuello: la mitad del contragiro; cabeza: el resto
        Rn = Rs_w @ np.eye(3)
        target = Rh
        rel = Rs_w.T @ target
        q = quat(rel)
        ang = 2 * math.acos(max(-1, min(1, q[3])))
        if ang > 1e-6:
            axis = q[:3] / math.sin(ang / 2)
            P.set_world_rot('Neck', Rs_w @ rot(axis, ang * 0.35))
        P.set_world_rot('Head', target)

    def weapon_world(self, P, arma):
        """(R, p) del arma en el mundo a partir de su pose relativa a la clavícula derecha"""
        Rc, Pc = P.world('RightShoulder')
        Ra, pa = arma
        return Rc @ Ra, Pc + Rc @ pa

    def arma_from_body(self, P_rest_shoulder, Rb, pb):
        """pose del arma dada en el marco del cuerpo en reposo -> relativa a la clavícula en reposo"""
        return Rb, np.asarray(pb, float) - P_rest_shoulder

    def hands_on(self, P, kind, arma_body, left=True, left_override=None, right_override=None, elbow_r=None, elbow_l=None,
                 clav_r=(0.0, 0.0), clav_l=(0.0, 0.0)):
        """coloca el arma (marco del cuerpo con el torso en reposo, se transporta con la clavícula) y las manos"""
        sk = self.sk
        # clavículas: (elevar, adelantar) en radianes
        P.local('RightShoulder', rz(-clav_r[0]) @ ry(-clav_r[1]))
        P.local('LeftShoulder', rz(clav_l[0]) @ ry(clav_l[1]))
        Rb, pb = arma_body
        # la pose del arma se da en el marco del cuerpo con la cadera y la columna baja quietas y de pie; se
        # guarda relativa a la clavícula derecha de esa referencia, así en el clip (y al mezclar capas) el arma
        # acompaña al torso: respiración, pasos, agacharse
        ref = Pose(sk)
        for n in ('Spine1', 'Spine2', 'RightShoulder'):
            ref.L[sk.i[n]] = P.L[sk.i[n]]
        Rc0, Pc0 = ref.world('RightShoulder')
        P.arma = (Rc0.T @ Rb, Rc0.T @ (np.asarray(pb, float) - Pc0))
        Rw, pw = self.weapon_world(P, P.arma)
        W = WEAPONS[kind]
        # mano derecha: el socket en el origen del arma
        if right_override is None:
            soff, Rs0 = sk.sock['Right']
            Rh = Rw @ Rs0.T
            wrist = pw - Rh @ soff
        else:
            Rh, wrist = right_override
        pole_r = elbow_r if elbow_r is not None else np.array([-0.9, -0.55, -0.25])
        P.ik('Right', 'Arm', wrist, pole_r, end_R=Rh)
        if left and W['left'] is not None:
            soff, Rs0 = sk.sock['Left']
            if left_override is None:
                tgt = pw + Rw @ np.array(W['left'])
                Rh = Rw @ Rs0.T
            else:
                Rh, tgt = left_override
            wrist = tgt - Rh @ soff
            pole_l = elbow_l if elbow_l is not None else np.array([0.5, -0.9, -0.1])
            P.ik('Left', 'Arm', wrist, pole_l, end_R=Rh)
        return Rw, pw

    def arm_free(self, P, side, hand_pos, Rh=None, pole=None):
        sx = 1 if side == 'Left' else -1
        if Rh is None:
            Rh = np.eye(3)
        soff, Rs0 = self.sk.sock[side]
        wrist = np.asarray(hand_pos, float) - Rh @ soff
        P.ik(side, 'Arm', wrist, pole if pole is not None else np.array([sx * 0.6, -0.3, -1.0]), end_R=Rh)


# ------------------------------------------------------------------ poses del arma en el marco del cuerpo (torso en reposo)
def rifle_aim(pitch=0.0):
    """rifle al hombro: mira a la altura del ojo derecho, culata en el hueco del hombro"""
    R = up(pitch)
    piv = np.array([-0.045, 1.60, 0.02])       # el ojo (aprox.) – el arma gira alrededor de la línea de mira
    p0 = np.array([-0.045, 1.60 - 0.161, 0.32])
    return R, piv + R @ (p0 - piv)


def rifle_low(dip=math.radians(28)):
    R = up(-dip) @ yaw(math.radians(8))
    butt = np.array([-0.10, 1.40, 0.0])
    return R, butt + R @ np.array([0, -0.075, 0.337])


def look(zdir, yhint):
    z = unit(zdir)
    y = unit(np.asarray(yhint, float) - np.dot(yhint, z) * z)
    return np.stack([np.cross(y, z), y, z], 1)


def rifle_port(t=0.0):
    """al correr: cruzado delante del pecho, cañón arriba a la izquierda, mano derecha a la altura de la cadera"""
    R = look((0.80, 0.42, 0.42), (-0.3, 0.4, 1.0))
    return R, np.array([-0.13, 1.06, 0.20])


def pistol_aim(pitch=0.0):
    R = up(pitch)
    piv = np.array([0.0, 1.43, 0.0])
    p0 = np.array([-0.02, 1.43, 0.47])
    return R, piv + R @ (p0 - piv)


def pistol_low():
    return up(-math.radians(40)), np.array([-0.04, 1.12, 0.32])
