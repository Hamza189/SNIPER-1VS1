# Street Rat — Poly Haven (CC0)

- **Fuente:** https://polyhaven.com/a/street_rat
- **Autor:** Sean Buckley (Poly Haven)
- **Licencia:** CC0 (dominio público): uso comercial permitido, sin atribución obligatoria.
- **Medidas:** 32 × 148 × 34 mm, de la nariz a la punta de la cola. En el juego se escala × 2,43 (unos 36 cm, una rata de calle).
- **Archivo `.blend`:** se guarda aquí. Las texturas 4K no se guardan (unos 50 MB); se descargan de Poly Haven.
- **Rig:** el `.blend` no tiene esqueleto ni animaciones, pero conserva los pesos del rig Rigify original (grupos `DEF-*`).
  - `tools/fauna/rat_rig.py` reconstruye un esqueleto de 19 huesos sobre esos pesos y exporta `assets/3d/fauna/rat.glb` con skinning.
  - Sin pelo: el pelo son partículas de Blender, que no se pueden exportar, y la textura ya lleva el color del pelaje.
- **Texturas del juego:** `tools/fauna/rat_textures.py` → `assets/tex/rat_c.jpg` (1024), `rat_n.jpg` y `rat_r.jpg` (512).
- **Animación:** procedural en `client/rats.js`.
