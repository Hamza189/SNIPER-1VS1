# Encargo para ChatGPT — CASA ATLAS XL (mapa 1v1 de francotiradores, 40 × 32 m)

Copia todo lo que hay debajo de la línea y pégaselo a ChatGPT. Adjunta también, si puedes, la entrega anterior
(`assets/3d/imports/2026-10-18_casa_atlas/`) como referencia de estilo y de formato.

---

Eres el artista 3D y diseñador de niveles de **SNIPER DUEL**, un shooter 1v1 de francotiradores para navegador (PC,
iPhone y Android) hecho con Three.js r128. Claude (otra IA) integra, valida y prueba lo que entregues; el propietario lo
juega y lo aprueba. Necesito una versión **grande** del mapa CASA ATLAS: la entrega anterior (piso de 18 × 14 m) funciona,
pero es demasiado pequeña para un juego de francotiradores. **Medido en el juego:** la línea de visión media entre dos
puntos es de 6,1 m, la máxima de 18,6 m, y solo el 1 % de las líneas de visión supera los 15 m. El rifle principal tiene
mira 4×/8× y cero a 50 m: el mapa tiene que aprovecharlo.

## 1. Qué quiero (diseño)
**CASA ATLAS XL**: una villa mediterránea creíble en una parcela de **40 m (X) × 32 m (Z)**, una planta jugable a nivel de
suelo (y = 0) más, si quieres, una azotea alcanzable por escalera o rampa (ver §4). Estilo: casa encalada o estucada,
teja o azotea, carpintería de madera, piedra, vegetación mediterránea. **Nada monumental** (un kit anterior se rechazó
por parecer un templo de piedra).

Distribución orientativa (puedes mejorarla si justificas por qué):
- **La casa** (≈ 18 × 14 m, puede ser la planta de la versión anterior, revisada), en el centro o desplazada a un lado.
- **Jardín/patio** con piscina o estanque, pérgola, muretes bajos, maceteros y árboles: espacio abierto con coberturas.
- **Calle delantera** por un lado de la parcela, con muro de cerramiento y portón.
- **Un segundo edificio** (garaje, casa de invitados o almacén) separado de la casa por el patio.
- Muro perimetral de **al menos 3,5 m** de alto (nadie puede salir del mapa ni ver «el vacío»).

**Distancias (lo más importante):**
- Que existan líneas de visión largas de **25–45 m** (por ejemplo, de la ventana de la casa al garaje cruzando el patio,
  o a lo largo de la calle) y medias de 10–25 m.
- Que ningún punto de aparición vea al otro: las dos salidas (A y B) en extremos opuestos, a más de 30 m, sin línea de
  visión entre ellas.
- Rutas alternativas: al menos **tres caminos** entre A y B (por dentro de la casa, por el patio, por la calle/garaje).
- Coberturas cada 6–10 m en las zonas abiertas, para poder cruzar sin quedar expuesto más de 2–3 s.
- Nada de pasillos sin salida ni rincones donde un jugador quede encerrado.

## 2. Formato (contrato de assets de SNIPER DUEL)
- **glTF 2.0 binario (`.glb`)**, texturas dentro. **Sin Draco, meshopt ni KTX2/Basis** (el cargador del juego no los lee).
- 1 unidad = 1 metro. **+Y arriba.** Origen en el centro de la parcela, a ras de suelo (y = 0). Calle hacia **+Z**.
- Normales en todas las primitivas (aristas duras con vértices separados). UV correctas, sin estirar.
- Materiales PBR metallic-roughness: base color en sRGB, normal OpenGL (+Y), rugosidad en G y metal en B.
  Nombres `sd_<semántico>` (`sd_estuco`, `sd_piedra`, `sd_teja`, `sd_madera`, `sd_hierro`, `sd_vidrio`,
  `sd_vegetacion`…). Vegetación con `alphaMode: MASK`; `BLEND` solo para el vidrio.
- **Texturas:** escaneadas CC0 de **Poly Haven** (indica cuáles en `LICENSE_ASSETS.md`) u obra propia. **Color base del
  material a 1,0** cuando la textura ya tiene el color (la versión anterior teñía el roble dos veces y salía naranja).
  JPEG para color y rugosidad; PNG solo si hace falta alfa. Potencias de 2, máximo 2048 px; reutiliza texturas entre
  piezas (cada material es una llamada de dibujo en el móvil).
- Presupuesto orientativo (lo medirá Claude en el iPhone): **≤ 60 000 triángulos** en total y **≤ 40 materiales**.
  Árboles y plantas en tarjetas (planos con alfa), no en geometría.
- Sin cámaras, luces ni animaciones.
- **Ningún hueco atraviesa a la nada:** si un interior está vacío, sus ventanas se cierran con vidrio o panel.
- **Techo:** la casa y el garaje necesitan techo o azotea de verdad (la versión anterior no tenía y se veía el cielo
  por encima de los tabiques). Si el techo es opcional, entrégalo como GLB aparte (`*_techo.glb`).

## 3. Colisiones (`collision_map.json`), mismo formato que la versión anterior
Las colisiones del juego y del servidor **salen solo de este archivo**, nunca del modelo. Cajas alineadas con los ejes:
```json
{ "name": "wall_garaje_n", "center": [x, y, z], "size": [sx, sy, sz], "type": "solid" }
```
- `"type": "solid"` → para el movimiento **y** para las balas (muros, muebles grandes, coches, troncos…).
- `"type": "move"` → solo para el movimiento (cristal, barandillas, setos finos que no paran balas).
- Incluye también `id`, `version`, `units`, `axis`, `dimensions`, `bounds`, `playerEyeHeight: 1.62`, `floorY: 0`,
  `spawns` (A y B con `position` y `yaw`), `zones` (nombre + rectángulo) y `notes`.

Reglas que el validador del juego comprueba (si no se cumplen, la entrega vuelve):
1. **Todo lo que se vea a la altura del cuerpo (0,12–2,0 m) y pueda parecer cobertura tiene caja**, y la caja coincide
   con lo dibujado a menos de 6 cm. Sin caja = cobertura falsa (las balas la atraviesan).
2. Muros sobre las caras de su caja; huecos de puertas y ventanas como máximo 0,25 m hacia dentro.
3. **Puertas de al menos 1,0 m** libres. Pasillos de al menos 1,2 m. El jugador es un cilindro de **0,35 m de radio** y
   1,8 m de alto (1,2 agachado); sube escalones de hasta 0,45 m.
4. **Muebles a 0,8 m de puertas, ventanas y fachadas**, y sillas a ≥ 0,45 m de su mesa y bien orientadas (en la versión
   anterior las macetas tapaban puertas y dos sillas estaban al revés).
5. **Salidas (spawns) a ≥ 0,8 m de cualquier caja**, sin línea de visión entre A y B.
6. Ventanas con alféizar por debajo de 1,5 m: el jugador podría saltar por ellas. Decide para cada una si se puede
   cruzar (entonces sin caja `move`) o no (caja `move` de suelo a 3 m). Igual con barandillas.
7. Nada transitable encima de muebles altos o tejados salvo la azotea prevista.
8. Las zonas caminables tienen que formar **un solo recinto conectado** (la versión anterior tenía un hueco de 85 cm entre
   la isla de la cocina y el horno donde se encerraban los bots).

## 4. Azotea (opcional)
Si haces azotea alcanzable: rampa recta (pendiente suave, ≤ 30°; Claude la convierte en rampa del juego) o escalera con peldaños de ≤ 0,45 m, cada uno con su caja, pretil de ≥ 1,0 m con caja, y que
desde ella no se vea ninguna salida. Indica en `notes` la altura y por dónde se sube.

## 5. Entrega
Carpeta `AAAA-MM-DD_casa_atlas_xl/` con:
1. `models/sd_casa_atlas_xl.glb` (+ `sd_casa_atlas_xl_techo.glb` si el techo va aparte).
2. `collision_map.json` (formato de §3).
3. `CASA_ATLAS_XL.md`: medidas (bounding box), plano con zonas, salidas, rutas A→B, las 5 líneas de visión más largas
   con sus extremos y metros, materiales y texturas con resolución, triángulos y materiales totales, decisiones de
   ventanas/barandillas, licencias.
4. `LICENSE_ASSETS.md` con cada recurso de terceros (solo CC0).
5. `preview/`: una vista cenital con las cajas superpuestas y 4 vistas a 1,62 m de altura desde las zonas principales.
6. Opcional pero muy útil: el script de Blender (`src/*.py`) que genera el modelo, para poder corregir y regenerar.

---

## Para Claude (integración, cuando llegue la entrega)
1. Copiar el original intacto a `assets/3d/imports/<fecha>_casa_atlas_xl/` con `FUENTE.md`.
2. `node tools/validate-glb.js` sobre el GLB; comprobar cajas frente a lo dibujado (como en §17 de `docs/ASSETS-3D.md`),
   puertas cruzables, ventanas, spawns y red de navegación conectada (`navMarkMain` debe dejar un solo trozo).
3. Integrar como mapa nuevo `casaxl` tras `?casa=2` (CASA ATLAS actual intacta), con `tools/casa/make_casa_js.py`
   adaptado, `tools/export-map.js` → `core/mapdata.js`, y comprobar que PUEBLO, ARENA y CASA no cambian byte a byte.
4. Medir líneas de visión (media, máxima, % > 25 m), llamadas, triángulos y memoria de texturas por perfil; en la GPU real.
5. Pruebas nuevas tipo `casa.test.js`, `casa.browser.test.js`, `casa.online.browser.test.js`; `npm test` completo.
6. **Desplegar el servidor solo con la aprobación del propietario** (mapa nuevo en `core/mapdata.js`).
