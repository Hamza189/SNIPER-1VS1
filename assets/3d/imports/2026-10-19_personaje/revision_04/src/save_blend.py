"""Entrega editable: importa el GLB validado y conserva mallas, rig, morphs, clips y mapas empaquetados."""
from pathlib import Path
import json
import bpy
from mathutils import Vector

REV = Path(__file__).resolve().parent.parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(REV / 'personaje.glb'))
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 30
for ob in bpy.data.objects:
    if ob.name in ('personaje_LOD1', 'personaje_LOD2'):
        ob.hide_set(True)
        ob.hide_render = True
    if ob.animation_data:
        for track in ob.animation_data.nla_tracks:
            track.mute = True
for action in bpy.data.actions:
    action.use_fake_user = True
idle = bpy.data.actions.get('idle_rifle')
rig = next(ob for ob in bpy.data.objects if ob.type == 'ARMATURE')
if idle:
    rig.animation_data_create()
    rig.animation_data.action = idle
    for slot in idle.slots:
        if slot.target_id_type == 'OBJECT':
            rig.animation_data.action_slot = slot
            break
    scene.frame_end = int(idle.frame_range[1])
scene.frame_set(1)
for img in bpy.data.images:
    if img.source != 'GENERATED':
        img.pack()
readme = bpy.data.texts.new('LEEME · LINCE')
readme.write('SNIPER DUEL · LINCE · revisión 04\n\n'
             'Malla de juego editable importada desde personaje.glb, tres LOD y texturas empaquetadas.\n'
             'Los clips están conservados como acciones; sus pistas NLA se guardan silenciadas.\n'
             'El archivo abre en idle_rifle. Para otro clip usa el editor de acciones y su slot del rig.\n'
             'Las posturas bajas usan los morphs agachado/deslizar: revisar también la animación de shape keys.\n'
             'No exportar cambios desde este archivo directamente al juego sin ejecutar validadores.\n'
             'Fuentes de construcción: src/*.py. Licencias: LICENSE_ASSETS.md.\n')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            space = area.spaces.active
            space.shading.type = 'MATERIAL'
            space.region_3d.view_distance = 3.6
            space.region_3d.view_location = Vector((0, 0, .9))
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.wm.save_as_mainfile(filepath=str(REV / 'LINCE.blend'), compress=True)
print(json.dumps({'file':'LINCE.blend','rig_bones':len(rig.data.bones),
                  'actions':[a.name for a in bpy.data.actions],
                  'meshes':[o.name for o in bpy.data.objects if o.type=='MESH'],
                  'packed_images':sum(bool(i.packed_file) for i in bpy.data.images)}))
