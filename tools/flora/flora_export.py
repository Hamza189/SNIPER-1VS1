"""dandelion_01 and grass_medium_02 (Poly Haven, CC0) → one GLB per plant, one node per variant/level.
   Dandelions: their own LOD2 and LOD3 (modifiers applied) → assets/3d/flora/dandelion.glb (the game uses LOD3).
   Grass: no longer exported as meshes (17-10-2026): it is drawn with cards, see grass_cards.py and grass_atlas.py."""
import bpy, sys, re
args = sys.argv[sys.argv.index('--') + 1:]
kind, src, out = args
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.ops.wm.open_mainfile(filepath=src, load_ui=False, use_scripts=False)
keep = []
for o in list(bpy.data.objects):
    if o.type != 'MESH': continue
    if kind == 'dandelion' and re.match(r'dandelion_01_[a-e]_LOD[23]$', o.name): keep.append(o)
    elif kind == 'grass' and re.match(r'grass_medium_02_[a-e]$', o.name): keep.append(o)
for o in list(bpy.data.objects):
    if o not in keep: bpy.data.objects.remove(o)
dg = bpy.context.evaluated_depsgraph_get()
for o in keep:
    if kind == 'grass':
        d = o.modifiers.new('dec', 'DECIMATE'); d.ratio = float(__import__('os').environ.get('GRASS_RATIO', '0.15'))
    o.location = (0, 0, 0)   # each variant at the origin: the game places instances itself
for o in keep:
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    o.select_set(False)
    me = o.data; me.calc_loop_triangles(); print(o.name, 'tris', len(me.loop_triangles), 'dims', [round(v, 3) for v in o.dimensions])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT', export_image_format='NONE')
