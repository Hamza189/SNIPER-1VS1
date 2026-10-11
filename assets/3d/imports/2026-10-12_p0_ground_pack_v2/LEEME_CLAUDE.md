# SNIPER DUEL — P0 Ground Pack v2 (corrección tras QA de Claude)

**Estado:** entrega candidata para validación, NO desplegada en el juego. Comparar solo en `?pueblo=3&suelo=p0` y conservar `&suelo=0`. No sustituir superficies estables sin aprobación.

## Correcciones frente a v1

- **Color:** variación por losa/piedra, tonos más apagados y medias sRGB ~135–158 en vez de ruido uniforme. No se ha horneado iluminación direccional.
- **Relieve:** juntas hundidas, biseles y piedras con altura sintética en mapas OpenGL (+Y); se redujo la normal lateral para evitar exageración. Valores cuantificados en `QA_report.json`.
- **Adoquín:** 9 columnas y 10 filas de piedras por cada 2×2 metros, aparejo desplazado.
- **Plaza:** 4×4 losas por cada 2 m; 50 cm de lado, juntas rectas. La procedencia matemática de los bordes es periódica.
- **Patch:** rejilla 5×6 con desplazamiento periódico en filas; sin senos no periódicos.
- **Decals:** atlas 4×4 con guardas alpha de 16 px; grietas de 3–6 px y detalles metálicos dibujados. Sigue siendo ilustración procedural, NO escultura 3D: revisar a nivel FPS y descartar los decals que no mejoren.
- **Transición:** color variable real con alpha recortado para borde limpio, periodicidad horizontal exacta en el límite matemático.
- **Bordillos:** GLB único con 16 nodos (8 piezas × 2 LOD), UV0, normales exportadas, material PBR `sd_ground_curb_01`, geometría diferenciada para esquinas. Comprobar con el validador del repo.

## Estructura

- `textures/sd_ground_{plaza,cobble,sidewalk,sand,patch}_01_{basecolor,normal,roughness}.png`: 15 mapas originales a 1024².
- `textures/sd_ground_decal_atlas_01.png`: RGBA 1024², matriz 4×4. Índices en `manifest.json` `[col,row]`, origen superior izquierdo. Margen transparente 16 px.
- `textures/sd_ground_transition_sand_stone_01.png`: RGBA 1024×256; tira de 1 metro de ancho. Repetición sugerida longitud 2 metros; prueba antes de usar con diferentes UV.
- `textures/sd_ground_curb_01_basecolor.png`: textura embebida también en el GLB.
- `models/sd_ground_curb_kit_01.glb`: 16 piezas con nombres `sd_curb_<pieza>_LOD0/LOD1`.
- `QA_report.json`: cifras de bordes, brillo y normales.
- `sources/`: generadores reproducibles. `finish_art.py` es un postprocesado único: si se regenera desde cero, ejecutarlo solo una vez para evitar volver a desaturar.

## Convenciones de colocación y colisiones

- Segmentos rectos 1 m y 2 m: largo +X, cara hacia calle +Z, acera −Z; pivote origen a nivel 0, al inicio de la arista.
- Altura del bordillo 9 cm, rebaje desciende progresivamente de 9 cm a 0 por +X. Ninguna geometría supera 12 cm.
- Suelo permanece físicamente plano: no añadir nuevas colisiones o falsa cobertura.
- Medidas de repetición: plaza 2 m, adoquín 2 m, acera 1,5 m, arena 3 m, patch 2 m.
- Versiones por perfil 512² ALTO y menores MEDIO/BAJO, conforme al contrato de Claude. Evitar cargar recursos duplicados; verificar memoria del conjunto <=20 MB en ALTO.
- Usar una textura PBR por tipo de superficie; configurar `roughnessMap` y `normalMap` según motor actual, sin añadir luces especulares innecesarias.

## Condiciones para aprobación

1. `node tools/validate-glb.js models/sd_ground_curb_kit_01.glb` (o ruta real y argumentos de la herramienta del repo). El archivo **no ha pasado todavía este validador específico**.
2. Revisar normal OpenGL, repeat UV, bordes con mipmap y ausencia de costuras visibles a escala real.
3. Capturas iguales antes/después, ALTO/MEDIO/BAJO, especialmente **plaza y calle norte desde FPS**, no solo aéreas.
4. Verificar memoria GPU, draw calls, carga y FPS de iPhone sin grabar. El render de muestra no sustituye una prueba real.
5. Si alguno de los cinco materiales sigue peor que el suelo actual, **mantener el actual** y devolver defectos precisos sin forzar todo el pack.

**Limitación artística:** este pack v2 es generado mediante texturas procedurales, no fotogrametría. No se debe afirmar que parece AAA o que mejora al original sin la comparativa dentro del juego.
