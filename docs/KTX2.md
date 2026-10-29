# Texturas comprimidas para la GPU (KTX2) — por defecto desde el 29-10-2026 (`?ktx2=0` = lo de antes)

**Estado**:
- Probado con `?ktx2=1` y validado por el propietario en el iPhone: Safari, calidad ALTO, «me deja jugar y carga todo».
- Lo de por defecto en móvil y PC (decisión del propietario: «sí, móvil y PC»).
- `?ktx2=0` vuelve a los JPG.
- En BAJO siguen los JPG de 1K, más ligeros de descargar.
- Si el aparato no sabe usar ninguna textura comprimida, también se usan los JPG: descomprimirlas a 4 bytes por píxel
  sería el problema de memoria de antes.

Petición del propietario: «no quiero perder calidad, sino ir mejorando, aunque haya que ahorrar memoria» y «sí,
prepáralo».

Contexto:
- Safari en el iPhone cerraba la página con los personajes realistas en calidad ALTO. Un personaje de 4K ocupa
  340 MB de memoria gráfica.
- El arreglo de urgencia (`ead572a`) limita los personajes del móvil a 2K.
- Esta prueba es la forma de **recuperar el detalle de 4K en el móvil sin gastar más memoria**.

## Qué es
- Las texturas de siempre, a su resolución completa, guardadas en un formato que la tarjeta gráfica entiende
  comprimido: **UASTC** de Basis Universal, dentro de archivos KTX2.
  - S.W.A.T. y FSB a 4K; MILITAR y SOLDADO a 2K.
  - Comprimido quiere decir que cada textura ocupa 1 byte por píxel en vez de 4.
- Al cargarlas, cada aparato recibe su formato nativo:
  - **ASTC 4×4** en el iPhone (y en este Chromium de pruebas);
  - **BC7** en una tarjeta de PC como la GTX 1050 Ti.
- Con KTX2, el móvil vuelve a cargar los personajes de 4K, porque comprimidos caben.
- Solo tienen versión KTX2 los cuatro que se eligen: SOLDADO, S.W.A.T., FSB y MILITAR. Los demás (p. ej. el LINCE de
  `?pj=3`) siguen en JPG.

## Medidas

### Memoria gráfica de los personajes en un móvil con calidad ALTO
Medida en la página real, con los bytes de cada nivel de mipmap.

| | Resolución | Formato | Memoria |
|---|---|---|---|
| Antes del arreglo de urgencia | 4096 | RGBA (JPG) | 340 MB, y Safari se cerraba |
| Hoy, sin bandera | 2048 | RGBA (JPG) | 85 MB |
| **`?ktx2=1`** | **4096** | **ASTC 4×4** | **85 MB** |

Con la misma memoria que hoy, 4 veces más detalle. En PC, con BC7, también es la cuarta parte de lo de ahora.

### Calidad
El mismo personaje con la misma pose, luz y cámara, JPG frente a KTX2. PSNR: por encima de 40 dB la diferencia no se
ve a simple vista. Hoja: `docs/img/ktx2-comparacion.jpg` (JPG | KTX2 | diferencia ×8).

| Personaje | Cuerpo entero | De cerca (como con la mira) |
|---|---|---|
| S.W.A.T. (4K) | 48,1 dB | 43,5 dB |
| FSB (4K) | 43,3 dB | 41,3 dB |
| MILITAR (2K) | 47,4 dB | 43,2 dB |
| SOLDADO (2K) | 47,2 dB | 42,1 dB |

### Lo que cuesta: la descarga
Es más grande: 2 a 5 veces lo de ahora, porque el JPG comprime mejor para guardar pero no sirve para la GPU.

| Personaje | Modelo JPG → KTX2 | Cada color JPG → KTX2 |
|---|---|---|
| S.W.A.T. | 10,7 → 26,6 MB | 1,3 → 6,2 MB |
| FSB | 8,1 → 16,8 MB | 0,9 → 3,5 MB |
| MILITAR | 4,5 → 9,3 MB | 0,3 → 2,0 MB |
| SOLDADO | 6,6 → 13,0 MB | 0,7 → 3,1–3,6 MB |

- Una partida en ALTO en el móvil descargaba unos 15 MB de personajes y con KTX2 serían unos 40–55 MB la primera vez.
  Después quedan en la caché del navegador.
- El lector (`vendor/KTX2Loader.js`, 71 KB) y el transcodificador (`vendor/basis`, 0,5 MB) solo se descargan con la
  bandera.

## Cómo se hace
- **Convertir** (Python + Node, sin instalar nada):
  `python3 tools/ktx2/make.py [op2 op3 op4 v2] [--rdo 1.0] [--level 2]`.
  - Saca las 3 texturas de cada GLB (color, normales, rugosidad/metal) y los colores de cada aspecto.
  - Las codifica con `tools/ktx2/encode.js`: el codificador oficial de Basis Universal v1.50, en WebAssembly
    (`tools/ktx2/basis`, Apache 2.0).
  - Ajustes: UASTC nivel 2, RDO 1,0, mipmaps y zstd.
  - Escribe, junto a los originales, que no se tocan: `personaje_ktx2.glb` (extensión `KHR_texture_basisu`) y
    `color_<A|B|bots>_ktx2.ktx2`.
  - Tarda: unos 7 min con las texturas de 2K y unos 30 min con las de 4K, en un solo hilo.
- **Comparar**: `node tools/ktx2/compare.js` y `python3 tools/ktx2/sheet.py <carpeta>`.
- **En el juego** (`src/page.html`, `pj2Load` / `pj2Mat`):
  - Con `?ktx2=1` carga el lector y pide `personaje_ktx2.glb` con `GLTFLoader.setKTX2Loader`, y los colores
    `.ktx2`.
  - Si algo falla, el personaje se carga como siempre (JPG).
  - El lector es el `KTX2Loader` de three.js r128 (MIT), empaquetado sin módulos. El transcodificador es el de r128.
- **Prueba**: `test/ktx2.browser.test.js`.
  - En PC llega en KTX2 y la GPU lo recibe comprimido.
  - En el móvil con ALTO, FSB llega en 4K comprimido.
  - Si falla, sale el JPG.
  - Sin la bandera no se descarga nada nuevo.

## Pendiente
- **Probado en el iPhone (29-10-2026)**: con `?ktx2=1` y calidad ALTO en Safari, «me deja jugar y carga todo». Es lo
  que antes cerraba Safari, ahora con los personajes de 4K. Falta el informe de MEDIR RENDIMIENTO con la bandera para
  ver la memoria de texturas.
- **Si se aprueba, que sea lo de por defecto**:
  - en el móvil, para tener 4K;
  - y probablemente en PC, por la memoria.
- **Lo mismo para las texturas del mapa**: el pueblo usa ~90–110 MB en texturas.
