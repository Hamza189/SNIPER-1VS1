"""Connected pieces of each GLB mesh (shared vertices) with their bounding boxes, and which collision box covers them."""
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); import glbtris
def pieces(t):
    v = np.round(t.reshape(-1, 3), 4); _, inv = np.unique(v, axis=0, return_inverse=True); inv = inv.reshape(-1, 3)
    par = list(range(inv.max() + 1))
    def f(a):
        while par[a] != a: par[a] = par[par[a]]; a = par[a]
        return a
    for a, b, c in inv: par[f(b)] = f(a); par[f(c)] = f(a)
    groups = {}
    for i, tri in enumerate(inv): groups.setdefault(f(tri[0]), []).append(i)
    return [t[g].reshape(-1, 3) for g in groups.values()]
def merge_boxes(bs, gap=0.02):
    bs = [list(b) for b in bs]; ch = True
    while ch:
        ch = False
        for i in range(len(bs)):
            for k in range(i + 1, len(bs)):
                a, b = bs[i], bs[k]
                if all(a[0][d] <= b[1][d] + gap and b[0][d] <= a[1][d] + gap for d in range(3)):
                    bs[i] = [np.minimum(a[0], b[0]), np.maximum(a[1], b[1])]; bs.pop(k); ch = True; break
            if ch: break
    return bs
if __name__ == '__main__':
    T, M, _ = glbtris.load(sys.argv[1]); D = json.load(open(sys.argv[2]))
    C = [(c['name'], np.array(c['center']) - np.array(c['size']) / 2, np.array(c['center']) + np.array(c['size']) / 2) for c in D['colliders']]
    allb = []
    for name, t in T.items():
        if not name.startswith('furniture__') and not name.startswith('details__'): continue
        for p in pieces(t): allb.append((p.min(0), p.max(0)))
    for lo, hi in merge_boxes(allb, 0.03):
        sz = hi - lo
        if sz[1] < 0.3 or max(sz[0], sz[2]) < 0.3: continue
        cov = [n for n, a, b in C if (np.minimum(hi, b) - np.maximum(lo, a) > -0.02).all()]
        print(f"{'  ' if cov else 'SIN CAJA'} x {lo[0]:6.2f}..{hi[0]:6.2f}  y {lo[1]:4.2f}..{hi[1]:4.2f}  z {lo[2]:6.2f}..{hi[2]:6.2f}  {','.join(sorted(set(cov)))[:60]}")
