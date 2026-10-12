ChatGPT: eres el artista 3D y director de arte de SNIPER DUEL. Claude integra, valida y publica, y yo pruebo en el iPhone. Tu objetivo es que el pueblo (PUEBLO 3.0) se vea mejor que ahora, y la única prueba que cuenta es la captura dentro del juego.

## 1. Por qué no han funcionado las entregas anteriores

- CASA OLIVA y los packs de suelo v1 y v2 se generaron con Python (numpy, PIL y trimesh): ruido, cuadrículas y cajas.
- El resultado se ve plano, borroso y con colores raros (verdes, lilas, grises fríos), y en el juego queda por debajo del suelo y los edificios actuales.
- Claude solo ha aceptado la plaza v2 y las tapas de alcantarilla, y como opción.
- **No vuelvas a generar texturas con ruido matemático ni edificios con cajas de trimesh.** Ese método ha tocado techo.

## 2. Método obligatorio a partir de ahora

1. **Texturas de calidad fotográfica**, de una de estas dos fuentes:
   - **(a) Generadas con tu herramienta de imágenes** como texturas repetibles (seamless), vistas desde arriba, con luz plana y sin perspectiva. Después compruebas y corriges que el mosaico 3×3 no tenga costuras.
   - **(b) Texturas PBR escaneadas con licencia CC0** (Poly Haven, ambientCG), indicando URL y licencia de cada una.
2. **Mapas a partir del color:** normal (OpenGL, +Y) y rugosidad derivados con criterio. Las juntas tienen que hundirse de verdad y las piedras tener volumen. Media de la componente z de la normal entre 0,90 y 0,96.
3. **Geometría en Blender (bpy)**, no con trimesh:
   - biseles reales y huecos de ventana retranqueados;
   - persianas con lamas, cornisas con molduras y balcones con barandilla;
   - cada pieza con sus vértices en las aristas duras y exportada con normales;
   - UV en metros (1 unidad de UV = 1 m) o atlas bien desplegado.
4. **Antes de entregar, renderiza en Blender a 1,6 m de altura** (la vista del jugador) con la luz del juego (sección 4) y ponlo al lado de las capturas actuales del juego que te adjunto. **Si no mejora claramente, no lo entregues.**

## 3. Estilo

- Pueblo mediterráneo cálido: caliza crema, ocres, arenas, terracota y cal encalada.
- Desgaste realista (manchas de humedad en zócalos, desconchones), sin estilo de dibujos animados ni suciedad excesiva.
- **Paleta:** variación por piedra o losa solo dentro de cremas, ocres, arenas y tostados. **Nada de verdes, lilas ni azulados** en el suelo.
- **Brillo:** color base con media sRGB de 120 a 160 y casi nada por encima de 220. El juego multiplica por un tono de zona y el sol es fuerte.

## 4. El motor, para que tus renders se parezcan al juego

- Three.js r128, MeshStandardMaterial (metal y rugosidad), tone mapping ACES Filmic con exposición 0,95.
- **Sol:** color #fff0d8, intensidad 3,0, desde la dirección (−45, 60, −30) (alto, en diagonal).
- **Cielo y niebla:** luz hemisférica con cielo #c4d8f0, suelo #c9a684 e intensidad 1,0; niebla #dcd6c8 de 45 a 175 m.
- **Móvil:** el juego tiene que ir fluido en iPhone.
  - **No hay límite de almacenamiento ni de MB.**
  - Texturas en potencias de 2, como mucho 4096 px.
  - Triángulos por edificio, orientativos: LOD0 ≤ 15 000, LOD1 ≤ 6 000, LOD2 ≤ 1 500. Se pueden superar si el iPhone lo aguanta.

## 5. Contrato técnico (Claude lo valida con `tools/validate-glb.js`)

- **Formato:** glTF 2.0 binario (.glb) con las texturas dentro. Sin Draco, meshopt ni KTX2.
- **Escala y ejes:** 1 unidad = 1 m, +Y arriba, fachada principal hacia +Z, origen en el centro de la huella a ras de suelo.
- **Niveles de detalle:** nodos `<id>_LOD0`, `<id>_LOD1` y `<id>_LOD2`.
  - El LOD1 conserva la silueta y el color: persianas, balcones y cornisa siguen visibles (CASA OLIVA los perdía y de lejos parecía una caja blanca).
- **Materiales:** nombres `sd_<material>`. Color base en sRGB, normal OpenGL y rugosidad en el canal G (o ORM).
- Sin luces, cámaras ni animaciones.
- **Reglas de juego.** Las colisiones son cajas fijas y el modelo tiene que encajar en su caja:
  - muros sobre las caras de la caja;
  - huecos (vidrio, puertas) a 0,25 m como máximo por detrás de la cara de la caja;
  - entre 0,12 y 2 m de altura, nada a más de 0,45 m de la caja (salvo decoración baja de ≤ 0,66 m pegada a la pared);
  - por encima de 2 m, balcones, toldos y aleros pueden salir hasta 1,2 m;
  - nada por encima de la altura del muro + 0,35 m;
  - **no se puede ver a través del edificio**: cada abertura queda cerrada o hay un volumen interior cerrado.
- **Suelo:** plano para los pies. Bordillos de 9 cm como máximo y nada del suelo por encima de 12 cm.
- **Licencia:** obra original, o CC0 con su fuente. Nada de licencia dudosa.

## 6. Qué fabricar, en este orden (una entrega cada vez)

### A. Suelo P0 v3

| Material | Repetición | Qué tiene que ser |
|---|---|---|
| Adoquín de canto rodado (calle norte) | 2 m | Piedras redondeadas e irregulares de 15–25 cm, abombadas, en tonos tostados y grises cálidos, con juntas de arena oscura. **Tiene que superar al actual**, que ya tiene relieve |
| Caliza de la plaza | 2 m | Losas de 40–60 cm crema y ocre, juntas rectas finas y algún desconchón |
| Acera | 1,5 m | Losa ocre clara |
| Explanada de ladrillo en espiga | 1 m | Ladrillo terracota apagado |
| Arena | 3 m | Grano, alguna piedrecita y grietas de secado |

- **Calcas:** atlas 4 × 4 de 1024² con manchas orgánicas (no círculos) y grietas de 4–8 px con borde oscuro, más un tamaño real en metros por celda.
- **Bordillo:** textura de piedra de al menos 512 × 128, con UV en metros y bisel.

### B. Edificio E10 (sustituye a CASA OLIVA)

- **Hueco:** 6 m (X) × 10 m (Z) de planta, muros de 6 m y nada por encima de 6,35 m. Azotea con pretil, con el forjado a unos 5,4–5,6 m para que el pretil se vea proporcionado. Fachada de 6 m hacia +Z.
- **Planta baja comercial:** escaparate con toldo, puerta de madera y zócalo de piedra.
- **Planta alta:** dos balcones con barandilla de forja, ventanas retranqueadas con jambas de piedra y persianas de lamas.
- **Detalles:** cornisa moldurada, bajantes y cableado.
- **Material:** estuco envejecido ocre o crema cálido, nunca gris ni blanco frío.

### C. Kit modular para el resto de edificios

Con lo aprendido en E10: ventanas, puertas, balcones, cornisas, zócalos y persianas, y texturas compartidas entre edificios.

## 7. Cada entrega lleva

1. Archivos: GLB y/o texturas a resolución completa.
2. **Renders a 1,6 m de altura**, con la luz de la sección 4, junto a la captura actual equivalente.
3. **Mosaico 3×3 de cada textura**, para ver que no hay costuras.
4. Una ficha con:
   - qué es, dónde va, tamaño de repetición en metros y medidas;
   - triángulos por LOD;
   - media de brillo sRGB y media de la z de la normal;
   - fuentes y licencias;
   - limitaciones honestas.
5. El script o archivo .blend que lo regenera.

**No digas que está aprobado.** Claude lo integra detrás de `?pueblo=3`, lo compara con las mismas cámaras en ALTO, MEDIO y BAJO, y solo lo activa si mejora el juego. La última palabra la tiene la prueba en mi iPhone.

Empieza por el **A (suelo P0 v3)**. Antes de fabricar, enséñame una muestra de la caliza de la plaza y del adoquín renderizada a 1,6 m, al lado de las capturas actuales que te adjunto.
