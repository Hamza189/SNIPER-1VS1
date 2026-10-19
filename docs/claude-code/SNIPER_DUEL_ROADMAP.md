# SNIPER DUEL — fases y tareas pendientes

Solo aparece lo que el propietario ha pedido o aprobado, o lo que ya estaba en los planes documentados. Lo que es
sugerencia de Claude está marcado como **PROPUESTA (sin aprobar)**.

## 1. Fases hechas
| Fase | Contenido | Fecha |
|---|---|---|
| 1 | Gunplay, movimiento, campo de tiro, autotest de puntería | 09-10 |
| 2A | Navaja, cambio de arma, entrenamiento | 09-10 |
| A / B | Estabilidad; controles móviles completos | 09-10 |
| C (básica) | Perfiles gráficos, resolución automática, 30 FPS | 09-10 |
| D1–D8 | 1v1 online autoritativo, Cloudflare, pruebas con dos navegadores, auditoría | 09-10 |
| E1–E4 | Pistola, escopeta, efectos, soldados articulados | 09/10-10 |
| F | Armas y brazos modelados en 3D (Blender) | 10-10 |
| G1–G10 | MIRA arrastrable, bots letales opcionales, HALCÓN V2, inspección, armas ligeras en 3.ª persona | 10-10 |
| A3 | AJUSTES por pestañas | 10-10 |
| GFX-0…3 | Color/ACES, PUEBLO 2.0, objetos | 11-10 |
| PUEBLO 3.0 | Slice norte, E10, packs P0, caliza v3b, adoquín CC0, fachadas P1 (opción), rata, vegetación | 11–17-10 |
| CASA ATLAS | Mapa experimental en cliente y servidor | 18-10 |

## 2. Pendiente, por prioridad (orden del propietario cuando lo ha dado)
### Prioridad inmediata: validar en dispositivos reales
1. Rayas en paredes en el PC del propietario (necesita su captura y diagnóstico; ver MASTER_CONTEXT §5).
2. CASA ATLAS: recorrido, bots y 1v1 online real entre dos dispositivos (el propietario: «primero entrar, recorrerlo y
   jugar contra bots; después probaremos el 1v1 online»); aprobación visual; decidir techo sí/no.
3. FPS en iPhone y Samsung de PUEBLO 3.0 (E10, ratas, 1 430 plantas) y de CASA ATLAS.
4. Suelo en el Samsung con la opción de AJUSTES; fachadas P1 (`&fachada=cc0`): ¿mejoran?
5. Reconexión desde segundo plano con dos iPhone; partidas de 10–15 min (calentamiento, FPS).

### Prioridades declaradas el 17-10 (las tres primeras hechas, la cuarta aplazada)
1. Rata ✔ · 2. Dientes de león y hierba ✔ · 3. Comparar el kit arquitectónico y quedarse solo con lo que mejore ✔ (no se
   integró) · 4. **Armas clásicas como aspectos opcionales sin ventaja** — PENDIENTE (falta: encaje en primera persona,
   animaciones, mapa de entorno, LOD; los modelos están en `assets/3d/weapons_classic/`).

### Planes documentados que siguen abiertos
- **Plan 2.0** (10-10): P1 estabilidad → P2 movimiento/cámara/controles → P3 efectos y animaciones → P4 PUEBLO 2.0 y
  ARENA 2.0 → P5 armas 3D → P6 personajes y bots → P7 mapa nuevo → P8 arma nueva → P9 menús/salas/HUD → P10 modos →
  P11 optimización. (Varias partes ya se han hecho por otras vías: P5 en la fase F, P7 con CASA ATLAS.)
- **Plan GFX** (11-10): GFX-4 ARENA 2.0 · GFX-5 remaster HALCÓN · GFX-6 resto de armas y manos (sprint) · GFX-7
  personajes y bots · GFX-8 efectos de combate · GFX-9 gráficos avanzados (personalizado: escala de render, sombras,
  partículas) · GFX-10 optimización final.
- **Plan de ajustes** (10-10): A4/A5 sensibilidad por arma, joystick fijo/flotante, bloquear editor de HUD, ver zonas
  táctiles · A6 gráficos personalizados · A8 retícula cosmética · A9–A11 migraciones, pruebas, docs.
- **PUEBLO 3.0**: extender a la mitad sur (P3-5) cuando se apruebe el estilo; sustituir los edificios restantes con un
  juego de texturas compartido (E10 usa 15,4 MB él solo).
- **Precisión** (`docs/PRECISION.md`, pendientes de aprobación): aguantar el aire automático en táctil; que el disparo
  espere al visor (≤ 170 ms).
- **CASA ATLAS para ChatGPT**: alejar/girar sillas del comedor, mover macetas de puertas y del balcón, texturas
  escaneadas y color base 1,0 en el roble.
- **Ideas anotadas** (fase G): pose de sprint que baja demasiado el arma; caras planas que brillan a contraluz; modo de
  entrenamiento de quickscope.

### Largo plazo (plan original del proyecto, sin calendario aprobado)
2v2 / 3v3 → ranked con MMR oculto → amigos, clanes, leaderboards, torneos, temporadas → cosméticos y maestría de arma
(sin ventajas de pago) → modos (ONE SHOT, FFA). Versiones instalables (.exe, .apk, iPhone): solo preguntado, sin decidir.

### PROPUESTAS (sin aprobar) de Claude
- Optimización medida en iPhone real (frame times, memoria de texturas, tiempos de carga) antes de añadir más contenido.
- Unificar texturas de edificios en atlas compartidos para PUEBLO 3.0.

## Objetivo futuro del propietario (19-10-2026): multiplataforma y monetización
Quiere el juego en **web (enlace) + PC (.exe) + iPhone + Android**, para llegar a más jugadores y poder monetizarlo.
Plan técnico propuesto (sin aprobar; nada empezado):
- **Una sola base de código** (la web actual) empaquetada para cada plataforma, para no mantener cuatro juegos.
- **PC (.exe):** Electron (incluye Chromium: permite quitar el límite de FPS de la pantalla y llegar a 120–144+) o Tauri
  (más ligero, usa el navegador de Windows). Se decide midiendo.
- **iPhone / Android:** Capacitor (la misma web dentro de una app nativa). Requiere cuenta de Apple Developer
  (99 $/año) y Google Play (25 $ una vez): **gasto que debe aprobar el propietario**.
- El servidor online (Cloudflare) sirve igual para todas: solo hay que añadir los orígenes de las apps a `ALLOWED_ORIGINS`.
- Antes de empaquetar: optimizar y «comprimir» el juego (texturas KTX2, minificar, carga bajo demanda) para que la app
  pese poco y vaya a los FPS que permita cada dispositivo.
- Monetización: solo cosmética, sin ventaja competitiva (regla del plan original).

## Estrategia de calidades gráficas por etapas (propietario, 19-10-2026)
Los originales y versiones antiguas se conservan (hay espacio de sobra en el PC). Plan:
1. Dentro de 1–2 semanas, lo que tengamos hecho de cada mapa se **congela como nivel BAJO** (versión ligera).
2. Ese mismo mapa se sigue mejorando (mejores modelos, texturas, detalle); cuando esté bien, esa versión pasa a ser **MEDIO**.
3. Se sigue mejorando más; la versión final más detallada es **ALTO**.
Requisitos técnicos para hacerlo bien (Claude):
- Las **colisiones y el servidor son los mismos en las tres calidades** (solo cambia lo que se ve): el 1v1 entre un móvil en
  BAJO y un PC en ALTO es justo.
- Cada calidad es un conjunto de assets propio cargado según el perfil (AUTO elige por dispositivo); se miden FPS y
  memoria de cada una (BAJO debe ir fluido en móviles flojos, ALTO puede aprovechar el PC).
- Primer paso ya apuntado: BAJO = PUEBLO 2.0, MEDIO/ALTO = PUEBLO 3.0.
