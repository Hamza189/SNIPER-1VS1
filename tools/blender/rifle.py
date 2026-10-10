"""HALCÓN R7 (fictional bolt-action precision rifle on an aluminium chassis). Original design,
built from code.

Coordinates: written in the GAME frame (x right, y up, -z forward) through G(), which converts
to Blender's (x, -z, y). Same layout the game already uses for the rifle: bore at y 0.004,
muzzle at z -0.77, scope axis at y 0.068, bolt pivot at (0.024, 0.012, 0.08).
Moving parts: bolt (pivot = origin), mag (origin = its seated position). Sockets: muzzle, eject.
"""
import math
from mathutils import Vector, Matrix, Euler
from common import *

def G(x, y, z):
    return (x, -z, y)

SCOPE_Y = 0.068
BORE_Y = 0.004
BOLT_PIVOT = (0.024, 0.012, 0.08)

def materials():
    return dict(
        chassis=mat('R_chassis', (0.36, 0.30, 0.20), 0.15, 0.55),
        black=mat('R_black', (0.03, 0.032, 0.035), 0.6, 0.42),
        barrel=mat('R_barrel', (0.05, 0.05, 0.055), 0.85, 0.35),
        steel=mat('R_steel', (0.45, 0.46, 0.48), 1.0, 0.28),
        rubber=mat('R_rubber', (0.02, 0.02, 0.02), 0.0, 0.9),
        scope=mat('R_scope', (0.035, 0.037, 0.04), 0.5, 0.38),
        lens=mat('R_lens', (0.05, 0.12, 0.18), 0.6, 0.05),
        accent=mat('R_accent', (0.85, 0.30, 0.06), 0.0, 0.5),
        brass=mat('P_brass', (0.78, 0.56, 0.24), 1.0, 0.25),
    )

def zcyl(name, r1, r2, z0, z1, x=0.0, y=0.0, segs=24, material=None):
    """Cylinder along the game's z axis from z0 to z1 (r1 at z0, r2 at z1)."""
    zc = (z0 + z1) / 2
    L = abs(z1 - z0)
    # Blender Y = -z: the -Y end is the larger game z
    lo, hi = (r2, r1) if z1 < z0 else (r1, r2)
    # cyl(): r1 at the negative Blender-Y end = the larger game z end
    rneg = r1 if z0 > z1 else r2
    rpos = r2 if z0 > z1 else r1
    return cyl(name, rneg, rpos, L, G(x, y, zc), axis='Y', segs=segs, material=material)

def gbox(name, size, center, material=None, rot=(0, 0, 0)):
    """Box with size (sx, sy, sz) in game axes, centred at a game point. rot: game Euler (rx, ry, rz)."""
    sx, sy, sz = size
    R = Euler((rot[0], -rot[2], rot[1]))
    return box(name, (sx, sz, sy), G(*center), material, rot=tuple(R))

def side_prism(name, pts, x0, x1, material=None):
    """Side profile given as game (z, y) points, extruded across x."""
    return prism_yz(name, [(-z, y) for (z, y) in pts], x0, x1, material)

def build(root):
    M = materials()
    parts = {}
    static = []
    # ------------------------------------------------------------- barrel: fluted, with a brake
    brl = zcyl('barrel', 0.0135, 0.0105, -0.12, -0.705, y=BORE_Y, segs=28, material=M['barrel'])
    for i in range(6):
        a = i * math.pi / 3
        c = gbox('c', (0.006, 0.006, 0.36), (math.cos(a) * 0.0128, BORE_Y + math.sin(a) * 0.0128, -0.43), rot=(0, 0, a))
        boolean(brl, c)
    finish(brl, 0.0004, 1, 40)
    static.append(brl)
    mb = zcyl('brake', 0.0175, 0.0175, -0.695, -0.775, y=BORE_Y, segs=24, material=M['black'])
    for z in (-0.715, -0.735, -0.755):
        boolean(mb, gbox('c', (0.05, 0.006, 0.010), (0, BORE_Y + 0.009, z)))
    boolean(mb, zcyl('c', 0.0055, 0.0055, -0.7, -0.79, y=BORE_Y, segs=16))
    finish(mb, 0.0006, 1, 40)
    static.append(mb)
    # ------------------------------------------------------------- receiver (round action) + rail
    rec = zcyl('receiver', 0.0175, 0.0175, 0.105, -0.13, y=BORE_Y, segs=28, material=M['black'])
    boolean(rec, gbox('c', (0.03, 0.022, 0.075), (0.018, BORE_Y + 0.012, -0.025)))      # ejection port
    finish(rec, 0.0006, 1, 40)
    static.append(rec)
    rail = gbox('rail', (0.022, 0.012, 0.25), (0, 0.027, -0.015), M['black'])
    for i in range(14):
        boolean(rail, gbox('c', (0.03, 0.006, 0.0075), (0, 0.032, -0.13 + i * 0.0175)))
    finish(rail, 0.0005, 1, 40)
    static.append(rail)
    shroud = zcyl('shroud', 0.0155, 0.012, 0.105, 0.145, y=BORE_Y, segs=24, material=M['black'])
    finish(shroud, 0.0008, 2, 30)
    static.append(shroud)
    # ------------------------------------------------------------- chassis: action bed + handguard
    bed = side_prism('bed', [(0.125, -0.005), (0.125, -0.042), (0.035, -0.046), (-0.075, -0.046), (-0.13, -0.04), (-0.13, -0.004)], -0.024, 0.024, M['chassis'])
    finish(bed, 0.0018, 2, 35)
    static.append(bed)
    oct_pts = []
    for i in range(8):
        a = math.pi / 8 + i * math.pi / 4
        oct_pts.append((math.cos(a) * 0.03, math.sin(a) * 0.032))
    hg = prism_xz('handguard', [(x, y - 0.008) for (x, y) in oct_pts], -(-0.13), -(-0.465), M['chassis'])
    # M-LOK style slots on the sides and the bottom
    for z in (-0.19, -0.25, -0.31, -0.37, -0.43):
        for sx in (-1, 1):
            boolean(hg, gbox('c', (0.02, 0.009, 0.034), (sx * 0.029, -0.008, z)))
        boolean(hg, gbox('c', (0.012, 0.02, 0.034), (0, -0.04, z)))
    boolean(hg, zcyl('c', 0.017, 0.017, -0.12, -0.48, y=BORE_Y, segs=20))
    finish(hg, 0.0012, 2, 30)
    static.append(hg)
    cap = zcyl('hgcap', 0.031, 0.031, -0.462, -0.47, y=-0.008, segs=8, material=M['black'])
    static.append(cap)
    stud = gbox('stud', (0.008, 0.01, 0.012), (0, -0.044, -0.445), M['steel'])
    static.append(stud)
    # ------------------------------------------------------------- grip, trigger guard, trigger
    ga = math.radians(16)
    gtop = Vector((0, -0.042, 0.112))
    gd = Vector((0, -math.cos(ga), math.sin(ga)))
    gf = Vector((0, -math.sin(ga), -math.cos(ga)))
    rings = []
    for k in range(10):
        t = k / 9
        w = 0.029 + 0.003 * math.sin(math.pi * t)
        d = 0.042 + 0.003 * math.sin(math.pi * t)
        ring = []
        for (x, v) in rounded_rect(w, d, 0.011, 4):
            if v > d / 2 - 0.006 and 0.15 < t < 0.85:
                v -= 0.0013 * max(0, math.sin(t * math.pi * 3.2 - 0.4))
            p = gtop + gd * (0.098 * t) + gf * v + Vector((x, 0, 0))
            ring.append(G(*p))
        rings.append(ring)
    grip = loft('grip', rings, mat('R_grip', (0.03, 0.03, 0.03), 0.0, 0.9))
    for p in grip.data.polygons:
        p.use_smooth = True
    uv_box(grip, 40.0)
    static.append(grip)
    guard = side_prism('guard', [(0.098, -0.04), (0.098, -0.072), (0.09, -0.08), (0.02, -0.08), (0.012, -0.072), (0.012, -0.04)], -0.007, 0.007, M['black'])
    boolean(guard, side_prism('c', [(0.09, -0.04), (0.09, -0.071), (0.086, -0.074), (0.024, -0.074), (0.02, -0.071), (0.02, -0.04)], -0.02, 0.02))
    finish(guard, 0.0008, 1, 35)
    static.append(guard)
    trig = side_prism('trigger', [(0.062, -0.044), (0.066, -0.044), (0.064, -0.056), (0.058, -0.066), (0.053, -0.068), (0.053, -0.066), (0.058, -0.06), (0.06, -0.05)], -0.0028, 0.0028, M['steel'])
    finish(trig, 0.0004, 1)
    set_origin(trig, G(0, -0.044, 0.064))
    trig.parent = root
    parts['trigger'] = trig
    # ------------------------------------------------------------- stock: skeleton, cheek riser, pad
    st = side_prism('stock', [(0.125, -0.004), (0.2, 0.012), (0.44, 0.016), (0.452, 0.012), (0.452, -0.105), (0.43, -0.112),
                              (0.36, -0.07), (0.2, -0.05), (0.14, -0.05), (0.125, -0.042)], -0.0165, 0.0165, M['chassis'])
    boolean(st, side_prism('c', [(0.22, 0.0), (0.4, 0.002), (0.415, -0.012), (0.415, -0.07), (0.37, -0.055), (0.23, -0.037)], -0.05, 0.05))
    finish(st, 0.0018, 2, 35)
    static.append(st)
    cheek = side_prism('cheek', [(0.25, 0.026), (0.41, 0.03), (0.415, 0.022), (0.415, 0.014), (0.25, 0.012)], -0.019, 0.019, M['black'])
    finish(cheek, 0.002, 2, 30)
    static.append(cheek)
    for z in (0.29, 0.37):
        static.append(zcyl('post', 0.004, 0.004, z - 0.002, z + 0.002, y=0.018, segs=10, material=M['steel']))
    pad = side_prism('pad', [(0.452, 0.016), (0.476, 0.018), (0.48, 0.0), (0.48, -0.1), (0.476, -0.113), (0.452, -0.108)], -0.02, 0.02, M['rubber'])
    finish(pad, 0.003, 2, 30)
    static.append(pad)
    knob = cyl('cheekknob', 0.007, 0.007, 0.01, G(0.022, 0.02, 0.33), axis='X', segs=16, material=M['steel'])
    static.append(knob)
    # ------------------------------------------------------------- magazine (origin = seated)
    mag = side_prism('mag', [(0.012, -0.044), (0.012, -0.096), (-0.062, -0.096), (-0.066, -0.044)], -0.0155, 0.0155, M['black'])
    finish(mag, 0.0012, 2, 35)
    mb2 = side_prism('magbase', [(0.016, -0.095), (0.016, -0.104), (-0.07, -0.104), (-0.07, -0.095)], -0.018, 0.018, M['black'])
    finish(mb2, 0.002, 2, 30)
    rnd = zcyl('round', 0.0055, 0.0055, 0.008, -0.05, y=-0.04, segs=14, material=M['brass'])
    mag = join([mag, mb2, rnd], 'mag')
    set_origin(mag, G(0, -0.044, -0.027))
    mag.parent = root
    parts['mag'] = mag
    # ------------------------------------------------------------- bolt (origin = pivot)
    px, py, pz = BOLT_PIVOT
    body = zcyl('boltbody', 0.0088, 0.0088, 0.07, -0.06, x=0.0, y=BORE_Y + 0.002, segs=18, material=M['steel'])
    for i in range(3):
        boolean(body, zcyl('c', 0.0095, 0.0095, -0.005 - i * 0.022, -0.012 - i * 0.022, y=BORE_Y + 0.002, segs=18), 'DIFFERENCE')
    stem = cyl('stem', 0.0045, 0.0045, 0.05, (0, 0, 0), axis='X', segs=12, material=M['steel'])
    stem.data.transform(Matrix.Rotation(math.radians(-12), 4, 'Y'))
    stem.data.transform(Matrix.Translation(Vector(G(px + 0.028, py - 0.003, pz))))
    kb = sphere('knob', 0.0115, G(px + 0.06, py - 0.008, pz), M['black'], scale=(1.0, 1.25, 1.0), segs=18)
    bolt = join([body, stem, kb], 'bolt')
    set_origin(bolt, G(px, py, pz))
    bolt.parent = root
    parts['bolt'] = bolt
    # ------------------------------------------------------------- scope
    sy = SCOPE_Y
    tube = zcyl('tube', 0.0175, 0.0175, 0.125, -0.17, y=sy, segs=32, material=M['scope'])
    bell = zcyl('bell', 0.0175, 0.029, -0.17, -0.215, y=sy, segs=32, material=M['scope'])
    objh = zcyl('obj', 0.029, 0.0295, -0.215, -0.275, y=sy, segs=32, material=M['scope'])
    boolean(objh, zcyl('c', 0.0265, 0.0265, -0.265, -0.29, y=sy, segs=32))
    ocu = zcyl('ocular', 0.0175, 0.0225, 0.125, 0.165, y=sy, segs=32, material=M['scope'])
    ring = zcyl('power', 0.0205, 0.0205, 0.13, 0.15, y=sy, segs=32, material=M['scope'])
    for i in range(16):
        a = i * math.pi / 8
        boolean(ring, gbox('c', (0.003, 0.004, 0.03), (math.cos(a) * 0.0205, sy + math.sin(a) * 0.0205, 0.14), rot=(0, 0, a)))
    cup = zcyl('cup', 0.0235, 0.0245, 0.165, 0.205, y=sy, segs=32, material=M['rubber'])
    boolean(cup, zcyl('c', 0.019, 0.019, 0.17, 0.215, y=sy, segs=32))
    for o in (tube, bell, objh, ocu, ring, cup):
        finish(o, 0.0006, 1, 40)
        static.append(o)
    lensF = cyl('lensF', 0.0265, 0.0265, 0.002, G(0, sy, -0.262), axis='Y', segs=32, material=M['lens'])
    lensR = cyl('lensR', 0.019, 0.019, 0.002, G(0, sy, 0.185), axis='Y', segs=32, material=mat('R_eye', (0.01, 0.012, 0.014), 0.2, 0.1))
    static += [lensF, lensR]
    # turrets (elevation on top, windage on the right, parallax on the left) with knurled caps
    def turret(name, axis_vec, h, r, cap_r):
        base = cyl(name, 0.013, 0.013, 0.012, (0, 0, 0), axis='Z', segs=24, material=M['scope'])
        capo = cyl(name + 'c', cap_r, cap_r, h, (0, 0, 0.006 + h / 2), axis='Z', segs=24, material=M['black'])
        for i in range(20):
            a = i * math.pi / 10
            boolean(capo, box('c', (0.0016, 0.0016, h * 1.2), (math.cos(a) * cap_r, math.sin(a) * cap_r, 0.006 + h / 2), rot=(0, 0, a)))
        line = box(name + 'l', (0.0012, 0.003, 0.001), (cap_r - 0.002, 0, 0.006 + h + 0.0004), M['accent'])
        o = join([base, capo, line], name)
        q = Vector((0, 0, 1)).rotation_difference(Vector(axis_vec))
        o.data.transform(q.to_matrix().to_4x4())
        return o
    for (nm, ax, off) in (('elev', (0, 0, 1), (0, 0, 0.0175)), ('wind', (1, 0, 0), (0.0175, 0, 0)), ('para', (-1, 0, 0), (-0.0175, 0, 0))):
        t = turret(nm, ax, 0.016 if nm != 'para' else 0.012, 0.0145 if nm != 'para' else 0.012, 0)
        t.data.transform(Matrix.Translation(Vector(G(0, sy, -0.01)) + Vector(off)))
        finish(t, 0.0004, 1, 50)
        static.append(t)
    # rings onto the rail, with cross bolts
    for z in (-0.085, 0.075):
        rg = zcyl('ring', 0.0215, 0.0215, z + 0.009, z - 0.009, y=sy, segs=28, material=M['black'])
        boolean(rg, zcyl('c', 0.0176, 0.0176, z + 0.02, z - 0.02, y=sy, segs=28))
        bs = gbox('ringbase', (0.026, sy - 0.033, 0.018), (0, (sy + 0.033) / 2 - 0.006, z), M['black'])
        boolean(bs, zcyl('c', 0.0178, 0.0178, z + 0.02, z - 0.02, y=sy, segs=28))
        cb = cyl('crossbolt', 0.004, 0.004, 0.034, G(0, 0.036, z), axis='X', segs=12, material=M['steel'])
        for o in (rg, bs):
            finish(o, 0.0006, 1, 40)
        static += [rg, bs, cb]
    # engraving on the chassis
    t = text_mesh('eng', 'HALCÓN R7', 0.0075, 0.0008, G(0.0242, -0.026, 0.02), (math.pi / 2, 0, math.pi / 2))
    static[static.index(bed)] = bed
    boolean(bed, t)
    acc = gbox('acc', (0.0008, 0.003, 0.11), (0.0305, -0.021, -0.3), M['accent'])
    acc2 = gbox('acc', (0.0008, 0.003, 0.11), (-0.0305, -0.021, -0.3), M['accent'])
    static += [acc, acc2]
    body = join(static, 'rifle')
    body.parent = root
    parts['body'] = body
    # ------------------------------------------------------------- sockets
    empty('r_muzzle', G(0, BORE_Y, -0.78), root)
    empty('r_eject', G(0.03, 0.014, -0.02), root)
    for k, o in parts.items():   # unique names in the file (the pistol has a mag and a trigger too)
        o.name = 'r_' + k
        o.data.name = 'r_' + k
    return parts
