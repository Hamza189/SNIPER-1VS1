# Inventario y cajas (paso D) — 28-10-2026

Petición del propietario: «Sigue con el inventario en el servidor (paso D) y las cajas gratuitas que se ganan jugando».
Con eso acepta la parte gratuita de la decisión 4 de `docs/CUENTAS-Y-MONETIZACION.md`. Lo de pago sigue apagado.

## Qué hay
- **Inventario en el servidor.** Lo que tienes lo guarda tu cuenta en Cloudflare (el mismo Durable Object de la
  cuenta) y solo el servidor lo concede. El navegador no puede inventarse un objeto: equipar algo que no es tuyo da 403.
- **Cajas gratuitas.** No se compran: solo se ganan jugando.
  - **Caja de bienvenida** al crear la cuenta.
  - **Caja diaria**: una al día; el día cambia a las 00:00 UTC (la 1:00 o las 2:00 en España).
  - **Puntos de caja**: 100 puntos = una caja. Valores en `core/items.js` → `PTS`.

| Partida | Puntos | Quién la cuenta | Límites |
|---|---|---|---|
| Online, ganar | +100 | el servidor de la sala | hacen falta los dos con cuenta, cuentas distintas y más de 1 min jugado (las pausas no cuentan); 1000 al día |
| Online, empatar | +75 | ídem | ídem |
| Online, perder | +50 | ídem | ídem |
| Online, el rival abandona | +50 | ídem | el que abandona no recibe nada |
| Contra bots que disparan, ganar | +25 | este navegador | 100 al día (una caja); 1 min entre partidas; ≥ 45 s de partida |
| Contra bots que disparan, perder | +10 | ídem | ídem |

  Las partidas contra bots las cuenta el navegador, porque el servidor no las ve. Por eso tienen tope diario: como
  mucho alguien con trampas consigue una caja al día. Como mucho se guardan 99 cajas.
- **Probabilidades** (se enseñan en la ventana CAJAS):

| Rareza | Probabilidad |
|---|---|
| Común | 55 % |
| Rara | 30 % |
| Épica | 12 % |
| Legendaria | 3 % |

  Nunca sale algo que ya tienes. Si ya tienes todo lo de esa rareza, sale de la inferior; si no queda nada abajo, de
  la superior. Con todo el catálogo completo, la caja da fragmentos para objetos futuros. El sorteo lo hace el
  servidor con `crypto.getRandomValues`.
- **Objetos (33).** Todos son solo de aspecto: nada cambia daño, cadencia, munición, retroceso, velocidad ni zonas de
  impacto.
  - **16 camuflajes del rifle**: arena, oliva, gris plomo, nieve, bosque, desierto digital, urbano digital, ártico,
    tigre, carbono, cobalto, carmesí, hielo, oro, dragón y neón. Dragón y neón brillan y laten.
    - Se ven en tu rifle de 1ª persona, sobre el HALCÓN R7 o sobre el aspecto de arma que lleves.
    - Hoja de muestras (la dibuja el propio juego): `docs/img/camuflajes.jpg` y `docs/img/camuflajes-aspectos.jpg`
      (`node tools/camo-sheet.js`).
  - **7 colores del punto de la mira** (verde, cian, amarillo, blanco, magenta, naranja, violeta). Mismo tamaño y misma
    posición que el rojo de serie: no ayuda a apuntar.
  - **10 títulos**: se ven en tu cuenta y, junto a tu nombre, en la sala online. Ahí el título lo pone el servidor
    leyendo tu cuenta, no tu navegador.
- Lo que ya era de todos (los 4 personajes y los aspectos de arma) **sigue siendo de todos**: las cajas solo dan
  objetos nuevos.

## Dónde está
- **En el juego** (con `?pj=pro`, `?pj=mix` o `?perfil=1` mientras se prueba):
  - Botón **CAJAS** en el menú, que cuenta las cajas por abrir más la diaria; también PERFIL › Cuenta › CAJAS Y OBJETOS.
  - Arriba: cajas, ABRIR CAJA, RECOGER CAJA DIARIA y la barra de puntos de la siguiente caja.
  - Debajo: pestañas CAMUFLAJES, MIRA y TÍTULOS. Lo bloqueado se ve atenuado; lo tuyo se equipa con un toque.
  - Al abrir una caja, la caja tiembla mientras el servidor sortea y luego se abre con el color de la rareza.
  - Al final de cada partida, los puntos ganados salen en la pantalla de resultados.
- **Código**:
  - `core/items.js`: catálogo, rarezas, probabilidades, puntos y sorteo; lo usan el servidor y la página.
  - `server/accounts.js`: inventario dentro de la ficha de la cuenta y estas rutas:
    - `/cuenta/caja/abrir`
    - `/cuenta/caja/diaria`
    - `/cuenta/equipar {slot, id}`
    - `/cuenta/partida {won, secs}`
  - `server/accounts.js` también tiene `roomAccount` y `matchReward` para la sala.
  - `core/room.js`:
    - mensaje `acct` (la sesión de la cuenta);
    - `opts.account` comprueba la cuenta y pone el título en la sala;
    - `opts.onOver` recibe al terminar las dos cuentas comprobadas y el tiempo jugado.
  - `server/worker.js` y `server/node.js` conectan la sala con las cuentas.
  - `client/camo.js`: dibujo de cada camuflaje (canvas 256×256 que se repite) y el retoque del material.
  - `src/page.html`: ventana CAJAS, la caja que se abre, equipar, mira y puntos al final.
- **Pruebas**:
  - `test/accounts.test.js`, sección INVENTARIO Y CAJAS: bienvenida, diaria, abrir sin repetir, probabilidades con
    20 000 cajas, equipar solo lo tuyo, topes contra bots y online, sin dobles premios y máximo de 99.
  - `test/room.test.js`, sección CUENTAS EN LA SALA: título comprobado y limpio, ficha mal formada, cuentas y tiempo
    jugado sin pausas al terminar, servidor sin cuentas.
  - `test/cajas.browser.test.js`: página real con passkey virtual, todo el recorrido, más el título que ve el rival.

## Cómo se ve el camuflaje (y lo que cuesta)
- El dibujo se proyecta por los tres ejes del arma, sin depender de sus UV, y conserva el detalle de la textura
  original (grabados y sombras).
- Solo se pinta el cuerpo y la mira: nunca lentes, cañón ni piezas pequeñas.
- El material se clona: los rifles de los bots y del rival no cambian.
- Coste:
  - mismas llamadas de dibujo;
  - tres lecturas de textura más por píxel del rifle;
  - un programa de sombreado más, que se compila en el menú al equipar.
- **PENDIENTE DE VALIDACIÓN EN IPHONE**: se ha medido en el escritorio con WebGL por software, no en el móvil.

## Pendiente
- Que el rival online vea tu camuflaje y tu aspecto de arma (hoy solo tu 1ª persona). Hace falta mandar el arma en la
  sala, y el servidor la leería de tu cuenta como el título.
- Camuflaje en tu 3ª persona.
- Usar los fragmentos cuando lleguen objetos nuevos; añadir más objetos al catálogo (p. ej. el 5º personaje).
- Tienda con precio a la vista: decisiones 2, 3 y 5 del plan de monetización.
