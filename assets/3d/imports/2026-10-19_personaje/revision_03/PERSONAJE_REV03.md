# PERSONAJE — revisión 03 (Claude, 19/20-10-2026)

**IMPLEMENTADO · PROBADO EN NAVEGADOR (visor Three.js r128 y el juego con `?pj=2`, WebGL por software) ·
PENDIENTE DE VALIDACIÓN EN IPHONE · NO ES EL PERSONAJE POR DEFECTO (lo decide el propietario).**

La revisión 01 de Codex (procedural, 5 328 triángulos, piezas rígidas) fue rechazada por el propietario: «parecen
muñecos». La 02 (Codex, sobre MakeHuman) quedó a medias. Esta revisión se ha rehecho entera por código con otra técnica:
cuerpo humano real, ropa con volumen y pliegues, pesos suaves y animación con cinemática inversa.

## Cómo está hecho
1. **Cuerpo** (`src/body.py`): malla de MakeHuman (CC0, `../revision_02/sources/base.obj`) con sus targets CC0 de hombre
   joven atlético (`sources/targets/`, procedencia y SHA-256 en `sources/provenance.json`). Escala: ojos a 1,62 m;
   la cabeza queda centrada en la esfera de impacto. Esqueleto provisional con dedos para recolocar: piernas juntas
   (tobillos a ±10,5 cm), puntas algo abiertas y **puños cerrados en empuñadura** (el modelo final no tiene huesos de
   dedos: siempre sujeta un arma). UV del cuerpo: las de MakeHuman.
2. **Ropa** (`src/clothing.py`): la superficie se alisa (fuera pezones, ombligo, glúteos marcados) y se ensancha por
   prenda a lo largo de la normal: chaqueta (más holgada en el vientre y la espalda baja), mangas, pantalón cargo que
   **cae recto desde la rodilla** (no se mete en la pantorrilla), guantes y braga de cuello sobre boca y nariz
   (sin rasgos de nadie). Los pies se borran: los tapan las botas.
3. **Equipo** (`src/gear.py`): piezas con espesor pegadas a la superficie por rayos — bolsillos de pecho y bajos con
   solapa, tirantes de la referencia, cuello subido, bajo y puños, cinturón con hebilla, funda, parche del hombro,
   bolsillos cargo con solapa, rodilleras con dos correas, botas (horma, caña y suela de 2,2 cm), casco alto recortado
   sobre las orejas con carriles y montura, cascos de comunicación y gafas con cristal ahumado. Todo lo de la cabeza
   se recorta a la esfera de impacto (radio 14,85 cm).
4. **Esqueleto y LOD** (`src/build_model.py`): 26 huesos (mismos nombres que la rev. 01), pesos automáticos por calor
   en el cuerpo y transferidos al equipo; casco y gafas solo a la cabeza. LOD0/1/2 por reducción con simetría.
5. **Horneados** (Cycles): normales desde una versión subdividida con **pliegues** (`src/folds.py`: codos, puños,
   sobre el cinturón, axilas, entrepierna, rodillas, pantalón recogido sobre la bota y un ondulado general), oclusión,
   posición, normal y zona de cada texel.
6. **Texturas** (`src/textures.py`, numpy + Pillow): color de cada tejido o cuero, desteñido, suciedad (más abajo,
   rodillas, codos, culera), desgaste en cantos y pliegues, costuras con pespunte, cremallera, cordones y ojales,
   tacos de la suela, parche, cristal; rugosidad y metal; normal final = pliegues + relieve fino (sarga, costuras…).
   2048 px y 1024 px. Apariencias: **A** arena/ocre, **B** oliva (como la referencia), **bots** gris.
7. **Animación** (`src/anim.py`, `src/clips.py`): cinemática propia — IK de dos huesos en brazos y piernas con polo,
   giro repartido entre antebrazo y muñeca, pies apoyados **sin patinar** a la velocidad del clip con talón→punta, cadera
   que sube y baja y gira con el paso, torso perfilado al apuntar (pie de apoyo del tirador), cabeza estabilizada.
   El arma va en el nodo `arma` (hijo de la clavícula derecha) y las manos se llevan a sus empuñaduras.
8. **GLB** (`src/build_glb.py`): escritor propio glTF 2.0 sin extensiones.

Reproducir (PowerShell, desde la raíz): `& 'assets/3d/imports/2026-10-19_personaje/revision_03/src/run.ps1'`
(una vez antes: `C:\Python314\python.exe …/src/prepare_targets.py`). Visor: `revision_03/viewer.html` con el servidor
estático del proyecto; capturas: `node …/src/capture.js`.

## Medidas
Metros, +Y arriba, +Z delante, origen entre los pies. Altura con casco **1,753 m** (≤ 1,78). Ojos 1,62 m.

| Nodo | Triángulos | Material |
|---|---:|---:|
| personaje_LOD0 | 14 598 | 1 |
| personaje_LOD1 | 5 000 | 1 |
| personaje_LOD2 | 1 500 | 1 |

`personaje.glb` 6,3 MB (texturas 2048 embebidas: color B, normal, ORM; 64 MB en GPU) · `personaje_1k.glb` 3,8 MB
(1024; 16 MB). `color_A`, `color_bots` aparte (el juego carga solo la que usa).

**Huesos (26):** Root, Hips, Spine, Spine1, Spine2, Neck, Head, Eyes, Left/Right Shoulder, Arm, ForeArm, Hand, Thumb,
UpLeg, Leg, Foot, ToeBase. Rotación de reposo identidad. **Nodos extra:** `arma` (+Z cañón, +Y arriba, origen en la
empuñadura), `socket_arma_R` (palma derecha) y `socket_arma_L` (mano de apoyo).

**Agachado y deslizamiento:** sin escalar el modelo por fuera. Dos morph targets (`agachado` = ×1/1,62, `deslizar` =
×0,85/1,62) comprimen el tronco y las piernas hacia sus articulaciones exactamente como las cajas del servidor; brazos
y cabeza no se deforman (solo bajan). Los clips llevan el peso del morph y las traslaciones de los huesos. Es la única
forma de que el cuerpo quepa en esas cajas: unas cuclillas reales sacan las rodillas 30 cm de la caja de piernas.

## Zonas de impacto (`tools/check-character-hitbox.js`, LOD0, 60 Hz; `hitbox.json`)
Cuánto sale cada parte de su zona, en cm. Cabeza: distancia radial fuera de la esfera. Cuerpo: X / Y / Z fuera de la
caja más cercana (o de la esfera, para el cuello). Brazos y manos exentos (sujetan el arma). En `walk_*`, `sprint` y
`crouch_walk` las piernas pueden salir hasta 45 cm solo en el eje del paso (excepción del propietario). Reposo: cabeza
−0,15 (dentro), cuerpo 2,1 / 2,2 / 2,4. **Los tres LOD cumplen** (±4 cm).

| Clip | s | Bucle | Capa | Cabeza | Cuerpo X / Y / Z | Se exige |
|---|---:|:---:|---|---:|---|:---:|
| `idle_rifle` | 4.00 | sí | upper | 1.7 | 3.1 / 3.1 / 3.6 | sí |
| `aim_rifle` | 4.00 | sí | upper | 3.6 | 3.8 / 3.6 / 3.5 | sí |
| `aim_up` | 0 | no | aditiva | 2.2 | 3.3 / 3.3 / 2.4 | no |
| `aim_down` | 0 | no | aditiva | 10.9 | 3.7 / 3.7 / 2.5 | no |
| `walk_fwd` | 0.66 | sí | lower | 3.1 | 3.7 / 3.3 / 3.6 | sí |
| `walk_back` | 0.66 | sí | lower | 3.0 | 3.7 / 3.3 / 3.6 | sí |
| `walk_left` | 0.66 | sí | lower | 2.4 | 3.2 / 3.2 / 2.9 | sí |
| `walk_right` | 0.66 | sí | lower | 2.4 | 3.2 / 3.2 / 2.9 | sí |
| `sprint` | 0.62 | sí | entero | 3.7 | 3.8 / 3.8 / 2.9 | sí |
| `crouch_idle` | 4.00 | sí | lower | 3.3 | 3.0 / 3.1 / 3.0 | sí |
| `crouch_walk` | 0.70 | sí | lower | 2.4 | 3.1 / 2.4 / 3.6 | sí |
| `slide` | 1.00 | sí | entero | 0 | 2.7 / 2.3 / 3.9 | sí |
| `jump_start` | 0.30 | no | lower | 11.0 | 4.2 / 4.3 / 11.7 | no |
| `jump_air` | 0.60 | sí | lower | 0.8 | 3.8 / 9.8 / 20.4 | no |
| `jump_land` | 0.30 | no | lower | 12.8 | 4.3 / 4.8 / 6.8 | no |
| `fire_rifle` | 0.95 | no | upper | 3.2 | 3.4 / 3.5 / 3.4 | no |
| `reload_rifle` | 2.35 | no | upper | 4.0 | 3.6 / 3.6 / 3.2 | no |
| `idle_pistol` | 4.00 | sí | upper | 1.4 | 3.1 / 3.0 / 2.4 | sí |
| `aim_pistol` | 4.00 | sí | upper | 1.2 | 2.9 / 2.9 / 2.4 | sí |
| `fire_pistol` | 0.22 | no | upper | 1.1 | 2.7 / 2.5 / 2.4 | no |
| `reload_pistol` | 1.45 | no | upper | 2.8 | 3.1 / 2.9 / 2.4 | no |
| `fire_shotgun` | 0.25 | no | upper | 3.5 | 3.2 / 3.1 / 4.6 | no |
| `pump_shotgun` | 0.32 | no | upper | 3.5 | 3.2 / 3.1 / 3.9 | no |
| `reload_shell` | 0.32 | no | upper | 3.4 | 3.4 / 3.1 / 2.6 | no |
| `knife_slash` | 0.45 | no | upper | 2.5 | 3.5 / 3.5 / 2.7 | no |
| `idle_knife` | 4.00 | sí | upper | 2.8 | 3.9 / 3.9 / 2.9 | no |
| `hit_react` | 0.26 | no | upper | 1.2 | 2.8 / 2.7 / 3.8 | no |
| `death_front` / `death_back` | 1.25 | no | entero | — | (tumbado) | no |

Velocidades sin patinar (el juego ajusta la fase a la velocidad real): adelante/atrás 4,49 m/s, lateral 2,75, esprint
6,77, agachado 2,21. El salto de ~1 m lo hace el juego (`jump_air` no sube la raíz). La inclinación (`aim_up/down`,
±60°) se aplica como capa aditiva sobre `aim_rifle`.

## Límites conocidos (para la revisión del propietario)
- Agachado y deslizamiento están **comprimidos en vertical** (morph) porque así son las cajas del servidor; no son unas
  cuclillas anatómicas. Cambiar eso exige cambiar las cajas (regla competitiva: decisión del propietario).
- Dedos fijos en empuñadura (sin huesos de dedos); la mano izquierda apoya delante del cargador, no en la punta del
  guardamanos (el brazo no llega con las proporciones reales).
- Brazos y armas no cuentan para los impactos (igual que antes).
- Cara cubierta (braga de cuello y gafas): no hay rostro de nadie.
- Probado con WebGL por software (aspecto, llamadas, triángulos). **Falta medir FPS en iPhone, Samsung y la GTX.**

## Licencia
Ver `LICENSE_ASSETS.md`: MakeHuman (malla base y targets) CC0; todo lo demás, obra propia del proyecto.
