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

## iPhone: se cerraba al entrar en la sala (17/18-11-2026)

El propietario: con `?lobby=2` el iPhone «carga, se reinicia una vez y al entrar en la sala se cae» («el enlace ha
generado problemas repetidamente»); el enlace normal funciona y en el PC va bien. Es Safari cerrando la página por memoria:
en ALTO el menú ya usa casi todo lo que el iPhone deja (tiene cargados los operadores de los bots), y la sala sumaba
encima un hangar con 10 luces (todos los materiales, también los de los personajes, se recompilan para cada juego de
luces), polvo, halos y un segundo operador. Medido en el PC: no se descargaba ningún personaje nuevo al abrir la sala.

- **Hangar ligero en pantallas táctiles** (`buildHangar(T, { phone: true })`): 4 luces en vez de 10 (una principal sobre
  las dos plataformas, un contraluz, el relleno y el ambiente), la mitad de los focos del techo, sin halos ni polvo, sin
  las luces propias de las plataformas (el aro sigue marcando LISTO y la llegada del rival).
- **El operador del rival no entra en la lista de personajes hasta que hay rival:** vacío tomaba el personaje por
  defecto (en ALTO, el S.W.A.T. de 4K) si algún otro terminaba de cargarse mientras tanto.
- **Red de seguridad:** mientras la sala está abierta en un móvil queda una marca (`sniperduel_lbOpen`); si la página
  arranca y la encuentra (la última visita terminó dentro de la sala sin salir: Safari la cerró), ese aparato abre desde
  entonces la **sala LIGERA**: la misma pantalla y los mismos botones sobre la sala del MENÚ 2 (la que ese iPhone ya
  mueve), sin hangar. `?sala3d=0` la fuerza; `?sala3d=1` devuelve el hangar.
- Pruebas: `test/sala1v1.test.js` 28 (hangar del móvil más ligero) y `test/sala1v1.browser.test.js` 43 (además: un móvil
  que se cayó abre la sala ligera y en ella se crea sala; `?sala3d=1`; la marca se pone y se quita).
- Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE (el WebGL del PC no reproduce el
  límite de memoria de Safari).

## Móvil: responsive y resolución ×1 / ×2 (18-11-2026)

El propietario, con capturas de su iPhone en horizontal (Safari con sus barras): «mejora lo del lobby en móvil, que se vea
bien y responsive, la resolución que se pueda cambiar el x1 o x2». Con las barras de Safari la página tiene unos 932 × 320
(se había probado con 932 × 430): la fila de mapas tapaba el hangar y el panel JUGADORES, «NO LISTO» y «ESPERANDO RIVAL» se
montaban, el contador de FPS pisaba el texto de la barra y el operador salía pequeño y oscuro.

- **Pantallas bajas en horizontal** (hasta 460 px de alto): los mapas pasan a una columna a la izquierda que se desplaza;
  los operadores tienen el centro (el encuadre cuenta con la columna); JUGADORES a la derecha, más compacto; todo más
  pequeño (barras de 36 y 46 px). El rol (ANFITRIÓN/RIVAL) de las etiquetas se quita: ya está en JUGADORES.
- **Vertical** (que se vea decente): JUGADORES arriba a lo ancho, los operadores en medio, los mapas en fila abajo y la barra
  en dos filas; sin el título de arriba (no cabe junto a SALA, RES y el ping).
- **El contador de FPS** se aparta a la derecha, encima de la barra, mientras la sala está abierta.
- **Más luz en el hangar del móvil** (exposición 1,0; luz principal y contraluz más fuertes).
- **Resolución ×1 / ×2**: ajuste nuevo en AJUSTES › GRÁFICOS › Resolución (AUTO, ×1, ×2; se guarda) y botón **RES ×1/×2**
  arriba en la sala. ×1 dibuja la cuarta parte de píxeles que ×2: menos memoria (ayuda contra las caídas de Safari), menos
  calor y más FPS. AUTO = la de la calidad, como siempre; con ×1 o ×2 elegidos a mano la resolución adaptativa se apaga (dibuja lo que eliges). `client/quality.js` (`pixelRatio(..., res)`) y
  `client/settings.js` (`res`).
- Capturas antes y después con la GPU en `docs/sala1v1/movil/` (iPhone con las barras de Safari 932 × 320, iPhone 932 × 430,
  Android 800 × 360, iPhone en vertical 430 × 932 y PC): `node tools/capture-sala1v1.js docs/sala1v1/movil despues-`.
- Pruebas: `test/sala1v1.test.js` 33 (la resolución) y `test/sala1v1.browser.test.js` (a 932 × 320: mapas en columna, nada
  se monta, todos los botones se ven; RES cambia la resolución real y se guarda).
- Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE Y ANDROID.

## Pendiente

- Que el propietario lo pruebe en iPhone, PC y Android y lo apruebe antes de que sea lo de por defecto.
- Publicar la página cuando él lo diga (el servidor ya está).
- Ajeno a esta sala: `test/menu2.browser.test.js` falla en 2 comprobaciones del operador (los personajes no llegan a
  ponerse con el WebGL por software) también en HEAD sin estos cambios; y la comprobación de tiempos de animación de
  `test/online.browser.test.js` falla a veces con el PC cargado.
- Si se queda: juntar las mallas fijas del hangar en menos llamadas de dibujo.
