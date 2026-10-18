# SNIPER DUEL — registro de decisiones, cambios y tareas

Registro duradero que mantiene Claude Code. Una entrada por sesión o por decisión, la más reciente arriba.
Cada entrada dice qué se decidió o cambió, quién lo decidió, y el estado real
(IMPLEMENTADO · PROBADO EN NAVEGADOR · PROBADO ONLINE · PENDIENTE DE VALIDACIÓN EN IPHONE).
Las decisiones anteriores al 18-10-2026 están resumidas en `SNIPER_DUEL_MASTER_CONTEXT.md` §4.

## Tareas abiertas (resumen vivo; detalle en `SNIPER_DUEL_ROADMAP.md`)
| Tarea | Quién la desbloquea | Estado |
|---|---|---|
| Rayas en las paredes en el PC del propietario | Propietario: captura + línea de diagnóstico + `?pueblo=3&sombras=0` | ESPERANDO |
| CASA ATLAS: recorrido, bots, 1v1 real, aprobación, techo | Propietario | ESPERANDO |
| FPS en iPhone/Samsung (PUEBLO 3.0, CASA ATLAS) | Propietario | ESPERANDO |
| Suelo del Samsung, fachadas P1 | Propietario y su pareja | ESPERANDO |
| Reconexión con dos iPhone, partidas de 10–15 min | Propietario | ESPERANDO |
| Instalar `gh` en el PC | Propietario (decide) | PENDIENTE |
| `.gitattributes` para fines de línea | Propietario (aprobar) | PROPUESTA |
| Armas clásicas como aspectos | Propietario (aprobar inicio) | SIN EMPEZAR |
| Evolución tecnológica T0–T6 (`SNIPER_DUEL_TECHNOLOGY_EVOLUTION.md`) | Propietario (revisar el informe y aprobar fases) | INFORME ENTREGADO |

## 18-10-2026 — Libertad tecnológica: auditoría e informe (sesión 1, segunda parte)
- **Decisión (propietario):** se autoriza proponer otros lenguajes y herramientas si se demuestra la mejora; nada de
  migrar antes de revisar el informe. Reglas copiadas en `CLAUDE.md` › «Decisiones técnicas».
- **Hecho:** `SNIPER_DUEL_TECHNOLOGY_EVOLUTION.md`. Medidas: tick de jugador 4,4–4,9 µs (PUEBLO) en Node; fotograma en
  la GTX 1050 Ti real ~3 ms de CPU, ~2 ms de ellos en `renderer.render` (131–217 llamadas); ~183 MB estimados de
  texturas en GPU en PUEBLO 3.0 ALTO; descarga 13,5 MB.
- **Recomendación:** T0 (higiene) y T1 (comprobación de tipos con `tsc --noEmit`) primero; T3 (texturas KTX2) como
  experimento que necesita el iPhone y el Samsung del propietario. Rust/WASM no está justificado hoy.
- **Publicación:** el commit `f408962` está publicado; Pages y «Prueba pública online» en verde.

## 18-10-2026 — Migración a Claude Code (sesión 1)
- **Hecho:** incorporación completa; informe en `SNIPER_DUEL_ONBOARDING_2026-10-18.md`.
- **Cambio en el repositorio:** `build.py` lee y escribe en UTF-8 (antes fallaba en Windows). Mismo hash de compilación
  (`0816092dae`). IMPLEMENTADO · `npm test` 936/936.
- **Cambios solo en el PC (fuera del repositorio):** `python3.exe` junto a Python 3.14; `playwright@1.56.0` + Chromium y
  `ws` con `npm install --no-save`.
- **Documentación:** conectores reales de Claude Code anotados en `SNIPER_DUEL_CONNECTIONS.md`; `CLAUDE.md` con notas de
  Windows y la obligación de mantener este registro.
- **Decisión (propietario):** no empezar todavía ninguna fase nueva ni reconstrucción; primero entender y confirmar el
  estado real. Publicar solo con su autorización.
- **Comprobado:** documentación y código coinciden (armas, reglas, mapas, banderas); `core/mapdata.js` se regenera
  idéntico; Pages y servidor público responden; Actions en verde.
