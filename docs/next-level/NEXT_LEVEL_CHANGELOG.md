# NEXT LEVEL — registro de cambios

Cada entrada sigue el formato pedido: antes (problema, reproducción, evidencia, causa, solución, riesgos) y después
(archivos, resultado, pruebas, antes/después, rendimiento, limitaciones, cómo revertir).
Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE.

---

## N3-3 · Online: las balas del servidor volaban a la mitad de velocidad (28-10-2026)

**Antes**
- **Problema:** encontrado por Claude al medir el tiempo jugado para las cajas.
  - Con el tráfico normal de una partida, el servidor de la sala hacía volar las balas a 280–380 m/s en vez de los
    600 m/s del HALCÓN R7. En tu pantalla iban a 600.
  - Contra un rival que se mueve, el servidor podía dar fallo donde el tirador había acertado.
  - A distancia y con ping alto se nota más.
- **Reproducción:** `test/simnet.js` (la sala real y dos clientes reales con red simulada); disparo al cielo y distancia
  recorrida por la bala del servidor entre ticks.
- **Evidencia:**

| Medida | Antes | Después |
|---|---|---|
| Velocidad de la bala en el servidor (ping 40 ms) | 284 m/s | 599 m/s |
| Velocidad de la bala en el servidor (ping 160 ms) | 379 m/s | 599 m/s |
| Rival andando de lado a 33 m, apuntando donde se ve con la anticipación normal (ping 92 ms) | 9 de 12 | 12 de 12 |
| Ídem, ping ~255 ms | 6–8 de 12 | 10 de 12 |

- **Causa:** `tick(now)` avanzaba las balas según `now - R.now`, pero `R.now` también lo mueve cada mensaje recibido. Ese
  tiempo era el que había pasado desde el último mensaje, no desde el último tick: casi siempre un solo paso de 1/120 s por
  tick de 1/60 s.
- **Solución:** las balas avanzan según el tiempo real entre ticks, en pasos de 1/120 s, guardando el sobrante para el
  siguiente tick (como mucho 30 pasos).
  - No cambia la bala: velocidad, caída, daño y zonas de impacto son los mismos.
  - Tampoco cambia la compensación de latencia. Solo que la bala del servidor vuela tan rápido como debía.
- **Riesgos:** ninguno en las reglas. Los blancos que se mueven ahora se aciertan como se ven.
- **Visto y NO tocado entonces (necesitaba aprobación):** la regeneración de vida online tiene el mismo fallo de reloj.
  - Curaba 6–11 de vida por segundo en vez de los 22 de la regla, que son los del modo contra bots.
  - El propietario lo aprobó después («Sí, corrígelo»): ahora se regenera según el tiempo entre ticks y da 22,0/s con
    ping 40 y 160 ms (comprobado en `test/room.test.js`).

**Después**
- **Archivos:** `core/room.js` (`tick`: `R.lastTick`, `R.bulletMs`), `test/room.test.js`.
- **Pruebas:**
  - `room` 122/122, con la comprobación nueva «la bala del servidor vuela a la velocidad del rifle» con ping 40 y 160 ms,
    que con el código anterior fallaba.
  - La prueba del rival en movimiento a 36 m da 5/5 con los dos pings.
  - `npm test` completo.
- **Cómo revertir:** volver a `n = round(dtMs / DT)` en `tick()` de `core/room.js`.
- Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR (simulación y pruebas online locales) · PENDIENTE DE PROBAR ONLINE ENTRE DOS
  DISPOSITIVOS.

---

## N7-2 · Personaje 3D, segunda pasada: chaleco, camuflaje y postura de combate (`?pj=2`, 20-10-2026)

**Antes**
- **Problema (propietario):** «bastante bien para empezar», pero le falta ser más agresivo, mejor postura, más
  detalle y mejores texturas y materiales, tipo PUBG Mobile (fotos de referencia).
- **Solución:** chaleco porta-placas con faja, hombreras, 3 portacargadores, bolsillo de pecho y radio (sustituye a
  bolsillos de pecho y tirantes); camuflaje por apariencia (bosque B, desierto A, digital urbano bots) calculado en 3D;
  cintas MOLLE con remates; pliegues +35 %; más contraste de oclusión y cantos; cristal de gafas reflectante. Postura:
  cadera atrás, rodillas flexionadas, pies abiertos, rifle más alto con codos abiertos, clavículas adelantadas.
- **Riesgos:** los mismos que N7-1 (solo cliente, solo con la bandera). La inclinación tiene tope: más saca la cabeza
  o la espalda de las cajas del servidor.

**Después**
- **Archivos:** `revision_03/src/gear.py`, `textures.py`, `clips.py`, `anim.py`, `build_model.py`, `run.ps1`;
  `assets/personaje/*` regenerados.
- **Pruebas:** `check-character-hitbox` ✔ en los 3 LOD; `soldier2.test` 18/18; `pj2.browser.test` 14/14;
  `online.browser` 43/43; `browser` 61/61.
- **Antes/después:** `docs/next-level/pj2b/` (misma cámara que `pj2/`). Llamadas 42 (igual), triángulos 76 200 (igual),
  CPU de animación de 3 bots 0,12–0,33 ms.
- **Cómo revertir:** `git revert` de este commit (vuelve la primera versión de la rev. 03).

---

## N7-1 · Personaje 3D realista para bots y rival online, tras `?pj=2` (19/20-10-2026)

**Antes**
- **Problema:** el rival y los bots eran una figura de cajas y cilindros con IK procedural («monigotes», propietario).
  Las dos entregas de Codex no valían: la rev. 01 (piezas rígidas, 5 328 triángulos) fue rechazada («parecen
  muñecos») y la rev. 02 se quedó a medias por falta de uso.
- **Causa del aspecto de muñeco en la rev. 01:** cuerpo hecho de primitivas, cada vértice pegado a un solo hueso
  (articulaciones que se separan), agachado y deslizamiento a base de escalar todo el cuerpo.
- **Solución:** revisión 03 rehecha por Claude por código (`assets/3d/imports/2026-10-19_personaje/revision_03/`,
  ficha `PERSONAJE_REV03.md`): cuerpo de MakeHuman CC0 masculino, ropa con volumen y pliegues horneados, equipo
  modelado, pesos suaves, texturas 2048 con suciedad y desgaste, 29 clips con IK y pies que no patinan; altura de
  agachado/deslizamiento por morph (los brazos y la cabeza no se deforman). Integración por capas con `AnimationMixer`.
- **Riesgos:** solo cliente y solo con la bandera. No se tocan `core/`, servidor, balística ni zonas de impacto.

**Después**
- **Archivos:** `client/soldier2.js` (nuevo), `src/page.html` (`PJ2`, `pj2Load/pj2Attach/animateSoldier2`, bots con
  apariencia, sin girar el grupo al morir con `?pj=2`), `build.py` (incluye el módulo y los assets en el hash),
  `assets/personaje/` (GLB 2048 y 1024, apariencias A y bots), `tools/check-character-hitbox.js` (nuevo),
  `tools/capture-pj2.js` (nuevo), `test/soldier2.test.js` y `test/pj2.browser.test.js` (nuevos), docs.
- **Resultado:** bots del duelo (gris), bots del campo de tiro (arena) y rival online (oliva) con el personaje nuevo:
  rifle al hombro o bajo, marcha en 4 direcciones sincronizada con la velocidad, esprint con el rifle cruzado,
  agachado, deslizamiento, salto, recarga/cerrojo/bombeo/navaja según el estado del juego, inclinación de la mirada
  (capa aditiva) y caída al morir. LOD por distancia dividida por el zoom de la mira (con la mira se ve LOD0).
- **Pruebas:** `validate-glb` ✔ (2048 y 1024); `check-character-hitbox` ✔ en los 3 LOD (±4 cm; cabeza en reposo
  −0,15 cm); `soldier2.test` 18/18; `pj2.browser.test` 14/14 (sin la bandera no se descarga nada; zonas de impacto
  idénticas; piernas que se mueven; agachado a la altura del servidor; tumbado al morir; LOD; rival B; BAJO = 1024);
  `npm test` completo en verde.
- **Antes/después (misma cámara, 3 bots a 7/14/30 m, WebGL por software):** `docs/next-level/pj2/` (PUEBLO 3.0 y
  CASA XL, plano general y de cerca).

  | 3 bots | Soldado de cajas | Personaje rev. 03 |
  |---|---:|---|
  | Llamadas de dibujo (con sombra) | 102–129 | **42** |
  | Triángulos (con sombra) | 10 500–14 500 | 76 200 (LOD0, LOD0, LOD1) |
  | CPU de animación (3 bots, por fotograma, PC) | 0,06–0,19 ms | 0,12–0,31 ms |
  | Texturas en GPU | — | 64 MB (ALTO/MEDIO) · 16 MB (BAJO) + 21/5 MB por apariencia extra |
- **Limitaciones:** agachado/deslizamiento comprimidos (son las cajas del servidor); dedos fijos; FPS reales en
  iPhone/Samsung/GTX sin medir. **PENDIENTE DE VALIDACIÓN EN IPHONE** y de aprobación visual del propietario antes de
  ser el personaje por defecto.
- **Cómo revertir:** quitar `?pj=2` (por defecto no cambia nada). Para retirarlo del todo: revertir el commit.

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

## 19-10-2026 — Menú de PC sin desplazamiento
- IMPLEMENTADO · PROBADO EN NAVEGADOR: controles en dos columnas y título adaptado al alto de la ventana; Campo de tiro oculta la descripción para conservar espacio.
- Verificación de maquetación en Chrome, Duelo y Campo de tiro: 1536×775, 1366×657, 1280×720, 1920×969 y 1440×789 sin desbordamiento vertical. Captura local: build/menu-desktop.png (HTML sin ejecutar el juego; no es una prueba de render 3D).
- mobile.test 74/74; touch.smoke.test 82/82. No se ha repetido npm test completo para este ajuste CSS.
- Pendiente: aprobación visual del propietario y publicación. Se conserva el trabajo independiente de CASA ATLAS.

---

## N8-1 · Menú de PC sin deslizar (petición del propietario, captura 19-10-2026)
- **Antes (MEDIDO):** el menú medía 1 061 px de alto en todos los tamaños; en 1536×775 (el Chrome del propietario)
  sobraban 286 px y **JUGAR quedaba en y = 879, fuera de la pantalla**; también en 1366×657, 1280×720 y 1440×789.
- **Solución (solo PC, ancho ≥ 900 px):** título que sigue la altura de la ventana, controles en dos columnas
  (Modo | Arma, Dificultad | Bots pueden matarte; bots de entrenamiento en dos columnas en el campo de tiro), fuera la
  línea antigua de fases; en ventanas de ≤ 700 px de alto se ocultan la descripción del modo y la lista de teclas.
  Texto superior actualizado («Duelo de francotiradores · 1v1»). El móvil no cambia.
- **Después:** sobra 0 px en 1536×775, 1366×657, 1280×720, 1920×969 y 1440×789; JUGAR en y = 641 de 775.
- **Pruebas:** browser 61/61 (nueva: el menú cabe en 3 tamaños), mobile 74/74, touch.smoke 82/82, smoke 76/76.
- También: la prueba de `&xltex=1` espera hasta 240 s a la carga (en una ejecución completa con el PC ocupado pasó de
  120 s; sola pasa). **Revertir:** `git revert`.

---

## N5-4 · Rayas en las paredes lejanas: CAUSA ENCONTRADA Y ARREGLADA (19-10-2026)
- **Síntoma (vídeo del propietario, ya con la GTX 1050 Ti):** al fondo de las calles de PUEBLO 3.0, la mitad de abajo de
  las fachadas se ve con manchas grises si estás quieto y con rayas que se mueven al andar. Ninguna de las banderas de
  diagnóstico (`near`, `sombras=0`, `nm=0`, `sombrageo`) lo cambiaba.
- **Causa (CONFIRMADA con rayos en la página):** las fachadas del «pueblo exterior» (`p3_backdrop_*`) están exactamente
  en el plano del muro perimetral antiguo de hormigón (`town_concrete`, x/z = ±50, 4 m de alto): 102 puntos coplanarios.
  Dos superficies a distancia cero pelean por cada píxel (z-fighting); por eso ninguna precisión extra lo arreglaba y
  por eso solo afecta a la franja baja (la altura del muro).
- **Solución:** el pueblo exterior usa materiales propios (mismas texturas, sin memoria extra) con el mismo
  desplazamiento de profundidad que ya usa el suelo: la fachada siempre gana al muro.
- **Antes/después (MEDIDO en la GTX 1050 Ti, píxeles de la pared que cambian con 5 mm de movimiento, 3 puntos a 16–36 m):**
  publicado 11–33 % → con el arreglo 0–2,6 %.
- **Pruebas:** p0.browser 76/76 (nueva: materiales propios con desplazamiento), town3, cover, shadow, e10 en verde.
- **Pendiente:** confirmación del propietario en su PC. Queda un caso pequeño (4 puntos) de piedra del kit contra estuco
  del pueblo en x ≈ 23–33. **Revertir:** `git revert`.
## N5-5 · CASA ATLAS XL v2 (ChatGPT) por defecto en XL
- **Entrega:** `assets/3d/imports/2026-10-19_casa_atlas_xl_v2/` (encargo `docs/PROMPT-CHATGPT-CASA-ATLAS-XL-V2.md`). ChatGPT
  se quedó sin uso antes de su control de calidad («visual and browser QA pending»); lo hizo Claude.
- **Comprobado:** `collision_map.json` idéntico byte a byte a la v1 (combate, servidor y bots sin cambios);
  `validate-glb` ✔ en los dos GLB; 28 094 triángulos (v1: 3 300), 23 materiales, 22 texturas; 49 MB en GPU (v1: 67).
  Capturas en el juego con 4 cámaras: rejas, contraventanas, puertas con marco, toldos, zócalo, suelo de barro, olivo
  con ramas, interior con techo y rodapié.
- **En el juego:** v2 por defecto; `&xlv=1` muestra la v1 (y `&xltex=1` solo se aplica a la v1).
- **Pruebas:** casaxl.browser 17/17, casa.browser 20/20. **Pendiente:** aprobación visual del propietario; iPhone.
