# Medir el rendimiento en el iPhone (y en cualquier dispositivo)

Propuesta de Claude (aprobada por el propietario el 25-10-2026): medir en el iPhone real antes de añadir más contenido.
Las pruebas del PC usan WebGL por software: sirven para contar llamadas y triángulos, **no** para saber los FPS del móvil.

## Cómo se hace (2 minutos)
1. Abre `https://hamza189.github.io/SNIPER-1VS1/` en el iPhone, en horizontal, sin otras apps abiertas.
2. AJUSTES › GRÁFICOS › **MEDIR RENDIMIENTO** (o abre directamente `…/SNIPER-1VS1/?medir=1`).
3. No toques la pantalla unos 45 s: el juego entra solo en ARENA, PUEBLO y CASA ATLAS XL, gira la cámara 10 s y apunta
   con la mira 3 s en cada mapa (los bots no pueden hacerte daño).
4. Sale el informe: **COMPARTIR** (WhatsApp, Notas…) o **COPIAR**, y pégalo en el chat con Claude.
   Repetirlo con AJUSTES › GRÁFICOS en BAJO, MEDIO y ALTO da la comparación completa. Funciona igual en el Samsung y en el PC.

## Qué mide
- Dispositivo (modelo deducido por la pantalla: el iPhone no lo dice), GPU, WebGL, calidad, resolución interna, Hz.
- Carga: HTML, página lista, todo cargado, primer fotograma, MB descargados y los 5 archivos más pesados.
- Por mapa: tiempo para entrar en la partida; fotograma (media, p50, p95, p99, máximo, FPS, % de tirones = más de 1,5
  fotogramas de pantalla, % bajo 30 FPS); CPU por fotograma (JavaScript + envío de dibujo) y si el límite es la CPU, la
  GPU o la pantalla; con la mira 8×; llamadas de dibujo, triángulos, texturas y su memoria estimada (RGBA + mipmaps).
- Durante la prueba la resolución automática se congela (si no, AUTO escondería el coste); al acabar todo vuelve a como
  estaba y el informe queda guardado en el dispositivo.

## Resultados

### iPhone Pro Max (14–16), calidad ALTO — 28-10-2026, 22:13
Informe del propietario, versión `3af783c030` (la de las salas personalizadas, **antes** del límite de 2K para los
personajes en el móvil). Pantalla 430×932, DPR 3, píxeles ×2, límite de 60 FPS, PUEBLO 3.0, WebGL 2 (Apple GPU).

| Mapa | Fotograma (media / p95 / máx.) | FPS | CPU por fotograma | Llamadas | Triángulos | Texturas |
|---|---|---|---|---|---|---|
| ARENA | 16,7 / 17 / 20 ms | 60 | 2,8 ms | 57 (máx. 83) | 98 mil (máx. 133) | 91 ≈ 801 MB |
| PUEBLO | 16,7 / 17 / 23 ms | 60 | 3,3 ms | 212 (máx. 337) | 349 mil (máx. 485) | 91 ≈ 801 MB |
| CASA ATLAS XL | 16,7 / 17 / 21 ms | 60 | 2,9 ms | 76 (máx. 107) | 131 mil (máx. 173) | 117 ≈ 851 MB |

Las tres van a 60 FPS clavados: 0 % de tirones, 0 % por debajo de 30, y con la mira 8× igual. La carga de la página
tarda 0,6 s (3,8 MB).

**Lo que sobra es la memoria, no el tiempo**: ~800 MB de texturas en ALTO. Casi 680 MB son los dos personajes
realistas de 4K (rival y bots, 340 MB cada uno). Es lo que hacía que Safari cerrara la página con varios personajes.
Desde `ead572a` el móvil nunca carga personajes de 4K: los mismos a 2K, unos 85 MB cada uno. Con esta misma prueba
debería quedar en unos **290 MB**. PENDIENTE de repetir la medida en el iPhone para confirmarlo.

### iPhone Pro Max, Safari, calidad ALTO — 29-10-2026, 10:58 (versión `1ce586367f`)
Con la dirección normal, después de volver a los JPG de 2K en el móvil. El propietario: «ya funciona con el link
original en Safari».

| Mapa | Fotograma (media / p95 / máx.) | FPS | CPU por fotograma | Llamadas | Triángulos | Texturas |
|---|---|---|---|---|---|---|
| ARENA | 16,7 / 17 / 24 ms | 60 | 3,0 ms | 52 (máx. 73) | 127 mil (máx. 171) | 110 ≈ 684 MB |
| PUEBLO | 16,7 / 17 / 19 ms | 60 | 3,5 ms | 197 (máx. 344) | 317 mil (máx. 486) | 110 ≈ 684 MB |
| CASA ATLAS XL | 16,7 / 17 / 19 ms | 60 | 3,2 ms | 70 (máx. 96) | 145 mil (máx. 211) | 135 ≈ 733 MB |

- 60 FPS clavados y 0 % de tirones.
- **La memoria sigue alta, y casi todo es el aspecto de arma** del rifle de 1ª persona. Memoria gráfica medida de cada
  aspecto, a 2K:

| Aspecto | Texturas | Memoria |
|---|---|---|
| ÚLTIMA | 19 | ~404 MB |
| SAHARA | 18 | ~383 MB |
| TITÁN | 9 | ~192 MB |
| VECTOR | 6 | ~128 MB |

  La lista de descargas muestra un `arma.glb` de 4,2 MB, así que llevaba ÚLTIMA o SAHARA: unos 400 de los 684 MB.
- **Propuesta**: pasar los aspectos de arma a KTX2, la misma técnica que los personajes. Mismas texturas y misma
  calidad en una cuarta parte de memoria (~400 → ~100 MB).
- **Hecho el 29-10 por la noche**, a petición del propietario («todo en 4K y en su máxima resolución»): cada aspecto
  con sus texturas a la resolución del original.
  - ÚLTIMA y VECTOR pasan a 4K con la misma memoria que hoy.
  - SAHARA baja de ~384 a ~96 MB; TITÁN de ~192 a ~96 MB.
  - Falta repetir MEDIR RENDIMIENTO en el iPhone con ÚLTIMA (`docs/ARMAS-EXT.md`).

### 29-10-2026, noche — Safari cerró la partida tras un minuto (sala, 5 bots, PUEBLO 3.0)
Informe del propietario: «ha cargado y funcionado durante un minuto hasta que se ha quedado pillado el juego en el
Safari del iPhone; sale el mismo error; estaba en sala multijugador, con 5 bots, en PUEBLO 3.0».

Reproducido en el ordenador con `node tools/mem-sala.js` (servidor local, sala TODOS CONTRA TODOS, 5 bots, PUEBLO,
«móvil» en ALTO, ÚLTIMA). WebGL por software: mide memoria, no FPS.

| | Antes | Después |
|---|---|---|
| Texturas en la GPU (mapa y personajes + ÚLTIMA) | 268–284 + 363 MB | 268 + 363 MB (igual) |
| Copia en JavaScript de las texturas comprimidas | **507 MB** | **0** |
| Memoria de JavaScript | 625 MB | ~92 MB (pico de 387 MB mientras cargan los personajes) |

- **Causa**: three.js guarda en JavaScript una copia de cada textura después de mandarla a la GPU. Con las texturas
  comprimidas (KTX2) esa copia no vuelve a usarse, pero ocupaba tanto como la propia GPU: ~500 MB de más.
- **Arreglo** (`ktx2Lean`/`ktx2Upload` en `src/page.html`):
  - la copia se suelta en cuanto la textura está en la GPU;
  - las texturas se mandan a la GPU al terminar de cargar el modelo, no la primera vez que se ven;
  - el aspecto de arma que se deja sale también de la GPU (antes se quedaban todos los que se habían probado);
  - si la GPU lo pierde todo (raro), la página se vuelve a abrir, porque esas texturas ya no se pueden mandar otra vez.
- IMPLEMENTADO · PROBADO EN NAVEGADOR · PENDIENTE DE VALIDACIÓN EN IPHONE.

### 30-10-2026, 21:08 — MEDIR RENDIMIENTO en el iPhone con las texturas desde Cloudflare R2 (versión 5c60dc3ee8)
iPhone Pro Max, Safari, ALTO, píxeles ×2, 60 Hz. Primera medición con el arreglo de memoria y los KTX2 servidos desde R2.

| Escena | Fotograma p50 / p95 / máx | CPU media | Llamadas | Triángulos | Texturas |
|---|---|---|---|---|---|
| ARENA | 17 / 17 / 27 ms → 60 FPS (tirones 0,2 %) | 3,2 ms | 51 | 125 mil | 111 ≈ 684 MB |
| PUEBLO | 17 / 17 / 19 ms → 60 FPS | 3,3 ms | 202 | 355 mil | 111 ≈ 684 MB |
| CASA ATLAS XL | 17 / 17 / 18 ms → 60 FPS | 3,3 ms | 70 | 125 mil | 136 ≈ 733 MB |

- 60 FPS fijos en las tres escenas, también con la mira 8×. Sin cierres de Safari durante la medición.
- Carga de la página: 2,3 s, 16,6 MB descargados; las texturas grandes ya estaban en la caché del navegador.
- La memoria de texturas en la GPU sigue en ~684 MB (como el 29-10). Lo que se quitó fue la copia en JavaScript, que
  esta medición no muestra.
- Falta la prueba larga: sala con 5 bots en PUEBLO 3.0 durante varios minutos.

Código: `client/perfprobe.js` (cálculos e informe, puro) y el bloque «MEDIR RENDIMIENTO» de `src/page.html`.
Prueba: `node test/perf.test.js`.
