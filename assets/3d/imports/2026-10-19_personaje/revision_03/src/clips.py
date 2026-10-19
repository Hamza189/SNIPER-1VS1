"""Revisión 03 — los 29 clips (28 del encargo + idle_knife). Cada uno es una función t -> Pose.

Velocidades de referencia (core/config.js): andar/correr 4,6 m/s, esprint 7, agachado 2,4. El juego ajusta
timeScale = velocidad real / 'speed' del clip. Pies apoyados sin patinar a esa velocidad.
"""
import math
import numpy as np
from anim import *

R_ = math.radians


def make(sk):
    B = Builder(sk)
    I = sk.i

    # ---------------------------------------------------------------- piezas del tren superior
    def up_rifle_idle(P, t, extra_twist=0.0):
        B.chest(P, twist=R_(-14) + extra_twist, lean=R_(2.0), breath_t=t)
        B.hands_on(P, 'rifle', rifle_low(), clav_r=(R_(2), R_(4)))
        B.head_look(P, pitch=R_(-3) + R_(1.2) * math.sin(TAU * t / 4.0), yaw_=R_(1.5) * math.sin(TAU * t / 5.0))

    def up_rifle_aim(P, t, pitch=0.0, recoil=0.0, breath=0.35):
        lean = R_(3.0) + max(0.0, -pitch) * 0.13
        B.chest(P, twist=R_(-20), lean=lean + R_(1.5), breath_t=t if breath else None)
        if pitch >= 0:
            Rw, pw = rifle_aim(pitch)
        else:                                     # hacia abajo gira alrededor de la culata y se inclina el torso
            R0, p0 = rifle_aim(0.0)
            butt = p0 + R0 @ np.array([0, 0.075, -0.337])
            Rw = up(pitch)
            pw = butt + Rw @ (p0 - butt)
        if recoil:
            pw = pw + Rw @ np.array([0, 0.004, -0.035]) * recoil
            Rw = Rw @ up(R_(6) * recoil)
        B.hands_on(P, 'rifle', (Rw, pw), clav_r=(R_(6) - 0.4 * recoil * R_(5), R_(9) - recoil * R_(4)), clav_l=(R_(2), R_(6)))
        B.head_look(P, pitch=pitch * 0.42 - R_(4), rol=R_(7.5) * (1 - abs(pitch) / R_(90)))
        return Rw, pw

    def up_pistol(P, t, aim=True, pitch=0.0, recoil=0.0):
        B.chest(P, twist=R_(-6), lean=R_(2.5), breath_t=t)
        if aim:
            Rw, pw = pistol_aim(pitch)
        else:
            Rw, pw = pistol_low()
        if recoil:
            pw = pw + Rw @ np.array([0, 0.012, -0.03]) * recoil
            Rw = Rw @ up(R_(14) * recoil)
        B.hands_on(P, 'pistol', (Rw, pw), clav_r=(R_(3), R_(6)), clav_l=(R_(3), R_(6)), elbow_r=np.array([-0.8, -0.6, -0.1]), elbow_l=np.array([0.8, -0.6, -0.1]))
        B.head_look(P, pitch=pitch * 0.45 - R_(3))
        return Rw, pw

    def lower_stand(P, t, **kw):
        B.stand(P, t, **kw)

    clips = {}

    def clip(name, duration, loop, speed=0.0, layer='upper'):
        def deco(fn):
            clips[name] = dict(fn=fn, duration=duration, loop=loop, speed=speed, layer=layer)
            return fn
        return deco

    # ---------------------------------------------------------------- de pie
    @clip('idle_rifle', 4.0, True)
    def _(t):
        P = Pose(sk)
        lower_stand(P, t)
        up_rifle_idle(P, t)
        return P

    @clip('aim_rifle', 4.0, True)
    def _(t):
        P = Pose(sk)
        lower_stand(P, t, sway=0.35, stance=0.0, knee=1.0)
        up_rifle_aim(P, t)
        return P

    @clip('aim_up', 0.0, False, layer='additive')
    def _(t):
        P = Pose(sk)
        lower_stand(P, 0, sway=0.35, stance=0.0, knee=1.0)
        up_rifle_aim(P, 0, pitch=R_(60), breath=0)
        return P

    @clip('aim_down', 0.0, False, layer='additive')
    def _(t):
        P = Pose(sk)
        lower_stand(P, 0, sway=0.35, stance=0.0, knee=1.0)
        up_rifle_aim(P, 0, pitch=R_(-60), breath=0)
        return P

    # ---------------------------------------------------------------- locomoción
    # (ciclo s, distancia del pie apoyado m, fracción de apoyo): velocidad sin patinar = D / (apoyo · ciclo)
    GAIT = {'fwd': (0.66, 0.80, 0.27), 'left': (0.66, 0.40, 0.22), 'right': (0.66, 0.40, 0.22), 'sprint': (0.62, 0.80, 0.19),
            'crouch': (0.70, 0.62, 0.40)}
    SPEED = {k: round(D / (s * T), 3) for k, (T, D, s) in GAIT.items()}

    def locomotion(P, t, kind):
        T, D, s = GAIT[kind]
        if kind == 'fwd':
            B.gait(P, t, T, D, (0, 0, 1), H=0.24, stance=s, bob=0.022, lean=R_(3), sway_deg=6)
        elif kind == 'left':
            B.gait(P, t, T, D, (1, 0, 0), H=0.022, stance=s, bob=0.004, lateral=True, sway_deg=4)
        elif kind == 'right':
            B.gait(P, t, T, D, (-1, 0, 0), H=0.022, stance=s, bob=0.004, lateral=True, sway_deg=4)
        elif kind == 'sprint':
            B.gait(P, t, T, D, (0, 0, 1), H=0.32, stance=s, bob=0.018, lean=R_(2.5), sway_deg=8, cross=0.025)

    @clip('walk_fwd', 0.66, True, speed=SPEED['fwd'], layer='lower')
    def _(t):
        P = Pose(sk)
        locomotion(P, t, 'fwd')
        up_rifle_idle(P, t)
        return P

    @clip('walk_back', 0.66, True, speed=SPEED['fwd'], layer='lower')
    def _(t):
        P = Pose(sk)
        locomotion(P, (0.66 - t) % 0.66, 'fwd')          # el paso hacia delante al revés: apoya punta y luego talón
        up_rifle_idle(P, t)
        return P

    @clip('walk_left', 0.66, True, speed=SPEED['left'], layer='lower')
    def _(t):
        P = Pose(sk)
        locomotion(P, t, 'left')
        up_rifle_idle(P, t)
        return P

    @clip('walk_right', 0.66, True, speed=SPEED['right'], layer='lower')
    def _(t):
        P = Pose(sk)
        locomotion(P, t, 'right')
        up_rifle_idle(P, t)
        return P

    @clip('sprint', 0.62, True, speed=SPEED['sprint'], layer='full')
    def _(t):
        P = Pose(sk)
        locomotion(P, t, 'sprint')
        u = (t / 0.62) % 1
        B.chest(P, twist=R_(10) + R_(6) * math.sin(TAU * u), lean=R_(4), breath_t=None)
        Rw, pw = rifle_port()
        pw = pw + np.array([0.0, 0.018 * math.sin(TAU * 2 * u), 0.012 * math.sin(TAU * u)])
        B.hands_on(P, 'rifle', (Rw @ yaw(R_(5) * math.sin(TAU * u)), pw), clav_r=(R_(1), R_(-2)), clav_l=(R_(4), R_(8)),
                   elbow_r=np.array([-0.7, -0.6, -0.4]), elbow_l=np.array([0.9, -0.5, 0.2]))
        B.head_look(P, pitch=R_(-2))
        return P

    # ---------------------------------------------------------------- agachado y deslizamiento (altura final con morph)
    def crouch_lower(P, t, walk=False):
        P.apply_squash(K_CROUCH, 1.0, 'agachado')
        if walk:
            T, D, s = GAIT['crouch']
            B.gait(P, t, T, D, (0, 0, 1), H=0.09, stance=s, bob=0.008, lean=R_(1), sway_deg=5)
            P.hips = P.hips + np.array([0, -0.01, 0.0])
        else:
            ph = TAU * t / 2.0
            P.hips = np.array([0.004 * math.sin(ph * 0.5), -0.012 - 0.002 * (1 - math.cos(ph)), -0.012])
            P.local('Hips', up(-R_(4)))
            feet = {}
            for side, sx in (('Left', 1), ('Right', -1)):
                Pr = Pose(sk)
                Pr.apply_squash(K_CROUCH, 1.0, 'agachado')
                _, pa = Pr.world(side + 'Foot')
                pa = pa + np.array([0.0, 0, 0.0 if side == 'Left' else 0.006])
                feet[side] = (pa, yaw(sx * R_(2)))
            B.legs_to(P, feet, knee_out=0.10)
        P.local('Spine', up(-R_(3)))

    @clip('crouch_idle', 4.0, True, layer='lower')
    def _(t):
        P = Pose(sk)
        crouch_lower(P, t)
        up_rifle_idle(P, t)
        return P

    @clip('crouch_walk', 0.70, True, speed=SPEED['crouch'], layer='lower')
    def _(t):
        P = Pose(sk)
        crouch_lower(P, t, walk=True)
        up_rifle_idle(P, t)
        return P

    @clip('slide', 1.0, True, layer='full')
    def _(t):
        P = Pose(sk)
        P.apply_squash(K_SLIDE, 1.0, 'deslizar')
        Pr = Pose(sk)
        Pr.apply_squash(K_SLIDE, 1.0, 'deslizar')
        P.hips = np.array([0.0, -0.01, 0.0])
        P.local('Hips', roll(R_(-3)))
        P.local('Spine', up(R_(4)))
        feet = {}
        for side, sx in (('Left', 1), ('Right', -1)):
            _, pa = Pr.world(side + 'Foot')
            if side == 'Left':
                pa = pa + np.array([0.005, 0.008, -0.002])
                Rf = np.eye(3)
            else:
                pa = pa + np.array([-0.005, 0.0, 0.004])
                Rf = yaw(-R_(3))
            feet[side] = (pa, Rf)
        B.legs_to(P, feet, knee_out=0.1)
        B.chest(P, twist=R_(-10), lean=R_(2.5) + R_(1) * math.sin(TAU * t))
        B.hands_on(P, 'rifle', rifle_low(R_(18)), clav_r=(R_(2), R_(2)))
        B.head_look(P, pitch=R_(2))
        return P

    # ---------------------------------------------------------------- salto
    @clip('jump_start', 0.3, False, layer='lower')
    def _(t):
        P = Pose(sk)
        u = t / 0.3
        dip = -0.045 * math.sin(math.pi * min(1, u / 0.7)) + 0.02 * smooth((u - 0.7) / 0.3)
        lower_stand(P, 0, sway=0)
        P.hips = P.hips + np.array([0, dip, -0.02 * math.sin(math.pi * min(1, u / 0.7))])
        feet = {}
        for side, sx in (('Left', 1), ('Right', -1)):
            ank = sk.rest[I[side + 'Foot']].copy()
            ank, Rf = B.foot_pose(side, ank, R_(30) * smooth((u - 0.75) / 0.25), 0.0, np.eye(3))
            feet[side] = (ank, Rf)
        P.local('Hips', up(-R_(10) * math.sin(math.pi * min(1, u / 0.7))))
        B.legs_to(P, feet)
        up_rifle_idle(P, t)
        return P

    @clip('jump_air', 0.6, True, layer='lower')
    def _(t):
        P = Pose(sk)
        u = t / 0.6
        lower_stand(P, 0, sway=0)
        P.local('Hips', up(R_(2)))
        feet = {}
        for side, sx in (('Left', 1), ('Right', -1)):
            ank = sk.rest[I[side + 'Foot']].copy()
            lift = 0.17 + 0.02 * math.sin(TAU * u + (0 if side == 'Left' else 2))
            ank = ank + np.array([0, lift, (0.07 if side == 'Left' else -0.06)])
            feet[side] = (ank, rx(R_(22 if side == 'Right' else 8)))
        B.legs_to(P, feet)
        up_rifle_idle(P, t)
        return P

    @clip('jump_land', 0.3, False, layer='lower')
    def _(t):
        P = Pose(sk)
        u = t / 0.3
        lower_stand(P, 0, sway=0)
        dip = -0.05 * math.sin(math.pi * min(1, u)) ** 0.8
        P.hips = P.hips + np.array([0, dip, -0.025 * math.sin(math.pi * u)])
        P.local('Hips', up(-R_(12) * math.sin(math.pi * u)))
        feet = {}
        for side, sx in (('Left', 1), ('Right', -1)):
            ank = sk.rest[I[side + 'Foot']].copy()
            ank, Rf = B.foot_pose(side, ank, -R_(10) * (1 - smooth(u / 0.25)), 0.0, np.eye(3))
            feet[side] = (ank, Rf)
        B.legs_to(P, feet)
        up_rifle_idle(P, t)
        return P

    # ---------------------------------------------------------------- rifle: disparo con cerrojo y recarga
    @clip('fire_rifle', 0.95, False)
    def _(t):
        P = Pose(sk)
        lower_stand(P, t, sway=0.2, stance=0.0, knee=1.0)
        rec = math.sin(math.pi * min(1, t / 0.07)) if t < 0.07 else math.exp(-(t - 0.07) / 0.08)
        Rw, pw = up_rifle_aim(P, t, recoil=rec)
        # cerrojo: la mano derecha va a la maneta, la levanta, tira, empuja, baja y vuelve
        W = WEAPONS['rifle']
        if 0.30 < t < 0.90:
            soff, Rs0 = sk.sock['Right']
            grip = np.zeros(3)
            bolt = np.array(W['bolt'])
            keys = [(0.30, grip, 0), (0.40, bolt, 0), (0.47, bolt + [0, 0.02, 0], 1), (0.59, bolt + [0, 0.02, -0.095], 1),
                    (0.70, bolt + [0, 0.02, 0], 1), (0.77, bolt, 0), (0.90, grip, 0)]
            for (t0, a, ra), (t1, b, rb) in zip(keys[:-1], keys[1:]):
                if t0 <= t <= t1:
                    s = smooth((t - t0) / (t1 - t0))
                    loc = a + (b - a) * s
                    rr = ra + (rb - ra) * s
                    break
            Rh = Rw @ roll(R_(-35) * (1 if np.linalg.norm(loc) > 0.02 else 0) * smooth(min(1, np.linalg.norm(loc) / 0.05))) @ Rs0.T
            Rh = Rw @ rz(R_(-50) * rr) @ Rw.T @ Rh
            wrist = pw + Rw @ loc - Rh @ soff
            P.ik('Right', 'Arm', wrist, np.array([-0.9, -0.55, -0.25]), end_R=Rh)
        return P

    @clip('reload_rifle', 2.35, False)
    def _(t):
        P = Pose(sk)
        lower_stand(P, t, sway=0.5)
        tilt = smooth(t / 0.3) * (1 - smooth((t - 2.05) / 0.3))
        B.chest(P, twist=R_(-16), lean=R_(4), breath_t=t)
        Rb, pb = rifle_low(R_(14))
        Rb = Rb @ roll(R_(-28) * tilt) @ yaw(R_(10) * tilt)
        pb = pb + np.array([0.03, 0.06, 0.0]) * tilt
        Rw, pw = B.hands_on(P, 'rifle', (Rb, pb), left=False, clav_r=(R_(2), R_(4)))
        soff, Rs0 = sk.sock['Left']
        port = pw + Rw @ np.array([0.0, 0.11, 0.07])
        pouch = np.array([0.11, 1.10, 0.17])
        guard = pw + Rw @ np.array(WEAPONS['rifle']['left'])
        Rguard = Rw @ Rs0.T
        Rpinch = up(R_(-70)) @ yaw(R_(80)) @ Rs0.T
        keys = [(0.0, guard, Rguard), (0.30, guard, Rguard), (0.62, pouch, Rpinch), (0.80, pouch, Rpinch), (1.10, port, Rpinch),
                (1.25, port + [0, -0.03, 0], Rpinch), (1.42, port, Rpinch), (1.57, port + [0, -0.03, 0], Rpinch), (1.75, port, Rpinch),
                (2.05, guard, Rguard), (2.35, guard, Rguard)]
        for (t0, a, Ra), (t1, b, Rb2) in zip(keys[:-1], keys[1:]):
            if t0 <= t <= t1 + 1e-9:
                s = smooth((t - t0) / max(1e-6, t1 - t0))
                pos = a + (b - a) * s
                Rh = Ra if s < 0.5 else Rb2
                if Ra is not Rb2:
                    q = quat(Ra.T @ Rb2)
                    ang = 2 * math.acos(max(-1, min(1, q[3])))
                    ax = q[:3] / max(1e-9, math.sin(ang / 2))
                    Rh = Ra @ rot(ax, ang * s) if ang > 1e-6 else Ra
                break
        B.arm_free(P, 'Left', pos, Rh, pole=np.array([0.7, -0.7, -0.2]))
        B.head_look(P, pitch=R_(-14) * tilt, yaw_=R_(-6) * tilt)
        return P

    # ---------------------------------------------------------------- pistola
    @clip('idle_pistol', 4.0, True)
    def _(t):
        P = Pose(sk)
        lower_stand(P, t)
        up_pistol(P, t, aim=False)
        return P

    @clip('aim_pistol', 4.0, True)
    def _(t):
        P = Pose(sk)
        lower_stand(P, t, sway=0.35, stance=0.0, knee=1.0)
        up_pistol(P, t, aim=True)
        return P

    @clip('fire_pistol', 0.22, False)
    def _(t):
        P = Pose(sk)
        lower_stand(P, 0, sway=0.35, stance=0.0, knee=1.0)
        rec = math.sin(math.pi * min(1, t / 0.04)) if t < 0.04 else math.exp(-(t - 0.04) / 0.05)
        up_pistol(P, t, aim=True, recoil=rec)
        return P

    @clip('reload_pistol', 1.45, False)
    def _(t):
        P = Pose(sk)
        lower_stand(P, t, sway=0.5)
        tilt = smooth(t / 0.2) * (1 - smooth((t - 1.2) / 0.25))
        B.chest(P, twist=R_(-6), lean=R_(3), breath_t=t)
        Rb, pb = pistol_low()
        Rb = Rb @ roll(R_(-25) * tilt)
        pb = pb + np.array([0.0, 0.08, 0.0]) * tilt
        Rw, pw = B.hands_on(P, 'pistol', (Rb, pb), left=False, clav_r=(R_(3), R_(6)), elbow_r=np.array([-0.8, -0.6, -0.1]))
        soff, Rs0 = sk.sock['Left']
        home = pw + Rw @ np.array(WEAPONS['pistol']['left'])
        belt = np.array([0.09, 0.98, 0.10])
        well = pw + Rw @ np.array([0.0, -0.13, 0.03])
        keys = [(0.0, home), (0.18, home), (0.45, belt), (0.6, belt), (0.85, well + [0, -0.06, 0]), (0.98, well), (1.2, home), (1.45, home)]
        for (t0, a), (t1, b) in zip(keys[:-1], keys[1:]):
            if t0 <= t <= t1 + 1e-9:
                pos = a + (b - a) * smooth((t - t0) / max(1e-6, t1 - t0))
                break
        B.arm_free(P, 'Left', pos, Rw @ Rs0.T, pole=np.array([0.8, -0.6, -0.1]))
        B.head_look(P, pitch=R_(-12) * tilt)
        return P

    # ---------------------------------------------------------------- escopeta
    @clip('fire_shotgun', 0.25, False)
    def _(t):
        P = Pose(sk)
        lower_stand(P, 0, sway=0.2, stance=0.0, knee=1.0)
        rec = math.sin(math.pi * min(1, t / 0.05)) if t < 0.05 else math.exp(-(t - 0.05) / 0.06)
        B.chest(P, twist=R_(-24), lean=R_(3) - R_(3) * rec)
        Rw, pw = rifle_aim(0)
        pw = pw + np.array([0, 0.01, 0.10]) + Rw @ np.array([0, 0.006, -0.05]) * rec
        Rw = Rw @ up(R_(10) * rec)
        B.hands_on(P, 'shotgun', (Rw, pw), clav_r=(R_(6), R_(9) - rec * R_(6)), clav_l=(R_(2), R_(6)))
        B.head_look(P, pitch=-R_(5), rol=R_(9))
        return P

    @clip('pump_shotgun', 0.32, False)
    def _(t):
        P = Pose(sk)
        lower_stand(P, 0, sway=0.2, stance=0.0, knee=1.0)
        B.chest(P, twist=R_(-24), lean=R_(3))
        Rw, pw = rifle_aim(0)
        pw = pw + np.array([0, 0.01, 0.10])
        Rw = Rw @ up(R_(3) * math.sin(math.pi * t / 0.32))
        W = WEAPONS['shotgun']
        pump = W['pump'] * math.sin(math.pi * t / 0.32) ** 2
        soff, Rs0 = sk.sock['Left']
        B.hands_on(P, 'shotgun', (Rw, pw), clav_r=(R_(6), R_(9)), clav_l=(R_(2), R_(6)),
                   left_override=(Rw @ Rs0.T, pw + Rw @ (np.array(W['left']) - [0, 0, pump])))
        B.head_look(P, pitch=-R_(5), rol=R_(9))
        return P

    @clip('reload_shell', 0.32, False)
    def _(t):
        P = Pose(sk)
        lower_stand(P, 0, sway=0.2)
        B.chest(P, twist=R_(-16), lean=R_(4))
        Rb, pb = rifle_low(R_(10))
        Rb = Rb @ roll(R_(-35))
        Rw, pw = B.hands_on(P, 'shotgun', (Rb, pb + np.array([0.02, 0.05, 0.05])), left=False, clav_r=(R_(2), R_(4)))
        soff, Rs0 = sk.sock['Left']
        pouch = np.array([0.12, 0.99, 0.12])
        port = pw + Rw @ np.array([0.0, -0.04, 0.13])
        u = t / 0.32
        pos = pouch + (port - pouch) * smooth(u / 0.6) if u < 0.6 else port + (pw + Rw @ np.array([0, -0.05, 0.10]) - port) * smooth((u - 0.6) / 0.4)
        B.arm_free(P, 'Left', pos, up(R_(-80)) @ yaw(R_(70)) @ Rs0.T, pole=np.array([0.8, -0.6, -0.1]))
        B.head_look(P, pitch=-R_(12))
        return P

    # ---------------------------------------------------------------- navaja
    def knife_upper(P, t, slash=0.0):
        B.chest(P, twist=R_(-12) + R_(30) * slash, lean=R_(5), breath_t=t)
        a = R_(-35) + R_(110) * slash
        Rk = yaw(R_(-10) + a * 0.6) @ up(R_(10) - R_(25) * slash) @ roll(R_(70) - R_(40) * slash)
        pk = np.array([-0.24 + 0.36 * slash, 1.28 + 0.12 * math.sin(math.pi * slash) - 0.14 * slash, 0.30 + 0.20 * math.sin(math.pi * slash)])
        B.hands_on(P, 'knife', (Rk, pk), left=False, clav_r=(R_(4), R_(8)), elbow_r=np.array([-0.9, -0.4, -0.3]))
        soff, Rs0 = sk.sock['Left']
        B.arm_free(P, 'Left', np.array([0.14, 1.30, 0.30]), up(R_(70)) @ yaw(R_(-20)) @ Rs0.T, pole=np.array([0.9, -0.5, -0.2]))
        B.head_look(P, pitch=R_(-4))

    @clip('knife_slash', 0.45, False)
    def _(t):
        P = Pose(sk)
        lower_stand(P, 0, sway=0.3, stance=0.0, knee=1.0)
        u = t / 0.45
        s = smooth(u / 0.55) if u < 0.55 else 1 - smooth((u - 0.55) / 0.45)
        knife_upper(P, t, s)
        return P

    @clip('idle_knife', 4.0, True)
    def _(t):
        P = Pose(sk)
        lower_stand(P, t, sway=0.6, stance=0.0, knee=1.0)
        knife_upper(P, t, 0.0)
        return P

    # ---------------------------------------------------------------- impacto y muertes
    @clip('hit_react', 0.26, False)
    def _(t):
        P = Pose(sk)
        lower_stand(P, 0)
        f = math.sin(math.pi * min(1, t / 0.26)) * math.exp(-t / 0.2)
        B.chest(P, twist=R_(-14) + R_(5) * f, lean=R_(2) - R_(9) * f)
        B.hands_on(P, 'rifle', rifle_low(R_(28) - R_(6) * f), clav_r=(R_(2) + R_(4) * f, R_(4)))
        B.head_look(P, pitch=R_(-3) + R_(8) * f, rol=R_(-5) * f)
        return P

    def death(P, t, front):
        u = min(1.0, t / 1.25)
        buckle = smooth(u / 0.32)
        fall = smoother((u - 0.18) / 0.62)
        settle = smooth((u - 0.8) / 0.2)
        sgn = 1 if front else -1
        # cadera: cae hacia el suelo y se va hacia donde cae el cuerpo; el torso gira 90° hasta quedar tumbado
        hy = lerp(0.0, -0.30, buckle) + lerp(0.0, -0.53, fall) + 0.02 * math.sin(math.pi * settle)
        hz = sgn * (0.10 * buckle + 0.32 * fall)
        P.hips = np.array([0.02 * fall * sgn, hy, hz])
        pitch = sgn * (R_(15) * buckle + R_(70) * fall) + sgn * R_(3) * settle
        P.local('Hips', up(-pitch) @ roll(R_(8) * fall * sgn))
        P.local('Spine', up(-sgn * R_(8) * buckle) @ yaw(R_(10) * fall))
        B.chest(P, twist=R_(10) * fall, lean=sgn * R_(10) * buckle - (R_(15) if not front else 0) * fall)
        # piernas: las rodillas ceden y, ya en el suelo, quedan casi estiradas y algo abiertas
        for side, sx in (('Left', 1), ('Right', -1)):
            kneebend = R_(65) * buckle * (1 - fall) + R_(6 if side == 'Left' else 14) * fall
            P.local(side + 'UpLeg', up(kneebend * 0.55) @ roll(sx * R_(7) * fall))
            P.local(side + 'Leg', up(-kneebend * 1.1))
            P.local(side + 'Foot', up(-R_(35) * fall) if front else up(R_(25) * fall) @ yaw(sx * R_(25) * fall))
        # brazos sueltos: abiertos sobre el suelo, codos apenas doblados
        for side, sx in (('Left', 1), ('Right', -1)):
            P.local(side + 'Shoulder', rz(sx * R_(4) * fall))
            P.local(side + 'Arm', rz(sx * (R_(20) + R_(30) * fall)) @ rx(R_(12) * fall))
            P.local(side + 'ForeArm', up(R_(25) * (1 - fall) - R_(32) * fall))
        P.local('Neck', up(-sgn * R_(10) * fall))
        P.local('Head', yaw(R_(25) * fall) @ up(-sgn * R_(6) * fall))

    @clip('death_front', 1.25, False, layer='full')
    def _(t):
        P = Pose(sk)
        death(P, t, True)
        return P

    @clip('death_back', 1.25, False, layer='full')
    def _(t):
        P = Pose(sk)
        death(P, t, False)
        return P

    return clips
