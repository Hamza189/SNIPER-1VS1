# SNIPER DUEL — registro de decisiones, cambios y tareas

Registro duradero que mantiene Claude Code. Una entrada por sesión o por decisión, la más reciente arriba.
Cada entrada dice qué se decidió o cambió, quién lo decidió, y el estado real
(IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE).
Las decisiones anteriores al 18-10-2026 están resumidas en `SNIPER_DUEL_MASTER_CONTEXT.md` §4.
Detalle de cada cambio (antes/después, medidas, cómo revertir): `docs/next-level/NEXT_LEVEL_CHANGELOG.md`.

## Tareas (resumen vivo, actualizado el 28-10-2026)

### Siguiente prioridad
| Tarea | Quién la desbloquea | Estado |
|---|---|---|
| **Cuentas** — probar en el iPhone: PERFIL › CREAR CUENTA (Face ID), ENTRAR en otro dispositivo, amigos e invitación (ya sin bandera) | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Cajas y objetos** — probar en el iPhone (ya sin bandera): menú › CAJAS (abrir, caja diaria, equipar camuflaje, mira y título), y una partida online de más de 1 min con cuenta los dos | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Balas del servidor a 600 m/s** (arreglado el 28-10, antes volaban a la mitad) — probar online entre dos dispositivos que los disparos a un rival que corre cuentan como se ven | Propietario | PUBLICADO · PENDIENTE DE PROBAR ONLINE |
| **Reloj, ajustes de sala y minimapa** — VALIDADO EN PC por el propietario (28-10: «el tiempo funciona bien, el mapa también, el contador también, los personajes cargan bien»; partida contra bots con +25 puntos de caja). Falta el iPhone y el informe de MEDIR RENDIMIENTO (mejor también con TODOS CONTRA TODOS y 5 bots, con el contador de FPS) | Propietario | VALIDADO EN PC · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Salas personalizadas** — probar con amigos: MULTIJUGADOR › Modo TODOS CONTRA TODOS (con bots) y EQUIPOS (2 contra 2 / 3 contra 3, los bots rellenan); medir en el iPhone con 5 rivales a la vista | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Monetización** — decidir los puntos 2, 3 y 5 de `docs/CUENTAS-Y-MONETIZACION.md` §5 (portal web, pagos, consulta de ingresos); el 4 (cajas gratuitas) ya está | Propietario | NECESITA APROBACIÓN |
| **Probar 3ª persona (tecla V / AJUSTES; permitida online) y el quickscope**; decidir si el agua de `?pulido=1` pasa a ser la de siempre | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Elegir personaje** (5 con el SOLDADO de `?pj=2`) — ya sale sin bandera: menú › Tu personaje; probar online con otro dispositivo que el rival ve el elegido | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN ONLINE |
| **Los 4 personajes a la vez contra bots** — `https://hamza189.github.io/SNIPER-1VS1/?pj=mix` (y medir con `&medir=1`) en iPhone y PC | Propietario | PUBLICADO TRAS BANDERA · PENDIENTE DE MEDIR EN IPHONE |
| **Medir el rendimiento en el iPhone** — AJUSTES › GRÁFICOS › MEDIR RENDIMIENTO (o `?medir=1`), mandar el informe a Claude; idealmente en BAJO, MEDIO y ALTO (`docs/RENDIMIENTO-IPHONE.md`) | Propietario | LISTO PARA MEDIR |
| **Personaje LINCE (rev. 04)** — compararlo con la rev. 03 en `?pj=3` frente a `?pj=2` | Propietario | PUBLICADO TRAS BANDERA · PENDIENTE DE VALIDACIÓN EN IPHONE |
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
| Riggear el «Modern Tactical Soldier» (CC BY, sin esqueleto) como 5º personaje; aspectos de arma y camuflajes también en la 3ª persona y para el rival online (el servidor los leería de la cuenta, como el título) | PENDIENTE |
| Contorno y sombras de los personajes; ojos algo rojizos del MILITAR (textura original); LINCE y rev. 03 con el paso lateral nuevo; botón de vista en el HUD táctil | PENDIENTE |
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
| Personajes realistas + elegir personaje (con el SOLDADO de `?pj=2`) y HUD 2 por defecto (aprobado en iPhone y PC) | 28-10 · directo a `main` |

## 28-10-2026 (noche, 3) — Personajes realistas, elegir personaje y HUD 2 por defecto
Decisión del propietario: «Lo de personaje realista y HUD NUEVO funcionan bien, tanto en iPhone como en PC, publícalo a
main», sin olvidar que con `?pj=2` no se podía elegir personaje.
- Sin bandera el juego es ahora `?pj=pro` + `?hud=2`: personajes realistas, ventana «Tu personaje» (menú y sala), aspectos
  de arma y PERFIL (con la cuenta en la nube). Lo de antes sigue: `?pj=0` (soldado de cajas, sin elegir) y `?hud=1` (HUD
  anterior). `?pj=2`, `?pj=3` y `?pj=mix` siguen igual.
- 5º personaje para elegir: **SOLDADO** = el de `?pj=2` que probó el propietario (es el que sale si aún no has elegido).
  `core/protocol.js` acepta `soldado` (solo aspecto: zonas de impacto, daño y reglas iguales); retrato con
  `ONLY=soldado node tools/skin-portraits.js`.
- En BAJO, como antes con `?pj=pro`: tu elección la ve el rival, pero en tu pantalla se ven los soldados de cajas.
- Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE (servidor local) · el propietario ya lo validó en iPhone y PC
  con las banderas.

## 28-10-2026 (noche, 5) — Salas personalizadas: todos contra todos y equipos mixtos con bots del servidor (fases 2 y 3)
Decisión del propietario: «Tienes que hacer lo de Todos contra todos y Equipos mixtos».
- Salas de hasta 6 plazas entre personas y bots del servidor (`core/bots.js`, mismas reglas que las personas; solo
  deciden adónde andar, a quién mirar y cuándo disparar).
- Modos: 1 contra 1 (igual que antes), todos contra todos (0–5 bots) y equipos ROJO/AZUL 2v2 o 3v3 (los bots
  rellenan, sin fuego amigo). La bala da al primer cuerpo que encuentra.
- Página: lobby con modo, bots, dificultad, tamaño y equipo; rivales por plaza; marcador TÚ/LÍDER o ROJO/AZUL; marca
  azul y minimapa para los compañeros.
- Premios: los equipos y una cuenta sola contra bots del servidor (puntos de bots, con tope); las partidas que acaban
  por tiempo ahora también dan puntos.
- Pruebas: `room` 155 (+21; las 134 de antes intactas), `accounts` 49, `salas.browser` 12 (nueva). Detalle:
  `docs/SALAS-PERSONALIZADAS.md`.
- IMPLEMENTADO · PROBADO EN NAVEGADOR (servidor local) · PENDIENTE DE VALIDACIÓN EN IPHONE Y CON AMIGOS.

## 28-10-2026 (noche, 4) — Regeneración online, reloj de partida, ajustes de sala y minimapa (fase 1)
Decisiones del propietario:
- «Sí, corrígelo» (regeneración online).
- «Añade tiempo, un contador que empiece desde 10 minutos», «ajuste de modo sala personalizada para poner bots y amigos»
  y «un mapa en el lateral para ver el mapa, los obstáculos y los enemigos cuando disparan».
- Para la sala: «todos contra todos y equipos mixtos».
Lo hecho:
- Regeneración online a 22 de vida/s (antes 6–11, mismo fallo de reloj que las balas).
- Reloj de partida: 10 min por defecto. Contra bots se elige en el menú; online, quien crea la sala elige bajas
  (5/10/20/30) y tiempo (5/10/15/20 o sin límite). Al acabarse el tiempo gana quien tiene más bajas; si van iguales,
  empate.
- Minimapa girado con la vista: obstáculos del mapa y enemigos solo cuando disparan (3 s). Arriba a la izquierda en PC
  y a la derecha en el móvil; se quita en AJUSTES.
- Pruebas: `room` (+12), `reloj.browser` (14, nueva). Detalle y plan de las fases 2 (todos contra todos con bots del
  servidor) y 3 (equipos mixtos): `docs/SALAS-PERSONALIZADAS.md`.
- IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 28-10-2026 (noche, 3) — Las balas del servidor ya vuelan a 600 m/s
Decisión del propietario: «Sí, arréglalo» (velocidad de las balas del servidor).
- `core/room.js`: las balas avanzan según el tiempo real entre ticks, en pasos de 1/120 s con el sobrante guardado.
  - Antes avanzaban según el tiempo desde el último mensaje: 284–379 m/s.
  - Ahora 599 m/s.
  - Rival andando de lado a 33 m: el servidor cuenta 12/12 disparos bien apuntados (antes 9/12); con ping alto, 10/12
    (antes 6–8/12).
  - Nada más cambia: daño, caída, zonas de impacto y compensación de latencia son los mismos.
  - Detalle: `docs/next-level/NEXT_LEVEL_CHANGELOG.md` N3-3.
- Visto y no tocado: la regeneración de vida online tiene el mismo fallo (6–11 de vida/s en vez de 22). Pendiente de su
  aprobación porque cambia el equilibrio.
- IMPLEMENTADO · PROBADO EN NAVEGADOR (simulación y pruebas online locales) · PENDIENTE DE PROBAR ONLINE ENTRE DOS
  DISPOSITIVOS.

## 28-10-2026 (noche, 2) — Inventario en el servidor y cajas gratuitas (paso D)
Decisión del propietario: «Inventario y cajas» (seguir con el paso D y las cajas gratuitas que se ganan jugando). Es la
parte gratuita de la decisión 4 del plan de monetización; nada de pago.
- Lo que tienes lo guarda y lo concede el servidor (ficha de la cuenta). Cajas: bienvenida, una al día y puntos por
  partidas (online los cuenta el servidor de la sala al terminar: dos cuentas distintas y más de 1 min jugado; contra bots
  los cuenta el navegador, con tope de una caja al día). Probabilidades a la vista (55/30/12/3 %), nunca repite.
- 33 objetos solo de aspecto (`core/items.js`): 16 camuflajes del rifle de 1ª persona (también sobre los aspectos de
  arma), 7 colores del punto de la mira (mismo tamaño: no ayuda a apuntar) y 10 títulos que el rival ve en la sala (los lee
  el servidor de la cuenta). Lo que ya era de todos sigue siéndolo.
- Sala (`core/room.js`): mensaje opcional `acct`, `opts.account` y `opts.onOver`; las reglas de la partida no cambian. El
  tiempo jugado se mide entre ticks (sin pausas).
- Encontrado al medirlo: la sala avanza las balas según el tiempo desde el último mensaje recibido, no desde el último tick;
  con el tráfico normal de una partida vuelan a ~284 m/s en vez de 600 (simulación, `test/simnet.js`). No se ha tocado:
  es balística autoritativa (regla 3); propuesto como tarea aparte.
- Pruebas: `test/accounts.test.js` (44), `test/room.test.js` (120), `test/cajas.browser.test.js` (15, nueva, en `npm test`).
  Hojas de camuflajes dibujadas por el juego: `docs/img/camuflajes*.jpg` (`tools/camo-sheet.js`).
  IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 28-10-2026 (noche) — Cuentas en la nube con passkey, amigos e invitaciones
Decisión del propietario: «Sí, cuentas» (passkeys en el mismo Cloudflare, plan gratuito, como proponía el plan).
- `server/accounts.js` (compartido por el Worker y el servidor Node): crear y entrar con passkey (WebAuthn), sesiones,
  nombre, amigos (pedir, aceptar, rechazar, quitar) e invitación a sala. Cloudflare: Durable Objects `AccountDO` (uno por
  cuenta) y `DirDO` (retos de entrada), migración v2 en `wrangler.toml`. Sin servicios nuevos ni gastos.
- Cliente: PERFIL › Cuenta en la nube (con `?pj=pro`). Jugar sigue sin pedir cuenta.
- Pruebas: `test/accounts.test.js` (también antes de cada despliegue), `test/cuentas.browser.test.js` (llave virtual; pasa
  contra el servidor Node y contra el motor real de Cloudflare con `wrangler dev`), y `test/public.test.js` comprueba las
  cuentas en el servidor público tras desplegar. IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.
- Siguiente: inventario en el servidor (paso D), «en línea» de los amigos, y el personaje y las armas elegidas enviados al
  rival desde la cuenta.

## 28-10-2026 (tarde) — Botón de vista en el móvil y armas de la carpeta SNIPER DUEL ASSETSS
- **Botón 3ª / 1ª** en la pantalla táctil (encima de INSP, editable). IMPLEMENTADO · PROBADO EN NAVEGADOR (táctil).
- **Carpeta de assets** (12 modelos): 5 con CC BY entran como **aspectos** (rifles TITÁN, ÚLTIMA, VECTOR, SAHARA y cuchillo
  TÁCTICA) con conversor nuevo `tools/arma-ext` y retratos; se eligen en «Tu personaje» con `?pj=pro`. Solo aspecto.
  Los 6 con licencia Sketchfab **Standard** (Beretta ×5, Remington XM2010) **no** se pueden usar en un juego web (prohíbe que
  se puedan descargar o extraer). El «Modern Tactical Soldier» (CC BY) viene **sin esqueleto**: pendiente de riggear.
  Aviso: la textura del SAHARA lleva el logotipo CADEX. Detalle en `docs/ARMAS-EXT.md`. IMPLEMENTADO · PROBADO EN NAVEGADOR.
- Próximo (propietario): cuentas.

## 28-10-2026 — Personajes pulidos, quickscope, 3ª persona y agua (vídeo del propietario)
Petición: personajes sin transparencias de lado y pulidos, ver en 3ª persona, mejorar el quickscope en PC y móvil y
retocar el mapa. Sobre cobrar a nombre de su hermano: decisión suya (que lo confirme un gestor).
- **Personajes** (S.W.A.T., FSB, MILITAR): sin agujeros en la cabeza, materiales de dos caras, ojos del FSB con iris,
  LOD ajustados a sus cajas; zonas de impacto bien en los 3 LOD. Herramienta `tools/skin-turntable.js`. Detalle en
  `docs/PERSONAJES-PRO.md`. IMPLEMENTADO · PROBADO EN NAVEGADOR.
- **Quickscope** (`core/weapon.js`, servidor): con la mira subiendo el disparo espera a la mira (≤ 0,17 s) y sale exacto;
  igual para todos. No cambia daño, cadencia, munición ni balística. `docs/VISTA-Y-QUICKSCOPE.md`. IMPLEMENTADO ·
  PROBADO (núcleo, sala) · PENDIENTE DE VALIDACIÓN EN IPHONE.
- **3ª persona**: AJUSTES › CONTROLES › Vista o tecla V; con la mira vuelve a 1ª. Solo visual. IMPLEMENTADO · PROBADO EN
  NAVEGADOR. **Decisión del propietario: también en las partidas online** (cada jugador elige su vista).
- **Agua** de las fuentes tras `?pulido=1` (cambio sutil, para comparar). IMPLEMENTADO · PROBADO EN NAVEGADOR.

## 27-10-2026 (noche) — Elegir personaje, paso más natural y plan de cuentas y monetización
Petición del propietario: el paso «parece un poco falso», las texturas tardan en cargar, elegir uno de los personajes
antes de la partida, cuentas (local o nube, opcionales: obligatorias solo para skins, armas y cajas) y empezar a ver
cómo monetizar.
- **Elegir personaje** (`?pj=pro` / `?pj=mix`): botón con retrato en el menú y en la sala; el rival online lo ve
  (mensaje `skin` de lista cerrada en `core/protocol.js`; el servidor solo lo reenvía). Retratos dibujados por el motor
  (`tools/skin-portraits.js`). IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE (servidor local, dos navegadores).
- **Texturas**: sin negro mientras llega el color; subida a la GPU al llegar; precarga del rival en la sala y de los 4 en
  `?pj=mix`. IMPLEMENTADO · PROBADO EN NAVEGADOR.
- **Paso**: medido con `tools/gait-sheet.js`; cadencia según la velocidad, piernas hacia la marcha con el pecho al
  frente y paso lateral nuevo en S.W.A.T., FSB y MILITAR (zonas de impacto comprobadas en los 3 LOD). Detalle y cifras en
  `docs/PERSONAJES-PRO.md`. IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.
- **Perfil local** (paso A de las cuentas): botón PERFIL (apodo, personaje, estadísticas de cada partida, código para
  pasarlo a otro dispositivo). Sin servicios nuevos. IMPLEMENTADO · PROBADO EN NAVEGADOR.
- **Cuentas y monetización**: plan con decisiones en `docs/CUENTAS-Y-MONETIZACION.md` (passkeys en el mismo Cloudflare,
  cajas gratuitas ganadas jugando, portales web con anuncios entre partidas, aviso sobre ingresos estando de baja).
  NECESITA APROBACIÓN: nada de la nube ni de pagos se ha creado.
- Toca `core/` (mensaje `skin`): se despliega el servidor. Las reglas, armas y zonas de impacto no cambian.

## 27-10-2026 (tarde) — `?pj=mix`: los 4 personajes a la vez contra bots
- **Petición (propietario):** antes de mejorar la cara (ojos blancos), el contorno y las sombras, ver los 3 personajes
  nuevos y el muñeco de siempre en la misma partida contra bots para probar y medir el rendimiento en el iPhone y el PC.
  Prioridad siguiente del propietario: empezar a ver cómo monetizar el juego.
- **Hecho:** `?pj=mix` (4 bots: S.W.A.T., FSB, Military suit y soldado de cajas; texturas 4K/2K/1K según la calidad).
- **Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE MEDIR EN IPHONE.

## 27-10-2026 — Personajes realistas CC BY por calidad (`?pj=pro`) y conversor de personajes
- **Petición (propietario):** implantar el Tactical Soldier 02 (TurboSquid) modificado. **No se hizo:** su licencia
  (estándar de TurboSquid) prohíbe usarlo en juegos web en formatos abiertos y que el jugador pueda obtener el modelo;
  modificarlo no lo cambia. Claude lo explicó y propuso modelos CC BY de Sketchfab.
- **Decisión (propietario):** nº 4 «Military tactical suit» (DanlyVostok) para MEDIO; nº 2 «S.W.A.T. Operator Remaster» y
  nº 3 «FSB Operator» (Mateusz Woliński) como principales en ALTO con 4K; BAJO con los muñecos de siempre. Los descargó
  él (Sketchfab pide cuenta).
- **Hecho:** `tools/personaje-ext` (lector glTF propio, conversor, atlas y comprobaciones; reutiliza el generador de
  animaciones de la rev. 04) y `?pj=pro`. Los tres pasan el contrato GLB y las zonas de impacto en los 3 LOD sin tocar el
  servidor. Créditos CC BY en AJUSTES, `LICENSE` y `CREDITOS.md`. Detalle: `docs/PERSONAJES-PRO.md`.
- **Aviso:** ALTO con dos personajes 4K usa ~500 MB de texturas en la GPU; en el iPhone, AUTO usa MEDIO.
- **Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

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
