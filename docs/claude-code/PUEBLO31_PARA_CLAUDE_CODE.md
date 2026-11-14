# Instrucciones para Claude Code — PUEBLO 3.1 (14-11-2026)

El propietario trabajó desde el móvil y pidió **un archivo descargable para Claude Code, sin `git push` y sin tocar
`main`**. Todo está en la rama local `pueblo-mejoras`, que no se ha subido. Lleva 3 commits sobre `main`:
los 2 de `casas-habitables`, que ya estaba en GitHub como rama aparte, y PUEBLO 3.1. El zip trae los parches, los archivos
completos, las capturas y los GLB.

Lee primero `docs/PUEBLO-31.md`, `docs/CASAS-HABITABLES.md` y `docs/FUENTE.md`.

## 1. Aplicar
```
git checkout main && git pull
git checkout -b pueblo-mejoras
git am PARCHES/*.patch          # los tres commits, en orden (0001, 0002, 0003)
python3 build.py
```
Si `git am` falla porque `main` ha cambiado, haz `git am --abort` y aplica los archivos de `ARCHIVOS/` a mano (son las
versiones completas). Después regenera el mapa con `node tools/export-map.js` y compara con el `core/mapdata.js` del zip:
solo debe cambiar `pueblo`.

## 2. Comprobar (en este orden)
```
node test/casas.test.js && node test/fuente.test.js && node test/town3.test.js
node test/core.test.js && node test/room.test.js && node test/pistol.test.js && node test/shotgun.test.js && node test/pen.test.js && node test/penroom.test.js && node test/net.test.js
node test/browser.test.js        # el mapa del servidor coincide con la página
node test/cover.browser.test.js  # coberturas falsas
node test/casas.browser.test.js
node test/shadow.browser.test.js && node test/p0.browser.test.js && node test/e10.browser.test.js
node test/online.browser.test.js # servidor local con el mapa nuevo
npm test                         # todo (tarda); casas y fuente ya están en la lista
```
Resultados en la nube el 14-11: ver `RESULTADOS_PRUEBAS.txt` en el zip. Dos fallos salen igual con `main`, así que no
son de este cambio:
- `browser.test.js` 57/58: `page.setViewportSize` después de la prueba de pantalla completa;
- `casa.test.js`: «el televisor de pie para la bala».

En el PC del propietario deberían pasar.

## 3. Enseñárselo al propietario ANTES de publicar (reglas 7 y 8)
- `?pueblo=3`: el pueblo entero. Comparar con `?pueblo=3&sur=0`, que es como estaba.
- Las 8 casas: entrar, asomarse, subir a las de dos plantas y salir a los balcones. `?casas=0` deja las cajas de antes,
  solo sin conexión.
- La fuente: compararla con `?fuente=0`. Tiene sonido.
- **MEDIR RENDIMIENTO en el iPhone** (`?medir=1`), en ALTO, con la versión nueva.
  - En el PC de pruebas: `main` 210 llamadas y 335 mil triángulos; esta versión, 264 llamadas y 372 mil.
  - Si el iPhone baja de 60 FPS en PUEBLO, probar `&sur=0` para ver si es el sur y avisar.

## 4. Publicar (solo con su OK)
- Cambia `core/mapdata.js`: el despliegue del servidor se lanza solo con el push a `main`.
- Vigilar «Desplegar servidor» y «Prueba pública online» en `gh run list`, y luego `version.json` público.
- Es un cambio del mapa competitivo: las casas pasan a estar también en línea. El propietario pidió «intégralas», pero
  confírmalo con él.
- Bots del servidor: `WORLDS.pueblo.navServer` deja la cuadrícula de 3 m de siempre (702 puntos, antes 705). No entran
  en las casas. Si se quiere que entren, `core/bots.js` tendría que calcular su separación de otra manera: hoy la saca de
  los primeros puntos, y los de 1 m de las casas la estropearían. Medirlo antes.

## 5. Volver atrás
- Antes de publicar: no hay que deshacer nada (es una rama).
- Después: `git revert` de los tres commits y push. Republica la página y el servidor.
- Para comparar en el propio juego: `?sur=0`, `?casas=0`, `?fuente=0`.
