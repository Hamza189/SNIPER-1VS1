# CARGA — que el juego, los personajes, las armas y los mapas carguen antes (03-11-2026)

Del propietario: «Los personajes, armas, mapas tardan en cargar, optimiza esto, que vaya mucho más rápido todo el juego…
si hace falta utilizar C, C++ o C# puedes utilizarlo».

**Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE (el service worker solo funciona en la
web publicada, https).

## Qué se midió
Herramienta: `node tools/carga.js` — abre el juego como un móvil (tamaño del iPhone, táctil, la CPU de Chrome frenada 4×,
la GPU real del PC), dos visitas seguidas, y saca un perfil de CPU: qué funciones gastan más tiempo hasta que todo está.

- **Descargas.** Cada archivo se pedía con `?v=<versión del juego>`. Esa versión cambia en cada publicación, así que tras
  cada publicación el navegador volvía a bajarlo **todo** (14 MB la primera vez en el iPhone; hasta ~78 MB con los
  personajes 4K y las skins). Además GitHub Pages solo deja guardar los archivos 10 minutos (`max-age=600`): pasado ese
  tiempo el iPhone vuelve a preguntar por cada uno (en los informes, con 0 MB descargados el juego tardaba 6–9 s en
  estar listo).
- **CPU al arrancar** (CPU 4×, como un móvil): el programa principal ~2 s; compilar todos los sombreadores de golpe
  (`precompileAll`) 1,8–2,9 s, y se repetía cada vez que llegaba algo (armas, cada personaje, ratas, hierba); la hierba
  del pueblo (`floraSetup`) 1,4 s; la preparación del mapa del MENÚ 2 (`m2Warm`) ~1 s repartido en ~10 veces; descomprimir
  las texturas KTX2 (WebAssembly, C++) ~1,3 s; subirlas a la GPU ~0,7 s.
- **Tamaño de los personajes:** 13–17 MB cada uno (en KTX2): ~12 MB son sus tres texturas 4K ya comprimidas (UASTC +
  Zstandard: gzip no las reduce) y 2,5–4,6 MB su geometría y sus 29 animaciones. R2 no comprime al enviar; GitHub Pages sí
  (el kit pasa de 1 MB a 270 KB).
- **Descartado:** no pedir a la GPU la confirmación de cada sombreador (`renderer.debug.checkShaderErrors`). Quita
  `Jr` del perfil (4,2 s) pero el tiempo hasta tener el juego no mejora medible y en Safari podría pasar la compilación a la
  primera vez que se dibuja (tirones en partida). Queda solo como prueba: `&shadercheck=0`.

## Qué cambia
1. **Versión por archivo.** `build.py` calcula la huella (SHA-1, 8 caracteres) de cada archivo de `assets/` y `vendor/`
   (las entregas de `assets/3d/imports` solo si el código las usa) y la mete en la página (`ASSET_V`, ~31 KB). Todos los
   cargadores de three.js pasan por `av()` (`THREE.DefaultLoadingManager.setURLModifier`), también los archivos de R2, y
   las imágenes del menú. Tras una publicación solo se descarga lo que cambió de verdad.
2. **Service worker** (`sw.js`, solo en https): los archivos con versión se sirven desde el dispositivo sin preguntar a la
   red; al llegar una versión nueva de un archivo, la vieja se borra. La página, `version.json` y el servidor online van
   siempre a la red (la página usa la copia guardada solo sin conexión). `?sw=0` lo quita de ese dispositivo.
3. **Una sola compilación de sombreadores**, 400 ms después de la última carga y después del primer fotograma del menú
   (antes, una por cada cosa que llegaba, y la primera antes de dibujar nada). Si empieza una partida antes, se hace en
   ese momento: nunca a mitad de partida.
4. **La hierba del pueblo**, 2 s después de llegar sus archivos (en el menú no se ve), o al empezar una partida si es
   antes.
5. **El MENÚ 2 prepara el mapa una sola vez**, cuando deja de llegar nada nuevo durante 1,5 s (antes, ~10 veces mientras
   cargaba).

## Carga progresiva del operador y del arma (03-11-2026, segunda parte)
Del propietario: «la web carga más rápido, pero el personaje sigue quedándose ahí pensando/cargando; quiero que el
personaje y el arma carguen rápido».

Ya descargados, lo que tarda es la CPU: cada personaje trae tres texturas 4K en KTX2 que el transcodificador
(WebAssembly, C++) descomprime de una en una en el móvil, y cada skin del rifle unas 17 (ÚLTIMA, SAHARA).

- **Operador:** el menú carga a la vez su versión 1K (`personaje_1k.glb`: mismo modelo y animaciones, texturas JPG que
  el navegador descomprime solo) y la completa. Sale con la 1K en cuanto llega y se cambia sola a la completa; la 1K sale
  después de la GPU. Mientras, una nota pequeña dice «ALTA RESOLUCIÓN…».
- **Arma:** cada skin tiene un modelo ligero (`arma_tp.glb`, 0,1–0,3 MB, mismo sistema de coordenadas y mismas piezas).
  Mientras la 4K se descomprime, la muestra de ARMAS y las manos del operador llevan ese modelo en vez de «CARGANDO…» o el
  HALCÓN.
- Solo en el menú: los personajes y las armas de la partida no cambian.

Medido con `node tools/carga-operador.js` (CPU ×4 como un móvil, FSB y ÚLTIMA, desde que se abre la página, que ya
tarda 7–10 s en ese PC con la CPU frenada):

| | Antes (solo 4K) | Ahora |
|---|---|---|
| Operador en pantalla | ~17 s | 10,6 s (1K; la completa entra sola a los ~17 s) |
| Arma ÚLTIMA en ARMAS | ~42 s | 12,8 s (modelo ligero; la 4K entra sola después) |

## Carga progresiva también en partida (04-11-2026)
El propietario, cuando se le ofreció: «sí».

- **Todos los personajes** (el operador del menú, los bots, el rival online y tú en 3ª persona) salen con su versión 1K
  en vez de la figura de cajas mientras llega la completa, y se cambian solos. Está en el código común de los personajes
  (`pj2Attach` / `pj2PrevLoad`): el menú ya no tiene nada propio. La 1K de un personaje sale de la GPU cuando nadie la
  lleva. Las zonas de impacto no cambian (nunca salieron del modelo).
- **Tu arma en 1ª persona y el cuchillo**: el modelo ligero de la skin (`arma_tp.glb`) en vez del HALCÓN o la NAVAJA
  mientras llega la completa (`wskinRifle` / `wskinKnife`, `WS_ST.<rifle|knife>.light`). Se monta en los mismos nodos
  (cuerpo, cerrojo, cargador), así que recargar y accionar el cerrojo funcionan igual. Al cambiar de skin salen de la
  memoria la completa y la ligera de la anterior; la ligera de la actual, en cuanto entra la completa.
- Las pruebas que esperaban «el personaje / la skin ha llegado» ahora esperan a la versión completa (`!v2prev`,
  `!light`); `armas.browser` comprueba además que el modelo ligero está en las manos mientras llega.

## PANTALLA DE CARGA con barra del 0 al 100 % (`?carga=2`, 19-11-2026)
Del propietario: «la típica barrita que va del 0% al 100%, lo digo para que en ese momento cargue todas las armas,
texturas, personajes, mapas, etc...».

**Estado:** IMPLEMENTADO TRAS BANDERA · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE Y ANDROID. Lo de siempre
sigue por defecto hasta que el propietario lo apruebe.

**Cómo probarla:** abrir el juego con `?carga=2`. El aparato lo recuerda (las siguientes veces sale sin poner nada);
`?carga=1` vuelve a la entrada de siempre.

### Qué se ve
Negro grafito, blanco y el naranja del juego, con el logo. Sale lo primero, antes incluso de que llegue three.js. Debajo
de la barra, la categoría que está cargando, cuántas van y qué es (por ejemplo «PERSONAJES 2/4 · FSB»), el porcentaje y
una fila con las 7 categorías (MOTOR 3D, TEXTURAS, MAPA, PERSONAJES, ARMAS, PREPARANDO, PARA DESPUÉS). Cabe en el iPhone
en horizontal con las barras de Safari (932 × 320), en Android y en PC. Capturas: `docs/img/carga/` (`node tools/capture-carga.js`).

### La barra es real
Cada trozo de la barra es algo que el juego usa de verdad, leído de su propio estado (`client/carga.js` hace las cuentas;
`src/page.html`, bloque «PANTALLA DE CARGA», las piezas):

| Categoría | Qué cuenta como «hecho» |
|---|---|
| MOTOR 3D | three.js y el código del juego en marcha; las letras |
| TEXTURAS | todas las texturas de los mapas pedidas por `texLoad` (llegadas o fallidas) |
| MAPA | el mapa elegido con su modelo (CASA ATLAS, BARRIO…) y lo del PUEBLO que el juego carga siempre (kit, Casa Oliva, hierba, ratas) |
| PERSONAJES | tu operador (su vista rápida 1K y el completo), el de los bots y, **solo en PC**, los otros personajes: el modelo en `PJ2.tpls` |
| ARMAS | los fusiles, la escopeta, la pistola, el cuchillo y las manos (`viewmodels.glb`), y los aspectos que llevas, completos |
| PREPARANDO | ningún archivo de three.js a medias; después, la hierba, todos los sombreadores, los bots de la primera partida, el calentamiento del menú (texturas a la GPU) y el sonido |
| PARA DESPUÉS | archivos solo **descargados** (sin decodificar): ver abajo |

Mientras una pieza no está, cuenta lo que lleva descargado (los bytes reales de cada archivo, que three.js va dando) hasta
un 90–95 % de lo suyo. La barra solo sube.

### La memoria del iPhone (decisión)
Safari cierra la página si se pasa de memoria (29-10 con KTX2, 17/18-11 con la SALA 1V1). «Cargar todo» en el móvil
significa **tenerlo descargado, no tenerlo en memoria**:
- En el móvil a la GPU solo va lo que el juego ya cargaba: tu operador, los bots y el mapa. Y lo que pone en marcha la
  pantalla va **de uno en uno y en orden** (la prueba lo comprueba).
- Los demás personajes, los demás aspectos de arma y los demás mapas solo se **descargan**, en su versión ligera
  (`personaje_1k.glb`, `arma_tp.glb`): archivos con su propia huella, así que el service worker los guarda también entre
  publicaciones. Al elegir otro personaje sale al momento su versión 1K y la completa llega detrás, como siempre.
- Los completos de 4K de los demás personajes no se descargan en el móvil: están en R2 con la versión de cada publicación
  (`?v=BUILD_HASH`), así que se volverían a bajar (~50 MB) tras cada publicación sin usarse. Ver «Lo siguiente».
- En PC los cuatro personajes van a memoria (el rival online puede llevar cualquiera): +132 MB de texturas, de sobra en
  una GTX 1050 Ti de 4 GB.
- Medido (`node tools/carga2.js`, memoria de texturas de todo lo que está en la GPU, `__SD.cgMem()`): en el móvil la
  memoria, una vez asentada, es **la misma con y sin la pantalla: 141,4 MB**.

**Fallo que ya estaba (arreglado, también sin la bandera):** el operador del menú, mientras no sabía qué personaje has
elegido, se ponía el «por defecto» (el S.W.A.T. en ALTO) en cuanto llegaba otro personaje (la vista 1K de los bots) y lo
cargaba en la GPU para nada: **64 MB de más en el móvil**, según el orden de llegada. Ahora espera a tu personaje
(`pj2Attach`, `R.pjOwn`).

### ENTRAR YA y los fallos
- **ENTRAR YA** aparece cuando el menú tiene su mínimo (motor, tu operador en 1K y las armas) y la espera ya se nota
  (2,5 s), o a los 15 s aunque falte. Lo que queda sigue cargando detrás del menú. Cuando ya está todo lo de la partida y
  solo quedan descargas, el botón dice ENTRAR.
- Un archivo que falla no bloquea: la pieza queda como fallida, la barra sigue y el juego usa su versión sencilla (la
  figura de cajas, el HALCÓN…). Una pieza que no se mueve en 45 s mientras no llega nada de la red se deja al juego.
- Mientras la pantalla tapa todo, el menú de detrás se dibuja ~8 veces por segundo (la CPU va a cargar).

### Medidas (antes = sin pantalla; después = `?carga=2`)
`node tools/carga2.js` (con `?r2=1`, los KTX2 de la web real; GPU del PC con `--use-angle=d3d11`; el «móvil» es el tamaño
del iPhone, táctil y con la CPU de Chrome frenada ×4). «Listo para jugar» = tu operador y los bots completos, las armas,
las texturas, y con la pantalla, la pantalla quitada. «Partida al momento» = se empieza una partida justo entonces.

Dos tandas cada una (las de la red y la CPU frenada varían mucho de una vez a otra: se dan las dos).

| PC (GTX 1050 Ti, 1280 × 720, ALTO) | Antes | Después |
|---|---|---|
| Listo para jugar | 11,2 s / 24,1 s | 12,2 s / 46,2 s (ENTRAR YA desde 3,4 s / 8,1 s) |
| Texturas en la GPU | 120 MB | 252 MB (los 4 personajes) |
| Partida al momento: `startMatch` | 873 ms / 988 ms | **23 ms / 132 ms** |
| Fotograma más largo en sus 3 primeros segundos | 947 ms / 782 ms | **65 ms / 360 ms** |
| Fotogramas de más de 100 ms en esos 3 s | 3 / 10 | **0 / 7** |
| Fotogramas en esos 3 s | 62 / 38 | **178 / 94** |

| Móvil (932 × 430, táctil, CPU ×4) | Antes | Después |
|---|---|---|
| Listo para jugar | 37,6 s / 66,7 s | **35,0 s / 53,7 s** (ENTRAR YA desde 14,9 s / 28,7 s) |
| Texturas en la GPU | 112 MB al estar «listo»; 141,4 MB a los 8 s (aún llegaba el color de los bots) | 141,4 MB (igual) |
| Partida al momento: `startMatch` | 1 334 ms / 892 ms | **339 ms / 628 ms** |
| Fotograma más largo | 1 331 ms / 761 ms | **471 ms / 466 ms** |
| Fotogramas en los 3 primeros segundos | 13 / 13 | **27 / 22** |

Lectura:
- **Tirones al empezar partida:** claramente menos en los dos (en PC el arranque pasa de casi 1 s a 23–132 ms). Lo que
  antes se hacía al pulsar JUGAR (hierba, sombreadores, bots, calentar el mapa) ya está hecho.
- **Tiempo hasta poder jugar:** en el móvil, algo menos (el menú de detrás se dibuja poco y la CPU va a cargar). En PC
  puede tardar más **la primera vez**, porque espera a los cuatro personajes (~70 MB de R2); ENTRAR YA sale a los 3–8 s.
  La segunda visita los tiene en el dispositivo.
- **Memoria en el móvil:** la misma una vez asentada (141,4 MB). Sin el arreglo del operador del menú, con la pantalla
  salían 205 MB (el S.W.A.T. cargado de más): por eso se arregló.
- Antes de esta medida, en el perfil del móvil `audioInit` (crear el sonido) costaba 0,3–0,5 s en el primer JUGAR: ahora
  se hace en PREPARANDO y queda en pausa hasta el primer toque. **Comprobar en el iPhone que el sonido sale.**
- WebGL por software (las pruebas) no vale para tiempos; estas medidas son con la GPU del PC. Nada de esto prueba el
  iPhone de verdad: PENDIENTE DE VALIDACIÓN EN IPHONE.

### Archivos
- `client/carga.js` (lógica pura: pesos, orden, porcentaje, etiqueta, ENTRAR YA) · `src/page.html` (CSS `#carga`, el HTML
  y su guion inicial, el contador de archivos y bytes junto a `setURLModifier`, y el bloque «PANTALLA DE CARGA» antes de
  `window.__SD`) · `test/carga.test.js` · `test/carga.browser.test.js` · `tools/carga2.js` (medidas) ·
  `tools/capture-carga.js` (capturas).

## Lo siguiente (no hecho todavía)
- **Versión estable para los archivos de R2.** Los KTX2 de R2 se piden con `?v=BUILD_HASH`, que cambia en cada
  publicación: el service worker los vuelve a bajar enteros tras cada una (un personaje 4K son 10–28 MB). Con la huella de
  cada archivo (como `ASSET_V`) solo se bajarían cuando cambian, y la pantalla de carga podría descargar también los
  completos en el móvil.
- **Comprimir la geometría y las animaciones con meshoptimizer** (C++; su decodificador es WebAssembly y three.js r128 lo
  admite: `EXT_meshopt_compression`). Bajaría cada personaje unos 2–3 MB y cada arma algo menos. Hace falta comprobar que
  las animaciones, los morphs (agacharse) y las zonas de impacto quedan idénticos.

## Pruebas
- La batería completa (`npm test`). La pantalla de carga: `node test/carga.test.js` y `node test/carga.browser.test.js`.
- En la web publicada: segunda visita sin descargas de `assets/` (todas desde el service worker).
