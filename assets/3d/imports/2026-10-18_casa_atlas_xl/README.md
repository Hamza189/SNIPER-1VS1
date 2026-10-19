# CASA ATLAS XL — ZIP listo para Claude Code

**Entrega:** 2026-10-18. **Mapa 3D real** para el juego SNIPER DUEL, diseñado como mapa **NUEVO** `casaxl`, no sustituto de CASA ATLAS 18×14.

## Descarga / uso

- Para integrar: entrega **todo el ZIP** a Claude Code y dile que lea `INTEGRACION_CLAUDE.md`.
- Modelo principal: `models/sd_casa_atlas_xl.glb`.
- Techo aparte: `models/sd_casa_atlas_xl_techo.glb` (**OBLIGATORIO para no ver cielo dentro en partida**).
- Colisiones/spawns/rutas: `collision_map.json`.
- Memoria y métricas: `CASA_ATLAS_XL.md`, `src/qa_results.json`.
- Licencias: `LICENSE_ASSETS.md`.

## Visor local

Abre terminal en esta carpeta y ejecuta `python -m http.server 8080`. En el navegador abre:

`http://localhost:8080/web/visor_casaxl.html`

Necesita Internet para cargar Three.js r128 del CDN (los GLB se sirven localmente). Tiene controles para mostrar el techo y las colisiones.

## Regeneración independiente

`pip install -r requirements.txt`

`python src/generate_casa_atlas_xl.py`

`python src/qa_casa_xl.py`

Las vistas `.png` de preview son **renderizados locales del objeto 3D real** en VTK usando colores planos para comprobación de geometría; los materiales PBR reales están embebidos en los GLB y se ven en el visor Three.js.

**No se ha jugado este mapa dentro de SNIPER DUEL todavía.** La validación local no reemplaza los tests de Claude, ni la aprobación en iPhone, ni la autorización para desplegar el servidor.
