# Más detalle en la escena (`?detalle=1`) — 25-11-2026

Fase 4 de 5 del encargo «más parecido a Call of Duty / PUBG sin cambiar de motor»: calcomanías y objetos pequeños en el
PUEBLO y el BARRIO. `client/detalle.js`.

**Estado**: IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE QUE EL PROPIETARIO LO VEA (PC e iPhone) con `?detalle=1`
(se recuerda; `?detalle=0` lo quita). Solo pasa a ser lo de por defecto si lo aprueba.

## Qué hay
- **En el suelo**: suciedad al pie de las paredes, manchas de aceite y de humedad, grietas, marcas de neumático, hojas,
  papeles y colillas.
- **En las paredes**: churretes bajo las ventanas (PUEBLO), carteles descoloridos («SE ALQUILA», «FIESTAS SAN ROQUE»,
  «CIRCO MUNDIAL»), placas de calle, «PROHIBIDO FIJAR CARTELES», y en el BARRIO también humedad que sube del suelo y
  pintadas (de seis colores).
- **Objetos pequeños tumbados**: latas, botellas, ladrillos y cascotes, junto a las paredes y por el suelo.

| Mapa | Calcomanías | Objetos | Triángulos | Llamadas |
|---|---|---|---|---|
| PUEBLO | 464 | 192 | 7 344 | +2 |
| BARRIO | 324 | 161 | 5 924 | +2 |

## Reglas (lo que no se toca)
- **Ni cajas, ni balas, ni servidor**: `node tools/export-map.js` + `git diff core/mapdata.js` = sin cambios.
- **Ninguna cobertura falsa**: los objetos miden como mucho 12 cm (la regla de PUEBLO 3.0: lo que no es caja va a ras de
  suelo o pegado a la pared). Las calcomanías son planas.
- **Nada encima de lo que ya hay en la pared**: los carteles evitan ventanas, puertas, balcones, toldos, rótulos, placas,
  contadores, aparatos y bajantes del kit.
- Nada dentro de las 8 casas habitables ni en la fuente; nada escondido dentro de una caja (se descarta).
- Una semilla fija: los dos jugadores ven lo mismo.

## Cómo funciona
- Las paredes salen de las **cajas del mapa**: cada cara de una caja de 2,4 m o más que da a suelo libre, en tramos de
  ~3 m. Así vale para cualquier mapa nuevo sin colocar nada a mano.
- La altura del suelo bajo cada cosa se mide con un rayo contra el suelo que se ve.
- Las texturas se dibujan en el juego en un lienzo de 1024×1024 (16 casillas de 256): nada que descargar.
- Dos mallas por mapa: las calcomanías (transparentes, sin escribir profundidad, con desplazamiento de polígono para no
  parpadear) y los objetos.

## Coste
GPU real del PC (GTX 1050 Ti, `tools/gpu-coste.js`, PUEBLO en ALTO al tamaño del iPhone a 2×): +0,2 ms. Con las cuatro
banderas a la vez (`?lm=1&post=1&estilo=1&detalle=1`): +0,3 ms. iPhone: PENDIENTE.

## Pruebas y herramientas
- `node test/detalle.test.js` (17) con las cajas reales del servidor: hay detalle, siempre igual, ningún objeto dentro de
  una caja, todo plano o a ras de suelo, todo mirando hacia fuera, ningún cartel sobre ventanas.
- `node tools/detalle-check.js`: cuántas se crearon en el juego y dónde (depuración).
- Capturas `docs/img/detalle/` (sin arriba, con abajo).

## Fallos encontrados al hacerlo
- Las cajas no llegaban al planificador (solo salía lo del suelo abierto): visto con `tools/detalle-check.js`.
- La primera pintada era un zigzag fino, igual en todas las paredes: ahora letras gruesas con contorno y chorretones,
  teñidas de un color por pared.
- Los carteles, nuevos y muy saturados (fuera de la guía de estilo): ahora descoloridos por el sol.
