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
