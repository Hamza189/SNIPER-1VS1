# Protocolo multijugador v1

JSON sobre WebSocket. Lo validan `core/protocol.js` (en el cliente y en el servidor) y `core/room.js`.

## Direcciones

| Petición | Respuesta |
|---|---|
| `POST /create` (cabecera `Origin` permitida) | `{ "code": "ABC234" }` crea una sala privada |
| `GET /health` | `{ "ok": true, "v": 1 }` |
| `WS /room/<CODE>` | el protocolo de la sala |

- **Servidor público:** `https://sniper-duel.hamzaimtiaz2015.workers.dev`, en Cloudflare Worker + Durable Object. Está escrito en `server.json`, que el juego lee al arrancar.
- **Servidor para pruebas en local:** `node server/node.js`. Al juego se le indica con `?server=http://127.0.0.1:8787`.
- **Orígenes permitidos:** `https://hamza189.github.io`, `http://localhost` y `http://127.0.0.1`. Se configuran en `wrangler.toml` → `ALLOWED_ORIGINS`.

## Identidades

- **Código de sala:** 6 caracteres del alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sin 0/O ni 1/I/L). Lo genera el servidor con `crypto.getRandomValues`. Sirve para entrar en la sala, nunca como credencial.
- **Token de reconexión:** 24 caracteres aleatorios por jugador. Lo entrega `welcome` y el cliente lo guarda en `localStorage` (`sniperduel_tok_<CODE>`). Va separado del código: solo quien lo tiene recupera su plaza.
- **Plazas:** `A` es quien crea la sala y `B` quien entra. Un tercero recibe `error full` y se cierra su conexión (código 4003).
- **Partida:** `m` es el número de partida dentro de la sala y sube con cada revancha. Cualquier mensaje `in` con un `m` antiguo se ignora.
- **Eventos:** cada mensaje `ev` lleva `q`, un número creciente. El cliente nunca aplica dos veces el mismo `q`.
- **Disparos:** cada bala lleva un `id` único y solo puede impactar una vez.

## Cliente → servidor

| t | Campos | Cuándo | Validación |
|---|---|---|---|
| `hello` | `v:1, name, token?` | primer mensaje | versión exacta; nombre limpio de 16 caracteres como máximo; token `[A-Za-z0-9_-]{16,64}` |
| `ready` | `on` | en el lobby | solo en fase `lobby` |
| `in` | `m, s, c:[cmd…]` | cada 3 ticks (≈40/s) o al disparar | de 1 a 24 comandos; `s` es la secuencia del primero |
| `rematch` | – | tras el final | – |
| `ping` | `c` (reloj del cliente) | cada 1,5 s | – |
| `leave` | – | al salir | – |

Comando compacto: `[mx, mz, yaw, pitch, bits]`. Si es un disparo se añaden `fdx, fdy, fdz, fox, foy, foz`, que son la dirección real del disparo (con dispersión y oscilación) y su origen.

Los bits son estos:

| Bit | Acción |
|---|---|
| 1 | sprint |
| 2 | agachado |
| 4 | agacharse (pulsación) |
| 8 | salto |
| 16 | fuego |
| 32 | mira |
| 64 | recargar |
| 128 | inspeccionar |
| 256 | navaja |
| 512 | rifle |
| 1024 | aguantar el aire |

`mx` y `mz` van en [-1,1] redondeados a milésimas, y `yaw` y `pitch` a 1e-5. El cliente simula con el comando ya redondeado (`SDProto.quantize`), así que la predicción coincide con el servidor bit a bit.

## Servidor → cliente

| t | Contenido |
|---|---|
| `welcome` | `you`, `token`, `code`, `phase`, `match`, `players`, `rules` |
| `lobby` | `phase`, `players[{id,name,connected,ready,kills}]`, `winner`, `rematch` |
| `start` | `m`, `in` (ms de cuenta atrás), `you`, `spawn{x,z,yaw}`, `rules`, `names`; con `resume:true, lastSeq` si es una vuelta a una partida en curso |
| `snap` | 20/s: `m`, `k` (tick), `ph`, `ack` (último comando aplicado), `me` (estado completo de movimiento, arma y navaja), `hp`, `alive`, `op` (rival: posición, velocidad, `yaw`/`pitch`, ojo, modo, arma, ADS, estado, vida), `sc`, `now` |
| `ev` | `m`, `q`, `e:[…]` con `go`, `shot{id,by,o,d,corrected}`, `hit{by,to,part,dmg,hp,pt,dist,weapon}`, `kill{by,to,part,dist,weapon,sc}`, `respawn{id,x,z,yaw}`, `pause{who}`, `resume`, `rejected{what,why}`, `over{winner,why,sc,stats}` |
| `pong` | `c` (eco) y `s` (reloj del servidor) |
| `error` | `code`: `bad_msg`, `full`, `no_room`, `in_progress` o `idle` |

## Límites y comportamiento ante datos incorrectos

- Más de 4 KB por mensaje: se descarta.
- Más de 90 mensajes por segundo y conexión: se descartan los sobrantes. Con más de 270 se cierra la conexión (4008).
- Mensaje mal formado: `error bad_msg`. A partir de 20 seguidos se cierra la conexión (4002).
- **Presupuesto de comandos:** un comando equivale a 1/120 s. Se aceptan como mucho los que permite el tiempo real más 1 s de margen, así que un cliente acelerado no gana velocidad. Los sobrantes se descartan y el cliente se corrige con la siguiente instantánea.
- Comandos con una secuencia ya aplicada (duplicados o antiguos): se ignoran.
- **Disparo:** la dirección no puede desviarse más de 0,3 rad de la mira. El origen no puede estar a más de 0,9 m del ojo que calcula el servidor, ni con una pared en medio. Si algo falla se rechaza (`rejected`) y se usa la mira del servidor. El rifle (munición, cerrojo y recarga) lo simula el servidor con los mismos comandos: no puede disparar durante el cerrojo, al recargar, muerto o con la partida terminada.
- **Navaja:** el cliente no envía el daño. El servidor calcula alcance, cono, espalda y paredes.
- **Conexión muda 6 s:** se da por desconectada y la partida se pausa para el rival.
- **Sala sin jugar 15 min:** se cierra (`error idle`, 4005).

## Códigos de cierre

| Código | Motivo | Qué hace el cliente |
|---|---|---|
| 4000 | `leave` (voluntario) | no reconecta |
| 4001 | la plaza se ha abierto en otra pestaña o dispositivo | no reconecta |
| 4002 | demasiados mensajes inválidos | reconecta |
| 4003 | sala llena | no reconecta |
| 4004 | la sala no existe | no reconecta |
| 4005 | sala inactiva | no reconecta |
| 4006 | conexión muda | reconecta |
| 4008 | inundación | reconecta |
| 4100 | lo cierra el propio cliente al pasar a segundo plano | reconecta al volver |

## Reglas del duelo (v1)

- Dos jugadores, sin bots. Gana el primero en llegar a 10 bajas.
- 100 de vida. Se regenera como en el modo offline: tras 5 s sin daño, +22 por segundo.
- Daño del Halcón R7: cabeza 250, torso 85, piernas 55.
- Navaja: 50 de frente y 100 por la espalda.
- Se reaparece a los 3 s, lejos del rival (más de 18 m) y, si es posible, fuera de su vista. Se vuelve con 100 de vida y el cargador lleno.
- Al empezar, A sale al oeste y B al este, sin línea de visión.
- Las balas que ya están en vuelo cuando muere quien disparó siguen volando y pueden impactar.
- Si dos jugadores se matan en el mismo tick, cuentan las dos bajas. Si con eso los dos llegan a 10, es empate.
- Si alguien se desconecta, la partida se pausa para los dos hasta 60 s. Si no vuelve, gana el que se quedó.
- Si alguien sale a mitad de partida, gana el otro por abandono.
- Revancha: necesita que la acepten los dos. Reinicia balas, vida, munición, posiciones, marcador y armas, y sube `m`.

## Frecuencias

| Qué | Frecuencia |
|---|---|
| Simulación del jugador (cliente y servidor, por comando) | 120 Hz |
| Bucle del servidor (balas en pasos de 1/120 s, temporizadores) | 60 Hz |
| Instantáneas | 20 Hz |
| Comandos | ≈40 mensajes/s con 3 comandos cada uno |
| Dibujo del rival | con 110 ms de retraso, interpolado entre instantáneas |
