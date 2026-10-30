# GAME FEEL 3.0 — movimiento, animación, FPS y visibilidad

Petición del propietario (30-10-2026, «SNIPER DUEL — ULTIMATE GAME FEEL 3.0»): que el juego se sienta como un shooter
táctico moderno. Fases GF-0 a GF-9. Reglas: medir antes y después, nada competitivo publicado sin su aprobación, el
juego estable intacto (todo lo nuevo como opción) y el servidor autoritativo intacto.

## Primera entrega (30-10-2026)

| Fase | Qué | Estado |
|---|---|---|
| GF-0 | Auditoría (movimiento, red, bots, animaciones, cámara) y medición por partes del fotograma | HECHO |
| GF-1 | Perfil de movimiento **TÁCTICO** (AJUSTES › CONTROLES, experimental, por defecto ACTUAL) | IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE |
| GF-4 | **Visibilidad de enemigos** (AJUSTES › JUGABILIDAD, experimental, por defecto NORMAL, solo sin conexión) | IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE |
| GF-5 | Los bots se animan **una vez por fotograma** (antes, 2 veces a 60 FPS y 4 a 30) | IMPLEMENTADO · PROBADO EN NAVEGADOR |

Ni `core/` ni `server/` cambian: el servidor no se vuelve a publicar y online todo sigue igual.

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
- Lo que falla:
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

## GF-1 — Movimiento TÁCTICO (experimental)
AJUSTES › CONTROLES › Movimiento: **ACTUAL** (por defecto) o **TÁCTICO**.

| | ACTUAL (servidor) | TÁCTICO (sin conexión) |
|---|---|---|
| Caminar | 4,6 m/s | **4,05 m/s (−12 %)** |
| Agachado | 2,4 | **1,95** |
| Hacia atrás | ×0,85 | **×0,78** |
| Sprint | 7,0 | 7,0 (sin cambios) |
| Apuntando | ×0,5 | ×0,5 (2,0 m/s) |
| 0 → 95 % de caminar | 0,075 s | **0,133 s** (medido) |
| Frenar al andar / tras sprint | 0,08 / 0,12 s | 0,12 / 0,21 s |

- **Sin conexión**: se usa el mismo motor (`SDPlayer.step`) con una copia de los números (`MOVE_TAC`). El reglamento
  del servidor (`SD_CONFIG.move`) no cambia, y lo comprueba la prueba.
- **Online**: las velocidades no cambian. Si se aprueban, hay que llevarlas a `core/config.js`, publicar el servidor y
  actualizar `test/core.test.js`. Con TÁCTICO, online solo cambia la cámara, que es solo cómo se ve.
- **Cámara TÁCTICA**:
  - el balanceo es sen² en vez de |sen|: la misma altura y el mismo ritmo, pero sin el golpe seco de cada paso;
  - una inclinación leve al ir de lado (0,9° a paso normal);
  - un pequeño hundimiento también en saltos cortos;
  - el balanceo del arma al girar ya no depende de los FPS (antes, a 30 FPS se movía distinto que a 60);
  - «Reducir movimiento» ahora también suaviza las inclinaciones y el FOV del sprint.
- Los porcentajes son candidatos para que los pruebes, no valores definitivos.

## GF-4 — Visibilidad de enemigos (experimental)
AJUSTES › JUGABILIDAD › Visibilidad de enemigos: **NORMAL** (por defecto) · **SILUETA MEJORADA** · **CONTORNO SUTIL**.

- **SILUETA MEJORADA**: el material del enemigo da hasta +35 % de luz y añade un borde cálido suave (solo en los bordes,
  según el ángulo).
- **CONTORNO SUTIL**: una línea fina (1,1 píxeles CSS) de color hueso con opacidad 0,45, **solo por fuera de la
  figura**. Cada cuerpo marca sus píxeles en el stencil y el contorno solo se dibuja donde no hay cuerpo.
  - En la primera versión no tenía esa máscara: los bordes de brazos, piernas y rifle cubrían casi todo el enemigo
    lejano (unos 12 píxeles de ancho) y se veía blanco. Esa versión se descartó.
- **Distancia**: se mide la distancia aparente (distancia × zoom).
  - Cerca, nada.
  - El brillo empieza hacia los 12 m y el contorno hacia los 24 m.
  - Con el visor 8×, un enemigo a 40 m «está» a 5 m: no sale nada, y el contorno nunca crece con el zoom.
- **Justo por construcción**:
  - Los dos efectos se dibujan con la prueba de profundidad, como parte del propio enemigo. Solo pueden aparecer en los
    píxeles del enemigo que de verdad se ven: nunca a través de paredes, suelos, coberturas ni vegetación.
  - No hace falta ningún dato extra de rivales ocultos.
  - El grosor es el mismo en BAJO que en ALTO.
- **Online: apagada.** Hace falta tu aprobación y una regla igual para los dos jugadores (por ejemplo, la elige la
  sala).
- **Medido** (`test/gamefeel.browser.test.js`, píxeles leídos de la GPU con el cuerpo en la misma pose):
  - enemigo **detrás de una fachada**: diferencia **0** entre NORMAL y CONTORNO;
  - a la vista a 30 m: 2,2 de diferencia media en la zona del enemigo;
  - a 8 m: 0.
- **Capturas**: `node tools/capture-visibilidad.js <carpeta>`, el mismo enemigo a 10, 20, 30 y 40 m, detrás de la pared
  y con el visor 8×. Están en `docs/img/visibilidad-distancias.jpg` y `docs/img/visibilidad-pared-visor.jpg`.

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
| GF-2 | Transiciones suaves de animación (sprint, salto, muerte, apuntar de los bots en 0,1–0,2 s); usar los clips que ya hay (aterrizaje, disparo, muerte de frente); recarga de la escopeta del rival; reacción al impacto online | No (solo cómo se ve) |
| GF-6 | Bots más humanos: giros suavizados, rebote según lo que andan, frenada sin deslizar, pausas | No (no cambia su puntería ni su dificultad) |
| GF-1b | Suavizar las correcciones online del servidor (sin publicarlo) y el paso de los rivales | No |
| GF-1c | Llevar TÁCTICO a online (`core/config.js` + servidor + pruebas) | **Sí** |
| GF-4b | Visibilidad online con una regla de sala igual para los dos | **Sí** |
| GF-3 | Armas en 1ª persona: retroceso con muelle por defecto (hoy con `?feel=2`), coherencia del cerrojo y la corredera | Ver con el propietario |
| GF-7 | Joystick: zona de andar despacio más amplia y bloqueo de sprint | No (el servidor ya acepta la intensidad) |
| — | Peek con el cuerpo, tumbarse, saltar o trepar obstáculos | **Sí** (cambian hitboxes o reglas) |
| — | Grabación en vídeo comparando el movimiento antes y después en una partida real | Pendiente |

## Cómo probarlo en el iPhone
1. Abre el juego (si estaba abierto, ciérralo del todo y vuelve a abrirlo).
2. AJUSTES › GRÁFICOS › **MEDIR RENDIMIENTO** y mándame el informe: ahora trae la línea «CPU por partes».
3. AJUSTES › CONTROLES › Movimiento: **TÁCTICO**. Juega un duelo contra bots (sin conexión): anda, corre, frena,
   cambia de dirección, agáchate, salta y apunta andando. Cambia a ACTUAL y repite para notar la diferencia.
4. AJUSTES › JUGABILIDAD › Visibilidad de enemigos: prueba **SILUETA MEJORADA** y **CONTORNO SUTIL** en PUEBLO 3.0,
   con bots lejos (30–40 m) delante de fachadas y sombras, y con el visor 4× y 8×. Comprueba que un bot escondido tras
   una pared no se ve.
5. Dime qué valores cambiarías (más o menos lento, más o menos inercia, contorno más o menos visible) y si apruebas
   llevar algo a online.
