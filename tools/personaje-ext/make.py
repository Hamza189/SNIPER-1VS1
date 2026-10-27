"""SNIPER DUEL — convierte un personaje externo y lo deja listo en el juego (?pj=pro).

  python tools/personaje-ext/make.py <pack>        (pack de tools/personaje-ext/packs.json: op2, op3, op4…)

1. Blender (extract.py): esqueleto → 26 huesos del juego, pesos, LOD, encaje en las zonas de impacto.
2. atlas.py: un material, texturas a <size> (+ 2K y 1K) y variantes de color.
3. build_glb de la rev. 04: GLB con las 29 animaciones, agachado/deslizamiento y LOD.
4. Comprobaciones: tools/validate-glb.js (triángulos por LOD, 1 material) y tools/check-character-hitbox.js (3 LOD).
5. Copia a assets/personaje/pro/<pack>/ lo que carga el juego.
Blender: D:\\Blender\\blender.exe (o la variable BLENDER). Trabajo en tools/personaje-ext/.work/<pack> (no se sube).
"""
import json, os, subprocess, sys, shutil
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PACKS = json.loads((HERE / 'packs.json').read_text(encoding='utf-8'))
name = sys.argv[1]
P = PACKS[name]
WORK = HERE / '.work' / name
OUT = WORK / 'out'
DEST = ROOT / 'assets' / 'personaje' / 'pro' / name
BL = os.environ.get('BLENDER', r'D:\Blender\blender.exe')
WORK.mkdir(parents=True, exist_ok=True)
(WORK / 'cfg.json').write_text(json.dumps(P.get('cfg', {}), indent=1))
import glob, zipfile
src = None
for pat in (P['input'] if isinstance(P['input'], list) else [P['input']]):
    hits = sorted(glob.glob(os.path.expandvars(os.path.expanduser(pat))), key=os.path.getmtime, reverse=True)
    if hits:
        src = hits[0]; break
if not src:
    raise SystemExit('no encuentro el modelo: ' + str(P['input']) + ' (descárgalo de ' + P['url'] + ' en formato glTF)')
if src.lower().endswith('.zip'):          # descarga de Sketchfab: se descomprime en su propia carpeta de trabajo
    dz = WORK / 'src'
    if dz.exists():
        shutil.rmtree(dz)
    with zipfile.ZipFile(src) as z:
        z.extractall(dz)
    found = sorted(list(dz.rglob('*.gltf')) + list(dz.rglob('*.glb')) + list(dz.rglob('*.fbx')))
    if not found:
        raise SystemExit('el zip no trae glTF/GLB/FBX: ' + src)
    src = str(found[0])
print('modelo:', src)


def run(cmd, env=None, quiet=False):
    print('»', ' '.join(str(c) for c in cmd)[:200], flush=True)
    r = subprocess.run([str(c) for c in cmd], cwd=ROOT, env=dict(os.environ, **(env or {})), capture_output=True, text=True, encoding='utf-8', errors='replace')
    out = r.stdout + r.stderr
    lines = [l for l in out.splitlines() if l.startswith('[ext]') or not quiet]
    print('\n'.join(lines[-40:]))
    if r.returncode != 0:
        raise SystemExit('falló (%d)' % r.returncode)
    return out


run([BL, '--background', '--factory-startup', '--python', HERE / 'extract.py', '--', src, WORK, WORK / 'cfg.json'], quiet=True)
run([sys.executable, HERE / 'atlas.py', WORK, OUT, P.get('size', 2048), WORK / 'cfg.json'])
sets = ',_2k,_1k' if P.get('size', 2048) > 2048 else ',_1k'
env = {'SD_WORK': str(WORK), 'SD_TEX': str(OUT), 'SD_OUT': str(OUT), 'SD_SETS': sets,
       'SD_GEN': 'SNIPER DUEL — %s (%s, %s) convertido con tools/personaje-ext' % (P['title'], P['author'], P['license'])}
run([sys.executable, ROOT / 'assets/3d/imports/2026-10-19_personaje/revision_04/src/build_glb.py'], env=env, quiet=True)

lod = P.get('cfg', {}).get('lod', [40000, 12000, 3000])
ok = True
v = subprocess.run(['node', 'tools/validate-glb.js', OUT / 'personaje.glb', '--lod0', str(int(lod[0] * 1.02)), '--lod1', str(int(lod[1] * 1.02)), '--lod2', str(int(lod[2] * 1.05))],
                   cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
print(v.stdout[-600:])
ok &= v.returncode == 0
report = {}
for L in (0, 1, 2):
    h = subprocess.run(['node', 'tools/check-character-hitbox.js', OUT / 'personaje.glb', '--lod', str(L)], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
    fails = [l for l in h.stdout.splitlines() if l.startswith('✘')]
    report['LOD%d' % L] = {'ok': h.returncode == 0, 'rest': next((l for l in h.stdout.splitlines() if l.startswith('reposo')), ''), 'fails': fails}
    print('LOD%d' % L, 'zonas de impacto:', 'BIEN' if h.returncode == 0 else '%d fallos' % len(fails), report['LOD%d' % L]['rest'])
    for f in fails[:6]:
        print('   ', f)
(WORK / 'report.json').write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding='utf-8')

if not P.get('copy', True):
    print('(prueba: no se copia al juego)'); sys.exit(0)
DEST.mkdir(parents=True, exist_ok=True)
for f in DEST.glob('*'):
    if f.name != 'CREDITOS.md':
        f.unlink()
# lo que carga el juego: tamaño completo (?pj=pro en ALTO/MEDIO) y 2K/1K (?pj=mix en MEDIO y BAJO)
for f in OUT.iterdir():
    if f.suffix == '.glb' or f.name.startswith('color_'):
        shutil.copy2(f, DEST / f.name)
(DEST / 'CREDITOS.md').write_text('# %s\n\n- Autor: %s (%s)\n- Licencia: %s — %s\n- Cambios: convertido para SNIPER DUEL con tools/personaje-ext '
                                  '(esqueleto de 26 huesos, animaciones propias del juego, LOD, atlas de texturas, colores y ajuste a las zonas de impacto).\n'
                                  % (P['title'], P['author'], P['url'], P['license'], P.get('licenseUrl', '')), encoding='utf-8')
print('copiado a', DEST, '·', 'comprobaciones BIEN' if ok and all(r['ok'] for r in report.values()) else 'HAY AVISOS (ver arriba)')
