"""PUEBLO 3.0 — modular architecture kit (Blender, bpy).

Builds assets/kit.glb: windows, doors, shutters, blinds, stone surrounds, balconies, awnings, tile eaves,
cornices, downpipes, lanterns, planters, pots, benches, climbing plants, laundry, signs, the fountain and
trees. Every piece is generated here from code (original work, no third-party assets or licences).

Run from the repo root:   python3 tools/blender/kit.py      (needs: pip install bpy)

Piece frame (GAME coordinates, metres): x along the wall, y up, z out of the wall. The wall's outer face
is z = 0; openings go into the wall (z < 0) by REVEAL metres. Each opening piece has its origin at the
bottom centre of the opening on the wall face. The browser places the pieces with instancing
(client/town3.js says where, page.html draws them). Material names are looked up by the game:
  stucco (tinted like the wall), stone, frame, wood (painted, tinted), woodraw, iron, glass, tile,
  terracotta, leaf (vertex colours), cloth (tinted), clothw, clothv (vertex colours), lamp, metal (tinted),
  zinc, azulejo, ceramic, dark, water, concrete, sign (UV 0..1 on the board's face)
"""
import sys, math, pathlib, random, json
import bpy, bmesh
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'kit.glb'
REVEAL = 0.22            # how deep openings go into the wall (town3.js uses the same value)
ONLY = set(a for a in sys.argv[1:] if not a.startswith('-'))

MAT_BASE = {   # Blender base colours (the game refines every material by name)
    'stucco': (0.92, 0.90, 0.86), 'stone': (0.80, 0.74, 0.63), 'frame': (0.90, 0.88, 0.83), 'wood': (0.85, 0.85, 0.85),
    'woodraw': (0.42, 0.30, 0.20), 'iron': (0.07, 0.07, 0.07), 'glass': (0.20, 0.26, 0.30), 'tile': (0.66, 0.36, 0.22),
    'terracotta': (0.70, 0.40, 0.26), 'leaf': (1, 1, 1), 'cloth': (0.9, 0.9, 0.9), 'clothw': (0.93, 0.91, 0.86),
    'clothv': (1, 1, 1), 'lamp': (1.0, 0.9, 0.7), 'metal': (0.8, 0.8, 0.8), 'zinc': (0.55, 0.56, 0.55),
    'azulejo': (1, 1, 1), 'ceramic': (0.93, 0.92, 0.88), 'dark': (0.05, 0.045, 0.04), 'water': (0.2, 0.32, 0.32),
    'concrete': (0.7, 0.68, 0.64), 'sign': (1, 1, 1),
}


def hexc(h):
    return ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)


class Piece:
    """A mesh built from faces in game coordinates; each face has a material and a colour."""
    def __init__(self, name):
        self.name = name
        self.faces = []          # (points, material, colour, uvs or None)

    # ------------------------------------------------------------- primitives
    def face(self, pts, mat, col=(1, 1, 1), uvs=None):
        self.faces.append(([tuple(p) for p in pts], mat, tuple(col), uvs))

    def box(self, x0, y0, z0, x1, y1, z1, mat, col=(1, 1, 1), skip=''):
        P = lambda x, y, z: (x, y, z)
        if '-x' not in skip: self.face([P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], mat, col)
        if '+x' not in skip: self.face([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], mat, col)
        if '-y' not in skip: self.face([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], mat, col)
        if '+y' not in skip: self.face([P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0)], mat, col)
        if '-z' not in skip: self.face([P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)], mat, col)
        if '+z' not in skip: self.face([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], mat, col)

    def quad_z(self, x0, y0, x1, y1, z, mat, col=(1, 1, 1), uvs=None):
        """A flat rectangle facing +z."""
        self.face([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], mat, col, uvs)

    def prism_x(self, prof, x0, x1, mat, col=(1, 1, 1), caps=True):
        """A profile [(y, z)…] (counter-clockwise seen from +x) extruded along x."""
        n = len(prof)
        for i in range(n):
            (y0, z0), (y1, z1) = prof[i], prof[(i + 1) % n]
            self.face([(x0, y0, z0), (x0, y1, z1), (x1, y1, z1), (x1, y0, z0)], mat, col)
        if caps:
            self.face([(x1, y, z) for (y, z) in prof], mat, col)
            self.face([(x0, y, z) for (y, z) in reversed(prof)], mat, col)

    def lathe(self, prof, cx, cz, segs, mat, col=(1, 1, 1), y0=0, close_top=False):
        """A profile [(r, y)…] from the bottom up, turned around a vertical axis at (cx, cz)."""
        rings = []
        for r, y in prof:
            rings.append([(cx + r * math.cos(2 * math.pi * i / segs), y0 + y, cz + r * math.sin(2 * math.pi * i / segs)) for i in range(segs)])
        for k in range(len(rings) - 1):
            a, b = rings[k], rings[k + 1]
            for i in range(segs):
                j = (i + 1) % segs
                self.face([a[i], a[j], b[j], b[i]][::-1], mat, col)
        if prof[0][0] > 0:
            self.face(rings[0], mat, col)
        if close_top and prof[-1][0] > 0:
            self.face(rings[-1][::-1], mat, col)

    def cyl_y(self, cx, cz, y0, y1, r0, r1, segs, mat, col=(1, 1, 1), caps=True):
        self.lathe([(r0, y0), (r1, y1)], cx, cz, segs, mat, col, 0, caps)

    def tube(self, pts, r, mat, col=(1, 1, 1), sides=5, caps=False):
        """A thin tube along a polyline (ironwork, cables, branches)."""
        rings = []
        for i, p in enumerate(pts):
            p = Vector(p)
            a = Vector(pts[max(i - 1, 0)]); b = Vector(pts[min(i + 1, len(pts) - 1)])
            d = (b - a).normalized()
            up = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
            s1 = d.cross(up).normalized(); s2 = d.cross(s1).normalized()
            rr = r(i / max(1, len(pts) - 1)) if callable(r) else r
            rings.append([tuple(p + (s1 * math.cos(2 * math.pi * k / sides) + s2 * math.sin(2 * math.pi * k / sides)) * rr) for k in range(sides)])
        for k in range(len(rings) - 1):
            a, b = rings[k], rings[k + 1]
            for i in range(sides):
                j = (i + 1) % sides
                self.face([a[i], a[j], b[j], b[i]], mat, col)
        if caps:
            self.face(rings[0][::-1], mat, col); self.face(rings[-1], mat, col)

    def blob(self, c, rad, mat, col, rnd, jit=0.25, sub=1):
        """A lumpy low-poly ball (foliage, flower clusters)."""
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
        for v in bm.verts:
            k = 1 + rnd.uniform(-jit, jit)
            v.co = Vector((c[0] + v.co.x * rad[0] * k, c[1] + v.co.y * rad[1] * k, c[2] + v.co.z * rad[2] * k))
        for f in bm.faces:
            self.face([tuple(v.co) for v in f.verts], mat, col)
        bm.free()

    def arch_fill(self, w, ys, r, z0, z1, mat, col=(1, 1, 1), segs=10):
        """The wall above an arch: corners of the rectangle [-w/2, w/2] × [ys, ys + r] outside the half
        circle of radius r (on the face z1), and the curved underside (intrados) from z1 back to z0."""
        pts = [(r * math.cos(math.pi * i / segs), ys + r * math.sin(math.pi * i / segs)) for i in range(segs + 1)]
        mid = segs // 2
        right = pts[:mid + 1]                       # from (r, ys) to the top (0, ys + r)
        left = pts[mid:]                            # from the top to (-r, ys)
        top = ys + r
        # right corner: polygon (w/2, ys) → (w/2, top) → top of the arch … down the arch to (r, ys)
        self.face([(w / 2, ys, z1), (w / 2, top, z1)] + [(x, y, z1) for (x, y) in reversed(right)], mat, col)
        self.face([(-w / 2, top, z1), (-w / 2, ys, z1)] + [(x, y, z1) for (x, y) in reversed(left)], mat, col)
        for i in range(segs):
            (xa, ya), (xb, yb) = pts[i], pts[i + 1]
            self.face([(xa, ya, z1), (xb, yb, z1), (xb, yb, z0), (xa, ya, z0)], mat, col)

    def ring_arch(self, ys, r0, r1, z0, z1, mat, col=(1, 1, 1), stones=9, gap=0.012, key=0.0):
        """Voussoirs: a half ring of wedge stones (r0..r1) between depths z0..z1; key = keystone bulge."""
        for i in range(stones):
            a0 = math.pi * i / stones + gap / r1
            a1 = math.pi * (i + 1) / stones - gap / r1
            k = key if i == stones // 2 else 0
            rr1 = r1 + k
            zz1 = z1 + (0.02 if k else 0)
            p = [(r0 * math.cos(a0), ys + r0 * math.sin(a0)), (r0 * math.cos(a1), ys + r0 * math.sin(a1)),
                 (rr1 * math.cos(a1), ys + rr1 * math.sin(a1)), (rr1 * math.cos(a0), ys + rr1 * math.sin(a0))]
            # extrude p (in x, y) from z0 to zz1
            self.face([(x, y, zz1) for (x, y) in p], mat, col)
            for j in range(4):
                (xa, ya), (xb, yb) = p[j], p[(j + 1) % 4]
                self.face([(xa, ya, zz1), (xa, ya, z0), (xb, yb, z0), (xb, yb, zz1)], mat, col)

    # ------------------------------------------------------------- to Blender
    def build(self, smooth_angle=38):
        bm = bmesh.new()
        mats = []
        col_layer = bm.loops.layers.color.new('Col')
        uv_layer = bm.loops.layers.uv.new('UVMap')
        for pts, mat, col, uvs in self.faces:
            if mat not in mats:
                mats.append(mat)
            vs = [bm.verts.new((x, -z, y)) for (x, y, z) in pts]        # game → Blender (x, -z, y)
            try:
                f = bm.faces.new(vs)
            except ValueError:
                continue
            f.material_index = mats.index(mat)
            f.normal_update()
            n = f.normal
            for k, loop in enumerate(f.loops):
                loop[col_layer] = (*col, 1.0)
                gx, gy, gz = pts[k]
                if uvs:
                    loop[uv_layer].uv = uvs[k]
                else:   # world-planar UVs in metres (the game's textures are set up in metres)
                    ax = max(range(3), key=lambda i: abs(n[i]))
                    if ax == 2:      # blender z = game y: top / bottom
                        loop[uv_layer].uv = (gx, gz)
                    elif ax == 0:
                        loop[uv_layer].uv = (gz * (1 if n[0] > 0 else -1), gy)
                    else:
                        loop[uv_layer].uv = (gx * (1 if n[1] < 0 else -1), gy)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in mats:
            me.materials.append(material(m))
        ca = me.color_attributes.get('Col')
        if ca is not None:
            me.color_attributes.active_color = ca
            me.color_attributes.render_color_index = me.color_attributes.find('Col')
        o = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(o)
        for p in me.polygons:
            p.use_smooth = True
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
            try:
                bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
            except Exception:
                pass
        return o


_MATS = {}
def material(name):
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*MAT_BASE.get(name, (0.8, 0.8, 0.8)), 1.0)
    b.inputs['Roughness'].default_value = 0.8
    if name in ('leaf', 'clothv', 'stucco', 'stone', 'frame', 'wood', 'woodraw', 'terracotta', 'tile', 'cloth', 'clothw', 'metal', 'azulejo', 'ceramic'):
        # tell the exporter the vertex colour is used (COLOR_0 is exported with the mesh)
        vc = m.node_tree.nodes.new('ShaderNodeVertexColor')
        vc.layer_name = 'Col'
        mix = m.node_tree.nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
        mix.inputs[1].default_value = (*MAT_BASE.get(name, (0.8, 0.8, 0.8)), 1.0)
        m.node_tree.links.new(vc.outputs['Color'], mix.inputs[2])
        m.node_tree.links.new(mix.outputs['Color'], b.inputs['Base Color'])
    _MATS[name] = m
    return m


# =====================================================================================================
# PIECES
# =====================================================================================================
D = REVEAL
WHITE = (1, 1, 1)
PIECES = {}


def piece(fn):
    PIECES[fn.__name__] = fn
    return fn


def sill(p, w, depth_out=0.07, y=0.0):
    """Stone sill under a window: sloped top, front drip."""
    p.prism_x([(y - 0.075, -D), (y - 0.075, depth_out - 0.01), (y - 0.055, depth_out), (y - 0.005, depth_out), (y + 0.012, -D + 0.04), (y + 0.012, -D)],
              -w / 2 - 0.1, w / 2 + 0.1, 'stone')


def casement(p, w, h, y0, panes, z=-D + 0.03, lower_panel=0.0, curtain=None):
    """Window frame in the opening: outer frame, two leaves, glazing bars, glass (and a curtain behind)."""
    t, lt = 0.065, 0.045
    zf0, zf1 = z, z + 0.06
    # outer frame
    p.box(-w / 2, y0, zf0, -w / 2 + t, y0 + h, zf1, 'frame', skip='-z')
    p.box(w / 2 - t, y0, zf0, w / 2, y0 + h, zf1, 'frame', skip='-z')
    p.box(-w / 2 + t, y0 + h - t, zf0, w / 2 - t, y0 + h, zf1, 'frame', skip='-z')
    p.box(-w / 2 + t, y0, zf0, w / 2 - t, y0 + t, zf1, 'frame', skip='-z')
    # two leaves (stiles + rails, slightly in front of the frame)
    zl0, zl1 = z + 0.005, z + 0.045
    iw = w / 2 - t
    for s in (-1, 1):
        xa, xb = (-iw, 0) if s < 0 else (0, iw)
        p.box(xa, y0 + t, zl0, xa + lt, y0 + h - t, zl1, 'frame', skip='-z')
        p.box(xb - lt, y0 + t, zl0, xb, y0 + h - t, zl1, 'frame', skip='-z')
        p.box(xa + lt, y0 + h - t - lt, zl0, xb - lt, y0 + h - t, zl1, 'frame', skip='-z')
        p.box(xa + lt, y0 + t, zl0, xb - lt, y0 + t + lt + (lower_panel * 0.0), zl1, 'frame', skip='-z')
        gy0 = y0 + t + lt
        if lower_panel:
            p.box(xa + lt, y0 + t + lt, zl0 + 0.01, xb - lt, y0 + t + lower_panel, zl1 - 0.012, 'frame', skip='-z')
            p.box(xa + lt, y0 + t + lower_panel, zl0, xb - lt, y0 + t + lower_panel + lt, zl1, 'frame', skip='-z')
            gy0 = y0 + t + lower_panel + lt
        gy1 = y0 + h - t - lt
        for k in range(1, panes):
            yy = gy0 + (gy1 - gy0) * k / panes
            p.box(xa + lt, yy - 0.012, zl0 + 0.01, xb - lt, yy + 0.012, zl1 - 0.01, 'frame', skip='-z')
        p.quad_z(xa + lt, gy0, xb - lt, gy1, z + 0.02, 'glass')
    if curtain:
        cx0, cx1, cy1 = curtain
        p.quad_z(cx0, y0 + t, cx1, cy1, z - 0.03, 'clothw', (0.96, 0.94, 0.88))
    # dark interior behind
    p.quad_z(-w / 2, y0, w / 2, y0 + h, z - 0.06, 'dark')


@piece
def win_std():
    p = Piece('win_std')
    casement(p, 1.0, 1.4, 0.0, 3)
    sill(p, 1.0)
    return p


@piece
def win_std_cur():
    p = Piece('win_std_cur')
    casement(p, 1.0, 1.4, 0.0, 3, curtain=(-0.45, 0.05, 1.32))
    sill(p, 1.0)
    return p


@piece
def win_tall():
    p = Piece('win_tall')
    casement(p, 1.0, 2.2, 0.0, 4, lower_panel=0.45)
    p.box(-0.6, -0.02, -D, 0.6, 0.0, 0.02, 'stone')
    return p


@piece
def win_small():
    p = Piece('win_small')
    w, h = 0.6, 0.6
    casement(p, w, h, 0.0, 1)
    for k in range(1, 5):
        x = -w / 2 + w * k / 5
        p.box(x - 0.01, 0.02, -0.06, x + 0.01, h - 0.02, -0.04, 'iron')
    sill(p, w, 0.05)
    return p


@piece
def win_arch():
    """1.0 × 1.8 opening with a round top (springs at 1.3): wall infill, arched frame, voussoirs."""
    p = Piece('win_arch')
    w, ys, r = 1.0, 1.3, 0.5
    casement(p, w, ys, 0.0, 2)
    p.arch_fill(w, ys, r, -D + 0.03, 0.0, 'stucco')
    # fanlight: half-round frame and glass
    segs = 10
    z = -D + 0.03
    arc = [(r * math.cos(math.pi * i / segs), ys + r * math.sin(math.pi * i / segs)) for i in range(segs + 1)]
    inner = [(x * 0.86, ys + (y - ys) * 0.86) for x, y in arc]
    for i in range(segs):
        (xa, ya), (xb, yb) = arc[i], arc[i + 1]
        (xc, yc), (xd, yd) = inner[i + 1], inner[i]
        p.face([(xa, ya, z + 0.06), (xb, yb, z + 0.06), (xc, yc, z + 0.06), (xd, yd, z + 0.06)][::-1], 'frame')
    p.face([(x, y, z + 0.02) for x, y in inner][::-1] + [], 'glass')
    for a in (math.pi / 4, math.pi / 2, 3 * math.pi / 4):
        p.tube([(0, ys, z + 0.04), (r * 0.86 * math.cos(a), ys + r * 0.86 * math.sin(a), z + 0.04)], 0.012, 'frame', sides=4)
    p.quad_z(-r, ys, r, ys + r, z - 0.06, 'dark')
    p.ring_arch(ys, r, r + 0.17, 0.0, 0.035, 'stone', stones=7, key=0.06)
    for s in (-1, 1):   # imposts and jamb stones
        p.box(s * r - (0.17 if s < 0 else 0), ys - 0.12, 0.0, s * r + (0.17 if s > 0 else 0), ys, 0.04, 'stone')
    sill(p, w)
    return p


@piece
def reja():
    """Ground-floor window grille (1.0 × 1.4 opening), flat against the wall."""
    p = Piece('reja')
    w, h = 1.16, 1.5
    z0, z1 = 0.035, 0.055
    n = 9
    for k in range(n):
        x = -w / 2 + 0.05 + (w - 0.1) * k / (n - 1)
        p.box(x - 0.009, -0.05, z0, x + 0.009, h - 0.04, z1, 'iron', skip='-y-z')
    for y in (0.05, h * 0.5, h - 0.12):
        p.box(-w / 2, y - 0.015, z1, w / 2, y + 0.015, z1 + 0.012, 'iron', skip='-x+x-z')
    # small scrolls at the top
    for k in range(4):
        cx = -w / 2 + 0.15 + (w - 0.3) * k / 3
        pts = [(cx + 0.06 * math.cos(a), h - 0.12 + 0.06 + 0.06 * math.sin(a), z1 + 0.006) for a in [math.pi * 1.5 + i * math.pi / 3 for i in range(7)]]
        p.tube(pts, 0.008, 'iron', sides=3)
    return p


def louvred_leaf(p, x0, x1, y0, y1, z0, z1, mat='wood'):
    t = 0.045
    p.box(x0, y0, z0, x0 + t, y1, z1, mat, skip='-z')
    p.box(x1 - t, y0, z0, x1, y1, z1, mat, skip='-z')
    p.box(x0 + t, y1 - t, z0, x1 - t, y1, z1, mat, skip='-z')
    p.box(x0 + t, y0, z0, x1 - t, y0 + t * 1.6, z1, mat, skip='-z')
    mid = (y0 + y1) / 2
    p.box(x0 + t, mid - 0.03, z0, x1 - t, mid + 0.03, z1, mat, skip='-z')
    # slats: tilted strips (front only), lighter top edge
    y = y0 + t * 1.6
    while y + 0.055 < y1 - t:
        if not (mid - 0.03 < y + 0.025 < mid + 0.03):
            p.face([(x0 + t, y, z1 - 0.005), (x1 - t, y, z1 - 0.005), (x1 - t, y + 0.06, z0 + 0.008), (x0 + t, y + 0.06, z0 + 0.008)], mat, (0.8, 0.8, 0.8))
        y += 0.055
    p.quad_z(x0 + t, y0, x1 - t, y1, z0 + 0.002, 'dark')


@piece
def shutter():
    """One open louvred shutter leaf (0.5 × 1.4), flat on the wall beside the opening; origin at its
    bottom centre. Symmetric: the same piece goes on both sides."""
    p = Piece('shutter')
    louvred_leaf(p, -0.25, 0.25, 0.0, 1.4, 0.008, 0.045)
    return p


@piece
def shutter_tall():
    p = Piece('shutter_tall')
    louvred_leaf(p, -0.25, 0.25, 0.0, 2.2, 0.008, 0.045)
    return p


@piece
def persiana():
    """Roll-down cane blind (persiana) hanging outside the window from the lintel (origin: top centre,
    1 m drop; the game scales it in y for longer or shorter drops)."""
    p = Piece('persiana')
    w = 1.12
    # the rolled part
    segs = 8
    for i in range(segs):
        a0, a1 = 2 * math.pi * i / segs, 2 * math.pi * (i + 1) / segs
        q = lambda a, x: (x, -0.06 + 0.06 * math.sin(a), 0.1 + 0.06 * math.cos(a))
        p.face([q(a0, -w / 2), q(a1, -w / 2), q(a1, w / 2), q(a0, w / 2)], 'wood', (0.9, 0.9, 0.9))
    # hanging slats: two tones
    n = 26
    for k in range(n):
        y1 = -0.1 - k * (0.9 / n)
        y0 = y1 - 0.9 / n
        c = (1, 1, 1) if k % 2 else (0.78, 0.78, 0.78)
        p.face([(-w / 2, y0, 0.06 + k * 0.0015), (w / 2, y0, 0.06 + k * 0.0015), (w / 2, y1, 0.06 + k * 0.0015), (-w / 2, y1, 0.06 + k * 0.0015)], 'wood', c)
    for x in (-w / 2 + 0.12, w / 2 - 0.12):
        p.box(x - 0.006, -1.0, 0.05, x + 0.006, -0.05, 0.1, 'clothw')
    p.box(-0.05, -0.04, 0.0, 0.05, 0.0, 0.12, 'iron')
    return p


@piece
def door_arch():
    """Deep arched doorway: opening 1.4 × 2.7 (springs at 2.0), plank door with studs, stone voussoirs,
    jamb stones and a step."""
    p = Piece('door_arch')
    w, ys, r = 1.4, 2.0, 0.7
    z = -D + 0.03
    p.arch_fill(w, ys, r, z - 0.02, 0.0, 'stucco')
    # planks
    n = 8
    for k in range(n):
        x0 = -w / 2 + w * k / n
        x1 = x0 + w / n - 0.006
        xc = (x0 + x1) / 2
        top = ys + math.sqrt(max(0.0, r * r - xc * xc)) - 0.01
        p.box(x0 + 0.003, 0.0, z - 0.02, x1, top, z + 0.025 + (0.004 if k % 2 else 0), 'woodraw', (1, 1, 1) if k % 3 else (0.85, 0.85, 0.85), skip='-z')
    # iron straps and studs
    for y in (0.4, 1.25, 1.95):
        p.box(-w / 2 + 0.05, y - 0.03, z + 0.03, w / 2 - 0.05, y + 0.03, z + 0.04, 'iron')
        for k in range(7):
            x = -w / 2 + 0.12 + (w - 0.24) * k / 6
            p.box(x - 0.017, y - 0.017, z + 0.04, x + 0.017, y + 0.017, z + 0.052, 'iron')
    p.box(-0.004, 0.0, z + 0.025, 0.004, ys + r - 0.02, z + 0.03, 'dark')      # gap between the leaves
    ring = [(0.18 + 0.06 * math.cos(a), 1.15 + 0.06 * math.sin(a), z + 0.06) for a in [i * math.pi / 5 for i in range(11)]]
    p.tube(ring, 0.008, 'iron', sides=4)
    # stone: jambs (alternating long / short), imposts, voussoirs, keystone, step
    y = 0.0
    k = 0
    while y < ys - 0.05:
        hgt = min(0.36, ys - y)
        ln = 0.3 if k % 2 == 0 else 0.2
        for s in (-1, 1):
            xa, xb = (s * w / 2, s * (w / 2 + ln)) if s > 0 else (s * (w / 2 + ln), s * w / 2)
            p.box(xa, y + 0.006, 0.0, xb, y + hgt - 0.006, 0.045, 'stone', (1, 1, 1) if k % 3 else (0.93, 0.92, 0.9))
        y += hgt
        k += 1
    p.ring_arch(ys, r, r + 0.3, 0.0, 0.05, 'stone', stones=9, key=0.08)
    p.box(-w / 2 - 0.25, 0.0, -D, w / 2 + 0.25, 0.1, 0.32, 'stone', (0.9, 0.9, 0.88))
    return p


@piece
def door_panel():
    """Panelled double door (opening 1.2 × 2.4) with a fanlight, a stone surround and a step."""
    p = Piece('door_panel')
    w, h, fan = 1.2, 2.4, 0.42
    z = -D + 0.03
    hd = h - fan
    for s in (-1, 1):
        x0, x1 = (-w / 2, -0.005) if s < 0 else (0.005, w / 2)
        p.box(x0, 0.0, z - 0.02, x1, hd, z + 0.02, 'wood', skip='-z')
        for (y0, y1) in ((0.15, 0.85), (0.98, hd - 0.12)):
            p.box(x0 + 0.08, y0, z + 0.02, x1 - 0.08, y1, z + 0.04, 'wood', (0.88, 0.88, 0.88), skip='-z')
            p.box(x0 + 0.13, y0 + 0.05, z + 0.04, x1 - 0.13, y1 - 0.05, z + 0.05, 'wood', skip='-z')
    p.box(0.2, 1.0, z + 0.05, 0.24, 1.06, z + 0.09, 'zinc')
    p.box(-w / 2, hd, z - 0.02, w / 2, hd + 0.06, z + 0.04, 'wood', skip='-z')
    p.quad_z(-w / 2, hd + 0.06, w / 2, h, z, 'glass')
    p.quad_z(-w / 2, hd + 0.06, w / 2, h, z - 0.05, 'dark')
    # fanlight grille: a half sun
    for k in range(7):
        a = math.pi * (k + 0.5) / 7
        p.tube([(0, hd + 0.06, z + 0.02), (0.55 * math.cos(a), hd + 0.06 + 0.34 * math.sin(a), z + 0.02)], 0.008, 'iron', sides=4)
    # surround: jambs, lintel with a small cornice
    sw = 0.2
    for s in (-1, 1):
        xa, xb = (w / 2, w / 2 + sw) if s > 0 else (-w / 2 - sw, -w / 2)
        p.box(xa, 0.0, 0.0, xb, h, 0.04, 'stone')
        p.box(xa - (0.02 if s < 0 else 0), 0.0, 0.0, xb + (0.02 if s > 0 else 0), 0.25, 0.06, 'stone', (0.92, 0.92, 0.9))
    p.box(-w / 2 - sw, h, 0.0, w / 2 + sw, h + 0.22, 0.045, 'stone')
    p.prism_x([(h + 0.22, 0.0), (h + 0.22, 0.07), (h + 0.27, 0.11), (h + 0.31, 0.11), (h + 0.31, 0.0)], -w / 2 - sw - 0.06, w / 2 + sw + 0.06, 'stone')
    p.box(-w / 2 - 0.2, 0.0, -D, w / 2 + 0.2, 0.09, 0.3, 'stone', (0.9, 0.9, 0.88))
    return p


@piece
def door_garage():
    """Workshop roller shutter (opening 2.8 × 2.6), tinted metal, with the shutter box and a lock."""
    p = Piece('door_garage')
    w, h = 2.8, 2.6
    z = -D + 0.05
    n = 34
    for k in range(n):
        y0 = 0.05 + (h - 0.4) * k / n
        y1 = 0.05 + (h - 0.4) * (k + 1) / n
        ym = (y0 + y1) / 2
        p.face([(-w / 2 + 0.06, y0, z), (w / 2 - 0.06, y0, z), (w / 2 - 0.06, ym, z + 0.012), (-w / 2 + 0.06, ym, z + 0.012)], 'metal', (0.86, 0.86, 0.86))
        p.face([(-w / 2 + 0.06, ym, z + 0.012), (w / 2 - 0.06, ym, z + 0.012), (w / 2 - 0.06, y1, z), (-w / 2 + 0.06, y1, z)], 'metal', (1, 1, 1))
    p.box(-w / 2 + 0.06, 0.0, z - 0.01, w / 2 - 0.06, 0.06, z + 0.04, 'metal', (0.7, 0.7, 0.7))
    for s in (-1, 1):
        p.box(s * (w / 2 - 0.03) - 0.03, 0.0, z - 0.02, s * (w / 2 - 0.03) + 0.03, h - 0.35, z + 0.05, 'zinc')
    p.box(-w / 2, h - 0.36, z - 0.02, w / 2, h, z + 0.12, 'metal', (0.75, 0.75, 0.75))
    p.box(-0.08, 0.02, z + 0.03, 0.08, 0.14, z + 0.06, 'zinc')
    p.box(-w / 2 - 0.12, h, 0.0, w / 2 + 0.12, h + 0.22, 0.035, 'concrete')
    p.box(-w / 2 - 0.15, 0.0, -D, w / 2 + 0.15, 0.05, 0.25, 'concrete', (0.85, 0.85, 0.85))
    return p


@piece
def shopfront():
    """Shop window and door (opening 2.6 × 2.6): tinted wooden frame, glazed door, display with shelves
    and goods behind the glass, tiled plinth."""
    p = Piece('shopfront')
    w, h = 2.6, 2.6
    z = -D + 0.03
    dw = 0.9
    xd = w / 2 - dw            # door from xd to w/2
    t = 0.08
    # frame
    for x in (-w / 2, xd - t / 2, w / 2 - t):
        p.box(x, 0.0, z - 0.02, x + t, h, z + 0.05, 'wood', skip='-z')
    p.box(-w / 2, h - 0.42, z - 0.02, w / 2, h - 0.34, z + 0.05, 'wood', skip='-z')
    p.box(-w / 2, 0.55, z - 0.02, xd, 0.62, z + 0.06, 'wood', skip='-z')
    # tiled plinth under the display
    p.quad_z(-w / 2 + t, 0.0, xd - t / 2, 0.55, z + 0.03, 'azulejo')
    # display glass and the inside: back wall, shelves, goods
    p.quad_z(-w / 2 + t, 0.62, xd - t / 2, h - 0.42, z + 0.01, 'glass')
    p.quad_z(-w / 2, 0.0, w / 2, h, z - 0.55, 'dark')
    rnd = random.Random(5)
    for sy in (0.95, 1.4, 1.85):
        p.box(-w / 2 + t, sy - 0.03, z - 0.45, xd - t / 2, sy, z - 0.08, 'woodraw')
        x = -w / 2 + t + 0.05
        while x < xd - 0.15:
            ww = rnd.uniform(0.08, 0.16)
            hh = rnd.uniform(0.12, 0.3)
            c = hexc(rnd.choice([0xc8452f, 0xe0b040, 0x3f7f5a, 0xf0e6d0, 0x3a5f9a, 0xb06a30]))
            p.box(x, sy, z - 0.3, x + ww, sy + hh, z - 0.16, 'clothv', c, skip='-z')
            x += ww + rnd.uniform(0.02, 0.06)
    # door: glazed with a kick plate
    p.box(xd + t / 2, 0.0, z - 0.04, w / 2 - t, 0.5, z + 0.0, 'wood', (0.85, 0.85, 0.85), skip='-z')
    p.quad_z(xd + t / 2, 0.5, w / 2 - t, h - 0.42, z - 0.02, 'glass')
    p.box(xd + t / 2 + 0.06, 1.05, z + 0.0, xd + t / 2 + 0.09, 1.25, z + 0.04, 'zinc')
    p.quad_z(-w / 2 + t, h - 0.34, w / 2 - t, h, z + 0.01, 'glass')
    p.box(-w / 2 - 0.1, 0.0, -D, w / 2 + 0.1, 0.07, 0.2, 'stone', (0.9, 0.9, 0.88))
    return p


def surround(p, w, h, band, mat, z1, ears=True, cornice=True, bottom=True):
    """A frame around an opening on the wall face (z 0..z1)."""
    p.box(-w / 2 - band, 0.0 if not bottom else -band * 0.3, 0.0, -w / 2, h, z1, mat)
    p.box(w / 2, 0.0 if not bottom else -band * 0.3, 0.0, w / 2 + band, h, z1, mat)
    p.box(-w / 2 - band, h, 0.0, w / 2 + band, h + band, z1, mat)
    if ears:
        for s in (-1, 1):
            xa = s * (w / 2 + band)
            p.box(min(xa, xa + s * 0.07), h + band - 0.12, 0.0, max(xa, xa + s * 0.07), h + band, z1, mat)
    if cornice:
        p.prism_x([(h + band, 0.0), (h + band, z1 + 0.03), (h + band + 0.05, z1 + 0.07), (h + band + 0.09, z1 + 0.07), (h + band + 0.09, 0.0)],
                  -w / 2 - band - 0.1, w / 2 + band + 0.1, mat)


@piece
def rec_stone():
    p = Piece('rec_stone')
    surround(p, 1.0, 1.4, 0.15, 'stone', 0.035)
    return p


@piece
def rec_stone_tall():
    p = Piece('rec_stone_tall')
    surround(p, 1.0, 2.2, 0.15, 'stone', 0.035)
    return p


@piece
def rec_band():
    """Painted band around a window (flush, tinted: ochre / blue / grey on whitewash)."""
    p = Piece('rec_band')
    surround(p, 1.0, 1.4, 0.17, 'stucco', 0.006, ears=False, cornice=False, bottom=False)
    p.box(-0.67, -0.25, 0.0, 0.67, 0.0, 0.006, 'stucco')
    return p


@piece
def rec_band_tall():
    p = Piece('rec_band_tall')
    surround(p, 1.0, 2.2, 0.17, 'stucco', 0.006, ears=False, cornice=False, bottom=False)
    return p


def railing(p, x0, x1, z0, z1, y0=0.0, h=1.0, scrolls=True):
    """Wrought iron: bottom and top rails, square balusters, a band of rings under the handrail; front
    along x at z1 and the two sides from z0 to z1 (no hidden faces: bars have no ends)."""
    p.box(x0, y0 + h - 0.05, z1 - 0.03, x1, y0 + h, z1 + 0.01, 'iron', skip='-x+x')
    p.box(x0, y0 + 0.04, z1 - 0.02, x1, y0 + 0.07, z1 + 0.0, 'iron', skip='-x+x-y')
    n = max(2, int((x1 - x0) / 0.12))
    for k in range(n + 1):
        x = x0 + 0.01 + (x1 - x0 - 0.02) * k / n
        p.box(x - 0.008, y0 + 0.07, z1 - 0.018, x + 0.008, y0 + h - 0.05, z1 - 0.002, 'iron', skip='-y+y')
    if scrolls:
        x = x0 + 0.16
        while x < x1 - 0.12:
            cy = y0 + h - 0.16
            ring = [(x + 0.05 * math.cos(a), cy + 0.05 * math.sin(a), z1 - 0.01) for a in [i * 2 * math.pi / 6 for i in range(7)]]
            p.tube(ring, 0.006, 'iron', sides=3)
            x += 0.33
    for xs in (x0, x1):
        p.box(xs - 0.012, y0 + h - 0.05, z0, xs + 0.012, y0 + h, z1, 'iron', skip='-z+z')
        p.box(xs - 0.01, y0 + 0.04, z0, xs + 0.01, y0 + 0.07, z1, 'iron', skip='-z+z-y')
        for k in range(1, 4):
            z = z0 + (z1 - z0) * k / 4
            p.box(xs - 0.008, y0 + 0.07, z - 0.008, xs + 0.008, y0 + h - 0.05, z + 0.008, 'iron', skip='-y+y')


def _balcony(name, w):
    p = Piece(name)
    d = 0.52
    # slab with a moulded edge
    p.prism_x([(-0.13, 0.0), (-0.13, d - 0.04), (-0.09, d), (-0.02, d), (0.0, d - 0.02), (0.0, 0.0)], -w / 2, w / 2, 'stone')
    # corbels
    for xs in ([-w / 2 + 0.18, w / 2 - 0.18] if w < 2.5 else [-w / 2 + 0.2, 0.0, w / 2 - 0.2]):
        prof = [(-0.13, 0.0), (-0.13, d - 0.08)] + [(-0.13 - 0.3 * (1 - math.cos(a)) , (d - 0.08) * math.cos(a) ** 0.6) for a in [i * (math.pi / 2) / 6 for i in range(1, 7)]] + [(-0.5, 0.0)]
        prof = [(y, z) for (y, z) in prof]
        p.prism_x(list(reversed(prof)), xs - 0.07, xs + 0.07, 'stone')
    railing(p, -w / 2 + 0.03, w / 2 - 0.03, 0.02, d - 0.05)
    return p


PIECES['balcony'] = lambda: _balcony('balcony', 1.7)
PIECES['balcony_long'] = lambda: _balcony('balcony_long', 3.4)


@piece
def awning():
    """Striped cloth awning (2.6 wide, 1.0 out, falling 0.45) with a scalloped valance and iron arms;
    origin: top centre on the wall. 'cloth' is tinted per instance, 'clothw' stays white."""
    p = Piece('awning')
    w, out, drop = 2.6, 1.0, 0.45
    n = 13
    segs = 3
    for k in range(n):
        x0 = -w / 2 + w * k / n
        x1 = x0 + w / n
        m = 'cloth' if k % 2 == 0 else 'clothw'
        for s in range(segs):
            t0, t1 = s / segs, (s + 1) / segs
            sag = lambda t: -0.05 * math.sin(math.pi * t)
            pa = (x0, -drop * t0 + sag(t0), out * t0)
            pb = (x1, -drop * t0 + sag(t0), out * t0)
            pc = (x1, -drop * t1 + sag(t1), out * t1)
            pd = (x0, -drop * t1 + sag(t1), out * t1)
            p.face([pa, pd, pc, pb], m)
            p.face([pa, pb, pc, pd], m, (0.75, 0.75, 0.75))           # underside (darker)
        # valance: scalloped strip
        y = -drop
        pts = [(x0, y, out + 0.005), (x1, y, out + 0.005), (x1, y - 0.16, out + 0.005), ((x0 + x1) / 2, y - 0.22, out + 0.005), (x0, y - 0.16, out + 0.005)]
        p.face(pts, m)
        p.face(list(reversed(pts)), m, (0.75, 0.75, 0.75))
    p.box(-w / 2, -0.06, 0.0, w / 2, 0.04, 0.12, 'metal', (0.4, 0.4, 0.4))
    p.box(-w / 2, -drop - 0.03, out - 0.03, w / 2, -drop + 0.01, out + 0.01, 'iron')
    for s in (-1, 1):
        p.tube([(s * (w / 2 - 0.1), -0.78, 0.02), (s * (w / 2 - 0.1), -drop - 0.01, out - 0.02)], 0.018, 'iron', sides=4)
    return p


@piece
def eave():
    """Tile eave (alero), one metre: two courses of flat tiles stepping out, then the Arab tiles
    (alternating channels and covers) projecting 0.3 m. Origin: wall top (y = 0) — it hangs below."""
    p = Piece('eave')
    w = 1.0
    # mortar band and two stepped courses
    p.box(-w / 2, -0.32, 0.0, w / 2, -0.24, 0.02, 'stucco')
    p.box(-w / 2, -0.24, 0.0, w / 2, -0.2, 0.08, 'terracotta', (0.92, 0.92, 0.92))
    p.box(-w / 2, -0.2, 0.0, w / 2, -0.16, 0.15, 'terracotta', (0.85, 0.85, 0.85))
    # tiles: cross-section wave, sloping down outwards
    k = 6
    pts_top = []
    for i in range(k * 4 + 1):
        x = -w / 2 + w * i / (k * 4)
        ph = (i % 4) / 4
        cover = (i // 4) % 2 == 1
        bump = math.sin(math.pi * ph)
        y = (0.055 * bump) if cover else (-0.035 * bump)
        pts_top.append((x, y))
    z0, z1 = -0.05, 0.3
    ya, yb = -0.12, -0.2
    for i in range(len(pts_top) - 1):
        (xa, ua), (xb, ub) = pts_top[i], pts_top[i + 1]
        cova = ((i // 4) % 2 == 1)
        c = (1, 1, 1) if cova else (0.86, 0.86, 0.86)
        p.face([(xa, ya + ua, z0), (xa, yb + ua, z1), (xb, yb + ub, z1), (xb, ya + ub, z0)][::-1], 'tile', c)
        # underside (seen from the street)
        p.face([(xa, ya + ua - 0.025, z0), (xa, yb + ua - 0.025, z1), (xb, yb + ub - 0.025, z1), (xb, ya + ub - 0.025, z0)], 'tile', (0.62, 0.62, 0.62))
    # the tile ends (front)
    for i in range(len(pts_top) - 1):
        (xa, ua), (xb, ub) = pts_top[i], pts_top[i + 1]
        p.face([(xa, yb + ua - 0.025, z1), (xb, yb + ub - 0.025, z1), (xb, yb + ub, z1), (xa, yb + ua, z1)], 'tile', (0.7, 0.7, 0.7))
    return p


@piece
def cornice():
    """Moulded cornice, one metre (cyma and fillet), origin at the wall top; hangs below it."""
    p = Piece('cornice')
    prof = [(-0.36, 0.0), (-0.36, 0.03), (-0.32, 0.03), (-0.3, 0.06), (-0.24, 0.07), (-0.2, 0.12), (-0.16, 0.18), (-0.12, 0.21), (-0.1, 0.22), (0.0, 0.22), (0.0, 0.0)]
    p.prism_x(list(reversed(prof)), -0.5, 0.5, 'stone', caps=False)
    return p


@piece
def pipe():
    """Downpipe, one metre (origin at the bottom, 0.1 m off the wall), with a wall clip."""
    p = Piece('pipe')
    p.cyl_y(0, 0.09, 0.0, 1.0, 0.05, 0.05, 8, 'zinc', caps=False)
    p.box(-0.06, 0.45, 0.0, 0.06, 0.5, 0.15, 'iron')
    return p


@piece
def pipe_shoe():
    """Bottom of a downpipe: the kick-out (origin on the ground)."""
    p = Piece('pipe_shoe')
    pts = [(0, 0.5, 0.09), (0, 0.22, 0.09), (0, 0.12, 0.13), (0, 0.06, 0.22)]
    p.tube(pts, 0.05, 'zinc', sides=8, caps=True)
    return p


@piece
def pipe_head():
    """Hopper at the top of a downpipe (origin at the wall top)."""
    p = Piece('pipe_head')
    p.lathe([(0.05, -0.55), (0.05, -0.36), (0.12, -0.24), (0.12, -0.08)], 0, 0.1, 8, 'zinc', close_top=True)
    p.box(-0.05, -0.08, 0.0, 0.05, -0.04, 0.12, 'zinc')
    return p


@piece
def lantern():
    """Wrought wall lantern on a scrolled bracket (origin: the bracket's wall plate)."""
    p = Piece('lantern')
    p.box(-0.07, -0.12, 0.0, 0.07, 0.12, 0.02, 'iron')
    p.tube([(0, 0.0, 0.02), (0, 0.02, 0.2), (0, 0.0, 0.4), (0, -0.04, 0.46)], 0.016, 'iron', sides=4)
    sc = [(0, -0.12 + 0.07 * math.sin(a), 0.1 + 0.07 * math.cos(a)) for a in [i * math.pi / 5 for i in range(9)]]
    p.tube(sc, 0.01, 'iron', sides=4)
    cz = 0.46
    p.lathe([(0.0, -0.06), (0.03, -0.06), (0.12, -0.12), (0.12, -0.14), (0.0, -0.1)][::-1][::-1], 0, cz, 4, 'iron')
    # glass body (a slightly tapered box), glowing
    p.lathe([(0.09, -0.48), (0.12, -0.16)], 0, cz, 4, 'lamp', close_top=False)
    p.lathe([(0.0, -0.52), (0.1, -0.5), (0.1, -0.48), (0.09, -0.48)], 0, cz, 4, 'iron')
    p.lathe([(0.13, -0.17), (0.13, -0.14), (0.0, -0.02)], 0, cz, 4, 'iron')
    p.blob((0, -0.32, cz), (0.05, 0.08, 0.05), 'lamp', (1, 1, 1), random.Random(1), 0.0, 1)
    return p


GERANIUM_F = [0xd23a4a, 0xe8586e, 0xf2f0ea, 0xc8306a]


def flowers(p, x0, x1, y, z0, z1, rnd, n, flower_cols=GERANIUM_F, size=0.07):
    for k in range(n):
        x = x0 + (x1 - x0) * (k + rnd.uniform(0.1, 0.9)) / n
        z = rnd.uniform(z0, z1)
        p.blob((x, y + rnd.uniform(0.02, 0.07), z), (0.09, 0.07, 0.08), 'leaf', hexc(rnd.choice([0x4f7a2e, 0x5f8a36, 0x3f6a2a])), rnd, 0.3, 1)
        if rnd.random() < 0.85:
            p.blob((x + rnd.uniform(-0.03, 0.03), y + 0.1 + rnd.uniform(0, 0.05), z + 0.02), (size, size * 0.8, size), 'leaf', hexc(rnd.choice(flower_cols)), rnd, 0.35, 0)


@piece
def planter():
    """Window box with geraniums (origin: the sill's top centre)."""
    p = Piece('planter')
    rnd = random.Random(21)
    p.box(-0.42, 0.0, 0.03, 0.42, 0.17, 0.22, 'terracotta')
    for x in (-0.3, 0.3):
        p.box(x - 0.02, -0.1, 0.0, x + 0.02, 0.0, 0.18, 'iron')
    flowers(p, -0.4, 0.4, 0.15, 0.06, 0.2, rnd, 6)
    return p


@piece
def pot_big():
    """Large terracotta pot with a rounded shrub in flower (≤ 0.62 m: never hides a crouching player)."""
    p = Piece('pot_big')
    rnd = random.Random(31)
    p.lathe([(0.0, 0.0), (0.15, 0.0), (0.2, 0.06), (0.25, 0.3), (0.27, 0.34), (0.27, 0.38), (0.24, 0.38)], 0, 0, 12, 'terracotta')
    for k in range(7):
        a = k * 2 * math.pi / 7
        p.blob((0.12 * math.cos(a), 0.46 + rnd.uniform(-0.02, 0.04), 0.12 * math.sin(a)), (0.13, 0.1, 0.13), 'leaf', hexc(rnd.choice([0x4f7a2e, 0x5a8434, 0x3e6a2c])), rnd, 0.3, 1)
    for k in range(6):
        a = rnd.uniform(0, 2 * math.pi)
        p.blob((0.17 * math.cos(a), 0.52 + rnd.uniform(0, 0.05), 0.17 * math.sin(a)), (0.05, 0.04, 0.05), 'leaf', hexc(rnd.choice(GERANIUM_F)), rnd, 0.3, 0)
    return p


@piece
def pot_agave():
    p = Piece('pot_agave')
    rnd = random.Random(33)
    p.lathe([(0.0, 0.0), (0.13, 0.0), (0.2, 0.08), (0.22, 0.28), (0.24, 0.32), (0.21, 0.32)], 0, 0, 12, 'terracotta')
    for k in range(11):
        a = k * 2 * math.pi / 11 + rnd.uniform(-0.15, 0.15)
        l = rnd.uniform(0.22, 0.32)
        up = rnd.uniform(0.15, 0.3)
        base = (0.03 * math.cos(a), 0.3, 0.03 * math.sin(a))
        tip = (l * math.cos(a), 0.3 + up, l * math.sin(a))
        side = (-math.sin(a) * 0.045, 0, math.cos(a) * 0.045)
        mid = ((base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2 + 0.04, (base[2] + tip[2]) / 2)
        c = hexc(rnd.choice([0x7d9a78, 0x6f8f70, 0x8aa486]))
        p.face([(base[0] - side[0], base[1], base[2] - side[2]), (base[0] + side[0], base[1], base[2] + side[2]), (mid[0] + side[0] * 0.8, mid[1], mid[2] + side[2] * 0.8), tip], 'leaf', c)
        p.face([tip, (mid[0] + side[0] * 0.8, mid[1], mid[2] + side[2] * 0.8), (base[0] + side[0], base[1], base[2] + side[2]), (base[0] - side[0], base[1], base[2] - side[2])], 'leaf', tuple(v * 0.8 for v in c))
    return p


@piece
def pot_small():
    p = Piece('pot_small')
    rnd = random.Random(35)
    p.lathe([(0.0, 0.0), (0.09, 0.0), (0.14, 0.2), (0.15, 0.22), (0.13, 0.22)], 0, 0, 10, 'terracotta')
    flowers(p, -0.08, 0.08, 0.2, -0.06, 0.06, rnd, 3)
    return p


@piece
def bench():
    """Tiled stone bench (1.6 × 0.45, 0.48 high) — set against a wall."""
    p = Piece('bench')
    w, d, h = 1.6, 0.45, 0.48
    p.box(-w / 2, h - 0.07, 0.0, w / 2, h, d, 'stone')
    p.prism_x([(h - 0.07, d), (h - 0.07, d + 0.03), (h - 0.03, d + 0.04), (h, d + 0.03), (h, d)], -w / 2, w / 2, 'stone')
    p.box(-w / 2 + 0.04, 0.0, 0.0, w / 2 - 0.04, h - 0.07, d - 0.06, 'stucco', skip='+z')
    p.quad_z(-w / 2 + 0.04, 0.02, w / 2 - 0.04, h - 0.09, d - 0.06, 'azulejo')
    for s in (-1, 1):
        p.box(s * (w / 2 - 0.02) - 0.06, 0.0, 0.0, s * (w / 2 - 0.02) + 0.06, h - 0.07, d - 0.02, 'stone', (0.92, 0.92, 0.9))
    return p


@piece
def bougain():
    """Bougainvillea climbing a facade: a twisted trunk and masses of leaves and magenta bracts,
    flat against the wall (≤ 0.3 m out); origin on the ground at the wall."""
    p = Piece('bougain')
    rnd = random.Random(41)
    trunk = [(0.0, 0.0, 0.08), (0.06, 0.6, 0.1), (-0.04, 1.2, 0.09), (0.05, 1.8, 0.1), (0.0, 2.3, 0.1)]
    p.tube(trunk, lambda t: 0.05 * (1 - t * 0.5), 'woodraw', sides=5)
    for bx in (-0.7, 0.6):
        p.tube([(0.0, 2.2, 0.1), (bx * 0.5, 2.6, 0.1), (bx, 2.9, 0.12)], 0.025, 'woodraw', sides=4)
    for k in range(34):
        x = rnd.uniform(-0.95, 0.95)
        y = rnd.uniform(2.0, 3.6) - abs(x) * 0.4
        z = rnd.uniform(0.08, 0.22)
        r = rnd.uniform(0.16, 0.3)
        mag = rnd.random() < 0.6
        c = hexc(rnd.choice([0xc2287a, 0xd23488, 0xb01e6a, 0xe0509a])) if mag else hexc(rnd.choice([0x3f6a2a, 0x4b7a30, 0x355e26]))
        p.blob((x, y, z), (r, r * 0.8, 0.09), 'leaf', c, rnd, 0.35, 1)
    for k in range(8):   # a few hanging down the trunk
        p.blob((rnd.uniform(-0.25, 0.25), rnd.uniform(1.0, 2.0), 0.12), (0.12, 0.1, 0.07), 'leaf', hexc(rnd.choice([0x3f6a2a, 0xc2287a])), rnd, 0.3, 1)
    return p


@piece
def climber():
    """Jasmine on the wall above a door (green, white flowers), ≤ 0.2 m out; origin at its bottom centre."""
    p = Piece('climber')
    rnd = random.Random(43)
    for k in range(26):
        x = rnd.uniform(-1.1, 1.1)
        y = rnd.uniform(0.0, 1.1) - abs(x) * 0.3
        p.blob((x, y, 0.08), (rnd.uniform(0.12, 0.22), 0.13, 0.07), 'leaf', hexc(rnd.choice([0x456f2c, 0x557f34, 0x3a6226])), rnd, 0.35, 1)
        if rnd.random() < 0.6:
            p.blob((x + 0.05, y + 0.05, 0.14), (0.04, 0.04, 0.03), 'leaf', hexc(0xf4f1e6), rnd, 0.2, 0)
    return p


@piece
def laundry():
    """Clothes line between two wall brackets (2.6 m), clothes hanging; origin on the wall at the line's
    height (everything is above head height where it is placed)."""
    p = Piece('laundry')
    rnd = random.Random(51)
    for s in (-1, 1):
        p.box(s * 1.3 - 0.015, -0.03, 0.0, s * 1.3 + 0.015, 0.0, 0.55, 'iron')
    line = [(-1.3 + 2.6 * i / 10, -0.08 * math.sin(math.pi * i / 10), 0.5) for i in range(11)]
    p.tube(line, 0.005, 'clothw', sides=3)
    x = -1.15
    cols = [0xf0ede4, 0x3f63a8, 0xd8b23c, 0xc24a3a, 0xe9e4d8, 0x5d8a64, 0xf2c4c8]
    while x < 1.05:
        ww = rnd.uniform(0.25, 0.55)
        hh = rnd.uniform(0.35, 0.7)
        y0 = -0.08 * math.sin(math.pi * (x + 1.3) / 2.6)
        c = hexc(rnd.choice(cols))
        k = rnd.uniform(-0.03, 0.03)
        pts = [(x, y0, 0.5), (x + ww, y0, 0.5), (x + ww, y0 - hh, 0.5 + k), (x, y0 - hh * rnd.uniform(0.9, 1.05), 0.5 + k)]
        p.face(pts, 'clothv', c)
        p.face(list(reversed(pts)), 'clothv', tuple(v * 0.8 for v in c))
        x += ww + rnd.uniform(0.03, 0.1)
    return p


@piece
def ac_unit():
    p = Piece('ac_unit')
    p.box(-0.4, 0.0, 0.0, 0.4, 0.55, 0.3, 'metal', (0.92, 0.92, 0.9))
    p.lathe([(0.2, 0.0), (0.2, 0.01)], 0.12, 0.0, 12, 'dark')  # placeholder ring (replaced below)
    p.faces.pop()
    segs = 14
    for i in range(segs):
        a0, a1 = 2 * math.pi * i / segs, 2 * math.pi * (i + 1) / segs
        p.face([(0.12, 0.28, 0.302), (0.12 + 0.2 * math.cos(a0), 0.28 + 0.2 * math.sin(a0), 0.302), (0.12 + 0.2 * math.cos(a1), 0.28 + 0.2 * math.sin(a1), 0.302)], 'dark')
    for k in range(6):
        y = 0.1 + k * 0.07
        p.box(-0.08, y, 0.3, 0.32, y + 0.012, 0.31, 'metal', (0.7, 0.7, 0.7))
    for s in (-1, 1):
        p.box(s * 0.3 - 0.02, -0.05, 0.0, s * 0.3 + 0.02, 0.0, 0.32, 'iron')
    return p


@piece
def meter_box():
    """Electricity meter cabinet set into the wall (flush, 6 cm out)."""
    p = Piece('meter_box')
    p.box(-0.25, 0.0, 0.0, 0.25, 0.6, 0.05, 'metal', (0.85, 0.85, 0.82))
    p.quad_z(-0.15, 0.3, 0.15, 0.5, 0.051, 'glass')
    p.box(0.18, 0.25, 0.05, 0.21, 0.33, 0.06, 'iron')
    return p


@piece
def plaque():
    """Glazed street-name tile (blue border; the name is suggested, not written)."""
    p = Piece('plaque')
    p.box(-0.3, 0.0, 0.0, 0.3, 0.22, 0.015, 'ceramic', (0.97, 0.96, 0.92))
    b = hexc(0x2c5a9a)
    for (x0, y0, x1, y1) in ((-0.28, 0.02, 0.28, 0.035), (-0.28, 0.185, 0.28, 0.2), (-0.28, 0.02, -0.265, 0.2), (0.265, 0.02, 0.28, 0.2)):
        p.quad_z(x0, y0, x1, y1, 0.016, 'ceramic', b)
    for k, ln in enumerate((0.36, 0.42)):
        p.quad_z(-ln / 2, 0.08 + k * 0.05, ln / 2, 0.1 + k * 0.05, 0.016, 'ceramic', b)
    return p


@piece
def sign():
    """Shop sign board (1.8 × 0.42) with a moulded frame; the face uses UVs 0..1 (the game writes the
    shop's name on it). Origin at its bottom centre on the wall."""
    p = Piece('sign')
    w, h = 1.8, 0.42
    p.box(-w / 2, 0.0, 0.0, w / 2, h, 0.04, 'wood', skip='+z')
    p.quad_z(-w / 2 + 0.04, 0.04, w / 2 - 0.04, h - 0.04, 0.041, 'sign', uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    for (x0, y0, x1, y1) in ((-w / 2, 0.0, w / 2, 0.04), (-w / 2, h - 0.04, w / 2, h), (-w / 2, 0.04, -w / 2 + 0.04, h - 0.04), (w / 2 - 0.04, 0.04, w / 2, h - 0.04)):
        p.box(x0, y0, 0.04, x1, y1, 0.065, 'wood', (0.8, 0.8, 0.8))
    return p


@piece
def fountain():
    """The plaza fountain, drawn inside the boxes the game already has for it: basin walls 6 × 6
    (0.5 thick, 0.8 high), the central pillar (0.9 × 0.9 × 2.4) and its cap (1.6 × 1.6, 2.4–2.6)."""
    p = Piece('fountain')
    rnd = random.Random(61)
    # basin walls: panelled sides, moulded rim, corner posts
    for (cx, cz, lx, lz) in ((0, -2.75, 6.0, 0.5), (0, 2.75, 6.0, 0.5), (-2.75, 0, 0.5, 5.0), (2.75, 0, 0.5, 5.0)):
        x0, x1, z0, z1 = cx - lx / 2, cx + lx / 2, cz - lz / 2, cz + lz / 2
        p.box(x0 + 0.02, 0.0, z0 + 0.02, x1 - 0.02, 0.68, z1 - 0.02, 'stone', (0.94, 0.93, 0.9))
        p.box(x0, 0.68, z0, x1, 0.8, z1, 'stone')
        p.box(x0, 0.0, z0, x1, 0.1, z1, 'stone', (0.82, 0.8, 0.76))
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.box(sx * 2.75 - 0.25, 0.0, sz * 2.75 - 0.25, sx * 2.75 + 0.25, 0.8, sz * 2.75 + 0.25, 'stone', (0.98, 0.97, 0.94))
            p.box(sx * 2.75 - 0.2, 0.8, sz * 2.75 - 0.2, sx * 2.75 + 0.2, 0.8005, sz * 2.75 + 0.2, 'stone', (0.9, 0.89, 0.86), skip='-y-x+x-z+z')
    # tiled inside of the basin
    for (x0, z0, x1, z1, nrm) in ((-2.5, -2.5, 2.5, -2.5, 1), (-2.5, 2.5, 2.5, 2.5, -1)):
        p.face([(x0, 0.0, z0), (x1, 0.0, z0), (x1, 0.68, z0), (x0, 0.68, z0)] if nrm < 0 else [(x1, 0.0, z0), (x0, 0.0, z0), (x0, 0.68, z0), (x1, 0.68, z0)], 'azulejo')
    for (x, nrm) in ((-2.5, 1), (2.5, -1)):
        pts = [(x, 0.0, -2.5), (x, 0.0, 2.5), (x, 0.68, 2.5), (x, 0.68, -2.5)]
        p.face(pts if nrm > 0 else list(reversed(pts)), 'azulejo')
    # central pillar: octagonal shaft on a square base, four spouts, the bowl on the cap
    p.box(-0.45, 0.0, -0.45, 0.45, 0.7, 0.45, 'stone', (0.92, 0.9, 0.86))
    p.lathe([(0.42, 0.7), (0.36, 0.8), (0.3, 0.86), (0.3, 2.1), (0.36, 2.2), (0.42, 2.3), (0.44, 2.4)], 0, 0, 8, 'stone')
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        p.tube([(0.28 * math.cos(a), 1.35, 0.28 * math.sin(a)), (0.52 * math.cos(a), 1.32, 0.52 * math.sin(a)), (0.6 * math.cos(a), 1.22, 0.6 * math.sin(a))], 0.025, 'zinc', sides=5)
        p.lathe([(0.0, 0.0), (0.06, 0.0), (0.05, 0.12)], 0.0, 0.0, 6, 'stone')
        p.faces[-6:] = [(tuple((x + 0.32 * math.cos(a), y + 1.3, z + 0.32 * math.sin(a)) for (x, y, z) in f[0]), f[1], f[2], f[3]) for f in p.faces[-6:]]
    p.lathe([(0.12, 2.4), (0.3, 2.43), (0.62, 2.5), (0.79, 2.56), (0.79, 2.6), (0.7, 2.6), (0.5, 2.55), (0.0, 2.55)], 0, 0, 16, 'stone')
    p.lathe([(0.7, 2.585), (0.0, 2.585)], 0, 0, 16, 'water')
    p.lathe([(0.1, 2.55), (0.07, 2.6), (0.0, 2.62)], 0, 0, 8, 'stone')
    return p


@piece
def lamp_post():
    """Street lamp for the fountain corners: base inside the basin's corner post (it stands on it)."""
    p = Piece('lamp_post')
    p.lathe([(0.12, 0.0), (0.12, 0.08), (0.08, 0.14), (0.05, 0.3), (0.035, 0.32), (0.035, 2.5), (0.05, 2.55), (0.03, 2.62)], 0, 0, 8, 'iron')
    p.tube([(0, 2.6, 0), (0.15, 2.72, 0), (0.32, 2.7, 0), (0.42, 2.62, 0)], 0.018, 'iron', sides=4)
    cx = 0.42
    p.lathe([(0.0, 2.38), (0.08, 2.38), (0.11, 2.6)], cx, 0, 4, 'lamp')
    p.lathe([(0.14, 2.6), (0.14, 2.63), (0.0, 2.74)], cx, 0, 4, 'iron')
    p.lathe([(0.0, 2.34), (0.09, 2.36), (0.09, 2.38)], cx, 0, 4, 'iron')
    return p


@piece
def planter_wall():
    """A stone planter that takes the place of a sandbag wall (one metre long, 0.8 thick, 1.05 high: the
    same box); low lavender and rosemary on top, never more than 12 cm above the box."""
    p = Piece('planter_wall')
    rnd = random.Random(71)
    p.box(-0.5, 0.0, -0.4, 0.5, 0.95, 0.4, 'stone', (0.96, 0.95, 0.92), skip='+y')
    p.box(-0.5, 0.95, -0.4, 0.5, 1.02, -0.3, 'stone')
    p.box(-0.5, 0.95, 0.3, 0.5, 1.02, 0.4, 'stone')
    p.face([(-0.5, 0.97, -0.3), (-0.5, 0.97, 0.3), (0.5, 0.97, 0.3), (0.5, 0.97, -0.3)], 'leaf', hexc(0x6a5038))
    for k in range(5):
        x = -0.42 + 0.21 * k + rnd.uniform(-0.04, 0.04)
        lav = rnd.random() < 0.5
        p.blob((x, 1.02, rnd.uniform(-0.12, 0.12)), (0.14, 0.09, 0.16), 'leaf', hexc(0x6f8a5a if lav else 0x4f6a3a), rnd, 0.3, 1)
        if lav:
            p.blob((x, 1.1, rnd.uniform(-0.08, 0.08)), (0.09, 0.03, 0.1), 'leaf', hexc(0x8a74b8), rnd, 0.3, 0)
    return p


@piece
def orange_tree():
    """A small orange tree for the planters: trunk, round crown 2.3–3.6 m (above every head)."""
    p = Piece('orange_tree')
    rnd = random.Random(81)
    p.tube([(0, 0.9, 0), (0.04, 1.6, 0.02), (-0.02, 2.2, 0.0), (0.0, 2.45, 0.0)], lambda t: 0.07 * (1 - t * 0.4), 'woodraw', sides=6)
    for k in range(18):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0.0, 0.55)
        p.blob((r * math.cos(a), 2.9 + rnd.uniform(-0.3, 0.35), r * math.sin(a)), (0.38, 0.32, 0.38), 'leaf', hexc(rnd.choice([0x355e26, 0x2f5422, 0x40692c])), rnd, 0.3, 1)
    for k in range(16):
        a = rnd.uniform(0, 2 * math.pi)
        p.blob((0.72 * math.cos(a), 2.9 + rnd.uniform(-0.35, 0.3), 0.72 * math.sin(a)), (0.045, 0.045, 0.045), 'leaf', hexc(0xf08a1c), rnd, 0.1, 0)
    return p


@piece
def cypress():
    """Mediterranean cypress (for outside the walls): a tall narrow flame of dark green."""
    p = Piece('cypress')
    rnd = random.Random(91)
    p.cyl_y(0, 0, 0.0, 1.0, 0.18, 0.14, 6, 'woodraw')
    for k in range(14):
        t = k / 13
        y = 0.8 + t * 8.2
        r = 0.95 * math.sin(math.pi * (0.12 + 0.88 * t)) ** 0.7 * (1 - t * 0.55) + 0.12
        p.blob((rnd.uniform(-0.08, 0.08), y, rnd.uniform(-0.08, 0.08)), (r, 0.9, r), 'leaf', hexc(rnd.choice([0x24401e, 0x2a4a22, 0x1f3a1a])), rnd, 0.25, 1)
    return p


@piece
def olive():
    """Olive tree (outside the walls): twisted trunk, silvery crown."""
    p = Piece('olive')
    rnd = random.Random(93)
    p.tube([(0, 0, 0), (0.15, 0.6, 0.05), (-0.05, 1.2, 0.1), (0.1, 1.7, 0.0)], lambda t: 0.22 * (1 - t * 0.5), 'woodraw', sides=6)
    for bx, bz in ((-0.8, 0.3), (0.7, -0.2), (0.1, 0.8)):
        p.tube([(0.1, 1.6, 0.0), (bx * 0.6, 2.2, bz * 0.6), (bx, 2.6, bz)], 0.06, 'woodraw', sides=4)
    for k in range(16):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0.2, 1.3)
        p.blob((r * math.cos(a), 2.7 + rnd.uniform(-0.3, 0.5), r * math.sin(a)), (0.6, 0.38, 0.6), 'leaf', hexc(rnd.choice([0x7b8a62, 0x6f7f58, 0x8a9670])), rnd, 0.35, 1)
    return p


@piece
def palm():
    """Date palm (outside the walls)."""
    p = Piece('palm')
    rnd = random.Random(95)
    pts = [(0.3 * math.sin(t * 1.4) * t, t * 7.5, 0.1 * t) for t in [i / 8 for i in range(9)]]
    p.tube(pts, lambda t: 0.24 * (1 - t * 0.3), 'woodraw', sides=7)
    top = Vector(pts[-1])
    for k in range(14):
        a = k * 2 * math.pi / 14 + rnd.uniform(-0.1, 0.1)
        L = rnd.uniform(2.2, 3.0)
        droop = rnd.uniform(0.6, 1.4)
        d = Vector((math.cos(a), 0, math.sin(a)))
        side = Vector((-math.sin(a), 0, math.cos(a)))
        prev = None
        for s in range(5):
            t = s / 4
            c = top + d * (L * t) + Vector((0, 0.5 * t - droop * t * t, 0))
            w = 0.35 * math.sin(math.pi * min(1, t * 1.1 + 0.05))
            pts2 = (tuple(c - side * w), tuple(c + side * w))
            if prev:
                col = hexc(rnd.choice([0x4d6a30, 0x5a7838, 0x45602a]))
                p.face([prev[0], prev[1], pts2[1], pts2[0]], 'leaf', col)
                p.face([pts2[0], pts2[1], prev[1], prev[0]], 'leaf', tuple(v * 0.75 for v in col))
            prev = pts2
    return p


@piece
def bell_tower():
    """Church bell tower for the skyline (outside the walls): 4 × 4 m, 17 m high, with a belfry and a
    tiled pyramid roof. Origin at the base centre."""
    p = Piece('bell_tower')
    s = 2.0
    p.box(-s, 0.0, -s, s, 12.0, s, 'stucco', skip='-y')
    p.box(-s - 0.12, 0.0, -s - 0.12, s + 0.12, 1.2, s + 0.12, 'stone', skip='-y')
    for y in (8.0, 12.0):
        p.box(-s - 0.15, y, -s - 0.15, s + 0.15, y + 0.25, s + 0.15, 'stone')
    # belfry: four piers and arches on each side
    yb = 12.25
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.box(sx * s - (0.5 if sx > 0 else 0) + (0 if sx > 0 else 0), yb, sz * s - (0.5 if sz > 0 else 0), sx * s + (0.5 if sx < 0 else 0), yb + 2.6, sz * s + (0.5 if sz < 0 else 0), 'stucco')
    for rot in range(4):
        def T(x, y, z, r=rot):
            for _ in range(r):
                x, z = -z, x
            return (x, y, z)
        st = len(p.faces)
        p.arch_fill(3.0, yb + 1.9, 0.6, -0.4, 0.0, 'stucco', segs=8)
        p.box(-1.5, yb + 2.5, -0.4, 1.5, yb + 2.6, 0.0, 'stucco')
        p.quad_z(-1.5, yb, 1.5, yb + 2.5, -1.2, 'dark')
        p.faces[st:] = [(tuple(T(x, y, z + s) for (x, y, z) in f[0]), f[1], f[2], f[3]) for f in p.faces[st:]]
    p.box(-s - 0.2, yb + 2.6, -s - 0.2, s + 0.2, yb + 2.9, s + 0.2, 'stone')
    # bell
    p.lathe([(0.0, 0.9), (0.15, 0.9), (0.2, 0.7), (0.35, 0.2), (0.4, 0.15)], 0, 0, 10, 'zinc', y0=yb + 1.2)
    # roof
    ap = (0.0, yb + 4.8, 0.0)
    c = [(-s - 0.3, yb + 2.9, -s - 0.3), (s + 0.3, yb + 2.9, -s - 0.3), (s + 0.3, yb + 2.9, s + 0.3), (-s - 0.3, yb + 2.9, s + 0.3)]
    for i in range(4):
        p.face([c[(i + 1) % 4], c[i], ap], 'tile')
    p.tube([(0, yb + 4.8, 0), (0, yb + 5.8, 0)], 0.03, 'iron', sides=4)
    p.tube([(-0.25, yb + 5.5, 0), (0.25, yb + 5.5, 0)], 0.025, 'iron', sides=4)
    return p


@piece
def weeds():
    """A tuft of dry grass and weeds for the foot of walls and kerbs (never above 0.12 m)."""
    p = Piece('weeds')
    rnd = random.Random(101)
    for k in range(11):
        a = rnd.uniform(0, 2 * math.pi)
        r = rnd.uniform(0.02, 0.16)
        bx, bz = r * math.cos(a), r * math.sin(a)
        hgt = rnd.uniform(0.06, 0.12)
        lean = rnd.uniform(-0.05, 0.05)
        side = (math.cos(a + 1.57) * 0.02, math.sin(a + 1.57) * 0.02)
        c = hexc(rnd.choice([0x8a8a4a, 0x7a8240, 0xa09a5a, 0x6f7a3a]))
        pts = [(bx - side[0], 0.0, bz - side[1]), (bx + side[0], 0.0, bz + side[1]), (bx + lean, hgt, bz + lean)]
        p.face(pts, 'leaf', c)
        p.face(pts[::-1], 'leaf', tuple(v * 0.8 for v in c))
    p.blob((0, 0.025, 0), (0.12, 0.03, 0.1), 'leaf', hexc(0x6a7a3c), rnd, 0.3, 1)
    return p


# ----------------------------------------------------------------------------------- low-detail versions
# for the upper floors of the town outside the walls (seen from 10 m and more): same outline, few faces

@piece
def win_lo():
    p = Piece('win_lo')
    w, h = 1.0, 1.4
    z = -D + 0.03
    p.quad_z(-w / 2, 0, w / 2, h, z + 0.02, 'glass')
    for (x0, y0, x1, y1) in ((-w / 2, 0, -w / 2 + 0.07, h), (w / 2 - 0.07, 0, w / 2, h), (-w / 2, h - 0.07, w / 2, h), (-w / 2, 0, w / 2, 0.07), (-0.03, 0, 0.03, h), (-w / 2, 0.85, w / 2, 0.9)):
        p.quad_z(x0, y0, x1, y1, z + 0.05, 'frame')
    p.box(-0.6, -0.07, -D, 0.6, 0.01, 0.06, 'stone', skip='-z')
    return p


@piece
def shutter_lo():
    p = Piece('shutter_lo')
    p.box(-0.25, 0.0, 0.0, 0.25, 1.4, 0.04, 'wood', skip='-z')
    for k in range(9):
        y = 0.12 + k * 0.13
        p.quad_z(-0.2, y, 0.2, y + 0.05, 0.041, 'wood', (0.72, 0.72, 0.72))
    return p


@piece
def shutter_tall_lo():
    p = Piece('shutter_tall_lo')
    p.box(-0.25, 0.0, 0.0, 0.25, 2.2, 0.04, 'wood', skip='-z')
    for k in range(15):
        y = 0.12 + k * 0.13
        p.quad_z(-0.2, y, 0.2, y + 0.05, 0.041, 'wood', (0.72, 0.72, 0.72))
    return p


@piece
def win_tall_lo():
    p = Piece('win_tall_lo')
    w, h = 1.0, 2.2
    z = -D + 0.03
    p.quad_z(-w / 2, 0, w / 2, h, z + 0.02, 'glass')
    for (x0, y0, x1, y1) in ((-w / 2, 0, -w / 2 + 0.07, h), (w / 2 - 0.07, 0, w / 2, h), (-w / 2, h - 0.07, w / 2, h), (-w / 2, 0, w / 2, 0.5), (-0.03, 0, 0.03, h)):
        p.quad_z(x0, y0, x1, y1, z + 0.05, 'frame')
    return p


@piece
def balcony_lo():
    p = Piece('balcony_lo')
    w, d = 1.7, 0.52
    p.box(-w / 2, -0.13, 0.0, w / 2, 0.0, d, 'stone', skip='-z')
    p.box(-w / 2 + 0.03, 0.95, d - 0.08, w / 2 - 0.03, 1.0, d - 0.03, 'iron', skip='-x+x')
    for k in range(8):
        x = -w / 2 + 0.05 + (w - 0.1) * k / 7
        p.quad_z(x - 0.012, 0.0, x + 0.012, 0.95, d - 0.05, 'iron')
    for xs in (-w / 2 + 0.03, w / 2 - 0.03):
        p.box(xs - 0.01, 0.95, 0.0, xs + 0.01, 1.0, d - 0.05, 'iron', skip='-z+z')
    return p


@piece
def eave_lo():
    p = Piece('eave_lo')
    w = 1.0
    p.box(-w / 2, -0.32, 0.0, w / 2, -0.2, 0.08, 'terracotta', (0.9, 0.9, 0.9), skip='-x+x-z')
    for k in range(6):
        x0 = -w / 2 + k / 6
        c = (1, 1, 1) if k % 2 else (0.7, 0.7, 0.7)
        p.face([(x0, -0.12, -0.05), (x0 + 1 / 6, -0.12, -0.05), (x0 + 1 / 6, -0.2, 0.3), (x0, -0.2, 0.3)][::-1], 'tile', c)
        p.face([(x0, -0.23, 0.3), (x0 + 1 / 6, -0.23, 0.3), (x0 + 1 / 6, -0.2, 0.3), (x0, -0.2, 0.3)], 'tile', (0.6, 0.6, 0.6))
        p.face([(x0, -0.15, -0.05), (x0 + 1 / 6, -0.15, -0.05), (x0 + 1 / 6, -0.23, 0.3), (x0, -0.23, 0.3)], 'tile', (0.55, 0.55, 0.55))
    return p


@piece
def street_pole():
    """Street lighting pole taking the place of a telegraph pole (same 8 m cylinder, r 0.12): a slim
    iron post, a lantern on a curved arm at 5 m (over the street), insulators and cables at the top."""
    p = Piece('street_pole')
    p.lathe([(0.12, 0.0), (0.12, 0.35), (0.09, 0.45), (0.07, 0.6), (0.06, 7.6), (0.07, 7.7), (0.04, 8.0)], 0, 0, 8, 'iron')
    p.tube([(0, 5.6, 0), (0.25, 5.9, 0), (0.7, 5.95, 0), (1.05, 5.8, 0)], 0.03, 'iron', sides=4)
    sc = [(0.15 + 0.1 * math.cos(a), 5.5 + 0.1 * math.sin(a), 0) for a in [i * math.pi / 4 for i in range(9)]]
    p.tube(sc, 0.012, 'iron', sides=3)
    cx = 1.05
    p.lathe([(0.0, 5.25), (0.1, 5.25), (0.14, 5.62)], cx, 0, 4, 'lamp')
    p.lathe([(0.18, 5.62), (0.18, 5.66), (0.0, 5.8)], cx, 0, 4, 'iron')
    p.lathe([(0.0, 5.2), (0.11, 5.23), (0.11, 5.25)], cx, 0, 4, 'iron')
    p.box(-0.55, 7.4, -0.04, 0.55, 7.5, 0.04, 'iron', skip='-x+x')
    for x in (-0.45, -0.15, 0.15, 0.45):
        p.cyl_y(x, 0, 7.5, 7.62, 0.035, 0.03, 6, 'ceramic')
    return p


# =====================================================================================================

def tri_count(o):
    return sum(len(pl.vertices) - 2 for pl in o.data.polygons)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    stats = {}
    objs = []
    for name, fn in PIECES.items():
        if ONLY and name not in ONLY:
            continue
        p = fn()
        o = p.build()
        o.name = name
        o.data.name = name
        objs.append(o)
        stats[name] = {'tris': tri_count(o), 'mats': [m.name for m in o.data.materials]}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_apply=True, export_yup=True,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                              export_extras=False, export_cameras=False, export_lights=False, export_animations=False)
    (ROOT / 'tools' / 'blender' / 'kit-stats.json').write_text(json.dumps({'reveal': REVEAL, 'pieces': stats}, indent=1))
    tot = sum(s['tris'] for s in stats.values())
    print('KIT', OUT, len(stats), 'pieces', tot, 'tris', round(OUT.stat().st_size / 1024), 'KB')
    for k, v in stats.items():
        print('  %-14s %6d  %s' % (k, v['tris'], ','.join(v['mats'])))


if __name__ == '__main__':
    main()
