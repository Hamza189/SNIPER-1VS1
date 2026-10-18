# SNIPER DUEL — mapas, modelos y recursos

Detalle completo de cada entrega en `docs/ASSETS-3D.md` (§8–§17). Aquí, el inventario y las decisiones.

## 1. Reglas que valen para todo
- **Lo que se ve no define lo que se juega.** Movimiento = cajas (`W.colliders`); balas = triángulos de `W.ray`;
  servidor = `core/mapdata.js` exportado de la página. Un modelo nuevo nunca cambia colisiones salvo que se cambien las
  cajas a propósito, se reexporte y pasen `browser`, `cover` y `room` tests.
- Ejes y escala: +Y arriba, 1 unidad = 1 m, origen a ras de suelo; glTF 2.0 (GLB) con normales, UV y PBR.
- LOD: el contrato pide `_LOD0/_LOD1/_LOD2` para edificios (E10 los trae); CASA ATLAS no los necesita (32 piezas).
- Nada a la altura del cuerpo lejos de una caja (coberturas falsas): `test/cover.browser.test.js` y `test/town3.test.js`.
- Validador: `node tools/validate-glb.js <glb>`. Contrato: `docs/ASSETS-3D.md` §1–7. Originales siempre guardados sin
  tocar en `assets/3d/imports/<fecha>_<nombre>/` con `FUENTE.md`.
- Sin límite de MB (decisión del propietario, 12-10-2026); la regla es la fluidez en su iPhone.
- Licencias: modelos propios generados por código (Blender) y Poly Haven CC0. Nada de licencia dudosa.

## 2. Mapas
| Mapa | Id | Estado | Notas |
|---|---|---|---|
| PUEBLO | `pueblo` | IMPLEMENTADO | 100 × 100 m. Versiones visuales: 1 (cajas, `?town=0`), 2.0 (por defecto) y 3.0 (`?pueblo=3` o AJUSTES). Las colisiones son las mismas en las tres. Contiene el CAMPO DE TIRO |
| ARENA DE PRUEBAS | `arena` | IMPLEMENTADO | 48 × 32 m, simétrico; mapa por defecto en salas online y en el duelo contra bots |
| CAMPO DE TIRO | (en `pueblo`) | IMPLEMENTADO | Dianas a 20/50/100 m, bots de entrenamiento |
| CASA ATLAS 1V1 | `casa` | EXPERIMENTAL | Piso de 18 × 14 m de ChatGPT, solo con `?casa=1`. En servidor desde el 18-10-2026 |

### PUEBLO 3.0 (vertical slice)
Mitad norte del pueblo rehecha: luz de mediodía, kit modular de Blender (6 familias de casas), suelo nuevo, pueblo
exterior. Por defecto en 3.0: plaza de caliza v3b (ChatGPT, aprobada), adoquín `cobblestone_02` de Poly Haven (aprobado
en iPhone: «se ve todo el suelo muy bien en 4k»), E10 Casa Oliva, ratas y vegetación. Mitad sur: sigue siendo 2.0.
Estado: IMPLEMENTADO · PENDIENTE DE APROBACIÓN ESTÉTICA GLOBAL y DE VALIDACIÓN DE FPS EN IPHONE.

### CASA ATLAS 1V1 (18-10-2026)
- Entrega de ChatGPT: GLB 10 108 triángulos, 32 piezas, 25 materiales, 14 texturas; techo opcional; `collision_map.json`
  con 78 cajas; spawns. Original intacto en `assets/3d/imports/2026-10-18_casa_atlas/`.
- En el juego: `assets/maps/casa_atlas/casa_atlas.glb` (PNG → JPEG, 7,4 → 1,8 MB), `casa_atlas_techo.glb`,
  `collision_map.json` (copia exacta) + `collision_fixes.json` (cajas añadidas por Claude) → `tools/casa/make_casa_js.py`
  → `client/casa.js` → `tools/export-map.js` → `core/mapdata.js`.
- Decisiones: el cristal no para balas pero no se cruza; barandillas a 3,30 m solo para movimiento; no se puede estar
  encima de muebles altos; sin techo por defecto (`&techo=1` para probarlo); lámparas del techo quitadas sin techo;
  salidas fijas A (−7,45; 0,95) y B (7,10; −2,50), movidas respecto al original por motivos medidos.
- Problemas de diseño para ChatGPT: sillas del comedor a 0,29 m de la mesa y dos al revés; macetas en marcos de puerta y
  junto a la fachada del balcón; suelo de roble con color doblemente teñido; texturas procedurales planas.
- Medidas: 38 llamadas / 12 600 triángulos en ALTO (PUEBLO 3.0: 182 / 288 000); en la GTX 1050 Ti del propietario
  18,3 ms por fotograma (ARENA 18,6, PUEBLO 3.0 24,1).
- Pruebas: `test/casa.test.js` (75), `test/casa.browser.test.js` (18), `test/casa.online.browser.test.js` (12).
- Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · 1v1 PROBADO con servidor local y el servidor público acepta el mapa ·
  PENDIENTE: 1v1 real entre dos dispositivos, validación en iPhone y Samsung, aprobación visual del propietario.

## 3. Modelos y packs — inventario y decisión
| Recurso | Origen | Estado | Por qué |
|---|---|---|---|
| Armas y brazos (HALCÓN R7 V2 «Precision», VÍBORA 9, FURIA 12, navaja, brazos con guantes) | Propio, Blender por código (`tools/blender/`) | EN USO (`assets/viewmodels.glb`) | Diseño propio sin licencias de terceros; versiones ligeras en tercera persona para rival y bots |
| Kit modular PUEBLO 3.0 (54 piezas) | Propio (`tools/blender/kit.py`) | EN USO (`assets/kit.glb`) | — |
| E10 «Casa Oliva» | ChatGPT, 11-10-2026 | EN USO en `?pueblo=3` (`&e10=0` la quita) | Copia con normales añadidas; defectos documentados (hueca, se ve a través → volumen interior opaco añadido; 15,4 MB de texturas; estuco gris) |
| P0 Ground Pack v1 | ChatGPT | OPCIÓN `&suelo=p0` | No mejoraba el suelo existente |
| P0 Ground Pack v2 | ChatGPT | Plaza y tapas como OPCIÓN; resto NO | Plaza de tono frío; bordillos GLB no pasan el validador |
| P0 v3 / v3b | ChatGPT | Caliza v3b POR DEFECTO en 3.0; adoquín v3b RECHAZADO | El adoquín no pasa la prueba de repetición |
| Adoquín `cobblestone_02` | Poly Haven CC0 | POR DEFECTO en 3.0 (`&adoquin=0` el anterior) | Aprobado por el propietario |
| Fachadas P1 (`white_stucco_02`, `clay_roof_tiles_02`, `distressed_painted_planks`, `rough_pine_door`) | Poly Haven CC0 | OPCIÓN `&fachada=cc0` | Mejora leve; `sandstone_blocks_04` excluida (no mejoraba) |
| Kit P1 de piedra de ChatGPT | ChatGPT | RECHAZADO | Estilo monumental, no mejora al kit actual |
| `street_rat` | Poly Haven CC0 | EN USO en 3.0 (3 ALTO / 2 MEDIO / 0 BAJO, `&ratas=0`) | Esqueleto de 19 huesos, IA de estados; 3 568 triángulos |
| `dandelion_01`, `grass_medium_02` | Poly Haven CC0 | EN USO en 3.0 (`&flora=0`) | Hierba en tarjetas; 1 430 / 853 / 350 plantas según perfil |
| `gate_latch_01` | Poly Haven CC0 | APARCADO | No se ve a la distancia de juego |
| Armas clásicas (`bolt_action_rifle_7_62`, `service_pistol`, `fish_knife`) | Poly Haven CC0 | GUARDADAS en `assets/3d/weapons_classic/`, no se cargan | Decisión del propietario (17-10-2026): las modernas siguen; las clásicas, en el futuro, como aspectos opcionales sin ventaja |
| CASA ATLAS 1V1 | ChatGPT | EXPERIMENTAL | Ver arriba |

## 4. Texturas
- `assets/tex/`: procedurales originales (`tools/textures/make_textures.py`, `make_textures_p3.py`), P0
  (`tools/p0/*.py`), P1 (`tools/p1/make_p1_facades.py`), flora/fauna. Variantes por perfil (`p1_`, `p1m_`, `p1b_`…).
- Descarga de Poly Haven: `tools/polyhaven/descargar_p1.py` (se ejecuta en el PC del propietario; la API de Poly Haven no
  es accesible desde el entorno de pruebas salvo por WebFetch).

## 5. Pendiente de validar en dispositivos reales (de assets y mapas)
- FPS en iPhone con ratas y 1 430 plantas (ALTO), con E10 y con CASA ATLAS.
- Suelo/adoquín en el Samsung (se veía gris; causa probable: el enlace compartido perdía los parámetros; ahora hay opción
  en AJUSTES y línea de diagnóstico).
- Fachadas P1 (`&fachada=cc0`): ¿mejoran a la vista del propietario?
- Rayas en las paredes en el PC del propietario (ver `SNIPER_DUEL_MASTER_CONTEXT.md` §5).
