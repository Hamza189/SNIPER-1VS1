"""Vistas rápidas (Workbench) para iterar el modelo dentro de Blender, con las zonas de impacto encima."""
import math
import bpy
from mathutils import Vector
from common import *

HIT = [('head', 'sphere', 1.63, 0.15), ('torso', 'box', 1.17, (0.245, 0.31, 0.16)), ('legs', 'box', 0.43, (0.19, 0.43, 0.11))]


def hit_objects(k=1.0, head_y=None):
    obs = []
    for name, t, y, s in HIT:
        if t == 'sphere':
            bpy.ops.mesh.primitive_uv_sphere_add(radius=s, location=(0, 0, head_y if head_y else y), segments=24, ring_count=12)
        else:
            bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, y * k))
            o = bpy.context.object
            o.scale = (s[0], s[2], s[1] * k)
        o = bpy.context.object
        w = o.modifiers.new('wire', 'WIREFRAME')
        w.thickness = 0.004
        o.name = 'hit_' + name
        obs.append(o)
    return obs


def render_views(path_prefix, views=('front', 'side', 'back'), res=(700, 1000), center_z=0.9, ortho=2.1, shading='MATERIAL', extra=None):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = shading
    sc.display.shading.show_cavity = True
    sc.display.shading.show_shadows = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.world = sc.world or bpy.data.worlds.new('w')
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = ortho
    cam = link(bpy.data.objects.new('cam', cam_data))
    sc.camera = cam
    dirs = {'front': (0, -1, 0), 'back': (0, 1, 0), 'side': (1, 0, 0), 'side2': (-1, 0, 0), 'hero': (0.8, -1, 0.25)}
    out = []
    for v in views:
        d = Vector(dirs[v]).normalized()
        cam.location = Vector((0, 0, center_z)) + d * 6
        cam.rotation_euler = (Vector((0, 0, center_z)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        if extra:
            extra(v)
        sc.render.filepath = str(path_prefix) + '_' + v + '.png'
        bpy.ops.render.render(write_still=True)
        out.append(sc.render.filepath)
    bpy.data.objects.remove(cam, do_unlink=True)
    return out
