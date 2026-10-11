# SNIPER DUEL — P0 Ground Pack v1.0 alpha

**Entrega real de ChatGPT**, material procedural original, para integración **exclusivamente** tras `?pueblo=3`. No se ha probado en el juego ni en un iPhone. Requiere la validación de Claude y la aprobación del propietario del proyecto.

## Contenido

- `textures/sd_ground_{plaza,cobble,sidewalk,sand,patch}_01_{basecolor,normal,roughness}.png`: 15 mapas 1024×1024, que se repiten. Normales OpenGL (+Y).
- `textures/sd_ground_decal_atlas_01.png`: atlas RGBA 1024×1024, cuadrícula 4×4 de 256×256, margen transparente 16 px.
- `textures/sd_ground_transition_sand_stone_01.png`: tira RGBA 1024×256, repetible horizontalmente, ancho transversal 1 m. Las variaciones del límite utilizan ruido periódico.
- `models/sd_ground_curb_kit_01.glb`: 8 componentes de bordillo, LOD0/LOD1 en nodos separados, 1 unidad=1 metro, +Y arriba. Al inicio de la arista +X, calle +Z, fondo −Z. Altura máxima ~10,4 cm por ribete, bordillo 9 cm; compatible con límite 12 cm.
- `manifest.json`: metadatos, nombres de nodos, escala y coordenadas de atlas.
- `previews/p0_ground_materials_preview.jpg`: vista de color sin iluminación del motor.
- `sources/generate_p0.py`: generador editable y reproducible (Python, Pillow, scipy, trimesh).

## Repeticiones

| Material | Tamaño del mosaico en mundo |
| --- | --- |
| plaza | 2 × 2 m |
| cobble (adoquín) | 2 × 2 m |
| sidewalk | 1,5 × 1,5 m |
| sand | 3 × 3 m |
| patch | 2 × 2 m |

En la plaza principal de ~22 × 22 m: evitar copias con el mismo punto de arranque en todas las superficies, conservar repetición modular en metros y utilizar calcas para variedad macroscópica. Las superficies en vista cenital son propuestas de materiales, no cambios de malla de colisiones.

## Integración solicitada a Claude

1. Crear copias 512² o menores por perfil; no cargar todos los originales de 1024² como mapas independientes al mismo tiempo en móvil. Medir **memoria GPU real** con formato de texturas y mipmaps, incluyendo normal, roughness, calcas, transición y otros recursos del suelo. El límite comunicado es **20 MB para todo el suelo nuevo en ALTO**.
2. BaseColor en sRGB; normal/roughness en espacio lineal; normal OpenGL +Y. Aclaración: mapa `roughness` en escala de grises independiente. Three.js MeshStandardMaterial suele usar roughnessMap **canal verde (G)**, por lo que es necesario convertir el PNG a RGB replicado o asignarlo a una textura RGBA compatible; verificar en el shader.
3. Atlas de calcas: 16 IDs en `manifest.json`; coordenadas `[columna, fila]` desde la esquina superior izquierda. Usar `alphaTest`/`MASK` para tapas/grietas, y blending controlado para manchas suaves; evitar z-fighting.
4. Bordillos: meshes con nodos por pieza. No crear 500 draw calls individuales: agrupar o instanciar según pieza/material. Colisiones no cambian. El ribete superior de los dos rectos llega a ~10,4 cm: dentro del máximo 12 cm, pero si se desea techo estricto 9 cm, quitar el ribete desde Three.js o regenerar.
5. Ubicar según `mapa-suelo-p0.png`: plaza ~22×22 plaza; calle norte adoquín; calle transversal asfalto actual (no hay asfalto nuevo en este primer pack); zonas exteriores arena; perímetros acera; parches desgaste. **No sustituir el asfalto por adoquín.**
6. Bandera experimental `?pueblo=3`, `&suelo=0` para comparación. Capturas ALTO/MEDIO/BAJO con misma cámara e informes de FPS, draw calls, carga y memoria. Prueba en iPhone pendiente.

## Calidad y limitaciones

Este es un **primer pack de materiales procedimentales originales**, no materiales escaneados fotogramétricos. Se ven como texturas de piedra suaves y sobrias, adecuadas como base; no prometer nivel AAA sin prueba visual a altura de ojos e iluminación real en el juego. Los mapas no incluyen sombras ni AO de luz solar. El detalle aparente depende del shader y la resolución efectiva.

## Licencia

Assets creados específicamente para SNIPER DUEL mediante generación geométrica/procedimental. Sin recursos visuales de terceros.
