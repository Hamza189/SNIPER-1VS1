# sd_e10_casa_oliva — SNIPER DUEL, nuevo asset 3D

**Tipo:** edificio mediterráneo 3D procedimental detallado, geometría real con huecos de puertas y ventanas; NO es una imagen plana.

**Destino:** PUEBLO E10 (6 × 10 m, muro 6 m, parapeto máximo +0,35 m). No modificar servidor ni mapa de colisiones.

**GLB:** glTF 2.0, GLB binario con texturas originales incorporadas, sin Draco/meshopt/KTX2.
**Origen y orientación:** centro de huella y=0; metros, +Y arriba, fachada principal +Z.
**Jerarquía:** `sd_e10_casa_oliva_LOD0`, `sd_e10_casa_oliva_LOD1`, `sd_e10_casa_oliva_LOD2`; mostrar **solo un LOD** a la vez.

| Nivel | Triángulos | Materiales |
|---|---:|---:|
| LOD0 | 13558 | 8 |
| LOD1 | 5990 | 6 |
| LOD2 | 348 | 3 |

**Peso GLB:** 4.75 MB. **Materiales:** sd_estuco, sd_piedra, sd_madera, sd_hierro, sd_vidrio, sd_teja, sd_vegetacion, sd_acento.
**Materiales PBR:** metálico/rugosidad, base color y normales donde aplicable; materiales integrados sin recursos externos.
**Licencia:** diseño y texturas originales; generados proceduralmente, sin contenidos externos.
**Ninguna animación, cámara ni luz** integrada en GLB.
**Regla:** no activar los 3 LOD simultáneamente; medir con los ajustes propios del juego.
**Importar primero a** `assets/3d/imports/`; ejecutar `tools/validate-glb.js` con --box 6,10,6; seguir con comprobación de cover `test/cover.browser.test.js`. No afirmar compatible sin esa validación.
**Pruebas realizadas aquí:** generación, límites de materiales/triángulos/tamaño, y carga redonda del GLB vía trimesh. **No** probado en iPhone ni con el validador de Claude.
**Plan de la fachada:** edificio urbano de estuco erosionado, dos puertas principales, escaparate con toldo pintado, ventanas retranqueadas y jambas 3D, persianas de lamas, dos balcones de hierro, vegetación, cornisas, red de agua y electricidad y azotea con pretil.
**Fuente:** `generate_e10_realista.py`; Python3 con numpy, pillow, scipy, trimesh. El archivo exportado es autónomo.
**IMPORTANTE:** si el validador detecta false-cover en aperturas, no publiques; envía el informe para retocar geometría e integración.
