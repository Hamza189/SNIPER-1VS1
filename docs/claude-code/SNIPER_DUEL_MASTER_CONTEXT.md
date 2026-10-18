# SNIPER DUEL — contexto maestro

Exportación del 18-10-2026, hecha por Claude a partir del repositorio (`main` en `cd4eb3b`), la documentación de `docs/`,
los documentos del proyecto «1VS1 SNIPER» de Claude.ai y la conversación de trabajo. Lo que no se ha podido comprobar
está marcado como **NO VERIFICADO**.

## 1. Identidad y objetivos
- **Qué es:** un FPS competitivo de francotiradores para el navegador (PC y móvil, sobre todo iPhone y Android), centrado
  en que disparar y moverse se sientan muy bien. Fantasía: entras → encuentras rival → te mueves → apuntas → disparas →
  ganas o mueres → revancha.
- **Prioridades** (plan original del proyecto): gunplay cuidado (levantar el arma, transición a mira, zoom, respiración,
  sway, retroceso, fogonazo, sonido, impactos, recarga y cerrojo) y movimiento fluido (sprint, slide, salto, agacharse,
  asomarse). Personajes simples. Mapas pequeños. Después del 1v1: 2v2/3v3, ranked, progresión y cosméticos **sin ventaja
  competitiva** (se vende apariencia, nunca estadísticas).
- **Para quién:** jugadores de móvil y PC; el propietario lo juega 1v1 con su pareja desde dos móviles.
- **Prioridades del propietario más recientes:** calidad visual, ambientación y fluidez, sin bajar mucho los FPS.
- **Objetivo económico mencionado:** monetizar pronto (octubre de 2026). Más tarde dijo que de momento no lo publica ni
  lo empaqueta («poco a poco»). No hay monetización implementada.

## 2. Estado del juego (18-10-2026)
| Sistema | Estado |
|---|---|
| HALCÓN R7 (rifle de cerrojo, 5 balas, 600 m/s, caída real) | IMPLEMENTADO |
| VÍBORA 9 (pistola semiautomática, 12) | IMPLEMENTADO |
| FURIA 12 (escopeta de bombeo, 9 perdigones, carga cartucho a cartucho) | IMPLEMENTADO (equilibrio ajustado el 12-10) |
| Navaja táctica (frente 50 / espalda 100, inspección) | IMPLEMENTADO |
| ADS y zoom 4×/8×, aguantar la respiración, sway, retroceso | IMPLEMENTADO |
| Movimiento: sprint, salto, slide, agacharse, asomarse, rampas | IMPLEMENTADO |
| Controles táctiles multitáctiles, MIRA mantener-y-arrastrar o PULSAR, editor de botones | IMPLEMENTADO (MIRA confirmada en iPhone el 10-10) |
| Sensibilidad con mira táctil 0,8 por defecto (antes 1,3) | IMPLEMENTADO (migración de ajustes v3) |
| Duelo contra bots (PUEBLO, ARENA, CASA ATLAS) con «Bots pueden matarte: NO/SÍ» | IMPLEMENTADO |
| Campo de tiro (dianas 20/50/100 m, bots de entrenamiento, diagnóstico de tiro) | IMPLEMENTADO |
| PUEBLO 2.0 / PUEBLO 3.0 (`?pueblo=3` o AJUSTES) | 2.0 por defecto; 3.0 EXPERIMENTAL elegible |
| ARENA DE PRUEBAS | IMPLEMENTADO (mapa por defecto online) |
| CASA ATLAS 1V1 | EXPERIMENTAL (`?casa=1`) |
| 1v1 online privado: salas por código/enlace, lobby, elección de mapa y arma, revancha, reconexión, abandono | IMPLEMENTADO · PROBADO ONLINE (dos móviles reales el 11-10, según el propietario) |
| Servidor autoritativo en Cloudflare | IMPLEMENTADO, desplegado y comprobado por URL pública |
| Ajustes: gráficos, audio por canales, accesibilidad, jugabilidad | IMPLEMENTADO |
| Perfiles BAJO / MEDIO / ALTO / AUTO, límite 30 FPS | IMPLEMENTADO |
| Ratas y vegetación (PUEBLO 3.0) | IMPLEMENTADO · PENDIENTE FPS EN IPHONE |
| Armas clásicas como aspectos | PENDIENTE (modelos guardados, no cargados) |
| 2v2 / 3v3, ranked, cuentas, cosméticos, monetización | PENDIENTE (no empezado) |
| Versiones instalables (.exe, .apk, iPhone) | PENDIENTE (solo preguntado; hoy es PWA «Añadir a pantalla de inicio») |

## 3. Enlaces del proyecto
- Juego: https://hamza189.github.io/SNIPER-1VS1/ (con PUEBLO 3.0: `?pueblo=3`; con CASA ATLAS: `?casa=1&pueblo=3`)
- Repositorio: https://github.com/Hamza189/SNIPER-1VS1 (rama `main`)
- Servidor: https://sniper-duel.hamzaimtiaz2015.workers.dev (está en `server.json`)
- Más en `SNIPER_DUEL_CONNECTIONS.md`.

## 4. Decisiones importantes (por fecha)
- 09-10: simulación compartida cliente/servidor en `core/`; servidor autoritativo en Cloudflare Workers + Durable Objects
  (plan gratuito); ARENA como mapa 1v1 por defecto; pistola y escopeta añadidas.
- 10-10: armas y brazos modelados por código con Blender (diseño propio, sin licencias); MIRA por Touch Events (fallaba en
  iOS con Pointer Events); AJUSTES por pestañas; sin ayuda de puntería.
- 11-10: renovación gráfica (ACES, PUEBLO 2.0); PUEBLO 3.0 como slice tras bandera; contrato de assets 3D para ChatGPT.
- 12-10: sin límite de MB para assets; caliza v3b por defecto en 3.0; sombra por texels enteros (rayas al moverse);
  escopeta reequilibrada; mira táctil 1,3 → 0,8 propuesta.
- 17-10: PUEBLO 3.0 elegible en AJUSTES; adoquín de Poly Haven por defecto en 3.0; «Bots pueden matarte» en el duelo;
  armas modernas se quedan (opción 1), clásicas guardadas para aspectos futuros; rata y vegetación; kit P1 de ChatGPT
  rechazado.
- 18-10: CASA ATLAS integrado como mapa experimental en cliente y servidor.

## 5. Problemas abiertos y cosas no verificadas
- **Rayas en las paredes en el PC del propietario** (las sigue viendo el 18-10). Arreglos aplicados el 12-10 y el 17-10
  (sombra por texels, autosombra, fundido). En el navegador integrado de Claude con su misma GPU (GTX 1050 Ti, ANGLE
  D3D11) no se reprodujeron. Pendiente: captura suya + línea de diagnóstico de AJUSTES › GRÁFICOS (dice la GPU que usa
  su Chrome: en un portátil con Optimus podría ser la Intel) + probar `?pueblo=3&sombras=0` para saber si son sombras.
- **FPS reales en iPhone** de PUEBLO 3.0 (con E10, ratas, plantas) y de CASA ATLAS: NO VERIFICADO.
- **Samsung**: suelo gris en ALTO (probablemente el enlace perdió `?pueblo=3`); NO VERIFICADO tras la opción de AJUSTES.
- **1v1 en CASA ATLAS entre dos dispositivos reales**: pendiente (probado con dos navegadores y servidor local).
- Reconexión desde segundo plano con dos iPhone reales; partidas largas (calentamiento, FPS a 10–15 min): pendientes.
- Pruebas online en navegador intermitentes en máquinas lentas (2 núcleos, WebGL por software); en CI pasan.
- Sentry no configurado (no hay DSN): los errores se ven en el panel F3.

## 6. Dónde está cada cosa
- Instrucciones permanentes: `CLAUDE.md` (raíz).
- Entrada para continuar: `docs/claude-code/SNIPER_DUEL_HANDOFF.md`.
- Arquitectura: `docs/claude-code/SNIPER_DUEL_TECHNICAL_ARCHITECTURE.md`.
- Mapas y assets: `docs/claude-code/SNIPER_DUEL_ASSETS_AND_MAPS.md` y `docs/ASSETS-3D.md`.
- Conexiones: `docs/claude-code/SNIPER_DUEL_CONNECTIONS.md`.
- Hoja de ruta: `docs/claude-code/SNIPER_DUEL_ROADMAP.md`.
- Online, protocolo, precisión, pruebas manuales: `docs/ONLINE.md`, `docs/PROTOCOLO.md`, `docs/PRECISION.md`,
  `docs/PRUEBAS-Y-AJUSTES.md`, `docs/PUEBLO-3.md`, `docs/ETAPA-D-AUDITORIA.md`.
