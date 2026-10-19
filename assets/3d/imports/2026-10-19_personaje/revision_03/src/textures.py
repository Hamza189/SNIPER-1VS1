"""Revisión 03 — texturas del soldado a partir de los horneados de build_model.py (Python + numpy + Pillow).

Cada texel sabe dónde está en el cuerpo (posición y normal horneadas), qué prenda o pieza es (zonas y
'part') y cuánta oclusión tiene. Con eso se pinta: color de cada tejido o cuero, variación y desteñido,
suciedad (más cerca del suelo, rodillas, codos, culera), desgaste en cantos y pliegues, costuras y
pespuntes, cremallera, cordones, suela con tacos, parche del hombro… Tres apariencias (A arena/ocre,
B oliva, bots gris/negro) con la misma rugosidad y normales: solo cambia el color.

Salida: revision_03/textures/{color_A,color_B,color_bots,normal,orm}.jpg (2048) y versiones _1k.
Uso: C:/Python314/python.exe textures.py
"""
import math, sys, json
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from noise import fbm, vnoise

REV = HERE.parent
WORK = REV.parent / '.work' / 'rev03'
OUT = REV / 'textures'
OUT.mkdir(exist_ok=True)
J = {k: np.array(v) for k, v in json.loads((WORK / 'joints.json').read_text()).items()}


def load(n):
    return np.load(WORK / (n + '.npy')).astype(np.float64)


pos_b = load('bake_pos')
H, W = pos_b.shape[:2]
pos = np.stack([pos_b[..., 0], pos_b[..., 2], -pos_b[..., 1]], -1)          # coordenadas del juego
nb = load('bake_objnormal')
onrm = np.stack([nb[..., 0], nb[..., 2], -nb[..., 1]], -1)
reg = load('bake_reg')
part = np.rint(load('bake_part')[..., 0] * 32).astype(int)
ao = load('bake_ao')[..., 0]
tn = load('bake_normal') * 2 - 1                                             # normales de pliegues (tangente)
valid = np.linalg.norm(pos, axis=-1) > 1e-4
x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]
P = pos.reshape(-1, 3)


def S(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def N(freq, octv=3, seed=0):
    return fbm(P, freq, octv, seed=seed).reshape(H, W)


# ------------------------------------------------------------------ materiales por texel
MATS = ['jacket', 'pants', 'glove', 'hood', 'skin', 'pocket', 'flap', 'belt', 'buckle', 'kneepad', 'strap', 'helmet',
        'hardplastic', 'lens', 'goggleframe', 'shoulderstrap', 'patch', 'boot', 'sole', 'sheath', 'zipper', 'vest', 'pouch']
PART_MAT = {1: 'pocket', 2: 'flap', 3: 'pocket', 4: 'belt', 5: 'buckle', 6: 'pants', 7: 'kneepad', 8: 'strap', 9: 'helmet',
            10: 'hardplastic', 11: 'lens', 12: 'goggleframe', 13: 'jacket', 14: 'shoulderstrap', 15: 'jacket', 16: 'jacket',
            17: 'patch', 18: 'boot', 19: 'sheath', 20: 'sole', 21: 'vest', 22: 'pouch', 23: 'vest', 24: 'vest', 25: 'pouch'}
mat = np.full((H, W), MATS.index('jacket'))
body = part == 0
r = reg
bodymat = np.where(r[..., 2] > 0.5, MATS.index('glove'), np.where(r[..., 1] > r[..., 0], MATS.index('pants'), MATS.index('jacket')))
headzone = body & (r[..., 0] < 0.5) & (r[..., 1] < 0.5) & (r[..., 2] < 0.5)
face = headzone & (y > 1.588) & (y < 1.668) & (z > 0.03)
bodymat = np.where(headzone, MATS.index('hood'), bodymat)
bodymat = np.where(face, MATS.index('skin'), bodymat)
mat = np.where(body, bodymat, mat)
for k, m in PART_MAT.items():
    mat = np.where(part == k, MATS.index(m), mat)
# cremallera delantera de la chaqueta
zip_ = (mat == MATS.index('jacket')) & (np.abs(x) < 0.0055) & (z > 0.02) & (y > 0.97) & (y < 1.52)
mat = np.where(zip_, MATS.index('zipper'), mat)


def M(name):
    return mat == MATS.index(name)


# ------------------------------------------------------------------ campos de detalle
big = N(2.5, 3, 1)                # desteñido grande
mid = N(11, 3, 2)
fine = N(160, 2, 3)
grain = N(420, 2, 4)
# curvatura desde las normales de pliegues: + canto/pliegue saliente, - hueco
dnx = np.gradient(tn[..., 0], axis=1)
dny = np.gradient(tn[..., 1], axis=0)
curv = np.clip((dnx + dny) * 9, -1, 1)
cav = np.clip(1 - tn[..., 2], 0, 1)
# suciedad: más abajo, rodillas, codos, culera, antebrazos y palmas
kneeL, kneeR = J['l-knee'], J['r-knee']
dist_knee = np.minimum(np.linalg.norm(pos - kneeL - [0, 0, 0.06], axis=-1), np.linalg.norm(pos - kneeR - [0, 0, 0.06], axis=-1))
dist_elb = np.minimum(np.linalg.norm(pos - J['l-elbow'], axis=-1), np.linalg.norm(pos - J['r-elbow'], axis=-1))
dirt = 0.85 * (1 - S(0.05, 0.55, y)) ** 1.5
dirt += 0.55 * np.exp(-(dist_knee / 0.09) ** 2)
dirt += 0.35 * np.exp(-(dist_elb / 0.08) ** 2)
dirt += 0.35 * S(0.02, -0.12, z) * np.exp(-((y - 0.86) / 0.08) ** 2)
dirt *= S(0.35, 0.75, N(7, 4, 5) + 0.25 * mid)
dirt += 0.18 * S(0.55, 0.85, N(23, 3, 6))
dirt = np.clip(dirt, 0, 1)
dust = np.clip(0.35 * S(0.5, 0.9, N(5, 3, 8)) * S(0.6, 1.4, y), 0, 1)

# ------------------------------------------------------------------ relieve fino (m) para el mapa de normales
h = np.zeros((H, W))
cloth = M('jacket') | M('pants') | M('pocket') | M('flap') | M('hood') | M('helmet') | M('vest') | M('pouch')
h += cloth * (grain - 0.5) * 0.00022 + cloth * (fine - 0.5) * 0.0003
# chaleco: cordura gruesa y cintas MOLLE/PALS (2,5 cm de cinta cada 3,8 cm, con remates cosidos cada 3,8 cm)
nylon = M('vest') | M('pouch')
row = ((y + 0.004) % 0.038) / 0.038
along = np.where(np.abs(onrm[..., 0]) > 0.7, z, x)
molle = M('vest') & (row < 0.66) & (y > 1.0) & (y < 1.42)
tack = molle & (((along + 0.5) % 0.038) / 0.038 < 0.07)
h += nylon * np.sin((x + y) * math.tau / 0.0016) * 0.00004
h += molle * 0.0009 - tack * 0.0004
pouch_edge = M('pouch') & (cav > 0.08)

# tejido: sarga diagonal fina en la chaqueta y el pantalón
tw = np.sin((x * 0.7 + y + z * 0.7) * math.tau / 0.0021)
h += (M('jacket') | M('pants') | M('pocket') | M('flap')) * tw * 0.00005
# punto de la braga/pasamontañas: canalé vertical
ang = np.arctan2(x, z + 1e-9)
h += M('hood') * np.sin(ang * 0.11 / 0.0035) * 0.00012
# costuras con pespunte
def stitch_line(mask_line, along):
    dash = (np.sin(along * math.tau / 0.0045) > -0.2)
    return mask_line * dash


placket = (M('jacket')) & (np.abs(np.abs(x) - 0.019) < 0.0011) & (z > 0.02) & (y > 0.975) & (y < 1.50)
side_seam = (M('jacket') | M('pants')) & (np.abs(z + 0.012) < 0.0012) & (np.abs(x) > 0.12)
leg_c = lambda s: np.where(s > 0, kneeL[0], kneeR[0])
out_seam = M('pants') & (np.abs(z - np.where(x > 0, kneeL[2], kneeR[2])) < 0.0012) & (y < 0.9) & (y > 0.2)
seams = placket | side_seam | out_seam
st = stitch_line(seams, y)
h -= seams * 0.00025
h += st * 0.00012
# cremallera: dientes
h += M('zipper') * (np.sin(y * math.tau / 0.0035) > 0) * 0.0005
# bota: cordones y ojales en el empeine, arrugas del cuero en el tobillo
foot_x = np.where(x > 0, J['l-ankle'][0], J['r-ankle'][0])
dx = x - foot_x
lace_zone = M('boot') & (z > np.where(x > 0, J['l-ankle'][2], J['r-ankle'][2]) + 0.012) & (y > 0.055) & (y < 0.205) & (np.abs(dx) < 0.024)
lace = lace_zone & ((np.abs(np.sin((y + np.abs(dx) * 0.9) * math.tau / 0.017)) < 0.28) | (np.abs(np.sin((y - np.abs(dx) * 0.9) * math.tau / 0.017)) < 0.28))
eyelet = M('boot') & (np.abs(np.abs(dx) - 0.024) < 0.0035) & (np.abs(np.sin(y * math.tau / 0.017)) > 0.92) & (y > 0.06) & (y < 0.2) & (z > -0.02)
h += lace * 0.0009 + eyelet * 0.0004
h += M('boot') * np.exp(-((y - 0.11) / 0.03) ** 2) * (vnoise(P * [1, 6, 1], 60, 13).reshape(H, W) - 0.5) * 0.0008
# suela con tacos
h += M('sole') * (np.sin((x + z) * math.tau / 0.012) > 0.2) * 0.001
# rodillera y casco: arañazos finos
scr = (vnoise(P * [1, 9, 1], 90, 21).reshape(H, W))
h -= (M('kneepad') | M('hardplastic')) * (np.abs(scr - 0.5) < 0.012) * 0.00015

# ------------------------------------------------------------------ rugosidad y metal
rough = np.full((H, W), 0.9)
RO = {'jacket': .88, 'pants': .9, 'glove': .6, 'hood': .95, 'skin': .55, 'pocket': .86, 'flap': .86, 'belt': .78, 'buckle': .35,
      'kneepad': .55, 'strap': .8, 'helmet': .9, 'hardplastic': .5, 'lens': .08, 'goggleframe': .55, 'shoulderstrap': .82,
      'patch': .8, 'boot': .62, 'sole': .85, 'sheath': .6, 'zipper': .4, 'vest': .78, 'pouch': .76}
ME = {'buckle': 1.0, 'zipper': 0.85, 'lens': 0.35}
metal = np.zeros((H, W))
for k, v in RO.items():
    rough = np.where(M(k), v, rough)
for k, v in ME.items():
    metal = np.where(M(k), v, metal)
rough = np.clip(rough + (mid - 0.5) * 0.08 + dirt * 0.08 - curv.clip(0, 1) * 0.06 * (M('boot') | M('glove')), 0.05, 1)
metal = np.where(eyelet, 0.9, metal)
rough = np.where(eyelet, 0.35, rough)

# ------------------------------------------------------------------ normal final = pliegues horneados + relieve fino
ppu_x = np.linalg.norm(np.gradient(pos, axis=1), axis=-1)     # metros por texel
ppu_y = np.linalg.norm(np.gradient(pos, axis=0), axis=-1)
ppu_x = np.clip(ppu_x, 2e-4, 3e-3)
ppu_y = np.clip(ppu_y, 2e-4, 3e-3)
gx = np.gradient(h, axis=1) / ppu_x
gy = np.gradient(h, axis=0) / ppu_y                            # fila 0 = v 0: el eje de filas ya es +v
gx = np.clip(gx, -0.8, 0.8)
gy = np.clip(gy, -0.8, 0.8)
nd = np.stack([-gx, -gy, np.ones_like(gx)], -1)
nd /= np.linalg.norm(nd, axis=-1, keepdims=True)
base = tn * np.array([1.35, 1.35, 1.0])            # pliegues algo más marcados
base = base / np.maximum(np.linalg.norm(base, axis=-1, keepdims=True), 1e-6)
nf = np.stack([base[..., 0] + nd[..., 0], base[..., 1] + nd[..., 1], base[..., 2] * nd[..., 2]], -1)
nf /= np.linalg.norm(nf, axis=-1, keepdims=True)
nf = np.where(valid[..., None], nf, [0, 0, 1])


# ------------------------------------------------------------------ color
def hexc(s):
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) / 255 for i in (0, 2, 4)])


PAL = {
    'B': dict(jacket='#4d4e37', pants='#5a5a42', glove='#33281f', hood='#43443a', skin='#b08670', pocket='#5d5040', flap='#61533f',
              belt='#1e1d1b', buckle='#8c8c88', kneepad='#56564f', strap='#2b2a27', helmet='#504f3a', hardplastic='#2c2c2a',
              lens='#121519', goggleframe='#1d1d1c', shoulderstrap='#665a42', patch='#3c4a2f', boot='#57432f', sole='#1e1c1a',
              sheath='#2a2723', zipper='#55524c', mud='#4f4232', dust='#8d8068', thread='#7d7a5c',
              vest='#4b4d3b', pouch='#53543f', camo=['#5c5d41', '#6f6449', '#3c4230', '#2a2923'], camo_kind='bosque'),
    'A': dict(jacket='#7c6a4e', pants='#8a7a59', glove='#45362a', hood='#6e604a', skin='#b08670', pocket='#715f45', flap='#766348',
              belt='#3b3128', buckle='#8c8c88', kneepad='#55524a', strap='#4b4134', helmet='#7b694e', hardplastic='#3a352e',
              lens='#121519', goggleframe='#25221e', shoulderstrap='#5f523c', patch='#5d4a2e', boot='#6a5440', sole='#231f1b',
              sheath='#3a3027', zipper='#5d574e', mud='#5a4a36', dust='#a39377', thread='#b2a07a',
              vest='#7a6748', pouch='#715f42', camo=['#9a8965', '#7c694b', '#b2a283', '#5c4d37'], camo_kind='desierto'),
    'bots': dict(jacket='#5a5d61', pants='#696c70', glove='#2a2a2b', hood='#46484b', skin='#a8846e', pocket='#4e5155', flap='#53565a',
                 belt='#1c1c1c', buckle='#7a7a78', kneepad='#3a3b3e', strap='#26272a', helmet='#525559', hardplastic='#222224',
                 lens='#101214', goggleframe='#18181a', shoulderstrap='#3e4043', patch='#7b7e82', boot='#3a3532', sole='#161514',
                 sheath='#1d1c1b', zipper='#4a4a4a', mud='#3d362e', dust='#6f6a62', thread='#6a6c70',
                 vest='#2f3135', pouch='#34363a', camo=['#5d6064', '#43464a', '#80838a', '#2d2f33'], camo_kind='digital'),
}


def camo_field(kind):
    """índice de color 0..3 del camuflaje en cada texel (con la posición en 3D: sin costuras entre islas)"""
    Q = P * np.array([1.0, 0.55, 1.0])                      # manchas alargadas en vertical
    if kind == 'digital':
        Q = np.floor(P / 0.011) * 0.011 * np.array([1.0, 0.7, 1.0])
    s = {'bosque': 12.0, 'desierto': 9.5, 'digital': 13.0}[kind]
    n1 = fbm(Q, s, 3, seed=41).reshape(H, W)
    n2 = fbm(Q + 7.3, s * 1.3, 3, seed=42).reshape(H, W)
    n3 = fbm(Q - 3.1, s * 1.8, 2, seed=43).reshape(H, W)
    idx = np.zeros((H, W), int)
    idx = np.where(n1 > 0.53, 1, idx)
    idx = np.where(n2 > 0.57, 2, idx)
    idx = np.where(n3 > 0.62, 3, idx)
    return idx


CAMO = {k: camo_field(PAL[k]['camo_kind']) for k in PAL}
camo_mask = M('jacket') | M('pants') | M('pocket') | M('flap') | M('helmet')

# parche del hombro: borde, campo y un galón (sin escudos ni banderas reales)
pp = pos[M('patch')]
patch_dec = np.zeros((H, W))
if len(pp):
    c = pp.mean(0)
    u_ax = np.array([0, -1, 0.0])
    rel = pos - c
    pu = rel @ np.array([0, 0, 1.0])
    pv = rel @ np.array([0, 1.0, 0])
    border = M('patch') & ((np.abs(pv) > 0.024) | (np.abs(pu) > 0.022))
    chevron = M('patch') & (np.abs(pv - (0.012 - np.abs(pu) * 0.8)) < 0.005)
    patch_dec = border * 1 + chevron * 2


def color(variant):
    pal = PAL[variant]
    col = np.zeros((H, W, 3))
    for k in MATS:
        col = np.where(M(k)[..., None], hexc(pal[k]), col)
    # camuflaje en chaqueta, pantalón, cubierta del casco y braga (tela de la misma partida)
    cols = np.array([hexc(h_) for h_ in pal['camo']])
    cc = cols[CAMO[variant]]
    soft = np.where(M('helmet')[..., None], 0.6, 0.92)
    col = np.where(camo_mask[..., None], col * (1 - soft) + cc * soft, col)
    # cintas MOLLE algo más oscuras, remates y cantos de los portacargadores más claros (rozados)
    col = np.where(molle[..., None], col * 0.86, col)
    col = np.where(tack[..., None], col * 0.7, col)
    col = col * (1 + (nylon * curv.clip(0, 1) * 0.35))[..., None]
    # variación del tinte y desteñido (la tela al sol se aclara en hombros y muslos)
    lum = 1 + (big - 0.5) * 0.10 + (mid - 0.5) * 0.07 + (fine - 0.5) * 0.07 + (grain - 0.5) * 0.06
    sun = S(0.3, 0.9, onrm[..., 1]) * 0.03 * (cloth)
    col = col * lum[..., None] + sun[..., None]
    # cuero: más claro en los cantos (rozaduras), más oscuro en los huecos
    leather = M('boot') | M('glove') | M('belt') | M('sheath')
    col *= (1 + leather * (0.30 * curv.clip(0, 1) - 0.25 * cav))[..., None]
    # pliegues de la tela: sombra en el hueco y luz en la cresta
    col *= (1 + cloth * (0.26 * curv - 0.30 * cav))[..., None]
    # cantos gastados en piezas duras
    hard = M('kneepad') | M('hardplastic') | M('helmet') | M('goggleframe')
    col += (hard * curv.clip(0, 1) * 0.10)[..., None]
    col += ((M('kneepad') | M('hardplastic')) * (np.abs(scr - 0.5) < 0.012) * 0.06)[..., None]
    # costuras: hilo un poco más claro, ranura más oscura
    col = np.where(seams[..., None], col * 0.82, col)
    col = np.where(st[..., None], hexc(pal['thread']) * (0.9 + 0.2 * fine[..., None]), col)
    # cordones y ojales
    col = np.where(lace[..., None], hexc('#2a2622') * (0.9 + 0.3 * fine[..., None]), col)
    col = np.where(eyelet[..., None], hexc('#6d6a64'), col)
    # parche
    col = np.where((patch_dec == 1)[..., None], hexc('#1c1c1a'), col)
    col = np.where((patch_dec == 2)[..., None], hexc('#b9a05a') if variant != 'bots' else hexc('#c8ccd0'), col)
    # piel: rubor y poros muy leves
    col = np.where(M('skin')[..., None], col * (1 + (N(60, 2, 31) - 0.5)[..., None] * 0.12) + np.array([0.03, -0.01, -0.01]) * N(9, 2, 32)[..., None], col)
    # cristal de las gafas: degradado y reflejo
    col = np.where(M('lens')[..., None], hexc('#1a2430') + (S(1.60, 1.65, y) * 0.12)[..., None] * np.array([0.5, 0.75, 1.0]), col)
    # suciedad (barro) y polvo
    mud = hexc(pal['mud'])
    dmask = dirt * (~(M('lens') | M('skin')))
    col = col * (1 - 0.45 * dmask[..., None]) + mud * (0.45 * dmask[..., None])
    col = col * (1 - 0.25 * dust[..., None]) + hexc(pal['dust']) * (0.25 * dust[..., None])
    # oclusión ambiental (horneada) para los contactos: bolsillos, cuello, cinturón, entre piernas
    col *= (0.30 + 0.70 * np.clip(ao, 0, 1) ** 1.1)[..., None]
    return np.clip(col, 0, 1)


def save(arr, name, q=90):
    img = Image.fromarray((np.flipud(arr) * 255 + 0.5).clip(0, 255).astype(np.uint8))
    img.save(OUT / (name + '.jpg'), quality=q, subsampling=0 if name == 'normal' else 2, optimize=True)
    img.resize((W // 2, H // 2), Image.LANCZOS).save(OUT / (name + '_1k.jpg'), quality=q, optimize=True)


for v in ('A', 'B', 'bots'):
    save(color(v), 'color_' + v)
    print('color', v)
save(nf * 0.5 + 0.5, 'normal', q=94)
orm = np.stack([0.35 + 0.65 * np.clip(ao, 0, 1), rough, metal], -1)
save(orm, 'orm')
print('ok', OUT)
