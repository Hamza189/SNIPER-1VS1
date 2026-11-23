"""SNIPER DUEL — esqueleto automático para un personaje sin huesos (p. ej. un GLB de Meshy en pose en A).

Deja un .blend con un esqueleto de nombres Mixamo y la malla pesada, listo para tools/personaje-ext/extract.py:
  1. importa el GLB, aplica sus transformaciones y lo reduce a <tris> triángulos (la textura no cambia);
  2. estima las articulaciones cortando el cuerpo en rodajas (piernas, brazos, cuello) — necesita pose en A o en T,
     de frente a -Y de Blender (+Z del glTF) y simétrico;
  3. calcula los pesos sobre una copia cerrada del cuerpo (remallado por vóxeles, sin agujeros ni piezas sueltas, donde
     el cálculo automático de Blender no falla) y los pasa a la malla de verdad por cercanía.

Uso: blender --background --factory-startup --python autorig.py -- <entrada.glb> <salida.blend> [tris]
"""
import bpy, bmesh, sys, os, json
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
TRIS = int(argv[2]) if len(argv) > 2 else 200000
log = lambda *a: print('[rig]', *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in bpy.data.objects:
    o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.data.objects):
    if o is not ob:
        bpy.data.objects.remove(o, do_unlink=True)
ob.name = 'Cuerpo'
# el GLB parte los vértices en cada costura de UV: sin unirlos, al reducir se abren grietas en las costuras y el Decimate
# las trata como bordes (no baja de ~13 000 triángulos)
bm = bmesh.new(); bm.from_mesh(ob.data); nv = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(ob.data); bm.free()
log('vértices unidos', nv, '→', len(ob.data.vertices))
n0 = sum(len(p.vertices) - 2 for p in ob.data.polygons)
if n0 > TRIS:
    m = ob.modifiers.new('dec', 'DECIMATE'); m.ratio = TRIS / n0
    bpy.ops.object.modifier_apply(modifier='dec')
log('triángulos', n0, '→', sum(len(p.vertices) - 2 for p in ob.data.polygons))

# ------------------------------------------------------------------ articulaciones por rodajas (Blender: Z arriba, -Y delante, +X izquierda del personaje)
# puntos repartidos por la superficie (no solo los vértices): en un modelo ligero (AMBER, 15 000 triángulos) las rodajas
# de vértices tienen huecos falsos dentro del cuerpo
ob.data.calc_loop_triangles()
VV = np.array([v.co[:] for v in ob.data.vertices])
TT = np.array([t.vertices[:] for t in ob.data.loop_triangles])
A_, B_, C_ = VV[TT[:, 0]], VV[TT[:, 1]], VV[TT[:, 2]]
ar = np.linalg.norm(np.cross(B_ - A_, C_ - A_), axis=1) / 2
rng = np.random.default_rng(1)
k_ = rng.choice(len(TT), 600000, p=ar / ar.sum())
u_, v_ = rng.random(len(k_)), rng.random(len(k_)); f_ = u_ + v_ > 1; u_[f_], v_[f_] = 1 - u_[f_], 1 - v_[f_]
V = np.vstack([VV, A_[k_] + (B_[k_] - A_[k_]) * u_[:, None] + (C_[k_] - A_[k_]) * v_[:, None]])
z0, z1 = V[:, 2].min(), V[:, 2].max(); H = z1 - z0
def sl(t, xr=None, tol=None):
    """puntos a la altura relativa t (0 suelo, 1 coronilla), opcionalmente con x dentro de xr"""
    m = np.abs(V[:, 2] - (z0 + t * H)) < (tol or H / 120)
    if xr is not None:
        m &= (V[:, 0] >= xr[0]) & (V[:, 0] <= xr[1])
    return V[m]
def segs(Q, gap=0.015):
    xs = np.sort(Q[:, 0]); g = np.where(np.diff(xs) > gap * H)[0]; out = []; s = 0
    for e in list(g) + [len(xs) - 1]:
        out.append((xs[s], xs[e])); s = e + 1
    return out
def mid(Q):
    return (Q.min(0) + Q.max(0)) / 2

# entrepierna: la rodaja más alta con las dos piernas separadas
crotch = None
for t in np.arange(0.2, 0.6, 0.005):
    S = [s for s in segs(sl(t)) if s[1] - s[0] > 0.03 * H]
    legs = [s for s in S if abs((s[0] + s[1]) / 2) < 0.2 * H]
    if len(legs) >= 2 and legs[0][1] < 0 < legs[-1][0]:
        crotch = t
    elif crotch is not None:
        break
# axila: la rodaja más alta con el brazo separado del tronco
arm_top = None
for t in np.arange(0.45, 0.85, 0.005):
    S = segs(sl(t))
    if len(S) >= 3 and S[-1][0] > 0.1 * H:
        arm_top = t
log('entrepierna', round(crotch, 3), 'axila', round(arm_top, 3))
# punta de los dedos: lo más bajo de los brazos (fuera del ancho de las caderas)
hipw = max(max(-a, b) for a, b in segs(sl(crotch + 0.05)) if a <= 0 <= b)      # el tramo del tronco (no el de las manos)
armV = V[(np.abs(V[:, 0]) > hipw + 0.02 * H) & (V[:, 2] < z0 + arm_top * H) & (V[:, 2] > z0 + (crotch - 0.06) * H)]   # no las botas
tip_t = (armV[:, 2].min() - z0) / H

def limb_center(t, side, xmin):
    Q = sl(t, (xmin, 9) if side > 0 else (-9, -xmin))
    return mid(Q) if len(Q) else None

J = {}
def P(n, v):
    J[n] = Vector(v)
# piernas (lado izquierdo del personaje = +X)
for side, S in ((1, 'Left'), (-1, 'Right')):
    def leg(t):
        Q = sl(t, (0, 9) if side > 0 else (-9, 0))
        Q = Q[np.abs(Q[:, 0]) < hipw + 0.01 * H]
        return mid(Q)
    hip = leg(crotch + 0.01); hip[2] = z0 + (crotch + 0.045) * H; hip[0] = side * max(abs(hip[0]) * 0.85, 0.05 * H)
    knee = leg(0.285); ankle = leg(0.05); ankle[2] = z0 + 0.045 * H
    foot = sl(0.01, (0, 9) if side > 0 else (-9, 0))
    toe = np.array([ankle[0], foot[:, 1].min() + 0.35 * (ankle[1] - foot[:, 1].min()), z0 + 0.015 * H])
    knee[1] -= 0.01 * H                                   # la rodilla un poco adelantada: dobla siempre hacia delante
    P(S + 'UpLeg', hip); P(S + 'Leg', knee); P(S + 'Foot', ankle); P(S + 'ToeBase', toe)
    P(S + 'ToeEnd', [toe[0], foot[:, 1].min(), toe[2]])
# brazos: el centro del brazo a lo largo de su recorrido, de la axila a la mano
for side, S in ((1, 'Left'), (-1, 'Right')):
    pts = []
    for t in np.arange(tip_t + 0.01, arm_top, 0.01):
        Q = sl(t, (hipw + 0.02 * H, 9) if side > 0 else (-9, -hipw - 0.02 * H))
        if len(Q):
            Sg = segs(Q)
            far = Sg[-1] if side > 0 else Sg[0]
            Q = Q[(Q[:, 0] >= far[0]) & (Q[:, 0] <= far[1])]
            pts.append(mid(Q))
    pts = np.array(pts)                                   # de la punta de los dedos hacia arriba
    L = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
    at = lambda d: np.array([np.interp(d, L, pts[:, k]) for k in range(3)])
    # hombro: la línea del brazo (último tramo separado del tronco) prolongada hacia arriba hasta |x| = 0,115 H
    top = pts[-1]; dvec = top - at(L[-1] - 0.12 * H); dvec /= np.linalg.norm(dvec)
    k = (abs(top[0]) - 0.115 * H) / max(abs(dvec[0]), 1e-3)
    sh = top + dvec * max(k, 0); sh[2] = min(sh[2], z0 + 0.82 * H); sh[1] = top[1]   # sin irse hacia atrás
    tipd = at(0)
    # mano ≈ 10,5 % de la altura; antebrazo y brazo con las proporciones habituales (0,146 y 0,186 H)
    wrist = at(0.105 * H)
    v = sh - wrist; dl = np.linalg.norm(v)
    elbow = wrist + v * (0.146 / (0.146 + 0.186)); elbow[1] += 0.012 * H   # codo algo atrás: dobla hacia delante
    P(S + 'Shoulder', [side * 0.025 * H, sh[1] - 0.01 * H, sh[2] - 0.015 * H])
    P(S + 'Arm', sh); P(S + 'ForeArm', elbow); P(S + 'Hand', wrist)
    hd = (tipd - wrist) / np.linalg.norm(tipd - wrist)
    th = wrist + hd * 0.035 * H; th[1] -= 0.025 * H; th[0] -= side * 0.012 * H
    P(S + 'HandThumb1', th); P(S + 'HandThumb2', th + Vector((0, -0.02 * H, -0.02 * H)))
    P(S + 'HandMiddle1', wrist + hd * 0.055 * H); P(S + 'HandEnd', tipd)
# columna y cabeza. Con gorro, casco o capucha el cuello no se ve (no hay rodaja más estrecha fiable): proporciones desde
# la coronilla. Cabeza (articulación) a la altura de la barbilla: si queda más arriba, la barbilla y la barba cuentan
# como cuello y el ajuste del cuerpo las aplasta contra su caja (la cara salía estirada). Ojos al 6,8 % de la altura
# bajo la coronilla (los usa extract.py para la escala: ojos a 1,62 m)
cy = lambda t: mid(sl(t))[1]
P('Hips', [0, cy(crotch + 0.05), z0 + (crotch + 0.045) * H])
hz = J['Hips'].z; nz = z1 - 0.19 * H
for k, f in (('Spine', 0.2), ('Spine1', 0.45), ('Spine2', 0.7)):
    zz = hz + f * (nz - hz); P(k, [0, cy((zz - z0) / H), zz])
P('Neck', [0, cy((nz - z0) / H), nz])
P('Head', [0, cy(0.85), z1 - 0.15 * H])
P('HeadTop_End', [0, J['Head'].y, z1])
ez = z1 - 0.068 * H; EY = sl((ez - z0) / H); EY = EY[np.abs(EY[:, 0]) < 0.05 * H]
for side, S in ((1, 'Left'), (-1, 'Right')):
    P(S + 'Eye', [side * 0.018 * H, EY[:, 1].min() + 0.012 * H, ez])
# simétrico: lo que lleva en un solo lado (bolsa del muslo, radio) no debe mover la articulación de ese lado
for n in [k for k in J if k.startswith('Left')]:
    m = 'Right' + n[4:]
    if m in J:
        L_, R_ = J[n], J[m]
        x_ = (abs(L_.x) + abs(R_.x)) / 2; y_ = (L_.y + R_.y) / 2; z_ = (L_.z + R_.z) / 2
        J[n] = Vector((x_, y_, z_)); J[m] = Vector((-x_, y_, z_))
log('articulaciones', json.dumps({k: [round(c, 3) for c in v] for k, v in J.items()}))

# ------------------------------------------------------------------ esqueleto (nombres Mixamo)
TREE = {'Hips': None, 'Spine': 'Hips', 'Spine1': 'Spine', 'Spine2': 'Spine1', 'Neck': 'Spine2', 'Head': 'Neck', 'HeadTop_End': 'Head',
        'LeftEye': 'Head', 'RightEye': 'Head'}
for S in ('Left', 'Right'):
    TREE.update({S + 'Shoulder': 'Spine2', S + 'Arm': S + 'Shoulder', S + 'ForeArm': S + 'Arm', S + 'Hand': S + 'ForeArm',
                 S + 'HandThumb1': S + 'Hand', S + 'HandMiddle1': S + 'Hand',
                 S + 'UpLeg': 'Hips', S + 'Leg': S + 'UpLeg', S + 'Foot': S + 'Leg', S + 'ToeBase': S + 'Foot'})
TAIL = {'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head', 'Head': 'HeadTop_End'}
for S in ('Left', 'Right'):
    TAIL.update({S + 'Shoulder': S + 'Arm', S + 'Arm': S + 'ForeArm', S + 'ForeArm': S + 'Hand', S + 'Hand': S + 'HandMiddle1',
                 S + 'HandThumb1': S + 'HandThumb2', S + 'HandMiddle1': S + 'HandEnd',
                 S + 'UpLeg': S + 'Leg', S + 'Leg': S + 'Foot', S + 'Foot': S + 'ToeBase', S + 'ToeBase': S + 'ToeEnd'})
ad = bpy.data.armatures.new('Esqueleto'); arm = bpy.data.objects.new('Esqueleto', ad)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
EB = {}
for n in TREE:
    if n == 'HeadTop_End':
        continue
    b = ad.edit_bones.new('mixamorig:' + n); b.head = J[n]
    if n.endswith('Eye'):                 # solo marcan dónde están los ojos: no mueven la malla
        b.tail = J[n] + Vector((0, -0.02, 0)); b.use_deform = False
    else:
        b.tail = J[TAIL[n]]
    if (b.tail - b.head).length < 1e-4:
        b.tail = b.head + Vector((0, 0, 0.02))
    EB[n] = b
for n, p in TREE.items():
    if n in EB and p:
        EB[n].parent = EB[p]
        EB[n].use_connect = False
# las piernas y brazos doblan hacia delante: giro del hueso alrededor de su eje hacia -Y
for b in ad.edit_bones:
    b.align_roll(Vector((0, -1, 0)) if 'Leg' not in b.name else Vector((0, 1, 0)))
bpy.ops.object.mode_set(mode='OBJECT')

# ------------------------------------------------------------------ pesos: copia cerrada → malla de verdad
def make_proxy(vs, faces):
    """copia cerrada por vóxeles de tamaño vs·H, reducida a ~faces caras, pesada con el cálculo automático de Blender;
    devuelve (copia, vértices que se quedaron sin peso)"""
    px = ob.copy(); px.data = ob.data.copy(); px.name = 'Proxy'
    bpy.context.scene.collection.objects.link(px)
    for o in bpy.data.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = px; px.select_set(True)
    rm = px.modifiers.new('vox', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = vs * H
    bpy.ops.object.modifier_apply(modifier='vox')
    if len(px.data.polygons) > faces:
        dm = px.modifiers.new('dec', 'DECIMATE'); dm.ratio = faces / len(px.data.polygons)
        bpy.ops.object.modifier_apply(modifier='dec')
    arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    bad = sum(1 for v in px.data.vertices if sum(g.weight for g in v.groups) < 1e-3)
    log('copia cerrada', vs, len(px.data.polygons), 'caras,', bad, 'vértices sin peso')
    return px, bad
# a veces el cálculo de Blender no encuentra solución («Bone Heat Weighting: failed») y deja media malla sin pesos:
# se prueba con otros tamaños de vóxel hasta que (casi) todo queda pesado
proxy = None
for vs, fc in ((0.006, 60000), (0.008, 40000), (0.01, 30000), (0.007, 50000), (0.012, 25000), (0.005, 80000)):
    px, bad = make_proxy(vs, fc)
    if proxy is None or bad < best:
        if proxy is not None:
            bpy.data.objects.remove(proxy, do_unlink=True)
        proxy, best = px, bad
    else:
        bpy.data.objects.remove(px, do_unlink=True)
    if best < 0.002 * len(proxy.data.vertices):
        break
log('grupos en la copia', len(proxy.vertex_groups))

for o in bpy.data.objects:
    o.select_set(False)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
for g in proxy.vertex_groups:
    ob.vertex_groups.new(name=g.name)
dt = ob.modifiers.new('pesos', 'DATA_TRANSFER'); dt.object = proxy
dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.modifier_apply(modifier='pesos')
# vértices sin peso (no debería haber): al hueso más cercano
names = [g.name for g in ob.vertex_groups]
heads = {n: (arm.matrix_world @ arm.data.bones[n].head_local, arm.matrix_world @ arm.data.bones[n].tail_local) for n in names if n in arm.data.bones}
def dseg(p, a, b):
    ab = b - a; t = max(0, min(1, (p - a).dot(ab) / max(ab.dot(ab), 1e-9))); return (p - (a + ab * t)).length
fixed = 0
for v in ob.data.vertices:
    if sum(g.weight for g in v.groups) < 1e-3:
        n = min(heads, key=lambda k: dseg(v.co, *heads[k])); ob.vertex_groups[n].add([v.index], 1.0, 'REPLACE'); fixed += 1
log('vértices sin peso arreglados', fixed)
# por encima de la barbilla todo va con la cabeza, rígido: el ala de un sombrero (AMBER) o un casco son piezas finas que
# el cálculo automático repartía entre el cuello y los hombros, y al moverse se «derretían» hacia abajo. Entre la
# articulación de la cabeza y 3 cm más arriba, mezcla suave con lo calculado
hz_ = J['Head'].z; band = 0.03 * H; gh = ob.vertex_groups['mixamorig:Head']; rig_ = 0
for v in ob.data.vertices:
    t = (v.co.z - hz_) / band
    if t <= 0:
        continue
    t = min(1.0, t)
    for g in v.groups:
        if g.group != gh.index:
            g.weight *= (1 - t)
    gh.add([v.index], t + (1 - t) * next((g.weight for g in v.groups if g.group == gh.index), 0.0), 'REPLACE'); rig_ += 1
log('vértices de la cabeza rígidos', rig_)
bpy.data.objects.remove(proxy, do_unlink=True)
ob.parent = arm
am = ob.modifiers.new('Armature', 'ARMATURE'); am.object = arm
bpy.ops.wm.save_as_mainfile(filepath=OUT)
json.dump({k: list(v) for k, v in J.items()}, open(os.path.splitext(OUT)[0] + '_joints.json', 'w'), indent=1)
log('guardado', OUT)
