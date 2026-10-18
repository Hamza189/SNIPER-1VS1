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
