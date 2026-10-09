# Etapa D — auditoría del 1v1 online (9-10-2026)

Estado real de cada tarea D1–D8 comprobado contra el código publicado (`main`), las pruebas automáticas y la primera prueba real: portátil en Wi-Fi + iPhone con datos móviles, 60 FPS y 70–90 ms de ping, con movimiento, disparos, daño por zonas, headshots, muertes, reapariciones y marcador 2–2 iguales en los dos.

Nada se ha rehecho desde cero. La arquitectura publicada (Worker + Durable Object en Cloudflare, `core/room.js` autoritativa y cliente con predicción) se mantiene.

| Tarea | Qué existe | Cómo se ha comprobado | Faltaba (corregido hoy) | Pendiente |
|---|---|---|---|---|
| **D1** Auditoría | Este documento + `ETAPA-D-REQUISITOS.md` (los cuatro documentos de requisitos) | Revisión del repositorio y del despliegue | — | — |
| **D2** Mapa compartido | `core/mapdata.js`, exportado de la página con `tools/export-map.js` (2.404 triángulos, 81 cajas, 2 rampas, 705 puntos). `core/geom.js` hace los rayos | `browser.test`: el mapa del servidor es idéntico al de la página; 3.000 rayos dan lo mismo que Three.js | — | El mundo visual sigue construyéndose en `src/page.html`. Si se añade un mapa nuevo hay que volver a exportar (la prueba lo detecta) |
| **D3** Sala autoritativa | `core/room.js` + `core/player.js` (el mismo tick en cliente y servidor) + `core/protocol.js` v1 | `room.test`: 77 pruebas con red simulada | Compensación de latencia acotada (250 ms) para balas con vuelo | Si Cloudflare reinicia la sala en mitad de una partida, vuelve al lobby con los nombres y los tokens (la partida no se recupera a medias) |
| **D4** Servidor Node | `server/node.js` (las mismas reglas) | `net.test`: 13 pruebas con WebSocket reales | — | Solo para pruebas locales |
| **D5** Cliente multijugador | Menú MULTIJUGADOR, enlace `?sala=`, lobby, cuenta atrás, rival en 3D, predicción y reconciliación, interpolación, marcador, VICTORIA/DERROTA/EMPATE, REVANCHA, RECONECTANDO, panel F3 de red | `online.browser.test` (30) con dos Chromium; prueba real Wi-Fi + datos | Lobby que no cabía en el móvil, HUD solapado, contador de desconexión fijo, aviso de versión nueva | Probar la reconexión al volver de segundo plano con dos móviles |
| **D6** Navegador real | Dos navegadores contra el servidor local (`online.browser.test`) y contra el público (`public.browser.test`, en GitHub después de cada publicación) | Todas las ejecuciones en verde | Pruebas nuevas: tamaño de iPhone 8, versión nueva, HUD estrecho | Safari/Android físicos (solo se pueden probar a mano) |
| **D7** Cloudflare | `server/worker.js`, `wrangler.toml`, flujo «Desplegar servidor» (pruebas → publicar → comprobar con dos clientes) | Despliegues en verde; URL en `server.json` | Límite de creación de salas por IP (10/min) | Sentry no está configurado (no hay DSN): los errores se ven en el panel F3 y en los registros de la sala |
| **D8** Navaja y efectos | Navaja validada en el servidor (alcance, paredes, espalda); disparo, fogonazo, chasquido cercano, pasos, cerrojo y recarga del rival; animaciones de recarga, cerrojo y estocada | `room.test` (navaja a 1,5 m sí, a 6 m no) | Estocada visible del rival, pasos y cerrojo audibles | Más animaciones y sonidos (fase creativa) |

## Riesgos que quedan (por orden)

1. **Reconexión desde segundo plano en dos iPhone reales.** Está automatizada en Chromium, pero en Safari solo se ha visto una vez, con un solo móvil.
2. **Partidas largas.** Falta comprobar que el móvil no se calienta ni pierde FPS después de 10–15 minutos.
3. **Caché del navegador.** Una pestaña abierta podía seguir con la versión vieja. Ahora sale el aviso «HAY UNA VERSIÓN NUEVA · ACTUALIZAR».
4. **Reinicio del servidor en mitad de una partida** (por ejemplo, al desplegar): la partida vuelve al lobby. Conviene no publicar el servidor mientras se juega.

## Siguiente fase (creativa)

1. **ARENA DE PRUEBAS** ✔ (9-10-2026): mapa 1v1 compacto, elegido por defecto en las salas nuevas; el creador puede cambiar a PUEBLO en el lobby.
2. Nuevas armas, mejores animaciones, sonidos e impactos.
