# BARRIO (04-11-2026): packs a Sketchfab glTF folder (scene.gltf + scene.bin + textures/) into one GLB for the game:
# textures down to MAX px, JPEG when they have no transparency (normal maps too, at a higher quality), PNG otherwise.
# Optionally drops meshes by material (the towers' own ground planes and kerb posts are not wanted behind the map).
#   python tools/barrio/pack.py <carpeta glTF> <salida.glb> [MAX=1024] [materiales a quitar, separados por comas]
import json, struct, sys, io, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
DROP = set(sys.argv[4].split(',')) if len(sys.argv) > 4 and sys.argv[4] else set()
g = json.load(open(os.path.join(src, 'scene.gltf'), encoding='utf-8'))
bin0 = open(os.path.join(src, g['buffers'][0]['uri']), 'rb').read()
normals = {t['index'] for m in g.get('materials', []) for t in [m.get('normalTexture')] if t}
normal_imgs = {g['textures'][i]['source'] for i in normals}
# drop meshes (their primitives) whose material is in DROP
if DROP:
    mats = [m.get('name', '') for m in g.get('materials', [])]
    for me in g['meshes']:
        me['primitives'] = [p for p in me['primitives'] if mats[p.get('material', 0)] not in DROP] or me['primitives'][:0]
    for nd in g['nodes']:
        if 'mesh' in nd and not g['meshes'][nd['mesh']]['primitives']: del nd['mesh']
# new binary: the old buffer as it is, then the images
blob = bytearray(bin0)
def pad(b, c=b'\0'):
    while len(b) % 4: b += c
pad(blob)
for i, im in enumerate(g.get('images', [])):
    p = Image.open(os.path.join(src, im['uri']))
    p.load()
    if max(p.size) > MAX:
        k = MAX / max(p.size); p = p.resize((max(1, round(p.size[0] * k)), max(1, round(p.size[1] * k))), Image.LANCZOS)
    alpha = p.mode in ('RGBA', 'LA', 'P') and p.convert('RGBA').getextrema()[3][0] < 250
    b = io.BytesIO()
    if alpha: p.convert('RGBA').save(b, 'PNG', optimize=True); mime = 'image/png'
    else: p.convert('RGB').save(b, 'JPEG', quality=92 if i in normal_imgs else 85, optimize=True); mime = 'image/jpeg'
    data = b.getvalue()
    g['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)})
    im.pop('uri', None); im['bufferView'] = len(g['bufferViews']) - 1; im['mimeType'] = mime
    blob += data; pad(blob)
g['buffers'] = [{'byteLength': len(blob)}]
js = json.dumps(g, separators=(',', ':')).encode('utf-8'); js = bytearray(js); pad(js, b' ')
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + blob
os.makedirs(os.path.dirname(out), exist_ok=True); open(out, 'wb').write(glb)
print(out, round(len(glb) / 1048576, 2), 'MB ·', len(g.get('images', [])), 'imágenes')
