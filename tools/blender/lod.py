"""Low-detail copies of the weapons for the third person (the rival and the bots carry these).

A soldier is seen from metres away, so its weapon needs a fraction of the first-person detail:
every mesh of a weapon is copied, joined into one object (one primitive per material) and decimated
to a triangle budget. Parts that move in third person stay separate with their own origin
(the FURIA 12 pump). Output roots: TP_<weapon> (e.g. TP_HALCON), in the same frame as the weapon.
"""
import bpy
from common import tri_count, join

# weapon root -> (triangle budget, parts kept separate: {source name: lod name}, parts left out)
LODS = {
    'HALCON': (1800, {}, ()),
    'FURIA12': (1300, {'s_pump': 'ts_pump'}, ('s_shell',)),
    'VIBORA9': (700, {}, ()),
    'NAVAJA': (400, {}, ()),
}


def _copy(o, root_inv, parent):
    c = o.copy()
    c.data = o.data.copy()
    c.parent = None
    c.matrix_world = root_inv @ o.matrix_world
    bpy.context.scene.collection.objects.link(c)
    return c


def _decimate(o, budget):
    t = tri_count(o)
    if t > budget:
        m = o.modifiers.new('lod', 'DECIMATE')
        m.decimate_type = 'COLLAPSE'
        m.ratio = budget / t
        m.use_collapse_triangulate = True
        with bpy.context.temp_override(object=o, active_object=o):
            bpy.ops.object.modifier_apply(modifier=m.name)
    return tri_count(o)


def build(name):
    budget, keep, drop = LODS[name]
    root = bpy.data.objects[name]
    root_inv = root.matrix_world.inverted()
    lod = bpy.data.objects.new('TP_' + name, None)
    bpy.context.scene.collection.objects.link(lod)
    lod.matrix_world = root.matrix_world.copy()

    def under(o, names):   # o is (a child of) one of the named parts
        while o is not None and o is not root:
            if o.name in names:
                return o.name
            o = o.parent
        return None

    meshes = [o for o in root.children_recursive if o.type == 'MESH' and not under(o, drop)]
    groups = {}
    for o in meshes:
        groups.setdefault(under(o, keep), []).append(o)
    total = sum(tri_count(o) for o in meshes)
    out = 0
    for key, objs in groups.items():
        cs = [_copy(o, root_inv, lod) for o in objs]
        j = join(cs, (keep[key] if key else 'TP_' + name + '_body'))
        share = sum(tri_count(o) for o in objs) / max(1, total)
        out += _decimate(j, max(60, int(budget * share)))
        if key:   # keep the part's own origin (it is moved in the game by its position)
            src = bpy.data.objects[key]
            want = root_inv @ src.matrix_world
            inv = want.inverted()
            j.data.transform(inv @ j.matrix_world)
            j.matrix_world = want
        mw = j.matrix_world.copy()
        j.parent = lod
        j.matrix_world = root.matrix_world @ mw
    return out
