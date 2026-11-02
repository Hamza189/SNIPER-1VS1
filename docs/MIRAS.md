# MIRAS: las ópticas del rifle como accesorio (31-10-2026)

Lo que pidió el propietario:
- «añade más miras y que sean como accesorio que se puedan cambiar»;
- «mira punto rojo, mira óptica por defecto del franco y miras aparte que se puedan seleccionar, faltan x2 y x6»;
- «la mira x4, x8 y x12 tienen que ser independientes y diferentes, cada una con sus características; en el móvil,
  apuntando, es imposible alejar o acercar: solo jugamos con dos dedos».

**Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

## Las 8 miras: cada una con un solo aumento
Ya no hay botón de zoom ni hace falta un tercer dedo: cada aumento es una mira distinta y se elige antes o durante la
partida. La de siempre del rifle es ahora el FRANCOTIRADOR 8× fijo; el 4× pasa a ser su propia mira.

**02-11-2026 (el propietario, desde el iPhone):** la holográfica, la 2× y la 3× estaban mal: «muy grande, ocupa toda la
pantalla… tiene que verse la mira entera y la retícula dentro». Desde entonces:
- la 2× y la 3× son miras **de ventana**, como el punto rojo: el rifle y la mira se ven enteros y se mira por su ocular
  (los modelos tienen el tubo hueco y el cristal claro), sin el círculo negro de visor;
- en las cuatro miras de ventana la retícula se dibuja **dentro de su ventana**, del tamaño con el que se ve la ventana
  desde el ojo (`SDMiras.windowFrac`: la abertura más pequeña de cada mira, medida en cada rifle; del 9 al 19 % de media
  pantalla);
- la holográfica tenía la pila delante del cristal: ahora va debajo;
- **botón de MIRA en el HUD táctil** (el que antes era de zoom, con el aumento escrito, p. ej. «1,5×»): cada toque pone la
  siguiente mira (punto → holo → 2× → 3× → 4× → 6× → 8× → 12× → punto). Sale siempre con el rifle, también apuntando;
  por defecto encima de R, sin tapar a INSP. Se mueve con el editor de botones como los demás.

| Mira | Aumento | Cuadro al apuntar | Retícula |
|---|---|---|---|
| **PUNTO ROJO** | 1,25× | Sin anillo: miras a través de la ventana y el rifle sigue a la vista | Un punto con halo |
| **HOLOGRÁFICA** | 1,5× | Sin anillo, ventana grande | Anillo con punto central |
| **VISOR 2×** | 2× | Ventana (desde el 02-11): la mira entera a la vista, la retícula en su ocular | Cruz fina con punto iluminado |
| **TÁCTICA 3×** | 3× | Ventana (desde el 02-11) | Chevrón iluminado: la punta es donde va la bala |
| **VISOR 4×** | 4× | Tubo, el círculo más grande (54 vmin) y el borde más suave | Dúplex: cruz gruesa por fuera y fina en el centro, sin punto |
| **VISOR 6×** | 6× | Tubo, 50 vmin | Un punto cada 5 milésimas en los cuatro brazos (una persona de pie a 100 m mide unos 3,5 puntos) y centro iluminado |
| **FRANCOTIRADOR** (por defecto) | 8× | Tubo de siempre (46 vmin) | La de siempre: marcas de caída a 100/150/200 m y de adelanto (agachado, andando, corriendo) |
| **LARGO ALCANCE** | 12× | Tubo más pequeño (42 vmin) y más oscuro en el borde | Fina, con marcas hasta 250 m y punto iluminado |

- **Dónde se elige:**
  - en el menú, en la ficha del arma: «Mira del rifle · CAMBIAR»;
  - en la pausa;
  - en el inventario de HUD 2: se cambia al momento, también en mitad de la partida.
- **Dónde se guarda:** en el dispositivo (`sniperduel_mira`).
- **El color:** el punto, el chevrón y el anillo usan el color del punto elegido en AJUSTES › MIRA (o el de la caja).
- **La sensibilidad:** «Visor hasta 4×» vale para el punto rojo, la holográfica, el 2×, el 3× y el 4×; «Visor de más de
  4×», para el 6×, el 8× y el 12×.
- **MEDIR RENDIMIENTO** mide la parte con la mira siempre con el FRANCOTIRADOR 8×, para que los informes se puedan
  comparar; al acabar vuelve la mira elegida.
- **La línea de datos** (distancia, aumento, cerrojo) y la barra del aire van más arriba con el prisma y la ventana, para
  no pisar la barra de armas del móvil.

## Reglas: lo que no cambia
- Con la mira puesta el disparo del rifle es exacto con todas (`ads ≥ scopeAt`, como siempre).
- Son iguales con todas, para los dos jugadores y el servidor:
  - el tiempo de apuntar;
  - el retroceso;
  - la dispersión antes de que salga la imagen;
  - el daño.
- **Solo cambia lo que ves:** aumento, retícula, cuadro y modelo. `core/` y `server/` no se tocan.
- Elegir menos aumento es un intercambio, no una ventaja oculta: ves más campo pero más pequeño. Todas están al alcance de
  todos.
- **El rival online** ve tu rifle con su mira de siempre: la mira no se envía, ni la vista en 3ª persona (eso necesitaría
  tocar el protocolo).
- **El destello de la mira** que ven los demás no cambia con la mira elegida, por la misma razón.

## Cómo está hecho
- **`client/miras.js`** (puro; solo `build()` necesita THREE): el catálogo, dónde va cada mira en cada rifle, las
  retículas y los modelos.
- **Retículas:**
  - las marcas de caída y adelanto (8× y 12×) y los puntos del 6× usan ángulos reales a su aumento, como las marcas de
    siempre;
  - el punto, el anillo, el chevrón, la cruz del 2× y el dúplex del 4× tienen tamaño fijo en pantalla. A 1,25–4× sus
    tamaños reales serían de uno o dos píxeles.
- **Modelos:** hechos por código, sin assets de terceros: perfiles torneados para los cuerpos redondos y cajas biseladas
  para el resto, una malla por material.

| Mira | Mallas | Triángulos |
|---|---|---|
| PUNTO ROJO | 7 | 956 |
| HOLOGRÁFICA | 6 | 402 |
| VISOR 2× | 6 | 1.232 |
| TÁCTICA 3× | 6 | 1.120 |
| VISOR 4× | 6 | 1.708 |
| VISOR 6× | 6 | 2.108 |
| LARGO ALCANCE | 7 | 2.372 |

- **Montaje:** cada rifle tiene medido su riel (altura y tramo) y su mira propia (`SDMiras.RIFLES`). El pie de la mira
  queda siempre sobre el riel; su parte trasera, lo más cerca posible de su distancia al ojo. La pose de apuntar lleva la
  línea de mira de esa óptica al centro de la pantalla.

### Cómo se quita la mira de siempre de cada rifle
Medido con los vértices de cada modelo; la mira de siempre vuelve al elegir FRANCOTIRADOR.

| Rifle | Cómo |
|---|---|
| HALCÓN R7 (`viewmodels.glb`) | Los triángulos del cuerpo por encima de 3,52 cm, entre z −0,27 y +0,215 (queda el riel) |
| HALCÓN de cajas (sin `viewmodels.glb`) | Sus piezas de la mira |
| TITÁN | Material `Optical` |
| ÚLTIMA | Material `05_Scope` y las piezas pequeñas por encima del riel |
| SAHARA | Material `Zoom`; su riel está inclinado 0,74° y la mira lo sigue |
| VECTOR | Los triángulos por encima del riel (6,6 cm) |

Recortar no copia nada: es el mismo búfer de vértices con un índice más corto.

## Pruebas
- `node test/miras.test.js` (28): catálogo de un aumento cada una, sensibilidad, montaje en los 6 rifles, retículas
  calibradas y de tamaño fijo, y modelos.
- `node test/miras.browser.test.js` (55), en el juego, con cada mira:
  - aumento, cuadro y rifle oculto o a la vista;
  - en las de ventana, la retícula del tamaño de la ventana;
  - el botón de MIRA: cada toque la siguiente, también apuntando;
  - cada visor con su círculo y su borde;
  - el modelo va en el riel; de la mira de siempre no queda ningún triángulo y del resto del HALCÓN no falta ninguno
    (contados uno a uno sobre la geometría original);
  - el autotest de puntería: el centro de la pantalla es donde va la bala;
  - el menú y lo que se guarda;
  - con los aspectos TITÁN, ÚLTIMA, VECTOR y SAHARA.
- Herramientas:
  - `node tools/miras/retratos.js`: los retratos de las fichas (`assets/miras/<id>.jpg`), dibujados por el propio juego;
  - `node tools/miras/hoja.js`: las 8 miras en los 5 rifles (`docs/img/miras-rifles.jpg`);
  - `node tools/miras/capturas.js <carpeta>`: cada mira apuntando (con `CADERA=1`, también sin apuntar), al tamaño del
    iPhone; resumen en `docs/img/miras-apuntando.jpg`.
- En la retícula fina, las cifras de caída se alternan a derecha e izquierda y se omite la que pisaría a otra. La
  retícula de siempre no cambia nada.

## Pendiente
- **iPhone:** el aspecto de cada mira y que el punto rojo y la holográfica se vean bien con el rifle a la vista.
- **Futuro:**
  - enviar la mira al rival online;
  - la mira elegida en la 3ª persona;
  - miras para la escopeta y la pistola (la escopeta ya lleva punto rojo).
