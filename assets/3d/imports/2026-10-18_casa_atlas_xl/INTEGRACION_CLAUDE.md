# CLAUDE CODE · CASAXL — Integración segura

**Este asset NO está integrado ni aprobado.** No tocar mapas existentes hasta comparar.

1. Copia esta carpeta intacta a `assets/3d/imports/2026-10-18_casa_atlas_xl/` y conserva `FUENTE.md`.
2. Valida ambos GLB con `node tools/validate-glb.js` (inspecciona primero las opciones y límites). No los comprimas con Draco/meshopt/KTX2. Deben contener normales, TEXCOORD_0, PBR y alphaMode correctos.
3. Asegura que los materiales base color factor sean neutros; alpha vegetal `MASK`, vidrio `BLEND`. Comprueba iluminación interior con techo visible. Las normales y ORM son embebidas.
4. Integra nuevo identificador `casaxl` detrás de `?casa=2`. Conserva CASA ATLAS 18×14 y PUEBLO/ARENA/CAMPO DE TIRO idénticos. No reescales el GLB: 1 unidad = 1 metro. Calle hacia +Z.
5. Adapta `tools/casa/make_casa_js.py`, `tools/export-map.js` y `core/mapdata.js` solo cuando sepas cómo funcionan en la versión actual. Importa `collision_map.json` como fuente única de cajas para cliente y servidor. Comprueba solid (jugador+balas), move (solo jugador); no derives colisiones por raycasts de las mallas visuales.
6. Importa los techos por separado como opacos en partida; ocúltalos solo en vistas aéreas. Asegura que el salto no permita subir a cubiertas. Los colisionadores de cubierta están en JSON. Ilumina adecuadamente el interior.
7. Ejecuta en orden: `src/qa_casa_xl.py` local, tu validador de GLB, pruebas de puertas ≥1m, pasillos ≥1,2m, vidrio, cobertura falsa ≤6cm, spawns y radios de cilindro, navMarkMain como componente única, rutas A-B, LOS oficiales, respawn y bots. Revisa los huecos del GLB frente a la caja del servidor, especialmente ventanas de `move`.
8. Crear `casa.test.js`, `casa.browser.test.js`, `casa.online.browser.test.js`; pruebas de regresión `npm test`.
9. Capturas a y=1,62 m desde calle, patio, interior villa, jardín y garaje (están incluidas como referencias). Medir FPS, frame times, GPU/memoria, draw calls y texturas en ALTO/MEDIO/BAJO con hardware real.
10. **NO desplegar Cloudflare / servidor sin la aprobación explícita del propietario**, porque añadir `core/mapdata.js` modifica mapa autoritativo. Mantén rama de pruebas y respalda un tag/commit estable.

**Advertencia artística:** este es un primer mapa 3D modular optimizado y explorable, no un escenario de calidad AAA terminada. La prioridad de este envío es layout, geometría real y colisiones que encajan. Una vez probado el combate 1v1, se podrá sustituir su material procedural por CC0 real sin alterar las rutas.
