# Paquetes por mapa y texturas por distancia (`?stream=1`) — 25/26-11-2026

Fase 5 de 5 del encargo «más parecido a Call of Duty / PUBG sin cambiar de motor»: para mapas grandes, primero una
versión pequeña de cada textura y la grande al acercarse, con el sistema KTX2 de siempre (`docs/KTX2.md`).

**Estado**: IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE QUE EL PROPIETARIO LO VEA (PC e iPhone) con `?stream=1`
(se recuerda; `?stream=0` lo quita). Solo pasa a ser lo de por defecto si lo aprueba.

## Cómo funciona
1. **Un paquete por mapa** (`client/packs.js`, generado por `node tools/packs/make.js`): las texturas de `assets/tex/`
   que usan de verdad las mallas de ese mapa (mirado en el juego, no adivinado), y lo que pesa cada versión. Una textura
   que usan los dos mapas va en el del PUEBLO.
2. **Al entrar** en un mapa, sus texturas se cargan en su versión pequeña (`assets/tex/lo/`, lado ≤ 256 px): el mapa
   aparece antes y con menos memoria.
3. **Al acercarse** (a menos de 40 m de algo que la usa y se ve), se carga la buena, **de una en una** y la más cercana
   primero (nada de picos de memoria: lo que se aprendió con Safari el 29-10):
   - en **KTX2** (UASTC, 1 byte por píxel en la GPU en vez de 4: ASTC en el iPhone, BC7 en el PC), con el cargador y la
     liberación de memoria de siempre (`ktx2Ready`, `ktx2Lean`), desde **Cloudflare R2** como el resto de KTX2;
   - en **JPG** si el aparato no puede con KTX2, en BAJO, o con `&streamktx2=0`; y también si R2 no responde.
4. **Lo que lleva 20 s lejos** (más de 70 m, o en un mapa que ya no se ve) vuelve a la pequeña y suelta la GPU. Entre
   40 y 70 m no cambia nada (sin ir y venir).
5. Las KTX2 se codifican desde la imagen volteada en vertical: los JPG se cargan volteados (`flipY`) y los KTX2 no, así
   que sin eso las texturas saldrían boca abajo.

La decisión (cerca / lejos / cuánto tiempo) es pura y tiene su prueba: `client/stream.js`, `test/stream.test.js`.

## Tamaños (26-11-2026)
| Mapa | Texturas | Pequeñas | JPG | KTX2 (descarga) |
|---|---|---|---|---|
| PUEBLO | 43 | 0,56 MB | 5,10 MB | 19,42 MB |
| BARRIO | 11 | 0,10 MB | 1,60 MB | 7,12 MB |

- Lo que se descarga para **empezar** a jugar: 0,56 MB en lugar de 5,1 MB (PUEBLO).
- **Ojo**: la KTX2 (UASTC) pesa en la **descarga** unas 4 veces más que el JPG, pero en la **GPU** ocupa 4 veces menos
  (un JPG se descomprime a 4 bytes por píxel). Es lo mismo que se eligió para personajes y armas (memoria del iPhone por
  encima de la descarga). Con `&streamktx2=0` se usa el JPG (descarga pequeña, más memoria).
- Las KTX2 están en R2 (`assets/tex/ktx2/`, fuera del repositorio: el publicado roza 1 GB). Se suben con
  `node tools/r2-subir.js` (ya las incluye).

## Memoria de la GPU (lo que importa en el iPhone)
| Mapa | Todo en JPG (como hasta ahora) | Todo en KTX2 | Al empezar (pequeñas) |
|---|---|---|---|
| PUEBLO | 98,3 MB | 24,6 MB | 14,3 MB |
| BARRIO | 38,7 MB | 9,7 MB | 3,7 MB |

(Con mipmaps: JPG 4 bytes por píxel, KTX2 1 byte por píxel.) Y al salir de un mapa, a los 20 s sus texturas buenas
vuelven a pequeñas.

## Medidas en el navegador (`node tools/stream-check.js`, SwiftShader, ALTO, calle norte del PUEBLO)
- Al empezar: 49 de 51 texturas en pequeño; mismas llamadas que sin `?stream=1` (170).
- Sube de una en una, la más cercana primero, **sin ir y venir**: 41 → 31 → 21 → 13 pendientes; al final 32 en KTX2,
  0 fallos, 0 soltadas por error. Las 19 que se quedan pequeñas son las 11 del BARRIO (no se ve) y 8 del PUEBLO que
  desde allí están a más de 40 m: lo esperado.
- Un primer intento soltaba y volvía a cargar texturas (vaivén): tras pasar a KTX2, la distancia se medía solo con las
  mallas que aún usaban la pequeña (las del BARRIO, ocultas). Ahora cada textura recuerda todas las mallas que la usan.
- Las copias que aparecen después (los materiales de un mapa que carga más tarde) suben aparte en JPG.
- Segunda pasada (todo el PUEBLO): 40 texturas en KTX2, 0 fallos; memoria de las texturas del PUEBLO en la GPU,
  **23,6 MB** frente a 98,3 MB si todo fuera JPG.
- **Soltar** (`node tools/stream-soltar.js`): el adoquín (`setts_c`, solo del PUEBLO) sube en KTX2; al pasar al BARRIO,
  a los 21 s vuelve a la pequeña y la KTX2 deja la GPU; al volver al PUEBLO sube otra vez. Una textura que también usa
  el BARRIO (`stucco_c`) no se suelta allí: sigue cerca, como debe.
- **Orientación**: la KTX2 descomprimida coincide con el JPG volteado (42–47 dB; sin voltear, 26–30 dB): es lo que hace
  falta para que, cargada sin `flipY`, se vea igual que el JPG.
- iPhone: PENDIENTE (lo prueba el propietario).

## Herramientas
`node tools/packs/make.js` (paquetes, pequeñas, KTX2) · `node tools/r2-subir.js` (KTX2 a R2) ·
`node tools/stream-check.js [dir]` (sube todo y mide) · `node tools/stream-soltar.js` (soltar al salir) ·
`node test/stream.test.js` (17).
