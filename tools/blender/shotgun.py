"""FURIA 12 (fictional 12-gauge pump-action). Original design, built from code.

Game frame, same layout as the game's previous shotgun: receiver centred on the origin, barrel
axis at y 0.018 to z -0.63, magazine tube at y -0.013, sight line y 0.04 (bead at the muzzle,
notch on the receiver), pump centred at (0, -0.013, -0.27) sliding back 0.085.
Moving parts: s_pump (origin = its rest centre), s_stock (folds out of the way when aiming),
s_trigger. A loose shell s_shell (origin = its middle) is used by the loading hand.
"""
import math
from mathutils import Vector, Matrix
from common import *
from rifle import G, side_prism, zcyl, gbox

def materials():
    return dict(
        recv=mat('S_recv', (0.03, 0.032, 0.035), 0.6, 0.45),
        barrel=mat('S_barrel', (0.04, 0.042, 0.045), 0.8, 0.36),
        poly=mat('S_poly', (0.035, 0.035, 0.034), 0.0, 0.7),
        grip=mat('S_grip', (0.03, 0.03, 0.03), 0.0, 0.9),
        red=mat('S_red', (0.75, 0.12, 0.06), 0.0, 0.5),
        shell=mat('S_shell', (0.6, 0.08, 0.06), 0.0, 0.5),
        brass=mat('P_brass', (0.78, 0.56, 0.24), 1.0, 0.25),
        bead=mat('S_bead', (1.0, 0.95, 0.75), 0.0, 0.3, emissive=(1.0, 0.95, 0.75)),
        black=mat('P_black', (0.008, 0.008, 0.009), 0.2, 0.7),
    )

def shell_obj(name, M, center, length=0.065):
    z0 = center[2] + length / 2
    hull = zcyl(name + 'h', 0.0104, 0.0104, z0 - 0.012, z0 - length, x=center[0], y=center[1], segs=16, material=M['shell'])
    head = zcyl(name + 'b', 0.0112, 0.011, z0, z0 - 0.013, x=center[0], y=center[1], segs=16, material=M['brass'])
    for o in (hull, head):
        finish(o, 0.0006, 1, 40)
    return join([hull, head], name)

def build(root):
    M = materials()
    parts, static = {}, []
    # receiver with ejection port, loading port, red stripes
    rec = side_prism('recv', [(0.12, 0.033), (0.12, -0.033), (-0.12, -0.033), (-0.12, 0.028), (-0.105, 0.033)], -0.025, 0.025, M['recv'])
    boolean(rec, gbox('c', (0.02, 0.026, 0.075), (0.026, 0.008, -0.02)))
    boolean(rec, gbox('c', (0.032, 0.02, 0.09), (0, -0.036, 0.0)))
    finish(rec, 0.0015, 2, 35)
    static.append(rec)
    port_bolt = gbox('bolt', (0.004, 0.02, 0.065), (0.018, 0.008, -0.02), M['barrel'])
    static.append(port_bolt)
    for sx in (-1, 1):
        static.append(gbox('stripe', (0.0008, 0.0045, 0.17), (sx * 0.0252, -0.016, 0.0), M['red']))
    # side saddle with four shells on the left of the receiver
    sad = gbox('saddle', (0.006, 0.03, 0.1), (-0.0285, 0.0, -0.01), M['poly'])
    finish(sad, 0.0012, 2, 35)
    static.append(sad)
    for i in range(4):
        z = -0.05 + i * 0.024
        sh = shell_obj('saddleshell', M, (-0.0335, 0.004, z), 0.05)
        sh.data.transform(Matrix.Translation(-Vector(G(-0.0335, 0.004, z))))
        sh.data.transform(Matrix.Rotation(math.pi / 2, 4, 'X'))
        sh.data.transform(Matrix.Translation(Vector(G(-0.0335, 0.004, z))))
        static.append(sh)
    # barrel, vent rib, magazine tube, clamp, choke, bead, rear notch
    brl = zcyl('barrel', 0.0125, 0.0122, -0.11, -0.625, y=0.018, segs=24, material=M['barrel'])
    boolean(brl, zcyl('c', 0.0092, 0.0092, -0.6, -0.64, y=0.018, segs=20))
    finish(brl, 0.0005, 1, 40)
    static.append(brl)
    rib = gbox('rib', (0.008, 0.003, 0.5), (0, 0.0335, -0.37), M['barrel'])
    static.append(rib)
    for i in range(11):
        static.append(gbox('post', (0.004, 0.004, 0.006), (0, 0.0305, -0.13 - i * 0.046), M['barrel']))
    tube = zcyl('tube', 0.0135, 0.0135, -0.11, -0.54, y=-0.013, segs=22, material=M['barrel'])
    static.append(tube)
    cap = zcyl('tubecap', 0.0145, 0.013, -0.535, -0.56, y=-0.013, segs=22, material=M['recv'])
    finish(cap, 0.001, 2, 30)
    static.append(cap)
    clamp = side_prism('clamp', [(-0.528, 0.032), (-0.55, 0.032), (-0.55, -0.028), (-0.528, -0.028)], -0.016, 0.016, M['recv'])
    finish(clamp, 0.002, 2, 30)
    static.append(clamp)
    choke = zcyl('choke', 0.0142, 0.0142, -0.61, -0.632, y=0.018, segs=24, material=M['recv'])
    boolean(choke, zcyl('c', 0.0092, 0.0092, -0.6, -0.64, y=0.018, segs=20))
    finish(choke, 0.0006, 1, 40)
    static.append(choke)
    bead = sphere('bead', 0.0036, G(0, 0.0375, -0.62), M['bead'], segs=12)
    static.append(bead)
    for sx in (-1, 1):
        n = gbox('notch', (0.003, 0.009, 0.006), (sx * 0.0058, 0.0385, 0.08), M['black'])
        static.append(n)
    # trigger guard, trigger
    guard = side_prism('guard', [(0.11, -0.033), (0.11, -0.064), (0.1, -0.07), (0.04, -0.07), (0.032, -0.06), (0.032, -0.033)], -0.007, 0.007, M['poly'])
    boolean(guard, side_prism('c', [(0.1, -0.033), (0.1, -0.062), (0.095, -0.065), (0.044, -0.065), (0.04, -0.06), (0.04, -0.033)], -0.02, 0.02))
    finish(guard, 0.0008, 1, 35)
    static.append(guard)
    trig = side_prism('trigger', [(0.07, -0.034), (0.074, -0.034), (0.072, -0.048), (0.065, -0.058), (0.061, -0.058), (0.066, -0.047)], -0.0028, 0.0028, M['barrel'])
    finish(trig, 0.0004, 1)
    set_origin(trig, G(0, -0.034, 0.072))
    trig.parent = root
    parts['trigger'] = trig
    # pistol grip (raked) and stock (its own node: it drops away when aiming)
    up = Vector((0, math.cos(0.4), -math.sin(0.4)))
    dn = -up
    fwd = Vector((0, -math.sin(0.4), -math.cos(0.4)))
    gtop = Vector((0, -0.03, 0.118))
    rings = []
    for k in range(10):
        t = k / 9
        w = 0.03 + 0.003 * math.sin(math.pi * t)
        d = 0.044 + 0.003 * math.sin(math.pi * t)
        ring = []
        for (x, v) in rounded_rect(w, d, 0.011, 4):
            if v > d / 2 - 0.006 and 0.15 < t < 0.85:
                v -= 0.0013 * max(0, math.sin(t * math.pi * 3.2 - 0.4))
            ring.append(G(*(gtop + dn * (0.1 * t) + fwd * v + Vector((x, 0, 0)))))
        rings.append(ring)
    grip = loft('grip', rings, M['grip'])
    for p in grip.data.polygons:
        p.use_smooth = True
    uv_box(grip, 40.0)
    static.append(grip)
    st = side_prism('stock', [(0.118, 0.03), (0.33, 0.012), (0.335, -0.06), (0.32, -0.085), (0.22, -0.06), (0.15, -0.045), (0.118, -0.033)], -0.02, 0.02, M['poly'])
    boolean(st, side_prism('c', [(0.2, 0.012), (0.3, 0.004), (0.3, -0.045), (0.24, -0.04), (0.2, -0.025)], -0.05, 0.05))
    finish(st, 0.002, 2, 35)
    pad = side_prism('pad', [(0.33, 0.014), (0.345, 0.014), (0.348, -0.075), (0.338, -0.09), (0.322, -0.087)], -0.022, 0.022, mat('R_rubber', (0.02, 0.02, 0.02), 0.0, 0.9))
    finish(pad, 0.003, 2, 30)
    stock = join([st, pad], 'stock')
    stock.parent = root
    parts['stock'] = stock
    # pump (forend) with grip ribs, origin at its rest centre
    pr = []
    zs = [-0.18 - 0.18 * i / 72 for i in range(73)]
    for z in zs:
        e = min(z - (-0.36), -0.18 - z)                       # distance to the ends
        r = 0.0225 + min(1.0, e / 0.008) * 0.0035
        g = (-0.205 - z) % 0.022
        if -0.35 < z < -0.2 and g < 0.006:
            r -= 0.0022 * math.sin(math.pi * g / 0.006)
        pr.append([G(math.cos(a) * r * 1.05, -0.016 + math.sin(a) * r, z) for a in [i * 2 * math.pi / 24 for i in range(24)]])
    pump = loft('pump', pr, M['poly'])
    boolean(pump, zcyl('c', 0.0145, 0.0145, -0.15, -0.4, y=-0.013, segs=20))
    for p in pump.data.polygons:
        p.use_smooth = True
    smooth(pump, 50)
    set_origin(pump, G(0, -0.013, -0.27))
    pump.parent = root
    parts['pump'] = pump
    # loose shell (for the loading hand), origin at its middle, pointing forward
    sh = shell_obj('shell', M, (0, 0, 0), 0.065)
    sh.parent = root
    parts['shell'] = sh
    body = join(static, 'shotgun')
    body.parent = root
    parts['body'] = body
    empty('s_muzzle', G(0, 0.018, -0.64), root)
    for k, o in parts.items():
        o.name = 's_' + k
        o.data.name = 's_' + k
    return parts
