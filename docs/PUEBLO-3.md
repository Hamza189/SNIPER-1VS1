# PUEBLO 3.0 — vertical slice (sin publicar por defecto)

**Estado:** IMPLEMENTADO y PROBADO EN NAVEGADOR (escritorio, WebGL por software).
PENDIENTE DE APROBACIÓN ESTÉTICA y PENDIENTE DE VALIDACIÓN EN IPHONE.

- Ver la slice: añade `?pueblo=3` a la URL del juego (también sirve en online: el mapa del servidor es el mismo).
- Sin la bandera el juego es PUEBLO 2.0, igual que antes. Rollback: no hay nada que deshacer, basta con no usar la bandera.
- `?town=0` sigue mostrando el pueblo original de cajas.

## Qué cubre la slice

Toda la mitad norte de PUEBLO: la calle norte, la plaza (con la fuente), la calle transversal y los 7 edificios del
norte, además del pueblo exterior que hay detrás de los muros norte, este y oeste. La mitad sur sigue siendo PUEBLO 2.0
hasta que se apruebe el estilo (P3-5).

| Pieza | Archivo |
|---|---|
| Luz, cielo y niebla de mediodía (solo con `?pueblo=3`) | `src/page.html` (`LOOK`) |
| 6 familias de edificios, suelo, pueblo exterior, colinas | `client/town3.js` |
| Kit modular (54 piezas, todas generadas por código, sin assets de terceros) | `tools/blender/kit.py` → `assets/kit.glb` |
| Materiales y horneado del kit en mallas estáticas | `client/kit3d.js` |
| Texturas nuevas (estuco, mampostería, adoquín irregular, losas, asfalto, tierra, teja, azulejo, ladrillo, espiga, empedrado) | `tools/textures/make_textures_p3.py` |
| Hoja del kit (render del motor) | `tools/kit-viewer.html`, `tools/capture-kit.js` |
| Cámaras de comparación y métricas | `tools/capture-scenes.js` (vistas `p3-*`), `tools/scene-metrics.js` |

Las familias son: casa encalada, casa de piedra, casa terracota, comercio, taller y casa señorial.

## Reglas de juego intactas

- Las cajas de colisión, los objetivos de las balas y `core/mapdata.js` (servidor) no cambian.
- Los muros van sobre las caras de las cajas. Los huecos entran 22 cm en ellas.
- A la altura del cuerpo (entre 0,12 y 2 m) no hay nada lejos de un muro. La decoración baja pegada a la pared
  (macetas, bancos) no pasa de 0,66 m, y una persona agachada mide 1,2 m.
- Por encima de 2 m solo hay balcones, toldos, faroles y ropa tendida, siempre a menos de 1,2 m de una fachada.
- Las jardineras de piedra ocupan exactamente la caja de los antiguos sacos terreros. La fuente encaja en sus cajas.
  Las farolas ocupan el cilindro de los antiguos postes.
- Las azoteas no tienen nada por encima de la caja del pretil.

Tests:

- `test/town3.test.js` comprueba la geometría y cada pieza del kit con sus medidas reales sacadas del GLB.
- `test/cover.browser.test.js` revisa lo que la página dibuja de verdad, vértice a vértice, frente a las cajas sólidas
  ("coberturas falsas"). Incluye una caja falsa de control que el detector tiene que encontrar.

## Rendimiento

- El kit se hornea en mallas estáticas por zona y material, lo que da pocas llamadas de dibujo.
- Texturas de color a 512 px; normal y rugosidad a 256 px.
- BAJO quita los detalles pequeños. Las sombras del kit dependen del perfil: en ALTO, todo lo grande; en MEDIO, balcones,
  toldos y cornisas.
- Las 28 cajas de sombra de los edificios ahora son una sola malla, con la misma sombra (esto también afecta a 2.0).
- AUTO estable: nunca baja de 0,75 de resolución y no sube y baja sin fin, porque el escalón que provocó la bajada queda
  como techo.

Las cifras de `tools/scene-metrics.js` son de escritorio con WebGL por software. **No son rendimiento de iPhone.**
