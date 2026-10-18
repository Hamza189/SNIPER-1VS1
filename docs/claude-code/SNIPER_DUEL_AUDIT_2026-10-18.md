# SNIPER DUEL — auditoría con cuatro agentes (18-10-2026)

Cuatro auditorías en paralelo, todas de solo lectura (ningún agente podía editar): rendimiento, gráficos, jugabilidad y
QA/multijugador. El coordinador (Claude) ha revisado los informes y ha vuelto a comprobar en el código o reproducido los
hallazgos marcados con ✔. **No se ha cambiado nada del juego.**

Leyenda: **MEDIDO** (con su entorno) · **COMPROBADO** en el código · **HIPÓTESIS** · ✔ = verificado de nuevo por el coordinador.
SwiftShader (navegador por software) sirve para contar llamadas, triángulos y memoria, **no** para FPS.

## 1. Lo más importante (resumen)
1. ✔ **Fallo online:** si el servidor de la sala se reinicia (pasa en cada despliegue) en mitad de una sesión, el cliente
   reconectado puede **ignorar los eventos de la partida siguiente** (`go`, impactos, muertes, final).
2. ✔ **CASA ATLAS:** la red de navegación de los bots está partida en 3 trozos (1 861 + 13 + 1 nodos). Algunos bots
   aparecen en un trozo aislado y **no se mueven en toda la vida** (≈2,2 % de las apariciones, simulado).
3. **Rayas en las paredes:** dos causas nuevas COMPROBADAS en el código, pendientes de probar en tu GPU: capas pintadas
   a 3–6 mm de la pared (z-fighting a distancia) y un fundido de sombra que sigue el relieve de la textura. Además, la
   hipótesis más fuerte: que tu Chrome use la **Intel UHD 630** y no la NVIDIA.
4. **Memoria de GPU en MEDIO (perfil del iPhone):** ~105 MB MEDIDOS; ~35 MB se pueden ahorrar sin tocar el aspecto
   (ESTIMACIÓN), sobre todo con texturas subidas varias veces a la GPU ✔.
5. ✔ **Tirón al empezar la partida:** las armas en primera persona nunca se precompilan; el primer fotograma de juego
   tarda 618 ms (MEDIDO en SwiftShader) frente a 9–25 ms los siguientes.
6. **Coste de Cloudflare:** con el ritmo de mensajes actual, el plan gratuito daría para unas **6,5 horas de partida al
   día en total** (CALCULADO con la documentación de Cloudflare; no comprobado en el panel). Superarlo da errores hasta
   las 00:00 UTC, no cobros.

## 2. Hallazgos por área

### QA y multijugador
| # | Hallazgo | Tipo | Prio | Solución | Toca `core/` (redespliega) | Prueba |
|---|---|---|---|---|---|---|
| Q1 ✔ | `R.evSeq` no se guarda en `save()` (`core/room.js:61-65`); el cliente conserva `lastEvQ` al reconectar a la misma sala (`src/page.html:4144`, `client/netcore.js:126`) y descarta eventos con `q` repetido | Fallo comprobado | **P1** | Cliente: `lastEvQ=0` al recibir `welcome` | No (solo `netcore.js`) | `room.test`: `restore()` + reconexión + partida nueva → llegan `go`, `kill`, `over` |
| Q2 | ~85 mensajes/s por sala (`sendEvery=3` a 120 Hz) y Durable Object sin hibernación (`server/worker.js:73-79`) → ~6,5 h de partida/día en el plan gratuito | Riesgo de coste calculado | **P1** | Medir el consumo real en el panel; después valorar `sendEvery` 6 o hibernación | No / Worker | `net.test` contando mensajes; panel de Cloudflare |
| Q3 | El retroceso de la compensación de latencia lo decide el cliente (`ft`, `core/room.js:300`): `ft=0` da siempre 250 ms | Vulnerabilidad acotada | P2 | RTT medido por el servidor; tope ≈ RTT/2 + interpolación + 40 ms | Sí | `room.test` con `ft` falso |
| Q4 | Conexiones WS sin límite de frecuencia ni de número por sala; socket sin `hello` vivo 15 min | Riesgo de abuso | P2 | Limitador por IP, máx. ~4 sockets por sala, cierre a 3 s sin `hello` | Sí | `room.test` |
| Q5 | `net.test.js` intermitente: **falló 2 de 4 veces** en este PC (cliente con mapa PUEBLO, servidor con ARENA; disparo de 30 ms con temporizadores de Windows) | Prueba frágil comprobada | P2 | Mapa ARENA en el cliente de prueba; esperar el evento en vez de `sleep` | No | 20 ejecuciones seguidas en verde |
| Q6 | Revancha con el rival ya ido: el comentario de `room.js:216` dice que el que queda pasa a A, el código no lo hace; si queda B no puede elegir mapa | Fallo menor | P3 | Mover B → A | Sí | `room.test` |
| Q7 | `CREATE_LIMITER` deja pasar si falla (`worker.js:28`); ráfaga de 120 comandos; socket cerrado que sigue en `socks` | Riesgos menores | P3 | Ver informe | Sí/No | — |
| Q8 | CI: «Desplegar servidor» solo pasa 4 suites, sin reversión automática si falla la prueba pública; «Pruebas» solo a mano; sin `package-lock` | Proceso | P2 | `test:fast` en cada push, `wrangler rollback` si falla, `npm ci` | No | Actions |
| Q9 | `server/worker.js` y `RoomDO` **sin ninguna prueba** | Hueco de cobertura | P2 | Prueba con `state` falso en Node | No | — |

### Jugabilidad
| # | Hallazgo | Tipo | Prio | Solución | Toca `core/` | Prueba |
|---|---|---|---|---|---|---|
| J1 ✔ | Red de navegación de CASA en 3 trozos; bots inmóviles si aparecen en el trozo aislado | Fallo comprobado | **Alta** | Quedarse con el trozo mayor (o margen 0,36 m); `pickDest` adaptado a un piso de 18×14 m | No | Prueba Node: un solo trozo |
| J2 | Bots de CASA: pierden un tick en cada cambio de nodo → 8,4 % de ticks parados, 2,6 m/s de media frente a 3,4 (MEDIDO) | Comprobado | Media | Avanzar en el mismo tick | No | `bot-motion-audit` en CASA |
| J3 ✔ | Zonas de impacto de los bots offline ≠ `core/hitbox.js`: dos «brazos» que cuentan como torso y sobresalen ~0,5 m, dos esferas de cabeza | Diferencia comprobada | Media | Construirlas desde `SDHitbox.PARTS` (como el rival online) | No | `aim-audit` + `aim.browser.test`. **Cambia la sensación offline: necesita tu aprobación** |
| J4 | Navaja offline contra bots agachados usa la altura de pie (`page.html:3626`) | Fallo menor | Baja | Usar `hitG.scale.y` | No | Prueba de navaja |
| J5 | Dispersión de cadera la decide el cliente; el servidor acepta hasta 0,3 rad (~17°) de desvío (`room.js:30,293`) | Riesgo de trampa | Media | Dispersión generada por el servidor o tope más estricto | **Sí** | **Toca reglas: necesita tu aprobación** |
| J6 | Fórmula de caída de daño copiada 3 veces (idénticas hoy) | Duplicación | Baja | `SDWeapon.damageAt` | Sí (mismo resultado) | `pistol`, `shotgun`, `room` |
| J7 | Daño de bot aplicado 0,2 s después sin volver a comprobar visión ni si el bot vive | Comprobado | Baja | Recomprobar dentro del retardo | No | Prueba de navegador |
| J8 | Táctil: con FUEGO y FUEGO 2 pulsados, soltar uno dispara aunque el otro siga | Riesgo | Baja | Comprobar ambos | No | `touch.smoke` |
| J9 | Giro residual tras reanudar si «suavizado» > 0 (`LOOKSM` no se vacía) | Riesgo | Baja | Vaciarlo en `clearPendingInput` | No | iPhone con `?diag=touch` |
| J10 | Pose de sprint: el arma baja 8 cm y gira mucho; vuelve en ~0,3 s y el disparo puede salir con el arma bajada | Visual (idea de fase G) | Media | Pose más suave tras bandera | No | `capture-vm`, **aprobación visual** |

Anotado sin proponer: el daño de los bots de duelo (48/100) no sale de `config.js`; cambiarlo sería balance.

### Gráficos (rayas y render)
| # | Hallazgo | Tipo | Prio | Siguiente paso |
|---|---|---|---|---|
| G1 | Tu Chrome podría pintar con la Intel UHD 630 (portátil Optimus, COMPROBADO que tiene las dos GPU) | HIPÓTESIS | **P0** | Captura de la línea «GPU:» en AJUSTES › GRÁFICOS |
| G2 ✔ | Capas pegadas a la pared: banda de ventanas a 6 mm (`tools/blender/kit.py:586-590`), zócalo a 4 mm y parches de ladrillo a 3 mm (`client/town3.js:294,311`). Con `near`=0,05 la precisión de profundidad a 50 m es ≈3 mm → z-fighting | COMPROBADO (causa probable) | **P0** | Bandera `&near=0.2`; después despegar ≥2 cm |
| G3 ✔ | El fundido de sombra usa `geometry.normal`, que ya incluye el mapa de normales (`page.html:803`): la sombra puede encenderse y apagarse siguiendo las hiladas | COMPROBADO (causa probable) | P1 | Usar la normal geométrica; probar con `&nm=0` |
| G4 | Lamas de contraventanas cada 5,5 cm → aliasing a 30 m; el kit no tiene LOD | COMPROBADO | P1 | LOD del kit tras bandera |
| G5 | Toldos y ropa `DoubleSide` y aleros pegados a la pared proyectan sombra sobre sí mismos | COMPROBADO | P1 | `&kitsombra=0` y prueba de proyectores coplanarios |
| G6 | Sesgos de sombra fijos que en MEDIO dejan ~15 cm de error | COMPROBADO | P2 | `&sbias=` para barrer |
| G7 | Más allá de 58 m no hay sombras: **una raya a más de 58 m no es sombra** | Dato | — | Descarte rápido |
| G8 | Parche de `ShaderChunk` frágil ante otra versión de Three.js (ya tiene prueba) | Riesgo futuro | P2 | — |
| G9–G11 | Sin reflejo ambiental en estuco y metal; anisotropía 2–4; LOD de E10 sin histéresis | Mejoras | P3 | Banderas `&env=1`, `&aniso=8` |
| OK | Gestión de color correcta (sRGB/lineal), AO horneado en vértices, shaders compatibles con WebGL 1 | Revisado | — | — |

### Rendimiento (MEDIDO en SwiftShader 1170×540 salvo indicación)
Base PUEBLO 3.0: texturas BAJO 54 MB · MEDIO 105 MB · ALTO 153 MB; MEDIO 230–331 llamadas, de ellas 77 del pase de sombras.

| # | Hallazgo | Prio (iPhone) | Ahorro | Solución | Riesgo visual |
|---|---|---|---|---|---|
| R1 ✔ | Tirón al empezar: `wScene` nunca se precompila; flora y ratas tampoco | **Alta** | Primer fotograma 618 ms → normal | `renderer.compile(wScene,wCam)` y tras cargar flora/ratas | Ninguno |
| R2 ✔ | Texturas subidas varias veces (`texLoad(...,own=true)`, `page.html:984-985,1117-1120`): `concrete` ×4, `wood` ×3… | **Alta** | ~14,6 MB GPU | UV escaladas + textura compartida | Ninguno (comprobar con diferencia de píxeles) |
| R3 ✔ | `rat_c` a 1024² para ratas de 25 cm | Alta | ~5 MB | 256² en MEDIO, 512² en ALTO | Mínimo |
| R4 | E10: 11 PNG dentro del GLB | Alta | ~10 MB GPU en MEDIO, ~3 MB de descarga (ESTIMACIÓN) | JPG y mitad de resolución en MEDIO | Aprobación visual |
| R5 | Rifle de los soldados: 11 piezas con sombra → ~40 de las 77 llamadas de sombra son de 2 bots | Media | ~20–40 llamadas | Solo la pieza principal proyecta sombra (se mantiene la sombra del cuerpo) | Bajo |
| R6 | Kit en 96 mallas, 37 con < 300 triángulos | Media | −25 a −35 llamadas (ESTIMACIÓN) | Unir regiones pequeñas y letreros | Muy bajo |
| R7 | El HUD reescribe el DOM cada fotograma en táctil | Media | CPU del iPhone | Escribir solo si cambia | Ninguno |
| R8 | Partículas: un material y una llamada por sprite (+72 llamadas en una ráfaga de escopeta) | Media | Picos de llamadas | Instanciado | Bajo |
| R9 | Luz del fogonazo siempre compilada aunque apagada | Media | Coste por píxel | Quitarla en MEDIO/BAJO | Se pierde el destello en paredes (aprobación) |
| R10 | CASA no se libera al salir (~32 MB ESTIMADOS) | Media | Memoria | `dispose` al salir | Recarga al volver |
| R11–R14 | `csFix` cada 10 fotogramas, ratas sin recorte, menú a FPS completos, resolución adaptativa con un solo escalón | Baja | — | Ver informe | — |

Descartado tras medir: rayos y asignaciones por fotograma (coste despreciable), fugas entre partidas (no hay).

## 3. Decisiones que te tocan a ti
| Decisión | Por qué es tuya |
|---|---|
| Zonas de impacto de bots offline iguales a las del online (J3) | Cambia la sensación de puntería offline |
| Dispersión de cadera decidida por el servidor o tope más estricto (J5) | Reglas y servidor |
| Bajar mensajes por segundo (`sendEvery`) o hibernación (Q2) | Sensación online / arquitectura del servidor |
| Resolución de texturas de rata y E10 en MEDIO (R3, R4) | Visual |
| Quitar el destello del fogonazo en paredes en MEDIO/BAJO (R9) | Visual |
| Pose de sprint (J10) | Visual |
| Pruebas de las rayas en tu PC (G1–G7) | Solo tu Chrome muestra el fallo |

## 4. Plan de implementación propuesto (nada empieza sin tu aprobación)
`src/page.html` es un solo archivo y lo tocan casi todos los arreglos, así que **los cambios del cliente van en serie**.
Solo la red (Q) puede ir en paralelo, en su propio worktree, porque toca otros archivos.

| Paquete | Archivos | Contenido | En paralelo |
|---|---|---|---|
| **P-RED** | `client/netcore.js`, `test/net.test.js`, `test/room.test.js` | Q1 (fallo de eventos), Q5 (prueba frágil); después Q3/Q4/Q6 en `core/room.js` y `server/worker.js` | Sí (worktree aparte) |
| **P-RENDIMIENTO-SEGURO** | `src/page.html`, `client/kit3d.js` | R1, R2, R7 (no cambian el aspecto) | No |
| **P-CASA** | `src/page.html` | J1, J2, J4, J7, J8, J9 | No (después del anterior) |
| **P-RAYAS-DIAGNÓSTICO** | `src/page.html`, `tools/capture-scenes.js` | Banderas `&near=`, `&kitsombra=0`, `&sbias=`, `&dbg=sombra`; capturas con la GPU real (Intel y NVIDIA) | No |
| **P-CI** | `.github/workflows/`, `package.json` | Q8 + higiene T0 del informe de evolución | Sí |

Cada paquete: commit pequeño, `npm test` antes y después, sin despliegue hasta que lo apruebes.
