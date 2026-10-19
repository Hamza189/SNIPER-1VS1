# PERSONAJE — entrega para revisión de arte, 19-10-2026

**IMPLEMENTADO como asset · PROBADO EN NAVEGADOR (visor aislado, Three.js r128) · NO INTEGRADO · NO PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE.**

Tres apariencias del mismo soldado: A arena/ocre, B oliva/gris oscuro, bots gris/negro. Comparten malla, UV, esqueleto y animaciones. Los cambios de apariencia solo sustituyen la textura de color. No hay armas, cámaras ni luces en el GLB. Obra procedural original; aspecto de pocos polígonos para revisión, sin aprobación visual del propietario todavía.

## Archivos y reproducción

- `personaje.glb`: 3,382,512 bytes; SHA-256 `452b495c3c9f68f32b91976f209ceca231570b8da0528a1e9848a0e9864de8bf`.
- `textures/color_A.jpg`, `color_B.jpg`, `color_bots.jpg`, `normal.png`, `orm.png`: 1024 × 1024. A, normal y ORM están también embebidas en el GLB.
- `src/build_character.py`: fuente ejecutada con Blender 5.2.2; `src/textures.py`: atlas original determinista con numpy/Pillow. No hace falta un servicio externo.
- `viewer.html`: visor local con selector de clip, apariencia y LOD; no modifica el juego.
- `preview/`: frente, perfil y espalda de cada apariencia con esfera/cajas; poses, comparativa y GIF de sprint in-place.
- `src/validate.py`: lector independiente del GLB y prueba de deformación en los tres LOD; `src/capture.js`: comprobación adicional con AnimationMixer de Three r128.

En PowerShell, desde la raíz del proyecto:
```powershell
& 'assets/3d/imports/2026-10-19_personaje/src/run.ps1'
C:\Python314\python.exe assets/3d/imports/2026-10-19_personaje/src/validate.py
node tools/validate-glb.js assets/3d/imports/2026-10-19_personaje/personaje.glb --lod0 10000 --lod1 4000 --lod2 1500 --json assets/3d/imports/2026-10-19_personaje/validate-glb.json
& 'assets/3d/imports/2026-10-19_personaje/src/run.ps1' -Stage preview
C:\Python314\python.exe assets/3d/imports/2026-10-19_personaje/src/report.py
```
Los ejecutables están ajustados al PC actual: Blender en `D:\Blender\blender.exe`, Python en `C:\Python314\python.exe`. Temporales, perfiles y cachés propios se redirigen a `.work/` dentro de esta entrega. No distribuir `.work/`.

## Medidas y esqueleto

Metros; +Y arriba, +Z delante; origen entre los pies, suelo y=0. Casco de pie: **1,778 m**. La esfera autoritativa termina en 1,780 m. La cabeza, gafas y casco caben sin usar los 4 cm de tolerancia.

Referencia de ojos `Eyes`: de pie 1,620 m, crouch 1,000 m, slide 0,850 m. Cabeza: centros 1,630000 / 1,006173 / 0,855247 m; radio fijo 0,15 m. Altura máxima aproximada de casco en posturas bajas: 1,154173 / 1,003247 m. Se usa el cociente exacto de `core/hitbox.js`, no 0,62/0,52 redondeado. **No aplicar otra escala vertical al modelo.**

26 huesos, máximo **2 influencias efectivas por vértice**, 4 componentes exportados y pesos normalizados. Esqueleto compartido por los tres LOD. Un SkinnedMesh y una llamada de dibujo por LOD activo; ocultar expresamente los otros dos. `extras.defaultVisible` es metadato, Three no lo aplica automáticamente.

| Nodo | Triángulos | Vértices | Materiales |
|---|---:|---:|---:|
| personaje_LOD0 | 5328 | 2963 | 1 |
| personaje_LOD1 | 2604 | 1586 | 1 |
| personaje_LOD2 | 924 | 599 | 1 |

Huesos: `Root`, `Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`, `Eyes`, `LeftShoulder`, `LeftArm`, `LeftForeArm`, `LeftHand`, `LeftThumb`, `LeftUpLeg`, `LeftLeg`, `LeftFoot`, `LeftToeBase`, `RightShoulder`, `RightArm`, `RightForeArm`, `RightHand`, `RightThumb`, `RightUpLeg`, `RightLeg`, `RightFoot`, `RightToeBase`.

`socket_arma_R` es hijo de RightHand, `socket_arma_L` de LeftHand. Origen en la palma, +Z hacia el cañón, +Y arriba. R es el anclaje del arma; L es un objetivo de apoyo, no un segundo padre para el arma. La alineación exacta con las empuñaduras reales de viewmodels.glb debe ajustarse y probarse al integrar.

Un material PBR opaco. Color sRGB JPEG; normal OpenGL RGB; ORM R=oclusión (255, sin AO horneada), G=rugosidad, B=metal. Estimación RGBA8 con mipmaps: 16 MiB para tres mapas residentes; 26,7 MiB si se mantienen los cinco mapas de las tres apariencias. Son estimaciones, no una medición de memoria del iPhone.

## Animaciones y medición de envolventes

28 clips, claves a 30 Hz más extremo exacto cuando la duración no es múltiplo de 1/30. Interpolación glTF CUBICSPLINE con tangentes derivadas de la trayectoria; aim_up/down son una única clave y duración cero. Root no recibe pistas; las caídas desplazan Hips como parte de la pose y acaban inmóviles. El salto de ~1 m lo realiza el juego: jump_air no eleva la raíz.

Tabla: máximo que sale de cada zona en **centímetros**, muestreando el clip a 60 Hz en los tres LOD. Torso y piernas se muestran en orden X / Y / Z. Cabeza es distancia radial adicional. Los brazos/manos están exentos y no se cuentan como torso. Todas las piezas restantes, incluido equipo grueso, sí se cuentan. `_ZONE` y el inventario de piezas en build.json hacen auditable la asignación.

| Clip | Duración s | Bucle | Cabeza radial cm | Torso X/Y/Z cm | Piernas X/Y/Z cm |
|---|---:|:---:|---:|---|---|
| `idle_rifle` | 2.00 | sí | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `aim_rifle` | 2.00 | sí | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `aim_up` | 0.00 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `aim_down` | 0.00 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `walk_fwd` | 0.56 | sí | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.11 / 39.46 |
| `walk_back` | 0.56 | sí | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.11 / 39.38 |
| `walk_left` | 0.56 | sí | 0.00 | 0.00 / 2.50 / 3.25 | 34.71 / 0.11 / 0.50 |
| `walk_right` | 0.56 | sí | 0.00 | 0.00 / 2.50 / 3.25 | 34.63 / 0.11 / 0.50 |
| `sprint` | 0.56 | sí | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.18 / 44.15 |
| `crouch_idle` | 2.00 | sí | 0.00 | 0.00 / 1.54 / 3.25 | 0.00 / 0.00 / 0.50 |
| `crouch_walk` | 0.50 | sí | 0.00 | 0.00 / 1.54 / 3.25 | 0.00 / 0.00 / 2.14 |
| `slide` | 1.00 | sí | 0.00 | 0.00 / 1.31 / 3.25 | 0.00 / 0.00 / 2.62 |
| `jump_start` | 0.30 | no | 4.29 | 0.00 / 7.48 / 3.25 | 0.00 / 0.00 / 0.50 |
| `jump_air` | 0.60 | sí | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 5.21 |
| `jump_land` | 0.30 | no | 4.29 | 0.00 / 7.48 / 3.25 | 0.00 / 0.00 / 0.50 |
| `fire_rifle` | 0.95 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `reload_rifle` | 2.35 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `idle_pistol` | 2.00 | sí | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `aim_pistol` | 2.00 | sí | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `fire_pistol` | 0.22 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `reload_pistol` | 1.45 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `fire_shotgun` | 0.25 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `pump_shotgun` | 0.32 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `reload_shell` | 0.32 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `knife_slash` | 0.45 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `hit_react` | 0.26 | no | 0.00 | 0.00 / 2.50 / 3.25 | 0.00 / 0.00 / 0.50 |
| `death_front` | 1.25 | no | 162.60 | 0.00 / 85.15 / 49.65 | 0.00 / 2.07 / 74.13 |
| `death_back` | 1.25 | no | 162.60 | 0.00 / 81.80 / 49.65 | 0.00 / 1.18 / 74.53 |

Límite de cabeza: 0. Límite de torso y piernas: 4 cm, salvo piernas de walk_* y sprint: **45 cm exclusivamente en el eje de marcha** (X en lateral, Z en adelante/atrás/sprint). Es la última excepción autorizada por Hamza. Death, jump y gestos de combate también se informan, pero no se contrastan contra la postura de pie como condición de aceptación. Las cajas del servidor no se han modificado. Una pierna visible fuera de su caja durante la locomoción no recibe impacto allí.

Estas son comprobaciones discretas de clips aislados, no una prueba matemática de todos los instantes ni de todas las mezclas. Claude debe comprobar las mezclas reales en el juego, especialmente cambios de postura y aim_up/down.

## Contacto, aspecto y límites de esta versión

walk_* y sprint duran 0,56 s por ciclo (214 pasos/minuto). Las velocidades de referencia son 4,6 y 7 m/s. A 4,6 m/s el paso visual es un trote, aunque la API llame al clip walk. La fase de apoyo es 28% del ciclo al caminar y 20% en sprint; la trayectoria de retorno tiene rampas de aceleración acotadas para no superar 45 cm.

La prueba independiente compensa la velocidad del juego y mide la deriva horizontal del tobillo durante el interior de cada apoyo a 240 Hz: máximo **0.139 mm**. Excluye los segmentos de 1/30 s que cruzan despegue/contacto; no demuestra bloqueo perfecto de toda la suela durante esas transiciones. La integración debe sincronizar timeScale con velocidad real y desactivar locomoción al detenerse. El GIF muestra el clip in-place sobre suelo fijo: el retroceso local del pie durante apoyo se cancela con el movimiento del jugador en el juego.

Crouch y slide conservan la compresión vertical necesaria para las cajas estrechas; no representan unas cuclillas anatómicas completas. Slide adelanta ligeramente una pierna dentro de esos límites. Hay que aprobar visualmente este compromiso y la continuidad de las articulaciones. El extremo inferior de algunas superficies de pierna puede atravesar el plano del suelo unos milímetros durante locomoción; la tabla Y conserva ese dato, no lo oculta.

No se ha certificado realismo, legibilidad a 150 m, ajuste de armas, calidad de mezclas ni 60 FPS en iPhone. Los gestos de recarga/cerrojo están en el personaje; las piezas móviles del arma deben animarse por separado al integrar. Tampoco hay IK de pies ni adaptación a escaleras en este asset.

## Pruebas y siguiente responsable

`validate-glb.json`: pasa el validador del proyecto. `validation.json`: pasa envolventes de los tres LOD y contacto interior de apoyo. `browser_qa.json`: importación y reproducción de 28 clips en Three r128, sin errores JavaScript; envolventes comprobadas también con boneTransform. Chrome usa SwiftShader para estas capturas: no es una medición de FPS en GPU física.

Para Claude: conservar esta carpeta original, integrar tras ?pj=2; sustituir makeSoldier/animateSoldier para bots y RemotePlayer, ocultar LOD inactivos, usar las texturas comunes y retirar solo para este modelo la escala vertical externa. Usar la tabla de bucles: el cargador no configura LoopRepeat por leer extras. Death y demás acciones finitas: LoopOnce + clampWhenFinished. aim_up/down: tratar como poses y comprobar la estrategia de mezcla, no sumar dos poses absolutas sin convertirlas si se usa mezcla aditiva.

Después: armas reales en sockets, medición de llamadas/triángulos/CPU con tres bots, capturas antes/después con la misma cámara, aim.browser, online.browser, fauna/cover y npm test. Las pruebas del juego no se han ejecutado porque esta entrega no cambia ni integra el código. El propietario aprueba el aspecto y prueba iPhone; hasta entonces no cambiar el personaje por defecto. No se han hecho commits ni publicaciones.
