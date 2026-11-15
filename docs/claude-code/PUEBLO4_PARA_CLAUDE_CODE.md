# Instrucciones para Claude Code — PUEBLO 4.0, fases F0–F5, F6a vehículos y F6b utilería (15-11-2026)

El propietario pidió PUEBLO 4.0 con auditoría y fases medidas, **sin publicar, sin cambiar el servidor, sin push y sin
tocar `main`**. Todo está en la rama local `pueblo4`. Lleva 6 commits sobre `main`:
1. y 2. casas habitables;
3. PUEBLO 3.1, del paquete anterior;
4. PUEBLO 4.0 F0–F5;
5. PUEBLO 4.0 F6a: pick-ups abandonadas en lugar de los coches de plástico;
6. PUEBLO 4.0 F6b: cajas, bidones y depósito de agua.

Si ya aplicaste el paquete de PUEBLO 3.1, aplica solo los tres últimos parches.

Lee primero `docs/PUEBLO-4.md`: auditoría, líneas de tiro medidas, plan, medidas y la propuesta F6.

## 1. Aplicar
```
git checkout main && git pull
git checkout -b pueblo4
git am PARCHES/*.patch           # 0001–0006 (o 0004–0006 encima de pueblo-mejoras)
python3 build.py
node tools/export-map.js && git diff --stat core/mapdata.js   # PUEBLO 4.0 no cambia el mapa del servidor: si aquí cambia algo, para
```

## 2. Comprobar
```
node test/casas.test.js && node test/fuente.test.js && node test/pueblo4.test.js && node test/town3.test.js
node test/core.test.js && node test/room.test.js && node test/pistol.test.js && node test/shotgun.test.js
node test/cover.browser.test.js && node test/casas.browser.test.js && node test/shadow.browser.test.js
node test/browser.test.js && node test/e10.browser.test.js && node test/online.browser.test.js
npm test
node tools/lineas-de-tiro.js                          # líneas de tiro sobre el mapa del servidor (no cambian en 4.0)
QUAL=alto node tools/pueblo-dibujo.js "&pueblo=3"     # y "&pueblo=3&pueblo4=0", y QUAL=medio / QUAL=bajo
```
Resultados en la nube: `RESULTADOS_PRUEBAS.txt` del paquete.

## 3. Enseñárselo al propietario
- `?pueblo=3` frente a `?pueblo=3&pueblo4=0`, que es PUEBLO 3.1 tal cual.
- Mirar las tres pick-ups (plaza NO, calle transversal este y oeste), el depósito de agua (-17, -21), las cajas y los bidones con y sin `&pueblo4=0`.
- Recorrer los interiores (tienda, taller, almacén, viviendas), mirar la luz y las fachadas con ropa tendida y cables.
- **MEDIR RENDIMIENTO** en el iPhone, ALTO, con y sin `&pueblo4=0`. El desgaste del sombreado cuesta GPU y aquí no se ha
  podido medir. Si baja de 60 FPS, `?pueblo4=0` lo quita entero; el desgaste solo también se puede quitar (BAJO ya no lo
  lleva).
- Decidir F6 (jugabilidad con colisiones nuevas, `docs/PUEBLO-4.md` § F6): eso cambia el servidor y necesita su
  aprobación.

## 4. Cambios en las pruebas (explicados, no relajados sin motivo)
- `test/cover.browser.test.js`:
  - los cables (`p4_cables`, 1,2 cm a más de 4,5 m) no cuentan como objetos sueltos sobre la calle;
  - lo que cuelga como mucho 0,45 m por debajo de un techo que es una caja sólida (las lámparas de las casas) tampoco.
  - Las demás reglas siguen igual y la caja falsa de control se sigue detectando.
- `test/casas.browser.test.js`: el límite de llamadas de las casas sube de 40 a 48, por lo que hay dentro de cada casa.
  En la partida completa son +10 llamadas en ALTO.
- `tools/pueblo-dibujo.js`: acepta `QUAL=medio|bajo`.
- `test/pueblo4.test.js`: comprueba también que las 3 pick-ups caben en la caja de colisión del coche viejo, tienen menos de
  6000 triángulos y que el coche viejo sigue en la escena para las balas.
- Regenerar los vehículos y la utilería: `pip install bpy`, `python3 tools/blender/vehiculos.py` y
  `python3 tools/blender/utileria.py`. Los dos scripts se paran si alguna pieza se sale de su caja.
- `test/pueblo4.test.js` comprueba también las cajas, bidones y el depósito (caben en lo viejo, triángulos, el objeto viejo sigue
  para las balas).
