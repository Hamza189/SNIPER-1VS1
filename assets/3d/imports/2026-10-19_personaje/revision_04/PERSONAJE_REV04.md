# Personaje revisión 04 «LINCE» (`?pj=3`)

Empezada por Codex el 25-10-2026 (se quedó sin uso antes de verificarla) y terminada por Claude el mismo día.
`?pj=2` sigue siendo la revisión 03, sin cambios.

## Qué cambia respecto a la revisión 03
- **De Codex:** chaleco porta-placas nuevo (`tailored.carrier`) con portacargadores y cierres de polímero, identificador
  «LINCE», rodilleras como pieza rígida con nervaduras, botas con cordones, costuras/vivos/rejilla de tejido
  (`surface_detail.py`), codos más recogidos al sostener el rifle (`clips.py`), materiales menos brillantes y paletas de
  color retocadas. Mismo esqueleto (26 huesos) y mismos 29 clips.
- **De Claude (para poder publicarla):**
  1. **Gafas:** el visor esférico continuo de Codex sacaba sus esquinas de la esfera de impacto de la cabeza al bajarla
     (4,2–5,0 cm con 4 cm de tolerancia en `idle_rifle`, `aim_rifle`, `walk_*`, `sprint`, `crouch_idle`). Vuelven las
     gafas de la rev. 03 (montura pegada a la cara y cristal continuo). Ahora: cabeza 2,7–3,7 cm, igual o mejor que la
     rev. 03; reposo −0,15 cm (dentro).
  2. **Camuflaje:** Codex lo había quitado (uniforme liso). El propietario lo aprobó en la rev. 03, así que vuelve por
     apariencia (bosque / desierto / digital), sobre las paletas nuevas.

## Medidas (`node test/soldier2.test.js`, `tools/check-character-hitbox.js`, `tools/capture-pj2.js`)
- Contrato GLB: LOD0 ≤ 15 000, LOD1 ≤ 5 000, LOD2 ≤ 1 500 triángulos, 1 material: cumple (2048 y 1024).
- Zonas de impacto: las mismas de siempre (no se tocan); el modelo cabe en los 3 LOD.
- En el juego (PUEBLO, 3 bots): 42 llamadas y 76 200 triángulos, igual que la rev. 03; animación 0,16 ms (rev. 03 0,15 ms).
  Capturas con la misma cámara: `docs/next-level/pj3/` (`pueblo_pj2*.png` = rev. 03, `pueblo_pj3*.png` = LINCE).
- Archivos del juego: `assets/personaje/v4/` (GLB 6,6 MB y 3,9 MB, texturas de color por apariencia).

## Regenerar
`& 'assets/3d/imports/2026-10-19_personaje/revision_04/src/run.ps1'` (Blender en `D:\Blender`, ~6 min). Las imágenes de
`preview/` y `LINCE.blend` son de Codex, de **antes** de los dos arreglos de arriba.
