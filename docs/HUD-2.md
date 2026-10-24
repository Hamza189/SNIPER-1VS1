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
