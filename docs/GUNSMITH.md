# GUNSMITH 2.0: el ARSENAL (08-11-2026)

**Estado:**
- **G1 y G2:** IMPLEMENTADO · PROBADO EN NAVEGADOR (PC con GPU y móvil en horizontal) · PENDIENTE DE VALIDACIÓN EN IPHONE.
- **G4 y G5:** hechos en parte (ver las tablas de abajo).
- **G3, G6, G7 y G8:** pendientes (plan y decisiones al final).
- **El ARMAS de antes:** `?arsenal=0` (se recuerda; `?arsenal=1` vuelve al ARSENAL).

Encargo del propietario (08-11): «un sistema GUNSMITH profesional… que todo lo que el jugador seleccione tenga un resultado
real y verificable… Empieza por G1 y G2. Resuelve primero las skins y el nuevo HUD». Prioridad: «primero que el rifle, los
accesorios y las skins se vean y funcionen perfectamente en el arsenal; después BALA DURA».

![arsenal](img/gunsmith/arsenal-pc.jpg)

## G1 · Auditoría: por qué «las skins no cargan o no coinciden»
Medido en el PC con `.work`/auditoría (página real, servidor local):

| Modelo | Primera descarga | Hasta verse (modelo ligero) | Hasta verse entero | Texturas en la GPU |
|---|---|---|---|---|
| HALCÓN R7 | — (viene con el juego) | al momento | al momento | 44 MB en total |
| TITÁN | 38 MB | 2,5 s | 30 s | 188 MB |
| ÚLTIMA | **139 MB** | 1,6 s | 34 s | **454 MB** |
| VECTOR | 60 MB | 3,5 s | 21 s | 220 MB |
| SAHARA | 33 MB | 1,3 s | 11 s | 188 MB |

1. **El camuflaje tapaba el modelo.**
   - Era el fallo de la captura del propietario: la ÚLTIMA se veía dorada (REJILLA DE ORO) y no se parecía a su miniatura.
   - El camuflaje era uno para todas: se pintaba encima de cualquier modelo.
   - **Arreglo:** cada modelo guarda su camuflaje. Un modelo nuevo empieza «SIN CAMUFLAJE», con su acabado de verdad.
2. **Las miniaturas de las miras mentían:** siempre enseñaban la mira sobre el HALCÓN.
   - **Arreglo:** 32 fotos nuevas, cada mira montada en cada modelo por el propio juego
     (`tools/miras/retratos-modelos.js` → `assets/miras/<modelo>/<mira>.jpg`).
3. **El peso de las versiones 4K** (ÚLTIMA: 139 MB de descarga y 454 MB en la GPU).
   - En el PC carga en 11–34 s.
   - En un iPhone puede tardar mucho o quedarse sin memoria.
   - Mientras llega se ve el modelo ligero (CARGA PROGRESIVA) con su porcentaje.
   - **No lo he bajado de resolución sin medirlo en el iPhone**: el propietario pidió 4K y el 04-11 dijo que las armas cargaban
     bien en su iPhone. Si falla allí, la propuesta es una versión 2K para móvil (¼ de memoria).
4. **Sin fallo:** la selección se guarda bien al recargar, no faltan archivos y no hay errores.
5. **Los rivales y los bots siguen viendo el HALCÓN.** Ya estaba así. Arreglarlo es mandar el modelo elegido por el protocolo:
   un cambio del servidor, solo de aspecto (G7).

## G2 · El ARSENAL nuevo
- **En el centro, el arma grande:** la de tus manos, con su modelo, mira y camuflaje.
  - Se gira arrastrando, de lado y arriba/abajo.
  - Se acerca con la rueda o pellizcando (doble clic: vuelve).
  - El operador no sale aquí.
- **A la izquierda, los MODELOS** (cambian el rifle entero) y los cuchillos, con su retrato real (`tools/arma-retratos.js`) y la
  marca EQUIPADO.
- **Debajo del arma, seis botones:** MIRA, CARGADOR, BÍPODE, SILENCIADOR, EMPUÑADURA y CAMUFLAJE.
  - Cada uno abre un selector pequeño con **solo lo que existe**.
  - MIRA: las 8 miras, en fotos del modelo elegido.
  - CARGADOR, BÍPODE, SILENCIADOR y EMPUÑADURA tienen hoy una sola opción (la del modelo) y lo dicen (llegan en G3).
  - CAMUFLAJE: los de tu cuenta («SIN CAMUFLAJE» sin cuenta).
- **A la derecha, ESTADÍSTICAS y DAÑO,** con las cifras del juego (ver G5), y la HABILIDAD PASIVA: BALA DURA «EN DESARROLLO · NO
  ACTIVA», que no se puede elegir.
- **GUARDAR CONFIGURACIÓN / RESTABLECER:**
  - Lo que eliges es un borrador: se ve al momento en el arma y no se guarda.
  - GUARDAR lo guarda: el modelo, el cuchillo y, por modelo, su mira y su camuflaje.
  - RESTABLECER vuelve a lo guardado.
  - Si sales de ARMAS sin guardar, vuelve lo guardado y al volver te lo dice.
- **Dónde se guarda:**
  - las claves de siempre (`sniperduel_wsRifle`, `sniperduel_wsKnife`, `sniperduel_mira`);
  - lo de cada modelo, en `sniperduel_gsCfg`;
  - el camuflaje, en tu cuenta: lo confirma el servidor, que solo deja equipar lo que tienes.
- Grafito y negro con acentos naranjas. En el móvil en horizontal (844 × 390) todo cabe entre las dos barras.

## G5 · Estadísticas reales: una sola fuente
- **Antes:** el daño por distancia estaba en `core/room.js` (servidor) y **copiado dos veces** en la página (partidas contra bots).
- **Ahora:** `core/gunstats.js` es la única fuente.
  - El servidor (`core/room.js`: `const dmgAt = GS.dmgAt`) y la página (`SDGunStats.dmgAt`) usan la misma cuenta.
  - El ARSENAL enseña lo que sale de ella:
    - ficha: daño por zona, cadencia, cargador, recarga, apuntar, velocidad, alcance y movilidad;
    - tabla de daño a 10–450 m, con los disparos para eliminar;
    - caída de la bala y tiempo de vuelo, con la misma balística de las balas del servidor (`core/weapon.js`).
- **Los 5 modelos y los 2 cuchillos son aspectos:** comparten las cifras del HALCÓN R7 y de la NAVAJA, y el panel lo dice.
- Las barras comparan con las tres armas del juego (HALCÓN R7, FURIA 12, VÍBORA 9).
- **No cambia ningún número.** La sala del servidor da los mismos resultados (`room.test` 155/155, `pistol` 15/15, `shotgun`
  27/27).

## Pruebas
- `node test/gunstats.test.js` (15):
  - la ficha es la de `core/config.js`;
  - la caída de la pistola y la escopeta;
  - la balística es igual que la de una bala del servidor a 100, 200 y 300 m;
  - el servidor y la página usan `core/gunstats.js`;
  - en una sala real del servidor, los impactos a cabeza, torso y piernas quitan lo que dice el ARSENAL.
- `node test/arsenal.browser.test.js` (24, con la GPU; `GPU=0` en software):
  - el ARSENAL en lugar de ARMAS;
  - borrador, guardar, restablecer, salir sin guardar, mira por modelo y recarga de la página;
  - miniaturas de la mira del modelo (sin 404);
  - accesorios sin alternativas y camuflaje sin cuenta;
  - cifras iguales a las de `core/gunstats.js`;
  - cuchillo, girar y acercar, `?arsenal=0` y móvil.
- `test/menu2.browser.test.js` sigue probando el ARMAS de antes, con `?arsenal=0`.
- **Capturas:** `node tools/capture-arsenal.js CARPETA` (PC y móvil; `GPU=0` en software).

## Lo que falta (plan por fases)
| Fase | Qué | Necesita al propietario |
|---|---|---|
| **G3** | Modelos de accesorio hechos por código (como las miras): silenciador, bípode, empuñaduras, cargadores. Montados en los puntos de cada modelo (boca del cañón `info.muzzle`, raíl, guardamanos). Primero **solo aspecto**. | Que el silenciador cambie el **sonido** y quite el **fogonazo** cambia el juego (en un 1 contra 1 el sonido delata): necesita aprobación, igual que cualquier efecto del bípode, la empuñadura o el cargador. |
| **G4** | Hecho: modelo, mira y camuflaje por modelo. Falta: los accesorios de G3 y la pasiva, cuando existan. | — |
| **G5** | Hecho para el rifle y el cuchillo. Falta: comparar con FURIA 12 y VÍBORA 9 en la misma tabla. | — |
| **G6** | BALA DURA, prototipo **contra bots**, detrás de una bandera. | El diseño de abajo |
| **G7** | BALA DURA en el servidor (salas de prueba) y el modelo elegido visible para el rival. | Aprobación antes de activarla en el 1 contra 1 |
| **G8** | Medir memoria y FPS antes/después en PC e iPhone; versión 2K de los modelos para móvil si hace falta. | Probar en su iPhone |

### BALA DURA: propuesta (sin programar todavía)
- **Solo lo marcado como penetrable:** cajas del mapa con superficie `wood` (madera fina) o paneles de metal ligero, y un grosor
  máximo (por ejemplo 0,12 m de madera, 0,04 m de chapa).
  - El grosor real es el que recorre la bala dentro de la caja, así que un ángulo rasante lo aumenta.
  - Hormigón, piedra, estuco, paredes gruesas y límites del mapa: nunca.
- **Datos:** hoy las cajas del mapa tienen superficie (`f`), pero no «penetrable».
  - Se añadiría un campo `pen` solo a las cajas elegidas a mano en cada mapa: lista revisable, sin cambiar ninguna cobertura.
  - Se exportaría a `core/mapdata.js` con el resto.
- **Cuenta del servidor** (nunca del cliente):
  - Al chocar con una caja `pen`, se calcula por dónde sale la bala (entrada y salida de la caja).
  - Si el grosor cabe y no ha atravesado ya otra, la bala sigue con menos energía: daño × 0,5–0,6 y alcance recortado.
  - Como mucho una superficie.
- **Aviso:** marca de penetración en la pared y un sonido distinto, sin marcadores que revelen a nadie.
- **Reglas iguales para los dos:**
  - primero contra bots;
  - luego en salas de prueba;
  - en el 1 contra 1 público, solo con aprobación del propietario.
