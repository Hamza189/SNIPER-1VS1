"""SNIPER DUEL — personaje revisión 03. Utilidades comunes (Blender 5.2, modo fondo).

Ejes: se trabaja en Blender (Z arriba, el personaje mira a -Y). El exportador glTF lo pasa a
+Y arriba y +Z delante, que es lo que usa el juego. Unidades: metros. Origen entre los pies.
"""
import math
from pathlib import Path
import numpy as np
import bpy
from mathutils import Vector, Matrix, Quaternion

REV = Path(__file__).resolve().parent.parent          # revision_03/
ROOT = REV.parent                                       # 2026-10-19_personaje/
WORK = ROOT / '.work' / 'rev03'
WORK.mkdir(parents=True, exist_ok=True)
BASE_OBJ = ROOT / 'revision_02' / 'sources' / 'base.obj'   # MakeHuman CC0 (procedencia en revision_02/sources)

# MakeHuman: 1 unidad = 1 dm, Y arriba, mira a +Z. Escala y suelo se fijan con set_frame() tras aplicar
# los targets (los ojos quedan a 1,62 m, como core/hitbox.js).
FRAME = {'sole': -8.1676, 'eye': 7.284, 'scale': 1.62 / (7.284 + 8.1676), 'zshift': 0.0}


def set_frame(sole, eye, zshift=0.0):
    FRAME.update(sole=sole, eye=eye, scale=1.62 / (eye - sole), zshift=zshift)


def mh_to_blender(p):
    """MakeHuman (x, y, z) -> Blender (x, -z, y) en metros, suelo en z = 0."""
    p = np.asarray(p, dtype=float)
    s = FRAME['scale']
    out = np.empty_like(p)
    out[..., 0] = p[..., 0] * s
    out[..., 1] = -p[..., 2] * s - FRAME['zshift']
    out[..., 2] = (p[..., 1] - FRAME['sole']) * s
    return out


def load_mh(with_uv=False):
    verts, uvs, groups, guv, name = [], [], {}, {}, ''
    for line in BASE_OBJ.read_text().splitlines():
        if line.startswith('v '):
            verts.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            uvs.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '):
            name = line[2:]
        elif line.startswith('f '):
            items = line.split()[1:]
            groups.setdefault(name, []).append([int(x.split('/')[0]) - 1 for x in items])
            guv.setdefault(name, []).append([int(x.split('/')[1]) - 1 if '/' in x and x.split('/')[1] else -1 for x in items])
    if with_uv:
        return np.array(verts), groups, np.array(uvs), guv
    return np.array(verts), groups


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = 30
    sc.unit_settings.system = 'METRIC'


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def activate(ob, select_only=True):
    if select_only:
        for o in bpy.context.scene.objects:
            if o is not None and o.name in bpy.context.view_layer.objects:
                o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)


def mesh_object(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces])
    me.update()
    return link(bpy.data.objects.new(name, me))


def verts_np(ob):
    a = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', a)
    return a.reshape(-1, 3)


def set_verts(ob, P):
    ob.data.vertices.foreach_set('co', np.asarray(P, dtype=float).reshape(-1))
    ob.data.update()


def normals_np(ob):
    a = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('normal', a)
    return a.reshape(-1, 3)


def apply_modifiers(ob):
    activate(ob)
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=float) - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def game_from_blender(P):
    """Blender (x, y, z) -> juego (x, y, z) = (x, z, -y)."""
    P = np.asarray(P, dtype=float)
    return np.stack([P[..., 0], P[..., 2], -P[..., 1]], axis=-1)


def game_to_blender(P):
    P = np.asarray(P, dtype=float)
    return np.stack([P[..., 0], -P[..., 2], P[..., 1]], axis=-1)
