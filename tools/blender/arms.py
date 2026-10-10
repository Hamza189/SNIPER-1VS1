"""First-person arms: tactical gloves (knuckle armour, padded fingers, wrist cuff) and the sleeves
of a field shirt, on one skeleton per arm. Built from code (original work).

Rest pose (Blender): arm straight forward along +Y, wrist at the origin, palm down (-Z), back of
the hand up (+Z); the right thumb on -X, the left one on +X. After export (game frame) that is:
fingers towards -z, back of the hand +y. The game poses the bones itself (two-bone IK to the
weapon's grips + finger curls), so no animation is exported.
Bones per side (prefix R_ / L_): upper, fore, hand, thumb1-3, index1-3, middle1-3, ring1-3, pinky1-3.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix
from common import *

UPPER, FORE = 0.29, 0.27
FINGERS = {  # knuckle (x, y), splay (deg), segment lengths, radius
    'index':  ((-0.027, 0.086), -6.0, (0.040, 0.024, 0.020), 0.0100),
    'middle': ((-0.0085, 0.089), -1.5, (0.044, 0.027, 0.021), 0.0102),
    'ring':   ((0.0100, 0.085), 3.5, (0.041, 0.025, 0.020), 0.0098),
    'pinky':  ((0.0275, 0.077), 8.5, (0.032, 0.020, 0.018), 0.0088),
}
THUMB = [(-0.017, 0.016, -0.006), (-0.038, 0.044, -0.014), (-0.050, 0.069, -0.017), (-0.057, 0.090, -0.018)]
THUMB_R = (0.0115, 0.0102, 0.0094, 0.0088)

def mats():
    return dict(
        glove=mat('A_glove', (0.045, 0.045, 0.043), 0.0, 0.88),
        pad=mat('A_pad', (0.085, 0.082, 0.072), 0.0, 0.62),
        cuff=mat('A_cuff', (0.028, 0.028, 0.027), 0.0, 0.9),
        sleeve=mat('A_sleeve', (0.19, 0.18, 0.12), 0.0, 0.95),
    )

def finger_points(s, name):
    (kx, ky), splay, lens, r = FINGERS[name]
    a = math.radians(splay) * s
    d = Vector((math.sin(a), math.cos(a), 0))
    p = Vector((kx * s, ky, 0.0))
    pts = [p.copy()]
    for L in lens:
        p = p + d * L
        pts.append(p.copy())
    return pts, r

def capsule(name, a, b, r1, r2, material, flat=0.86):
    """A tapered capsule from a to b (flattened a little top-to-bottom like a finger)."""
    a, b = Vector(a), Vector(b)
    d = (b - a)
    L = d.length
    o = cyl(name, r1, r2, L, (0, 0, 0), axis='Y', segs=16, material=material)
    s1 = sphere(name + 's1', r1, (0, -L / 2, 0), material, segs=16)
    s2 = sphere(name + 's2', r2, (0, L / 2, 0), material, segs=16)
    o = join([o, s1, s2])
    o.data.transform(Matrix.Diagonal((1, 1, flat, 1)))
    q = Vector((0, 1, 0)).rotation_difference(d.normalized())
    o.data.transform(Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4())
    return o

def remeshed(objs, name, voxel, ratio):
    g = join(objs, name)
    m = g.modifiers.new('rm', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel; m.adaptivity = 0.0
    sm = g.modifiers.new('sm', 'SMOOTH'); sm.factor = 0.6; sm.iterations = 3
    dc = g.modifiers.new('dc', 'DECIMATE'); dc.ratio = ratio
    apply_mods(g)
    for p in g.data.polygons:
        p.use_smooth = True
    uv_box(g, 60.0)
    return g

def glove_mesh(s, M, prefix):
    """Returns (palm_with_thumb, [finger meshes]). Each finger is its own smooth tube whose base
    sphere is centred on its knuckle (the pivot), so bending never opens a gap or tears a web."""
    parts = []
    rings = []
    for y, w, th, dz in ((-0.012, 0.058, 0.034, -0.002), (0.02, 0.068, 0.033, -0.002), (0.05, 0.077, 0.029, -0.0015), (0.075, 0.08, 0.025, -0.001), (0.086, 0.074, 0.021, -0.0005), (0.091, 0.06, 0.016, 0.0)):
        rings.append([(x + s * 0.0005, y, z * th / 0.03 + dz) for (x, z) in rounded_rect(w, 0.03, 0.0125, 4)])
    parts.append(loft(prefix + 'palm', rings, M['glove']))
    parts.append(sphere(prefix + 'thenar', 0.016, (s * -0.022, 0.03, -0.009), M['glove'], scale=(1.0, 1.4, 0.8)))
    parts.append(sphere(prefix + 'heel', 0.016, (s * 0.02, 0.022, -0.01), M['glove'], scale=(1.1, 1.3, 0.7)))
    parts.append(cyl(prefix + 'wrist', 0.027, 0.03, 0.05, (0, -0.02, -0.002), axis='Y', segs=20, material=M['glove']))
    parts[-1].data.transform(Matrix.Diagonal((1.15, 1, 0.8, 1)))
    tp = [Vector((p[0] * s, p[1], p[2])) for p in THUMB]
    for i in range(3):
        parts.append(capsule(prefix + 'thumb' + str(i), tp[i], tp[i + 1], THUMB_R[i], THUMB_R[i + 1], M['glove'], flat=0.92))
    palm = remeshed(parts, prefix + 'palmM', 0.0016, 0.11)
    fingers = []
    for name in FINGERS:
        pts, r = finger_points(s, name)
        rs = (r, r * 0.95, r * 0.9, r * 0.84)
        caps = [capsule(prefix + name + str(i), pts[i], pts[i + 1], rs[i], rs[i + 1], M['glove']) for i in range(3)]
        fingers.append((name, remeshed(caps, prefix + name + 'M', 0.0013, 0.09)))
    return palm, fingers

def armour(s, M, prefix):
    """Rigid pieces: knuckle armour, padded finger backs, wrist cuff. Returns [(object, bone)]."""
    out = []
    k = box(prefix + 'knuckle', (0.064, 0.02, 0.007), (s * 0.0, 0.075, 0.0125), M['pad'])
    m = k.modifiers.new('sub', 'SUBSURF'); m.levels = 2
    apply_mods(k)
    smooth(k, 80)
    out.append((k, 'hand'))
    # cuff: a short open tube with a strap over the back of the wrist
    rings = []
    for y, rx, rz in ((-0.062, 0.0365, 0.0305), (-0.012, 0.0335, 0.0275)):
        rings.append([(rx * math.cos(a), y, rz * math.sin(a) - 0.002) for a in [i * 2 * math.pi / 24 for i in range(24)]])
    c = loft(prefix + 'cuff', rings, M['cuff'], cap=False)
    sol = c.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.002
    apply_mods(c)
    smooth(c, 60)
    out.append((c, 'fore'))
    return out

def sleeve(prefix, M, y0, y1, r0, r1, folds, name):
    rings = []
    N = 20
    steps = 12
    for k in range(steps + 1):
        t = k / steps
        y = y0 + (y1 - y0) * t
        r = r0 + (r1 - r0) * t
        ring = []
        for i in range(N):
            a = i * 2 * math.pi / N
            f = 1.0 + folds * (0.5 * math.sin(a * 3 + t * 9) + 0.5 * math.sin(a * 5 - t * 13)) * (0.4 + 0.6 * t)
            ring.append((r * f * 1.08 * math.cos(a), y, r * f * 0.94 * math.sin(a)))
        rings.append(ring)
    o = loft(prefix + name, rings, M['sleeve'])
    for p in o.data.polygons:
        p.use_smooth = True
    uv_box(o, 30.0)
    return o

def skeleton(s, prefix):
    """Returns the bone list: (name, head, tail, parent)."""
    B = []
    B.append(('upper', (0, -(UPPER + FORE), 0), (0, -FORE, 0), None))
    B.append(('fore', (0, -FORE, 0), (0, 0, 0), 'upper'))
    B.append(('hand', (0, 0, 0), (0, 0.083, 0), 'fore'))
    for name in FINGERS:
        pts, r = finger_points(s, name)
        par = 'hand'
        for i in range(3):
            B.append((name + str(i + 1), tuple(pts[i]), tuple(pts[i + 1]), par))
            par = name + str(i + 1)
    tp = [(p[0] * s, p[1], p[2]) for p in THUMB]
    par = 'hand'
    for i in range(3):
        B.append(('thumb' + str(i + 1), tp[i], tp[i + 1], par))
        par = 'thumb' + str(i + 1)
    return B

def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length, t

def chain_weights(mesh_obj, chain, B, groups, base_parent=None, base_blend=0.0):
    """Weights along one bone chain: nearest bone, blended across its own joints."""
    for v in mesh_obj.data.vertices:
        p = v.co
        ds = [seg_dist(p, B[n][0], B[n][1]) for n in chain]
        j = min(range(len(chain)), key=lambda k: ds[k][0])
        u = ds[j][1]
        w = {chain[j]: 1.0}
        Z = 0.28
        if j > 0 and u < Z:
            k = 0.5 + 0.5 * u / Z
            w = {chain[j]: k, chain[j - 1]: 1 - k}
        elif j < len(chain) - 1 and u > 1 - Z:
            k = 0.5 + 0.5 * (1 - u) / Z
            w = {chain[j]: k, chain[j + 1]: 1 - k}
        elif j == 0 and base_parent and u < base_blend:
            k = 0.5 + 0.5 * u / base_blend
            w = {chain[0]: k, base_parent: 1 - k}
        for n, x in w.items():
            groups[n].add([v.index], x, 'REPLACE')

def skin_weights(palm, fingers, bones, s):
    B = {n: (Vector(h), Vector(t), par) for (n, h, t, par) in bones}
    gp = {n: palm.vertex_groups.new(name=n) for n in B}
    tchain = ['thumb1', 'thumb2', 'thumb3']
    for v in palm.data.vertices:
        p = v.co
        ds = [seg_dist(p, B[n][0], B[n][1]) for n in tchain]
        j = min(range(3), key=lambda k: ds[k][0])
        d, u = ds[j]
        # the thumb owns what is close to it and past its base; the rest is the hand (and the wrist)
        if d < 0.0145 and (j > 0 or u > 0.35):
            w = {tchain[j]: 1.0}
            if j > 0 and u < 0.28:
                k = 0.5 + 0.5 * u / 0.28; w = {tchain[j]: k, tchain[j - 1]: 1 - k}
            elif j < 2 and u > 0.72:
                k = 0.5 + 0.5 * (1 - u) / 0.28; w = {tchain[j]: k, tchain[j + 1]: 1 - k}
            elif j == 0:
                k = min(1.0, (u - 0.35) / 0.4); w = {'thumb1': 0.5 + 0.5 * k, 'hand': 0.5 - 0.5 * k}
        elif p.y < 0.0:
            k = min(1.0, -p.y / 0.06) * 0.5
            w = {'hand': 1 - k, 'fore': k}
        else:
            w = {'hand': 1.0}
        for n, x in w.items():
            gp[n].add([v.index], x, 'REPLACE')
    for name, f in fingers:
        g = {n: f.vertex_groups.new(name=n) for n in B}
        chain_weights(f, [name + '1', name + '2', name + '3'], B, g)

def build_side(s, prefix):
    M = mats()
    bones = skeleton(s, prefix)
    # armature
    ad = bpy.data.armatures.new(prefix + 'arm')
    arm = bpy.data.objects.new('ARM_' + prefix[0], ad)
    scene_coll().objects.link(arm)
    with bpy.context.temp_override(object=arm, active_object=arm, selected_objects=[arm], selected_editable_objects=[arm]):
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode='EDIT')
        eb = {}
        for (n, h, t, par) in bones:
            b = ad.edit_bones.new(prefix + n)
            b.head = h
            b.tail = t
            b.roll = 0.0
            if par:
                b.parent = eb[par]
                b.use_connect = False
            eb[n] = b
        bpy.ops.object.mode_set(mode='OBJECT')
    palm, fingers = glove_mesh(s, M, prefix)
    skin_weights(palm, fingers, bones, s)
    for o in [palm] + [f for _, f in fingers]:
        for vg in o.vertex_groups:
            vg.name = prefix + vg.name
    rigid = armour(s, M, prefix)
    rigid.append((sleeve(prefix, M, -FORE - 0.02, -0.035, 0.047, 0.037, 0.05, 'sleeveF'), 'fore'))
    rigid.append((sleeve(prefix, M, -FORE - UPPER, -FORE + 0.01, 0.058, 0.05, 0.04, 'sleeveU'), 'upper'))
    objs = [palm] + [f for _, f in fingers]
    for (o, bone) in rigid:
        g = o.vertex_groups.new(name=prefix + bone)
        g.add([v.index for v in o.data.vertices], 1.0, 'REPLACE')
        objs.append(o)
    mesh = join(objs, prefix + 'arms')
    if s < 0:
        pass
    mesh.parent = arm
    mod = mesh.modifiers.new('arm', 'ARMATURE'); mod.object = arm
    return arm, mesh

def mirror_mesh_x(o):
    o.data.transform(Matrix.Diagonal((-1, 1, 1, 1)))
    o.data.flip_normals()

def build():
    tris = 0
    for s, prefix in ((1, 'R_'), (-1, 'L_')):
        arm, mesh = build_side(s, prefix)
        tris += tri_count(mesh)
    return tris
