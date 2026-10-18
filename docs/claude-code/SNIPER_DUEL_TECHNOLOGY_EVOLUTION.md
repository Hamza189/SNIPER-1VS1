# SNIPER DUEL — evolución tecnológica (informe, 18-10-2026)

Encargo del propietario: auditar el repositorio y proponer qué lenguajes y herramientas conviene mantener o introducir.
**No se ha migrado nada.** Este documento solo propone; cada fase necesita su aprobación.

Leyenda: **MEDIDO** = ejecutado en esta sesión (con dónde y cómo). **ESTIMACIÓN** = cálculo o criterio, sin medir.
**POR VERIFICAR** = depende de una prueba que aún no se ha hecho (sobre todo en iPhone y Android reales).

---

## 1. Arquitectura tecnológica actual (MEDIDO en `main` `f408962`)

| Capa | Tecnología | Tamaño |
|---|---|---|
| Cliente completo (render, mapas, bots, HUD, menús, entrada, red del cliente, audio) | JavaScript dentro de `src/page.html` | 4 621 líneas; 316 KB de JS, 29 KB de CSS y 25 KB de HTML en un solo archivo |
| Lógica compartida cliente/servidor | JavaScript puro en `core/` (módulos IIFE/CommonJS sin dependencias) | 9 archivos, ~1 600 líneas + `mapdata.js` generado (218 KB) |
| Lógica de cliente sin DOM | JavaScript en `client/` (mismo patrón) | 12 archivos, ~2 500 líneas |
| Servidor | Cloudflare Worker + Durable Object (`server/worker.js`, módulos ES) y copia Node (`server/node.js`) | 173 líneas: toda la lógica está en `core/room.js` |
| Motor 3D | Three.js r128 (scripts clásicos, `vendor/`), WebGL 2 con caída a WebGL 1, `GLTFLoader` r128 | 600 KB + 100 KB |
| Shaders | GLSL dentro de Three.js: 1 parche global de `ShaderChunk` (fundido de sombras), 1 `ShaderMaterial` (cielo), 1 `onBeforeCompile` (viento de la vegetación) | Pocos y localizados |
| Compilación | `build.py` (Python): concatena `core/` + `client/` dentro de `page.html` → `index.html` | 62 líneas, sin dependencias |
| Herramientas | Python (30 archivos, 4 181 líneas: texturas, Blender/`bpy`, validadores, Poly Haven) y Node (capturas, métricas, validador GLB, exportador de mapas) | — |
| Pruebas | 28 suites propias en Node + Playwright/Chromium, sin framework externo | 936 comprobaciones en `npm test` |
| Publicación | GitHub Pages (estático) + GitHub Actions (wrangler para Cloudflare) | — |

**Sobre los porcentajes de GitHub:** GitHub cuenta casi todo el cliente como «HTML» porque el JavaScript vive dentro de
`page.html` (y además se publica una copia generada, `index.html`). Ese porcentaje no dice nada de calidad ni de
rendimiento; el JavaScript real del juego supera con mucho al HTML.

### Dependencias entre módulos (MEDIDO)
- `core/`: `player` ← `config`, `movement`, `weapon`, `melee`; `room` ← todos los anteriores + `geom`, `hitbox`,
  `protocol`. **No hay dependencias circulares.**
- `client/` y `page.html` se comunican por variables globales (`window.SDWeapon`, `SD_CONFIG`…). Dentro de `page.html`
  hay **430 declaraciones de nivel superior** que se usan entre secciones (por ejemplo `T` 640 veces, `P` 280, `NET` 187,
  `SFX` 143, `state` 138). Ese es el punto más acoplado del proyecto.

## 2. Problemas reales encontrados

| # | Problema | Evidencia | Gravedad |
|---|---|---|---|
| 1 | **Memoria de texturas alta para un móvil** | MEDIDO en este PC (PUEBLO 3.0, perfil AUTO → ALTO): 100 texturas, **~183 MB estimados en GPU** (RGBA8 + mipmaps). Solo el adoquín de 2048² (color + normal) ocupa ~43 MB. El iPhone usa MEDIO por defecto: allí será menos, pero no está medido | Alta para iPhone |
| 2 | `page.html` es un archivo de 4 621 líneas con 430 globales compartidas | Ver §1. Cambiar el HUD o los bots obliga a navegar todo el cliente; un nombre mal escrito no avisa hasta que se ejecuta | Media (mantenimiento) |
| 3 | Sin comprobación de tipos | Errores de nombre o de forma de los mensajes de red solo se ven en las pruebas o en el juego. `core/protocol.js` valida los mensajes en tiempo de ejecución, pero no hay tipos compartidos | Media |
| 4 | Instalación no reproducible | `package.json` sin dependencias: `playwright` y `ws` se instalan a mano con versión fija; no hay `package-lock.json`; `npm test` llama a `python3`, que no existe en Windows; sin `.gitattributes` (ruido de fin de línea) | Baja, pero molesta en cada sesión nueva |
| 5 | Pequeñas duplicaciones | La fórmula de caída de daño está 3 veces (2 en `page.html`, 1 en `core/room.js`); el arma en primera persona está dos veces: modelos GLB y la versión procedural de reserva (`?vm=0`, ~680 líneas en `page.html`) | Baja |
| 6 | Parche global del shader de luces | `ShaderChunk.lights_fragment_begin` se modifica por texto (fundido de sombras). Es frágil ante cualquier cambio de versión de Three.js; si no encuentra el texto, solo avisa en la consola | Baja hoy; alta si se actualiza Three.js |
| 7 | Restos de entorno | `server/node.js` busca `ws` en `/opt/npm-tools/...` si no lo encuentra (ruta del entorno antiguo de pruebas) | Muy baja |

### Lo que NO es un problema (MEDIDO)
- **CPU de la simulación.** En Node, en este PC: un tick de jugador cuesta **4,4–4,9 µs** en PUEBLO y **~2,9 µs** en
  ARENA/CASA; un rayo de bala de 5 m contra el mapa, **2,5 µs** (PUEBLO) y **0,8 µs** (ARENA/CASA). A 120 ticks/s eso es
  menos de 1 ms de CPU por segundo y jugador.
- **CPU del fotograma.** En el navegador integrado con la GTX 1050 Ti real (ventana 731 × 694, pixel ratio 1,25,
  PUEBLO 3.0): fotograma completo **~2,9–3,2 ms de CPU**, de los que **~1,9–2,2 ms** son el envío de Three.js
  (`renderer.render`, con 131–217 llamadas de dibujo y 262 000–293 000 triángulos). La lógica del juego son ~1 ms.
  Recorrer la escena (1 989 objetos) cuesta 0,1 ms.
- **Peso de la descarga.** PUEBLO 3.0 transfiere 13,5 MB (GLB 6,2 MB, JPG 5,4 MB, PNG 2,0 MB); la página son 194 KB
  comprimidos (582 KB sin comprimir).

Conclusión: el coste está en **la GPU y en el envío de dibujo** (texturas, llamadas, sombras), no en la lógica en
JavaScript. Esto decide qué tecnologías merecen la pena.

## 3. Lenguajes que conviene mantener
| Lenguaje | Por qué se queda |
|---|---|
| **JavaScript** (navegador y servidor) | Es lo que ejecutan Safari, Chrome Android y Cloudflare sin pasos intermedios. El código de `core/` corre igual en cliente y servidor: es la base de la autoridad del servidor |
| **GLSL** (vía Three.js) | Lo que entiende WebGL en todos los dispositivos actuales |
| **Python** | Ya hace bien las herramientas: texturas, Blender (`bpy`), validadores, compilación. No llega al jugador |
| **HTML/CSS** | Interfaz y menús. Se queda, pero separada del JS en la medida en que convenga (§5) |

## 4. Tecnologías nuevas: recomendadas, a investigar y desaconsejadas

Orden por **impacto ÷ (riesgo × esfuerzo)**. Todas son gratuitas y de código abierto; ninguna se descarga en el juego
salvo que se indique.

| Orden | Propuesta | Sistemas | Impacto | Riesgo | Esfuerzo | Recomendación |
|---|---|---|---|---|---|---|
| 1 | **Higiene de herramientas**: `devDependencies` fijas (`playwright@1.56.0`, `ws`) + `package-lock.json`; `.gitattributes`; llamada a Python que funcione en Windows y Linux; quitar la ruta `/opt/npm-tools` | Pruebas, CI, sesiones nuevas | Medio | Muy bajo | Bajo | **Sí, primero** |
| 2 | **TypeScript sin cambiar el código**: `tsc --noEmit` con `checkJs` y anotaciones JSDoc, empezando por `core/`; un archivo de tipos compartidos (mensajes de red, configuración de armas, datos del mapa) | Core, armas, balística, networking, tipos cliente/servidor | Alto | Muy bajo (solo añade comentarios de tipos; el comportamiento no cambia) | Bajo–medio | **Sí** |
| 3 | **Texturas comprimidas en GPU (KTX2/Basis)**, prueba aislada tras bandera `&tex=ktx2` | Gestión de recursos, PUEBLO 3.0, CASA ATLAS | **Alto en iPhone** | Medio | Medio | **Sí, como experimento medido** |
| 4 | **Separar `page.html` en módulos de `client/`**, sección por sección, con el mismo patrón y el mismo `build.py` | Render, armas en 1.ª persona, soldados/bots, red del cliente, audio, efectos, HUD/menús, depuración | Alto (mantenimiento) | Bajo–medio | Medio–alto, repartido en muchos commits pequeños | **Sí, progresivo** |
| 5 | **Quitar duplicaciones pequeñas** (caída de daño en una función de `core/`) | Armas | Bajo | Bajo, pero toca `core/` → redespliega el servidor | Bajo | Sí, junto a la 2 o la 4, con pruebas de servidor |
| 6 | **TypeScript «de verdad»** (`.ts` → JavaScript con esbuild o `tsc`) para módulos nuevos | Bots, animaciones, gestor de recursos, sistemas nuevos | Medio–alto | Bajo si se hace después de la 2 | Medio | Sí, después de la 2 y la 4 |
| 7 | **Optimización de render medida** (agrupar mallas, instanciar, revisar el pase de sombras) con GLSL solo donde haga falta | Render, sombras | Medio–alto | Medio (sombras: ya hubo correcciones) | Medio | Sí, con capturas antes/después |
| 8 | Minificar la página publicada (esbuild) | Carga | Bajo (ESTIMACIÓN: 582 → ~300 KB sin comprimir) | Bajo | Bajo | Más adelante |
| 9 | **Three.js moderno y WebGPU**: investigación en una página aislada | Motor | Potencialmente alto | **Alto** | **Alto** | Solo investigación; nada de migrar sin aprobación |
| 10 | **Rust + WebAssembly** | Simulación, física, geometría | **Ninguno hoy** (ver §2: no hay cuello de botella de CPU) | Medio–alto | Alto | **No por ahora**; solo si aparece un cuello de botella medido |

### 4.1 TypeScript (propuestas 2 y 6)
- **Fase A (comprobar sin compilar):** `typescript` como dependencia de desarrollo; `tsconfig.json` con `allowJs`,
  `checkJs`, `noEmit`; `// @ts-check` archivo por archivo, empezando por `core/protocol.js`, `core/config.js`,
  `core/weapon.js`, `core/geom.js`, `core/room.js`. Un `types/` con los tipos de los mensajes (`docs/PROTOCOLO.md`), las
  armas y el mapa. Nuevo paso `npm run typecheck` en `npm test` y en CI. **El comportamiento publicado no cambia**: solo se añaden comentarios (el `hash` de
  `version.json` sí cambia, porque los comentarios de `core/` van dentro de la página).
- **Fase B (archivos `.ts`):** módulos nuevos en TypeScript, compilados a JavaScript con el mismo formato IIFE antes de
  `build.py`. El navegador y Cloudflare siguen recibiendo JavaScript. Herramienta: esbuild (un ejecutable, gratis) o el
  propio `tsc`.
- **No** se convierten archivos existentes de golpe. `page.html` solo se tipará cuando sus secciones estén separadas.

### 4.2 Shaders y gráficos (propuestas 3 y 7)
- **Texturas comprimidas (KTX2/Basis Universal).** Hoy todas las texturas llegan a la GPU sin comprimir (RGBA8).
  Comprimidas en ASTC/ETC2/BC ocuparían entre 4 y 8 veces menos memoria de GPU (**ESTIMACIÓN**: ~183 MB → ~25–45 MB en
  PUEBLO 3.0 ALTO). Three.js r128 ya trae lo necesario (COMPROBADO en el paquete oficial `three@0.128.0`:
  `examples/js/loaders/BasisTextureLoader.js`, `examples/jsm/loaders/KTX2Loader.js` y el transcodificador; el
  `GLTFLoader` r128 admite `KHR_texture_basisu`). El transcodificador es WebAssembly que ya mantiene el proyecto Basis:
  es el uso de WASM con beneficio más claro y no hay que escribirlo.
  Riesgos: calidad visual de los mapas de normales (hay que compararla con las mismas cámaras), tiempo de
  transcodificación al cargar, y soporte real en Safari de iPhone y en el Samsung (**POR VERIFICAR**). Se generaría con
  herramientas gratuitas (`toktx` de Khronos o `gltf-transform`) en desarrollo, guardando siempre los originales.
- **Sombras:** antes de tocar shaders hay que respetar las correcciones del 12-10 y 17-10 (sombra por texels enteros,
  `normalBias`, fundido por N·L y por distancia; `docs/ASSETS-3D.md` §15 y `test/shadow.browser.test.js`). Propuesta:
  convertir el parche de texto de `ShaderChunk` en un módulo con prueba propia que falle si el texto no se encuentra.
- **Llamadas de dibujo:** 131–217 en PUEBLO 3.0. Agrupar decoración estática por material y usar `InstancedMesh` donde
  se repite (farolas, macetas, ratas, plantas) bajaría el envío de CPU de Three.js, que es la mitad del fotograma.
- Efectos de disparo, iluminación y materiales mejores: se pueden hacer en GLSL dentro de Three.js r128, siempre detrás
  de una bandera y con capturas comparativas.

### 4.3 Rust y WebAssembly (propuesta 10)
Las condiciones del propietario no se cumplen hoy: **no hay cuello de botella de CPU medido** (§2). Además, cada llamada
JS↔WASM tiene un coste fijo que, con funciones de 1–5 µs, se comería buena parte de la ganancia.
Se reconsiderará si alguna de estas medidas lo justifica (con una prueba reproducible en el repositorio):
- muchas más entidades (por ejemplo, decenas de bots o un modo con más jugadores) y el tick supera ~2 ms en móvil;
- el tiempo de CPU del Durable Object se acerca a los límites del plan gratuito de Cloudflare;
- búsqueda de rutas o física mucho más compleja que la actual.

**El servidor y el motor no se migran a Rust sin aprobación expresa** (regla del propietario).

### 4.4 Python y Blender
Se mantienen y se amplían donde ahorren trabajo, siempre fuera del juego que descarga el jugador:
- generador de versiones KTX2 de las texturas, con informe de memoria antes/después;
- generador de LOD para GLB de ChatGPT (hoy lo hace Claude a mano según el contrato);
- validador de mapas (cajas frente a la geometría visible) que complemente `test/cover.browser.test.js`.

### 4.5 WebGPU y versiones nuevas de Three.js (propuesta 9)
- Pasar de r128 a una versión actual no es una actualización menor: desaparecen los scripts clásicos `examples/js`
  (todo pasa a módulos ES), cambian la gestión del color y las unidades de luz, y el parche de sombras habría que
  rehacerlo. Afecta a todo `page.html`, a `vmrig.js` y a `kit3d.js`.
- WebGPU está disponible en las versiones recientes de Safari y de Chrome para Android según la documentación pública,
  pero **no está comprobado en el iPhone ni en el Samsung del propietario** (POR VERIFICAR).
- Propuesta: una página de prueba aislada (`tools/` o una rama) que cargue un mapa con Three.js actual en WebGL y en
  WebGPU, y compare FPS, tiempo de fotograma, memoria y aspecto con las mismas cámaras en PC, iPhone y Samsung. La
  vuelta atrás es trivial: el juego no cambia mientras dure la prueba.

## 5. Organización modular propuesta (propuesta 4)
Sin rehacer nada y sin carpetas por tenerlas. Cada sección de `page.html` que ya tiene sus límites pasa a un archivo de
`client/`, con el patrón que ya usan `town3.js`, `rats.js` o `flora.js` (IIFE + objeto global), y `build.py` la incluye.

| Paso | Sección de `page.html` (líneas aprox.) | Destino | Por qué primero |
|---|---|---|---|
| 1 | Armas en 1.ª persona procedurales (1602–2281, ~680) | `client/vm-procedural.js` | La más grande y la más independiente (solo construye mallas) |
| 2 | Soldado articulado (2344–2752, ~410) | `client/soldier.js` | Lo usan bots y rival online; aislarlo facilita animaciones nuevas |
| 3 | Audio (1426–1545) y efectos (1546–1601) | `client/audio.js`, `client/fx.js` | Pocas dependencias |
| 4 | Panel F3, autotest de puntería, diagnóstico de tiro | `client/debug.js` | Herramientas, no juego |
| 5 | Red del cliente (4062–4392, ~330) | `client/net-client.js` | Junto a `netcore.js`; tipos compartidos con el servidor |
| 6 | Bots (`class Bot`) | `client/bots.js` | Después del soldado |
| 7 | UI, menús, entrada | `client/ui.js`, `client/input.js` | Las más acopladas al estado global: al final |

Estructura resultante (resumen): `core/` (simulación compartida) · `client/` (render, recursos, armas 1.ª persona, bots
y fauna, mapas, controles, UI/HUD, red) · `server/` · `test/` · `tools/` (Python y Node). Cada paso es un commit con
`npm test` completo antes y después y capturas con las mismas cámaras (el `hash` cambia porque cambia el texto, pero
no el comportamiento).

## 6. Mejoras esperadas y riesgos (resumen)
| Propuesta | Mejora esperada | Riesgo principal | Cómo se controla |
|---|---|---|---|
| Higiene (1) | Sesiones nuevas listas con `npm ci`; CI y PC iguales | Ninguno relevante | `npm test` |
| Tipos (2) | Errores detectados antes de ejecutar; mensajes de red con forma garantizada | Falsos avisos al principio | Solo afecta a desarrollo |
| KTX2 (3) | Mucha menos memoria de GPU en iPhone; menos riesgo de que Safari recargue la página | Calidad de normales; carga más lenta en móviles viejos | Bandera, capturas, medida en iPhone, vuelta atrás quitando la bandera |
| Módulos (4) | Cambios más rápidos y seguros | Romper una referencia global | Un paso por commit, pruebas completas |
| Render (7) | Menos ms de CPU por fotograma, más margen en iPhone | Rayas o sombras distintas | Pruebas de sombras y capturas |
| WebGPU (9) | Quizá más rendimiento a largo plazo | Incompatibilidades, reescritura grande | Solo prueba aislada |

## 7. Impacto en rendimiento
- Higiene, tipos y módulos: **0** en el juego (el mismo código, reordenado o con comentarios; se comprueba con las
  pruebas y con capturas).
- KTX2: menos memoria de GPU y menos ancho de banda de texturas (ESTIMACIÓN 4–8 veces menos memoria); coste extra de
  transcodificar al cargar (POR VERIFICAR en móvil).
- Render: hoy ~2 ms de CPU por fotograma en envío de dibujo en la GTX 1050 Ti (MEDIDO); en iPhone, no medido.
- Rust/WASM: sin mejora esperable con la carga actual (MEDIDO: la lógica son ~1 ms por fotograma).

## 8. Compatibilidad
| Propuesta | PC | Android | iPhone |
|---|---|---|---|
| 1, 2, 4, 5, 6, 8 | Igual que hoy (JavaScript del mismo tipo) | Igual | Igual |
| 3 KTX2 | Sí (BC/ETC2 según GPU) | POR VERIFICAR en el Samsung | POR VERIFICAR (ASTC en GPU Apple) |
| 7 Render | Igual | Igual | Igual; se mide |
| 9 WebGPU | Navegadores recientes | POR VERIFICAR | POR VERIFICAR; siempre con WebGL de reserva |
| Servidor (Cloudflare) | Sin cambios: sigue siendo JavaScript con `core/` compartido | — | — |

GitHub Pages y Cloudflare Workers siguen sirviendo exactamente lo mismo en todas las propuestas salvo la 9.

## 9. Complejidad de mantenimiento
- Hoy: muy pocas piezas (Python + JavaScript, sin dependencias en tiempo de ejecución), pero un archivo gigante.
- Con 1+2+4: una dependencia de desarrollo más (TypeScript), un `tsconfig.json`, y archivos más pequeños. Es el mejor
  equilibrio.
- Con 3: herramienta de texturas en desarrollo y un cargador más en el juego. Aceptable si mejora el iPhone.
- Con 9 o 10: segunda cadena de herramientas (módulos ES / Rust + wasm-pack). Solo si la medida lo justifica.

## 10. Plan progresivo (cada fase necesita aprobación; ninguna empieza sola)
| Fase | Contenido | Toca el juego publicado | Validación |
|---|---|---|---|
| T0 | Higiene de herramientas (propuesta 1) | No | `npm test`, CI verde |
| T1 | `tsc --noEmit` sobre `core/` + tipos compartidos de red/armas/mapa (2) y caída de daño unificada (5) | Solo comentarios y una función movida; mismo comportamiento. Toca `core/` → redespliega el servidor | `npm test`, pruebas de servidor |
| T2 | Separar `page.html` en módulos, pasos 1–7 de §5 (4) | No (mismo JS) | `npm test` por paso, capturas |
| T3 | Prueba aislada KTX2 tras `&tex=ktx2` (3) | Solo con la bandera | Capturas, memoria, **FPS en el iPhone y el Samsung del propietario** |
| T4 | TypeScript real para módulos nuevos (6) | No | `npm test` |
| T5 | Optimización de render medida (7) | Tras bandera hasta aprobarla | Capturas, llamadas, ms, sombras |
| T6 | Investigación Three.js actual / WebGPU en página aparte (9) | No | Informe comparativo; decisión del propietario |
| — | Rust/WASM (10) | No | Solo si aparece un cuello de botella medido |

Recomendación: empezar por **T0 y T1** (riesgo casi nulo, beneficio inmediato) y, en paralelo, que el propietario
decida si quiere la prueba **T3**, porque es la que más puede mejorar el iPhone y la única que requiere sus dispositivos.
