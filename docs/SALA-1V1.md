# SALA 1V1 — la sala de espera multijugador nueva (`?lobby=2`, 10-11-2026)

Pedido del propietario: una sala de espera MULTIJUGADOR 1V1 «al estilo de los lobbies de PUBG o COD, pero con diseño
original», con una imagen de referencia («no tiene que ser igual, pero sí parecido»). Reutiliza las salas privadas de
siempre: mismo servidor (Cloudflare Worker + Durable Objects), mismo protocolo, mismo código de invitación. No hay un
multijugador nuevo.

- **Cómo se activa:** `?lobby=2` (se recuerda en el dispositivo, `sniperduel_lobby2`). `?lobby=1` vuelve a la pantalla de
  salas de siempre (`#mp`), que no se ha borrado. Sin la bandera, todo sigue como antes.
- **Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR (dos navegadores reales, PC 1600 × 900 y móvil apaisado 932 × 430 con
  pantalla táctil, contra el servidor local) · PENDIENTE DE VALIDACIÓN EN IPHONE Y ANDROID · SIN PUBLICAR la página.
  La parte del servidor (`hello.hs` y `go`) ya está publicada, con su arreglo c6f49ae (ver «Fallo corregido»). La
  página es b97060c.

## Qué ve el jugador

1. **INICIO › MULTIJUGADOR 1V1** abre su propia pantalla (no hace falta pulsar JUGAR) con dos opciones: **CREAR SALA
   PRIVADA** y **UNIRSE CON CÓDIGO** (más el nombre). Detrás ya se ve el hangar con tu operador.
2. **Hangar táctico oscuro en 3D** (`client/lobby1v1.js`): suelo de hormigón casi negro, la puerta del hangar con
   lamas y ventanas altas de luz fría, columnas y cerchas, filas de focos en el techo, cajas, pantallas y la lona con el
   logo del juego. Dos plataformas hexagonales con un aro naranja: **tú a la izquierda, el rival a la derecha**.
   - Los operadores son los del juego (SOLDADO, S.W.A.T., FSB, MILITAR… el sistema `pj2`/`SKINS`), cada uno con su arma:
     tú con tu rifle tal como lo llevas (skin, mira y camuflaje, la misma copia que el MENÚ 2) o la FURIA 12 si la
     eliges; el rival con su HALCÓN R7 o su FURIA 12. Animación de reposo del juego y una respiración suave distinta
     para cada uno.
   - **El rival aparece en tiempo real** cuando entra: sube a su plataforma y el aro destella, sin recargar nada. Si
     sale, su plataforma vuelve a quedar vacía con un haz tenue de espera.
   - Sobre cada uno: nombre, corona y «ANFITRIÓN» si lo es, y su estado (**✓ LISTO**, NO LISTO o DESCONECTADO). El aro de
     la plataforma se enciende a tope cuando ese jugador está LISTO.
3. **INVITAR** (botón abajo; en el PC el panel sale abierto mientras esperas): código grande, **Copiar código**,
   **Copiar enlace** (`?sala=CÓDIGO&lobby=2`: el invitado entra directo a esta sala), **Compartir por WhatsApp**
   (`wa.me` con el texto) y **Compartir…** (el menú nativo del móvil, `navigator.share`, solo si el navegador lo tiene).
   Sin contactos ni amigos inventados. Solo 2 plazas.
4. **Mapas:** tarjetas con las capturas reales de `assets/menu/mapa_*.jpg`, solo de los mapas que esta página juega
   online (los de MENÚ 2 › MAPAS) **y** que el servidor tiene (`lobby.maps`). Elige el anfitrión; el invitado ve la
   misma tarjeta marcada al momento y no puede tocarlas. En el PC, a la derecha, la ficha del mapa elegido.
5. **Abajo:** SALIR, INVITAR, jugadores (1/2 · 2/2) con lo que falta, **LISTO** e **INICIAR PARTIDA** (naranja). El
   anfitrión inicia con 2/2 y los dos LISTOS; el invitado ve «INICIA EL ANFITRIÓN». Si el anfitrión cambia el mapa, los
   dos LISTO vuelven a NO y el invitado ve el aviso «EL ANFITRIÓN HA ELEGIDO …».
6. Arriba: VOLVER, MULTIJUGADOR 1V1, **SALA: código** (al tocarlo se copia) y el **ping** real (verde, amarillo > 150 ms,
   rojo sin conexión). No se inventa la región del servidor.
7. Tras la partida, si vuelves a la sala (por ejemplo, cerraste el juego y abriste el enlace otra vez) el botón LISTO pasa
   a ser **REVANCHA** (o NUEVO RIVAL si el otro se ha ido).

Diseño: negro grafito, paneles translúcidos, blanco cálido y naranja; sin desenfoque de fondo (en el móvil cuesta una
pasada de pantalla entera por fotograma). En el móvil apaisado se quita la ficha grande del mapa y todo se encoge.

## Servidor (autoritativo, `core/room.js`)

| Caso | Qué hace |
|---|---|
| El anfitrión tiene la página nueva (`hello.hs`) | Estar los dos LISTOS ya no basta: empieza cuando él manda `go` (2/2, los dos LISTOS y conectados). Si no se puede, `error cant_start` con el motivo |
| `go` repetido o fuera de la sala | Una sola partida; fuera de la sala, `cant_start phase` |
| El anfitrión tiene la página de siempre | Como siempre: empieza sola al estar los dos LISTOS (`lobby.hs = 0`) |
| Cambio de mapa con `hs` | Solo el anfitrión, solo mapas del servidor; los LISTO vuelven a NO. Con la página de siempre no cambia nada |
| Entrar y salir | Un tercero recibe `full`/`in_progress`. Si sale el invitado, el anfitrión queda solo con 1/2 |
| Desconexión y reconexión | En la sala, su plaza se guarda 60 s (sale DESCONECTADO y sin LISTO); vuelve con su ficha a la misma plaza. En la partida, pausa RECONECTANDO hasta 60 s, como siempre |
| El anfitrión se va | Pasa a ser anfitrión el que se queda (el que lleva más tiempo en la sala, no la plaza A: antes, si entraba otro en la A, pasaba por delante) |
| Salas duplicadas | Pulsar CREAR dos veces crea una sala; `go` dos veces, una partida |

Nada de esto toca la balística, las zonas de impacto, el daño ni las reglas de la partida.

### Fallo corregido (c6f49ae)

El asiento ya tenía `hs` (tiros a la cabeza) y la primera versión usó el mismo nombre para «el anfitrión inicia con
botón». Con la página de siempre, un anfitrión con algún tiro a la cabeza dejaba la sala esperando un INICIAR que su
página no tiene si su rival se iba y entraba otro. Ahora la bandera es `hostBtn` (el protocolo no cambia). Lo encontró
TypeScript (`tsc --noEmit`) en otra sesión. Publicado el 10-11-2026.

## Archivos

- `client/lobby1v1.js` — el hangar (`buildHangar`), el encuadre de los dos operadores (`fitCamera`), los estados en
  palabras (`view`) y las tarjetas de mapa (`mapCards`).
- `src/page.html` — HTML `#lb`, su CSS (bloque «SALA 1V1») y su lógica (bloque «SALA 1V1» después del MENÚ 2). Enganches
  pequeños en `mpShow`, `mpMsg`, `inviteLink`, `netConnect` (hello con `hs`), `renderLobby`, `netStart`, `netLeave`, el
  error `cant_start` y el dibujo del menú (el hangar sustituye a la sala del MENÚ 2 mientras está abierto y se libera al
  jugar).
- `core/protocol.js`, `core/room.js`, `client/netcore.js` — `hello.hs`, `go`, `lobby.hs`, `rematchOf`.
- Pruebas: `test/room.test.js` (36 comprobaciones de la sala nueva), `test/sala1v1.test.js` (sin navegador) y
  `test/sala1v1.browser.test.js` (dos navegadores reales; `SHOTS=<carpeta>` guarda capturas, `--gpu` usa la GPU).
- Capturas: `docs/sala1v1/`.

## Medidas

- Hangar: 125 mallas y ~1 400 triángulos, sin sombras, dos texturas del juego (hormigón y metal) y cuatro texturas
  pequeñas de lienzo (logo, pantallas, brillo, sombra). Los operadores son los mismos GLB del juego.
- El WebGL por software del entorno de pruebas sirve para contar y comparar, **no** para los FPS: falta medirlo en el
  iPhone y en el Android.

## Pendiente

- Que el propietario lo pruebe en iPhone, PC y Android y lo apruebe antes de que sea lo de por defecto.
- Publicar la página cuando él lo diga (el servidor ya está).
- Ajeno a esta sala: `test/menu2.browser.test.js` falla en 2 comprobaciones del operador (los personajes no llegan a
  ponerse con el WebGL por software) también en HEAD sin estos cambios; y la comprobación de tiempos de animación de
  `test/online.browser.test.js` falla a veces con el PC cargado.
- Si se queda: juntar las mallas fijas del hangar en menos llamadas de dibujo.
