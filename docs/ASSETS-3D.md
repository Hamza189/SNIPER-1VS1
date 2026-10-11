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

## 3. Presupuestos (por edificio)

| | LOD0 · ALTO | LOD1 · MEDIO | LOD2 · BAJO |
|---|---|---|---|
| Triángulos | ≤ 15 000 | ≤ 6 000 | ≤ 1 500 |
| Materiales (= llamadas de dibujo) | ≤ 8 | ≤ 6 | ≤ 3 |
| Textura de color | 1024² (atlas) | compartida | compartida |
| Normal / ORM | 1024² o 512² | 512² | sin normal |

- Archivo completo: ≤ 6 MB.
- Lado máximo de textura: 2048.
- Potencias de 2.

Las cifras de la imagen de referencia (28 000 / 12 000 / 4 500) son orientativas. En el mapa conviven 14 edificios y el
objetivo son 60 FPS en iPhone, por eso el presupuesto es menor.

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
5. **Presupuesto:** todo el suelo en ALTO, como máximo 10 MB de GPU en texturas y un material por tipo de superficie.
6. **Ficha:** lista de archivos, escala de cada textura, dónde va cada material (plaza, calle norte, calle
   transversal, aceras, afueras) y licencia (original, o CC0 con su fuente).

**Integración:** detrás de `?pueblo=3`, con `&suelo=0` para comparar. Capturas con las mismas cámaras en ALTO, MEDIO y
BAJO, coste en memoria y llamadas de dibujo, y prueba en iPhone antes de darlo por bueno.

### Prueba en iPhone del 12-10-2026 (vídeo del usuario, `?pueblo=3`)

- **Fluidez:** al moverse, la grabación tiene unos 57–58 fotogramas distintos por segundo (cerca de 60).
- **CASA OLIVA:** solo aparece de lejos (LOD1). Se ve blanca y plana: sin contraventanas en ese nivel y con el estuco
  pálido. El usuario no la aprueba; la sustituirá el kit de fachadas P1.
