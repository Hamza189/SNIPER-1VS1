# 3ª persona y quickscope (28-10-2026)

Petición del propietario: «poder ver en 3ª persona, cambiar el modo de vista» y «mejorar el quickscope, tanto en PC como
en móvil, lo de apuntar y disparar rápido».

## Quickscope (afecta a todos y al servidor: `core/weapon.js`)
**Antes:** si pulsabas disparar mientras la mira **todavía subía** (aunque faltasen 0,03 s), el tiro salía en el acto con
la mitad de la dispersión de cadera (a 50 m, más de un metro de error). En móvil, con «soltar para disparar», un toque
rápido disparaba al soltar aunque la mira no hubiera salido.

**Ahora:** con el botón de apuntar pulsado y la mira subiendo, el disparo **espera a que salga la mira** (como mucho
`adsTime · scopeAt` = 0,17 s con el HALCÓN R7) y sale exacto por la retícula. Sin apuntar, el disparo de cadera sale en
el acto como siempre. En móvil, el toque rápido sigue subiendo la mira hasta el disparo.
- Solo armas con mira (`quickscope: true` en el rifle de `core/config.js`; pistola y escopeta no cambian).
- No cambia daño, cadencia, munición, balística, dispersión con mira ni zonas de impacto. Es igual para los dos
  jugadores (lo ejecutan el cliente y el servidor con el mismo código).
- Para quitarlo: `quickscope: false` en `core/config.js`.
- Pruebas: `node test/core.test.js` (sección quickscope).

## 3ª persona (solo lo que se ve; el servidor no cambia)
AJUSTES › CONTROLES › **Vista** (1ª / 3ª PERSONA) o la tecla **V** en el PC.
- La cámara va detrás del hombro derecho (2,3 m atrás, 0,55 a la derecha) y se acerca si hay una pared detrás: nunca la
  atraviesa.
- Se ve tu personaje con las mismas animaciones que el rival; con `?pj=pro` es el que elegiste.
- **Con la mira vuelve a 1ª persona exacta.** La bala sale siempre de los ojos; en 3ª persona la cruceta se mueve al
  punto real donde va la bala.
- **Online:** como en todos los juegos con 3ª persona, la cámara puede ver tras una esquina antes de asomar el cuerpo.
  **Decisión del propietario (28-10-2026): se permite también en las partidas online** (cada jugador elige su vista).
- Prueba: `node test/tp.browser.test.js`.
