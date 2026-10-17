"""street_rat (Poly Haven, CC0, Sean Buckley): the mesh keeps the Rigify DEF-* weights of its original rig (the skeleton was
removed). We rebuild a light game skeleton (18 bones) on those weights — groups merged per bone — and export a skinned GLB.
No fur (particle hair cannot be exported; the texture already carries the coat colour)."""
import bpy, sys, re, mathutils
src, out = sys.argv[-2], sys.argv[-1]
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.ops.wm.open_mainfile(filepath=src, load_ui=False, use_scripts=False)
o = bpy.data.objects['street_rat']
for m in list(o.modifiers): o.modifiers.remove(m)          # hair particles + subsurf (game mesh = base cage, 14k tris)
for x in list(bpy.data.objects):
    if x != o: bpy.data.objects.remove(x)
FACE = r'lid|brow|lip|cheek|nose|chin|jaw|tongue|forehead|temple'
def target(n):
    if not n.startswith('DEF-'): return None
    s = n[4:]
    if re.match(r'tail\.00(\d)', s): return 't' + s[-1]
    if re.search(FACE, s) or s == 'spine.005': return 'head'
    if s.startswith('ear.'): return 'ear.' + s[4]
    if s == 'spine.004': return 'neck'
    if s in ('spine.002', 'spine.003', 'belly.C', 'Breast.C'): return 'chest'
    if s in ('spine', 'spine.001', 'pelvis.C'): return 'hips'
    m = re.match(r'(pelvis|thigh|shin)\.([LR])', s)
    if m: return 'hip.' + m.group(2)
    m = re.match(r'r_.*\.([LR])', s) or re.match(r'foot.*\.([LR])', s)
    if m: return 'rfoot.' + m.group(1)
    m = re.match(r'shoulder\.([LR])', s)
    if m: return 'arm.' + m.group(1)
    m = re.match(r'f_.*\.([LR])', s)
    if m: return 'ffoot.' + m.group(1)
    return None
idx = {g.index: target(g.name) for g in o.vertex_groups}
W = {}
for v in o.data.vertices:
    acc = {}
    for ge in v.groups:
        t = idx.get(ge.group)
        if t and ge.weight > 0: acc[t] = acc.get(t, 0) + ge.weight
    s = sum(acc.values())
    if s <= 0: acc, s = {'hips': 1.0}, 1.0
    ws = {k: w / s for k, w in acc.items()}
    # the original tail.001 group also covers the rump: on the body (y < 3 cm) that weight goes to the hips, so bending
    # the tail no longer stretches the hindquarters into a cone
    y = (o.matrix_world @ v.co).y
    if ws.get('t1') and y < 0.032:
        k = min(1.0, max(0.0, (y - 0.022) / 0.010)); move = ws['t1'] * (1 - k); ws['t1'] -= move; ws['hips'] = ws.get('hips', 0) + move
    W[v.index] = ws
for g in list(o.vertex_groups): o.vertex_groups.remove(g)
# bones: (name, head, tail, parent) — metres, rat looks to -Y, +Z up
B = [('root', (0, 0.0, 0), (0, -0.01, 0), None),
     ('hips', (0, 0.019, 0.016), (0, 0.003, 0.019), 'root'), ('chest', (0, 0.003, 0.019), (0, -0.013, 0.017), 'hips'),
     ('neck', (0, -0.013, 0.017), (0, -0.022, 0.016), 'chest'), ('head', (0, -0.022, 0.016), (0, -0.041, 0.012), 'neck'),
     ('ear.L', (0.005, -0.02, 0.022), (0.008, -0.017, 0.029), 'head'), ('ear.R', (-0.005, -0.02, 0.022), (-0.008, -0.017, 0.029), 'head'),
     ('t1', (0, 0.021, 0.014), (0, 0.035, 0.010), 'hips'), ('t2', (0, 0.035, 0.010), (0, 0.055, 0.0055), 't1'),
     ('t3', (0, 0.055, 0.0055), (0, 0.079, 0.0022), 't2'), ('t4', (0, 0.079, 0.0022), (0, 0.107, 0.0002), 't3')]
for sd, sx in (('L', 1), ('R', -1)):
    B += [('hip.' + sd, (sx * 0.0095, 0.019, 0.016), (sx * 0.011, 0.020, 0.004), 'hips'), ('rfoot.' + sd, (sx * 0.011, 0.020, 0.004), (sx * 0.008, 0.011, 0.0008), 'hip.' + sd),
          ('arm.' + sd, (sx * 0.0085, -0.010, 0.014), (sx * 0.0062, -0.0155, 0.0030), 'chest'), ('ffoot.' + sd, (sx * 0.0062, -0.0155, 0.0030), (sx * 0.0055, -0.0222, 0.0005), 'arm.' + sd)]
arm = bpy.data.armatures.new('rat_rig'); ao = bpy.data.objects.new('rat_rig', arm); bpy.context.scene.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT')
for n, h, t, p in B:
    eb = arm.edit_bones.new(n); eb.head = h; eb.tail = t
    if p: eb.parent = arm.edit_bones[p]; eb.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')
for n, *_ in B: o.vertex_groups.new(name=n)
for vi, ws in W.items():
    for k, w in ws.items(): o.vertex_groups[k].add([vi], w, 'REPLACE')
o.parent = ao; md = o.modifiers.new('rig', 'ARMATURE'); md.object = ao
mat = bpy.data.materials.new('rat'); o.data.materials.clear(); o.data.materials.append(mat)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_skins=True, export_animations=False,
                          export_apply=False, export_yup=True, export_materials='EXPORT', export_image_format='NONE')
print('ok huesos', len(B), 'vértices', len(o.data.vertices), 'triángulos', sum(len(p.vertices) - 2 for p in o.data.polygons))
