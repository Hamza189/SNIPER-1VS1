"""Re-encode the images inside a GLB (Blender writes 16-bit PNGs: ~5 MB per 1024² normal map). Opaque images → JPEG q90
   (normal, metal/roughness, colour), images with real transparency → 8-bit PNG. Geometry, materials and names untouched.
   Run: python3 tools/weapons_classic/repack_glb.py in.glb out.glb"""
import sys, json, struct, io
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + jl]); bin0 = 20 + jl + 8
blob = b[bin0:bin0 + struct.unpack('<I', b[20 + jl:24 + jl])[0]]
views = j['bufferViews']; img_views = {im['bufferView']: im for im in j.get('images', [])}
new, before, after = bytearray(), 0, 0
for i, v in enumerate(views):
    data = blob[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    if i in img_views:
        im = img_views[i]; pi = Image.open(io.BytesIO(data)); before += len(data)
        alpha = pi.mode in ('RGBA', 'LA') and pi.convert('RGBA').getchannel('A').getextrema()[0] < 250
        out = io.BytesIO()
        if alpha: pi.convert('RGBA').save(out, 'PNG', optimize=True); im['mimeType'] = 'image/png'
        else: pi.convert('RGB').save(out, 'JPEG', quality=90, optimize=True); im['mimeType'] = 'image/jpeg'
        data = out.getvalue(); after += len(data)
    while len(new) % 4: new.append(0)
    v['byteOffset'] = len(new); v['byteLength'] = len(data); new += data
while len(new) % 4: new.append(0)
j['buffers'][0]['byteLength'] = len(new)
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(new)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(new), 0x004E4942)); f.write(new)
print(dst, 'imágenes', before // 1024, '→', after // 1024, 'KB · archivo', (12 + 16 + len(js) + len(new)) // 1024, 'KB')
