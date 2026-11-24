# PUEBLO 3.1 — el pueblo entero en 3.0, 8 casas habitables y la fuente nueva (14-11-2026)

> **24-11-2026:** `?sur=0` y el pueblo de antes se quitaron: PUEBLO es siempre el 4.0 (`docs/LANZAMIENTO.md`, Fase 3).

Petición del propietario (14-11): «mejora el mapa PUEBLO 3.0 mucho más, revisa cada textura, edificio, raya, todo,
mejora fluidez, integra estas casas y pásame un .glb, haz más edificios habitables… y mejórame la fuente del medio, el
agua parece de Minecraft». Hecho en la rama local `pueblo-mejoras` (encima de `casas-habitables`), **sin push y sin
tocar `main`**. Se entrega como paquete para Claude Code.

Estado: **IMPLEMENTADO · PRUEBAS EN VERDE (ver abajo) · SIN PUBLICAR · PENDIENTE DE VALIDACIÓN EN IPHONE/PC/ANDROID**.

## 1. Qué cambia
| Parte | Antes | Ahora | Bandera para ver lo de antes |
|---|---|---|---|
| Mitad sur (P3-5) | PUEBLO 2.0: arena, edificios grises, sin pueblo de fuera al sur | PUEBLO 3.0: familias para los 3 edificios que quedaban, calle sur de adoquín con su cuneta y bordillos, aceras alrededor de E10, tierra con manchas, sacos → jardineras con naranjos, postes → farolas, pueblo de fuera también al sur y en la mitad sur de los lados (versión ligera), dientes de león y hierba también al sur (un 40 % menos densos) | `?sur=0` |
| Casas habitables | 3 (rama `casas-habitables`) | 8, con el aspecto de PUEBLO 3.0 (sus materiales y piezas del kit) y **en el mapa del servidor** | `?casas=0` (solo sin conexión) |
| Fuente | agua plana y opaca | agua con ondas, reflejos, transparencia, cáusticas, 9 chorros, espuma, gotas y sonido | `?fuente=0` |
| Carteles de tienda | algunos decían «undefined» (índice negativo en `SHOP_NAMES`) | el nombre que toca | — |
| Suelo bajo los edificios | una losa de acera debajo de cada edificio (no se veía; se dibujaba igual) y hierbajos del suelo dentro de los edificios | un anillo de acera alrededor; nada dentro | — |

Familias del sur (`SDTown3.SOUTH_FAMILIES`): COMERCIO en `[-31,-9]` (dos escaparates a la calle transversal), TALLER en
`[-9,-31]` (el de la rampa a la azotea; la rampa no cambia) y ENCALADA en `[-2,-43]`. E10 (Casa Oliva) sigue siendo su GLB.
Las calles del sur de PUEBLO 2.0 ya no se dibujan con PUEBLO 3.0.

## 2. Rayas
- Las casas nuevas no proyectan sombra desde sus paredes, sino desde una caja por casa 0,45 m más pequeña, como el resto
  del pueblo desde el 17-10. Así se evita el «acné» de sombra, las rayas que se ven en las GPU reales.
- No hay ninguna «piel» pegada a una pared: el color de dentro va por cara.
- Las piezas que se solapan (marcos, cornisas, sillares) son del mismo material y color, así que no pueden parpadear.
- El suelo de dentro está 3,5 cm por encima de cualquier acera, y la acera ya no pasa por debajo.
- El pueblo de fuera del sur usa el mismo desplazamiento de profundidad que el del norte (el arreglo de las rayas del
  19-10).
- PENDIENTE: confirmarlo en el PC del propietario (GTX 1050 Ti), porque el entorno de pruebas no reproduce los fallos de
  precisión de las GPU.

## 3. Texturas
Se revisaron las de PUEBLO 3.0:
- color a 512 px y normal/rugosidad a 256 px;
- filtrado anisótropo ×4 en ALTO;
- adoquín CC0 de 2K en ALTO.

No se han subido de resolución: la memoria de texturas es lo que cerraba Safari en el iPhone
(`docs/RENDIMIENTO-IPHONE.md`), y pasar los edificios a 1K serían unos +120 MB de GPU. Las casas y la fuente usan
**las mismas texturas** que ya estaban cargadas: 0 MB nuevos, salvo una copia del azulejo para el fondo de la fuente.

## 4. Fluidez (medido, no supuesto)
Medido con `tools/pueblo-dibujo.js`: partida en PUEBLO, ALTO, 932×430 a 2× (la pantalla del iPhone), la cámara dando una
vuelta en la plaza. Son las llamadas de dibujo y los triángulos medios por fotograma. Es WebGL por software: los números
son exactos, el tiempo no es el del móvil.

| Versión | Llamadas | Triángulos |
|---|---|---|
| `main` (publicado, con PUEBLO 3.0 al norte) | 210 | 335 mil |
| Primera versión de esta rama | 241 | 507 mil |
| Con pueblo de fuera del sur ligero, contraventanas ligeras arriba y flora del sur más clara | 237 | 458 mil |
| **Final**: las piezas del kit partidas en norte y sur, para que la cámara no dibuje la mitad que tiene detrás | **264** | **372 mil** |

El pueblo entero en 3.0, 8 casas y la fuente cuestan +11 % de triángulos y +54 llamadas respecto a `main`.

Referencia: el iPhone 15 Pro Max iba a 60 FPS con 184–249 llamadas y 355–401 mil triángulos (03-11). PENDIENTE: MEDIR
RENDIMIENTO en el iPhone con esta versión. Si baja de 60:
- `?sur=0` vuelve al norte solo;
- BAJO ya quita el pueblo de fuera del sur.

## 5. GLB
`tools/exportar-glb.js CARPETA` → `casas-habitables.glb` (las 8 casas, cada una en su grupo, con sus piezas del kit),
`fuente.glb` (la fuente con el agua, quieta) y `pueblo3.glb` (todo el pueblo como se ve). Son para verlos en Blender o en
un visor: el juego no los carga.

## 6. Pruebas
Ver `docs/claude-code/PUEBLO31_PARA_CLAUDE_CODE.md` (lista y resultados).
