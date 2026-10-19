"""Ruido de valor 3D determinista con numpy (sin dependencias): base de pliegues, desgaste y suciedad."""
import numpy as np

_PERM = np.random.default_rng(1907).permutation(4096)
_VAL = np.random.default_rng(2610).random(4096)


def _h(ix, iy, iz, seed):
    return _VAL[_PERM[(_PERM[(_PERM[(ix + seed * 131) & 4095] + iy) & 4095] + iz) & 4095]]


def vnoise(P, freq=1.0, seed=0):
    """ruido de valor suave en [0, 1] para puntos P (N, 3)"""
    Q = np.asarray(P, dtype=np.float64) * freq
    i = np.floor(Q).astype(np.int64)
    f = Q - i
    u = f * f * (3 - 2 * f)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (u[:, 0] if dx else 1 - u[:, 0]) * (u[:, 1] if dy else 1 - u[:, 1]) * (u[:, 2] if dz else 1 - u[:, 2])
                out = out + w * _h(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return out


def fbm(P, freq=1.0, octaves=4, seed=0, gain=0.5):
    out, amp, tot = 0, 1.0, 0
    for o in range(octaves):
        out = out + amp * vnoise(P, freq * 2 ** o, seed + o * 7)
        tot += amp
        amp *= gain
    return out / tot
