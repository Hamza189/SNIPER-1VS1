# Iconos del HUD de SNIPER DUEL

Diseño original hecho por código (`tools/hud-icons/icons.js`), sin copiar PUBG ni COD Mobile: solo se ha tomado de ellos
la idea de claridad. Licencia: la del juego (todos los derechos reservados).

Regenerar todo: `node tools/hud-icons/make.js` (SVG, PNG, hoja de sprites, vistas previas, JSON y `client/hudicons.js`).

## Estilo
- Rejilla de 64 × 64; el dibujo cabe en 14–50; base circular de radio 30.
- Línea de grosor constante (3,5) con extremos y uniones redondeadas: se lee bien a 40 px en un móvil.
- Colores: blanco hueso `#f2efe8` sobre fondo oscuro translúcido. Ámbar `#ffb020` solo para «activo». Rojo `#ff4b3e`
  solo para alertas (RECARGAR con el cargador vacío).

## Estados
| Estado | Aspecto | Cuándo |
|---|---|---|
| normal | dibujo claro, base oscura translúcida | siempre |
| pressed (pulsado) | invertido: base clara, dibujo oscuro | el dedo está encima |
| active (activo) | aro y dibujo ámbar | interruptor encendido (toggle) |
| alert (alerta) | aro rojo | solo RECARGAR sin balas |

En el juego (`?hud=2`) se usa el dibujo solo (`client/hudicons.js`, color `currentColor`) y los estados los pone el CSS del
botón, así que un único dibujo sirve para los cuatro.

## Iconos
| Nombre | Acción | ¿Interruptor? | Estados |
|---|---|---|---|
| `peak_left` | Asomarse a la izquierda | Sí (móvil: toque = inclina, otro toque = vuelve; o mantener, en AJUSTES) | normal, pressed, active |
| `peak_right` | Asomarse a la derecha | Sí (igual) | normal, pressed, active |
| `aim_ads` | Apuntar con la mira | Solo con MIRA en modo PULSAR | normal, pressed, active |
| `fire_main` | Disparar | No | normal, pressed |
| `reload` | Recargar | No | normal, pressed, alert |
| `crouch` | Agacharse / deslizarse | Sí (móvil) | normal, pressed, active |
| `jump` | Saltar | No | normal, pressed |
| `fire_left` | Disparar (botón izquierdo opcional) | No | normal, pressed |
| `weapon_swap` | Cambiar de arma | No | normal, pressed |
| `knife` | Navaja | No | normal, pressed |
| `pause` | Pausa | No | normal, pressed |
| `inspect` | Inspeccionar el arma | No | normal, pressed |
| `hold_breath` | Aguantar la respiración | Activo mientras se mantiene | normal, pressed, active |
| `sprint` | Esprintar (indicador del joystick) | Activo mientras se esprinta | normal, pressed, active |
| `inventory` | Inventario | Activo con el inventario abierto | normal, pressed, active |

Siluetas de armas para la barra (rellenas, 120 × 40): `weapon_rifle` (HALCÓN R7), `weapon_shotgun` (FURIA 12),
`weapon_pistol` (VÍBORA 9), `weapon_knife` (NAVAJA).

## Variantes de los iconos dudosos (`icons/variants/`, comparadas en `preview/variants.png`)
| Icono | Variantes | Recomendado y por qué |
|---|---|---|
| `peak_left` / `peak_right` | a) cabeza junto a la esquina y flecha · b) dos flechas y pared · c) flecha y pared | **a**: la cabeza y la flecha dicen «asomarse» y no «cambiar»; izquierda y derecha son espejo exacto y se distinguen al instante por el lado de la flecha. La b se confunde con «cambiar de arma». |
| `inspect` | a) ojo · b) lupa | **a**: la lupa se lee como «buscar». |
| `hold_breath` | a) pulmones · b) aire y pausa | **a**: la b es más abstracta y a 40 px se parece a un menú. |

`fire_left` usa la misma bala que `fire_main` (es la misma acción) más una barra a la izquierda.

## Archivos
- `icons/<nombre>.svg` y `icons/<nombre>_<pressed|active|alert>.svg`, `icons/variants/`, `icons/weapons/`.
- `png/64`, `png/96`, `png/128`, `png/256`: copias PNG con fondo transparente.
- `sprites/hud_icons_128.png` + `sprites/hud_icons_128.json`: hoja de sprites opcional (coordenadas de cada icono).
- `preview/preview_dark.png`, `preview/preview_light.png`, `preview/variants.png`.
- `hud_icons.json`: mapeo nombre → archivo de cada estado, acción, si es interruptor, variantes y la recomendada.
