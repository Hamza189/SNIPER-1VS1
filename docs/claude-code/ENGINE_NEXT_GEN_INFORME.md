# ENGINE NEXT GENERATION — informe de la primera fase (10-11-2026)

Encargo del propietario: el plan guardado en `SNIPER_DUEL_TECHNOLOGY_EVOLUTION.md` §11 («Continúa»), y la regla 14 de
`CLAUDE.md`. **El juego publicado no ha cambiado.** Todo lo de WebGPU es una prueba aislada en `tools/webgpu/`.

Leyenda: **MEDIDO** = ejecutado hoy en el PC del propietario (GTX 1050 Ti Max-Q). **POR VERIFICAR** = depende del iPhone o
del Android reales. La GPU del PC no es la del iPhone: los números sirven para comparar las opciones entre sí, no para
saber los FPS del móvil.

## 1. Hecho hoy
| Fase | Qué | Estado |
|---|---|---|
| T0 | Dependencias de desarrollo fijas (`playwright` 1.56.0, `ws` 8.22.0, `typescript` 5.9.3, `@types/node` 22) con `package-lock.json`; `tools/py.js` (python3, python o py -3); `.gitattributes` para los binarios; fuera la ruta del entorno antiguo en `server/node.js` | IMPLEMENTADO |
| T1 | `tsconfig.json` + `npm run typecheck`: TypeScript **comprueba** `core/` (lo que comparten juego y servidor) sin generar nada | IMPLEMENTADO; fuera de `npm test` hasta arreglar el fallo de `room.js` |
| Paso 1 y 5 | Auditoría y medidas | Este documento |
| Paso 8 | Prueba aislada WebGL/WebGPU con una escena del PUEBLO | MEDIDO en el PC |

**Lo que T1 encontró nada más empezar** (6 avisos en `core/`):
- `core/melee.js`: el resultado del cuchillo se creaba sin sus campos `back` y `damage`. Ya está arreglado; no cambia el
  comportamiento.
- `core/room.js`, sala 1v1: `hs` significa a la vez «el anfitrión inicia la partida» y «tiros a la cabeza».
  - Al empezar cada partida el contador se pone a 0 y borra la bandera: en la revancha la sala vuelve a arrancar sola.
  - Las estadísticas de tiros a la cabeza salen como `true`.
  - Lo está trabajando la sesión de la sala 1v1, y ya está avisada.

## 2. Auditoría (MEDIDO)
- **Motor:** Three.js r128 (2021), con scripts clásicos (`vendor/three.min.js`, `GLTFLoader`, `KTX2Loader` y el
  transcodificador Basis en WebAssembly).
- **Código:** `src/page.html` (8 335 líneas) más 24 módulos en `client/` (4 642 líneas). La lógica compartida con el
  servidor está en `core/`.
- **Qué depende de r128** (lo que costaría actualizar):
  - 13 parches de shader propios con `onBeforeCompile`: camuflajes, cristal Fresnel, viento de la hierba, parpadeo y
    otros;
  - 6 cambios de `ShaderChunk` (el fundido de sombras);
  - 3 `ShaderMaterial` (cielo y otros);
  - 21 usos de la gestión de color antigua (`outputEncoding`, `sRGBEncoding`, `encoding=`).

  Con WebGPU, **todos** los parches de shader hay que reescribirlos en TSL/nodos: `onBeforeCompile` no existe en
  `WebGPURenderer`.
- **Dónde se va el tiempo** (medidas del 28-10 al 03-11, `docs/RENDIMIENTO-IPHONE.md`):
  - iPhone Pro Max: 60 FPS en ARENA, PUEBLO y CASA ATLAS 2.0, con la CPU a ~3 ms de los 16,7 que tiene cada fotograma.
  - Lo que pesa es la GPU (PUEBLO: 184–249 llamadas, ~400 mil triángulos) y la memoria de texturas (~630 MB).
  - La lógica del juego son ~1 ms; el tick del jugador, ~5 µs.

## 3. Prueba aislada: la misma escena en r128 WebGL, r186 WebGL y r186 WebGPU (MEDIDO)
- **Escena:** el PUEBLO exportado tal como lo monta el juego, 4 soldados, el rifle LINCE en la mano, sol con sombras
  2048 y niebla.
- **Medida:** pantalla del iPhone (932 × 430) a ×3 (2 796 × 1 290 píxeles); la cámara da una vuelta completa a la altura
  de los ojos; Google Chrome con la GTX 1050 Ti.
- **Herramientas:** `tools/webgpu/bench.html`, `bench128.html`, `medir.js` y `preparar.js`.

| Motor | FPS sin límite (2 rondas) | CPU para preparar el dibujo (p50) | Fotograma hasta que la GPU acaba (p50) |
|---|---|---|---|
| **r128 WebGL (el juego de hoy)** | 261–289 | 1,3–1,7 ms | 1,3–1,7 ms |
| **r186 WebGL** | **275–337** | **1,1–1,5 ms** | 1,1–1,5 ms |
| **r186 WebGPU** | 176–236 | 1,4–2,5 ms | 7,5–8,7 ms* |

\* Con WebGPU la espera a la GPU (`onSubmittedWorkDone`) no equivale al `gl.finish` de WebGL. Lo comparable son los
FPS sin límite.

- **Aspecto:** r128 y r186 WebGL se ven iguales. Con WebGPU las fachadas salen casi blancas: es la incompatibilidad de
  materiales que el plan pedía revisar (capturas en `.work/webgpu/`).
- **Detalles técnicos encontrados:**
  - El Chromium que trae Playwright no tiene `dxil.dll` y su WebGPU no arranca en Windows. Hay que medir con Google
    Chrome (`channel: 'chrome'`).
  - En r186, `clone()` de un personaje con esqueleto lo rompe: hay que usar `SkeletonUtils.clone`.

## 4. Conclusiones
**A. Lo que se puede mejorar ya en Three.js/WebGL**
- Actualizar a Three.js actual **en WebGL** da un poco más de margen: 275–337 FPS frente a 261–289, con la misma escena.
- Es la puerta a todo lo nuevo: mejores sombras, `BatchedMesh` para juntar llamadas de dibujo y KTX2 actualizado.
- Coste: pasar a módulos ES y a la gestión de color nueva, y repasar los 13 parches de shader (que en WebGL siguen
  funcionando, pero con otros nombres de variables). Se haría por fases, tras bandera, con capturas y FPS en el iPhone.
- Sin cambiar de versión: reducir llamadas de dibujo en el PUEBLO (agrupar el kit, `InstancedMesh` en lo repetido) y
  memoria de texturas. La GPU es lo que manda.

**B. Lo que aporta de verdad WebGPU hoy**
- En este PC **va más lento** que WebGL: 176–236 FPS frente a 275–337. Prepara el dibujo con tan poca CPU como WebGL;
  la diferencia está en la GPU.
- Obligaría a reescribir los 13 parches de shader en TSL, y hoy pinta mal algunos materiales.
- En iPhone y Android: POR VERIFICAR (Safari 26 trae WebGPU; el Samsung depende de su Chrome).
- **Recomendación:** no migrar. Repetir la prueba en el iPhone y el Samsung con la página de prueba. Si allí tampoco
  gana, WebGPU queda solo para efectos que WebGL no puede hacer (por ejemplo, cálculo en la GPU).

**C. Los subsistemas que ganarían con C++/WebAssembly**
- **Candidato medido: construir la red por la que andan los bots** al cargar el mapa (`navGrid`):

  | Mapa | Puntos | Tiempo en el PC |
  |---|---|---|
  | CASA ATLAS 2.0, sus tres diseños | 11–12 mil | 122–134 ms |
  | BARRIO | 18 mil | **329 ms** |

  En el iPhone probablemente sea una pausa visible al empezar (POR VERIFICAR). Es un cálculo pesado, de una sola vez y
  con pocos datos de entrada: el caso en que WebAssembly gana, porque cruzar entre JS y WASM se paga una vez y no
  millones.
- Alternativa sin C++: calcular esa red al compilar la página, como ya hace el servidor con `core/mapdata.js`, y no
  gastar nada al cargar.
- Lo demás no lo justifica:
  - simulación del jugador: ~5 µs por tick;
  - balas: 1–3 µs por rayo;
  - la lógica del juego cabe en ~1 ms.
- **Herramientas que harían falta:** LLVM/clang, o Emscripten, que lleva clang dentro. Son gratuitas y de código
  abierto, y hoy no están instaladas en el PC.
- **C#:** no; solo tendría sentido con Unity o .NET.

## 5. Siguiente paso propuesto
1. Que el propietario autorice instalar LLVM/clang (gratuito) para la primera pieza en C++: `navGrid` compilado a
   WebAssembly, con la versión JS de reserva, medido contra la JS y contra precalcularla.
2. Abrir la página de prueba WebGPU en el iPhone y en el Samsung: comparar FPS y aspecto.
3. Plan de actualización a Three.js r186 en WebGL tras bandera (`?motor=r186`), empezando por la gestión de color y los
   parches de sombras.

## 6. Hecho el 17-11-2026: la primera pieza en C++
- Con permiso del propietario («Sí, instálalo»): wasi-sdk 34 (LLVM/clang 23) en `C:\Users\Hamza\tools\wasi-sdk`, sin
  instalador.
- **`wasm/nav.cpp` → `assets/wasm/nav.wasm` (5,8 KB):** la red de los bots. Da el mismo resultado que JavaScript y es
  entre 4 y 10 veces más rápida. En la página: BARRIO 25 ms frente a 72; CASA ATLAS 2.0, 15 frente a 89.
- La versión JavaScript se queda de reserva, y `?navwasm=0` la fuerza. Detalle en `docs/WASM.md`.
- `npm run typecheck` ya está en `npm test` (0 avisos).

## 7. Hecho el 18-11-2026: perfil de CPU y lo que de verdad pesaba
- **El perfil** (`node tools/wasm/perfil.js pueblo 20`: el perfilador de muestras de Chrome con la GPU del PC).
  - **Carga** (8–20 s de reloj en el PC, sin caché de shaders): lo que más pesa es la compilación de shaders de three.js
    (`WebGLProgram`), entre 4,7 y 11,5 s.
    - Sin la comprobación de errores (`&shadercheck=0`) la compilación solo se mueve de sitio (8 s en otra función).
    - El arreglo de verdad es tener menos variantes de shader (hoy hay 40 programas), no C++.
  - **Partida:** lo primero es recalcular las matrices de posición de **todos** los objetos en cada fotograma. Son 3 366,
    incluidos los mapas y soldados ocultos y 1 229 cajas invisibles de las balas.
- **Matrices:** ahora solo se actualiza lo que está a la vista, y las cajas de las balas quedan fijas.
  - De 2 027 a 1 104 matrices por fotograma en el PUEBLO (−46 %), con WebGL por software.
  - `?matrices=0` vuelve a lo de antes.
  - Pruebas en navegador sin cambios: general 61, CASA ATLAS 2.0 · NUEVA 22, BARRIO 8, sombras 7, casa de la oliva 12.
- **Más C++ (`docs/WASM.md`):**
  - las rutas de los bots del servidor (A*), 8–20 veces más rápidas;
  - el sonido inicial, entre 7 y 16 veces más rápido.
- **Arreglado de paso:**
  - la red de los bots del servidor, rota en tres mapas (`navReach`);
  - `?desliz=0/1` no funcionaba, porque su patrón tenía un carácter de control en lugar de `\b`.
- **Lo que C++ no puede mejorar** (medido): el resto de la CPU de un fotograma es el propio three.js preparando el dibujo,
  y lo que más pesa en el iPhone es la GPU. Lo que toca ahí es menos llamadas de dibujo y menos variantes de shader.

## 8. Hecho el 24-11-2026: lo que el cliente hace en cada fotograma (medido) y las mallas solo para balas
- **El perfil del cliente** (partida sin conexión en PUEBLO con bots, el dibujo apartado; WebGL por software, PC):
  - las matrices de three.js (`updateMatrixWorld`, `multiplyMatrices`, `traverse`) eran ~45 % de la CPU del juego;
  - las líneas de visión y las balas del cliente contra el mapa (`Raycaster`) solo el 3 % (0,03–0,04 ms por fotograma):
    **pasarlas a C++ no compensa**, a diferencia del servidor (`geom.wasm`, 18-11).
- **Probado y descartado: no rehacer las matrices que no cambian** (comparar posición, giro y escala con los de la última
  vez). Hacía la mitad de cuentas, pero el fotograma salía más lento (0,33 → 0,41 ms): el coste no está en las cuentas sino
  en recorrer los objetos, y comparar en JavaScript cuesta lo mismo que rehacer. Guardarlo en cada objeto lo empeoraba más
  (0,35 → 0,50 ms: cambia la «forma» de los objetos y three.js entero va más lento). No se publicó.
- **Lo que sí: menos objetos que recorrer.** En PUEBLO, 1 596 de los ~2 200 objetos de primer nivel de la escena son mallas
  de material invisible que solo usan las balas (paredes de las casas para las balas, las cajas del pueblo viejo bajo el
  nuevo, las cajas de los otros mapas). three.js las recorría en cada fotograma para sus matrices, para dibujar y para la
  sombra del sol. Ahora quedan ocultas (`visible = false`) con su matriz hecha una vez: el `Raycaster` de three.js no mira
  `visible`, así que las balas chocan exactamente igual.
  - Objetos que three.js recorre en cada fotograma: PUEBLO 2 020 → 424, ARENA 1 279 → 146, CASA ATLAS 1 236 → 103.
  - Matrices del fotograma (PC con WebGL por software, la mejor de 9 vueltas alternas en la misma página): PUEBLO entre
    0,29–0,43 → 0,16–0,23 ms según lo ocupado que estuviera el PC, ARENA 0,11 → 0,07, CASA 0,10 → 0,06. Además se ahorra el
    mismo recorrido al preparar el dibujo y la sombra del sol (no medible con la GPU por software).
  - `test/ocultas.browser.test.js` (18 comprobaciones): en la misma página y el mismo momento, ocultas y a la vista dan las
    mismas llamadas de dibujo y los mismos triángulos, y 3 000 rayos chocan a la misma distancia; ninguna oculta se ha
    movido tras una partida con bots; bien al cambiar de mapa y con las casas macizas de antes.
  - En el móvil, PENDIENTE DE VALIDACIÓN: lo que cuenta es «CPU» en MEDIR RENDIMIENTO (3,3–3,4 ms en el iPhone en PUEBLO).
  - `?ocultas=0` = como antes.
