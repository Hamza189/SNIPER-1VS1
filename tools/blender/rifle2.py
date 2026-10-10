"""HALCÓN R7 V2 «PRECISION» — fictional bolt-action precision rifle on a sand-coloured aluminium
chassis. Original design built from code (style of a modern chassis rifle: long slab-sided
handguard with slots and a full-length top rail, flat-sided action, skeleton folding stock with
a cheek riser, black barrel with a brake, premium scope on a one-piece mount).

Same layout the game uses for the rifle (so hands, animations, sockets keep working):
bore y 0.004 · muzzle z -0.78 · scope axis y 0.068 · bolt pivot (0.024, 0.012, 0.08) ·
grip top (0, -0.042, 0.112) · handguard bottom y -0.042 · magazine origin (0, -0.044, -0.027).
"""
import math
from mathutils import Vector, Matrix, Euler
from common import *
from rifle import G, zcyl, gbox, side_prism, materials, SCOPE_Y, BORE_Y, BOLT_PIVOT

def stadium(z0, z1, yc, h, segs=6):
    """Rounded slot outline in the (z, y) plane, from z0 to z1 (z0 > z1), height h."""
    r = h / 2
    pts = []
    for i in range(segs + 1):                    # round end at z1, bottom → far end → top
        a = -math.pi / 2 + math.pi * i / segs
        pts.append((z1 + r - r * math.cos(a), yc + r * math.sin(a)))
    for i in range(segs + 1):                    # round end at z0, top → far end → bottom
        a = math.pi / 2 + math.pi * i / segs
        pts.append((z0 - r - r * math.cos(a), yc + r * math.sin(a)))
    return pts

def slot_cut(target, z0, z1, yc, h, x0, x1):
    c = side_prism('c', stadium(z0, z1, yc, h), x0, x1)
    boolean(target, c)

def rail(name, z0, z1, y0, M, step=0.016):
    """Picatinny-style rail from z0 to z1 (z0 > z1), base at y0."""
    r = side_prism(name, [(z0, y0), (z0, y0 + 0.0045), (z0 - 0.002, y0 + 0.0075), (z1 + 0.002, y0 + 0.0075), (z1, y0 + 0.0045), (z1, y0)], -0.0105, 0.0105, M['black'])
    n = int((z0 - z1) / step)
    for i in range(1, n):
        z = z0 - i * step
        boolean(r, gbox('c', (0.03, 0.004, 0.0052), (0, y0 + 0.0075, z)))
    smooth(r, 30)
    return r

def build(root):
    M = materials()
    M['grip'] = mat('R_grip', (0.03, 0.03, 0.03), 0.0, 0.9)
    parts, static = {}, []
    # ------------------------------------------------------------- barrel + brake
    brl = zcyl('barrel', 0.0138, 0.0112, -0.12, -0.70, y=BORE_Y, segs=28, material=M['barrel'])
    for i in range(6):
        a = i * math.pi / 3
        boolean(brl, gbox('c', (0.0055, 0.0055, 0.3), (math.cos(a) * 0.0128, BORE_Y + math.sin(a) * 0.0128, -0.47), rot=(0, 0, a)))
    finish(brl, 0.0004, 1, 40)
    static.append(brl)
    br = side_prism('brake', [(-0.69, BORE_Y + 0.016), (-0.775, BORE_Y + 0.016), (-0.782, BORE_Y + 0.010), (-0.782, BORE_Y - 0.010), (-0.775, BORE_Y - 0.016), (-0.69, BORE_Y - 0.016)], -0.0175, 0.0175, M['black'])
    for z in (-0.708, -0.727, -0.746, -0.764):
        boolean(br, gbox('c', (0.05, 0.02, 0.011), (0, BORE_Y, z)))
    boolean(br, zcyl('c', 0.0058, 0.0058, -0.68, -0.79, y=BORE_Y, segs=16))
    finish(br, 0.0012, 1, 35)
    static.append(br)
    # ------------------------------------------------------------- upper receiver (flat-sided action) + full-length rail
    up = side_prism('upper', [(0.118, -0.004), (0.118, 0.022), (0.112, 0.027), (-0.13, 0.027), (-0.13, -0.004)], -0.0195, 0.0195, M['chassis'])
    boolean(up, gbox('c', (0.03, 0.023, 0.08), (0.019, 0.011, -0.022)))                          # ejection port
    boolean(up, gbox('c', (0.012, 0.03, 0.07), (0.022, 0.012, 0.075)))                             # bolt handle slot
    t = text_mesh('eng', 'HALCÓN R7', 0.0072, 0.0007, G(-0.0197, 0.011, 0.04), (math.pi / 2, 0, -math.pi / 2))
    boolean(up, t)
    finish(up, 0.0012, 1, 35)
    uv_box(up, 25.0)
    static.append(up)
    static.append(rail('rail', 0.112, -0.5, 0.027, M))
    shroud = zcyl('shroud', 0.0145, 0.011, 0.118, 0.15, y=BORE_Y + 0.004, segs=24, material=M['black'])
    finish(shroud, 0.0008, 2, 30)
    static.append(shroud)
    # ------------------------------------------------------------- handguard: slab sides, slots, end cap
    rings = []
    for z in (-0.128, -0.5):
        rings.append([G(x, -0.0075 + y, z) for (x, y) in rounded_rect(0.054, 0.069, 0.009, 4)])
    hg = loft('handguard', rings, M['chassis'])
    for i in range(6):
        z = -0.165 - i * 0.055
        for sx in (-1, 1):
            slot_cut(hg, z, z - 0.036, -0.009, 0.012, sx * 0.03, sx * 0.0195)
    for i in range(5):
        z = -0.19 - i * 0.06
        boolean(hg, gbox('c', (0.012, 0.012, 0.035), (0, -0.042, z - 0.017)))
    boolean(hg, zcyl('c', 0.018, 0.018, -0.12, -0.52, y=BORE_Y, segs=24))
    for p in hg.data.polygons:
        p.use_smooth = False
    finish(hg, 0.0016, 1, 35)
    uv_box(hg, 25.0)
    static.append(hg)
    endcap = loft('endcap', [[G(x, -0.0075 + y, -0.499) for (x, y) in rounded_rect(0.052, 0.067, 0.009, 4)],
                             [G(x, -0.0075 + y, -0.508) for (x, y) in rounded_rect(0.046, 0.06, 0.008, 4)]], M['black'])
    static.append(endcap)
    # ------------------------------------------------------------- lower chassis: bed, magwell, guard, hinge
    low = side_prism('lower', [(0.13, -0.004), (0.13, -0.046), (0.105, -0.05), (0.02, -0.05), (0.018, -0.058), (-0.075, -0.058), (-0.082, -0.05), (-0.13, -0.044), (-0.13, -0.004)], -0.021, 0.021, M['chassis'])
    boolean(low, gbox('c', (0.034, 0.03, 0.08), (0, -0.06, -0.028)))                             # magwell opening
    finish(low, 0.0014, 1, 35)
    uv_box(low, 25.0)
    static.append(low)
    guard = side_prism('guard', [(0.098, -0.046), (0.098, -0.075), (0.088, -0.083), (0.026, -0.083), (0.018, -0.074), (0.018, -0.046)], -0.0075, 0.0075, M['chassis'])
    boolean(guard, side_prism('c', [(0.09, -0.04), (0.09, -0.073), (0.084, -0.077), (0.03, -0.077), (0.026, -0.072), (0.026, -0.04)], -0.02, 0.02))
    finish(guard, 0.001, 2, 35)
    static.append(guard)
    trig = side_prism('trigger', [(0.062, -0.048), (0.066, -0.048), (0.064, -0.058), (0.058, -0.068), (0.053, -0.07), (0.053, -0.068), (0.058, -0.062), (0.06, -0.054)], -0.0028, 0.0028, M['steel'])
    finish(trig, 0.0004, 1)
    set_origin(trig, G(0, -0.048, 0.064))
    trig.parent = root
    parts['trigger'] = trig
    hinge = zcyl('hinge', 0.012, 0.012, 0.128, 0.16, x=0.0, y=-0.016, segs=16, material=M['black'])
    hinge.data.transform(Matrix.Translation(Vector((0, 0, 0))))
    static.append(hinge)
    hb = gbox('hingeblock', (0.04, 0.05, 0.03), (0, -0.02, 0.145), M['black'])
    finish(hb, 0.002, 2, 30)
    static.append(hb)
    # ------------------------------------------------------------- grip (raked, stippled rubber)
    ga = math.radians(16)
    gtop = Vector((0, -0.042, 0.112))
    gd = Vector((0, -math.cos(ga), math.sin(ga)))
    gf = Vector((0, -math.sin(ga), -math.cos(ga)))
    grs = []
    for k in range(10):
        t = k / 9
        w = 0.029 + 0.003 * math.sin(math.pi * t)
        d = 0.043 + 0.003 * math.sin(math.pi * t)
        ring = []
        for (x, v) in rounded_rect(w, d, 0.011, 4):
            if v > d / 2 - 0.006 and 0.15 < t < 0.85:
                v -= 0.0013 * max(0, math.sin(t * math.pi * 3.2 - 0.4))
            ring.append(G(*(gtop + gd * (0.1 * t) + gf * v + Vector((x, 0, 0)))))
        grs.append(ring)
    grip = loft('grip', grs, M['grip'])
    for p in grip.data.polygons:
        p.use_smooth = True
    uv_box(grip, 40.0)
    static.append(grip)
    # ------------------------------------------------------------- skeleton folding stock
    stk = side_prism('stock', [(0.16, 0.02), (0.42, 0.026), (0.432, 0.02), (0.432, -0.102), (0.42, -0.112), (0.33, -0.112), (0.24, -0.068), (0.175, -0.05), (0.16, -0.04)], -0.012, 0.012, M['chassis'])
    boolean(stk, side_prism('c', [(0.2, 0.007), (0.3, 0.01), (0.3, -0.045), (0.25, -0.045), (0.205, -0.03)], -0.05, 0.05))
    boolean(stk, side_prism('c', [(0.322, 0.011), (0.41, 0.013), (0.41, -0.04), (0.33, -0.04)], -0.05, 0.05))
    boolean(stk, side_prism('c', [(0.35, -0.058), (0.41, -0.058), (0.41, -0.096), (0.375, -0.096)], -0.05, 0.05))
    for z in (0.315, 0.338):
        boolean(stk, cyl('c', 0.0045, 0.0045, 0.1, G(0, -0.083, z), axis='X', segs=14))
    finish(stk, 0.0018, 1, 35)
    uv_box(stk, 25.0)
    static.append(stk)
    cheek = side_prism('cheek', [(0.235, 0.034), (0.405, 0.04), (0.41, 0.033), (0.41, 0.03), (0.24, 0.026)], -0.017, 0.017, M['black'])
    finish(cheek, 0.003, 3, 30)
    static.append(cheek)
    for z in (0.27, 0.37):
        static.append(cyl('post', 0.0035, 0.0035, 0.012, G(0, 0.026, z), axis='Z', segs=10, material=M['steel']))
    static.append(cyl('cheekknob', 0.0075, 0.0075, 0.009, G(0.017, 0.012, 0.32), axis='X', segs=18, material=M['black']))
    pad = side_prism('pad', [(0.432, 0.03), (0.452, 0.033), (0.458, 0.02), (0.458, -0.108), (0.452, -0.118), (0.432, -0.115)], -0.019, 0.019, M['rubber'])
    finish(pad, 0.003, 3, 30)
    static.append(pad)
    for z in (0.42, -0.31):
        static.append(cyl('qd', 0.005, 0.005, 0.004, G(-0.021 if z > 0 else -0.028, -0.03, z), axis='X', segs=14, material=M['steel']))
    # ------------------------------------------------------------- folded bipod under the handguard
    static.append(gbox('bipodmount', (0.026, 0.012, 0.03), (0, -0.048, -0.465), M['black']))
    for sx in (-1, 1):
        leg = zcyl('leg', 0.0042, 0.0042, -0.46, -0.27, x=sx * 0.0105, y=-0.052, segs=10, material=M['black'])
        foot = sphere('foot', 0.0065, G(sx * 0.0105, -0.052, -0.268), M['rubber'], segs=10)
        static += [leg, foot]
    # ------------------------------------------------------------- magazine
    mag = side_prism('mag', [(0.012, -0.046), (0.012, -0.098), (-0.064, -0.098), (-0.068, -0.046)], -0.0155, 0.0155, M['black'])
    finish(mag, 0.0012, 2, 35)
    mb2 = side_prism('magbase', [(0.016, -0.096), (0.016, -0.106), (-0.072, -0.106), (-0.072, -0.096)], -0.018, 0.018, M['black'])
    finish(mb2, 0.002, 2, 30)
    rnd = zcyl('round', 0.0055, 0.0055, 0.008, -0.05, y=-0.041, segs=14, material=M['brass'])
    mag = join([mag, mb2, rnd], 'mag')
    set_origin(mag, G(0, -0.044, -0.027))
    mag.parent = root
    parts['mag'] = mag
    # ------------------------------------------------------------- bolt (origin = pivot)
    px, py, pz = BOLT_PIVOT
    body = zcyl('boltbody', 0.0088, 0.0088, 0.07, -0.06, x=0.0, y=BORE_Y + 0.002, segs=18, material=M['steel'])
    for i in range(3):
        boolean(body, zcyl('c', 0.0095, 0.0095, -0.005 - i * 0.022, -0.012 - i * 0.022, y=BORE_Y + 0.002, segs=18))
    stem = cyl('stem', 0.0045, 0.0045, 0.05, (0, 0, 0), axis='X', segs=12, material=M['black'])
    stem.data.transform(Matrix.Rotation(math.radians(-14), 4, 'Y'))
    stem.data.transform(Matrix.Translation(Vector(G(px + 0.028, py - 0.004, pz))))
    kb = sphere('knob', 0.0125, G(px + 0.061, py - 0.01, pz), M['black'], scale=(1.0, 1.3, 1.0), segs=20)
    bolt = join([body, stem, kb], 'bolt')
    set_origin(bolt, G(px, py, pz))
    bolt.parent = root
    parts['bolt'] = bolt
    # ------------------------------------------------------------- scope on a one-piece mount
    sy = SCOPE_Y
    def sc(name, r1, r2, z0, z1, mat_=None, segs=36):
        o = zcyl(name, r1, r2, z0, z1, y=sy, segs=segs, material=mat_ or M['scope'])
        return o
    tube = sc('tube', 0.0168, 0.0168, 0.12, -0.15)
    bell = sc('bell', 0.0168, 0.0265, -0.15, -0.192)
    objh = sc('obj', 0.0265, 0.027, -0.192, -0.252)
    boolean(objh, zcyl('c', 0.0245, 0.0245, -0.243, -0.26, y=sy, segs=36))
    shade = sc('shade', 0.0272, 0.0272, -0.198, -0.204, M['black'])
    ocb = sc('ocbell', 0.0168, 0.0205, 0.12, 0.142)
    power = sc('power', 0.0198, 0.0198, 0.098, 0.12, M['black'])
    for i in range(12):
        a = i * math.pi / 6
        boolean(power, gbox('c', (0.0026, 0.004, 0.03), (math.cos(a) * 0.0198, sy + math.sin(a) * 0.0198, 0.109), rot=(0, 0, a)))
    lever = gbox('lever', (0.004, 0.016, 0.006), (0.017, sy + 0.017, 0.109), M['black'], rot=(0, 0, -0.75))
    ocu = sc('ocular', 0.0205, 0.0212, 0.142, 0.178)
    cup = sc('cup', 0.0218, 0.0228, 0.176, 0.205, M['rubber'])
    boolean(cup, zcyl('c', 0.018, 0.018, 0.18, 0.215, y=sy, segs=32))
    saddle = gbox('saddle', (0.034, 0.028, 0.062), (0, sy, -0.012), M['scope'])
    for o in (tube, bell, objh, shade, ocb, power, ocu, cup, saddle, lever):
        finish(o, 0.0006, 1, 40)
        static.append(o)
    lensF = cyl('lensF', 0.0245, 0.0245, 0.002, G(0, sy, -0.244), axis='Y', segs=36, material=M['lens'])
    lensR = cyl('lensR', 0.0178, 0.0178, 0.002, G(0, sy, 0.185), axis='Y', segs=36, material=mat('R_eye', (0.01, 0.012, 0.014), 0.2, 0.1))
    static += [lensF, lensR]
    def turret(name, cap_r, h, with_line=True):
        base = cyl(name, cap_r * 0.86, cap_r * 0.86, 0.008, (0, 0, 0.004), axis='Z', segs=28, material=M['scope'])
        capo = cyl(name + 'c', cap_r, cap_r, h, (0, 0, 0.008 + h / 2), axis='Z', segs=28, material=M['black'])
        for i in range(10):
            a = i * math.pi / 5
            boolean(capo, box('c', (0.0018, 0.0018, h * 0.7), (math.cos(a) * cap_r, math.sin(a) * cap_r, 0.008 + h * 0.6), rot=(0, 0, a)))
        top = cyl(name + 't', cap_r * 0.8, cap_r * 0.8, 0.0015, (0, 0, 0.008 + h + 0.0006), axis='Z', segs=28, material=M['scope'])
        bits = [base, capo, top]
        if with_line:
            bits.append(box(name + 'l', (0.0012, cap_r * 0.7, 0.0008), (0, cap_r * 0.42, 0.008 + h + 0.0014), M['accent']))
        return join(bits, name)
    for (nm, ax, r, h) in (('elev', (0, 0, 1), 0.0145, 0.02), ('wind', (1, 0, 0), 0.013, 0.014), ('para', (-1, 0, 0), 0.0125, 0.012)):
        tt = turret(nm, r, h, nm != 'para')
        q = Vector((0, 0, 1)).rotation_difference(Vector(ax))
        tt.data.transform(q.to_matrix().to_4x4())
        tt.data.transform(Matrix.Translation(Vector(G(0, sy, -0.012)) + Vector(ax) * 0.0135))
        finish(tt, 0.0004, 1, 50)
        static.append(tt)
    # one-piece cantilever mount: base on the rail, two rings
    mb = side_prism('mountbase', [(0.085, 0.0345), (0.085, 0.042), (-0.115, 0.042), (-0.115, 0.0345)], -0.0115, 0.0115, M['black'])
    finish(mb, 0.0008, 1, 35)
    static.append(mb)
    for z in (-0.09, 0.055):
        rg = zcyl('ring', 0.0205, 0.0205, z + 0.009, z - 0.009, y=sy, segs=32, material=M['black'])
        boolean(rg, zcyl('c', 0.0169, 0.0169, z + 0.02, z - 0.02, y=sy, segs=32))
        stand = gbox('stand', (0.02, sy - 0.042, 0.018), (0, (sy + 0.042) / 2 - 0.01, z), M['black'])
        boolean(stand, zcyl('c', 0.0171, 0.0171, z + 0.02, z - 0.02, y=sy, segs=32))
        for o in (rg, stand):
            finish(o, 0.0006, 1, 40)
        static += [rg, stand]
        for sx in (-1, 1):
            static.append(cyl('screw', 0.0024, 0.0024, 0.004, G(sx * 0.02, sy + 0.012, z), axis='X', segs=10, material=M['steel']))
    # small accents (the game's orange)
    static.append(gbox('acc', (0.0008, 0.0025, 0.12), (0.0276, 0.016, -0.32), M['accent']))
    static.append(gbox('acc', (0.0008, 0.0025, 0.12), (-0.0276, 0.016, -0.32), M['accent']))
    body = join(static, 'rifle')
    body.parent = root
    parts['body'] = body
    empty('r_muzzle', G(0, BORE_Y, -0.785), root)
    empty('r_eject', G(0.03, 0.014, -0.02), root)
    for k, o in parts.items():
        o.name = 'r_' + k
        o.data.name = 'r_' + k
    return parts
