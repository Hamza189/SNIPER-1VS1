"""Read every triangle of a GLB (node transforms applied) without extra dependencies → {mesh name: (N,3,3) float32}."""
import json, struct, numpy as np
CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
def load(path):
    b = open(path, 'rb').read()
    jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl]); bin0 = 20 + jl + 8
    def acc(i):
        a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
        off = bin0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0); n = NC[a['type']]; dt = np.dtype(CT[a['componentType']])
        stride = bv.get('byteStride', 0) or dt.itemsize * n
        raw = np.frombuffer(b, dtype=np.uint8, count=stride * (a['count'] - 1) + dt.itemsize * n, offset=off)
        out = np.lib.stride_tricks.as_strided(raw, shape=(a['count'], dt.itemsize * n), strides=(stride, 1)).copy().view(dt).reshape(a['count'], n)
        return out
    def mat(n):
        if 'matrix' in n: return np.array(n['matrix'], float).reshape(4, 4).T
        M = np.eye(4); t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
        x, y, z, w = r
        R = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
        M[:3, :3] = R * np.array(s); M[:3, 3] = t; return M
    out = {}; mats = {}
    def walk(i, P):
        n = j['nodes'][i]; M = P @ mat(n)
        if 'mesh' in n:
            for pr in j['meshes'][n['mesh']]['primitives']:
                p = acc(pr['attributes']['POSITION']).astype(float); p = (np.c_[p, np.ones(len(p))] @ M.T)[:, :3]
                idx = acc(pr['indices']).ravel() if 'indices' in pr else np.arange(len(p))
                t = p[idx].reshape(-1, 3, 3).astype(np.float32); nm = n.get('name', 'm%d' % i)
                out[nm] = np.concatenate([out[nm], t]) if nm in out else t
                mats[nm] = j['materials'][pr['material']]['name'] if 'material' in pr else None
        for c in n.get('children', []): walk(c, M)
    for r in j['scenes'][j.get('scene', 0)]['nodes']: walk(r, np.eye(4))
    return out, mats, j
