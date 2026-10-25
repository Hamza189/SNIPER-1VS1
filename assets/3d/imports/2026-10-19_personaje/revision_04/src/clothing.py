"""Paso 2: la ropa sobre el cuerpo (chaqueta, pantalón cargo, guantes, braga de cuello).

La ropa es la propia superficie del cuerpo suavizada (fuera pezones, ombligo, glúteos marcados) y
ensanchada a lo largo de la normal con holguras distintas por prenda; el pantalón cae recto desde la
rodilla como la tela de verdad. Las botas son piezas aparte (gear.py) y los pies se quitan.
Los pliegues finos van en el mapa de normales; aquí solo los volúmenes.
Todo se calcula en coordenadas del juego (x, y arriba, z delante).
"""
import math
import numpy as np
import bpy
from common import *

JACKET_HEM = 0.965      # bajo de la chaqueta (el cinturón asoma debajo)
BOOT_TOP = 0.215        # caña de la bota
FOOT_CUT = 0.165        # por debajo, el pie se borra (lo tapa la bota)


def weights_matrix(ob):
    names = [g.name for g in ob.vertex_groups]
    W = np.zeros((len(ob.data.vertices), len(names)))
    for v in ob.data.vertices:
        for g in v.groups:
            W[v.index, g.group] = g.weight
    s = W.sum(1, keepdims=True)
    W = W / np.maximum(s, 1e-9)
    return names, W


def group_weight(names, W, pred):
    cols = [i for i, n in enumerate(names) if pred(n)]
    return W[:, cols].sum(1) if cols else np.zeros(len(W))


def adjacency(ob):
    n = len(ob.data.vertices)
    e = np.empty(len(ob.data.edges) * 2, dtype=np.int64)
    ob.data.edges.foreach_get('vertices', e)
    return n, e.reshape(-1, 2)


def laplacian(P, n, e, mask, lam=0.5, mu=-0.53, iters=10):
    """Suavizado de Taubin (no encoge) ponderado por máscara."""
    deg = np.maximum(np.bincount(e.ravel(), minlength=n).astype(float), 1)
    m = np.asarray(mask)[:, None]
    for _ in range(iters):
        for f in (lam, mu):
            acc = np.zeros_like(P)
            np.add.at(acc, e[:, 0], P[e[:, 1]])
            np.add.at(acc, e[:, 1], P[e[:, 0]])
            P = P + f * m * (acc / deg[:, None] - P)
    return P


def vertex_normals_game(ob):
    ob.data.update()
    return game_from_blender(normals_np(ob))


def segment_param(P, a, b):
    d = b - a
    return ((P - a) @ d) / (d @ d)


def classify(ob, J):
    """Campos por vértice en coordenadas del juego (máscaras 0..1)."""
    names, W = weights_matrix(ob)
    P = game_from_blender(verts_np(ob))
    G = {k: game_from_blender(v) for k, v in J.items()}
    hand = group_weight(names, W, lambda n: n.endswith('Hand') or ('F' in n and '_' in n))
    arm = group_weight(names, W, lambda n: n.endswith('Arm')) + hand
    leg = group_weight(names, W, lambda n: n.endswith('Leg') or n.endswith('Foot') or n.endswith('ToeBase'))
    head = group_weight(names, W, lambda n: n == 'Head')
    neck = group_weight(names, W, lambda n: n == 'Neck')
    glove = np.zeros(len(P))
    for s in ('l', 'r'):
        side = (P[:, 0] > 0) if s == 'l' else (P[:, 0] < 0)
        t = segment_param(P, G[s + '-elbow'], G[s + '-hand'])
        glove = np.maximum(glove, side * (arm > 0.3) * smoothstep(0.90, 0.94, t))
    y = P[:, 1]
    boot = np.clip(leg + (y < 0.25), 0, 1) * (1 - smoothstep(BOOT_TOP - 0.004, BOOT_TOP + 0.004, y))
    head_all = np.clip(head + neck * smoothstep(1.50, 1.56, y), 0, 1)
    upper = smoothstep(JACKET_HEM - 0.004, JACKET_HEM + 0.004, y)
    jacket = np.clip((1 - glove) * (1 - head_all) * np.maximum(upper, arm * (y > 0.9)), 0, 1)
    pants = np.clip((1 - jacket) * (1 - head_all) * (1 - glove), 0, 1)
    return dict(P=P, names=names, W=W, glove=glove, boot=boot, head=head_all, jacket=jacket, pants=pants,
                arm=np.clip(arm, 0, 1), leg=np.clip(leg, 0, 1))


def hang(P, mask, axis_fn, y0, y1, bins=32, blend=0.8):
    """La tela cae: por debajo de su punto más ancho no vuelve a meterse (máximo acumulado de arriba abajo)."""
    sel = np.where(mask & (P[:, 1] > y0) & (P[:, 1] < y1))[0]
    if not len(sel):
        return P
    c = np.array([axis_fn(y) for y in P[sel, 1]])
    d = P[sel][:, [0, 2]] - c
    r = np.linalg.norm(d, axis=1)
    th = np.arctan2(d[:, 1], d[:, 0])
    b = ((th + math.pi) / math.tau * bins).astype(int) % bins
    order = np.argsort(-P[sel, 1])
    run = np.zeros(bins)
    target = np.empty(len(sel))
    # recorrer de arriba abajo por franjas: el radio objetivo es el máximo visto por encima en ese ángulo
    for k in order:
        run[b[k]] = max(run[b[k]] * 0.985, r[k])
        target[k] = run[b[k]]
    w = blend * smoothstep(y0, y0 + 0.06, P[sel, 1]) * (1 - smoothstep(y1 - 0.05, y1, P[sel, 1]))
    newr = r + (target - r) * w
    P = P.copy()
    P[sel, 0] = c[:, 0] + d[:, 0] / np.maximum(r, 1e-9) * newr
    P[sel, 2] = c[:, 1] + d[:, 1] / np.maximum(r, 1e-9) * newr
    return P


def dress(ob, J):
    C = classify(ob, J)
    P = C['P'].copy()
    G = {k: game_from_blender(v) for k, v in J.items()}
    n, e = adjacency(ob)
    y = P[:, 1]
    # complexión: hombros y pecho algo más anchos, cuello más grueso
    torso_band = smoothstep(1.05, 1.30, y) * (1 - smoothstep(1.46, 1.52, y)) * (1 - C['arm'])
    P[:, 0] *= 1 + 0.015 * torso_band
    neckb = smoothstep(1.42, 1.47, y) * (1 - smoothstep(1.53, 1.58, y))
    P[:, 0] *= 1 + 0.08 * neckb
    P[:, 2] *= 1 + 0.05 * neckb
    # alisar la anatomía bajo la ropa; braga de cuello sobre boca y nariz (tela lisa, sin rasgos de nadie)
    cloth = np.clip(C['jacket'] + C['pants'], 0, 1)
    gaiter = C['head'] * (1 - smoothstep(1.578, 1.598, y))
    C['gaiter'] = gaiter
    P = laplacian(P, n, e, cloth * 0.9 + gaiter * 0.9, iters=16)
    set_verts(ob, game_to_blender(P))
    N = vertex_normals_game(ob)
    jy = P[:, 1]
    sleeve_t = np.zeros(len(P))
    for s in ('l', 'r'):
        side = (P[:, 0] > 0) if s == 'l' else (P[:, 0] < 0)
        sleeve_t = np.where(side, segment_param(P, G[s + '-elbow'], G[s + '-hand']), sleeve_t)
    # holguras (m) a lo largo de la normal
    jack = 0.024 + 0.014 * smoothstep(0.96, 1.08, jy) * (1 - smoothstep(1.10, 1.28, jy))
    sleeve = 0.024 - 0.010 * smoothstep(0.65, 0.90, sleeve_t)
    off = C['jacket'] * np.where(C['arm'] > 0.5, sleeve, jack)
    thigh = smoothstep(0.45, 0.62, jy) * (1 - smoothstep(0.80, 0.90, jy))
    off += C['pants'] * (0.011 + 0.002 * thigh - 0.005 * (1 - smoothstep(0.20, 0.30, jy)))
    off += C['glove'] * 0.0035
    off += C['head'] * 0.003 + gaiter * 0.005
    P = P + N * off[:, None]
    # el pantalón cae recto desde la rodilla; la chaqueta cuelga del pecho y la espalda
    for s, sd in ((1, 'l'), (-1, 'r')):
        knee, ank = G[sd + '-knee'], G[sd + '-ankle']
        axis = lambda yy, knee=knee, ank=ank: (ank + (knee - ank) * np.clip((yy - ank[1]) / (knee[1] - ank[1]), 0, 1))[[0, 2]]
        P = hang(P, (C['pants'] > 0.5) & (C['leg'] > 0.5) & (P[:, 0] * s > 0), axis, 0.27, knee[1] + 0.03, blend=0.35)
    P = hang(P, (C['jacket'] > 0.5) & (C['arm'] < 0.2), lambda yy: np.array([0.0, -0.01]), 0.95, 1.30, bins=40, blend=0.55)
    P = laplacian(P, n, e, np.clip(C['jacket'] + C['pants'], 0, 1) * 0.6, iters=6)
    set_verts(ob, game_to_blender(P))
    C['P'] = P
    C['J'] = J
    return C


def cut_feet(ob, C):
    """borra el pie (lo tapa la bota): caras con todos los vértices por debajo de FOOT_CUT en las piernas."""
    import bmesh
    P = C['P']
    kill = (P[:, 1] < FOOT_CUT) & (C['leg'] > 0.3)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    lay = bm.verts.layers.int.new('orig')
    for v in bm.verts:
        v[lay] = v.index
    faces = [f for f in bm.faces if all(kill[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=faces, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.verts.ensure_lookup_table()
    keep = np.zeros(len(P), bool)
    keep[[v[lay] for v in bm.verts]] = True
    bm.verts.layers.int.remove(lay)
    bm.to_mesh(ob.data)
    bm.free()
    for k in ('P', 'glove', 'boot', 'head', 'jacket', 'pants', 'arm', 'leg', 'gaiter', 'W'):
        C[k] = C[k][keep]
    return C
