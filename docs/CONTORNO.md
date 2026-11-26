# El contorno del PUEBLO — 26-11-2026

Petición del propietario: «mejora el diseño del mapa, un cuadrado perfecto no tiene gracia».

**Estado**: IMPLEMENTADO · PROBADO EN NAVEGADOR (SwiftShader: aspecto) y con el mapa del servidor en Node
(`test/contorno.test.js`) · PENDIENTE DE QUE EL PROPIETARIO LO VEA EN SU PC Y SU IPHONE. Es el mapa de verdad (va
online: `core/mapdata.js`, mapa `pueblo4`), no una opción.

## Qué cambia
Antes, un muro de 100 × 100 m. Ahora un polígono de 20 esquinas (`client/contorno.js`, lados rectos: las cajas de
movimiento son rectas), con entrantes y salientes como el recinto de un pueblo viejo:

| Zona | Dónde | Qué aporta |
|---|---|---|
| **Plazuela del mirador** | este, al final de la calle transversal (x 50…62, z −10…8) | la línea de tiro más larga del mapa: 112 m del muro oeste al fondo de la plazuela; losas, 3 pilas de cajas para cubrirse |
| **Callejón** | sur (x 17…23, hasta z = −60) | estrecho (6 m) y sin salida, fachadas a los dos lados; desde el fondo se ve el pueblo hasta el muro norte; una caja al fondo |
| **Patio** | oeste (x −56…−50, z −30…−18) | un rincón de tierra con 2 cajas apiladas |
| **Manzana noroeste** | entra en el pueblo (x −50…−41, z 44…50) | rompe la esquina recta |
| **Manzana sureste** | entra en el pueblo (x 43…50, z −50…−42) | rompe la esquina recta |

Al norte no hay salientes: detrás del muro norte está el campo de tiro (mismo mundo).

## De dónde sale cada cosa
- **Muros**: una caja de 1 m de grueso y 4 m de alto detrás de cada lado (movimiento y balas, como el muro de antes),
  1 m más larga en las esquinas salientes para no dejar hueco.
- **Fachadas del pueblo de fuera** (`client/town3.js` `backdrop`, `opt.sides`): una fila de casas por lado. En las
  esquinas: sin alero que asome y el hastial 6 cm hacia dentro (si no, quedaba en el mismo plano que la fachada del otro
  lado y «peleaban» por cada píxel); en las esquinas entrantes las dos casas de la esquina tienen la misma altura (sus
  tejados se cruzan en lugar de flotar uno sobre otro). Los árboles de fuera no caen dentro de una casa ni del pueblo.
- **Suelo** (`ground`, `opt.areas`): losas con banda de adoquín en la plazuela (el asfalto de la calle entra 4 m), adoquín
  con su reguera en el callejón, tierra con hierbas en el patio; en las dos manzanas que entran, nada.
- **Red de los bots**: la misma rejilla de 3 m de antes, ahora sobre todo el polígono y a ≥ 2,9 m del muro (llega a la
  plazuela, el callejón y el patio). El servidor la usa para las apariciones.
- **Cajas de madera**: las dos de las esquinas que ahora quedan dentro de las manzanas se movieron unos metros; 8 nuevas
  en lo nuevo.
- **Minimapa**: se dibuja solo con las cajas de colisión, así que ya sale con la forma nueva.

## Comprobaciones
`node test/contorno.test.js` (15): el muro cierra (medio metro por fuera de cada lado siempre hay muro, cada 25 cm), el
servidor tiene sus 20 cajas y no la de antes en x = 50, se llega andando (movimiento real, radio 0,35) a la plazuela, al
fondo del callejón y del patio, andando contra cada muro no se sale, todos los puntos de la red dentro y las cajas de
madera dentro. Además `test/town3.test.js`, `test/casas.test.js`, `test/room.test.js` y, con el servidor local,
`test/pueblo4.online.browser.test.js`.

## Luz horneada
La geometría del pueblo cambió (y la de las escaleras): se volvió a hornear todo (`tools/lightmap/`, ver
`docs/ILUMINACION-HORNEADA.md`); si no, esas mallas se quedarían sin horneado (la firma no coincide).

## Capturas (SwiftShader, `tools/capture-scenes.js`)
`docs/img/contorno/`: `plazuela.jpg` (la plazuela del mirador desde arriba), `callejon.jpg` (el callejón del sur),
`escalera.jpg` (escalera de 1,5 m con barandilla), `lejos-antes.jpg` / `lejos-despues.jpg` (la luz horneada de lejos) y
`juntas-antes.jpg` / `juntas-despues.jpg` (las líneas negras en las juntas de los muros de las casas).
