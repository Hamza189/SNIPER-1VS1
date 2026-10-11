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
- **Nodos LOD** en la raíz: `<id>_LOD0` (ALTO), `<id>_LOD1` (MEDIO) y `<id>_LOD2` (BAJO). Los tres comparten la misma
  silueta y el mismo volumen.
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

- **Muros:** sobre las caras de la caja. Los huecos pueden entrar hasta 0,25 m.
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
