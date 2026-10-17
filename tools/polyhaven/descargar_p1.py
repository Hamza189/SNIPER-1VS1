"""SNIPER DUEL · P1 (fachadas): descarga texturas CC0 de Poly Haven para que Claude las compare en el juego.

En Windows, abre una terminal en esta carpeta y ejecuta:   py descargar_p1.py
No hace falta instalar nada (solo Python 3). Crea la carpeta polyhaven_p1 con una subcarpeta por textura:
  color (diff), normal OpenGL (nor_gl) y rugosidad (rough) en PNG de 2K, tal cual vienen de Poly Haven
  (sin convertir: la rugosidad es de 16 bits y convertirla mal la deja en blanco), más info.json con
  autor, licencia y medidas.
Después conecta la carpeta polyhaven_p1 en la app de Claude (+ › Añadir carpeta) y díselo a Claude.
Licencia de todas: CC0 (dominio público), https://polyhaven.com/license
"""
import json, os, sys, urllib.request

ASSETS = {
    # paredes encaladas (el juego las tiñe de cada color de fachada)
    'white_stucco_02': 'pared', 'plastered_wall_02': 'pared', 'beige_wall_001': 'pared',
    # tejados de teja árabe
    'clay_roof_tiles_02': 'tejado', 'clay_roof_tiles_03': 'tejado',
    # piedra de jambas, zócalos y esquinas
    'sandstone_blocks_04': 'piedra', 'large_sandstone_blocks_01': 'piedra',
    # madera de persianas y puertas (también se tiñe)
    'distressed_painted_planks': 'madera', 'rough_pine_door': 'madera',
}
MAPS = {'color': ['Diffuse', 'diff'], 'normal': ['nor_gl', 'Normal (GL)'], 'rugosidad': ['Rough', 'rough']}
RES = '2k'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'polyhaven_p1')


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'SniperDuel-P1/1.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def pick(files, names):
    for n in names:
        for k, v in files.items():
            if k.lower() == n.lower() and RES in v:
                for ext in ('png', 'jpg'):
                    e = v[RES].get(ext)
                    if isinstance(e, dict) and e.get('url'):
                        return e['url']
    return None


ok, bad = 0, []
for asset, use in ASSETS.items():
    d = os.path.join(OUT, asset)
    os.makedirs(d, exist_ok=True)
    try:
        files = json.loads(get('https://api.polyhaven.com/files/' + asset))
        info = json.loads(get('https://api.polyhaven.com/info/' + asset))
        meta = {'asset': asset, 'uso': use, 'pagina': 'https://polyhaven.com/a/' + asset, 'licencia': 'CC0',
                'autores': list((info.get('authors') or {}).keys()), 'medidas_mm': info.get('dimensions'), 'resolucion': RES, 'archivos': {}}
        for name, keys in MAPS.items():
            url = pick(files, keys)
            if not url:
                raise RuntimeError('falta el mapa ' + name)
            fn = name + os.path.splitext(url)[1]
            data = get(url)
            with open(os.path.join(d, fn), 'wb') as f:
                f.write(data)
            meta['archivos'][name] = {'archivo': fn, 'url': url, 'bytes': len(data)}
            print('  ', asset, name, round(len(data) / 1e6, 1), 'MB')
        with open(os.path.join(d, 'info.json'), 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
        ok += 1
    except Exception as e:
        bad.append(asset + ': ' + str(e))
        print('ERROR', asset, e)
print('\nListo:', ok, 'de', len(ASSETS), 'texturas en', OUT)
if bad:
    print('Fallaron:\n  ' + '\n  '.join(bad))
    sys.exit(1)
