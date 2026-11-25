# Guía de estilo: materiales y color de SNIPER DUEL (25-11-2026)

Para que todo lo que entra en el juego (modelos de ChatGPT, de Meshy, del kit de Blender por código) parezca del mismo
juego. Fase 3 del encargo «más parecido a Call of Duty / PUBG sin cambiar de motor». Complementa el contrato técnico
`docs/ASSETS-3D.md` (formato, ejes, LOD, nombres): aquí va **cómo debe verse**.

**Estado**: guía escrita · materiales del juego ajustados a ella detrás de `?estilo=1` (sin la bandera, todo igual) ·
comprobador `node tools/estilo-check.js [modelo.glb]` · PENDIENTE DE QUE EL PROPIETARIO LO VEA.

## 1. La idea en una frase
Un pueblo mediterráneo real, a pleno sol de media tarde, **con aspecto de foto y no de dibujo**: colores de pintura vieja
y piedra al sol, nada saturado ni brillante de más, suciedad donde la deja la vida (abajo, bajo las ventanas, en los
rincones), y metales que se ven por lo que reflejan, no por su color. Referencia de tono: el realismo de los juegos de
tiros militares actuales (luz natural, contraste contenido), con una paleta propia de pueblo blanco y ocre.

## 2. La luz con la que se juzga todo
Nadie juzga un modelo en un visor con otra luz. Siempre con la del juego (`LOOK` en `src/page.html`):

| | Valor |
|---|---|
| Sol | `#FFF0D8`, intensidad 3,2, desde (−45, 60, −30): alto, de media tarde, por el suroeste |
| Cielo / rebote del suelo | hemisférica `#C4D8F0` / `#C9A684`, intensidad 0,92 |
| Exposición y tono | 0,95, ACES Filmic, salida sRGB |
| Niebla | `#D8DAD6`, de 45 a 175 m |
| Oclusión y sombra horneadas | `?lm=1` (`docs/ILUMINACION-HORNEADA.md`) |

## 3. Color base (albedo): los límites
El color base es **el color de la superficie, sin luz**: ni sombras, ni brillos, ni degradados de luz pintados.

| Superficie | Luminancia sRGB (0–255) | Saturación máx. (HSV) | Ejemplos del pueblo |
|---|---|---|---|
| Revoco claro / encalado | 200–240 | 0,15 | `#F4F0E6`, `#F1EBDF` |
| Revoco de color | 150–225 | 0,45 (terracota hasta 0,65) | ocre `#DCB98A`, salmón `#E8BFAE`, terracota `#C9734C`, amarillo `#EBD394` |
| Piedra, hormigón, losa | 120–210 | 0,25 | `#D9CFBD`, `#CBC5BB`, `#D2CABD` |
| Teja y barro | 110–175 | 0,6 | `#C06A44`, `#C77A52` |
| Madera pintada (contraventanas, puertas) | 50–140 | 0,55 | verde `#3F7A4E`, azul `#2F6A9A`, marrón `#6E4A2C` |
| Madera sin pintar | 70–150 | 0,45 | `#8A6A4C` |
| Hierro pintado, rejas | 30–70 | 0,15 | `#2B2826` |
| Telas, toldos, carteles | 60–220 | 0,7 | rojo `#B0302A`, verde `#2F6B4A`, azul `#2D5A8A` |
| Lo más oscuro (huecos, alcantarillas) | **25** mínimo | — | `#221C16` |
| Lo más claro | **240** máximo | — | — |

Nunca negro puro (0) ni blanco puro (255) en un color base: con ACES el blanco puro al sol «quema» y el negro puro
parece un agujero.

## 4. PBR: rugosidad y metal
Metal **0 o 1**, casi nunca a medias: lo que está pintado es pintura (0), aunque debajo haya hierro. Un metal (1) sin
reflejo del entorno se ve negro: necesita `env` en `KIT3D.LOOK`.

| Material | Metal | Rugosidad | Notas |
|---|---|---|---|
| Revoco, yeso, encalado | 0 | 0,88–0,95 | relieve en el mapa de normales (0,3–0,5) |
| Piedra, mampostería | 0 | 0,75–0,9 | |
| Hormigón, asfalto | 0 | 0,85–0,95 | con mapa de rugosidad si el charco/desgaste importa |
| Adoquín, losas | 0 | 0,7–0,85 | |
| Teja | 0 | 0,7–0,85 | |
| Madera pintada | 0 | 0,55–0,7 | |
| Madera sin pintar | 0 | 0,75–0,9 | |
| Hierro pintado (rejas, farolas) | 0 | 0,5–0,65 | |
| Chapa galvanizada, zinc | 1 | 0,4–0,55 | con `env` |
| Pintura de coche vieja | 0 | 0,55–0,7 | óxido y polvo en el color o en una máscara |
| Azulejo, cerámica | 0 | 0,15–0,35 | |
| Vidrio | 0 | 0,02–0,1 | transparente, con `env` |
| Tela | 0 | 0,85–0,95 | a dos caras |
| Vegetación | 0 | 0,7–0,9 | recorte (MASK), nunca mezcla |

## 5. Desgaste y suciedad (lo que hace que parezca real)
- **Abajo**: suciedad que sube del suelo hasta 0,3–0,8 m, irregular (ya lo hace `client/pueblo4.js` en los materiales del
  pueblo; un modelo nuevo de fachada no debe traerla pintada encima, o se dobla).
- **Churretes**: bajo alféizares, cornisas y bajantes, verticales, suaves.
- **Bordes**: cantos y esquinas algo más claros (desconchado) en madera pintada y metal.
- **Rincones**: oscuros por la oclusión horneada; en un modelo, la AO va en su canal R (no multiplicada en el color).
- Nada de suciedad uniforme por toda la superficie: la suciedad se explica (agua, pies, manos, humo).

## 6. Detalle por metro (densidad de texel)
| Qué | Densidad |
|---|---|
| Lo que se ve a menos de 3 m (armas, puertas, objetos a mano) | 512–1024 px/m |
| Fachadas y suelo (texturas que se repiten) | 256–512 px/m |
| Edificios lejanos (fuera del pueblo) | 64–128 px/m |
| Iluminación horneada | ~7 texeles/m (es luz suave: no necesita más) |

Resolución por calidad, como siempre: ALTO 2K–4K (KTX2), MEDIO 2K, BAJO 1K (JPG).

## 7. Lista para ChatGPT / Meshy (pegar en el encargo)
1. GLB, 1 unidad = 1 m, +Y arriba, fachada a +Z, origen en el centro de la huella a ras de suelo (`docs/ASSETS-3D.md`).
2. Materiales `sd_<nombre>` (`sd_estuco`, `sd_piedra`, `sd_teja`, `sd_madera`, `sd_hierro`, `sd_vidrio`…).
3. Color base sin luz ni sombras pintadas; dentro de los márgenes de la tabla 3 (ni 0 ni 255).
4. Metal 0 o 1; rugosidades de la tabla 4.
5. AO, si la trae, en su canal (R del mapa ORM), no en el color.
6. Desgaste según el apartado 5; nada de suciedad uniforme.
7. Paleta: la del pueblo (tabla 3); un color nuevo, solo si el propietario lo pide.
8. Se mira con la luz del juego (apartado 2), nunca en el visor de Meshy/ChatGPT.
9. Antes de integrarlo: `node tools/validate-glb.js` (formato) y `node tools/estilo-check.js modelo.glb` (esta guía).

## 8. Qué cambia en el juego con `?estilo=1`
Los materiales compartidos del pueblo (`KIT3D.LOOK`) que no seguían la guía:

| Material | Antes | Con `?estilo=1` | Por qué |
|---|---|---|---|
| `iron` (rejas, farolas) | metal 0,5, rug. 0,5 | metal 0, rug. 0,6 | es hierro pintado |
| `metal` (chapas pintadas) | metal 0,3, rug. 0,45 | metal 0, rug. 0,5 | pintura |
| `zinc` (aparatos, depósitos) | metal 0,65, sin reflejo | metal 1, rug. 0,45, reflejo 0,6 | metal de verdad |
| `paint` (coches viejos) | metal 0,12 | metal 0, rug. 0,62 | pintura vieja |
| `glass` | metal 0,1 | metal 0 | vidrio |
| `water` | metal 0,25 | metal 0 | agua |
| `tile` (teja sin textura) | rug. 0,72 | rug. 0,8 | barro cocido |
| `dark` | `#17130F` | `#221C16` | el mínimo de 25 |
| E10 «Casa Oliva»: `sd_hierro` | metal 0,82 | metal 0, rug. 0,6 | hierro pintado |
| E10 «Casa Oliva»: `sd_vidrio` | metal 0,15, rug. 0,17 | metal 0, rug. 0,08 | vidrio |

Los materiales que traen dentro `assets/kit.glb`, `sd_p4_vehiculos.glb` y `sd_p4_utileria.glb` son solo nombres: el
juego los cambia por los de `KIT3D.LOOK` (por eso el comprobador les da avisos de rugosidad que no cuentan).

Medido con las mismas cámaras (`tools/capture-scenes.js`, ALTO): cambia el 0,9–2,9 % de los píxeles (rejas, farolas,
chapas, bidones, coches); mismas llamadas y triángulos. Capturas en `docs/img/estilo/` (sin arriba, con abajo).

Lo comprueba `node tools/estilo-check.js` (sin argumentos: `KIT3D.LOOK` con y sin `?estilo=1`).
