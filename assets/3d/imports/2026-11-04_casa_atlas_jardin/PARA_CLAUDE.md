# CASA ATLAS 2.0 con jardín

Entrega de modelo solicitada por Hamza el 04-11-2026. La integración del mapa queda a cargo de Claude.

## Modelo

`CASA_ATLAS_2_JARDIN.glb` incluye la casa y sus 19 imágenes embebidas.

- glTF 2.0 binario, eje Y vertical y unidades en metros.
- 34 mallas y 23 426 triángulos. 4 004 992 bytes.
- Límites X de −22,18 a +22,18 m y Z de −16,58 a +16,58 m.
- Suelo de juego en Y = 0. Las cimentaciones llegan a Y = −0,51 m.
- Cubierta más alta en Y = 3,8 m.
- Dos alas desplazadas 2,4 m en sentidos opuestos, cubiertas escalonadas y porches abiertos.
- Césped transitable, senderos y cinco coberturas de jardín. Muebles y macetas retirados de los accesos.

## Archivos de referencia

`colisiones.json` contiene las 365 cajas propuestas y las dos salidas simétricas, en las mismas coordenadas del GLB. Cada caja lleva `n`, `a`, `b`, `s` y `f`. El valor `s` indica si detiene balas. Las cajas de movimiento incluyen también cristal y límites del modelo original. Es una referencia para la integración autoritativa por parte de Claude.

`vista_jardin.jpg` y `vista_aerea.jpg` muestran el diseño. `GLB_reimportado.png` muestra el archivo GLB cargado otra vez con GLTFLoader. `medidas.json` y `verificacion.json` recogen las comprobaciones del archivo.

## Materiales

Geometría e interiores derivados de la CASA ATLAS original del propietario. Se reutilizan sus materiales. Los tres suelos escaneados proceden de Poly Haven con licencia CC0, según el inventario del proyecto.

- wood_floor, Dimitrios Savva.
- floor_tiles_06, Rob Tuytel.
- patio_tiles, Dario Barresi.

El césped es una textura procedural propia de 128 × 128 píxeles. El cristal usa el material PBR estándar exportado. El reflejo Fresnel personalizado del juego se configura al integrar el modelo, al igual que el entorno y las luces.

## Estado de la entrega

Estructura GLB, normales, dimensiones y texturas embebidas comprobadas. El mapa experimental del que se exportó pasó las pruebas locales de rutas, puertas, bots y disparos entre dos navegadores. La aprobación visual y las pruebas en iPhone corresponden al propietario.

## Contexto de la carpeta de trabajo

Hamza aclaró que esta tarea consiste en entregar el GLB para que Claude lo implemente. Codex retiró sus cambios locales de integración y sus ajustes de pruebas. Durante la sesión, otra sesión publicó el commit 9b977c6 de Google con un index.html que había incorporado el prototipo generado. Claude debe comprobar la coherencia del HTML generado y el mapa del servidor antes de integrar o publicar esta entrega. La copia local de index.html se ha regenerado a partir de las fuentes restauradas.
