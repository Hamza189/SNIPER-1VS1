# SNIPER DUEL — arquitectura técnica

Estado verificado contra el repositorio el 18-10-2026 (commit `cd4eb3b`). Las rutas existen; los números de líneas son
aproximados y cambian.

## 1. Mapa del repositorio

| Ruta | Qué es |
|---|---|
| `src/page.html` (~4 600 líneas) | El cliente entero: render, luz y sombras, mapas (`WORLDS`), cámara, arma en primera persona, efectos, audio, bots, HUD, menús, AJUSTES, controles, online. Tiene un marcador `/*@@CORE@@*/` donde `build.py` inyecta `core/` y `client/` |
| `build.py` | Une `core/*.js` + `client/*.js` + `src/page.html` → `index.html` (página publicada) y `build/artifact.html`; escribe `version.json` (`hash` de contenido + `rev` de git). Sustituye los CDN por `vendor/` |
| `index.html`, `version.json` | **Generados.** No se editan a mano; se commitean (GitHub Pages los sirve) |
| `core/` | Lógica pura, determinista, sin Three.js ni DOM, compartida por navegador y servidor |
| `client/` | Lógica de cliente sin DOM (probada en Node) y generadores de escena |
| `server/worker.js` | Servidor de producción: Cloudflare Worker + Durable Object `RoomDO` (una instancia por sala) |
| `server/node.js` | El mismo servidor en Node para pruebas locales (`startServer({port, debug})`) |
| `assets/` | `viewmodels.glb` (armas y brazos), `kit.glb` (kit modular del PUEBLO 3.0), `tex/` (texturas JPG/PNG), `3d/` (modelos, imports originales, fauna, flora, armas clásicas), `maps/casa_atlas/` |
| `vendor/` | `three.min.js` y `GLTFLoader.js` oficiales r128 (`test/vendor.test.js` lo comprueba) |
| `tools/` | Herramientas (export de mapas, capturas, validador GLB, Blender, texturas, fauna, flora, casa) |
| `test/` | 28 suites (Node y Chromium real) |
| `docs/` | Documentación técnica y de assets (ver `SNIPER_DUEL_HANDOFF.md`) |
| `.github/workflows/` | `deploy-server.yml`, `public-check.yml`, `server-check.yml` |
| `wrangler.toml`, `server.json`, `manifest.webmanifest` | Config de Cloudflare, URL pública del servidor, PWA |

### `core/`
| Archivo | Función |
|---|---|
| `config.js` | Todos los números de sensaciones: movimiento, armas, cámara, entrenamiento. `TICK: 120` |
| `movement.js` | Movimiento: aceleración, sprint, agacharse, slide, salto con coyote/buffer, colisión círculo-vs-cajas en XZ, escalón 0,45 m, rampas |
| `weapon.js` | Estados del arma, precisión, balística con gravedad, retroceso |
| `melee.js` | Cambio de arma, navaja (alcance, paredes, espalda), cargas |
| `player.js` | El tick de un jugador (navaja → movimiento → rifle → pistola → escopeta), idéntico en cliente y servidor |
| `trainer.js` | Cerebro de los bots de entrenamiento |
| `mapdata.js` | **Generado** por `tools/export-map.js`: por mapa `tris` (triángulos de bala), `ds` (doble cara), `colliders`, `ramps`, `nav`, `spawns` (solo casa) |
| `geom.js` | Rayos/segmentos contra el mapa (rejilla XZ, Möller–Trumbore igual que Three.js), cajas orientadas y esfera de cabeza |
| `hitbox.js` | Zonas cabeza/torso/piernas |
| `protocol.js` | Protocolo de red v1 validado (`docs/PROTOCOLO.md`) |
| `room.js` | Sala 1v1 autoritativa: lobby, elección de mapa, comandos, balas, daño, regeneración, marcador, revancha, reconexión, compensación de latencia |

### `client/` (orden de inclusión en `build.py`)
`settings.js` (ajustes, versión 3, `localStorage` `sniperduel_*`) · `layout.js` (botones táctiles) · `touch.js` (joystick y
multitáctil) · `hudicons.js` (**generado** por `tools/hud-icons/make.js`: iconos del HUD 2) · `hud2.js` (HUD 2 tras
`?hud=2`: barra de armas, inventario, diseño con migración, teclas de asomarse) · `quality.js` (perfiles BAJO/MEDIO/ALTO/AUTO y resolución adaptativa) · `netcore.js` (predicción,
reconciliación, interpolación del rival 110 ms, ping) · `vmrig.js` (materiales y poses de brazos/manos) · `town.js`
(PUEBLO 2.0) · `kit3d.js` (horneado del kit modular) · `town3.js` (PUEBLO 3.0) · `rats.js` (ratas) · `flora.js`
(vegetación) · `casa.js` (**generado**: cajas de CASA ATLAS).

## 2. Motor y render
- **Three.js r128** (scripts clásicos, `window.THREE`), WebGL 2 con caída a WebGL 1.
- Color: luz lineal, salida sRGB, tone mapping ACES (`renderer.outputEncoding = sRGBEncoding`). Todos los colores del
  código son hex sRGB y `csMat/csFix` los convierte una vez; los materiales glTF se marcan `userData.cs=1`.
- `LOOK`: dos iluminaciones — clásica (atardecer) y PUEBLO 3.0 (mediodía) — con sol direccional, hemisférica, cielo y niebla.
- Sombras: sol con mapa 2048 (ALTO) / 1024 (MEDIO) / sin sombras (BAJO), PCF. Caja de sombra ±62 m que sigue a la cámara
  **en texels enteros** (`sunFollow`, `&sombra=libre` la desactiva); `normalBias` = 0,6 texel; parche del shader del sol
  que funde la sombra con N·L rasante y de 40 a 58 m (`&sombrafade=0`). En CASA ATLAS la caja baja a ±16 m.
- Cámara: near 0,05, far 600; FOV 75 (PC) / 70 (táctil).
- Rendimiento: el pueblo se trocea para frustum culling; el kit se hornea en mallas estáticas por zona y material;
  sombras de edificios con cajas que solo pintan en el mapa de sombras; LOD por distancia/zoom en E10.

## 3. Simulación, armas y balística
- Simulación fija a 120 Hz con interpolación visual. Online cada tick es un comando que el servidor ejecuta con el mismo
  `core/player.js`.
- Movimiento (`config.move`): andar 4,6 m/s, sprint 7, agachado 2,4; salto ~1,0 m; slide ~0,68 s; radio 0,35 m; escalón
  0,45 m; altura 1,8 m (agachado 1,2); ojos 1,62.
- Armas (`config.js`):

| Arma | Cargador | Daño cabeza / torso / piernas | Bala | Notas |
|---|---|---|---|---|
| HALCÓN R7 (rifle de cerrojo) | 5 | 250 / 85 / 55 | 600 m/s, cero a 50 m | cerrojo 0,95 s, recarga 2,35 s, ADS 0,2 s |
| VÍBORA 9 (pistola) | 12 | 90 / 34 / 26 | 380 m/s, cero 20 m, alcance 150 m | caída de daño ×1 hasta 18 m, ×0,6 desde 55 m |
| FURIA 12 (escopeta) | 6 | por perdigón 24 / 15 / 11 (9 perdigones) | 330 m/s, 35 m máx. | caída ×1 hasta 10 m, ×0,3 desde 30 m; carga cartucho a cartucho |
| Navaja táctica | — | 50 de frente, 100 por la espalda | — | validada en servidor (alcance y paredes) |

- Arma principal elegible: rifle o escopeta (se aplica en la siguiente aparición). Pistola tecla 2, navaja 3.
- Reglas online (`core/room.js` `RULES`): 10 bajas para ganar, 100 de vida, reaparición 3 s, cuenta atrás 3 s,
  regeneración tras 5 s a 22/s, compensación de latencia acotada a 250 ms.

## 4. Bots y entrenamiento
- Bots de duelo (`class Bot` en `src/page.html`): navegan por `NAV` (puntos con vecinos, BFS `findPath`), estados
  watch/move/aim, destello de mira, reacción; soldado articulado (`makeSoldier`); zonas de impacto invisibles.
  Número: según dificultad; ARENA 2 (3 en ÉLITE); CASA ATLAS 1 (2 en ÉLITE).
- «Bots pueden matarte: NO/SÍ» en DUELO (`duelLethal`) y en CAMPO DE TIRO (`trainLethal`).
- Bots de entrenamiento (`core/trainer.js`) en el campo de tiro: fácil/normal/difícil, se mueven, esquivan y se cubren.
- Campo de tiro: dianas a 20, 50 y 100 m (vive en PUEBLO), diagnóstico de tiro (solo ahí).

## 5. Controles, HUD, menús y ajustes
- PC: WASD, Shift (sprint / aguantar aire con mira), C (agacharse / slide), Espacio, Q/E (asomarse), clic derecho
  (mira), rueda (zoom 4×/8×), clic izq. (disparo), R, 1/2/3, F (inspeccionar), F3 (panel técnico).
- Móvil (Touch Events, no Pointer Events, por el gesto de iOS): joystick izquierdo (al fondo = sprint), arrastre a la
  derecha para la cámara, botones FUEGO, MIRA (mantener y arrastrar, o PULSAR), AIRE, AGACH, SALTO, R, ARMA, INSP;
  editor de botones (posición, tamaño, opacidad); diagnóstico táctil (`?diag=touch`).
- HUD 2 (`?hud=2`, `docs/HUD-2.md`): botones con iconos (`assets/hud/`), barra de armas abajo (1/2/3, toque, rueda
  opcional), inventario (I / Tab / mochila), asomarse en móvil (botones, PULSAR o MANTENER) y teclas de asomarse
  configurables; editor con barra, visibilidad y opacidad por elemento (`hudLayout2`, migra desde `touchLayout`).
- AJUSTES por pestañas: CONTROLES, SENSIBILIDAD (sensibilidad con mira táctil por defecto 0,8), GRÁFICOS
  (AUTO/BAJO/MEDIO/ALTO, 30 FPS, mostrar FPS, Pueblo CLÁSICO/3.0, línea de diagnóstico con GPU, sombras, escala de
  píxeles y texturas), AUDIO (canales Web Audio), JUGABILIDAD, ACCESIBILIDAD.
- Perfiles (`client/quality.js`): BAJO (pixel ratio ≤1, sin sombras), MEDIO (≤1,35, sombra 1024), ALTO (≤2, sombra
  2048). AUTO = MEDIO en móvil, ALTO en PC, con resolución adaptativa (nunca por debajo de 0,75).
- Aviso de versión nueva («HAY UNA VERSIÓN NUEVA · ACTUALIZAR») comparando `BUILD_HASH` con `version.json`.

## 6. Modelos y texturas
- `GLTFLoader` r128. Armas y brazos: `assets/viewmodels.glb`, generado por Blender desde `tools/blender/*.py` (diseño
  propio). `?vm=0` fuerza los modelos simples.
- PUEBLO 3.0: `assets/kit.glb` (54 piezas, `tools/blender/kit.py`) horneado por `client/kit3d.js`; texturas en
  `assets/tex/` (procedurales de `tools/textures/`, escaneos CC0 de Poly Haven para adoquín/fachadas).
- E10 Casa Oliva (`assets/3d/models/sd_e10_casa_oliva.glb`), rata, flora y CASA ATLAS se cargan con `GLTFLoader` en
  segundo plano; si fallan, el juego sigue (lo jugable son las cajas).
- Contrato y validador de GLB: `docs/ASSETS-3D.md` §1–7 y `node tools/validate-glb.js <glb>`.

## 7. Multijugador
- Cliente: menú MULTIJUGADOR → CREAR SALA (código de 6 caracteres) → enlace `?sala=CÓDIGO` (WhatsApp) → lobby (nombres,
  mapa elegido por el creador, arma principal de cada uno) → LISTO ×2 → cuenta atrás → partida → VICTORIA / DERROTA /
  EMPATE → REVANCHA. Reconexión con token (pausa RECONECTANDO hasta 60 s).
- Servidor autoritativo (`core/room.js`): ejecuta los comandos con `core/player.js`, decide munición, cerrojo, recarga,
  balas (parábola real contra los triángulos de `core/mapdata.js`), daño, muertes, marcador y ganador. Mapas en el
  servidor: `pueblo`, `arena` (por defecto), `casa`.
- `server/worker.js`: Worker HTTP/WebSocket + Durable Object `RoomDO` (SQLite, plan gratuito) por sala; persistencia del
  lobby; límite de creación de salas `CREATE_LIMITER` (10 por minuto y dirección); `ALLOWED_ORIGINS` en `wrangler.toml`.
- URL pública del servidor en `server.json` (`https://sniper-duel.hamzaimtiaz2015.workers.dev`); `?server=URL` la
  cambia (pruebas).
- Protocolo: `docs/PROTOCOLO.md`. Funcionamiento y reversión: `docs/ONLINE.md`.

## 8. Banderas de URL (todas verificadas en el código)
| Bandera | Efecto |
|---|---|
| `?pueblo=3` / `?pueblo=0` | PUEBLO 3.0 sí / forzar no (también se guarda desde AJUSTES › GRÁFICOS) |
| `&suelo=0` / `&suelo=p0` | Suelo anterior / plaza P0 v2 |
| `&adoquin=0`, `&adoquinm=<m>` | Adoquín anterior / tamaño de repetición del adoquín CC0 (2,7 por defecto) |
| `&fachada=cc0` | Fachadas P1 con escaneos de Poly Haven (opción) |
| `&e10=0` | Sin Casa Oliva (edificio anterior) |
| `&ratas=0`, `&flora=0` | Sin ratas / sin vegetación |
| `&sombra=libre`, `&sombrafade=0`, `&sombras=0` | Sombra sin ajuste a texels / sin fundido / sin sombras (diagnóstico) |
| `?casa=1` / `?casa=0` | Muestra / oculta CASA ATLAS en los menús (se recuerda) |
| `&techo=1` | Techo opcional en CASA ATLAS |
| `?pj=2` | Personaje 3D (rev. 03, `client/soldier2.js`, `assets/personaje/`) en bots y rival online en vez de la figura de cajas; solo aspecto |
| (28-10) por defecto | Sin bandera = `?pj=pro` + `?hud=2`; personaje SOLDADO (el de `?pj=2`) elegible y el de por defecto. Volver a lo anterior: `?pj=0` (cajas) y `?hud=1` (HUD anterior) |
| `?hud=2` | (por defecto desde el 28-10) HUD 2: iconos, barra de armas, inventario, asomarse en móvil, teclas de asomarse y editor ampliado (`client/hud2.js`, `docs/HUD-2.md`); solo presentación y entrada |
| `?pj=mix` | Los 4 personajes a la vez contra bots (op2, op3, op4 y el de cajas; 4 bots; texturas 4K/2K/1K por calidad) para comparar y medir |
| `?pj=pro` / `?pj=mix` (27-10) | Además: «Tu personaje» en el menú y la sala (mensaje `skin` del servidor) y botón PERFIL |
| `?pj=pro` (28-10) | Además: PERFIL › Cuenta en la nube (passkeys, amigos, invitaciones; `server/accounts.js`, rutas `/cuenta/…` del Worker) y CAJAS (inventario en el servidor y cajas gratuitas: `core/items.js`, `client/camo.js`, mensaje `acct` de la sala; `docs/INVENTARIO-Y-CAJAS.md`) |
| `?pulido=1` (28-10) | Agua de las fuentes con ondas en movimiento y reflejo suave (para comparar con la de siempre) |
| `?perfil=1` | Botón PERFIL sin cambiar de personajes (perfil local: `client/profile.js`, `docs/CUENTAS-Y-MONETIZACION.md`) |
| `?pj=pro` | (por defecto desde el 28-10) Personajes realistas CC BY por calidad: ALTO op2 (rival) / op3 (bots) con 4K, MEDIO op4, BAJO soldado de cajas (`tools/personaje-ext`, `docs/PERSONAJES-PRO.md`) |
| `?pj=3` | Personaje LINCE (rev. 04, `assets/personaje/v4/`) en bots y rival online; solo aspecto |
| `?medir=1` | Ejecuta MEDIR RENDIMIENTO al cargar (`client/perfprobe.js`, `docs/RENDIMIENTO-IPHONE.md`); `?medir=rapido` para pruebas |
| `?town=0` | Pueblo original de cajas |
| `?vm=0` / `?vm=1` | Armas simples / forzar modelos 3D |
| `&nm=0` | Sin mapas de normales |
| `?perf=low` | Modo sin GPU para pruebas automáticas |
| `?diag=touch` | Diagnóstico táctil |
| `?sala=CÓDIGO` | Entrar en una sala |
| `?server=URL` | Otro servidor (pruebas) |

## 9. Pruebas y diagnóstico
Últimas ejecuciones completas (18-10-2026, todas en verde): vendor 8 · town 11 · town3 14 · glb.contract 8 · core 69 ·
phase2 64 · pistol 15 · shotgun 27 · mobile 74 · smoke 76 · touch.smoke 82 · room 110 · net 13 · browser 58 · cover 10 ·
e10 12 · p0 75 · shadow 7 · rats 11 · flora 9 · fauna 21 · aim 14 · casa 75 · casa.browser 18 · casa.online.browser 12 ·
online.browser 43. En GitHub tras cada publicación: `public.test.js` y `public.browser.test.js`.

Herramientas: `tools/capture-scenes.js` (cámaras fijas, `VIEW=`, `ONLY=`, `Q=`, `URLX=`), `tools/scene-metrics.js`,
`tools/casa/perf.js`, `tools/validate-glb.js`, `tools/aim-audit.js`, `tools/bot-motion-audit.js`, `tools/view-shot.js`,
`tools/film.js`, `tools/viewer.html`, `tools/kit-viewer.html`. En el juego: F3 (panel técnico), diagnóstico de tiro,
diagnóstico táctil, línea de diagnóstico en AJUSTES › GRÁFICOS.

Problema conocido del entorno de pruebas: en una máquina de 2 núcleos con WebGL por software, las pruebas de navegador
online fallan a veces por tiempos (la base también); en CI pasan.
