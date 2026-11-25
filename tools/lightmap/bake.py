"""ILUMINACIÓN HORNEADA, paso 3 de 3 (docs/ILUMINACION-HORNEADA.md): Blender (Cycles) hornea el atlas.

  D:\\Blender\\blender.exe --background --factory-startup --python tools/lightmap/bake.py -- <work> [muestras] [cpu]

Lee <work>/bake.json, pueblo.bin y uv2.f32 (de dump.js y pack.js) y escribe <work>/ao.png (oclusión ambiental) y
<work>/ao_lejos.png (la misma a 8 m: cuánto cielo ve), <work>/sol.png (lo que ve del sol cada texel, con la penumbra de un sol de 2,5°). tools/lightmap/finish.py los junta en
assets/lightmaps/pueblo_lm.jpg. Todas las mallas del PUEBLO hacen sombra; solo las que tienen uv2 reciben.
Ejes: el juego tiene y arriba; Blender z arriba (como glTF: x, -z, y)."""
import bpy, sys, os, json, math, time
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
WORK = os.path.abspath(argv[0])
SAMPLES = int(argv[1]) if len(argv) > 1 else 128
CPU = len(argv) > 2 and argv[2] == 'cpu'
LIFT = float(os.environ.get('LM_LIFT', '0.02'))
SUN_POS = (-45.0, 60.0, -30.0)          # LOOK.sunPos en src/page.html
AO_DIST = float(os.environ.get('LM_AO', '0.7'))   # metros: rincones y jambas (3 m dejaba negras las habitaciones; 1,2 m, manchas junto a las contraventanas)

t0 = time.time()
cfg = json.load(open(os.path.join(WORK, 'bake.json')))
raw = open(os.path.join(WORK, 'pueblo.bin'), 'rb').read()
uvraw = np.fromfile(os.path.join(WORK, 'uv2.f32'), dtype=np.float32)
W, H = cfg['w'], cfg['h']

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.samples = SAMPLES
cy.use_denoising = False
if not CPU:
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in ('OPTIX', 'CUDA'):
            try:
                prefs.compute_device_type = kind; prefs.get_devices()
                devs = [d for d in prefs.devices if d.type == kind]
                if devs:
                    for d in prefs.devices: d.use = d.type == kind
                    cy.device = 'GPU'; print('GPU:', kind, [d.name for d in devs]); break
            except Exception as e:
                print('sin', kind, e)
    except Exception as e:
        print('GPU no disponible:', e)

def to_bl(a):   # (n,3) game → Blender
    return np.stack([a[:, 0], -a[:, 2], a[:, 1]], axis=1)

def build(name, m, with_uv):
    pos = np.frombuffer(raw, dtype=np.float32, count=m['verts'] * 3, offset=m['pos']).reshape(-1, 3)
    idx = np.frombuffer(raw, dtype=np.uint32, count=m['idx'], offset=m['ix'])
    if with_uv:
        # receivers 2 cm out along their normal: the town's ground lies in the very plane of the sand under it (and some
        # facades on old walls); a ray starting there counts as fully hidden (AO 0) without this
        nrm = np.frombuffer(raw, dtype=np.float32, count=m['verts'] * 3, offset=m['nrm']).reshape(-1, 3)
        pos = pos + nrm * LIFT
    me = bpy.data.meshes.new(name)
    me.vertices.add(m['verts']); me.vertices.foreach_set('co', to_bl(pos).ravel())
    me.loops.add(len(idx)); me.loops.foreach_set('vertex_index', idx)
    nt = len(idx) // 3
    me.polygons.add(nt); me.polygons.foreach_set('loop_start', np.arange(0, len(idx), 3, dtype=np.int32))
    if with_uv:
        uv = uvraw[m['uv'] // 4: m['uv'] // 4 + m['verts'] * 2].reshape(-1, 2)
        lay = me.uv_layers.new(name='lm')
        lay.data.foreach_set('uv', uv[idx].ravel())
    me.update(calc_edges=True)
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    return ob

img = bpy.data.images.new('lm', W, H, alpha=False, float_buffer=True)
mat_r = bpy.data.materials.new('recibe'); mat_r.use_nodes = True
nt = mat_r.node_tree; bsdf = nt.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img
uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'lm'; nt.links.new(uvn.outputs['UV'], tn.inputs['Vector'])
nt.nodes.active = tn; tn.select = True
mat_o = bpy.data.materials.new('sombra'); mat_o.use_nodes = True
mat_o.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.6, 0.6, 0.6, 1)

# thin pieces flat on the facades (shutters, frames, railings, awnings, pots…): they shade from the sun, but their
# occlusion at 13–15 cm a texel drew grey smudges round every window, so they are hidden for the occlusion bakes
import re
THIN = re.compile(r'^kit_(wood|frame|iron|metal|cloth\w*|lamp|zinc|ceramic|terracotta)')
recv, occ, thin = [], [], []
for i, m in enumerate(cfg['meshes']):
    ob = build('m%03d' % i, m, m['uv'] >= 0)
    ob.data.materials.append(mat_r if m['uv'] >= 0 else mat_o)
    if m['uv'] >= 0: recv.append(ob)
    elif m['name'].startswith('kit_') and not m['name'].startswith('kit_coches') and THIN.match(m.get('mat') or ''): thin.append(ob)
    else: occ.append(ob)
print('mallas', len(recv), 'reciben,', len(occ), 'solo sombra,', len(thin), 'finas (solo sol) ·', round(time.time() - t0, 1), 's')

# one object for the receivers (one bake), one for the rest
def join(obs, name):
    if not obs: return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1: bpy.ops.object.join()
    obs[0].name = name; return obs[0]
R = join(recv, 'recibe'); join(occ, 'sombra'); F = join(thin, 'finas')
if F: F.hide_render = True

# light: the sky for the occlusion, the sun for the shadow
world = bpy.data.worlds.new('cielo'); sc.world = world
world.use_nodes = True; world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
world.light_settings.distance = AO_DIST
s = Vector((SUN_POS[0], -SUN_POS[2], SUN_POS[1])).normalized()
ld = bpy.data.lights.new('sol', 'SUN'); ld.energy = 3.0; ld.angle = math.radians(2.5)
sun = bpy.data.objects.new('sol', ld); sc.collection.objects.link(sun)
sun.rotation_euler = (-s).to_track_quat('-Z', 'Y').to_euler()

bk = sc.render.bake
bk.margin = cfg['pad']; bk.margin_type = 'EXTEND'; bk.use_clear = True; bk.target = 'IMAGE_TEXTURES'
bpy.ops.object.select_all(action='DESELECT'); R.select_set(True); bpy.context.view_layer.objects.active = R

def save(name):
    img.filepath_raw = os.path.join(WORK, name); img.file_format = 'PNG'
    sc.render.image_settings.color_depth = '16'
    img.save()
    print('guardado', name, round(time.time() - t0, 1), 's')

bpy.ops.object.bake(type='AO')
save('ao.png')
# the same at 8 m: how much sky each texel sees (inside the houses: darker, lighter by the doors and windows)
world.light_settings.distance = float(os.environ.get('LM_AO_FAR', '8'))
bpy.ops.object.bake(type='AO')
save('ao_lejos.png')

# the sun's shadow. Not the SHADOW bake: in Blender 5.2 it leaves 0.17 under a cube and goes over 1 (measured with a
# plane and a cube). Instead the sun's direct light alone (no sky, no colour; energy π → exactly N·L where lit, 0 in
# shadow) divided by N·L from a normal bake of the same texels: what each texel sees of the sun, from 0 to 1
if F: F.hide_render = False
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.0
ld.energy = math.pi
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT'})
px = np.empty(W * H * 4, dtype=np.float32); img.pixels.foreach_get(px); direct = px.reshape(H, W, 4)[:, :, 0].copy()
bpy.ops.object.bake(type='NORMAL', normal_space='OBJECT')
img.pixels.foreach_get(px); raw = px.reshape(H, W, 4)[:, :, :3]; nrm = raw * 2 - 1
ndl = nrm @ np.array([s.x, s.y, s.z], dtype=np.float32)
vis = np.where(ndl > 0.05, np.clip(direct / np.maximum(ndl, 1e-3), 0, 1), 1.0)   # facing away: the game's N·L is 0 anyway
vis[raw.max(axis=2) < 1e-6] = 1.0   # texels no triangle covers (normal left at 0): the clear value finish.py knows
out = np.ones((H, W, 4), dtype=np.float32); out[:, :, 0] = out[:, :, 1] = out[:, :, 2] = vis
img.pixels.foreach_set(out.ravel()); save('sol.png')
print('hecho en', round(time.time() - t0, 1), 's')
