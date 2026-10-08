# Sniper Duel — Fase 1 estabilizada: pruebas y ajustes

## Qué está probado y qué no

**Pruebas automáticas (las ejecuta Claude en Node, sin navegador)**
- `test/core.test.js` — 69 comprobaciones del núcleo puro: movimiento, arma, balística y retroceso. Todas pasan.
- `test/smoke.test.js` — 25 comprobaciones del juego completo con Three.js y la página sustituidos por imitaciones. Recorre el menú, el duelo, el campo de tiro, la muerte y reaparición, la pausa y el panel F3 durante miles de fotogramas. Detecta errores de ejecución, fugas de proyectiles y eventos, y diferencias por FPS. Todas pasan, tres ejecuciones seguidas.

**Lo que NO cubren las pruebas automáticas** (solo se ve jugando en un navegador):
- Todo lo visual: el renderizado, las animaciones, el humo y que el rifle no atraviese la cámara.
- Los impactos reales contra las cajas de impacto de los bots. Los rayos de Three.js no corren en Node.
- El sonido.
- Las sensaciones.

## Pruebas manuales (hazlas tú jugando)

Pulsa **F3** para ver el panel técnico. En móvil está en Pausa → Panel técnico.

**Antes de nada: autotest de puntería.** Campo de tiro → Pausa → AUTOTEST DE PUNTERÍA. Usa el motor real del navegador y dispara balas simuladas, sin dañar a nadie. Comprueba que:
- el centro de la pantalla apunta exactamente adonde va la bala;
- un disparo perfecto a la cabeza, al torso y a las piernas de cada diana fija da en esa zona;
- un disparo 35 cm por encima de la cabeza falla.

Si sale alguna ✘, o un mensaje de ERROR, pásale la lista a Claude.

| # | Qué hacer | Resultado esperado |
|---|---|---|
| 1 | Campo de tiro. Apunta con la mira a la diana fija de 50 m (la de la izquierda), al centro de la cabeza, sin moverte. Aguanta el aire y dispara. | HEADSHOT, con el marcador dorado y su aro. En F3, «objetivo» muestra `DIANA-x head` antes de disparar. |
| 2 | Lo mismo con la diana fija de 20 m. | HEADSHOT. La bala impacta 1–2 cm por encima del centro. |
| 3 | Lo mismo con la diana fija de 100 m, apuntando al centro de la cabeza. | Impacta unos 12 cm bajo el centro: todavía cabeza, justo en el borde. Apuntando un pelo alto (primera marca) es seguro. |
| 4 | Diana móvil de 100 m: apunta justo a su cabeza mientras pasa. | Fallas por detrás. Adelantando algo más de un cuerpo (unos 0,6 m), aciertas. |
| 5 | Dispara 10 veces a la pared de enfrente con la mira, cada una con la retícula sobre un punto distinto. | Cada marca de impacto aparece exactamente bajo el centro de la retícula. Nunca desplazada por el retroceso. |
| 6 | Dispara con la mira y mira el visor justo después. | Ningún humo tapa la imagen. El retroceso sube la vista con fuerza y vuelve sola en unos 0,28 s, sin rebote. |
| 7 | Dispara desde la cadera y entra a la mira enseguida. | El humo se ve en el cañón y se desvanece al empezar a apuntar. Nunca dentro de la mira. |
| 8 | Mantén pulsado el disparo con la mira. | Cada disparo sale exactamente en el instante del «clac» de cierre del cerrojo. En el visor, «○ CERROJO» pasa a «● LISTO» en ese mismo momento. |
| 9 | Esprinta (Shift + W) y mira el rifle. | El rifle baja y gira hacia la izquierda, cruzado. No sube. |
| 10 | Esprinta y pulsa clic derecho. | El sprint se corta y la mira entra sin saltos. El disparo solo es posible 0,1 s después de dejar de esprintar; si pulsas antes, sale solo en ese momento. |
| 11 | Esprinta, pulsa C (slide) y, durante el slide, haz clic derecho y dispara. | Quickscope en slide: si la imagen de la mira ya está, la bala va donde apunta la retícula. |
| 12 | Esprinta, pulsa C y suéltala enseguida. | El slide se corta y te levantas conservando algo de inercia, sin frenazo brusco. |
| 13 | Esprinta, C y Espacio durante el slide. | Slide-jump: saltas sin perder la velocidad. En F3 la velocidad no pasa de 8,6. El slide dura unos 0,68 s. |
| 14 | Salta sobre una caja de 1,2 m. | Subes. Salto corto, nada flotante (unos 0,6 s en el aire). |
| 15 | Sube la rampa del pueblo hasta el tejado (al sur de la plaza) y la del campo de tiro. | Subes y bajas pegado a la rampa, sin botar. |
| 16 | Q / E junto a una pared. | Te asomas sin que la cámara atraviese la pared. |
| 17 | Apunta y aguanta Shift. | El balanceo casi desaparece durante 3,5 s. Al agotarse el aire, viñeta oscura y más balanceo durante 2,6 s. |
| 18 | Abre F3 y juega 5 minutos en el duelo. | «proyectiles» nunca supera 4. «partículas» está siempre dentro del límite. «eventos» se mantiene bajo. Los FPS se mantienen estables. |
| 19 | Limita los FPS (o juega en el móvil) y repite la prueba 1. | Mismo resultado. En F3, «sim» se queda en 120 Hz aunque los FPS bajen. |
| 20 | Duelo completo de principio a fin en cada dificultad. | Los bots disparan, el destello avisa, mueres y reapareces, y aparecen VICTORIA o DERROTA con las estadísticas. |
| 21 | Móvil: joystick al fondo, AGACH, MIRA, AIRE y FUEGO arrastrando. | Mismo comportamiento que en el ordenador. AGACH esprintando hace slide; púlsalo otra vez para levantarte. |
| 22 | Campo de tiro: Pausa → Reiniciar estadísticas y dispara 20 veces. | Disparos = 20. La precisión y «S ENTRE BAJAS» (segundos de media entre una baja y la siguiente) cuadran con lo que has hecho. |

| 23 | Mira el rifle a plena luz y a la sombra de un edificio. | Se distinguen el metal (con brillos), la madera sintética clara del guardamanos y la culata, el visor, el raíl y el cerrojo. No es una mancha negra. |
| 24 | Duelo: deja que un bot te apunte y míralo con la mira. | El destello es un punto brillante pequeño junto a su visor. Se le sigue viendo la cabeza. |
| 25 | Campo de tiro: dispara al suelo, a una caja, a un barril y a una pared a 20 m y a 80 m. | Cada superficie suena distinta (tierra sorda, madera seca, metal que tintinea, pared que cruje). A 80 m el sonido llega claramente después del impacto. |
| 26 | Acierta a una diana a 100 m. | Marcador inmediato, y el golpe seco del impacto llega unos 0,3 s después. |

Si algo no cumple lo esperado, apunta el número de la prueba y lo que muestra F3 en ese momento.

## Parámetros para afinar las sensaciones (`core/config.js`)

**Movimiento** (`move`)
- `groundAccel` / `groundDecel`: lo rápido que arrancas y frenas. Más alto es más «nervioso».
- `overspeedDecel`: lo que dura la inercia después de un sprint o un slide.
- `sprint`, `walk`, `crouch`: las velocidades.
- `jumpV`, `gravity`, `fallMul`: la altura del salto y lo «pesado» que se siente. Sube `fallMul` si lo notas flotante.
- `airAccel`: cuánto puedes corregir en el aire.
- `slideBoost`, `slideFriction`, `slideDrag`, `slideMaxTime`, `slideCooldown`: lo largo, rápido y frecuente que es el slide.
- `coyote`, `jumpBuffer`: el margen al saltar. Más alto es más permisivo.

**Rifle** (`rifles.halcon`)
- `adsTime` / `adsOutTime`: la velocidad de entrar y salir de la mira. Es la clave del quickscope.
- `scopeAt`: en qué punto de la transición aparece la mira y el disparo pasa a ser exacto. Más bajo hace el quickscope más fácil.
- `hipSpread`, `moveSpread`, `airSpread`: lo impreciso que es disparar desde la cadera.
- `bolt`, `reload`, `sprintOut`, `fireBuffer`: el ritmo de disparo.
- `speed`, `gravity`, `zero`: la balística. Con 600 m/s y la mira calibrada a 50 m, la bala cae 12 cm a 100 m y 24 cm a 130 m. Si el PvP resulta frustrante, sube `speed` o pon `zero` a 75 m.
- `sway`, `breathHold`, `exhaustTime`, `holdMul`: el balanceo y la respiración.
- `recoil.pitch`, `recoil.stiffness`, `recoil.damping`: la fuerza del golpe, la rapidez con que vuelve y si rebota. Es solo visual.
- `dmg`: el daño por zona.

**Sensaciones** (`feel`): el FOV, el aumento de FOV en sprint y slide, el balanceo al andar, la sacudida, el golpe al aterrizar y la cámara lenta del headshot (solo afecta a efectos).

## Arquitectura

- `core/config.js`: todos los números del juego.
- `core/movement.js`: la simulación del jugador. Es pura y determinista y no usa Three.js.
- `core/weapon.js`: el estado del arma, la regla de precisión, la balística y el retroceso. También puro.
- `src/page.html`: el cliente: render, cámara, modelo del arma, efectos, audio, bots, interfaz y entrada.
- `build.py`: une todo en `index.html`, la página que se abre en el navegador.

La simulación corre a 120 Hz fijos con interpolación visual.

Pensando en el multijugador:
- El cliente convierte la entrada en un «comando» por tick.
- El servidor autoritativo podrá ejecutar los mismos `movement.js` y `weapon.js` con esos comandos y validar los disparos con la misma balística.
