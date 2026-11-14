# LA FUENTE de la plaza (14-11-2026)

El propietario: «mejórame la fuente del medio, el agua parece de Minecraft». Antes el agua era un plano verde azulado,
quieto y opaco (`MAT.water`) y la taza era otro disco plano del kit.

Estado: **IMPLEMENTADO · PROBADO EN NAVEGADOR (capturas en software) · PENDIENTE DE VALIDACIÓN EN IPHONE/PC/ANDROID**.
Por defecto; `?fuente=0` deja el agua de antes, para comparar.

## Qué tiene ahora (`client/fuente.js`, `SDFuente.build`)
| Pieza | Cómo | Llamadas |
|---|---|---|
| Agua de la pila (5 × 5 m, a 0,60 m) | `MeshStandardMaterial` con el sombreado cambiado (`onBeforeCompile`): 5 ondas que se mueven + ruido fino, anillos donde cae el agua, espuma en las caídas y en los bordes, color y transparencia según el ángulo (de cerca se ve el fondo; de lejos refleja el cielo), brillo del sol. Recibe sombras y niebla como el resto | 1 |
| Fondo de azulejo | el azulejo del pueblo, teñido de agua | 1 |
| Cáusticas | los reflejos de luz que se mueven en el fondo de una piscina (celdas animadas, suma de luz) | 1 |
| Agua de la taza | el mismo material, con los anillos del borbotón | 1 |
| Chorros | 4 caños (salen a 2,6 m/s de la punta del caño y caen a 1,5 m del eje), 4 hilos que rebosan de la taza, el borbotón de arriba y una niebla alrededor de cada chorro; vetas que corren por el agua | 1 |
| Espuma | 8 manchas que se mueven donde cae el agua | 1 |
| Gotas | 208 puntos que saltan donde cae el agua (todo en la GPU; no en BAJO) | 1 |
| Sonido | agua cayendo (dos capas de ruido filtrado con borboteo), más fuerte cerca de la plaza y por el lado en que está, por el canal AMBIENTE de AJUSTES | — |

Unos 3 200 triángulos y 6–7 llamadas, solo cuando la plaza está a la vista. Sin texturas nuevas. Los chorros solo con
PUEBLO 3.0 (usan los caños de la fuente del kit); en PUEBLO 2.0 solo el agua nueva.

## Reglas de juego intactas
- Ninguna caja ni blanco de bala nuevos: las balas y el servidor ven la fuente de siempre.
- `test/cover.browser.test.js` no cuenta las mallas `fuente_*` como «cobertura falsa»: es agua y se ve a través. Nadie se
  esconde detrás de un chorro.

## Pruebas
- `node test/fuente.test.js`: 9 comprobaciones. Los chorros caen dentro de la pila, lejos del pilar y del borde. Nada
  sale de la pila ni pasa de 3 m. El agua queda por debajo del borde.
- Capturas: `docs/capturas/pueblo31/fuente-*.jpg` (antes y después).
