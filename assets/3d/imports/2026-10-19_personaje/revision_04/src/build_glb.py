"""Revisión 04 — escribe personaje.glb (texturas 2048) y personaje_1k.glb (1024) a partir de model.npz,
las texturas y los clips. glTF 2.0 sin extensiones (Three.js r128 lo lee tal cual).

  * nodos: personaje → Root → … 26 huesos (rotación de reposo identidad, +Y arriba, +Z delante);
    'arma' (hijo de RightShoulder: donde va el arma del juego), socket_arma_R/L (hijos de las manos);
    personaje_LOD0/1/2 (SkinnedMesh, mismo esqueleto, 1 material);
  * morph targets 'agachado' y 'deslizar' (altura final de las cajas del servidor);
  * 29 animaciones lineales a 30 Hz con extras {loop, duration, speed, layer}.
Uso: C:/Python314/python.exe build_glb.py
"""
import json, math, struct, hashlib, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from anim import Skel, Pose, quat, squash_positions, morph_delta, K_CROUCH, K_SLIDE, WEAPONS
from clips import make

REV = HERE.parent
WORK = REV.parent / '.work' / 'rev04'
TEX = REV / 'textures'
FPS = 30
M = np.load(WORK / 'model.npz')
J = json.loads((WORK / 'joints.json').read_text())
sk = Skel(M, J)
CLIPS = make(sk)
ARM_BONES = {'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftThumb', 'RightArm', 'RightForeArm', 'RightHand', 'RightThumb'}


# ------------------------------------------------------------------ muestreo de clips
def sample(name, c):
    d = c['duration']
    times = [0.0] if d == 0 else list(np.arange(0, d - 1e-9, 1 / FPS)) + [d]
    frames = []
    for t in times:
        P = c['fn'](t)
        if P.arma is None:
            P.arma = REST_ARMA
        frames.append(P)
    return times, frames


def skin_points(P, pos, joints, weights, D=None):
    Rw, Pw = P.fk()
    Rw = np.array(Rw)
    Pw = np.array(Pw)
    v = pos.copy()
    if D is not None:
        for k, w in P.morph.items():
            if w:
                v = v + D[k] * w
    out = np.zeros_like(v)
    for c in range(joints.shape[1]):
        b = joints[:, c]
        w = weights[:, c][:, None]
        loc = v - sk.rest[b]
        out += w * (np.einsum('nij,nj->ni', Rw[b], loc) + Pw[b])
    return out


# pose de reposo del arma (para clips sin arma): la de idle_rifle en t = 0
REST_ARMA = None
REST_ARMA = CLIPS['idle_rifle']['fn'](0.0).arma

lod = [{k: M['lod%d_%s' % (i, k)] for k in ('pos', 'nrm', 'tan', 'uv', 'idx', 'joints', 'weights', 'part')} for i in range(3)]
for L in lod:
    L['morph'] = {'agachado': morph_delta(sk, L['pos'], L['joints'], L['weights'], K_CROUCH),
                  'deslizar': morph_delta(sk, L['pos'], L['joints'], L['weights'], K_SLIDE)}
    # zona para la validación de cajas: 0 cabeza, 1 tronco, 2 piernas, 3 brazo (exento: sujeta el arma)
    arm = np.zeros(len(L['pos']))
    head = np.zeros(len(L['pos']))
    leg = np.zeros(len(L['pos']))
    for c in range(4):
        nm = np.array(sk.names)[L['joints'][:, c]]
        arm += L['weights'][:, c] * np.isin(nm, list(ARM_BONES))
        head += L['weights'][:, c] * (nm == 'Head')
        leg += L['weights'][:, c] * np.isin(nm, ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'])
    z = np.ones(len(L['pos']), dtype=np.uint8)
    z[leg > 0.5] = 2
    z[head > 0.5] = 0
    z[arm > 0.5] = 3
    L['zone'] = z

sampled = {}
for name, c in CLIPS.items():
    times, frames = sample(name, c)
    # muertes: el cuerpo se apoya en el suelo (vértice más bajo a 1 cm) sin atravesarlo
    if name.startswith('death'):
        L = lod[2]
        for P in frames:
            y = skin_points(P, L['pos'], L['joints'], L['weights'])[:, 1].min()
            if y < 0.012 or P is frames[-1]:
                P.hips = P.hips + np.array([0, 0.012 - y, 0])
    sampled[name] = (times, frames)
    print('clip', name, len(times), 'fotogramas')

# huesos cuya traslación cambia en algún clip (agachado, deslizamiento, cadera)
var_t = set()
for name, (times, frames) in sampled.items():
    for P in frames:
        offs = P.off + np.array([P.hips if n == 'Hips' else np.zeros(3) for n in sk.names])
        for b in np.where(np.abs(offs - sk.off0).max(1) > 1e-6)[0]:
            var_t.add(int(b))
print('huesos con traslación animada:', sorted(sk.names[b] for b in var_t))


# ------------------------------------------------------------------ escritor glTF
def write(path, texsuffix):
    doc = {'asset': {'version': '2.0', 'generator': 'SNIPER DUEL personaje rev04 (MakeHuman CC0 + ropa/equipo/animación propios)'},
           'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'personaje', 'children': []}],
           'buffers': [{}], 'bufferViews': [], 'accessors': [], 'meshes': [], 'skins': [], 'animations': [],
           'images': [], 'textures': [], 'materials': [],
           'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]}
    data = bytearray()

    def view(raw, target=None):
        while len(data) % 4:
            data.append(0)
        off = len(data)
        data.extend(raw)
        bv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(raw)}
        if target:
            bv['target'] = target
        doc['bufferViews'].append(bv)
        return len(doc['bufferViews']) - 1

    def acc(a, typ, comp=5126, bounds=False, target=None, normalized=False):
        dt = {5126: '<f4', 5123: '<u2', 5121: 'u1', 5125: '<u4'}[comp]
        a = np.ascontiguousarray(np.asarray(a, dtype=dt))
        item = {'bufferView': view(a.tobytes(), target), 'componentType': comp, 'count': int(a.shape[0]), 'type': typ}
        if normalized:
            item['normalized'] = True
        if bounds:
            item['min'] = np.min(a, axis=0).reshape(-1).astype(float).tolist()
            item['max'] = np.max(a, axis=0).reshape(-1).astype(float).tolist()
        doc['accessors'].append(item)
        return len(doc['accessors']) - 1

    for nm in ('color_B', 'normal', 'orm'):
        f = TEX / (nm + texsuffix + '.jpg')
        doc['images'].append({'name': nm, 'bufferView': view(f.read_bytes()), 'mimeType': 'image/jpeg'})
        doc['textures'].append({'sampler': 0, 'source': len(doc['images']) - 1})
    doc['materials'].append({'name': 'soldado', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicRoughnessTexture': {'index': 2},
                             'metallicFactor': 1, 'roughnessFactor': 1}, 'normalTexture': {'index': 1, 'scale': 1.0},
                             'occlusionTexture': {'index': 2, 'strength': 0.8}})
    # huesos
    nid = []
    for b, n in enumerate(sk.names):
        ni = len(doc['nodes'])
        nid.append(ni)
        doc['nodes'].append({'name': n, 'translation': sk.off0[b].tolist(), 'children': []})
        p = sk.parents[b]
        (doc['nodes'][0] if p < 0 else doc['nodes'][nid[p]])['children'].append(ni)
    Ra, pa = REST_ARMA
    arma_id = len(doc['nodes'])
    doc['nodes'].append({'name': 'arma', 'translation': pa.tolist(), 'rotation': quat(Ra).tolist(),
                         'extras': {'note': 'origen en la empuñadura del arma; +Z cañón, +Y arriba, -X derecha. Datos de cada arma en extras de la escena.'}})
    doc['nodes'][nid[sk.i['RightShoulder']]]['children'].append(arma_id)
    for side, short in (('Right', 'R'), ('Left', 'L')):
        soff, Rs = sk.sock[side]
        ni = len(doc['nodes'])
        doc['nodes'].append({'name': 'socket_arma_' + short, 'translation': soff.tolist(), 'rotation': quat(Rs).tolist(),
                             'extras': {'forward': '+Z', 'up': '+Y', 'purpose': 'grip' if short == 'R' else 'support'}})
        doc['nodes'][nid[sk.i[side + 'Hand']]]['children'].append(ni)
    ibm = []
    for p in sk.rest:
        m = np.eye(4)
        m[:3, 3] = -p
        ibm.append(m.T.reshape(-1))
    doc['skins'].append({'name': 'esqueleto', 'inverseBindMatrices': acc(ibm, 'MAT4'), 'joints': nid, 'skeleton': nid[0]})
    lod_nodes = []
    for i, L in enumerate(lod):
        uv = L['uv'].copy()
        uv[:, 1] = 1 - uv[:, 1]
        attrs = {'POSITION': acc(L['pos'], 'VEC3', bounds=True, target=34962), 'NORMAL': acc(L['nrm'], 'VEC3', target=34962),
                 'TANGENT': acc(L['tan'], 'VEC4', target=34962), 'TEXCOORD_0': acc(uv, 'VEC2', target=34962),
                 'JOINTS_0': acc(L['joints'], 'VEC4', 5121, target=34962), 'WEIGHTS_0': acc(L['weights'], 'VEC4', target=34962),
                 '_ZONE': acc(L['zone'], 'SCALAR', 5121, target=34962)}
        targets = [{'POSITION': acc(L['morph'][k], 'VEC3', bounds=True, target=34962)} for k in ('agachado', 'deslizar')]
        doc['meshes'].append({'name': 'personaje_LOD%d' % i, 'primitives': [{'attributes': attrs, 'indices': acc(L['idx'].reshape(-1), 'SCALAR', 5123, target=34963),
                              'material': 0, 'targets': targets}], 'weights': [0, 0], 'extras': {'targetNames': ['agachado', 'deslizar']}})
        ni = len(doc['nodes'])
        lod_nodes.append(ni)
        doc['nodes'].append({'name': 'personaje_LOD%d' % i, 'mesh': i, 'skin': 0, 'extras': {'lod': i, 'triangles': int(len(L['idx']))}})
        doc['nodes'][0]['children'].append(ni)
    # animaciones
    for name, (times, frames) in sampled.items():
        c = CLIPS[name]
        ti = acc(np.array(times)[:, None], 'SCALAR', bounds=True)
        an = {'name': name, 'samplers': [], 'channels': [],
              'extras': {'loop': c['loop'], 'duration': c['duration'], 'speed': c['speed'], 'layer': c['layer'], 'fps': FPS}}

        def channel(node, path, values, typ):
            s = len(an['samplers'])
            an['samplers'].append({'input': ti, 'output': acc(values, typ), 'interpolation': 'LINEAR'})
            an['channels'].append({'sampler': s, 'target': {'node': node, 'path': path}})

        for b in range(sk.n):
            q = np.array([quat(P.L[b]) for P in frames])
            for k in range(1, len(q)):
                if np.dot(q[k - 1], q[k]) < 0:
                    q[k] = -q[k]
            channel(nid[b], 'rotation', q, 'VEC4')
            if b in var_t:
                tr = np.array([P.off[b] + (P.hips if sk.names[b] == 'Hips' else 0) for P in frames])
                channel(nid[b], 'translation', tr, 'VEC3')
        qa = np.array([quat(P.arma[0]) for P in frames])
        for k in range(1, len(qa)):
            if np.dot(qa[k - 1], qa[k]) < 0:
                qa[k] = -qa[k]
        channel(arma_id, 'rotation', qa, 'VEC4')
        channel(arma_id, 'translation', np.array([P.arma[1] for P in frames]), 'VEC3')
        w = np.array([[P.morph['agachado'], P.morph['deslizar']] for P in frames]).reshape(-1)
        for ni in lod_nodes:
            channel(ni, 'weights', w[:, None], 'SCALAR')
        doc['animations'].append(an)
    doc['scenes'][0]['extras'] = {'weapons': {k: {kk: vv for kk, vv in v.items()} for k, v in WEAPONS.items()},
                                  'clips': {n: {'loop': c['loop'], 'duration': c['duration'], 'speed': c['speed'], 'layer': c['layer']} for n, c in CLIPS.items()},
                                  'lower': ['Root', 'Hips', 'Spine', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'],
                                  'heightMorphs': {'agachado': K_CROUCH, 'deslizar': K_SLIDE}}
    doc['buffers'][0]['byteLength'] = len(data)
    j = json.dumps(doc, separators=(',', ':')).encode()
    j += b' ' * ((-len(j)) % 4)
    while len(data) % 4:
        data.append(0)
    blob = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(data)) + struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(data), 0x004E4942) + bytes(data)
    path.write_bytes(blob)
    print(path.name, len(blob), 'bytes', hashlib.sha256(blob).hexdigest()[:16])


write(REV / 'personaje.glb', '')
write(REV / 'personaje_1k.glb', '_1k')
