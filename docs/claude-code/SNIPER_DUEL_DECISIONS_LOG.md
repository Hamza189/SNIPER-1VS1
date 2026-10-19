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
| Instalar `gh` en el PC | — | HECHO (19-10, sesión de Hamza189) |
| `.gitattributes` para fines de línea | Propietario (aprobar) | PROPUESTA |
| CASA ATLAS XL (40×32 m): encargo a ChatGPT en `docs/PROMPT-CHATGPT-CASA-ATLAS-XL.md` | Propietario (pasarlo a ChatGPT) | ESPERANDO ENTREGA |
| PR #1 `next-level/casa-atlas-xl` | — | FUSIONADA 19-10 (`4517b82`); Pages, servidor y prueba pública en verde |
| Proyecto Cloudflare Pages `sniper-1vs1` conectado al repo: su build falla en todos los commits (también en `main`); no es el que publica el juego | Propietario (desconectarlo o decir para qué es) | DETECTADO |
| Comparar `?feel=2` con la sensación actual (PC e iPhone) | Propietario | ESPERANDO |
| Pruebas de rayas (`docs/next-level/PRUEBA_RAYAS_PC.md`) | Propietario | ESPERANDO |
| **Siguiente prioridad (propietario, 19-10): personaje del jugador y bots** — encargo `docs/PROMPT-CHATGPT-PERSONAJE.md` | Propietario (pasarlo a ChatGPT/Codex) | ESPERANDO ENTREGA |
| Gráficos de CASA ATLAS XL, poco a poco (cuando haya uso de Codex) | Propietario | APARCADO |
| Cloudflare Pages `sniper-1vs1` (archivo > 25 MiB) | Propietario | APARCADO |
| Armas clásicas como aspectos | Propietario (aprobar inicio) | SIN EMPEZAR |
| Fallo online: eventos ignorados tras reinicio de sala (Q1) | — | ARREGLADO y PUBLICADO (19-10) |
| CASA ATLAS: bots atascados por red de navegación partida (J1) | — | ARREGLADO y PUBLICADO (19-10) |
| Paquetes de la auditoría (`SNIPER_DUEL_AUDIT_2026-10-18.md` §4) | Propietario (aprobar) | PROPUESTOS |
| Evolución tecnológica T0–T6 (`SNIPER_DUEL_TECHNOLOGY_EVOLUTION.md`) | Propietario (revisar el informe y aprobar fases) | INFORME ENTREGADO |

## 19-10-2026 — NEXT LEVEL: primer paquete publicado (PR #1)
- **Publicado** (`4517b82`, fusión hecha por Claude con `gh` por orden del propietario): CASA ATLAS XL solo contra bots,
  todos los mapas en el menú, arreglos online (eventos tras reinicio) y de bots de CASA, rendimiento (sin tirón inicial,
  −13 MB de texturas, HUD táctil, sombras de soldados), audio, banderas de diagnóstico de rayas y `?feel=2`.
- **Comprobado:** Pages, «Desplegar servidor» y «Prueba pública online» en verde; `version.json` publicado = local
  (`e9a6f2b13e`); `/health` ok; el GLB de XL se sirve. `npm test` 955/955 antes de fusionar.
- **Pendiente:** el propietario compara `?feel=2` y hace las pruebas de rayas; validación en iPhone y Samsung.

## 18-10-2026 — Auditoría con cuatro agentes (sesión 1, tercera parte)
- **Petición (propietario):** cuatro auditorías en paralelo de solo lectura; el agente principal coordina; nada de
  despliegues ni balance sin aprobación; implementaciones paralelas solo en worktrees aislados.
- **Hecho:** `SNIPER_DUEL_AUDIT_2026-10-18.md`. Verificados por el coordinador: fallo de eventos online tras reinicio de
  sala, red de CASA partida (1 861/13/1 nodos), texturas duplicadas, `wScene` sin precompilar, capas de pared a 3–6 mm,
  fundido de sombra con normal perturbada, zonas de impacto offline distintas.
- **Decisión de método:** `src/page.html` lo tocan casi todos los arreglos → cambios del cliente en serie; solo red y CI
  en paralelo.

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
