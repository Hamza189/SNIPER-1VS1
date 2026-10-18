# Contrato de assets 3D — SNIPER DUEL

Reparto del trabajo:

- **ChatGPT** diseña y entrega los modelos (GLB, texturas, LOD, scripts de Blender y documentación).
- **Claude** los valida, los integra en Three.js, conserva las colisiones, los optimiza, los prueba y los publica.
- **El usuario** prueba en el iPhone y aprueba.

Ningún modelo entra en el juego sin pasar antes por `tools/validate-glb.js`.

## 1. Carpetas

| Carpeta | Contenido | ¿Lo carga el juego? |
|---|---|---|
| `assets/3d/imports/` | Entregas tal cual llegan (GLB, fuentes `.blend`/`.py`, notas). Una subcarpeta por entrega: `AAAA-MM-DD_<id>/` | No |
| `assets/3d/models/` | GLB validados e integrados: `<id>.glb` | Sí |
| `assets/3d/textures/` | Texturas compartidas por varios modelos, solo si no van dentro del GLB | Sí, si un modelo las usa |
| `assets/3d/lod/` | LOD en archivos aparte, solo si no caben como nodos del mismo GLB | Sí |

El kit procedural actual (`assets/kit.glb`) y las texturas de `assets/tex/` siguen donde están; no se duplican.

## 2. Formato

- **glTF 2.0 binario (`.glb`)**, un archivo por asset, con las texturas dentro.
- **Sin compresión Draco, meshopt ni Basis/KTX2**: el cargador del juego (Three.js r128) no las lee. El validador las
  rechaza.
- **Unidades:** 1 unidad = 1 metro.
- **Ejes:** +Y arriba. La fachada principal mira a **+Z**.
- **Origen:** en el centro de la huella, a ras de suelo (y = 0).
- **Nodos LOD**: `<id>_LOD0` (ALTO), `<id>_LOD1` (MEDIO) y `<id>_LOD2` (BAJO), en la raíz o dentro de un único nodo
  raíz (como el `world` que escribe trimesh). Los tres comparten la misma silueta y el mismo volumen.
- **Normales en todas las primitivas.** Con aristas duras: vértices separados por cara, no compartidos entre caras en
  ángulo. En trimesh, `scene.export(ruta, include_normals=True)`.
- **Ningún hueco atraviesa el edificio.** Si el interior está vacío, cada abertura (ventana, puerta, escaparate) se
  cierra entera con su vidrio o panel, o se incluye un volumen interior cerrado. Si no, se ve a través del edificio
  donde las balas no pasan.
- Sin cámaras ni luces. Sin animaciones, salvo que se acuerden.
- **Materiales PBR** metallic-roughness:
  - base color en sRGB;
  - normal en convención OpenGL (+Y);
  - rugosidad y metal en G y B;
  - la oclusión (AO) puede ir horneada en el base color o en el canal R.
  - Vegetación con `alphaMode: MASK`; `BLEND` solo para el vidrio.
- **Nombres:** materiales `sd_<semántico>` (por ejemplo `sd_estuco`, `sd_piedra`, `sd_teja`, `sd_madera`, `sd_hierro`,
  `sd_vidrio`, `sd_vegetacion`), que permiten afinarlos desde el juego.
- **Licencia:** obra original. Si algo es CC0, se indica la fuente. No se aceptan assets de licencia dudosa.

## 3. Tamaño y rendimiento

**Sin límite de almacenamiento** (decisión del propietario, 12-10-2026). No hay máximo de MB por archivo ni de
memoria de texturas: el validador solo informa del tamaño. La única regla es que **el juego siga fluido en el iPhone**,
medido con el contador de FPS (AJUSTES → GRÁFICOS → «Mostrar FPS») en ALTO, MEDIO y BAJO.

- **Texturas:** potencias de 2. Hasta 4096 px de lado; por encima, algunos móviles no las cargan (límite técnico de
  WebGL, no de almacenamiento).
- **Triángulos por edificio (orientativo, por rendimiento):** LOD0 ≤ 15 000, LOD1 ≤ 6 000, LOD2 ≤ 1 500. Se pueden
  superar si la prueba en el iPhone lo permite.
- **Materiales por edificio:** pocos (cada uno es una llamada de dibujo); mejor atlas o texturas compartidas entre
  edificios.
- Claude genera las versiones reducidas para MEDIO y BAJO a partir de los originales.

## 4. Reglas de juego: lo que el modelo puede ocupar

Las balas y el servidor usan cajas fijas (`core/mapdata.js`). El modelo tiene que encajar en su caja; si no, aparece
una **cobertura falsa**.

- **Muros:** sobre las caras de la caja. Los huecos (vidrio, puertas) pueden entrar hasta 0,25 m desde la cara de la
  caja, no desde la pared.
- **A la altura del cuerpo (0,12–2,0 m):** nada a más de 0,45 m de la caja. Excepción: decoración baja (≤ 0,66 m) pegada
  a la pared, como macetas o bancos.
- **Por encima de 2 m:** balcones, toldos, faroles, aleros y ropa tendida pueden salir hasta 1,2 m de la fachada.
- **Por encima de la caja:** solo cabe el pretil, que llega a +0,35 m sobre la altura de muro H.
  - Un **tejado inclinado o chimeneas** más altos necesitan que se amplíe la caja de colisión del mapa. Eso es un cambio
    en el servidor y necesita aprobación.
  - Mientras tanto, el tejado debe ser plano (azotea) o quedar por debajo de H + 0,35.
- El validador lo comprueba con `--box W,D,H`. Después, `test/cover.browser.test.js` lo comprueba sobre lo que el juego
  dibuja de verdad.

## 5. Huecos del mapa (PUEBLO)

Medidas de las cajas de colisión. La caja llega a **H + 0,35 m** (el pretil). La rotación al colocarlo la hace Claude.

| Hueco | Centro x, z | Huella X × Z (m) | Muro H (m) | Caja hasta (m) | Azotea alcanzable | Ahora |
|---|---|---|---|---|---|---|
| E01 | -31, -31 | 14 × 12 | 7 | 7.35 | no | — (PUEBLO 2.0) |
| E02 | -31, -9 | 12 × 10 | 5 | 5.35 | no | — (PUEBLO 2.0) |
| E03 | -32, 16 | 12 × 12 | 9 | 9.35 | no | señorial (3.0) |
| E04 | -31, 37 | 14 × 10 | 6 | 6.35 | no | piedra (3.0) |
| E05 | 31, -33 | 12 × 10 | 8 | 8.35 | no | — (PUEBLO 2.0) |
| E06 | 33, -8 | 10 × 12 | 5 | 5.35 | no | — (PUEBLO 2.0) |
| E07 | 30, 17 | 14 × 10 | 7 | 7.35 | no | terracota (3.0) |
| E08 | 33, 38 | 10 × 10 | 10 | 10.35 | no | señorial (3.0) |
| E09 | -9, -31 | 8 × 8 | 4 | 4.35 | **sí** (rampa) | — (PUEBLO 2.0) |
| E10 | 13, -25 | 6 × 10 | 6 | 6.35 | no | — (PUEBLO 2.0) |
| E11 | -12, 27 | 10 × 6 | 5 | 5.35 | no | comercio (3.0) |
| E12 | 11, 31 | 8 × 6 | 4 | 4.35 | no | encalada (3.0) |
| E13 | -2, -43 | 10 × 5 | 3.5 | 3.85 | no | — (PUEBLO 2.0) |
| E14 | 3, 43 | 12 × 5 | 4 | 4.35 | no | taller (3.0) |

**Primer edificio (residencial mediterráneo de dos plantas)** — hay dos opciones:

- **A (sin tocar el servidor): hueco E10, 6 × 10 m, muros de 6 m.** Es el único hueco de dos plantas con proporciones
  parecidas a la referencia (8 × 6 × 6). Va de lado: la fachada principal de 6 m mira a +Z, hacia el norte y la plaza.
  Tejado plano con pretil, o inclinado como máximo hasta 6,35 m.
- **B (cambio de colisión, con aprobación):** la referencia exacta de 8 × 6 m con tejado a dos aguas. Se colocaría en
  E12 (8 × 6) subiendo la caja a 6 m más un prisma de tejado. Hay que regenerar `core/mapdata.js` y desplegar el
  servidor.

## 6. Entrega (qué manda ChatGPT)

1. `<id>.glb` con `<id>_LOD0/1/2`.
2. Una ficha `<id>.md` con:
   - nombre e identificador
   - hueco de destino
   - escala, orientación y origen
   - medidas (bounding box)
   - materiales y texturas (resolución)
   - triángulos por LOD
   - licencia y dependencias
   - animaciones, si las hay
   - notas de integración
3. Opcional: el `.blend` o el script de Blender que lo genera, para poder regenerarlo.

## 7. Qué hace Claude al recibirlo

1. Copia la entrega a `assets/3d/imports/AAAA-MM-DD_<id>/`.
2. Ejecuta `node tools/validate-glb.js <archivo> --box W,D,H` con el hueco de destino. Si falla, lo devuelve con el
   informe.
3. Lo integra detrás de una bandera (por ejemplo `?pueblo=3`), en una zona de prueba. No sustituye recursos estables
   sin una prueba previa.
4. Configura materiales (texturas compartidas, color), sombras y LOD por perfil gráfico.
5. Compara modelo actual y nuevo con las mismas cámaras (`tools/capture-scenes.js`): captura, llamadas de dibujo,
   triángulos y memoria (`tools/scene-metrics.js`).
6. Pasa los tests (`npm test`, que incluye la comprobación de coberturas falsas) y publica, pendiente de la prueba en
   iPhone.

## 8. Entregas

### E10 · `sd_e10_casa_oliva` (CASA OLIVA) — 11-10-2026

- **Entrega:** `assets/3d/imports/2026-10-11_sd_e10_casa_oliva/`, guardada tal cual con su script y sus vistas.
- **Validador:**
  - El original no pasa: ninguna primitiva tiene normales.
  - Por eso hay una copia `assets/3d/models/sd_e10_casa_oliva.glb` hecha con `node tools/glb-add-normals.js`. Las
    caras ya tenían sus vértices separados (ángulo máximo entre caras que comparten vértice: 1,2°), así que las
    normales salen exactas.
  - La copia cumple las reglas obligatorias: LOD 13 558 / 5 990 / 348 triángulos, 8 / 6 / 3 materiales, 5 MB y nada
    fuera de la caja en ningún LOD.
- **En el juego:** solo con `?pueblo=3` (`&e10=0` muestra el edificio anterior).
  - El edificio PUEBLO 2.0 se dibuja hasta que carga el GLB, así que el hueco nunca queda vacío con una pared invisible.
  - Las colisiones y el servidor no cambian.
  - El nivel de detalle depende de la distancia dividida por el zoom, para que con la mira no aparezca el LOD bajo:

    | Perfil | LOD0 | LOD1 | LOD2 |
    |---|---|---|---|
    | ALTO | < 35 m | 35–80 m | más allá |
    | MEDIO | — | < 55 m | más allá |
    | BAJO | — | < 30 m | más allá |

  - Sin sombras propias: la sombra la da la caja de siempre.
  - En BAJO, sin mapas de normales.
- **Coste medido** (mismas cámaras, navegador de escritorio): unas 9 llamadas de dibujo y 11 000 triángulos más en
  ALTO cerca; 7 llamadas y unos 4 000 triángulos en MEDIO y BAJO. Texturas: 15,4 MB de GPU.
- **Defectos del modelo, a corregir en la próxima entrega:**
  1. **Sin normales** (resuelto en la copia, pero el archivo tiene que traerlas).
  2. **Se ve a través del edificio a la altura del cuerpo.** El interior está hueco y hay aberturas sin cerrar:
     - ventanas laterales (±X) en z local ≈ −3,5 y +0,5, entre 1,2 y 1,8 m: el rayo cruza de una calle a la otra;
     - fachada +Z en x ≈ +2,1, entre 0,3 y 1,8 m: rendija junto a la puerta que deja ver la ventana trasera;
     - trasera −Z en x ≈ −2,1…−1,2, a 0,9 m.

     Mientras tanto, la integración añade un volumen interior opaco a 0,36 m de las caras (12 triángulos), que
     `test/e10.browser.test.js` comprueba.
  3. **Huecos de 0,28–0,33 m de fondo** desde la cara de la caja (el máximo es 0,25 m). La pared queda a 0,08–0,12 m,
     así que vidrios y puertas deben quedar como mucho a 0,13–0,17 m por detrás de la pared.
  4. **Memoria de texturas:** 11 texturas propias, 15,4 MB de GPU para un solo edificio. Para 14 edificios hace falta
     un juego de texturas compartido (`sd_estuco`, `sd_piedra`…), normales a 512 como máximo y color en atlas.
  5. **Color (para que decida el usuario):** en el juego el estuco se ve gris y blanquecino frente a los ocres y
     terracotas del pueblo.
- **Estado:** IMPLEMENTADO y PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE (aspecto, FPS y carga de 5 MB).

## 9. P0 — suelo de PUEBLO: qué necesita la integración

Plan acordado: ChatGPT fabrica (P0 suelo → P1 fachadas → P2 props → P3 guía de luz → P4 armas y personajes).
Claude integra, valida, mide y publica. Claude no rehace modelos, salvo para compatibilidad u optimización
(por ejemplo, añadir normales o tapar huecos que dejan ver a través).

**El suelo plano no se hace con piezas 3D, sino con texturas que se repiten.** El suelo ocupa medio mapa; con mallas
por piezas serían miles de objetos. Las piezas 3D se reservan para lo que tiene altura.

1. **Juegos de textura PBR repetibles, sin costuras**, uno por material:
   - `sd_suelo_<nombre>_basecolor.png` (sRGB), `_normal.png` (OpenGL, +Y) y `_roughness.png` (o `_orm.png`);
   - 1024² para ALTO (Claude genera 512² para MEDIO y 256² para BAJO);
   - indicar cuántos metros mide una repetición (hoy: adoquín 1,9 m, losas 3,2 m, espiga 0,8 m, asfalto 4,5 m,
     tierra 3,6 m, arena 4 m).
   - Materiales que se sustituyen: arena, tierra, adoquín (`setts`), losas (`slabs`), espiga (`herring`), canto
     rodado (`pebbles`), asfalto, hormigón y escombros (`rubble`).
   - Sin luz ni sombras pintadas en el color.
   - Color base sin blancos quemados: ninguna zona grande por encima de ~200/255.
   - Rugosidad de 0,6 a 0,95.
2. **Transición arena–pavimento:** una tira repetible con máscara alfa (MASK, no BLEND).
3. **Calcas (manchas, grietas, arena acumulada, aceite, alcantarilla, rejilla de desagüe):** un atlas PNG de 1024²
   con alfa y la lista de rectángulos (u0, v0, u1, v1 y tamaño en metros). Van planas, a 1–2 cm del suelo.
4. **Piezas con altura (GLB, con el mismo contrato que los edificios):**
   - bordillo recto de 1 m, esquina y rebaje para paso;
   - **altura máxima 0,09 m** (los pies no suben escalones: el suelo de colisión es plano);
   - nada del suelo por encima de 0,12 m.
   - LOD0, LOD1 y LOD2, con normales.
5. **Presupuesto (ya no se aplica: sin límite de almacenamiento desde el 12-10-2026; ver §3).** El suelo actual ya usa 18 MB de GPU (color a 512²; normal y rugosidad a
   256²) y el iPhone va a 60 FPS. El límite anterior de 10 MB era demasiado bajo y no cabía con texturas de 1024²: una
   textura de 1024² ocupa 5,3 MB con mipmaps. Queda así:
   - ChatGPT entrega **originales de 1024²** y el juego carga versiones reducidas:

     | Perfil | Color | Normal | Rugosidad |
     |---|---|---|---|
     | ALTO | 512² | 512² en plaza y adoquín, 256² en el resto | 256² |
     | MEDIO | 512² | 256² | — |
     | BAJO | 256² | — | — |

     A 1,6 m de altura, una losa de 2 m en 512² da 256 píxeles por metro, que es suficiente.
   - **Suelo nuevo en ALTO: 20 MB como máximo**, sustituyendo al actual (unos 2 MB más que hoy como mucho).
6. **Ficha:** lista de archivos, escala de cada textura, dónde va cada material y licencia (original, o CC0 con su
   fuente). Mapa de zonas: `docs/mapa-suelo-p0.png`.

**Detalles que fija la integración (P0, especificación de ChatGPT del 12-10-2026):**
- **Normales:** convención OpenGL (+Y, verde hacia arriba).
- **Repetición:** con losas o adoquines de 2 m sobre una plaza de 22 × 22 m se notaría el patrón. Nada llamativo y
  único dentro de la textura (una piedra muy distinta, una mancha): la variación grande la ponen las calcas y el color
  por zona del juego.
- **Brillo:** media del color base entre ~140 y ~190 (sRGB) y casi nada por encima de 220. Lo que hoy tiñe el suelo
  (color por vértice) pasará a blanco con las texturas nuevas: el color de la textura es el que se verá.
- **Calcas:** atlas de 1024² en rejilla de 4 × 4 celdas de 256 px.
  - **16 px de margen transparente** dentro de cada celda; si no, al alejarse se mezclan las vecinas (mipmaps).
  - Tabla con celda, nombre y tamaño real en metros.
  - Alcantarillas, rejillas, tapas y grietas: borde nítido (MASK).
  - Manchas, humedad, arena suelta y suciedad de esquina: borde suave permitido, porque son pequeñas y planas y se
    dibujan mezcladas sin coste apreciable.
- **Transición arena–pavimento (1024 × 256):** borde irregular y suave, sin efecto spray. Tiene que repetirse a lo
  largo (los extremos izquierdo y derecho encajan) y cubrir 1 m de ancho de tira.
- **Bordillos: un solo GLB** `sd_ground_curb_kit_01.glb` con un nodo por pieza (`sd_curb_straight_1m`, …), mejor que
  siete archivos.
  - Origen en el suelo (y = 0), al principio de la arista que da a la calle.
  - Largo hacia +X, cara vista hacia +Z (la calle) y fondo hacia −Z (la acera).
  - Rebaje: de 0,09 m a 0 m a lo largo de +X.
  - Esquinas: giro hacia −Z.
  - Basta con LOD0 y un LOD1 de caja simple; con normales.
  - Los bordillos se funden en pocas mallas por zona: muchas piezas repetidas no suman llamadas de dibujo.
**Integración:** detrás de `?pueblo=3`, con `&suelo=0` para comparar. Capturas con las mismas cámaras en ALTO, MEDIO y
BAJO, coste en memoria y llamadas de dibujo, y prueba en iPhone antes de darlo por bueno.

### Prueba en iPhone del 12-10-2026 (vídeo del usuario, `?pueblo=3`)

- **Fluidez:** al moverse, la grabación tiene unos 57–58 fotogramas distintos por segundo (cerca de 60).
- **CASA OLIVA:** solo aparece de lejos (LOD1). Se ve blanca y plana: sin contraventanas en ese nivel y con el estuco
  pálido. El usuario no la aprueba; la sustituirá el kit de fachadas P1.

## 10. P0 Ground Pack v1 (ChatGPT, 12-10-2026): resultado de la integración

- **Entrega:** `assets/3d/imports/2026-10-12_p0_ground_pack_v1/`, guardada tal cual.
- **Copias del juego:** generadas por `tools/p0/make_p0_textures.py` en `assets/tex/p0*` (ALTO `p0_`, MEDIO `p0m_`,
  BAJO `p0b_`).
- **En el juego:** solo con `?pueblo=3&suelo=p0`. **No está activado por defecto, ni siquiera en `?pueblo=3`**, porque
  en las capturas no mejora el suelo actual.
- **Pruebas:** `test/p0.browser.test.js` (23 comprobaciones) verifica:
  - que sin la bandera no se descarga nada;
  - que existe cada textura que pide cada perfil;
  - mapas por perfil, sin rugosidad 0;
  - calcas planas (≤ 5 cm);
  - colisiones idénticas.
- **Uso por zona:**
  - plaza → `plaza`;
  - calle norte y bandas de la plaza → `cobble`;
  - aceras alrededor de los edificios → `sidewalk`;
  - explanadas ante las fachadas → `patch`;
  - suelo general → `sand`;
  - el asfalto no se toca.
- **Calcas:** 81 en ALTO, 58 en MEDIO y 15 en BAJO (solo las de borde nítido).
- **Arena acumulada:** 24 tiras junto a los bordillos que dan a la arena (ALTO y MEDIO).
- **Bordillos:** el GLB no se integra (ver defecto 8). La versión 3.0 ya dibuja sus bordillos de 9 cm con textura.

**Medido (navegador de escritorio, mismas cámaras):**

| | ALTO | MEDIO | BAJO |
|---|---|---|---|
| Memoria de texturas de toda la escena | 78,4 → 86,4 MB (+8) | 78,4 → 83,7 MB (+5,3) | 50,7 → 48,7 MB (−2) |
| Llamadas de dibujo | +5 | +5 | +3 |
| Triángulos | +210 | +160 | +30 |
| Descarga | ~0,4 MB | | |

- El suelo con el pack ocupa 20 MB en ALTO (el límite era 20). Las texturas antiguas del suelo siguen cargadas porque
  se usan en cunetas, tejados y otros elementos; por eso la memoria total sube 8 MB.
- FPS: pendiente del iPhone (el navegador de escritorio no sirve para medirlos).

**Fallo de integración encontrado y corregido:** en MEDIO la plaza y el adoquín pedían `p0m_*_r.jpg`, que no se había
generado. La textura que falta se lee como negra (rugosidad 0) y el suelo brillaba como un espejo. Corregido; el test
ahora falla si alguna textura da 404.

**Ajuste de material hecho por Claude:** con el color por vértice en blanco, las texturas se queman a blanco con el sol
del juego. Se mantienen los tonos de zona del suelo actual. Además, el rango de brillo pedido (140–190) era demasiado
claro para esta luz: mejor una media de ~120–160.

**Defectos, archivo por archivo (para la v2):**
1. **`*_normal.png` (los cinco): casi sin relieve.** La componente z media es 0,992 y los archivos comprimen a 2–28 KB.
   Las piedras no tienen volumen y es la razón principal de que el suelo se vea plano. Hace falta:
   - altura real por piedra (adoquín abombado, losas con canto biselado, juntas de 5–10 mm);
   - una fuerza que deje la z media en ~0,90–0,95.
2. **`sd_ground_cobble_01_*`:** 16 piedras por 2 m (12 cm), demasiado pequeñas y regulares: a la altura de los ojos se
   ve una malla gris. El adoquín actual mide ~20–25 cm, redondeado e irregular. Pedir 8–10 piedras por 2 m, formas
   irregulares, juntas oscuras y tono distinto por piedra.
3. **`sd_ground_plaza_01_*`:**
   - losas de 29 cm (7 × 7 por 2 m) con juntas onduladas: parece una cuadrícula deformada;
   - **costura en los bordes** (diferencia 1,9 frente a 0,3 dentro): `sin(yy*19)` y `sin(xx*14)` no son periódicos en
     [0, 1].

   Pedir losas de 40–60 cm, juntas rectas de ancho algo irregular, tono por losa y bordes periódicos.
4. **`sd_ground_patch_01_*`:** costura en Y (2,2 frente a 0,3) y en X (0,9), por la misma causa (`sin(yy*23)`,
   `sin(xx*35)`).
5. **Color base (los cinco):** solo ruido de nubes suave, sin variación por piedra ni grano fino; de cerca se ve borroso.
   Hace falta tono por piedra, poros y desconchones, y un color de junta.
6. **`sd_ground_decal_atlas_01.png`:**
   - suciedad, humedad, arena, gravilla y manchas están dibujadas como círculos sueltos (lunares) y no se leen como
     suciedad;
   - las grietas son líneas en zigzag de 2–4 px que a 512 px parecen garabatos;
   - tapas y rejilla son dibujos planos sin relieve ni material;
   - **falta el tamaño real en metros** de cada celda (Claude lo ha supuesto).
7. **`sd_ground_transition_sand_stone_01.png`:** el RGB es un único color plano (166, 145, 110), sin textura de arena.
   En el generador, `… if False else np.zeros_like(base)` anula la variación. El borde está bien.
8. **`sd_ground_curb_kit_01.glb`:** no pasa el validador.
   - Sin normales, con vértices compartidos entre caras a 90°: hay que exportar con aristas duras
     (`mesh.unmerge_vertices()` y luego `export(..., include_normals=True)`).
   - Sin UV y sin material (solo color por vértice).
   - Las esquinas «outer» e «inner» son la misma L reflejada.
   - Para sustituir a los bordillos actuales necesitarían UV en metros, un material `sd_ground_curb_01` con textura de
     piedra y biseles.

## 11. P0 Ground Pack v2 (ChatGPT, 12-10-2026): resultado

- **Entrega:** `assets/3d/imports/2026-10-12_p0_ground_pack_v2/`, guardada tal cual. La v1 se conserva al lado.
- **Copias del juego:** `tools/p0/make_p0_textures.py`, que ahora usa la v2 por defecto.

**Corregido respecto a la v1 (medido):**
- **Relieve:** z media de la normal entre 0,937 y 0,963 (antes 0,992).
- **Adoquín:** 9 × 10 piedras por cada 2 × 2 m (unos 22 × 20 cm).
- **Plaza:** losas de 50 cm con juntas rectas.
- **Costuras:** la diferencia en el borde es como la del interior (como mucho ~2 veces en acera y plaza, invisible a
  escala real).
- **Brillo:** medias de 136 a 164.
- **Bordillos (GLB):** pasa el validador. Normales planas correctas (cada cara con sus vértices), UV, material
  `sd_ground_curb_01`, 9,8 cm de alto como máximo.

**Comparado en el juego** (mismas cámaras a la altura de los ojos, ALTO/MEDIO/BAJO), material por material:

| Material | Veredicto | Motivo |
|---|---|---|
| Plaza | **Se queda como opción** (`&suelo=p0`) | Ni mejor ni peor: más grano y variación por losa, pero tono frío (verdes y lilas); el actual es piedra caliza cálida y limpia |
| Adoquín | Se mantiene el actual | Rectángulos pastel (rosa, verde, lila) que parecen adoquín moderno; el actual es canto rodado irregular y cálido con relieve |
| Acera | Se mantiene la actual | Gris frío; la actual es ocre |
| Explanada (patch) | Se mantiene la actual | Rejilla gris; la actual, espiga cálida |
| Arena | Se mantiene la actual | Equivalente; sin mejora apreciable |
| Tapas y rejilla | **Se quedan como opción** | Se leen bien (dos tapas en la plaza y dos alcantarillas en la calle norte, en una tira propia de 512 × 128) |
| Resto de calcas | Fuera | Las grietas siguen siendo líneas negras de 1 px a distancia de juego; suciedad, humedad y arena siguen siendo puntos |
| Tira de arena | Fuera | En el juego se ve como una mancha blanquecina sobre la acera |
| Bordillos | No se integran | Textura de 64 × 64 px y UV de 0 a 1 por pieza (en la de 2 m se estira el doble): a los pies se ve peor que el bordillo actual |

- **Coste de la selección** (navegador de escritorio):
  - texturas de la escena: ALTO 78,4 → 81,7 MB (+3,3), MEDIO +2,3 MB, BAJO +0,4 MB;
  - +2 llamadas de dibujo y +8 triángulos;
  - descarga: ALTO y MEDIO ~0,2 MB, BAJO ~24 KB.
- **Pruebas:** `test/p0.browser.test.js` (26) verifica, en cada perfil, que solo se usan los materiales elegidos.
- **Estado:** opción en `?pueblo=3&suelo=p0`; el suelo por defecto no cambia. PENDIENTE DE VALIDACIÓN EN IPHONE.

**Para la v3 (si se quiere seguir):**
1. **Color:** paleta cálida mediterránea. Variación por piedra dentro de ocres, cremas y arenas, sin verdes, lilas ni
   azulados.
2. **Adoquín:** canto rodado irregular y abombado (no rectángulos), con juntas de arena oscura.
3. **Calcas:** manchas orgánicas (ruido suave), no círculos; grietas de 4–8 px con borde oscuro y variación de ancho.
4. **Bordillo:** textura de 512 × 128 como mínimo, con UV en metros (1 m de bordillo = una repetición) y un bisel visible.

## 12. P0 v3, prototipo (ChatGPT, 12-10-2026): primera dirección fotográfica

- **Entrega:** `assets/3d/imports/2026-10-12_p0_v3_prototipo/` con plaza y adoquín: 6 PNG de 2048² más pruebas de
  repetición.
- **En el juego:** `?pueblo=3&suelo=v3` (copias de `tools/p0/make_p0v3_proto.py`: color y normal a 1024, rugosidad a
  512). El resto del suelo sigue como está.

**Medido en los archivos:**
- **Rugosidad:** 0,82 (plaza) y 0,80 (adoquín), correcta.
- **Normales:** z media de 0,977 y 0,974, más débiles que el 0,94 anunciado.
- **Color de la plaza:** media sRGB (201, 164, 118), más claro y anaranjado que el rango de 120–160 pedido. El adoquín
  da (155, 124, 95).
- **Bordes:** la diferencia entre bordes opuestos es 0 porque se igualaron mezclando en espejo. En la prueba de
  desplazamiento del 50 % aparecen:
  - **piedras duplicadas en simetría** (en el adoquín, piedras en «mariposa»);
  - **una losa fantasma** en la plaza;
  - **una línea horizontal recta** que cruza el centro.

  En el juego se ve una línea recta fina que atraviesa las losas.
- **Resolución efectiva:** baja, porque son recortes de la ilustración ampliados. A 2048 no hay más detalle que a ~512.

**En el juego (mismas cámaras):**
- **Es la primera vez que el suelo se lee como piedra de verdad:** travertino con poros y desgaste, y canto rodado con
  volumen. La dirección es la correcta.
- **Plaza:** muy cerca de servir, a falta de la costura y de bajar la saturación naranja (con el tono de zona del
  juego sale todavía más amarilla).
- **Adoquín:** piedras de ~30–40 cm (se pidieron 15–25), tonos anaranjados y borrosas de cerca. El actual sigue siendo
  más nítido.

**Para la v3 definitiva:**
1. Generar la textura **directamente a 2048²** (no recortes ampliados).
2. Hacer la continuidad **sin espejo**: desplazar el 50 % y rellenar (inpaint) la cruz del centro con contenido nuevo.
3. Plaza: media de ~150 / 135 / 110 (menos saturación).
4. Adoquín: 8–12 piedras por metro, de 15–25 cm.
5. Normales con z media de 0,92–0,95.

### 12.1 Pack provisional v3b (6 PNG de 2048², 12-10-2026)

- **Entrega:** `assets/3d/imports/2026-10-12_p0_v3b_provisional/`. Origen: la ilustración de ChatGPT ampliada (no son
  escaneos CC0). Los bordes se han igualado mezclando sin espejo.
- **Caliza:**
  - pasa la prueba de desplazamiento del 50 %: sin cruz central ni losas duplicadas;
  - color medio (157, 140, 120), dentro de rango;
  - z media de la normal 0,956; rugosidad 0,82.
- **Adoquín: no pasa.**
  - En el desplazamiento del 50 % se ve un eje de espejo vertical en el centro (piedras simétricas en «mariposa»).
  - Las piedras siguen siendo de ~30–40 cm.
  - Se mantiene el adoquín actual.
- **En el juego (`?pueblo=3&suelo=v3`, solo la plaza):**
  - en ALTO, MEDIO y BAJO la caliza se lee como travertino desgastado, con juntas y poros, cálido sin ser naranja;
  - **es el primer material entregado que mejora el actual**;
  - de muy cerca se nota algo blando porque viene ampliado.
- **Coste:** texturas de 1024 (color y normal) y 512 (rugosidad): unos +12 MB de memoria de texturas en ALTO (sin
  límite desde el 12-10-2026).
- **Estado:** **activada por defecto en `?pueblo=3` desde el 12-10-2026**: el propietario la aprobó a la vista («la
  textura de la plaza ha quedado muy chula»). `&suelo=0` vuelve al suelo anterior y `&suelo=p0` a la plaza v2. El
  adoquín sigue siendo el actual. FPS en iPhone: PENDIENTE DE VALIDACIÓN EN IPHONE.
- **CC0:** desde este entorno no se puede llegar a Poly Haven ni ambientCG (la red lo bloquea). Si se usan, el
  propietario los descarga en su ordenador y Claude los recoge de la carpeta conectada.

## 13. Adoquín CC0: Poly Haven `cobblestone_02` (12-10-2026)

- **Fuente:** https://polyhaven.com/a/cobblestone_02, de Amal Kumar, con licencia **CC0**. El propietario lo descargó en su PC. Originales y procedencia en `assets/3d/imports/2026-10-12_cobble_cc0_polyhaven/` (ver `FUENTE.md` en esa carpeta).
  - Color: PNG 2K sin pérdida.
  - Normal OpenGL y rugosidad: EXR 4K.
- **Preparador de ChatGPT:**
  - el color y la normal salen bien;
  - **la rugosidad sale blanca entera (255)**: el PNG de 16 bits se satura al convertirlo a RGB. Por eso se usa el EXR.
- **Medidas del escaneo:**
  - repetible sin costuras: el salto en el borde es 4,3 y dentro de la imagen 4,5;
  - sin espejo ni piedras duplicadas en el desplazamiento del 50 %;
  - nada por encima de 220;
  - z media de la normal 0,88 (relieve fuerte); rugosidad 0,80 (de 0,69 a 0,89).
- **Comparativa en el juego** (mismas cámaras en ALTO: calle norte, plaza y suelo a 1,6 m):

  | Variante | Resultado |
  |---|---|
  | Tal cual, 1,8 m (tamaño real) | Piedras de 4–6 cm: a pocos metros parece grava. La tierra naranja hace que la calle se lea como un camino de tierra |
  | Tal cual, 2,7 y 3,6 m | Mejor tamaño, pero sigue siendo naranja |
  | **Gris cálido (saturación × 0,5), 2,7 m** | **Candidata.** Canto rodado real con volumen y sombra entre las piedras (el actual es una malla de grietas dibujada), color que encaja con el pueblo, y de lejos se sigue leyendo como piedra. De cerca tiene menos contraste que el actual |
  | Gris cálido, 3,6 m | Piedras demasiado grandes y escaneo blando de cerca |

- **Generador:** `tools/p0/make_p0cc_cobble.py`. Solo redimensiona y desatura; no toca las formas.
- **Tamaños por perfil:**

  | Perfil | Archivos | Color | Normal | Rugosidad |
  |---|---|---|---|---|
  | ALTO | `p0cc_cobble_*` | 2048 | 2048 | 1024 |
  | MEDIO | `p0ccm_` | 1024 | 1024 | 512 |
  | BAJO | `p0ccb_` | 512 | — | — |

- **En el juego:** opción `?pueblo=3&adoquin=cc0`, en la calle norte y las bandas de la plaza. Mismos triángulos, draw calls y colisiones. `&adoquinm=<m>` cambia el tamaño de la repetición (por defecto 2,7).
- **Estado:**
  - **Activado por defecto en PUEBLO 3.0 desde el 17-10-2026.** El propietario lo vio en su iPhone («se ve todo el suelo muy bien en 4k»). `&adoquin=0` vuelve al adoquín anterior.
  - PROBADO EN NAVEGADOR (`test/p0.browser.test.js`). Las texturas de ALTO a 2048 cuestan unos 40 MB más de memoria de vídeo.
  - **Samsung de su pareja (17-10-2026): suelo gris** en BAJO y en ALTO, en varios navegadores.
    - En el navegador de pruebas, forzando WebGL 1 (`WEBGL1=1 node tools/capture-scenes.js …`), se ve bien.
    - Causa más probable: el enlace perdió `?pueblo=3&adoquin=cc0` al compartirlo, y sin eso se carga el pueblo clásico, cuyo adoquín es gris.
    - Arreglo:
      - el pueblo 3.0 se elige en AJUSTES › GRÁFICOS (CLÁSICO / 3.0) y se recuerda en el dispositivo;
      - en esa misma pestaña, una línea de diagnóstico muestra si está activo el pueblo 3.0, si el suelo es el nuevo, la versión de WebGL, la GPU y cuántas texturas han cargado o fallado. Con una captura desde cualquier móvil se sabe qué pasa.

## 14. P1 — fachadas con escaneos CC0 (plan, 17-10-2026)

- **Mismo método que el adoquín.** Escaneos CC0 de Poly Haven:
  - los descarga el propietario con `tools/polyhaven/descargar_p1.py` (Python sin instalar nada, PNG 2K tal cual);
  - Claude los compara en el juego con las mismas cámaras y los activa como opción;
  - solo pasan a ser los de por defecto si mejoran.
- **Candidatos:**

  | Material del kit | Candidatos | Notas |
  |---|---|---|
  | `stucco` (paredes) | `white_stucco_02`, `plastered_wall_02`, `beige_wall_001` | Se tiñe por fachada: hace falta una base clara y neutra |
  | `rooftiles` (tejados) | `clay_roof_tiles_02`, `clay_roof_tiles_03` | Teja árabe |
  | `stone` (jambas y zócalos) | `sandstone_blocks_04`, `large_sandstone_blocks_01` | |
  | `wood` (persianas y puertas) | `distressed_painted_planks`, `rough_pine_door` | Se tiñe |

- **Texturas actuales:** las generé con código, de 20 a 60 KB cada una. Son el punto flojo al lado del suelo nuevo.

### 14.1 Resultado (17-10-2026)

- **Descarga del propietario:** las 9 texturas, en PNG 2K. Cuatro rugosidades son de 16 bits y se convirtieron bien (de 0,86 a 0,95, ninguna blanca).
- **Copias compactas, `info.json` y fuente:** en `assets/3d/imports/2026-10-17_p1_polyhaven/`. Generador: `tools/p1/make_p1_facades.py`.
- **Cada escaneo se lleva al brillo de la textura que sustituye,** así que el color de cada fachada no cambia; solo cambia el detalle.

| Material | Elegido | Resultado en el juego (mismas cámaras, ALTO) |
|---|---|---|
| Paredes (`stucco`) | `white_stucco_02`, 1,8 m, desaturado | Grano de enlucido real y más limpio, pero pierde las manchas de humedad de la actual. Mejora leve |
| Tejados (`rooftiles`) | `clay_roof_tiles_02` (teja árabe), 2,5 m | Apenas se nota a la distancia de juego |
| Persianas (`wood`) | `distressed_painted_planks`, 1,6 m | Apenas se nota |
| Puertas (`woodraw`) | `rough_pine_door`, 2 m | Apenas se nota |
| Piedra (`stone`) | `sandstone_blocks_04` | **Peor:** los bloques casi no se marcan y jardineras y jambas parecen una mancha. **Descartada**, se queda la actual |
| Descartados al mirarlos | `beige_wall_001` (casi lisa), `plastered_wall_02` (juntas de panel de hormigón), `clay_roof_tiles_03` (teja plana francesa), `large_sandstone_blocks_01` (verdosa, con musgo) | |

- **Conclusión:** en las fachadas la textura no es lo que limita el aspecto; pesan más la forma y el color de los edificios.
- **Estado:**
  - opción `?pueblo=3&fachada=cc0`;
  - PENDIENTE DE VALIDACIÓN EN IPHONE;
  - no se activa por defecto si el propietario no la ve mejor.

## 15. Rayas en las paredes lejanas (vídeo del propietario, 17-10-2026)

- **Síntoma:** en paredes a 20–50 m se ven manchas de sombra rayadas en diagonal alrededor de puertas y ventanas de la planta baja.
  - Al moverse parpadean y parecen una textura sin cargar.
  - Al pararse se ven como una sombra.
- **No se reproduce en el navegador de pruebas** (WebGL por software, más precisión de profundidad), así que es propio de la tarjeta gráfica real.
- **El sol nunca roza las paredes** (viene del noroeste, a unos 47°), así que las rayas no son sombra estirada sino **autosombra (shadow acne)**:
  - las paredes detalladas están justo sobre las caras de las cajas que proyectan la sombra de los edificios;
  - los marcos y las hojas de las puertas están a ras de la pared;
  - solo los separaba un desplazamiento de 2,5 cm, con texeles de sombra de 6 cm (ALTO) o 12 cm (MEDIO).
- **Arreglos** (`test/shadow.browser.test.js`):
  1. Las cajas de sombra de los edificios se meten 0,3 m dentro de la pared. La comprobación se probó en los dos sentidos: con las cajas sin meter, 504 esquinas coinciden con las de colisión; metidas, ninguna.
  2. Los marcos y hojas de puerta ya no proyectan sombra. De paso hay menos llamadas de dibujo: calle de 222 a 194, vista general de 255 a 237.
  3. El desplazamiento normal va con el texel: 0,6 texel, es decir, 3,6 cm en ALTO y 7 cm en MEDIO.
  4. En el shader del sol, la sombra se desvanece si el sol roza la superficie y, por distancia, de 40 a 58 m, en vez de cortarse en el borde de la caja de 62 m.
- **Comparación:** con las mismas cámaras, antes y después son casi idénticos (entre el 1 y el 2 % de píxeles distintos) y las sombras de los edificios en el suelo siguen igual.
- **Estado:** PENDIENTE DE VALIDACIÓN en el PC y el iPhone del propietario, que es donde se ve el fallo.
- **Para comparar:** `&sombrafade=0` desactiva el fundido.

## 16. Fase de modelos 3D de Poly Haven (17-10-2026)

**Auditoría de los 8 paquetes** (con Blender 5.2, `tools` en `/home/claude/assets3d`): ninguno trae animaciones, y solo la rata conserva los pesos de un rig.

| Paquete | Qué es de verdad | Decisión |
|---|---|---|
| `bolt_action_rifle_7_62` | Rifle de cerrojo clásico de madera, tipo Mosin, con visor pequeño; 1,23 m; ~12 000 triángulos | **No sustituye a HALCÓN R7.** Es otra estética (militar antigua frente a la táctica moderna actual). Lo decide el propietario |
| `service_pistol` | Pistola clásica de acero y cachas de madera, tipo P38 | Igual: no sustituye a VÍBORA 9 sin su decisión |
| `fish_knife` | Cuchillo de pesca con mango de madera | Igual que las dos anteriores |
| `street_rat` | Rata de 14,8 cm, sin rig pero con los pesos de un Rigify | **Integrada** (ver abajo) |
| `dandelion_01`, `grass_medium_02` | Plantas con varios niveles de detalle | **Integradas** (ver abajo) |
| `gate_latch_01` | Pestillo metálico de verja (~15 cm) | **Aparcado:** no se ve a la distancia de juego |
| Kit P1 de ChatGPT | Perfiles de cajas con piedra procedural y el estuco `beige_wall_001` (casi liso) | **No se integra:** no supera al kit actual de Blender, que ya tiene jambas, cornisas y zócalos. El propio paquete se presenta como «prototipo, no publicar por defecto» |

**Rata con vida** (`client/rats.js`, `tools/fauna/`)
- **Esqueleto:** 19 huesos reconstruidos sobre los pesos originales del rig.
- **Animación procedural:** patas al trote en diagonal, columna, cabeza, orejas y cola.
- **Estados:** reposo, olfateo, exploración junto a las paredes, huida (si el jugador se acerca a menos de 4,5 m o suena un disparo a menos de 30 m) y escondida en la alcantarilla. Vuelve a salir cuando el jugador está a más de 9 m.
- **Sin efecto en el juego:** no tiene colisiones, no le afectan las balas y no pasa por el servidor.
- **Cantidad:** 3 en ALTO, 2 en MEDIO y ninguna en BAJO. `&ratas=0` las quita.
- **Pruebas:** `test/rats.test.js` (11 comprobaciones) y `test/fauna.browser.test.js`.

**Vegetación** (`client/flora.js`, `tools/flora/`)
- **Dónde crece:** al pie de paredes y jardineras, en la junta del bordillo y alrededor de las alcantarillas; nunca en mitad de la calle.
- **Mismas plantas para todos los jugadores.** Miden de 15 a 60 cm, así que no esconden a nadie.
- **Hierba en tarjetas** (ver `assets/3d/imports/2026-10-17_flora/FUENTE.md`).
  - Antes: 505 matas sumaban 230 000 triángulos y apenas se veían unas pajas.
  - Ahora:

    | Calidad | Plantas | Triángulos | Llamadas de dibujo |
    |---|---|---|---|
    | ALTO | 1 430 | 48 000 | 13 |
    | MEDIO | 853 | 31 000 | 13 |
    | BAJO | 350 | 12 000 | 13 |

- **Arreglos en el camino:**
  - las hojas finas desaparecían en los mipmaps (el alpha test ahora se corrige según el nivel de mipmap);
  - la cara trasera de las tarjetas salía oscura (se dejó de invertir la normal).
- `&flora=0` quita la vegetación.
- **Pruebas:** `test/flora.test.js` (9 comprobaciones) y `test/fauna.browser.test.js` (21 comprobaciones).
- **Estado:**
  - PROBADO EN NAVEGADOR.
  - PENDIENTE DE VALIDACIÓN EN IPHONE: FPS con 3 ratas y 1 430 plantas en ALTO.


### 16.1 Segunda pasada (17-10-2026, tras la decisión del propietario)

- **Armas:** opción 1.
  - Las modernas (HALCÓN R7, VÍBORA 9 y la navaja táctica) se quedan como armas principales.
  - Las clásicas se convierten y se guardan en `assets/3d/weapons_classic/` (ver `FUENTE.md` en esa carpeta): 8,4 MB, comprobadas en el Three.js del juego.
  - El juego no las carga y no están animadas.
- **Rata más ligera:** de 14 286 a 3 568 triángulos; a 2 m se ven idénticas. Son unos 32 000 triángulos menos en ALTO con 3 ratas.
- **Coste medido** (navegador por software, así que son llamadas de dibujo, triángulos y tiempo de CPU, no FPS reales):
  - el cerebro y los huesos de las 3 ratas: 0,2 ms por fotograma;
  - la vegetación en ALTO: unos 48 000 triángulos y 13 llamadas de dibujo.
  - FPS reales: PENDIENTE DE VALIDACIÓN EN IPHONE.
- **Kit P1 de ChatGPT, probado dentro del juego** (fachada de muestra en el campo de tiro, con la misma luz), frente a fachadas reales del pueblo:
  - estilo monumental: marcos y sillares gruesos, puerta lisa y el doble de triángulos;
  - el pueblo actual tiene más carácter: estuco de color, persianas, balcones, rejas y recercados finos;
  - **no se integra ninguna pieza.**

## 17. CASA ATLAS 1V1 — mapa experimental de ChatGPT (18-10-2026)

Piso de 18 × 14 m en una planta: salón, cocina, comedor, dormitorio, baño, estudio y balcón. GLB real (10 108 triángulos,
32 piezas, 25 materiales PBR, 14 texturas) + techo opcional + `collision_map.json` (78 cajas) + spawns. Original intacto en
`assets/3d/imports/2026-10-18_casa_atlas/`; en el juego, `assets/maps/casa_atlas/`.

**Cómo entra en el juego**
- Mapa nuevo `casa`, independiente de PUEBLO y ARENA (que no cambian: sus datos de servidor son idénticos byte a byte).
- Solo aparece en los menús con `?casa=1` (se recuerda en el dispositivo; `?casa=0` lo vuelve a ocultar). El mapa existe
  siempre (sus cajas son baratas), así que un invitado sin el enlace puede entrar en una sala online creada en él; su GLB
  solo se descarga la primera vez que se muestra.
- **Colisiones y balas salen solo de las cajas** (`client/casa.js`, generado por `tools/casa/make_casa_js.py` desde
  `collision_map.json` + `collision_fixes.json`), nunca del GLB: caja sólida → colisión + caja invisible para las balas;
  caja de solo movimiento → colisión. `tools/export-map.js` lleva exactamente las mismas al servidor (`core/mapdata.js`).
- Duelo contra bots: 1 bot (2 en ÉLITE). Navegación con rejilla de 0,25 m a 0,4 m de todo lo que esté a la altura del cuerpo.
- Sin techo: luz del sol del mapa; la caja de sombras del sol se reduce a ±16 m en este mapa (sombras 4 veces más finas)
  y el suelo del pueblo baja 4 cm (sin parpadeo con los suelos del piso). Todo vuelve a su valor al cambiar de mapa.
- `&techo=1` carga el techo opcional (experimental).

**Decisiones de juego (iguales en cliente y servidor)**
- El cristal **no para las balas** ni se rompe; **sí impide el paso** (ventanas, cristaleras del balcón, mampara).
- Las barandillas del balcón llegan a 3,30 m para el movimiento (las balas pasan por encima de la barandilla real de 1,16 m).
- No se puede estar encima del armario, frigorífico, estanterías, horno ni televisor (sin techo se vería por encima de los
  tabiques). Saltando desde un mueble de más de 0,5 m los ojos asoman un instante por encima de los tabiques (3,12 m).

**Problemas de diseño encontrados** (fichero → coordenadas → qué se ha hecho / recomendación para ChatGPT)
1. `collision_map.json`: el **televisor de pie** (x −2,10…−0,30, y 0,81…1,88, z −2,14…−2,06) en mitad del paso salón–pasillo
   no tenía caja: parecía cobertura y las balas lo atravesaban. Añadida caja sólida.
2. Cabecero de la cama (x −7,10…−5,10, y hasta 1,45, z −5,97…−5,80) sin caja. Añadida.
3. **Ventanas y cristaleras**: con alféizar a 1,10–1,25 m y salto de 1 m + escalón de 0,45 m, se salía del mapa por
   cualquier ventana; las cristaleras del salón/comedor (desde el suelo) se cruzaban andando. Cajas de solo movimiento.
4. Barandillas del balcón de 1,16 m: se saltaban. Subidas a 3,30 m solo para el movimiento.
5. **Spawn A** (−7,45; 0,57): a 0,33 m de la silla del escritorio; con el radio del juego (0,35 m) nace dentro. Movido a
   (−7,45; 0,95). **Spawn B** (7,15; 0,20): ve la salida A en línea recta a 14,6 m por las puertas del estudio y la cocina.
   Movido a (7,10; −2,50), detrás de la pared, junto a la isla.
6. **Sillas del comedor** (z 1,84…2,34 y 4,18…4,68): a 0,29 m de la mesa y delante de la puerta de la cocina; con caja
   cortaban el paso. Las dos de z ≈ 2,3 tienen el respaldo hacia la mesa (están al revés). Se quedan sin caja (como el original).
   Recomendación: alejarlas 0,45 m de la mesa y girar las del norte.
7. **Macetas**: la del pasillo (x 2,67…3,26, z −3,40…−2,83) está en el marco de la puerta de la cocina; las del balcón
   (x −6,40…−5,86 y 5,70…6,24) dejan 0,62 m con la fachada y bloquean el paso a los extremos del balcón. Sin caja salvo las
   dos grandes del salón. Recomendación: moverlas al menos 0,8 m de puertas y fachada.
8. Rincones muertos sin acceso (0,22 m² detrás de la mesilla del dormitorio, 0,14 m² entre váter y lavabo): sin importancia.
9. Materiales: el suelo de roble multiplica una textura ya marrón por un color base marrón (sale naranja saturado); el
   resto de texturas son procedimentales y planas. Para la siguiente versión: texturas escaneadas (Poly Haven) y color base 1,0.
10. Sin LOD (no hacen falta: 32 piezas) y el GLB pesaba 7,4 MB por las PNG (ahora 1,8 MB en JPEG).

**Validación** (`test/casa.test.js` 75, `test/casa.browser.test.js` 18, `test/casa.online.browser.test.js` 12)
- Cliente = servidor: mismas 102 cajas, 950 triángulos de bala, mismos spawns; 400 disparos al azar con el mismo impacto
  en el cliente (Three.js) y en el servidor (core/geom.js).
- Lo que se ve = las cajas: 1 670 rayos contra las dos caras de cada pared, todas dibujadas a menos de 6 cm.
- Las 10 puertas se cruzan en los dos sentidos con el código de movimiento real; las 9 cristaleras/ventanas y las tres
  barandillas no se cruzan ni corriendo y saltando; nadie se queda encima de los muebles altos.
- 1v1 online (red simulada y dos navegadores reales con el servidor Node): spawns A/B, impacto cruzando el salón, el
  tabique y el televisor paran la bala, la cristalera no.

**Rendimiento** (`tools/casa/perf.js`, 4 cámaras por mapa, PUEBLO 3.0 activo; llamadas y triángulos exactos, incluida la sombra)

| perfil | CASA ATLAS | ARENA | PUEBLO 3.0 |
|---|---|---|---|
| ALTO  | 38 llamadas · 12 635 triángulos | 25 · 10 466 | 182 · 288 252 |
| MEDIO | 33 · 11 651 | 25 · 10 466 | 167 · 241 950 |
| BAJO  | 32 · 11 015 | 20 · 5 830 | 120 · 170 854 |

Texturas del mapa en la GPU: ~31 MB (11 de 512² y 3 de 1024²); BAJO quita el mapa de normales. El tiempo por fotograma
no se puede medir aquí (WebGL por software); PENDIENTE DE VALIDACIÓN EN IPHONE y en el Samsung.

**Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR · 1v1 PROBADO con servidor local (falta la prueba online real entre
dos dispositivos) · PENDIENTE DE VALIDACIÓN EN IPHONE. Enlace: `?casa=1` (con `&pueblo=3` para la luz nueva; `&techo=1`
para probar el techo).
