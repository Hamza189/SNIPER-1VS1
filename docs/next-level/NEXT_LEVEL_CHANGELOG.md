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
