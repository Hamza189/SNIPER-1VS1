# Instrucciones para Claude Code — CASAS HABITABLES (14-11-2026)

El propietario pidió (13-11, fuera de casa) que tres casas de PUEBLO 3.0 se puedan usar por dentro y que **no se tocara
`main`**: todo está en la rama `casas-habitables` (un commit encima de `main`) y en un zip con los mismos archivos y el
parche. Léete `docs/CASAS-HABITABLES.md` antes de nada.

## Qué hay
| Archivo | Nuevo / cambiado | Para qué |
|---|---|---|
| `client/casas.js` | nuevo | `SDCasas`: cajas, rampas, navegación y aspecto de las 3 casas (puro, Node y navegador) |
| `build.py` | 1 línea | añade `casas.js` a `CLIENT` (después de `town3.js`) |
| `src/page.html` | ~90 líneas, todo tras `CASAS.on` | bandera `?casas=1`, quitar la caja maciza de esas casas, no dibujarlas en PUEBLO 2.0/3.0, meter cajas/proxies/rampas/mallas, navegación por las puertas, `casasSolid()` para el online, flora fuera de las casas, `__SD.CASAS` |
| `test/casas.test.js` | nuevo | 106 comprobaciones sin navegador con el movimiento real |
| `test/casas.browser.test.js` | nuevo | la página con y sin la bandera, escaleras, balas, online, duelo de 25 s |
| `docs/CASAS-HABITABLES.md`, este archivo, entrada en `SNIPER_DUEL_DECISIONS_LOG.md` | docs | |
| `docs/capturas/casas/*.png` | capturas | SwiftShader, mismo encuadre fuera y dentro de cada casa |

## Cómo integrarlo (cuando el propietario lo diga)
```
git fetch origin
git checkout casas-habitables          # o: git am 0001-*.patch sobre main si se trabaja con el zip
python3 build.py
node test/casas.test.js                # 106/106
node test/core.test.js && node test/room.test.js && node test/pen.test.js
node test/casas.browser.test.js        # tarda (WebGL por software)
node test/browser.test.js              # el mapa del servidor no cambia: debe seguir en verde
```
Después: abrir `?pueblo=3&casas=1` (en local con `node tools/static-server.js` o el servidor de siempre), recorrer las
tres casas y enseñárselo al propietario. Si lo aprueba: `git checkout main && git merge --ff-only casas-habitables`,
`npm test`, push, y comprobar Pages y `version.json` como siempre. **Sigue siendo tras bandera**; quitar la bandera solo con
su aprobación visual (regla 7/8).

## Ojo con
- **El servidor no cambia.** Online en PUEBLO las casas vuelven a ser macizas (`casasSolid(true)` en `netStart`). Para
  llevarlas al online hay que exportar el mapa con la bandera puesta (`tools/export-map.js` abre la página: hay que pasarle
  `?casas=1` o guardar `casasExp` antes), comprobar que `core/mapdata.js` solo cambia en esas tres casas, pasar `room`,
  `core`, `pistol`, `shotgun`, `browser` y desplegar el servidor. Es un cambio del mapa competitivo: **pedir aprobación**.
- La navegación del servidor (`MAP.nav`) tampoco cambia hasta ese export; los bots del servidor no entran en las casas.
- Los bots sin conexión entran por las puertas (puntos `NAV[i].casa`) pero no suben escaleras (andan en 2D a y = 0).
- Ventanas: alféizar a 1,10 m a propósito (de pie asomas, agachado te cubres, no se salta por ellas). Si el propietario
  quiere saltar por las ventanas, bajar `WIN_SILL` a 0,9 y volver a pasar `test/casas.test.js` (la comprobación
  «agachado tras el muro» dejará de cumplirse: ajustarla).
- Penetración (`core/pen.js`): muros de 0,30 m, tabiques de 0,12 m y forjados = «media» (solo BALA DURA); cajas = «fina».
- `casa.test.js` tiene 1 fallo que **ya estaba en `main`** («el televisor de pie para la bala»): no es de esto.
- Rendimiento: ~11 llamadas de dibujo y ~15 400 triángulos más para las tres casas (las barandillas son barrotes).
  Medido en SwiftShader: no vale para FPS. Hay que medir en el iPhone 15 Pro Max, el MSI y el Android.
