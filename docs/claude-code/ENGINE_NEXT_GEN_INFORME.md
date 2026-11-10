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
