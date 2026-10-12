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
- **Estado:** opción. Se activará por defecto en `?pueblo=3` cuando el propietario lo apruebe en el iPhone (FPS y
  aspecto).
- **CC0:** desde este entorno no se puede llegar a Poly Haven ni ambientCG (la red lo bloquea). Si se usan, el
  propietario los descarga en su ordenador y Claude los recoge de la carpeta conectada.
