# Etapa D — requisitos de prevención de errores (pendiente)

Recibido el 9-10-2026. NO empezado: el orden acordado es probar la jugabilidad móvil → Etapa C (gráficos) → Etapa D.
Texto original del plan, sin cambios:

```text
Para la Etapa D de Sniper Duel, lo más peligroso no es conseguir que dos jugadores entren en una
sala. Es que parezca funcionar durante las primeras pruebas y luego falle cuando tú y tu novia
juguéis desde dos móviles diferentes.

Hay que anticipar problemas de conexión, sincronización, balística, controles táctiles, reconexiones y
despliegue. Especialmente porque Sniper Duel ya tiene físicas a 120 Hz, balas con velocidad y
gravedad, navaja, deslizamientos y disparo al soltar el botón.

He preparado un plan de prevención de errores para que Claude no construya el multijugador a base
de parches.


Los 12 fallos que más me preocuparían

Posible error                                           Cómo prevenirlo

Uno ve al otro en una posición incorrecta               Interpolación, identificadores de tick y reconciliación

Disparo que acierta en un móvil pero falla en el otro   Impactos calculados y confirmados por el servidor

Balas atravesando paredes                               Colisiones autoritativas con geometría de cobertura

Jugadores teletransportándose                           Predicción local, buffers y límites de corrección

Doble disparo al soltar FUEGO                           Identificadores únicos de disparo y control de estado

Navaja atacando desde demasiado lejos                   Validar distancia, orientación y obstáculos en
                                                        servidor

Desconexión al bloquear el iPhone                       Reconexión con token temporal y recuperación de
                                                        partida

Dos jugadores usando el mismo identificador             Identidad por sesión validada en servidor

Sala que queda bloqueada                                Temporizadores, limpieza y estados definidos

Diferencias entre 30 y 120 FPS                          Simulación de tiempo fijo independiente del
                                                        renderizado

WebSocket que funciona localmente pero no en GitHub     WSS, configuración de origen y pruebas públicas
Pages

Cambios que rompen el modo offline                      Pruebas de regresión y aislamiento de modos


Y añadiría algo importante: no basta con que el servidor reciba un disparo y decida el daño.
Debe conocer el estado real del jugador, su arma, munición, cerrojo, posición y momento del disparo.


Prompt de prevención de errores para Claude
Envíale este mensaje junto con el plan de la Etapa D, o inmediatamente después, antes de que
empiece a programar el multijugador.


  Quiero añadir un requisito fundamental a la ETAPA D de Sniper Duel: arquitectura resistente
  a errores, pruebas de red y prevención de regresiones.

  Antes de implementar el multijugador, analiza los posibles fallos de sincronización, red,
  balística, físicas, controles, seguridad y despliegue.

  No quiero que simplemente funcione en una prueba ideal. Quiero que el sistema soporte
  condiciones reales de dos móviles, incluyendo Safari de iPhone, Android, redes distintas,
  latencia, pérdida de paquetes y desconexiones.

  Trabaja siguiendo estas reglas:

  1. Estados y protocolo de red

  Define una máquina de estados clara:

  DESCONECTADO → CONECTANDO → EN SALA → PREPARADO → JUGANDO →
  FINALIZADO.

  Incluye estados de reconexión y error.

     Versiona el protocolo de red.
     Valida estructura, tipo, tamaño y frecuencia de todos los mensajes.
     Usa identificadores únicos de jugador, sala, partida, tick y disparo cuando corresponda.
     Evita procesar mensajes duplicados, atrasados o pertenecientes a partidas anteriores.
     No permitas que un jugador suplante al otro.
     No permitas iniciar una partida sin dos participantes válidos.
     Maneja correctamente dos conexiones simultáneas, cierre de pestañas, reconexiones y
     salas abandonadas.

  2. Simulación y sincronización

     Mantén la simulación independiente de los FPS de renderizado.
     Decide explícitamente la frecuencia de simulación del servidor y la frecuencia de envío de
     snapshots; no presupongas que deben ser 120 Hz.
     Utiliza timestamps o ticks coherentes y números de secuencia.
     Implementa interpolación de jugadores remotos.
     Implementa predicción local y reconciliación progresivamente, sin comprometer la
     estabilidad.
     Evita que snapshots antiguos sobrescriban estados nuevos.
   Evita que el jugador remoto atraviese paredes o se teletransporte por errores de
   interpolación.
   Controla acumulaciones excesivas de tiempo tras volver de una pestaña suspendida.
   Nunca confíes en posiciones arbitrarias enviadas por el cliente como autoridad final.

3. Disparos y balística

Este punto es crítico porque Sniper Duel tiene un rifle con velocidad de proyectil de 600 m/s,
gravedad y mira calibrada.

   El servidor debe validar origen, dirección, cadencia, munición, recarga, cerrojo y estado del
   arma.
   Mantén consistencia entre la trayectoria visual y la trayectoria autoritativa.
   No conviertas accidentalmente los proyectiles en hitscan.
   No permitas disparar durante estados incompatibles.
   No permitas que una bala impacte dos veces por duplicación de mensajes.
   Evita daños después de terminar la partida.
   Respeta colisiones con coberturas y obstáculos.
   Mantén el funcionamiento correcto de headshots, torso y extremidades.
   Verifica qué ocurre cuando un jugador dispara y muere casi simultáneamente.
   Define si los proyectiles ya disparados siguen existiendo después de morir y aplica la
   misma regla siempre.

4. Latencia y compensación

Prueba el sistema con latencias simuladas de:

   20 ms.
   80 ms.
   150 ms.
   250 ms.

También con jitter, pérdida de paquetes y reconexiones.

   Evita ventajas injustificadas por diferencias de FPS.
   No implementes compensación de lag ilimitada.
   Si utilizas rebobinado de posiciones, establece una ventana temporal máxima.
   Comprueba los impactos contra el estado histórico adecuado sin permitir disparos
   imposibles.
   Evita que un jugador pueda falsificar timestamps para obtener ventaja.
   Muestra ping aproximado y estado de conexión.

5. Controles de móvil
Conserva el sistema táctil actual.

Presta especial atención al modo mantener FUEGO → apuntar → soltar → disparar.

   Un touchcancel nunca debe producir un disparo.
   Pausar no debe disparar.
   Cambiar de arma no debe disparar.
   Girar el teléfono no debe disparar.
   Perder el foco del navegador no debe disparar.
   Una desconexión no debe dejar acciones activadas.
   Un toque duplicado no debe producir dos balas.
   Si el servidor rechaza un disparo, el cliente debe reconciliar munición y estado sin dejar el
   arma bloqueada.

6. Navaja

   Validar alcance real de ataque.
   Validar obstáculos entre atacante y víctima.
   Validar orientación para daño frontal o trasero.
   Evitar ataques repetidos por mensajes duplicados.
   Comprobar ataques durante sprint, slide, salto y cambio de arma.
   No aceptar daño calculado exclusivamente por el cliente.

7. Aparición, muerte y marcador

   No permitir aparecer dentro de paredes.
   Evitar aparición simultánea en el mismo punto.
   Evitar visión directa inicial cuando sea posible.
   No permitir que un jugador muerto siga causando ataques nuevos.
   Evitar registrar una muerte dos veces.
   Definir correctamente empates y muertes simultáneas.
   Garantizar que ambos jugadores reciben el mismo resultado final.
   Reiniciar correctamente salud, munición, posición y estados en la revancha.
   Evitar que una revancha reutilice proyectiles o mensajes de la partida anterior.

8. Desconexiones reales en móviles

Simula:

   iPhone bloqueado.
   Safari enviado a segundo plano.
   Cambio de Wi-Fi a datos móviles.
   Pérdida de Internet durante 5, 15 y 30 segundos.
   Cierre accidental de pestaña.
   Reconexión mientras el otro jugador sigue dentro.

No dependas de que Safari mantenga WebSocket activo en segundo plano.

Al reconectar, recupera el estado desde el servidor mediante una nueva sesión validada.

No crees un tercer jugador por accidente.

9. Seguridad

   Servidor autoritativo para daño, salud y marcador.
   Validación de velocidad y movimiento.
   Rate limiting de mensajes.
   Límites de tamaño de paquetes.
   Códigos de sala difíciles de adivinar y tokens de sesión separados.
   Protección contra spam de creación de salas.
   No registrar tokens ni secretos en logs.
   No incluir credenciales en el cliente.
   No permitir comandos administrativos desde mensajes normales.
   No ejecutar código recibido de jugadores.

10. Pruebas automatizadas obligatorias

Crea pruebas de:

   Creación de sala.
   Entrada del segundo jugador.
   Rechazo de un tercero.
   Códigos incorrectos.
   Inicio de partida.
   Movimiento simultáneo.
   Sprint, slide, salto y crouch.
   Rifle y navaja.
   Balas bloqueadas por paredes.
   Daño y headshots.
   Munición, recarga y cerrojo.
   Disparos duplicados.
   Muertes simultáneas.
   Marcador a 10 bajas.
   Desconexión y reconexión.
   Revancha.
   Latencia artificial.
   Mensajes malformados.
   Intentos de velocidad o cadencia imposibles.
   Dos navegadores reales conectados al mismo servidor.

Mantén también las pruebas existentes del modo PC, móvil y entrenamiento.

11. Observabilidad y depuración

Implementa un panel técnico multijugador con:

   Ping.
   Estado WebSocket.
   Tick del servidor.
   Frecuencia de snapshots.
   Pérdida de conexión detectada.
   Desfase de predicción.
   Último disparo aceptado o rechazado.
   Motivo de rechazo cuando sea apropiado.

Usa identificadores de eventos para poder relacionar errores del cliente con logs del servidor.

Puedes utilizar Sentry, ya conectado, para errores relevantes, sin enviar datos personales
innecesarios ni credenciales.

12. Despliegue seguro

No supongas que GitHub Pages puede alojar el servidor WebSocket.

Evalúa Cloudflare Durable Objects y otras alternativas compatibles con conexiones
persistentes.

Si eliges Cloudflare, estudia la hibernación de WebSockets y la persistencia necesaria para
recuperar salas. No guardes únicamente en memoria volátil datos imprescindibles para
recuperar una partida.

No contrates ni actives recursos de pago sin mi aprobación.

Despliega primero en un entorno de pruebas.

Verifica que la web pública puede conectarse mediante WSS, que no hay errores de origen ni
problemas de certificados.

Mantén una versión estable anterior y una forma de revertir cambios.

13. Desarrollo y corrección automática
  En cada subfase:

   1. Analiza el código existente.
   2. Identifica riesgos antes de modificarlo.
   3. Implementa cambios pequeños y verificables.
   4. Ejecuta pruebas unitarias y de integración.
   5. Prueba con dos clientes reales de navegador cuando sea posible.
   6. Simula errores de red.
   7. Corrige los problemas encontrados.
   8. Repite las pruebas de regresión.
   9. Documenta los errores detectados y su solución.
  10. Solo entonces prepara el siguiente paso.

  No declares una fase terminada porque pasen únicamente los tests simulados.

  Distingue siempre entre pruebas automáticas, navegador real y pruebas manuales pendientes
  en dos móviles físicos.

  Objetivo final: que dos personas puedan entrar desde redes diferentes, moverse, apuntar,
  disparar, recibir daño, morir, reaparecer y jugar una revancha sin reiniciar la web.

  Prioriza estabilidad, precisión y facilidad de depuración sobre funcionalidades secundarias.

  No reescribas desde cero los sistemas que ya funcionan.

  Empieza por una auditoría técnica de D1 y una matriz de riesgos. Después implementa el
  multijugador progresivamente, sin pedirme confirmación para cada cambio menor, pero
  respetando los permisos y aprobaciones de seguridad.




Mi recomendación técnica adicional
Para Sniper Duel, estudiaría especialmente Cloudflare Durable Objects con WebSockets, porque
ya tienes Cloudflare conectado y este modelo puede encajar bien con una sala privada de dos
jugadores.

Pero hay que evaluar sus límites de ejecución, facturación, persistencia y simulación antes de decidir.
Tener un conector conectado no significa que el servidor esté desplegado ni que todo sea gratuito.

También evitaría intentar implementar de golpe compensación de lag avanzada, anticheat completo,
matchmaking y cuentas de usuario. Primero conseguiría que dos jugadores puedan conectarse y
combatir de manera consistente.
El primer objetivo de calidad sería una partida completa a 10 bajas y una revancha desde dos
móviles en redes diferentes, sin desconexiones irrecuperables, disparos duplicados ni
marcadores contradictorios. Cuando eso funcione, tendremos una base sólida para ampliar Sniper
Duel a 2vs2 y 3vs3.
```
