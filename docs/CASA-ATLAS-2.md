# CASA ATLAS 2.0: cuatro CASA ATLAS unidas en un complejo para el 1v1 (02-11-2026)

**Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR (contra bots) · PENDIENTE DE VALIDACIÓN EN IPHONE · SIN SERVIDOR TODAVÍA.
Se prueba con el enlace `https://hamza189.github.io/SNIPER-1VS1/?casa2=1` (el dispositivo lo recuerda; `?casa2=0` lo quita).
En el menú aparece como **CASA ATLAS 2.0 · EXP.**, solo en el duelo contra bots. El online llega cuando el propietario lo
apruebe.

El encargo (el propietario, 02-11): «amplía la CASA ATLAS original que ya me gusta, sin rehacerla: duplica sus módulos,
reutiliza sus materiales, conéctalos… un complejo residencial con rutas, flanqueos, obstáculos, habitaciones y líneas de
visión para francotiradores». Se retira la CASA ATLAS XL de ChatGPT cuando la 2.0 esté aprobada.

![resumen](img/casa2/resumen.jpg)

## Qué es
Cuatro copias de la CASA ATLAS original (el mismo `assets/maps/casa_atlas/casa_atlas.glb` y las mismas cajas de
`client/casa.js`), sin rehacer nada, en 2 × 2 alrededor de un patio:

```
       x −21,3 ……………………………………………………………… +21,3
z −16,4 ┌────┬──────────────┬─────┬──────────────┬────┐
        │ P  │ A (salida A) │  C  │ B (espejo)   │ P  │   A  tal cual             (noroeste)
        │ A  │   balcón     │  A  │   balcón     │ A  │   B  espejo en x          (noreste)
        │ S  ├──────────────┤  L  ├──────────────┤ S  │   C  espejo en z          (suroeste)
        │ I  │ PATIO: 5 m entre barandillas, 42 m de largo  │   D  girada 180°          (sureste, salida B)
        │ L  ├──────────────┤  L  ├──────────────┤ I  │
        │ L  │   balcón     │  E  │   balcón     │ L  │   Simétrico por el centro (A ↔ D, B ↔ C):
        │ O  │ C (espejo)   │  J  │ D (salida B) │ L  │   los dos jugadores tienen exactamente el
z +16,4 └────┴──────────────┴─────┴──────────────┴────┘   mismo mapa
```

- **Tamaño:** 43 × 33 m (el encargo decía unos 40 × 32).
- **Cada piso conserva** sus habitaciones, muebles, cristaleras, materiales PBR y luces. Los espejos y el giro hacen que las
  cuatro no se vean iguales al recorrerlas.
- **Tres aperturas por piso** (se quitan los triángulos y las cajas de colisión; no quedan paredes invisibles ni agujeros):
  - la ventana del **comedor** pasa a ser una puerta al **callejón** entre pisos (2,3 m de ancho). No se usó la de la
    cocina: entre su isla y la encimera solo quedan 0,85 m;
  - la ventana del **estudio** pasa a ser una puerta al **pasillo lateral**. El estudio de cada salida tiene así tres salidas:
    pasillo, salón y dormitorio;
  - dos **huecos en la barandilla** del balcón, delante de sus puertas, bajan al patio (1,64 m entre postes).
  - También se quitan las macetas que quedaban delante de las puertas nuevas. Las hojas de la del estudio se reutilizan
    como arbustos de las jardineras.
- **Piezas nuevas**, con los materiales del piso (estuco, piedra del balcón, remate blanco, metal de la barandilla, hojas):
  - los muros del límite;
  - el suelo del patio, del callejón y de los pasillos;
  - 4 muretes de 1,05 m (cubren agachado; de pie se dispara por encima);
  - 10 jardineras de piedra de 1,1 m con arbusto;
  - 4 contrafuertes en los pasillos.
  - Cada pieza sólida tiene su caja de balas y de movimiento, y la prueba comprueba que coinciden a ±3 cm.
- **Salidas:** el estudio del piso A y el del D, a 39,8 m, sin verse (paredes en medio) y con 0,6 m libres alrededor.

## Rutas y distancias
| Ruta | Por dónde | Longitud entre salidas |
|---|---|---|
| A · interior | estudio → salón → comedor → **callejón** → comedor → salón → estudio | 49 m |
| B · patio | salón → balcón → **patio** (coberturas) → balcón → salón | 63 m |
| C · flanco | estudio → **pasillo lateral** → piso de al lado → callejón → piso de la otra salida | 60 m |

- Cada ruta se comprueba sin pasar por las otras dos. Ninguna es mucho más corta (como mucho 1,3 veces).
- Todas siguen abiertas exigiendo 0,5 m de margen a cada lado del cuerpo: puertas de 1 m o más.
- **Líneas de tiro** (rayos a 1,6 m entre puntos al azar; el cristal y las barandillas no tapan, como en el juego):

  | | Media | Máxima | Más de 25 m |
  |---|---|---|---|
  | CASA ATLAS original | 6,1 m | 18,6 m | — |
  | CASA ATLAS 2.0 | 13,5 m | 42,3 m | ~10 % |

  Además hay un ~50 % de líneas de 10–25 m. Las largas son el patio de punta a punta (40 m), el callejón y los pasillos
  (32 m) y de una cristalera a la de enfrente.
- **Cobertura en el patio:** ningún punto a más de 6 m de un murete o una jardinera.

## Rendimiento (medido en el PC, `node tools/casa2/medir.js`)
Mismas 3 vistas por mapa, 1280 × 720. Con `GPU=1` es la GPU del PC: **no** vale como FPS del iPhone.

| | Descarga del mapa | Lista en | Llamadas | Triángulos (escena) | ms/fotograma PC (ALTO) | Texturas añadidas |
|---|---|---|---|---|---|---|
| CASA ATLAS | 1,8 MB | 0,7 s | 66 | 48 mil | 6,9 | — |
| **CASA ATLAS 2.0** | **1,8 MB (el mismo GLB)** | **0,5 s** | 70 | 86 mil | 6,3 | **0 MB (las mismas texturas)** |
| CASA ATLAS XL | 6,3 MB | 2,8 s | 74 | 87 mil | 10,0 | +19 MB |

- **Cómo se consigue:** los 32 trozos del GLB se juntan, cada uno con sus 4 copias, en una sola malla con el MISMO objeto de
  material. Las texturas, los materiales y los shaders son los de CASA ATLAS y están una vez en la GPU. Solo se añaden
  vértices (~42 mil triángulos del complejo, ~4 MB).
- En MEDIO y BAJO pasa lo mismo: 0 MB de texturas nuevas; la XL añade 19 MB.
- Los ms del PC varían mucho entre ejecuciones (había otra sesión trabajando a la vez); sirven para comparar, no como cifra.
- La red de los bots (11 000–12 000 puntos) tarda ~50–80 ms en construirse y solo se construye con `?casa2=1`.

## Pruebas
- `node test/casa2.test.js` (24, sin navegador):
  - cajas, simetría por el centro y tamaño;
  - salidas: distancia, que no se vean, espacio libre, mirada y 3 salidas;
  - un solo trozo de red y todas las habitaciones con puntos;
  - las tres rutas y las puertas de 1 m;
  - líneas de tiro y cobertura en el patio.
- `node test/casa2.browser.test.js` (19, en la página):
  - sin la bandera no existe; con ella sale en el menú del duelo y no en el online;
  - carga y empieza en la salida A con 2 bots;
  - los mismos materiales que CASA ATLAS;
  - lo que se ve coincide con las cajas, y las 8 puertas abiertas para la vista, las balas y el cuerpo;
  - muretes, jardineras y cristaleras con las balas;
  - bots 40 s: se mueven 75–86 m, nunca dentro de una caja.
- Herramientas:
  - `node tools/casa2/capturas.js CARPETA`: vista aérea, patio, callejón, pasillo, salidas y comparación con la original
    (imágenes en `docs/img/casa2/`);
  - `node tools/casa2/medir.js`: la tabla de arriba;
  - `tools/casa2/glb.js`: lector de GLB para auditar piezas.

## Lo que falta (necesita al propietario)
1. **Probarla en el iPhone** con `?casa2=1` (menú › DUELO › CASA ATLAS 2.0 · EXP.) y aprobarla o pedir cambios.
2. **Online:** quitar `local: true`, `node tools/export-map.js` y publicar despliega el servidor con el mapa nuevo. Antes:
   - sus ~11 000 puntos de red harían `core/mapdata.js` ~250 KB más grande: se mandaría uno de cada cuatro;
   - probar dos jugadores (aparición, colisiones, disparos, reaparición, revancha, reconexión).
   Es un cambio del servidor: espera su aprobación.
3. **Retirar CASA ATLAS XL** cuando apruebe la 2.0. Inventario:
   - `client/casaxl.js` y su línea en `build.py`;
   - el bloque «CASA ATLAS XL» de `src/page.html`: `XL`, `casaxlLoad`, `xlRetex`, `XL_TEXSET`, el botón `casaxl` del menú,
     `duelCasaXL`, `OFFMAP`, `setWorld`, `startMatch` y MEDIR RENDIMIENTO (que mide la XL como tercera escena: pasaría a
     medir la 2.0);
   - el mapa de `client/menu2.js` (de la sesión del menú nuevo);
   - `test/casaxl.browser.test.js` y su línea en `package.json`;
   - `assets/maps/casa_atlas_xl/` (17 MB);
   - `assets/3d/imports/2026-10-18_casa_atlas_xl/` (19 MB) y `2026-10-19_casa_atlas_xl_v2/` (151 MB). **Ojo:** Codex tiene
     cambios sin confirmar en esta última carpeta;
   - documentos que la mencionan (se dejan como historia).
   - El servidor **no** la tiene (era solo del cliente): retirarla no toca `core/` ni `server/`.
   - Punto de recuperación: el commit anterior a la retirada (se apunta aquí cuando se haga).
