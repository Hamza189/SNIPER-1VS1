# CASAS HABITABLES del PUEBLO (13/14-11-2026)

> **24-11-2026:** `?casas=0` (las cajas macizas de antes) se quitó: siempre las casas.

El propietario (13-11, con 7 capturas de PUEBLO 3.0) pidió que tres casas fueran «habitables»: entrar, salir, asomarse
por la ventana, cubrirse y disparar. El 14-11 pidió integrarlas y hacer más edificios así. Ahora son **8 casas** y
forman parte del mapa, en cliente y servidor.

**17-11-2026:** integradas en `main` solo con `?pueblo=4` (PUEBLO 4.0), con su propio mapa de servidor `pueblo4`; el
PUEBLO de siempre y su mapa `pueblo` no cambian. Detalle en `docs/PUEBLO-4.md` § Integración.

## 19-11-2026 — más variedad, menos ventanas y sin rayas por dentro
Del propietario: «se sienten muy monótonas, muy parecidas, y hay alguna que otra casa que tiene DEMASIADAS ventanas, revisa
todas las casas, también en el interior en las esquinas se veía la textura rayada, mejora materiales».
- **Rayas:** dentro se veía el estuco de la fachada, con relieve fuerte (un zigzag), y rendijas claras en las juntas
  entre trozos de muro. Ahora cada casa tiene su revestimiento interior, 4 mm delante del muro, con el material nuevo `yeso`
  (la misma textura de estuco, más grande y casi lisa; sin desgaste) y los trozos se solapan 2–3 mm: sin rendijas.
- **Ventanas** (`wins`/`up` y tamaño propio `win`): TERRACOTA 23 → 13, ARENISCA 24 → 13, PIEDRA 18 → 10, CASONA 17 → 14,
  BODEGA 9 → 5 (ventanas de almacén pequeñas y altas). ENCALADA y PIEDRA, ventanas pequeñas; CASONA, altas. El alféizar
  sigue entre 1,0 y 1,42 m: de pie te asomas, agachado te cubres (`test/casas.test.js`).
- **Cada casa por dentro** (`ins`): ENCALADA azulejo, barro y vigas; TERRACOTA zócalo y suelo de madera, azul pálido
  arriba; ARENISCA verde pálido, losas y vigas; PIEDRA mampostería vista, losas y vigas; COLMADO azulejo de tienda;
  TALLER ladrillo, hormigón y vigas de hierro; BODEGA adoquín, zócalo de piedra y vigas; CASONA zócalo de madera noble,
  suelo oscuro y rosa arriba. Los tabiques llevan el acabado de su planta.
- **Muebles nuevos** (siempre contra la pared, ≤ 0,3 m): chimenea con campana hasta el techo, reloj de péndulo y alacena
  de cocina con azulejos; cada casa su lista (`items`) y arriba un orden distinto por casa.
- Colisiones: solo cambian las ventanas → mapa `pueblo4` del servidor 559 → 449 cajas; los otros 7 mapas, iguales.
- Medido (MEDIO, pantalla de iPhone, WebGL por software): 239,7 llamadas y 375 mil triángulos en PUEBLO 4.0 (antes 239,9 y
  371 mil); las casas 29 llamadas (antes 21; los materiales pequeños de dentro van en una malla para todo el pueblo).
- Capturas antes/después con las mismas cámaras: `docs/capturas/casas/1911/` (fuera y dentro de cada casa).

Estado: **IMPLEMENTADO · PRUEBAS SIN NAVEGADOR Y EN NAVEGADOR EN VERDE · MAPA DEL SERVIDOR EXPORTADO · SIN PUBLICAR ·
PENDIENTE DE VALIDACIÓN EN IPHONE/PC/ANDROID**. Para comparar, `?casas=0` vuelve a las cajas macizas, pero solo sin
conexión: en línea siempre se usan las casas, porque son las del servidor.

## Las casas
| Casa | `BUILDINGS` | Plantas | Puertas | Dentro |
|---|---|---|---|---|
| ENCALADA (blanca, zócalo amarillo) | `[11,31]` | 1 | oeste (calle), este | tabique con paso, 2 cajas |
| TERRACOTA (naranja, balcones) | `[30,17]` | 2 | oeste, norte | escalera, 2 tabiques abajo y 1 arriba, 7 balcones |
| ARENISCA (junto al depósito) | `[-31,-31]` | 2 | este, sur | escalera, 2 tabiques abajo y 1 arriba, 1 balcón |
| PIEDRA (mampostería y ocre) | `[-31,37]` | 2 (forjado a 2,9 m) | norte, este | escalera, 2 tabiques abajo y 1 arriba, 2 cajas |
| COLMADO (tienda con escaparate y toldo) | `[-12,27]` | 1 alta | este (calle norte), oeste | mostrador de 1,05 m (agachado te cubre), caja |
| TALLER (portón) | `[3,43]` | 1 | portón de 2,8 m y puerta, al norte | banco de trabajo, caja, ventanas altas |
| BODEGA | `[33,-8]` | 1 alta | sur (calle transversal), oeste | tabique largo con paso, 2 cajas |
| CASONA (señorial, balcones) | `[31,-33]` | 2 (forjado a 3,5 m) | sur, oeste | escalera, 3 balcones, tabiques, 2 cajas |

Medidas, para el jugador de `core/config.js` (radio 0,35, escalón 0,45, salto ≈ 1,0, ojos a 1,62 de pie y a 1,0
agachado):
- Muros de yeso de 0,30 m: penetración «media», así que solo la BALA DURA los atraviesa. Forjados de hormigón de 0,20 m.
- Puertas de 1,30 × 2,35 m. Junto a cada una hay una hoja de madera abierta 90° que es sólida (para pies y balas, como la
  de verdad).
- Ventanas de 1,20 m con el alféizar a 1,10 m: de pie te asomas y disparas, agachado quedas cubierto. Por la ventana no se
  sale; solo por las puertas. El escaparate del COLMADO es de 2,40 m. Las ventanas altas del TALLER tienen el alféizar a
  1,30 m.
- Escaleras: una rampa de 1,1 m de ancho y una baranda en la mitad baja del hueco. Los peldaños paran las balas («solo
  balas», `s: 2`) y no estorban al subir.
- Balcones de 0,9 m de fondo con baranda de 1,05 m. La baranda es solo para el movimiento: las balas pasan.
- Tejado y pretil a la misma altura que la caja de antes, así que la silueta y la azotea no cambian.

## Cómo está hecho
- `client/casas.js` (`SDCasas`, sin dependencias: funciona en Node y en el navegador). Por cada casa genera:
  - las cajas: movimiento, balas y «solo balas»;
  - las rampas;
  - la navegación de la planta baja;
  - la geometría visible por material, con los mismos materiales y texturas de PUEBLO 3.0, así que no se carga ninguna
    textura nueva;
  - las piezas del kit de PUEBLO 3.0: contraventanas abiertas, balcones con forja, faroles, macetas, toldo, buganvilla y
    trepadora.
  - Las paredes por dentro van pintadas de claro con el color por cara, sin una «piel» pegada a la pared que pudiera
    hacer rayas. El zócalo sobresale 2,5 cm y hay rodapié dentro.
- `src/page.html`:
  - En el bucle de `BUILDINGS`, la caja maciza de esas casas se guarda aparte, invisible.
  - PUEBLO 2.0 y PUEBLO 3.0 no dibujan esas casas. PUEBLO 3.0 sigue usando sus huellas para el suelo, que ahora es un
    anillo alrededor y no una losa debajo.
  - El bloque «CASAS HABITABLES» mete las cajas en `W.colliders` y los proxies de bala en `W.ray`, con `userData.surf`;
    las rampas en `W.ramps`; y las mallas (unas 19 llamadas en total, por material y lado del pueblo).
  - Las sombras salen de una caja por casa, 0,45 m más pequeña, dibujada solo en el mapa de sombras. Las paredes no
    proyectan sobre su propio plano, así que no aparecen las rayas de sombra de las GPU reales. Dentro de las casas hay
    sombra.
  - Navegación: los puntos de dentro se añaden a `NAV`, y cada puerta se une a la cuadrícula.
  - La flora (dientes de león y hierba) y los hierbajos del suelo no salen dentro de las casas.
  - `casasSolid(on)` cambia entre las casas y las cajas de antes. Solo lo usan `?casas=0` y su prueba; `netStart` fuerza
    las casas.
- Servidor: `core/mapdata.js` regenerado con `node tools/export-map.js`. Incluye las cajas, los triángulos de bala (con los
  peldaños), las 4 rampas y la navegación de las casas. Los bots del servidor entran por las puertas (andan en 2D, no suben
  escaleras).

## Pruebas
- `node test/casas.test.js` (278 comprobaciones, con el movimiento real):
  - entrar y salir por cada puerta;
  - no colarse por las ventanas;
  - de pie se ven los ojos por la ventana y agachado quedas tras el muro;
  - las balas salen por el hueco y el muro las para;
  - subir las 4 escaleras y andar por la planta alta;
  - salir a cada balcón sin caerse, ni saltando;
  - tabiques, mostrador, banco y cajas paran balas;
  - hojas de puerta sólidas;
  - peldaños que paran balas sin estorbar;
  - las piezas del kit van pegadas a la fachada y no hay nada a la altura del cuerpo salvo las contraventanas;
  - la navegación interior llega a las puertas.
- `node test/casas.browser.test.js`: la página real, con `?casas=0` y por defecto. Comprueba las cajas, las 4 escaleras,
  el dibujo, la navegación, que se entra por las puertas con el mundo vivo, los rayos por la ventana y contra el muro, el
  cambio de ida y vuelta, y un duelo de 25 s con bots que entran en las casas sin quedarse en un muro.
- `test/browser.test.js` comprueba que el mapa del servidor coincide con el del juego.
- `test/cover.browser.test.js` busca coberturas falsas.
- `room`, `core`, `pistol`, `shotgun` y `pen` también pasan.

## Pendiente
1. Que el propietario las recorra en el iPhone y en el PC, y diga cuántos FPS tiene dentro y fuera (MEDIR RENDIMIENTO).
2. 1v1 en línea real entre dos dispositivos dentro de las casas, después de desplegar el servidor.
3. Ideas: subir a las azoteas con una escalera de mano, puertas que se abran y cierren, y muebles del kit.
