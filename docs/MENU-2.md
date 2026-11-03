# MENÚ 2 — el menú principal (por defecto desde el 03-11-2026)

Pedido por el propietario el 02-11-2026 con dos imágenes de referencia: «la sala oscura debería ser la referencia
principal; la primera sirve para organizar el botón JUGAR, las tarjetas y la navegación». Construido con los recursos
del juego, sin imágenes generadas como fondo.

- **Por defecto** desde el 03-11-2026: el propietario lo probó en el iPhone («funciona mejor») y pidió que el enlace
  normal (`https://hamza189.github.io/SNIPER-1VS1/`) abra ya este menú.
- **Volver al de antes:** `?menu=1` (se recuerda en el dispositivo, `sniperduel_menuOld`); `?menu=2` vuelve al nuevo. El
  menú antiguo no se ha borrado: sigue entero en la página.
- **Estado:** POR DEFECTO · PROBADO EN NAVEGADOR (PC y tamaño iPhone) · PROBADO POR EL PROPIETARIO EN IPHONE (03-11).

## Qué hay

| Sección | Qué hace | Qué reutiliza |
|---|---|---|
| Barra de arriba | Logo, tu apodo y tu retrato (abre PERFIL), botón de CAJAS con el número de cajas | `openProfile`, `openInv` |
| **INICIO** | Tu operador en 3D en el centro; a la izquierda MULTIJUGADOR 1V1, VS BOTS y CAMPO DE TIRO (con la vista real del mapa de fondo), OPCIONES DE PARTIDA y **JUGAR**; a la derecha las tarjetas ARMAS y OPERADOR | `setMode`, `startMatch`, la pantalla de salas (`#mp`) |
| OPCIONES DE PARTIDA | La descripción del modo, arma principal (HALCÓN R7 / FURIA 12), dificultad, bots que matan, tiempo, bots de entrenamiento, munición infinita, diagnóstico de tiro y sensibilidad general | Los mismos bloques del menú de siempre, **movidos** (no copiados): sus botones y lo guardado siguen funcionando igual |
| **PERSONAJE** | Los operadores que de verdad se pueden elegir (SOLDADO, S.W.A.T., FSB, MILITAR, CLÁSICO) con retrato y autor; el elegido se ve en 3D al momento | `setSkin`, `SKINS`, `pj2SetPack` (lo ve tu rival online como siempre) |
| **ARMAS** | Dos categorías: FRANCOTIRADOR (las 8 miras y las 5 skins del rifle) y ARMA DE MANO (NAVAJA y TÁCTICA). El arma elegida se ve en 3D de perfil, se puede girar, y el operador la lleva en las manos | `setMira`, `setWskin`, el rifle de tu 1ª persona tal cual (skin, mira y camuflaje de CAJAS) |
| **MAPAS** | Tarjetas con vistas reales de ARENA, PUEBLO, CASA ATLAS y CASA ATLAS 2.0 (la XL la retiró el propietario el 02-11), con ONLINE / EXPERIMENTAL; el elegido es el de VS BOTS y, al crear una sala online, se pone ese (si el servidor lo tiene) | `setOffMap`, `N.chooseMap` (lo que ya hacía el anfitrión) |
| **AJUSTES** | Los ajustes de siempre, con todas sus secciones (controles, sensibilidad, mira, gráficos, editor del HUD…); al pulsar LISTO vuelves a la sección en la que estabas | `openSettings` / `closeSettings` |

No hay monedas, niveles, tiendas ni recompensas inventadas: todo lo que sale existe ya en el juego.

## La sala 3D

`client/menu2.js` (`SDMenu2.buildRoom`): suelo de hormigón oscuro, pared de fondo con costillas de acero y una línea de
LED naranja, tres lámparas de techo con un halo suave, cuatro cajas de material y polvo en suspensión. Luz cálida
principal por delante a la izquierda, dos contraluces fríos por detrás y un rebote naranja. Sin sombras dinámicas (una
sombra de contacto pintada bajo el operador). Exposición propia (0,78) para que la sala sea oscura sin tocar la del juego.

- **Operador:** `makeSoldier` + `pj2SetPack` con el personaje elegido, animación de reposo del juego con el rifle bajo y
  un balanceo pequeño (respiración y peso). Se gira arrastrando con el ratón o el dedo; a los 2,6 s vuelve de frente.
- **Rifle en sus manos y arma de muestra:** copias de los nodos del rifle de tu 1ª persona (`GUN`), que ya lleva la skin,
  la mira y el camuflaje. Comparten mallas, materiales y texturas: no se carga ni se ocupa memoria de nuevo.
- **Encuadre:** cada sección tiene un hueco libre (`.m2Stage`); la cámara desplaza su imagen (`setViewOffset`) y se aleja
  lo justo para que el operador quepa en ese hueco, en cualquier pantalla. El arma de muestra se coloca igual en su hueco.
- **Memoria y rendimiento:** mientras juegas la sala se libera (geometrías, materiales y sus dos texturas) y no se dibuja
  nada de ella; al volver al menú se reconstruye. El mapa sigue cargado detrás como antes (hace falta para empezar sin
  esperas), pero en el menú nuevo **no se dibuja**: solo la sala. Medido en Chromium (WebGL por software, sirve para
  contar, no para FPS): 66–89 llamadas de dibujo y 21 000–34 000 triángulos por fotograma según el operador.
- **Nada cambia en las reglas:** skins, miras y cuchillos son solo aspecto y usan las mismas funciones que antes; el
  servidor no recibe nada nuevo.

## Archivos

- `client/menu2.js` — la sala y las cuentas del encuadre (probado sin navegador en `test/menu2.test.js`).
- `src/page.html` — el HTML (`#m2`, dentro de `#menu` para que todo lo que muestra u oculta el menú siga valiendo), su CSS
  (bloque «MENÚ 2») y su lógica (bloque «MENÚ 2» antes del bucle de dibujo).
- `assets/menu/mapa_*.jpg` — vistas reales de cada mapa, hechas con el juego: `node tools/menu2-mapas.js` (repetir si
  cambia un mapa).
- `tools/capture-menu2.js` — capturas de todas las secciones en PC (1600 × 900) y móvil (932 × 430):
  `node tools/capture-menu2.js docs/menu2`.
- `docs/menu2/` — las capturas de la entrega (PC y móvil, cada sección; en las capturas automáticas la letra es la de
  reserva porque no se descarga la fuente Teko).
- `test/menu2.browser.test.js` — cada botón del menú nuevo, el de siempre intacto sin la bandera, JUGAR, la sala liberada
  al jugar, y el móvil en horizontal.

## Correcciones del 03-11-2026 (vídeo del propietario en el PC)

El propietario grabó el menú en su PC: «al principio parece ser que tarda bastante en cargar todos los personajes… hay
varios fallos que hay que pulir». Visto en el vídeo y corregido:

| Fallo | Causa | Arreglo |
|---|---|---|
| Al abrir el menú salía un soldado de cajas blanco durante segundos, y otra vez al cambiar de operador | El operador del menú nacía con el personaje por defecto (S.W.A.T. o FSB), que se descargaba antes que el tuyo, y mientras llegaba se veía la figura de cajas | El operador nace sin personaje y se descarga primero el tuyo. Mientras no está, no se ve nadie y sale «CARGANDO OPERADOR…». Al cambiar, el anterior se queda hasta que el nuevo está listo («CARGANDO MILITAR…»). En el PC, al pasar el ratón por un operador ya empieza a cargarse |
| Al elegir una skin del rifle, la muestra seguía siendo el HALCÓN casi dos minutos (en partida también) | Las texturas 4K de las skins se descargan en cola (3 a la vez). La skin elegida antes (ÚLTIMA, 139 MB) seguía ocupando la cola y la nueva esperaba detrás | Las texturas de la skin elegida ahora pasan delante en la cola (también en partida). En ARMAS, mientras llega, sale «CARGANDO TITÁN · 40 %» en lugar del HALCÓN |
| El CLÁSICO se veía blanco | A los colores de la figura de cajas les faltaba la corrección de color que el juego aplica a su escena | Se aplica también al operador del menú |
| MAPAS: tarjetas pequeñas arriba y media pantalla vacía | Rejilla de 4 en fila | 2 × 2, del tamaño que permita la pantalla |

La primera descarga de una skin 4K sigue tardando lo que tarda (ÚLTIMA son 139 MB). Después el navegador la guarda y
la siguiente vez sale al momento.

## Pendiente

- Medir en el iPhone los FPS del menú (el contador de AJUSTES › GRÁFICOS sirve también en el menú).
- Si pasado un tiempo nadie usa `?menu=1`, se podrá retirar el menú antiguo (pidiéndolo antes al propietario).
