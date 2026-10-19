# Encargo para ChatGPT — CASA ATLAS XL, versión 2 (mismo mapa, acabado de calidad)

Copia todo lo que hay debajo de la línea y pégaselo a ChatGPT. Adjunta su entrega anterior
(`assets/3d/imports/2026-10-18_casa_atlas_xl/`, sobre todo `collision_map.json` y `src/generate_casa_atlas_xl.py`).

---

Hola. Tu CASA ATLAS XL v1 ya está integrada en SNIPER DUEL (shooter 1v1 de francotiradores en el navegador, Three.js r128,
PC y iPhone). **La planta, las rutas, las distancias y las colisiones funcionan muy bien y NO deben cambiar.** Lo que falla
es el aspecto: el propietario lo ha jugado y no está contento. Necesito la **versión 2: el mismo mapa con acabado de calidad.**

## 1. Lo que hay que conservar EXACTAMENTE (obligatorio)
- **El mismo `collision_map.json`**: las 98 cajas, los 2 spawns, las zonas y el origen. Las colisiones del juego y del
  servidor salen de ese archivo y ya están probadas (red de bots, líneas de tiro, rutas). Si necesitas cambiar alguna
  caja, **no lo hagas en silencio**: entrégalo en un archivo aparte `collision_changes.json` con cada cambio y su motivo.
- Misma escala (1 unidad = 1 m), +Y arriba, calle hacia +Z, centro de la parcela en (0, 0, 0), suelo jugable a y = 0.
- Mismos muros en el mismo sitio y con el mismo grosor; mismas puertas y ventanas en las mismas posiciones.
- Reglas de las cajas (ya las conoces): todo lo que esté a la altura del cuerpo (0,12–2,0 m) y parezca cobertura debe
  coincidir con una caja (±6 cm). La decoración nueva a la altura del cuerpo **no puede sobresalir más de 0,45 m** de una
  caja existente, salvo decoración baja (≤ 0,66 m) pegada a una pared. Por encima de 2 m (aleros, toldos, faroles,
  cornisas, balcones) puede salir hasta 1,2 m de la fachada.

## 2. Qué falló en la v1 (medido por Claude en el motor real)
- **Texturas casi planas:** el color de cada material varía solo ±4/255; no se ve estuco, ni piedra, ni madera.
- **Mapas de normales exagerados** (desviación 30–48/255): las paredes parecen barro o espuma, no estuco.
- **Geometría de cajas:** 3 300 triángulos para 40 × 32 m. Muros lisos sin marcos, sin contraventanas, sin alféizares,
  sin cornisas ni aleros, puertas como huecos vacíos, interiores vacíos y oscuros.
- **48 texturas PNG de 512 px**: 55 MB de memoria de GPU para un aspecto plano (en móvil eso cuenta).
- Vegetación de tarjetas con poco detalle; el olivo es un tronco recto con una copa en bloques.

## 3. Qué quiero en la v2
**Dirección artística:** villa mediterránea creíble (Andalucía / costa), a la altura de los ojos del jugador (1,62 m), no
para foto aérea. Nada monumental ni de piedra «templo».

**Arquitectura (geometría real, no solo textura):**
- Ventanas con marco, alféizar saliente, rejas de hierro en planta baja y contraventanas de madera (abiertas, pegadas a
  la fachada). El vidrio puede seguir siendo un plano.
- Puertas con marco, umbral y hoja de madera abierta contra la pared (las puertas no se cierran en el juego).
- Cornisa o alero en la línea de tejado; tejado de teja árabe con canal y cumbrera, o azotea con pretil y albardilla.
- Zócalo pintado o de piedra en la base de los muros (máx. 1–2 cm de saliente o, mejor, con su propia geometría
  separada ≥ 2 cm: las capas pintadas pegadas a 3–6 mm de la pared provocan parpadeo a distancia).
- Muro perimetral con albardilla, pilastras y portón de hierro o madera.
- Pérgola con vigas y una parra o buganvilla en tarjetas.
- Garaje con portón seccional o de madera, canalón y bajante.

**Detalles de ambiente (la mayoría por encima de 2 m o pegados a la pared):** farolas de pared, macetas de barro junto
a las paredes, buganvillas, canalones, aire acondicionado, cables, toldos, una moto o carretilla en el garaje (si va a
la altura del cuerpo, con caja nueva en `collision_changes.json`).

**Interior:** techo opaco, suelo de barro cocido o madera, rodapié, puertas interiores con marco, unos pocos muebles con
sus cajas (los que ya hay) y lámparas. **Hornea la oclusión ambiental (AO) y la luz interior** en el color o en un mapa de
oclusión, para que el interior no quede negro con techo puesto.

**Vegetación:** olivos con tronco retorcido y copa de tarjetas bien recortadas (alphaMode MASK), cipreses, setos bajos,
macetas. Sin caja = el jugador y las balas los atraviesan, así que nada de setos que parezcan cobertura.

## 4. Materiales y texturas
- PBR metallic-roughness, base color en sRGB, **factor de color 1,0** (que el color venga de la textura).
- **Texturas escaneadas CC0 de Poly Haven** (indica cada una en `LICENSE_ASSETS.md`). El juego ya usa y aprueba estas,
  así que mejor estas mismas: `white_stucco_02` (estuco), `cobblestone_02` (adoquín), `clay_roof_tiles_02` (teja),
  `distressed_painted_planks` (madera pintada), `rough_pine_door` (puertas). Para el resto elige CC0 de Poly Haven.
- **Mapas de normales suaves** (normalScale ≈ 0,5–1; que se vea relieve, no espuma). Normal OpenGL (+Y).
- Resolución: **1024 px** como máximo para color y 512 para normal/rugosidad; JPEG para color y rugosidad, PNG solo
  para alfa (vegetación). Reutiliza la misma textura entre piezas: **≤ 25 texturas y ≤ 30 materiales en total.**
- Escala real: un ladrillo, una teja o un adoquín deben tener su tamaño real a 1,62 m de altura.

## 5. Presupuesto de rendimiento (el iPhone manda)
- **≤ 80 000 triángulos** en total (casa + garaje + exterior + vegetación), techo incluido.
- **≤ 30 materiales** (cada material es una llamada de dibujo).
- Si superas 40 000 triángulos, entrega LOD: `<pieza>_LOD0` (completo) y `_LOD1` (sin detalles pequeños, ~40 %).
- Sin Draco, sin meshopt, sin KTX2 (el cargador no los lee). Sin luces ni cámaras dentro del GLB.

## 6. Entrega
1. `models/sd_casa_atlas_xl_v2.glb` y `models/sd_casa_atlas_xl_v2_techo.glb` (techo aparte, como en la v1).
2. El mismo `collision_map.json` de la v1 (sin cambios) y, solo si hace falta, `collision_changes.json`.
3. `CASA_ATLAS_XL_V2.md`: qué has añadido, triángulos y materiales por pieza, texturas con su resolución y licencia, qué
   decoración sobresale y cuánto (para comprobar que no crea coberturas falsas).
4. `LICENSE_ASSETS.md`, `preview/` con 6 vistas a 1,62 m (calle, patio, pérgola, interior con techo, jardín, garaje) y
   el script de Blender (`src/*.py`) que lo genera.

Prioridad si no da tiempo a todo: 1) materiales y texturas reales; 2) ventanas, puertas, cornisas y tejado;
3) interior con techo y luz horneada; 4) vegetación; 5) detalles de ambiente.
