"""Pliegues de la tela (solo en la malla de alta que se hornea al mapa de normales).

Donde la tela se arruga de verdad: codos y puños (anillos comprimidos), sobre el cinturón, axilas,
entrepierna, detrás y delante de la rodilla, y el pantalón recogido sobre la bota. Más un ondulado
suave por toda la tela para que no parezca plástico. Valores en metros a lo largo de la normal.
"""
import math
import numpy as np
from noise import fbm, vnoise
from common import game_from_blender


def _axis_param(P, a, b):
    d = b - a
    L = np.linalg.norm(d)
    t = ((P - a) @ d) / (L * L)
    foot = a + np.outer(t, d)
    radial = P - foot
    return t, L, radial


def fold_offsets(P, reg, J):
    G = {k: game_from_blender(np.array(v)) for k, v in J.items()}
    jacket, pants, glove = reg[:, 0], reg[:, 1], reg[:, 2]
    cloth = np.clip(jacket + pants, 0, 1)
    y = P[:, 1]
    warp = fbm(P, 9.0, 3, seed=3)            # deforma las líneas de pliegue para que no sean regulares
    d = np.zeros(len(P))
    # ondulado general de la tela
    d += cloth * (0.0013 * (fbm(P, 28.0, 3, seed=11) - 0.5) + 0.0009 * (vnoise(P, 70.0, seed=5) - 0.5))
    # mangas: anillos comprimidos en el codo y sobre el puño
    for s in ('l', 'r'):
        sh, el, wr = G[s + '-shoulder'], G[s + '-elbow'], G[s + '-hand']
        side = (P[:, 0] > 0) if s == 'l' else (P[:, 0] < 0)
        for a, b, centers in ((sh, el, [(1.0, 0.10, 0.0034)]), (el, wr, [(0.0, 0.10, 0.0034), (0.78, 0.16, 0.0030)])):
            t, L, rad = _axis_param(P, a, b)
            s_m = t * L
            for c, width, amp in centers:
                env = np.exp(-((s_m - c * L) / width) ** 2)
                th = np.arctan2(rad[:, 2], rad[:, 0] + 1e-9)
                wave = np.sin(math.tau * s_m / 0.030 + 2.5 * warp + 0.9 * np.sin(th * 1.0 + warp * 4))
                d += side * jacket * (reg[:, 0] > 0.5) * env * amp * np.sign(wave) * np.abs(wave) ** 0.7 * (0.6 + 0.8 * warp)
        # axila: pliegues diagonales
        ax = side * jacket * np.exp(-((y - (sh[1] - 0.09)) / 0.06) ** 2) * np.exp(-((np.abs(P[:, 0]) - (abs(sh[0]) - 0.03)) / 0.05) ** 2)
        d += ax * 0.003 * np.sin(math.tau * (y + np.abs(P[:, 0]) * 0.8) / 0.035 + 3 * warp)
    # chaqueta: fruncido sobre el cinturón y en la espalda baja
    belt = jacket * np.exp(-((y - 1.0) / 0.045) ** 2)
    d += belt * 0.0032 * np.sin(math.tau * (y / 0.024 + 0.35 * np.sin(P[:, 0] * 18 + warp * 3)) + 3 * warp)
    # pantalón: entrepierna, rodillas y recogido sobre la bota
    crotch = pants * np.exp(-((y - 0.80) / 0.07) ** 2) * np.exp(-(P[:, 0] / 0.10) ** 2)
    d += crotch * 0.0030 * np.sin(math.tau * (y - np.abs(P[:, 0]) * 1.3) / 0.035 + 2.5 * warp)
    for s in ('l', 'r'):
        kn = G[s + '-knee']
        side = (P[:, 0] > 0) if s == 'l' else (P[:, 0] < 0)
        env = np.exp(-((y - kn[1]) / 0.075) ** 2)
        back = np.clip(-(P[:, 2] - kn[2]) / 0.05, 0, 1)
        d += side * pants * env * (0.0020 + 0.0022 * back) * np.sin(math.tau * y / 0.026 + 3 * warp + P[:, 0] * 30)
    stack = pants * np.exp(-((y - 0.25) / 0.04) ** 2)
    d += stack * 0.0045 * np.sin(math.tau * y / 0.022 + 2 * warp + 1.5 * np.sin(np.arctan2(P[:, 2], P[:, 0]) * 2))
    # guantes: arrugas en los nudillos
    d += glove * 0.0006 * (vnoise(P, 160.0, seed=9) - 0.5)
    return d
