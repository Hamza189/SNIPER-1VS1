"""Classic Poly Haven weapons (CC0) → GLB kept for a later phase (alternative skins; 17-10-2026, owner's option 1).
   NOT loaded by the game. Modifiers applied (triangulate, geometry nodes), every part kept as its own node with its name
   (bolt, magazine, trigger… for a future animation), textures reduced from 4K to MAXPX (default 1024) inside the GLB.
   Run: python3 tools/weapons_classic/export_classic.py -- <file.blend> <out.glb> [maxpx]"""
import bpy, sys, os
args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]; maxpx = int(args[2]) if len(args) > 2 else 1024
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.ops.wm.open_mainfile(filepath=src, load_ui=False, use_scripts=False)
for o in list(bpy.data.objects):
    if o.type not in ('MESH', 'EMPTY'): bpy.data.objects.remove(o)
for img in bpy.data.images:
    if img.source == 'FILE' and img.size[0] > maxpx:
        try:
            w, h = img.size; img.scale(maxpx, max(1, round(h * maxpx / w)))
        except Exception as e: print('no se pudo reducir', img.name, e)
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for o in bpy.data.objects:
    if o.type == 'MESH':
        me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles); o.evaluated_get(dg).to_mesh_clear()
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT',
                          export_image_format='AUTO', export_animations=False, export_cameras=False, export_lights=False)
print('ok', os.path.basename(out), 'partes', [o.name for o in bpy.data.objects if o.type == 'MESH'], 'triángulos', tris, 'KB', os.path.getsize(out) // 1024)
