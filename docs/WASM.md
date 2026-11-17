# C++ y WebAssembly en SNIPER DUEL

**Estado (17-11-2026):** IMPLEMENTADO · PROBADO EN NAVEGADOR (PC) · PENDIENTE DE VALIDACIÓN EN IPHONE Y ANDROID.

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

## Compilar (solo al cambiar el C++)
- **Compilador:** wasi-sdk 34 (LLVM/clang 23, gratuito y de código abierto, de WebAssembly en GitHub). Instalado el
  17-11-2026 en `C:\Users\Hamza\tools\wasi-sdk`, sin instalador ni permisos de administrador. En otro equipo, la variable
  `WASI_SDK` apunta a su carpeta.
- `node tools/wasm/build.js` → `assets/wasm/nav.wasm`. Después: `node test/navwasm.test.js` y `python3 build.py`.
- **Compatibilidad:** WebAssembly con memoria ampliable, en todos los navegadores actuales (Safari de iPhone, Chrome de
  Android y escritorio). Sin hilos ni SIMD, para que vaya en todos.

## Lo que no tiene sentido pasar a C++ (medido)
- Lo que se ejecuta muchas veces y dura poco: cada llamada JS↔WASM se paga.
  - el tick del jugador: ~5 µs;
  - un rayo de bala: 1–3 µs.
- El dibujo, que es lo que más pesa en el iPhone: va en la GPU.
