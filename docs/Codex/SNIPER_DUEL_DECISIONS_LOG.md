# Registro de decisiones de Codex

El registro histórico está en ../claude-code/SNIPER_DUEL_DECISIONS_LOG.md.

## 19-10-2026 — Menú de PC sin desplazamiento
- IMPLEMENTADO · PROBADO EN NAVEGADOR: controles en dos columnas y título adaptado al alto de la ventana; Campo de tiro oculta la descripción para conservar espacio.
- Verificación de maquetación en Chrome, Duelo y Campo de tiro: 1536×775, 1366×657, 1280×720, 1920×969 y 1440×789 sin desbordamiento vertical. Captura local: build/menu-desktop.png (HTML sin ejecutar el juego; no es una prueba de render 3D).
- mobile.test 74/74; touch.smoke.test 82/82. No se ha repetido npm test completo para este ajuste CSS.
- Pendiente: aprobación visual del propietario y publicación. Se conserva el trabajo independiente de CASA ATLAS.
