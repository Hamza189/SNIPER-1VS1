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

Código: `client/perfprobe.js` (cálculos e informe, puro) y el bloque «MEDIR RENDIMIENTO» de `src/page.html`.
Prueba: `node test/perf.test.js`.
