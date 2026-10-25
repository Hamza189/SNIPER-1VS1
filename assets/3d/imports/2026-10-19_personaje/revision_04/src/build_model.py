"""Revisión 04 — modelo (Blender 5.2 en modo fondo):

  cuerpo MakeHuman CC0 → ropa → equipo → esqueleto de 26 huesos con pesos automáticos (calor)
  → LOD0/1/2 por reducción → UV → horneados en Cycles (normales desde la versión de alta con pliegues,
  oclusión, posición, zonas y piezas) → work/rev04/model.npz + mapas para textures.py.

Uso:  D:/Blender/blender.exe --background --factory-startup --python-exit-code 1 --python build_model.py
"""
import sys, json, math, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np
import bpy, bmesh
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
from common import *
from body import build_body
from clothing import dress, cut_feet
from gear import build_gear, PARTS
from noise import fbm, vnoise

TEX = 2048
TRIS = [14600, 5000, 1500]
BONES = ['Root', 'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'Eyes',
         'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftThumb',
         'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
         'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'RightThumb',
         'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
t0 = time.time()


def log(*a):
    print('[%6.1fs]' % (time.time() - t0), *a, flush=True)


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def duplicate(ob, name):
    o = ob.copy()
    o.data = ob.data.copy()
    o.name = o.data.name = name
    link(o)
    return o


def decimate_to(ob, target):
    activate(ob)
    m = ob.modifiers.new('dec', 'DECIMATE')
    m.decimate_type = 'COLLAPSE'
    m.use_collapse_triangulate = True
    m.use_symmetry = True
    m.symmetry_axis = 'X'
    m.ratio = min(1.0, target / tri_count(ob))
    bpy.ops.object.modifier_apply(modifier=m.name)
    for _ in range(4):   # ajuste fino del número final
        n = tri_count(ob)
        if n <= target:
            break
        m = ob.modifiers.new('dec', 'DECIMATE')
        m.decimate_type = 'COLLAPSE'
        m.use_collapse_triangulate = True
        m.ratio = target / n * 0.995
        bpy.ops.object.modifier_apply(modifier=m.name)


def triangulate(ob):
    activate(ob)
    m = ob.modifiers.new('tri', 'TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=m.name)


# ------------------------------------------------------------------ 1. cuerpo, ropa y equipo
reset_scene()
body, J = build_body()
C = dress(body, J)
eq = build_gear(body, C, J)
# normales hacia fuera en todas las piezas cerradas del equipo
activate(eq)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
log('cuerpo', len(body.data.vertices), 'v; equipo', tri_count(eq), 'tri')

# ------------------------------------------------------------------ 2. esqueleto final y pesos
from body import build_rig
for vg in list(body.vertex_groups):
    body.vertex_groups.remove(vg)
rig = build_rig('rig', J, with_fingers=False)
activate(body)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
log('pesos automáticos', len(body.vertex_groups), 'grupos')
# equipo: pesos por cercanía a la superficie del cuerpo; casco y gafas, solo la cabeza
for b in BONES:
    if b not in eq.vertex_groups:
        eq.vertex_groups.new(name=b)
activate(eq)
dt = eq.modifiers.new('dt', 'DATA_TRANSFER')
dt.object = body
dt.use_vert_data = True
dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'
dt.layers_vgroup_select_src = 'ALL'
dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.modifier_apply(modifier=dt.name)
part = np.zeros(len(eq.data.polygons), dtype=np.int32)
eq.data.attributes['part'].data.foreach_get('value', part)
head_parts = {k for k, v in PARTS.items() if v[1] == 'head'}
hv = set()
for p in eq.data.polygons:
    if part[p.index] in head_parts:
        hv.update(p.vertices)
hv = list(hv)
for g in eq.vertex_groups:
    g.remove(hv)
eq.vertex_groups['Head'].add(hv, 1.0, 'REPLACE')
C = cut_feet(body, C)

# zonas de la ropa del cuerpo (para texturizar): R chaqueta, G pantalón, B guante, A braga de cuello
reg = body.data.color_attributes.new('reg', 'FLOAT_COLOR', 'POINT')
reg.data.foreach_set('color', np.stack([C['jacket'], C['pants'], C['glove'], C['gaiter']], 1).reshape(-1))
ra = body.data.attributes.new('part', 'INT', 'FACE')
ra.data.foreach_set('value', np.zeros(len(body.data.polygons), dtype=np.int32))
reg2 = eq.data.color_attributes.new('reg', 'FLOAT_COLOR', 'POINT')
reg2.data.foreach_set('color', np.zeros(len(eq.data.vertices) * 4))

# UV del equipo (el cuerpo ya trae las de MakeHuman)
activate(eq)
eq.data.uv_layers.new(name='UVMap')
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.002, correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')

# ------------------------------------------------------------------ 3. malla de alta (para normales) y LOD
for m in list(body.modifiers):
    body.modifiers.remove(m)
body.parent = None
activate(body)
eq.select_set(True)
bpy.ops.object.join()
hi = body
hi.name = 'alta'
for p in hi.data.polygons:
    p.use_smooth = True
log('alta', tri_count(hi), 'tri')

lod0 = duplicate(hi, 'personaje_LOD0')
decimate_to(lod0, TRIS[0])
triangulate(lod0)
log('LOD0', tri_count(lod0))

# UV: proyección por ángulos y empaquetado con margen para el horneado
activate(lod0)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.average_islands_scale()
bpy.ops.uv.pack_islands(rotate=True, margin=0.003)
bpy.ops.object.mode_set(mode='OBJECT')
lod1 = duplicate(lod0, 'personaje_LOD1')
decimate_to(lod1, TRIS[1])
lod2 = duplicate(lod0, 'personaje_LOD2')
decimate_to(lod2, TRIS[2])
log('LOD1', tri_count(lod1), 'LOD2', tri_count(lod2))

# alta con pliegues: subdivisión + desplazamiento a lo largo de la normal en la tela
bake_hi = duplicate(hi, 'alta_pliegues')
activate(bake_hi)
sub = bake_hi.modifiers.new('sub', 'SUBSURF')
sub.levels = 1
sub.subdivision_type = 'CATMULL_CLARK'
bpy.ops.object.modifier_apply(modifier=sub.name)
from folds import fold_offsets
P = game_from_blender(verts_np(bake_hi))
bake_hi.data.update()
N = game_from_blender(normals_np(bake_hi))
regc = np.empty(len(bake_hi.data.vertices) * 4)
bake_hi.data.color_attributes['reg'].data.foreach_get('color', regc)
regc = regc.reshape(-1, 4)
d = fold_offsets(P, regc, J) * 1.05
set_verts(bake_hi, game_to_blender(P + N * d[:, None]))
log('alta con pliegues', tri_count(bake_hi), 'tri; desplazamiento máx', float(np.abs(d).max()))

# ------------------------------------------------------------------ 4. horneados (Cycles)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 16
sc.render.bake.margin = 8
sc.render.bake.margin_type = 'EXTEND'


def new_image(name, float_=False):
    img = bpy.data.images.new(name, TEX, TEX, alpha=False, float_buffer=float_)
    img.colorspace_settings.name = 'Non-Color'
    return img


def material_for(ob, name, build):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    build(nt, out)
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    return mat


def target_node(ob, img):
    mat = ob.data.materials[0]
    n = mat.node_tree.nodes.new('ShaderNodeTexImage')
    n.image = img
    mat.node_tree.nodes.active = n


def emit_attr(attr, kind='color', scale=1.0):
    def b(nt, out):
        a = nt.nodes.new('ShaderNodeAttribute')
        a.attribute_name = attr
        e = nt.nodes.new('ShaderNodeEmission')
        if kind == 'color':
            nt.links.new(a.outputs['Color'], e.inputs['Color'])
        else:
            m = nt.nodes.new('ShaderNodeMath')
            m.operation = 'MULTIPLY'
            m.inputs[1].default_value = scale
            nt.links.new(a.outputs['Fac'], m.inputs[0])
            nt.links.new(m.outputs[0], e.inputs['Color'])
        nt.links.new(e.outputs[0], out.inputs['Surface'])
    return b


def emit_geom(socket):
    def b(nt, out):
        g = nt.nodes.new('ShaderNodeNewGeometry')
        e = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(g.outputs[socket], e.inputs['Color'])
        nt.links.new(e.outputs[0], out.inputs['Surface'])
    return b


def plain(nt, out):
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(p.outputs[0], out.inputs['Surface'])


def bake(kind, img, selected=None, samples=16, **kw):
    sc.cycles.samples = samples
    activate(lod0)
    if selected is not None:
        selected.select_set(True)
        bpy.context.view_layer.objects.active = lod0
    target_node(lod0, img)
    bpy.ops.object.bake(type=kind, use_selected_to_active=selected is not None, **kw)
    px = np.empty(TEX * TEX * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    # fila 0 = v 0 (abajo); se guarda tal cual, textures.py la da la vuelta al escribir imágenes
    np.save(WORK / (img.name + '.npy'), px.reshape(TEX, TEX, 4)[:, :, :3])
    log('horneado', img.name)


material_for(lod0, 'm_lod0', plain)
material_for(bake_hi, 'm_hi', plain)
img = new_image('bake_normal')
bake('NORMAL', img, selected=bake_hi, samples=4, normal_space='TANGENT', cage_extrusion=0.012, max_ray_distance=0.035, margin=8)
material_for(bake_hi, 'm_hi_reg', emit_attr('reg'))
material_for(lod0, 'm_lod0', plain)
img = new_image('bake_reg')
bake('EMIT', img, selected=bake_hi, samples=4, cage_extrusion=0.012, max_ray_distance=0.035)
material_for(lod0, 'm_lod0_part', emit_attr('part', 'fac', 1 / 32))
img = new_image('bake_part')
bake('EMIT', img, samples=1)
material_for(lod0, 'm_pos', emit_geom('Position'))
img = new_image('bake_pos', float_=True)
bake('EMIT', img, samples=1)
material_for(lod0, 'm_nrm', emit_geom('Normal'))
img = new_image('bake_objnormal', float_=True)
bake('EMIT', img, samples=1)
material_for(lod0, 'm_lod0', plain)
img = new_image('bake_ao')
sc.world = bpy.data.worlds.new('w')
for o in (hi, bake_hi, lod1, lod2):
    o.hide_render = True
sc.world.light_settings.distance = 0.12
bake('AO', img, samples=96)

# ------------------------------------------------------------------ 5. datos de malla para el GLB
bi = {b: i for i, b in enumerate(BONES)}
out = {'bones': np.array(BONES)}
rest = {}
for b in rig.data.bones:
    rest[b.name] = game_from_blender(np.array(b.head_local))
out['rest'] = np.array([rest[b] for b in BONES])
out['parents'] = np.array([BONES.index(rig.data.bones[b].parent.name) if rig.data.bones[b].parent else -1 for b in BONES])
out['tails'] = np.array([game_from_blender(np.array(rig.data.bones[b].tail_local)) for b in BONES])
for li, ob in enumerate((lod0, lod1, lod2)):
    me = ob.data
    me.calc_loop_triangles()
    try:
        me.calc_tangents()
    except Exception as e:
        log('tangentes', e)
    # vértices por esquina (UV y normal partidos en las costuras): se agrupan por (vértice, uv)
    uvl = me.uv_layers.active.data
    key, idx, verts, uvs, nors, tans = {}, [], [], [], [], []
    for t in me.loop_triangles:
        tri = []
        for l in t.loops:
            lp = me.loops[l]
            uv = tuple(np.round(uvl[l].uv, 6))
            k = (lp.vertex_index, uv)
            if k not in key:
                key[k] = len(verts)
                verts.append(lp.vertex_index)
                uvs.append(uv)
                nors.append(tuple(lp.normal))
                tans.append(tuple(lp.tangent) + (lp.bitangent_sign,))
            tri.append(key[k])
        idx.append(tri)
    V = verts_np(ob)[verts]
    W = np.zeros((len(me.vertices), len(BONES)))
    gi = {g.index: g.name for g in ob.vertex_groups}
    for v in me.vertices:
        for g in v.groups:
            nm = gi[g.group]
            if nm in bi:
                W[v.index, bi[nm]] += g.weight
    W = W[verts]
    order = np.argsort(-W, axis=1)[:, :4]
    w4 = np.take_along_axis(W, order, 1)
    w4[w4 < 0.02] = 0
    w4 /= np.maximum(w4.sum(1, keepdims=True), 1e-9)
    # vértice sin peso: al hueso más cercano del tronco (no debería pasar)
    out['lod%d_pos' % li] = game_from_blender(V)
    out['lod%d_nrm' % li] = game_from_blender(np.array(nors))
    tg = np.array(tans)
    out['lod%d_tan' % li] = np.concatenate([game_from_blender(tg[:, :3]), tg[:, 3:]], 1)
    out['lod%d_uv' % li] = np.array(uvs)
    out['lod%d_idx' % li] = np.array(idx, dtype=np.int32)
    out['lod%d_joints' % li] = order.astype(np.int32)
    out['lod%d_weights' % li] = w4
    pa = np.zeros(len(me.polygons), dtype=np.int32)
    if 'part' in me.attributes:
        me.attributes['part'].data.foreach_get('value', pa)
    out['lod%d_part' % li] = pa[[t.polygon_index for t in me.loop_triangles]]
    log('LOD%d' % li, len(V), 'vértices', len(idx), 'triángulos', 'sin peso:', int((w4.sum(1) < 0.5).sum()))
np.savez_compressed(WORK / 'model.npz', **out)
J_game = {k: game_from_blender(v).tolist() for k, v in J.items() if 'finger' not in k or k.endswith('-1') or k[2:] in ('finger-1-2', 'finger-1-4')}
# centro del puño (por donde pasa la empuñadura): media de las yemas y falanges cerradas de cada mano
for side, s in (('Left', 'l'), ('Right', 'r')):
    hv = [i for i, w in enumerate(C['glove']) if w > 0.5 and (C['P'][i, 0] > 0) == (s == 'l')]
    J_game[s + '-fist'] = C['P'][hv].mean(0).tolist()
(WORK / 'joints.json').write_text(json.dumps(J_game, indent=1))
bpy.ops.wm.save_as_mainfile(filepath=str(WORK / 'model.blend'))
log('listo')
