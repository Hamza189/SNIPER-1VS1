# Parpadeo de los edificios lejanos (31-10-2026)

Lo que dijo el propietario, con un vídeo de su iPhone 15 Pro Max: «las texturas de los edificios desde lejos no se ven
lisas, se ven como que parpadean».

**Estado:** IMPLEMENTADO · PROBADO EN NAVEGADOR (escritorio, WebGL por software y GTX 1050 Ti) · PENDIENTE DE VALIDACIÓN EN
IPHONE.

## Qué era
- **Fotogramas del vídeo.** Fotogramas consecutivos a 60 por segundo en los momentos en que la cámara casi no se mueve. El
  cambio de un fotograma a otro se concentra en los bordes finos de las fachadas lejanas: barrotes y barandillas de los
  balcones, marcos de las ventanas y contraventanas. No hay manchas dentro de las paredes (eso sería un fallo de
  profundidad).
- **La causa.** El iPhone dibujaba sin suavizado de bordes. La regla de la fase 1 lo daba solo en ALTO y en pantallas de
  menos de 2× («con tanta densidad no hace falta»). El iPhone tiene 3× pero el juego lo dibuja a 2×. Un barrote de 2 cm a
  60 m ocupa menos de un píxel, así que, al girar un poco, aparece y desaparece en cada fotograma.
- **Descartado.** Subir el plano cercano de la cámara (`&near=0.15`) no cambia nada (2,404 frente a 2,406): no son caras que
  se pelean por la profundidad. Las sombras ya van ajustadas a su rejilla.

## Qué cambia
- **Suavizado de bordes (MSAA 4×)** en MEDIO y ALTO, en todos los dispositivos. BAJO sigue sin él.
- **Ajuste en AJUSTES › GRÁFICOS:** casilla «Suavizado de bordes». Se aplica al recargar y RESTAURAR la vuelve a encender.
- **Banderas de URL:** `&aa=0` y `&aa=1` lo fuerzan apagado o encendido, sea cual sea el perfil.
- **Hierba y dientes de león:** con el suavizado encendido, el borde de las hojas cubre parte del píxel (*alpha to
  coverage*) en vez de todo o nada, y dejan de chispear.
- **Panel GRÁFICOS:** dice si el suavizado está activo («suavizado de bordes 4×» o «no»).

## Medida
La herramienta es `tools/flicker.js`. La cámara está quieta en PUEBLO 3.0 y gira 0,25 px por fotograma, de forma regular.
Se dibuja a 932×430 a 2×, el tamaño del iPhone 15 Pro Max en horizontal a la resolución del juego.

La cifra de **parpadeo** es la media de |siguiente − 2·actual + anterior| por píxel, sobre el 70 % superior de la imagen.
Un borde suavizado se aclara poco a poco al cruzar un píxel y da casi 0. Un borde sin suavizar salta de un color a otro y
vuelta, y da un valor alto.

Medido con WebGL por software, que sirve para el aspecto, no para FPS.

| Vista | Parpadeo antes | Ahora | Píxeles peores (p99,9) antes | Ahora |
|---|---|---|---|---|
| Plaza hacia la fila este (40–80 m) | 3,31 | 2,18 (−34 %) | 121 | 54 (−55 %) |
| Calle norte hacia la plaza | 2,84 | 2,02 (−29 %) | 78 | 43 (−45 %) |
| Fachadas a ~70 m con el visor 8× | 2,72 | 1,73 (−36 %) | 71 | 35 (−51 %) |

Imagen: `docs/img/parpadeo-antes-ahora.jpg`. Arriba se ve una casa a unos 60 m; abajo, el mapa de parpadeo (blanco =
parpadea).

**Rendimiento en el PC** (GTX 1050 Ti, a la resolución del iPhone, ARENA y PUEBLO, dos rondas alternas): 60 FPS con y sin
suavizado, p99 de 16,8 ms en todas, y el mismo tiempo de dibujo en la CPU (unos 2,3–2,5 ms en PUEBLO).

**En el iPhone está sin medir.** Los iPhone resuelven el MSAA dentro de la GPU y suele costar poco, pero hay que confirmarlo
con MEDIR RENDIMIENTO. Si bajara, el modo AUTO baja la resolución solo y la casilla lo apaga.

## Lo que queda
- **Lo que aún chispea con el suavizado:** los cristales y barrotes de las ventanas más lejanas, y los toldos de rayas.
- **Siguiente paso si hiciera falta:** un nivel de detalle para los barrotes a más de unos 50 m (calculado con la distancia
  aparente, para que con el visor vuelvan).

## 03-11-2026 — Segunda pasada: rejas lejanas y medidas con la GPU real
El propietario: «vuelve a hacerlo y ve mejorando PUEBLO».

- **Medir con la GPU de verdad.** `tools/flicker.js` acepta `GPU=1`: el navegador de pruebas usa la tarjeta del PC
  (GTX 1050 Ti, Direct3D 11) en vez de WebGL por software, que no aplica cosas como el filtrado anisótropo.
- **Referencia de hoy** (suavizado 4× activo): parpadeo 2,18 / 2,03 / 1,74 con software, lo mismo que el 31-10. Con la
  GPU real: 1,91 / 1,79 / 2,16. Sin suavizado (`aa=0`): 3,08 / 2,68 / 3,32. El suavizado sigue siendo lo que más quita.
- **Descartado: filtrado anisótropo 16×** en todas las texturas (variante `xaniso=16`). Con la GPU real da lo mismo
  (1,906 frente a 1,906): las rayas que bailan no son de textura.
- **Hecho: rejas lejanas.** Las barandillas y rejas del kit (barrotes de 2–3 cm, unidos en una malla por barrio) se
  desvanecen entre 40 y 60 m de distancia aparente (la distancia dividida por el aumento: con el visor 8× vuelven). Más
  lejos, un barrote mide menos de medio píxel y solo encendía y apagaba píxeles. El fundido va por *alpha to coverage*
  con el suavizado activo (sin trama de puntos); sin suavizado se cortan a 60 m. Farolas y postes no cambian. Las balas
  nunca usaron esas mallas. `&rejas=0` lo apaga para comparar.
- **Lo que gana es poco:** con la GPU real, en la plaza el parpadeo baja de 1,91 a 1,86 y los peores píxeles (p99,9)
  de 50 a 44. Lo que queda está repartido en todos los bordes lejanos (marcos, contraventanas, aleros, toldos).
- **La medida tiene ruido:** la hierba se mueve con el viento y las ratas andan aunque la cámara esté parada. Una
  variante salió una vez con cifras disparadas (7,4 y 15,8) que no se repiten. Comparar siempre varias pasadas.
- **Siguiente paso posible** (no hecho): un suavizado temporal (TAA) quitaría casi todo el parpadeo restante, pero cuesta
  una pasada de pantalla completa en el iPhone y desenfoca un poco. Solo si el propietario lo quiere probar.

## Pruebas
- `test/ajustes.test.js`: el ajuste nuevo va encendido por defecto, se puede apagar y RESTAURAR lo vuelve a encender.
- `test/ajustes.browser.test.js`, en el móvil:
  - el modo AUTO, que en el móvil es MEDIO, dibuja con MSAA 4×;
  - con la casilla apagada no hay MSAA.
