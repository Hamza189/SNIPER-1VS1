"""Independent binary/file checks, not a generator self-report."""
from pathlib import Path
import json,struct,hashlib,io
import numpy as np
from itertools import product
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
V1=ROOT.parent/'2026-10-18_casa_atlas_xl'
assert (ROOT/'collision_map.json').read_bytes()==(V1/'collision_map.json').read_bytes()
results={'collision_identical':True,'models':[]};images={};total=0;materials=0;gpu_instances=0
for filename in ['sd_casa_atlas_xl_v2.glb','sd_casa_atlas_xl_v2_techo.glb']:
    raw=(ROOT/'models'/filename).read_bytes();magic,version,length=struct.unpack_from('<III',raw)
    assert magic==0x46546c67 and version==2 and length==len(raw)
    n,kind=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
    assert not doc.get('cameras') and not doc.get('extensionsRequired')
    assert 'KHR_lights_punctual' not in doc.get('extensions',{})
    tris=0
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            assert p.get('mode',4)==4
            tris+=doc['accessors'][p['indices']]['count']//3
            for name in ['POSITION','NORMAL','TEXCOORD_0','COLOR_0']:
                a=doc['accessors'][p['attributes'][name]];v=doc['bufferViews'][a['bufferView']]
                data=np.frombuffer(binary[v['byteOffset']:v['byteOffset']+v['byteLength']],dtype='<f4')
                assert np.isfinite(data).all(),name
    for m in doc['materials']:
        assert m['pbrMetallicRoughness']['baseColorFactor']==[1,1,1,1]
        assert m.get('normalTexture',{}).get('scale',.55)<=1
        if 'vegetacion' in m['name']:assert m['alphaMode']=='MASK'
    for im in doc['images']:
        v=doc['bufferViews'][im['bufferView']];data=binary[v['byteOffset']:v['byteOffset']+v['byteLength']]
        img=Image.open(io.BytesIO(data));w,h=img.size
        assert max(w,h)<=1024
        if '_normal' in im['name'] or '_orm' in im['name']:assert max(w,h)<=512
        if img.format=='PNG':assert img.mode=='RGBA',im['name']
        else:assert img.format=='JPEG'
        gpu_instances+=int(w*h*4*4/3)
        images[hashlib.sha256(data).hexdigest()]={'name':im['name'],'size':[w,h],'format':img.format,'gpu_bytes_with_mips':int(w*h*4*4/3)}
    total+=tris;materials+=len(doc['materials'])
    results['models'].append({'file':filename,'triangles':tris,'materials':len(doc['materials']),'images':len(doc['images']),'bytes':len(raw)})
assert total<=40000 # no LOD required
assert materials<=30 and sum(m['images'] for m in results['models'])<=25
results.update(total_triangles=total,material_slots_total=materials,embedded_image_instances=sum(m['images'] for m in results['models']),unique_images=len(images),textures=list(images.values()),gpu_unique_mib=round(sum(v['gpu_bytes_with_mips'] for v in images.values())/1048576,2),passed=True)
collision=json.loads((ROOT/'collision_map.json').read_text(encoding='utf-8'))
boxes=next(v for v in collision.values() if isinstance(v,list) and v and isinstance(v[0],dict) and 'center' in v[0] and 'size' in v[0])
mins=np.array([np.array(o['center'])-np.array(o['size'])/2 for o in boxes]);maxs=np.array([np.array(o['center'])+np.array(o['size'])/2 for o in boxes])
audit=json.loads((ROOT/'geometry_audit.json').read_text());protrusions=[];violations=[]
for o in audit:
    low=np.array(o['min']);high=np.array(o['max']);rule=o['rule']
    if high[1]<=.12 or low[1]>=2 or rule in ['existing','ground']:continue
    if rule=='foliage_noncover':
        assert high[1]<=.66001, (o['name'],'body-height foliage',high[1])
        continue
    clippedlow=low.copy();clippedhigh=high.copy();clippedlow[1]=max(.12,low[1]);clippedhigh[1]=min(2,high[1])
    maxdist=0
    for p in product(*zip(clippedlow,clippedhigh)):
        p=np.array(p);dist=np.linalg.norm(np.maximum(np.maximum(mins-p,p-maxs),0),axis=1).min();maxdist=max(maxdist,float(dist))
    allowance=.45
    if rule in ['wall_detail_<=6cm','existing_detail_<=6cm','trunk_existing']:allowance=.06
    if rule=='low_wall_detail':
        gap=np.linalg.norm(np.maximum(np.maximum(mins-high,low-maxs),0),axis=1).min()
        assert high[1]<=.66 and gap<=.03,(o['name'],'low decor must touch a wall',gap)
        allowance=.66  # Explicit user exception: low pots touching a wall.
    if maxdist>allowance+1e-5:violations.append({'name':o['name'],'distance':maxdist,'rule':rule})
    protrusions.append({'name':o['name'],'rule':rule,'max_corner_distance_m':round(maxdist,4),'height_max':round(float(high[1]),4)})
results['decoration_body_audit']={'method':'All body-slice AABB corners to nearest original solid/move box; geometric bound, not gameplay proof','checked':len(protrusions),'max_distance_m':max(v['max_corner_distance_m'] for v in protrusions),'violations':violations}
(ROOT/'decoration_clearance.json').write_text(json.dumps(protrusions,indent=2),encoding='utf-8')
assert not violations,violations
# Actual two-file memory upper estimate includes copies duplicated in both GLBs.
results['gpu_two_files_mib']=round(gpu_instances/1048576,2)
(ROOT/'validation.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
