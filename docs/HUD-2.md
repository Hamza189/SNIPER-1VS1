# HUD 2 — renovación del HUD y del equipamiento (`?hud=2`)

Todo lo de este documento va tras la bandera `?hud=2`. Sin ella el juego es exactamente el de siempre.
Estado: ver la última sección.

## 1. Auditoría (24-10-2026, antes de tocar nada)

### HUD actual
- **DOM** en `src/page.html` (`#hud`): brújula y marcador arriba, registro de bajas arriba a la derecha, salud abajo a la
  izquierda (`#vitals`), munición abajo a la derecha (`#ammo`: balas en «pips», número, `/∞` y `#wname` con el nombre del
  arma y la tecla). En móvil (`body.touch`) salud y munición suben a la esquina superior izquierda, junto a PAUSA.
- **Botones táctiles** (`#touch`, `.tb` con texto: FUEGO, MIRA, AGACH, SALTO, R, AIRE, 8×, ARMA, INSP, FUEGO izquierdo,
  II). Posición/tamaño en `client/layout.js` (puro, anclados a una esquina, `touchLayout` en `localStorage`).
  Multitáctil en `client/touch.js` (puro: un dedo = un botón, joystick flotante en el 42 % izquierdo, el resto gira la
  cámara). Visibilidad dinámica por fotograma en `frame()` (AIRE y 8× solo con la mira; INSP oculto al apuntar).
- **Editor de HUD**: solo botones táctiles. Mueve (arrastrar), tamaño por botón, opacidad global; GUARDAR / RESTAURAR /
  CANCELAR. No hay visibilidad por botón ni elementos que no sean botones.
- **Ajustes** (`client/settings.js`, versión 3 con migración): sensibilidades, modo MIRA, FUEGO izquierdo, calidad, audio,
  accesibilidad. No hay teclas configurables.

### Armas y equipamiento
- `core/melee.js` (cargador de equipo): ranuras `rifle` (= «mi principal»: HALCÓN R7 o FURIA 12), `pistol` (VÍBORA 9) y
  `knife` (NAVAJA TÁCTICA). Cambiar = enfundar y desenfundar con tiempos de `core/config.js` (`loadout`). La otra
  principal **no se puede sacar**: `setPrimary` solo al reaparecer (`PRIMARY` en la página, `kit` en el servidor).
- `core/weapon.js`: una máquina de estados por arma (cargador propio, cerrojo/corredera/bombeo, recarga que se pausa
  enfundada). **Munición de reserva: no existe, es ilimitada** (el HUD ya dice `/∞`).
- `core/player.js` corre el mismo `step` en el cliente y en el servidor: el cliente envía `select` (rifle/pistol/knife) en
  el comando y el servidor aplica los tiempos. Teclas 1/2/3 ya existen; el botón táctil ARMA rota principal → pistola →
  navaja. La rueda del ratón solo alterna 4×/8× con la mira.

### Asomarse («peek»)
- **Ya existe en PC**: Q/E mantenidas (`P.lean`). Solo mueve la cámara hasta 0,45 m de lado (con un rayo que la para
  0,25 m antes de una pared) y la inclina un poco. Los bots ven esa posición. La bala sale de la cámara.
- **Online**: el servidor acepta el origen del disparo si está a menos de 0,9 m del ojo y hay línea de visión entre ambos
  (`core/room.js`, `maxOriginDist`), así que disparar asomado ya funciona. **Pero las zonas de impacto del servidor no
  se mueven con el asomado** y el rival no lo ve (no viaja en el protocolo). Es una ventaja que ya existe hoy en PC.
- No hay botones de asomarse en móvil.

### Estructura técnica propuesta
- `client/hud2.js` (nuevo, puro, con pruebas en Node): modelo de la barra de armas (qué ranura, nombre, munición,
  estado), modelo del inventario (solo lo que existe en el juego), diseño del HUD 2 (botones + barra, con posición,
  tamaño, opacidad y visibilidad por elemento; `hudLayout2` con migración desde `touchLayout`), teclas configurables.
- `client/hudicons.js` (generado): los iconos SVG en línea para que la página siga siendo un único archivo.
- `assets/hud/`: el pack de iconos (SVG, PNG 64/96/128/256, hoja de sprites, vistas previas, `HUD_ICONS.md`, JSON).
- `src/page.html`: todo lo nuevo dentro de `if (HUD2)`; los botones táctiles nuevos (asomarse ×2, inventario) solo
  existen con la bandera. Ni `core/` ni `server/` cambian: **ninguna regla, daño, balística ni zona de impacto cambia**.
- Asomarse en móvil: reutiliza exactamente la mecánica de PC (mismo `P.lean`, mismo límite de 0,45 m que el servidor ya
  acepta). Que las zonas de impacto sigan al asomado sería un cambio del servidor → **pregunta abierta al propietario**.

## 2. Iconos (fase 2)
Pack original en `assets/hud/` (detalle en `assets/hud/HUD_ICONS.md`): 15 iconos de botón con estados normal, pulsado,
activo y alerta; variantes de los dudosos (asomarse, inspeccionar, aguantar la respiración) con la recomendada; siluetas
de las 4 armas; PNG 64/96/128/256; hoja de sprites; vistas previas sobre fondo oscuro y claro; `hud_icons.json`.
Se generan por código: `node tools/hud-icons/make.js` (también escribe `client/hudicons.js`, 6 KB, lo que usa el juego).

## 3. Lo que hace `?hud=2` (fases 3–6)
| Pieza | Cómo funciona | Reglas que respeta |
|---|---|---|
| **Botones con iconos** | El mismo botón táctil de siempre, con icono en vez de texto (el nombre queda para accesibilidad). Pulsado = invertido; activo (MIRA en modo pulsar, AGACH, AIRE, asomarse) = ámbar; RECARGAR en rojo con el cargador vacío. Con la navaja, FUEGO muestra la navaja. | Ninguna nueva |
| **Barra de armas** abajo, semitransparente | Principal / VÍBORA 9 / NAVAJA con silueta, nombre (expandida), munición `cargador/∞` y tecla. Activa con borde ámbar; la pedida parpadea mientras se guarda la actual; destello al sacarla; barra de progreso al recargar; número en rojo sin balas; «SIGUIENTE: FURIA 12» si eliges la otra principal en partida. Con la mira puesta baja al 35 % de opacidad. | Un toque pide el arma con el mismo `select` de siempre: guardar + sacar con los tiempos de `core/config.js`, igual en el servidor. La otra principal solo al reaparecer. |
| Toque en la barra (móvil) | Selecciona al **levantar** el dedo. Si el dedo se desliza más de 14 px, no era para la barra: pasa a ser joystick (o cámara) desde donde tocó, porque la barra está en la parte baja de la zona del joystick. | — |
| PC | Teclas 1/2/3 (como siempre) y rueda del ratón opcional (AJUSTES › CONTROLES, desactivada por defecto; con la mira la rueda sigue cambiando el zoom). | — |
| **Inventario táctico** | Mochila al final de la barra, tecla I o Tab. Armamento (estado, tiempo de sacar, munición y reserva ∞), arma principal al reaparecer (con el aviso «SE APLICARÁ EN EL PRÓXIMO RESPAWN»), estado (salud, aire, arma pendiente) y restricciones. En móvil se toca para equipar o elegir la principal; en PC, con el ratón capturado, es informativo. No pausa la partida. | Solo lo que existe: no hay objetos inventados. Las categorías están preparadas para objetos futuros, que antes tendrían que existir en el servidor. |
| **Asomarse** | PC: Q/E como siempre (configurables, MANTENER o PULSAR). Móvil: dos botones a la izquierda, por encima del joystick; PULSAR (por defecto) = un toque inclina y se queda, otro vuelve; MANTENER = mientras se pulsa. Se puede apuntar y disparar asomado. | Es la inclinación de cámara que ya existía (máx. 0,45 m, nunca a través de una pared); el servidor ya acepta ese origen del disparo (≤ 0,9 m del ojo). **Zonas de impacto y balística sin cambios.** |
| **Editor de HUD** | Botones y barra: posición (arrastrar), tamaño, opacidad global y por elemento, visible/oculto (PAUSA no se puede ocultar), barra compacta o expandida. Se guarda en `hudLayout2`; la primera vez parte de los botones que el jugador ya movió (`touchLayout`), que no se toca. La barra por defecto encoge o se aparta si fuera a tapar un botón (iPhone 8 apaisado incluido). | Datos guardados rotos o trucados se limitan (tamaños, opacidades, posiciones). |

Sin la bandera, el juego es exactamente el de siempre (comprobado en `test/hud2.browser.test.js`).

## 4. Pregunta abierta para el propietario: asomarse y las zonas de impacto
Asomarse mueve **solo la cámara** (y el origen de la bala). Las zonas de impacto del servidor no se mueven y el rival no ve
la inclinación. Esto ya pasa hoy en PC con Q/E; con `?hud=2` también se puede hacer en el móvil. En una esquina, quien
se asoma ve y dispara desde 45 cm a un lado mientras su cabeza sigue detrás de la pared en el servidor.
Opciones (necesitan tu aprobación porque cambian reglas del servidor):
1. Dejarlo como está (igual para los dos jugadores, ya existe en PC).
2. Que el servidor mueva la cabeza y el pecho con la inclinación (viaja en el comando; el rival lo ve inclinado). Es lo
   justo, pero cambia las zonas de impacto y el protocolo: requiere pruebas del servidor y tu OK.
3. Limitar el asomado a menos distancia (p. ej. 0,25 m).

## 5. Pruebas
- `node test/hud2.test.js` (47): barra, inventario, diseño y migración, teclas, iconos.
- `node test/hud2.browser.test.js` (56, Chromium real): sin bandera nada cambia; PC (1/2/3, rueda, munición al disparar
  y recargar, cargador vacío, principal en el próximo respawn, inventario, Q/E mantener y pulsar, tecla nueva desde
  AJUSTES, disparo apuntando y asomado, coste por fotograma ~3 µs); móvil con multitáctil real (toques en la barra,
  deslizar = joystick, inventario, joystick + asomarse + MIRA + FUEGO a la vez, editor guardado y restaurado al recargar,
  migración); online con servidor local (el servidor cambia de arma con las teclas y acepta y cuenta un disparo hecho
  apuntando y asomado).
- Capturas: `node tools/capture-hud2.js` → `docs/hud2/` (iPhone 15 Pro Max, iPhone 8, Samsung, PC; actual vs HUD 2,
  inventario y editor). WebGL por software: sirven para el aspecto, no para FPS.
- Rendimiento: el HUD es DOM, no WebGL (no añade llamadas de dibujo ni triángulos). La actualización por fotograma solo
  toca el DOM cuando cambia lo que se ve (~3 µs por fotograma medidos en el PC de pruebas).

## 6. Cómo volver atrás
Basta con no usar `?hud=2`. Para quitarlo del código: revertir los commits «HUD 2: …». Los ajustes guardados del HUD 2
(`sniperduel_hudLayout2` y las teclas de asomarse) no afectan al juego sin la bandera.

## 7. Añadido el 25-10-2026 (petición del propietario)
- Fondo de la barra de armas regulable (AJUSTES › CONTROLES › HUD 2 y en el editor): 0 = transparente, solo armas y números con sombra.
- AJUSTES › CONTROLES › Agacharse (para todos, no solo con ?hud=2): PULSAR · TE LEVANTAS AL DESLIZAR (por defecto en móvil), PULSAR, MANTENER (por defecto en PC, como siempre). Solo cambia la entrada; el movimiento y el servidor no cambian.
