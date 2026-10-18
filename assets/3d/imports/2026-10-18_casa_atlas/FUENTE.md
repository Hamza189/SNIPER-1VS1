# CASA ATLAS 1V1 — entrega original de ChatGPT (18-10-2026)

Copia sin modificar de lo recibido (paquete `SD_APARTAMENTO_1V1` del PC del propietario + adjuntos del chat).
SHA-256 del GLB: 7d5623620301292ebbb2d3e01b274a16c04692a8f56e459417eb3d544d4d5b92 · techo: be7e4cd9… · collision_map.json: c1543338…

- Licencia: geometría, código y texturas procedimentales propias de la entrega (CC0 equivalente); estuco `beige_wall_001`
  de Poly Haven (CC0). Ver `LICENSE_ASSETS.md`.
- Lo que usa el juego está en `assets/maps/casa_atlas/`:
  - `casa_atlas.glb` = este GLB con las 14 imágenes PNG pasadas a JPEG q90 (`tools/weapons_classic/repack_glb.py`):
    7,4 MB → 1,8 MB. Geometría, materiales, UV y nombres intactos.
  - `casa_atlas_techo.glb` = el techo opcional, igual (256 → 56 KB). Solo con `&techo=1`.
  - `collision_map.json` = copia exacta; `collision_fixes.json` = cajas añadidas por Claude (no se toca el original).
- Validación: `tools/casa/validate_casa.py` (cortes del GLB contra las cajas), `tools/casa/components.py` (piezas sin caja),
  `test/casa.test.js`, `test/casa.browser.test.js`, `test/casa.online.browser.test.js`. Informe: docs/ASSETS-3D.md §17.
