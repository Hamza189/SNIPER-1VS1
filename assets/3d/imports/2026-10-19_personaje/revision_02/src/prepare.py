from pathlib import Path
import urllib.request,json,hashlib
R=Path(__file__).resolve().parent.parent
def read(url):
 return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'SNIPER-DUEL-asset-authoring'}),timeout=60).read()
info=json.loads(read('https://api.github.com/repos/makehumancommunity/makehuman/commits/master'));commit=info['sha']
files={'base.obj':'makehuman/data/3dobjs/base.obj','MAKEHUMAN_LICENSE.md':'LICENSE.md','MAKEHUMAN_CC0.md':'LICENSE.ASSETS.md'}
manifest={}
for name,source in files.items():
 url=f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{commit}/{source}';data=read(url);(R/'sources'/name).write_bytes(data);manifest[name]={'url':url,'sha256':hashlib.sha256(data).hexdigest(),'license':'CC0-1.0' if name=='base.obj' else 'license text'}
(R/'sources'/'provenance.json').write_text(json.dumps(manifest,indent=2))
old=R.parent
s=(old/'src'/'build_character.py').read_text()
start=s.index('def create(lod):');end=s.index('\nclips=',start)
s=s[:start]+'''def create(lod):
 import sys
 sys.path.insert(0,str(Path(__file__).resolve().parent))
 from design import make_character
 return make_character(lod,Geometry,rest,bi)
'''+s[end:]
(R/'src'/'build_character.py').write_text(s)
for name in ['validate.py','run.ps1']:(R/'src'/name).write_bytes((old/'src'/name).read_bytes())
for name in ['viewer.html']:
 s=(old/name).read_text(encoding='utf-8-sig').replace('../../../../vendor/','../../../../../vendor/').replace('personaje en revisión','personaje · revisión 02')
 (R/name).write_text(s,encoding='utf8')
s=(old/'src'/'capture.js').read_text().replace("'../../../..'","'../../../../..'").replace('2026-10-19_personaje/viewer.html','2026-10-19_personaje/revision_02/viewer.html')
(R/'src'/'capture.js').write_text(s)
print('Pinned MakeHuman assets:',commit)
groups={};g='';verts=[]
for line in (R/'sources'/'base.obj').read_text().splitlines():
 if line.startswith('v '):verts.append([float(x) for x in line.split()[1:4]])
 if line.startswith('g '):g=line[2:]
 if line.startswith('f '):groups[g]=groups.get(g,0)+1
import numpy as np
v=np.array(verts);print('bounds',v.min(0),v.max(0),'groups',groups)
