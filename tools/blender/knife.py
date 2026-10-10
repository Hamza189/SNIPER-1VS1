"""NAVAJA TÁCTICA (fictional fixed-blade combat knife). Original design, built from code.

Game frame (knife-local): the blade points to -z from the guard at z = 0, spine up (+y), edge
down; the handle runs to +z. Same layout as the game's previous knife, so poses still fit.
"""
import math
from mathutils import Vector, Matrix
from common import *
from rifle import G, side_prism, zcyl, gbox

def materials():
    return dict(
        blade=mat('K_blade', (0.08, 0.085, 0.09), 0.85, 0.32),
        edge=mat('K_edge', (0.6, 0.62, 0.65), 1.0, 0.16),
        steel=mat('K_steel', (0.05, 0.05, 0.055), 0.8, 0.4),
        g10=mat('K_g10', (0.09, 0.1, 0.07), 0.0, 0.7),
        screw=mat('K_screw', (0.4, 0.4, 0.42), 1.0, 0.3),
        accent=mat('P_accent', (0.85, 0.30, 0.06), 0.0, 0.5),
    )

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def blade_profile(z):
    """Spine and edge heights at game z (0 = guard, -0.176 = tip)."""
    u = -z / 0.176
    spine = 0.0145 - 0.0105 * smoothstep(0.6, 1.0, u) ** 0.8
    edge = -0.0135 + 0.0165 * smoothstep(0.55, 1.0, u) ** 1.35
    return spine, edge

def build(root):
    M = materials()
    parts = []
    # ---- blade: lofted cross-sections (flat sides, a primary grind down to a thin edge)
    rings_b, rings_e = [], []
    N = 28
    for k in range(N + 1):
        z = -0.002 - 0.174 * (k / N) ** 0.9
        sp, ed = blade_profile(z)
        u = k / N
        hw = 0.0021 * (1 - 0.75 * u ** 3)
        gy = ed + 0.5 * (sp - ed)
        sec = [(hw, sp), (hw, gy), (0.00035, ed + 0.0006), (-0.00035, ed + 0.0006), (-hw, gy), (-hw, sp)]
        rings_b.append([G(x, y, z) for (x, y) in sec])
    tip = G(0, blade_profile(-0.177)[0] * 0.5 + blade_profile(-0.177)[1] * 0.5, -0.1775)
    blade = loft('blade', rings_b, M['blade'], cap=True)
    # close the tip: pull the last ring onto one point
    import bmesh
    bm = bmesh.new(); bm.from_mesh(blade.data)
    bm.verts.ensure_lookup_table()
    last = [v for v in bm.verts if v.co.y > 0.1755]
    for v in last:
        v.co = Vector(tip)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(blade.data); bm.free()
    # fuller (groove) on both sides and jimping on the spine
    for sx in (-1, 1):
        boolean(blade, gbox('c', (0.0016, 0.0035, 0.07), (sx * 0.0021, 0.0075, -0.055)))
    for i in range(9):
        boolean(blade, gbox('c', (0.01, 0.0016, 0.0012), (0, 0.0148, -0.012 - i * 0.0026)))
    finish(blade, 0.0002, 1, 50)
    parts.append(blade)
    # honed edge strip (bright) along the lower edge
    ering = []
    for k in range(N + 1):
        z = -0.002 - 0.172 * (k / N) ** 0.9
        sp, ed = blade_profile(z)
        ering.append([G(0.0007, ed + 0.0023, z), G(0.0004, ed + 0.0004, z), G(-0.0004, ed + 0.0004, z), G(-0.0007, ed + 0.0023, z)])
    edge = loft('edge', ering, M['edge'])
    parts.append(edge)
    # ---- guard, tang, scales, screws, pommel
    guard = side_prism('guard', [(0.0, 0.021), (0.0065, 0.021), (0.0065, -0.024), (0.0, -0.026), (-0.003, -0.022), (-0.003, 0.018)], -0.0075, 0.0075, M['steel'])
    finish(guard, 0.0012, 2, 30)
    parts.append(guard)
    hp = [(0.0065, 0.0125), (0.06, 0.0135), (0.1, 0.011), (0.112, 0.008), (0.115, -0.006), (0.108, -0.014), (0.085, -0.0155),
          (0.062, -0.012), (0.045, -0.0155), (0.028, -0.0175), (0.016, -0.0145), (0.0065, -0.017)]
    tang = side_prism('tang', hp, -0.002, 0.002, M['steel'])
    finish(tang, 0.0005, 1, 40)
    parts.append(tang)
    inset = [(z + (0.003 if z < 0.05 else -0.003), y * 0.86) for (z, y) in hp]
    for sx in (-1, 1):
        sc = side_prism('scale', inset, sx * 0.0019, sx * 0.0115 if sx > 0 else -0.0115, M['g10'])
        if sx < 0:
            sc = side_prism('scale', inset, -0.0115, -0.0019, M['g10'])
        for p in sc.data.polygons:
            p.use_smooth = True
        bevel(sc, 0.0042, 4, 30, harden=False)
        apply_mods(sc)
        smooth(sc, 70)
        uv_box(sc, 50.0)
        parts.append(sc)
        for z in (0.03, 0.085):
            parts.append(cyl('screw', 0.0028, 0.0028, 0.0012, G(sx * 0.0115, -0.001, z), axis='X', segs=14, material=M['screw']))
    pom = side_prism('pommel', [(0.112, 0.006), (0.128, 0.004), (0.13, -0.004), (0.112, -0.008)], -0.002, 0.002, M['steel'])
    boolean(pom, cyl('c', 0.003, 0.003, 0.02, G(0, -0.001, 0.122), axis='X', segs=14))
    finish(pom, 0.0006, 1, 40)
    parts.append(pom)
    knife = join(parts, 'k_knife')
    knife.parent = root
    return {'knife': knife}
