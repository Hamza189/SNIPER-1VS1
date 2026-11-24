# AJUSTES › EN PRUEBA (19-11-2026) — RETIRADA el 23-11-2026

> Con el lanzamiento (`docs/LANZAMIENTO.md`) todo lo que ofrecía esta pestaña pasó a ser lo de por defecto y la pestaña se
> quitó. Las banderas del enlace siguen funcionando para comparar. Lo de abajo es la historia.

Lo pidió el propietario: el acceso directo de la pantalla de inicio es la única forma de tener el juego a pantalla
completa en el iPhone, pero ese acceso abre siempre el enlace normal. El manifiesto dice `start_url: "./"`, así que se
pierde todo lo que va tras el `?`. Además, en el iPhone el acceso directo tiene su propia memoria, separada de Safari. Por
eso, probar algo nuevo con `?bandera=…` dejaba el acceso directo «medio pillado».

La solución es una pestaña **EN PRUEBA** en AJUSTES, con un interruptor SÍ / NO para cada función en prueba que el juego
ya recuerda en el dispositivo:

| Interruptor | Dato que guarda (lo mismo que la bandera del enlace) |
|---|---|
| SALA 1V1 NUEVA | `lobby2` (`?lobby=2/1`) |
| SALA 1V1 LIGERA | `lbLite` (`?sala3d=0/1`) |
| PUEBLO 4.0 | `p4` (`?pueblo=4`, `?pueblo=0/3`) |
| BARRIO | `barrioExp` (`?barrio=1/0`) |
| CASA ATLAS | `casaExp` (`?casa=1/0`) |
| CASA ATLAS 2.0 | `casa2Exp` (`?casa2=1/0`) |
| MENÚ NUEVO | `menuOld` (`?menu=2/1`) |
| ARSENAL | `arsenalOld` (`?arsenal=1/0`) |
| RIFLES DISTINTOS | `balanceOld` (`?balance=1/0`) |
| BALAS QUE ATRAVIESAN | `penOff` (`?pen=1/0`) |
| DESLIZAMIENTO NUEVO | `deslizOld` (`?desliz=1/0`) |
| RAYOS X EN PRUEBAS | `rayosxOff` (`?rayosx=1/0`) |
| PANTALLA DE CARGA | `carga2` (`?carga=2/1`; añadido el 21-11-2026, `docs/CARGA.md`) |

- Cada interruptor muestra lo que está funcionando **ahora**. Así sigue siendo correcto aunque algo pase a ser lo de por
  defecto.
- Al tocar un interruptor, el valor se guarda al momento y aparece **RECARGAR PARA APLICAR**. Ese botón vuelve a abrir la
  página quitando del enlace esas banderas, para que decida el interruptor y no un enlace viejo.
- **RESTAURAR ESTA SECCIÓN** olvida lo recordado. Tras recargar vuelve todo a lo de por defecto.
- Vale igual en Safari, en el acceso directo del iPhone, en Chrome de Android y en el PC.
- Archivos:
  - `src/page.html`: la pestaña `data-tab="pruebas"`, su panel `#fxList`, el bloque `FX` junto a `SET_TABS` y su CSS
    `.fxRow`.
  - Prueba: `test/pruebas.browser.test.js`, con 11 comprobaciones, también a 932 × 320.
  - Capturas: `docs/en-prueba/`.

**Para añadir una función nueva:** si recuerda su bandera con `store.set`, basta con añadir una línea a `FX` (dato,
nombre, descripción, qué hay ahora y cómo se guarda) y su parámetro a `FX_PARAMS`.

Estado: IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN EL ACCESO DIRECTO DEL IPHONE.
