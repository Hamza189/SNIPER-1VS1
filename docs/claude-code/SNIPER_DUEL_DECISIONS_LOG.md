# SNIPER DUEL — registro de decisiones, cambios y tareas

Registro duradero que mantiene Claude Code. Una entrada por sesión o por decisión, la más reciente arriba.
Cada entrada dice qué se decidió o cambió, quién lo decidió, y el estado real
(IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE).
Las decisiones anteriores al 18-10-2026 están resumidas en `SNIPER_DUEL_MASTER_CONTEXT.md` §4.
Detalle de cada cambio (antes/después, medidas, cómo revertir): `docs/next-level/NEXT_LEVEL_CHANGELOG.md`.

## Tareas (resumen vivo, actualizado el 04-11-2026)

### Siguiente prioridad
| Tarea | Quién la desbloquea | Estado |
|---|---|---|
| **RIFLES DISTINTOS** (09-11) — probar contra bots los 5 rifles (TITÁN pesado, VECTOR rápido…) y comparar con `?balance=0`; decir si se llevan al online | Propietario | PUBLICADO SOLO SIN CONEXIÓN · PENDIENTE DE SU PRUEBA |
| **ARSENAL (GUNSMITH)** (08-11) — probar ARMAS en el iPhone: el rifle grande, girar y acercar, elegir modelo y mira (fotos de cada modelo), GUARDAR y RESTABLECER, ESTADÍSTICAS y DAÑO; decir si el silenciador puede cambiar el sonido (G3) y si apruebas el diseño de BALA DURA (`docs/GUNSMITH.md`) | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE · NECESITA DECISIÓN |
| **Camuflajes de foto** (05-11) — en CAJAS Y OBJETOS (con la cuenta ADMIN están todos): probar ALUMINIO, los tres CARBONOS y los dos OROS en el iPhone | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **BARRIO** (04-11) — probar `https://hamza189.github.io/SNIPER-1VS1/?barrio=1` (menú › BARRIO) en el iPhone, contra bots y online: FPS, aspecto de los garajes y las torres, rutas | Propietario | PUBLICADO TRAS BANDERA · PENDIENTE DE APROBACIÓN |
| **CASA ATLAS 2.0 · JARDÍN** (04-11) — probar `https://hamza189.github.io/SNIPER-1VS1/?casa2v=3` y compararlo con `?casa2v=2`: elegir el diseño que se queda | Propietario | PUBLICADO TRAS BANDERA · PENDIENTE DE APROBACIÓN |
| **CASA ATLAS 2.0 · diseño 2** (04-11) — probar `https://hamza189.github.io/SNIPER-1VS1/?casa2v=2` (menú › CASA ATLAS 2.0 · NUEVA) en el iPhone, contra bots y online; si le gusta, pasa a ser la CASA ATLAS 2.0 de todos y se retira el diseño 1 | Propietario | PUBLICADO TRAS BANDERA · PENDIENTE DE APROBACIÓN |
| **Cuenta admin** (04-11) — mirar en el perfil que pone ADMIN y que en CAJAS Y OBJETOS se pueden equipar los 33 objetos | Propietario | DESPLEGADO · PENDIENTE DE VALIDACIÓN |
| **Entrar con Google** (04-11, activado) — en PERFIL de tu cuenta ADMIN: «Continuar con Google» para vincularla; en otro dispositivo, «Iniciar sesión con Google». Mientras la app de Google esté «En prueba» solo entran los usuarios de prueba; para abrirla a todos, «Información de la marca» + «Publicar app» (`docs/CUENTAS-Y-MONETIZACION.md`) | Propietario | PUBLICADO · BOTÓN REAL COMPROBADO EN LA WEB · PENDIENTE DE SU PRIMERA ENTRADA |
| **Parpadeo y menú** (31-10) — mirar en el iPhone que las fachadas lejanas ya no parpadean y que AJUSTES sale más pequeño; mandar MEDIR RENDIMIENTO para ver lo que cuesta el suavizado de bordes (se puede apagar en GRÁFICOS) (`docs/PARPADEO.md`) | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Game feel 3.0** — probar en el iPhone el movimiento TÁCTICO (ya es el del servidor), las animaciones nuevas (GF-2: esprint, salto, disparo, impacto y muerte sin saltos) y el CONTORNO rojo/azul; mandar MEDIR RENDIMIENTO con la línea «CPU por partes» (`docs/GAMEFEEL.md`) | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Cuentas** — probar en el iPhone: PERFIL › CREAR CUENTA (Face ID), ENTRAR en otro dispositivo, amigos e invitación (ya sin bandera) | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Cajas y objetos** — probar en el iPhone (ya sin bandera): menú › CAJAS (abrir, caja diaria, equipar camuflaje, mira y título), y una partida online de más de 1 min con cuenta los dos | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Balas del servidor a 600 m/s** (arreglado el 28-10, antes volaban a la mitad) — probar online entre dos dispositivos que los disparos a un rival que corre cuentan como se ven | Propietario | PUBLICADO · PENDIENTE DE PROBAR ONLINE |
| **Reloj, ajustes de sala y minimapa** — VALIDADO EN PC por el propietario (28-10: «el tiempo funciona bien, el mapa también, el contador también, los personajes cargan bien»; partida contra bots con +25 puntos de caja). Falta el iPhone y el informe de MEDIR RENDIMIENTO (mejor también con TODOS CONTRA TODOS y 5 bots, con el contador de FPS) | Propietario | VALIDADO EN PC · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Salas personalizadas** — probar con amigos: MULTIJUGADOR › Modo TODOS CONTRA TODOS (con bots) y EQUIPOS (2 contra 2 / 3 contra 3, los bots rellenan); medir en el iPhone con 5 rivales a la vista | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Monetización** — decidir los puntos 2, 3 y 5 de `docs/CUENTAS-Y-MONETIZACION.md` §5 (portal web, pagos, consulta de ingresos); el 4 (cajas gratuitas) ya está | Propietario | NECESITA APROBACIÓN |
| **Probar 3ª persona (tecla V / AJUSTES; permitida online) y el quickscope**; decidir si el agua de `?pulido=1` pasa a ser la de siempre | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Elegir personaje** (5 con el SOLDADO de `?pj=2`) — ya sale sin bandera: menú › Tu personaje; probar online con otro dispositivo que el rival ve el elegido | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN ONLINE |
| **Los 4 personajes a la vez contra bots** — `https://hamza189.github.io/SNIPER-1VS1/?pj=mix` (y medir con `&medir=1`) en iPhone y PC | Propietario | PUBLICADO TRAS BANDERA · PENDIENTE DE MEDIR EN IPHONE |
| **Personajes con texturas comprimidas (KTX2)** — por defecto en PC y, desde el 29-10 por la noche, también en el móvil (el propietario: «he probado el link con KTX2 con las texturas en 4K en Safari y ahora funciona»). Falta abrir varias veces el enlace normal en Safari y un informe de MEDIR RENDIMIENTO (`docs/KTX2.md`) | Propietario | POR DEFECTO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Safari: la barra tapa la pantalla y deforma la imagen** — la imagen ya sigue al tamaño real de la pantalla; para quitar la barra, instalar el juego: Compartir › «Añadir a pantalla de inicio» (sale un aviso en el menú del iPhone) | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Aspectos de arma en KTX2, a su resolución máxima** (29-10) — ÚLTIMA y VECTOR a 4K con la misma memoria que antes; SAHARA ~384 → ~96 MB; TITÁN ~192 → ~96 MB; TÁCTICA a 2K. Probar en Safari eligiendo ÚLTIMA (la descarga más grande, 139,0 MB, la primera vez) y repetir MEDIR RENDIMIENTO (`docs/ARMAS-EXT.md`) | Propietario | PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Archivos grandes a Cloudflare R2** — HECHO el 30-10: las texturas KTX2 (76 archivos, ~400 MB) salen de R2 por el Worker `sniper-duel-assets` y ya no están en el repositorio. Texturas nuevas: `node tools/r2-subir.js` (`docs/R2.md`). Falta comprobarlo en el iPhone | Propietario | HECHO · PENDIENTE DE VALIDACIÓN EN IPHONE |
| **Rendimiento en el iPhone** — MEDIDO en ALTO el 28-10: 60 FPS clavados en ARENA, PUEBLO y CASA XL (CPU ~3 ms/fotograma), pero ~800 MB de texturas por los personajes de 4K, corregido en `ead572a`. Falta repetir la medida en Safari para confirmar ~290 MB y probar una sala con 5 bots (`docs/RENDIMIENTO-IPHONE.md`) | Propietario | MEDIDO · PENDIENTE DE CONFIRMAR LA MEMORIA |
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

## 09-11-2026 — GUNSMITH: los 5 rifles con sus cifras contra bots (en línea sigue el HALCÓN)
Del propietario (08-11):
- «Apruebo provisionalmente la tabla de los cinco francotiradores… para pruebas experimentales»;
- «el VECTOR debería sentirse rápido, el TITÁN pesado y potente, y el HALCÓN equilibrado»;
- «No actives el nuevo balance ni BALA DURA en el multijugador público hasta que yo lo pruebe»;
- silenciador con un precio pequeño (bala un 8 % más lenta);
- BALA DURA como pasiva de cualquier rifle, solo para una pared media.

Hecho (detalle y tabla en `docs/GUNSMITH.md`):
- TITÁN, ÚLTIMA, VECTOR y SAHARA con sus cifras en `core/config.js`; el HALCÓN no cambia.
- Contra bots y en el campo de tiro cuentan las del modelo, al aparecer. En línea, el HALCÓN para todos.
- La velocidad al andar depende del rifle (`speedMul(L, rc)`); el servidor no cambia.
- El ARSENAL enseña las cifras del modelo, su diferencia con el HALCÓN y «EN LÍNEA: HALCÓN R7».
- `?balance=0`: las cifras de antes para comparar.
- **Pruebas:** rifles.browser 27/27 (medidas con el reloj del juego), gunstats 20/20, online.browser 48/48, arsenal.browser
  24/24 y core, room, pistol y shotgun sin cambios.
- **Estado:** PROBADO EN NAVEGADOR (PC con GPU) · PENDIENTE DE QUE EL PROPIETARIO LO PRUEBE CONTRA BOTS (PC, iPhone y Android).
- También el 09-11: el propietario actualizó CLAUDE.md (Android también para probar, regla 14 de C/C++/C# → WebGPU +
  TypeScript + C++/WASM en un mes sin abandonar Three.js, y la línea `Authored-By: Hamza` en los commits).
- **Siguiente:**
  - accesorios con efecto contra bots (silenciador primero);
  - penetración de serie y BALA DURA contra bots.

## 08-11-2026 — GUNSMITH 2.0: G1 (auditoría de skins) y G2 (ARSENAL nuevo); estadísticas de una sola fuente
Del propietario: el encargo «SNIPER DUEL — GUNSMITH 2.0» (fases G1–G8). Prioridades:
- «primero que el rifle, los accesorios y las skins se vean y funcionen perfectamente en el arsenal»;
- «después BALA DURA con pruebas de colisión y autoridad del servidor»;
- «Empieza por G1 y G2»;
- «Utiliza la GPU para las pruebas».

Detalle en `docs/GUNSMITH.md`.
- **G1 (auditoría):** en el PC las 5 skins cargan, pero había cuatro fallos.
  - El camuflaje (uno para todas) tapaba el modelo: la captura del propietario era la ÚLTIMA con REJILLA DE ORO.
  - Las miniaturas de las miras siempre enseñaban el HALCÓN.
  - El peso 4K: ÚLTIMA 139 MB de descarga y 454 MB en la GPU. Pendiente de medir en el iPhone; no se baja sin medirlo.
  - Los rivales y los bots ven siempre el HALCÓN.
- **G2 (ARSENAL), con lo arreglado de G1:**
  - el arma grande en el centro (girar y acercar);
  - los modelos a la izquierda;
  - seis botones (MIRA, CARGADOR, BÍPODE, SILENCIADOR, EMPUÑADURA y CAMUFLAJE) que abren selectores con solo lo que existe;
  - ESTADÍSTICAS y DAÑO reales, y BALA DURA «EN DESARROLLO · NO ACTIVA»;
  - GUARDAR y RESTABLECER, con borrador y mira y camuflaje por modelo;
  - 32 fotos nuevas de cada mira en cada modelo;
  - `?arsenal=0`: el ARMAS de antes.
- **G5:** `core/gunstats.js` es la única cuenta del daño (servidor, juego contra bots y ARSENAL) y la balística del ARSENAL.
  - Sin cambiar ningún número: room 155/155, pistol 15/15, shotgun 27/27.
- **Pruebas:** gunstats 15/15 (con impactos en una sala real del servidor), arsenal.browser 24/24, menu2 34/34, miras 55/55,
  armas 29/29 y cajas 15/15.
- **Estado:** PROBADO EN NAVEGADOR (PC con GPU y móvil en horizontal) · PENDIENTE DE VALIDACIÓN EN IPHONE.
- **Necesita al propietario:**
  - G3: si el silenciador puede cambiar el sonido y el fogonazo (cambia el juego);
  - G6/G7: aprobar el diseño de BALA DURA de `docs/GUNSMITH.md` antes de programarla.

## 05-11-2026 — Material del 05-11: texturas para BARRIO y 6 camuflajes nuevos
Del propietario: la carpeta `COSAS DEL JUEGO/MATERIAL 05 11`, con 12 texturas PBR en 4K de free-3dtextureshd.com. Son
libres en juegos y no piden crédito.
- **BARRIO:** ladrillo, bloques de hormigón y losas escaneados en lugar de los lisos. Sus normales eran DirectX y se
  convirtieron.
- **Cajas:** 6 camuflajes de foto (ALUMINIO, CARBONO ROJO, CARBONO AZUL, PANAL DE CARBONO, ORO PULIDO, REJILLA DE ORO).
  Con un tipo nuevo `pat: 'img'` en `client/camo.js`. Hay 39 objetos; la cuenta ADMIN los tiene todos.
- **Pruebas:** accounts 64, room 155, core 74, cajas 15, barrio.browser 8, browser 61 y armas 29, todas en verde.
- **Estado:** PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 04-11-2026 (5) — BARRIO: mapa nuevo con el garaje y las torres
Del propietario, tras ver que la calle abandonada no servía de cerca: «mapa con torres y garaje».
- **BARRIO** (`client/barrio.js`, `docs/BARRIO.md`, `?barrio=1`, mapa `barrio` en el servidor):
  - una calle entre dos filas de edificios, con callejones y un callejón trasero para flanquear;
  - un garaje abandonado en cada fila, abierto a la calle;
  - las torres de pisos ×3,5 de horizonte.
- **Pruebas:** 13/13, 8/8 en navegador y 13/13 online. En el PC, 10,9 ms por fotograma en ALTO (la CASA ATLAS 2.0, 10,2 ms);
  327 mil triángulos y 12,4 MB de descarga.
- **Arreglado durante la prueba online:** la superficie «brick» no tenía efectos de impacto (error al dar a un ladrillo);
  ahora es «plaster».
- **Estado:** PROBADO EN NAVEGADOR · PROBADO ONLINE (servidor local) · PENDIENTE DE APROBACIÓN Y DE VALIDACIÓN EN IPHONE.

## 04-11-2026 (4) — Material del 04-11: triaje, CASA ATLAS JARDÍN integrada y fallo de `9b977c6` corregido
Del propietario: «te he dejado cosas para que añadas, y que implementes a pueblo, o añadas nuevo mapa, o juntes todo», y
después «las dos a la vez» (el jardín y un mapa nuevo con la calle abandonada).
- **Fallo mío, corregido** (`9cc306d`): el commit `9b977c6` compiló `index.html` con un `client/casa2.js` sin guardar de otra
  sesión (un prototipo de Codex). De 12:22 a 13:00, con `?casa2v=2`, la web no coincidía con el servidor. Ahora, antes de
  publicar `index.html`, compruebo que las fuentes coinciden con `main`.
- **Triaje del material:**
  - Sí: el jardín, la calle abandonada, las torres de fondo, el garaje abandonado y los cuadros. Las licencias son Sketchfab
    Standard (uso en juegos) y CC-BY (con créditos).
  - Más adelante: el salón vintage (105 mil triángulos, 46 MB; el estilo choca).
  - No:
    - el AK dorado (700 mil triángulos y un arma nueva toca el equilibrio);
    - «City Game ready» (estilo dibujo animado);
    - la caja dorada (no sirve);
    - «nfs edge mobile garage» y «garage interior from RCD», porque parecen sacados de otros juegos (regla 11).
- **CASA ATLAS 2.0 · JARDÍN** (`casa2c`, `?casa2v=3`): pruebas 12/12, 8/8 en navegador y 13/13 online.
  - Estado: PROBADO EN NAVEGADOR · PROBADO ONLINE (servidor local) · PENDIENTE DE APROBACIÓN.

## 04-11-2026 (3) — Entrar con Google
Del propietario: «Entrar con Google» (elegido entre Google y correo con contraseña).
- **Servidor** (`server/accounts.js`):
  - comprueba el token de Google: firma RS256 con las llaves públicas de Google, ID de cliente, caducidad y nonce (un reto
    nuestro de un solo uso);
  - crea la cuenta o entra en ella; también vincula Google a una cuenta hecha con llave;
  - solo guarda el `sub` de Google.
- **Página:** el botón oficial de Google en PERFIL. Solo se carga si el servidor tiene ID de cliente; si no, todo sigue como
  antes.
- **Pruebas:** accounts 64/64 (13 nuevas de Google); `test/google.browser.test.js` 8/8 (Google simulado). Cuentas y cajas en
  navegador, en verde.
- **Falta:** el ID de cliente, que crea el propietario en Google Cloud (gratis). Estado: IMPLEMENTADO · PROBADO CON GOOGLE
  SIMULADO · SIN ACTIVAR.

## 04-11-2026 (2) — Cuenta admin del propietario y CASA ATLAS 2.0 · diseño 2 (más conectado, texturas y cristal)
Del propietario: «todo va bien, en iPhone carga bastante rápido… en PC 59-60 FPS, en iPhone 60 FPS clavados», y además:
«a mi perfil ponle la cuenta admin; si no pruebo las otras skins, ¿cómo voy a saber si funcionan?»; «mejor registrarse por
correo, lo del Face ID de primeras es un poco raro»; y, con un vídeo: «hay demasiados obstáculos para moverse libremente, el
diseño es muy simple… que estén más conectadas, que no sean literalmente 4 casas en cuatro esquinas; mejora texturas y el
cristal, busca un .glb de cristal».
- **Cuenta admin** (`c58b1d4`, servidor desplegado): `ADMIN_IDS` en `wrangler.toml` con su cuenta (`SD-QTFX-77ZM`). Tiene los
  33 objetos y puede equiparlos; su perfil pone ADMIN. Sin claves en la página: hace falta su passkey. PROBADO EN PRUEBAS
  (accounts 51/51) · desplegado · PENDIENTE DE QUE LO VEA EN SU PERFIL.
- **Registro por correo:** pendiente de su decisión. Mandar correos necesita un servicio externo, y una contraseña sin correo
  no permite recuperarla.
- **CASA ATLAS 2.0 · diseño 2** (`docs/CASA-ATLAS-2.md`, «Diseño 2»):
  - los pisos espalda con espalda: dos casas grandes, unidas por dentro (comedores y cocinas);
  - sin barandillas, bancos, mesa baja ni isla de cocina;
  - el patio, de casa a casa, con 5 coberturas en lugar de 18, un seto en el centro y una pérgola;
  - suelos escaneados de Poly Haven (CC0) y un cristal más claro con reflejo Fresnel.
- **El cristal:** no se buscó un GLB. La geometría ya era buena; el fallo estaba en el material (43 % opaco, lechoso).
- **Cómo está:** como opción, `?casa2v=2`, mapa `casa2b` en el servidor; el diseño 1 sigue igual para todos.
  - Pruebas: casa2v2 33/33, casa2v2.browser 22/22, online --v2 13/13.
  - Estado: PROBADO EN NAVEGADOR · PROBADO ONLINE (servidor local) · PENDIENTE DE SU APROBACIÓN EN IPHONE.

## 04-11-2026 — CASA ATLAS 2.0 y miras validadas en el iPhone
Del propietario, preguntado si había probado en el iPhone la CASA ATLAS 2.0 y las miras de ventana con el botón de MIRA:
«Si todo bien» y «si».
- CASA ATLAS 2.0 (contra bots y online): VALIDADO EN IPHONE. Sale de la tabla de tareas abiertas.
- Miras de ventana (holográfica, 2×, 3×) y botón de MIRA: VALIDADO EN IPHONE. Con lo que dijo el 02-11 («el zoom de las
  miras x4 x6 x8 y x12 es correcto»), las 8 miras quedan validadas.

## 04-11-2026 — CARGA PROGRESIVA en partida (personajes y armas)
Del propietario: «sí» (a llevar al juego la versión 1K del personaje y el modelo ligero del arma mientras llegan las 4K).
Bots, rival online y tú en 3ª persona salen con la 1K en vez del soldado de cajas; tu rifle y tu cuchillo con el modelo
ligero de la skin en vez del HALCÓN o la NAVAJA. Código común (`pj2Attach`, `wskinRifle`, `wskinKnife`); el menú usa lo
mismo. Detalle en `docs/CARGA.md`.

**Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 03-11-2026 (6) — CARGA PROGRESIVA del operador y del arma en el menú
Del propietario: «el personaje sigue quedándose ahí pensando/cargando; quiero que el personaje y el arma carguen rápido».
El operador sale con su versión 1K (JPG) y pasa solo a la completa; el arma enseña su modelo ligero (`arma_tp.glb`)
mientras se descomprime la 4K. Con CPU de móvil: operador 17 → 10,6 s, arma ÚLTIMA 42 → 12,8 s (`docs/CARGA.md`).

**Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR (menu2, pro, pj2, ktx2, armas en verde) · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 03-11-2026 (5) — CARGA: versión por archivo, service worker y arranque sin compilar de golpe
Del propietario: «Los personajes, armas, mapas tardan en cargar, optimiza esto… si hace falta utilizar C, C++ o C# puedes
utilizarlo» (guardado en la memoria del proyecto). Detalle en `docs/CARGA.md`.
- Cada archivo se pide con la huella de su propio contenido (`ASSET_V` de `build.py`, `av()` en los cargadores): tras
  publicar solo se descarga lo que cambió (antes, todo cada vez).
- `sw.js`: los archivos se guardan en el dispositivo y la segunda visita no los vuelve a pedir; `?sw=0` lo quita.
- Una compilación de sombreadores por tanda de cargas, después del primer fotograma del menú; hierba en diferido; el
  MENÚ 2 prepara el mapa una vez. Nada se compila a mitad de partida (se hace al pulsar JUGAR si quedaba algo).
- `tools/carga.js`: perfil de CPU del arranque como un móvil.
- Siguiente: meshoptimizer (C++) para la geometría de personajes y armas, y texturas progresivas.

**Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR (54 de 55 suites; `ajustes.browser` ya fallaba) · PENDIENTE DE VALIDACIÓN
EN IPHONE.

## 03-11-2026 (4) — PUEBLO: qué cuesta, parpadeo y rejas lejanas
Del propietario: «hay que ir optimizando poco a poco el juego todo lo que se pueda… vuelve a hacerlo [lo del parpadeo] y
ve mejorando PUEBLO».
- El PUEBLO no ha engordado desde el 30-10: misma cámara, mismas 210 llamadas y 335 mil triángulos
  (`tools/pueblo-dibujo.js`). La diferencia del iPhone era de la posición y de los bots a la vista.
- Herramientas nuevas con la GPU real del PC: `tools/flicker.js` con `GPU=1` y `tools/gpu-coste.js`. La GTX 1050 Ti es
  demasiado rápida para decir qué le cuesta al iPhone (2,7–3,1 ms en todas las variantes).
- Rejas y barandillas lejanas del kit: se desvanecen entre 40 y 60 m de distancia aparente (vuelven con el visor).
  Parpadeo en la plaza 1,91 → 1,86, peores píxeles 50 → 44. Poco, pero sin coste. `&rejas=0` para comparar.
- Descartado el filtrado anisótropo 16× (no cambia nada).
- Medido en el iPhone (14:14–14:23, con las rejas lejanas): el PUEBLO va a 60 FPS fijos tal cual, y también sin sombras,
  sin suavizado o sin hierba: nada lo frena y no se quita nada. Texturas ~282 MB. Los 55 FPS de las 12:47 eran de esa
  medida (posición, bots, skin 4K cargada).

**Estado:** IMPLEMENTADO · MEDIDO EN IPHONE (60 FPS en los tres mapas).

## 03-11-2026 (3) — MEDIR RENDIMIENTO en el iPhone con el menú nuevo por defecto
Del propietario: «he estado jugando y bastante bien», con el informe de la versión 7d973e3f42 (iPhone Pro Max, ALTO).
ARENA 60 FPS (0 % tirones), PUEBLO 55 FPS (p95 25 ms, 1,5 % tirones), CASA ATLAS 2.0 60 FPS; CPU ~3 ms; texturas ~629 MB
(antes ~684). Entrar en partida 17–18 ms: el menú nuevo no deja tirón al empezar. La medida por software (≈25 frente a ≈45
fotogramas en ARENA) no se confirma en el iPhone. Pendiente aparte: el PUEBLO tiene más dibujo que el 30-10 (249
llamadas y 401 mil triángulos frente a 202 y 355 mil). Detalle en `docs/RENDIMIENTO-IPHONE.md`.

**Estado:** MEDIDO EN IPHONE.

## 03-11-2026 (2) — MENÚ 2 pasa a ser el menú principal por defecto
Del propietario, tras probarlo en el iPhone: «funciona mejor… al entrar al link original ya cargara el nuevo menú
principal». El enlace normal abre el menú nuevo; `?menu=1` vuelve al de antes y se recuerda (`sniperduel_menuOld`; la
bandera vieja `sniperduel_menu2` ya no cuenta, así que todos los dispositivos pasan al nuevo). El menú antiguo sigue en
la página.
- Como el menú nuevo no dibuja el mapa detrás, lo que antes hacía ese dibujo se hace aparte: las posiciones del mapa se
  actualizan cada fotograma, sus sombreadores y texturas se preparan cuando cambia (y al pulsar JUGAR si aún no estaba:
  sin tirón al empezar), y la cámara del juego sigue girando alrededor del mapa como antes (nivel de detalle, sombras).
- MEDIR RENDIMIENTO espera a que tu operador y los personajes terminen de cargar antes de medir.
- Pruebas que pulsaban botones del menú antiguo ahora recorren el nuevo (MULTIJUGADOR + JUGAR, AJUSTES en la barra,
  OPCIONES DE PARTIDA, PERFIL y CAJAS arriba). Batería: 54 de 55 suites en verde. La que falla, `ajustes.browser` («FUEGO
  izquierdo solo al apuntar»), ya fallaba en 7076310, antes de este cambio, también con `?menu=1`: queda pendiente.
- WebGL por software: ARENA, el primer mapa de MEDIR RENDIMIENTO rápido, da menos fotogramas que con el menú antiguo
  (≈25 frente a ≈45; PUEBLO y CASA 2.0 iguales). No sirve para FPS reales: confirmar con MEDIR RENDIMIENTO en el iPhone.

**Estado:** POR DEFECTO · PROBADO EN NAVEGADOR · PROBADO POR EL PROPIETARIO EN IPHONE.

## 03-11-2026 — MENÚ 2: correcciones tras el vídeo del propietario (carga de personajes y skins)
Del propietario, con un vídeo del PC: «al principio parece ser que tarda bastante en cargar todos los personajes… hay
varios fallos que hay que pulir». Detalle en `docs/MENU-2.md` (Correcciones del 03-11-2026).
- El operador del menú ya no descarga un personaje por defecto: el tuyo primero. Nunca se ve la figura de cajas mientras
  llega uno realista («CARGANDO OPERADOR…»). Al cambiar, el anterior se queda hasta que el nuevo está listo. En el PC
  empieza a cargarse al pasar el ratón.
- Cola de texturas KTX2 de las skins (`ktx2Queue`, también en partida): la skin elegida ahora pasa delante. Antes, al
  cambiar de ÚLTIMA a otra, la nueva esperaba a que terminasen los 139 MB de ÚLTIMA (casi 2 min en el vídeo). En ARMAS
  sale el progreso de la descarga.
- CLÁSICO con sus colores (le faltaba la corrección de color en la sala). MAPAS en 2 × 2, grande.

**Estado:** PROBADO EN NAVEGADOR (menu2.browser 34/34; ktx2, armas, pro, miras y browser en verde) · PENDIENTE DE
VALIDACIÓN EN EL PC DEL PROPIETARIO Y EN IPHONE.

## 03-11-2026 — CASA ATLAS 2.0 aprobada: online, y CASA ATLAS XL retirada
Del propietario: «Aprobada, súbela online».
- `b7f5524`: el servidor recibe el mapa. `core/mapdata.js` con casa2 y una red ligera para sus bots; el protocolo admite ids
  con cifras.
  - Desplegado y comprobado en el servidor público (una sala en CASA ATLAS 2.0).
  - Prueba nueva con dos navegadores contra el servidor Node (13/13).
- Por error, el commit del menú 2 (`e4f8332`) subió antes parte de los cambios de la página; `b7f5524` los completó unos
  minutos después.
- La XL, retirada del juego (detalle e inventario en `docs/CASA-ATLAS-2.md`):
  - quitados su código, su prueba y `assets/maps/casa_atlas_xl/`;
  - MEDIR RENDIMIENTO mide ahora la 2.0;
  - se conservan las entregas de `assets/3d/imports/` (Codex trabaja en una);
  - punto de recuperación: `b7f5524`.
- Estado: PUBLICADO · PROBADO ONLINE (servidor local y público) · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 02-11-2026 — CASA ATLAS 2.0 (cuatro CASA ATLAS unidas) y miras de ventana con botón de MIRA
Del propietario (desde el iPhone y luego en el PC):
- Miras: «van bien menos la holográfica, la x2 y la x3… muy grande, ocupa toda la pantalla, tiene que verse la mira entera
  y la retícula dentro» y «añade un botón en el HUD para poder cambiar la mira dándole solo al botón».
- Mapa: encargo «CASA ATLAS 2.0»: ampliar la CASA ATLAS pequeña duplicándola (no rehacerla, no usar la XL), unir los cuatro
  módulos con tres rutas, líneas de 25–40 m, salidas equilibradas, mismo mapa en cliente y servidor, y retirar la XL de
  ChatGPT cuando la 2.0 funcione. Publicación final tras su aprobación; para probarla en el iPhone eligió «publicarla como
  opción oculta con enlace aparte».

**Qué se hizo**
- MIRAS (`c1f6a71`, publicado):
  - la 2× y la 3× pasan a ser miras de ventana como el punto rojo (rifle y mira enteros a la vista, ocular hueco);
  - en punto, holo, 2× y 3× la retícula se dibuja dentro de la ventana, a su tamaño visto desde el ojo;
  - la pila de la holográfica ya no tapa el cristal;
  - botón de MIRA en el HUD táctil (el antiguo de zoom, con el aumento): cada toque pone la siguiente mira, también
    apuntando. Detalle en `docs/MIRAS.md`.
- CASA ATLAS 2.0 (`client/casa2.js`, `docs/CASA-ATLAS-2.md`, con `?casa2=1`, solo contra bots):
  - 4 copias de la CASA ATLAS original (A tal cual, B y C en espejo, D girada) alrededor de un patio, en 43 × 33 m,
    simétrica por el centro;
  - se unen por el comedor (callejón), el estudio (pasillos laterales) y dos huecos en cada barandilla (patio);
  - tres rutas de 49, 63 y 60 m; líneas de tiro de media 13,5 m y máxima 42 m (la original: 6,1 / 18,6);
  - muretes y jardineras con los materiales de la casa;
  - las salidas, a 39,8 m y sin verse;
  - el mismo GLB y las mismas texturas que CASA ATLAS: 0 MB de texturas nuevas y ~32 mallas (la XL: +19 MB y 6,3 MB de
    descarga).
- Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR (casa2 24/24, casa2.browser 19/19; bots 40 s sin atascarse) · PUBLICADO TRAS
  BANDERA · PENDIENTE DE VALIDACIÓN EN IPHONE.
- Online y retirada de la XL: preparados (inventario en `docs/CASA-ATLAS-2.md`), esperan su aprobación. El servidor no
  cambia.

## 02-11-2026 — MENÚ 2: menú principal nuevo con la sala oscura y el operador en 3D (experimental, `?menu=2`)
Del propietario: rediseñar la pantalla principal con dos imágenes de referencia; «la sala oscura debería ser la
referencia principal; la primera sirve para organizar el botón JUGAR, las tarjetas y la navegación». Operador 3D real con
el francotirador del juego, barra de abajo INICIO | PERSONAJE | ARMAS | MAPAS | AJUSTES, sin inventar monedas ni niveles,
el menú antiguo recuperable y el nuevo como experimental hasta que lo apruebe.

**Qué se hizo** (detalle en `docs/MENU-2.md`)
- Sala táctica oscura ligera (`client/menu2.js`): hormigón, costillas de acero, LED naranja, tres lámparas con halo, cajas
  y polvo; luces sin sombras y exposición propia. Unas 49 mallas y 632 triángulos.
- El operador es el personaje elegido (GLB del juego, `makeSoldier` + `pj2SetPack`) con la animación de reposo, el rifle
  bajo y un balanceo; se gira con el ratón o el dedo. Lleva en las manos tu rifle tal cual (skin, mira, camuflaje): son
  copias de los nodos del de 1ª persona, sin cargar nada otra vez.
- INICIO: MULTIJUGADOR 1V1 (abre las salas), VS BOTS, CAMPO DE TIRO, OPCIONES DE PARTIDA (los bloques del menú de siempre,
  movidos tal cual) y JUGAR; tarjetas ARMAS y OPERADOR. PERSONAJE: los 5 operadores. ARMAS: FRANCOTIRADOR (8 miras, 5
  skins) y ARMA DE MANO (NAVAJA, TÁCTICA) con el arma en 3D. MAPAS: vistas reales hechas con el juego
  (`tools/menu2-mapas.js`); al crear una sala se pone el mapa elegido si el servidor lo tiene. AJUSTES: los de siempre.
- Mientras juegas la sala se libera y no se dibuja; en el menú nuevo el mapa no se dibuja detrás (solo la sala).
- El arma principal FURIA 12 sigue en OPCIONES DE PARTIDA (no es una tercera categoría de ARMAS, como pidió el propietario,
  pero no se pierde).

**Reglas:** nada cambia; `core/` y `server/` no se tocan. Skins, miras y cuchillos son solo aspecto, con las funciones de
siempre.

**Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR (capturas PC 1600 × 900 y móvil 932 × 430; `test/menu2.test.js` y
`test/menu2.browser.test.js` pulsan cada botón) · PENDIENTE DE VALIDACIÓN EN IPHONE Y DE APROBACIÓN. Por defecto sigue el
menú de siempre.

## 31-10-2026 (8) — MIRAS: 8 ópticas para el rifle como accesorio, cada una con un solo aumento
Del propietario:
- «añade más miras y que sean como accesorio que se puedan cambiar»;
- «mira punto rojo, mira óptica por defecto del franco y miras aparte que se puedan seleccionar, faltan x2 y x6»;
- «la mira x4, x8 y x12 tienen que ser independientes y diferentes, cada una con sus características; en el móvil,
  apuntando, es imposible alejar o acercar, solo jugamos con dos dedos».

**Las miras** (detalle en `docs/MIRAS.md`)
- PUNTO ROJO 1,25×, HOLOGRÁFICA 1,5×, VISOR 2×, TÁCTICA 3×, VISOR 4×, VISOR 6×, FRANCOTIRADOR 8× (la de cada rifle,
  por defecto) y LARGO ALCANCE 12×.
- Un solo aumento cada una: sin botón de zoom. El 4×, el 6×, el 8× y el 12× tienen cada uno su retícula (dúplex, puntos,
  caída y adelanto, fina) y su círculo: más grande cuanto menos aumenta, más oscuro en el borde cuanto más.
- **Cambio para quien usaba el 4× de la mira de siempre:** ahora es el VISOR 4×. El FRANCOTIRADOR queda en 8×.
- Cada una tiene su retícula y su cuadro:
  - tubo: el anillo negro de siempre;
  - prisma: un círculo mucho más ancho;
  - ventana: el punto rojo y la holográfica se miran a través de ellos, con el rifle a la vista.
- Los modelos son de código (`client/miras.js`) y se montan en el riel medido de cada rifle. La mira de siempre se quita
  y vuelve, también con TITÁN, ÚLTIMA, VECTOR y SAHARA.
- Se eligen en la ficha del arma del menú, en la pausa y en el inventario de HUD 2 (al momento, también en partida).

**Reglas**
- No cambia nada: con la mira puesta el disparo es exacto con todas, y el tiempo de apuntar, el retroceso, la dispersión
  y el daño son los mismos. `core/` y `server/` no se tocan.
- El rival online sigue viendo tu rifle con su mira de siempre.

**Estado**: pruebas nuevas `miras` (26) y `miras.browser` (49).
- La batería entera, en verde: 37 suites en la ejecución de `npm test`, más `ajustes.browser` y las 14 de detrás por
  separado. `ajustes.browser` tenía una espera fija en la prueba del giroscopio y ahora espera fotogramas.
- PUBLICADO · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 31-10-2026 (7) — Parpadeo de los edificios lejanos y menú de AJUSTES más pequeño en Safari
Del propietario, con un vídeo de su iPhone: «las texturas de los edificios desde lejos no se ven lisas, se ven como que
parpadean»; y «haz el menú de ajustes más pequeño, es muy grande en Safari».

**Parpadeo** (detalle en `docs/PARPADEO.md`)
- Causa: el iPhone dibujaba sin suavizado de bordes (regla de la fase 1: solo en pantallas de menos de 2×). Los barrotes,
  barandillas y marcos lejanos, más finos que un píxel, aparecían y desaparecían.
  - Confirmado con los fotogramas de su vídeo y medido con `tools/flicker.js` (nuevo).
  - Descartado el fallo de profundidad (`&near` no cambia nada).
- Cambio: MSAA 4× en MEDIO y ALTO en todos los dispositivos (BAJO sin él), con la casilla AJUSTES › GRÁFICOS ›
  «Suavizado de bordes» y `&aa=0/1`. La hierba usa *alpha to coverage* con el suavizado puesto.
- Medida: parpadeo −34 % en la plaza, −29 % en la calle norte y −36 % con el visor 8×; los peores píxeles, a la mitad.
- Coste: en el PC, 60 FPS y el mismo tiempo de dibujo con y sin él. Sin medir en el iPhone: falta MEDIR RENDIMIENTO.

**Menú** (detalle en `docs/AJUSTES.md`)
- Causa: Safari agranda por su cuenta los textos largos en horizontal (hasta ~1,8×). Se impide con `text-size-adjust`.
- Además, en un móvil en horizontal: pestañas en una fila, textos más pequeños, casillas y barras en dos columnas.

**Estado**: no se tocan `core/` ni `server/`. Pruebas: `ajustes` (+1) y `ajustes.browser` (+5). PUBLICADO · PENDIENTE DE
VALIDACIÓN EN IPHONE.

## 31-10-2026 (6) — GF-2: transiciones de animación; el CONTORNO, rojo para enemigos y azul para compañeros
Del propietario: «Sigue mejorando animaciones, lo del delineado podría ser un rojo un poco así opaco para ver desde lejos,
rojo enemigo, azul amigo».
- **Animaciones** (`client/soldier2.js`, detalle en `docs/GAMEFEEL.md` › GF-2): lo que el juego manda de golpe (esprint,
  salto, muerte, apuntar de los bots, cambio de arma) se mezcla en 0,08–0,25 s. Se usan los clips que había sin usar:
  despegue, aterrizaje, retroceso de las tres armas (capa aditiva), impacto en su tiempo y muerte hacia delante.
  - Medido con `tools/anim-sheet.js` (nuevo): el mayor giro de un hueso en un fotograma baja de 99° a 18° al soltar el
    esprint, de 71° a 13° al aterrizar, de 130° a 21° al morir y de 82° a 18° en la recarga de la escopeta.
  - Online: el rival se encoge con cada impacto (mensaje `hit`) y cae hacia el lado contrario a quien lo mató (`kill`).
  - Bots: cerrojo después de disparar (sin cambiar su ritmo), sin giro de golpe al morir y sin el rebote de 4 cm que
    movía sus zonas de impacto.
  - Coste: 60 FPS en el PC; unos 0,01–0,02 ms de CPU por personaje y fotograma.
- **Contorno**: rojo mate casi opaco en los enemigos (desde 14 m aparentes), azul en los compañeros (a cualquier
  distancia), 1,35 px, sin niebla ni estilo de imagen. La opción pasa a llamarse CONTORNO.
  - **Fallo corregido**: en el duelo online 1 contra 1 el contorno no se dibujaba (solo en las salas de varios).
  - **Perfil BAJO**: con el soldado de cajas, la SILUETA no hacía nada y el contorno salía también por dentro de la
    figura; ahora es igual que en MEDIO y ALTO. En el CAMPO DE TIRO también se dibuja.
- No cambian las zonas de impacto, la balística, los tiempos de las armas ni la puntería de los bots. `core/` y `server/`
  no se tocan: no hace falta volver a publicar el servidor.
- Pruebas nuevas: `soldier2` (+14), `gamefeel.browser` (+5) y `online.browser` (+3).

Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE (dos navegadores contra el servidor local) · PENDIENTE DE
VALIDACIÓN EN IPHONE.

## 30-10-2026 (5) — El movimiento TÁCTICO pasa al servidor; lo mejorado va al juego de verdad
Del propietario: «¿Cómo que si apruebo llevar el movimiento táctico a partidas online? Si ese es el plan, no hay límites
para crear este juego, y cualquier cosa que hago es para ir mejorando y puliendo el juego, no para tenerlo para mí en
offline, que ni voy a jugar solo».
- **Criterio desde ahora**: las mejoras de jugabilidad van al juego real, online incluido. No se dejan como opciones
  solo sin conexión. Se siguen probando a fondo y se le informa. Daño, cadencia y munición siguen necesitando su OK.
- **Reglamento de movimiento** (`core/config.js`, servidor publicado):
  - caminar 4,6 → 4,05 m/s; agachado 2,4 → 1,95; hacia atrás ×0,85 → ×0,78;
  - aceleración 58 → 32 y frenada 60 → 36 m/s²; tras el sprint, 11 → 9;
  - el sprint no cambia;
  - el núcleo cumple sus límites de respuesta: 0,125 s para alcanzar la velocidad, 0,117 s para pararse y 0,242 s para
    cambiar de lado.
- La cámara TÁCTICA pasa a ser la de todos. `?mov=clasico` (sin conexión) guarda el movimiento de antes para comparar.
- La visibilidad de enemigos funciona también online: igual para todos y solo sobre rivales.
- Las marcas de adelanto del visor salen ahora de las velocidades reales.
- La versión del protocolo no se sube: así las páginas antiguas pueden seguir conectando.
- Pruebas que tenían escritas las velocidades antiguas (`phase2`, `aim.browser`, la rampa de `core`): ahora leen el
  reglamento sin rebajar lo que exigen.

Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE (prueba pública del servidor) · PENDIENTE DE VALIDACIÓN EN
IPHONE.

## 30-10-2026 (4) — GAME FEEL 3.0, primera entrega (GF-0, GF-1, GF-4, GF-5)
Encargo del propietario, «SNIPER DUEL — ULTIMATE GAME FEEL 3.0»:
- movimiento, animaciones, FPS, visibilidad de enemigos lejanos, bots, controles y online;
- por etapas GF-0 a GF-9, midiendo antes y después;
- nada competitivo publicado sin su aprobación, el juego estable intacto y el servidor autoritativo intacto.

Hecho (detalle en `docs/GAMEFEEL.md`):
- **GF-0**:
  - auditoría de movimiento, red, bots, animación y cámara (dos subagentes de solo lectura);
  - medida por partes del fotograma (`PROF`, `?prof=1` y una línea nueva en MEDIR RENDIMIENTO);
  - `tools/gf-medir.js` para la línea base con la GPU real del PC: 60 FPS en ARENA, PUEBLO y sala de 5 bots.
- **GF-1**: perfil de movimiento **TÁCTICO** (AJUSTES › CONTROLES, experimental, por defecto ACTUAL).
  - Sin conexión: andar 4,05 m/s (−12 %), agachado 1,95 y arranque al 95 % en 0,133 s (antes 0,075).
  - En todas partes: cámara más suave.
  - El reglamento del servidor no cambia.
- **GF-4**: **visibilidad de enemigos** (AJUSTES › JUGABILIDAD, experimental, por defecto NORMAL, apagada online):
  silueta mejorada o contorno exterior fino, con prueba de profundidad y stencil.
  - Enemigo tras una pared: 0 píxeles de diferencia.
  - Se ajusta al zoom y tiene el mismo grosor en BAJO y en ALTO.
  - La primera versión del contorno se veía blanca de lejos y se rehízo con stencil.
- **GF-5**: bots animados una vez por fotograma; en ARENA, 4 → 2 personajes animados por fotograma.
- **Pruebas**: `gamefeel.browser` (11), nueva.
- Ni `core/` ni `server/` cambian.

Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

Necesitan aprobación del propietario: TÁCTICO online (servidor), la visibilidad online (regla de sala), el peek con el
cuerpo, tumbarse y trepar. Siguientes sin aprobación: GF-2 (transiciones de animación), GF-6 (bots más humanos) y
GF-1b (suavizar correcciones online).

## 30-10-2026 (3) — Ajustes como en los grandes shooters de móvil (primera fase)
Del propietario: probó R2 en el iPhone («funciona… se siente más liviano, como que carga más rápido»). Pidió mejorar la
jugabilidad y la fluidez. Mandó un vídeo recorriendo los ajustes de PUBG Mobile («añade todo lo que puedas») y otro
jugando en 3ª y 1ª persona («que se sienta fluido como si fuera hecho por una empresa experta en shooters»).
- **Hecho (solo cliente: ni servidor, ni equilibrio, ni balas)**. Detalle en `docs/AJUSTES.md`:
  - SENSIBILIDAD: sensibilidad sin mira en 1ª y 3ª persona y para cada zoom del visor (4× y 8×); giroscopio opcional.
  - CONTROLES: MIRA en modo MIXTO y FUEGO izquierdo solo al apuntar.
  - MIRA (pestaña nueva): cruceta (9 colores, 5 estilos, largo, grosor, separación, borde, vista previa), color del
    visor, retícula iluminada, color del marcador de impacto y del impacto en el cuerpo.
  - GRÁFICOS: brillo, 5 estilos de imagen y modo daltónico, dentro del tone mapping (sin coste: mismas llamadas y
    triángulos).
  - AUDIO: volumen de la interfaz y vibración (Android).
- Con los valores por defecto todo queda igual que antes; lo comprueba la prueba.
- **Pruebas**: `ajustes` 17 y `ajustes.browser` 17, nuevas; además las de siempre en verde.
- **No copiado**: recogida de objetos, visores que el juego no tiene y la calidad del sonido (motivos en `docs/AJUSTES.md`).
- IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE (giroscopio, MIXTO y estilos).
- **Siguiente fase propuesta (fluidez)**, pendiente de que el propietario elija:
  - vista libre en 3ª persona;
  - cambio de hombro;
  - bloqueo de carrera empujando el joystick;
  - disposiciones de botones guardadas (1/2/3);
  - números de daño y anuncios de racha.
  - Necesitan su aprobación, porque tocan el servidor: saltar o trepar obstáculos, inercia del movimiento y tumbarse.

## 30-10-2026 (2) — Los archivos grandes pasan a Cloudflare R2
El propietario activó R2 en el panel de Cloudflare. No podía hacer `wrangler login` (estaba fuera de casa) y pidió a
Claude que lo hiciera él. No hizo falta: el token de Cloudflare que ya tenía GitHub publica también el Worker de
archivos.
- **R2**: almacén `sniper-duel-assets` (creado con el conector de Cloudflare) y Worker `sniper-duel-assets`
  (`assets-worker/`, `.github/workflows/deploy-assets.yml`), aparte del servidor multijugador:
  - `GET` con CORS para todos;
  - `PUT`/`DELETE` solo con la clave de subida. La clave está en el secreto `R2_UPLOAD_KEY` de GitHub y en
    `.work/r2-clave.txt` (fuera de git), nunca en la página.
- **Subido** con `tools/r2-subir.js`: 76 archivos KTX2 (personajes y armas, ~400 MB). Cada uno se comprueba con su MD5.
  Hubo un corte de red a mitad de subida; ahora se reintenta.
- **El juego**: `r2()` en `src/page.html` pide los KTX2 a R2 en la web publicada; en localhost usa las copias locales.
  Si R2 falla, se cargan los JPG que siguen en el repositorio.
- **Repositorio**: los 76 archivos salen del árbol (`.gitignore`; siguen en el historial y en el PC). La web publicada
  baja ~400 MB y queda sitio para más texturas a 4K.
- **Pruebas**: `ktx2.browser` 16 (nuevas: carga desde R2 sin red y nada de R2 en localhost), `armas.browser`,
  `browser`, `pj2.browser`, `perf.browser`.
- IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 30-10-2026 — Safari cerraba la sala con 5 bots: la copia en JavaScript de las texturas comprimidas
Informe del propietario: la partida cargó y funcionó un minuto y luego Safari la cerró con el mismo error (sala
multijugador, 5 bots, PUEBLO 3.0). Decisión del propietario en el mismo mensaje: pasar los archivos grandes a
Cloudflare R2 («hasta 10 GB tenemos suficiente espacio»).
- **Medido** (`tools/mem-sala.js`): la GPU estaba como antes (268 + 363 MB con ÚLTIMA). Pero three.js guardaba además
  una copia en JavaScript de cada textura comprimida: 507 MB. La memoria de JavaScript estaba en 625 MB.
- **Arreglo**:
  - la copia se suelta al subir cada textura a la GPU; JavaScript baja a ~92 MB;
  - las texturas se suben al acabar de cargar el modelo;
  - el aspecto de arma que se deja sale de la GPU;
  - una sola descarga por aspecto aunque se elija dos veces.
- **Pruebas**: `armas.browser` 28 (comprueba que no quedan copias y que el aspecto dejado sale de la memoria),
  `ktx2.browser` 13, y en verde `pro`, `pj2`, `perf`, `cajas`, `salas`, `hud2`, `touch.smoke`, `browser` y
  `online.browser`. `pantalla.browser` ahora espera al cambio de tamaño en vez de a un tiempo fijo (falló una vez con el
  ordenador cargado).
- **R2**: la cuenta de Cloudflare aún no tiene R2 activado («Please enable R2 through the Cloudflare Dashboard»).
  Activarlo y aceptar sus condiciones lo tiene que hacer el propietario; para subir archivos hace falta `wrangler login`
  en su PC.
- IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 29-10-2026 (5) — Aspectos de arma en KTX2 a su resolución máxima
Petición del propietario: «lo quiero todo en 4K y en su máxima resolución».
- `arma_ktx2.glb` + `ktx2/` por aspecto (`tools/ktx2/make.py`), sin volver a pasar por Blender:
  - la misma geometría que `arma.glb`;
  - cada textura vuelve a salir del original de `tools/arma-ext/.work/<id>/src`, a su tamaño real, en su propio
    archivo;
  - antes se comprueba que sea la misma imagen.
- Resoluciones: ÚLTIMA y VECTOR 4K; TITÁN 4K/2K; SAHARA y TÁCTICA 2K.
- Memoria gráfica: ÚLTIMA 363 MB y VECTOR 128 MB (las mismas, 4 veces el detalle); TITÁN 192 → 96 MB; SAHARA
  384 → 96 MB.
- Descarga: ÚLTIMA 5,1 → 139,0 MB la primera vez. Solo se descarga el aspecto elegido y queda en la caché.
- **Archivos aparte**: ÚLTIMA en un solo GLB pasaría de los 100 MB que admite GitHub. Además, el móvil pide las
  texturas de una en una (`ktx2Queue`; 3 a la vez en PC), así que al cargar no tiene el modelo entero en memoria.
- **Espacio**: el repositorio publicado pasa de 574 a ~870 MB, y el límite de GitHub Pages es 1 GB. Para más 4K (mapas)
  hace falta otro sitio: tarea abierta.
- En el juego:
  - si el KTX2 falla, sale `arma.glb`; con `?ktx2=0` y en BAJO, `arma.glb` (JPG 2K);
  - mientras llega, el HALCÓN sigue en las manos (antes se quedaban vacías durante la carga).
- **Arreglado de paso**: volver a elegir un aspecto ya usado (ÚLTIMA → TITÁN → ÚLTIMA) dejaba las manos vacías, porque
  sus piezas ya no estaban en la escena guardada. Ahora se guardan con su posición.
- Camuflaje: `client/camo.js` usa `extras.lum` (brillo medio del color) con las texturas comprimidas.
- Comparativa con la misma cámara y el mismo fotograma: `docs/img/ktx2-armas.jpg` (PSNR del rifle: TITÁN 37,6 dB, ÚLTIMA 41,7, VECTOR 35,6, SAHARA 40,1 (no se ve pérdida; con 4K, algo más de nitidez)).
- Pruebas: `armas.browser` 26/26 (también en el móvil: ÚLTIMA a 4K con sus 17 texturas de una en una); `npm test` completo en verde (`aim.browser` falló una vez con el ordenador ocupado comprimiendo y pasó al repetirla, 14/14).
- IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

## 29-10-2026 (4) — Safari: la imagen sigue a la pantalla, juego instalable y KTX2 otra vez por defecto en el móvil
Petición del propietario: «lo quiero todo en 4K y en su máxima resolución, he probado el link con KTX2 con las texturas en
4K en Safari y ahora funciona […] lo único malo de Safari es que no me deja subir la barra de marcadores y de búsqueda y
me tapa la pantalla y se distorsiona un poco el juego por las medidas».
- **Imagen deformada**: en Safari la barra cambia la zona visible sin avisar siempre a la página (sin evento `resize`, o
  tarde), y la cámara seguía con la forma de antes: imagen estirada. Ahora:
  - el tamaño se toma del lienzo en pantalla (`getBoundingClientRect`);
  - un `ResizeObserver` del lienzo y `visualViewport` avisan del cambio aunque Safari no lo haga.
- **La barra**: una página no puede ocultar las barras de Safari. El juego instalado sí se abre sin ellas:
  - `manifest.webmanifest` con iconos (`assets/app/`, retícula dibujada con Pillow), pantalla completa en horizontal;
  - icono para el iPhone (`apple-touch-icon`);
  - en el menú del iPhone (solo en Safari, no en la app instalada) sale cómo hacerlo: Compartir › «Añadir a pantalla de
    inicio». La app instalada guarda sus datos aparte: la primera vez hay que volver a entrar en la cuenta.
- **KTX2 otra vez por defecto en el móvil**, con la carga ligera (un transcodificador, personajes de uno en uno).
  `?ktx2=0` = JPG de 2K.
- **Pruebas**: nueva `test/pantalla.browser.test.js` (9). Simula la barra de Safari: la zona visible cambia sin
  `resize`. Sin el arreglo falla: dibujaba 390 filas en 330 píxeles. También comprueba el aviso y el manifiesto.
  `ktx2.browser` 12, `pro` 30, `pj2` 16, `hud2.browser` 60, `touch.smoke` 86, `mobile` 74, `smoke` 76 y `perf` 11, en
  verde.
- IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

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

## 29-10-2026 (3) — Safari volvió a cerrar la partida con KTX2 por defecto: en el móvil, JPG 2K por defecto
Informe del propietario: «en Safari vuelve a fallar la partida o a veces ni carga». En Chrome del iPhone, MEDIR
RENDIMIENTO: 60 FPS en ARENA, PUEBLO y CASA XL; modelo KTX2 de 23 MB en 7,7 s.
- **Causa probable**: el pico de memoria al cargar. Modelos KTX2 de 17–27 MB a la vez y hasta 4 transcodificadores. La
  memoria fija sí es menor.
- **Cambios**:
  - en el móvil vuelven por defecto los JPG de 2K;
  - KTX2 en el móvil con `?ktx2=1`, con un solo transcodificador y los personajes de uno en uno;
  - en PC sigue KTX2;
  - MEDIR RENDIMIENTO cuenta la memoria real de las texturas comprimidas (antes las contaba a 4 bytes por píxel).
- **Pruebas**: `ktx2.browser` 12, `perf` 11, `pro`, `pj2`, `touch.smoke` y `online.browser` en verde.
- IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN SAFARI (con y sin `?ktx2=1`).

## 29-10-2026 (2) — Los personajes en KTX2 pasan a ser lo de por defecto (móvil y PC)
Decisión del propietario, tras probar `?ktx2=1` en Safari con ALTO («sí que me deja jugar y carga todo»): «Sí, móvil y
PC».
- KTX2 por defecto en MEDIO y ALTO, en móvil y PC. `?ktx2=0` = los JPG de antes. En BAJO siguen los JPG de 1K.
- Si la GPU no admite ninguna textura comprimida, se usan los JPG (no se descomprimen a 4 bytes por píxel).
- Solo se pide KTX2 para los cuatro personajes que lo tienen.
- Pruebas: `ktx2.browser` (9) sobre el nuevo por defecto. `pj2.browser` y `pro.browser` comprueban los JPG con
  `?ktx2=0`, como se hizo con `?pj=0` / `?hud=1`.
- IMPLEMENTADO · PROBADO EN NAVEGADOR · VALIDADO EN IPHONE con la bandera.

## 29-10-2026 — Texturas comprimidas para la GPU (KTX2) como prueba con `?ktx2=1`
Decisión del propietario: «Sí, prepáralo» (recuperar el detalle de 4K en el móvil sin perder calidad ni gastar más
memoria).
- **Herramientas**: el codificador oficial de Basis Universal v1.50 (WebAssembly, Apache 2.0) en `tools/ktx2`, y el
  `KTX2Loader` y el transcodificador de three.js r128 (MIT y Apache 2.0) en `vendor/`. Sin instalar nada y sin
  servicios.
- **Los 4 personajes convertidos** a UASTC con su resolución completa: `personaje_ktx2.glb` y `color_*_ktx2.ktx2`, junto
  a los originales.
- **Medido**:
  - en un móvil con ALTO, FSB a 4K en ASTC ocupa 85 MB, lo mismo que hoy a 2K (antes, sin comprimir, 340 MB);
  - calidad: 41–48 dB, sin diferencia a la vista (`docs/img/ktx2-comparacion.jpg`);
  - descarga: 2–5 veces mayor.
- **Pruebas**: `ktx2.browser` (8, nueva); `pro.browser` y `pj2.browser` sin cambios.
- IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN EL IPHONE: `?ktx2=1` con ALTO en Safari. Si se
  aprueba, pasaría a ser lo de por defecto.

## 28-10-2026 (noche, 6) — iPhone: Safari cerraba la página con los personajes realistas en ALTO
Informe del propietario:
- «Al intentar crear sala multijugador con 5 bots en pueblo en el iPhone me ha dado error».
- Después confirmó que también fallaba offline y con 1–2 bots; que con `?pj=0` funcionaba; y que en Chrome del iPhone
  cargaba bien.
- Tenía ALTO, S.W.A.T. y 3ª persona.

Causa medida:
- En ALTO, el rival y los bots cargaban personajes de 4K: 340 MB de memoria gráfica cada uno, 538 MB de texturas en la
  partida.
- Chrome guardaba otros ajustes (la calidad por defecto).

Arreglo:
- En móviles y tabletas, los personajes nunca pasan de 2K. Son los mismos que en PC y nada baja a 1K: el propietario
  pidió «no quiero perder calidad, sino ir mejorando».
- Con su configuración: 155 MB. En MEDIO, igual que antes.
- Propuesta para recuperar el detalle de 4K en el móvil con la misma memoria: texturas comprimidas en la GPU (KTX2).
  NECESITA APROBACIÓN.
- Detalle: `docs/PERSONAJES-PRO.md`. Prueba en `pro.browser`.
- IMPLEMENTADO · PROBADO EN NAVEGADOR (emulación de móvil) · PENDIENTE DE VALIDACIÓN EN EL IPHONE (Safari con ALTO).

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
