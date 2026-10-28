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

Código: `client/perfprobe.js` (cálculos e informe, puro) y el bloque «MEDIR RENDIMIENTO» de `src/page.html`.
Prueba: `node test/perf.test.js`.
