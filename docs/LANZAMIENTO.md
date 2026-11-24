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
