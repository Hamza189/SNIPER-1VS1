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

## Lo siguiente (no hecho todavía)
- **Comprimir la geometría y las animaciones con meshoptimizer** (C++; su decodificador es WebAssembly y three.js r128 lo
  admite: `EXT_meshopt_compression`). Bajaría cada personaje unos 2–3 MB y cada arma algo menos. Hace falta comprobar que
  las animaciones, los morphs (agacharse) y las zonas de impacto quedan idénticos.

## Pruebas
- La batería completa (`npm test`).
- En la web publicada: segunda visita sin descargas de `assets/` (todas desde el service worker).
