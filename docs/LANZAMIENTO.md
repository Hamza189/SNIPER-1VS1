# LANZAMIENTO (versión para enseñar a la gente) — 23-11-2026

Del propietario: «medio lanzarlo a producción… pon todo lo nuevo por defecto, borra cosas que no utilizamos, deja
gráficos altos por defecto… en las skins, armas, ajustes, borra todo el texto innecesario, todas las fuentes, derechos,
todo eso en un archivo aparte, pero que se vea limpio y profesional». Se hace por fases, en commits pequeños.

## Fase 0 — Sin sonido de fondo (5828b93)
- Lo único que sonaba sin parar era el agua de la fuente del PUEBLO: un ruido filtrado audible en casi todo el mapa, que
  sonaba a viento. Fuera, junto con el código de reserva del viento (`?viento=1`) y el volumen AMBIENTE de AJUSTES.

## Fase 1 — Lo nuevo, por defecto
| Qué | Antes | Ahora | Volver a lo de antes (para comparar) |
|---|---|---|---|
| Gráficos AUTO | MEDIO en móviles, ALTO en PC | **ALTO en todos**. Siguen bajando solos las gráficas flojas (`gpuHint`) y si en partida va muy lento (`wantsLower`); la resolución se ajusta a los FPS | elegir MEDIO o BAJO en AJUSTES; `?gpuauto=0` |
| SALA 1V1 (hangar 3D) | `?lobby=2` | **por defecto**, con **MÁS MODOS** (pantalla de salas de siempre: TODOS CONTRA TODOS, EQUIPOS, bots) | `?lobby=1` |
| Pantalla de carga | `?carga=2` | **por defecto** | `?carga=1` |
| BARRIO en MAPAS | `?barrio=1` | **por defecto** | `?barrio=0` |
| RIDGE y AMBER | `?meshy=1` | **en la lista para todos**, con texturas de 2K en todos los aparatos (aún no tienen KTX2: su 4K en JPG serían ~85 MB de memoria gráfica cada uno, y la carga del PC sube a la tarjeta los 6 personajes) | — |
| Rifles con sus cifras **online** | solo contra bots; online, todos con el HALCÓN R7 | **también online** (aprobado por el propietario el 23-11: «Sí, cada rifle con sus cifras») | `?balance=0` (solo sin conexión) |
| AJUSTES › EN PRUEBA | pestaña con interruptores | **quitada**: todo lo que ofrecía es lo de por defecto | las banderas del enlace siguen |
| AJUSTES › GRÁFICOS › Pueblo CLÁSICO / 3.0 | interruptor | **quitado**: ya no hacía nada (el pueblo es PUEBLO 4.0) | `?pueblo=0` |

- **Una vez por aparato** (`sniperduel_rel1`), el juego olvida lo que recordaban los interruptores de EN PRUEBA, para que
  ningún móvil se quede en una versión vieja por una elección antigua.
- **Rifles online** (`core/`): mensaje nuevo `rifle {id}` (`core/protocol.js`); el servidor guarda el modelo de cada
  jugador y se lo da en la siguiente aparición (`core/room.js` → `core/player.js respawn`); los disparos usan las cifras
  del rifle que lleva en esa vida. El cliente predice con las mismas (`client/netcore.js` `N.rifle`). El silenciador sigue
  siendo solo contra bots. Pruebas: `test/room.test.js` (6 nuevas) y `test/online.browser.test.js`.
- **MÁS MODOS**: una sala con más de dos personas (modo distinto de duelo o con bots) se abre siempre en la pantalla de
  siempre, también al entrar con su enlace.

## Fase 2 — Textos limpios
- PERSONAJE y ARMAS: en lugar del autor y la licencia, un papel corto (SOLDADO · INFANTERÍA, TITÁN · LARGO ALCANCE…).
  Fuera los avisos «solo cambia el aspecto…», «en línea va el HALCÓN», «PRÓXIMAMENTE» y las categorías vacías del ARSENAL
  (ASALTO, SUBFUSIL, GRANADAS).
- AJUSTES: ayudas de una línea; la fórmula de la sensibilidad y los textos técnicos, fuera; la línea técnica y MEDIR
  RENDIMIENTO, plegados en DIAGNÓSTICO (GRÁFICOS).
- **Créditos y licencias en su propia página**: `creditos.html` (personajes, armas, Poly Haven, three.js, Basis Universal,
  tipografías), enlazada al pie de AJUSTES junto a Privacidad.

## Fase 3 — Versiones antiguas borradas (24-11-2026)
Del propietario, a la pregunta «¿borro también las versiones antiguas que solo siguen por banderas del enlace?»: «Sí,
bórralas». Antes de tocar nada, todo quedó guardado en la etiqueta git **`antes-de-limpiar-2026-11-24`** (subida a
GitHub): cualquier versión se puede recuperar de ahí.

| Ya no existe | Qué era | Lo que queda |
|---|---|---|
| `?menu=1` | el menú principal de antes | el MENÚ 2 (sus bloques ocultos de `#menu .menuInner` siguen: son los controles del juego que se mueven a OPCIONES DE PARTIDA) |
| `?hud=1` | el HUD táctil y de PC de antes | el HUD 2 (`client/layout.js` sigue: el HUD 2 se apoya en él) |
| `?arsenal=0` | la sección ARMAS de antes (filas de miras, skins y cuchillos) | el ARSENAL; fuera su HTML, su CSS y su código |
| `?balance=0` | las cifras del HALCÓN para los 5 modelos | cada rifle con las suyas |
| `?desliz=0` | el deslizamiento de antes en tu 3ª persona | el de piernas por delante (en línea, el rival sigue con el de siempre) |
| `?mov=clasico` | el movimiento de antes (4,6 m/s) | el TÁCTICO del servidor |
| `?feel=2` | un experimento de sensaciones de arma nunca aprobado | — |
| `?caja=0` | forzar la caja de CAJAS en CSS | la ATLAS DROP en 3D (la de CSS sigue de reserva si falla WebGL) |
| `?perfil=1` | PERFIL sin personajes | PERFIL con los personajes |
| `?pueblo=0` / `=3` / `=4`, `?sur=0`, `?pueblo4=0`, `?town=0`, `?e10=0`, `?suelo=0` / `p0`, `?adoquin=0`, `?casas=0`, `?fuente=0` | el pueblo de antes y sus partes (PUEBLO 2.0, 3.0, 3.1, el suelo y el adoquín de antes, las cajas macizas, el agua plana) | **PUEBLO 4.0 siempre**. El enlace de invitación ya no lleva `&pueblo=4` |

- **Servidor sin cambios.** Su mapa `pueblo` (el de antes) se queda para las páginas viejas que aún lo pidan:
  `tools/export-map.js` lo copia tal cual de `core/mapdata.js` en lugar de generarlo. Si una sala usa ese mapa (creada
  desde una página vieja), esta página sale de ella con el aviso «ESA SALA USA EL PUEBLO ANTIGUO: EL ANFITRIÓN TIENE QUE
  RECARGAR LA PÁGINA», en lugar de dibujar un pueblo mientras el servidor juega en otro.
- Se quedan las banderas de diagnóstico y pruebas (`?carga=1`, `?lobby=1`, `?perf=low`, `?pj=0`, `?ktx2=0`, `?gpuauto=0`,
  `?prof=1`, `?medir`, `?server`, `?sala`…) y las opciones aún por decidir (`?fachada=cc0`, `?casa2v=2/3`, `?pulido=1`).
- Pruebas puestas al día: `touch.smoke` pasa con el HUD 2 (el entorno simulado ya distingue un botón de la barra de
  armas); `menu2`, `arsenal`, `rifles`, `gamefeel`, `hud2`, `cover`, `e10`, `fauna`, `p0`, `casas` y `pueblo4.online`
  ya no comprueban las versiones quitadas.

## Fallos encontrados por el camino
- **Error de sintaxis** al quitar el «PRÓXIMAMENTE» del ARSENAL (un `else` suelto): la página no arrancaba. Corregido
  antes de publicar; lo cazó la batería completa.
- **La pantalla de carga se podía quedar encima de una partida** si esta empezaba antes de acabar de cargar (un enlace de
  invitación, un toque rápido): ahora, al empezar una partida, se quita como con ENTRAR YA (`cgOff`).
- **AJUSTES › GRÁFICOS › Pueblo CLÁSICO / 3.0 no hacía nada** desde el PUEBLO 4.0: quitado.
- **RIDGE y AMBER a 4K en el PC** (JPG sin comprimir, ~85 MB de memoria gráfica cada uno, y la carga del PC sube los 6
  personajes): ahora a 2K hasta que tengan KTX2.

## Pruebas que se habían quedado viejas (no eran fallos del juego)
La batería completa no se pasaba entera desde hacía semanas. Puestas al día, comprobando antes en una copia limpia de la
versión publicada que fallaban igual:
- `p0`: el juego normal ya es PUEBLO 4.0 (suelo nuevo), desde el 17-11.
- `casa`: el televisor de pie deja pasar la bala con menos daño (penetración aprobada el 10-11: 188 a la cabeza, el 75 %).
  **Pendiente de decidir por el propietario** si el televisor debe parar la bala del todo (sería un cambio del servidor).
- `armas`: en el móvil las armas van a 2K desde el 18-11.
- `menu2`: con WebGL por software AUTO elige BAJO (desde el 10-11) y en BAJO no hay operadores realistas: la prueba fuerza ALTO.
- `pausa`: con `?radar=0` siguen saliendo en el minimapa los bots que disparan (es lo correcto); se comprueba que no salga el RADAR.
- `sala1v1`: el enlace lleva `&pueblo=4` y el mapa del servidor es `pueblo4`; la resolución con `?perf=low` es fija.

Herramienta nueva: `node tools/todas-las-pruebas.js [desde]` pasa todas las suites de `npm test` sin pararse en la primera
que falla y al final da la lista de todos los fallos.

## Pruebas
- Pruebas que usan la pantalla de salas de siempre: abren con `?lobby=1`. La sala nueva: `test/sala1v1.browser.test.js`
  (con MÁS MODOS). Las pruebas sin navegador (`smoke`, `touch.smoke`): con `?carga=1`, porque ahí nunca termina de cargar.
- `test/pruebas.browser.test.js` (la pestaña EN PRUEBA) se quitó con la pestaña.

Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE Y ANDROID.
