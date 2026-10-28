# Salas personalizadas, reloj y minimapa (28-10-2026)

Petición del propietario: «añade tiempo, por ejemplo un contador que empiece desde 10 minutos al empezar la partida,
crear ajuste de modo sala personalizada, para que pueda poner bots, amigos, también quiero como un mapa en el lateral
izquierdo superior o derecho para ver el mapa en sí, los obstáculos y los enemigos cuando disparan».

Decisión sobre la sala: «todos contra todos y equipos mixtos». Se hace por fases, cada una probada y publicada.

## Fase 1 — HECHA (28-10-2026)

### Reloj
- Cuenta atrás desde el inicio de la partida, bajo el marcador. En el último minuto se pone en rojo.
- **Contra bots**: menú › Tiempo de la partida: 5, 10 (por defecto), 15 min o sin límite. Se guarda en el dispositivo.
- **Online**: lo cuenta el servidor de la sala. Solo cuenta el tiempo jugado, no las pausas por desconexión. Llega a
  los jugadores en cada snapshot (`tl`).
- **Al acabarse el tiempo**: gana quien tenga más bajas; si van iguales, **EMPATE**. La pantalla final dice «Se acabó
  el tiempo».

### Ajustes de sala (online)
- Quien crea la sala elige, entre partidas:
  - **bajas para ganar**: 5, 10, 20 o 30;
  - **tiempo**: 5, 10, 15, 20 min o sin límite.
- Por defecto, 10 bajas y 10 minutos.
- El invitado los ve, pero no puede cambiarlos. El servidor valida los valores y no deja cambiarlos a mitad de
  partida.

### Minimapa
- El mapa visto desde arriba, girado con tu vista: arriba es adonde miras, y una «N» en el borde marca el norte.
- Se dibuja con las cajas de colisión del mundo a la altura del cuerpo: las altas, claras; las bajas (coberturas),
  más tenues.
- **Los enemigos solo salen cuando disparan**: un punto rojo durante 3 s. Vale para los bots contra bots y para el rival
  online, con el origen del disparo que manda el servidor. Si no disparan, no se ven.
- **Dónde está**:
  - en PC, arriba a la izquierda;
  - en el móvil, arriba a la derecha, porque con el HUD 2 la vida está arriba a la izquierda (los avisos de bajas se
    apartan a su izquierda).
- **Se quita en** AJUSTES › JUGABILIDAD › Minimapa.
- **Coste**: un canvas 2D que se redibuja unas 20 veces por segundo. El mapa de fondo se dibuja una sola vez por mapa.

### Regeneración de vida online (aprobado por el propietario)
- Online curaba 6–11 de vida por segundo en vez de los 22 de la regla, que son los del modo contra bots. Era el mismo
  fallo de reloj que tenían las balas.
- Ahora cura **22/s** con cualquier ping, medido.

### Código y pruebas
- **Código**:
  - `core/room.js`: `cfg`, `tl`, fin por `tiempo`, regeneración por el tiempo entre ticks.
  - `core/protocol.js`: mensaje `cfg`.
  - `client/netcore.js`: `N.cfg`, `N.setCfg`, `N.timeLeft`.
  - `client/settings.js`: `minimap`.
  - `src/page.html`: reloj, minimapa, ajustes de sala y del menú.
- **Pruebas**:
  - `test/room.test.js`, sección TIEMPO, AJUSTES DE SALA Y REGENERACIÓN: 12 comprobaciones.
  - `test/reloj.browser.test.js` (nueva): 14 comprobaciones. Incluye que un disparo delante sale arriba del centro del
    minimapa y que en el móvil no tapa la vida.

## Fases 2 y 3 — HECHAS (28-10-2026): todos contra todos y equipos mixtos con bots del servidor

### En la sala (MULTIJUGADOR)
- Quien crea la sala elige el **modo**:
  - **1 CONTRA 1**: como siempre, y es el de por defecto. Si alguien se desconecta, la partida se pausa para los dos
    hasta 60 s.
  - **TODOS CONTRA TODOS**: hasta 6 plazas entre personas y **bots del servidor** (0 a 5), cada uno por su cuenta.
    - Se puede empezar solo con bots.
    - El lobby anuncia «+ 3 BOTS DEL SERVIDOR · VETERANO».
  - **EQUIPOS**: ROJO contra AZUL, 2 contra 2 o 3 contra 3.
    - Cada persona entra en el equipo con menos gente y puede cambiarse si hay hueco.
    - Los bots rellenan los huecos.
    - **Sin fuego amigo**: la bala atraviesa al compañero sin hacerle nada.
    - Gana el equipo que suma el objetivo de bajas, o el que más lleva cuando se acaba el tiempo.
- **Dificultad de los bots**:

| Nivel | Reacción | Error de puntería asentado |
|---|---|---|
| RECLUTA | 0,9–1,4 s | 14 mrad |
| VETERANO | 0,6–1,0 s | 8 mrad |
| ÉLITE | 0,35–0,7 s | 4,5 mrad |

- También se eligen el mapa, las bajas y el tiempo, como en la fase 1.
- **Si alguien se desconecta** en todos contra todos o en equipos, los demás siguen jugando. Esa persona sale del campo
  sin contar como muerte y reaparece al volver con su plaza. Si se van todas las personas, la partida se pausa.
- **Revancha**: cuando la aceptan todas las personas de la sala. Los bots vuelven a la nueva partida.

### En la partida
- **Marcador**:
  - 1 contra 1: TÚ y el rival;
  - todos contra todos: TÚ y LÍDER (las bajas del que más lleva);
  - equipos: tu equipo y el otro.
- **Avisos**: el panel de bajas dice quién mata a quién también entre otros, y avisa si alguien se desconecta o sale.
- **Compañeros**: llevan una marca azul sobre la cabeza y no están entre tus blancos.
- **Minimapa**: los compañeros salen siempre en azul; los enemigos, en rojo solo cuando disparan.
- **Final**: VICTORIA si gana tu plaza o tu equipo. El texto dice quién ganó, o ROJO x – y AZUL.

### Los bots (`core/bots.js`)
- **Mismas reglas que las personas**: la sala pasa sus órdenes por el mismo paso de jugador (movimiento, rifle, visor,
  cerrojo, recarga, regla del quickscope) y sus balas por la misma balística y zonas de impacto.
- **Solo deciden ellos**:
  - **por dónde andar**: A* sobre los puntos de navegación del mapa. El grafo se hace una vez por mapa (5–190 ms) y un
    tramo une dos puntos si hay línea libre a la altura de la rodilla y del pecho;
  - **a quién mirar**: el enemigo vivo más cercano a la vista, mirado unas 8 veces por segundo;
  - **cuándo disparar**: tras el tiempo de reacción, con un error de puntería que se asienta mientras aguantan la mira.
- **Comportamiento**:
  - Apuntan adonde está el enemigo, sin adelantar, así que moverse les hace fallar más.
  - Dan pasos laterales mientras apuntan y a veces cambian de posición tras disparar.
  - Oyen los disparos a menos de 90 m y van hacia allí; si les dan, se giran hacia quien les dio.
- **Medido en la simulación**: 3 bots ÉLITE en 40 s andan, disparan 44–48 veces y hacen 11–12 bajas contra personas
  quietas.

### Puntos de caja
- Todas las personas con cuenta reciben puntos:
  - +100 si gana su plaza o su equipo;
  - +75 en empate;
  - +50 si pierden.
- **Una sola cuenta contra bots del servidor**: puntos de bots (+25 o +10, tope de 100 al día). Los cuenta el servidor.
- Se arregló que las partidas que terminan por tiempo no daban puntos.

### Protocolo y código
- **Protocolo** (`docs/PROTOCOLO.md`):
  - `cfg` con `mode`, `bots`, `diff` y `size`;
  - mensaje `team`;
  - la snapshot lleva `ops`, todos los demás con su plaza, equipo y marca de bot (y `op`, el rival, para páginas
    antiguas);
  - `tsc`, el marcador de equipos;
  - eventos `away` y `left`;
  - `over.winner` puede ser un equipo.
- **Código**:
  - `core/room.js`: plazas A–F, modos, bots, equipos y bala al cuerpo más cercano;
  - `core/bots.js` (nuevo);
  - `client/netcore.js`: `remotes` por plaza, `chooseTeam` y `tsc`;
  - `server/accounts.js`: premios con equipos y bots;
  - `src/page.html`: `REMOTES`, lobby, marcador, marcas de compañero y minimapa.
- **Pruebas**:
  - `test/room.test.js`: 21 comprobaciones nuevas (1 contra 1 intacto, todos contra todos con bots, bala al cuerpo más
    cercano, equipos sin fuego amigo, marcador y victoria de equipo);
  - `test/accounts.test.js`: +4;
  - `test/salas.browser.test.js` (nueva): 12 comprobaciones, la página real con el servidor local.

### Pendiente
- **Rendimiento**: con 5 rivales a la vista hay más personajes que dibujar, como contra bots offline. Hay que medirlo en
  el iPhone con MEDIR RENDIMIENTO.
- **Coste del servidor**: los bots piensan en el servidor; cuesta CPU del Durable Object, dentro del plan gratuito.
  Una partida con 5 bots aún no se ha medido en Cloudflare.
- **Pendiente de validar** en partidas reales con amigos: los bots en CASA ATLAS (mapa pequeño), y si la dificultad
  VETERANO es la adecuada.
