# PUEBLO 4.0 — auditoría, plan y primeras fases (15-11-2026)

> **24-11-2026:** PUEBLO 4.0 es el único pueblo: el de antes (`?pueblo=0`/`3`, `?pueblo4=0`, `?sur=0`, `?town=0`…) se quitó. El servidor conserva su mapa `pueblo` para páginas viejas (`docs/LANZAMIENTO.md`, Fase 3).

Encargo del propietario (15-11): llevar PUEBLO 3.1 a «un mapa de un shooter 3D real» sin rehacerlo: más calidad visual,
vida, interiores con personalidad, mejores posiciones de francotirador, verticalidad, luz y profundidad, sin bajar de 60 FPS
en el móvil. Primero auditoría y plan, luego fases pequeñas y medidas. Sin publicar y sin cambiar el servidor.

Hecho por Claude (sesión en la nube, 14–15-11) e integrado por Claude Code el 17-11-2026 encima de `main`.

## Integración en el juego (17-11-2026)
- **Solo con `?pueblo=4`** (se recuerda en el dispositivo, como `?pueblo=3`; `?pueblo=0` o `?pueblo=3` lo olvidan). Sin la
  bandera PUEBLO es exactamente el de siempre: ni casas habitables, ni mitad sur nueva, ni fuente nueva, ni 4.0.
  `?pueblo=3` sigue siendo PUEBLO 3.0 como en `main`.
- El paquete activaba las 8 casas habitables (PUEBLO 3.1) **para todos** y cambiaba el mapa `pueblo` del servidor. Para que
  el PUEBLO de ahora siga siendo el de por defecto, el servidor tiene ahora **dos mapas**: `pueblo` (igual que antes, byte a
  byte) y `pueblo4` (2 404 → 7 792 triángulos de bala, 81 → 559 cajas, 705 → 702 puntos de navegación). El servidor ya
  admitía cualquier mapa de `core/mapdata.js` (como `casa2b`/`casa2c`): no se ha tocado `core/room.js` ni `server/`.
- `tools/export-map.js` abre una segunda página con `?pueblo=4` y vuelca su PUEBLO como `pueblo4`.
- **En línea:** con la bandera, `client/netcore.js` traduce el nombre (la página dice `pueblo`, el servidor `pueblo4`) y
  no ofrece el `pueblo` clásico. Si la sala tiene el otro PUEBLO, la página se recarga sola con la bandera correcta y
  vuelve a entrar en la sala (conserva su ficha). El enlace de invitación lleva `&pueblo=4`.
- `?pueblo=4&pueblo4=0` = PUEBLO 3.1 tal cual. `?casas=0`, `?sur=0` y `?fuente=0` siguen valiendo, con la bandera.

- **Capturas** (17/18-11, `tools/capture-scenes.js`, MEDIO, mismas cámaras; izquierda el PUEBLO de siempre, derecha
  `?pueblo=4`): `docs/capturas/pueblo4/integracion/cmp-pc-*.jpg` (1170×540), `cmp-movil-*.jpg` (932×430) y
  `cmp-safari-*.jpg` (932×320, lo que deja Safari en el iPhone 15 Pro Max en horizontal): plaza, calle
  norte, fachada, esquina oeste, vista alta, mitad sur y **dentro de la ENCALADA**. Llamadas y triángulos de cada vista en
  los `*-metrics.json` (plaza: 111 → 263 llamadas, 65 → 379 mil triángulos).
- **Memoria y dibujo** (`tools/pueblo-dibujo.js`, ahora también memoria): ver la tabla del 17-11 en
  `docs/claude-code/SNIPER_DUEL_DECISIONS_LOG.md`. En MEDIO (lo que AUTO elige en el móvil) 4.0 usa las mismas texturas
  que 3.0 (160 MB) y +7,5 MB de geometría.

**`?pueblo=4&pueblo4=0` vuelve a PUEBLO 3.1 al instante.**

Estado: **F0–F5, F6a (vehículos) y F6b (cajas, bidones, depósito) IMPLEMENTADAS · PRUEBAS EN VERDE · MAPA DEL SERVIDOR `pueblo4` APARTE (`pueblo` sin cambios) · SIN PUBLICAR · PENDIENTE DE
VALIDACIÓN EN IPHONE/PC/ANDROID**. F6 (jugabilidad con colisiones nuevas) está propuesta y necesita su aprobación.

---

## F0 · Auditoría de PUEBLO 3.1

### Lo que mejoró de 3.0 a 3.1 (se conserva)
- La mitad sur ya no es arena y cajas grises: todo el pueblo tiene el mismo estilo y el pueblo de fuera cierra los cuatro
  lados.
- Las 8 casas habitables son la mayor mejora de juego: combate cercano dentro, ventanas y balcones como puestos altos.
- La fuente dejó de ser un plano verde.

### Líneas de tiro, medidas (`node tools/lineas-de-tiro.js`, sobre `core/mapdata.js`)
- 702 puestos de suelo (la cuadrícula del servidor). 217 559 parejas a 5–80 m; el **38 %** tienen línea de tiro (ojos a
  1,62 m → pecho a 1,3 m).

| Distancia | Parejas con línea de tiro | % |
|---|---|---|
| corta 5–10 m | 5 898 | 7,1 % |
| media 10–25 m | 22 961 | 27,6 % |
| larga 25–50 m | 35 290 | 42,5 % |
| muy larga 50 m+ | 18 963 | 22,8 % |

- Exposición de un punto de suelo (cuántos puntos le ven): mediana 232, el 10 % más protegido 101 y el 10 % más expuesto
  365.
- **Mapa de exposición** (`docs/capturas/pueblo4/exposicion.png`): la plaza y el cruce son una zona roja de unos
  25 × 25 m. Es la «zona abierta peligrosa» que se busca, pero no tiene ninguna cobertura intermedia más alta que las
  jardineras.
- **Puestos altos** (ventanas y balcones de las casas, azotea de la rampa): ninguno es invencible. Todos tienen tantos
  contraángulos como puntos dominan (proporción ≈ 1), dos salidas (dos puertas; en las de dos plantas, escalera) y otros
  puestos altos que les contestan. Los más fuertes son la azotea de la rampa (ve 360 puntos y 23 puestos altos la ven) y
  los balcones de TERRACOTA (340 y 6).
- Las ventanas altas de TERRACOTA (este y sur) ven poco: como mucho 29 puntos, y ningún puesto alto les contesta. Dan
  al muro y a casas cercanas, así que no son buen puesto: se quedan para el combate cercano.

### Problemas, por prioridad
| # | Prioridad | Problema | Fase |
|---|---|---|---|
| 1 | P0 | Ninguno encontrado. Colisiones, balas, navegación, servidor, coberturas falsas y online están en verde (pruebas de 3.1) | — |
| 2 | P1 | Materiales «de ordenador»: el estuco, la piedra y el adoquín están igual de limpios en todas partes; sin suciedad abajo ni manchas; la repetición del adoquín y las losas se nota de lejos | F1 |
| 3 | P1 | Interiores de las casas: cajas blancas sin nada; no se sabe qué es cada casa; poca luz (sin sol dentro) | F2 |
| 4 | P1 | Fachadas que se parecen: mismas ventanas y contraventanas; casi no hay ropa tendida, aparatos de aire, jardineras ni placas (en 5 edificios: 1 aparato, 0 tendederos) | F3 |
| 5 | P1 (jugabilidad) | Combate corto escaso fuera de las casas (7 % de las líneas son de 5–10 m) y la plaza sin cobertura intermedia | F6, con colisiones: necesita aprobación |
| 6 | P2 | Calles: adoquín uniforme, solo hay tapas en la calle transversal, nada en el aire (sin cables) | F1 y F3 |
| 7 | P2 | Luz plana: la luz del cielo llena tanto que las fachadas pierden relieve; la niebla del horizonte es del mismo color que el pueblo | F4 |
| 8 | P2 | Restos de PUEBLO 2.0 que se ven de prototipo: el depósito de agua, las cajas de madera de textura antigua, los coches, los bidones | F6 (sustituir con colisiones iguales: va con el servidor) |
| 9 | P3 | La fuente no está «asentada»: piedra igual de limpia en la base que arriba | F1 (la suciedad que sube del suelo también le llega) |
| 10 | P3 | Sin tejados accesibles en el norte (la única azotea alcanzable está en el sur) | F6 |
| 11 | P4 | Bancos, mesas y herramientas en la calle | F6 (necesitan cajas de colisión) |

### Plan
- F1 materiales → F2 casas por dentro → F3 vida y calles → F4 luz → F5 GLB ligero. Todo es solo visual: el servidor ni se
  entera.
- **F6, jugabilidad**: cambia colisiones, así que exige exportar el mapa y desplegar el servidor, y por tanto la
  aprobación del propietario.

---

## Lo hecho (F1–F5)

| Fase | Qué cambió | Archivos |
|---|---|---|
| F1 Materiales | Desgaste en el sombreado de los **materiales compartidos** del pueblo, sin texturas nuevas (`SDPueblo4.weather`, enganchado en `KIT3D.material` con `ctx.decorate`). En muros: suciedad que sube del suelo hasta 0,75–1,35 m de forma irregular, churretes verticales, manchas grandes, un tono distinto por manzana (±6 %) y más rugosidad donde hay suciedad. En el suelo: manchas grandes que rompen la repetición del adoquín y las losas, y zonas gastadas. Llega a la fuente, las casas y las piezas del kit. No en BAJO | `client/pueblo4.js`, `client/kit3d.js` |
| F2 Casas | Cada casa tiene su carácter: vivienda, tienda (estanterías llenas), taller (panel de herramientas, bidones, mancha de aceite), almacén (botelleros y sacos), señorial y piedra (librerías, aparador, espejo, cuadros). En cada planta hay una alfombra y una lámpara que brilla. Las caras de dentro están un 30 % más claras, como si les llegara la luz de rebote. Todo va pegado a una pared (como mucho 0,3 m de fondo: los ojos del jugador no se meten dentro), plano o bajo el techo; nada encima de las escaleras | `client/casas.js` (`TYPE`, `freeSpans`, `deco`, `mesh(…,{boost})`) |
| F3 Vida y calles | En las fachadas de PUEBLO 3.0: ropa tendida, jardineras en los alféizares y aparatos de aire (todo por encima de 2 m), placas con el número y contadores junto a las puertas (planos). Cables entre fachadas sobre las calles (a más de 4,5 m; 10 tramos dobles). Tapas de alcantarilla también en las calles norte y sur | `client/pueblo4.js` (`dress`, `cables`), `client/town3.js` (`opt.p4`) |
| F4 Luz | Más sol (3,0 → 3,2) y menos cielo (1,0 → 0,92): más relieve en las fachadas. Niebla un poco más fría (`0xdcd6c8` → `0xd8dad6`): lo lejano se separa de lo cercano | `src/page.html` (`LOOK`) |
| F6a Vehículos (15-11, tras la queja del coche de plástico) | Los 3 coches de PUEBLO 2.0 (cajas de colores planos) son ahora **pick-ups 4×4 viejas y abandonadas**, hechas en Blender por código (`tools/blender/vehiculos.py` → `assets/3d/models/sd_p4_vehiculos.glb`, 0,9 MB, 3 variantes de unos 4 600 triángulos). Tienen pintura desteñida con óxido, churretes, polvo y barro en el color de vértice; lunas rotas; un faro roto; una rueda pinchada; lona sobre la caja; bajos, interior, juntas, rejilla y matrícula sin texto. **Solo cambia lo que se ve:** la caja de colisión y los triángulos de bala del coche viejo siguen igual (el coche viejo queda invisible en la escena, como el resto de restos de 2.0). La forma de pick-up es a propósito: llena la misma silueta que la caja de bala (carrocería hasta 1,2 m y cabina hasta 1,9 m). Un turismo de 1,4 m dejaría medio metro de cobertura falsa sobre el techo. Hasta que carga el modelo se ve el coche viejo; si no carga, se queda el viejo | `tools/blender/vehiculos.py`, `src/page.html` (`P4VEH`), `client/kit3d.js` (`paint`), `client/pueblo4.js` |
| F6b Cajas, bidones y depósito (15-11) | Los últimos restos de PUEBLO 2.0 que se veían de cerca, con el mismo criterio que los coches: `tools/blender/utileria.py` → `assets/3d/models/sd_p4_utileria.glb` (0,35 MB). **Cajas** de pino curtido (3 variantes, unos 240 triángulos): tablas con rendijas, postes, listones, una con diagonal, otra con una tabla y la tapa rotas (se ve el interior oscuro). **Bidones** de 200 l (3 variantes, 724 triángulos): aros de rodadura, bordes, tapones, uno abollado; pintura desteñida, óxido en aros, bordes y abajo, churretes y barro. **Depósito**: patas en H dentro de su caja de 0,3 m, vigas, cruces de redondo de 2,2 cm (como en 2.0), tanque con dos costuras remachadas, tejado cónico con alero y respiradero, escalera junto a una pata que empieza a 2,6 m; óxido por manchas y churretes (3 100 triángulos). **Solo cambia lo que se ve:** cada pieza cabe en la caja / los triángulos de bala del objeto viejo (el script se para si no) y el objeto viejo sigue invisible para las balas. Si el modelo no carga, se quedan los objetos viejos | `tools/blender/utileria.py`, `src/page.html` (`P4PROP`, `P4VEH.props`), `test/pueblo4.test.js` |
| F5 GLB | `pueblo4-ligero.glb`: el pueblo en una malla por material (76 mallas, 76 materiales, 57 texturas de 512 px como máximo, 418 mil triángulos, **32,4 MB**). Sin color de vértice cuando es todo blanco, sin UV donde no hay textura y con índices de 16 bits cuando caben (37,7 → 32,4 MB). Es de referencia y para arte: el juego no lo carga. Lo que más pesa son las posiciones, normales y UV; para bajar más habría que cuantizar (`KHR_mesh_quantization`) con una herramienta externa, que no se ha añadido sin permiso. `casas-habitables.glb` 5,6 MB (47 mil triángulos) y `fuente.glb` 0,5 MB | `tools/exportar-glb.js` |

No se ha añadido nada que pueda servir de cobertura sin serlo: `test/cover.browser.test.js` sigue en verde. Ninguna
caja, bala ni punto de navegación cambia: `core/mapdata.js` sale **idéntico** con `node tools/export-map.js`.

## Medidas
Con `tools/pueblo-dibujo.js`: partida en PUEBLO, pantalla de iPhone (932×430 a 2×) y vuelta de cámara en la plaza, en
WebGL por software. Son medias por fotograma. `QUAL=medio` o `QUAL=bajo` miden los otros perfiles.

| Perfil | PUEBLO 3.1 (`?pueblo4=0`) | PUEBLO 4.0 | Diferencia |
|---|---|---|---|
| ALTO | 263,5 llamadas · 371,6 mil triángulos | 263,6 · 419,1 mil | +0,1 llamadas · +47,5 mil (+12,8 %) |
| MEDIO | 242,6 · 323,7 mil | 239,9 · 371,0 mil | −2,7 · +47,3 mil |
| BAJO | 169 · 218,2 mil | 169,3 · 246,8 mil | +0,3 · +28,6 mil |

Con F6b (cajas, bidones y depósito) las llamadas **bajan** unas 12 frente a F6a (276 → 263,6 en ALTO): las piezas nuevas van
en el mismo grupo que las pick-ups y los restos de 2.0 dejan de dibujarse en cada cuarto del pueblo. Los triángulos suben
+17,7 mil frente a F6a (401,4 → 419,1 mil en ALTO), contando la sombra. Antes de F6b (solo F6a) eran 276 · 401,4 mil en
ALTO, 252,3 · 353,3 mil en MEDIO y 174,6 · 236,9 mil en BAJO.

Sin los vehículos (F1–F5) eran 273,4 · 379,4 mil en ALTO, 249,7 · 330,9 mil en MEDIO y 173,1 · 223,8 mil en BAJO. Las tres
pick-ups van juntas en un grupo por material (6 materiales) y cuestan unas +2,6 llamadas y +22 mil triángulos en ALTO,
contando también su sombra.

- Memoria: **0 texturas nuevas** (79 en los dos casos). Geometrías iguales (las piezas nuevas se fusionan con las que
  ya había). +4 programas de sombreado (41 frente a 37) y unos 0,5 MB de geometría.
- Coste de GPU del desgaste: unas 2 consultas de ruido por píxel en muros y suelos. **No se puede medir aquí.**
  PENDIENTE: MEDIR RENDIMIENTO en el iPhone con y sin `?pueblo4=0`.

## Riesgo a vigilar
- En la nube, con WebGL por software (SwiftShader), una sesión larga de capturas de PUEBLO 4.0 (6–8 vistas seguidas en la
  misma página) puede cerrar la pestaña («Target crashed»). Las vistas sueltas funcionan, y PUEBLO 3.1 aguanta 12–21
  vistas. Puede ser solo el WebGL por software, o memoria y compilación de sombreados que se acumulan.
- **PENDIENTE: comprobar en el iPhone** con una partida larga (10 minutos o más, girando por todo el pueblo) que no se
  recarga la pestaña. Si se recarga, `?pueblo4=0` lo quita.

## Pruebas
Están en `docs/claude-code/PUEBLO4_PARA_CLAUDE_CODE.md` y en `RESULTADOS_PRUEBAS.txt` del paquete.

## F6 · Propuesta de jugabilidad (sin hacer; necesita aprobación)
Todo esto cambia cajas y balas: hay que exportar el mapa y desplegar el servidor.
1. **Plaza**: 4 coberturas intermedias en las esquinas de la plaza (bancos de piedra de 0,5 m con respaldo de 1,0 m y
   macetones). Pasan de «zona roja» a una zona con decisiones, sin cerrar las líneas largas del cruce. Medido antes y
   después con `tools/lineas-de-tiro.js`: el objetivo es subir el combate corto del 7 % al 10–12 % sin bajar la larga del
   40 %.
2. **Contraángulo norte**: una azotea alcanzable en el norte (escalera de mano en el patio de PIEDRA o del TALLER)
   para contestar a los balcones de TERRACOTA, con una sola subida (vulnerable) y pretil.
3. **Callejón**: abrir un paso de 2 m entre la calle norte y el patio de detrás del COLMADO. Sería una ruta de flanqueo
   a cubierto hacia la plaza.
4. ~~Sustituir los restos de PUEBLO 2.0 que quedan~~ **Hecho** (F6a coches, F6b cajas, bidones y depósito), con las mismas
   cajas de colisión: el servidor no cambia.
5. **Bots del servidor dentro de las casas**: cambiar cómo `core/bots.js` calcula la separación de la red y medir el
   coste de su grafo.
