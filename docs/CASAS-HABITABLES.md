# CASAS HABITABLES del PUEBLO (`?casas=1`) — 14-11-2026

Petición del propietario (13-11, con 7 capturas de PUEBLO 3.0): que tres casas sean «habitables»: entrar, salir,
asomarse por la ventana, cubrirse y disparar. Entregado en la rama `casas-habitables` (no en `main`) para que Claude Code
lo revise e integre cuando el propietario esté en casa.

Estado: **IMPLEMENTADO · PRUEBAS SIN NAVEGADOR EN VERDE · CAPTURAS EN SOFTWARE · PENDIENTE DE VALIDACIÓN EN IPHONE/PC/ANDROID**.
No está publicado. El servidor no cambia.

## Las tres casas
| Casa | `BUILDINGS` | Plantas | Puertas | Qué tiene dentro |
|---|---|---|---|---|
| ENCALADA (blanca, zócalo amarillo, contraventanas verdes) | `[11,31,8,6,4,5]` | 1 | oeste (calle) y este | tabique con paso, 2 cajas, 6 ventanas |
| TERRACOTA (naranja de esquina, balcones) | `[30,17,14,10,7,1]` | 2 | oeste y norte | escalera junto al muro este, 2 tabiques abajo y 1 arriba, 7 balcones transitables, 2 cajas |
| ARENISCA (2.0, contraventanas verdes, puerta roja, junto al depósito) | `[-31,-31,14,12,7,0]` | 2 | este y sur | escalera junto al muro norte, 2 tabiques abajo y 1 arriba, 1 balcón, 2 cajas |

Medidas (pensadas para el jugador de `core/config.js`: radio 0,35, escalón 0,45, salto ≈ 1,0, ojos 1,62 de pie / 1,0
agachado):
- muros de 0,30 m (yeso → penetración «media»: solo BALA DURA los atraviesa), forjado de hormigón de 0,20 a 3,3–3,5 m;
- puertas de 1,30 × 2,35 m; ventanas de 1,20 m con alféizar a **1,10 m** y dintel a 2,30 m: de pie asomas la cabeza y
  disparas; agachado quedas cubierto; no se puede saltar por ellas (solo se entra por las puertas);
- escalera = rampa de 1,1 m de ancho (0 → 3,5 m en 5,2–6 m), con baranda en la mitad baja del hueco;
- balcones de 0,9 m de fondo con baranda de 1,05 m (solo movimiento: las balas pasan por encima y por debajo);
- tejado y pretil a la misma altura que la caja antigua (h y h + 0,35): desde fuera la silueta y el tejado no cambian.

## Cómo está hecho
- `client/casas.js` (`SDCasas`, puro, Node y navegador): genera para cada casa las **cajas** (movimiento y balas, mismo
  formato que `client/casa.js`), las **rampas**, los **puntos de navegación** de la planta baja y la **geometría visible**
  por material (cajas con UV en metros y color por vértice).
- `src/page.html`, solo con la bandera:
  - en el bucle de `BUILDINGS` la caja maciza de esas tres casas se guarda aparte (invisible, fuera del mundo);
  - PUEBLO 2.0 (`SDTown.build`) y PUEBLO 3.0 (`SDTown3.build`) no dibujan esas casas; del 3.0 se siguen usando sus huellas
    y frentes para el suelo;
  - bloque «CASAS HABITABLES» antes de la red de navegación: cajas → `W.colliders`, cajas sólidas → proxies invisibles en
    `W.ray` con `userData.surf` (impactos y penetración), rampas → `W.ramps`, y 11 mallas (una por material);
  - red de navegación: los puntos interiores de cada casa se añaden a `NAV` y cada puerta se une a la cuadrícula
    comprobando solo lo que estorba a un cuerpo que anda (los forjados y balcones encima de la puerta no cuentan);
  - **online**: el servidor sigue teniendo las cajas macizas, así que `netStart` llama a `casasSolid(true)` (vuelven las
    cajas y su aspecto antiguo, se ocultan las casas nuevas) y `netEndOnline` a `casasSolid(false)`. Cliente y servidor
    nunca discrepan.
- Sin la bandera el juego es idéntico (mismo `core/mapdata.js`; `tools/export-map.js` no se ve afectado).

## Pruebas
- `node test/casas.test.js` (106 comprobaciones, movimiento real): entrar y salir por cada puerta, no colarse por las
  ventanas, ojos de pie en el hueco y agachado tras el muro, balas por el hueco sí y por el muro no, subir cada escalera
  hasta 3,5 m, andar por la planta alta, salir a cada balcón y no caerse ni saltando, tabiques y cajas paran balas,
  navegación interior conectada con las dos puertas.
- `node test/casas.browser.test.js` (15/15, la página real): sin la bandera nada cambia; con ella 3 casas, 189 proxies de
  bala, 2 escaleras, 11 llamadas de dibujo y 15 420 triángulos, 252 puntos de navegación unidos por las 6 puertas, entrar
  por cada puerta y subir cada escalera con el mundo vivo, rayos por la ventana y contra el muro, ida y vuelta del modo
  online, y un duelo de 25 s con 3 bots que entran en las casas sin quedarse en ningún muro.
- `core`, `room`, `pen` en verde. `casa.test.js` tiene 1 fallo **que ya estaba en `main`** («el televisor de pie para la
  bala»), no relacionado.
- Capturas en `docs/capturas/casas/` (SwiftShader: sirven para el aspecto, no para FPS). Escena completa vista desde
  fuera de cada casa: 137–172 llamadas y 224 000–296 000 triángulos (perfil ALTO, todo PUEBLO 3.0 incluido).

## Lo que falta antes de pasarlo a `main`
1. Que el propietario lo vea en su iPhone y en el PC (`?pueblo=3&casas=1`) y lo apruebe visualmente.
2. Medir FPS en iPhone/Android dentro y fuera de las casas (≈ 11 llamadas de dibujo y ≈ 12 000 triángulos más).
3. Si se aprueba y se quiere online: exportar el mapa con las casas (`tools/export-map.js` con la bandera puesta) para que
   el servidor tenga las mismas cajas, pasar `room`, `core`, `browser` y desplegar el servidor (cambio de reglas del mapa
   competitivo → necesita su aprobación).
4. Ideas para después: subir a los tejados (escalera de mano), puertas que se abren y cierran, cristales rompibles,
   muebles con el kit 3D.
