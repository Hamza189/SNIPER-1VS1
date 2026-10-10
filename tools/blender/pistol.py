"""VÍBORA 9 (fictional compact 9 mm sidearm). Original design built from code.

Gun frame (Blender): origin on the bore line at the rear of the barrel area, +Y = muzzle, +Z = up.
Same measurements the game already uses: slide from y -0.022 to 0.168, sight line at z 0.0262.
Moving parts are separate nodes with their pivot as origin: slide, trigger, mag, slidestop.
Sockets (empties) mark where things attach in the game: muzzle, eject, magwell.
"""
import math
from mathutils import Vector, Matrix, Euler
from common import *

SIGHT_Z = 0.0262
GRIP_ANGLE = math.radians(19)
GRIP_TOP = Vector((0, -0.006, -0.034))
GRIP_D = Vector((0, -math.sin(GRIP_ANGLE), -math.cos(GRIP_ANGLE)))   # down the grip
GRIP_F = Vector((0, math.cos(GRIP_ANGLE), -math.sin(GRIP_ANGLE)))    # towards its front strap
GRIP_LEN = 0.104

def materials():
    return dict(
        slide=mat('P_slide', (0.032, 0.034, 0.037), 0.75, 0.42),
        frame=mat('P_frame', (0.040, 0.039, 0.037), 0.0, 0.6),
        grip=mat('P_grip', (0.040, 0.039, 0.037), 0.0, 0.88),
        steel=mat('P_steel', (0.40, 0.41, 0.43), 1.0, 0.3),
        barrel=mat('P_barrel', (0.62, 0.45, 0.20), 1.0, 0.32),
        accent=mat('P_accent', (0.85, 0.30, 0.06), 0.0, 0.5),
        dotG=mat('P_dotG', (0.45, 1.0, 0.3), 0.0, 0.4, emissive=(0.45, 1.0, 0.3)),
        dotY=mat('P_dotY', (1.0, 0.85, 0.2), 0.0, 0.4, emissive=(1.0, 0.85, 0.2)),
        brass=mat('P_brass', (0.78, 0.56, 0.24), 1.0, 0.25),
        black=mat('P_black', (0.008, 0.008, 0.009), 0.2, 0.7),
    )

def grip_point(t, x, v):
    c = GRIP_TOP + GRIP_D * (GRIP_LEN * t)
    return c + Vector((x, 0, 0)) + GRIP_F * v

def build(root):
    M = materials()
    parts = {}
    # ------------------------------------------------------------- slide
    W = 0.0255
    sec = [(-W / 2, -0.0105), (W / 2, -0.0105), (W / 2, 0.0112), (W / 2 - 0.0032, 0.0178), (-W / 2 + 0.0032, 0.0178), (-W / 2, 0.0112)]
    slide = prism_xz('slide', sec, -0.022, 0.168, M['slide'])
    # side profile: dehorned nose, slightly raked rear face
    side = [(-0.021, -0.0105), (0.159, -0.0105), (0.168, -0.0055), (0.168, 0.0145), (0.1645, 0.0182), (-0.0195, 0.0182), (-0.0225, 0.0150), (-0.0225, -0.0080)]
    cut = prism_yz('cut', side, -0.03, 0.03)
    boolean(slide, cut, 'INTERSECT')
    # ejection port (right side, behind the rear sight's front)
    boolean(slide, box('c', (0.022, 0.041, 0.016), (0.0115, 0.039, 0.0135)))
    # rear and front serrations, slanted
    for sx in (-1, 1):
        for i in range(8):
            y = -0.0165 + i * 0.0034
            boolean(slide, box('c', (0.0024, 0.0013, 0.03), (sx * W / 2, y, 0.002), rot=(math.radians(-12), 0, 0)))
        for i in range(5):
            y = 0.128 + i * 0.0034
            boolean(slide, box('c', (0.0024, 0.0013, 0.03), (sx * W / 2, y, 0.002), rot=(math.radians(-12), 0, 0)))
    # lightening cut on top front (flat recess), barrel hole in the nose
    boolean(slide, box('c', (0.009, 0.05, 0.004), (0, 0.105, 0.0195)))
    boolean(slide, cyl('c', 0.0071, 0.0071, 0.03, (0, 0.165, 0.0015)))
    # rear plate recess
    boolean(slide, box('c', (0.0115, 0.003, 0.016), (0, -0.0225, 0.001)))
    # engravings
    t = text_mesh('eng', 'VÍBORA 9', 0.0062, 0.0006, (-W / 2 + 0.0002, 0.088, 0.0035), (math.pi / 2, 0, -math.pi / 2))
    boolean(slide, t)
    finish(slide, 0.0006, 1, 35)
    uv_box(slide, 25.0)
    # parts riding on the slide
    rs = prism_yz('rsight', [(-0.0162, 0.0178), (-0.0070, 0.0178), (-0.0080, SIGHT_Z), (-0.0158, SIGHT_Z)], -0.0108, 0.0108, M['black'])
    boolean(rs, box('c', (0.0036, 0.03, 0.0082), (0, -0.012, SIGHT_Z)))                       # U notch
    boolean(rs, cyl('c', 0.0018, 0.0018, 0.03, (0, -0.012, SIGHT_Z - 0.0041), segs=16))
    finish(rs, 0.0004, 1, 40)
    fs = prism_yz('fsight', [(0.146, 0.0178), (0.1545, 0.0178), (0.1535, SIGHT_Z), (0.1488, SIGHT_Z)], -0.0017, 0.0017, M['black'])
    finish(fs, 0.0003, 1, 40)
    dots = [cyl('dot', 0.00125, 0.00125, 0.0005, (sx * 0.0064, -0.0163, SIGHT_Z - 0.0034), segs=12, material=M['dotG']) for sx in (-1, 1)]
    dots.append(cyl('dot', 0.00115, 0.00115, 0.0005, (0, 0.1484, SIGHT_Z - 0.0024), segs=12, material=M['dotY']))
    plate = box('plate', (0.0100, 0.0016, 0.0140), (0, -0.0222, 0.001), M['slide'])
    finish(plate, 0.0003, 1)
    # barrel: hood in the port, crown at the muzzle (bronze finish)
    hood = box('hood', (0.0176, 0.043, 0.0118), (0, 0.0395, 0.0115), M['barrel'])
    finish(hood, 0.0006, 2)
    brl = cyl('barrel', 0.0066, 0.0066, 0.11, (0, 0.113, 0.0015), segs=28, material=M['barrel'])
    boolean(brl, cyl('c', 0.0045, 0.0045, 0.03, (0, 0.168, 0.0015), segs=20))
    finish(brl, 0.0005, 2)
    bore = cyl('bore', 0.0045, 0.0045, 0.001, (0, 0.159, 0.0015), segs=20, material=M['black'])
    slide = join([slide, rs, fs, plate, hood, brl, bore] + dots, 'slide')
    parts['slide'] = slide
    # ------------------------------------------------------------- frame
    fp = [(-0.024, -0.0105), (0.150, -0.0105), (0.150, -0.0262), (0.1455, -0.0305), (0.094, -0.0305), (0.0915, -0.050),
          (0.084, -0.0588), (0.037, -0.0588), (0.027, -0.0525), (0.017, -0.043), (-0.030, -0.043), (-0.031, -0.022),
          (-0.0335, -0.0165), (-0.0325, -0.0125), (-0.0255, -0.0105)]
    frame = prism_yz('frame', fp, -0.0116, 0.0116, M['frame'])
    hole = prism_yz('c', [(0.0815, -0.0325), (0.0835, -0.0455), (0.078, -0.0525), (0.040, -0.0525), (0.031, -0.047), (0.027, -0.0325)], -0.03, 0.03)
    boolean(frame, hole)
    # rail: cross slots underneath, grooves on both sides
    for y in (0.106, 0.121, 0.136):
        boolean(frame, box('c', (0.03, 0.0055, 0.004), (0, y, -0.0305)))
    for sx in (-1, 1):
        boolean(frame, box('c', (0.003, 0.054, 0.0022), (sx * 0.0116, 0.122, -0.0255)))
    finish(frame, 0.0007, 2, 35)
    # ------------------------------------------------------------- grip (lofted along its rake)
    rings = []
    N = 14
    for k in range(N):
        t = k / (N - 1)
        w = 0.0285 + 0.003 * math.sin(math.pi * min(1, t * 1.2)) + (0.0015 if t > 0.93 else 0)
        d = 0.0465 + 0.0022 * math.sin(math.pi * t) + (0.0022 if t > 0.93 else 0)
        r = 0.0105
        ring = []
        for (x, v) in rounded_rect(w, d, r, 5):
            # finger grooves on the front strap, palm swell on the back strap
            if v > d / 2 - r * 0.6:
                v -= 0.0012 * max(0, math.sin(t * math.pi * 3.0 - 0.35)) if 0.12 < t < 0.88 else 0
            if v < -d / 2 + r * 0.6:
                v -= 0.0012 * math.sin(math.pi * t)
            ring.append(tuple(grip_point(t, x, v + 0.002)))
        rings.append(ring)
    grip = loft('grip', rings, M['grip'])
    for p in grip.data.polygons:
        p.use_smooth = True
    uv_box(grip, 40.0)
    # mag release, takedown levers, slide stop (slide stop moves: own node)
    mr = box('magrel', (0.004, 0.009, 0.0085), (-0.0135, 0.019, -0.040), M['frame'])
    finish(mr, 0.0012, 2)
    tk = [box('tk', (0.0244, 0.006, 0.003), (0, 0.084, -0.0175), M['steel'])]
    finish(tk[0], 0.0006, 1)
    ss = box('slidestop', (0.0022, 0.022, 0.0042), (-0.0126, 0.040, -0.0112), M['steel'])
    boolean(ss, box('c', (0.004, 0.006, 0.006), (-0.0126, 0.050, -0.0085)))
    finish(ss, 0.0006, 1)
    set_origin(ss, (-0.0126, 0.030, -0.0112))
    ss.parent = root
    parts['slidestop'] = ss
    # accent: thin inlay along the dust cover
    acc = [box('acc', (0.0006, 0.044, 0.0016), (sx * 0.0117, 0.120, -0.0175), M['accent']) for sx in (-1, 1)]
    frame = join([frame, grip, mr] + tk + acc, 'frame')
    frame.parent = root
    parts['frame'] = frame
    # ------------------------------------------------------------- trigger (pivot at its top)
    tp = [(0.0645, -0.031), (0.0675, -0.031), (0.0665, -0.040), (0.0628, -0.0485), (0.0572, -0.0505), (0.0566, -0.0492),
          (0.0602, -0.0465), (0.0628, -0.040), (0.0635, -0.033)]
    trig = prism_yz('trigger', tp, -0.0029, 0.0029, M['steel'])
    blade = box('blade', (0.0016, 0.004, 0.009), (0, 0.0618, -0.0425), M['accent'], rot=(math.radians(-28), 0, 0))
    finish(trig, 0.0004, 1)
    trig = join([trig, blade], 'trigger')
    set_origin(trig, (0, 0.066, -0.0315))
    trig.parent = root
    parts['trigger'] = trig
    # ------------------------------------------------------------- magazine (origin at the top of the grip axis)
    mrings = []
    for t in (0.02, 0.97):
        mrings.append([tuple(grip_point(t, x, v + 0.0015)) for (x, v) in rounded_rect(0.0205, 0.031, 0.006, 3)])
    body = loft('magbody', mrings, M['black'])
    prings = []
    for t, e in ((0.965, 0.0), (1.0, 0.0), (1.035, -0.002)):
        prings.append([tuple(grip_point(t, x, v + 0.002)) for (x, v) in rounded_rect(0.0315 + e, 0.0505 + e, 0.0105, 5)])
    bp = loft('magbase', prings, M['frame'])
    for p in bp.data.polygons:
        p.use_smooth = True
    inl = [box('inl', (0.0005, 0.03, 0.003), tuple(grip_point(1.0, sx * 0.0159, 0.0)), M['accent'], rot=(-GRIP_ANGLE, 0, 0)) for sx in (-1, 1)]
    top = grip_point(0.02, 0, 0.0015)
    rnd = cyl('round', 0.0045, 0.0045, 0.015, tuple(top + GRIP_F * 0.003 + Vector((0, 0, 0.004))), axis='Y', segs=16, material=M['brass'])
    tip = cyl('tip', 0.0045, 0.0018, 0.005, tuple(top + GRIP_F * 0.0135 + Vector((0, 0, 0.004))), axis='Y', segs=16, material=M['brass'])
    lips = box('lips', (0.0212, 0.02, 0.003), tuple(top + GRIP_F * -0.004), M['black'])
    mag = join([body, bp, rnd, tip, lips] + inl, 'mag')
    set_origin(mag, tuple(GRIP_TOP))
    mag.parent = root
    parts['mag'] = mag
    # ------------------------------------------------------------- sockets
    empty('muzzle', (0, 0.17, 0.0015), root)
    empty('eject', (0.014, 0.040, 0.016), root)
    empty('gripTop', tuple(GRIP_TOP), root)
    slide.parent = root
    return parts

def grip_frame():
    """Exported for reference: grip axis (down) and front direction, both in Blender coordinates."""
    return GRIP_TOP, GRIP_D, GRIP_F, GRIP_LEN
