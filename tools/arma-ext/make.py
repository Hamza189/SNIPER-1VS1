"""SNIPER DUEL — convierte un arma externa (CC BY de Sketchfab) en un aspecto del juego.

  python tools/arma-ext/make.py <id> --medir    vista de lado con regla (para rellenar la ficha en armas.json)
  python tools/arma-ext/make.py <id>            arma.glb (1ª persona) y arma_tp.glb (3ª) en assets/armas/<id>/

Las fichas (armas.json) dicen de dónde sale (zip en Descargas/SNIPER DUEL ASSETSS), su licencia y cómo encaja en el arma
del juego: largo real, qué es arriba, gatillo y ánima medidos con la regla, cajas del cerrojo y del cargador.
Solo se admiten licencias que permitan publicar el modelo en un juego web (CC0, CC BY): la «Standard» de Sketchfab y
las de TurboSquid no (prohíben que se pueda descargar o extraer el archivo).
"""
import json, os, subprocess, sys, shutil, zipfile, glob
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = Path(__file__).resolve().parents[2]; HERE = Path(__file__).resolve().parent
A = json.loads((HERE / 'armas.json').read_text(encoding='utf-8'))
name = sys.argv[1]; P = A[name]; MED = '--medir' in sys.argv
assert P['license'] in ('CC BY 4.0', 'CC0'), 'licencia no admitida: ' + P['license']
BL = os.environ.get('BLENDER', r'D:\Blender\blender.exe')
WORK = HERE / '.work' / name; SRC = WORK / 'src'
if not SRC.exists():
    z = Path(os.path.expanduser('~/Downloads/SNIPER DUEL ASSETSS')) / P['zip']
    with zipfile.ZipFile(z) as f:
        f.extractall(SRC)
gl = sorted(SRC.rglob('*.gltf'))[0]
cfg = dict(P['cfg']); cfg['measure'] = MED
# el arma del juego que sustituye (assets/viewmodels.glb, coordenadas de Blender: +Y boca, +Z arriba)
cfg['ref'] = {'rifle': {'grip': [0, -0.064, -0.048]}, 'knife': {'grip': [0, 0.0, 0.0]}}[P['slot']]   # gatillo del HALCÓN / empuñadura de la NAVAJA
(WORK / 'cfg.json').write_text(json.dumps(cfg, ensure_ascii=False, indent=1), encoding='utf-8')
out = WORK / ('medir' if MED else 'out')
r = subprocess.run([BL, '--background', '--factory-startup', '--python', str(HERE / 'arma.py'), '--', str(gl), str(out), str(WORK / 'cfg.json')],
                   capture_output=True, text=True, encoding='utf-8', errors='replace')
print('\n'.join(l for l in (r.stdout + r.stderr).splitlines() if l.startswith('[arma]') or 'Error' in l or 'Traceback' in l))
if r.returncode != 0:
    raise SystemExit('Blender falló')
if MED:
    subprocess.run([sys.executable, str(HERE / 'regla.py'), str(out)]); sys.exit(0)
DEST = ROOT / 'assets' / 'armas' / name; DEST.mkdir(parents=True, exist_ok=True)
for f in ('arma.glb', 'arma_tp.glb', 'info.json'):
    shutil.copy2(out / f, DEST / f)
(DEST / 'CREDITOS.md').write_text('# %s\n\n- Autor: %s (%s)\n- Licencia: %s — https://creativecommons.org/licenses/by/4.0/\n- Cambios: convertido para SNIPER DUEL con tools/arma-ext (orientado, escalado, alineado con el arma del juego, piezas móviles, menos triángulos y texturas más pequeñas).\n'
                         % (P['title'], P['author'], P['url'], P['license']), encoding='utf-8')
print('copiado a', DEST, json.loads((out / 'info.json').read_text()))
