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
# glTF/GLB: lector propio (tools/personaje-ext/gltfread.py) en el espacio de la piel y en doble precisión; FBX y .blend: Blender
GLTF = SRC.lower().endswith(('.gltf', '.glb'))
if not GLTF:
    if SRC.lower().endswith('.blend'):
        bpy.ops.wm.open_mainfile(filepath=SRC)
    elif SRC.lower().endswith('.fbx'):
        bpy.ops.wm.read_factory_settings(use_empty=True)
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

if GLTF:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import gltfread
    RD = gltfread.read(SRC)
    ALLJ = dict(RD['joints'])
    for k_, v_ in RD['extra'].items():
        ALLJ.setdefault(k_, {'pos': v_['pos'], 'parent': v_['parent']})
    NAMES = list(ALLJ.keys())
    def s_pos(n): return np.array(ALLJ[n]['pos'], float)
    def s_parent(n): return ALLJ[n]['parent']
    log('esqueleto glTF', len(RD['jnames']), 'huesos con piel,', len(NAMES), 'nodos de esqueleto')
else:
    arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    meshes_all = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
    def arm_of(o):
        for m in o.modifiers:
            if m.type == 'ARMATURE' and m.object:
                return m.object
    def bone_parent(o):
        """(armadura, hueso) si el objeto cuelga de un hueso (directamente o a través de otros objetos)"""
        q = o
        while q.parent is not None:
            if q.parent_type == 'BONE' and q.parent.type == 'ARMATURE':
                return q.parent, q.parent_bone
            q = q.parent
        return None, None
    rigid = [o for o in bpy.data.objects if o.type == 'MESH' and not any(m.type == 'ARMATURE' for m in o.modifiers) and bone_parent(o)[0] is not None]
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
    MW = ARM.matrix_world
    NAMES = list(bones.keys())
    def s_pos(n): return np.array(MW @ bones[n].head_local, float)
    def s_parent(n): return bones[n].parent.name if bones[n].parent else None
CHILDREN = {n: [] for n in NAMES}
for n in NAMES:
    p_ = s_parent(n)
    if p_ in CHILDREN:
        CHILDREN[p_].append(n)
def s_desc(n):
    out, st = [], list(CHILDREN.get(n, []))
    while st:
        c = st.pop(); out.append(c); st += CHILDREN.get(c, [])
    return out
def s_anc(n):
    out = []
    p_ = s_parent(n)
    while p_ is not None:
        out.append(p_); p_ = s_parent(p_)
    return out
def s_tail(n):
    if not GLTF:
        return np.array(MW @ bones[n].tail_local, float)
    ch = CHILDREN.get(n, [])
    if ch:
        return s_pos(ch[0])
    p_ = s_parent(n)
    return s_pos(n) + (s_pos(n) - s_pos(p_)) * 0.5 if p_ else s_pos(n)
byn = {}
for n in NAMES:
    byn.setdefault(norm(n), n)
for n in NAMES:                              # Sketchfab numera los nodos: mixamorig:Spine_02 → Spine
    byn.setdefault(norm(re.sub(r'_\d+$', '', n)), n)
def find(cands, under=None):
    for c in cands:
        if c in byn and (under is None or under in s_anc(byn[c]) + [byn[c]]):
            return byn[c]
    if under is not None:      # dedos: por subcadena bajo la mano
        for b in s_desc(under):
            nb = norm(re.sub(r'_\d+$', '', b))
            if any(nb.endswith(c) or c in nb for c in cands):
                return b
    return None
MAP = {}
for k, cs in CAND.items():
    b = find(cs)
    if b:
        MAP[k] = b
SYN_SPINE2 = 'Spine2' not in MAP and 'Spine1' in MAP and 'Neck' in MAP   # Mixamo de 3 vértebras: Spine2 se crea a mitad
missing = [k for k in CAND if k not in MAP and not (k == 'Spine2' and SYN_SPINE2)]
log('mapa', MAP)
if missing:
    raise SystemExit('faltan huesos: ' + ', '.join(missing))

# orientación deducida del esqueleto (no del exportador): arriba = pies → cabeza, izquierda = cadera der. → izq.,
# delante = izquierda × arriba (el juego: +X izquierda, +Y arriba, +Z delante)
def unit(v): return v / np.linalg.norm(v)
O_ = (s_pos(MAP['LeftFoot']) + s_pos(MAP['RightFoot'])) / 2
U_ = unit(s_pos(MAP['Head']) - O_)
L_ = s_pos(MAP['LeftUpLeg']) - s_pos(MAP['RightUpLeg']); L_ = unit(L_ - U_ * np.dot(L_, U_))
F_ = np.cross(L_, U_)
if np.dot(s_pos(MAP['LeftToeBase']) - s_pos(MAP['LeftFoot']), F_) < 0:
    log('aviso: los dedos de los pies miran hacia atrás con izquierda/derecha del esqueleto; se invierte el lado')
    L_ = -L_; F_ = np.cross(L_, U_)
BASIS = np.stack([L_, U_, F_], 1)
def to_game(v):
    return (np.asarray(v, float) - O_) @ BASIS
def to_game_dir(v):
    return np.asarray(v, float) @ BASIS

ours = list(CAND.keys())
GAME = ['Root', 'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'Eyes', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftThumb',
        'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'RightThumb',
        'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
GI = {n: i for i, n in enumerate(GAME)}
inv = {v: k for k, v in MAP.items()}
# hueso de origen → hueso del juego: el propio o el antepasado más cercano que tenga correspondencia
def target_of(gname):
    b = gname if gname in CHILDREN else byn.get(norm(gname))
    while b is not None:
        if b in inv:
            return GI[inv[b]]
        b = s_parent(b)
    return GI['Hips']

# ------------------------------------------------------------------ mallas en reposo
eye_pts = []
if GLTF:
    keep_t = np.ones(len(RD['F']), bool)
    for m in RD['meshes']:
        nm_ = ' / '.join(m['chain'][:3])
        if any(p.search(n) for p in DROP for n in m['chain']):
            keep_t[m['t0']:m['t1']] = False
            log('quito', nm_, m['tris'], 'triángulos')
        elif m['rigid'] and any('eye' in n.lower() for n in m['chain'][:2]):
            eye_pts.append(RD['P'][RD['F'][m['t0']:m['t1']].reshape(-1)])
    MATN = [m['name'] for m in RD['mats']]
    dropm = np.array([any(p.search(n) for p in DROPMAT) for n in MATN] + [True])   # -1 (sin material) se quita
    fm = RD['FM'].copy(); fm[fm < 0] = len(MATN)
    keep_t &= ~dropm[fm]
    for i, n in enumerate(MATN):
        if dropm[i]:
            log('quito material', n)
        elif RD['mats'][i]['alpha'] != 'OPAQUE':
            log('aviso: material con transparencia', n, RD['mats'][i]['alpha'], '(en el juego será opaco)')
    used = sorted(set(fm[keep_t].tolist()))
    remap = {m: i for i, m in enumerate(used)}
    mats = [RD['mats'][m] for m in used]
    F = RD['F'][keep_t]; FM = np.array([remap[m] for m in fm[keep_t]], np.int32)
    P = to_game(RD['P']); N = to_game_dir(RD['N']); UV = RD['UV'].astype(np.float32).copy()
    UV[:, 1] = 1 - UV[:, 1]                    # glTF: v hacia abajo; aquí, como en Blender, hacia arriba
    TJ = np.array([target_of(n) for n in RD['jnames']])
    WJ = np.zeros((len(P), len(GAME)), np.float32)
    for j in range(len(TJ)):
        WJ[:, TJ[j]] += RD['W'][:, j]
    log('mallas', [m['name'] for m in RD['meshes'] if m['tris']][:40])
else:
    keep = []
    def chain(o):
        out = []
        while o is not None:
            out.append(o.name); o = o.parent
        return out
    def dropped(o):
        return any(p.search(n) for p in DROP for n in chain(o))
    for o in rigid:
        a, bn = bone_parent(o)
        if a == ARM and not dropped(o) and not o.hide_render:
            keep.append(o)
            if 'eye' in o.name.lower() or (o.parent and 'eye' in o.parent.name.lower()):
                eye_pts.append(np.array([o.matrix_world @ Vector(c) for c in o.bound_box]))
        elif a == ARM:
            log('quito pieza', o.name, '←', ' / '.join(chain(o)[1:3]))
    for o in meshes_all:
        if arm_of(o) != ARM or dropped(o) or o.hide_render:
            if arm_of(o) == ARM:
                log('quito malla', o.name)
            continue
        keep.append(o)
    log('mallas', [o.name for o in keep])
    deps = bpy.context.evaluated_depsgraph_get()
    P, N, UV, F, FM, WJ = [], [], [], [], [], []
    mats = []
    for o in keep:
        ev = o.evaluated_get(deps)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        M4 = ev.matrix_world
        nm3 = M4.to_3x3().inverted().transposed()
        gmap = {g.index: target_of(g.name) for g in o.vertex_groups}
        nv = len(me.vertices)
        W = np.zeros((nv, len(GAME)), np.float32)
        if o in rigid:                       # pegada a un hueso: todo su peso a ese hueso
            W[:, target_of(bone_parent(o)[1])] = 1
        else:
            for v in me.vertices:
                for g in v.groups:
                    t = gmap.get(g.group)
                    if t is not None:
                        W[v.index, t] += g.weight
        uvl = me.uv_layers.active
        lm = []
        for s_ in o.material_slots:
            m = s_.material
            if m is None or any(p.search(m.name) for p in DROPMAT):
                lm.append(-1); continue
            if m not in mats:
                mats.append(m)
            lm.append(mats.index(m))
        for tri in me.loop_triangles:
            mi = lm[tri.material_index] if tri.material_index < len(lm) else -1
            if mi < 0:
                continue
            ids = []
            for li in tri.loops:
                lp = me.loops[li]
                vi = lp.vertex_index
                P.append(np.array(M4 @ me.vertices[vi].co)); N.append(np.array((nm3 @ lp.normal).normalized()))
                UV.append(tuple(uvl.data[li].uv) if uvl else (0.0, 0.0))
                WJ.append(W[vi])
                ids.append(len(P) - 1)
            F.append(ids); FM.append(mi)
        ev.to_mesh_clear()
    P = to_game(np.array(P, np.float64)); N = to_game_dir(np.array(N, np.float64)); UV = np.array(UV, np.float32)
    F = np.array(F, np.int64); FM = np.array(FM, np.int32); WJ = np.array(WJ, np.float32)
    MATN = None
MATNAMES = [m['name'] if isinstance(m, dict) else m.name for m in mats]
# compactar: solo las esquinas que usan los triángulos que quedan
sel_ = F.reshape(-1)
P, N, UV, WJ = P[sel_], N[sel_], UV[sel_], WJ[sel_]
F = np.arange(len(sel_)).reshape(-1, 3)
log('triángulos', len(F), 'materiales', MATNAMES)

# ojos → escala (ojos a 1,62 m): huesos de ojos, malla de los ojos o, si no hay, un punto de la cabeza
eyes = [n for n in (RD['jnames'] if GLTF else NAMES) if 'eye' in norm(n) and 'brow' not in norm(n) and 'lid' not in norm(n)]
head_g = to_game(s_pos(MAP['Head']))
headtop = to_game(s_tail(MAP['Head']))
if eyes:
    eye_g = np.mean([to_game(s_pos(n)) for n in eyes[:2]], axis=0)
elif eye_pts:
    eye_g = to_game(np.concatenate(eye_pts)).mean(0)
    log('ojos por la malla de los ojos')
else:
    eye_g = head_g + (headtop - head_g) * 0.45
log('ojos sin escalar', eye_g)

# piel tapada por la ropa: un triángulo de piel cuyo frente choca con ropa a menos de 'hideDist' no se ve nunca
HIDE = [re.compile(p, re.I) for p in CFG.get('hide', [])]
if HIDE:
    from mathutils.bvhtree import BVHTree
    hm = np.array([any(p.search(n) for p in HIDE) for n in MATNAMES])
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
hip = G(to_game(s_pos(MAP['Hips'])))
P[:, 0] -= hip[0]; P[:, 2] -= hip[2]
def J(name, tail=False):
    g = G(to_game(s_tail(MAP[name]) if tail else s_pos(MAP[name])))
    g[0] -= hip[0]; g[2] -= hip[2]
    return g

# ------------------------------------------------------------------ esqueleto del juego (posiciones de reposo)
rest = {}
rest['Root'] = np.array([0.0, 0.0, 0.0])
for k in ours:
    if k == 'Spine2' and SYN_SPINE2:
        continue
    rest[k] = J(k)
if SYN_SPINE2:
    rest['Spine2'] = (rest['Spine1'] + rest['Neck']) / 2
    log('Spine2 creado a mitad entre Spine1 y Neck')
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
# piernas de exhibición (separadas, una atrás): cada pierna gira desde su cadera hasta dejar el tobillo debajo, a la
# separación del esqueleto del juego (±legX) y sin cambiar su longitud; el giro se reparte con el peso de la pierna
LEGX = CFG.get('legX', 0.105)
if LEGX:
    def rot_between(a, b):
        a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
        v = np.cross(a, b); c = float(np.dot(a, b)); sn = np.linalg.norm(v)
        if sn < 1e-9:
            return np.zeros(3), 0.0
        return v / sn, math.atan2(sn, c)
    def rodr(axis, ang):
        K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
        return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
    for side, sg in (('Left', 1), ('Right', -1)):
        hipj, ank = rest[side + 'UpLeg'], rest[side + 'Foot']
        L_ = np.linalg.norm(ank - hipj)
        tx = sg * LEGX
        dy = math.sqrt(max(1e-6, L_ * L_ - (tx - hipj[0]) ** 2))
        target = np.array([tx, hipj[1] - dy, hipj[2]])
        axis, ang = rot_between(ank - hipj, target - hipj)
        if ang < 1e-4:
            continue
        w = np.clip(Wsum([side + 'UpLeg', side + 'Leg', side + 'Foot', side + 'ToeBase']), 0, 1)
        sel = w > 1e-4
        for wv in np.unique(np.round(w[sel], 3)):
            m_ = sel & (np.round(w, 3) == wv)
            R_ = rodr(axis, ang * wv)
            P[m_] = hipj + (P[m_] - hipj) @ R_.T
            N[m_] = N[m_] @ R_.T
        R1 = rodr(axis, ang)
        for n in (side + 'Leg', side + 'Foot', side + 'ToeBase'):
            rest[n] = hipj + R1 @ (rest[n] - hipj)
        for n in (side + 'UpLeg', side + 'Leg', side + 'Foot', side + 'ToeBase'):
            TAILS[GI[n]] = hipj + R1 @ (TAILS[GI[n]] - hipj)
        log('pierna', side, 'girada', round(math.degrees(ang), 1), 'grados (tobillo a x', tx, ')')
    REST = np.array([rest[n] for n in GAME])
    TAILS[GI['LeftUpLeg']] = rest['LeftLeg']; TAILS[GI['RightUpLeg']] = rest['RightLeg']
    TAILS[GI['LeftLeg']] = rest['LeftFoot']; TAILS[GI['RightLeg']] = rest['RightFoot']
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
if SYN_SPINE2:
    y2 = rest['Spine2'][1]
    t = np.clip((P[:, 1] - (y2 - 0.05)) / 0.10, 0, 1)
    c1, c2 = GI['Spine1'], GI['Spine2']
    mv = WJ[:, c1] * t
    WJ[:, c1] -= mv; WJ[:, c2] += mv
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
    # franja entre cajas (cintura): al andar baja a la caja de piernas, que es menos profunda; aquí se exige también
    # el fondo de la caja de piernas (con su inset trasero) en z
    BAND = CFG.get('waistBand', [0.78, 0.97])
    if BAND:
        bm = (q[:, 1] >= BAND[0]) & (q[:, 1] <= BAND[1])
        hzb = 0.11 - max([i_.get('inset', 0) for i_ in CFG.get('fitInset', []) if i_.get('box') == 'legs' and i_.get('side', -1) == -1 and i_['y'][0] <= 0.85 <= i_['y'][1]] + [0])
        zz = q[bm, 2]
        e = np.maximum(0, -zz - hzb)              # solo hacia atrás (glúteos, cinturón trasero)
        q[bm, 2] = np.where(e > 0, -(hzb + FM_ * (1 - np.exp(-e / FM_))), zz)
        log('cintura: ', int((e > 0).sum()), 'vértices metidos al fondo de la caja de piernas')
    P[zb] = q
    log('ajuste suave a las cajas:', moved, 'vértices (máx', FM_ * 100, 'cm fuera en reposo)')
# piezas sueltas de la cabeza que sobresalen mucho de la esfera (gafas de visión nocturna, antenas): fuera enteras
HDO = CFG.get('headDropOutside')
if HDO and zh.any():
    key = np.round(P, 4)
    _, vid = np.unique(key, axis=0, return_inverse=True); vid = vid.reshape(-1)
    tri_h = zh[F].all(1)
    par = np.arange(vid.max() + 1)
    def find_(x):
        while par[x] != x:
            par[x] = par[par[x]]; x = par[x]
        return x
    for t in np.where(tri_h)[0]:
        a_, b_, c_ = find_(vid[F[t, 0]]), find_(vid[F[t, 1]]), find_(vid[F[t, 2]])
        par[b_] = a_; par[find_(c_)] = a_
    comp = np.array([find_(vid[F[t, 0]]) for t in range(len(F))])
    cen = np.array([0, 1.63, 0]); dist = np.linalg.norm(P - cen, axis=1) - 0.15
    drop_t = np.zeros(len(F), bool); nd = 0
    for cid in np.unique(comp[tri_h]):
        ts = np.where(tri_h & (comp == cid))[0]
        ex = dist[F[ts].reshape(-1)].max()
        if ex > HDO:
            drop_t[ts] = True; nd += 1
    F, FM = F[~drop_t], FM[~drop_t]
    log('cabeza: quitadas', nd, 'piezas que salían más de', HDO * 100, 'cm de la esfera (', int(drop_t.sum()), 'triángulos)')
# la cabeza tiene que caber en su esfera en reposo sin tolerancia: lo que sobra (punta de la visera, casco) entra con
# una curva suave que empieza 1,2 cm antes del borde y nunca llega a él
if zh.any():
    hf = CFG.get('headFit', [0.012, 0.002])        # la curva empieza hf[0] antes del borde y se queda a hf[1] de él
    c = np.array([0, 1.63, 0]); r = 0.15; rin = r - hf[0]; rout = r - hf[1]
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
        pts[k] = G(to_game(s_pos(b))) - [hip[0], 0, hip[2] - DZ] if b else None
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
    # el Decimate mueve vértices: la cabeza vuelve a quedar dentro de su esfera en reposo (sin tolerancia)
    hw = sum(L['weights'][:, c] * np.isin(L['joints'][:, c], [GI['Head'], GI['Eyes']]) for c in range(4)) > 0.5
    v = L['pos'][hw] - [0, 1.63, 0]; d = np.linalg.norm(v, axis=1); over = d > 0.148
    v[over] *= (0.148 / d[over])[:, None]; L['pos'][hw] = v + [0, 1.63, 0]
    log('LOD%d' % i, len(L['idx']), 'triángulos', len(L['pos']), 'vértices', '· cabeza recolocada', int(over.sum()))
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
if GLTF:
    import shutil
    def tex_file(t, tag):
        if t is None:
            return None
        if isinstance(t, tuple):            # imagen dentro del .bin / .glb
            bv = RD['J']['bufferViews'][t[1]]
            raw = RD['bufs'][bv['buffer']][bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
            fn = '%s_%d%s' % (tag, t[1], '.jpg' if 'jpeg' in t[2] else '.png')
            open(os.path.join(WORK, 'tex', fn), 'wb').write(raw)
            return fn
        fn = os.path.basename(t)
        shutil.copy2(t, os.path.join(WORK, 'tex', fn))
        return fn
    for m in mats:
        d = {'name': m['name'], 'color': tex_file(m['color'], 'c'), 'colorFactor': m['colorFactor'], 'normal': tex_file(m['normal'], 'n')}
        mr = tex_file(m['mr'], 'mr')
        d.update({'rough': mr, 'roughCh': 'G' if mr else None, 'metal': mr, 'metalCh': 'B' if mr else None,
                  'roughness': m['roughness'], 'metallic': m['metallic'], 'roughMul': m['roughness'], 'metalMul': m['metallic'],
                  'ao': tex_file(m['ao'], 'ao'), 'alpha': m['alpha']})
        MJ.append(d)
for m in ([] if GLTF else mats):
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
