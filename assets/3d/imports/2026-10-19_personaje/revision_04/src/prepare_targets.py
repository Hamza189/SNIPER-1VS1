"""Descarga (una vez) los 'targets' CC0 de MakeHuman que convierten la base neutra en un hombre adulto
atlético. Fijados al mismo commit que base.obj (revision_02/sources/provenance.json) y con su SHA-256.
Uso: python prepare_targets.py
"""
from pathlib import Path
import urllib.request, json, hashlib

R = Path(__file__).resolve().parent.parent
COMMIT = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
FILES = [
    'macrodetails/universal-male-young-averagemuscle-averageweight.target',
    'macrodetails/universal-male-young-maxmuscle-averageweight.target',
    'macrodetails/caucasian-male-young.target',
    'macrodetails/african-male-young.target',
    'macrodetails/asian-male-young.target',
]
out = R / 'sources' / 'targets'
out.mkdir(parents=True, exist_ok=True)
manifest = {}
for f in FILES:
    url = f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{COMMIT}/makehuman/data/targets/{f}'
    data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'SNIPER-DUEL-asset-authoring'}), timeout=60).read()
    (out / Path(f).name).write_bytes(data)
    manifest[Path(f).name] = {'url': url, 'sha256': hashlib.sha256(data).hexdigest(), 'license': 'CC0-1.0 (MakeHuman LICENSE.md: assets en makehuman/data)'}
(R / 'sources' / 'provenance.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
print('ok', len(manifest))
