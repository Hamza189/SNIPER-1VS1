# Sniper Duel — 1v1 online (alfa privada)

## Cómo se juega con dos móviles

1. Los dos abrís **https://hamza189.github.io/SNIPER-1VS1/** (iPhone: Safari → Compartir → «Añadir a pantalla de inicio» para pantalla completa) y ponéis el móvil en horizontal.
2. Uno pulsa **MULTIJUGADOR** → escribe su nombre → **CREAR SALA**. Sale un código de 6 letras.
3. **COMPARTIR INVITACIÓN** (o COPIAR CÓDIGO) y se envía por WhatsApp. El enlace lleva `?sala=CÓDIGO` y abre el juego directamente en esa sala.
4. La otra persona abre el enlace (o MULTIJUGADOR → UNIRSE con el código), pone su nombre y entra.
5. Quien crea la sala elige el **mapa**: **ARENA DE PRUEBAS** (por defecto, un patio cerrado de 48 × 32 m con un bloque central con rampas a su tejado, muros bajos, muros altos, pilares y cajas: os encontráis enseguida) o **PUEBLO** (el mapa grande). La otra persona ve la elección.
6. Los dos pulsáis **LISTO**. El servidor hace una cuenta atrás de 3 s y empieza la partida, cada uno en un lado del pueblo.
7. Gana el primero que llegue a **10 bajas**. Al terminar: **REVANCHA** (los dos) y empieza otra partida sin recargar.

Reglas: 100 de vida, regeneración tras 5 s sin daño, reaparición a los 3 s con el cargador lleno, rifle HALCÓN: cabeza 250 / torso 85 / piernas 55; pistola VÍBORA 9 (tecla 2, o ARMA en el móvil): 12 balas, semiautomática, cabeza 90 / torso 34 / piernas 26, con menos daño a partir de 18 m (60 % a 55 m o más); navaja 50 de frente y 100 por la espalda. El servidor comprueba la munición, la cadencia, los impactos y el daño de las tres armas. Si los dos llegáis a 10 en el mismo instante es **EMPATE**.

## Lo que pasa cuando algo falla

| Situación | Qué hace el juego |
|---|---|
| Uno bloquea el móvil, cambia de app o pierde la red | La partida se **pausa para los dos** (RECONECTANDO). Al volver, recupera su plaza con su token y sigue. |
| No vuelve en 60 s | Gana el que se quedó (abandono). |
| Alguien sale de la sala | El otro gana por abandono y puede ESPERAR OTRO RIVAL en la misma sala. |
| Un tercero intenta entrar | «ESA SALA ESTÁ LLENA». |
| Código que no existe o sala caducada | «ESA SALA NO EXISTE». |
| Sala abierta 15 min sin jugar | Se cierra sola (aviso en pantalla). |
| El servidor no responde | «SERVIDOR NO DISPONIBLE». El modo offline (bots y campo de tiro) sigue funcionando. |

El panel **F3** (en PC; en móvil desde Pausa → PANEL TÉCNICO) muestra la versión (commit), el estado de la conexión, la sala, el ping, las instantáneas por segundo, los comandos enviados/confirmados, la corrección de predicción, el último disparo aceptado o rechazado y los errores recientes.

## Cómo funciona (resumen)

- El servidor es **autoritativo**: ejecuta los comandos de cada jugador con el mismo código de movimiento y arma que el móvil (`core/player.js`), y decide munición, cerrojo, recarga, balas (parábola real a 600 m/s contra los mismos triángulos del mapa que se ven), daño, muertes, marcador y ganador.
- El móvil **predice** su propio movimiento y disparo para que respondan al instante; cuando llega la confirmación del servidor no cambia nada porque la simulación es la misma (las pruebas miden 0 m de corrección).
- El rival se dibuja **110 ms en el pasado**, interpolado, para que se mueva suave.
- **Compensación de latencia acotada:** cada bala se prueba contra el rival donde lo veía quien disparó (como máximo 250 ms atrás). Para acertar a alguien que corre solo hay que anticipar el vuelo de la bala, no el ping. Contrapartida: quien acaba de ponerse a cubierto puede recibir un impacto hasta 250 ms después.
- Protocolo completo y límites: [`PROTOCOLO.md`](PROTOCOLO.md).

## Qué está comprobado y qué no

**Comprobado automáticamente** (en este entorno y en cada publicación desde GitHub):
- Sala, entrada, tercero rechazado, código inexistente, inicio único, verse, moverse (sprint, slide, salto, agachado), disparar, headshot/torso/piernas, pared que bloquea, munición, cerrojo, recarga, disparos duplicados, navaja, muerte, reaparición, marcador, victoria, empate, revancha, mensajes antiguos y mal formados, pausa y reconexión, socket mudo, latencia 20–250 ms con jitter y picos de pérdida, rival en movimiento con compensación, estrés.
- Dos navegadores Chromium reales jugando una partida contra la **página pública** y el **servidor público** (flujo «Prueba pública online» en GitHub Actions).

**Pendiente de comprobar a mano** (nadie lo ha probado todavía):
- Safari de iPhone y Chrome de Android de verdad, con los dedos.
- Dos redes distintas (por ejemplo, uno en Wi-Fi y el otro con datos).
- Bloquear el iPhone a mitad de partida y volver.
- FPS reales y calentamiento del móvil después de 10 minutos.

### Prueba final con los dos móviles

| # | Paso | Qué debe pasar |
|---|---|---|
| 1 | Móvil A abre el juego | Menú normal, sin pantallas de error |
| 2 | Móvil B abre el juego | Igual |
| 3 | A: MULTIJUGADOR → CREAR SALA | Código de 6 letras y ESPERANDO AL SEGUNDO JUGADOR |
| 4 | B abre el enlace de WhatsApp | Entra en la sala de A; los dos veis los dos nombres |
| 5 | Los dos LISTO | Cuenta atrás 3-2-1 a la vez |
| 6 | Moveos | Cada uno ve al otro moverse suave, sin saltos |
| 7 | Disparad | Se ve el fogonazo y se oye el disparo del rival |
| 8 | Acertad | El que recibe ve su vida bajar; el que acierta ve el marcador de impacto |
| 9 | Uno muere | Pantalla de muerte, reaparece a los 3 s |
| 10 | Marcador | Los dos veis el mismo resultado arriba |
| 11 | Bloquea un iPhone 10 s y vuelve | El otro ve RECONECTANDO; al volver sigue la partida |
| 12 | Hasta 10 bajas | Los dos veis el ganador correcto (VICTORIA / DERROTA) |
| 12b | Saca la pistola (2 / ARMA) y dispara | El rival ve la pistola en tu mano y oye un disparo más seco; quita mucho menos que el rifle; recarga con R |
| 13 | REVANCHA los dos | Empieza otra partida 0–0 sin recargar |
| 14 | Juega 10 minutos | Sin tirones fuertes; anota el ping del panel y si el móvil se calienta |

Si algo falla, apunta el número del paso, abre el panel técnico y haz una captura.

## Coste y límites (Cloudflare, plan gratuito)

Workers + Durable Objects con SQLite están incluidos en el plan gratuito: 100.000 peticiones al día y 13.000 GB·s de duración al día (unas 28 horas de sala activa). Una partida de 10 minutos usa unos pocos miles de peticiones. Si se pasara del límite diario, el servidor dejaría de aceptar conexiones hasta las 02:00 (00:00 UTC); no se cobra nada sin cambiar de plan.

## Publicación y cómo volver atrás

- **Página:** cada `git push` a `main` la publica GitHub Pages en 1–2 minutos.
- **Servidor:** el flujo «Desplegar servidor» lo publica en Cloudflare si cambian `core/`, `server/`, `client/netcore.js` o `wrangler.toml`. Antes ejecuta las pruebas del núcleo y de la sala, y después prueba el servidor público con dos clientes.
- **Volver a una versión anterior:**
  1. `git revert <commit>` (o `git revert HEAD` para el último cambio) y `git push`: se republican la página y el servidor de la versión anterior.
  2. Solo el servidor y con prisa: panel de Cloudflare → Workers y Pages → `sniper-duel` → Implementaciones → elegir la anterior → **Revertir**.
- La última versión estable conocida es la que tiene en verde los flujos «Desplegar servidor» y «Prueba pública online» en la pestaña Actions de GitHub.
