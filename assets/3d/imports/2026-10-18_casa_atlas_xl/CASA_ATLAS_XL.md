# CASA ATLAS XL — SNIPER DUEL

## Entrega 3D real — build 2026-10-18

Mapa de una sola planta jugable de **40 × 32 metros** para francotirador 1v1. **GLB y colisiones reales**, generados mediante el script reproducible incluido. No es un concept art ni está integrado aún en el juego.

### Inventario

- `models/sd_casa_atlas_xl.glb` — geometría del terreno, casa, garaje, pérgola, patio, piscina decorativa, calles, árboles y coberturas. Texturas PBR embebidas.
- `models/sd_casa_atlas_xl_techo.glb` — techos opacos y pretiles de la casa y el garaje: renderizar durante el juego; ocultar únicamente en las capturas interiores o editor.
- `collision_map.json` — **98** AABB para el servidor y cliente (`solid`/`move`); no inferir colisiones desde GLB.
- `src/generate_casa_atlas_xl.py` — regenerador completo, independiente del repositorio de Sniper Duel; usa trimesh/Pillow/numpy/scipy/vtk.
- `src/qa_casa_xl.py`, `src/qa_results.json` — comprobaciones independientes después de exportar.
- `src/scene_objects.json` — relación de objetos y centros; `src/material_manifest.json` — escala UV y resoluciones por material.
- `assets/` — originales en color JPG, normals PNG y ORM JPG (reutilizados dentro del GLB).
- `preview/` — plano con colisiones, conexión A→B, cinco perspectivas a altura **1,62 m** y vista isométrica.
- `web/visor_casaxl.html` — visor de GLB y AABB en navegador, requiere servicio HTTP local e Internet para bibliotecas de Three.js r128; no sustituye pruebas del juego.

### Medidas y ejes

- Parcela física: X −20..20; Z −16..16. **+Y arriba**, **+Z calle frontal**, centro de parcela origen (0,0,0).
- Suelo lógico y colisiones: **y=0**; algunas mallas de suelo visual están enterradas hasta **−0,21 m**, sin afectar los pies.
- Bounding box real del GLB principal: X −19,925..19,925; Y −0,21..4,05; Z −15,925..15,925 m.
- Bounding box real del techo: X −14,72..17,40; Y 3,25..3,99; Z −9,155..9,12 m.
- Edificio principal: X −14,7..1,3 (16 m), Z −4,1..9,1 (13,2 m), pared de 3,45 m.
- Garaje: X 10,1..17,4 (7,3 m), Z −9,15..−1,2 (7,95 m), pared de 3,25 m.
- Muro perimetral: 3,70 m; portón cerrado de madera en **+Z**. No se puede salir del terreno.
- Azotea **NO** transitable; cubierta separada con collider sólido especificado.
- Interior conectado con puertas abiertas: 1,70–2,10 m; apertura del garaje 3,10 m.

### Spawns 1v1

- A: **(-17,25, 0, -12,30)**, despejado.
- B: **(17,25, 0, 12,40)**, despejado.
- Distancia directa: **42.43 m**.
- Distancia mínima a las cajas de colisión (A/B): 2.43 / 2.43 m (mínimo contractual: 0,80 m).
- **Sin visión directa** entre ellos a y=1,62 m en la comprobación local AABB.

### Zonas

| Zona | Rectángulo [xmin,zmin,xmax,zmax] m |
|---|---|
| CALLE FRONTAL | [-19.45, 10.15, 19.45, 15.55] |
| VILLA INTERIOR | [-14.7, -4.1, 1.3, 9.1] |
| PATIO Y ESTANQUE | [1.35, -1.2, 16.9, 10.0] |
| PERGOLA | [2.2, -8.8, 8.8, -3.1] |
| GARAJE | [10.1, -9.15, 17.4, -1.2] |
| JARDIN TRASERO | [-19.1, -15.45, 19.1, -9.55] |
| CALLEJON OESTE | [-19.5, -10.2, -14.85, 10.15] |
| CALLEJON ESTE | [17.55, -10.2, 19.5, 10.15] |

### Tres rutas verificadas entre A y B

Comprobadas con una cuadrícula de 0,33 m y margen de jugador de 0,355 m. Longitud: aproximación discretizada, incluyendo cambios de dirección.

| Ruta | Longitud aprox. | Puntos de control (X,Z) |
|---|---:|---|
| sur / calle | 62.4 m | (-17.2,-12.3) → (-17.4,9.9) → (-17.1,13.2) → (8.0,13.2) → (17.2,13.2) → (17.2,12.4) |
| jardin / callejon este | 63.7 m | (-17.2,-12.3) → (-10.0,-12.3) → (5.0,-12.3) → (18.4,-12.3) → (18.4,10.7) → (17.2,12.4) |
| casa interior / patio | 59.7 m | (-17.2,-12.3) → (-17.1,1.5) → (-13.3,1.5) → (-5.0,3.5) → (0.2,3.5) → (3.3,3.5) → (3.2,8.1) → (3.2,12.7) → (17.2,12.4) |

El conjunto transitable forma **1 componente conectada** en este grid; ninguna isla aislada a radio 0,35 m.

### Cinco líneas de visión largas

Raycast propio contra `solid` a altura de ojo (1,62 m), sin bloquear el vidrio (`move`). Se escogieron cinco segmentos largos no idénticos; **NO** son máximos matemáticos garantizados sobre todo el terreno.

| # | Desde [x,y,z] | Hasta [x,y,z] | Metros |
|---|---|---|---:|
| 1 | `17.86, 1.62, 5.69` | `-19.1, 1.62, -10.15` | 40.21 |
| 2 | `-10.85, 1.62, -12.46` | `18.85, 1.62, 14.27` | 39.96 |
| 3 | `17.86, 1.62, 3.71` | `-17.45, 1.62, -14.44` | 39.70 |
| 4 | `-17.78, 1.62, 11.96` | `18.52, 1.62, -3.55` | 39.47 |
| 5 | `17.53, 1.62, -14.44` | `-18.77, 1.62, -3.55` | 37.90 |

**Muestreo adicional:** 1249 pares de puntos con visión directa en 2700 muestras aleatorias. Media 14.50 m, máximo muestreado 40.29 m, 11.29% mayores de 25m. Este promedio no es exactamente comparable al método de Claude para la versión de 18 × 14 m; debe repetir sus métricas oficiales en el motor.

### Coste del asset

- Triángulos totales principal + techo: **3,300**.
- Materiales semánticos compartidos: **17** (el techo puede generar instancias de material/draw calls propias).
- Texturas integradas en glTF 2.0 en JPG/PNG; tamaño máximo de lado **512 px**, material vidrio/hierro/agua **256 px**. No se han incorporado recursos externos.
- Peso GLB principal: **8.87 MB**; techo: **1.83 MB**.
- Materiales PBR metallic-roughness; colores factor base blanco (`[1,1,1,1]`, salvo alpha vidrio), normals+Y/OpenGL, rugosidad en G/metal en B, `MASK` en vegetación, `BLEND` en vidrio.
- Las superficies son **originales procedimentales**, no escaneos reales de Poly Haven. Se pueden sustituir por escaneos CC0 una vez validada la jugabilidad.

### Ventanas, portones, coberturas

- Ventanas con alféizar a **1,08 m** (garaje 1,25): vidrio visual translúcido, caja `move` de **0..3 m** ocupando todo el hueco para impedir trepar; balas pasan por el vidrio, pero **no** por el alféizar sólido ni por el marco superior.
- Todas las puertas están abiertas; no hay paneles de puerta que obstruyan rutas. Pueden moverse bots/jugadores con radio 0,35 m.
- Cubierta y pérgola: vigas altas, no transitables ni jugables como segunda planta.
- El estanque/piscina es una **cubeta elevada** no nadable, con colisión sólida exactamente en el volumen visual y parte superior acuática decorativa.
- Muretes/maceteros, cajas y mobiliario importante: modelos y cajas a las mismas coordenadas y dimensiones. **88** objetos sólidos visuales con cajas equivalentes; las demás cajas son vidrios de movimiento y cubiertas aparte.
- Troncos de olivo son cobertura sólida; las copas y hierba son tarjetas alpha MASK cosméticas y **no** bloquean balas ni movimiento (no aparentan cobertura fiable).
- El resto de las 98 AABB conserva la distinción `solid` vs. `move`.

### Limitaciones y aceptación

**Estado: CANDIDATO EXPERIMENTAL, NO APROBADO NI INTEGRADO.**

Este paquete comprueba estructura, circulación y colisiones en un entorno local; **no** ejecuta `tools/validate-glb.js` del repositorio, ni el motor real de Sniper Duel, ni pruebas de FPS en iPhone/Samsung, ni pruebas online en Cloudflare. Los materiales originales son modestos: falta un art pass de estilo mediterráneo con escaneos CC0 reales si el propietario quiere un acabado fotorrealista. Las capturas de la carpeta `preview/` muestran la geometría renderizada con material simplificado de diagnóstico, no una comparación visual con el render PBR del juego. Los valores de líneas de visión son de simulador independiente y deben contrastarse con los oficiales de Claude.

Recomendación: integrar como **`?casa=2`**, comparar frente a la CASA ATLAS original, validar cajas y probar bots en local antes de solicitar autorización expresa para desplegar servidor multijugador.
