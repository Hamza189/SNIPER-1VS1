# SNIPER DUEL — documento de entrada para Claude Code

Si acabas de llegar al repositorio, lee esto primero (5 minutos) y luego `CLAUDE.md`.

## 1. Situación a 18-10-2026
- `main` está estable, publicado y con CI en verde (último commit de código: `cd4eb3b`).
- El juego funciona en PC y móvil: duelo contra bots, campo de tiro y 1v1 online autoritativo.
- Lo último hecho: CASA ATLAS 1V1, un mapa experimental de ChatGPT (`?casa=1`), integrado en cliente y servidor con
  pruebas propias. Pendiente de que el propietario lo pruebe y lo apruebe.
- Lo último que reportó el propietario: en su PC «se siguen viendo las rayas». No reproducido; se le pidió captura y la
  línea de diagnóstico, y probar `?pueblo=3&sombras=0`.

- 18-10 (tarde): migración a Claude Code hecha y verificada. Informe: `SNIPER_DUEL_ONBOARDING_2026-10-18.md`. Registro
  vivo de decisiones y tareas: `SNIPER_DUEL_DECISIONS_LOG.md` (léelo justo después de este documento).

## 2. Primeros pasos en una sesión nueva
```
git pull
python3 build.py
node test/core.test.js && node test/room.test.js && node test/casa.test.js   # rápidas (sin navegador)
npx playwright install chromium   # si faltan las de navegador
npm test                          # todo (tarda)
```
Antes de cambiar algo: lee el archivo entero que vas a tocar y busca su prueba en `test/`.

## 3. Flujo de trabajo para cada cambio
1. Leer el código y los docs relevantes (`docs/claude-code/*`, `docs/ASSETS-3D.md`).
2. Hacer el cambio detrás de una bandera de URL si es visual o experimental.
3. Si toca un mapa: `node tools/export-map.js` y comprobar que PUEBLO/ARENA no cambian (comparar `core/mapdata.js`).
4. `python3 build.py`, pruebas afectadas y luego `npm test`.
5. Capturas antes/después con `tools/capture-scenes.js` si es visual; medir llamadas/triángulos.
6. Commit pequeño en español con el estado real; `git push origin main`.
7. Verificar: `gh run list` (Pages, «Desplegar servidor» si tocó `core/`/`server/`, «Prueba pública online») y
   `curl …/version.json` hasta que coincida con el local.
8. Contar al propietario qué cambió, el enlace para probar y qué falta validar en su iPhone.

## 4. Volver a una versión estable
- `git revert <commit>` + `git push` republica la página y, si hace falta, el servidor.
- Solo el servidor y con prisa: panel de Cloudflare → `sniper-duel` → Implementaciones → Revertir (lo hace el
  propietario).
- Estable conocido = commit con «Desplegar servidor» y «Prueba pública online» en verde.

## 5. Mapa de la documentación
| Documento | Para qué |
|---|---|
| `CLAUDE.md` | Reglas permanentes |
| `docs/claude-code/SNIPER_DUEL_DECISIONS_LOG.md` | Registro duradero de decisiones, cambios y tareas abiertas |
| `docs/claude-code/SNIPER_DUEL_ONBOARDING_2026-10-18.md` | Informe de incorporación de Claude Code |
| `docs/claude-code/SNIPER_DUEL_AUDIT_2026-10-18.md` | Auditoría de rendimiento, gráficos, jugabilidad y red, con paquetes de trabajo |
| `docs/claude-code/SNIPER_DUEL_TECHNOLOGY_EVOLUTION.md` | Auditoría de lenguajes y plan de evolución tecnológica (T0–T6) |
| `docs/claude-code/SNIPER_DUEL_MASTER_CONTEXT.md` | Qué es, estado de cada sistema, decisiones, problemas abiertos |
| `docs/claude-code/SNIPER_DUEL_TECHNICAL_ARCHITECTURE.md` | Código, archivos, render, red, banderas, pruebas |
| `docs/claude-code/SNIPER_DUEL_ASSETS_AND_MAPS.md` | Mapas, modelos aceptados/rechazados, reglas de colisión |
| `docs/claude-code/SNIPER_DUEL_CONNECTIONS.md` | GitHub, Pages, Actions, Cloudflare, herramientas |
| `docs/claude-code/SNIPER_DUEL_ROADMAP.md` | Hecho, pendiente y prioridades |
| `docs/ASSETS-3D.md` | Contrato de assets y cada entrega con medidas (§17 = CASA ATLAS) |
| `docs/ONLINE.md`, `docs/PROTOCOLO.md` | Online: uso, fallos, protocolo, coste, reversión |
| `docs/PRECISION.md`, `docs/PRUEBAS-Y-AJUSTES.md`, `docs/PUEBLO-3.md` | Puntería, pruebas manuales, PUEBLO 3.0 |
| `docs/GAMEFEEL.md`, `docs/AJUSTES.md` | GAME FEEL 3.0 (movimiento TÁCTICO, transiciones de animación, visibilidad y contorno rojo/azul, medidas por partes del fotograma) y los ajustes del jugador |
| `docs/ETAPA-D-AUDITORIA.md`, `docs/ETAPA-D-REQUISITOS.md` | Auditoría y requisitos originales del online |
| `docs/PROMPT-CHATGPT-*.md` | Instrucciones que se dieron a ChatGPT para los assets |

## 6. Información que falta (para completar la migración)
- Conversaciones antiguas de Claude.ai y de ChatGPT: no están en el repositorio; lo importante se resumió aquí y en
  `docs/`. Los vídeos y capturas del propietario no se guardaron en el repositorio.
- Panel de Cloudflare y secretos: solo los tiene el propietario.
- Validaciones reales en iPhone/Samsung listadas en el roadmap.
