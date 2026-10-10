"""Shared helpers for the asset scripts (run with the `bpy` Python module: pip install bpy).

Coordinates (Blender): X = right, Y = forward (the muzzle), Z = up. The glTF exporter turns this
into the game's frame: x right, y up, -z forward. Units are metres.
Everything here is built from code (no downloaded models), so the assets are original work.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix, Euler

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)

def scene_coll():
    return bpy.context.scene.collection

# ---------------------------------------------------------------- materials
MATS = {}
def mat(name, color, metal=0.0, rough=0.5, emissive=None, alpha=1.0):
    """Principled material. The game looks materials up by name and may refine them."""
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1.0)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emissive:
        b.inputs['Emission Color'].default_value = (*emissive, 1.0)
        b.inputs['Emission Strength'].default_value = 1.0
    MATS[name] = m
    return m

# ---------------------------------------------------------------- objects
def obj_from_bm(name, bm, material=None, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene_coll().objects.link(o)
    if material is not None:
        me.materials.append(material)
    if parent is not None:
        o.parent = parent
    return o

def empty(name, loc=(0, 0, 0), parent=None, rot=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.01
    scene_coll().objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    if parent is not None:
        o.parent = parent
    return o

def apply_mods(o):
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)

def smooth(o, angle=35):
    """Smooth shading with sharp edges kept above `angle` degrees."""
    me = o.data
    for p in me.polygons:
        p.use_smooth = True
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
        except Exception:
            pass

def bevel(o, width=0.0008, segs=2, angle=40, harden=True):
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width = width
    m.segments = segs
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = harden
    m.miter_outer = 'MITER_ARC'
    return m

def weighted_normals(o):
    m = o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    m.keep_sharp = True
    return m

def finish(o, width=0.0008, segs=2, angle=40):
    """Bevel the hard edges and fix the shading so small parts catch light like machined parts."""
    bevel(o, width, segs, angle, harden=False)
    apply_mods(o)
    smooth(o, 32)

def boolean(target, cutter, op='DIFFERENCE', keep=False):
    m = target.modifiers.new('bool', 'BOOLEAN')
    m.operation = op
    m.solver = 'EXACT'
    m.object = cutter
    with bpy.context.temp_override(object=target, active_object=target, selected_objects=[target], selected_editable_objects=[target]):
        bpy.ops.object.modifier_apply(modifier=m.name)
    if not keep:
        bpy.data.objects.remove(cutter, do_unlink=True)

def join(objs, name=None):
    objs = [o for o in objs if o is not None]
    base = objs[0]
    with bpy.context.temp_override(active_object=base, object=base, selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.join()
    if name:
        base.name = name
        base.data.name = name
    return base

# ---------------------------------------------------------------- shapes
def prism_yz(name, pts, x0, x1, material=None, parent=None):
    """A side profile (list of (y, z), counter-clockwise seen from +X) extruded from x0 to x1."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for (y, z) in pts]
    b = [bm.verts.new((x1, y, z)) for (y, z) in pts]
    n = len(pts)
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material, parent)

def prism_xz(name, pts, y0, y1, material=None, parent=None):
    """A cross-section (list of (x, z)) extruded along Y from y0 to y1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for (x, z) in pts]
    b = [bm.verts.new((x, y1, z)) for (x, z) in pts]
    n = len(pts)
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[j], a[i], b[i], b[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material, parent)

def box(name, size, loc, material=None, parent=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    R = Euler(rot).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(loc)) @ R, verts=bm.verts)
    return obj_from_bm(name, bm, material, parent)

def cyl(name, r1, r2, length, loc=(0, 0, 0), axis='Y', segs=24, material=None, parent=None, rot=None):
    """Cylinder/cone along an axis, centred on loc. r1 at the negative end, r2 at the positive end."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=length)
    if axis == 'Y':
        R = Matrix.Rotation(-math.pi / 2, 4, 'X')
    elif axis == 'X':
        R = Matrix.Rotation(math.pi / 2, 4, 'Y')
    else:
        R = Matrix.Identity(4)
    if rot is not None:
        R = Euler(rot).to_matrix().to_4x4() @ R
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(loc)) @ R, verts=bm.verts)
    return obj_from_bm(name, bm, material, parent)

def sphere(name, r, loc, material=None, parent=None, scale=(1, 1, 1), segs=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=max(6, segs // 2), radius=r)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2])) + Vector(loc)
    return obj_from_bm(name, bm, material, parent)

def rounded_rect(w, d, r, segs=4):
    """Points of a rounded rectangle (width along x, depth along y), centred, counter-clockwise."""
    pts = []
    cs = [(w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)]
    for cx, cy, a0 in cs:
        for i in range(segs + 1):
            a = math.radians(a0 + 90 * i / segs)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def loft(name, rings, material=None, parent=None, cap=True):
    """Bridges a list of rings (each a list of 3D points, same count) into a closed tube."""
    bm = bmesh.new()
    vs = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for k in range(len(vs) - 1):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((vs[k][i], vs[k][j], vs[k + 1][j], vs[k + 1][i]))
    if cap:
        bm.faces.new(list(reversed(vs[0])))
        bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material, parent)

def text_mesh(name, body, size, depth, loc, rot, material=None):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = depth
    cu.resolution_u = 2
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    o = bpy.data.objects.new(name, cu)
    scene_coll().objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
        bpy.ops.object.convert(target='MESH')
    o = bpy.context.scene.objects[name] if name in bpy.context.scene.objects else o
    if material is not None:
        o.data.materials.append(material)
    return o

def uv_box(o, scale=1.0):
    """Box-projected UVs (for the detail textures the game adds: stippling, fabric weave)."""
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    for p in me.polygons:
        n = p.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                u, v = co.y, co.z
            elif ax == 1:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            uv[li].uv = (u * scale, v * scale)

def set_origin(o, point):
    """Moves the object's origin to `point` (object space of its parent) without moving the mesh."""
    p = Vector(point)
    o.data.transform(Matrix.Translation(-p))
    o.location = o.location + p

def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)
