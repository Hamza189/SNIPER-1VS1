"""Paso 1: cuerpo anatómico (MakeHuman CC0) recolocado para el juego.

- Piernas juntas (los tobillos dentro de la caja de piernas del servidor) y punta del pie algo abierta.
- Dedos cerrados en empuñadura (el modelo final no tiene huesos de dedos: siempre sujeta un arma).
Devuelve el objeto 'cuerpo' y las articulaciones (en Blender, metros) ya recolocadas.
"""
import math
import numpy as np
import bpy
from mathutils import Vector, Matrix, Quaternion
from common import *

FINGERS = range(1, 6)   # 1 = pulgar ... 5 = meñique


def joints_from_mh(V, G):
    J = {}
    for n in G:
        if n.startswith('joint-'):
            idx = sorted(set(i for f in G[n] for i in f))
            J[n[6:]] = mh_to_blender(V[idx].mean(0))
    return J


def build_rig(name, J, with_fingers=True):
    """Esqueleto en las articulaciones de MakeHuman. Devuelve el objeto armadura."""
    arm = bpy.data.armatures.new(name)
    ob = link(bpy.data.objects.new(name, arm))
    activate(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones

    def bone(n, head, tail, parent=None, deform=True, roll_up=None):
        b = eb.new(n)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent:
            b.parent = eb[parent]
            b.use_connect = False
        b.use_deform = deform
        if roll_up is not None:
            b.align_roll(Vector(roll_up))
        return b

    up = (0, 0, 1)
    fwd = (0, -1, 0)
    bone('Root', (0, 0, 0), (0, 0, 0.12), deform=False, roll_up=fwd)
    pelvis = J['pelvis']
    bone('Hips', pelvis, J['spine-3'], 'Root', roll_up=fwd)
    bone('Spine', J['spine-3'], J['spine-2'], 'Hips', roll_up=fwd)
    bone('Spine1', J['spine-2'], J['spine-1'], 'Spine', roll_up=fwd)
    bone('Spine2', J['spine-1'], J['neck'], 'Spine1', roll_up=fwd)
    bone('Neck', J['neck'], J['head'], 'Spine2', roll_up=fwd)
    bone('Head', J['head'], J['head-2'], 'Neck', roll_up=fwd)
    eyes = (J['l-eye'] + J['r-eye']) / 2
    bone('Eyes', eyes, eyes + np.array([0, -0.08, 0]), 'Head', deform=False, roll_up=up)
    for side, s in (('Left', 'l'), ('Right', 'r')):
        sx = 1 if s == 'l' else -1
        bone(side + 'Shoulder', J[s + '-clavicle'], J[s + '-shoulder'], 'Spine2', roll_up=up)
        bone(side + 'Arm', J[s + '-shoulder'], J[s + '-elbow'], side + 'Shoulder', roll_up=(0, 1, 0))
        bone(side + 'ForeArm', J[s + '-elbow'], J[s + '-hand'], side + 'Arm', roll_up=(0, 1, 0))
        bone(side + 'Hand', J[s + '-hand'], J[s + '-finger-3-1'], side + 'ForeArm', roll_up=(0, 1, 0))
        if with_fingers:
            for f in FINGERS:
                pts = [J['%s-finger-%d-%d' % (s, f, k)] for k in range(1, 5)]
                tip = pts[3] + (pts[3] - pts[2]) * 0.85
                pts.append(tip)
                par = side + 'Hand'
                for k in range(4 if f == 1 else 3):
                    a, b = (pts[k], pts[k + 1]) if f != 1 else (pts[k], pts[k + 1])
                    nm = '%sF%d_%d' % (side, f, k)
                    bone(nm, a, b, par, roll_up=(0, 1, 0))
                    par = nm
        else:
            bone(side + 'Thumb', J[s + '-finger-1-2'], J[s + '-finger-1-4'], side + 'Hand', roll_up=(0, 1, 0))
        bone(side + 'UpLeg', J[s + '-upper-leg'], J[s + '-knee'], 'Hips', roll_up=fwd)
        bone(side + 'Leg', J[s + '-knee'], J[s + '-ankle'], side + 'UpLeg', roll_up=fwd)
        bone(side + 'Foot', J[s + '-ankle'], J[s + '-foot-2'], side + 'Leg', roll_up=up)
        toe = J[s + '-foot-2'] + np.array([0, -0.07, -0.01])
        bone(side + 'ToeBase', J[s + '-foot-2'], toe, side + 'Foot', roll_up=up)
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def rotate_bone_world(rig, name, axis, angle):
    """Rotación en el espacio local del hueso equivalente a girar 'angle' sobre el eje del mundo 'axis'."""
    pb = rig.pose.bones[name]
    b = rig.data.bones[name]
    la = (b.matrix_local.to_3x3().inverted() @ Vector(axis)).normalized()
    pb.rotation_mode = 'QUATERNION'
    pb.rotation_quaternion = Quaternion(la, angle) @ pb.rotation_quaternion


TARGETS = {   # hombre joven atlético (pesos como los aplica MakeHuman con género 1, mezcla étnica por igual)
    'caucasian-male-young.target': 1 / 3, 'african-male-young.target': 1 / 3, 'asian-male-young.target': 1 / 3,
    'universal-male-young-maxmuscle-averageweight.target': 0.55,
}


def apply_targets(V):
    V = V.copy()
    for name, w in TARGETS.items():
        for line in (REV / 'sources' / 'targets' / name).read_text().splitlines():
            if not line or line[0] == '#':
                continue
            i, dx, dy, dz = line.split()
            V[int(i)] += w * np.array([float(dx), float(dy), float(dz)])
    return V


def build_body():
    V, G, UV, GUV = load_mh(with_uv=True)
    V = apply_targets(V)
    idx = sorted(set(i for f in G['body'] for i in f))
    B = V[idx]
    eye_ids = sorted(set(i for f in G['joint-l-eye'] for i in f))
    eye_y = V[eye_ids, 1].mean()
    # centro delante/detrás de la cabeza a la altura de los ojos -> z = 0 (centro de la esfera de impacto)
    band = B[(np.abs(B[:, 1] - eye_y) < 0.25) & (np.abs(B[:, 0]) < 0.4)]
    zc = (band[:, 2].min() + band[:, 2].max()) / 2
    set_frame(B[:, 1].min(), eye_y)
    FRAME['zshift'] = -zc * FRAME['scale']
    J = joints_from_mh(V, G)
    look = {v: i for i, v in enumerate(idx)}
    body = mesh_object('cuerpo', mh_to_blender(V[idx]), [[look[i] for i in f] for f in G['body']])
    for p in body.data.polygons:
        p.use_smooth = True
    # UV propias de MakeHuman (despliegue del cuerpo hecho a mano, CC0)
    uvl = body.data.uv_layers.new(name='UVMap')
    flat = np.array([UV[i] for f in GUV['body'] for i in f])
    uvl.data.foreach_set('uv', flat.reshape(-1))

    rig = build_rig('rig_recolocar', J, with_fingers=True)
    activate(body)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    activate(rig)
    bpy.ops.object.mode_set(mode='POSE')
    # piernas: tobillo a |x| ~ 0,105 m; punta del pie abierta 9°
    for side, sx in (('Left', 1), ('Right', -1)):
        hip = rig.data.bones[side + 'UpLeg'].head_local
        ank = rig.data.bones[side + 'Leg'].tail_local
        target_x = sx * 0.105
        ang = math.atan2(abs(ank.x) - abs(target_x), hip.z - ank.z)
        rotate_bone_world(rig, side + 'UpLeg', (0, 1, 0), sx * ang)
        # pie 2,5 cm hacia atrás (la bota cabe en la caja de piernas: 22 cm de fondo + 4)
        back = math.atan2(0.0, hip.z - ank.z)
        rotate_bone_world(rig, side + 'UpLeg', (1, 0, 0), back)
        rotate_bone_world(rig, side + 'Foot', (1, 0, 0), -back)
        rotate_bone_world(rig, side + 'Foot', (0, 0, 1), sx * math.radians(9))
    # manos: dedos cerrados alrededor de una empuñadura (eje de flexión según la palma)
    for side, s, sx in (('Left', 'l', 1), ('Right', 'r', -1)):
        wrist = J[s + '-hand']
        k2 = J[s + '-finger-2-1']
        k5 = J[s + '-finger-5-1']
        n = np.cross(k2 - wrist, k5 - wrist)
        n /= np.linalg.norm(n)
        if n[0] * sx > 0:
            n = -n                        # hacia la palma (la palma mira al muslo)
        for f in FINGERS:
            segs = 4 if f == 1 else 3
            angs = [20, 35, 30, 25] if f == 1 else ([45, 62, 40] if f == 2 else [55, 70, 45])
            for k in range(segs):
                nm = '%sF%d_%d' % (side, f, k)
                b = rig.data.bones[nm]
                d = np.array(b.tail_local - b.head_local)
                d /= np.linalg.norm(d)
                ax = np.cross(d, n)
                ax /= np.linalg.norm(ax)
                rotate_bone_world(rig, nm, ax, math.radians(angs[k]))
                if f == 1 and k == 0:
                    rotate_bone_world(rig, nm, d, sx * math.radians(25))
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()

    # aplicar la pose al cuerpo y llevar las articulaciones a su sitio nuevo
    activate(body)
    for m in list(body.modifiers):
        if m.type == 'ARMATURE':
            bpy.ops.object.modifier_apply(modifier=m.name)
    body.parent = None
    body.matrix_world = Matrix.Identity(4)
    # los pesos automáticos del esqueleto provisional se conservan: sirven para saber qué es brazo, pierna, mano…
    newJ = dict(J)
    for side, s in (('Left', 'l'), ('Right', 'r')):
        pb = rig.pose.bones
        newJ[s + '-knee'] = np.array(pb[side + 'Leg'].head)
        newJ[s + '-ankle'] = np.array(pb[side + 'Foot'].head)
        newJ[s + '-foot-2'] = np.array(pb[side + 'ToeBase'].head)
        newJ[s + '-finger-1-2'] = np.array(pb[side + 'F1_1'].head)     # pulgar ya cerrado
        newJ[s + '-finger-1-4'] = np.array(pb[side + 'F1_3'].head)
    bpy.data.objects.remove(rig, do_unlink=True)
    return body, newJ
