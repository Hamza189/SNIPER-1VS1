# Cuentas, amigos, objetos y monetización — plan (27-10-2026)

Petición del propietario: «toca crear lo de los usuarios… que se guarde en local o nube, tipo inicio de sesión, también
para hacer amigos o simplemente jugar; es opcional, no hay que iniciar sesión para jugar, pero sí para las skins, las armas
y las cajas» y «hay que empezar a ver cómo monetizarlo».

Este documento separa lo que Claude puede hacer ya (gratis, sin servicios nuevos) de lo que **necesita tu aprobación**
(servicios en la nube nuevos, pagos, temas legales). Nada de lo marcado como «decisión» se ha activado.

## 0. Antes de cobrar nada (importante)
- **Estás de baja.** En España, cobrar por una actividad mientras se está de baja (incapacidad temporal) puede ser
  incompatible con la prestación. Antes de activar pagos o anuncios con ingresos, pregúntalo a un gestor o a la
  Seguridad Social. Mientras tanto se puede construir todo y dejarlo apagado.
- Para facturar hace falta estar dado de alta (autónomo) o usar una plataforma que venda por ti («merchant of record»:
  ella cobra, paga el IVA europeo y te transfiere lo tuyo). Ver §4.

## 1. Lo que ya está (27-10-2026)
- **Elegir personaje** antes de la partida (`?pj=pro` y `?pj=mix`): S.W.A.T., FSB, MILITAR o CLÁSICO, con retrato. Se
  guarda en este dispositivo y el rival online lo ve (el servidor solo reenvía un nombre de una lista cerrada; no cambia
  nada del juego).
- Es la base de las «skins»: cada personaje es un objeto con nombre, retrato y licencia.
- **Perfil local (paso A)**: botón PERFIL en el menú (con `?pj=pro`, `?pj=mix` o `?perfil=1`): apodo (es el nombre del
  online), personaje, identificador `SD-XXXX-XXXX`, estadísticas de todas las partidas (contra bots y online) y un
  **código de copia** para pasar el perfil a otro dispositivo (COPIAR CÓDIGO → RESTAURAR). Se guarda en el dispositivo
  (`sniperduel_profile`), siempre, aunque no se abra. Hoy los cuatro personajes son de todos; los objetos de pago, si
  llegan, los concederá el servidor (paso D), nunca este archivo. Código: `client/profile.js`; pruebas:
  `test/profile.test.js` y `test/profile.browser.test.js`.

## 2. Cuentas: cómo hacerlo sin coste y sin contraseñas
Recomendación, por pasos (cada uno se puede publicar solo):

| Paso | Qué | Coste | Estado |
|---|---|---|---|
| A | **Perfil local**: apodo, personaje, estadísticas y objetos en el dispositivo. Jugar nunca pide nada. | 0 € | HECHO (27-10) |
| B | **Cuenta en la nube sin contraseña**: al «crear cuenta» el juego genera una identidad y la guarda con una **llave de acceso (passkey)** del iPhone/Android/Windows (Face ID, huella o PIN). Entrar en otro dispositivo = la misma passkey (iCloud/Google la sincronizan). Sin correos, sin contraseñas que robar, sin servicios externos. | 0 € dentro del plan gratuito de Cloudflare | HECHO (28-10) |
| C | **Amigos**: código de amigo (p. ej. `HAMZA#4821`), solicitudes, lista con «en línea», invitar a una sala privada (las salas ya existen). | 0 € | HECHO (28-10): código de amigo = SD-XXXX-XXXX, solicitudes, invitar a tu sala; «en línea» aún no |
| D | **Inventario en el servidor**: lo que tienes lo concede y lo guarda el servidor (el cliente no puede inventarse una skin). | 0 € | HECHO (28-10): cajas gratuitas, 33 objetos de aspecto, ver `docs/INVENTARIO-Y-CAJAS.md` |

**Hecho (28-10-2026, decisión del propietario: «Sí, cuentas»):** cuentas con **passkey** en el **mismo Worker de
Cloudflare** del online (plan gratuito, sin servicios nuevos): un Durable Object por cuenta y uno de «directorio» para los
retos de entrada. Código: `server/accounts.js` (lo usan igual Cloudflare y el servidor Node de pruebas). En el juego:
PERFIL › **Cuenta en la nube** (con `?pj=pro` mientras se prueba): CREAR CUENTA, ENTRAR, tu código de amigo, AÑADIR,
ACEPTAR/RECHAZAR, INVITAR a tu sala y UNIRSE desde una invitación.
- Seguridad: el servidor guarda solo la **llave pública**; comprueba la firma (ECDSA P-256 o RSA), que la página sea la del
  juego, que el reto sea suyo, de un solo uso y de menos de 5 minutos, y que el contador de la llave no vuelva atrás. Las
  sesiones son fichas aleatorias de las que solo se guarda el resumen (SHA-256); caducan a los 60 días; SALIR la anula.
  Crear cuentas y pedir retos: como mucho 10 por minuto y dirección. Ver `test/accounts.test.js` (23 comprobaciones) y
  `test/cuentas.browser.test.js` (llave virtual de Chromium, servidor local y el motor real de Cloudflare con wrangler dev).
- Pasar de dispositivo: la passkey se sincroniza con iCloud (iPhone/Mac) o con Google (Android/Chrome). En un dispositivo sin
  ella, el móvil puede firmar por QR desde el diálogo del sistema.

Dónde guardar las cuentas (decisión, ya tomada): en el **mismo Worker de Cloudflare** que ya usa el online, con un Durable Object
por jugador (almacenamiento SQLite) o con **D1** (base de datos de Cloudflare). Los dos tienen plan gratuito suficiente
para empezar, pero son productos nuevos en tu cuenta: **Claude no los crea sin tu OK**. Alternativa externa (Supabase,
Firebase): más piezas y datos fuera de Cloudflare; no la recomiendo.

Iniciar sesión con Google/Apple: posible más adelante, pero exige registrar la app en Google/Apple (y para Apple, la
cuenta de desarrollador de 99 $/año). Las passkeys no necesitan nada de eso.

## 3. Objetos: skins, armas y cajas
- **Solo cosméticos**: nada que cambie daño, cadencia, munición, velocidad ni zonas de impacto (no pay-to-win). Las
  zonas de impacto son las mismas para todos los personajes; ya lo comprueba `tools/check-character-hitbox.js`.
- **Cajas (loot boxes) — cuidado legal.** Las cajas de pago con premio al azar están prohibidas en Bélgica, reguladas en
  otros países y en España hay un anteproyecto de ley (2022) que las limita (prohibidas a menores, probabilidades
  visibles, límites de gasto). Recomendación:
  - Cajas **gratuitas**, que se ganan jugando (por partidas, por subir de nivel), nunca compradas con dinero.
  - Lo de pago, **con precio y contenido a la vista** (tienda de skins o pase de temporada).
  - Si algún día se venden cajas al azar: consultar antes a un abogado y mostrar las probabilidades.
- **Armas «clásicas» como aspectos** (ya en la lista de tareas): mismo arma, otro aspecto.
- Licencias: lo que se venda tiene que permitir uso comercial (CC0, CC BY con crédito, o hecho por nosotros).
  Los tres personajes actuales son CC BY 4.0: se pueden vender en el juego **citando al autor** (ya se cita).

## 4. Cómo ganar dinero (de más rápido a más trabajo)
| Opción | Qué hace falta | Comisión / coste | Notas |
|---|---|---|---|
| **Portales de juegos web** (CrazyGames, Poki, GameDistribution, itch.io) | Subir el juego y su SDK (anuncios entre partidas, anuncios con recompensa) | Reparto de ingresos con el portal; sin cuota | La vía más rápida: el público ya está ahí. Algunos piden exclusividad o quitar el online propio: leer las condiciones. **DECISIÓN** |
| **Tienda de cosméticos en la web** | Cuentas (§2 B–D) + un procesador de pagos | Stripe ~1,5 % + 0,25 € por pago en la UE; Paddle / Lemon Squeezy ~5 % + 0,50 € pero hacen ellos el IVA y la factura | Necesita alta fiscal (o «merchant of record»). **DECISIÓN** |
| **Pase de temporada** | Lo anterior + retos y recompensas por nivel | Igual | Funciona bien con partidas cortas como las nuestras |
| **Pack de apoyo / donaciones** (Ko-fi, itch.io «paga lo que quieras») | Un enlace | ~0–10 % | Lo más simple; poco dinero |
| **App en iPhone/Android** | Empaquetar la web (PWA o Capacitor) | Apple 99 $/año; Google 25 $ una vez; las compras dentro de la app pagan 15–30 % | Más adelante; la web en el iPhone ya funciona |

Recomendación para empezar (sin gastar): **1)** perfil local y cuentas con passkey en Cloudflare (gratis);
**2)** preparar una versión para un portal web (CrazyGames o itch.io) con anuncios **solo entre partidas** (nunca durante
el duelo); **3)** tienda de cosméticos cuando haya jugadores. Todo apagado hasta que confirmes lo de la baja (§0).

## 5. Decisiones que necesito del propietario
1. ~~¿Cuentas con **passkey** en el **mismo Cloudflare** (Durable Objects o D1, plan gratuito)? → crear la base de datos.~~ HECHO (28-10)
2. ¿Portal web para monetizar con anuncios (CrazyGames / itch.io / otro)? → leo sus condiciones y preparo la versión.
3. ¿Tienda de cosméticos con Stripe o con un «merchant of record» (Paddle / Lemon Squeezy)?
4. ~~Cajas: ¿de acuerdo con que sean **gratuitas** (ganadas jugando) y lo de pago con precio a la vista?~~ HECHO (28-10) lo
   gratuito: caja de bienvenida, una diaria y puntos por partidas, probabilidades a la vista (`docs/INVENTARIO-Y-CAJAS.md`).
   Lo de pago espera a la decisión 3.
5. Confirmar con un gestor si puedes tener ingresos del juego mientras estás de baja.
