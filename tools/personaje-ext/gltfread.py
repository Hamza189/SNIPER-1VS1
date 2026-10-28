"""Lector de glTF 2.0 (.gltf + .bin o .glb) para tools/personaje-ext, sin Blender: numpy en doble precisión.

Devuelve el personaje en la pose de la escena (la que dibuja cualquier visor): la piel se aplica aquí con las matrices
de cada hueso (mundo · inverseBindMatrix) en doble precisión, y las mallas que cuelgan de un hueso se colocan con su
nodo. Así todo queda en el mismo espacio y en metros aunque el exportador guarde la pose de enlace en otras unidades
(Sketchfab deja algunos esqueletos a ~10^6 unidades por metro, donde los floats de 32 bits de Blender pierden centímetros).
  joints: {nombre: {'pos': (3,), 'parent': nombre|None}}
  corners: P (n,3), N (n,3), UV (n,2), W (n, njoints) por esquina de triángulo; F (t,3); FM (t,) índice de material
  mats: [{'name', 'color', 'colorFactor', 'normal', 'mr' (G rugosidad, B metal), 'roughness', 'metallic', 'ao', 'alpha'}]
  meshes: [{'name', 'chain' (nombres de nodos hasta la raíz), 'rigid' (nodo hueso o None), 'tris'}]
Las mallas sin piel que cuelgan de un hueso (ojos, bolsas, armas de exhibición) se colocan con la matriz de enlace
de ese hueso y llevan todo su peso a él.
"""
import json, struct, base64, os
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def _load(path):
    if path.lower().endswith('.glb'):
        b = open(path, 'rb').read()
        off, J, BIN = 12, None, None
        while off < len(b):
            ln, ty = struct.unpack_from('<II', b, off)
            ch = b[off + 8: off + 8 + ln]
            if ty == 0x4E4F534A:
                J = json.loads(ch)
            elif ty == 0x004E4942:
                BIN = ch
            off += 8 + ln
        bufs = [BIN]
    else:
        J = json.load(open(path, encoding='utf-8'))
        bufs = []
        for bf in J['buffers']:
            u = bf['uri']
            if u.startswith('data:'):
                bufs.append(base64.b64decode(u.split(',', 1)[1]))
            else:
                bufs.append(open(os.path.join(os.path.dirname(path), u), 'rb').read())
    return J, bufs


def _acc(J, bufs, i):
    a = J['accessors'][i]
    n = NC[a['type']]
    dt = CT[a['componentType']]
    cnt = a['count']
    if 'bufferView' not in a:
        out = np.zeros((cnt, n), dt)
    else:
        bv = J['bufferViews'][a['bufferView']]
        buf = bufs[bv['buffer']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        isz = np.dtype(dt).itemsize
        stride = bv.get('byteStride', isz * n)
        raw = np.frombuffer(buf, np.uint8, count=stride * (cnt - 1) + isz * n, offset=off)
        if stride == isz * n:
            out = raw.view(dt).reshape(cnt, n).copy()
        else:
            out = np.lib.stride_tricks.as_strided(raw, (cnt, isz * n), (stride, 1)).copy().view(dt).reshape(cnt, n)
    if a.get('normalized') and dt != np.float32:
        out = out.astype(np.float64) / np.iinfo(dt).max
    if 'sparse' in a:
        sp = a['sparse']
        idx = _acc_raw(J, bufs, sp['indices'], sp['count'], 1)
        val = _acc_raw(J, bufs, sp['values'], sp['count'], n, a['componentType'])
        out = out.astype(np.float64)
        out[idx.reshape(-1)] = val
    return out.astype(np.float64) if dt == np.float32 else out


def _acc_raw(J, bufs, s, cnt, n, ct=None):
    bv = J['bufferViews'][s['bufferView']]
    dt = CT[ct if ct else s['componentType']]
    off = bv.get('byteOffset', 0) + s.get('byteOffset', 0)
    return np.frombuffer(bufs[bv['buffer']], dt, count=cnt * n, offset=off).reshape(cnt, n)


def _q2m(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def _local(nd):
    if 'matrix' in nd:
        return np.array(nd['matrix'], float).reshape(4, 4).T
    M = np.eye(4)
    R = _q2m(nd.get('rotation', [0, 0, 0, 1]))
    S = np.diag(nd.get('scale', [1, 1, 1]))
    M[:3, :3] = R @ S
    M[:3, 3] = nd.get('translation', [0, 0, 0])
    return M


def read(path):
    J, bufs = _load(path)
    nodes = J['nodes']
    parent = {}
    for i, nd in enumerate(nodes):
        for c in nd.get('children', []):
            parent[c] = i
    name = lambda i: nodes[i].get('name', 'node%d' % i)
    def chain(i):
        out = []
        while i is not None:
            out.append(name(i)); i = parent.get(i)
        return out
    skins = J.get('skins', [])
    if not skins:
        raise SystemExit('el glTF no tiene esqueleto (skins)')
    # el esqueleto con más huesos
    sk = max(skins, key=lambda s: len(s['joints']))
    jn = sk['joints']
    ibm = _acc(J, bufs, sk['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1) if 'inverseBindMatrices' in sk else np.tile(np.eye(4), (len(jn), 1, 1))
    def nworld(i):
        M = np.eye(4)
        while i is not None:
            M = _local(nodes[i]) @ M; i = parent.get(i)
        return M
    WJ_ = np.array([nworld(n) for n in jn])           # cada hueso en la pose de la escena
    SKIN = WJ_ @ ibm                                  # matriz de piel de cada hueso
    jidx = {n: k for k, n in enumerate(jn)}
    joints = {}
    for k, n in enumerate(jn):
        p = parent.get(n)
        while p is not None and p not in jidx:
            p = parent.get(p)
        joints[name(n)] = {'pos': WJ_[k][:3, 3].copy(), 'parent': name(p) if p is not None else None, 'node': n}
    jnames = [name(n) for n in jn]
    # dedos y puntas que no deforman pero existen como nodos hijos de un hueso: también se registran (posición por jerarquía)
    def world_of(i):
        """(matriz del nodo en la escena, hueso del que cuelga) o (None, None) si no cuelga de ningún hueso"""
        q = i
        while q is not None and q not in jidx:
            q = parent.get(q)
        if q is None:
            return None, None
        return nworld(i), name(q)

    # materiales
    imgs = J.get('images', [])
    texs = J.get('textures', [])
    def tex_uri(t):
        if not t:
            return None
        src = texs[t['index']].get('source')
        if src is None:
            return None
        im = imgs[src]
        if 'uri' in im:
            return os.path.join(os.path.dirname(path), im['uri'].replace('%20', ' '))
        return ('bufferView', im['bufferView'], im.get('mimeType', 'image/png'))
    mats = []
    for m in J.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})
        tr = m.get('extensions', {}).get('KHR_materials_transmission', {})
        bcf = pbr.get('baseColorFactor', [1, 1, 1, 1])
        mats.append({'name': m.get('name', 'mat%d' % len(mats)), 'color': tex_uri(pbr.get('baseColorTexture')),
                     'trans': tex_uri(tr.get('transmissionTexture')), 'transFactor': tr.get('transmissionFactor', 0.0),
                     'alphaFactor': bcf[3] if len(bcf) > 3 else 1.0, 'cutoff': m.get('alphaCutoff', 0.5), 'double': bool(m.get('doubleSided')),
                     'colorFactor': pbr.get('baseColorFactor', [1, 1, 1, 1])[:3], 'normal': tex_uri(m.get('normalTexture')),
                     'mr': tex_uri(pbr.get('metallicRoughnessTexture')), 'roughness': pbr.get('roughnessFactor', 1.0),
                     'metallic': pbr.get('metallicFactor', 1.0), 'ao': tex_uri(m.get('occlusionTexture')),
                     'alpha': m.get('alphaMode', 'OPAQUE'), 'bufs': bufs, 'J': None})

    P, N, UV, W, F, FM, meshes = [], [], [], [], [], [], []
    nj = len(jn)
    for ni, nd in enumerate(nodes):
        if 'mesh' not in nd:
            continue
        skinned = 'skin' in nd
        if skinned and J['skins'][nd['skin']] is not sk:
            continue
        if skinned:
            M = np.eye(4); rigid = None
        else:
            M, rigid = world_of(ni)
            if M is None:
                continue                                # ni piel ni cuelga de un hueso: no es del personaje
        R3 = np.linalg.inv(M[:3, :3]).T
        tris_here = 0
        for pr in J['meshes'][nd['mesh']]['primitives']:
            if pr.get('mode', 4) != 4:
                continue
            at = pr['attributes']
            pos = _acc(J, bufs, at['POSITION'])
            nrm = _acc(J, bufs, at['NORMAL']) if 'NORMAL' in at else None
            uv = _acc(J, bufs, at['TEXCOORD_0']) if 'TEXCOORD_0' in at else np.zeros((len(pos), 2))
            idx = _acc(J, bufs, pr['indices']).reshape(-1) if 'indices' in pr else np.arange(len(pos))
            tri = idx.reshape(-1, 3)
            w = np.zeros((len(pos), nj))
            if skinned:
                k = 0
                while 'JOINTS_%d' % k in at:
                    jj = _acc(J, bufs, at['JOINTS_%d' % k]).astype(int)
                    ww = _acc(J, bufs, at['WEIGHTS_%d' % k]).astype(float)
                    for c in range(jj.shape[1]):
                        np.add.at(w, (np.arange(len(pos)), jj[:, c]), ww[:, c])
                    k += 1
                w /= np.maximum(w.sum(1), 1e-12)[:, None]
                # piel: suma ponderada de las matrices de los huesos (solo los que pesan)
                p4 = np.c_[pos, np.ones(len(pos))]
                pw = np.zeros((len(pos), 3)); R3s = np.zeros((len(pos), 3, 3))
                for j in np.where(w.max(0) > 0)[0]:
                    wj = w[:, j][:, None]
                    pw += wj * (p4 @ SKIN[j].T)[:, :3]
                    R3s += w[:, j][:, None, None] * SKIN[j][:3, :3]
            else:
                w[:, jnames.index(rigid)] = 1
                p4 = np.c_[pos, np.ones(len(pos))] @ M.T
                pw = p4[:, :3]
                R3s = None
            if nrm is None:
                nrm = np.zeros_like(pos)
                fn = np.cross(pw[tri[:, 1]] - pw[tri[:, 0]], pw[tri[:, 2]] - pw[tri[:, 0]])
                for c in range(3):
                    np.add.at(nrm, tri[:, c], fn)
                nw = nrm
            elif R3s is not None:
                nw = np.einsum('nij,nj->ni', np.linalg.inv(R3s).transpose(0, 2, 1), nrm)
            else:
                nw = nrm @ R3.T
            nw = nw / np.maximum(np.linalg.norm(nw, axis=1), 1e-12)[:, None]
            mi = pr.get('material', -1)
            base = len(P) and sum(len(x) for x in P)
            P.append(pw[tri.reshape(-1)]); N.append(nw[tri.reshape(-1)]); UV.append(uv[tri.reshape(-1)]); W.append(w[tri.reshape(-1)])
            n0 = base if isinstance(base, int) else 0
            F.append(np.arange(len(tri) * 3).reshape(-1, 3) + n0)
            FM.append(np.full(len(tri), mi))
            tris_here += len(tri)
        meshes.append({'name': name(ni), 'chain': chain(ni), 'rigid': rigid, 'tris': tris_here, 'skinned': skinned})
    out = {'joints': joints, 'jnames': jnames, 'P': np.concatenate(P), 'N': np.concatenate(N), 'UV': np.concatenate(UV), 'W': np.concatenate(W),
           'F': np.concatenate(F), 'FM': np.concatenate(FM), 'mats': mats, 'meshes': meshes, 'J': J, 'bufs': bufs}
    # para quitar mallas: rango de triángulos de cada una (en el mismo orden)
    t0 = 0
    for m in meshes:
        m['t0'], m['t1'] = t0, t0 + m['tris']; t0 += m['tris']
    # nodos hijos de huesos (dedos sin peso, puntas): posición por jerarquía, para buscar dedos
    extra = {}
    for i, nd in enumerate(nodes):
        nm = name(i)
        if nm in joints or 'mesh' in nd:
            continue
        Mw, b = world_of(i)
        if Mw is not None:
            extra[nm] = {'pos': Mw[:3, 3].copy(), 'parent': b}
    out['extra'] = extra
    return out
