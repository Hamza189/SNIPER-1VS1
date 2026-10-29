"""Versión KTX2 de los personajes realistas y de los aspectos de arma (docs/KTX2.md): las mismas texturas, comprimidas
para la GPU (UASTC: ASTC en el iPhone, BC7 en PC). Ocupan 1 byte por píxel en memoria gráfica en vez de 4: una textura
de 4K cabe en lo que hoy ocupa una de 2K.

Personajes (op2 op3 op4 v2), a la misma resolución que sus JPG (4K en S.W.A.T. y FSB, 2K en MILITAR y SOLDADO). Por cada
uno escribe, junto a los originales (que no se tocan):
  personaje_ktx2.glb       el mismo modelo con sus 3 texturas (color, normales, rugosidad/metal) en KTX2
                           (extensión KHR_texture_basisu, la que lee GLTFLoader con un KTX2Loader)
  color_<A|B|bots>_ktx2.ktx2   los colores de cada aspecto

Aspectos de arma (titan ratio vector lince tactica), a la resolución MÁXIMA de su original (29-10-2026, «todo en 4K y
en su máxima resolución»): el arma.glb del juego lleva texturas de 2K (1K el cuchillo) porque sin comprimir no cabían;
aquí cada textura se vuelve a coger del original (tools/arma-ext/.work/<id>/src, mismo nombre) a su tamaño real (4K en
ÚLTIMA y VECTOR, 4K/2K en TITÁN, 2K en SAHARA y TÁCTICA). Antes se comprueba que sea la misma imagen. Escribe
  arma_ktx2.glb            la misma geometría que arma.glb (no pasa por Blender), sin las texturas que three r128 no usa
                           (KHR_materials_specular); cada material lleva en extras.lum el brillo medio de su color (el
                           camuflaje lo necesita y no puede leer una textura comprimida)
  ktx2/<nombre>.<hash>.ktx2  sus texturas, cada una en su archivo (ÚLTIMA son ~180 MB: un solo archivo pasaría del
                           límite de GitHub, y el móvil las pide de una en una)
Las texturas ya codificadas se guardan en .work/ktx2-cache (no se repite el trabajo si no cambia la imagen ni el ajuste).

  python3 tools/ktx2/make.py [op2 op3 op4 v2 titan ratio vector lince tactica] [--rdo 1.0] [--level 2] [--jobs 4]
Necesita Pillow, numpy y Node (el codificador es tools/ktx2/encode.js)."""
import hashlib, io, json, os, re, shutil, struct, subprocess, sys, tempfile
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PACKS = {'op2': 'assets/personaje/pro/op2/', 'op3': 'assets/personaje/pro/op3/', 'op4': 'assets/personaje/pro/op4/', 'v2': 'assets/personaje/'}
ARMAS = {k: 'assets/armas/%s/' % k for k in ('titan', 'ratio', 'vector', 'lince', 'tactica')}
ARMA_SRC = os.path.join(ROOT, 'tools', 'arma-ext', '.work')


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


SLOTS = (('pbr', 'baseColorTexture'), ('pbr', 'metallicRoughnessTexture'), ('m', 'normalTexture'), ('m', 'occlusionTexture'), ('m', 'emissiveTexture'))


def slot_refs(m):
    """the texture references three r128 reads from a material: (dict, key)"""
    pbr = m.get('pbrMetallicRoughness', {})
    return [(pbr if w == 'pbr' else m, k) for w, k in SLOTS if k in (pbr if w == 'pbr' else m)]


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
        if 'emissiveTexture' in m: k.setdefault(src(m['emissiveTexture']['index']), 'srgb')
    return k


def image_bytes(J, BIN, i):
    bv = J['bufferViews'][J['images'][i]['bufferView']]; o = bv.get('byteOffset', 0)
    return BIN[o:o + bv['byteLength']]


CACHE = os.path.join(ROOT, '.work', 'ktx2-cache')


def job_key(j):
    return hashlib.sha1(open(j['in'], 'rb').read() + json.dumps([j['kind'], j['rdo'], j['level']]).encode()).hexdigest()


def encode(jobs, tmp, tag, n):
    """runs encode.js in n processes at once (each texture is independent); a texture already encoded from the same
    picture with the same settings comes from .work/ktx2-cache (a 4K one takes ~10 min)"""
    os.makedirs(CACHE, exist_ok=True)
    todo = []
    for j in jobs:
        c = os.path.join(CACHE, job_key(j) + '.ktx2')
        if os.path.exists(c): shutil.copyfile(c, j['out'])
        else: todo.append(j)
    print('%s: %d texturas, %d ya codificadas' % (tag, len(jobs), len(jobs) - len(todo)))
    if todo: run_encoder(todo, tmp, tag, n)
    for j in todo: shutil.copyfile(j['out'], os.path.join(CACHE, job_key(j) + '.ktx2'))


def run_encoder(jobs, tmp, tag, n):
    n = max(1, min(n, len(jobs)))
    procs = []
    for k in range(n):
        part = jobs[k::n]
        jf = os.path.join(tmp, '%s_jobs%d.json' % (tag, k)); json.dump(part, open(jf, 'w'))
        procs.append(subprocess.Popen(['node', os.path.join(ROOT, 'tools', 'ktx2', 'encode.js'), jf]))
    if any(p.wait() for p in procs):
        raise SystemExit('el codificador falló (%s)' % tag)


def repack(J, BIN, outs, out, drop=(), apart=None):
    """the same GLB with the images in KTX2: geometry, skin, animations and materials untouched (drop: bufferViews of
    images left out). apart: folder name next to the GLB where each image goes as its own file (named by its content,
    so a cached old one is never used) instead of inside the GLB"""
    img_bv = {im['bufferView'] for im in J['images']} | set(drop)
    nb, NB, remap = [], bytearray(), {}
    def put(data):
        NB.extend(b'\0' * ((4 - len(NB) % 4) % 4)); off = len(NB); NB.extend(data); return off
    for idx, bv in enumerate(J['bufferViews']):
        if idx in img_bv: continue
        o = bv.get('byteOffset', 0); v = dict(bv); v['byteOffset'] = put(BIN[o:o + bv['byteLength']]); v['buffer'] = 0
        remap[idx] = len(nb); nb.append(v)
    if apart:
        dd = os.path.join(os.path.dirname(out), apart)
        if os.path.isdir(dd): shutil.rmtree(dd)
        os.makedirs(dd)
    for i, im in enumerate(J['images']):
        data = open(outs[i], 'rb').read()
        if apart:
            fn = '%s.%s.ktx2' % (re.sub(r'[^A-Za-z0-9_-]+', '_', im.get('name', 'img%d' % i)), hashlib.sha1(data).hexdigest()[:8])
            open(os.path.join(dd, fn), 'wb').write(data)
            J['images'][i] = dict({'name': im['name']} if 'name' in im else {}, uri=apart + '/' + fn, mimeType='image/ktx2')
            continue
        nb.append({'buffer': 0, 'byteOffset': put(data), 'byteLength': len(data)})
        J['images'][i] = dict({'name': im['name']} if 'name' in im else {}, bufferView=len(nb) - 1, mimeType='image/ktx2')
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
    write_glb(out, J, NB)


def pack_personaje(name, rdo, level, n, tmp):
    d = os.path.join(ROOT, PACKS[name])
    J, BIN = read_glb(os.path.join(d, 'personaje.glb'))
    kind = kinds(J)
    jobs, outs = [], {}
    for i, im in enumerate(J['images']):
        pic = Image.open(io.BytesIO(image_bytes(J, BIN, i)))
        png = os.path.join(tmp, '%s_img%d.png' % (name, i)); pic.convert('RGBA' if pic.mode in ('RGBA', 'LA', 'P') else 'RGB').save(png)
        outs[i] = os.path.join(tmp, '%s_img%d.ktx2' % (name, i))
        jobs.append({'in': png, 'out': outs[i], 'kind': kind.get(i, 'srgb'), 'rdo': rdo, 'level': level})
        print('%s - imagen %d: %s %dx%d' % (name, i, kind.get(i, 'srgb'), pic.width, pic.height))
    for v in ('A', 'B', 'bots'):
        f = os.path.join(d, 'color_%s.jpg' % v)
        if not os.path.exists(f): continue
        png = os.path.join(tmp, '%s_color_%s.png' % (name, v)); Image.open(f).convert('RGB').save(png)
        jobs.append({'in': png, 'out': os.path.join(d, 'color_%s_ktx2.ktx2' % v), 'kind': 'srgb', 'rdo': rdo, 'level': level})
    encode(jobs, tmp, name, n)
    out = os.path.join(d, 'personaje_ktx2.glb'); repack(J, BIN, outs, out)
    print('%s -> %s (%.1f MB; el original %.1f MB)' % (name, os.path.relpath(out, ROOT), os.path.getsize(out) / 1048576, os.path.getsize(os.path.join(d, 'personaje.glb')) / 1048576))


def psnr(a, b):
    e = np.mean((a.astype(np.float64) - b.astype(np.float64)) ** 2)
    return 99.0 if e == 0 else 10 * np.log10(255.0 ** 2 / e)


def pack_arma(name, rdo, level, n, tmp):
    d = os.path.join(ROOT, ARMAS[name])
    J, BIN = read_glb(os.path.join(d, 'arma.glb'))
    # only the textures three r128 reads (the KHR_materials_specular ones would be downloaded for nothing)
    for m in J.get('materials', []):
        sp = m.get('extensions', {}).get('KHR_materials_specular')
        if sp:
            sp.pop('specularTexture', None); sp.pop('specularColorTexture', None)
    keep_t = sorted({r[k]['index'] for m in J.get('materials', []) for r, k in slot_refs(m)})
    tmap = {o: i for i, o in enumerate(keep_t)}
    keep_i = sorted({J['textures'][t]['source'] for t in keep_t})
    imap = {o: i for i, o in enumerate(keep_i)}
    for m in J.get('materials', []):
        for r, k in slot_refs(m):
            r[k]['index'] = tmap[r[k]['index']]
    J['textures'] = [dict(J['textures'][t], source=imap[J['textures'][t]['source']]) for t in keep_t]
    old = J['images']; J['images'] = [old[i] for i in keep_i]
    drop = [im['bufferView'] for i, im in enumerate(old) if i not in imap]
    srcs = {}
    for root, _, files in os.walk(os.path.join(ARMA_SRC, name, 'src')):
        for f in files:
            st, ext = os.path.splitext(f)
            if ext.lower() in ('.png', '.jpg', '.jpeg'): srcs[st] = os.path.join(root, f)
    kind = kinds(J)
    jobs, outs = [], {}
    for i, im in enumerate(J['images']):
        small = Image.open(io.BytesIO(image_bytes(J, BIN, i))).convert('RGB')
        f = srcs.get(im.get('name'))
        pic = Image.open(f) if f else None
        if pic is not None:
            pic = pic.convert('RGB')
            # the same picture? (Blender may rebuild an image when it exports: then the one in arma.glb is the truth).
            # Compared at 256 px: fine detail (normal maps) differs by the JPG and the scaling filter, not by the picture
            q = psnr(np.asarray(pic.resize((256, 256), Image.BOX)), np.asarray(small.resize((256, 256), Image.BOX)))
            if q < 30:
                print('  %s: el original no coincide (%.1f dB), se usa el de arma.glb' % (im.get('name'), q)); pic = None
        if pic is None: pic = small
        png = os.path.join(tmp, '%s_img%d.png' % (name, i)); pic.save(png)
        outs[i] = os.path.join(tmp, '%s_img%d.ktx2' % (name, i))
        jobs.append({'in': png, 'out': outs[i], 'kind': kind.get(i, 'srgb'), 'rdo': rdo, 'level': level})
        print('%s - %s: %s %dx%d (en arma.glb %dx%d)' % (name, im.get('name'), kind.get(i, 'srgb'), pic.width, pic.height, small.width, small.height))
    # brightness of each colour map, linear and averaged (what client/camo.js detail() measures on a JPG)
    for m in J.get('materials', []):
        ct = m.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if ct is None: continue
        px = np.asarray(Image.open(io.BytesIO(image_bytes(J, BIN, J['textures'][ct['index']]['source']))).convert('RGB').resize((16, 16), Image.BOX), dtype=np.float64) / 255
        lin = px ** 2.2
        m.setdefault('extras', {})['lum'] = round(float(np.mean(0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2])), 5)
    encode(jobs, tmp, name, n)
    # the textures as files of their own next to the model: no file near GitHub's 100 MB limit (ÚLTIMA is ~180 MB in all),
    # and the game can fetch them one at a time on a phone (little memory at once)
    out = os.path.join(d, 'arma_ktx2.glb'); repack(J, BIN, outs, out, drop, apart='ktx2')
    tot = os.path.getsize(out) + sum(os.path.getsize(os.path.join(d, 'ktx2', f)) for f in os.listdir(os.path.join(d, 'ktx2')))
    print('%s -> %s + ktx2/ (%.1f MB en total; arma.glb %.1f MB)' % (name, os.path.relpath(out, ROOT), tot / 1048576, os.path.getsize(os.path.join(d, 'arma.glb')) / 1048576))


def main():
    args = sys.argv[1:]
    rdo = float(args[args.index('--rdo') + 1]) if '--rdo' in args else 1.0
    level = int(args[args.index('--level') + 1]) if '--level' in args else 2
    n = int(args[args.index('--jobs') + 1]) if '--jobs' in args else 4
    names = [a for a in args if a in PACKS or a in ARMAS] or list(PACKS)
    tmp = tempfile.mkdtemp(prefix='ktx2_')
    for name in names:
        (pack_personaje if name in PACKS else pack_arma)(name, rdo, level, n, tmp)


if __name__ == '__main__':
    main()
