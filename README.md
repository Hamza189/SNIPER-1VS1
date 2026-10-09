# SNIPER DUEL

Shooter PvP de francotiradores en el navegador, hecho con Three.js. Sin Unity ni Godot: se abre `index.html` y se juega.

**Estado:** alfa privada del **1v1 online** (sala privada con código o enlace, servidor autoritativo en Cloudflare) + modo offline completo (duelo contra bots y campo de tiro). Arma principal a elegir (rifle HALCÓN R7 o escopeta FURIA 12) + pistola VÍBORA 9 + navaja táctica. PC y móvil.

- Juego: https://hamza189.github.io/SNIPER-1VS1/
- Servidor online: la dirección está en [`server.json`](server.json). Cómo se juega online, las pruebas con dos móviles y cómo revertir: [`docs/ONLINE.md`](docs/ONLINE.md).

## Jugar

Abre `index.html` en el navegador (ordenador o móvil). Pulsa **F3** durante la partida para ver el panel técnico.

| Ordenador | Acción |
|---|---|
| W A S D | Moverse |
| Shift | Esprintar · con mira: aguantar la respiración |
| C | Agacharse · esprintando: slide |
| Espacio | Saltar |
| Q / E | Asomarse |
| Clic derecho | Mira (mantener) |
| Rueda | Zoom 4× / 8× |
| Clic izquierdo | Disparar |
| R | Recargar |
| 1 / 2 / 3 | Arma principal (rifle o escopeta) / pistola / navaja |
| F | Inspeccionar navaja |

En móvil (iPhone con Safari, Android con Chrome, en horizontal): joystick a la izquierda (al fondo = sprint), arrastra a la derecha para apuntar, y botones FUEGO, MIRA, AIRE, AGACH (slide), SALTO, R, ARMA e INSP. En Ajustes se cambian la sensibilidad (horizontal, vertical, con mira, dedo), se invierte el eje vertical y se pueden mover y redimensionar los botones. En iPhone, «Añadir a pantalla de inicio» lo abre a pantalla completa.

## Estructura

```
core/            Lógica pura y determinista (sin Three.js): la usan el navegador Y el servidor
  config.js      Todos los números que definen las sensaciones (movimiento, rifle, cámara)
  movement.js    Movimiento: aceleración, sprint, crouch, slide, salto, colisiones, rampas
  weapon.js      Estados del arma, precisión, balística con caída de bala, retroceso
  melee.js       Cambio de arma, navaja (alcance, paredes, espalda), animaciones
  player.js      El tick de un jugador (navaja → movimiento → rifle → pistola → escopeta), idéntico en cliente y servidor
  trainer.js     Cerebro de los bots de entrenamiento
  mapdata.js     Los mapas (PUEBLO y ARENA DE PRUEBAS) exportados del navegador para el servidor
  geom.js        Rayos/segmentos contra el mapa y el cuerpo (mismo resultado que Three.js)
  hitbox.js      Zonas de impacto cabeza/torso/piernas (servidor y modelo del rival)
  protocol.js    Protocolo de red v1 validado (docs/PROTOCOLO.md)
  room.js        La sala 1v1 autoritativa: lobby, comandos, balas, daño, marcador, revancha
client/          Lógica del cliente sin DOM (probada en Node)
  settings.js    Ajustes (sensibilidad, opciones táctiles, gráficos)
  layout.js      Disposición de los botones táctiles      touch.js   Joystick y varios dedos
  quality.js     Perfiles gráficos y resolución automática
  netcore.js     Multijugador: predicción, reconciliación, interpolación del rival, ping
server/
  worker.js      Servidor en Cloudflare (Worker + Durable Object por sala)
  node.js        El mismo servidor en Node (pruebas locales)
src/page.html    Cliente: render, cámara, arma, efectos, audio, bots, interfaz, controles, online
build.py         Une core/ + client/ + src/page.html en index.html
tools/           export-map.js (mapa del servidor), static-server.js
test/            Pruebas automáticas (Node y navegador real)
docs/            Pruebas manuales, ajustes, protocolo, online
```

La simulación corre a 120 Hz fijos con interpolación visual. Online, cada tick es un comando que el servidor ejecuta con el mismo `core/player.js`: la predicción del móvil coincide con el servidor y el servidor decide munición, cerrojo, balas, daño y marcador.

## Desarrollo

Requisitos: Python 3 y Node.js 18 o superior. Las pruebas de red y navegador usan `ws` y `playwright` (si faltan, esas pruebas se saltan).

```
python3 build.py        # genera index.html
npm test                # build + pruebas automáticas
```

- `test/core.test.js` (69) movimiento, arma, balística y retroceso · `test/phase2.test.js` (58) navaja y bots de entrenamiento · `test/pistol.test.js` (15) pistola: cadencia, cargador, recarga, dispersión y velocidad · `test/shotgun.test.js` (25) escopeta: bombeo, carga cartucho a cartucho, patrón de perdigones y daño por distancia.
- `test/mobile.test.js` (54) joystick, varios dedos, ajustes, botones y perfiles gráficos · `test/touch.smoke.test.js` (53) el juego completo como móvil.
- `test/smoke.test.js` (57) el juego completo con Three.js imitado.
- `test/room.test.js` (110) la sala 1v1 con dos clientes reales sobre red simulada: latencia 20–250 ms, jitter, picos de pérdida, duplicados, reconexión, compensación de latencia, estrés.
- `test/net.test.js` (13) servidor Node real + dos WebSocket · `test/browser.test.js` (38) Chromium real · `test/online.browser.test.js` (43) dos navegadores jugando una partida contra el servidor.
- En GitHub, tras cada publicación: `public.test.js` y `public.browser.test.js` contra la página y el servidor públicos.

Edita `core/` o `src/page.html`, nunca `index.html` directamente: se regenera con `build.py`.

Las pruebas que hay que hacer jugando están en [`docs/PRUEBAS-Y-AJUSTES.md`](docs/PRUEBAS-Y-AJUSTES.md).

## Hoja de ruta

1. Gunplay ✔ · 2A. Navaja y entrenamiento ✔ · 2B. Controles móviles ✔ · 2C. Calidad gráfica (básica ✔: perfiles y resolución automática) · **3. 1v1 online con sala privada (alfa, actual)** · 4. Salas 2v2 / 3v3 · después: ranked, cuentas, cosméticos
