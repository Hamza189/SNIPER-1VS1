"""Versión KTX2 de los personajes realistas (docs/KTX2.md): las mismas texturas a la misma resolución (4K en S.W.A.T. y
FSB, 2K en MILITAR y SOLDADO), comprimidas para la GPU (UASTC: ASTC en el iPhone, BC7 en PC). Ocupan 1 byte por píxel en
memoria gráfica en vez de 4: un personaje de 4K cabe en lo que hoy ocupa uno de 2K.

Por cada personaje escribe, junto a los originales (que no se tocan):
  personaje_ktx2.glb       el mismo modelo con sus 3 texturas (color, normales, rugosidad/metal) en KTX2
                           (extensión KHR_texture_basisu, la que lee GLTFLoader con un KTX2Loader)
  color_<A|B|bots>_ktx2.ktx2   los colores de cada aspecto
El juego solo los usa con ?ktx2=1 mientras se compara.

  python3 tools/ktx2/make.py [op2 op3 op4 v2] [--rdo 1.0] [--level 2]
Necesita Pillow y Node (el codificador es tools/ktx2/encode.js)."""
import io, json, os, struct, subprocess, sys, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PACKS = {'op2': 'assets/personaje/pro/op2/', 'op3': 'assets/personaje/pro/op3/', 'op4': 'assets/personaje/pro/op4/', 'v2': 'assets/personaje/'}


def read_glb(p):
    b = open(p, 'rb').read()
    off, J, BIN = 12, None, b''
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off)
        ch = b[off + 8: off + 8 + ln]
        if ty == 0x4E4F534A:
            J = json.loads(ch)
        elif ty == 0x004E4942:
            BIN = ch
        off += 8 + ln
    return J, BIN


def write_glb(p, J, BIN):
    js = json.dumps(J, separators=(',', ':')).encode('utf-8')
    js += b' ' * ((4 - len(js) % 4) % 4)
    BIN = bytes(BIN) + b'\0' * ((4 - len(BIN) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(BIN)
    with open(p, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(BIN), 0x004E4942)); f.write(BIN)


def kinds(J):
    """qué es cada imagen: color (sRGB), normales o rugosidad/metal (lineal)"""
    k = {}
    src = lambda ti: J['textures'][ti]['source']
    for m in J.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})
        if 'baseColorTexture' in pbr: k[src(pbr['baseColorTexture']['index'])] = 'srgb'
        if 'metallicRoughnessTexture' in pbr: k[src(pbr['metallicRoughnessTexture']['index'])] = 'linear'
        if 'normalTexture' in m: k[src(m['normalTexture']['index'])] = 'normal'
        if 'occlusionTexture' in m: k.setdefault(src(m['occlusionTexture']['index']), 'linear')
    return k


def main():
    args = sys.argv[1:]
    rdo = float(args[args.index('--rdo') + 1]) if '--rdo' in args else 1.0
    level = int(args[args.index('--level') + 1]) if '--level' in args else 2
    names = [a for a in args if a in PACKS] or list(PACKS)
    tmp = tempfile.mkdtemp(prefix='ktx2_')
    for name in names:
        d = os.path.join(ROOT, PACKS[name])
        J, BIN = read_glb(os.path.join(d, 'personaje.glb'))
        kind = kinds(J)
        jobs, outs = [], {}
        for i, im in enumerate(J['images']):
            bv = J['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0)
            pic = Image.open(io.BytesIO(BIN[o:o + bv['byteLength']]))
            png = os.path.join(tmp, '%s_img%d.png' % (name, i)); pic.convert('RGBA' if pic.mode in ('RGBA', 'LA', 'P') else 'RGB').save(png)
            outs[i] = os.path.join(tmp, '%s_img%d.ktx2' % (name, i))
            jobs.append({'in': png, 'out': outs[i], 'kind': kind.get(i, 'srgb'), 'rdo': rdo, 'level': level})
            print('%s - imagen %d: %s %dx%d' % (name, i, kind.get(i, 'srgb'), pic.width, pic.height))
        for v in ('A', 'B', 'bots'):
            f = os.path.join(d, 'color_%s.jpg' % v)
            if not os.path.exists(f): continue
            png = os.path.join(tmp, '%s_color_%s.png' % (name, v)); Image.open(f).convert('RGB').save(png)
            jobs.append({'in': png, 'out': os.path.join(d, 'color_%s_ktx2.ktx2' % v), 'kind': 'srgb', 'rdo': rdo, 'level': level})
        jf = os.path.join(tmp, name + '_jobs.json'); json.dump(jobs, open(jf, 'w'))
        subprocess.run(['node', os.path.join(ROOT, 'tools', 'ktx2', 'encode.js'), jf], check=True)
        # the same GLB with the images in KTX2: geometry, skin, animations and materials untouched
        img_bv = {im['bufferView'] for im in J['images']}
        nb, NB, remap = [], bytearray(), {}
        def put(data):
            NB.extend(b'\0' * ((4 - len(NB) % 4) % 4)); off = len(NB); NB.extend(data); return off
        for idx, bv in enumerate(J['bufferViews']):
            if idx in img_bv: continue
            o = bv.get('byteOffset', 0); v = dict(bv); v['byteOffset'] = put(BIN[o:o + bv['byteLength']]); v['buffer'] = 0
            remap[idx] = len(nb); nb.append(v)
        for i, im in enumerate(J['images']):
            data = open(outs[i], 'rb').read()
            nb.append({'buffer': 0, 'byteOffset': put(data), 'byteLength': len(data)})
            J['images'][i] = {'bufferView': len(nb) - 1, 'mimeType': 'image/ktx2'}
        for a in J.get('accessors', []):
            if 'bufferView' in a: a['bufferView'] = remap[a['bufferView']]
            sp = a.get('sparse')
            if sp:
                sp['indices']['bufferView'] = remap[sp['indices']['bufferView']]; sp['values']['bufferView'] = remap[sp['values']['bufferView']]
        J['bufferViews'] = nb; J['buffers'] = [{'byteLength': len(NB)}]
        for t in J['textures']:
            t['extensions'] = dict(t.get('extensions', {}), KHR_texture_basisu={'source': t.pop('source')})
        J['extensionsUsed'] = sorted(set(J.get('extensionsUsed', [])) | {'KHR_texture_basisu'})
        J['extensionsRequired'] = sorted(set(J.get('extensionsRequired', [])) | {'KHR_texture_basisu'})
        out = os.path.join(d, 'personaje_ktx2.glb'); write_glb(out, J, NB)
        print('%s -> %s (%.1f MB; el original %.1f MB)' % (name, os.path.relpath(out, ROOT), os.path.getsize(out) / 1048576, os.path.getsize(os.path.join(d, 'personaje.glb')) / 1048576))


if __name__ == '__main__':
    main()
