"""SNIPER DUEL — arma externa (glTF de Sketchfab) → aspecto de un arma del juego (Blender, en segundo plano).

  blender --background --factory-startup --python arma.py -- <scene.gltf> <salida_dir> <ficha.json>

Medidas de la ficha («regla»: tools/arma-ext/make.py <id> --medir): en metros, con la boca del cañón en y = 0 (la culata
hacia y negativo), lo más alto del arma en z = 0 (hacia abajo negativo) y x = derecha del tirador. Coordenadas de Blender.
  len      largo real (m)                       up      qué eje del archivo es arriba ('+Z', '-Y'…)
  pitch    grados para enderezar el cañón      bore    z del ánima (negativo)
  grip     [y, z] del punto que va donde el gatillo (rifle) o la empuñadura (cuchillo) del arma del juego
  drop / dropBox   mallas (por nombre) o cajas [[x,y,z],[x,y,z]] que se quitan (cartuchos sueltos, fundas)
  bolt     caja de la palanca del cerrojo (se moverá con el cerrojo del juego; giro en boltPivot [y, z] sobre el ánima)
  mag / magBox     mallas o caja del cargador (se moverá con el cargador del juego)
Salida: <salida>/arma.glb (nodos cuerpo, cerrojo, carg), arma_tp.glb (3ª persona) e info.json con los puntos de giro en el
marco del arma del juego (Three: x derecha, y arriba, −z hacia la boca) para que la página mueva ahí las manos.
"""
import bpy, bmesh, sys, os, json, re, math
from mathutils import Vector, Matrix

a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, CFG = a[0], a[1], json.load(open(a[2], encoding='utf-8'))
os.makedirs(OUT, exist_ok=True)
info = {}
def log(*x):
    print('[arma]', *x, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in [o for o in bpy.context.scene.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)
for o in bpy.context.scene.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
DROP = [re.compile(p, re.I) for p in CFG.get('drop', [])]
for o in [o for o in bpy.context.scene.objects if any(p.search(o.name) for p in DROP)]:
    log('quito', o.name); bpy.data.objects.remove(o, do_unlink=True)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']

def bbox(os_):
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in os_:
        for v in o.data.vertices:
            w = o.matrix_world @ v.co
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    return mn, mx
def xform(os_, M):
    for o in os_:
        o.data.transform(M); o.data.update()

# ---- orientación: eje largo = cañón, boca = el extremo más fino, arriba según la ficha
mn, mx = bbox(objs); ext = mx - mn
L = CFG.get('axis') or 'XYZ'[max(range(3), key=lambda i: ext[i])]
li = 'XYZ'.index(L[-1])
def thick(end):
    lo, hi = (mn[li], mn[li] + ext[li] * 0.04) if end < 0 else (mx[li] - ext[li] * 0.04, mx[li])
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices if lo <= (o.matrix_world @ v.co)[li] <= hi]
    return max(max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3) if i != li) if pts else 1e9
msign = CFG.get('muzzle') or (-1 if thick(-1) < thick(1) else 1)
fwd = Vector((0, 0, 0)); fwd[li] = msign
U = CFG.get('up', '+Z'); up = Vector((0, 0, 0)); up['XYZ'.index(U[-1])] = -1 if U[0] == '-' else 1
xform(objs, Matrix.Scale(CFG['len'] / ext[li], 4) @ Matrix((fwd.cross(up), fwd, up)).to_4x4())
if CFG.get('pitch'):
    xform(objs, Matrix.Rotation(math.radians(CFG['pitch']), 4, 'X'))
if CFG.get('rot'):             # piezas en diagonal en el archivo (el cuchillo): giro X y luego Z, y otra vez a su largo
    rx, _, rz = CFG['rot']
    xform(objs, Matrix.Rotation(math.radians(rz), 4, 'Z') @ Matrix.Rotation(math.radians(rx), 4, 'X'))
    mn, mx = bbox(objs); xform(objs, Matrix.Scale(CFG['len'] / (mx.y - mn.y), 4))
mn, mx = bbox(objs)
xform(objs, Matrix.Translation(Vector((0, -mx.y, -mx.z))))      # boca en y = 0, lo más alto en z = 0 (marco de la regla)
# x = 0 en el eje del cañón: el centro de lo que hay en los 2 primeros cm desde la boca
xs = [(o.matrix_world @ v.co).x for o in objs for v in o.data.vertices if (o.matrix_world @ v.co).y > -0.02]
xform(objs, Matrix.Translation(Vector((-(min(xs) + max(xs)) / 2, 0, 0))))
mn, mx = bbox(objs)
log('eje', L, 'boca', msign, 'arriba', U, '· largo', round(mx.y - mn.y, 3), 'alto', round(mx.z - mn.z, 3))

if CFG.get('measure'):
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'TEXTURE'; W_, H_ = 1800, 700; sc.render.resolution_x, sc.render.resolution_y = W_, H_
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; span = max(mx.y - mn.y, (mx.z - mn.z) * W_ / H_) * 1.04; cam.data.ortho_scale = span
    cy, cz, cx = (mn.y + mx.y) / 2, (mn.z + mx.z) / 2, 0.0   # vista de arriba centrada en el cañón (x = 0)
    cam.location = (-5, cy, cz); cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
    sc.render.filepath = os.path.join(OUT, 'lado.png'); bpy.ops.render.render(write_still=True)
    cam.location = (cx, cy, 5); cam.rotation_euler = (0, 0, math.radians(90))    # desde arriba (boca a la derecha, +X abajo)
    sc.render.filepath = os.path.join(OUT, 'arriba.png'); bpy.ops.render.render(write_still=True)
    json.dump({'span': span, 'cy': cy, 'cz': cz, 'cx': cx, 'w': W_, 'h': H_, 'len': mx.y - mn.y, 'height': mx.z - mn.z},
              open(os.path.join(OUT, 'lado.json'), 'w'))
    sys.exit(0)

# ---- piezas (todo en el marco de la regla)
def in_box(p, box):
    return all(box[0][i] <= p[i] <= box[1][i] for i in range(3))
def faces_out(o, box, inside):
    """deja en o solo las caras cuyo centro está (inside=True) o no está dentro de la caja"""
    b2 = bmesh.new(); b2.from_mesh(o.data)
    bmesh.ops.delete(b2, geom=[f for f in b2.faces if in_box(f.calc_center_median(), box) != inside], context='FACES')
    b2.to_mesh(o.data); b2.free(); o.data.update()
def join(os_, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in os_:
        o.select_set(True)
    bpy.context.view_layer.objects.active = os_[0]; bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name; return o
def split(src, box, name):
    dup = src.copy(); dup.data = src.data.copy(); dup.name = name; bpy.context.scene.collection.objects.link(dup)
    faces_out(dup, box, True); faces_out(src, box, False)
    return dup if len(dup.data.polygons) else None
for box in CFG.get('dropBox', []):          # en todas las mallas (los cartuchos sueltos pueden ir con el cargador)
    for o in objs:
        faces_out(o, box, False)
    log('caja quitada', box)
objs = [o for o in objs if len(o.data.polygons)]
MAGR = [re.compile(p, re.I) for p in CFG.get('mag', [])]
mags = [o for o in objs if any(p.search(o.name) for p in MAGR)]
body = join([o for o in objs if o not in mags], 'cuerpo')
mag = join(mags, 'carg') if mags else (split(body, CFG['magBox'], 'carg') if CFG.get('magBox') else None)
bolt = split(body, CFG['bolt'], 'cerrojo') if CFG.get('bolt') else None

# ---- al marco del arma del juego: el punto 'grip' de la ficha va al gatillo/empuñadura del original
gy, gz = CFG['grip']
off = Vector(CFG['ref']['grip']) - Vector((0, gy, gz))
parts = [o for o in (body, bolt, mag) if o]
xform(parts, Matrix.Translation(off))
def to3(v):            # Blender (x, y, z) → Three (x, z, −y)
    return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]
def set_origin(o, p):  # el nodo queda en p (giro de la pieza), la malla relativa a él
    o.data.transform(Matrix.Translation(-p)); o.data.update(); o.location = p
if bolt:
    if CFG.get('boltPivot'):
        py, pz = CFG['boltPivot']
    else:
        py, pz = sum(v.co.y for v in bolt.data.vertices) / len(bolt.data.vertices) - off.y, CFG['bore']
    p = Vector((0, py, pz)) + off; set_origin(bolt, p); info['boltPivot'] = to3(p)
elif CFG.get('boltPivot'):     # sin palanca aparte: la mano va igual a su sitio al accionar el cerrojo
    py, pz = CFG['boltPivot']; info['boltPivot'] = to3(Vector((0, py, pz)) + off)
if mag:
    c = sum((v.co for v in mag.data.vertices), Vector()) / len(mag.data.vertices); p = Vector((0, c.y, c.z))
    set_origin(mag, p); info['magPivot'] = to3(p)
mn, mx = bbox(parts)
info['muzzle'] = to3(Vector((0, mx.y, CFG['bore'] + off.z)))
info['bbox3'] = [to3(mn), to3(mx)]
log('cerrojo', info.get('boltPivot'), 'cargador', info.get('magPivot'), 'boca', info['muzzle'])

# ---- texturas y triángulos
for im in bpy.data.images:
    if im.size[0] > CFG.get('tex', 1024):
        k = CFG.get('tex', 1024) / im.size[0]; im.scale(int(im.size[0] * k), int(im.size[1] * k))
def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)
def decimate(o, target):
    if tri_count(o) > target:
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = target / tri_count(o)
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=m.name)
    return tri_count(o)
def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format='GLB', export_image_format='JPEG',
                              export_jpeg_quality=86, export_apply=True, export_yup=True)
info['tris'] = decimate(body, CFG.get('tris', 20000)) + sum(tri_count(o) for o in (bolt, mag) if o)
export(os.path.join(OUT, 'arma.glb'))
tot = info['tris']
for o in parts:
    decimate(o, max(60, int(CFG.get('trisTp', 2500) * tri_count(o) / tot)))
for im in bpy.data.images:
    if im.size[0] > 256:
        k = 256 / im.size[0]; im.scale(int(im.size[0] * k), int(im.size[1] * k))
info['trisTp'] = sum(tri_count(o) for o in parts)
export(os.path.join(OUT, 'arma_tp.glb'))
json.dump(info, open(os.path.join(OUT, 'info.json'), 'w'), indent=1)
log('listo', info)
