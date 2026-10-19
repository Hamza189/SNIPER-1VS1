"""Generate delivery documentation from measured outputs, only inside this folder."""
from pathlib import Path
from collections import defaultdict
import json,hashlib,csv,struct
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
qa=json.loads((ROOT/'validation.json').read_text());browser=json.loads((ROOT/'browser_qa.json').read_text());stats=json.loads((ROOT/'stats.json').read_text())
assert qa['passed'] and browser['passed']
assert browser['v2']['triangles']==qa['total_triangles']
records=json.loads((ROOT/'geometry_audit.json').read_text());sources=json.loads((ROOT/'texture_sources.json').read_text());clearance=json.loads((ROOT/'decoration_clearance.json').read_text())
def piece(r):
    n=r['name']
    if r['roof']:return 'Techo separado (villa + garaje)'
    if n.startswith('suelo_'):return 'Suelos continuos, sin capas coplanares'
    if n.startswith('villa_'):return 'Villa: paredes, huecos, marcos y hojas'
    if n.startswith('garaje_'):return 'Garaje: paredes, huecos y detalles'
    if n.startswith(('arbol','olivo','cipres','pergola_parra','buganvilla','plantacion','maceta_flor')):return 'Vegetación y troncos'
    if n.startswith('pergola_'):return 'Pérgola estructural'
    if n.startswith(('perimetro','porton')):return 'Perímetro y portón'
    return 'Mobiliario, ambiente, cornisas y patio'
pieces=defaultdict(lambda:{'triangles':0,'materials':set()})
for r in records:
    p=pieces[piece(r)];p['triangles']+=r['triangles'];p['materials'].add(r['material'])
assert sum(p['triangles'] for p in pieces.values())==qa['total_triangles']
with (ROOT/'piece_stats.csv').open('w',newline='',encoding='utf-8-sig') as f:
    writer=csv.writer(f);writer.writerow(['pieza','triangulos','material_fuente','techo','regla','min_xyz','max_xyz'])
    for r in records:writer.writerow([r['name'],r['triangles'],r['material'],r['roof'],r['rule'],r['min'],r['max']])
mesh_rows=[]
for item in qa['models']:
    raw=(ROOT/'models'/item['file']).read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n])
    for m in doc['meshes']:
        prim=m['primitives'][0];mesh_rows.append(f"| {m['name']} | {doc['accessors'][prim['indices']]['count']//3} | {doc['materials'][prim['material']]['name']} |")

def table(headers,rows):return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |']+['| '+' | '.join(map(str,row))+' |' for row in rows])
licenses=['# Licencias — CASA ATLAS XL v2','', 'Las texturas escaneadas proceden de Poly Haven y son CC0-1.0. Referencia: https://polyhaven.com/license .','',table(['Asset','Autor/es','Uso / transformación','Fuente'],[(s['asset'],', '.join(s.get('authors',[])) or 'Consultar fuente','Redimensionado JPEG; normales OpenGL y rugosidad empaquetada cuando se usan. '+s.get('adaptation',''),s['url']) for s in sources]),'',
'`ochre_color.jpg` deriva de white_stucco_02 mediante un tinte cálido aplicado a los píxeles. `linen_color.jpg` es una adaptación salvia poco contrastada de fabric_pattern_07. Los factores baseColorFactor de los GLB son siempre [1,1,1,1].',
'','`botanical.png`, `glass.png` y `palette.jpg` son originales procedurales de esta entrega; no se presentan como escaneados. La geometría v2 y los scripts son trabajo original para SNIPER DUEL. Se entregan para uso, modificación y distribución por el propietario sin restricción adicional. La planta y las colisiones proceden de su entrega v1, preservada.',
'','Proveniencia y SHA-256: `texture_sources.json`. Los archivos nuevos descargados y sus metadatos están en `sources/`; las cinco fuentes aprobadas y sandstone se leen de la importación local anterior al regenerar. Ningún proveedor de pago.']
(ROOT/'LICENSE_ASSETS.md').write_text('\n'.join(licenses),encoding='utf-8')
body=f'''# CASA ATLAS XL v2 — entrega para revisión de Claude

Fecha: 19-10-2026. **IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.**
No integrado en el juego publicado. No probado online: CASA ATLAS XL sigue siendo un mapa local en el código actual.
Sin commits ni publicación. Esta carpeta es la entrega; Claude conserva la integración y las pruebas de hardware.

## Contrato conservado

`collision_map.json` es idéntico byte por byte al de la v1: 98 cajas, 2 spawns, zonas, origen y metadatos intactos.
SHA-256: `{stats['collision_sha256']}`.
No existe `collision_changes.json` porque no se propone ningún cambio físico. Metros, +Y arriba, calle +Z, y=0 jugable.
Muros, espesores, dinteles y aperturas salen de la receta de la v1. Los nuevos marcos quedan sobre los muros,
sin estrechar los huecos. Rejas, cristales y follaje conservan el carácter cosmético: la balística debe seguir usando las cajas originales.
El JSON conserva por diseño las métricas visuales antiguas: para v2 usar `validation.json`, no `renderMeshes` del JSON v1.

## Archivos de integración

- `models/sd_casa_atlas_xl_v2.glb` — escena principal.
- `models/sd_casa_atlas_xl_v2_techo.glb` — techo opaco obligatorio, independiente.
- `collision_map.json` — copia exacta de v1.
- `viewer.html` — comparación v1/v2, seis cámaras, WASD y arrastre para inspección libre (sin colisiones).
- `preview/v2_*.png` — seis vistas finales a 1,62 m; `preview/v1_*.png`, mismas cámaras e iluminación.
- `preview/game_import.png` — prueba de importación en el juego actual, mediante sustitución temporal de respuestas en el navegador de pruebas.
- `piece_stats.csv`, `geometry_audit.json`, `decoration_clearance.json` — desglose y salientes auditables.
- `src/` — preparación de texturas, generación en Blender, validación y capturas reproducibles.

## Qué cambia

Villa mediterránea de cal blanca y cal cálida, suelo de barro cocido escaneado y rodapié de arcilla.
Marcos y alféizares reales, rejas finas, contraventanas abiertas con lamas y herrajes, puertas abiertas contra los muros
y umbrales de 1,8 cm. Cornisas, azotea con pretil y albardillas; garaje con teja árabe curva, cumbrera, canalones,
bajante y portón abierto elevado. Techo interior de yeso, lámparas, sofá con brazos/asientos y mesas con patas,
herrajes y cajones sobre muebles existentes. Pérgola con vigas y travesaños, parra, buganvilla, macetas bajas,
faroles, toldo, aire acondicionado y cable. Tres olivos ramificados y un ciprés usan los cuatro troncos físicos originales.
El terreno y los pavimentos son una malla de caras contiguas a y=0, evitando superficies de suelo superpuestas.
No se añade moto/carretilla: requeriría cobertura nueva o una caja propuesta.

## Presupuesto medido sobre los GLB

{table(['Archivo','Triángulos','Materiales / primitivas','Imágenes embebidas','MiB'],[(m['file'],m['triangles'],m['materials'],m['images'],round(m['bytes']/1048576,2)) for m in qa['models']])}

Total: **{qa['total_triangles']:,} triángulos**, **{qa['material_slots_total']} materiales/primitivas entre los dos archivos**, **{qa['embedded_image_instances']} imágenes cargadas**.
Hay {qa['unique_images']} imágenes diferentes: tres se duplican entre GLB para que sean autocontenidos. Sin Draco, meshopt, KTX2, cámaras ni luces.
No hace falta LOD según el encargo: el total es menor de 40.000.
Memoria estimada de texturas RGBA8 con mipmaps: **{qa['gpu_two_files_mib']} MiB** sin deduplicar los dos GLB;
{qa['gpu_unique_mib']} MiB si un integrador comparte las tres imágenes repetidas. Es una estimación, no una medida de VRAM.
JPEG reduce descarga, no memoria descomprimida: la reducción de memoria viene de resoluciones y reutilización.
Los 27 envíos son el máximo del pase de color del asset completo; sombras, transparencia y resto del juego tienen coste adicional.

### Desglose por conjunto

{table(['Conjunto','Triángulos','Materiales fuente compartidos'],[(k,v['triangles'],len(v['materials'])) for k,v in pieces.items()])}

Los conjuntos comparten materiales; no sumar esa columna como llamadas de dibujo. El CSV desglosa cada pieza.

### Primitivas reales exportadas

| Malla | Triángulos | Material |
| --- | --- | --- |
{chr(10).join(mesh_rows)}

## Texturas, escala y luz interior

{table(['Imagen','Resolución','Formato'],[(t['name'],' × '.join(map(str,t['size'])),t['format']) for t in qa['textures']])}

Licencias y URLs individuales en `LICENSE_ASSETS.md`. Color sRGB; normal/rugosidad lineales. Normales OpenGL,
normalScale 0,55. Textura de barro a 2,08 m por repetición, estuco 1,8 m, adoquín 2 m, puertas 2 m;
tejas modeladas de unos 0,29 × 0,52 m. Los materiales secundarios pequeños usan rugosidad constante.
Follaje en atlas original RGBA con alphaMode MASK, cutoff 0,5; vidrio en BLEND. No hay caras de vegetación opacas.

AO y luz de cuatro lámparas se calculan en Blender con rayos sobre BVH y se guardan en **COLOR_0**
({stats['baked_vertices']} vértices interiores únicos). Las paredes se subdividen para interpolar ese horneado.
Es un horneado por vértices de visibilidad e irradiancia simplificada, **no una lightmap de Cycles**.
Los materiales interiores reutilizan su color como emisión muy tenue (0,04–0,075) para conservar legibilidad bajo el techo.
Las capturas usan sol y hemisferio; no dependen de luces interiores añadidas solo para las fotos.

## Salientes y coberturas

La comprobación independiente revisa {qa['decoration_body_audit']['checked']} piezas decorativas a altura corporal.
Marcos, lamas, hojas, herrajes, rodapiés y detalles de muebles cumplen una distancia de sus esquinas ≤6 cm
a las cajas originales. Alféizares: 5,5 cm hacia fuera; rodapiés: 2,5 cm. No se usan capas pintadas a 3–6 mm.
La bajante llega a 21,2 cm de la caja por su codo; es un tubo de 7 cm de diámetro, dentro del límite decorativo de 45 cm.
Macetas: hasta 51 cm de alto, tocando la pared; llegan a unos 49,4 cm desde la caja por el diámetro y
se acogen explícitamente a la excepción de decoración baja ≤66 cm pegada a pared. Flores bajas: ≤66 cm.
Copas y ramas salientes empiezan por encima de 2 m; los troncos usan las posiciones originales y una silueta dentro de 3 cm de las cajas.
Cornisas: 9 cm más allá de fachada; toldo: 1,05 m desde la cara exterior; cubierta del garaje: ≤45 cm;
aire acondicionado: 42 cm. Todo ello por encima de 2 m y por debajo del límite de 1,2 m de saliente de fachada.
El peralte máximo del nuevo tejado/ciprés es visual: no crea superficies jugables ni nuevas cajas.
Ver cifras por pieza en `decoration_clearance.json`; esta prueba geométrica no sustituye el recorrido humano.

## Verificación realizada y límites

- GLB analizados independientemente: índices/atributos finitos, materiales, imágenes, presupuestos y ausencia de extensiones no soportadas.
- Three.js **{browser['v2']['three']}**: ambos GLB cargan sin errores; {browser['v2']['materials']} materiales y {browser['v2']['textureObjects']} texturas en el navegador.
- Seis cámaras a **1,62 m** con techo puesto; v1/v2 con posición, objetivo e iluminación idénticos.
- Juego actual probado mediante interceptación local de sus dos peticiones de GLB: **{browser['game']['navigationNodes']} nodos**, **{browser['game']['navigationComponents']} componente**.
- Bot durante 40 segundos de simulación: {browser['game']['bot40s']['moved']:.1f} m recorridos, cero entradas en cajas y cero salidas de parcela.
- Sin cambios en archivos de juego, colisiones, servidor ni integración. La interceptación desaparece al cerrar ese navegador de pruebas.
- Capturas con Chromium/SwiftShader: válidas para aspecto/importación, **no para FPS de GTX ni iPhone**.
- Pendientes de Claude/propietario: comparación y aceptación visual en hardware, medidas GTX, móvil y eventual integración/publicación.

## Reproducir en este repositorio

Desde la raíz del proyecto, PowerShell:

```powershell
& 'assets/3d/imports/2026-10-19_casa_atlas_xl_v2/src/run.ps1'
python -B assets/3d/imports/2026-10-19_casa_atlas_xl_v2/src/validate_delivery.py
node assets/3d/imports/2026-10-19_casa_atlas_xl_v2/src/capture_and_test.js
python -B assets/3d/imports/2026-10-19_casa_atlas_xl_v2/src/write_report.py
```

Blender predeterminado: `D:\\Blender\\blender.exe`; se puede pasar `-Blender RUTA` al PS1.
Requiere Python con Pillow/numpy, Blender y Node/Playwright ya instalados. Usa Chrome/Edge si falta el Chromium de Playwright.
Los temporales, cachés y perfil de pruebas se escriben en `.work/` dentro de esta carpeta, excluida del manifiesto.
La receta base y las fuentes CC0 previas se leen de las importaciones anteriores del repositorio. Las descargas adicionales
están cacheadas en `sources/` y se verifican contra el hash de Poly Haven.

Para ver el visor, servir la raíz del repositorio y abrir
`/assets/3d/imports/2026-10-19_casa_atlas_xl_v2/viewer.html`.
La bandera `?version=v1` cambia solo el visor. El visor no es una integración ni una bandera nueva del juego.
'''
(ROOT/'CASA_ATLAS_XL_V2.md').write_text(body,encoding='utf-8')
(ROOT/'README.md').write_text('# CASA ATLAS XL v2\n\nEntrega de assets para revisión de Claude. Leer [CASA_ATLAS_XL_V2.md](CASA_ATLAS_XL_V2.md).\n\nDos GLB en `models/`, colisiones idénticas, fuentes en `src/`, seis comparativas en `preview/`. Sin integración, commits ni publicación.\n',encoding='utf-8')
(ROOT/'PARA_CLAUDE.md').write_text('''# Para Claude — entrega aislada

No se ha tocado código del juego ni hecho commits. Esta carpeta contiene la entrega v2 y sus pruebas.

1. Leer CASA_ATLAS_XL_V2.md y comparar preview/v1_*.png con v2_*.png.
2. Verificar collision_map.json contra la v1: deben coincidir incluso los bytes.
3. Los dos GLB son autocontenidos, +Y arriba, sin escala/rotación adicional. Techo obligatorio.
4. Materiales con v2_vidrio, v2_agua, v2_vegetacion_*, v2_tierra y v2_adoquin mantienen las clasificaciones por regex del cargador actual. Las claves no coinciden con XL_TEXSET: no sobrescribir las texturas v2 con xltex=1.
5. El juego se probó sustituyendo solo las respuestas de los GLB dentro de Playwright; no se cambiaron assets/maps ni src/page.html.
6. AO/irradiancia está en COLOR_0, más emisión interior tenue. Conservar vertexColors y los mapas de emisión al integrar.
7. Rejas y hojas siguen siendo cosméticas frente a las cajas originales. Mesas/sofá mantienen el proxy AABB original, incluido su volumen vacío: revisar visualmente esa simplificación antes de aprobar.
8. No se han medido FPS de GTX/iPhone ni jugado online. Tu revisión e integración quedan pendientes.

Temporales actuales en .work/ (ignorado). En la fase anterior a la instrucción de limitar toda la entrega a esta carpeta se crearon también temporales en build/casaxl-v2-runtime/ dentro del proyecto; no se han movido ni borrado después de esa instrucción. No forman parte de la entrega.
AGENTS.md ya estaba presente al comenzar: no fue creado ni modificado por esta sesión.
''',encoding='utf-8')

# Contact sheet uses the actual captured frames, not generated artwork.
sheet=Image.new('RGB',(1280,3*360),(239,237,230))
for i,view in enumerate(['calle','patio','pergola','interior','jardin','garaje']):
    im=Image.open(ROOT/'preview'/('v2_'+view+'.png')).convert('RGB').resize((640,360),Image.Resampling.LANCZOS)
    sheet.paste(im,((i%2)*640,(i//2)*360))
sheet.save(ROOT/'preview'/'resumen_v2.jpg',quality=92)
stats['status']='IMPLEMENTADO; PROBADO EN NAVEGADOR; PENDIENTE DE VALIDACION EN IPHONE; SIN INTEGRAR'
(ROOT/'stats.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
manifest={str(p.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in ROOT.rglob('*') if p.is_file() and '.work' not in p.parts and p.name!='manifest.sha256.json' and '__pycache__' not in p.parts}
(ROOT/'manifest.sha256.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Report, licenses, contact sheet and manifest:',len(manifest),'files')
