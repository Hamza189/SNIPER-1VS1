# C++ y WebAssembly en SNIPER DUEL

**Estado (18-11-2026):** cuatro piezas en C++ (red de los bots, rutas del servidor, sonido y balas del servidor) · PROBADO EN NAVEGADOR (PC) y en
Cloudflare local (`wrangler dev`) · PENDIENTE DE VALIDACIÓN EN IPHONE Y ANDROID.

Regla 14 de `CLAUDE.md` y conclusión C de `docs/claude-code/ENGINE_NEXT_GEN_INFORME.md`: C++ solo donde una medida lo
justifique. La primera pieza es la **red por la que andan los bots** (`navGrid`), que se construye al empezar un mapa.

## Qué hace
- **`wasm/nav.cpp`:** C++ sin biblioteca estándar. Hace lo mismo que `navGrid()` de `client/casa2.js`, en el mismo
  orden, para que el resultado sea idéntico.
  - Puntos cada 0,25 m fuera de las cajas.
  - Enlaces con los 8 vecinos si la línea entre ellos está libre.
  - Se queda el trozo conectado más grande.
- **`assets/wasm/nav.wasm`:** el C++ compilado. Pesa 5,8 KB y se guarda en el repositorio, así que para jugar o para
  `build.py` no hace falta compilador.
- **`client/navwasm.js`:** lo carga y lo traduce.
  - En el navegador lo pide al terminar de cargar la página, con su versión (`ASSET_V`).
  - En Node (pruebas y `export-map`) lo carga al momento.
- **`navGrid()`** lo usa si ya está cargado. Si no ha llegado o falla, sigue con la versión JavaScript, que da el mismo
  resultado.
- **`?navwasm=0`** lo desactiva en esa carga (para comparar). Lo usan la CASA ATLAS 2.0 (sus tres diseños) y el BARRIO.

## Medido
- **En Node** (`node test/navwasm.test.js`): la misma red punto por punto y enlace por enlace en los 4 mapas y con los
  dos márgenes (0,4 y 0,5 m). Entre 4 y 10 veces más rápido:

  | Mapa | Puntos | JavaScript | C++/WASM |
  |---|---|---|---|
  | CASA ATLAS 2.0 | 11 251 | 88 ms | 20 ms |
  | Diseño 2 | 12 255 | 51 ms | 12 ms |
  | JARDÍN | 12 410 | 79 ms | 15 ms |
  | BARRIO | 18 384 | 76 ms | 12 ms |

  La primera vez en un proceso nuevo, JavaScript tardaba 122–329 ms (sin calentar).
- **En la página** (`node test/navwasm.browser.test.js`): la página carga `nav.wasm` y las redes salen iguales con
  `?navwasm=0`.

  | Mapa | C++ | JavaScript |
  |---|---|---|
  | BARRIO | 25 ms | 72 ms |
  | CASA ATLAS 2.0 | 15 ms | 89 ms |
  | Diseño 2 | 9 ms | 41 ms |

- **Pendiente:** medirlo en el iPhone y el Samsung. Es el paso de la carga en que el juego se queda quieto antes de
  empezar la partida.

## Las rutas de los bots del servidor (18-11-2026): `wasm/astar.cpp` → `assets/wasm/astar.wasm` (3,5 KB)
- **Qué hace:** el A* de `core/bots.js` en C++, con montículo binario. La red de cada mapa se copia una sola vez y cada
  búsqueda va entera dentro de WebAssembly.
- **Cómo se carga:**
  - El servidor Node lo lee del disco (`server/node.js`).
  - El de Cloudflare lo importa como módulo compilado (`server/worker.js`; wrangler lo empaqueta aparte).
  - Sin él, se usa el A* en JavaScript.
- **`node test/astar.test.js`:** rutas válidas y nunca más largas que las de JavaScript, en los 7 mapas.

  | Mapa | JavaScript, media (peor) | C++, media (peor) |
  |---|---|---|
  | PUEBLO | 1,19 ms (28,3) | 0,056 ms (1,15) |
  | CASA ATLAS 2.0 | 0,66 ms (3,5) | 0,089 ms (0,37) |
  | BARRIO | 2,35 ms (11,1) | 0,238 ms (1,63) |

- **Comprobado en el propio Cloudflare** (`wrangler dev`, el motor workerd): una sala del BARRIO con 3 bots del servidor,
  y los bots se mueven.
- **Fallo encontrado y arreglado al medir:** en la CASA ATLAS 2.0 · NUEVA, el JARDÍN y el BARRIO, la red de los bots del
  servidor estaba rota en miles de trozos (2 194, 2 248 y 3 663). El servidor enlazaba los puntos a 1,5 veces la
  distancia mínima entre ellos, y esas redes mezclan puntos cada 0,5 m con otros cada 0,25 m junto a las paredes.
  - Arreglo: cada mapa dice a qué distancia enlazar (`navReach: 0.75` en `core/mapdata.js`). Ahora cada red es un solo
    trozo.
  - PUEBLO, ARENA, CASA ATLAS y CASA ATLAS 2.0 no cambian.

## El sonido generado al empezar (18-11-2026): `wasm/audio.cpp` → `assets/wasm/audio.wasm` (1,8 KB)
- **Qué hace:** el ruido (2 s) y la reverberación del pueblo (2,4 s en estéreo) que `audioInit()` genera en el primer
  toque.
- **Cómo lo hace:** un generador xorshift, y la potencia (1 − t)^3,4 calculada cada 32 muestras, en línea recta entre
  medias; la curva es suave.
- **`node test/audiowasm.test.js`:**
  - la potencia, igual que `Math.pow` (error 3,5·10⁻⁸);
  - ruido entre −1 y 1 con media 0;
  - la misma energía por tramos (±1 %).
  - **Entre 7 y 16 veces más rápido:** de 27–57 ms a 3,6–3,9 ms (el PC iba cargado y las cifras cambian de una vez a
    otra).
- La primera versión calculaba la potencia muestra a muestra y solo ganaba ×1,2: el `Math.pow` de JavaScript ya es
  rápido. Lo que dio la mejora fue el algoritmo, no el lenguaje.
- `?audiowasm=0` usa JavaScript.

## Las balas y las líneas de visión del servidor (18-11-2026): `wasm/geom.cpp` → `assets/wasm/geom.wasm` (5,6 KB)
- **Por qué:** el perfil de CPU del servidor (CASA ATLAS 2.0, una persona y 5 bots en TODOS CONTRA TODOS) daba el 45 % del
  tiempo a `segMap`/`triHit` de `core/geom.js`. Ahí entra todo lo que mira si una línea toca un triángulo del mapa: las
  balas, lo que ven los bots, los sitios de aparición y el cuchillo.
- **Qué hace:** lo mismo que `segMap`, con la misma rejilla de 4 m y Möller–Trumbore, en doble precisión, en el mismo
  orden y sin contracción a FMA (`-ffp-contract=off`). Las celdas fuera del mapa ya no se miran una a una: una bala de
  1 km en JavaScript buscaba en ~60 000 celdas vacías.
- **Tiene que dar exactamente lo mismo:** son las balas autoritativas (regla 3). `node test/geomwasm.test.js` compara
  distancia y punto de impacto **bit a bit** en los 9 mapas del servidor, con segmentos al azar (balas largas, vistas de
  bots, cortos de cuchillo, con y sin margen) y líneas de visión. 0 diferencias en 360 000 segmentos.
- **Medido** (Node, este PC):

  | | JavaScript | C++/WASM |
  |---|---|---|
  | 40 000 segmentos por mapa | 7,6–9,0 s | 29–283 ms (×32–×306) |

  Servidor entero, una persona y 5 bots, por segundo de partida (con las rutas ya en C++):

  | Mapa | Hoy | Con las balas en C++ | Peor paso |
  |---|---|---|---|
  | PUEBLO | 13,4 ms | 6,8 ms | 9,1 → 2,7 ms |
  | CASA ATLAS 2.0 | 15,4 ms | 9,8 ms | 10,8 → 4,0 ms |
  | PUEBLO 4.0 | 24,2 ms | 14,4 ms | 18,4 → 8,3 ms |

- **Cómo se carga:** igual que las rutas. `server/node.js` lo lee del disco y `server/worker.js` lo importa (wrangler lo
  empaqueta). Sin él, o con `ix.noWasm`, se usa JavaScript.
- Pruebas del servidor con las dos piezas cargadas, iguales que sin ellas: core 74, pistol 15, shotgun 27, room 191,
  gunstats 20, astar 17.

## Compilar (solo al cambiar el C++)
- **Compilador:** wasi-sdk 34 (LLVM/clang 23, gratuito y de código abierto, de WebAssembly en GitHub). Instalado el
  17-11-2026 en `C:\Users\Hamza\tools\wasi-sdk`, sin instalador ni permisos de administrador. En otro equipo, la variable
  `WASI_SDK` apunta a su carpeta.
- `node tools/wasm/build.js` → `assets/wasm/nav.wasm`, `astar.wasm`, `audio.wasm` y `geom.wasm`. Después:
  `node test/navwasm.test.js`, `node test/astar.test.js`, `node test/audiowasm.test.js`, `node test/geomwasm.test.js` y
  `python3 build.py`. Se compila con `-ffp-contract=off` (sin FMA: los resultados tienen que salir igual que JavaScript).
- **Compatibilidad:** WebAssembly con memoria ampliable, en todos los navegadores actuales (Safari de iPhone, Chrome de
  Android y escritorio). Sin hilos ni SIMD, para que vaya en todos.

## Lo que no tiene sentido pasar a C++ (medido)
- Lo que se ejecuta muchas veces y dura poco: cada llamada JS↔WASM se paga.
  - el tick del jugador: ~5 µs;
  - un rayo de bala: 1–3 µs.
- El dibujo, que es lo que más pesa en el iPhone: va en la GPU.
