# SNIPER DUEL — conexiones, servicios y herramientas

Sin secretos: aquí solo aparecen nombres de variables, nunca valores. «Estado» = lo comprobado el 18-10-2026.

## 1. Servicios que el proyecto usa de verdad
| Nombre | Función | URL | Conexión | Estado | Qué puede hacer Claude Code | Cómo comprobarlo |
|---|---|---|---|---|---|---|
| GitHub (repo `Hamza189/SNIPER-1VS1`) | Código, historial, rama `main` | https://github.com/Hamza189/SNIPER-1VS1 (el remoto antiguo redirige aquí) | Git por HTTPS + `gh` CLI | Funciona (push del 18-10) | Clonar, commitear, hacer push, ver Actions | `git remote -v`, `git push`, `gh run list` |
| GitHub Pages | Publica `index.html` y `assets/` desde `main` | https://hamza189.github.io/SNIPER-1VS1/ | Automática (`pages-build-deployment`) | Publicado y verificado el 18-10 (mismo `version.json` que el repositorio) | Publicar con un push | `curl https://hamza189.github.io/SNIPER-1VS1/version.json` y comparar con el `version.json` local |
| GitHub Actions | CI/CD | pestaña Actions del repo | Workflows del repo | Verde el 18-10 | Lanzar/leer ejecuciones con `gh` | `gh run list --limit 5` |
| Cloudflare Workers + Durable Objects | Servidor 1v1 autoritativo (`server/worker.js`, DO `RoomDO`, SQLite, rate limit `CREATE_LIMITER`) | https://sniper-duel.hamzaimtiaz2015.workers.dev (`server.json`) · panel: dash.cloudflare.com → Workers y Pages → `sniper-duel` | Despliegue con `cloudflare/wrangler-action@v3` (wrangler 4.42.0) desde Actions | Desplegado y verificado el 18-10: el servidor público ofrece los mapas `pueblo`, `arena`, `casa` | Desplegar haciendo push de cambios en `core/`, `server/`, `client/netcore.js`, `wrangler.toml` | Flujo «Desplegar servidor» en verde (incluye `test/public.test.js` contra la URL) |
| Secretos de GitHub (nombres) | Despliegue de Cloudflare | Settings → Secrets del repo | — | Configurados (el despliegue funciona) | Ninguno: no los lee ni los necesita en local | — |
| CDN (cdnjs, jsDelivr) | Respaldo de Three.js r128 si falla `vendor/` | cdnjs.cloudflare.com, cdn.jsdelivr.net | `<script>` | En uso como respaldo | — | `test/vendor.test.js` |

Variables necesarias (solo nombres): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (secretos de GitHub Actions).
Variable del Worker en `wrangler.toml`: `ALLOWED_ORIGINS` (pública). Bindings: `ROOMS` (DO `RoomDO`), `CREATE_LIMITER`.
Coste: plan gratuito de Cloudflare (100 000 peticiones/día; sin cobro sin cambiar de plan). No activar planes de pago.

### Workflows (`.github/workflows/`)
| Archivo | Cuándo | Qué hace |
|---|---|---|
| `deploy-server.yml` («Desplegar servidor») | push a `main` que toque `core/**`, `server/**`, `client/netcore.js`, `test/public.test.js`, `wrangler.toml` o el propio flujo | `core`, `pistol`, `shotgun`, `room` tests → publica en Cloudflare → `test/public.test.js` contra la URL publicada |
| `public-check.yml` («Prueba pública online») | tras cada `pages-build-deployment` | Instala Playwright 1.56.0 + Chromium y juega una partida con dos navegadores contra la página y el servidor públicos (`test/public.browser.test.js`) |
| `server-check.yml` («Pruebas») | manual | build + vendor, core, phase2, mobile… |

## 2. Herramientas de producción
| Nombre | Función | Conexión | Estado |
|---|---|---|---|
| Blender (módulo `bpy`, 5.x) | Genera armas, brazos, kit (`tools/blender/`), procesa rata/flora/armas clásicas | CLI/Python local (`pip install bpy`) | Usado; no hace falta para jugar |
| Python 3 + numpy + Pillow | `build.py`, texturas, validadores de mapas | Local | Necesario |
| Node 18+ (CI 22), `ws`, `playwright` 1.56 | Pruebas, servidor local, capturas | npm | Necesario para pruebas |
| Poly Haven | Texturas y modelos CC0 (adoquín, fachadas, rata, plantas, armas clásicas) | Manual: el propietario descarga en su PC (`tools/polyhaven/descargar_p1.py`) y los pasa; la API pública se consultó por WebFetch | En uso (CC0) |
| ChatGPT | Arte y assets 3D (E10, packs P0, kit P1, CASA ATLAS) | Manual (archivos que el propietario entrega) | Activo |
| Claude.ai, proyecto «1VS1 SNIPER» | Conversaciones y copia de documentos (`claude/sniper-duel-*.md`, espejo de `docs/`) | Claude.ai | Activo; el repositorio es la fuente de verdad |
| Navegador integrado de Claude en el PC del propietario (MSI, GTX 1050 Ti) | Pruebas en GPU real | Claude desktop app | Usado el 18-10 para medir y verificar |

## 3. Conectores MCP (comprobados en Claude Code el 18-10-2026, solo lectura)
Corrección: en la app de escritorio Claude Code **sí** tiene los conectores de la cuenta. Ninguno forma parte del juego
ni de su despliegue. No crear proyectos ni recursos en ellos sin permiso (pueden tener coste).

| Conector | Comprobación | Resultado |
|---|---|---|
| Cloudflare Developer Platform | listar Workers | Ve `sniper-duel` (modificado 18-10 10:53 UTC). Útil para leer el estado del servidor; desplegar sigue siendo cosa de Actions |
| Context7 | buscar «Three.js» | Funciona (documentación de Three.js) |
| Linear | listar equipos e incidencias | Equipo «SNIPER DUEL» (SNI) con solo las 4 tareas de bienvenida; sin proyectos. No se usa |
| Sentry | listar organizaciones | Una organización; el juego no tiene Sentry (sin DSN ni código) |
| Supabase | listar proyectos | Un proyecto ajeno al juego |
| Netlify | leer usuario | Cuenta del propietario; el juego no usa Netlify |
| Figma | `whoami` | Plan starter; no usado |
| Google Drive/Docs/Sheets/Calendar, Gmail, Runway, Chrome, navegador integrado, control del escritorio | — | Disponibles; no usados por el proyecto |

En el PC del propietario no está instalado `gh`; el estado de Actions se lee con la API pública de GitHub (`curl`).

## 4. Datos que faltan (PENDIENTE DE RECUPERAR)
- Identificadores internos de Cloudflare (cuenta, zona): no se necesitan y no se documentan.
- Panel de Cloudflare: solo el propietario tiene acceso; Claude no lo ha visto.
