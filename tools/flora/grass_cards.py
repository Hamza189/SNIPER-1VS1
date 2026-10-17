"""grass_medium_02 (Poly Haven, CC0) → impostor cards: each FULL-detail clump (every blade, original 4K textures) rendered
   from the side, orthographic, albedo only (emission of the base colour, alpha from the alpha map), transparent background.
   Atlas 2048×1024: 4 clumps (b–e) × green / dry, cells of 512×512. Writes the atlas and cards.json (width/height in m per clump)."""
import bpy, sys, os, json, math
args = sys.argv[sys.argv.index('--') + 1:]
src, out = args
bpy.ops.wm.open_mainfile(filepath=src, load_ui=False, use_scripts=False)
T = os.path.join(os.path.dirname(src), 'textures') + '/'
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'; sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 512; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
if sc.world: sc.world.use_nodes = True; bg = sc.world.node_tree.nodes.get('Background'); bg and setattr(bg.inputs[1], 'default_value', 0.0)
for o in list(bpy.data.objects):
    if o.type in ('LIGHT',): bpy.data.objects.remove(o)
def emission_mat(name, diff):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord'); ic = nt.nodes.new('ShaderNodeTexImage'); ia = nt.nodes.new('ShaderNodeTexImage')
    ic.image = bpy.data.images.load(T + diff); ia.image = bpy.data.images.load(T + 'grass_medium_02_alpha_4k.png'); ia.image.colorspace_settings.name = 'Non-Color'
    em = nt.nodes.new('ShaderNodeEmission'); tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(tc.outputs['UV'], ic.inputs['Vector']); nt.links.new(tc.outputs['UV'], ia.inputs['Vector'])
    nt.links.new(ic.outputs['Color'], em.inputs['Color']); nt.links.new(ia.outputs['Color'], mx.inputs['Fac'])
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs['Surface'])
    return m
mats = {'verde': emission_mat('g_green', 'grass_medium_02_diff_4k.jpg'), 'seca': emission_mat('g_dry', 'grass_medium_02_dry_diff_4k.png')}
objs = {v: bpy.data.objects.get('grass_medium_02_' + v) for v in 'bcde'}
cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'; cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
info = {}
for v, o in objs.items():
    for other in objs.values(): other.hide_render = other is not o
    for x in bpy.data.objects:
        if x.type == 'MESH' and x not in objs.values(): x.hide_render = True
    bb = [o.matrix_world @ __import__('mathutils').Vector(c) for c in o.bound_box]
    x0, x1 = min(p.x for p in bb), max(p.x for p in bb); y0, y1 = min(p.y for p in bb), max(p.y for p in bb); z0, z1 = min(p.z for p in bb), max(p.z for p in bb)
    w = max(x1 - x0, y1 - y0); h = z1 - z0; s = max(w, h) * 1.04
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    cam_d.ortho_scale = s; cam.location = (cx, y0 - 2, z0 + s / 2 - 0.01); cam.rotation_euler = (math.pi / 2, 0, 0)
    info[v] = {'w': round(s, 4), 'h': round(s, 4), 'base': round(0.01 / s, 4)}   # the card is square (s × s); the clump stands on its bottom edge
    for k, m in mats.items():
        o.data.materials.clear(); o.data.materials.append(m)
        sc.render.filepath = os.path.join(out, f'{v}_{k}.png'); bpy.ops.render.render(write_still=True)
        print('ok', v, k, 'card', round(s, 3), 'm')
json.dump(info, open(os.path.join(out, 'cards.json'), 'w'), indent=1)
