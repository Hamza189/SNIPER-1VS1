# Encargo para ChatGPT — personaje del jugador, rival online y bots (SNIPER DUEL)

Copia todo lo que hay debajo de la línea y pégaselo a ChatGPT (o a Codex). Si puedes, adjunta una captura del soldado
actual en el juego para que vea de qué partimos.

---

Hola. Necesito el **personaje en tercera persona** de SNIPER DUEL, un shooter 1v1 de francotiradores para navegador
(Three.js r128; PC, iPhone y Android). El mismo modelo se usa para **el rival online y los bots**. Ahora mismo es un
muñeco hecho de cajas y cilindros; quiero un soldado creíble, con animaciones fluidas, que siga yendo a 60 FPS en un
iPhone. Claude (otra IA) lo integra, lo valida y lo prueba; el propietario lo aprueba.

## 1. Medidas del juego (obligatorias: el servidor decide los impactos con estas cajas)
Unidades en metros. +Y arriba. **El personaje mira hacia +Z.** Origen entre los pies, a ras de suelo (y = 0).

| Medida | Valor |
|---|---|
| Altura total de pie (coronilla) | **1,80 m** |
| Altura de los ojos de pie | **1,62 m** |
| Altura de los ojos agachado | 1,00 m (todo el cuerpo se escala en vertical × 0,62) |
| Altura de los ojos deslizándose | 0,85 m (× 0,52) |
| Radio de colisión del cuerpo (movimiento) | 0,35 m |

**Zonas de impacto del servidor** (en el sistema local del personaje; el juego las escala en vertical al agacharse):
| Zona | Forma | Centro (y) | Medidas |
|---|---|---|---|
| Cabeza | esfera | y = 1,63 | radio 0,15 (de 1,48 a 1,78) |
| Torso | caja | y = 1,17 | ancho 0,49 · alto 0,62 (de 0,86 a 1,48) · fondo 0,32 |
| Piernas | caja | y = 0,43 | ancho 0,38 · alto 0,86 (de 0 a 0,86) · fondo 0,22 |

**Regla de juego limpio:** lo que se ve debe coincidir con estas zonas. Ninguna parte del cuerpo puede sobresalir más de
**4 cm** de su zona en la pose de pie, al apuntar o al andar (si no, el jugador dispara a algo que el servidor no cuenta).
Excepciones: el arma, los brazos sujetando el arma y equipo fino (≤ 3 cm). La cabeza (casco incluido) cabe en la esfera.
Todas las variantes de aspecto deben tener **la misma silueta y el mismo tamaño** (ninguna ventaja por la apariencia).

## 2. Estilo
Soldado/tirador moderno táctico, realista pero legible a 50–150 m: casco o gorra con cascos de comunicación, chaleco
porta-placas con bolsillos, camiseta o chaqueta técnica, pantalón con rodilleras, botas, guantes. Rostro con pasamontañas
o gafas (sin rasgos de una persona real). Nada de fantasía ni ciencia ficción.
Colores: necesito **3 variantes de textura** del mismo modelo: equipo A (arena/ocre), equipo B (verde oliva/gris oscuro) y
bots (gris/negro). Que el rival se distinga del fondo (fachadas claras, suelo arena) sin colores fluorescentes.

## 3. Formato técnico
- **glTF 2.0 binario (.glb)**, un único `SkinnedMesh` (o 2 como máximo: cuerpo y equipo) con **un esqueleto**.
- Sin Draco, sin meshopt, sin KTX2 (el cargador del juego no los lee). Sin cámaras ni luces.
- **≤ 60 huesos.** Nombres claros y estables (estilo Mixamo vale: `Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`,
  `LeftShoulder`, `LeftArm`, `LeftForeArm`, `LeftHand`, dedos simplificados, `LeftUpLeg`, `LeftLeg`, `LeftFoot`, `LeftToeBase`
  y los mismos a la derecha). Máximo 4 pesos por vértice.
- **Triángulos:** `LOD0` ≤ 10 000, `LOD1` ≤ 4 000, `LOD2` ≤ 1 500 (mismo esqueleto, nodos `personaje_LOD0/1/2`).
- **Materiales:** 1 (o 2 como máximo). Texturas PBR: color (sRGB, JPEG), normal OpenGL (+Y) y ORM (oclusión R, rugosidad G,
  metal B), **1024 px**. Las 3 variantes de color como texturas de color aparte (mismo UV), no como modelos aparte.
- **Puntos de anclaje** (nodos vacíos hijos de los huesos de la mano):
  - `socket_arma_R` en la palma derecha, en el centro de la empuñadura: +Z hacia la boca del cañón, +Y hacia arriba.
  - `socket_arma_L` en la palma izquierda, donde va el guardamanos.
  El juego pone en ellos sus propias armas (rifle de cerrojo HALCÓN R7, pistola VÍBORA 9, escopeta FURIA 12, navaja).
  No incluyas armas en el modelo; si quieres, entrega aparte un rifle de referencia solo para las vistas previas.

## 4. Animaciones (en el mismo GLB, sin desplazamiento de la raíz: el juego mueve al personaje)
Nombres exactos, 30 fps, en bucle las que lo indican. Arma principal a dos manos salvo donde se dice:
| Nombre | Bucle | Notas |
|---|---|---|
| `idle_rifle` | sí | de pie, rifle en guardia baja |
| `aim_rifle` | sí | apuntando con el rifle al hombro (la cara en la mira) |
| `aim_up`, `aim_down` | no (1 fotograma) | la pose de apuntar mirando +60° y −60°: el juego mezcla según hacia dónde mira |
| `walk_fwd`, `walk_back`, `walk_left`, `walk_right` | sí | ~4,6 m/s, con el rifle |
| `sprint` | sí | ~7 m/s, rifle bajo cruzado |
| `crouch_idle`, `crouch_walk` | sí | agachado (dentro de la altura agachada) |
| `slide` | sí | deslizándose, una pierna adelante |
| `jump_start`, `jump_air`, `jump_land` | no / sí / no | salto de ~1 m |
| `fire_rifle` | no | retroceso + cerrojo (0,95 s) |
| `reload_rifle` | no | 2,35 s |
| `idle_pistol`, `aim_pistol`, `fire_pistol`, `reload_pistol` | — | pistola a una o dos manos; recarga 1,45 s |
| `fire_shotgun`, `pump_shotgun`, `reload_shell` | no | bombeo y un cartucho (0,32 s cada uno) |
| `knife_slash` | no | ataque con navaja |
| `hit_react` | no | encaje corto al recibir un impacto (≤ 0,3 s) |
| `death_front`, `death_back` | no | caída al morir, termina tumbado y quieto |

Prioridad si no da tiempo a todo: idle/aim/walk/sprint/crouch/death primero; después pistola, escopeta y el resto.

## 5. Entrega
1. `personaje.glb` (LOD0/1/2, esqueleto, animaciones, sockets) y las 3 texturas de color (A, B y bots).
2. `PERSONAJE.md`: medidas reales (altura, ojos), huesos, triángulos por LOD, texturas, lista de animaciones con duración,
   y una tabla de **cuánto sobresale cada parte del cuerpo de su zona de impacto** en pie, apuntando y andando.
3. `preview/`: el personaje de frente, de lado y de espaldas con las 3 cajas de impacto dibujadas encima; y capturas de
   `aim_rifle`, `sprint`, `crouch_idle` y `death_front`.
4. El script de Blender o el `.blend` fuente, y `LICENSE_ASSETS.md` (obra original o CC0 con su origen; nada de modelos
   comprados ni de licencia dudosa).

---

## Para Claude (integración, cuando llegue)
1. Original intacto a `assets/3d/imports/<fecha>_personaje/`; `node tools/validate-glb.js`.
2. Comprobar con un script que el cuerpo cabe en `core/hitbox.js` (±4 cm) en `idle_rifle`, `aim_rifle`, `walk_fwd`,
   `crouch_idle` y `slide`. Si no cabe, devolverlo con las medidas. **No tocar las cajas del servidor** para que encaje.
3. Sustituir `makeSoldier`/`animateSoldier` (bots y `RemotePlayer`) tras bandera `?pj=2`: `AnimationMixer`, mezcla de
   `aim_up/aim_down` por la inclinación, armas de `viewmodels.glb` en los sockets, LOD por distancia y por perfil.
4. Medir llamadas de dibujo, triángulos y ms de CPU de las animaciones con 3 bots; `aim.browser`, `online.browser`,
   `fauna`/`cover` y `npm test`; capturas antes/después. Por defecto solo cuando el propietario lo apruebe.

---

## Aclaraciones (19-10-2026, preguntas de Codex respondidas por Claude con el propietario)
1. **Altura:** prevalece la esfera de la cabeza. Cabeza y casco **dentro de la esfera: máximo 1,78 m**. El 1,80 m del
   §1 es la altura del cilindro de movimiento, no la del modelo.
2. **Agachado y deslizamiento:** los clips `crouch_*` y `slide` ya llevan la altura final; Claude quita el escalado
   externo (×0,62 / ×0,52) solo para este modelo. En esas posturas el cuerpo debe caber en las cajas del servidor
   (ancho y fondo iguales que de pie; la esfera de la cabeza mantiene radio 0,15):
   | Postura | Cabeza (centro) | Torso | Piernas |
   |---|---|---|---|
   | De pie (ojos 1,62) | 1,63 m | 0,86 – 1,48 m | 0 – 0,86 m |
   | Agachado (ojos 1,00) | 1,006 m | 0,53 – 0,91 m | 0 – 0,53 m |
   | Deslizándose (ojos 0,85) | 0,855 m | 0,45 – 0,78 m | 0 – 0,45 m |
