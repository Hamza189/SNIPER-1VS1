# SNIPER DUEL — registro de decisiones, cambios y tareas

Registro duradero que mantiene Claude Code. Una entrada por sesión o por decisión, la más reciente arriba.
Cada entrada dice qué se decidió o cambió, quién lo decidió, y el estado real
(IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE).
Las decisiones anteriores al 18-10-2026 están resumidas en `SNIPER_DUEL_MASTER_CONTEXT.md` §4.
Detalle de cada cambio (antes/después, medidas, cómo revertir): `docs/next-level/NEXT_LEVEL_CHANGELOG.md`.

## Tareas (resumen vivo, actualizado el 25-10-2026)

### Siguiente prioridad
| Tarea | Quién la desbloquea | Estado |
|---|---|---|
| **Personaje 3D (rev. 03) en bots y rival** — probarlo en `https://hamza189.github.io/SNIPER-1VS1/?pj=2` (PC, iPhone, Samsung) y decir si pasa a ser el de por defecto | Propietario | PUBLICADO TRAS BANDERA · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Medir el rendimiento en el iPhone** — AJUSTES › GRÁFICOS › MEDIR RENDIMIENTO (o `?medir=1`), mandar el informe a Claude; idealmente en BAJO, MEDIO y ALTO (`docs/RENDIMIENTO-IPHONE.md`) | Propietario | LISTO PARA MEDIR |
| **Personaje LINCE (rev. 04)** — compararlo con la rev. 03 en `?pj=3` frente a `?pj=2` | Propietario | PUBLICADO TRAS BANDERA · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **HUD 2** (iconos, barra de armas, inventario, asomarse en móvil, editor) — probarlo en `https://hamza189.github.io/SNIPER-1VS1/?hud=2` (iPhone, Samsung, PC) y decir si pasa a ser el de por defecto | Propietario | PUBLICADO TRAS BANDERA · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Asomarse y zonas de impacto**: ¿el servidor debe mover cabeza y pecho con la inclinación? (`docs/HUD-2.md` §4) | Propietario | NECESITA APROBACIÓN |

### Esperando pruebas o decisiones del propietario
| Tarea | Estado |
|---|---|
| 1v1 online real entre dos dispositivos en CASA ATLAS (el mapa ya funciona contra bots en PC y móvil) | PENDIENTE |
| CASA ATLAS: ¿techo sí o no? (`&techo=1`) | PENDIENTE |
| Comparar `?feel=2` (sensación de armas) con la actual en PC e iPhone | PENDIENTE |
| FPS medidos en iPhone y Samsung (el propietario dice que en el móvil «va bastante bien» y todos los mapas funcionan; faltan cifras) | VALIDADO A OJO |
| Suelo del Samsung y fachadas P1 (`&fachada=cc0`) | PENDIENTE |
| Reconexión desde segundo plano con dos iPhone; partidas largas de 10–15 min | PENDIENTE |
| Comparar CASA XL v2 con v1 (`&xlv=1`) y aprobarla | PENDIENTE |
| Paquetes de la auditoría que cambian reglas o la sensación (zonas de impacto offline J3, dispersión del servidor J5, mensajes por segundo Q2) | NECESITAN APROBACIÓN |
| Evolución tecnológica T0–T6 (`SNIPER_DUEL_TECHNOLOGY_EVOLUTION.md`) | INFORME ENTREGADO |
| `.gitattributes` para los fines de línea | PROPUESTA |

### Pendiente de Claude (se hará poco a poco; se publica sin pedir OK si las pruebas pasan)
| Tarea | Estado |
|---|---|
| Perfil BAJO = PUEBLO 2.0 automáticamente; MEDIO/ALTO = PUEBLO 3.0 (mismas colisiones) | PENDIENTE |
| Calidades por etapas: congelar lo hecho como BAJO (~finales de octubre), mejorar a MEDIO y luego ALTO (plan en la hoja de ruta) | PLANIFICADO |
| Resto de la auditoría que no cambia reglas: seguridad del servidor (Q3, Q4, Q6, Q7), CI con `test:fast` y reversión (Q8), pruebas del Worker (Q9), navaja contra bots agachados (J4), daño del bot tras el retardo (J7), FUEGO doble táctil (J8), giro residual al reanudar (J9), textura de rata y E10 por perfil (R3, R4), unir mallas del kit (R6), partículas instanciadas (R8), liberar CASA al salir (R10), LOD y anisotropía (G4, G10, G11) | PENDIENTE |
| Caso pequeño de z-fighting: piedra del kit contra estuco del pueblo (x ≈ 23–33, 4 puntos) | PENDIENTE |
| Paredes blancas lisas de la CASA ATLAS original que deslumbran de cerca | PENDIENTE |

### Futuro / aparcado
| Tarea | Estado |
|---|---|
| Multiplataforma (web + .exe + iPhone + Android) y monetización cosmética — plan en `SNIPER_DUEL_ROADMAP.md` | FUTURO |
| Subir de 60 a 120–144 FPS en PC (dificultad media; en el navegador lo limita la frecuencia de la pantalla) | FUTURO |
| Gráficos de CASA ATLAS XL, poco a poco (cuando haya uso de Codex) | APARCADO |
| Cloudflare Pages `sniper-1vs1`: falla porque un original pesa 31 MiB (> 25 MiB); arreglo: comando de compilación en el panel | APARCADO |
| Armas clásicas como aspectos opcionales | SIN EMPEZAR |

### Hecho y publicado (18–19 de octubre de 2026)
| Tarea | Cuándo |
|---|---|
| Migración a Claude Code: informe de incorporación, `build.py` en UTF-8, entorno de Windows (`python3`, Playwright, `gh` con sesión) | 18-10 / 19-10 |
| Auditoría con cuatro agentes (rendimiento, gráficos, jugabilidad, red) e informe de evolución tecnológica | 18-10 |
| Online: el cliente ya no pierde los eventos tras reiniciarse el servidor de la sala (Q1) | 19-10 · PR #1 |
| CASA ATLAS: bots que aparecían encerrados y andaban a tirones (J1, J2) | 19-10 · PR #1 |
| CASA ATLAS XL (40 × 32 m) contra bots; todos los mapas en el menú | 19-10 · PR #1 |
| Rendimiento: sin tirón al empezar (R1), −13 MB de texturas duplicadas (R2), sombras de soldados (R5), HUD táctil (R7) | 19-10 · PR #1 |
| Prueba de audio que fallaba al azar | 19-10 · PR #1 |
| `?feel=2`: sprint, retroceso con muelle, confirmación de baja e impactos lejanos (para comparar) | 19-10 · PR #1 |
| Ratón «pillado» (REANUDAR demasiado pronto tras Esc) | 19-10 · PR #2 |
| Menú de PC sin deslizar (JUGAR estaba fuera de la pantalla) | 19-10 · PR #2 |
| CASA XL con texturas reales (`&xlv=1&xltex=1`, para la v1) | 19-10 · PR #2 |
| Chrome del propietario usaba la GPU Intel → puesto en «Alto rendimiento» (GTX 1050 Ti): 57–60 FPS estables | 19-10 (propietario) |
| **Rayas en las paredes lejanas**: z-fighting del pueblo exterior con el muro perimetral; confirmado por el propietario | 19-10 · PR #3 |
| CASA ATLAS XL v2 de ChatGPT por defecto (mismas colisiones, detalle real) | 19-10 · directo a `main` |
| Encargos para ChatGPT: CASA XL, CASA XL v2 y personaje | 18-10 / 19-10 |
| Personaje 3D rev. 03 hecho por Claude e integrado tras `?pj=2` (bots y rival online) | 20-10 · directo a `main` |

## 25-10-2026 (tarde) — LINCE terminado tras `?pj=3`, medidor de rendimiento, barra transparente y agacharse
- **Petición (propietario):** acabar el personaje que Codex dejó a medias al quedarse sin uso, preparar la optimización
  medida en el iPhone real (propuesta de Claude), fondo de la barra de armas regulable y levantarse solo tras deslizarse.
- **LINCE (rev. 04):** Codex lo dejó generado e integrado tras `?pj=3`, sin verificar ni subir. No pasaba la prueba de
  zonas de impacto (cabeza 4,2–5 cm fuera de su esfera por el visor nuevo) y había perdido el camuflaje. **Decisión
  (Claude):** se conservan sus mejoras (chaleco, portacargadores, rodilleras, botas, costuras, codos) y vuelven las gafas
  y el camuflaje de la rev. 03. Ahora cabe (2,7–3,7 cm) y cuesta lo mismo que la rev. 03 (42 llamadas, 76 200 triángulos
  con 3 bots). Detalle: `assets/3d/imports/2026-10-19_personaje/revision_04/PERSONAJE_REV04.md`.
- **Medidor:** AJUSTES › GRÁFICOS › MEDIR RENDIMIENTO / `?medir=1` (`client/perfprobe.js`, `docs/RENDIMIENTO-IPHONE.md`).
  Siguiente paso: el propietario mide en su iPhone y su Samsung y Claude optimiza con esas cifras.
- **Barra de armas:** fondo regulable de oscuro a transparente (AJUSTES y editor). **Agacharse:** PULSAR · TE LEVANTAS AL
  DESLIZAR (por defecto en móvil), PULSAR, MANTENER (por defecto en PC). Solo entrada: movimiento y servidor sin cambios.
- **Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 25-10-2026 — HUD 2 tras `?hud=2` (iconos, barra de armas, inventario, asomarse en móvil)
- **Petición (propietario, encargo largo con capturas de PUBG y COD Mobile como referencia ergonómica):** HUD renovado,
  original y profesional, con prioridad móvil, armas abajo en una barra transparente, inventario ligero, asomarse a
  izquierda y derecha, todo en el editor de HUD y tras una bandera hasta que lo apruebe en su iPhone.
- **Auditoría:** el asomado ya existía en PC (Q/E, solo cámara, máx. 0,45 m) y el servidor ya acepta disparos desde
  ahí (≤ 0,9 m del ojo), pero sus zonas de impacto no se inclinan. No hay munición de reserva (es ilimitada).
- **Hecho:** pack de 15 iconos originales hechos por código (`assets/hud/`, SVG + PNG + hoja de sprites + vistas previas
  + `HUD_ICONS.md` + JSON) y, tras `?hud=2`: botones con iconos y estados, barra de armas (toque, 1/2/3, rueda opcional;
  activa, pendiente, recarga, vacía, «siguiente» para la principal del próximo respawn), inventario (I/Tab/mochila),
  botones de asomarse en móvil (PULSAR por defecto) y teclas de asomarse configurables, editor con barra, visibilidad y
  opacidad por elemento (`hudLayout2`, migra desde los botones clásicos). Detalle: `docs/HUD-2.md`.
- **Decisión técnica (Claude):** nada de `core/` ni `server/` cambia: la barra usa el mismo `select` y el asomado móvil la
  misma inclinación de cámara que el PC. Sin la bandera el juego es exactamente el de siempre (comprobado).
- **Decisión técnica (Claude):** en móvil la barra selecciona al levantar el dedo y, si el dedo se desliza, pasa a ser
  joystick (la barra queda en la parte baja de la zona del joystick: así no se cambia de arma sin querer).
- **Pregunta abierta al propietario:** ¿mover las zonas de impacto con el asomado? (cambio del servidor, `docs/HUD-2.md` §4).
- **Pruebas:** `test/hud2.test.js` (47) y `test/hud2.browser.test.js` (56: PC, multitáctil real por CDP, editor con
  recarga, migración y online con servidor local, incluido un disparo apuntando y asomado aceptado por el servidor).
- **Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE (servidor local) · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 20-10-2026 — Personaje 3D: segunda pasada (chaleco, camuflaje, postura)
- **Opinión del propietario** sobre la rev. 03 en el juego: «bastante bien para empezar»; pide más agresividad,
  postura, detalle y materiales tipo PUBG Mobile (envía fotos de referencia).
- **Hecho:** chaleco porta-placas con portacargadores, camuflaje por apariencia, MOLLE, más contraste y postura de
  combate (detalle en el changelog › N7-2). Sigue cabiendo en las cajas en los 3 LOD.
- **Límite que conviene que sepa el propietario:** con las cajas actuales del servidor el cuerpo no puede inclinarse
  mucho más hacia delante (la cabeza saldría de su esfera); una postura «PUBG» más baja exigiría ajustar las cajas.
- **Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 20-10-2026 — Personaje 3D (revisión 03) tras `?pj=2`
- **Contexto:** el propietario rechazó la rev. 01 de Codex («parecen muñecos») y Codex se quedó sin uso dos veces;
  el trabajo pasó a Claude (sesión lanzada desde la principal).
- **Hecho:** personaje rehecho por código (MakeHuman CC0 masculino + ropa con pliegues + equipo + texturas 2048 con
  suciedad/desgaste + 29 clips con IK) e integrado solo en cliente tras `?pj=2`: bots del duelo (gris), campo de tiro
  (arena) y rival online (oliva). Detalle y medidas: `docs/next-level/NEXT_LEVEL_CHANGELOG.md` › N7-1 y
  `assets/3d/imports/2026-10-19_personaje/revision_03/PERSONAJE_REV03.md`.
- **Decisión técnica (Claude):** la altura de agachado y deslizamiento se hace con dos *morph targets* que comprimen
  tronco y piernas como las cajas del servidor (no se escala el modelo por fuera ni los huesos; brazos y cabeza no se
  deforman). Unas cuclillas anatómicas no caben en la caja de piernas (22 cm de fondo): cambiarlo sería tocar las
  zonas de impacto → decisión del propietario.
- **Decisión técnica (Claude):** el arma cuelga de un nodo `arma` (hijo de la clavícula derecha) en vez de la mano,
  para que el cerrojo y la recarga muevan la mano sin mover el rifle. Las rev. 01/02 se conservan (no se borran).
- **Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR (WebGL por software) · PENDIENTE DE VALIDACIÓN EN IPHONE. No
  probado en un 1v1 online real entre dos dispositivos (el rival usa el mismo código que los bots; probado con
  `RemotePlayer` en el navegador). Por defecto sigue el soldado de cajas.

## 19-10-2026 — Rayas, CASA XL v2, nuevas reglas de trabajo y planes de futuro
- **Arreglado y publicado:** ratón pillado y menú de PC (PR #2), rayas de las paredes lejanas (PR #3; el propietario confirma
  que han desaparecido), CASA ATLAS XL v2 por defecto (directo a `main`). Pages y «Prueba pública online» en verde en cada
  publicación.
- **Valoración del propietario:** el juego va a 60 FPS estables en PC (GTX 1050 Ti) y «bastante bien» en el móvil; todos
  los mapas funcionan; el movimiento de la mira al apuntar y disparar está consolidado en PC e iPhone. CASA XL le gusta
  por su tamaño, pero hay que mejorar mucho más los gráficos, poco a poco.
- **Decisión (propietario):** Claude prueba y publica sin pedir OK (push directo o PR fusionada con `gh`) y avisa después;
  sigue haciendo falta aprobación para balance, reglas competitivas del servidor y gastos. Anotado en `CLAUDE.md`.
- **Decisión (propietario):** siguiente prioridad = personaje del jugador y bots (encargo a ChatGPT entregado).
- **Decisión (propietario):** no se borran originales ni versiones antiguas; las calidades gráficas se harán por etapas
  (lo hecho → BAJO; mejoras → MEDIO; más mejoras → ALTO), empezando por BAJO = PUEBLO 2.0.
- **Objetivo futuro (propietario):** multiplataforma (web, .exe, iPhone, Android) y monetización.
- **Lección:** en el navegador integrado, el juego capturaba el ratón real del propietario al lanzar partidas de prueba;
  Claude desactiva la captura antes de probar allí.

## 19-10-2026 — NEXT LEVEL: primer paquete publicado (PR #1)
- **Publicado** (`4517b82`, fusión hecha por Claude con `gh` por orden del propietario): CASA ATLAS XL solo contra bots,
  todos los mapas en el menú, arreglos online (eventos tras reinicio) y de bots de CASA, rendimiento (sin tirón inicial,
  −13 MB de texturas, HUD táctil, sombras de soldados), audio, banderas de diagnóstico de rayas y `?feel=2`.
- **Comprobado:** Pages, «Desplegar servidor» y «Prueba pública online» en verde; `version.json` publicado = local
  (`e9a6f2b13e`); `/health` ok; el GLB de XL se sirve. `npm test` 955/955 antes de fusionar.

## 18-10-2026 — Auditoría con cuatro agentes (sesión 1, tercera parte)
- **Petición (propietario):** cuatro auditorías en paralelo de solo lectura; el agente principal coordina; nada de
  despliegues ni balance sin aprobación; implementaciones paralelas solo en worktrees aislados.
- **Hecho:** `SNIPER_DUEL_AUDIT_2026-10-18.md`. Verificados por el coordinador: fallo de eventos online tras reinicio de
  sala, red de CASA partida (1 861/13/1 nodos), texturas duplicadas, `wScene` sin precompilar, capas de pared a 3–6 mm,
  fundido de sombra con normal perturbada, zonas de impacto offline distintas.
- **Decisión de método:** `src/page.html` lo tocan casi todos los arreglos → cambios del cliente en serie; solo red y CI
  en paralelo.

## 18-10-2026 — Libertad tecnológica: auditoría e informe (sesión 1, segunda parte)
- **Decisión (propietario):** se autoriza proponer otros lenguajes y herramientas si se demuestra la mejora; nada de
  migrar antes de revisar el informe. Reglas copiadas en `CLAUDE.md` › «Decisiones técnicas».
- **Hecho:** `SNIPER_DUEL_TECHNOLOGY_EVOLUTION.md`. Medidas: tick de jugador 4,4–4,9 µs (PUEBLO) en Node; fotograma en
  la GTX 1050 Ti real ~3 ms de CPU, ~2 ms de ellos en `renderer.render` (131–217 llamadas); ~183 MB estimados de
  texturas en GPU en PUEBLO 3.0 ALTO; descarga 13,5 MB.
- **Recomendación:** T0 (higiene) y T1 (comprobación de tipos con `tsc --noEmit`) primero; T3 (texturas KTX2) como
  experimento que necesita el iPhone y el Samsung del propietario. Rust/WASM no está justificado hoy.

## 18-10-2026 — Migración a Claude Code (sesión 1)
- **Hecho:** incorporación completa; informe en `SNIPER_DUEL_ONBOARDING_2026-10-18.md`.
- **Cambio en el repositorio:** `build.py` lee y escribe en UTF-8 (antes fallaba en Windows). Mismo hash de compilación
  (`0816092dae`). IMPLEMENTADO · `npm test` 936/936.
- **Cambios solo en el PC (fuera del repositorio):** `python3.exe` junto a Python 3.14; `playwright@1.56.0` + Chromium y
  `ws` con `npm install --no-save`.
- **Documentación:** conectores reales de Claude Code anotados en `SNIPER_DUEL_CONNECTIONS.md`; `CLAUDE.md` con notas de
  Windows y la obligación de mantener este registro.
- **Comprobado:** documentación y código coinciden (armas, reglas, mapas, banderas); `core/mapdata.js` se regenera
  idéntico; Pages y servidor público responden; Actions en verde.
