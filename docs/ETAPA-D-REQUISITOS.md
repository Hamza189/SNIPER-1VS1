# Etapa D — requisitos de prevención de errores (pendiente)

Recibido el 9-10-2026. EN CURSO: Hamza pidió hacerlo ya (prompt maestro 1vs1 online + protocolo de autocorrección, abajo).
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

---

## Documento recibido: 871e0b9f-Juego_simple_monetizable_2.pdf

```text
Para conseguir que mañana por la noche puedas jugar a Sniper Duel con tu novia, cambiaría la
estrategia de desarrollo: dejaría de añadir funcionalidades secundarias y pondría a Claude a trabajar
en una versión multijugador 1vs1 completamente jugable.

No significa que haya que abandonar tus ideas de futuro. Significa que debemos separar lo
imprescindible para mañana de todo lo que convertirá Sniper Duel en un juego competitivo completo.

La prioridad absoluta será que ambos podáis abrir la web desde vuestros móviles, crear una sala
privada, veros, moveros, dispararos, recibir daño y terminar una partida con ganador. Y que podáis
repetirla.

Es un objetivo ambicioso para un día. No puedo garantizar que Claude consiga implementarlo y
desplegarlo todo a tiempo, especialmente porque todavía no hemos probado un servidor online real.
Por eso el siguiente prompt incluye prioridades, alternativas y pruebas de aceptación muy estrictas.


El orden que seguiría

       Conexión online
 01
       Dos móviles conectados desde redes diferentes

       Sala privada
 02
       Crear sala, compartir código, entrar y comenzar

       Dos jugadores reales
 03
       Movimiento, orientación y modelos sincronizados

       Combate
 04
       Rifle, proyectiles, obstáculos, daño y muertes

       Partida completa
 05
       Marcador, reaparición, victoria y revancha

       Estabilidad
 06
       Reconexiones, latencia, Safari, pruebas y despliegue


Prompt maestro para Claude — Sniper Duel 1vs1
Este mensaje está pensado para enviarlo entero, sin dividirlo. Le da autonomía para desarrollar,
probar y corregir, pero le exige preservar el juego actual y no declarar éxito sin comprobarlo.


   SNIPER DUEL — OPERACIÓN 1VS1 ONLINE JUGABLE
   MAÑANA POR LA NOCHE
   MISIÓN PRINCIPAL

   Quiero que actúes como desarrollador principal, arquitecto de networking, programador de
   gameplay, ingeniero de pruebas, especialista en rendimiento móvil y responsable del
despliegue de Sniper Duel.

Mi objetivo es que mañana por la noche pueda jugar una partida 1vs1 real contra mi
novia, cada uno desde su propio móvil y desde redes diferentes.

No quiero únicamente una demostración de conexión ni dos jugadores moviéndose sin poder
combatir. Quiero un videojuego funcional en el que podamos crear una sala, entrar, movernos,
apuntar, dispararnos, recibir daño, morir, reaparecer, ganar y jugar una revancha.

Tienes autonomía para analizar, programar, ejecutar pruebas, corregir errores y preparar
versiones, dentro de los permisos que tengas disponibles.

No me interrumpas para aprobar cambios pequeños y seguros. Agrupa las decisiones que
realmente necesiten mi intervención.

No eludas confirmaciones obligatorias de seguridad, no generes gastos sin aprobación y no
destruyas ni sustituyas versiones estables.

REGLA FUNDAMENTAL: prioriza conseguir una partida 1vs1 completa mañana sobre
añadir funcionalidades secundarias.



1. AUDITORÍA DEL PROYECTO ACTUAL
Antes de escribir código, inspecciona realmente el repositorio SNIPER-1VS1 y su arquitectura.

El proyecto utiliza Three.js y JavaScript, con cliente web publicado en GitHub Pages.

El juego ya tiene, según las fases anteriores:

   Rifle HALCÓN R7 con cinco balas.
   Balística con velocidad de 600 m/s, gravedad y mira calibrada.
   Mecánica de cerrojo y recarga.
   Apuntado con telescopio.
   Disparo desde la cadera.
   Movimiento con sprint, salto, crouch y slide.
   Simulación fija a 120 Hz e interpolación.
   Navaja táctica con daño frontal y trasero.
   Entrenamiento y duelo contra bots.
   Controles de ratón y teclado.
   Controles multitáctiles para móviles.
   Joystick dinámico.
   HUD móvil personalizable.
   Sensibilidades configurables.
   Modo de mantener FUEGO para apuntar y soltar para disparar, si su implementación ya
   está completada.
   Autotests de puntería y pruebas automatizadas.

No presupongas que todas estas funciones están correctas solo porque aparecen en la
documentación. Verifica el estado actual del código y las pruebas.

Identifica:

 1. Qué módulos pueden reutilizarse en el servidor.
 2. Qué reglas están mezcladas con el renderizado.
 3. Qué partes del combate dependen del cliente.
 4. Qué estados de armas deben sincronizarse.
 5. Qué componentes de movimiento son deterministas o reutilizables.
 6. Qué colisiones y geometría necesitan existir también en el servidor.
 7. Qué errores conocidos siguen pendientes.
 8. Qué funcionalidades pueden posponerse sin impedir el 1vs1.

No reescribas el juego desde cero.

Mantén intactos los modos offline y las configuraciones de PC y móvil.


2. PRIORIDADES Y PLAZO
Organiza el trabajo en tres niveles.

P0 — OBLIGATORIO PARA MAÑANA

   Servidor online funcional.
   Cliente publicado accesible por HTTPS.
   Conexión segura mediante WSS.
   Crear sala privada.
   Unirse mediante código.
   Dos jugadores conectados.
   Iniciar partida.
   Mismo mapa para ambos.
   Posiciones y orientaciones sincronizadas.
   Movimiento básico, sprint, crouch, salto y slide.
   Rifle funcional.
   Disparos visibles.
   Colisiones con paredes.
   Daño validado por servidor.
  Salud.
  Muertes.
  Reaparición.
  Marcador.
  Victoria.
  Revancha.
  Controles móviles.
  Recuperación básica de desconexiones.
  Pruebas con dos clientes independientes.
  Despliegue público comprobado.

P1 — MUY IMPORTANTE SI P0 ESTÁ ESTABLE

  Navaja online.
  Animaciones completas de jugadores.
  Sincronización visual de recargas y cerrojo.
  Efectos de disparo e impactos.
  Sonido espacial.
  Indicador de ping.
  Interpolación más avanzada.
  Reconexión tras cambios de red.
  Mejoras de rendimiento móvil.
  Ajustes de HUD específicos para PvP.
  Pantalla de resultados más elaborada.

P2 — POSPONER HASTA DESPUÉS

  Cuentas de usuario.
  Estadísticas persistentes.
  Clasificaciones globales.
  Matchmaking público.
  2vs2 y 3vs3.
  Tienda de cosméticos.
  Monetización.
  Pase de batalla.
  Amigos.
  Chat de voz.
  Sistema de clanes.
  Múltiples mapas nuevos.
  Personalización compleja de armas.
  Anticheat avanzado.
   Sistema de repeticiones.
   Aplicaciones nativas.

No dediques tiempo a P2 mientras exista un fallo que impida completar P0.


3. INFRAESTRUCTURA Y SERVIDOR
Tenemos conectores disponibles para Cloudflare Developer Platform, Supabase, Netlify, Sentry,
Context7, Figma y Linear.

Evalúa qué herramientas puedes utilizar realmente en este entorno.

Mi preferencia inicial es estudiar Cloudflare Durable Objects con WebSockets para alojar salas
privadas de dos jugadores.

No elijas esta arquitectura únicamente porque Cloudflare está conectado. Comprueba que
permite ejecutar correctamente la simulación que necesitamos, que el modelo de facturación es
aceptable y que los límites técnicos encajan.

Si Durable Objects no resulta adecuado para un servidor autoritativo de disparos y físicas,
propón una alternativa Node.js con WebSocket en un servicio compatible.

Prioriza:

   Fiabilidad.
   Facilidad de despliegue.
   Latencia razonable.
   Bajo coste.
   Simplicidad.
   Capacidad de depuración.
   Seguridad.

No dependas de procesos persistentes en GitHub Pages.

El cliente seguirá pudiendo alojarse en GitHub Pages.

Utiliza variables de entorno para configuración y secretos.

Nunca introduzcas tokens administrativos en el JavaScript público.

No actives servicios de pago ni suscripciones sin mi aprobación.

No afirmes que el servidor está desplegado hasta comprobar su URL pública y realizar una
conexión real.
4. PROTOCOLO MULTIJUGADOR
Diseña un protocolo versionado y validado.

Necesitamos mensajes para:

   Conectar.
   Crear sala.
   Unirse a sala.
   Confirmar identidad.
   Jugador listo.
   Iniciar partida.
   Enviar comandos de movimiento.
   Recibir snapshots.
   Solicitar disparo.
   Confirmar o rechazar disparo.
   Crear proyectil.
   Impacto.
   Daño.
   Muerte.
   Reaparición.
   Cambio de arma.
   Ataque de navaja.
   Actualización de marcador.
   Victoria.
   Revancha.
   Ping.
   Desconexión.
   Reconexión.
   Error.

No utilices un protocolo improvisado sin documentación.

Valida todos los mensajes recibidos.

Define tamaños máximos, frecuencia máxima y comportamiento ante datos incorrectos.

Incluye identificadores de sesión, jugador, sala y partida.

Usa números de secuencia para evitar aplicar estados antiguos sobre nuevos.

No confíes en identificadores enviados por el cliente sin verificar su sesión.
5. CREAR SALA Y UNIRSE
Añade MULTIJUGADOR al menú principal.

Al entrar:

CREAR SALA

UNIRSE A SALA

Si pulso CREAR SALA:

   El servidor genera un código aleatorio de seis caracteres.
   Se crea una sala privada.
   Aparece el código en pantalla.
   Aparece un botón COPIAR CÓDIGO.
   Aparece un botón COMPARTIR INVITACIÓN.
   Se muestra un enlace que pueda enviar por WhatsApp.
   Se indica ESPERANDO AL SEGUNDO JUGADOR.

El enlace de invitación debe abrir el juego y facilitar la entrada en esa sala.

Si mi novia abre el enlace:

   Se carga la web.
   Se muestra la invitación.
   Puede elegir un nombre.
   Entra en la sala si sigue disponible.
   No necesita crear una cuenta.
   No necesita instalar una aplicación.

El código de sala no debe servir como credencial administrativa.

El servidor debe rechazar a un tercer jugador.

Si la sala ya está llena, debe mostrar un mensaje claro.

Si el código no existe, también.

Si alguien pierde la conexión, debe poder recuperar su puesto mediante un token de
reconexión seguro.



6. LOBBY
Antes de empezar la partida, quiero ver:
   Mi nombre.
   El nombre de mi novia.
   Estado de conexión.
   Estado PREPARADO.
   Botón LISTO.
   Botón EMPEZAR cuando ambos estén preparados.
   Botón SALIR.

No permitas empezar con un solo jugador.

Evita que dos pulsaciones simultáneas creen dos partidas.

La transición de lobby a partida debe producirse una sola vez y estar coordinada por el servidor.

Al comenzar, ambos jugadores deben recibir el mismo identificador de partida y las mismas
reglas.



7. DOS JUGADORES VISIBLES
Cada jugador debe tener una representación 3D visible para el rival.

No es necesario crear un personaje hiperrealista mañana.

Prioriza un modelo sencillo, reconocible y correctamente animado.

El modelo remoto debe mostrar:

   Posición.
   Dirección del cuerpo.
   Orientación del arma.
   Movimiento.
   Sprint.
   Agacharse.
   Slide.
   Salto.
   Disparo.
   Muerte.

El jugador local debe seguir viendo su arma en primera persona.

No renderices el cuerpo remoto exactamente como el arma de primera persona.

Separa representación local y remota.
Evita que el modelo remoto aparezca dentro del suelo o flote.

No permitas que los jugadores se atraviesen o atraviesen paredes debido a errores de
sincronización.



8. MOVIMIENTO ONLINE
Conserva la sensación del movimiento actual.

No cambies arbitrariamente:

   Velocidad al caminar.
   Sprint.
   Fricción.
   Salto.
   Slide.
   Aceleración.
   Control aéreo.
   Colisiones.

Reutiliza las reglas existentes cuando sea posible.

El cliente puede predecir su movimiento para mantener respuesta inmediata.

El servidor debe validar la posición y el movimiento.

Implementa reconciliación sin producir correcciones visuales violentas.

El servidor debe detectar velocidades imposibles y desplazamientos ilegales.

No permitas que un cliente modificado pueda teletransportarse libremente.

La simulación no debe depender de que el móvil funcione a 30, 60 o 120 FPS.

Define claramente la frecuencia del servidor, la de snapshots y la de renderizado.

No asumas que un servidor necesita ejecutar exactamente el mismo bucle de 120 Hz del
cliente.


9. RIFLE HALCÓN R7 ONLINE
Esta es una de las partes más importantes.

Quiero conservar la sensación actual del rifle.
Mantén:

   Cinco balas.
   Velocidad de proyectil.
   Gravedad.
   Caída balística.
   Calibración de mira.
   Cerrojo.
   Recarga.
   Cadencia.
   Retroceso.
   Dispersión desde la cadera.
   Daño por zona corporal.

No sustituyas la balística por un raycast instantáneo únicamente para simplificar el multijugador.

El servidor debe ser autoritativo sobre:

   Munición.
   Estado del cerrojo.
   Recarga.
   Validez del disparo.
   Proyectiles.
   Colisiones.
   Impactos.
   Daño.
   Muertes.

El cliente puede mostrar efectos inmediatos para evitar sensación de retraso.

Pero un efecto visual local no debe equivaler a un impacto confirmado.

Los proyectiles deben tener identificadores únicos.

No se deben duplicar impactos.

No se debe poder disparar dos veces durante el cerrojo.

No se debe disparar durante recargas incompatibles.

No se debe disparar estando muerto.

Los obstáculos deben bloquear balas correctamente.

Prueba impactos en cabeza, torso, piernas, paredes y coberturas.
10. COMPENSACIÓN DE LATENCIA
No quiero que un jugador con mejor conexión gane automáticamente por problemas de
sincronización.

Implementa primero una solución sencilla y estable.

Después, si es necesario, añade compensación de lag acotada.

Considera que los proyectiles tienen tiempo de vuelo.

No apliques técnicas de compensación de impactos instantáneos sin adaptarlas a proyectiles
balísticos.

Los timestamps enviados por clientes no deben ser autoridad absoluta.

Mantén una ventana histórica limitada cuando corresponda.

No aceptes disparos que supuestamente ocurrieron hace varios segundos.

Prueba latencias de 20, 80, 150 y 250 ms.

Prueba jitter y pérdida de paquetes.

No confundas una prueba simulada con el rendimiento real de Internet.



11. NAVAJA ONLINE
Si P0 ya está estable, incorpora la navaja.

Mantén:

   Alcance de aproximadamente dos metros.
   Daño frontal.
   Daño trasero.
   Comprobación de orientación.
   Bloqueo por paredes.
   Intervalo entre ataques.
   Cambio de arma.
   Animaciones.

El servidor debe validar los ataques.

No debe aceptar que el cliente indique directamente cuánto daño ha causado.
Comprueba ataques mientras el jugador corre, salta, se desliza o cambia de arma.

No permitas ataques duplicados.


12. CONTROLES MÓVILES
Conserva la Etapa B.

No rompas:

   Joystick dinámico.
   Sprint.
   Cámara táctil.
   Multitáctil.
   Mira.
   Fuego.
   Salto.
   Agacharse.
   Slide.
   Recarga.
   Cambio de arma.
   Editor de HUD.
   Sensibilidad.
   Guardado de configuración.

Especialmente importante:

Mantener FUEGO para apuntar, arrastrar para corregir la puntería y soltar para disparar.

Si esa opción ya está implementada, reutilízala.

Si sigue incompleta, termínala y pruébala.

El evento touchcancel no debe disparar.

Perder el foco no debe disparar.

Pausar no debe disparar.

Cambiar de arma no debe disparar.

Bloquear el teléfono no debe disparar.

Girar el móvil no debe disparar.
Evita que una pulsación genere dos disparos.

En multijugador, pausar el menú no debe congelar el servidor ni detener la partida del rival.

Si el jugador queda inactivo, el servidor debe gestionarlo de forma segura.


13. CONTROLES DE PC
Mantén el soporte para ratón y teclado.

Verifica Pointer Lock real.

El ratón debe permitir girar indefinidamente 360 grados en ambas direcciones.

No limites la cámara a los bordes de la ventana.

Comprueba entrada y salida de Pointer Lock.

Comprueba Escape, cambio de pestaña y reanudación.

No alteres las sensibilidades del PC al modificar las del móvil.


14. MAPA Y PUNTOS DE APARICIÓN
Para la primera versión utiliza el mapa existente si es adecuado.

No dediques horas a construir otro mapa antes de tener el 1vs1 funcionando.

Define dos zonas de aparición.

Evita que ambos jugadores aparezcan superpuestos.

Evita posiciones dentro de edificios o paredes.

Evita, cuando sea posible, línea de visión directa al inicio.

Comprueba que el mapa que usa el servidor coincide con el que renderiza el cliente.

Si la geometría visual y la geometría de colisiones son diferentes, documenta esa diferencia y
evita impactos imposibles.

No generes coberturas visuales que no existan para el servidor.


15. REGLAS DEL DUELO
Para la primera versión:
   Dos jugadores.
   Sin bots.
   Diez bajas para ganar.
   Salud completa al reaparecer.
   Munición restablecida según reglas definidas.
   Marcador sincronizado.
   Pantalla de victoria.
   Pantalla de derrota.
   Revancha.

Muestra:

TUS BAJAS

BAJAS DEL RIVAL

PING

ESTADO DE CONEXIÓN

Evita registrar una muerte dos veces.

Gestiona muertes simultáneas de forma consistente.

No permitas seguir disparando después del final.

Al iniciar revancha:

   Limpia proyectiles antiguos.
   Reinicia salud.
   Reinicia munición.
   Reinicia posiciones.
   Reinicia marcador.
   Reinicia estados de armas.
   Conserva la sala y sus dos jugadores.



16. RECONEXIONES
Esto es especialmente importante en iPhone.

Safari puede suspender la página al bloquear el teléfono o cambiar de aplicación.

No presupongas que el WebSocket seguirá activo.

Detecta:
   Desconexión.
   Pérdida temporal de red.
   Cambio de Wi-Fi a datos móviles.
   Vuelta desde segundo plano.
   Cierre y reapertura de la página.

Implementa reconexión con backoff y límites.

No crees jugadores duplicados.

No permitas que un tercero robe una sesión desconectada.

Durante la reconexión muestra:

RECONECTANDO...

Al recuperar conexión, solicita un snapshot completo del estado actual.

Si no se puede recuperar la sesión, muestra un mensaje claro y ofrece volver al menú.

No dejes la pantalla bloqueada indefinidamente.


17. INTERFAZ MULTIJUGADOR
Mantén la identidad visual de Sniper Duel.

Quiero una interfaz limpia, militar y legible en móviles.

Necesitamos:

   Menú MULTIJUGADOR.
   Crear sala.
   Unirse a sala.
   Campo de código.
   Botón copiar.
   Botón compartir.
   Lobby.
   Lista de jugadores.
   Estado preparado.
   Indicador de conexión.
   Indicador de ping.
   Marcador.
   Aviso de daño.
   Aviso de muerte.
   Pantalla de victoria.
   Pantalla de derrota.
   Revancha.
   Salir al menú.

Evita ventanas que tapen los controles durante el combate.

Respeta áreas seguras de iPhone.

No permitas zoom accidental ni desplazamiento de página.

El diseño debe adaptarse a pantallas pequeñas.

No hace falta utilizar Figma para cada pantalla si eso retrasa el objetivo.



18. SONIDO Y EFECTOS
Si P0 está terminado, mejora la presentación del combate online.

Sincroniza:

   Disparos del rival.
   Impactos.
   Recargas.
   Cerrojo.
   Pasos.
   Navaja.
   Muertes.

Utiliza audio espacial cuando corresponda.

No reproduzcas el mismo disparo dos veces por predicción y confirmación del servidor.

Evita reproducir sonidos antiguos después de reconectar.

No hagas que los efectos visuales dependan de recibir snapshots completos.

Mantén el rendimiento móvil.



19. RENDIMIENTO EN IPHONE Y ANDROID
No conviertas la optimización en un proyecto separado antes de terminar P0.

Haz las optimizaciones imprescindibles para jugar.
Evita:

   Crear objetos innecesarios cada frame.
   Fugas de memoria.
   Texturas excesivamente grandes.
   Efectos de partículas descontrolados.
   Renderizar modelos invisibles.
   Actualizar interfaces constantemente sin necesidad.
   Enviar demasiados mensajes por WebSocket.
   Crear geometría nueva para cada snapshot.

Añade, si es necesario, un perfil gráfico móvil ligero.

No reduzcas la precisión de la simulación de combate para conseguir más FPS.

Distingue entre FPS del cliente, ticks del servidor y frecuencia de red.

No prometas 60 FPS constantes sin pruebas en dispositivos físicos.



20. SEGURIDAD BÁSICA
El servidor debe validar:

   Identidad de sesión.
   Sala.
   Estado de partida.
   Velocidad.
   Movimiento.
   Munición.
   Cadencia.
   Daño.
   Distancia de navaja.
   Colisiones.
   Frecuencia de mensajes.

No aceptes mensajes de daño arbitrario.

No aceptes coordenadas de impacto como verdad absoluta.

No permitas disparar desde posiciones imposibles.

No permitas entrar en una sala llena.

No expongas credenciales.
Limita el número de salas y mensajes para evitar abusos.

Los códigos de sala deben generarse con aleatoriedad segura.

Separa el código compartible de cualquier token de reconexión.

No implementes mecanismos de seguridad complejos que retrasen P0 si existe una solución
sencilla y correcta.


21. PRUEBAS AUTOMÁTICAS
Crea pruebas de integración con dos clientes.

No te limites a mocks del protocolo.

Comprueba:

 1. Crear sala.
 2. Entrar con segundo jugador.
 3. Rechazar tercero.
 4. Rechazar código inexistente.
 5. Ambos preparados.
 6. Inicio único.
 7. Posiciones sincronizadas.
 8. Orientación sincronizada.
 9. Movimiento.
10. Sprint.
11. Slide.
12. Salto.
13. Crouch.
14. Disparo.
15. Trayectoria balística.
16. Colisión con pared.
17. Headshot.
18. Daño corporal.
19. Munición.
20. Cerrojo.
21. Recarga.
22. Disparo duplicado.
23. Cambio de arma.
24. Navaja, si está incluida.
25. Muerte.
26. Reaparición.
27. Marcador.
28. Victoria.
29. Revancha.
30. Desconexión.
31. Reconexión.
32. Mensajes antiguos.
33. Mensajes malformados.
34. Latencia.
35. Jitter.
36. Pérdida de paquetes.
37. Reinicio de partida.
38. Salida al menú.
39. Modo offline sin regresiones.
40. Controles táctiles sin regresiones.

Conserva y ejecuta las pruebas existentes del proyecto.

No modifiques pruebas simplemente para ocultar fallos.

Si una prueba falla porque su expectativa era incorrecta, explica por qué y documenta la
corrección.


22. PRUEBAS REALES DE NAVEGADOR
Cuando sea posible, abre dos navegadores independientes conectados al mismo servidor.

No basta con dos pestañas compartiendo accidentalmente la misma sesión.

Utiliza perfiles o contextos independientes.

Comprueba:

    Jugador A crea sala.
    Jugador B entra.
    Ambos se ven.
    A se mueve y B observa.
    B se mueve y A observa.
    A dispara a B.
    B recibe daño.
    B dispara a A.
    A recibe daño.
   Uno muere.
   Ambos ven el mismo marcador.
   Se completa una partida.
   Ambos ven el resultado correcto.
   Ambos aceptan revancha.
   La segunda partida empieza correctamente.

Después prueba los dos clientes desde la URL pública.

Si no puedes realizar pruebas físicas en iPhone y Android, indícalo claramente.

No afirmes haberlas realizado.



23. PRUEBAS DE FALLOS Y CONDICIONES EXTREMAS
Simula:

   20 ms de latencia.
   80 ms.
   150 ms.
   250 ms.
   Jitter.
   Pérdida de paquetes.
   Mensajes duplicados.
   Mensajes desordenados.
   Cierre de conexión.
   Reapertura.
   Cliente lento.
   Servidor reiniciado.
   Jugador que abandona.
   Jugador que intenta entrar dos veces.
   Disparo durante recarga.
   Disparo durante muerte.
   Disparo al terminar la partida.
   Dos muertes simultáneas.
   Revancha mientras llegan mensajes antiguos.
   Cambio de orientación móvil.
   Touchcancel.
   Pérdida de foco.

Corrige primero los errores que impidan jugar.
No pierdas horas intentando solucionar problemas cosméticos mientras el 1vs1 todavía no
funciona.


24. REGISTROS Y DEPURACIÓN
Amplía el panel F3 con información de red:

   Estado de conexión.
   Ping.
   Identificador de sala abreviado.
   Tick del servidor.
   Frecuencia de snapshots.
   Estado de sincronización.
   Último disparo confirmado.
   Último disparo rechazado.
   Motivo de rechazo.
   Errores recientes.

No muestres tokens secretos.

Registra eventos importantes en el servidor.

Si Sentry está disponible y configurado, úsalo para capturar excepciones relevantes.

No envíes información sensible innecesaria.

Distingue errores del cliente y del servidor.



25. DESPLIEGUE
Prepara un despliegue real.

El cliente puede permanecer en:

https://hamza189.github.io/SNIPER-1VS1/

El servidor debe tener su propia dirección segura.

No inventes una URL de servidor.

No pongas localhost como endpoint de producción.

No declares el despliegue completado hasta verificarlo.

Comprueba:
   HTTPS.
   WSS.
   Certificados.
   CORS y validación de origen cuando correspondan.
   Configuración del cliente.
   Estado del servidor.
   Conexión desde la página pública.
   Dos sesiones independientes.
   Ausencia de errores críticos de consola.

Mantén una versión anterior recuperable.

No publiques una versión que rompa completamente el modo offline.

Si el servidor falla, el juego debe seguir permitiendo entrenamiento y partidas contra bots.


26. AUTOMATIZACIÓN
Quiero que trabajes con autonomía.

Puedes:

   Analizar archivos.
   Modificar código.
   Crear módulos.
   Ejecutar pruebas.
   Depurar.
   Consultar documentación.
   Corregir errores.
   Preparar commits.
   Repetir pruebas.

No me preguntes por cada pequeña decisión técnica.

Pero no debes:

   Saltarte confirmaciones obligatorias.
   Exponer secretos.
   Contratar servicios.
   Generar gastos sin aprobación.
   Borrar versiones estables.
   Desactivar medidas de seguridad.
   Afirmar que una prueba pasó sin ejecutarla.
Si encuentras un bloqueo, investiga alternativas razonables antes de pedirme ayuda.

Si necesitas una autorización de Cloudflare o de otro proveedor, explícame exactamente qué
debo aprobar.



27. PLAN DE EMERGENCIA PARA LLEGAR A MAÑANA
Si el tiempo no permite terminar todas las características, reduce el alcance en este orden:

Primero posponer cosméticos.

Después sonidos avanzados.

Después animaciones secundarias.

Después navaja online.

Después optimización gráfica avanzada.

Después compensación de lag avanzada.

Pero no elimines:

   Dos jugadores reales.
   Sala privada.
   Conexión online.
   Movimiento.
   Rifle.
   Disparos.
   Daño.
   Muertes.
   Marcador.
   Victoria.
   Revancha.

No sustituyas la partida real por una simulación de bots.

Si existe un bloqueo que impide completar una función obligatoria, informa del bloqueo y de la
alternativa técnicamente viable. No finjas que está resuelto.


28. CRITERIOS PARA DECLARAR ÉXITO
La Etapa D solo puede considerarse terminada cuando:
 1. El juego público carga correctamente.
 2. Puedo crear una sala desde un móvil.
 3. Mi novia puede entrar desde otro móvil.
 4. Ambos aparecemos en el mismo mapa.
 5. Ambos podemos movernos.
 6. Ambos podemos ver al rival.
 7. Ambos podemos apuntar y disparar.
 8. Las balas respetan obstáculos.
 9. El servidor valida los impactos.
10. Ambos vemos el mismo daño y marcador.
11. Podemos morir y reaparecer.
12. Podemos terminar una partida.
13. Ambos vemos el ganador correcto.
14. Podemos jugar una revancha.
15. El modo offline sigue funcionando.
16. No hay errores críticos de consola o servidor.
17. El despliegue público ha sido comprobado.

Distingue los criterios comprobados automáticamente de los pendientes de prueba manual con
dos móviles.


29. INFORMES DE PROGRESO
Después de cada bloque importante, informa brevemente:

   Qué has implementado.
   Qué has probado realmente.
   Qué errores has encontrado.
   Qué has corregido.
   Qué sigue pendiente.
   Si la versión pública es jugable.
   Qué necesitas de mí, si algo requiere autorización.

No me des informes excesivamente largos mientras todavía queda trabajo crítico.

Prioriza ejecutar, probar y corregir.


30. OBJETIVO FINAL
Quiero que mañana por la noche podamos hacer exactamente esto:

Abro Sniper Duel en mi iPhone.
Pulso MULTIJUGADOR.

Pulso CREAR SALA.

Copio el enlace.

Se lo envío a mi novia por WhatsApp.

Ella abre el enlace desde su móvil.

Entra en mi sala.

Nos marcamos como preparados.

Empieza una cuenta atrás de tres segundos.

Aparecemos en lados diferentes del mapa.

Corremos, nos cubrimos, nos deslizamos, apuntamos con el francotirador y nos disparamos.

Las balas tienen trayectoria y caída real.

Recibimos daño y podemos morir.

Reaparecemos.

El marcador llega a diez bajas.

Aparece un ganador.

Pulsamos REVANCHA.

Y volvemos a jugar sin tener que cerrar la página.

Eso es lo que quiero conseguir.

Empieza ahora auditando el proyecto y construyendo la versión mínima online jugable.

No empieces por efectos visuales ni funcionalidades secundarias.

No reescribas el juego desde cero.

No sacrifiques la seguridad básica.

No declares completada la etapa sin comprobar el funcionamiento real.

Quiero que concentres el esfuerzo en conseguir un 1vs1 estable, preciso y divertido, lo antes
posible.
Lo que yo vigilaría personalmente
Hay tres puntos donde probablemente Claude encontrará las mayores dificultades.

Primero, la balística online. Tu rifle no dispara rayos instantáneos: las balas tienen velocidad y
gravedad. El servidor deberá reproducir esas trayectorias de manera consistente, sin que la bala
visual y la bala real acaben en sitios diferentes.

Segundo, el movimiento. Sniper Duel tiene slide, sprint, salto y físicas bastante rápidas. Si el
servidor corrige la posición demasiado bruscamente, notarás tirones. Si confía demasiado en el
cliente, aparecerán desincronizaciones y posibles trampas.

Tercero, Safari de iPhone. Cuando se bloquea el teléfono, se cambia de aplicación o se pierde
cobertura, el navegador puede suspender la conexión. La partida no debe romperse
permanentemente por eso.

Y una decisión importante: no intentaría implementar todavía 2vs2, 3vs3 ni matchmaking público.
Una vez que el 1vs1 funcione bien, tendremos la arquitectura necesaria para ampliar el juego con
bastante más seguridad.

Mi objetivo para mañana sería una versión alfa privada real, no un videojuego comercial terminado.
Si conseguimos una partida completa entre vosotros dos, desde dos redes distintas y con revancha,
será un hito enorme para Sniper Duel.
```

---

## Documento recibido: f579cb0b-Juego_simple_monetizable_3.pdf

```text
Para que Claude consiga tener Sniper Duel listo para jugar mañana por la noche, lo mejor es darle
algo más útil que otra lista de funcionalidades: un protocolo de diagnóstico, autocorrección,
pruebas y recuperación de errores.

Así, cuando encuentre un fallo, tendrá instrucciones concretas para investigar su causa, corregirlo,
comprobar que no ha roto otra cosa y continuar sin preguntarte constantemente.

También quiero evitar un problema típico del desarrollo asistido por IA: que Claude arregle un error
modificando varias partes del juego, provoque otros tres y termine perdiendo tiempo. La solución es
trabajar con cambios pequeños, pruebas reproducibles y versiones estables.

Este prompt complementa el anterior. Puedes enviárselo directamente.


Prompt de autocorrección y optimización de Sniper Duel


  SNIPER DUEL — PROTOCOLO MAESTRO DE
  AUTOCORRECCIÓN, DEPURACIÓN Y ESTABILIZACIÓN
  MISIÓN

  Quiero que actúes como ingeniero principal de calidad, arquitectura, networking, gameplay,
  rendimiento y despliegue de Sniper Duel.

  Tu misión es detectar, diagnosticar, corregir y prevenir los errores que puedan impedir que
  mañana por la noche juegue un 1vs1 real contra mi novia desde dos móviles diferentes.

  Este protocolo complementa todas las instrucciones anteriores de la Etapa D.

  Tu prioridad es entregar una versión alfa privada jugable, estable y verificable, no una
  versión cargada de funciones incompletas.

  No me preguntes por cada pequeño error. Investiga y corrige autónomamente dentro de los
  permisos disponibles.

  No omitas autorizaciones obligatorias, no generes gastos sin permiso y no declares
  solucionado un fallo sin verificarlo.


  1. SISTEMA UNIVERSAL DE AUTOCORRECCIÓN
  Cada vez que encuentres un error, sigue este proceso:

   1. Identifica el síntoma exacto.
   2. Determina si ocurre en PC, móvil, servidor o varios entornos.
 3. Intenta reproducirlo con pasos concretos.
 4. Captura el error de consola, stack trace o evento de red.
 5. Identifica la causa raíz, no solamente el síntoma.
 6. Escribe una prueba de regresión cuando sea viable.
 7. Aplica la corrección más pequeña y segura.
 8. Ejecuta la prueba específica.
 9. Ejecuta las pruebas relacionadas.
10. Ejecuta las pruebas generales.
11. Comprueba que el modo offline sigue funcionando.
12. Documenta la corrección.
13. Continúa con la siguiente tarea.

No cambies cinco sistemas a la vez para corregir un único problema.

Si un arreglo falla dos veces, deja de aplicar parches similares y reconsidera la hipótesis inicial.

Si una solución rompe una característica que antes funcionaba, revierte el cambio o aísla la
regresión antes de continuar.

Nunca conviertas un error real en una prueba artificialmente aprobada.



2. ERRORES DE DESPLIEGUE Y CARGA DEL JUEGO
Error: pantalla negra al abrir GitHub Pages

Posibles causas:

   Archivos JavaScript no encontrados.
   Rutas absolutas incorrectas.
   Error de sintaxis.
   Recursos cargados desde rutas incompatibles con /SNIPER-1VS1/.
   Fallo durante la inicialización de Three.js.
   Error WebGL.
   Archivo generado desactualizado.
   Caché antigua.

Soluciones:

   Inspeccionar consola y pestaña Network.
   Verificar respuestas HTTP de scripts y recursos.
   Comprobar las rutas de build.
   Confirmar que build.py genera los archivos correctos.
   Comparar la versión local con la publicada.
   Mostrar un error visible y útil cuando falle la inicialización.
   Evitar que una pantalla de carga o error permanezca visible después de completarse
   correctamente.

Error: en Claude funciona, pero en GitHub Pages no

Soluciones:

   No depender de APIs especiales del entorno de Claude.
   Probar siempre la URL pública.
   Verificar rutas relativas.
   Verificar políticas de seguridad del navegador.
   Comprobar diferencias de caché.
   Verificar que todos los archivos necesarios están incluidos en el despliegue.

Error: la versión antigua sigue apareciendo

Soluciones:

   Identificar si la caché corresponde al HTML, JavaScript, manifest o service worker.
   Utilizar versionado de recursos cuando corresponda.
   No añadir parámetros aleatorios indiscriminadamente a todas las peticiones.
   Mostrar un identificador de versión en el panel técnico.
   Comprobar el commit realmente publicado.
   Evitar que una PWA antigua mezcle archivos incompatibles con una versión nueva.

Error: GitHub Pages está disponible, pero el servidor no

Soluciones:

   Separar estado del cliente y del backend.
   Verificar endpoint WSS.
   Comprobar DNS y certificados.
   Comprobar configuración de entorno.
   Mostrar SERVIDOR NO DISPONIBLE sin bloquear el entrenamiento offline.
   Implementar reintentos limitados con backoff.



3. ERRORES DE WEBSOCKET
Error: WebSocket connection failed

Comprobar:

   Que la URL sea correcta.
   Que use wss:// desde HTTPS.
   Que el servidor esté desplegado.
   Que acepte el origen esperado.
   Que la ruta exista.
   Que no haya errores de autenticación.
   Que el servicio soporte WebSockets.
   Que no haya fallos de configuración o límites del proveedor.

No usar ws:// ni localhost en producción.

Error: conexión que se cierra inmediatamente

Soluciones:

   Registrar códigos y motivos de cierre.
   Revisar validación de origen.
   Revisar autenticación.
   Revisar versión del protocolo.
   Revisar errores del servidor.
   Revisar límites del proveedor.
   Diferenciar cierres voluntarios de fallos inesperados.

Error: mensajes que llegan desordenados

Aunque WebSocket conserva el orden dentro de una conexión, pueden existir eventos de
distintas sesiones, reconexiones y procesos asíncronos que generen estados obsoletos.

Soluciones:

   Números de secuencia.
   Identificadores de partida.
   Identificadores de sesión.
   Rechazar snapshots obsoletos.
   Ignorar respuestas de una sesión anterior.
   Evitar que operaciones asíncronas antiguas modifiquen una partida nueva.

Error: conexión aparentemente activa pero sin actualizaciones

Soluciones:

   Heartbeat.
   Detección de conexión inactiva.
   Timeout.
   Reconexión.
   Snapshot completo tras recuperar conexión.
   Indicador visible de estado.

No dependas de que el navegador mantenga la conexión activa en segundo plano.


4. ERRORES DE SALAS PRIVADAS
Error: dos jugadores crean salas distintas por accidente

Soluciones:

   Generación de sala exclusivamente en servidor.
   Identificador único de sala.
   Operaciones de creación idempotentes cuando corresponda.
   Evitar crear salas adicionales por doble pulsación.

Error: entra un tercer jugador

Soluciones:

   Comprobar capacidad de sala de forma atómica.
   No depender de un contador mantenido únicamente en el cliente.
   Reservar plazas para jugadores desconectados durante la ventana de reconexión.

Error: dos jugadores tienen el mismo identificador

Soluciones:

   Identidad de sesión asignada y validada por servidor.
   Token de reconexión separado del código de invitación.
   No utilizar nombres visibles como identificadores únicos.

Error: un jugador queda permanentemente en ESPERANDO

Soluciones:

   Máquina de estados.
   Timeouts.
   Heartbeat.
   Limpieza de sesiones abandonadas.
   Actualizaciones del lobby emitidas por servidor.
   Opción de abandonar y volver a entrar.

Error: la partida empieza dos veces
Soluciones:

   Transición atómica de lobby a partida.
   Identificador único de partida.
   Ignorar solicitudes duplicadas.
   No permitir iniciar desde un estado incompatible.


5. ERRORES DE MOVIMIENTO
Error: el rival se teletransporta

Posibles causas:

   Snapshots atrasados.
   Frecuencia insuficiente.
   Correcciones demasiado grandes.
   Predicción incorrecta.
   Estado de reconexión mal restaurado.

Soluciones:

   Buffer de interpolación.
   Secuencias de snapshots.
   Reconciliación.
   Corrección progresiva cuando sea apropiada.
   Teletransporte explícito solamente para respawn o cambios autorizados.
   Diagnóstico del error de posición.

Error: el rival se mueve a saltos

Soluciones:

   Separar renderizado y red.
   Interpolar entre snapshots válidos.
   Medir jitter.
   Ajustar el buffer.
   Evitar usar directamente la última posición recibida sin interpolación.

Error: el jugador atraviesa paredes

Soluciones:

   Colisiones autoritativas.
   Geometría compartida o equivalente entre cliente y servidor.
   Validar movimiento.
   Comprobar penetraciones.
   Corregir estados inválidos.
   Probar esquinas, rampas, saltos y slides.

Error: sprint o slide demasiado rápidos online

Soluciones:

   Validar aceleración y velocidades permitidas según estado.
   Tener en cuenta pendientes y movimiento aéreo.
   Evitar límites simplistas que rechacen movimientos legítimos.
   Reproducir secuencias de entrada en pruebas deterministas.

Error: FPS bajos alteran las físicas

Soluciones:

   Simulación de tiempo fijo.
   Acumulador limitado.
   No usar delta variable directamente para reglas críticas.
   Separar renderizado de simulación.
   Comprobar 30, 60 y 120 FPS.



6. ERRORES DE DISPAROS Y BALÍSTICA
Error: disparo visualmente acertado, pero servidor indica fallo

Investigar:

   Posición de origen del proyectil.
   Dirección del arma.
   Estado de cámara.
   Tiempo de emisión.
   Latencia.
   Colisión con coberturas.
   Diferencias entre geometría visual y servidor.
   Interpolación del objetivo.
   Calibración de la mira.

Soluciones:

   Registrar identificador de disparo.
   Registrar origen y dirección.
   Registrar tick autoritativo.
   Comparar trayectoria visual y autoritativa.
   Visualizar trayectorias en modo depuración.
   Corregir la discrepancia geométrica o temporal real.

No aumentar artificialmente el tamaño de las hitboxes para esconder un error de sincronización.

Error: bala atraviesa una pared

Soluciones:

   Colisión continua o barrido por segmento durante cada paso de simulación.
   Comprobar el primer impacto válido.
   Mantener orden correcto de intersecciones.
   Verificar que el servidor dispone de la cobertura.
   Evitar tunneling con proyectiles rápidos.

Error: bala atraviesa a un jugador

Soluciones:

   Colisión barrida.
   Hitboxes correctamente actualizadas.
   Transformaciones consistentes.
   Comprobar orden temporal.
   Evitar que el proyectil salte sobre una hitbox entre ticks.

Error: doble daño por una sola bala

Soluciones:

   ID único de proyectil.
   Estado de proyectil consumido.
   Registro de impacto único.
   Procesamiento idempotente.
   Evitar aplicar daño en cliente y servidor simultáneamente.

Error: disparo duplicado al soltar FUEGO

Soluciones:

   Máquina de estados del gesto táctil.
   Identificador de pointer/touch.
   Un único evento de disparo por gesto válido.
   No disparar en touchcancel.
   No disparar en pérdida de foco.
   No disparar por pausa.
   Validación de cadencia y munición en servidor.

Error: se dispara durante recarga o cerrojo

Soluciones:

   Estados explícitos del arma.
   Transiciones válidas.
   Temporizadores autoritativos.
   Comandos rechazados cuando corresponda.
   Sincronización de munición.
   Pruebas de acciones simultáneas.

Error: headshots inconsistentes

Soluciones:

   Hitboxes por región corporal.
   Prioridad correcta de intersecciones.
   Transformaciones actualizadas.
   Comprobación de obstáculos.
   Pruebas a varias distancias y orientaciones.



7. ERRORES DE NAVAJA
Error: golpe desde demasiado lejos

   Validar alcance en servidor.
   Validar posición histórica dentro de una ventana razonable.
   No aceptar distancia calculada por el cliente.

Error: golpe a través de pared

   Comprobar línea de visión.
   Comprobar colisión entre atacante y objetivo.
   No confiar en la animación visual.

Error: daño trasero incorrecto

   Utilizar orientación autoritativa del objetivo.
   Definir claramente el ángulo frontal y trasero.
   Probar objetivos quietos y en movimiento.

Error: ataques duplicados

   Identificadores de ataque.
   Control de cooldown.
   Estado de arma.
   Ignorar mensajes repetidos.

Si la navaja online retrasa la primera partida, posponerla. No bloquear P0.



8. ERRORES DE MUERTE Y REAPARICIÓN
Error: jugador muerto sigue disparando

   Bloquear nuevos comandos de ataque.
   Rechazar disparos inválidos en servidor.
   Cancelar gestos táctiles activos.
   Definir comportamiento de proyectiles ya existentes.

Error: marcador suma dos muertes

   Identificador único de evento de muerte.
   Transición de vivo a muerto una sola vez.
   Actualización autoritativa del marcador.
   Ignorar daños posteriores incompatibles.

Error: reaparece dentro de una pared

   Validar puntos de aparición.
   Comprobar ocupación.
   Restaurar orientación.
   Limpiar velocidades y estados incompatibles.

Error: un jugador ve victoria y otro sigue jugando

   Estado final emitido por servidor.
   Identificador de partida.
   Resultado único.
   Rechazar ataques después de finalizar.
   Snapshot final y confirmación de estado.

Error: revancha con balas antiguas
  Limpiar proyectiles.
  Reiniciar armas.
  Reiniciar temporizadores.
  Reiniciar estados.
  Crear nueva instancia o identificador de partida.
  Rechazar eventos anteriores.


9. ERRORES ESPECÍFICOS DE IPHONE
Error: pantalla táctil deja de responder

  Revisar pointer events y touch events.
  Evitar listeners duplicados.
  Usar touch-action correctamente.
  Gestionar cancelaciones.
  Verificar overlays invisibles que capturen toques.

Error: joystick se queda pulsado

  Limpiar entradas en touchcancel.
  Limpiar entradas al perder foco.
  Limpiar entradas al pausar.
  Limpiar entradas al cambiar de orientación.
  Limpiar entradas al morir.

Error: Safari hace zoom

  Revisar configuración viewport.
  Revisar touch-action.
  Evitar interferencias del navegador sin bloquear innecesariamente accesibilidad fuera del
  juego.

Error: el juego se pausa al abrir el centro de control

  Detectar pérdida de foco.
  Limpiar entradas.
  Mantener estado de red separado del estado visual.
  Reanudar con snapshot actualizado.

Error: bloquear el iPhone desconecta la partida

  Reconexión.
  Token temporal.
  Restauración de sesión.
  Snapshot completo.
  Mensaje claro al usuario.

Error: rendimiento cae tras varios minutos

  Medir memoria.
  Revisar objetos Three.js no liberados.
  Revisar texturas.
  Revisar geometrías.
  Revisar partículas.
  Revisar render targets.
  Revisar listeners acumulados.
  Revisar calentamiento y reducción de rendimiento.


10. ERRORES DE RATÓN EN PC
Error: cámara no gira 360 grados

  Verificar Pointer Lock.
  Utilizar movimiento relativo.
  No limitar yaw a los bordes de pantalla.
  Mantener pitch limitado verticalmente.
  Comprobar pérdida y recuperación del bloqueo.

Error: clic dispara al cerrar menú

  Separar acciones de interfaz y gameplay.
  Ignorar clic de recuperación cuando corresponda.
  Limpiar entradas al cambiar de estado.
  Evitar eventos fantasma.

Error: ratón funciona en local pero no en producción

  Probar el contexto real de navegador.
  Revisar permisos y activación por gesto del usuario.
  Revisar diferencias entre iframe y página independiente.


11. ERRORES DE RENDIMIENTO
Caídas de FPS
Investigar:

   Draw calls.
   Triángulos.
   Sombras.
   Resolución interna.
   Pixel ratio.
   Postprocesado.
   Partículas.
   Creación de objetos.
   Garbage collection.
   Renderizado de modelos remotos.

Aplicar mejoras graduales y medir antes/después.

Memoria creciente

   Revisar fugas.
   Liberar geometrías y materiales.
   Liberar texturas cuando ya no se utilicen.
   Cancelar listeners y suscripciones.
   Eliminar entidades destruidas.
   Evitar acumulación de snapshots.

Exceso de tráfico de red

   Enviar entradas compactas.
   Enviar snapshots a frecuencia razonable.
   No transmitir geometría completa.
   No transmitir efectos cosméticos innecesarios.
   Medir bytes por segundo.
   Evitar enviar estados idénticos continuamente cuando no sea necesario.


12. ERRORES DE CLOUDFLARE O DEL HOSTING
Si utilizas Cloudflare Durable Objects:

   Comprueba límites de ejecución.
   Comprueba alarmas y temporizadores disponibles.
   Comprueba persistencia.
   Comprueba comportamiento de hibernación.
   Comprueba reconexión de WebSockets.
   No dependas de memoria volátil para recuperar estados críticos.
   No supongas que una instancia permanecerá activa para siempre.
   Comprueba compatibilidad del bucle de simulación.
   Mide consumo y coste estimado.

Si no encaja técnicamente, utiliza una alternativa de servidor persistente.

No fuerces Cloudflare si complica la simulación autoritativa.

No uses Supabase Realtime como sustituto automático de un servidor de combate autoritativo
sin justificar técnicamente sus garantías y limitaciones.


13. SISTEMA DE PRUEBAS DE ESTRÉS
Crea pruebas automatizadas para:

   100 creaciones y cierres de sala secuenciales.
   Entradas y salidas repetidas.
   Reconexiones repetidas.
   1.000 comandos de movimiento válidos.
   Disparos repetidos respetando cadencia.
   Mensajes duplicados.
   Mensajes malformados.
   Mensajes fuera de estado.
   Reinicio de partida.
   Revanchas consecutivas.
   Latencia variable.
   Jitter.
   Pérdida de paquetes.
   Clientes con distintos FPS.

No ejecutes pruebas de carga agresivas contra infraestructura pública sin verificar límites y
autorización. Realiza el estrés principalmente en entornos controlados.

No confundas pruebas de estrés con pruebas reales de experiencia de usuario.


14. PRIORIDAD DE ERRORES
Clasifica cada error:

P0 — BLOQUEANTE

   No carga el juego.
   No conecta el servidor.
   No se puede crear sala.
   No entra el segundo jugador.
   No empieza la partida.
   No se ve al rival.
   No funciona el movimiento.
   No funcionan los disparos.
   No se aplica daño.
   No se puede terminar una partida.
   La partida queda permanentemente bloqueada.

Corregir inmediatamente.

P1 — GRAVE

   Tirones frecuentes.
   Desincronización notable.
   Reconexión defectuosa.
   Disparos duplicados.
   Marcador inconsistente.
   Errores importantes de HUD.
   Rendimiento insuficiente.
   Navaja defectuosa.

Corregir después de P0.

P2 — MENOR

   Animaciones secundarias.
   Sonidos mejorables.
   Efectos visuales.
   Ajustes estéticos.
   Detalles de interfaz.

Posponer si comprometen el plazo.


15. SISTEMA DE REGRESIONES
Antes de cada despliegue:

1. Ejecutar pruebas del núcleo.
2. Ejecutar pruebas de armas.
3. Ejecutar pruebas de movimiento.
 4. Ejecutar pruebas táctiles.
 5. Ejecutar autotest de puntería.
 6. Ejecutar pruebas de red.
 7. Ejecutar pruebas de sala.
 8. Ejecutar pruebas de combate.
 9. Ejecutar pruebas de muerte y revancha.
10. Probar carga desde URL pública.

Mantén una referencia de la última versión estable.

No publiques una nueva versión con errores P0 conocidos.

Si la versión nueva rompe el juego, utiliza el procedimiento de reversión documentado.



16. AUTOMATIZACIÓN RESPONSABLE
Quiero que trabajes sin interrupciones innecesarias.

Si detectas un fallo y tienes permiso para solucionarlo, soluciónalo.

Si una prueba falla, investiga.

Si la solución introduce una regresión, corrígela o revierte.

Si una herramienta falla, comprueba si existe otra forma segura de completar la tarea.

Si una integración no está disponible, no finjas que la has utilizado.

Si necesitas una decisión importante, agrupa las preguntas.

Si necesitas autorización para un gasto, despliegue sensible o credenciales, solicítala.

No desactives pruebas, controles de seguridad ni validaciones para conseguir un resultado
verde.

No realices ciclos infinitos de corrección. Establece un límite razonable de intentos por
problema y comunica bloqueos reales.


17. CRITERIOS DE ENTREGA PARA MAÑANA
No quiero que mañana me entregues simplemente un informe diciendo que hay cientos de
pruebas correctas.

Quiero poder abrir dos móviles y jugar.
La prueba final será:

 1. Móvil A abre el juego.
 2. Móvil B abre el juego.
 3. A crea sala.
 4. B entra.
 5. Ambos se ven.
 6. Ambos se mueven.
 7. Ambos disparan.
 8. Ambos reciben daño.
 9. Uno muere.
10. El marcador cambia en ambos.
11. Hay reaparición.
12. Se llega a diez bajas.
13. Ambos ven el ganador.
14. Ambos aceptan revancha.
15. Empieza otra partida.

Si algún punto falla, informa exactamente cuál y por qué.

No declares éxito sin haber verificado el flujo completo.


18. INSTRUCCIÓN FINAL
Trabaja con mentalidad de producto real.

No persigas únicamente un número alto de pruebas automatizadas.

Prioriza:

 1. Que el juego cargue.
 2. Que ambos jugadores conecten.
 3. Que puedan combatir.
 4. Que la partida termine.
 5. Que puedan jugar otra vez.
 6. Que todo sea estable.
 7. Que el rendimiento sea aceptable.
 8. Que la experiencia sea divertida.

Corrige los errores de raíz.

Conserva lo que ya funciona.
  Evita reescrituras innecesarias.

  No introduzcas nuevas funcionalidades secundarias mientras existan errores bloqueantes.

  Tu objetivo es entregar la mejor versión 1vs1 realmente jugable que puedas verificar
  antes de mañana por la noche.

  Empieza auditando los errores de mayor riesgo de la implementación actual y continúa
  automáticamente con las correcciones y pruebas permitidas.




Una última recomendación importante
No le enviaría más prompts enormes después de este. Ya tendrá las especificaciones del
multijugador, la prevención de errores y el protocolo de autocorrección. Seguir añadiendo
instrucciones puede hacer que dedique más tiempo a planificar que a programar.

A partir de ahora, lo más útil será que Claude implemente D1, D2 y D3, y que te vaya dando
versiones jugables. Cuando consigas entrar con dos navegadores y disparar al otro jugador, ya
podremos corregir problemas reales en lugar de anticipar infinitas posibilidades.

Y recuerda: aunque Claude pueda automatizar gran parte del desarrollo, tendrás que hacer al
menos una prueba final con tu iPhone y el móvil de tu novia. Ningún autotest sustituye
completamente esa comprobación.
```
