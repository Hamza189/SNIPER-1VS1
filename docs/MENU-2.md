# MENÚ 2 — el menú principal nuevo (experimental)

Pedido por el propietario el 02-11-2026 con dos imágenes de referencia: «la sala oscura debería ser la referencia
principal; la primera sirve para organizar el botón JUGAR, las tarjetas y la navegación». Construido con los recursos
del juego, sin imágenes generadas como fondo.

- **Cómo verlo:** `https://hamza189.github.io/SNIPER-1VS1/?menu=2` (se recuerda en el dispositivo).
- **Volver al de siempre:** `?menu=1` (también se recuerda). El menú antiguo no se ha tocado: sigue en la página entera.
- **Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR (PC y tamaño iPhone, Chromium) · PENDIENTE DE VALIDACIÓN EN IPHONE Y
  DE APROBACIÓN. Hasta que el propietario lo apruebe, lo de por defecto sigue siendo el menú de siempre.

## Qué hay

| Sección | Qué hace | Qué reutiliza |
|---|---|---|
| Barra de arriba | Logo, tu apodo y tu retrato (abre PERFIL), botón de CAJAS con el número de cajas | `openProfile`, `openInv` |
| **INICIO** | Tu operador en 3D en el centro; a la izquierda MULTIJUGADOR 1V1, VS BOTS y CAMPO DE TIRO (con la vista real del mapa de fondo), OPCIONES DE PARTIDA y **JUGAR**; a la derecha las tarjetas ARMAS y OPERADOR | `setMode`, `startMatch`, la pantalla de salas (`#mp`) |
| OPCIONES DE PARTIDA | La descripción del modo, arma principal (HALCÓN R7 / FURIA 12), dificultad, bots que matan, tiempo, bots de entrenamiento, munición infinita, diagnóstico de tiro y sensibilidad general | Los mismos bloques del menú de siempre, **movidos** (no copiados): sus botones y lo guardado siguen funcionando igual |
| **PERSONAJE** | Los operadores que de verdad se pueden elegir (SOLDADO, S.W.A.T., FSB, MILITAR, CLÁSICO) con retrato y autor; el elegido se ve en 3D al momento | `setSkin`, `SKINS`, `pj2SetPack` (lo ve tu rival online como siempre) |
| **ARMAS** | Dos categorías: FRANCOTIRADOR (las 8 miras y las 5 skins del rifle) y ARMA DE MANO (NAVAJA y TÁCTICA). El arma elegida se ve en 3D de perfil, se puede girar, y el operador la lleva en las manos | `setMira`, `setWskin`, el rifle de tu 1ª persona tal cual (skin, mira y camuflaje de CAJAS) |
| **MAPAS** | Tarjetas con vistas reales de ARENA, PUEBLO, CASA ATLAS y CASA ATLAS XL, con ONLINE / SOLO CONTRA BOTS / EXPERIMENTAL; el elegido es el de VS BOTS y, al crear una sala online, se pone ese (si el servidor lo tiene) | `setOffMap`, `N.chooseMap` (lo que ya hacía el anfitrión) |
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

## Pendiente

- Que el propietario lo pruebe en el iPhone 15 Pro Max y en el PC y lo apruebe (o pida cambios). Hasta entonces sigue
  tras `?menu=2`.
- Medir en el iPhone los FPS del menú (el contador de AJUSTES › GRÁFICOS sirve también en el menú).
- Si se aprueba: hacerlo lo de por defecto y dejar `?menu=1` para el antiguo.
