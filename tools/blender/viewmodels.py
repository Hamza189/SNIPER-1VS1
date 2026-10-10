"""Builds assets/viewmodels.glb: the first-person weapons and the gloved arms of SNIPER DUEL.

Run from the repo root:   python3 tools/blender/viewmodels.py      (needs: pip install bpy)
Every mesh is generated here from code, so the result is original work with no third-party
license. Output nodes (game frame after export: x right, y up, -z forward):
  VIBORA9  (slide, trigger, mag, slidestop, frame + sockets)
  ...
"""
import sys, os, pathlib, math
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bpy
from common import *
import pistol, rifle, knife, shotgun

ROOT = HERE.parent.parent
OUT = ROOT / 'assets' / 'viewmodels.glb'
ONLY = set(a for a in sys.argv[1:] if not a.startswith('-'))

def main():
    reset()
    stats = {}
    if not ONLY or 'pistol' in ONLY:
        r = empty('VIBORA9')
        parts = pistol.build(r)
        stats['VIBORA9'] = sum(tri_count(o) for o in parts.values())
    if not ONLY or 'rifle' in ONLY:
        r = empty('HALCON')
        parts = rifle.build(r)
        stats['HALCON'] = sum(tri_count(o) for o in parts.values())
    if not ONLY or 'knife' in ONLY:
        r = empty('NAVAJA')
        parts = knife.build(r)
        stats['NAVAJA'] = sum(tri_count(o) for o in parts.values())
    if not ONLY or 'shotgun' in ONLY:
        r = empty('FURIA12')
        parts = shotgun.build(r)
        stats['FURIA12'] = sum(tri_count(o) for o in parts.values())
    try:
        import arms
        if not ONLY or 'arms' in ONLY:
            stats['ARMS'] = arms.build()
    except ImportError:
        pass
    OUT.parent.mkdir(exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', export_apply=True, export_yup=True,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_skins=True, export_animations=False, export_extras=False, export_cameras=False,
                              export_lights=False)
    print('VIEWMODELS', OUT, os.path.getsize(OUT), 'bytes', stats)

main()
