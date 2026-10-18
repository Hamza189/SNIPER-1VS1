# SNIPER DUEL — informe de incorporación de Claude Code (18-10-2026)

Primera sesión de Claude Code en el PC Windows del propietario, sobre un clon recién hecho de `main` (`0a17017`).
Todo lo que pone «MEDIDO» o «COMPROBADO» se ha ejecutado o leído en esta sesión; lo demás se indica.

## 1. Estado del repositorio (COMPROBADO)
- Rama `main`, al día con `origin/main`, sin cambios locales al empezar. 87 commits; último de código `cd4eb3b`, último
  total `0a17017` (documentación).
- `python3 build.py` reproduce exactamente lo publicado: mismo `hash` de contenido (`0816092dae`) que
  `https://hamza189.github.io/SNIPER-1VS1/version.json`. Solo cambia el campo `rev` (commit de compilación), como es normal.
- `node tools/export-map.js` regenera `core/mapdata.js` **idéntico** al del repositorio (pueblo 2 404 triángulos / 81
  cajas; arena 482 / 35; casa 950 / 102): cliente y servidor están sincronizados.
- `npm test` completo en este PC: **936 comprobaciones correctas, 0 fallidas, 26 suites** (las mismas cifras por suite
  que la última ejecución documentada). Las dos suites públicas (`public*.test.js`) solo corren en GitHub Actions.
  Nota: el «AUTOTEST: 7 correctas, 16 fallidas» que aparece dentro de `aim.browser.test.js` es contenido del autotest
  bajo WebGL por software; la prueba solo exige que se ejecute sin errores, y pasa.

## 2. Dónde está cada sistema (COMPROBADO en el código)
| Sistema | Dónde |
|---|---|
| Render, luz, sombras, cámara, efectos, HUD, menús, AJUSTES, audio | `src/page.html` (4 621 líneas) |
| Mapas | `src/page.html`: `WORLDS.pueblo`, `WORLDS.arena` (l. ~1342), `WORLDS.casa` (l. ~1377); PUEBLO 2.0 `client/town.js`, 3.0 `client/town3.js` + `client/kit3d.js`; cajas de CASA `client/casa.js` (generado) |
| Controles | `client/touch.js`, `client/layout.js`, `client/settings.js`; teclado/ratón en `src/page.html` |
| Armas y balística | `core/weapon.js`, `core/melee.js`, `core/config.js` (números), `core/hitbox.js`, `core/geom.js` |
| Movimiento | `core/movement.js`, tick común `core/player.js` (120 Hz) |
| Bots | `class Bot` en `src/page.html` (l. ~2509); bots de entrenamiento `core/trainer.js` |
| Multijugador | Sala autoritativa `core/room.js` (`RULES`: 10 bajas, 100 de vida…); protocolo `core/protocol.js`; cliente `client/netcore.js`; servidor `server/worker.js` (Cloudflare) y `server/node.js` (local) |
| Pruebas | `test/` (28 suites: 26 en `npm test` + 2 públicas en CI) |
| Despliegue | `.github/workflows/` (Pages automático, «Desplegar servidor», «Prueba pública online», «Pruebas» manual); `wrangler.toml` |

Los números de armas y reglas de sala del código coinciden con `SNIPER_DUEL_TECHNICAL_ARCHITECTURE.md` §3. Las banderas
de URL que lee el código son exactamente las 21 de §8 (ninguna sin documentar, ninguna documentada que no exista).

## 3. Estado real de assets y mapas (COMPROBADO en el repositorio)
| Elemento | Estado comprobado |
|---|---|
| PUEBLO 3.0 | Código y assets presentes (`assets/kit.glb` 1,0 MB, 138 texturas en `assets/tex/` = 17 MB). Se activa con `?pueblo=3` o AJUSTES. Mitad sur sigue en 2.0. Sin aprobación estética global ni FPS en iPhone |
| E10 Casa Oliva | `assets/3d/models/sd_e10_casa_oliva.glb` (5,0 MB) cargado por la página en 3.0 |
| Texturas Poly Haven | Adoquín por defecto en 3.0; fachadas P1 como opción `&fachada=cc0` |
| Fauna (rata) | `assets/3d/fauna/rat.glb` (0,2 MB) cargado en 3.0 |
| Flora | `assets/3d/flora/dandelion.glb` + `grass_cards.json` cargados en 3.0 |
| Armas clásicas | `assets/3d/weapons_classic/` (3 GLB, 8,3 MB) presentes y **no referenciadas** por ningún archivo del juego (0 coincidencias): guardadas, como se decidió |
| CASA ATLAS | `assets/maps/casa_atlas/` (GLB 1,8 MB, techo, `collision_map.json`); cliente, servidor y 3 suites propias en verde. Experimental (`?casa=1`) |
| Originales de ChatGPT | `assets/3d/imports/` (172 MB), intactos, no los carga el juego |

## 4. Conexiones (COMPROBADAS en esta sesión, solo lectura)
| Servicio | Resultado |
|---|---|
| GitHub (git) | Remoto `https://github.com/Hamza189/SNIPER-1VS1.git`, credenciales con Git Credential Manager. Push no probado (no se ha publicado nada) |
| GitHub Actions | Leído por la API pública: últimos «pages build», «Prueba pública online» y «Desplegar servidor» en **verde** (hasta `0a17017`) |
| `gh` CLI | **No instalado** en este PC |
| GitHub Pages | Responde; `version.json` = hash local |
| Servidor Cloudflare | `/health` → `{"ok":true,"v":1,"server":"cloudflare"}` |
| Cloudflare (MCP) | **Conectado**: ve el Worker `sniper-duel` (modificado 18-10 10:53 UTC, coincide con el despliegue de `0a419e1`) |
| Context7 (MCP) | Conectado (documentación de Three.js disponible) |
| Netlify (MCP) | Conectado a la cuenta del propietario; el proyecto no usa Netlify |
| Sentry (MCP) | Conectado a una organización; el juego no tiene Sentry (sin DSN, sin código) |
| Supabase (MCP) | Conectado; un proyecto ajeno al juego. El juego no usa Supabase |
| Figma (MCP) | Conectado (plan starter). No usado por el proyecto |
| Linear (MCP) | Conectado; existe un equipo «SNIPER DUEL» (SNI) con solo las 4 tareas de bienvenida de Linear, sin proyectos |
| Otros MCP de la sesión | Google Drive/Docs/Sheets/Calendar, Gmail, Runway, Chrome, navegador integrado, control del escritorio |

Corrección a `SNIPER_DUEL_CONNECTIONS.md` §3: en esta instalación Claude Code **sí** tiene esos conectores. Siguen sin
formar parte del juego y no se crea nada en ellos sin permiso.

## 5. Problemas detectados en esta sesión
| # | Problema | Estado |
|---|---|---|
| 1 | `python3` no existía en Windows (solo `python` y el alias de Microsoft Store): `npm test` fallaba | ARREGLADO en el PC (copia `C:\Python314\python3.exe`), no en el repositorio |
| 2 | `build.py` fallaba en Windows al leer UTF-8 con la codificación cp1252 | ARREGLADO en el repositorio (`encoding="utf-8"`); hash de compilación idéntico |
| 3 | Faltaban `playwright` 1.56 + Chromium y `ws` | INSTALADOS con `--no-save` |
| 4 | `gh` no instalado | PENDIENTE (el propietario decide; mientras, Actions se lee con la API pública) |
| 5 | Sin `.gitattributes` y `core.autocrlf=true`: los archivos regenerados salen como «modificados» aunque solo cambie el fin de línea | PROPUESTA (sin aprobar): añadir `.gitattributes` con `* text=auto eol=lf` |
| 6 | Los PDF de traspaso eran imágenes; su contenido coincide con `CLAUDE.md`, `MASTER_CONTEXT` y `HANDOFF` del repositorio | Sin diferencias de fondo |
| 7 | La documentación decía que Claude Code no tendría conectores | CORREGIDO en `SNIPER_DUEL_CONNECTIONS.md` |

No se ha encontrado ninguna diferencia entre documentación y código en jugabilidad, armas, reglas, mapas ni banderas.

## 6. Tareas: hechas, en curso, sin empezar
**Hechas** (verificadas en código y pruebas): todo lo de `SNIPER_DUEL_ROADMAP.md` §1 (fases 1 a CASA ATLAS).

**En curso / esperando al propietario** (nada que programar hasta tener su resultado):
1. Rayas en las paredes en su PC: falta su captura, la línea de diagnóstico de AJUSTES › GRÁFICOS y probar
   `?pueblo=3&sombras=0`.
2. CASA ATLAS: recorrerlo, bots, 1v1 real entre dos dispositivos, aprobación visual y decisión del techo.
3. FPS reales en iPhone/Samsung de PUEBLO 3.0 y CASA ATLAS.
4. Suelo del Samsung y fachadas P1.
5. Reconexión con dos iPhone y partidas de 10–15 min.

**Sin empezar**: armas clásicas como aspectos; mitad sur de PUEBLO 3.0; atlas de texturas compartido; GFX-4…10;
ajustes A4–A11; propuestas de precisión; 2v2/3v3, ranked, cosméticos, versiones instalables.

## 7. Siguiente fase recomendada
1. **Cerrar las validaciones pendientes** (lista anterior), empezando por las rayas. COMPROBADO: este PC es el portátil
   del propietario (MSI GF63 8RD) y tiene **dos GPU**, Intel UHD 630 y NVIDIA GTX 1050 Ti Max-Q (Optimus). Eso refuerza
   la hipótesis de que su Chrome pinte con la Intel. Claude Code puede abrir el juego en el navegador integrado y leer la
   línea de diagnóstico, pero lo que ve el Chrome del propietario solo lo confirma su propia captura.
2. **Medición de rendimiento** reproducible en GPU real (ms por fotograma, llamadas, triángulos, memoria de texturas) por
   mapa y perfil, como base antes de añadir contenido. Las cifras de iPhone las tiene que dar el propietario.
3. Después, con su aprobación: **armas clásicas como aspectos** (prioridad 4 del 17-10, la única de esa lista sin hacer).

No se ha empezado ninguna fase nueva ni se ha tocado la jugabilidad.
