# Iluminación horneada del PUEBLO (`?lm=1`) — 24/25-11-2026

Petición: que SNIPER DUEL se parezca más a Call of Duty / PUBG sin cambiar de motor (Three.js r128, WebGL). Fase 1 de 5:
luz horneada con Blender, sombras suaves y rincones más oscuros, casi sin coste en el juego (iPhone incluido).

**Estado**: IMPLEMENTADO · PROBADO EN NAVEGADOR (SwiftShader: aspecto, llamadas y triángulos) · PENDIENTE DE QUE EL
PROPIETARIO LO VEA EN SU PC Y SU IPHONE. Va detrás de la bandera `?lm=1` (se recuerda en el aparato; `?lm=0` la quita).
Solo pasa a ser lo de por defecto si el propietario lo aprueba.

## Qué se ve
- **Oclusión ambiental** (canal R): las esquinas, el encuentro de pared y suelo, las jambas de puertas y ventanas, bajo
  los aleros y balcones, más oscuros. Alcance 0,7 m (con 3 m las habitaciones quedaban negras; con 1,2 m salían
  manchas grises alrededor de cada contraventana).
- **Cuánto cielo ve cada punto** (canal B, oclusión a 8 m): dentro de las casas la luz del cielo baja (más oscuro,
  como en un juego de tiros moderno) y sube junto a puertas y ventanas.
- **Sombra del sol horneada** (canal G), con penumbra (sol de 2,5°) y el mismo sol que el juego (`LOOK.sunPos`):
  - donde hay sombra de tiempo real (MEDIO y ALTO, hasta 40–58 m) manda la de tiempo real, como siempre;
  - más lejos (donde la de tiempo real se apagaba) y en los muros que el sol roza, se usa la horneada: ahora **las
    sombras siguen a lo lejos**;
  - en **BAJO** (sin sombras de tiempo real) es la única: BAJO **gana sombras** sin coste.

Recibe horneado lo que el juego genera por código: paredes, tejados y suelo del pueblo (`client/town3.js`, mallas
`p3_*`) y las 8 casas por dentro y por fuera (`client/casas.js`, mallas `casas_*`). Las piezas del kit
(`assets/kit.glb`: ventanas, balcones, coches, árboles, la fuente…) **hacen sombra** sobre ellas en el horneado, pero
conservan su propio sombreado (ya horneado en sus colores de vértice por `tools/blender/kit.py`).

## Coste en el juego
- Una textura más: `assets/lightmaps/pueblo_lm.jpg` (2048×2048 JPG; en la GPU 16 MB + mipmaps).
- `pueblo_uv2.bin` (~0,5 MB): el segundo juego de UV de cada vértice que recibe.
- Por píxel: una lectura de textura en los materiales del pueblo. **Las mismas llamadas de dibujo y los mismos
  triángulos** (medido abajo). Cada material del pueblo tiene una copia «+lm» (otro programa de sombreado por material).
- Nada de colisiones, balas ni servidor: `core/mapdata.js` no cambia.

## Cómo se hace (herramientas, `tools/lightmap/`)
```
python3 build.py
node tools/lightmap/dump.js                       # la geometría REAL del pueblo, sacada del juego (Playwright)
node tools/lightmap/pack.js --size 2048           # uv2 + atlas (o --solo encalada --size 1024: una casa)
D:\Blender\blender.exe --background --factory-startup --python tools/lightmap/bake.py -- tools/lightmap/.work 128
python3 tools/lightmap/finish.py                  # → assets/lightmaps/pueblo_lm.jpg
node tools/lightmap/check.js                      # en el navegador: cuántas mallas lo reciben y si alguna no coincide
node test/lightmap.test.js                        # archivos coherentes
```
- `dump.js` saca las mallas tal como se dibujan (mismo orden de vértices), así el uv2 encaja sin repetir en Node la
  construcción del pueblo.
- `dump.js` también saca las cajas de sombra de los edificios (`shadow_proxies`, que solo se dibujan en el mapa de
  sombras): las fachadas del pueblo no son volúmenes cerrados y, sin ellas, el sol atravesaba los edificios. Se quitan
  las que caen dentro de las 8 casas habitables (si no, su interior saldría negro).
- `pack.js` une los cuadriláteros coplanarios que se tocan (sin costuras y con muchos menos trozos: 33 013 → 18 921),
  salvo si el trozo unido queda hueco (el bordillo de la plaza era un anillo de 45 m), proyecta cada trozo en su plano
  y los coloca en el atlas por estantes con 2 texeles de margen. Densidad buscada sola: la mayor que cabe (pueblo:
  7,23 texeles/m, unos 14 cm por texel; el pueblo de fuera a ⅓ y la tierra a ½). Los vértices que no reciben apuntan a
  un cuadrado blanco en la esquina (0,0): sin efecto.
- `bake.py` (Blender 5.2, Cycles en la GTX 1050 Ti con OptiX, 128 muestras, ~1 min): oclusión a 0,7 m, oclusión a 8 m
  y la sombra del sol. Las superficies que reciben se separan 2 cm de su plano (el suelo está en el mismo plano que la
  arena). Las piezas finas del kit pegadas a las fachadas (contraventanas, marcos, rejas, toldos, macetas) hacen sombra
  del sol pero no oclusión.
- **La sombra del sol no usa el horneado «SHADOW» de Blender**: en Blender 5.2 deja 0,17 bajo un cubo (debería ser 0)
  y pasa de 1 (medido con un plano y un cubo). Se hornea la luz directa del sol sola (sin cielo ni color, energía π →
  exactamente N·L) y se divide por N·L, sacado de un horneado de normales de los mismos texeles.
- `finish.py` rasteriza los triángulos en el atlas para saber qué texeles horneó Blender, suaviza solo entre ellos y
  rellena 8 texeles alrededor de cada trozo (el margen de Blender no se aplicaba y los mipmaps leían el vacío: líneas
  oscuras y verdes en los bordes). Lo que sigue vacío, blanco.
- Seguridad: cada malla lleva su nº de vértices y una firma de sus posiciones. Si el pueblo cambia y una malla ya no
  coincide, esa malla se queda sin horneado (no se ve mal) y la consola lo dice; hay que volver a hornear.

## Banderas para comparar
`?lm=1` encendido · `&lmao=0.7` fuerza de la oclusión · `&lmcielo=0.75` cuánto oscurece el interior ·
`&lmsol=0` sin la sombra horneada del sol.

## Medidas (25-11-2026)
Capturas con las mismas cámaras (`tools/capture-scenes.js`, SwiftShader: vale para aspecto, llamadas y triángulos):

| Vista | Calidad | Llamadas sin / con | Triángulos sin / con |
|---|---|---|---|
| p3-general | ALTO | 166 / 166 | 475 861 / 475 861 |
| calle (norte) | ALTO | 170 / 170 | 486 283 / 486 283 |
| interior ENCALADA | ALTO | 166 / 166 | 485 993 / 485 993 |
| p3-general | BAJO | 121 / 121 | 276 766 / 276 766 |

- Mallas con horneado: 52 en ALTO y MEDIO (132 052 vértices), 50 en BAJO (sin el pueblo del sur de fuera). Ninguna
  «no coincide».
- GPU real del PC (GTX 1050 Ti, `GPU=1 node tools/gf-medir.js`, PUEBLO, 10 s): 60 FPS con y sin `?lm=1` (el tope de la
  pantalla), CPU de dibujo 1,85 / 1,81 ms. En el iPhone: PENDIENTE (lo mide el propietario).
- Atlas: 2048×2048 JPG, 1,9 MB; uv2 516 KB. En la GPU, 16 MB más mipmaps (~21 MB).
- Lo que cambia a la vista (píxeles que cambian > 12 de 765 en la suma RGB): interior de ENCALADA 97 % (brillo medio
  116 → 81: el interior pasa a estar en penumbra), calle 21 %, vista general 15 %.
- BAJO: sombras del sol que antes no tenía (cajas, fuente, jardineras, edificios); en la zona de sombra de una caja,
  el brillo baja de 188 a 80 (con el horneado «SHADOW» de Blender bajaba solo a 140).

Capturas: `docs/img/horneado/` (antes arriba, después abajo).
