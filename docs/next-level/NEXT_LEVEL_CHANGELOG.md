# NEXT LEVEL — registro de cambios

Cada entrada sigue el formato pedido: antes (problema, reproducción, evidencia, causa, solución, riesgos) y después
(archivos, resultado, pruebas, antes/después, rendimiento, limitaciones, cómo revertir).
Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE.

---

## N3-1 · Online: los eventos de la partida se perdían tras reiniciarse el servidor de la sala

**Antes**
- **Problema:** si el Durable Object de la sala se reinicia en mitad de una sesión (cosa que provoca cada despliegue del
  servidor), los dos jugadores reconectan con su token, pero el cliente descarta los eventos de la partida siguiente:
  el «go», y después impactos, bajas, reapariciones y el final, hasta que el contador del servidor supera al anterior.
- **Reproducción:** `test/room.test.js` › «REINICIO DEL SERVIDOR DE LA SALA» (nuevo `S.restartRoom()` en
  `test/simnet.js`, que hace lo mismo que el Durable Object: sala nueva + `restore()` desde el almacenamiento).
- **Evidencia:** sin el arreglo, `FAIL … (go antes 1, después 1)`: el «go» de la partida nueva no llega.
- **Causa (confirmada):** `R.evSeq` no se guarda en el almacenamiento (`core/room.js` `save()`), así que vuelve a 1; el
  cliente conserva `lastEvQ` (`client/netcore.js`) porque reutiliza su estado al reconectar a la misma sala
  (`src/page.html` `netConnect`).
- **Solución:** el cliente pone `lastEvQ = 0` al recibir `welcome` (cada socket nuevo empieza su propia numeración).
  Además, la página ignora los mensajes de un socket que ya ha sido sustituido, para que un mensaje tardío del socket
  viejo no pueda colarse con la numeración reiniciada.
- **Riesgos:** ninguno en el servidor (no se toca `core/` ni `server/`; no hace falta desplegar el servidor). Los
  eventos repetidos en un mismo socket siguen filtrándose.

**Después**
- **Archivos:** `client/netcore.js`, `src/page.html` (`ws.onmessage`), `test/simnet.js`, `test/room.test.js`.
- **Pruebas:** `room.test` 113/113 (antes 110 + 3 nuevas); `net.test` 13/13 en 3 ejecuciones seguidas.
- **Antes/después:** «go» tras el reinicio: 0 → 1 en los dos clientes.
- **Rendimiento:** sin efecto.
- **Limitaciones:** el arreglo de fondo en el servidor (guardar `evSeq` o una época) queda como opción; con el arreglo
  del cliente no es necesario. Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR (simulado) · PENDIENTE DE PROBAR ONLINE
  después de publicar.
- **Revertir:** `git revert` del commit; solo cliente.

---

## N3-2 · CASA ATLAS: bots que aparecían encerrados y bots que avanzaban a tirones

**Antes**
- **Problema 1:** la red de puntos por la que andan los bots en CASA ATLAS está partida en 3 trozos (1 861, 13 y 1
  puntos). Si un bot aparece en el trozo de 13 puntos (entre la isla de la cocina y el horno), no encuentra ninguna ruta
  y se pasa toda la vida quieto.
- **Problema 2:** al llegar a cada punto de su ruta, el bot se quedaba un tick sin moverse. En la rejilla de 0,25 m de
  CASA eso son muchos ticks: anda a tirones y más despacio de lo previsto.
- **Reproducción:** `test/casa.browser.test.js` › «BOTS EN CASA: RED DE NAVEGACIÓN» (300 apariciones y 30 s de
  marcha con la página real).
- **Evidencia (MEDIDO, Chromium por software):** **27 de 300** apariciones en un trozo aislado; **174 de 1 845** ticks
  de marcha parado (9,4 %).
- **Causa (confirmada):** la red se construye con 0,4 m de margen a los muebles y el hueco junto al horno es más
  estrecho; `spawn()` y `pickDest()` elegían cualquier punto. El seguidor de rutas hacía `break` tras avanzar de punto.
- **Solución:** `navMarkMain()` marca como `off` los puntos que no pertenecen al trozo principal y los bots ni aparecen
  ni van a ellos; el seguidor pasa al punto siguiente en el mismo tick. **La lista de puntos no cambia**, porque
  `tools/export-map.js` la manda al servidor como candidatos de reaparición (un jugador sí sale de ese hueco).
- **Riesgos:** los bots de los tres mapas andan ahora a la velocidad prevista también al pasar por los puntos (en
  PUEBLO y ARENA los puntos están más separados y el efecto es pequeño). No cambia el daño, la puntería ni la vista.

**Después**
- **Archivos:** `src/page.html` (`navMarkMain`, `Bot.spawn`, `Bot.pickDest`, estado `move`), `test/casa.browser.test.js`.
- **Pruebas:** `casa.browser` 20/20 (18 + 2 nuevas); `core/mapdata.js` regenerado idéntico; `npm test` completo (ver
  abajo).
- **Antes/después:** apariciones encerradas 27/300 → **0/300**; ticks parados 9,4 % → **0,19 %** (3/1 600).
- **Rendimiento:** `navMarkMain` recorre la red una vez por mapa (la primera aparición); despreciable.
- **Limitaciones:** solo en navegador por software; pendiente de verlo jugando en CASA en el PC y el iPhone.
- **Revertir:** `git revert` del commit; solo cliente.

---

## N5-1 · CASA ATLAS XL (40 × 32 m) integrado como mapa experimental, solo contra bots; todos los mapas en el menú

**Antes**
- **Problema:** CASA ATLAS (18 × 14 m) es un mapa de corta distancia para un juego de francotiradores: visión media
  6,1 m, máxima 18,6 m, 1 % de líneas > 15 m (MEDIDO, `NEXT_LEVEL_PLAYTEST.md`). Además, los mapas experimentales solo
  salían con banderas en la URL; el propietario pidió elegir todos los mapas desde el menú.
- **Solución:** entrega de ChatGPT (encargo `docs/PROMPT-CHATGPT-CASA-ATLAS-XL.md`): villa, garaje, patio con estanque,
  pérgola, jardín, calle y callejones. Integrado como mapa `casaxl`, **solo en el cliente** (duelo contra bots): el
  mundo lleva `local: true` y `tools/export-map.js` lo salta, así que `core/mapdata.js` y el servidor público no cambian.
- **Riesgos:** ninguno para el online (XL no se ofrece en las salas). Visual: acabado sencillo (texturas procedurales);
  lo dice la propia entrega.

**Después**
- **Archivos:** `assets/3d/imports/2026-10-18_casa_atlas_xl/` (original intacto), `assets/maps/casa_atlas_xl/`,
  `tools/casa/make_casaxl_js.py` → `client/casaxl.js`, `build.py`, `src/page.html` (bloque XL, menú, `setWorld`,
  partida, salida A), `tools/export-map.js` (salta mundos `local`), `test/casaxl.browser.test.js` (nueva, en `npm test`),
  `test/casa.browser.test.js` (CASA ahora visible por defecto).
- **Validación:** `validate-glb` ✔ en los dos GLB (avisos: sin LOD, punto más bajo −0,21 m del suelo exterior, techo a
  3,25 m porque va aparte). Comprobación propia de las colisiones: 98 cajas, salidas a 42,4 m sin verse, holgura 2,4 m,
  una sola red caminable.
- **Antes/después (MEDIDO, rayos contra las cajas reales):** visión media 6,1 → **14,9 m**; máxima 18,6 → **37,6–41,4 m**;
  líneas > 25 m: 0 → **13–14 %**.
- **Rendimiento (MEDIDO en la GTX 1050 Ti, ventana pequeña):** 23 llamadas de dibujo y ~35 000 triángulos en el patio
  (menos que ARENA). Texturas del GLB: ~55 MB en GPU (16 mapas de normales PNG de 512²): **pendiente** pasarlas a
  JPEG/menor resolución en MEDIO, como se hizo con CASA ATLAS. Sin medir en iPhone.
- **Menú:** la sección «Mapa» del duelo ofrece siempre ARENA, PUEBLO, CASA ATLAS y CASA ATLAS XL (`?casa=0` oculta los
  experimentales). El menú online ofrece ARENA, PUEBLO y CASA ATLAS (XL no, hasta desplegar el servidor).
- **Pendiente:** 1v1 online en XL (requiere desplegar el servidor con aprobación), texturas CC0 reales, iluminación
  interior con techo, prueba en iPhone/Samsung.
- **Revertir:** `git revert` del commit; solo cliente.

---

## N6-1 · Sin tirón al empezar la primera partida (precompilación de shaders y subida de texturas)

**Antes**
- **Problema:** el primer fotograma de la primera partida tardaba mucho: los materiales de las armas en primera persona
  (otra escena, `wScene`) y de los bots (se construyen al pulsar JUGAR) se compilaban y sus texturas se subían a la GPU
  en ese momento. Se nota como un parón justo al aparecer.
- **Evidencia (MEDIDO, Chromium por software 1170×540, PUEBLO 3.0; los ms solo sirven para comparar):** se creaban
  **6 programas de shader** y ~15 texturas en el primer fotograma; 1.er fotograma 1 619 ms (MEDIO) / 3 329 ms (ALTO)
  frente a 27–45 ms los siguientes.
- **Solución:** `precompileAll()` en el menú: construye ya el primer bot (oculto), compila `scene` y `wScene` y sube todas
  sus texturas (`renderer.initTexture`); se repite al terminar de cargar armas, vegetación y ratas.

**Después**
- **Archivos:** `src/page.html`.
- **Antes/después:** programas nuevos en el 1.er fotograma 6 → **0**; texturas subidas ~15 → 8–10 (quedan las de los
  muñecos del campo de tiro); 1.er fotograma 1 619 → **274 ms** (MEDIO) y 3 329 → **149 ms** (ALTO).
- **Pruebas:** `smoke` 76/76, `browser` 58/58, `p0.browser` 75/75.
- **Observado:** `browser.test` › «AUDIO: el volumen de disparos…» falló una vez y pasó al repetir (lee el volumen 30 ms
  después de cambiarlo): **prueba intermitente anotada**, pendiente de arreglar.
- **Rendimiento:** el trabajo se hace en el menú (carga), no en partida. Sin medir en iPhone.
- **Revertir:** `git revert`; solo cliente.

---

## N6-2 · Texturas del pueblo y de la ARENA subidas una sola vez (−13,3 MB de GPU)
- **Antes:** cada tipo de material pedía su copia de la textura para darle su repetición: hormigón ×4, madera ×3, piedra ×2
  (14,6 MB duplicados en PUEBLO 3.0, MEDIDO). **Causa:** `texLoad(…, own=true)` en `townMaterial` y en el suelo de la ARENA.
- **Solución:** textura compartida (caché) y la repetición se aplica a las UV de la malla (`townUV`), como ya hacía el kit.
- **Después (MEDIDO, Chromium por software):** PUEBLO 3.0 MEDIO 105 → **92 MB**, ALTO 153 → **139 MB**, pueblo clásico
  33 → **27 MB**. Queda 1 copia del hormigón de las rampas (1,3 MB). Capturas antes/después con la misma cámara: paredes,
  suelo y cajas idénticos; diferencias solo en el cielo del horizonte (0,1–1 % de píxeles).
- **Pruebas:** town, town3, browser, cover.browser, e10.browser. **Revertir:** `git revert ca28d6e`.

## N3-3 · Audio: volumen aplicado con el audio en pausa; prueba intermitente arreglada
- **Antes:** `browser.test` › volumen de disparos fallaba 2 de cada 3 veces. **Causa (confirmada):** la rampa de 20 ms
  (`setTargetAtTime`) solo avanza con el reloj de audio en marcha; la prueba leía a los 200 ms.
- **Solución:** con el audio en pausa, el nivel se pone al momento; la prueba espera a que llegue (hasta 2 s).
- **Después:** 4 de 4 ejecuciones en verde. **Revertir:** `git revert d37a0c9`.

## N6-3 · HUD táctil y brújula sin escrituras inútiles en el DOM
- **Antes:** en táctil se reescribían cada fotograma los textos de FUEGO / FUEGO 2 / zoom y la brújula, aunque no
  cambiaran (cada escritura recalcula estilos; en iPhone suma). **MEDIDO:** 4,2 cambios del DOM por fotograma.
- **Solución:** `setText` / `setHidden` y la brújula guarda su último HTML.
- **Después:** **0,1** cambios por fotograma (250 → 8 en 60 fotogramas, MutationObserver, emulación táctil 844×390).
- **Pruebas:** mobile 74/74, touch.smoke 82/82. **Pendiente:** medir el efecto en el iPhone real (Safari Timeline).
  **Revertir:** `git revert b1601b0`.

## N6-4 · Soldados (bots y rival online): solo la pieza principal de cada arma proyecta sombra
- **Antes (MEDIDO, ARENA, MEDIO, Chromium por software):** 2 bots a la vista = **38 llamadas de dibujo** por fotograma;
  90 piezas con sombra (cada arma en tercera persona, 11 piezas pequeñas con su propia sombra).
- **Solución:** en `soldierUseModels`, de cada arma solo proyecta sombra la malla de mayor volumen. La sombra del cuerpo
  (pista de juego: ver al rival por su sombra) no cambia.
- **Después:** 2 bots = **18 llamadas**; 24 piezas con sombra. Pruebas: shadow.browser 7/7, aim.browser 14/14,
  online.browser 43/43. **Riesgo visual:** la sombra del rifle en el suelo pierde detalles de pocos píxeles.
- **Revertir:** `git revert` del commit; solo cliente.

## N5-2 · Banderas de diagnóstico para las rayas del PC del propietario
- **Por qué:** la auditoría encontró causas posibles comprobadas en el código (capas de pintura a 3–6 mm de la pared,
  fundido de sombra que usa la normal con relieve, toldos que se sombrean, sesgo de sombra) pero ninguna se ha
  reproducido; solo el Chrome del propietario las muestra (portátil con Intel + NVIDIA).
- **Añadido (sin cambiar nada por defecto):** `&near=`, `&sbias=`, `&kitsombra=0`, `&sombrageo=1`, `&dbg=sombra`; la línea
  de diagnóstico de AJUSTES › GRÁFICOS dice cuáles están activas. Guía para el propietario: `PRUEBA_RAYAS_PC.md`.
- **Comprobado en la GTX 1050 Ti (navegador integrado):** las 4 combinaciones compilan sin programas rotos; sin banderas,
  cámara y sesgo idénticos a antes. shadow.browser 7/7.
- **Revertir:** `git revert` del commit; solo cliente.

### Validación del paquete N6 (19-10-2026)
`npm test`: 955 correctas, 0 fallidas (26 suites). Nota: una ejecución completa se cortó en `aim.browser` por falta de
memoria **del PC** (Node no pudo reservar memoria con 22 MB de montón; 3,5 GB libres con Chrome del propietario abierto);
las 6 suites restantes se pasaron después por separado. `online.browser` agotó una vez los 30 s de carga de la página en
ese estado y pasó 43/43 al repetirla sola.

---

## N4-1 · Sensación de las armas tras `?feel=2` (para comparar con la actual)
**Antes (diagnóstico en el código):**
1. **Sprint:** el arma baja hasta 8 cm y gira rx −0,42 / ry +0,55 rad; tarda ~0,23 s en volver (amortiguación 10/s) aunque
   el sprint termina en 0,1 s: el disparo puede salir con el arma aún bajada (auditoría J10).
2. **Retroceso visual:** el golpe se apaga en exponencial lenta (sigue al 15 % a los 200 ms y al 2,5 % a los 400 ms):
   sensación de arma que «flota».
3. **Confirmación:** la marca de baja / headshot dura 0,26 s, igual que un impacto normal, y coincide con la sacudida.
4. **Impactos:** las partículas en el cuerpo crecen con la distancia, las de pared y suelo no: a 60–100 m sin mira son
   casi invisibles.

**Solución (`?feel=2`, solo presentación):** pose de sprint al 60 % y vuelta a 22/s; retroceso visual con muelle
(k 420, c 26 → ζ≈0,63); marca de baja/headshot con «pop» ×1,9 y 0,5 s; impactos en pared/suelo ×(distancia/30), hasta
×2,2, sin cambiar el tamaño del agujero. **Puntería, RECOIL, dispersión, daño y balas no cambian.**

**Después (MEDIDO, curva del retroceso visual tras un disparo, cada 1/60 s):**
| | 50 ms | 100 ms | 200 ms | 400 ms |
|---|---|---|---|---|
| actual | 0,57 | 0,37 | 0,15 | 0,025 |
| feel=2 | 0,55 | 0,16 | −0,05 (rebote) | 0,003 |
Sprint: vuelta al 10 % en ~0,10 s (antes ~0,23 s), calculado de las constantes.

**Pruebas:** `npm test` completo 955/955 (tras liberar memoria: Windows se había quedado sin memoria comprometida,
24,4/24,5 GB, y las suites de navegador no arrancaban). **Pendiente de que el propietario compare** `?feel=2` con la versión actual, en PC e iPhone.
**Revertir:** `git revert` del commit; o simplemente no usar la bandera.

---

## N5-3 · CASA ATLAS XL con las texturas CC0 del juego (`&xltex=1`)
- **Antes (MEDIDO):** las texturas de color de la entrega son casi lisas (±4/255) con mapas de relieve muy fuertes:
  aspecto de barro o espuma. 57 texturas, 66,8 MB de GPU en ALTO y MEDIO.
- **Solución (tras `&xltex=1`):** cada material de la entrega usa la textura aprobada del juego, con la resolución de su
  perfil y la repetición a su tamaño real (UV reescaladas por malla): estuco `white_stucco_02` (ocre con tinte), piedra
  del kit, caliza v3b, adoquín `cobblestone_02`, tierra, hormigón, madera del pueblo (tintada), tablones CC0 para la
  madera pintada, espiga para el suelo interior, teja `clay_roof_tiles_02`. Vidrio, agua, hierro, tela y plantas, sin
  cambios. Probados y descartados: guijarros para la grava (es un mosaico decorativo) y tablones blancos para el tronco.
- **Después (MEDIDO, Chromium por software):** 40 texturas; MEDIO 66,8 → 66,2 MB; ALTO 66,8 → 118 MB (texturas CC0 de
  2048 px, solo PC). Capturas antes/después con 4 cámaras fijas a la altura de los ojos.
- **Pruebas:** casaxl.browser 17/17 (3 nuevas: texturas por perfil, las que se conservan, sin 404).
- **Pendiente:** aprobación visual del propietario; iluminación interior; medir en iPhone.
- **Revertir:** no usar la bandera, o `git revert`.

---

## N3-4 · «El ratón se queda pillado» (vídeo del propietario, 19-10-2026)
- **Reproducción:** vídeo `Grabación 2026-10-19 103827` (min 0:24–0:28): jugando, la cámara deja de girar unos segundos
  y el propietario vuelve al menú. **Causa (confirmada en el código):** si Chrome rechaza la captura del ratón (lo hace
  si se pide menos de ~1 s después de salir de ella, p. ej. Esc → REANUDAR rápido), el juego seguía con la cámara
  atada al **cursor libre**: al llegar al borde de la pantalla, el cursor se para y la cámara se queda clavada. Además,
  el clic que volvía a pedir la captura disparaba.
- **Solución:** REANUDAR espera ese segundo («UN MOMENTO…») en vez de pedir una captura que Chrome va a rechazar; sin
  captura, la cámara no sigue al cursor libre y el clic solo recupera el ratón (no dispara). El modo de cursor libre
  queda solo para navegadores donde la captura falla 3 veces seguidas.
- **Pruebas:** `browser` 60/60 (2 nuevas: REANUDAR espera; sin captura ni giro ni disparo), `online.browser` 43/43
  (reanuda pasado el segundo, como una persona), `smoke` 76/76, `touch.smoke` 82/82 (táctil no cambia).
- **Otro hallazgo del mismo vídeo:** la línea de diagnóstico dice **«GPU: ANGLE (Intel… UHD Graphics 630)»**: el Chrome
  del propietario dibujaba con la GPU integrada (FPS 25–46 en el vídeo). El propietario puso Chrome en «Alto
  rendimiento (GTX 1050 Ti)» en Windows › Gráficos; pendiente de comprobar tras reiniciar Chrome (también las rayas).
- **Revertir:** `git revert` del commit; solo cliente.
