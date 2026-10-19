from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent.parent
build=json.loads((R/'build.json').read_text());v=json.loads((R/'validation.json').read_text());browser=json.loads((R/'browser_qa.json').read_text());static=json.loads((R/'validate-glb.json').read_text())
sha=hashlib.sha256((R/'personaje.glb').read_bytes()).hexdigest()
assert sha==build['sha256']==v['sha256']==browser['sha256']
assert v['passed'] and browser['browserImportPassed'] and static['ok']
rows=[]
for c in build['clips']:
 m=v['clips'][c['name']];rows.append(f"| `{c['name']}` | {c['duration']:.2f} | {'sí' if c['loop'] else 'no'} | {m['head']*100:.2f} | {' / '.join(f'{x*100:.2f}' for x in m['torso'])} | {' / '.join(f'{x*100:.2f}' for x in m['legs'])} |")
drift=max(x.get('interior_stance_ankle_drift_m',0) for x in v['clips'].values())
doc=f'''# PERSONAJE — entrega para revisión de arte, 19-10-2026

**IMPLEMENTADO como asset · PROBADO EN NAVEGADOR (visor aislado, Three.js r128) · NO INTEGRADO · NO PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE.**

Tres apariencias del mismo soldado: A arena/ocre, B oliva/gris oscuro, bots gris/negro. Comparten malla, UV, esqueleto y animaciones. Los cambios de apariencia solo sustituyen la textura de color. No hay armas, cámaras ni luces en el GLB. Obra procedural original; aspecto de pocos polígonos para revisión, sin aprobación visual del propietario todavía.

## Archivos y reproducción

- `personaje.glb`: {(R/'personaje.glb').stat().st_size:,} bytes; SHA-256 `{sha}`.
- `textures/color_A.jpg`, `color_B.jpg`, `color_bots.jpg`, `normal.png`, `orm.png`: 1024 × 1024. A, normal y ORM están también embebidas en el GLB.
- `src/build_character.py`: fuente ejecutada con Blender 5.2.2; `src/textures.py`: atlas original determinista con numpy/Pillow. No hace falta un servicio externo.
- `viewer.html`: visor local con selector de clip, apariencia y LOD; no modifica el juego.
- `preview/`: frente, perfil y espalda de cada apariencia con esfera/cajas; poses, comparativa y GIF de sprint in-place.
- `src/validate.py`: lector independiente del GLB y prueba de deformación en los tres LOD; `src/capture.js`: comprobación adicional con AnimationMixer de Three r128.

En PowerShell, desde la raíz del proyecto:
```powershell
& 'assets/3d/imports/2026-10-19_personaje/src/run.ps1'
C:\\Python314\\python.exe assets/3d/imports/2026-10-19_personaje/src/validate.py
node tools/validate-glb.js assets/3d/imports/2026-10-19_personaje/personaje.glb --lod0 10000 --lod1 4000 --lod2 1500 --json assets/3d/imports/2026-10-19_personaje/validate-glb.json
& 'assets/3d/imports/2026-10-19_personaje/src/run.ps1' -Stage preview
C:\\Python314\\python.exe assets/3d/imports/2026-10-19_personaje/src/report.py
```
Los ejecutables están ajustados al PC actual: Blender en `D:\\Blender\\blender.exe`, Python en `C:\\Python314\\python.exe`. Temporales, perfiles y cachés propios se redirigen a `.work/` dentro de esta entrega. No distribuir `.work/`.

## Medidas y esqueleto

Metros; +Y arriba, +Z delante; origen entre los pies, suelo y=0. Casco de pie: **1,778 m**. La esfera autoritativa termina en 1,780 m. La cabeza, gafas y casco caben sin usar los 4 cm de tolerancia.

Referencia de ojos `Eyes`: de pie 1,620 m, crouch 1,000 m, slide 0,850 m. Cabeza: centros 1,630000 / 1,006173 / 0,855247 m; radio fijo 0,15 m. Altura máxima aproximada de casco en posturas bajas: 1,154173 / 1,003247 m. Se usa el cociente exacto de `core/hitbox.js`, no 0,62/0,52 redondeado. **No aplicar otra escala vertical al modelo.**

26 huesos, máximo **2 influencias efectivas por vértice**, 4 componentes exportados y pesos normalizados. Esqueleto compartido por los tres LOD. Un SkinnedMesh y una llamada de dibujo por LOD activo; ocultar expresamente los otros dos. `extras.defaultVisible` es metadato, Three no lo aplica automáticamente.

| Nodo | Triángulos | Vértices | Materiales |
|---|---:|---:|---:|
'''
for n,m in build['parts'].items():doc+=f"| {n} | {m['triangles']} | {m['vertices']} | 1 |\n"
doc+='\nHuesos: '+', '.join('`'+n+'`' for n in build['bones'])+'.\n'
doc+='''
`socket_arma_R` es hijo de RightHand, `socket_arma_L` de LeftHand. Origen en la palma, +Z hacia el cañón, +Y arriba. R es el anclaje del arma; L es un objetivo de apoyo, no un segundo padre para el arma. La alineación exacta con las empuñaduras reales de viewmodels.glb debe ajustarse y probarse al integrar.

Un material PBR opaco. Color sRGB JPEG; normal OpenGL RGB; ORM R=oclusión (255, sin AO horneada), G=rugosidad, B=metal. Estimación RGBA8 con mipmaps: 16 MiB para tres mapas residentes; 26,7 MiB si se mantienen los cinco mapas de las tres apariencias. Son estimaciones, no una medición de memoria del iPhone.

## Animaciones y medición de envolventes

28 clips, claves a 30 Hz más extremo exacto cuando la duración no es múltiplo de 1/30. Interpolación glTF CUBICSPLINE con tangentes derivadas de la trayectoria; aim_up/down son una única clave y duración cero. Root no recibe pistas; las caídas desplazan Hips como parte de la pose y acaban inmóviles. El salto de ~1 m lo realiza el juego: jump_air no eleva la raíz.

Tabla: máximo que sale de cada zona en **centímetros**, muestreando el clip a 60 Hz en los tres LOD. Torso y piernas se muestran en orden X / Y / Z. Cabeza es distancia radial adicional. Los brazos/manos están exentos y no se cuentan como torso. Todas las piezas restantes, incluido equipo grueso, sí se cuentan. `_ZONE` y el inventario de piezas en build.json hacen auditable la asignación.

| Clip | Duración s | Bucle | Cabeza radial cm | Torso X/Y/Z cm | Piernas X/Y/Z cm |
|---|---:|:---:|---:|---|---|
'''+ '\n'.join(rows)+f'''

Límite de cabeza: 0. Límite de torso y piernas: 4 cm, salvo piernas de walk_* y sprint: **45 cm exclusivamente en el eje de marcha** (X en lateral, Z en adelante/atrás/sprint). Es la última excepción autorizada por Hamza. Death, jump y gestos de combate también se informan, pero no se contrastan contra la postura de pie como condición de aceptación. Las cajas del servidor no se han modificado. Una pierna visible fuera de su caja durante la locomoción no recibe impacto allí.

Estas son comprobaciones discretas de clips aislados, no una prueba matemática de todos los instantes ni de todas las mezclas. Claude debe comprobar las mezclas reales en el juego, especialmente cambios de postura y aim_up/down.

## Contacto, aspecto y límites de esta versión

walk_* y sprint duran 0,56 s por ciclo (214 pasos/minuto). Las velocidades de referencia son 4,6 y 7 m/s. A 4,6 m/s el paso visual es un trote, aunque la API llame al clip walk. La fase de apoyo es 28% del ciclo al caminar y 20% en sprint; la trayectoria de retorno tiene rampas de aceleración acotadas para no superar 45 cm.

La prueba independiente compensa la velocidad del juego y mide la deriva horizontal del tobillo durante el interior de cada apoyo a 240 Hz: máximo **{drift*1000:.3f} mm**. Excluye los segmentos de 1/30 s que cruzan despegue/contacto; no demuestra bloqueo perfecto de toda la suela durante esas transiciones. La integración debe sincronizar timeScale con velocidad real y desactivar locomoción al detenerse. El GIF muestra el clip in-place sobre suelo fijo: el retroceso local del pie durante apoyo se cancela con el movimiento del jugador en el juego.

Crouch y slide conservan la compresión vertical necesaria para las cajas estrechas; no representan unas cuclillas anatómicas completas. Slide adelanta ligeramente una pierna dentro de esos límites. Hay que aprobar visualmente este compromiso y la continuidad de las articulaciones. El extremo inferior de algunas superficies de pierna puede atravesar el plano del suelo unos milímetros durante locomoción; la tabla Y conserva ese dato, no lo oculta.

No se ha certificado realismo, legibilidad a 150 m, ajuste de armas, calidad de mezclas ni 60 FPS en iPhone. Los gestos de recarga/cerrojo están en el personaje; las piezas móviles del arma deben animarse por separado al integrar. Tampoco hay IK de pies ni adaptación a escaleras en este asset.

## Pruebas y siguiente responsable

`validate-glb.json`: pasa el validador del proyecto. `validation.json`: pasa envolventes de los tres LOD y contacto interior de apoyo. `browser_qa.json`: importación y reproducción de 28 clips en Three r128, sin errores JavaScript; envolventes comprobadas también con boneTransform. Chrome usa SwiftShader para estas capturas: no es una medición de FPS en GPU física.

Para Claude: conservar esta carpeta original, integrar tras ?pj=2; sustituir makeSoldier/animateSoldier para bots y RemotePlayer, ocultar LOD inactivos, usar las texturas comunes y retirar solo para este modelo la escala vertical externa. Usar la tabla de bucles: el cargador no configura LoopRepeat por leer extras. Death y demás acciones finitas: LoopOnce + clampWhenFinished. aim_up/down: tratar como poses y comprobar la estrategia de mezcla, no sumar dos poses absolutas sin convertirlas si se usa mezcla aditiva.

Después: armas reales en sockets, medición de llamadas/triángulos/CPU con tres bots, capturas antes/después con la misma cámara, aim.browser, online.browser, fauna/cover y npm test. Las pruebas del juego no se han ejecutado porque esta entrega no cambia ni integra el código. El propietario aprueba el aspecto y prueba iPhone; hasta entonces no cambiar el personaje por defecto. No se han hecho commits ni publicaciones.
'''
(R/'PERSONAJE.md').write_text(doc,encoding='utf8')
(R/'LICENSE_ASSETS.md').write_text('''# Origen y licencia

Geometría, esqueleto, clips y atlas de esta entrega son obra procedural original generada para Hamza/SNIPER DUEL mediante los scripts incluidos. No se han descargado modelos, animaciones, fotografías ni texturas de terceros. No contiene rasgos de una persona real, marcas ni armas.

En la medida en que existan derechos sobre estos assets originales, se ofrecen bajo CC0-1.0: https://creativecommons.org/publicdomain/zero/1.0/ . El propietario puede usar, modificar y redistribuirlos, incluso comercialmente, sin atribución obligatoria. Esta declaración se refiere a los assets y scripts nuevos de esta carpeta, no al juego ni a las bibliotecas externas.

Blender, numpy, Pillow, Three.js y Playwright se usan como herramientas o dependencias locales; no se relicencian ni se incluyen sus distribuciones en el paquete. Las vistas previas se renderizan con el Three.js r128 ya presente en el proyecto.

Procedencia del encargo: mensajes del propietario y adjunto de 19-10-2026, con aclaraciones de altura, posturas finales y excepción de locomoción recogidas en ENCARGO.md. No se han usado servicios de generación de pago.
''',encoding='utf8')
(R/'README.md').write_text('''# Soldado SNIPER DUEL — entrega de arte para revisión

Empieza por [PERSONAJE.md](PERSONAJE.md). Modelo: [personaje.glb](personaje.glb). Tres apariencias: [comparativa](preview/tres_apariencias.jpg). Fuente y pruebas: src/. Licencia: LICENSE_ASSETS.md.

Estado: asset generado y comprobado en visor Three r128; integración, revisión de arte y validación de rendimiento en dispositivos pendientes. No activar por defecto sin aprobación de Hamza. No distribuir .work/.
''',encoding='utf8')
# Presentation sheets are assembled from actual Three.js renders, never concepts.
sheet=Image.new('RGB',(1350,780),(40,48,56));d=ImageDraw.Draw(sheet)
for i,(name,title) in enumerate([('A','EQUIPO A · ARENA'),('B','EQUIPO B · OLIVA'),('bots','BOTS · GRIS')]):
 im=Image.open(R/'preview'/f'{name}_hero.png').convert('RGB');im=im.crop((290,75,835,945));im.thumbnail((435,700));sheet.paste(im,(i*450+(450-im.width)//2,60));d.text((i*450+90,22),title,fill=(230,231,225),font_size=22)
sheet.save(R/'preview'/'tres_apariencias.jpg',quality=94)
frames=[]
for p in sorted((R/'.work').glob('sprint_[0-9][0-9].png')):
 im=Image.open(p).convert('RGB').resize((560,500));frames.append(im)
if frames:frames[0].save(R/'preview'/'sprint_in_place.gif',save_all=True,append_images=frames[1:],duration=23,loop=0)
manifest={}
for p in sorted(R.rglob('*')):
 if p.is_file() and '.work' not in p.parts and p.name!='manifest.sha256.json':manifest[p.relative_to(R).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
(R/'manifest.sha256.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print('Reports and manifest:',len(manifest),'files; GLB',sha)
