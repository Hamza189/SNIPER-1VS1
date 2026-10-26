"""SNIPER DUEL — personaje externo → formato del juego (parte 1, dentro de Blender).

Carga un personaje con esqueleto (glTF/GLB, FBX o .blend; esqueletos Mixamo, Character Creator, Rigify o
Unreal), lo deja en la postura de reposo, lo pasa a coordenadas del juego (+Y arriba, +Z delante, +X izquierda
del personaje, metros, ojos a 1,62 m como el esqueleto del juego), traslada sus pesos a los 26 huesos del juego,
hace 3 LOD con Decimate y exporta:
  <work>/model.npz     bones/rest/parents/tails + lod{0,1,2}_{pos,nrm,tan,uv,idx,joints,weights,part,mat}
  <work>/joints.json   puntos de la mano que usan las animaciones (dedos 2/3/5 y puño)
  <work>/materials.json + <work>/tex/*.png   texturas de cada material (color, normal, rugosidad/metal, AO)
La parte 2 (tools/personaje-ext/atlas.py) junta las texturas en un atlas y la 3 (build_glb del personaje rev. 04)
escribe el GLB con las 29 animaciones, el agachado y los LOD.

Uso: blender --background --factory-startup --python extract.py -- <entrada> <work> <cfg.json>
cfg: { "lod": [40000, 12000, 3000], "drop": ["regex de mallas a quitar"], "dropMat": ["regex de materiales"] }
"""
import bpy, bmesh, sys, os, re, json, math
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, WORK = argv[0], argv[1]
CFG = json.load(open(argv[2])) if len(argv) > 2 else {}
os.makedirs(os.path.join(WORK, 'tex'), exist_ok=True)
LOD = CFG.get('lod', [40000, 12000, 3000])
DROP = [re.compile(p, re.I) for p in CFG.get('drop', [])]
DROPMAT = [re.compile(p, re.I) for p in CFG.get('dropMat', [])]
log = lambda *a: print('[ext]', *a, flush=True)

# ------------------------------------------------------------------ cargar
if SRC.lower().endswith('.blend'):
    bpy.ops.wm.open_mainfile(filepath=SRC)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if SRC.lower().endswith(('.gltf', '.glb')):
        bpy.ops.import_scene.gltf(filepath=SRC)
    elif SRC.lower().endswith('.fbx'):
        bpy.ops.import_scene.fbx(filepath=SRC, use_anim=False, ignore_leaf_bones=True)
    else:
        raise SystemExit('formato no soportado: ' + SRC)

# ------------------------------------------------------------------ esqueleto
def norm(n):
    n = n.split(':')[-1]
    for p in ('mixamorig', 'CC_Base_', 'DEF-', 'ORG-', 'Bip01', 'Bip001'):
        if n.startswith(p):
            n = n[len(p):]
    return re.sub(r'[\s_.\-]', '', n).lower()

# nombres de los 26 huesos del juego → nombres normalizados posibles (Mixamo, Character Creator, Rigify, Unreal)
CAND = {
    'Hips': ['hips', 'hip', 'pelvis'],
    'Spine': ['spine', 'waist', 'spine01'],
    'Spine1': ['spine1', 'spine01', 'spine02', 'spine001'],
    'Spine2': ['spine2', 'spine02', 'spine03', 'spine002', 'spine003', 'chest'],
    'Neck': ['neck', 'necktwist01', 'neck01', 'spine004'],
    'Head': ['head', 'spine006'],
}
def side_names(S, s1):
    """S: 'Left'/'Right'; s1: 'l'/'r' (Mixamo LeftArm, Character Creator L_Upperarm, Rigify upper_arm.L, Unreal upperarm_l)"""
    w = S.lower()
    return {S + 'Shoulder': [w + 'shoulder', s1 + 'clavicle', 'shoulder' + s1, 'clavicle' + s1],
            S + 'Arm': [w + 'arm', s1 + 'upperarm', 'upperarm' + s1],
            S + 'ForeArm': [w + 'forearm', s1 + 'forearm', 'forearm' + s1, 'lowerarm' + s1],
            S + 'Hand': [w + 'hand', s1 + 'hand', 'hand' + s1],
            S + 'Thumb': [w + 'handthumb1', s1 + 'thumb1', 'thumb01' + s1, 'thumb1' + s1],
            S + 'UpLeg': [w + 'upleg', s1 + 'thigh', 'thigh' + s1],
            S + 'Leg': [w + 'leg', s1 + 'calf', 'shin' + s1, 'calf' + s1],
            S + 'Foot': [w + 'foot', s1 + 'foot', 'foot' + s1],
            S + 'ToeBase': [w + 'toebase', s1 + 'toebase', 'toe' + s1, 'ball' + s1, 'toebase' + s1]}
CAND.update(side_names('Left', 'l')); CAND.update(side_names('Right', 'r'))
FINGER = {'idx': ['handindex1', 'index1', 'f_index01', 'findex01'], 'mid': ['handmiddle1', 'mid1', 'middle1', 'fmiddle01'],
          'pinky': ['handpinky1', 'pinky1', 'fpinky01'], 'eye': ['eye']}

arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
meshes_all = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
def arm_of(o):
    for m in o.modifiers:
        if m.type == 'ARMATURE' and m.object:
            return m.object
use = {}
for o in meshes_all:
    a = arm_of(o)
    if a:
        use[a] = use.get(a, 0) + 1
ARM = max(use, key=use.get) if use else max(arms, key=lambda a: len(a.data.bones))
log('esqueleto', ARM.name, len(ARM.data.bones), 'huesos')
ARM.data.pose_position = 'REST'
bpy.context.view_layer.update()
bones = {b.name: b for b in ARM.data.bones}
byn = {}
for b in ARM.data.bones:
    byn.setdefault(norm(b.name), b)
# mano izquierda y derecha: los dedos se buscan bajo la mano
def find(cands, under=None):
    for c in cands:
        if c in byn and (under is None or under in [p.name for p in byn[c].parent_recursive] + [byn[c].name]):
            return byn[c]
    if under is not None:      # dedos: por subcadena bajo la mano
        for b in bones[under].children_recursive:
            nb = norm(b.name)
            if any(nb.endswith(c) or c in nb for c in cands):
                return b
    return None
MAP = {}
for k, cs in CAND.items():
    b = find(cs)
    if b:
        MAP[k] = b.name
# columna: si Spine1/Spine2 coinciden, repartir por la cadena
missing = [k for k in CAND if k not in MAP]
log('mapa', MAP)
if missing:
    raise SystemExit('faltan huesos: ' + ', '.join(missing))

MW = ARM.matrix_world
def wpos(bname, tail=False):
    b = bones[bname]
    return MW @ (b.tail_local if tail else b.head_local)

# orientación: el juego mira a +Z; en Blender el personaje mira a -Y (glTF/Mixamo/CC). Se comprueba con los pies.
foot, toe = wpos(MAP['LeftFoot']), wpos(MAP['LeftToeBase'])
fwd_sign = -1 if toe.y < foot.y else 1          # -1: mira a -Y (lo normal)
def to_game(v):
    return np.array([v.x if fwd_sign < 0 else -v.x, v.z, -v.y if fwd_sign < 0 else v.y])

# ojos (o, si no hay, un punto delante de la cabeza) → escala para que queden a 1,62 m
eyes = [b for b in ARM.data.bones if 'eye' in norm(b.name) and 'brow' not in norm(b.name) and 'lid' not in norm(b.name)]
head_g = to_game(wpos(MAP['Head']))
headtop = to_game(wpos(MAP['Head'], tail=True))
if eyes:
    eye_g = np.mean([to_game(MW @ b.head_local) for b in eyes[:2]], axis=0)
else:
    eye_g = head_g + (headtop - head_g) * 0.45
log('ojos sin escalar', eye_g)

# ------------------------------------------------------------------ mallas en reposo
keep = []
for o in meshes_all:
    if arm_of(o) != ARM or any(p.search(o.name) for p in DROP) or o.hide_render:
        if arm_of(o) == ARM:
            log('quito malla', o.name)
        continue
    keep.append(o)
log('mallas', [o.name for o in keep])
deps = bpy.context.evaluated_depsgraph_get()

ours = list(CAND.keys())
GAME = ['Root', 'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'Eyes', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftThumb',
        'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'RightThumb',
        'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
GI = {n: i for i, n in enumerate(GAME)}
inv = {v: k for k, v in MAP.items()}
# grupo de vértices → hueso del juego: el propio hueso o el antepasado más cercano que tenga correspondencia
def target_of(gname):
    b = bones.get(gname)
    if b is None:
        b = byn.get(norm(gname))
    while b is not None:
        if b.name in inv:
            return GI[inv[b.name]]
        b = b.parent
    return GI['Hips']

P, N, UV, F, FM, WJ, WW = [], [], [], [], [], [], []
mats = []
voff = 0
for o in keep:
    ev = o.evaluated_get(deps)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    M4 = ev.matrix_world
    nm3 = M4.to_3x3().inverted().transposed()
    # pesos (del objeto original: el evaluado conserva los grupos)
    gmap = {g.index: target_of(g.name) for g in o.vertex_groups}
    nv = len(me.vertices)
    W = np.zeros((nv, len(GAME)), np.float32)
    for v in me.vertices:
        for g in v.groups:
            t = gmap.get(g.group)
            if t is not None:
                W[v.index, t] += g.weight
    uvl = me.uv_layers.active
    # materiales globales
    lm = []
    for s in o.material_slots:
        m = s.material
        if m is None or any(p.search(m.name) for p in DROPMAT):
            lm.append(-1); continue
        if m not in mats:
            mats.append(m)
        lm.append(mats.index(m))
    # un vértice por esquina de triángulo; se juntan después
    for tri in me.loop_triangles:
        mi = lm[tri.material_index] if tri.material_index < len(lm) else -1
        if mi < 0:
            continue
        ids = []
        for li in tri.loops:
            lp = me.loops[li]
            vi = lp.vertex_index
            p = M4 @ me.vertices[vi].co
            n = (nm3 @ lp.normal).normalized()
            P.append(to_game(p)); N.append(to_game(n))
            UV.append(tuple(uvl.data[li].uv) if uvl else (0.0, 0.0))
            WJ.append(W[vi])
            ids.append(len(P) - 1)
        F.append(ids); FM.append(mi)
    ev.to_mesh_clear()
P = np.array(P, np.float64); N = np.array(N, np.float64); UV = np.array(UV, np.float32); F = np.array(F, np.int64); FM = np.array(FM, np.int32)
WJ = np.array(WJ, np.float32)
log('triángulos', len(F), 'materiales', [m.name for m in mats])

# piel tapada por la ropa: un triángulo de piel cuyo frente choca con ropa a menos de 'hideDist' no se ve nunca
HIDE = [re.compile(p, re.I) for p in CFG.get('hide', [])]
if HIDE:
    from mathutils.bvhtree import BVHTree
    hm = np.array([any(p.search(m.name) for p in HIDE) for m in mats])
    skin = hm[FM]
    cover = np.where(~skin)[0]
    tree = BVHTree.FromPolygons([Vector(v) for v in P.tolist()], F[cover].tolist(), all_triangles=True)
    A, B_, C = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
    cen = (A + B_ + C) / 3
    fn = np.cross(B_ - A, C - A); fn /= np.maximum(np.linalg.norm(fn, axis=1), 1e-12)[:, None]
    dist = CFG.get('hideDist', 0.06)
    hidden = np.zeros(len(F), bool)
    for i in np.where(skin)[0]:
        hits = 0
        for pt in (cen[i], A[i] * 0.8 + cen[i] * 0.2, B_[i] * 0.8 + cen[i] * 0.2, C[i] * 0.8 + cen[i] * 0.2):
            h = tree.ray_cast(Vector((pt + fn[i] * 1e-4).tolist()), Vector(fn[i].tolist()), dist)
            if h[0] is not None:
                hits += 1
        hidden[i] = hits == 4
    keepf = ~hidden
    log('piel tapada quitada', int(hidden.sum()), 'triángulos')
    F, FM = F[keepf], FM[keepf]

# escala y suelo
s = 1.62 / (eye_g[1] - P[:, 1].min()) if eye_g[1] > P[:, 1].min() else 1.0
ground = P[:, 1].min()
def G(v):
    v = np.array(v, float) * 1.0
    return np.array([v[0] * s, (v[1] - ground) * s, v[2] * s])
P = np.stack([P[:, 0] * s, (P[:, 1] - ground) * s, P[:, 2] * s], 1)
# centrar en X/Z sobre la cadera
hip = G(to_game(wpos(MAP['Hips'])))
P[:, 0] -= hip[0]; P[:, 2] -= hip[2]
def J(name, tail=False):
    g = G(to_game(wpos(MAP[name], tail)))
    g[0] -= hip[0]; g[2] -= hip[2]
    return g

# ------------------------------------------------------------------ esqueleto del juego (posiciones de reposo)
rest = {}
rest['Root'] = np.array([0.0, 0.0, 0.0])
for k in ours:
    rest[k] = J(k)
eye_s = G(eye_g); eye_s[0] -= hip[0]; eye_s[2] -= hip[2]
rest['Eyes'] = np.array([0.0, eye_s[1], eye_s[2]])
for side in ('Left', 'Right'):
    # pulgar: si queda fuera de la mano por el mapeo, a media mano
    pass
PAR = {'Root': -1, 'Hips': 'Root', 'Spine': 'Hips', 'Spine1': 'Spine', 'Spine2': 'Spine1', 'Neck': 'Spine2', 'Head': 'Neck', 'Eyes': 'Head'}
for side in ('Left', 'Right'):
    PAR.update({side + 'Shoulder': 'Spine2', side + 'Arm': side + 'Shoulder', side + 'ForeArm': side + 'Arm', side + 'Hand': side + 'ForeArm',
                side + 'Thumb': side + 'Hand', side + 'UpLeg': 'Hips', side + 'Leg': side + 'UpLeg', side + 'Foot': side + 'Leg', side + 'ToeBase': side + 'Foot'})
parents = [-1 if PAR[n] == -1 else GI[PAR[n]] for n in GAME]
CH = {'Root': 'Hips', 'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head'}
tails = []
for n in GAME:
    if n in CH:
        tails.append(rest[CH[n]])
    elif n == 'Head':
        tails.append(J('Head', tail=True) if np.linalg.norm(J('Head', True) - rest['Head']) > 0.05 else rest['Head'] + [0, 0.155, 0])
    elif n == 'Eyes':
        tails.append(rest['Eyes'] + [0, 0, 0.08])
    elif n.endswith(('Shoulder', 'Arm', 'ForeArm', 'UpLeg', 'Leg', 'Foot')):
        nxt = {'Shoulder': 'Arm', 'Arm': 'ForeArm', 'ForeArm': 'Hand', 'UpLeg': 'Leg', 'Leg': 'Foot', 'Foot': 'ToeBase'}
        side = 'Left' if n.startswith('Left') else 'Right'
        key = n[len(side):]
        tails.append(rest[side + nxt[key]])
    else:
        side = 'Left' if n.startswith('Left') else 'Right'
        tails.append(J(n, tail=True))
REST = np.array([rest[n] for n in GAME]); TAILS = np.array(tails)

# ------------------------------------------------------------------ encajar en las zonas de impacto del servidor
# (core/hitbox.js: cabeza esfera r 0,15 a 1,63 m; tronco caja ±0,245/±0,16; piernas caja ±0,19/±0,11, centradas en z = 0).
# Las zonas no se tocan: se acortan las botas hacia el tobillo (cfg footScale) y se desplaza el modelo en z (dz)
# para que la cabeza quepa en su esfera en reposo y el resto quede lo más dentro posible.
BN = np.array(GAME)
Wsum = lambda names_: WJ[:, [GI[n] for n in names_]].sum(1)
footw = np.clip(Wsum(['LeftFoot', 'LeftToeBase', 'RightFoot', 'RightToeBase']), 0, 1)
kf, kb = CFG.get('footScale', [1.0, 1.0])
if kf != 1.0 or kb != 1.0:
    for side in ('Left', 'Right'):
        ank = rest[side + 'Foot']
        sel = (Wsum([side + 'Foot', side + 'ToeBase', side + 'Leg']) > 0.05) & (P[:, 1] < ank[1] + 0.05) & (np.sign(P[:, 0]) == (1 if side == 'Left' else -1))
        dzv = P[sel, 2] - ank[2]
        k = np.where(dzv > 0, kf, kb)
        w = footw[sel]
        P[sel, 2] = ank[2] + dzv * (1 - w + w * k)
        for n in (side + 'ToeBase',):
            rest[n][2] = ank[2] + (rest[n][2] - ank[2]) * kf
    REST = np.array([rest[n] for n in GAME])
    TAILS[GI['LeftFoot']] = rest['LeftToeBase']; TAILS[GI['RightFoot']] = rest['RightToeBase']
    TAILS[GI['LeftToeBase']][2] = rest['LeftFoot'][2] + (TAILS[GI['LeftToeBase']][2] - rest['LeftFoot'][2]) * kf
    TAILS[GI['RightToeBase']][2] = rest['RightFoot'][2] + (TAILS[GI['RightToeBase']][2] - rest['RightFoot'][2]) * kf
    log('botas acortadas', kf, kb)
zh = Wsum(['Head', 'Eyes']) > 0.5
za = Wsum(['LeftArm', 'LeftForeArm', 'LeftHand', 'LeftThumb', 'RightArm', 'RightForeArm', 'RightHand', 'RightThumb']) > 0.5
zb = ~(zh | za)
def excess(dz):
    Q = P + [0, 0, dz]
    head = (np.linalg.norm(Q[zh] - [0, 1.63, 0], axis=1) - 0.15).max() if zh.any() else -1
    def bx(q, y, hx, hy, hz):
        return np.linalg.norm(np.stack([np.maximum(0, abs(q[:, 0]) - hx), np.maximum(0, abs(q[:, 1] - y) - hy), np.maximum(0, abs(q[:, 2]) - hz)], 1), axis=1)
    q = Q[zb]
    return head, np.minimum(bx(q, 1.17, .245, .31, .16), bx(q, .43, .19, .43, .11)).max()
if 'dz' in CFG:
    DZ = CFG['dz']
else:
    best = None
    for dz in np.arange(-0.10, 0.0401, 0.0025):
        h, bmax = excess(dz)
        if h <= CFG.get('headSlack', 0.02) and (best is None or bmax < best[1]):
            best = (dz, bmax)
    DZ = best[0] if best else 0.0
h, bmax = excess(DZ)
log('desplazamiento z', round(float(DZ), 4), 'cabeza', round(float(h) * 100, 1), 'cm', 'cuerpo', round(float(bmax) * 100, 1), 'cm (reposo)')
P[:, 2] += DZ; REST[:, 2] += DZ; TAILS[:, 2] += DZ
for k in rest:
    rest[k] = rest[k] + [0, 0, DZ]
# lo que aún sobresale de las cajas (bolsillos, bolsas del chaleco) se acerca a ellas con una curva suave: nunca más
# de 'fitMargin' fuera en reposo, sin escalones (exceso e → m·(1 − e^(−e/m)))
FM_ = CFG.get('fitMargin', 0.025)
if FM_ > 0:
    q = P[zb]
    BOX = [(1.17, .245, .31, .16), (.43, .19, .43, .11)]
    ex = []
    for (y, hx, hy, hz) in BOX:
        c = np.array([0, y, 0]); h = np.array([hx, hy, hz])
        ex.append(np.maximum(0, np.abs(q - c) - h))
    pick = np.linalg.norm(ex[0], axis=1) <= np.linalg.norm(ex[1], axis=1)
    moved = 0
    for bi, (y, hx, hy, hz) in enumerate(BOX):
        sel = pick if bi == 0 else ~pick
        c = np.array([0, y, 0]); h = np.array([hx, hy, hz])
        d = q[sel] - c
        hh = np.tile(h, (len(d), 1))
        # zonas que la animación empuja hacia fuera (glúteos al andar, rodillas al deslizarse): se meten un poco más
        for ins in CFG.get('fitInset', []):
            if ins.get('box', 'legs') != ('torso', 'legs')[bi]:
                continue
            ax = 'xyz'.index(ins.get('axis', 'z'))
            m_ = (q[sel][:, 1] >= ins['y'][0]) & (q[sel][:, 1] <= ins['y'][1]) & (np.sign(d[:, ax]) == ins.get('side', -1))
            hh[m_, ax] -= ins.get('inset', 0.01)
        h = hh
        e = np.maximum(0, np.abs(d) - h)
        es = FM_ * (1 - np.exp(-e / FM_))
        nd = np.where(e > 0, np.sign(d) * (h + es), d)
        moved += int((e > 0).any(1).sum())
        q[sel] = c + nd
    P[zb] = q
    log('ajuste suave a las cajas:', moved, 'vértices (máx', FM_ * 100, 'cm fuera en reposo)')
# la cabeza tiene que caber en su esfera en reposo sin tolerancia: lo que sobra (punta de la visera, casco) entra con
# una curva suave que empieza 1,2 cm antes del borde y nunca llega a él
if zh.any():
    c = np.array([0, 1.63, 0]); r = 0.15; rin = r - 0.012; rout = r - 0.002
    v = P[zh] - c; d = np.linalg.norm(v, axis=1)
    sel = d > rin
    dn = rin + (rout - rin) * (1 - np.exp(-(d[sel] - rin) / (rout - rin)))
    v[sel] *= (dn / d[sel])[:, None]
    P[zh] = c + v
    log('cabeza dentro de su esfera:', int(sel.sum()), 'vértices ajustados, antes', round(float(d.max() - r) * 100, 2), 'cm')
# por encima de la entrepierna, el muslo no debe arrastrar la cadera al andar: parte de su peso pasa a Hips
HB = CFG.get('hipBlend', [0.70, 0.86, 0.35])   # de y0 (todo muslo) a y1 (solo 'keep' del muslo)
if HB:
    y0, y1, keep_ = HB
    t = np.clip((P[:, 1] - y0) / (y1 - y0), 0, 1)
    f = 1 - t * (1 - keep_)
    for n in ('LeftUpLeg', 'RightUpLeg'):
        c = GI[n]
        moved_w = WJ[:, c] * (1 - f)
        WJ[:, c] -= moved_w
        WJ[:, GI['Hips']] += moved_w

# puntos de la mano (dedos índice / medio / meñique y puño)
JJ = {}
for side, sh in (('Left', 'l'), ('Right', 'r')):
    hand = MAP[side + 'Hand']
    pts = {}
    for k in ('idx', 'mid', 'pinky'):
        b = find(FINGER[k], under=hand)
        pts[k] = G(to_game(MW @ b.head_local)) - [hip[0], 0, hip[2] - DZ] if b else None
    w = rest[side + 'Hand']
    fwd = (rest[side + 'Hand'] - rest[side + 'ForeArm']); fwd /= np.linalg.norm(fwd)
    for k, d in (('idx', 0.09), ('mid', 0.095), ('pinky', 0.085)):
        if pts[k] is None:
            pts[k] = w + fwd * d
    JJ[sh + '-finger-2-1'] = pts['idx'].tolist(); JJ[sh + '-finger-3-1'] = pts['mid'].tolist(); JJ[sh + '-finger-5-1'] = pts['pinky'].tolist()
    JJ[sh + '-fist'] = (w + (pts['mid'] - w) * 0.75).tolist()
json.dump(JJ, open(os.path.join(WORK, 'joints.json'), 'w'), indent=1)
log('alto de ojos', rest['Eyes'][1], 'cabeza', rest['Head'], 'altura', P[:, 1].max())

# ------------------------------------------------------------------ malla única en Blender para el Decimate
def build_obj(name):
    me = bpy.data.meshes.new(name)
    # vértices únicos por posición (para que el Decimate trabaje sobre una malla cerrada); UV y normales por esquina
    key = np.round(P, 5)
    uniq, inv_ = np.unique(key, axis=0, return_inverse=True)
    inv_ = inv_.reshape(-1)
    me.from_pydata(uniq.tolist(), [], inv_[F].tolist())
    me.update()
    uvl = me.uv_layers.new(name='UV')
    loop_uv = UV[F.reshape(-1)]
    uvl.data.foreach_set('uv', loop_uv.reshape(-1))
    me.polygons.foreach_set('material_index', FM)
    me.polygons.foreach_set('use_smooth', [True] * len(F))
    for i in range(len(mats)):
        me.materials.append(bpy.data.materials.new('m%d' % i))
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    # pesos por vértice único (media de las esquinas)
    Wu = np.zeros((len(uniq), len(GAME)), np.float32); cnt = np.zeros(len(uniq))
    np.add.at(Wu, inv_, WJ); np.add.at(cnt, inv_, 1)
    Wu /= np.maximum(cnt, 1)[:, None]
    for gi, gn in enumerate(GAME):
        vg = ob.vertex_groups.new(name=gn)
        idx = np.where(Wu[:, gi] > 1e-4)[0]
        for i in idx:
            vg.add([int(i)], float(Wu[i, gi]), 'REPLACE')
    # normales originales como normales personalizadas
    me.normals_split_custom_set(N[F.reshape(-1)].tolist())
    return ob

base = build_obj('base')
log('malla base', len(base.data.vertices), 'vértices', len(base.data.polygons), 'triángulos')

def export_lod(ob, target):
    bpy.context.view_layer.objects.active = ob
    ntri = len(ob.data.polygons)
    if target < ntri:
        mod = ob.modifiers.new('dec', 'DECIMATE')
        mod.ratio = target / ntri
        mod.use_collapse_triangulate = True
        mod.delimit = {'UV', 'MATERIAL'}
    deps = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(deps)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    me.calc_tangents(uvmap='UV')
    uvl = me.uv_layers['UV']
    gi = {g.index: GI[g.name] for g in ob.vertex_groups}
    # pesos por vértice: 4 mayores
    vw = []
    for v in me.vertices:
        ws = sorted(((g.weight, gi[g.group]) for g in v.groups if g.weight > 1e-4), reverse=True)[:4]
        tot = sum(w for w, _ in ws) or 1
        j = [b for _, b in ws] + [0] * (4 - len(ws)); w = [x / tot for x, _ in ws] + [0.0] * (4 - len(ws))
        if not ws:
            j, w = [GI['Hips'], 0, 0, 0], [1.0, 0, 0, 0]
        vw.append((j, w))
    pos, nrm, tan, uv, jo, we, idx, mat = [], [], [], [], [], [], [], []
    seen = {}
    for tri in me.loop_triangles:
        face = []
        for li in tri.loops:
            lp = me.loops[li]
            vi = lp.vertex_index
            co = me.vertices[vi].co
            n = lp.normal if (target >= ntri or me.has_custom_normals) else me.vertices[vi].normal
            t = lp.tangent
            u = uvl.data[li].uv
            k = (vi, round(u[0], 5), round(u[1], 5), round(n[0], 3), round(n[1], 3), round(n[2], 3))
            if k not in seen:
                seen[k] = len(pos)
                pos.append((co.x, co.y, co.z)); nrm.append((n.x, n.y, n.z)); tan.append((t.x, t.y, t.z, lp.bitangent_sign))
                uv.append((u[0], u[1])); jo.append(vw[vi][0]); we.append(vw[vi][1])
            face.append(seen[k])
        idx.append(face); mat.append(tri.material_index)
    ev.to_mesh_clear()
    if ob.modifiers:
        ob.modifiers.remove(ob.modifiers[0])
    return {'pos': np.array(pos), 'nrm': np.array(nrm), 'tan': np.array(tan), 'uv': np.array(uv, np.float32), 'idx': np.array(idx, np.int32),
            'joints': np.array(jo, np.int32), 'weights': np.array(we), 'mat': np.array(mat, np.int32)}

out = {'bones': np.array(GAME), 'rest': REST, 'parents': np.array(parents), 'tails': TAILS}
for i, tgt in enumerate(LOD):
    L = export_lod(base, tgt)
    log('LOD%d' % i, len(L['idx']), 'triángulos', len(L['pos']), 'vértices')
    for k, v in L.items():
        out['lod%d_%s' % (i, k)] = v
    out['lod%d_part' % i] = L['mat'].copy()
np.savez_compressed(os.path.join(WORK, 'model.npz'), **out)

# ------------------------------------------------------------------ texturas de cada material
def img_of(node_in):
    """imagen conectada (directa o a través de nodos intermedios) a una entrada"""
    if not node_in or not node_in.is_linked:
        return None, None
    n = node_in.links[0].from_node
    sock = node_in.links[0].from_socket.name
    seen = 0
    while n and n.type != 'TEX_IMAGE' and seen < 6:
        ins = [i for i in n.inputs if i.is_linked and i.type in ('RGBA', 'VECTOR', 'VALUE')]
        if not ins:
            return None, None
        prev = n
        n = ins[0].links[0].from_node
        sock = (prev.type, ins[0].links[0].from_socket.name, sock)
        seen += 1
    return (n.image if n and n.type == 'TEX_IMAGE' else None), sock

saved = {}
def save(img):
    if img is None:
        return None
    if img.name in saved:
        return saved[img.name]
    fn = re.sub(r'[^A-Za-z0-9_.-]', '_', img.name)
    if not fn.lower().endswith('.png'):
        fn += '.png'
    path = os.path.join(WORK, 'tex', fn)
    try:
        img.filepath_raw = path
        img.file_format = 'PNG'
        img.save()
    except Exception as e:
        try:
            img.save_render(path)
        except Exception as e2:
            log('no se pudo guardar', img.name, e2); return None
    saved[img.name] = fn
    return fn

MJ = []
for m in mats:
    d = {'name': m.name}
    bsdf = next((n for n in (m.node_tree.nodes if m.node_tree else []) if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf:
        im, _ = img_of(bsdf.inputs['Base Color']); d['color'] = save(im)
        d['colorFactor'] = list(bsdf.inputs['Base Color'].default_value)[:3]
        nin = bsdf.inputs['Normal']
        if nin.is_linked and nin.links[0].from_node.type == 'NORMAL_MAP':
            im, _ = img_of(nin.links[0].from_node.inputs['Color']); d['normal'] = save(im)
        im, sk = img_of(bsdf.inputs['Roughness']); d['rough'] = save(im); d['roughCh'] = 'G' if sk and 'Green' in str(sk) or (sk and 'G' == str(sk)[-1:]) else ('R' if im else None)
        d['roughness'] = float(bsdf.inputs['Roughness'].default_value)
        im, sk = img_of(bsdf.inputs['Metallic']); d['metal'] = save(im); d['metalCh'] = 'B' if sk and 'Blue' in str(sk) else ('R' if im else None)
        d['metallic'] = float(bsdf.inputs['Metallic'].default_value)
        a = bsdf.inputs.get('Alpha')
        d['alphaLinked'] = bool(a and a.is_linked)
    # oclusión (glTF: grupo «glTF Material Output»/«glTF Settings»)
    for n in (m.node_tree.nodes if m.node_tree else []):
        if n.type == 'GROUP' and 'Occlusion' in n.inputs:
            im, _ = img_of(n.inputs['Occlusion']); d['ao'] = save(im)
    MJ.append(d)
json.dump(MJ, open(os.path.join(WORK, 'materials.json'), 'w'), indent=1)
log('materiales', json.dumps(MJ)[:1500])
log('LISTO')
