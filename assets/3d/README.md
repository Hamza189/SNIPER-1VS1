# assets/3d — modelos 3D entregados

El contrato completo está en `docs/ASSETS-3D.md`.

- `imports/` — entregas tal cual llegan (`AAAA-MM-DD_<id>/`). El juego no las carga.
- `models/` — GLB validados e integrados.
- `textures/` — texturas compartidas por varios modelos (solo si no van dentro del GLB).
- `lod/` — LOD en archivos aparte (solo si no caben como nodos `<id>_LOD1/2` del mismo GLB).

Antes de integrar cualquier archivo hay que validarlo:

    node tools/validate-glb.js assets/3d/imports/<entrega>/<id>.glb --box W,D,H
