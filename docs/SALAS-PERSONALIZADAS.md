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

## Fase 2 — todos contra todos con bots en el servidor (en curso)
- **Salas de hasta 6 participantes** entre personas y bots. El creador elige:
  - modo: 1 contra 1, todos contra todos o equipos;
  - número de bots y su dificultad.
- **Bots en el servidor** que juegan con las mismas reglas que las personas: el mismo movimiento, rifle, cerrojo,
  recarga y balística. Solo deciden ellos:
  - por dónde andar: caminos por los puntos de navegación del mapa;
  - a quién mirar: línea de visión;
  - cuándo disparar: tiempo de reacción y error de puntería según la dificultad.
- **1 contra 1** sigue funcionando igual, pausa por desconexión incluida.

## Fase 3 — equipos mixtos
- 2 contra 2 o 3 contra 3. Los amigos eligen equipo y los bots rellenan los huecos.
- Sin fuego amigo. Gana el equipo que suma más bajas o el primero en llegar al objetivo.
- En el minimapa, los compañeros se ven siempre.
