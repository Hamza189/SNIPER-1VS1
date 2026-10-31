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

## Pruebas
- `test/ajustes.test.js`: el ajuste nuevo va encendido por defecto, se puede apagar y RESTAURAR lo vuelve a encender.
- `test/ajustes.browser.test.js`, en el móvil:
  - el modo AUTO, que en el móvil es MEDIO, dibuja con MSAA 4×;
  - con la casilla apagada no hay MSAA.
