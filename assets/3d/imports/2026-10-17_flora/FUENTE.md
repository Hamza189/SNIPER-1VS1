# Vegetación de PUEBLO 3.0 — Poly Haven (CC0)

| Modelo | Fuente | Autores | Licencia |
|---|---|---|---|
| Diente de león | https://polyhaven.com/a/dandelion_01 | Rob Tuytel, Rico Cilliers | CC0 |
| Hierba | https://polyhaven.com/a/grass_medium_02 | Rico Cilliers | CC0 |

Los archivos `.blend` y las texturas 4K no se guardan en el repositorio: pesan unos 70 MB y se descargan de Poly Haven.

## Cómo se convierten

**Dientes de león**
- `tools/flora/flora_export.py` toma sus propios niveles LOD2 y LOD3 y los exporta a `assets/3d/flora/dandelion.glb`. El juego usa el LOD3, de 140 a 265 triángulos por planta.
- `tools/flora/flora_textures.py` genera el color con la transparencia en `assets/tex/flora_dandelion_{1024,512}.png`.

**Hierba**
- **Problema:** cada mata son hojas sueltas, cada una con su propia geometría, unos 2 500 triángulos por mata. Simplificada a ~470 triángulos pierde la mayoría de las hojas y deja unas pajas; además, 505 matas sumaban 230 000 triángulos.
- **Solución:** tarjetas, la técnica habitual en juegos para móvil.
  - `tools/flora/grass_cards.py` renderiza en Blender (Cycles) cada mata completa, con todas sus hojas y la textura 4K original, vista de lado y sin fondo.
  - `tools/flora/grass_atlas.py` las junta en `assets/tex/flora_grasscards_{1024,512}.png`, con 4 matas, en verde y en seca, y en `assets/3d/flora/grass_cards.json`, con el tamaño y la base de cada una.
  - En el juego cada mata son dos cuadrados cruzados (4 triángulos) con la normal hacia arriba en las dos caras, para que se ilumine como el suelo.
  - El alpha test sube la opacidad con el nivel de mipmap, para que las hojas finas no desaparezcan de lejos.
