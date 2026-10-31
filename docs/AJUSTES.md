# Ajustes del jugador (AJUSTES)

Lógica pura en `client/settings.js` (valores, límites, `sanitize`, `lookDelta`, `gyroDelta`) y panel en `src/page.html`
(sección «settings panel»). Todo se guarda en el dispositivo (`localStorage`, clave `sniperduel_settings`). Ningún ajuste
cambia el daño, el retroceso, las balas ni las reglas: solo lo que ves y cómo controlas (online manda el servidor).

## 31-10-2026 — Menú más pequeño en Safari y «Suavizado de bordes»
- **Tamaño.** Safari en el iPhone agranda por su cuenta los textos largos cuando el móvil está en horizontal, hasta
  ~1,8×: los textos de ayuda salían a 19–22 px en vez de 12 (captura del propietario). La página ahora lo impide
  (`-webkit-text-size-adjust: 100%`), así que el menú sale con sus tamaños reales.
- **Móvil en horizontal** (altura de hasta 500 px):
  - el panel usa casi todo el ancho;
  - las 7 pestañas van en una fila;
  - ayudas a 10,5 px, etiquetas a 9 px y botones más bajos;
  - casillas y barras en dos columnas (menos el bloque de HUD 2, que tiene su propio orden).
- **El resultado.** CONTROLES pasa de 792 a 673 px de alto en un móvil de 390 px, sin contar el agrandado de Safari, que
  era lo que más ocupaba. Imagen: `docs/img/ajustes-safari-antes-ahora.jpg`.
- **GRÁFICOS › Suavizado de bordes** (encendido por defecto, en MEDIO y ALTO; se aplica al recargar): quita el parpadeo de
  las fachadas lejanas. Ver `docs/PARPADEO.md`.
- **Pruebas.** `test/ajustes.browser.test.js` comprueba en un móvil en horizontal:
  - el `text-size-adjust`;
  - las pestañas en una fila;
  - los tamaños y las dos columnas;
  - el MSAA, encendido y apagado.

## 30-10-2026 — Ampliación con los ajustes de los grandes shooters de móvil
Petición del propietario: a partir de las capturas de los ajustes de PUBG Mobile, «añade todo lo que puedas» y que el
juego «se sienta fluido como si fuera hecho por una empresa experta». Primera fase: los ajustes que no tocan el servidor
ni el equilibrio. Con los valores por defecto el juego se ve y se controla exactamente igual que antes (lo comprueba
`test/ajustes.test.js`).

| Pestaña | Nuevo | Qué hace |
|---|---|---|
| CONTROLES | Botón MIRA en **MIXTO** | Un toque rápido (menos de 250 ms) fija la mira y otro la quita; si se mantiene, apunta solo mientras se mantiene. Con el mismo dedo se mueve la mira |
| CONTROLES | FUEGO izquierdo **solo al apuntar** | El segundo botón de disparo aparece solo con la mira puesta (no se esconde si lo estás pulsando) |
| SENSIBILIDAD | **Sin mira · 1ª persona** / **Sin mira · 3ª persona** | Multiplicadores para cada vista; se desvanecen mientras sube la mira |
| SENSIBILIDAD | **Visor 4×** / **Visor 8×** | Un multiplicador para cada zoom del francotirador, encima de «visor francotirador» |
| SENSIBILIDAD | **Giroscopio** (solo móvil): NO · AL APUNTAR · SIEMPRE, sensibilidad sin mira y apuntando, invertir | Girar el móvil gira la cámara. A 1,00 gira lo mismo que el móvil y con el visor se divide por su zoom. Apagado por defecto. En el iPhone Safari pide permiso la primera vez. No apunta por ti: es solo otra forma de mover la cámara |
| MIRA (nueva) | **Cruceta**: 9 colores, 5 estilos (cruz y punto, cruz, punto, círculo, T), largo, grosor, separación extra, borde oscuro, con vista previa | La separación se sigue abriendo con la dispersión real del arma; la extra solo se suma |
| MIRA | **Visor**: color del punto central y «retícula iluminada» | Las líneas del visor toman también ese color |
| MIRA | **Marcador de impacto**: color | Las bajas siguen en rojo y los disparos a la cabeza en dorado |
| MIRA | **Impacto en el cuerpo**: rojo, verde o amarillo | Color de las partículas al acertar |
| GRÁFICOS | **Brillo** (70–140 %) | Cambia la exposición al momento |
| GRÁFICOS | **Estilo de imagen**: CLÁSICO · VIVO · REALISTA · SUAVE · CINE | Saturación, contraste, negros y balance de color |
| GRÁFICOS | **Modo daltónico**: protanopía, deuteranopía, tritanopía | Corrección «daltonize»: los colores que no se distinguen se mueven a otros que sí |
| AUDIO | **Interfaz (botones y menús)** | Su propio volumen (antes iba con «efectos») |
| AUDIO | **Vibración** al disparar y al recibir daño | Solo Android: Safari en el iPhone no deja vibrar a las páginas web (la opción no aparece allí) |

### Cómo están hechos el estilo y el modo daltónico (sin coste de FPS)
- El retoque va dentro del tone mapping ACES que ya hace cada material (`PIC` en `src/page.html`): unas pocas operaciones
  por píxel y ninguna pasada de pantalla completa. El cielo, que tiene su propio shader, usa la misma función (`sdGrade`).
- Se lee al cargar la página, porque los shaders se construyen con él: al cambiarlo aparece «RECARGAR PARA APLICAR».
- CLÁSICO sin corrección deja el tone mapping intacto.
- `?look=vivo|realista|suave|cine` y `?cvd=prot|deut|trit` lo fuerzan para comparar (`tools/capture-scenes.js` con `URLX`).
- Medido con `tools/capture-scenes.js` (PUEBLO 3.0, `p3-plaza` y `p3-fachada`): las mismas 186 llamadas de dibujo y
  320.702 triángulos con todos los estilos. Comparativa: `docs/img/estilos-imagen.jpg`.

### Giroscopio: ejes
`devicemotion.rotationRate` da grados por segundo en los ejes del propio móvil. En horizontal, el eje x del móvil (beta)
queda de pie, así que es el giro; el eje y (gamma) queda a lo largo de la pantalla, así que es la inclinación. El signo
depende de hacia qué lado está girado el móvil (`screen.orientation.angle` 90 o 270). Si en algún móvil va al revés,
«Invertir giroscopio» lo corrige. **Pendiente de validación en el iPhone y en el Samsung.**

### Pruebas
- `node test/ajustes.test.js` (17): mismos giros que antes con los valores por defecto, multiplicadores por situación,
  giroscopio (1:1, al apuntar, con el visor, invertido, apagado), listas y límites.
- `node test/ajustes.browser.test.js` (17): cruceta y vista previa, visor, marcador, brillo, estilos y modo daltónico
  cargados sin errores de shader, MIXTO, FUEGO izquierdo y giroscopio con eventos simulados.

Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE (giroscopio, MIXTO y estilos en Safari).

## Lo que no se ha copiado (y por qué)
- Recogida automática de objetos: el juego no tiene botín.
- Mira inclinada, visores 2×/3×/6× y cambio rápido de visor: las armas del juego solo tienen el visor 4×/8× del rifle y
  las miras de hierro.
- Calidad de los efectos de sonido (baja/alta/ultra): el sonido se genera en el navegador y ya es ligero.
- Límite de FPS por encima de 60: la opción de 60 ya dibuja todos los fotogramas de la pantalla (144 Hz en un monitor
  de 144 Hz). Safari en el iPhone no pasa de 60.
