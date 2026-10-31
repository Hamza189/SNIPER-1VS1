# GAME FEEL 3.0 — movimiento, animación, FPS y visibilidad

Petición del propietario (30-10-2026, «SNIPER DUEL — ULTIMATE GAME FEEL 3.0»): que el juego se sienta como un shooter
táctico moderno. Fases GF-0 a GF-9. Reglas: medir antes y después, nada competitivo publicado sin su aprobación, el
juego estable intacto (todo lo nuevo como opción) y el servidor autoritativo intacto.

## Primera entrega (30-10-2026)

| Fase | Qué | Estado |
|---|---|---|
| GF-0 | Auditoría (movimiento, red, bots, animaciones, cámara) y medición por partes del fotograma | HECHO |
| GF-1 | Movimiento **TÁCTICO**: reglamento del servidor y cámara nueva para todos (aprobado por el propietario) | IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE |
| GF-2 | **Transiciones de animación** (31-10): esprint, salto, muerte, apuntar y cambio de arma sin saltos; retroceso al disparar, reacción al impacto (online también), aterrizaje y caída hacia delante | IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE (servidor local) · PENDIENTE DE VALIDACIÓN EN IPHONE |
| GF-4 | **Visibilidad de enemigos** (AJUSTES › JUGABILIDAD, por defecto NORMAL, online también); desde el 31-10 el CONTORNO es rojo en los enemigos y azul en los compañeros | IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE (servidor local) · PENDIENTE DE VALIDACIÓN EN IPHONE |
| GF-5 | Los bots se animan **una vez por fotograma** (antes, 2 veces a 60 FPS y 4 a 30) | IMPLEMENTADO · PROBADO EN NAVEGADOR |

La primera publicación no tocó `core/` ni `server/`. La segunda, aprobada por el propietario, cambia el reglamento de
movimiento de `core/config.js` y vuelve a publicar el servidor.

## GF-0 — Auditoría (lo medido, no supuesto)

### Movimiento (`core/movement.js`, `core/config.js`)
- **Velocidades**:
  - caminar **4,6 m/s**, sprint **7,0**, agachado **2,4**;
  - hacia atrás ×0,85 (3,9); apuntando ×0,5 (2,3; agachado 1,2); recargando ×0,9;
  - de lado, sin multiplicador;
  - por arma: pistola ×1,04, escopeta ×0,98, navaja ×1,08.
- **Aceleración**: 58 m/s² y frenada de 60 m/s². De quieto al 95 % de caminar en **0,075 s**; se para en 0,077 s. Muy
  seco: es el «arranque de robot». `test/core.test.js` exige que el reglamento del servidor siga por debajo de 0,15 s,
  0,12 s y 0,25 s.
- **Salto**: 6,3 m/s, ~1 m de alto, ~0,59 s en el aire.
- **Simulación**: fija a 120 Hz; la cámara interpola entre los dos últimos pasos.
- **Joystick**: ya es analógico. Media inclinación ≈ 2,2 m/s; el sprint arranca solo al llegar al borde. El servidor
  acepta la intensidad del joystick.
- **Online**:
  - el servidor manda en la posición;
  - el cliente predice y, al recibir el estado del servidor, corrige de golpe (sin suavizar);
  - los rivales se dibujan 110 ms en el pasado, interpolados;
  - estados del servidor ~20 por segundo.

### Cámara
- **Balanceo al andar**: |sen| (un golpe seco abajo en cada paso), 2 cm al andar y 4,3 al correr.
- **Aterrizaje**: solo hunde la cámara en caídas fuertes.
- **Al ir de lado**: no hay inclinación.
- «Reducir movimiento» no afectaba al FOV del sprint ni a las inclinaciones.

### Animación de personajes (`client/soldier2.js`)
- Los 16 modelos (SOLDADO, S.W.A.T., FSB, MILITAR y sus variantes) comparten **el mismo esqueleto**: 26 huesos, sin
  dedos, 3 niveles de detalle (LOD).
- Tienen **29 clips**: andar en 4 direcciones, correr, agachado, deslizar, saltar, apuntar, disparar, recargar, navaja,
  impacto y muerte.
- Se mezclan por pesos calculados en cada fotograma, con la cadencia sincronizada con la velocidad real.
- Lo que fallaba (corregido el 31-10 en GF-2, salvo el peek):
  - el sprint, el salto y la muerte entran **de golpe** (pesos 0/1);
  - clips sin usar: `jump_land`, `fire_*`, `death_front`, el inicio de `fire_rifle`;
  - la recarga de la escopeta del rival no sigue a los cartuchos;
  - los rivales online no reaccionan al impacto;
  - no hay peek visual (el peek solo mueve la cámara: si el cuerpo se inclinara, no coincidiría con la hitbox del
    servidor).

### Bots sin conexión (`class Bot`)
- Andan a 3,4 m/s con una aceleración de 9 m/s².
- **Giran a velocidad fija y se paran en seco**.
- Rebotan 4 cm según el tiempo (no según lo que andan), y el rebote cae a 0 de golpe al pararse.
- Siguen deslizándose ~0,6 m después de que las piernas se paren.

### Línea base de rendimiento
`node tools/gf-medir.js` con la GPU real del portátil (GTX 1050 Ti, Chromium sin ventana), cámara girando y 8 s por
escena. Tiempos de CPU en ms por fotograma:

| Escena | FPS (1 % bajo) | Pasos por fotograma | Personajes animados por fotograma | Simulación | de ella, bots | Animación | Envío de dibujo |
|---|---|---|---|---|---|---|---|
| ARENA (1 bot) | 60 (59,5) | 2 | **4** | 0,29 | 0,25 | 0,20 | 1,20 |
| PUEBLO 3.0 (1 bot) | 60 (59,5) | 2 | **6** | 0,46 | 0,41 | 0,32 | 2,05 |
| SALA con 5 bots | 60 (59,5) | 2 | 5 | 0,13 | — | 0,23 | 2,08 |

- En el PC el juego va holgado: lo que más cuesta es enviar el dibujo a la GPU.
- El último informe del iPhone (30-10, 21:08) da 60 FPS en las tres escenas, con 3,2–3,3 ms de CPU.
- En móviles más lentos y con 30 FPS, el trabajo doble de los bots pesa más: lo corrige GF-5.
- **Nuevo en MEDIR RENDIMIENTO**: una línea «CPU por partes» por escena (simulación, bots, animación de bots y de
  personajes, cámara, arma, HUD, efectos, red, mundo, envío de dibujo) y cuántos personajes se animan por fotograma.
  Así el iPhone dice dónde se va el tiempo. También funciona con `?prof=1` (`__SD.PROF`).

## GF-1 — Movimiento TÁCTICO: el del juego, online incluido (30-10-2026)
Primero entró como opción solo sin conexión. El propietario contestó que **lo mejorado va al juego de verdad** («no
para tenerlo para mí en offline, que ni voy a jugar solo»). Desde entonces es el **reglamento del servidor**
(`core/config.js`), igual para todos, y la opción desaparece de AJUSTES.

| | Antes | Ahora (servidor) |
|---|---|---|
| Caminar | 4,6 m/s | **4,05 m/s (−12 %)** |
| Agachado | 2,4 | **1,95** |
| Hacia atrás | ×0,85 | **×0,78** |
| Sprint | 7,0 | 7,0 (sin cambios) |
| Apuntando | ×0,5 (2,3 m/s) | ×0,5 (2,0 m/s) |
| Aceleración / frenada | 58 / 60 m/s² | **32 / 36 m/s²** |
| 0 → 95 % de caminar | 0,075 s | **0,125 s** |
| Pararse al andar | 0,077 s | **0,117 s** |
| Cambio de lado completo | ~0,15 s | **0,242 s** |
| Tras soltar el sprint | 11 m/s² | 9 m/s² (la inercia se va más suave) |

- **Dentro de los límites de respuesta** de `test/core.test.js`, que no se han tocado: llegar a la velocidad en menos de
  0,15 s, pararse en menos de 0,12 s y cambiar de lado en menos de 0,25 s. Los candidatos del primer día (30/34 m/s²) se
  pasaban en la parada y el cambio de lado, y se ajustaron a 32/36.
- **Cámara TÁCTICA**, por defecto para todos:
  - el balanceo es sen² en vez de |sen|: la misma altura, sin el golpe seco de cada paso;
  - una inclinación leve al ir de lado (0,9° a paso normal);
  - un hundimiento suave en saltos cortos;
  - el balanceo del arma ya no depende de los FPS;
  - «Reducir movimiento» también suaviza las inclinaciones y el FOV del sprint.
- **Marcas de adelanto del visor**: ahora salen de las velocidades reales (1,95 / 4,05 / 7 m/s). Antes estaban escritas a
  mano (2,4 / 4,6 / 7) y habrían quedado mal.
- **Bots del campo de tiro**: siguen el reglamento (ANDAN a 2,03 m/s, LATERAL a 4,05, CORREN a 7). Los bots del servidor
  también.
- **Para comparar**: `?mov=clasico`, sin conexión, usa el movimiento y la cámara de antes. Online siempre manda el
  servidor.
- **Pruebas que tenían escritas las velocidades antiguas**: ahora las leen del reglamento sin rebajar lo que exigen.
  - `phase2`: los patrones del campo de tiro.
  - `aim.browser`: las marcas del visor.
  - `core`: la rampa tiene 3 s en vez de 2,5 para llegar abajo a 4,05 m/s, y sigue exigiendo no despegar del suelo.
- **Versión del protocolo**: no se ha subido.
  - Un jugador con la página antigua en caché sigue pudiendo jugar: el servidor manda en la posición, así que solo verá
    alguna corrección hasta recargar.
  - El aviso de versión nueva del menú le pide recargar.
  - Subir el número habría dejado esas páginas antiguas sin poder conectar y sin explicación.

## GF-2 — Transiciones de animación (31-10-2026)
Petición del propietario: «Sigue mejorando animaciones».

Antes, cuando el juego cambiaba de estado de golpe (empezar o dejar de esprintar, saltar, aterrizar, morir, apuntar los
bots, cambiar de arma), el personaje saltaba de una postura a otra en un solo fotograma. Ahora cada cambio se mezcla en
un tiempo corto y se usan los clips que había sin usar. Se ve en los rivales online, en los bots y en tu personaje en
3ª persona (`client/soldier2.js`, funciones `blend` y `plan`).

**Medido** con `node tools/anim-sheet.js op4` (personaje MILITAR, el de MEDIO; con SOLDADO da cifras parecidas): lo que
más gira un hueso en un solo fotograma a 60 FPS. Andar normal ronda los 13° y esprintar, los 18°.

| Caso | Antes | Ahora |
|---|---|---|
| Soltar el esprint | 99° | 18° (el propio paso de carrera) |
| Saltar y aterrizar andando | 71° | 13° |
| Salto largo (0,9 s en el aire) | 37° | 7° |
| Morir andando | 130° | 21° |
| Morir por un tiro en la espalda | 130° (caía hacia atrás) | 19° (cae hacia delante) |
| Disparo y bombeo de la escopeta | 45° | 15° (es el retroceso) |
| Recarga de la escopeta | 82° | 18° |
| Apuntar de los bots | 21° | 2° |
| Cambio de arma (rifle → pistola) | 41° | 5° |
| Impacto | 33° | 11° |
| Disparo de pistola | 0° (no se movía) | 5° (retroceso) |

Hoja de fotogramas antes y después: `docs/img/transiciones-antes-ahora.jpg`.

**Qué cambia**:
- **Mezclas cortas**: esprint 0,22 s al entrar y al salir; salto 0,08 s al despegar y 0,1 s al aterrizar; muerte 0,25 s;
  apuntar 0,15–0,18 s; cambio de arma 0,22 s. Si lo que llega del servidor ya cambia despacio (el apuntado del rival
  sigue a su ADS), no añade retraso: solo convierte los saltos en rampas.
- **Despegue y aterrizaje**: al despegar se ve el final de `jump_start` (las piernas se estiran). Al caer se ve
  `jump_land`, más fuerte cuanto más tiempo en el aire; andando, más suave. Un escalón o un salto de menos de 0,08 s no
  cuenta.
- **Disparo**:
  - retroceso con los clips `fire_rifle` (su inicio, antes de ir al cerrojo), `fire_pistol` y `fire_shotgun`, como una
    capa que se suma a la postura que haya;
  - un empujón del pecho hacia atrás: 4° con el rifle, 6° con la escopeta y 3° con la pistola;
  - los clips de la escopeta parten de otra colocación de los brazos y, mezclados tal cual, la hacían saltar: por eso
    solo se usa su movimiento (y no el clip de bombeo, que es casi una postura fija).
- **Impacto**:
  - `hit_react` en su tiempo, con entrada y salida (antes, una postura fija a peso 1 de golpe);
  - un tirón del pecho hacia donde empuja el tiro, y la cabeza hacia atrás si fue en la cabeza;
  - **online también**: el rival se encoge cuando le alcanza cualquier disparo, tuyo o de otro (mensaje `hit` del
    servidor). Tu personaje en 3ª persona, igual.
- **Muerte**:
  - cae hacia atrás si el tiro vino de delante y hacia delante (`death_front`, antes sin usar) si vino de la espalda;
  - online, según quién lo mató (mensaje `kill`);
  - mientras se mezcla, las piernas siguen su paso (antes se cortaban de golpe).
- **Recarga de la escopeta**: la mano va a la ventana de carga y vuelve en cada cartucho, al ritmo real (0,4 s por
  cartucho). Antes era un ciclo de 0,8 s que no seguía a los cartuchos y saltaba al empezar cada uno.
- **Bots sin conexión**:
  - después de disparar mueven el cerrojo, como el rival online. Su siguiente disparo llega 1,6 s después o más, así que
    no cambian ni su ritmo ni su puntería;
  - al morir ya no giran de golpe para mirar al tirador: giran en 0,4 s, o caen hacia delante;
  - ya no rebotan 4 cm por encima de su animación de andar. Era un segundo rebote, sin sincronizar, que además movía sus
    zonas de impacto; ahora están quietas, como las del servidor.
- **Perfil BAJO** (el soldado de cajas): el esprint y el salto también se mezclan.
- **No cambia**: las zonas de impacto (cajas del servidor), la balística, los tiempos de las armas y la puntería de los
  bots.
- **Coste** (GPU del PC, `tools/gf-medir.js`, dos rondas de la versión anterior contra la nueva):
  - 60 FPS en todas las escenas;
  - CPU de animación de 0,19 a 0,25 ms por fotograma en PUEBLO y de 0,26 a 0,30 ms con 5 bots: unos 0,01–0,02 ms por
    personaje;
  - el envío de dibujo no cambia.
- **Pruebas**:
  - `soldier2`: 14 comprobaciones nuevas (ritmos de mezcla, aterrizaje, muerte, cambio de arma, retroceso, impacto,
    recarga y pesos que suman 1);
  - `gamefeel.browser`: ninguna transición gira un hueso más de 25° por fotograma; los bots disparan con retroceso y
    cerrojo, caen sin girar de golpe y no rebotan;
  - `online.browser` (dos navegadores contra el servidor local): el rival se encoge con el impacto, se ve el retroceso de
    su disparo y se sabe quién lo mató.

## GF-4 — Visibilidad de enemigos
AJUSTES › JUGABILIDAD › Visibilidad de enemigos: **NORMAL** (por defecto) · **SILUETA MEJORADA** · **CONTORNO**.
Desde el 30-10 también online. Son las mismas opciones y el mismo dibujo para todos los jugadores. La SILUETA va en el
material compartido, así que en EQUIPOS también aclara a los compañeros lejanos.

**31-10-2026, el propietario**: «lo del delineado podría ser un rojo un poco así opaco para ver desde lejos, rojo
enemigo, azul amigo». Desde entonces:
- el CONTORNO es **rojo mate casi opaco** en los enemigos (#c42d22, opacidad 0,92) y **azul** en los compañeros de
  equipo (#3a7ee0, opacidad 0,85);
- algo más grueso: 1,35 px CSS (antes 1,1), igual en BAJO y en ALTO;
- en los enemigos empieza a los 14 m aparentes y está entero a los 24 (antes, de 24 a 34 m). En los compañeros sale a
  cualquier distancia;
- no le afectan la niebla ni el estilo de imagen: a 90 m sigue siendo el mismo rojo;
- en el **duelo online 1 contra 1** no se dibujaba (solo en las salas de varios jugadores, un fallo de la entrega del
  30-10): corregido;
- en el **perfil BAJO** (el soldado de cajas) la SILUETA no hacía nada y el contorno también se dibujaba por dentro de la
  figura (entre brazos y torso): corregido, ahora es igual que en MEDIO y ALTO;
- en el CAMPO DE TIRO también se dibuja, en las dianas y en los bots de entrenamiento;
- se llamaba CONTORNO SUTIL; ahora, CONTORNO.

- **SILUETA MEJORADA**: el material del enemigo da hasta +35 % de luz y añade un borde cálido suave (solo en los bordes,
  según el ángulo).
- **CONTORNO**: una línea de 1,35 píxeles CSS, roja en los enemigos y azul en los compañeros, **solo por fuera de la
  figura**. Cada cuerpo marca sus píxeles en el stencil y el contorno solo se dibuja donde no hay cuerpo. (Del 30 al 31-10
  fue de color hueso, con opacidad 0,45 y 1,1 píxeles.)
  - En la primera versión no tenía esa máscara: los bordes de brazos, piernas y rifle cubrían casi todo el enemigo
    lejano (unos 12 píxeles de ancho) y se veía blanco. Esa versión se descartó.
- **Distancia**: se mide la distancia aparente (distancia × zoom).
  - Cerca, nada.
  - El brillo empieza hacia los 12 m y el contorno de los enemigos hacia los 14 m.
  - Con el visor 8×, un enemigo a 40 m «está» a 5 m: no sale nada, y el contorno nunca crece con el zoom.
- **Justo por construcción**:
  - Los dos efectos se dibujan con la prueba de profundidad, como parte del propio enemigo. Solo pueden aparecer en los
    píxeles del enemigo que de verdad se ven: nunca a través de paredes, suelos, coberturas ni vegetación.
  - No hace falta ningún dato extra de rivales ocultos.
  - El grosor es el mismo en BAJO que en ALTO.
- **Medido** (`test/gamefeel.browser.test.js`, píxeles leídos de la GPU con el cuerpo en la misma pose):
  - enemigo **detrás de una fachada**: diferencia **0** entre NORMAL y CONTORNO;
  - a la vista a 30 m: el contorno se ve, y los píxeles que cambia son rojos (de media, R 120 · G 31 · B 23);
  - a 8 m: 0 (cerca no se dibuja);
  - el mismo bot como compañero: azul (R 44 · G 63 · B 131), también a 8 m;
  - online, con dos navegadores contra el servidor local, el rival del duelo 1 contra 1 lleva su contorno rojo.
- **Capturas**: `node tools/capture-visibilidad.js <carpeta>`: el mismo personaje a 10, 20, 30, 40, 60 y 90 m como
  enemigo y como compañero, detrás de la pared y con el visor 8×. Comparativa del 31-10 en
  `docs/img/contorno-rojo-azul.jpg`; las del 30-10 (color hueso) en `docs/img/visibilidad-distancias.jpg` y
  `docs/img/visibilidad-pared-visor.jpg`.

## GF-5 — Bots animados una vez por fotograma
- Antes, cada bot calculaba su pose en cada paso de simulación de 120 Hz: 2 veces por fotograma a 60 FPS y 4 a 30. Solo
  se veía la última pose.
- Ahora la simulación avanza igual (sus decisiones y su posición, a 120 Hz) y la pose se calcula una vez por fotograma
  dibujado, con todo lo que se ha movido en ese fotograma.
- **Medido** con la GPU del PC (`tools/gf-medir.js`, `.work/gf/base-gpu.json` → `despues-gpu.json`). Tiempos de CPU en
  ms por fotograma; los FPS no cambian (60, con el 1 % más lento a 59,5), porque el PC ya iba holgado:

| Escena | Personajes animados por fotograma | Simulación + animación de bots | Animación de personajes |
|---|---|---|---|
| ARENA | 4 → **2** | 0,29 → 0,32 (sin ganancia medible: ruido) | 0,20 → 0,21 |
| PUEBLO 3.0 | 6 → **3** | 0,46 → **0,23** | 0,32 → **0,15** |
| SALA con 5 bots (online) | 5 → 5 (ya era una vez por fotograma) | igual | igual |

- La ganancia grande se espera en móviles más lentos limitados a 30 FPS: allí cada bot se animaba 4 veces por
  fotograma y ahora 1. Está **sin medir en un móvil**: la línea «CPU por partes» de MEDIR RENDIMIENTO lo dirá.

## Pendiente (próximas entregas)
| Entrega | Qué | ¿Hace falta tu aprobación? |
|---|---|---|
| GF-2b | Pies que dan pasos al girar sin moverse (hoy el cuerpo entero gira sobre sí mismo) y apoyo de los pies en escaleras y cuestas | No (solo cómo se ve) |
| GF-6 | Bots más humanos: giros suavizados, rebote según lo que andan, frenada sin deslizar, pausas | No (no cambia su puntería ni su dificultad) |
| GF-1b | Suavizar las correcciones online del servidor (sin publicarlo) y el paso de los rivales | No |
| GF-3 | Armas en 1ª persona: retroceso con muelle por defecto (hoy con `?feel=2`), coherencia del cerrojo y la corredera | Ver con el propietario |
| GF-7 | Joystick: zona de andar despacio más amplia y bloqueo de sprint | No (el servidor ya acepta la intensidad) |
| — | Peek con el cuerpo, tumbarse, saltar o trepar obstáculos | **Sí** (cambian hitboxes o reglas) |
| — | Grabación en vídeo comparando el movimiento antes y después en una partida real | Pendiente |

## Cómo probarlo en el iPhone
1. Abre el juego (si estaba abierto, ciérralo del todo y vuelve a abrirlo).
2. AJUSTES › GRÁFICOS › **MEDIR RENDIMIENTO** y mándame el informe: ahora trae la línea «CPU por partes».
3. Juega una partida online, o en una sala con bots: anda, corre, frena, cambia de dirección, agáchate, salta y apunta
   andando. El movimiento nuevo ya es el del juego. Para notar la diferencia con el de antes, abre la página con
   `?mov=clasico` y juega un duelo sin conexión.
4. AJUSTES › JUGABILIDAD › Visibilidad de enemigos: prueba **SILUETA MEJORADA** y **CONTORNO** en PUEBLO 3.0, con
   bots lejos (30–90 m) delante de fachadas y sombras, y con el visor 4× y 8×. Comprueba que un bot escondido tras una
   pared no se ve. En una sala por EQUIPOS, tus compañeros salen en azul.
5. **Animaciones**: fíjate en los bots y en el rival al empezar y dejar de correr, al saltar, al disparar (retroceso y
   cerrojo), al recibir un tiro y al morir (por delante y por la espalda). Mejor aún en 3ª persona (tecla V o AJUSTES).
6. Dime qué valores cambiarías: más o menos lento, más o menos inercia, contorno más o menos visible, animaciones más
   rápidas o más suaves.
