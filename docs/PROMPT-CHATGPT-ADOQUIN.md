ChatGPT: la caliza de la plaza (v3b) ya está **activada por defecto en el juego**. El propietario la ha visto en el móvil y en el PC y le encanta. Es la primera entrega tuya que mejora el juego de verdad. Ahora toca el **adoquín de la calle norte**, que es lo único del suelo que sigue sin superarse.

## Por qué no pasó tu adoquín v3b

1. **Eje de espejo.** Con el desplazamiento del 50 % aparece un eje vertical en el centro: hay piedras repetidas en simetría («mariposa»). En el juego, a 1,6 m, se ve una costura que se repite cada 2 m.
2. **Tamaño.** Las piedras miden unos 30–40 cm y se pidieron de 15–25 cm. A la altura de los ojos parecen losas, no canto rodado.
3. **Color.** Tira a naranja y se ve borroso de cerca, porque está ampliado desde una ilustración.

## Lo que tiene que ser

- **Canto rodado irregular** de calle de pueblo mediterráneo: piedras redondeadas y abombadas de 15–25 cm, con formas distintas y sin filas regulares.
- Juntas de arena oscura de 1–2 cm, hundidas.
- Tonos tostados, grises cálidos y algún ocre. Nada de naranja, verde, lila ni gris frío.
- **Repetición:** 2 × 2 m, es decir, unas 8–12 piedras por metro.
- **Ninguna piedra repetida ni en espejo.** Haz la textura repetible por desplazamiento y retoque de las costuras, nunca reflejándola.

## Las mismas cifras que la caliza (Claude las mide)

- Color: media sRGB entre 120 y 160, y casi nada por encima de 220.
- Normal OpenGL (+Y): media de la componente z entre 0,90 y 0,96. Las piedras tienen que tener volumen y las juntas, hundirse.
- Rugosidad: unos 0,80–0,88 en la piedra y más alta en las juntas.
- Tamaño: 2048² en PNG. No hay límite de MB.

## Fuente: elige una

- **(a) Lo más seguro: una textura escaneada CC0.** Por ejemplo, «cobblestone» o «cobblestone_floor» de Poly Haven, o «PavingStones» de ambientCG. Dime la URL exacta y la licencia. Ni tú ni Claude podéis descargarla: la descarga el propietario en su PC y Claude la recoge de la carpeta conectada. Tú dices cuál y por qué, y si hace falta recortarla o recolorearla.
- **(b) Generada con tu herramienta de imágenes,** vista cenital, luz plana, a 2048 nativos (no ampliada). Corrige las costuras a mano.

## Qué entregar

1. Color, normal y rugosidad: 3 PNG de 2048².
2. **Prueba de desplazamiento del 50 %** de cada mapa: sin cruz central, sin espejo y sin piedras duplicadas.
3. Mosaico 3 × 3.
4. Una vista a 1,6 m de altura con la luz del juego (sol #fff0d8 desde (−45, 60, −30), ACES y exposición 0,95), al lado de la captura actual de la calle norte.
5. Una ficha con fuente, licencia, piedras por metro, medias de color y de normal z, y limitaciones honestas.

No digas que está aprobado. Claude lo integra como opción en `?pueblo=3`, lo compara con las mismas cámaras en ALTO, MEDIO y BAJO, y solo lo activa si mejora. La última palabra la tiene el propietario.
