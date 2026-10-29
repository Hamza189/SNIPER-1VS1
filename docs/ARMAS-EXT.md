# Armas externas como aspectos (28-10-2026)

Petición del propietario: «hay una carpeta en Descargas/SNIPER DUEL ASSETSS y quiero que añadas todo».

## Qué había y qué se ha podido usar
| Archivo | Licencia | ¿Entra? | En el juego |
|---|---|---|---|
| CheyTac M200 «Intervention» — Aleksandr (sannf4) | CC BY 4.0 | Sí | Rifle **TITÁN** |
| PGM Ultima Ratio — drepi.3d | CC BY 4.0 | Sí | Rifle **ÚLTIMA** |
| Modern Sniper Rifle (Free Lowpoly) — Vlasov Daniil | CC BY 4.0 | Sí | Rifle **VECTOR** |
| Sniper Rifle — awakov_dawid | CC BY 4.0 | Sí (ver aviso) | Rifle **SAHARA** |
| Tactical Knife — lunea | CC BY 4.0 | Sí | Cuchillo **TÁCTICA** |
| Modern Tactical Soldier — ItsKrish7 | CC BY 4.0 | Aún no | Viene sin esqueleto (modelo generado con IA, 378 000 triángulos, mochila grande): hay que riggearlo antes |
| Beretta APX A1 ×2, PX4, PMX, BRX1 — geyges; Remington XM2010 — ardickasaretas | Sketchfab **Standard** | **No** | La licencia prohíbe publicarlos de forma que se puedan descargar o extraer (§2.2 b) y exige protegerlos (§12). En un juego web el `.glb` se descarga tal cual y el repositorio es público: mismo caso que el de TurboSquid |

**Nombres de marca:** en el juego llevan nombres inventados (TITÁN, ÚLTIMA, VECTOR, SAHARA, TÁCTICA). Los créditos citan los
títulos originales, como pide CC BY. **Aviso:** la textura del SAHARA lleva el logotipo «CADEX DEFENCE» (marca real): taparlo
antes de una versión de pago. Las demás no muestran logotipos legibles en primera persona.

## Cómo entran
Solo aspecto (cosmético): balas, daño, cadencia, retroceso y zonas de impacto son las del HALCÓN R7 y la NAVAJA. Se eligen en la
ventana de **Tu personaje** (con `?pj=pro` o `?pj=mix`): «Tu rifle» y «Tu cuchillo». Se guardan en el dispositivo
(`sniperduel_wsRifle`, `sniperduel_wsKnife`). Por ahora se ven en tu 1ª persona; los demás y la 3ª persona siguen viendo el
HALCÓN (siguiente paso: enviarlo al rival como el personaje).

- El modelo del HALCÓN se oculta y el del aspecto ocupa su sitio, alineado por el **gatillo** (el dedo cae en él).
- **Cerrojo y cargador** del aspecto cuelgan de los del HALCÓN: se mueven con sus animaciones, y sus nodos se colocan donde
  están esas piezas en el arma nueva, así la mano derecha va a la palanca de cada rifle y la izquierda a su cargador.
  VECTOR no tiene palanca aparte (la mano va a su sitio igual); SAHARA tiene el cargador enrasado (no se separa).
- El fogonazo sale de la boca de cada rifle.

## Conversor `tools/arma-ext`
```
python tools/arma-ext/make.py <id> --medir    vista de lado y desde arriba con regla en cm (.work/<id>/medir/regla*.png)
python tools/arma-ext/make.py <id>            assets/armas/<id>/arma.glb (1ª persona), arma_tp.glb (3ª), info.json, CREDITOS.md
node tools/arma-retratos.js                   retratos de la ventana de selección
```
La ficha de cada arma (`tools/arma-ext/armas.json`) lleva la licencia (solo CC BY / CC0: el conversor se niega con otras) y
las medidas leídas con la regla: largo real, qué es arriba, enderezado (SAHARA venía inclinado 4°, el cuchillo en diagonal),
altura del ánima, gatillo, cajas del cerrojo y del cargador, y cajas para quitar sobrantes (cartuchos sueltos y el bípode
desplegado del TITÁN).

| Arma | Triángulos 1ª / 3ª | Texturas | Peso |
|---|---|---|---|
| TITÁN | 24 600 / 2 500 | 2048 | 6,3 MB |
| ÚLTIMA | 22 800 / 2 500 | 2048 | 5,5 MB |
| VECTOR | 19 500 / 2 500 | 2048 | 3,5 MB |
| SAHARA | 22 200 / 2 500 | 2048 | 5,5 MB |
| TÁCTICA | 1 800 / 600 | 1024 | 0,6 MB |
Solo se descarga el aspecto elegido, cuando lo eliges (el HALCÓN tiene 18 000 triángulos).

### A resolución máxima, en KTX2 (29-10-2026)
Petición del propietario: «lo quiero todo en 4K y en su máxima resolución».
- Sin comprimir no cabían: por eso el `arma.glb` lleva 2K (1K el cuchillo).
- Desde ahora el juego pide `arma_ktx2.glb` más la carpeta `ktx2/`:
  - la misma geometría (no pasa por Blender);
  - cada textura vuelve a salir del original, a su tamaño real, comprimida para la GPU igual que los personajes
    (`docs/KTX2.md`);
  - cada textura es un archivo aparte, `ktx2/<nombre>.<hash>.ktx2`, de 1 a 13 MB.
- `arma.glb` (JPG 2K) sigue para `?ktx2=0`, para BAJO y por si el KTX2 falla.

| Arma | Texturas | Resolución | Memoria gráfica JPG → KTX2 | Descarga JPG → KTX2 |
|---|---|---|---|---|
| TITÁN | 9 | 4K (3) y 2K (6) | 192 → 96 MB | 5,8 → 52,3 MB |
| ÚLTIMA | 17 | 4K | 363 → 363 MB (4 veces el detalle) | 5,1 → 139,0 MB |
| VECTOR | 6 | 4K | 128 → 128 MB (4 veces el detalle) | 3,2 → 59,6 MB |
| SAHARA | 18 | 2K (su máximo) | 384 → 96 MB | 5,1 → 32,6 MB |
| TÁCTICA | 6 | 2K (antes 1K) | 32 → 32 MB | 0,5 → 8,1 MB |

- **Por qué archivos aparte**:
  - ÚLTIMA en un solo GLB pasaría de los 100 MB, y GitHub no admite archivos tan grandes;
  - en el móvil se piden de una en una (`ktx2Queue`, 3 a la vez en PC): al cargar solo hay en memoria una textura
    descomprimiéndose, no el modelo entero;
  - no esperan a la cola de los personajes.
- Las texturas de `KHR_materials_specular` de ÚLTIMA no se descargan: three r128 no las usa.
- Mientras llega el aspecto, el HALCÓN (o la NAVAJA) sigue en las manos.
- Arreglado de paso: volver a elegir un aspecto ya usado (p. ej. ÚLTIMA → TITÁN → ÚLTIMA) dejaba las manos vacías.
- Comparativa con la misma cámara y el mismo fotograma: `docs/img/ktx2-armas.jpg` (`node tools/ktx2/armas-compare.js` y
  `python3 tools/ktx2/sheet.py --armas .work/ktx2-armas`). PSNR del rifle frente al JPG: TITÁN 37,6 dB, ÚLTIMA 41,7, VECTOR 35,6, SAHARA 40,1 (no se ve pérdida; con 4K, algo más de nitidez).
- **Espacio**: GitHub Pages publica webs de hasta 1 GB. Con las armas a 4K el repositorio publicado pasa de 574 a
  ~870 MB. Para más texturas de 4K (los mapas) habrá que sacar los archivos grandes a otro sitio: ver la tarea en el
  registro de decisiones.

Pruebas: `node test/armas.browser.test.js` (los 4 rifles disparan y accionan el cerrojo con su modelo; volver al HALCÓN lo deja
como siempre; cuchillo; se guarda; sin 404; KTX2 a la resolución del original y vuelta al JPG si falla; el HALCÓN mientras
carga; volver a elegir un aspecto ya usado; en el móvil ÚLTIMA a 4K con las texturas de una en una).
